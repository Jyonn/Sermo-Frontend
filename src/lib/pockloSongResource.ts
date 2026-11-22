import {useEffect,useState} from 'react';
import {API_BASE_URL} from './siteConfig';
import {SongError,type SongMetadata,type SongPlayback,type SongReference} from './pockloSong';
import {pockloShareToken} from './pockloShare';
import {ShareResourceCache} from './shareResourceCache';

export async function fetchSong<T>(path:string,signal:AbortSignal):Promise<T>{
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted)controller.abort();
  const timer=setTimeout(abort,12000);
  try{
    const response=await fetch(API_BASE_URL+path,{signal:controller.signal,cache:'no-store',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new SongError(response.status);
    return await response.json();
  }finally{clearTimeout(timer);signal.removeEventListener('abort',abort)}
}
const METADATA_TTL_MS = 60_000;
const COVER_EXPIRY_MARGIN_MS = 15_000;
type CoverLease = {url?: string; version: number};
const metadata = new ShareResourceCache<SongMetadata>();
const covers = new ShareResourceCache<CoverLease>();

function readSong(token: string, id: string, version?: number, refresh = false) {
  const key = `${token}:${id}`;
  const cached = metadata.get(key);
  const versionChanged = cached !== undefined && version !== undefined && cached.version < version;
  return metadata.load(key, async () => {
    const song = await fetchSong<SongMetadata>(`/users/pocklo/shares/${token}/song`, new AbortController().signal);
    if (song.schema !== 'pocklo.song.v1' || song.song_id !== id) throw new SongError(503);
    return {value: song, validUntil: performance.now() + METADATA_TTL_MS};
  }, refresh || versionChanged);
}

function readCover(token: string, song: SongMetadata, refresh = false) {
  const key = `${token}:${song.song_id}`;
  const cached = covers.get(key);
  return covers.load(key, async () => {
    const started = performance.now();
    const startedAt = Date.now();
    const media = await fetchSong<SongPlayback>(`/users/pocklo/shares/${token}/playback`, new AbortController().signal);
    if (media.song_id !== song.song_id) throw new SongError(503);
    const validUntil = started + Date.parse(media.expires_at) - startedAt - COVER_EXPIRY_MARGIN_MS;
    const url = validUntil > performance.now() ? media.cover?.url : undefined;
    return {value: {url, version: media.version}, validUntil};
  }, refresh || !!cached && cached.version !== song.version);
}

type SongState = {key?: string; song?: SongMetadata; cover?: string; error?: number; loading: boolean};

function useSongRead(reference: SongReference | null, enabled: boolean, fetchCover: boolean) {
  const token = reference ? pockloShareToken(reference.canonical_url) : null;
  const id = reference?.song_id;
  const version = reference?.version;
  const key = token && id ? `${token}:${id}` : undefined;
  const [state, setState] = useState<SongState>(() => {
    const song = key ? metadata.get(key) : undefined;
    const lease = key && fetchCover ? covers.get(key) : undefined;
    return {key, song, cover: song && lease?.version === song.version ? lease.url : undefined, loading: enabled && !song};
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled || !key || !token || !id) {
      setState({loading: false});
      return;
    }
    let live = true;
    const refresh = revision > 0;
    async function load(token: string, id: string, key: string) {
      try {
        let song = await readSong(token, id, version, refresh);
        let cover: string | undefined;
        if (live && fetchCover && song.available && song.cover) {
          try {
            const lease = await readCover(token, song, refresh);
            if (lease.version !== song.version) song = await readSong(token, id, lease.version, true);
            if (lease.version === song.version && song.available) cover = lease.url;
          } catch (error) {
            // A cover error does not prevent an available song from playing.
            if (error instanceof SongError && (error.status === 404 || error.status === 410)) throw error;
          }
        }
        if (live) setState({key, song, cover, loading: false});
      } catch (error) {
        const status = error instanceof SongError ? error.status : 503;
        if (status === 404 || status === 410) {
          metadata.invalidate(key);
          covers.invalidate(key);
        }
        if (live) setState({key, error: status, loading: false});
      }
    }
    if (refresh) setState({key, loading: true});
    void load(token, id, key);
    return () => {live = false;};
  }, [key, token, id, version, enabled, fetchCover, revision]);

  const current: SongState = enabled && state.key === key ? state : {loading: enabled && !!key};
  return {...current, retry: () => setRevision(value => value + 1)};
}

/** Lyrics use the same complete /song response as the cards. Playback signs its own audio. */
export function useSongMetadata(reference: SongReference | null, open: boolean) {
  return useSongRead(reference, open, false);
}

export function useSongResource(reference: SongReference) {
  return useSongRead(reference, true, true);
}

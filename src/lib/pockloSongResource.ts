import {useEffect,useState} from 'react';
import {API_BASE_URL} from './siteConfig';
import {SongError,type SongMetadata,type SongPlayback,type SongReference} from './pockloSong';
import {pockloShareToken} from './pockloShare';

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
type Entry={promise:Promise<{song:SongMetadata;cover?:string}>;controller:AbortController;users:number};
const pending=new Map<string,Entry>();
export function useSongResource(reference:SongReference){
  const [state,setState]=useState<{song?:SongMetadata;cover?:string;error?:number;loading:boolean}>({loading:true});
  const [revision,setRevision]=useState(0);
  const token=pockloShareToken(reference.canonical_url)!;
  useEffect(()=>{
    let live=true;setState({loading:true});
    let entry=pending.get(token);
    if(!entry){
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);const base='/users/pocklo/shares/'+token;
      const created:Entry={controller,users:0,promise:Promise.resolve({song:null as unknown as SongMetadata})};
      created.promise=(async()=>{
        let song=await fetchSong<SongMetadata>(base+'/song',controller.signal);
        if(song.song_id!==reference.song_id||song.schema!=='pocklo.song.v1')throw new SongError(503);
        let cover:string|undefined;
        if(song.available&&song.cover){
          try{
            const media=await fetchSong<SongPlayback>(base+'/playback',controller.signal);
            if(media.song_id!==song.song_id)throw new SongError(503);
            if(media.version!==song.version)song=await fetchSong<SongMetadata>(base+'/song',controller.signal);
            cover=media.cover?.url;
          }catch(error){
            // A failed cover must not prevent an otherwise valid song from playing.
            if(error instanceof SongError&&(error.status===404||error.status===410))throw error;
          }
        }
        return {song,cover};
      })().finally(()=>{clearTimeout(timer);if(pending.get(token)===created)pending.delete(token)});
      pending.set(token,created);entry=created;
    }
    const subscription=entry;subscription.users++;
    void subscription.promise.then(result=>{if(live)setState({...result,loading:false})}).catch(error=>{if(live)setState({loading:false,error:error instanceof SongError?error.status:503})});
    return()=>{live=false;subscription.users--;queueMicrotask(()=>{if(subscription.users===0){subscription.controller.abort();if(pending.get(token)===subscription)pending.delete(token)}})};
  },[token,reference.song_id,revision]);
  return {...state,retry:()=>setRevision(v=>v+1)};
}

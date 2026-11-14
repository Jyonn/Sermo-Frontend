import {useEffect} from 'react';
import {useI18n} from '../lib/language';
import {useMusicPlayer} from '../lib/musicPlayer';
import {type SongReference,songLyrics} from '../lib/pockloSong';
import {useSongResource} from '../lib/pockloSongResource';
import {MusicPreview} from './NeteaseMusicPreview';

export function PockloSongCard({reference}:{reference:SongReference}){
  const {t}=useI18n(),player=useMusicPlayer();const state=useSongResource(reference);
  const error=state.error??(state.song&&!state.song.available?410:0);
  useEffect(()=>{if((error===404||error===410)&&player.music?.canonical_url===reference.canonical_url)player.close()},[error,reference.canonical_url]);
  if(error||state.loading)return <article className="pocklo-song-state" aria-busy={state.loading}><span className="material-symbols-outlined" aria-hidden="true">{error?'music_off':'music_note'}</span><div><strong>{reference.title}</strong><p role={error?'status':undefined}>{t(state.loading?'common.loading':error===404?'pocklo.songRevoked':error===410?'pocklo.songMissing':'pocklo.songFailed')}</p></div>{error!==404&&error!==410&&error?<button type="button" onClick={state.retry}>{t('common.retry')}</button>:null}</article>;
  const song=state.song!;
  return <MusicPreview music={{...reference,title:song.title,artists:song.artists,album:song.album,version:song.version,duration_ms:song.duration_ms??undefined,cover_url:state.cover,audio_url:'',available:song.available,lyrics:songLyrics(song)}}/>;
}

import {useEffect,useRef,useState} from 'react';
import {useI18n} from '../lib/language';
import {useMusicPlayer} from '../lib/musicPlayer';
import {sameMusic} from '../lib/musicBrand';
import {claimMediaPlayback,releaseMediaPlayback} from '../lib/mediaPlaybackFocus';
import {usePlaybackWait} from './MediaWaitFeedback';
import type {MusicProviderDataDTO} from '../types';

export function SquareMusicCover({music,uri}:{music:MusicProviderDataDTO;uri:string|null}){
  const {t}=useI18n(),player=useMusicPlayer();
  const active=sameMusic(player.music,music),playing=active&&player.playing;
  const failed=active&&player.unavailable;
  return <button type="button" className={`square-note-cover square-note-music${playing?' is-playing':''}`} style={{aspectRatio:1}} onClick={()=>{if(active)player.toggle();else player.play(music)}} aria-label={`${failed?t('common.retry'):playing?t('music.pause'):t('music.play')} · ${music.title}`} aria-pressed={playing} disabled={!music.audio_url}>
    {uri?<img className="square-note-music-backdrop" src={uri} loading="lazy" alt=""/>:null}
    <span className="square-note-disc" aria-hidden="true">{uri?<img src={uri} loading="lazy" alt=""/>:<span className="material-symbols-outlined">music_note</span>}</span>
    <span className="square-note-play-control" aria-hidden="true">{active&&player.loading?<span className="media-wait-spinner"/>:<span className="material-symbols-outlined">{failed?'refresh':playing?'pause':'play_arrow'}</span>}</span>
    <span className="square-note-media-tag" aria-hidden="true"><span className="material-symbols-outlined">music_note</span></span>
    {failed?<span className="square-note-play-status" role="status">{t('common.retry')}</span>:null}
  </button>;
}

export function SquareAudioCover({uri,label,duration,theme,ratio}:{uri:string;label:string;duration:string;theme:number;ratio:number}){
  const {t}=useI18n(),audio=useRef<HTMLAudioElement>(null),wait=usePlaybackWait();
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{const element=audio.current;return()=>{if(element){element.pause();releaseMediaPlayback(element)}}},[uri]);
  const toggle=()=>{const element=audio.current;if(!element)return;if(!element.paused){element.pause();return}if(wait.phase==='error')element.load();claimMediaPlayback(element);wait.start();void element.play().catch(wait.fail)};
  return <><button className={`square-note-cover is-text theme-${theme} square-note-voice${playing?' is-playing':''}`} style={{aspectRatio:ratio}} type="button" onClick={toggle} aria-label={`${wait.phase==='error'?t('common.retry'):playing?t('media.pause'):t('media.play')} · ${label}`} aria-pressed={playing}>
    <span className="square-note-audio"><span className="square-note-wave" aria-hidden="true">{[16,28,21,36,48,30,42,54,36,22,38,26,14].map((height,index)=><i key={index} style={{height}}/>)}</span><strong>{t('square.typeAudio')}</strong><small>{duration}</small></span>
    <span className="square-note-play-control" aria-hidden="true">{wait.visible&&wait.phase!=='error'?<span className="media-wait-spinner"/>:<span className="material-symbols-outlined">{wait.phase==='error'?'refresh':playing?'pause':'play_arrow'}</span>}</span>
    {wait.phase==='error'?<span className="square-note-play-status" role="status">{t('common.retry')}</span>:null}
  </button><audio hidden ref={audio} src={uri} preload="none" onPlay={event=>claimMediaPlayback(event.currentTarget)} onPlaying={()=>{setPlaying(true);wait.ready()}} onPause={()=>{setPlaying(false);wait.stop()}} onEnded={()=>{setPlaying(false);wait.ready()}} onWaiting={wait.waiting} onStalled={wait.waiting} onError={()=>{setPlaying(false);wait.fail()}}/></>;
}

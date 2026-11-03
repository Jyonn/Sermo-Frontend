import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {useI18n} from '../lib/language';
import {claimMediaPlayback,releaseMediaPlayback} from '../lib/mediaPlaybackFocus';
import './SquareVoice.css';

export const voiceTime=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;

/** Shared review player; no native control bar or duplicate audio thumbnail. */
export function SquareVoicePreview({uri,duration,onRemove,disabled=false}:{uri:string;duration:number;onRemove?:()=>void;disabled?:boolean}){
  const {t}=useI18n(),audio=useRef<HTMLAudioElement>(null),attempt=useRef(0);
  const [playing,setPlaying]=useState(false),[waiting,setWaiting]=useState(false),[failed,setFailed]=useState(false),[position,setPosition]=useState(0);
  useEffect(()=>{
    const element=audio.current;
    setPlaying(false);setWaiting(false);setFailed(false);setPosition(0);
    const pause=()=>{if(document.hidden)element?.pause()};
    document.addEventListener('visibilitychange',pause);
    return()=>{attempt.current++;if(element){element.pause();releaseMediaPlayback(element)}document.removeEventListener('visibilitychange',pause)};
  },[uri]);
  useEffect(()=>{if(disabled)audio.current?.pause()},[disabled]);
  const toggle=async()=>{
    const element=audio.current;if(!element||disabled)return;
    if(waiting||!element.paused){attempt.current++;element.pause();setWaiting(false);return}
    const request=++attempt.current;
    if(failed)element.load();
    setFailed(false);setWaiting(true);claimMediaPlayback(element);
    try{await element.play()}catch(cause){if(request===attempt.current){setWaiting(false);setPlaying(false);if(!(cause instanceof DOMException&&cause.name==='AbortError'))setFailed(true)}}
  };
  const elapsed=Math.min(duration,position),progress=duration>0?elapsed/duration:0;
  return <div className={`square-voice-clip${playing?' is-playing':''}${failed?' has-error':''}`}>
    <button className="square-voice-clip-toggle" disabled={disabled} onClick={()=>void toggle()} type="button" aria-label={t(failed?'common.retry':playing||waiting?'audio.pause':'audio.play')}>
      {waiting?<span className="media-wait-spinner"/>:<span className="material-symbols-outlined">{failed?'refresh':playing?'pause':'play_arrow'}</span>}
    </button>
    <div className="square-voice-clip-content">
      <div className="square-voice-clip-caption"><span>{t(failed?'square.voicePreviewFailed':'square.voice')}</span><time>{voiceTime(elapsed)}<small> / {voiceTime(duration)}</small></time></div>
      <input aria-label={t('audio.seekPreview')} disabled={disabled||failed} type="range" min={0} max={Math.max(1,duration)} step={0.1} value={elapsed} style={{'--voice-progress':`${progress*100}%`} as CSSProperties} onChange={event=>{const next=Number(event.target.value),element=audio.current;if(element)try{element.currentTime=next;setPosition(next)}catch{/* Wait for seekable media data. */}}}/>
    </div>
    {onRemove?<button className="square-voice-clip-remove" disabled={disabled} onClick={onRemove} type="button" aria-label={t('common.remove')}><span className="material-symbols-outlined">close</span></button>:null}
    <audio hidden ref={audio} src={uri} preload="metadata" onTimeUpdate={event=>setPosition(event.currentTarget.currentTime)} onPlaying={()=>{setPlaying(true);setWaiting(false);setFailed(false)}} onPause={()=>{setPlaying(false);setWaiting(false)}} onWaiting={()=>setWaiting(true)} onError={()=>{setFailed(true);setPlaying(false);setWaiting(false)}} onEnded={()=>{setPlaying(false);setWaiting(false);setPosition(0);if(audio.current)audio.current.currentTime=0}}/>
  </div>;
}

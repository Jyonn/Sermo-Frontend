import {useEffect,useRef,useState,type CSSProperties,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import {useI18n} from '../lib/language';
import {safeActivityImage} from '../lib/activityPresentation';
import {claimMediaPlayback,releaseMediaPlayback} from '../lib/mediaPlaybackFocus';
import {musicTime} from '../lib/musicLyrics';
import {usePlaybackWait} from './MediaWaitFeedback';
import type {RecordShopAlbum as Album,RecordShopDecoration} from '../types';
import './RecordShop.css';

function RecordShopDisc({cover,playing=false}:{cover:string;playing?:boolean}) {
  const disc=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    const spin=disc.current?.getAnimations?.().find(animation=>'animationName' in animation&&animation.animationName==='record-shop-disc-spin');
    spin?.updatePlaybackRate(playing?4:1);
  },[playing]);
  return <span ref={disc} className="record-shop-disc" aria-hidden="true"><img src={cover} alt="" loading="lazy" draggable={false} /></span>;
}

function RecordShopClip({album,uri,cover,interactive=true,onPlayingChange}:{album:Album;uri:string;cover?:string;interactive?:boolean;onPlayingChange?:(playing:boolean)=>void}) {
  const {t}=useI18n();
  const audio=useRef<HTMLAudioElement>(null);
  const attempt=useRef(0);
  const [playing,setPlaying]=useState(false);
  const [time,setTime]=useState(0);
  const [duration,setDuration]=useState(0);
  const wait=usePlaybackWait();
  const failed=wait.phase==='error';
  const waiting=wait.phase==='loading'||wait.phase==='buffering';
  const label=t(failed?'common.retry':playing||waiting?'music.pause':'recordShop.listen');

  useEffect(()=>{onPlayingChange?.(playing&&!waiting);},[onPlayingChange,playing,waiting]);

  useEffect(()=>{
    const node=audio.current;
    return()=>{
      attempt.current++;
      if(node){node.pause();releaseMediaPlayback(node);}
    };
  },[]);

  const toggle=(event:MouseEvent<HTMLButtonElement>)=>{
    event.stopPropagation();
    const node=audio.current;
    if(!node||!interactive)return;
    if(waiting||!node.paused){
      attempt.current++;
      node.pause();
      releaseMediaPlayback(node);
      wait.stop();
      return;
    }
    const current=++attempt.current;
    if(failed)node.load();
    wait.start();
    claimMediaPlayback(node);
    void node.play().catch(error=>{
      if(current!==attempt.current)return;
      releaseMediaPlayback(node);
      setPlaying(false);
      if(error instanceof DOMException&&error.name==='AbortError')wait.stop();
      else wait.fail();
    });
  };

  const updateDuration=(node:HTMLAudioElement)=>setDuration(Number.isFinite(node.duration)?node.duration:0);
  const statusIcon=wait.visible&&waiting
    ? <span className="media-wait-spinner" aria-hidden="true"/>
    : <span className="material-symbols-outlined" aria-hidden="true">{failed?'refresh':playing||waiting?'pause':'play_arrow'}</span>;
  const playback=<audio hidden ref={audio} src={uri} preload={cover?'none':'metadata'}
    onDurationChange={event=>{if(!cover)updateDuration(event.currentTarget);}}
    onTimeUpdate={event=>{if(!cover)setTime(event.currentTarget.currentTime);}}
    onPlaying={event=>{if(!event.currentTarget.paused){setPlaying(true);wait.ready();}}}
    onPause={event=>{if(event.currentTarget.paused){setPlaying(false);wait.stop();releaseMediaPlayback(event.currentTarget);}}}
    onEnded={event=>{setPlaying(false);wait.stop();releaseMediaPlayback(event.currentTarget);}}
    onWaiting={event=>{if(!event.currentTarget.paused)wait.waiting();}}
    onError={event=>{setPlaying(false);wait.fail();releaseMediaPlayback(event.currentTarget);}}/>;

  if(cover)return <>
    <button type="button" className={`record-shop-message-cover tier-${album.tier}`} aria-label={`${label} · ${album.name}`} title={`${label} · ${album.name}`} disabled={!interactive} aria-pressed={playing} onPointerDown={event=>event.stopPropagation()} onClick={toggle}>
      <RecordShopDisc cover={cover} playing={playing&&!waiting}/>
      <span className={`record-shop-disc-state${waiting||failed?' is-visible':''}`}>{statusIcon}</span>
    </button>
    {playback}
  </>;

  const elapsed=Math.min(time,duration);
  return <div className="record-shop-clip">
    <button className="record-shop-clip-toggle" type="button" onClick={toggle} aria-label={label}>{statusIcon}</button>
    <div className="record-shop-clip-track">
      <input type="range" min={0} max={duration||1} step="any" value={elapsed} disabled={!duration||failed} aria-label={t('music.progress')}
        style={{'--record-clip-position':`${duration?elapsed/duration*100:0}%`} as CSSProperties}
        onChange={event=>{const node=audio.current;if(node){node.currentTime=Number(event.target.value);setTime(node.currentTime);}}}/>
      {failed?<span role="status">{t('recordShop.clipUnavailable')}</span>:<div className="record-shop-clip-times"><time>{musicTime(elapsed)}</time><time>{musicTime(duration)}</time></div>}
    </div>
    {playback}
  </div>;
}

export function RecordShopAlbum({album,onClose,discovery=false}:{album:Album;onClose:()=>void;discovery?:boolean}) {
  const {t}=useI18n();
  const dialog=useRef<HTMLDialogElement>(null);
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{dialog.current?.showModal();},[]);
  const cover=safeActivityImage(album.cover);
  const clip=safeActivityImage(album.clip);
  return createPortal(<dialog ref={dialog} className={`record-shop-album tier-${album.tier}${discovery?' is-discovery':''}`} onClose={onClose} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close();}} aria-label={album.name}>
    <div className="record-shop-album-panel">
      <form method="dialog"><button className="record-shop-close" type="submit" aria-label={t('common.close')}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></form>
      <div className="record-shop-album-visual">
        {discovery?<div className="record-shop-waves" aria-hidden="true"><i/><i/><i/></div>:null}
        {cover?<RecordShopDisc cover={cover} playing={playing}/>:null}
      </div>
      <p>{discovery?t('recordShop.first'):t(`recordShop.tier.${album.tier}`)}</p>
      <h2>{album.name}</h2>
      <span>{album.title}</span>
      {clip?<RecordShopClip key={clip} album={album} uri={clip} onPlayingChange={setPlaying}/>:<small>{t('recordShop.clipUnavailable')}</small>}
    </div>
  </dialog>,document.body);
}

export function RecordShopDecorationView({decoration,interactive=true}:{decoration:RecordShopDecoration;interactive?:boolean}) {
  const {t}=useI18n();
  const album=decoration.album;
  const cover=safeActivityImage(album?.cover);
  const clip=safeActivityImage(album?.clip);
  const portrait=safeActivityImage(decoration.portrait);
  if(album&&cover)return clip
    ? <RecordShopClip key={clip} album={album} uri={clip} cover={cover} interactive={interactive}/>
    : <span className={`record-shop-message-cover tier-${album.tier}`} role="img" aria-label={`${album.name} · ${t('recordShop.clipUnavailable')}`}><RecordShopDisc cover={cover}/></span>;
  return portrait?<img className="record-shop-portrait" src={portrait} alt={t(`recordShop.singer.${decoration.artist}`)} loading="lazy" decoding="async" draggable={false}/>:null;
}

export function RecordShopDiscoveries() {
  const seen=useRef(new Set<number>());
  const [queue,setQueue]=useState<Album[]>([]);
  useEffect(()=>{
    const receive=(event:Event)=>{
      const detail=(event as CustomEvent<{messageId:number;album:Album}>).detail;
      if(!detail?.album||seen.current.has(detail.messageId))return;
      seen.current.add(detail.messageId);
      setQueue(current=>[...current,detail.album]);
    };
    window.addEventListener('frienden:record-shop-discovery',receive);
    return ()=>window.removeEventListener('frienden:record-shop-discovery',receive);
  },[]);
  return queue[0]?<RecordShopAlbum key={queue[0].id} album={queue[0]} discovery onClose={()=>setQueue(current=>current.slice(1))}/>:null;
}

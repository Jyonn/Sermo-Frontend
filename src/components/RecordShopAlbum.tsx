import {useEffect,useRef,useState,type CSSProperties,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import {useI18n} from '../lib/language';
import {safeActivityImage} from '../lib/activityPresentation';
import {claimMediaPlayback,releaseMediaPlayback} from '../lib/mediaPlaybackFocus';
import {musicTime} from '../lib/musicLyrics';
import {useModalFocus} from '../lib/modalFocus';
import {usePlaybackWait} from './MediaWaitFeedback';
import {RecordShopPortrait} from './RecordShopPortrait';
import type {RecordShopAlbum as Album,RecordShopDecoration} from '../types';
import './RecordShop.css';
import './RecordShopReveal.css';

export function RecordShopTierMark({tier,label}:{tier:Album['tier'];label?:string}) {
  return <span className={`record-shop-tier-mark tier-${tier}`} role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true}/>;
}

function RecordShopDisc({cover,playing=false,animated=true}:{cover?:string;playing?:boolean;animated?:boolean}) {
  const disc=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    const spin=disc.current?.getAnimations?.().find(animation=>'animationName' in animation&&animation.animationName==='record-shop-disc-spin');
    spin?.updatePlaybackRate(playing?4:1);
  },[playing]);
  return <span ref={disc} className={`record-shop-disc${animated?'':' is-still'}`} aria-hidden="true">
    {cover?<img src={cover} alt="" loading="lazy" draggable={false} />:null}
  </span>;
}

export function RecordShopAlbumFace({album,animated=false,playing=false,tierLabel}:{
  album:Album;animated?:boolean;playing?:boolean;tierLabel?:string;
}) {
  return <span className={`record-shop-album-face tier-${album.tier}`}>
    <RecordShopDisc cover={safeActivityImage(album.cover)} playing={playing} animated={animated}/>
    <RecordShopTierMark tier={album.tier} label={tierLabel}/>
  </span>;
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

export function RecordShopAlbum({album,onClose,discovery=false,spaceDiscovery}:{
  album:Album;onClose:()=>void;discovery?:boolean;spaceDiscovery?:{winner:string;time:string};
}) {
  const {t}=useI18n();
  const dialog=useRef<HTMLDialogElement>(null);
  const previewTrigger=useRef<HTMLButtonElement>(null);
  const revealClose=useRef<HTMLButtonElement>(null);
  const [playing,setPlaying]=useState(false);
  const [preview,setPreview]=useState(false);
  const rare=album.tier==='diamond'||album.tier==='obsidian';
  const reveal=rare&&(discovery||preview||Boolean(spaceDiscovery));
  const revealLabel=t(spaceDiscovery?'recordShop.spaceFirst':preview?'recordShop.previewReveal':'recordShop.first');
  const dismiss=()=>{
    if(preview){
      setPreview(false);
      requestAnimationFrame(()=>previewTrigger.current?.focus());
    }else dialog.current?.close();
  };
  useModalFocus(dialog,true,dismiss,{manageLayer:false});
  useEffect(()=>{dialog.current?.showModal();},[]);
  useEffect(()=>{if(preview)revealClose.current?.focus();},[preview]);
  const clip=safeActivityImage(album.clip);
  const playback=clip?<RecordShopClip key={clip} album={album} uri={clip} onPlayingChange={setPlaying}/>:<small>{t('recordShop.clipUnavailable')}</small>;
  return createPortal(<dialog ref={dialog} className={`record-shop-album tier-${album.tier}${discovery||reveal?' is-discovery':''}${reveal?' is-rare-reveal':''}`} onClose={onClose} onClick={event=>{event.stopPropagation();if(event.target===event.currentTarget)dismiss();}} onKeyDown={event=>event.stopPropagation()} aria-label={reveal?`${revealLabel} · ${album.name}`:album.name}>
    {reveal?<div className="record-shop-reveal">
      <button className="record-shop-close record-shop-reveal-close" type="button" ref={revealClose} onClick={dismiss} aria-label={t('common.close')}>
        <span className="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
      <div className="record-shop-reveal-stage">
        <div className="record-shop-reveal-orbits" aria-hidden="true"><i/><i/><i/></div>
        <div className="record-shop-reveal-rays" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
        <RecordShopAlbumFace album={album} animated playing={playing} tierLabel={t(`recordShop.tier.${album.tier}`)}/>
      </div>
      <div className="record-shop-reveal-caption">
        <p><RecordShopTierMark tier={album.tier}/>{revealLabel}</p>
        <h2>{album.name}</h2>
        {album.title!==album.name?<span>{album.title}</span>:null}
        {spaceDiscovery?<span className="record-shop-reveal-winner">{t('recordShop.spaceFirstBy', spaceDiscovery)}</span>:!preview?<div className="record-shop-reveal-player">{playback}</div>:null}
      </div>
    </div>:<div className="record-shop-album-panel">
      <form method="dialog"><button className="record-shop-close" type="submit" aria-label={t('common.close')}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></form>
      <div className="record-shop-album-visual">
        {discovery?<div className="record-shop-waves" aria-hidden="true"><i/><i/><i/></div>:null}
        <RecordShopAlbumFace album={album} animated playing={playing} tierLabel={t(`recordShop.tier.${album.tier}`)}/>
      </div>
      {discovery?<p>{t('recordShop.first')}</p>:null}
      <h2>{album.name}</h2>
      <span>{album.title}</span>
      {playback}
      {rare&&!discovery?<button className="record-shop-preview-reveal" ref={previewTrigger} type="button" onClick={()=>{
        setPlaying(false);
        setPreview(true);
      }}>
        <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>{t('recordShop.previewReveal')}
      </button>:null}
    </div>}
  </dialog>,document.body);
}

export function RecordShopDecorationView({decoration,interactive=true}:{decoration:RecordShopDecoration;interactive?:boolean}) {
  const {t}=useI18n();
  const album=decoration.album;
  const cover=safeActivityImage(album?.cover);
  const clip=safeActivityImage(album?.clip);
  if(album&&cover)return clip
    ? <RecordShopClip key={clip} album={album} uri={clip} cover={cover} interactive={interactive}/>
    : <span className={`record-shop-message-cover tier-${album.tier}`} role="img" aria-label={`${album.name} · ${t('recordShop.clipUnavailable')}`}><RecordShopDisc cover={cover}/></span>;
  return <RecordShopPortrait artist={decoration.artist} uri={decoration.portrait} alt={t(`recordShop.singer.${decoration.artist}`)} />;
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

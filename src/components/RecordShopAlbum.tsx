import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useI18n} from '../lib/language';
import {safeActivityImage} from '../lib/activityPresentation';
import {claimMediaPlayback,releaseMediaPlayback} from '../lib/mediaPlaybackFocus';
import type {RecordShopAlbum as Album,RecordShopDecoration} from '../types';
import './RecordShop.css';

export function RecordShopAlbum({album,onClose,discovery=false}:{album:Album;onClose:()=>void;discovery?:boolean}) {
  const {t}=useI18n();
  const dialog=useRef<HTMLDialogElement>(null);
  const audio=useRef<HTMLAudioElement>(null);
  useEffect(()=>{
    dialog.current?.showModal();
    const node=audio.current;
    return()=>{if(node){node.pause();releaseMediaPlayback(node);}};
  },[]);
  const cover=safeActivityImage(album.cover);
  const clip=safeActivityImage(album.clip);
  return createPortal(<dialog ref={dialog} className={`record-shop-album tier-${album.tier}${discovery?' is-discovery':''}`} onClose={onClose} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close();}} aria-label={album.name}>
    <div className="record-shop-album-panel">
      <form method="dialog"><button className="record-shop-close" type="submit" aria-label={t('common.close')}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></form>
      <div className="record-shop-album-visual">
        {discovery?<div className="record-shop-waves" aria-hidden="true"><i/><i/><i/></div>:null}
        {cover?<img src={cover} alt=""/>:null}
      </div>
      <p>{discovery?t('recordShop.first'):t(`recordShop.tier.${album.tier}`)}</p>
      <h2>{album.name}</h2>
      <span>{album.title}</span>
      {clip?<audio ref={audio} src={clip} aria-label={t('recordShop.listen')} controls preload="none"
        onPlay={event=>claimMediaPlayback(event.currentTarget)} onEnded={event=>releaseMediaPlayback(event.currentTarget)}/>:
        <small>{t('recordShop.clipUnavailable')}</small>}
    </div>
  </dialog>,document.body);
}

export function RecordShopDecorationView({decoration,first}:{decoration:RecordShopDecoration;first:boolean}) {
  const {t}=useI18n();
  const [active,setActive]=useState(false);
  const album=first?undefined:decoration.album;
  const cover=safeActivityImage(album?.cover);
  const portrait=safeActivityImage(decoration.portrait);
  if(album&&cover)return <>
    <button type="button" className={`record-shop-message-cover tier-${album.tier}`} aria-label={album.name} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();setActive(true);}}>
      <img src={cover} loading="lazy" alt=""/>
    </button>
    {active?<RecordShopAlbum album={album} onClose={()=>setActive(false)}/>:null}
  </>;
  return portrait?<img className="record-shop-portrait" src={portrait} alt={t(`recordShop.singer.${decoration.artist}`)} loading="lazy"/>:null;
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

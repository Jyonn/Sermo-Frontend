import {useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {useI18n} from '../lib/language';
import {arrangeSquareColumns,squareCover,textCoverStyle} from '../lib/squareFeedLayout';
import type {SquareStatementDTO} from '../types';
import {PlainAvatar} from './UserAvatar';
import {VirtualDynamicList} from './VirtualDynamicList';
import './SquareMasonryFeed.css';

export function SquareMasonryFeed({items,canInteract,onOpen,onLike,onProfile,renderText,scrollRef}:{items:SquareStatementDTO[];canInteract:boolean;onOpen:(item:SquareStatementDTO)=>void;onLike:(item:SquareStatementDTO)=>void;onProfile:(item:SquareStatementDTO)=>void;renderText?:(item:SquareStatementDTO)=>ReactNode;scrollRef:RefObject<HTMLElement|null>}){
  const {t}=useI18n();const root=useRef<HTMLDivElement>(null),[width,setWidth]=useState(0);
  useLayoutEffect(()=>{const node=root.current;if(!node)return;const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(node);return()=>observer.disconnect()},[]);
  const columns=arrangeSquareColumns(items,width);
  const renderItem=(item:SquareStatementDTO)=>{
    const cover=squareCover(item),textStyle=textCoverStyle(item.statement_id,item.text);
    const author=item.is_anonymous?t('square.anonymousUser'):item.user.name;
    const fallback=cover.title||(cover.kind==='music'?t('square.typeMusic'):cover.video?t('square.video'):cover.kind==='audio'?t('square.typeAudio'):item.chat_record?t('messageSearch.chatRecord'):t('square.statementDetail'));
    const mediaIcon=cover.kind==='music'?'music_note':cover.kind==='audio'?'graphic_eq':cover.video?'play_arrow':cover.kind==='collection'?'photo_library':cover.kind==='chat'?'forum':null;
    const duration=cover.duration?`${Math.floor(cover.duration/60)}:${String(Math.floor(cover.duration%60)).padStart(2,'0')}`:'';
    return <article className="square-note" key={item.statement_id}>
      <button className={`square-note-cover${cover.uri?' has-media':` is-text theme-${textStyle.theme} text-${textStyle.font}`}`} style={{aspectRatio:cover.uri?cover.ratio:textStyle.ratio}} onClick={()=>onOpen(item)} type="button" aria-label={item.text||fallback}>
        {cover.uri?<><span className="square-note-placeholder material-symbols-outlined" aria-hidden="true">image</span><img key={cover.uri} loading="lazy" decoding="async" src={cover.uri} alt="" onError={event=>{const image=event.currentTarget;if(cover.fallbackUri&&!image.dataset.retried){image.dataset.retried='true';image.src=cover.fallbackUri}else image.style.visibility='hidden'}}/></>:cover.kind==='audio'?<span className="square-note-audio"><span className="square-note-wave" aria-hidden="true">{[16,28,21,36,48,30,42,54,36,22,38,26,14].map((height,index)=><i key={index} style={{height}}/>)}</span><strong>{t('square.typeAudio')}</strong><small>{duration}</small></span>:<span className="square-note-lettering">{item.text?(renderText?.(item)??item.text):fallback}</span>}
        {mediaIcon||cover.count>1?<span className="square-note-media-tag" aria-hidden="true"><span className="material-symbols-outlined">{mediaIcon||'filter_none'}</span>{cover.count>1?<small>{cover.count}</small>:null}</span>:null}
        {cover.video&&duration?<small className="square-note-duration">{duration}</small>:null}
        {!cover.uri&&item.text.length>100?<span className="square-note-continued" aria-hidden="true">···</span>:null}
      </button>
      <button className="square-note-title" onClick={()=>onOpen(item)} type="button">{item.text?(renderText?.(item)??item.text):fallback}</button>
      <footer><button className="square-note-author" type="button" disabled={item.is_anonymous} onClick={()=>onProfile(item)}>{item.is_anonymous?<span className="square-note-anonymous material-symbols-outlined" aria-hidden="true">person</span>:<PlainAvatar className="square-note-avatar" name={author} uri={item.user.avatar_uri}/>}<span>{author}</span></button><button className={`square-note-like${item.liked?' is-liked':''}`} disabled={!canInteract} onClick={()=>onLike(item)} type="button" aria-label={`${t('square.like')} ${item.like_count}`} aria-pressed={item.liked}><span className="material-symbols-outlined" aria-hidden="true">favorite</span><span>{item.like_count||t('square.like')}</span></button></footer>
    </article>;
  };
  const cardWidth=(Math.max(280,width)-(columns.length-1)*14)/columns.length;
  return <div className="square-masonry-feed" ref={root} style={{gridTemplateColumns:`repeat(${columns.length},minmax(0,1fr))`}}>{columns.map((column,index)=><VirtualDynamicList key={index} className="square-masonry-column" items={column} scrollRef={scrollRef} itemKey={item=>String(item.statement_id)} estimateSize={item=>{const cover=squareCover(item);return cardWidth/(cover.uri?cover.ratio:textCoverStyle(item.statement_id,item.text).ratio)+81}} rowGap={22} overscan={500} renderItem={renderItem}/>)}</div>;
}

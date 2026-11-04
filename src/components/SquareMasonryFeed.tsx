import {useLayoutEffect,useMemo,useRef,useState,type ReactNode,type RefObject} from 'react';
import {useI18n} from '../lib/language';
import {arrangeSquareColumns,squareCover,textCoverStyle} from '../lib/squareFeedLayout';
import type {SquareStatementDTO} from '../types';
import {PlainAvatar} from './UserAvatar';
import {VirtualDynamicList} from './VirtualDynamicList';
import {SquareMusicCover,SquareAudioCover} from './SquarePlayableCovers';
import {isMusicData} from './NeteaseMusicPreview';
import stillfolioMark from '../assets/stillfolio-mark.svg';
import './SquareMasonryFeed.css';

export function SquareNoteCard({item,canInteract,onOpen,onLike,onProfile,renderText}:{item:SquareStatementDTO;canInteract:boolean;onOpen:(item:SquareStatementDTO)=>void;onLike:(item:SquareStatementDTO)=>void;onProfile:(item:SquareStatementDTO)=>void;renderText?:(item:SquareStatementDTO)=>ReactNode}){
    const {t}=useI18n();
    const cover=squareCover(item),textStyle=textCoverStyle(item.statement_id,item.text);
    const author=item.is_anonymous?t('square.anonymousUser'):item.user.name;
    const fallback=cover.title||(cover.kind==='music'?t('square.typeMusic'):cover.video?t('square.video'):cover.kind==='audio'?t('square.typeAudio'):item.chat_record?t('messageSearch.chatRecord'):t('square.statementDetail'));
    const mediaIcon=cover.kind==='music'?'music_note':cover.kind==='audio'?'graphic_eq':cover.video?'play_arrow':cover.kind==='collection'?'photo_library':cover.kind==='chat'?'forum':null;
    const duration=cover.duration?`${Math.floor(cover.duration/60)}:${String(Math.floor(cover.duration%60)).padStart(2,'0')}`:'';
    const music=item.external_media?.status==='ready'&&isMusicData(item.external_media.provider_data)?item.external_media.provider_data:null;
    const audio=item.media.find(media=>media.kind==='audio');
    return <article className="square-note" key={item.statement_id}>
      {music?<SquareMusicCover music={music} uri={cover.uri}/>:audio&&cover.kind==='audio'?<SquareAudioCover uri={audio.uri} label={item.text||fallback} duration={duration} theme={textStyle.theme} ratio={textStyle.ratio}/>:<button className={`square-note-cover${cover.uri?' has-media':` is-text theme-${textStyle.theme} text-${textStyle.font}`}`} style={{aspectRatio:cover.uri?cover.ratio:textStyle.ratio}} onClick={()=>onOpen(item)} type="button" aria-label={item.text||fallback}>
        {cover.uri?<><span className="square-note-placeholder material-symbols-outlined" aria-hidden="true">image</span><img key={cover.uri} loading="lazy" decoding="async" src={cover.uri} alt="" onError={event=>{const image=event.currentTarget;if(cover.fallbackUri&&!image.dataset.retried){image.dataset.retried='true';image.src=cover.fallbackUri}else image.style.visibility='hidden'}}/></>:cover.kind==='audio'?<span className="square-note-audio"><span className="square-note-wave" aria-hidden="true">{[16,28,21,36,48,30,42,54,36,22,38,26,14].map((height,index)=><i key={index} style={{height}}/>)}</span><strong>{t('square.typeAudio')}</strong><small>{duration}</small></span>:<span className="square-note-lettering">{item.text?(renderText?.(item)??item.text):fallback}</span>}
        {mediaIcon&&cover.kind!=='collection'?<span className="square-note-media-tag" aria-hidden="true"><span className="material-symbols-outlined">{mediaIcon}</span></span>:null}
        {cover.video&&duration?<small className="square-note-duration">{duration}</small>:null}
        {cover.provider==='stillfolio_collection'?<span className="square-note-brand"><img alt="StillFolio" src={stillfolioMark}/></span>:null}
        {!cover.uri&&item.text.length>100?<span className="square-note-continued" aria-hidden="true">···</span>:null}
      </button>}
      <div className="square-note-details">
      <button className="square-note-title" onClick={()=>onOpen(item)} type="button">{item.text?(renderText?.(item)??item.text):fallback}</button>
      <footer><button className="square-note-author" type="button" disabled={item.is_anonymous} onClick={()=>onProfile(item)}>{item.is_anonymous?<span className="square-note-anonymous material-symbols-outlined" aria-hidden="true">person</span>:<PlainAvatar className="square-note-avatar" name={author} uri={item.user.avatar_uri}/>}<span>{author}</span></button><button className={`square-note-like${item.liked?' is-liked':''}`} disabled={!canInteract} onClick={()=>onLike(item)} type="button" aria-label={`${t('square.like')} ${item.like_count}`} aria-pressed={item.liked}><span className="material-symbols-outlined" aria-hidden="true">favorite</span><span>{item.like_count||t('square.like')}</span></button></footer>
      </div>
    </article>;
}

export function SquareMasonryFeed({items,canInteract,onOpen,onLike,onProfile,renderText,scrollRef,overscan=500}:{items:SquareStatementDTO[];canInteract:boolean;onOpen:(item:SquareStatementDTO)=>void;onLike:(item:SquareStatementDTO)=>void;onProfile:(item:SquareStatementDTO)=>void;renderText?:(item:SquareStatementDTO)=>ReactNode;scrollRef:RefObject<HTMLElement|null>;overscan?:number}){
  const root=useRef<HTMLDivElement>(null),[width,setWidth]=useState(0);
  useLayoutEffect(()=>{const node=root.current;if(!node)return;const observer=new ResizeObserver(([entry])=>{if(entry.contentRect.width>0)setWidth(entry.contentRect.width)});observer.observe(node);return()=>observer.disconnect()},[]);
  const columns=useMemo(()=>arrangeSquareColumns(items,width),[items,width]);
  const renderItem=(item:SquareStatementDTO)=><SquareNoteCard item={item} canInteract={canInteract} onOpen={onOpen} onLike={onLike} onProfile={onProfile} renderText={renderText}/>;
  const cardWidth=(Math.max(280,width)-(columns.length-1)*14)/columns.length;
  return <div className="square-masonry-feed" ref={root} style={{gridTemplateColumns:`repeat(${columns.length},minmax(0,1fr))`}}>{columns.map((column,index)=><VirtualDynamicList key={index} className="square-masonry-column" items={column} scrollRef={scrollRef} itemKey={item=>String(item.statement_id)} estimateSize={item=>{const cover=squareCover(item);return cardWidth/(cover.uri?cover.ratio:textCoverStyle(item.statement_id,item.text).ratio)+90}} rowGap={16} overscan={overscan} renderItem={renderItem}/>)}</div>;
}

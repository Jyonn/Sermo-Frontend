import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {SquareStatementDTO} from '../types';
import {useI18n} from '../lib/language';
import {formatSquareTime} from '../lib/squareTime';
import {squareNotePhotos,naturalMediaRatio} from '../lib/squareNoteMedia';
import {useMediaSource} from '../lib/useMediaSource';
import {claimMediaPlayback} from '../lib/mediaPlaybackFocus';
import {UserAvatar} from './UserAvatar';
import {AccountRoleBadge} from './AccountRoleBadge';
import {LinkPreviewCard} from './LinkPreviewCard';
import {isStillfolioCollection,revalidateCollection} from './StillfolioPreview';
import {MediaLightbox, type MediaLightboxItem} from './ImageLightbox';
import {MediaMetadataPanel} from './MediaMetadataPanel';
import {MediaWaitFeedback} from './MediaWaitFeedback';
import {StatementVideoThumbnail} from './StatementVideoThumbnail';
import { SquareEditedLabel } from './SquareStatementEdits';
import {DrawerDismissButton, OverlayIconButton} from './OverlayIconButton';
import stillfolioMark from '../assets/stillfolio-mark.svg';
import './SquareNoteDetail.css';

function NoteImage({uri,poster,selected,near,external,onOpen,onSize}:{uri:string;poster?:string|null;selected:boolean;near:boolean;external:boolean;onOpen:()=>void;onSize:(width:number,height:number)=>void}){
  const {t}=useI18n(),source=useMediaSource(selected?uri:poster||uri);
  return <div className="square-reader-photo"><button onClick={onOpen} type="button" aria-label={t('common.fullscreen')}><img src={near?source.src:undefined} alt="" loading={selected?'eager':'lazy'} decoding="async" referrerPolicy={external?'no-referrer':undefined} onLoad={event=>{source.ready();onSize(event.currentTarget.naturalWidth,event.currentTarget.naturalHeight)}} onError={source.fail}/></button>{selected?<MediaWaitFeedback phase={source.phase} onRetry={source.retry}/>:null}</div>;
}

interface Props{
  panel?:boolean;
  statement:SquareStatementDTO;discussion:ReactNode;composer:ReactNode;text:ReactNode;canInteract:boolean;
  onBack:()=>void;onProfile:()=>void;onShare:()=>void;onMore:()=>void;onLike:()=>void;onLocation:()=>void;
  onHistory: () => void;
}

export function SquareNoteDetailHeader({panel, onDismiss, children}: {
  panel?: boolean;
  onDismiss: () => void;
  children?: ReactNode;
}) {
  const {t} = useI18n();
  const dismiss = <DrawerDismissButton className="square-reader-dismiss" onClick={onDismiss} />;
  return <header className="square-reader-header">
    {!panel && dismiss}
    {children ?? <strong className="square-reader-heading">{t('square.statementDetail')}</strong>}
    {panel && dismiss}
  </header>;
}

export function SquareNoteDetail(p:Props){
  const {t,language}=useI18n(),s=p.statement;
  const initial=s.external_media?.status==='ready'&&isStillfolioCollection(s.external_media.provider_data)?s.external_media.provider_data:null;
  const [collection,setCollection]=useState(initial),[index,setIndex]=useState(0),[lightbox,setLightbox]=useState<number|null>(null),[info,setInfo]=useState(false);
  const [imageRatios,setImageRatios]=useState<Record<string,number>>({});
  const track=useRef<HTMLDivElement>(null),comments=useRef<HTMLDivElement>(null);
  const currentIndex=useRef(index);currentIndex.current=index;
  useEffect(()=>{setCollection(initial);if(!initial||!s.external_media?.preview_id)return;let live=true;void revalidateCollection(s.external_media.preview_id).then(next=>{if(live&&next?.canonical_url===initial.canonical_url)setCollection(next)}).catch(()=>undefined);return()=>{live=false}},[initial,s.external_media?.preview_id]);
  const photos=useMemo(()=>squareNotePhotos(s,collection),[s,collection]);
  useEffect(()=>{setIndex(current=>Math.max(0,Math.min(current,photos.length-1)))},[photos.length]);
  useLayoutEffect(()=>{const el=track.current;if(!el)return;const align=()=>{el.scrollLeft=el.clientWidth*currentIndex.current};align();const observer=new ResizeObserver(align);observer.observe(el);return()=>observer.disconnect()},[photos.length]);
  const audio=s.media.find(item=>item.kind==='audio'),video=s.media.find(item=>item.kind==='video'),active=photos[index];
  const owner = s.is_anonymous ? null : s.user;
  const assets: MediaLightboxItem[] = photos.map(photo => ({
    uri: photo.uri, kind: 'image', posterUri: photo.poster, imageMetadata: photo.metadata, owner,
    createdAt: s.created_at, referrerPolicy: photo.external ? 'no-referrer' : undefined,
  }));
  if (video) assets.push({
    id: video.media_id, uri: video.uri, kind: 'video', posterUri: video.thumbnail_uri, owner, createdAt: s.created_at,
    width: video.metadata?.pixel_width, height: video.metadata?.pixel_height,
    detail: video.metadata?.status === 1 ? <MediaMetadataPanel kind="video" metadata={video.metadata} owner={owner} /> : undefined,
  });
  const openAsset = (position: number, showInfo = false) => {
    setInfo(showInfo);
    setLightbox(position);
  };
  const activeRatio=active?(imageRatios[active.uri]??naturalMediaRatio(active.metadata?.pixel_width,active.metadata?.pixel_height)??4/3):4/3;
  const reduce=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const page=(next:number)=>{const el=track.current;if(el)el.scrollTo({left:next*el.clientWidth,behavior:reduce()?'auto':'smooth'})};
  const photoStage=photos.length?<section className="square-reader-gallery" aria-label={t('square.photo')}>
    <div className="square-reader-track" style={{aspectRatio:activeRatio}} ref={track} onScroll={event=>{const el=event.currentTarget;if(el.clientWidth)setIndex(Math.max(0,Math.min(photos.length-1,Math.round(el.scrollLeft/el.clientWidth))))}}>
      {photos.map((photo,i)=><NoteImage key={photo.uri} uri={photo.uri} poster={photo.poster} external={photo.external} selected={i===index} near={Math.abs(i-index)<=1} onOpen={()=>setLightbox(i)} onSize={(width,height)=>{const ratio=naturalMediaRatio(width,height);if(ratio)setImageRatios(current=>current[photo.uri]===ratio?current:{...current,[photo.uri]:ratio})}}/>)}
    </div>
    {collection?<span className="square-reader-provider"><img src={stillfolioMark} alt="StillFolio"/></span>:null}
    <button className="square-reader-photo-info" onClick={()=>openAsset(index,true)} type="button"><span className="material-symbols-outlined">info</span>{t('square.photoInfo')}</button>
    {photos.length>1?<div className="square-reader-pagination"><button disabled={index===0} aria-label={t('media.previousImage')} onClick={()=>page(index-1)} type="button"><span className="material-symbols-outlined">chevron_left</span></button><div className="square-reader-dots" role="group" aria-label={t('square.photo')} >{photos.map((photo,i)=><button key={photo.uri} aria-label={`${i+1} / ${photos.length}`} aria-current={i===index?'true':undefined} onClick={()=>page(i)} type="button"><i/></button>)}</div><span>{index+1} / {photos.length}</span><button disabled={index===photos.length-1} aria-label={t('media.nextImage')} onClick={()=>page(index+1)} type="button"><span className="material-symbols-outlined">chevron_right</span></button></div>:null}
  </section>:null;
  return <article className={`square-reader${p.panel?' is-panel':''}${photos.length?' has-gallery':''}`}>
    <SquareNoteDetailHeader panel={p.panel} onDismiss={p.onBack}>
      <button className="square-reader-author" disabled={s.is_anonymous} onClick={p.onProfile} type="button">
        {s.is_anonymous ? <span className="material-symbols-outlined">person</span> : <UserAvatar className="square-reader-avatar" name={s.user.name} uri={s.user.avatar_uri} frame={s.user.avatar_frame_style} />}
        <strong>{s.is_anonymous ? t('square.anonymousUser') : s.user.name}</strong>
        {!s.is_anonymous && s.user.official ? <AccountRoleBadge kind="official" /> : null}
      </button>
      <OverlayIconButton icon="share" aria-label={t('square.share')} onClick={p.onShare} />
      {s.can_delete||s.can_pin||s.can_mute ? <OverlayIconButton icon="more_horiz" aria-label={t('common.more')} onClick={p.onMore} /> : null}
    </SquareNoteDetailHeader>
    <div className="square-reader-scroll"><div className="square-reader-layout">{photoStage}<div className="square-reader-reading">
      {!photos.length&&s.external_media?<div className="square-reader-external"><LinkPreviewCard preview={s.external_media} statementId={s.statement_id} fitMedia/></div>:null}
      {video?<StatementVideoThumbnail className="square-reader-video" eager fitMedia aspectRatio={naturalMediaRatio(video.metadata?.pixel_width,video.metadata?.pixel_height)} thumbnailUri={video.thumbnail_uri} durationSeconds={video.duration_seconds} onClick={()=>openAsset(photos.length)}/>:null}
      {audio?<audio className="square-reader-audio" src={audio.uri} controls preload="metadata" onPlay={event=>claimMediaPlayback(event.currentTarget)}/>:null}
      {s.chat_record?<button className="square-reader-chat-record" onClick={()=>window.dispatchEvent(new CustomEvent('sermo:forward-bundle',{detail:s.chat_record}))} type="button"><span className="material-symbols-outlined">forum</span>{t('message.forwardBundleSnapshot')}<span className="material-symbols-outlined">chevron_right</span></button>:null}
      {s.text?<div className="square-reader-text">{p.text}</div>:null}
      {collection?.title?<a className="square-reader-source" href={collection.canonical_url} target="_blank" rel="noreferrer">{collection.title}<span className="material-symbols-outlined">arrow_outward</span></a>:null}
      {s.location?<button className="square-reader-location" onClick={p.onLocation} type="button"><span className="material-symbols-outlined">location_on</span>{s.location.address||t('square.location')}<span className="material-symbols-outlined">chevron_right</span></button>:null}
      <div className="square-reader-meta"><time dateTime={new Date(s.created_at*1000).toISOString()}>{formatSquareTime(s.created_at,language,t('time.yesterday'))}</time>
        {!!s.edited_at && <SquareEditedLabel onHistory={p.onHistory} />}
        <span>{s.is_anonymous?t('square.publishAnonymously'):s.visibility==='friends'?t('square.friendsOnly'):t('square.audiencePublic')}</span>
      </div>
    </div><div ref={comments}>{p.discussion}</div></div></div>
    <footer className="square-reader-footer"><div className="square-reader-composer">{p.composer||<span>{t('square.readOnlyHint')}</span>}</div><button className={s.liked?'is-liked':''} disabled={!p.canInteract} aria-label={`${t('square.like')} ${s.like_count}`} aria-pressed={s.liked} onClick={p.onLike} type="button"><span className="material-symbols-outlined">favorite</span><small>{s.like_count||t('square.like')}</small></button><button aria-label={t('square.comments')} onClick={()=>comments.current?.scrollIntoView({behavior:reduce()?'auto':'smooth',block:'start'})} type="button"><span className="material-symbols-outlined">chat_bubble_outline</span><small>{s.comment_count}</small></button></footer>
    {lightbox !== null && assets.length > 0 ? <MediaLightbox initialInfo={info} index={lightbox} items={assets}
      source={collection ? {name: 'StillFolio', logo: stillfolioMark, url: collection.canonical_url} : undefined}
      onForward={() => {setLightbox(null); p.onShare();}}
      onClose={() => setLightbox(null)} onIndexChange={next => {setLightbox(next); if (next < photos.length) {setIndex(next); page(next);}}} /> : null}
  </article>;
}

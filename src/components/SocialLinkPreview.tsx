import {useEffect,useRef,useState} from 'react';
import type {LinkPreviewDTO} from '../types';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import {PlatformMediaCard} from './PlatformMediaCard';
import {ConfirmDialog} from './ConfirmDialog';
import {MediaLightbox, type MediaLightboxItem} from './ImageLightbox';
import {isDouyinVideoData} from './DouyinVideoPreview';
import {isSocialMediaData} from './SocialMediaPreview';
import {hasSocialShareMetadata, isRepeatedShareText, socialShareTitle} from '../lib/socialSharePresentation';
import './SocialLinkPreview.css';

/** Opening, playing cached media and paid resolution are three separate actions. */
export function SocialLinkPreview({preview,url,fitMedia=false,embeddedCover=false}:{
  preview:LinkPreviewDTO|null;url:string;fitMedia?:boolean;embeddedCover?:boolean;
}){
  const {t}=useI18n(),[current,setCurrent]=useState(preview),[open,setOpen]=useState(false),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[notice,setNotice]=useState(''),[index,setIndex]=useState(0);
  const mounted=useRef(true),generation=useRef(0);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++}},[]);
  useEffect(()=>{setCurrent(preview)},[preview]);
  const data=current?.provider_data;
  const media=data&&(isDouyinVideoData(data)||isSocialMediaData(data))?data:null;
  const dy=(media?.provider||'').startsWith('douyin')||url.includes('douyin.com');
  const source=t(dy?'social.douyin':'social.xiaohongshu'),logo=dy?'/icons/douyin-logo.svg':'/icons/xiaohongshu-logo.png';
  const historyKey=useRef(`social-detail-${preview?.preview_id || (dy ? 'douyin' : 'xiaohongshu')}`);
  const gallery=media&&'images' in media&&Array.isArray(media.images)?media.images:[];
  const video=media&&'video_url' in media&&typeof media.video_url==='string'?media.video_url:'';
  const previewTitle=socialShareTitle(current),title=previewTitle || t('link.preview');
  const author=media?.author||'',cover=current?.image_url||(media&&'cover_url' in media?media.cover_url:undefined),canonical=current?.url||url;
  const hasMetadata=hasSocialShareMetadata(current);
  const ask=()=>{setNotice('');setConfirm(true)};
  const resolve=async()=>{
    if(busy)return;
    setBusy(true);const attempt=++generation.current;
    try{
      const reference=current?.preview_id?current:await api.resolveExternalMedia(url);
      if(!reference?.preview_id)throw Error('unavailable');
      const result=await api.refreshExternalMedia(reference.preview_id,true,true);
      if(!mounted.current||attempt!==generation.current)return;
      setCurrent(result);setConfirm(false);
      if(result.parse_error){setNotice(t(`link.parse.${result.parse_error}`));setFailed(true)}
      else{setFailed(false);setNotice('')}
    }catch{if(mounted.current)setNotice(t('link.parse.unavailable'))}
    finally{if(mounted.current&&attempt===generation.current)setBusy(false)}
  };
  const mediaError=()=>{setFailed(true);ask()};
  const items: MediaLightboxItem[] = gallery.length
    ? gallery.map((uri, position) => ({id: position, uri, kind: 'image', referrerPolicy: 'no-referrer'}))
    : media || cover
      ? [{id: 'video', uri: failed ? '' : video, kind: 'video', posterUri: cover, referrerPolicy: 'no-referrer', deferPlayback: true, onPlayRequest: ask, onPlaybackError: mediaError}]
      : [{id: 'article', uri: '', kind: 'image'}];
  return <>
    <div className="social-link-row" onClick={event=>event.stopPropagation()}>
      <div className="social-link-card">{hasMetadata?<PlatformMediaCard title={title} author={author} source={source} logo={logo} cover={cover}
        kindLabel={gallery.length?`${gallery.length} ${t('social.photos')}`:t('social.video')} playIcon={gallery.length?undefined:'play_arrow'}
        fitMedia={fitMedia} embeddedCover={embeddedCover} hideTitle={embeddedCover && Boolean(socialShareTitle(preview))}
        onClick={()=>{setIndex(0);setOpen(true)}}/>:<a className="message-link-preview-card no-image is-unavailable" href={url} target="_blank" rel="noreferrer"><div className="message-link-preview-text"><strong className="message-link-preview-title">{source}</strong><span className="message-link-preview-desc">{url}</span></div><span className="message-link-preview-placeholder" aria-hidden="true">↗</span></a>}</div>
      {!hasMetadata?<button type="button" className="social-link-parse" disabled={busy} onClick={ask}><span className="material-symbols-outlined" aria-hidden="true">link</span>{t('link.parse.action')}</button>:null}
    </div>
    {notice?<span className="social-link-notice" role="status">{notice}</span>:null}
    {open && <MediaLightbox index={index} items={items} onIndexChange={setIndex} onClose={()=>setOpen(false)}
      altPrefix={title} source={{name: source, logo, url: canonical, author}} historyKey={historyKey.current}
      sharedDetail={<article className="media-drawer-article">
        <h2>{title}</h2>
        {current?.description && !isRepeatedShareText(current.description, previewTitle) ? <p>{current.description}</p> : null}
        {failed?<button className="ghost-button" type="button" onClick={ask}>{t('link.parse.action')}</button>:null}
        {notice?<p role="status">{notice}</p>:null}
      </article>} />}
    <ConfirmDialog open={confirm} title={t('link.parse.confirmTitle')} description={t('link.parse.confirmBody')} confirmLabel={t('link.parse.action')} busy={busy} onClose={()=>setConfirm(false)} onConfirm={()=>void resolve()}/>
  </>;
}

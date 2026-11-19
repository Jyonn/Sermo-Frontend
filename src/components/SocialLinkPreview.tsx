import {useEffect,useRef,useState} from 'react';
import type {LinkPreviewDTO} from '../types';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import {PlatformMediaCard} from './PlatformMediaCard';
import {SideDrawer} from './SideDrawer';
import {ConfirmDialog} from './ConfirmDialog';
import {ImageLightbox} from './ImageLightbox';
import {isDouyinVideoData} from './DouyinVideoPreview';
import {isSocialMediaData} from './SocialMediaPreview';
import './SocialLinkPreview.css';

export function isSocialUrl(url:string){try{return ['douyin.com','www.douyin.com','v.douyin.com','iesdouyin.com','www.iesdouyin.com','xiaohongshu.com','www.xiaohongshu.com','xhslink.com','www.xhslink.com','xhslink.cn','www.xhslink.cn'].includes(new URL(url).hostname)}catch{return false}}

/** Opening, playing cached media and paid resolution are three separate actions. */
export function SocialLinkPreview({preview,url,fitMedia=false}:{preview:LinkPreviewDTO|null;url:string;fitMedia?:boolean}){
  const {t}=useI18n(),[current,setCurrent]=useState(preview),[open,setOpen]=useState(false),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[playing,setPlaying]=useState(false),[failed,setFailed]=useState(false),[notice,setNotice]=useState(''),[lightbox,setLightbox]=useState<number|null>(null);
  const mounted=useRef(true),generation=useRef(0);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++}},[]);
  useEffect(()=>{setCurrent(preview)},[preview]);
  const data=current?.provider_data;
  const media=data&&(isDouyinVideoData(data)||isSocialMediaData(data))?data:null;
  const dy=(media?.provider||'').startsWith('douyin')||url.includes('douyin.com');
  const source=t(dy?'social.douyin':'social.xiaohongshu'),logo=dy?'/icons/douyin-logo.svg':'/icons/xiaohongshu-logo.png';
  const gallery=media&&'images' in media&&Array.isArray(media.images)?media.images:[];
  const video=media&&'video_url' in media&&typeof media.video_url==='string'?media.video_url:'';
  const title=current?.title||t('link.preview'),author=media?.author||'',cover=current?.image_url||(media&&'cover_url' in media?media.cover_url:undefined),canonical=current?.url||url;
  const hasMetadata=current?.status==='ready'&&Boolean(current.title||current.description||current.image_url);
  const ask=()=>{setNotice('');setConfirm(true)};
  const resolve=async()=>{
    if(busy)return;
    setBusy(true);const attempt=++generation.current;
    try{
      const reference=current?.preview_id?current:await api.resolveExternalMedia(url);
      if(!reference?.preview_id)throw Error('unavailable');
      const result=await api.refreshExternalMedia(reference.preview_id,true,true);
      if(!mounted.current||attempt!==generation.current)return;
      setCurrent(result);setConfirm(false);setPlaying(false);
      if(result.parse_error){setNotice(t(`link.parse.${result.parse_error}`));setFailed(true)}
      else{setFailed(false);setNotice('')}
    }catch{if(mounted.current)setNotice(t('link.parse.unavailable'))}
    finally{if(mounted.current&&attempt===generation.current)setBusy(false)}
  };
  const play=()=>{if(!video){ask();return}setPlaying(true)};
  const mediaError=()=>{setPlaying(false);setFailed(true);ask()};
  return <>
    <div className="social-link-row" onClick={event=>event.stopPropagation()}>
      <div className="social-link-card">{hasMetadata?<PlatformMediaCard title={title} author={author} source={source} logo={logo} cover={cover} kindLabel={gallery.length?`${gallery.length} ${t('social.photos')}`:t('social.video')} playIcon={gallery.length?undefined:'play_arrow'} fitMedia={fitMedia} onClick={()=>setOpen(true)}/>:<a className="message-link-preview-card no-image is-unavailable" href={url} target="_blank" rel="noreferrer"><div className="message-link-preview-text"><strong className="message-link-preview-title">{source}</strong><span className="message-link-preview-desc">{url}</span></div><span className="message-link-preview-placeholder" aria-hidden="true">↗</span></a>}</div>
      {!hasMetadata?<button type="button" className="social-link-parse" disabled={busy} onClick={ask}><span className="material-symbols-outlined" aria-hidden="true">link</span>{t('link.parse.action')}</button>:null}
    </div>
    {notice?<span className="social-link-notice" role="status">{notice}</span>:null}
    <SideDrawer open={open} onClose={()=>{setOpen(false);setPlaying(false)}} title={source} className="social-link-drawer" headerless historyKey={`social-detail-${current?.preview_id||url}`}>
      <article className="social-link-detail">
        <a className="social-link-brand" href={canonical} target="_blank" rel="noreferrer"><img src={logo} alt=""/>{source}<span className="material-symbols-outlined" aria-hidden="true">north_east</span></a>
        <h2>{title}</h2>{author?<p className="social-link-author">{author}</p>:null}
        {gallery.length?<div className="social-link-gallery">{gallery.map((image,index)=><button type="button" key={`${index}:${image}`} onClick={()=>setLightbox(index)}><img src={image} alt={`${title} ${index+1}`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/></button>)}</div>:playing&&video?<video key={video} src={video} poster={cover} controls autoPlay playsInline preload="metadata" onError={mediaError}/>:<button className="social-link-poster" type="button" onClick={play}>{cover?<img src={cover} alt="" referrerPolicy="no-referrer"/>:null}<span><i className="material-symbols-outlined" aria-hidden="true">play_arrow</i>{t('link.parse.play')}</span></button>}
        {current?.description?<p className="social-link-description">{current.description}</p>:null}
        {failed?<button className="ghost-button" type="button" onClick={ask}>{t('link.parse.action')}</button>:null}
        {notice?<p role="status">{notice}</p>:null}
      </article>
    </SideDrawer>
    {lightbox!==null&&gallery.length?<ImageLightbox uris={gallery} index={lightbox} onIndexChange={setLightbox} onClose={()=>setLightbox(null)} altPrefix={title} fileNamePrefix="social" referrerPolicy="no-referrer"/>:null}
    <ConfirmDialog open={confirm} title={t('link.parse.confirmTitle')} description={t('link.parse.confirmBody')} confirmLabel={t('link.parse.action')} busy={busy} onClose={()=>setConfirm(false)} onConfirm={()=>void resolve()}/>
  </>;
}

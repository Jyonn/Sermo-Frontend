import {memo,useEffect,useRef,useState} from 'react';
import type {LinkPreviewDTO} from '../types';
import {api} from '../lib/api';
import {usePageActive} from '../lib/pageActivity';
import {useI18n} from '../lib/language';
import {CURRENT_RELEASE} from '../lib/pwaUpdate';
import {needsContentUpgrade} from '../lib/contentCompatibility';
import {dropShareUrl} from '../lib/dropPicker';
import {monifaShareUrl} from '../lib/monifa';
import {isPockloSong} from '../lib/pockloSong';
import {DropDiaryCard} from './DropDiaryCard';
import {MonifaOtpCard} from './MonifaOtpCard';
import {PockloSongCard} from './PockloSongCard';
import {isPockloShare,PockloShareCard} from './PockloShareCard';
import {isMusicData,MusicPreview} from './NeteaseMusicPreview';
import {isDouyinVideoData,DouyinVideoPreview} from './DouyinVideoPreview';
import {isSocialMediaData,SocialMediaPreview} from './SocialMediaPreview';
import {isStillfolioCollection,StillfolioPreview} from './StillfolioPreview';
import {SquareMusicCover} from './SquarePlayableCovers';
import {UnsupportedContentNotice} from './UnsupportedContentNotice';
import './LinkPreviewCard.css';
import {isSocialUrl,SocialLinkPreview} from './SocialLinkPreview';

function hostname(url:string){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return ''}}

/** One link lifecycle and provider dispatcher for chat, shares, composers and feeds. */
export const LinkPreviewCard=memo(function LinkPreviewCard({preview,url='',messageId,fitMedia=false,presentation='card'}:{preview?:LinkPreviewDTO|null;url?:string;messageId?:number|string;fitMedia?:boolean;presentation?:'card'|'cover'}){
  const {t}=useI18n(),active=usePageActive();
  const [resolved,setResolved]=useState(preview??null),root=useRef<HTMLAnchorElement>(null),[visible,setVisible]=useState(false);
  const currentUrl=resolved?.url||preview?.url||url;
  const drop=dropShareUrl(url)||dropShareUrl(currentUrl),monifa=monifaShareUrl(url)||monifaShareUrl(currentUrl);
  useEffect(()=>setResolved(preview??null),[preview]);
  useEffect(()=>{if(!root.current)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{rootMargin:'160px'});observer.observe(root.current);return()=>observer.disconnect()},[resolved?.status]);
  useEffect(()=>{
    if(!active||!visible||drop||monifa||resolved?.status!=='pending')return;
    let cancelled=false,attempts=0,timer:ReturnType<typeof setTimeout>|undefined;
    const poll=async()=>{try{const next=typeof messageId==='number'?await api.getMessageLinkPreview(messageId):await api.resolveExternalMedia(currentUrl);if(cancelled)return;setResolved(next);if(next.status!=='pending')return}catch{if(cancelled)return}if(++attempts<40)timer=setTimeout(()=>void poll(),2000)};
    timer=setTimeout(()=>void poll(),900);return()=>{cancelled=true;clearTimeout(timer)};
  },[active,visible,drop,monifa,resolved?.status,currentUrl,messageId]);

  // Keep the card itself as the root in chat so existing bubble skins still apply.
  function content(){
    if(needsContentUpgrade(resolved?.min_client_version,CURRENT_RELEASE.id))return <UnsupportedContentNotice minVersion={resolved?.min_client_version} title={resolved?.title||resolved?.site_name} url={currentUrl}/>;
    if(drop)return <DropDiaryCard url={drop}/>;
    if(monifa)return <MonifaOtpCard url={monifa}/>;
    if(isSocialUrl(currentUrl))return <SocialLinkPreview preview={resolved} url={currentUrl} fitMedia={fitMedia}/>;
    const data=resolved?.provider_data;
    if(resolved?.status==='ready'){
      if(presentation==='cover'&&isMusicData(data))return <SquareMusicCover music={data} uri={data.cover_url||resolved.image_url||null}/>;
      if(isPockloSong(data))return <PockloSongCard reference={data}/>;
      if(isMusicData(data))return <MusicPreview music={data}/>;
      if(isDouyinVideoData(data))return <DouyinVideoPreview previewId={resolved.preview_id} video={data} imageUrl={resolved.image_url} fitMedia={fitMedia}/>;
      if(isSocialMediaData(data))return <SocialMediaPreview media={data} previewId={resolved.preview_id} imageUrl={resolved.image_url} fitMedia={fitMedia}/>;
      if(isStillfolioCollection(data))return <StillfolioPreview collection={data} previewId={resolved.preview_id}/>;
      if(isPockloShare(data))return <PockloShareCard share={data}/>;
    }
    const loading=resolved?.status==='pending',unavailable=!resolved||resolved.status==='none'||resolved.status==='failed';
    const parseHint=resolved?.parse_error?t(`link.parse.${resolved.parse_error}`):'';
    const host=hostname(currentUrl),rawTitle=resolved?.title||host||currentUrl||t('link.title');
    const title=unavailable?(host?host.toUpperCase():t('link.preview')):host&&rawTitle.trim().toLowerCase()===host.toLowerCase()?host.toUpperCase():rawTitle;
    return <a ref={root} className={`message-link-preview-card ${loading?'is-loading':resolved?.image_url&&!unavailable?'has-image':'no-image'}${unavailable?' is-unavailable':''}`} href={url||currentUrl} aria-label={loading?t('link.generatingPreview'):undefined} onClick={event=>event.stopPropagation()} rel="noreferrer" target="_blank">
      <div className="message-link-preview-text">{loading?<><span className="message-link-preview-site">{host?host.toUpperCase():t('link.preview')}</span><span className="message-link-preview-title shimmer-line"/><span className="message-link-preview-desc shimmer-line short"/></>:<><strong className="message-link-preview-title">{title}</strong>{parseHint||(!unavailable&&resolved?.description)?<span className="message-link-preview-desc">{parseHint||resolved?.description}</span>:null}</>}</div>
      {loading?<div className="message-link-preview-image shimmer-block"/>:resolved?.image_url&&!unavailable?<img alt="" className="message-link-preview-image" loading="lazy" src={resolved.image_url}/>:<span className="message-link-preview-placeholder" aria-hidden="true">↗</span>}
    </a>;
  }
  return content();
});

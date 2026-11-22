import { useState } from "react";
import type { SocialMediaDataDTO } from "../types";
import { MediaLightbox, type MediaLightboxItem } from "./ImageLightbox";
import { useI18n } from "../lib/language";
import { api } from '../lib/api';
import { PlatformMediaCard } from "./PlatformMediaCard";
import "./SocialMediaPreview.css";

const domains = ["douyinpic.com", "byteimg.com", "xhscdn.com", "xhsimg.com", "rednotecdn.com"];

function trusted(url: string, allowed: string[]) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && allowed.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

export function isSocialMediaData(value: unknown): value is SocialMediaDataDTO {
  if (!value || typeof value !== "object") return false;
  const media = value as Partial<SocialMediaDataDTO>;
  if (!["douyin_gallery", "xiaohongshu_gallery", "xiaohongshu_video"].includes(media.provider || "")) return false;
  const sources = media.provider === "douyin_gallery" ? ["www.douyin.com"] : ["www.xiaohongshu.com", "xiaohongshu.com"];
  try { if (!sources.includes(new URL(media.canonical_url || "").hostname)) return false; } catch { return false; }
  if (media.provider === "xiaohongshu_video") return typeof media.video_url === "string" && trusted(media.video_url, ["xhscdn.com", "rednotecdn.com"]);
  return Array.isArray(media.images) && media.images.length > 0 && media.images.every((url) => typeof url === "string" && trusted(url, domains));
}

export function SocialMediaPreview({ media: initialMedia, previewId, imageUrl,fitMedia=false }: { media: SocialMediaDataDTO; previewId?:number; imageUrl?: string;fitMedia?:boolean }) {
  const { t } = useI18n();
  const [media,setMedia]=useState(initialMedia);
  const [opening,setOpening]=useState(false);
  const [retried,setRetried]=useState(false);
  const [notice,setNotice]=useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const isVideo = media.provider === "xiaohongshu_video";
  const images = media.images || [];
  const source = media.provider === "douyin_gallery" ? t("social.douyin") : t("social.xiaohongshu");
  const logo = media.provider === "douyin_gallery" ? "/icons/douyin-logo.svg" : "/icons/xiaohongshu-logo.png";
  const cover = media.cover_url || images[0] || imageUrl;
  const title = media.title || t(isVideo ? "social.video" : "social.gallery");
  const refresh=async(force=false)=>{
    if(!previewId)return true;
    const next=await api.refreshExternalMedia(previewId,force);
    if(next.status!=='ready'||!isSocialMediaData(next.provider_data)){setNotice(t(`link.parse.${next.parse_error||'unavailable'}`));return false;}
    setNotice('');
    setMedia(next.provider_data);return true;
  };
  const openMedia=async()=>{
    if(opening)return;
    setOpening(true);
    try{if(await refresh()){setIndex(0);setFailed(false);setRetried(false);setOpen(true)}}
    finally{setOpening(false)}
  };
  const items: MediaLightboxItem[] = isVideo
    ? [{id: 'video', kind: 'video', uri: media.video_url || '', posterUri: cover, loop: true, autoPlay: true, onPlaybackError: () => {
      if (retried) {setFailed(true); return;}
      setRetried(true);
      void refresh(true).then(ok => {if (!ok) setFailed(true);}).catch(() => setFailed(true));
    }}]
    : images.map((uri, position) => ({id: position, kind: 'image', uri, referrerPolicy: 'no-referrer'}));
  return <>
    <PlatformMediaCard fitMedia={fitMedia} author={media.author} cover={cover} kindLabel={isVideo ? t("social.video") : `${images.length} ${t("social.photos")}`} logo={logo} opening={opening} onClick={() => void openMedia().catch(()=>setFailed(true))} playIcon={isVideo ? "play_arrow" : undefined} source={source} title={title} />
    {notice?<span role="status" className="message-link-preview-desc">{notice}</span>:null}
    {open && <MediaLightbox altPrefix={title} index={index} items={items} onClose={() => setOpen(false)} onIndexChange={setIndex}
      source={{name: source, logo, url: media.canonical_url, author: media.author}} fileNamePrefix={media.provider}
      sharedDetail={<article className="media-drawer-article"><h2>{title}</h2>{failed && <p role="status">{t('social.playbackUnavailable')}</p>}</article>} />}
  </>;
}

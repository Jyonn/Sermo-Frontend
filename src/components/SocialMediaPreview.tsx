import { useState } from "react";
import type { SocialMediaDataDTO } from "../types";
import { ImageLightbox, ImmersiveVideo } from "./ImageLightbox";
import { SideDrawer } from "./SideDrawer";
import { useI18n } from "../lib/language";
import "./SocialMediaPreview.css";

const domains = ["douyinpic.com", "byteimg.com", "xhscdn.com", "xhsimg.com"];

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
  if (media.provider === "xiaohongshu_video") return typeof media.video_url === "string" && trusted(media.video_url, ["xhscdn.com"]);
  return Array.isArray(media.images) && media.images.length > 0 && media.images.every((url) => typeof url === "string" && trusted(url, domains));
}

export function SocialMediaPreview({ media, imageUrl }: { media: SocialMediaDataDTO; imageUrl?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const isVideo = media.provider === "xiaohongshu_video";
  const images = media.images || [];
  const source = media.provider === "douyin_gallery" ? t("social.douyin") : t("social.xiaohongshu");
  const cover = media.cover_url || images[0] || imageUrl;
  const title = media.title || t(isVideo ? "social.video" : "social.gallery");
  const galleryDetails = <div className="message-image-archive social-media-archive" onClick={(event) => event.stopPropagation()}>
    <div className="message-image-record">
      <span className="message-image-archive-label">{source}</span>
      <strong className="social-media-archive-title">{title}</strong>
      <div className="social-media-archive-foot">
        <span>{media.author || source}</span>
        <a href={media.canonical_url} rel="noreferrer" target="_blank">{t("social.openSource")} {source} ↗</a>
      </div>
    </div>
  </div>;
  return <>
    <button className="social-media-card" type="button" onClick={(event) => { event.stopPropagation(); setIndex(0); setOpen(true); }}>
      {cover ? <img alt="" className="social-media-cover" loading="lazy" referrerPolicy="no-referrer" src={cover} /> : <span className="social-media-cover" />}
      <span className="social-media-card-top">{source}<span>{isVideo ? t("social.video") : `${images.length} ${t("social.photos")}`}</span></span>
      <span className="social-media-card-bottom"><strong>{title}</strong><small>{media.author || source}</small></span>
      {isVideo ? <span className="social-media-play material-symbols-outlined" aria-hidden="true">play_arrow</span> : null}
    </button>
    {open && !isVideo ? <ImageLightbox altPrefix={title} details={images.map(() => galleryDetails)} fileNamePrefix={media.provider} index={index} onClose={() => setOpen(false)} onIndexChange={setIndex} referrerPolicy="no-referrer" uris={images} /> : null}
    <SideDrawer floatingBack={false} fullscreen headerless historyKey={`social-${media.canonical_url}`} open={open && isVideo} onClose={() => setOpen(false)} title={title}>
      {open && isVideo ? <div className="social-media-video"><ImmersiveVideo src={media.video_url || ""} poster={cover} onClose={() => setOpen(false)} onError={() => setFailed(true)} context={<a className="social-media-source" href={media.canonical_url} target="_blank" rel="noreferrer"><strong>{title}</strong><span>{media.author ? `${media.author} · ` : ""}{source} ↗</span></a>} />{failed ? <div className="social-media-error">{t("social.playbackUnavailable")} <a href={media.canonical_url} target="_blank" rel="noreferrer">{t("social.openSource")} {source}</a></div> : null}</div> : null}
    </SideDrawer>
  </>;
}

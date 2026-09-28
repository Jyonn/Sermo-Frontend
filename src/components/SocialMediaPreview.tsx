import { useState } from "react";
import type { SocialMediaDataDTO } from "../types";
import { ImmersiveVideo } from "./ImageLightbox";
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
  return <>
    <button className="social-media-card" type="button" onClick={(event) => { event.stopPropagation(); setOpen(true); }}>
      {cover ? <img alt="" className="social-media-cover" loading="lazy" referrerPolicy="no-referrer" src={cover} /> : <span className="social-media-cover" />}
      <span className="social-media-card-top">{source}<span>{isVideo ? t("social.video") : `${images.length} ${t("social.photos")}`}</span></span>
      <span className="social-media-card-bottom"><strong>{title}</strong><small>{media.author || source}</small></span>
      {isVideo ? <span className="social-media-play material-symbols-outlined" aria-hidden="true">play_arrow</span> : null}
    </button>
    <SideDrawer floatingBack={false} fullscreen headerless historyKey={`social-${media.canonical_url}`} open={open} onClose={() => setOpen(false)} title={title}>
      {open && isVideo ? <div className="social-media-video"><ImmersiveVideo src={media.video_url || ""} poster={cover} onClose={() => setOpen(false)} onError={() => setFailed(true)} context={<a className="social-media-source" href={media.canonical_url} target="_blank" rel="noreferrer"><strong>{title}</strong><span>{media.author ? `${media.author} · ` : ""}{source} ↗</span></a>} />{failed ? <div className="social-media-error">{t("social.playbackUnavailable")} <a href={media.canonical_url} target="_blank" rel="noreferrer">{t("social.openSource")} {source}</a></div> : null}</div> : null}
      {open && !isVideo ? <div className="social-gallery" onClick={(event) => event.stopPropagation()}>
        <header className="social-gallery-header"><div><small>{source} · {index + 1} / {images.length}</small><strong>{title}</strong></div><button type="button" aria-label={t("common.close")} onClick={() => setOpen(false)}>×</button></header>
        <div className="social-gallery-stage"><button disabled={index === 0} type="button" aria-label={t("social.previous")} onClick={() => setIndex(index - 1)}>‹</button><img referrerPolicy="no-referrer" src={images[index]} alt={`${title} ${index + 1}`} /><button disabled={index === images.length - 1} type="button" aria-label={t("social.next")} onClick={() => setIndex(index + 1)}>›</button></div>
        <footer className="social-gallery-footer"><div><strong>{media.author || source}</strong>{media.description ? <p>{media.description}</p> : null}</div><a href={media.canonical_url} target="_blank" rel="noreferrer">{t("social.openSource")} {source} ↗</a></footer>
      </div> : null}
    </SideDrawer>
  </>;
}

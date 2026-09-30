import { useState } from "react";
import type { SocialMediaDataDTO } from "../types";
import { ImageLightbox, ImmersiveVideo } from "./ImageLightbox";
import { SideDrawer } from "./SideDrawer";
import { useI18n } from "../lib/language";
import { PlatformMediaCard, PlatformVideoError, PlatformVideoSource } from "./PlatformMediaCard";
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
  const logo = media.provider === "douyin_gallery" ? "/icons/douyin-logo.svg" : "/icons/xiaohongshu-logo.png";
  const cover = media.cover_url || images[0] || imageUrl;
  const title = media.title || t(isVideo ? "social.video" : "social.gallery");
  const galleryDetails = <div className="message-image-archive social-media-archive" onClick={(event) => event.stopPropagation()}>
    <div className="message-image-record">
      <span className="message-image-archive-label social-media-brand"><img alt="" src={logo} />{source}</span>
      <strong className="social-media-archive-title">{title}</strong>
      <div className="social-media-archive-foot">
        <span>{media.author || source}</span>
        <a href={media.canonical_url} rel="noreferrer" target="_blank">{t("social.openSource")} {source} ↗</a>
      </div>
    </div>
  </div>;
  return <>
    <PlatformMediaCard author={media.author} cover={cover} kindLabel={isVideo ? t("social.video") : `${images.length} ${t("social.photos")}`} logo={logo} onClick={() => { setIndex(0); setFailed(false); setOpen(true); }} playIcon={isVideo ? "play_arrow" : undefined} source={source} title={title} />
    {open && !isVideo ? <ImageLightbox altPrefix={title} fileNamePrefix={media.provider} index={index} onClose={() => setOpen(false)} onIndexChange={setIndex} referrerPolicy="no-referrer" sharedDetail={galleryDetails} uris={images} /> : null}
    <SideDrawer floatingBack={false} fullscreen headerless historyKey={`social-${media.canonical_url}`} open={open && isVideo} onClose={() => setOpen(false)} title={title}>
      {open && isVideo ? <div className="platform-video-shell">
        <ImmersiveVideo context={<PlatformVideoSource author={media.author} href={media.canonical_url} label={`${t("social.openSource")} ${source}`} logo={logo} source={`${source} · ${t("social.video")}`} title={title} />} loop onClose={() => setOpen(false)} onError={() => setFailed(true)} poster={cover} src={media.video_url || ""} />
        {failed ? <PlatformVideoError href={media.canonical_url} label={`${t("social.openSource")} ${source}`}>{t("social.playbackUnavailable")}</PlatformVideoError> : null}
      </div> : null}
    </SideDrawer>
  </>;
}

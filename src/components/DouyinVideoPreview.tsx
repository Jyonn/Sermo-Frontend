import { useState } from "react";
import { useI18n } from "../lib/language";
import type { DouyinVideoDataDTO } from "../types";
import { SideDrawer } from "./SideDrawer";

export function isDouyinVideoData(value: unknown): value is DouyinVideoDataDTO {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<DouyinVideoDataDTO>;
  if (data.provider !== "douyin_video" || typeof data.video_id !== "string" || !/^\d{10,25}$/.test(data.video_id)) return false;
  if (typeof data.embed_url !== "string" || typeof data.canonical_url !== "string") return false;
  try {
    const embed = new URL(data.embed_url);
    const canonical = new URL(data.canonical_url);
    return embed.protocol === "https:"
      && embed.hostname === "open.douyin.com"
      && embed.pathname === "/player/video"
      && embed.searchParams.get("vid") === data.video_id
      && canonical.protocol === "https:"
      && canonical.hostname === "www.douyin.com"
      && canonical.pathname === `/video/${data.video_id}`;
  } catch {
    return false;
  }
}

export function DouyinVideoPreview({ video, imageUrl }: { video: DouyinVideoDataDTO; imageUrl?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const aspectRatio = video.width > 0 && video.height > 0 ? `${video.width} / ${video.height}` : "9 / 16";
  const embedUrl = new URL(video.embed_url);
  embedUrl.searchParams.set("autoplay", "1");

  return <>
    <button className="douyin-video-card" type="button" onClick={(event) => { event.stopPropagation(); setOpen(true); }}>
      {imageUrl ? <img className="douyin-video-poster" src={imageUrl} alt="" loading="lazy" /> : <span className="douyin-video-poster-fallback" aria-hidden="true" />}
      <span className="douyin-video-play material-symbols-outlined" aria-hidden="true">play_arrow</span>
      <span className="douyin-video-copy"><small>{t("douyin.source")}</small><strong>{video.title || t("douyin.video")}</strong></span>
    </button>
    <SideDrawer className="douyin-video-drawer" historyKey={`douyin-video-${video.video_id}`} open={open} onClose={() => setOpen(false)} title={video.title || t("douyin.video")}>
      <div className="douyin-video-viewer">
        {open ? <iframe title={video.title || t("douyin.video")} src={embedUrl.toString()} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ aspectRatio }} /> : null}
        <a href={video.canonical_url} rel="noreferrer" target="_blank">{t("douyin.openOriginal")} <span aria-hidden="true">↗</span></a>
      </div>
    </SideDrawer>
  </>;
}

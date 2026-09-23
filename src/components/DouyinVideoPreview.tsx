import { useState } from "react";
import { useI18n } from "../lib/language";
import type { DouyinVideoDataDTO } from "../types";
import { SideDrawer } from "./SideDrawer";

export function isDouyinVideoData(value: unknown): value is DouyinVideoDataDTO {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<DouyinVideoDataDTO>;
  if (data.provider !== "douyin_video" || typeof data.video_id !== "string" || !/^\d{10,25}$/.test(data.video_id)) return false;
  if (typeof data.canonical_url !== "string") return false;
  try {
    const canonical = new URL(data.canonical_url);
    const media = data.video_url ? new URL(data.video_url) : null;
    const allowedMedia = ["douyinvod.com", "douyincdn.com", "bytecdn.cn", "snssdk.com", "amemv.com"];
    return (!media || (media.protocol === "https:"
      && allowedMedia.some((host) => media.hostname === host || media.hostname.endsWith(`.${host}`))
      && media.pathname.length > 1))
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
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const aspectRatio = video.width > 0 && video.height > 0 ? `${video.width} / ${video.height}` : "9 / 16";
  const playable = Boolean(video.video_url);

  return <>
    <button className="douyin-video-card" type="button" onClick={(event) => { event.stopPropagation(); if (playable) setOpen(true); else window.open(video.canonical_url, "_blank", "noopener,noreferrer"); }}>
      {imageUrl ? <img className="douyin-video-poster" src={imageUrl} alt="" loading="lazy" /> : <span className="douyin-video-poster-fallback" aria-hidden="true" />}
      <span className="douyin-video-play material-symbols-outlined" aria-hidden="true">{playable ? "play_arrow" : "open_in_new"}</span>
      <span className="douyin-video-copy"><small>{t("douyin.source")}</small><strong>{video.title || t("douyin.video")}</strong></span>
    </button>
    <SideDrawer className="douyin-video-drawer" historyKey={`douyin-video-${video.video_id}`} open={open} onClose={() => setOpen(false)} title={video.title || t("douyin.video")}>
      <div className="douyin-video-viewer">
        {open && video.video_url ? <video title={video.title || t("douyin.video")} src={video.video_url} controls autoPlay playsInline poster={imageUrl} style={{ aspectRatio }} onError={() => setPlaybackFailed(true)} /> : null}
        {playbackFailed ? <p>{t("douyin.playbackUnavailable")}</p> : null}
        <a href={video.canonical_url} rel="noreferrer" target="_blank">{t("douyin.openOriginal")} <span aria-hidden="true">↗</span></a>
      </div>
    </SideDrawer>
  </>;
}

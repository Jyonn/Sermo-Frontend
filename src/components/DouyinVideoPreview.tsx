import { useState } from "react";
import "./DouyinVideoPreview.css";
import { useI18n } from "../lib/language";
import type { DouyinVideoDataDTO } from "../types";
import { ImmersiveVideo } from "./ImageLightbox";
import { SideDrawer } from "./SideDrawer";

export function isDouyinVideoData(value: unknown): value is DouyinVideoDataDTO {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<DouyinVideoDataDTO>;
  if (data.provider !== "douyin_video" || typeof data.video_id !== "string" || !/^\d{10,25}$/.test(data.video_id)) return false;
  if (typeof data.canonical_url !== "string") return false;
  try {
    const canonical = new URL(data.canonical_url);
    const media = data.video_url ? new URL(data.video_url) : null;
    const allowedMedia = ["douyinvod.com", "douyincdn.com", "bytecdn.cn", "snssdk.com", "amemv.com", "zjcdn.com"];
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

function DouyinSource({ video }: { video: DouyinVideoDataDTO }) {
  const { t } = useI18n();
  return <a className="douyin-player-context" href={video.canonical_url} rel="noreferrer" target="_blank" aria-label={t("douyin.openOriginal")}>
    <span className="douyin-player-context-mark" aria-hidden="true"><span className="material-symbols-outlined" style={{ fontSize: 22 }}>music_note</span></span>
    <span className="douyin-player-context-copy">
      <strong>{video.title || t("douyin.video")}</strong>
      <small>@{video.author || t("douyin.creator")} · {t("douyin.source")}</small>
    </span>
    <span className="material-symbols-outlined" aria-hidden="true" style={{ display: "grid", width: 34, height: 34, placeItems: "center", borderRadius: "50%", color: "#f5faf8", background: "rgba(255,255,255,.09)", fontSize: 18 }}>north_east</span>
  </a>;
}

function DouyinDrawerPlayer({ imageUrl, onClose, video }: { imageUrl?: string; onClose: () => void; video: DouyinVideoDataDTO }) {
  const { t } = useI18n();
  const [playbackFailed, setPlaybackFailed] = useState(false);

  return <div className="douyin-player-shell">
    <ImmersiveVideo
      context={<DouyinSource video={video} />}
      loop
      onClose={onClose}
      onError={() => setPlaybackFailed(true)}
      poster={imageUrl}
      src={video.video_url || ""}
    />
    {playbackFailed ? <div className="douyin-player-error">
      <span className="material-symbols-outlined" aria-hidden="true" style={{ color: "#ff5676", fontSize: 38 }}>video_file</span>
      <strong>{t("douyin.playbackUnavailable")}</strong>
      <a href={video.canonical_url} rel="noreferrer" target="_blank">{t("douyin.openOriginal")}</a>
    </div> : null}
  </div>;
}

export function DouyinVideoPreview({ video, imageUrl }: { video: DouyinVideoDataDTO; imageUrl?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const playable = Boolean(video.video_url);

  return <>
    <button className="douyin-video-card" type="button" onClick={(event) => { event.stopPropagation(); if (playable) setOpen(true); else window.open(video.canonical_url, "_blank", "noopener,noreferrer"); }}>
      {imageUrl ? <img className="douyin-video-poster" src={imageUrl} alt="" loading="lazy" /> : <span className="douyin-video-poster-fallback" aria-hidden="true" />}
      <span className="douyin-video-play material-symbols-outlined" aria-hidden="true">{playable ? "play_arrow" : "open_in_new"}</span>
      <span className="douyin-video-copy"><small>{t("douyin.source")}</small><strong>{video.title || t("douyin.video")}</strong></span>
    </button>
    <SideDrawer className="douyin-video-drawer" headerless historyKey={`douyin-video-${video.video_id}`} open={open} onClose={() => setOpen(false)} title={video.title || t("douyin.video")}>
      {open && video.video_url ? <DouyinDrawerPlayer imageUrl={imageUrl} onClose={() => setOpen(false)} video={video} /> : null}
    </SideDrawer>
  </>;
}

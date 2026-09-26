import { useState } from "react";
import "./DouyinVideoPreview.css";
import { useI18n } from "../lib/language";
import type { DouyinVideoDataDTO } from "../types";
import { ImmersiveVideo } from "./ImageLightbox";
import { SideDrawer } from "./SideDrawer";
import { api } from "../lib/api";

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
    <span className="douyin-player-context-mark" aria-hidden="true"><img alt="" src="/icons/douyin-logo.svg" /></span>
    <span className="douyin-player-context-copy">
      <strong>{video.title || t("douyin.video")}</strong>
      <small>@{video.author || t("douyin.creator")} · {t("douyin.source")}</small>
    </span>
    <span className="material-symbols-outlined" aria-hidden="true" style={{ display: "grid", width: 34, height: 34, placeItems: "center", borderRadius: "50%", color: "#f5faf8", background: "rgba(255,255,255,.09)", fontSize: 18 }}>north_east</span>
  </a>;
}

function DouyinDrawerPlayer({ imageUrl, onClose, onPlaybackError, playbackKey, video }: { imageUrl?: string; onClose: () => void; onPlaybackError: () => void; playbackKey: number; video: DouyinVideoDataDTO }) {
  const { t } = useI18n();

  return <div className="douyin-player-shell">
    <ImmersiveVideo
      key={playbackKey}
      context={<DouyinSource video={video} />}
      loop
      onClose={onClose}
      onError={onPlaybackError}
      poster={imageUrl}
      src={video.video_url || ""}
    />
  </div>;
}

export function DouyinVideoPreview({ previewId, video, imageUrl }: { previewId?: number; video: DouyinVideoDataDTO; imageUrl?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(video);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryAttempted, setRetryAttempted] = useState(false);
  const playable = Boolean(currentVideo.video_url);

  const refresh = async (force: boolean) => {
    if (!previewId) return null;
    const refreshed = await api.refreshExternalMedia(previewId, force);
    if (!isDouyinVideoData(refreshed.provider_data) || !refreshed.provider_data.video_url) return null;
    setCurrentVideo(refreshed.provider_data);
    setCurrentImageUrl(refreshed.image_url || imageUrl);
    return { video: refreshed.provider_data, refreshed: Boolean(refreshed.refreshed) };
  };

  const openPlayer = async () => {
    let refreshedVideo: Awaited<ReturnType<typeof refresh>> = null;
    try { refreshedVideo = await refresh(false); } catch { /* The cached URL may still be playable. */ }
    setPlaybackFailed(false);
    setRetryAttempted(false);
    if (refreshedVideo?.video.video_url || currentVideo.video_url) setOpen(true);
    else window.open(currentVideo.canonical_url, "_blank", "noopener,noreferrer");
  };

  const handlePlaybackError = async () => {
    if (retrying || retryAttempted || playbackFailed) return;
    setRetryAttempted(true);
    setRetrying(true);
    try {
      const result = await refresh(true);
      if (result?.refreshed && result.video.video_url) {
        setPlaybackKey((value) => value + 1);
        return;
      }
    } catch { /* Show the final fallback below. */ }
    finally { setRetrying(false); }
    setPlaybackFailed(true);
  };

  return <>
    <button className="douyin-video-card" type="button" onClick={(event) => { event.stopPropagation(); void openPlayer(); }}>
      {currentImageUrl ? <img className="douyin-video-poster" src={currentImageUrl} alt="" loading="lazy" /> : <span className="douyin-video-poster-fallback" aria-hidden="true" />}
      <span className="douyin-video-play material-symbols-outlined" aria-hidden="true">{playable ? "play_arrow" : "open_in_new"}</span>
      <span className="douyin-video-copy"><small>{t("douyin.source")}</small><strong>{currentVideo.title || t("douyin.video")}</strong></span>
    </button>
    <SideDrawer floatingBack={false} fullscreen headerless historyKey={`douyin-video-${currentVideo.video_id}`} open={open} onClose={() => setOpen(false)} title={currentVideo.title || t("douyin.video")}>
      {open && currentVideo.video_url ? <DouyinDrawerPlayer imageUrl={currentImageUrl} onClose={() => setOpen(false)} onPlaybackError={() => void handlePlaybackError()} playbackKey={playbackKey} video={currentVideo} /> : null}
      {playbackFailed ? <div className="douyin-player-error">
        <span className="material-symbols-outlined" aria-hidden="true" style={{ color: "#ff5676", fontSize: 38 }}>video_file</span>
        <strong>{t("douyin.playbackUnavailable")}</strong>
        <a href={currentVideo.canonical_url} rel="noreferrer" target="_blank">{t("douyin.openOriginal")}</a>
      </div> : null}
    </SideDrawer>
  </>;
}

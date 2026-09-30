import { useState } from "react";
import { useI18n } from "../lib/language";
import type { DouyinVideoDataDTO } from "../types";
import { ImmersiveVideo } from "./ImageLightbox";
import { SideDrawer } from "./SideDrawer";
import { api } from "../lib/api";
import { PlatformMediaCard, PlatformVideoError, PlatformVideoSource } from "./PlatformMediaCard";

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

function DouyinDrawerPlayer({ imageUrl, onClose, onPlaybackError, playbackKey, video }: { imageUrl?: string; onClose: () => void; onPlaybackError: () => void; playbackKey: number; video: DouyinVideoDataDTO }) {
  const { t } = useI18n();

  return <div className="platform-video-shell">
    <ImmersiveVideo
      key={playbackKey}
      context={<PlatformVideoSource author={video.author || t("douyin.creator")} href={video.canonical_url} label={t("douyin.openOriginal")} logo="/icons/douyin-logo.svg" source={t("douyin.source")} title={video.title || t("douyin.video")} />}
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
    <PlatformMediaCard author={currentVideo.author} cover={currentImageUrl} kindLabel={t("social.video")} logo="/icons/douyin-logo.svg" onClick={() => void openPlayer()} playIcon={playable ? "play_arrow" : "open_in_new"} source={t("social.douyin")} title={currentVideo.title || t("douyin.video")} />
    <SideDrawer floatingBack={false} fullscreen headerless historyKey={`douyin-video-${currentVideo.video_id}`} open={open} onClose={() => setOpen(false)} title={currentVideo.title || t("douyin.video")}>
      {open && currentVideo.video_url ? <DouyinDrawerPlayer imageUrl={currentImageUrl} onClose={() => setOpen(false)} onPlaybackError={() => void handlePlaybackError()} playbackKey={playbackKey} video={currentVideo} /> : null}
      {playbackFailed ? <PlatformVideoError href={currentVideo.canonical_url} label={t("douyin.openOriginal")}>{t("douyin.playbackUnavailable")}</PlatformVideoError> : null}
    </SideDrawer>
  </>;
}

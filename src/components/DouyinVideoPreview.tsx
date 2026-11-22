import { useState } from "react";
import { useI18n } from "../lib/language";
import type { DouyinVideoDataDTO } from "../types";
import { MediaLightbox } from "./ImageLightbox";
import { api } from "../lib/api";
import {naturalMediaRatio} from '../lib/squareNoteMedia';
import { PlatformMediaCard } from "./PlatformMediaCard";

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

export function DouyinVideoPreview({ previewId, video, imageUrl,fitMedia=false }: { previewId?: number; video: DouyinVideoDataDTO; imageUrl?: string;fitMedia?:boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(video);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryAttempted, setRetryAttempted] = useState(false);
  const [opening, setOpening] = useState(false);
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
    if (opening) return;
    setOpening(true);
    let refreshedVideo: Awaited<ReturnType<typeof refresh>> = null;
    try { refreshedVideo = await refresh(false); } catch { /* The cached URL may still be playable. */ }
    setPlaybackFailed(false);
    setRetryAttempted(false);
    if (refreshedVideo?.video.video_url || currentVideo.video_url) setOpen(true);
    else window.open(currentVideo.canonical_url, "_blank", "noopener,noreferrer");
    setOpening(false);
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
    <PlatformMediaCard fitMedia={fitMedia} aspectRatio={naturalMediaRatio(currentVideo.width,currentVideo.height)} author={currentVideo.author} cover={currentImageUrl} kindLabel={t("social.video")} logo="/icons/douyin-logo.svg" onClick={() => void openPlayer()} opening={opening} playIcon={playable ? "play_arrow" : "open_in_new"} source={t("social.douyin")} title={currentVideo.title || t("douyin.video")} />
    {open && <MediaLightbox index={0} items={[{id: playbackKey, uri: currentVideo.video_url || '', kind: 'video', posterUri: currentImageUrl,
      width: currentVideo.width, height: currentVideo.height, loop: true, autoPlay: true, onPlaybackError: () => void handlePlaybackError()}]}
      onIndexChange={() => undefined} onClose={() => setOpen(false)} altPrefix={currentVideo.title || t('douyin.video')}
      historyKey={`douyin-video-${currentVideo.video_id}`}
      source={{name: t('social.douyin'), url: currentVideo.canonical_url, logo: '/icons/douyin-logo.svg', author: currentVideo.author}}
      sharedDetail={<article className="media-drawer-article"><h2>{currentVideo.title || t('douyin.video')}</h2>{playbackFailed && <p role="status">{t('douyin.playbackUnavailable')}</p>}</article>} />}
  </>;
}

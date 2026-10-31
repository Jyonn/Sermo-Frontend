import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { i18n } from "../lib/language";
import { resolveStableResourceUri } from "../lib/stableResource";
import { useMediaSource } from "../lib/useMediaSource";
import { messageMediaAspect } from "../lib/messageMedia";
import type { ImageMetadataDTO, VideoMetadataDTO } from "../types";

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export const RetryingMediaImage = memo(function RetryingMediaImage({
  alt,
  ariaHidden,
  className,
  fallbackSrc,
  loading = "lazy",
  onFinalError,
  onLoad,
  src,
}: {
  alt: string;
  ariaHidden?: boolean;
  className?: string;
  fallbackSrc?: string;
  loading?: "eager" | "lazy";
  onFinalError?: () => void;
  onLoad?: (width: number, height: number) => void;
  src: string;
}) {
  const source = useMediaSource(src, fallbackSrc);
  const finalError = useRef(onFinalError); finalError.current = onFinalError;
  useEffect(() => { if (source.phase === "error") finalError.current?.(); }, [source.phase]);

  return (
    <img
      key={source.src}
      alt={alt}
      aria-hidden={ariaHidden}
      className={className}
      loading={loading}
      src={source.src}
      onError={source.fail}
      onLoad={(event) => { source.ready(); onLoad?.(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight); }}
    />
  );
});

export const MessageMediaImage = memo(function MessageMediaImage({
  failed,
  groupClassName,
  localPreviewUri,
  metadata,
  messageId,
  onOpenImage,
  onRetry,
  thumbnailUri,
  uri,
  width,
  height,
}: {
  failed?: boolean;
  groupClassName: string;
  localPreviewUri?: string;
  metadata?: ImageMetadataDTO | null;
  messageId?: number;
  onOpenImage?: (uris: string[], index: number, metadata?: Array<ImageMetadataDTO | null>, messageIds?: Array<number | null>) => void;
  onRetry?: () => void;
  thumbnailUri?: string;
  uri: string;
  width?: number | null;
  height?: number | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const resolvedUri = resolveStableResourceUri(uri) ?? uri;
  const resolvedThumbnailUri = resolveStableResourceUri(thumbnailUri) ?? thumbnailUri;
  const displayUri = localPreviewUri ?? resolvedUri;
  const fallbackUri = localPreviewUri ? resolvedThumbnailUri ?? resolvedUri : resolvedThumbnailUri;
  const [measuredSize, setMeasuredSize] = useState<{ width: number; height: number } | null>(null);
  const imageAspect = messageMediaAspect(measuredSize?.width ?? metadata?.pixel_width ?? width, measuredSize?.height ?? metadata?.pixel_height ?? height);
  const frameStyle = { "--message-media-aspect": imageAspect } as CSSProperties;

  useEffect(() => {
    setLoaded(false);
  }, [displayUri]);

  return (
    <button
      aria-label={failed ? i18n.t("message.retrySend") : i18n.t("message.image")}
      className={`message-media-frame image-button ${imageAspect ? "has-intrinsic-size" : ""} ${groupClassName} ${loaded ? "is-loaded" : "is-loading"}`.trim()}
      onClick={() => failed ? onRetry?.() : onOpenImage?.([displayUri], 0, [metadata ?? null], [messageId ?? null])}
      style={frameStyle}
      type="button"
    >
      {resolvedThumbnailUri ? <RetryingMediaImage alt="" ariaHidden className="message-media-image message-media-image-thumb" src={resolvedThumbnailUri} /> : null}
      <RetryingMediaImage
        alt={i18n.t("message.image")}
        className="message-media-image message-media-image-main"
        fallbackSrc={fallbackUri}
        src={displayUri}
        onFinalError={() => setLoaded(true)}
        onLoad={(width, height) => { setLoaded(true); setMeasuredSize({ width, height }); }}
      />
    </button>
  );
});

export const MessageMediaVideo = memo(function MessageMediaVideo({
  groupClassName,
  messageId,
  metadata,
  onOpenVideo,
  thumbnailUri,
  uri,
  width,
  height,
}: {
  groupClassName: string;
  messageId?: number;
  metadata?: VideoMetadataDTO | null;
  onOpenVideo?: (uri: string, metadata: VideoMetadataDTO | null, messageId: number | null) => void;
  thumbnailUri?: string;
  uri: string;
  width?: number | null;
  height?: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewPosterOnly = uri === "preview://video";
  const metadataAspectRatio = metadata?.pixel_width && metadata.pixel_height
    && Number.isFinite(metadata.pixel_width) && Number.isFinite(metadata.pixel_height)
    && metadata.pixel_width > 0 && metadata.pixel_height > 0
    ? metadata.pixel_width / metadata.pixel_height
    : width && height ? width / height : null;
  const hasPoster = Boolean(thumbnailUri);
  const [loaded, setLoaded] = useState(previewPosterOnly || hasPoster);
  const [duration, setDuration] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number | null>(metadataAspectRatio);
  const source = useMediaSource(uri, undefined, "video");
  const resolvedUri = source.src;
  const resolvedThumbnailUri = resolveStableResourceUri(thumbnailUri) ?? thumbnailUri;

  useEffect(() => {
    const video = videoRef.current;
    setLoaded(previewPosterOnly || hasPoster || Boolean(video && video.readyState >= 1));
    setDuration(video && Number.isFinite(video.duration) ? video.duration : 0);
    setAspectRatio(video?.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : metadataAspectRatio);
  }, [hasPoster, previewPosterOnly, resolvedUri]);

  return (
    <div
      className={`message-media-frame message-video-card ${groupClassName} ${loaded ? "is-loaded" : "is-loading"}`.trim()}
      style={{ "--message-media-aspect": messageMediaAspect(aspectRatio ?? 4 / 3, 1) } as CSSProperties}
    >
      <button
        aria-label={i18n.t("video.view")}
        className="message-video-surface"
        onClick={() => onOpenVideo?.(uri, metadata ?? null, messageId ?? null)}
        type="button"
      >
        {previewPosterOnly ? (
          <img alt="" aria-hidden="true" className="message-media-video message-video-preview-poster" src={resolvedThumbnailUri} />
        ) : (
          <video
            className="message-media-video"
            onCanPlay={() => { source.ready(); setLoaded(true); }}
            onDurationChange={(event) => {
              const value = event.currentTarget.duration;
              if (Number.isFinite(value)) setDuration(value);
            }}
            onError={source.fail}
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              setLoaded(true);
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                const measuredAspectRatio = video.videoWidth / video.videoHeight;
                const metadataMismatch = metadataAspectRatio !== null
                  && Math.abs(measuredAspectRatio - metadataAspectRatio) / metadataAspectRatio > 0.05;
                if (metadataAspectRatio === null || metadataMismatch) {
                  setAspectRatio(measuredAspectRatio);
                }
              }
              if (Number.isFinite(video.duration)) setDuration(video.duration);
            }}
            playsInline
            poster={resolvedThumbnailUri}
            preload="metadata"
            ref={videoRef}
            src={resolvedUri}
          />
        )}
        <span className="message-video-shade" aria-hidden="true" />
        <span className="message-video-play" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m9 6 9 6-9 6Z" /></svg>
        </span>
      </button>
      <div className="message-video-meta">
        <span>{formatDuration(metadata?.duration_seconds ?? duration)}</span>
      </div>
    </div>
  );
});

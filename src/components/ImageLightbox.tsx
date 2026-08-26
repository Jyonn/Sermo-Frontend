import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/language";

interface ImageLightboxProps {
  index: number;
  uris: string[];
  altPrefix?: string;
  details?: ReactNode[];
  downloadLabels?: string[];
  fileNamePrefix?: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export interface MediaLightboxItem {
  uri: string;
  kind: "image" | "video";
  posterUri?: string | null;
  width?: number | null;
  height?: number | null;
  detail?: ReactNode;
  downloadLabel?: string;
}

interface MediaLightboxProps {
  index: number;
  items: MediaLightboxItem[];
  altPrefix?: string;
  fileNamePrefix?: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

async function downloadMedia(uri: string, fileNamePrefix: string) {
  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("download_failed");
    const blob = await response.blob();
    const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg").replace("quicktime", "mov") || "bin";
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${fileNamePrefix}-${Date.now()}.${extension}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(uri, "_blank", "noopener,noreferrer");
  }
}

type ImageViewMode = "default" | "fit" | "fill" | "actual" | "custom";

interface ImageTransform {
  x: number;
  y: number;
  scale: number;
}

function ImmersiveImage({ alt, src, onClose }: { alt: string; src: string; onClose: () => void }) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef({
    moved: false,
    startX: 0,
    startY: 0,
    startTransform: { x: 0, y: 0, scale: 1 } as ImageTransform,
    pinchDistance: 0,
    pinchMidX: 0,
    pinchMidY: 0,
  });
  const transformRef = useRef<ImageTransform>({ x: 0, y: 0, scale: 1 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState<ImageTransform>({ x: 0, y: 0, scale: 1 });
  const [mode, setMode] = useState<ImageViewMode>("default");
  const [controlsVisible, setControlsVisible] = useState(false);

  const scales = (() => {
    if (!naturalSize.width || !naturalSize.height || !viewportSize.width || !viewportSize.height) {
      return { minimum: 1, fit: 1, fill: 1, actual: 1, maximum: 16 };
    }
    const widthScale = viewportSize.width / naturalSize.width;
    const heightScale = viewportSize.height / naturalSize.height;
    const fit = Math.min(widthScale, heightScale);
    const minimum = Math.min(1, fit);
    const fill = Math.max(widthScale, heightScale);
    return {
      minimum,
      fit,
      fill,
      actual: 1,
      maximum: 16,
    };
  })();

  const clampScale = (scale: number) => Math.max(scales.minimum, Math.min(scales.maximum, scale));

  const commitTransform = (next: ImageTransform) => {
    const stageWidth = viewportSize.width;
    const stageHeight = viewportSize.height;
    const clampedScale = clampScale(next.scale);
    const renderedWidth = naturalSize.width * clampedScale;
    const renderedHeight = naturalSize.height * clampedScale;
    const maxX = Math.max(0, (renderedWidth - stageWidth) / 2);
    const maxY = Math.max(0, (renderedHeight - stageHeight) / 2);
    const clamped = {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
      scale: clampedScale,
    };
    transformRef.current = clamped;
    setTransform(clamped);
  };

  const applyMode = (nextMode: Exclude<ImageViewMode, "default" | "custom">) => {
    const nextScale = nextMode === "fit" ? scales.fit : nextMode === "fill" ? scales.fill : scales.actual;
    const clampedScale = clampScale(nextScale);
    const renderedWidth = naturalSize.width * clampedScale;
    const renderedHeight = naturalSize.height * clampedScale;
    setMode(nextMode);
    commitTransform({
      x: nextMode === "fill" ? Math.max(0, (renderedWidth - viewportSize.width) / 2) : 0,
      y: nextMode === "fill" ? Math.max(0, (renderedHeight - viewportSize.height) / 2) : 0,
      scale: clampedScale,
    });
  };

  const zoomBy = (factor: number, clientX?: number, clientY?: number) => {
    const current = transformRef.current;
    const nextScale = clampScale(current.scale * factor);
    if (Math.abs(nextScale - current.scale) < 0.0001) return;
    const stage = stageRef.current;
    const rect = stage?.getBoundingClientRect();
    const anchorX = clientX !== undefined && rect ? clientX - rect.left : viewportSize.width / 2;
    const anchorY = clientY !== undefined && rect ? clientY - rect.top : viewportSize.height / 2;
    const ratio = nextScale / current.scale;
    setMode("custom");
    commitTransform({
      x: current.x + (anchorX - viewportSize.width / 2) * (1 - ratio),
      y: current.y + (anchorY - viewportSize.height / 2) * (1 - ratio),
      scale: nextScale,
    });
  };

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateViewport = () => setViewportSize({ width: stage.clientWidth, height: stage.clientHeight });
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!naturalSize.width || !viewportSize.width) return;
    setMode("default");
    commitTransform({ x: 0, y: 0, scale: scales.minimum });
  }, [naturalSize.width, naturalSize.height, viewportSize.width, viewportSize.height]);

  useLayoutEffect(() => {
    setControlsVisible(false);
    setNaturalSize({ width: 0, height: 0 });
    transformRef.current = { x: 0, y: 0, scale: 1 };
    setTransform({ x: 0, y: 0, scale: 1 });
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth && image.naturalHeight) {
      setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
    }
  }, [src]);

  const beginGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;
    gesture.moved = false;
    gesture.startX = event.clientX;
    gesture.startY = event.clientY;
    gesture.startTransform = transformRef.current;
    if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      gesture.pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      gesture.pinchMidX = (first.x + second.x) / 2;
      gesture.pinchMidY = (first.y + second.y) / 2;
      gesture.startTransform = transformRef.current;
    }
  };

  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;
    if (pointersRef.current.size >= 2) {
      const [first, second] = [...pointersRef.current.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const midX = (first.x + second.x) / 2;
      const midY = (first.y + second.y) / 2;
      if (Math.abs(distance - gesture.pinchDistance) > 2) gesture.moved = true;
      const nextScale = gesture.startTransform.scale * (distance / Math.max(gesture.pinchDistance, 1));
      const ratio = nextScale / gesture.startTransform.scale;
      const centerX = viewportSize.width / 2;
      const centerY = viewportSize.height / 2;
      setMode("custom");
      commitTransform({
        x: gesture.startTransform.x + (midX - gesture.pinchMidX) + (gesture.pinchMidX - centerX) * (1 - ratio),
        y: gesture.startTransform.y + (midY - gesture.pinchMidY) + (gesture.pinchMidY - centerY) * (1 - ratio),
        scale: nextScale,
      });
      return;
    }
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (Math.hypot(deltaX, deltaY) > 6) gesture.moved = true;
    if (transformRef.current.scale > scales.minimum + 0.001) {
      setMode("custom");
      commitTransform({
        ...gesture.startTransform,
        x: gesture.startTransform.x + deltaX,
        y: gesture.startTransform.y + deltaY,
      });
    }
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.values()][0];
      gestureRef.current.startX = remaining.x;
      gestureRef.current.startY = remaining.y;
      gestureRef.current.startTransform = transformRef.current;
      return;
    }
    if (!gestureRef.current.moved) setControlsVisible((visible) => !visible);
  };

  return <div
    className="immersive-image-stage"
    onClick={(event) => event.stopPropagation()}
    onPointerCancel={endGesture}
    onPointerDown={beginGesture}
    onPointerMove={moveGesture}
    onPointerUp={endGesture}
    onWheel={(event) => {
      event.preventDefault();
      setMode("custom");
      if (event.ctrlKey || event.metaKey) {
        zoomBy(Math.exp(-event.deltaY * 0.008), event.clientX, event.clientY);
        return;
      }
      commitTransform({
        ...transformRef.current,
        x: transformRef.current.x - event.deltaX,
        y: transformRef.current.y - event.deltaY,
      });
    }}
    ref={stageRef}
    role="presentation"
  >
    <img
      alt={alt}
      className="immersive-image-canvas"
      draggable={false}
      onLoad={(event) => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
      ref={imageRef}
      src={src}
      style={{
        height: naturalSize.height ? `${naturalSize.height}px` : "auto",
        transform: `translate3d(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px), 0) scale(${transform.scale})`,
        width: naturalSize.width ? `${naturalSize.width}px` : "auto",
      }}
    />
    <div className={`immersive-image-actionbar${controlsVisible ? " is-visible" : ""}`} onPointerDown={(event) => event.stopPropagation()}>
      <div className="immersive-image-view-modes" role="group" aria-label={t("media.viewMode")}>
        <button className={mode === "fit" ? "is-active" : ""} onClick={() => applyMode("fit")} type="button">{t("media.fitPage")}</button>
        <button className={mode === "fill" ? "is-active" : ""} onClick={() => applyMode("fill")} type="button">{t("media.fillScreen")}</button>
        <button className={mode === "actual" ? "is-active" : ""} onClick={() => applyMode("actual")} type="button">{t("media.actualSize")}</button>
      </div>
      <div className="immersive-image-zoom-controls">
        <button
          aria-label={t("media.zoomOut")}
          disabled={transform.scale <= scales.minimum + 0.0001}
          onClick={() => zoomBy(0.8)}
          type="button"
        >−</button>
        <span className="immersive-image-zoom">{Math.round(transform.scale * 100)}%</span>
        <button
          aria-label={t("media.zoomIn")}
          disabled={transform.scale >= scales.maximum - 0.0001}
          onClick={() => zoomBy(1.25)}
          type="button"
        >＋</button>
      </div>
      <button aria-label={t("common.close")} className="immersive-image-close" onClick={onClose} type="button">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  </div>;
}

function formatPlaybackTime(value: number) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function ImmersiveVideo({ poster, src, onClose }: { poster?: string | null; src: string; onClose: () => void }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => () => videoRef.current?.pause(), []);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play(); else video.pause();
  };

  return <div
    className="immersive-video-stage"
    onClick={(event) => {
      event.stopPropagation();
      setControlsVisible((visible) => !visible);
    }}
    role="presentation"
  >
    <video
      className="immersive-video-canvas"
      onDurationChange={(event) => setDuration(event.currentTarget.duration)}
      onEnded={() => setPlaying(false)}
      onPause={() => setPlaying(false)}
      onPlay={() => setPlaying(true)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      playsInline
      poster={poster || undefined}
      preload="metadata"
      ref={videoRef}
      src={src}
    />
    <button
      aria-label={playing ? t("media.pause") : t("media.play")}
      className={`immersive-video-center-control${controlsVisible ? " is-visible" : ""}`}
      onClick={(event) => { event.stopPropagation(); togglePlayback(); }}
      type="button"
    >
      <span className="material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>
    </button>
    <div className={`immersive-image-actionbar immersive-video-actionbar${controlsVisible ? " is-visible" : ""}`} onClick={(event) => event.stopPropagation()}>
      <button aria-label={playing ? t("media.pause") : t("media.play")} className="immersive-video-play" onClick={togglePlayback} type="button">
        <span className="material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>
        <span>{playing ? t("media.pause") : t("media.play")}</span>
      </button>
      <span className="immersive-video-time">{formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}</span>
      <button aria-label={t("common.close")} className="immersive-image-close" onClick={onClose} type="button">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
    <div className={`immersive-video-timeline${controlsVisible ? " is-visible" : ""}`} onClick={(event) => event.stopPropagation()}>
      <input
        aria-label={t("media.duration")}
        max={Math.max(duration, 0)}
        min={0}
        onChange={(event) => {
          const video = videoRef.current;
          if (video) video.currentTime = Number(event.currentTarget.value);
        }}
        step={0.01}
        type="range"
        value={Math.min(currentTime, duration || 0)}
      />
    </div>
  </div>;
}

export function MediaLightbox({
  index,
  items,
  altPrefix,
  fileNamePrefix = "sermo-media",
  onClose,
  onIndexChange,
}: MediaLightboxProps) {
  const { t } = useI18n();
  const resolvedAltPrefix = altPrefix || t("media.imagePreview");
  const trackRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{ moved: boolean; x: number } | null>(null);
  const [immersive, setImmersive] = useState(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft = track.clientWidth * index;
  }, [index, items]);

  if (!items.length) return null;
  const activeItem = items[index] ?? items[0];
  const close = () => onClose();

  return createPortal(
    <div className="dialog-backdrop message-image-preview-backdrop" onClick={() => {
      if (immersive) return;
      if (gestureRef.current?.moved) {
        gestureRef.current = null;
        return;
      }
      close();
    }} onPointerDown={(event) => { gestureRef.current = { moved: false, x: event.clientX }; }} onPointerMove={(event) => {
      const gesture = gestureRef.current;
      if (gesture && Math.abs(event.clientX - gesture.x) > 8) gesture.moved = true;
    }} role="presentation">
      <section aria-modal="true" className={`message-image-preview-modal${immersive ? " is-immersive" : ""}`} role="dialog">
        <div className="message-image-preview-track" onScroll={(event) => {
          const element = event.currentTarget;
          const nextIndex = Math.round(element.scrollLeft / Math.max(element.clientWidth, 1));
          if (nextIndex !== index) onIndexChange(nextIndex);
        }} ref={trackRef}>
          {items.map((item, itemIndex) => <div className="message-image-preview-slide" key={`${item.uri}:${itemIndex}`}>
            <article className={`message-image-preview-plate${item.kind === "video" ? " message-video-preview-plate" : ""}`}>
              <div className={`message-image-preview-frame${item.kind === "video" ? " message-video-preview-frame" : ""}`}>
                {item.kind === "video"
                  ? immersive && itemIndex === index
                    ? <ImmersiveVideo onClose={close} poster={item.posterUri} src={item.uri} />
                    : <video className="message-video-preview" controls onClick={(event) => event.stopPropagation()} playsInline poster={item.posterUri || undefined} preload="metadata" src={item.uri} />
                  : immersive && itemIndex === index
                    ? <ImmersiveImage alt={`${resolvedAltPrefix} ${itemIndex + 1}`} onClose={close} src={item.uri} />
                    : <img alt={`${resolvedAltPrefix} ${itemIndex + 1}`} className="message-image-preview" draggable={false} src={item.uri} />}
              </div>
              {!immersive ? <div>{item.detail ?? null}</div> : null}
            </article>
          </div>)}
        </div>
        {!immersive ? <div className="message-image-preview-toolbar" onClick={(event) => event.stopPropagation()}>
          {items.length > 1 ? <span className="message-image-preview-count">{String(index + 1).padStart(2, "0")}<i />{String(items.length).padStart(2, "0")}</span> : null}
          <button aria-label={t("common.fullscreen")} onClick={() => setImmersive(true)} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" /></svg>
          </button>
          <button aria-label={activeItem.downloadLabel ? t("media.downloadImageWithSize", { size: activeItem.downloadLabel }) : t("media.downloadImage")} onClick={() => void downloadMedia(activeItem.uri, fileNamePrefix)} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16v3h14v-3" /></svg>
            {activeItem.downloadLabel ? <span>{activeItem.downloadLabel}</span> : null}
          </button>
        </div> : null}
      </section>
    </div>,
    document.body,
  );
}

export function ImageLightbox({
  index,
  uris,
  altPrefix,
  details = [],
  downloadLabels = [],
  fileNamePrefix = "sermo-image",
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  return <MediaLightbox altPrefix={altPrefix} fileNamePrefix={fileNamePrefix} index={index} items={uris.map((uri, itemIndex) => ({ uri, kind: "image", detail: details[itemIndex], downloadLabel: downloadLabels[itemIndex] }))} onClose={onClose} onIndexChange={onIndexChange} />;
}

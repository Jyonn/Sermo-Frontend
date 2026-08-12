import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
                  ? <video className="message-video-preview" controls={!immersive} onClick={immersive ? undefined : (event) => event.stopPropagation()} playsInline poster={item.posterUri || undefined} preload="metadata" src={item.uri} />
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

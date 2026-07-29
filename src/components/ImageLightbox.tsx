import { useLayoutEffect, useRef, type ReactNode } from "react";
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

async function downloadImage(uri: string, fileNamePrefix: string) {
  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("download_failed");
    const blob = await response.blob();
    const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
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
  const { t } = useI18n();
  const resolvedAltPrefix = altPrefix || t("media.imagePreview");
  const trackRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{ moved: boolean; x: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft = track.clientWidth * index;
  }, [index, uris]);

  if (!uris.length) return null;
  const activeUri = uris[index] ?? uris[0];
  const downloadLabel = downloadLabels[index] ?? "";

  return createPortal(
    <div
      className="dialog-backdrop message-image-preview-backdrop"
      onClick={() => {
        if (gestureRef.current?.moved) {
          gestureRef.current = null;
          return;
        }
        onClose();
      }}
      onPointerDown={(event) => {
        gestureRef.current = { moved: false, x: event.clientX };
      }}
      onPointerMove={(event) => {
        const gesture = gestureRef.current;
        if (gesture && Math.abs(event.clientX - gesture.x) > 8) gesture.moved = true;
      }}
      role="presentation"
    >
      <section aria-modal="true" className="message-image-preview-modal" role="dialog">
        <div
          ref={trackRef}
          className="message-image-preview-track"
          onScroll={(event) => {
            const element = event.currentTarget;
            const nextIndex = Math.round(element.scrollLeft / Math.max(element.clientWidth, 1));
            if (nextIndex !== index) onIndexChange(nextIndex);
          }}
        >
          {uris.map((uri, itemIndex) => (
            <div className="message-image-preview-slide" key={`${uri}:${itemIndex}`}>
              <article className="message-image-preview-plate">
                <div className="message-image-preview-frame">
                  <img
                    alt={`${resolvedAltPrefix} ${itemIndex + 1}`}
                    className="message-image-preview"
                    draggable={false}
                    src={uri}
                  />
                </div>
                {details[itemIndex] ?? null}
              </article>
            </div>
          ))}
        </div>
        <div className="message-image-preview-toolbar" onClick={(event) => event.stopPropagation()}>
          {uris.length > 1 ? (
            <span className="message-image-preview-count">
              {String(index + 1).padStart(2, "0")}
              <i />
              {String(uris.length).padStart(2, "0")}
            </span>
          ) : null}
          <button
            aria-label={downloadLabel
              ? t("media.downloadImageWithSize", { size: downloadLabel })
              : t("media.downloadImage")}
            onClick={() => void downloadImage(activeUri, fileNamePrefix)}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16v3h14v-3" />
            </svg>
            {downloadLabel ? <span>{downloadLabel}</span> : null}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

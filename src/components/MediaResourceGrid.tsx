import { forwardRef, useState, type ReactNode } from "react";
import { RelativeDateSections } from "./RelativeDateSections";

export interface MediaResourceGridItem {
  id: string | number;
  kind: "image" | "video";
  uri: string;
  thumbnailUri?: string | null;
  createdAt: number;
  durationSeconds?: number | null;
  label?: string;
}

function MediaGridImage({ item, onError }: { item: MediaResourceGridItem; onError?: () => void }) {
  const src = item.thumbnailUri || item.uri;
  const [result, setResult] = useState<{ src: string; status: "ready" | "error" } | null>(null);
  const status = result?.src === src ? result.status : "loading";
  return <span className={`shared-media-image is-${status}`}>
    {src && status !== "error" ? <img alt={item.label || ""} loading="lazy" onError={() => { setResult({ src, status: "error" }); onError?.(); }} onLoad={() => setResult({ src, status: "ready" })} src={src} /> : <span aria-hidden="true" className="material-symbols-outlined">image_not_supported</span>}
  </span>;
}

export const MediaResourceGrid = forwardRef<HTMLDivElement, {
  items: MediaResourceGridItem[];
  highlightedId?: string | number | null;
  onSelect: (item: MediaResourceGridItem) => void;
  renderAction?: (item: MediaResourceGridItem) => ReactNode;
  onImageError?: (item: MediaResourceGridItem) => void;
}>(function MediaResourceGrid({ items, highlightedId, onSelect, renderAction, onImageError }, ref) {
  return <RelativeDateSections identity={(item) => item.id} items={items} timestamp={(item) => item.createdAt}>
    {(group) => <div className="shared-media-grid" ref={ref}>
      {group.map((item) => <article className={`shared-media-tile${highlightedId === item.id ? " is-highlighted" : ""}`} data-resource-id={item.id} key={item.id}>
        <button aria-label={item.label} className="shared-media-preview" onClick={() => onSelect(item)} type="button">
          <MediaGridImage item={item} onError={() => onImageError?.(item)} />
          {item.kind === "video" ? <span className="shared-media-play material-symbols-outlined">play_arrow</span> : null}
          {Number.isFinite(item.durationSeconds) && Number(item.durationSeconds) > 0 ? <small>{Math.floor(Number(item.durationSeconds) / 60)}:{String(Math.round(Number(item.durationSeconds) % 60)).padStart(2, "0")}</small> : null}
        </button>
        {renderAction?.(item)}
      </article>)}
    </div>}
  </RelativeDateSections>;
});

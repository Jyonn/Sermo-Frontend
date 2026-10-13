import { useState } from "react";
import type { StillfolioCollectionDTO } from "../types";
import { ImageLightbox } from "./ImageLightbox";
import { useI18n } from "../lib/language";
import "./StillfolioPreview.css";

export function isStillfolioCollection(value: unknown): value is StillfolioCollectionDTO {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<StillfolioCollectionDTO>;
  try {
    const url = new URL(data.canonical_url || "");
    if (url.protocol !== "https:" || url.hostname !== "stillfolio.jyonn.space" || !/^\/share\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/?$/i.test(url.pathname)) return false;
    return data.provider === "stillfolio_collection" && Array.isArray(data.images)
      && data.images.every((image) => {
        try { const parsed = new URL(image); return parsed.protocol === "https:" && parsed.hostname === "stillfolio.jyonn.space"; }
        catch { return false; }
      });
  } catch { return false; }
}

export function StillfolioPreview({ collection }: { collection: StillfolioCollectionDTO }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const title = collection.title || "留幅作品集";
  const images = collection.images;
  return <>
    <div className="stillfolio-card">
      <button className="stillfolio-card-main" onClick={() => images.length ? (setIndex(0), setOpen(true)) : window.open(collection.canonical_url, "_blank", "noopener,noreferrer")} type="button">
        <span className="stillfolio-card-top"><span className="stillfolio-mark">留幅</span><span>STILLFOLIO / {String(collection.photo_count || images.length).padStart(2, "0")}</span></span>
        {images.length ? <span className="stillfolio-card-image"><img alt="" loading="lazy" src={images[0]} /></span> : <span className="stillfolio-card-empty">STILLFOLIO</span>}
        <span className="stillfolio-card-title">{title}</span>
        <span className="stillfolio-card-caption">{collection.author || "留幅"} · {collection.photo_count || images.length} {t("social.photos")}</span>
      </button>
      <a className="stillfolio-card-source" href={collection.canonical_url} rel="noreferrer" target="_blank">{t("social.openSource")} ↗</a>
    </div>
    {open && images.length ? <ImageLightbox altPrefix={title} fileNamePrefix="stillfolio" index={index} onClose={() => setOpen(false)} onIndexChange={setIndex} referrerPolicy="no-referrer" sharedDetail={<div className="stillfolio-lightbox-detail"><span>留幅 STILLFOLIO</span><strong>{title}</strong><small>{collection.description || collection.author}</small><a href={collection.canonical_url} rel="noreferrer" target="_blank">{t("social.openSource")} ↗</a></div>} uris={images} /> : null}
  </>;
}

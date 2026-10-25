import type { ReactNode } from "react";
import { useI18n } from "../lib/language";
import { openMediaLocationMap } from "../lib/mediaLocation";
import type { ImageMetadataDTO, TinyUserDTO } from "../types";
import "./PhotoArchivePlate.css";

function positive(value?: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function PhotoArchivePlate({ metadata, owner, width, height, children, actions, detail }: {
  metadata?: ImageMetadataDTO | null;
  owner?: TinyUserDTO | null;
  width?: number | null;
  height?: number | null;
  children: ReactNode;
  actions?: ReactNode;
  detail?: ReactNode;
}) {
  const { locale, t } = useI18n();
  const data = metadata?.status === 1 ? metadata : null;
  const camera = [data?.make, data?.model].filter(Boolean).join(" · ");
  const lens = data?.lens_model;
  const exposure = [
    positive(data?.focal_length_mm) ? `${Number(data.focal_length_mm.toFixed(1))} MM` : "",
    positive(data?.aperture) ? `F/${Number(data.aperture.toFixed(1))}` : "",
    positive(data?.exposure_seconds) ? data.exposure_seconds < 1 ? `1/${Math.round(1 / data.exposure_seconds)} S` : `${Number(data.exposure_seconds.toFixed(2))} S` : "",
    positive(data?.iso) ? `ISO ${Math.round(data.iso)}` : "",
  ].filter(Boolean);
  const hasCoordinates = typeof data?.latitude === "number" && Number.isFinite(data.latitude)
    && typeof data?.longitude === "number" && Number.isFinite(data.longitude);
  const coordinate = hasCoordinates
    ? `${Math.abs(data!.latitude!).toFixed(6)}° ${data!.latitude! >= 0 ? "N" : "S"}, ${Math.abs(data!.longitude!).toFixed(6)}° ${data!.longitude! >= 0 ? "E" : "W"}`
    : "";
  const address = data?.address?.trim();
  const takenAt = data?.taken_at ? new Date(data.taken_at * 1000) : null;
  const date = takenAt && Number.isFinite(takenAt.getTime()) ? new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "Asia/Shanghai",
  }).format(takenAt) : "";
  const imageWidth = width || data?.pixel_width || 0;
  const imageHeight = height || data?.pixel_height || 0;
  const expanded = imageWidth > 0 && imageHeight / imageWidth > 1.05;
  const long = imageWidth > 0 && imageHeight / imageWidth > 2;
  const hasTechnical = Boolean(camera || lens || exposure.length);
  const location = address || coordinate ? <div className="photo-archive-location">
    {hasCoordinates ? <button aria-label={t("location.viewOnMap")} onClick={() => openMediaLocationMap({ location: {
      latitude: data!.latitude!, longitude: data!.longitude!, address: data?.address,
    }, owner })} type="button">
      {address ? <span className="photo-archive-place">{address}</span> : null}
      {coordinate ? <span className="photo-archive-coordinates">{coordinate}</span> : null}
    </button> : <span className="photo-archive-place">{address}</span>}
  </div> : null;
  const technical = hasTechnical ? <header className="photo-archive-technical">
    {camera || lens ? <div className="photo-archive-camera"><span className="photo-archive-label">{t("media.cameraLabel")}</span>
      {camera ? <span title={camera}>{camera}</span> : null}{lens ? <span title={lens}>{lens}</span> : null}
    </div> : null}
    {exposure.length ? <div className="photo-archive-exposure"><span className="photo-archive-label">{t("media.exposureLabel")}</span><span className="photo-archive-exposure-values">{exposure.map((value, index) => <span key={value}>{index > 0 ? `/ ${value}` : value}</span>)}</span></div> : null}
  </header> : null;

  return <article className={`photo-archive-plate${expanded ? " is-expanded" : ""}${long ? " is-long" : ""}${hasTechnical ? " has-technical" : ""}${location ? " has-location" : ""}`} onClick={(event) => {
    if ((event.target as HTMLElement).closest('button,a,.photo-preview-details,.photo-archive-extra')) event.stopPropagation();
  }}>
    <div className="photo-archive-visual">
      <div className="photo-archive-image-scroll">{children}</div>
    </div>
    {detail ? <div className="photo-archive-extra">{detail}</div> : null}
    {hasTechnical || location || date ? <details className="photo-preview-details">
      <summary tabIndex={0}><span className="material-symbols-outlined" aria-hidden="true">info</span>{t("media.photoDetails")}<span className="material-symbols-outlined" aria-hidden="true">expand_more</span></summary>
      <div className="photo-preview-details-body">{technical}{location}{date ? <div className="photo-archive-date"><span className="photo-archive-label">{t("media.dateLabel")}</span><time dateTime={takenAt!.toISOString()}>{date}</time></div> : null}</div>
    </details> : null}
    {actions ? <footer className="photo-archive-footer">{actions}</footer> : null}
  </article>;
}

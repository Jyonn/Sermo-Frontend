import { useI18n } from "../lib/language";
import type { ImageMetadataDTO, VideoMetadataDTO } from "../types";

type MediaMetadata = ImageMetadataDTO | VideoMetadataDTO;

export function MediaMetadataPanel({ kind, metadata }: { kind: "image" | "video"; metadata?: MediaMetadata | null }) {
  const { locale, t } = useI18n();
  const recordLabel = kind === "video" ? t("media.videoRecord") : t("media.imageRecord");
  if (!metadata || metadata.status !== 1) {
    return <div className="message-image-archive is-empty"><span>{recordLabel}</span><p>{t("media.metadataMissing")}</p></div>;
  }

  const device = [metadata.make, metadata.model].filter(Boolean).join(" ");
  const coordinate = metadata.latitude != null && metadata.longitude != null
    ? `${metadata.latitude.toFixed(6)}, ${metadata.longitude.toFixed(6)}`
    : "";
  const takenAt = metadata.taken_at
    ? new Date(metadata.taken_at * 1000).toLocaleString(locale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  const location = metadata.address || (metadata.geocoding_status === 0 && coordinate ? t("location.resolving") : coordinate);
  const rows = [[t("media.device"), device], [t("media.lens"), metadata.lens_model]].filter((row) => row[1]);
  const provider = metadata.geocoding_provider === "nominatim"
    ? { href: "https://www.openstreetmap.org/copyright", label: "OpenStreetMap" }
    : metadata.geocoding_provider === "amap"
      ? { href: "https://www.amap.com/", label: t("map.amap") }
      : metadata.geocoding_provider === "opencage"
        ? { href: "https://opencagedata.com/", label: "OpenCage" }
        : null;

  return <div className={`message-image-archive${kind === "video" ? " message-video-archive" : ""}`}>
    <div className={`message-image-location${location ? "" : " is-empty"}`}>
      <span className="message-image-archive-label">{t("media.locationLabel")}</span>
      <strong>{location || t("location.notRecorded")}</strong>
      {coordinate ? <small>{coordinate}</small> : null}
      {provider && metadata.address ? <a href={provider.href} rel="noreferrer" target="_blank">GEOCODED BY {provider.label}</a> : null}
    </div>
    <div className="message-image-record">
      <div className="message-image-record-heading">
        <span className="message-image-archive-label">{recordLabel}</span>
        <strong>{takenAt || t("media.timeNotRecorded")}</strong>
      </div>
      {rows.length ? <dl className="message-image-metadata-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}
    </div>
  </div>;
}

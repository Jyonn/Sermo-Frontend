import { useI18n } from "../lib/language";
import type { ImageMetadataDTO, VideoMetadataDTO } from "../types";

type MediaMetadata = ImageMetadataDTO | VideoMetadataDTO;

function formatDuration(seconds?: number | null) {
  if (seconds == null) return "";
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function formatBitRate(bitRate?: number | null) {
  if (bitRate == null) return "";
  return bitRate >= 1_000_000 ? `${(bitRate / 1_000_000).toFixed(1)} Mbps` : `${Math.round(bitRate / 1_000)} kbps`;
}

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
    ? new Date(metadata.taken_at * 1000).toLocaleString(locale, {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai",
      })
    : "";
  const location = metadata.address || (metadata.geocoding_status === 0 && coordinate ? t("location.resolving") : coordinate);
  const videoMetadata = kind === "video" ? metadata as VideoMetadataDTO : null;
  const rows = [
    [t("media.takenAt"), takenAt],
    [t("media.device"), device],
    [t("media.lens"), metadata.lens_model],
    [t("media.software"), metadata.software],
    [t("media.duration"), formatDuration(videoMetadata?.duration_seconds)],
    [t("media.frameRate"), videoMetadata?.frame_rate != null ? `${Number(videoMetadata.frame_rate.toFixed(2))} fps` : ""],
    [t("media.bitRate"), formatBitRate(videoMetadata?.bit_rate)],
    [t("media.videoCodec"), videoMetadata?.video_codec],
    [t("media.audioCodec"), videoMetadata?.audio_codec],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const provider = metadata.geocoding_provider === "nominatim"
    ? { href: "https://www.openstreetmap.org/copyright", label: "OpenStreetMap" }
    : metadata.geocoding_provider === "amap"
      ? { href: "https://www.amap.com/", label: t("map.amap") }
      : metadata.geocoding_provider === "opencage"
        ? { href: "https://opencagedata.com/", label: "OpenCage" }
        : null;

  return <div className={`message-image-archive${kind === "video" ? " message-video-archive" : ""}`}>
    {location ? <div className="message-image-location">
      <span className="message-image-archive-label">{t("media.locationLabel")}</span>
      <strong>{location}</strong>
      {coordinate ? <small>{coordinate}</small> : null}
      {provider && metadata.address ? <a href={provider.href} rel="noreferrer" target="_blank">GEOCODED BY {provider.label}</a> : null}
    </div> : null}
    <div className="message-image-record">
      <span className="message-image-archive-label">{recordLabel}</span>
      {rows.length
        ? <dl aria-label={recordLabel} className="message-image-metadata-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        : <p className="message-image-record-empty">{t("media.metadataMissing")}</p>}
    </div>
  </div>;
}

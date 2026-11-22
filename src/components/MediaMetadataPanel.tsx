import { memo } from "react";
import { useI18n } from "../lib/language";
import { openMediaLocationMap } from "../lib/mediaLocation";
import type { ImageMetadataDTO, TinyUserDTO, VideoMetadataDTO } from "../types";
import "./MediaMetadataPanel.css";

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

export const MediaMetadataPanel = memo(function MediaMetadataPanel({ kind, metadata, owner }: { kind: "image" | "video"; metadata?: MediaMetadata | null; owner?: TinyUserDTO | null }) {
  const { locale, t } = useI18n();
  const recordLabel = kind === "video" ? t("media.videoRecord") : t("media.imageRecord");
  if (!metadata || metadata.status !== 1) {
    return <div className="media-metadata-card media-metadata-empty"><strong>{recordLabel}</strong><p>{t("media.metadataMissing")}</p></div>;
  }

  const device = [metadata.make, metadata.model].filter(Boolean).join(" ");
  const coordinate = metadata.latitude != null && metadata.longitude != null
    ? `${metadata.latitude.toFixed(6)}, ${metadata.longitude.toFixed(6)}`
    : "";
  const captureDate = metadata.taken_at ? new Date(metadata.taken_at * 1000) : null;
  const takenAt = captureDate && Number.isFinite(captureDate.getTime())
    ? captureDate.toLocaleString(locale, {
        year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai",
      })
    : "";
  const location = metadata.address || (metadata.geocoding_status === 0 && coordinate ? t("location.resolving") : coordinate);
  const canOpenMap = Number.isFinite(metadata.latitude) && Number.isFinite(metadata.longitude);
  const videoMetadata = kind === "video" ? metadata as VideoMetadataDTO : null;
  const photo = kind === 'image' ? metadata as ImageMetadataDTO : null;
  const exposure = [
    photo?.iso ? `ISO ${photo.iso}` : "",
    photo?.focal_length_mm ? `${Number(photo.focal_length_mm.toFixed(1))} mm` : "",
    photo?.aperture ? `f/${Number(photo.aperture.toFixed(1))}` : "",
    photo?.exposure_seconds ? photo.exposure_seconds < 1 ? `1/${Math.round(1 / photo.exposure_seconds)} s` : `${photo.exposure_seconds} s` : "",
  ].filter(Boolean);
  const resolution = metadata.pixel_width && metadata.pixel_height ? `${metadata.pixel_width} × ${metadata.pixel_height}` : "";
  const size = metadata.file_size ? metadata.file_size >= 1048576
    ? `${(metadata.file_size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(metadata.file_size / 1024))} KB` : "";
  const dimensions = [resolution, size].filter(Boolean).join(" · ");
  const rows = [
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

  return <div className="media-metadata">
    <div className="media-metadata-card">
      <div className="media-metadata-date">
        <span>{takenAt ? t("media.takenAt") : recordLabel}</span>
        {takenAt && captureDate && <time dateTime={captureDate.toISOString()}>{takenAt}</time>}
      </div>
      {(device || metadata.lens_model || dimensions) && <div className="media-metadata-device">
        {device && <strong>{device}</strong>}
        {metadata.lens_model && <span>{metadata.lens_model}</span>}
        {dimensions && <span>{dimensions}</span>}
      </div>}
      {exposure.length > 0 && <ul className="media-metadata-exposure" aria-label={t("media.exposureLabel")}>
        {exposure.map(value => <li key={value}>{value}</li>)}
      </ul>}
      {rows.length > 0 && <dl className="media-metadata-properties">
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>}
      {!takenAt && !device && !metadata.lens_model && !dimensions && !exposure.length && !rows.length
        && <p className="media-metadata-empty">{t("media.metadataMissing")}</p>}
    </div>
    {location ? <div className="media-metadata-card media-metadata-location">
      {canOpenMap ? (
        <button
          aria-label={`${t("location.viewOnMap")} · ${location}`}
          className="media-metadata-map-button"
          onClick={() => openMediaLocationMap({
            location: {
              latitude: Number(metadata.latitude),
              longitude: Number(metadata.longitude),
              address: metadata.address,
            },
            owner,
          })}
          type="button"
        >
          <span aria-hidden="true" className="material-symbols-outlined">location_on</span>
          <span className="media-metadata-place">
            <span>{t("media.locationLabel")}</span>
            <strong>{location}</strong>
            {coordinate && location !== coordinate && <small>{coordinate}</small>}
          </span>
          <span aria-hidden="true" className="material-symbols-outlined">arrow_outward</span>
        </button>
      ) : (
        <div className="media-metadata-place"><span>{t("media.locationLabel")}</span><strong>{location}</strong></div>
      )}
      {provider && metadata.address ? <a href={provider.href} rel="noreferrer" target="_blank">GEOCODED BY {provider.label}</a> : null}
    </div> : null}
  </div>;
});

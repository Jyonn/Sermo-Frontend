import { useState, type ReactNode } from "react";
import { useI18n } from "../lib/language";
import "./MediaWaitFeedback.css";
import "./PlatformMediaCard.css";

interface PlatformMediaCardProps {
  author?: string;
  cover?: string;
  kindLabel: string;
  logo: string;
  onClick: () => void;
  opening?: boolean;
  playIcon?: "play_arrow" | "open_in_new";
  source: string;
  title: string;
}

export function PlatformMediaCard({ author, cover, kindLabel, logo, onClick, opening = false, playIcon, source, title }: PlatformMediaCardProps) {
  const { t } = useI18n();
  const [coverResult, setCoverResult] = useState<{ uri?: string; status: "ready" | "error" } | null>(null);
  const coverState = coverResult && coverResult.uri === cover ? coverResult.status : cover ? "loading" : "error";
  return <button aria-busy={opening} className={`platform-media-card${coverState === "loading" ? " is-cover-loading" : ""}`} disabled={opening} onClick={(event) => { event.stopPropagation(); onClick(); }} type="button">
    {cover && coverState !== "error" ? <img alt="" className="platform-media-cover" loading="lazy" onError={() => setCoverResult({ uri: cover, status: "error" })} onLoad={() => setCoverResult({ uri: cover, status: "ready" })} referrerPolicy="no-referrer" src={cover} /> : <span className="platform-media-cover is-unavailable"><span aria-hidden="true" className="material-symbols-outlined">image_not_supported</span></span>}
    <span className="platform-media-card-top">
      <span className="platform-media-card-brand"><img alt="" src={logo} />{source}</span>
      <span className="platform-media-card-kind">{kindLabel}</span>
    </span>
    <span className="platform-media-card-bottom"><strong>{title}</strong><small>{author || source}</small></span>
    {playIcon ? <span aria-hidden="true" className="platform-media-play">{opening ? <span className="media-wait-spinner" /> : <span className="material-symbols-outlined">{playIcon}</span>}</span> : null}
    {opening ? <span className="platform-media-opening" role="status">{t("media.loadingVideo")}</span> : null}
  </button>;
}

interface PlatformVideoSourceProps {
  author?: string;
  href: string;
  label: string;
  logo: string;
  source: string;
  title: string;
}

export function PlatformVideoSource({ author, href, label, logo, source, title }: PlatformVideoSourceProps) {
  return <a aria-label={label} className="platform-video-context" href={href} rel="noreferrer" target="_blank">
    <span aria-hidden="true" className="platform-video-context-mark"><img alt="" src={logo} /></span>
    <span className="platform-video-context-copy"><strong>{title}</strong><small>{author ? `@${author} · ` : ""}{source}</small></span>
    <span aria-hidden="true" className="platform-video-context-open material-symbols-outlined">north_east</span>
  </a>;
}

export function PlatformVideoError({ children, href, label }: { children: ReactNode; href: string; label: string }) {
  return <div className="platform-video-error">
    <span aria-hidden="true" className="material-symbols-outlined">video_file</span>
    <strong>{children}</strong>
    <a href={href} rel="noreferrer" target="_blank">{label}</a>
  </div>;
}

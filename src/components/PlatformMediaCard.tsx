import type { ReactNode } from "react";
import "./PlatformMediaCard.css";

interface PlatformMediaCardProps {
  author?: string;
  cover?: string;
  kindLabel: string;
  logo: string;
  onClick: () => void;
  playIcon?: "play_arrow" | "open_in_new";
  source: string;
  title: string;
}

export function PlatformMediaCard({ author, cover, kindLabel, logo, onClick, playIcon, source, title }: PlatformMediaCardProps) {
  return <button className="platform-media-card" onClick={(event) => { event.stopPropagation(); onClick(); }} type="button">
    {cover ? <img alt="" className="platform-media-cover" loading="lazy" referrerPolicy="no-referrer" src={cover} /> : <span className="platform-media-cover" />}
    <span className="platform-media-card-top">
      <span className="platform-media-card-brand"><img alt="" src={logo} />{source}</span>
      <span className="platform-media-card-kind">{kindLabel}</span>
    </span>
    <span className="platform-media-card-bottom"><strong>{title}</strong><small>{author || source}</small></span>
    {playIcon ? <span aria-hidden="true" className="platform-media-play material-symbols-outlined">{playIcon}</span> : null}
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

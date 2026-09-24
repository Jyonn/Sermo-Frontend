import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./DouyinVideoPreview.css";
import { useI18n } from "../lib/language";
import type { DouyinVideoDataDTO } from "../types";
import { SideDrawer } from "./SideDrawer";

export function isDouyinVideoData(value: unknown): value is DouyinVideoDataDTO {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<DouyinVideoDataDTO>;
  if (data.provider !== "douyin_video" || typeof data.video_id !== "string" || !/^\d{10,25}$/.test(data.video_id)) return false;
  if (typeof data.canonical_url !== "string") return false;
  try {
    const canonical = new URL(data.canonical_url);
    const media = data.video_url ? new URL(data.video_url) : null;
    const allowedMedia = ["douyinvod.com", "douyincdn.com", "bytecdn.cn", "snssdk.com", "amemv.com", "zjcdn.com"];
    return (!media || (media.protocol === "https:"
      && allowedMedia.some((host) => media.hostname === host || media.hostname.endsWith(`.${host}`))
      && media.pathname.length > 1))
      && canonical.protocol === "https:"
      && canonical.hostname === "www.douyin.com"
      && canonical.pathname === `/video/${data.video_id}`;
  } catch {
    return false;
  }
}

function formatTime(value: number) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function DouyinDrawerPlayer({ imageUrl, video }: { imageUrl?: string; video: DouyinVideoDataDTO }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState((video.duration_ms || 0) / 1000);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  useEffect(() => () => videoRef.current?.pause(), []);

  const togglePlayback = async () => {
    const element = videoRef.current;
    if (!element) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    try {
      await element.play();
    } catch {
      setPlaybackFailed(true);
    }
  };

  const toggleMuted = () => {
    const element = videoRef.current;
    if (!element) return;
    element.muted = !element.muted;
    setMuted(element.muted);
  };

  const enterFullscreen = async () => {
    const stage = stageRef.current;
    if (stage?.requestFullscreen) {
      await stage.requestFullscreen().catch(() => undefined);
      return;
    }
    const videoElement = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    videoElement?.webkitEnterFullscreen?.();
  };

  return <div className="douyin-player-shell">
    <div className="douyin-player-stage" ref={stageRef}>
      <div className="douyin-player-atmosphere" aria-hidden="true" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined} />
      <video
        autoPlay
        className="douyin-player-video"
        loop
        muted={muted}
        onClick={() => void togglePlayback()}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : duration)}
        onEnded={() => setPlaying(false)}
        onError={() => setPlaybackFailed(true)}
        onPause={() => setPlaying(false)}
        onPlay={() => { setPlaying(true); setPlaybackFailed(false); }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        playsInline
        poster={imageUrl}
        preload="auto"
        ref={videoRef}
        src={video.video_url}
      />
      <div className="douyin-player-shade" aria-hidden="true" />

      <div className="douyin-player-brand" aria-label={t("douyin.source")}>
        <span className="douyin-player-note material-symbols-outlined" aria-hidden="true">music_note</span>
        <span><b>DOUYIN</b><small>{t("douyin.source")}</small></span>
      </div>

      {!playing && !playbackFailed ? <button className="douyin-player-center" onClick={() => void togglePlayback()} type="button" aria-label={t("media.play")}>
        <span className="material-symbols-outlined">play_arrow</span>
      </button> : null}

      <aside className="douyin-player-rail" aria-label={t("douyin.controls")}>
        <button onClick={toggleMuted} type="button" aria-label={muted ? t("douyin.unmute") : t("douyin.mute")}>
          <span className="material-symbols-outlined">{muted ? "volume_off" : "volume_up"}</span>
          <small>{muted ? t("douyin.soundOff") : t("douyin.soundOn")}</small>
        </button>
        <button onClick={() => void enterFullscreen()} type="button" aria-label={t("common.fullscreen")}>
          <span className="material-symbols-outlined">fullscreen</span>
          <small>{t("douyin.fullscreen")}</small>
        </button>
        <a href={video.canonical_url} rel="noreferrer" target="_blank" aria-label={t("douyin.openOriginal")}>
          <span className="material-symbols-outlined">north_east</span>
          <small>{t("douyin.original")}</small>
        </a>
      </aside>

      <div className="douyin-player-copy">
        <div className="douyin-player-author"><i aria-hidden="true" />@{video.author || t("douyin.creator")}</div>
        <h3>{video.title || t("douyin.video")}</h3>
        <p><span className="material-symbols-outlined" aria-hidden="true">music_note</span>{t("douyin.source")}</p>
      </div>

      {playbackFailed ? <div className="douyin-player-error">
        <span className="material-symbols-outlined" aria-hidden="true">video_file</span>
        <strong>{t("douyin.playbackUnavailable")}</strong>
        <a href={video.canonical_url} rel="noreferrer" target="_blank">{t("douyin.openOriginal")}</a>
      </div> : null}

      <div className="douyin-player-timeline">
        <input
          aria-label={t("media.duration")}
          max={Math.max(duration, 0)}
          min={0}
          onChange={(event) => {
            const element = videoRef.current;
            if (element) element.currentTime = Number(event.currentTarget.value);
          }}
          step={0.01}
          style={{ "--douyin-progress": `${progress}%` } as CSSProperties}
          type="range"
          value={Math.min(currentTime, duration || 0)}
        />
        <time>{formatTime(currentTime)} <i /> {formatTime(duration)}</time>
      </div>
    </div>
  </div>;
}

export function DouyinVideoPreview({ video, imageUrl }: { video: DouyinVideoDataDTO; imageUrl?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const playable = Boolean(video.video_url);

  return <>
    <button className="douyin-video-card" type="button" onClick={(event) => { event.stopPropagation(); if (playable) setOpen(true); else window.open(video.canonical_url, "_blank", "noopener,noreferrer"); }}>
      {imageUrl ? <img className="douyin-video-poster" src={imageUrl} alt="" loading="lazy" /> : <span className="douyin-video-poster-fallback" aria-hidden="true" />}
      <span className="douyin-video-play material-symbols-outlined" aria-hidden="true">{playable ? "play_arrow" : "open_in_new"}</span>
      <span className="douyin-video-copy"><small>{t("douyin.source")}</small><strong>{video.title || t("douyin.video")}</strong></span>
    </button>
    <SideDrawer className="douyin-video-drawer" headerless historyKey={`douyin-video-${video.video_id}`} open={open} onClose={() => setOpen(false)} title={video.title || t("douyin.video")}>
      {open && video.video_url ? <DouyinDrawerPlayer imageUrl={imageUrl} video={video} /> : null}
    </SideDrawer>
  </>;
}

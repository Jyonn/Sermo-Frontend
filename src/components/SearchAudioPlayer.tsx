import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/language";
import { PlainAvatar } from "./UserAvatar";
import { usePlaybackWait } from "./MediaWaitFeedback";

function durationLabel(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function SearchAudioPlayer({ src, durationSeconds = 0 }: { src: string; durationSeconds?: number | null }) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const wait = usePlaybackWait();

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { if (wait.phase === "error") audio.load(); wait.start(); try { await audio.play(); } catch { wait.fail(); } }
    else audio.pause();
  };

  return <div className={`message-search-audio${playing ? " is-playing" : ""}`}>
    <audio
      onDurationChange={(event) => setDuration(event.currentTarget.duration || durationSeconds || 0)}
      onEnded={() => { setPlaying(false); setCurrentTime(0); wait.ready(); }}
      onError={wait.fail}
      onPause={() => { setPlaying(false); wait.stop(); }}
      onPlaying={() => { setPlaying(true); wait.ready(); }}
      onWaiting={wait.waiting}
      onStalled={wait.waiting}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      preload="metadata"
      ref={audioRef}
      src={src}
    />
    <button aria-label={wait.phase === "error" ? t("common.retry") : wait.visible ? t("media.buffering") : playing ? t("media.pause") : t("media.play")} onClick={() => void toggle()} type="button">
      {wait.visible && wait.phase !== "error" ? <span aria-hidden="true" className="media-wait-spinner" /> : <svg aria-hidden="true" viewBox="0 0 24 24">{playing ? <path d="M8 6v12M16 6v12" /> : <path d="m9 6 9 6-9 6Z" />}</svg>}
    </button>
    <span className="message-search-audio-wave" aria-hidden="true">{[4,8,12,7,14,10,5,13,8,11,6,9,14,7,5,10].map((height, index) => <i key={index} style={{ height }} />)}</span>
    <time>{durationLabel(currentTime || duration)}</time>
  </div>;
}

export function SearchAudioTile({ src, durationSeconds = 0, avatarUri, name, onJump }: { src: string; durationSeconds?: number | null; avatarUri?: string; name: string; onJump: () => void }) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const fallbackDuration = Number.isFinite(durationSeconds) ? Number(durationSeconds) : 0;
  const [duration, setDuration] = useState(fallbackDuration);
  const wait = usePlaybackWait();
  useEffect(() => () => audioRef.current?.pause(), []);
  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { if (wait.phase === "error") audio.load(); wait.start(); try { await audio.play(); } catch { wait.fail(); } }
    else audio.pause();
  };
  return <article className={`message-search-audio-tile${playing ? " is-playing" : ""}`}>
    <audio onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : fallbackDuration)} onEnded={() => { setPlaying(false); wait.ready(); }} onError={wait.fail} onPause={() => { setPlaying(false); wait.stop(); }} onPlaying={() => { setPlaying(true); wait.ready(); }} onWaiting={wait.waiting} onStalled={wait.waiting} preload="metadata" ref={audioRef} src={src} />
    <PlainAvatar className="message-search-audio-avatar" name={name} uri={avatarUri} />
    <span className="message-search-audio-shade" />
    <button aria-label={`${name} · ${wait.phase === "error" ? t("common.retry") : wait.visible ? t("media.buffering") : playing ? t("media.pause") : t("media.play")}`} onClick={() => void toggle()} type="button">{wait.visible && wait.phase !== "error" ? <span aria-hidden="true" className="media-wait-spinner" /> : <svg aria-hidden="true" viewBox="0 0 24 24">{playing ? <path d="M8 6v12M16 6v12" /> : <path d="m9 6 9 6-9 6Z" />}</svg>}</button>
    <time>{durationLabel(duration)}</time>
    <button aria-label={t("messageSearch.jumpToMessage")} className="message-search-audio-jump" onClick={onJump} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg></button>
  </article>;
}

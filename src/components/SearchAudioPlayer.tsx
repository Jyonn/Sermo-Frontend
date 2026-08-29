import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/language";

function durationLabel(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function SearchAudioPlayer({ src, durationSeconds = 0 }: { src: string; durationSeconds?: number | null }) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  };

  return <div className={`message-search-audio${playing ? " is-playing" : ""}`}>
    <audio
      onDurationChange={(event) => setDuration(event.currentTarget.duration || durationSeconds || 0)}
      onEnded={() => { setPlaying(false); setCurrentTime(0); }}
      onPause={() => setPlaying(false)}
      onPlay={() => setPlaying(true)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      preload="metadata"
      ref={audioRef}
      src={src}
    />
    <button aria-label={playing ? t("media.pause") : t("media.play")} onClick={() => void toggle()} type="button">
      <svg aria-hidden="true" viewBox="0 0 24 24">{playing ? <path d="M8 6v12M16 6v12" /> : <path d="m9 6 9 6-9 6Z" />}</svg>
    </button>
    <span className="message-search-audio-wave" aria-hidden="true">{[4,8,12,7,14,10,5,13,8,11,6,9,14,7,5,10].map((height, index) => <i key={index} style={{ height }} />)}</span>
    <time>{durationLabel(currentTime || duration)}</time>
  </div>;
}

export function SearchAudioTile({ src, durationSeconds = 0, avatarUri, name, onJump }: { src: string; durationSeconds?: number | null; avatarUri?: string; name: string; onJump: () => void }) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(durationSeconds || 0);
  useEffect(() => () => audioRef.current?.pause(), []);
  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  };
  return <article className={`message-search-audio-tile${playing ? " is-playing" : ""}`} style={avatarUri ? { backgroundImage: `url("${avatarUri.replace(/"/g, "%22")}")` } : undefined}>
    <audio onDurationChange={(event) => setDuration(event.currentTarget.duration || durationSeconds || 0)} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} preload="metadata" ref={audioRef} src={src} />
    {!avatarUri ? <span className="message-search-audio-initial">{name.trim().slice(0, 1).toUpperCase()}</span> : null}
    <span className="message-search-audio-shade" />
    <button aria-label={`${name} · ${playing ? t("media.pause") : t("media.play")}`} onClick={() => void toggle()} type="button"><svg aria-hidden="true" viewBox="0 0 24 24">{playing ? <path d="M8 6v12M16 6v12" /> : <path d="m9 6 9 6-9 6Z" />}</svg></button>
    <time>{durationLabel(duration)}</time>
    <button aria-label={t("messageSearch.jumpToMessage")} className="message-search-audio-jump" onClick={onJump} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg></button>
  </article>;
}

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

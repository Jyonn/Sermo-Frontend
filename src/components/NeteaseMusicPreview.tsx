import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "../lib/language";
import type { MusicProviderDataDTO } from "../types";
import { SideDrawer } from "./SideDrawer";

interface LyricLine {
  time: number;
  text: string;
  translation?: string;
}

interface NeteaseMusicPreviewProps {
  music: MusicProviderDataDTO;
}

const AUDIO_PLAY_EVENT = "sermo:music-preview-play";
const LRC_TIME_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

function parseLrc(value = "") {
  const lines: Array<{ time: number; text: string }> = [];
  value.split(/\r?\n/).forEach((row) => {
    const text = row.replace(LRC_TIME_RE, "").trim();
    if (!text) return;
    let match: RegExpExecArray | null;
    LRC_TIME_RE.lastIndex = 0;
    while ((match = LRC_TIME_RE.exec(row))) {
      const fraction = Number(`0.${(match[3] || "0").padEnd(3, "0").slice(0, 3)}`);
      lines.push({ time: Number(match[1]) * 60 + Number(match[2]) + fraction, text });
    }
  });
  LRC_TIME_RE.lastIndex = 0;
  return lines.sort((a, b) => a.time - b.time);
}

function combineLyrics(original = "", translation = ""): LyricLine[] {
  const translated = new Map(parseLrc(translation).map((line) => [line.time.toFixed(2), line.text]));
  return parseLrc(original).map((line) => ({
    ...line,
    translation: translated.get(line.time.toFixed(2)),
  }));
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function isNeteaseMusicData(value: unknown): value is MusicProviderDataDTO {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MusicProviderDataDTO>;
  return candidate.provider === "netease_music"
    && typeof candidate.song_id === "number"
    && typeof candidate.title === "string"
    && typeof candidate.audio_url === "string"
    && typeof candidate.canonical_url === "string"
    && Array.isArray(candidate.artists);
}

export function NeteaseMusicPreview({ music }: NeteaseMusicPreviewProps) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricRefs = useRef(new Map<number, HTMLParagraphElement>());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState((music.duration_ms || 0) / 1000);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const lyrics = useMemo(
    () => combineLyrics(music.lyrics?.original, music.lyrics?.translation),
    [music.lyrics?.original, music.lyrics?.translation]
  );
  const activeLyricIndex = useMemo(() => {
    let index = -1;
    for (let cursor = 0; cursor < lyrics.length; cursor += 1) {
      if (lyrics[cursor].time > currentTime + .08) break;
      index = cursor;
    }
    return index;
  }, [currentTime, lyrics]);
  const artists = music.artists.join(" / ");

  useEffect(() => {
    const stopForAnotherPlayer = (event: Event) => {
      if ((event as CustomEvent<HTMLAudioElement>).detail === audioRef.current) return;
      audioRef.current?.pause();
    };
    window.addEventListener(AUDIO_PLAY_EVENT, stopForAnotherPlayer);
    return () => window.removeEventListener(AUDIO_PLAY_EVENT, stopForAnotherPlayer);
  }, []);

  useEffect(() => {
    if (!drawerOpen || activeLyricIndex < 0) return;
    lyricRefs.current.get(activeLyricIndex)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLyricIndex, drawerOpen]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || audioUnavailable) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    window.dispatchEvent(new CustomEvent(AUDIO_PLAY_EVENT, { detail: audio }));
    try {
      await audio.play();
    } catch {
      setAudioUnavailable(true);
      setPlaying(false);
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const cover = music.cover_url ? <img alt="" src={music.cover_url} /> : <span className="material-symbols-outlined">music_note</span>;

  return (
    <>
      <article className="netease-music-card" onClick={(event) => event.stopPropagation()}>
        <button
          aria-label={playing ? t("music.pause") : t("music.play")}
          className="netease-music-play"
          disabled={audioUnavailable}
          onClick={() => void togglePlayback()}
          type="button"
        >
          <span className="netease-music-cover">{cover}</span>
          <span className="netease-music-play-icon material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>
        </button>
        <button className="netease-music-summary" onClick={() => setDrawerOpen(true)} type="button">
          <strong>{music.title}</strong>
          <span>{artists}</span>
          <small><i aria-hidden="true">♫</i>{t("music.neteaseSource")}</small>
        </button>
        <span className="netease-music-card-progress" style={{ "--music-progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as CSSProperties} />
      </article>
      <audio
        onDurationChange={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
        }}
        onEnded={() => setPlaying(false)}
        onError={() => { setAudioUnavailable(true); setPlaying(false); }}
        onPause={() => setPlaying(false)}
        onPlay={() => { setAudioUnavailable(false); setPlaying(true); }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        preload="none"
        ref={audioRef}
        src={music.audio_url}
      />
      <SideDrawer
        className="netease-music-drawer"
        historyKey={`netease-song-${music.song_id}`}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        title={music.title}
        titleAccessory={<span className="netease-music-drawer-source">{t("music.neteaseSource")}</span>}
      >
        <div className="netease-player">
          <div className={`netease-player-cover${playing ? " is-playing" : ""}`}>{cover}</div>
          <div className="netease-player-heading">
            <h4>{music.title}</h4>
            <p>{artists}</p>
            {music.album ? <small>{music.album}</small> : null}
          </div>
          <div className="netease-player-controls">
            <input
              aria-label={t("music.progress")}
              max={duration || 0}
              min="0"
              onChange={(event) => seek(Number(event.target.value))}
              step="0.1"
              type="range"
              value={Math.min(currentTime, duration || 0)}
            />
            <div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
            <button disabled={audioUnavailable} onClick={() => void togglePlayback()} type="button">
              <span className="material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>
              {audioUnavailable ? t("music.audioUnavailable") : playing ? t("music.pause") : t("music.play")}
            </button>
          </div>
          <section className="netease-player-lyrics" aria-label={t("music.lyrics")}>
            {lyrics.length ? lyrics.map((line, index) => (
              <p
                className={index === activeLyricIndex ? "is-active" : ""}
                key={`${line.time}:${index}`}
                onClick={() => seek(line.time)}
                ref={(element) => { if (element) lyricRefs.current.set(index, element); else lyricRefs.current.delete(index); }}
              >
                <span>{line.text}</span>
                {line.translation ? <small>{line.translation}</small> : null}
              </p>
            )) : <div className="netease-player-no-lyrics">{t("music.noLyrics")}</div>}
          </section>
          <a className="netease-player-open" href={music.canonical_url} rel="noreferrer" target="_blank">
            {t("music.openNetease")}<span aria-hidden="true">↗</span>
          </a>
        </div>
      </SideDrawer>
    </>
  );
}

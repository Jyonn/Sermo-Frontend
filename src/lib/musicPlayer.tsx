import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { MusicProviderDataDTO } from "../types";
import { useI18n } from "./language";
import { SideDrawer } from "../components/SideDrawer";

type Player = {
  music: MusicProviderDataDTO | null;
  playing: boolean;
  time: number;
  duration: number;
  unavailable: boolean;
  play: (music: MusicProviderDataDTO) => void;
  toggle: () => void;
  seek: (time: number) => void;
  close: () => void;
};

const Context = createContext<Player | null>(null);
const PLAYER_MARGIN = 12;
const DRAG_HOLD_MS = 280;

function timedLyrics(value = "") {
  return value.split(/\r?\n/).flatMap((row) => {
    const text = row.replace(/\[[^\]]+\]/g, "").trim();
    if (!text) return [];
    return [...row.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)].map((match) => ({
      time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${(match[3] || "0").padEnd(3, "0").slice(0, 3)}`),
      text,
    }));
  }).sort((a, b) => a.time - b.time);
}

function playerWidth(compact: boolean) {
  return compact ? 68 : Math.min(360, window.innerWidth - PLAYER_MARGIN * 2);
}

function playerTop(top: number) {
  return Math.min(Math.max(PLAYER_MARGIN, top), Math.max(PLAYER_MARGIN, window.innerHeight - 80));
}

export function useMusicPlayer() {
  const value = useContext(Context);
  if (!value) throw new Error("MusicPlayerProvider is missing");
  return value;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const audio = useRef<HTMLAudioElement>(null);
  const pendingPlay = useRef(false);
  const [music, setMusic] = useState<MusicProviderDataDTO | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [edge, setEdge] = useState<"left" | "right">("right");
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const pendingDrag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number; target: HTMLElement; timer: ReturnType<typeof setTimeout> } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const lyrics = useMemo(() => timedLyrics(music?.lyrics?.original), [music?.lyrics?.original]);
  const activeLyric = useMemo(() => {
    for (let index = lyrics.length - 1; index >= 0; index -= 1) {
      if (time + .08 >= lyrics[index].time) return lyrics[index].text;
    }
    return "";
  }, [lyrics, time]);

  useEffect(() => {
    const reposition = () => setPosition((current) => ({
      left: edge === "left" ? PLAYER_MARGIN : window.innerWidth - playerWidth(compact) - PLAYER_MARGIN,
      top: playerTop(current?.top ?? window.innerHeight - (window.innerWidth <= 520 ? 165 : 100)),
    }));
    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [compact, edge]);

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (!position) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.currentTarget;
    const timer = setTimeout(() => {
      const pending = pendingDrag.current;
      if (!pending || pending.pointerId !== event.pointerId) return;
      drag.current = { pointerId: pending.pointerId, offsetX: pending.x - pending.left, offsetY: pending.y - pending.top };
      target.setPointerCapture(pending.pointerId);
      suppressClick.current = true;
      setDragging(true);
    }, DRAG_HOLD_MS);
    pendingDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: position.left, top: position.top, target, timer };
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const pending = pendingDrag.current;
    if (pending?.pointerId === event.pointerId && !drag.current && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 8) {
      clearTimeout(pending.timer);
      pendingDrag.current = null;
    }
    if (drag.current?.pointerId !== event.pointerId) return;
    setPosition({
      left: Math.min(Math.max(0, event.clientX - drag.current.offsetX), window.innerWidth - playerWidth(compact)),
      top: playerTop(event.clientY - drag.current.offsetY),
    });
  };
  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (pendingDrag.current?.pointerId === event.pointerId) {
      clearTimeout(pendingDrag.current.timer);
      pendingDrag.current = null;
    }
    if (drag.current?.pointerId !== event.pointerId) return;
    const releasedLeft = Math.min(Math.max(0, event.clientX - drag.current.offsetX), window.innerWidth - playerWidth(compact));
    drag.current = null;
    setDragging(false);
    const nextEdge = releasedLeft + playerWidth(compact) / 2 < window.innerWidth / 2 ? "left" : "right";
    setEdge(nextEdge);
    setPosition((current) => ({
      left: nextEdge === "left" ? PLAYER_MARGIN : window.innerWidth - playerWidth(compact) - PLAYER_MARGIN,
      top: playerTop(current?.top ?? PLAYER_MARGIN),
    }));
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  };

  useEffect(() => {
    if (!music || !pendingPlay.current) return;
    pendingPlay.current = false;
    void audio.current?.play().catch(() => { setUnavailable(true); setPlaying(false); });
  }, [music]);

  const toggle = () => {
    if (!audio.current || unavailable) return;
    if (audio.current.paused) void audio.current.play().catch(() => { setUnavailable(true); setPlaying(false); });
    else audio.current.pause();
  };
  const play = (next: MusicProviderDataDTO) => {
    if (music?.song_id === next.song_id) { toggle(); return; }
    audio.current?.pause();
    setTime(0);
    setDuration((next.duration_ms || 0) / 1000);
    setUnavailable(false);
    pendingPlay.current = true;
    setMusic(next);
  };
  const seek = (next: number) => {
    if (!audio.current) return;
    audio.current.currentTime = next;
    setTime(next);
  };
  const close = () => { audio.current?.pause(); setMusic(null); setTime(0); setDrawerOpen(false); };

  return <Context.Provider value={{ music, playing, time, duration, unavailable, play, toggle, seek, close }}>
    {children}
    <audio ref={audio} src={music?.audio_url || undefined} preload="none"
      onPlay={() => { setPlaying(true); setUnavailable(false); }} onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)} onError={() => { setUnavailable(true); setPlaying(false); }}
      onDurationChange={(event) => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration); }}
      onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} />
    {music ? <aside className={`music-mini-player${compact ? " is-compact" : ""}${dragging ? " is-dragging" : ""}`} aria-label={t("music.neteaseSource")} style={position ? { left: position.left, top: position.top } as CSSProperties : undefined}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
      onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
      onContextMenu={(event) => event.preventDefault()}>
      {compact ? <button className="music-mini-compact" type="button" onClick={() => setCompact(false)} aria-label={t("music.expandPlayer")}>
        <span className={`music-mini-disc${playing ? " is-playing" : ""}`}>{music.cover_url ? <img src={music.cover_url} alt="" /> : <span className="material-symbols-outlined">music_note</span>}</span>
      </button> : <>
      <button className="music-mini-cover" type="button" onClick={toggle} disabled={unavailable} aria-label={playing ? t("music.pause") : t("music.play")}>
        <span className={`music-mini-disc${playing ? " is-playing" : ""}`}>{music.cover_url ? <img src={music.cover_url} alt="" /> : <span className="material-symbols-outlined">music_note</span>}</span>
        <span className="music-mini-play-icon material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>
      </button>
      <button className="music-mini-copy" type="button" onClick={() => setDrawerOpen(true)}><strong>{music.title}<span> · {music.artists.join(" / ")}</span></strong><small>{activeLyric || t("music.noLyrics")}</small></button>
      <button className="music-mini-collapse" type="button" onClick={() => setCompact(true)} aria-label={t("music.collapsePlayer")}><span className="material-symbols-outlined">close_fullscreen</span></button>
      <button type="button" onClick={close} aria-label={t("music.closePlayer")}><span className="material-symbols-outlined">close</span></button>
      </>}
      <span className="music-mini-progress" style={{ width: `${duration ? Math.min(100, time / duration * 100) : 0}%` }} />
    </aside> : null}
    {music ? <SideDrawer className="netease-music-drawer" historyKey={`global-netease-song-${music.song_id}`} onClose={() => setDrawerOpen(false)} open={drawerOpen} title={music.title} titleAccessory={<span className="netease-music-drawer-source">{t("music.neteaseSource")}</span>}>
      <div className="netease-player">
        <div className={`netease-player-cover music-disc is-active${playing ? " is-playing" : ""}`}>{music.cover_url ? <img src={music.cover_url} alt="" /> : <span className="material-symbols-outlined">music_note</span>}</div>
        <div className="netease-player-heading"><h4>{music.title}</h4><p>{music.artists.join(" / ")}</p>{music.album ? <small>{music.album}</small> : null}</div>
        <div className="netease-player-controls"><input type="range" min="0" max={duration || 0} value={Math.min(time, duration || 0)} step="0.1" aria-label={t("music.progress")} onChange={(event) => seek(Number(event.target.value))} /><div><span>{Math.floor(time / 60)}:{Math.floor(time % 60).toString().padStart(2, "0")}</span><span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, "0")}</span></div><button type="button" onClick={toggle} disabled={unavailable}><span className="material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>{unavailable ? t("music.audioUnavailable") : playing ? t("music.pause") : t("music.play")}</button></div>
        <section className="netease-player-lyrics" aria-label={t("music.lyrics")}>{music.lyrics?.original ? music.lyrics.original.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => { const stamp = line.match(/\[(\d+):(\d+)(?:[.:](\d+))?\]/); const at = stamp ? Number(stamp[1]) * 60 + Number(stamp[2]) + Number(`0.${stamp[3] || 0}`) : 0; return <p key={index} className={time >= at && time < at + 4 ? "is-active" : ""} onClick={() => seek(at)}>{line.replace(/\[[^\]]+\]/g, "").trim()}</p>; }) : <div className="netease-player-no-lyrics">{t("music.noLyrics")}</div>}</section>
        <a className="netease-player-open" href={music.canonical_url} rel="noreferrer" target="_blank">{t("music.openNetease")}<span aria-hidden="true">↗</span></a>
      </div>
    </SideDrawer> : null}
  </Context.Provider>;
}

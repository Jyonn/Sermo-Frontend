import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { MusicProviderDataDTO } from "../types";
import { musicBrand, sameMusic } from "./musicBrand";
import {claimMediaPlayback} from './mediaPlaybackFocus';
import { useI18n } from "./language";
import { SideDrawer } from "../components/SideDrawer";
import { usePlaybackWait } from "../components/MediaWaitFeedback";
import {SongSession,isPockloSong,cueLines,songLyrics,songPresentation} from './pockloSong';
import {fetchSong,useSongMetadata} from './pockloSongResource';

type Player = {
  music: MusicProviderDataDTO | null;
  playing: boolean;
  time: number;
  duration: number;
  unavailable: boolean;
  loading: boolean;
  songError: number;
  play: (music: MusicProviderDataDTO) => void;
  toggle: () => void;
  seek: (time: number) => void;
  close: () => void;
};

const Context = createContext<Player | null>(null);
const PLAYER_MARGIN = 12;

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
  const [songError,setSongError]=useState(0);
  const songSession=useRef<SongSession|null>(null);
  const currentMusic=useRef(music);currentMusic.current=music;
  const playbackWait = usePlaybackWait();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const metadata=useSongMetadata(isPockloSong(music)?music:null,drawerOpen);
  useEffect(()=>{
    if(metadata.song)setMusic(current=>isPockloSong(current)&&current.song_id===metadata.song!.song_id?{...current,...songPresentation(metadata.song!)}:current);
  },[metadata.song]);
  const [compact, setCompact] = useState(true);
  const [edge, setEdge] = useState<"left" | "right">("right");
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const pendingDrag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number; target: HTMLElement } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const lyricRefs = useRef(new Map<number, HTMLParagraphElement>());
  const lyrics = useMemo(() => music?.lyrics?.cues?.length?cueLines(music.lyrics.cues):timedLyrics(music?.lyrics?.original), [music?.lyrics]);
  useEffect(()=>{
    const element=audio.current;if(!element)return;
    const session=new SongSession(element,fetchSong,(song,media)=>{setMusic(current=>current&&current.provider==='pocklo_music'&&current.song_id===song.song_id?{...current,title:song.title,artists:song.artists,album:song.album,duration_ms:song.duration_ms??undefined,version:song.version,cover_url:media.cover?.url,lyrics:songLyrics(song)}:current)},(loading,error)=>{setSongError(error);setUnavailable(!!error);if(loading)playbackWait.start();else if(error)playbackWait.fail();else playbackWait.ready()});
    songSession.current=session;return()=>{session.stop();songSession.current=null};
  },[]);
  const activeLyricIndex = useMemo(() => {
    for (let index = lyrics.length - 1; index >= 0; index -= 1) {
      if (time + .08 >= lyrics[index].time) return index;
    }
    return -1;
  }, [lyrics, time]);
  const activeLyric = activeLyricIndex >= 0 ? lyrics[activeLyricIndex].text : "";

  useEffect(() => {
    if (!drawerOpen || activeLyricIndex < 0) return;
    lyricRefs.current.get(activeLyricIndex)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLyricIndex, drawerOpen]);

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
    pendingDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: position.left, top: position.top, target: event.currentTarget };
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const pending = pendingDrag.current;
    if (pending?.pointerId === event.pointerId && !drag.current && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 5) {
      drag.current = { pointerId: pending.pointerId, offsetX: pending.x - pending.left, offsetY: pending.y - pending.top };
      pending.target.setPointerCapture(pending.pointerId);
      pendingDrag.current = null;
      suppressClick.current = true;
      setDragging(true);
    }
    if (drag.current?.pointerId !== event.pointerId) return;
    setPosition({
      left: Math.min(Math.max(0, event.clientX - drag.current.offsetX), window.innerWidth - playerWidth(compact)),
      top: playerTop(event.clientY - drag.current.offsetY),
    });
  };
  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (pendingDrag.current?.pointerId === event.pointerId) {
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
    playbackWait.start();
    void audio.current?.play().catch(() => { playbackWait.fail(); setUnavailable(true); setPlaying(false); });
  }, [music]);

  const toggle = () => {
    if (!audio.current) return;
    if(isPockloSong(currentMusic.current)){
      if(songError===404||songError===410)return;
      if(!audio.current.paused&&!unavailable){songSession.current?.pause();return}
      songSession.current?.resume();return;
    }
    if (audio.current.paused || unavailable) {
      if (unavailable) { setUnavailable(false); audio.current.load(); }
      playbackWait.start();
      void audio.current.play().catch(() => { playbackWait.fail(); setUnavailable(true); setPlaying(false); });
    }
    else audio.current.pause();
  };
  const play = (next: MusicProviderDataDTO) => {
    if (sameMusic(music, next)) { toggle(); return; }
    audio.current?.pause();
    songSession.current?.stop();setSongError(0);
    setTime(0);
    setDuration((next.duration_ms || 0) / 1000);
    setUnavailable(false);
    playbackWait.start();
    pendingPlay.current = !isPockloSong(next);
    setCompact(true);
    setMusic(next);
    currentMusic.current=next;
    if(isPockloSong(next))songSession.current?.start(next);
  };
  const seek = (next: number) => {
    if (!audio.current) return;
    if(isPockloSong(currentMusic.current)){songSession.current?.seek(next);return}
    audio.current.currentTime = next;
    setTime(next);
  };
  const close = () => { songSession.current?.stop();setSongError(0);audio.current?.pause(); playbackWait.ready(); setMusic(null); setTime(0); setDrawerOpen(false); };
  const progress = duration > 0 ? Math.min(100, Math.max(0, time / duration * 100)) : 0;
  const brand = music ? musicBrand(music.provider) : null;

  return <Context.Provider value={{ music, playing, time, duration, unavailable, songError, loading:playbackWait.visible&&playbackWait.phase!=='error', play, toggle, seek, close }}>
    {children}
    <audio ref={audio} src={music?.provider==='pocklo_music'?undefined:music?.audio_url || undefined} crossOrigin={music?.provider==='pocklo_music'?'anonymous':undefined} preload={music?.provider==='pocklo_music'?'metadata':'none'}
      onPlay={event => {claimMediaPlayback(event.currentTarget);setUnavailable(false)}} onPlaying={() => { setPlaying(true); playbackWait.ready(); }}
      onPause={() => { setPlaying(false); playbackWait.stop(); }} onWaiting={playbackWait.waiting} onStalled={playbackWait.waiting}
      onEnded={() => { setPlaying(false); playbackWait.ready(); }} onError={() => { setPlaying(false);if(isPockloSong(currentMusic.current)){songSession.current?.mediaError();return}playbackWait.fail(); setUnavailable(true); }}
      onDurationChange={(event) => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration); }}
      onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} />
    {music ? <aside className={`music-mini-player${compact ? " is-compact" : ""}${dragging ? " is-dragging" : ""}`} aria-label={brand?.name} style={{ ...(position || {}), "--music-progress": `${progress}%`, "--music-angle": `${progress * 3.6}deg`, "--netease-red": brand?.color } as CSSProperties}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
      onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
      onContextMenu={(event) => event.preventDefault()}>
      {compact ? <button className="music-mini-compact" type="button" onClick={() => setCompact(false)} aria-label={t("music.expandPlayer")}>
        <span className={`music-mini-disc${playing && playbackWait.phase === "idle" ? " is-playing" : ""}`}>{music.cover_url ? <img src={music.cover_url} alt="" /> : <span className="material-symbols-outlined">music_note</span>}</span>
        {playbackWait.visible && playbackWait.phase !== "error" ? <span aria-hidden="true" className="media-wait-spinner music-mini-wait" /> : null}
      </button> : <>
      <button className="music-mini-cover" type="button" onClick={toggle} aria-label={unavailable ? t("common.retry") : playing ? t("music.pause") : t("music.play")}>
        <span className={`music-mini-disc${playing && playbackWait.phase === "idle" ? " is-playing" : ""}`}>{music.cover_url ? <img src={music.cover_url} alt="" /> : <span className="material-symbols-outlined">music_note</span>}</span>
        {playbackWait.visible && playbackWait.phase !== "error" ? <span className="media-wait-spinner music-mini-play-icon" aria-hidden="true" /> : <span className="music-mini-play-icon material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>}
      </button>
      <button className="music-mini-copy" type="button" onClick={() => setDrawerOpen(true)}><strong><img alt="" src={brand?.logo} style={{ width: 14, height: 14, marginRight: 5, borderRadius: "50%", verticalAlign: "-2px" }} />{music.title}<span> · {music.artists.join(" / ")}</span></strong><small>{playbackWait.visible && playbackWait.phase !== "error" ? t("media.buffering") : activeLyric || t("music.noLyrics")}</small></button>
      <button className="music-mini-collapse" type="button" onClick={() => setCompact(true)} aria-label={t("music.collapsePlayer")}><span className="material-symbols-outlined">close_fullscreen</span></button>
      <button className="music-mini-close" type="button" onClick={close} aria-label={t("music.closePlayer")}><span className="material-symbols-outlined">close</span></button>
      </>}
    </aside> : null}
    {music ? <SideDrawer className="netease-music-drawer" historyKey={`global-${music.provider}-song-${music.song_id}`} onClose={() => setDrawerOpen(false)} onRouteOpen={()=>setDrawerOpen(true)} open={drawerOpen} style={{ "--netease-red": brand?.color } as CSSProperties} title={music.title} titleAccessory={<span className="netease-music-drawer-source"><img alt="" src={brand?.logo} style={{ width: 15, height: 15, borderRadius: "50%" }} />{brand?.name}</span>}>
      <div className="netease-player">
        <div className={`netease-player-cover music-disc is-active${playing && playbackWait.phase === "idle" ? " is-playing" : ""}`}>{music.cover_url ? <img src={music.cover_url} alt="" /> : <span className="material-symbols-outlined">music_note</span>}</div>
        <div className="netease-player-heading"><h4>{music.title}</h4><p>{music.artists.join(" / ")}</p>{music.album ? <small>{music.album}</small> : null}</div>
        <div className="netease-player-controls"><input type="range" min="0" max={duration || 0} value={Math.min(time, duration || 0)} step="0.1" aria-label={t("music.progress")} onChange={(event) => seek(Number(event.target.value))} /><div><span>{Math.floor(time / 60)}:{Math.floor(time % 60).toString().padStart(2, "0")}</span><span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, "0")}</span></div><button type="button" disabled={songError===404||songError===410} onClick={toggle}>{playbackWait.visible && playbackWait.phase !== "error" ? <span aria-hidden="true" className="media-wait-spinner" /> : <span className="material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span>}{songError===404?t("pocklo.songRevoked"):songError===410?t("pocklo.songMissing"):unavailable ? t("common.retry") : playbackWait.visible && playbackWait.phase !== "error" ? t("media.buffering") : playing ? t("music.pause") : t("music.play")}</button></div>
        <section className="netease-player-lyrics" aria-label={t("music.lyrics")}>{metadata.loading?<div className="netease-player-no-lyrics" role="status">{t('common.loading')}</div>:metadata.error?<div className="netease-player-no-lyrics" role="status">{t(metadata.error===404?'pocklo.songRevoked':metadata.error===410?'pocklo.songMissing':'pocklo.songFailed')}</div>:lyrics.length ? lyrics.map((line, index) => <p key={`${line.time}:${index}`} className={index === activeLyricIndex ? "is-active" : ""} onClick={() => seek(line.time)} ref={(element) => { if (element) lyricRefs.current.set(index, element); else lyricRefs.current.delete(index); }}>{line.text}</p>) : music.lyrics?.original?<p style={{whiteSpace:"pre-wrap"}}>{music.lyrics.original}</p>:<div className="netease-player-no-lyrics">{t("music.noLyrics")}</div>}</section>
        <a className="netease-player-open" href={music.canonical_url} rel="noreferrer" target="_blank"><img alt="" src={brand?.logo} style={{ width: 18, height: 18, borderRadius: "50%" }} />{brand?.name}<span aria-hidden="true">↗</span></a>
      </div>
    </SideDrawer> : null}
  </Context.Provider>;
}

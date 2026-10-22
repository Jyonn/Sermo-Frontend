import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO, ChatMessage } from "../types";
import { BgmKeychain } from "./BgmActivity";
import "./BgmChatEntrance.css";
import { BgmIcon } from "./BgmIcon";
import { localBgmUri } from "../lib/bgmMedia";
import { bgmSilentMinutes, newBgmEntrances } from "../lib/bgmEntrance";
import { showToast } from "../lib/toast";

let activeBgm: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());

async function playBgm(uri: string) {
  // Never interrupt a voice message or a video already playing.
  if (Array.from(document.querySelectorAll("audio,video")).some((element) => !(element as HTMLMediaElement).paused)) return false;
  activeBgm?.pause();
  const player = new Audio(localBgmUri(uri, window.location.origin));
  player.volume = 0.35;
  activeBgm = player;
  player.onended = announce;
  player.onpause = announce;
  player.onerror = announce;
  announce();
  try { await player.play(); announce(); return true; }
  catch { announce(); return false; }
}

export function BgmAudioPill({ uri, title, compact = false }: { uri: string; title: string; compact?: boolean }) {
  const { t } = useI18n();
  const [, refresh] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => { const update = () => refresh((value) => value + 1); listeners.add(update); return () => { listeners.delete(update); }; }, []);
  const playing = activeBgm?.src === new URL(localBgmUri(uri, window.location.origin), window.location.origin).href && !activeBgm.paused;
  return <span className={`bgm-audio-inline${compact ? " is-compact" : ""}`}><button aria-label={t(playing ? "bgm.stopPlayback" : "bgm.playTrack", { title })} onClick={() => {
    if (playing) { activeBgm?.pause(); return; }
    void playBgm(uri).then((played) => setError(!played));
  }} type="button"><BgmIcon name={playing ? "pause" : "play_arrow"} />{!compact ? <span>{title}</span> : null}</button>{error ? <small role="status">{t("bgm.playFailed")}</small> : null}</span>;
}

export function BgmChatEntrance({ chatId, messages, active }: { chatId: number; messages: ChatMessage[]; active: boolean }) {
  const { session } = useAuth();
  const { t } = useI18n();
  const [activity, setActivity] = useState<ActivityCampaignDTO | null>(null);
  const [seconds, setSeconds] = useState(3);
  const [dock, setDock] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [pressedTrack, setPressedTrack] = useState<string | null>(null);
  const dockCloseTimer = useRef<number | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const visit = useRef(0);
  const requestId = useRef("");
  const [receiveAudio, setReceiveAudio] = useState(false);
  const seen = useRef(new Set<string>());
  const mountedAt = useRef(Date.now() / 1000);
  const userId = session?.user.user_id;

  useEffect(() => {
    alive.current = true;
    const currentVisit = ++visit.current;
    requestId.current = crypto.randomUUID();
    setDock(false); setActivity(null); setReceiveAudio(false);
    setSeconds(3); setPressedTrack(null); setBusy(false); setError("");
    sending.current = false;
    const controller = new AbortController();
    if (active && !document.hidden) void api.getMyBgm(controller.signal, chatId).then((result) => {
      if (controller.signal.aborted) return;
      setActivity(result);
      setReceiveAudio(result?.bgm?.receive_audio ?? true);
      const data = result?.bgm;
      if (!result || !data || data.mode === "off" || document.hidden) return;
      if (data.entrance?.reason === "cooldown") { silent(data.entrance.retry_after_seconds); return; }
      if (!data.entrance?.allowed) return;
      if (data.mode === "manual") setDock(true);
      else if (data.mode === "auto") void enter(result, undefined, currentVisit);
    }).catch(() => undefined);
    const stopWhenHidden = () => { if (document.hidden) { activeBgm?.pause(); setDock(false); } };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => { alive.current = false; controller.abort(); activeBgm?.pause(); if (dockCloseTimer.current !== null) window.clearTimeout(dockCloseTimer.current); document.removeEventListener("visibilitychange", stopWhenHidden); };
  }, [chatId, userId, session?.user.space_id, active]);

  useEffect(() => {
    if (!dock || !active || busy || pressedTrack || document.hidden) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, 3 - Math.floor((performance.now() - start) / 1000));
      setSeconds(remaining);
      if (!remaining) { setDock(false); window.clearInterval(timer); }
    }, 100);
    return () => window.clearInterval(timer);
  }, [dock, active, busy, pressedTrack]);

  function silent(seconds: number) {
    setDock(false);
    showToast(t("bgm.silentEntry", { minutes: bgmSilentMinutes(seconds) }), "info", 3000);
  }

  async function enter(selectedActivity: ActivityCampaignDTO, track?: string, currentVisit = visit.current) {
    if (sending.current || !active || document.hidden) return;
    const isCurrent = () => alive.current && visit.current === currentVisit;
    sending.current = true;
    setBusy(true); setError("");
    try {
      const response = await api.enterWithBgm(selectedActivity.key, chatId, requestId.current, track);
      if (!isCurrent()) return;
      if (response.reason === "cooldown") { silent(response.retry_after_seconds ?? 180); return; }
      if (!response.sent || !response.uri || !response.title) { setDock(false); return; }
      const played = await playBgm(response.uri);
      if (!isCurrent()) { activeBgm?.pause(); return; }
      if (track && played) {
        setPressedTrack(track);
        dockCloseTimer.current = window.setTimeout(() => { if (alive.current) { setDock(false); setPressedTrack(null); } }, 900);
      } else setDock(false);
    } catch { if (isCurrent()) { setDock(false); setError(t("bgm.entranceFailed")); } }
    finally { if (isCurrent()) { sending.current = false; setBusy(false); } }
  }

  useEffect(() => {
    if (!messages.length) return;
    const ids = new Set(messages.map((message) => String(message.id)));
    const previous = seen.current;
    seen.current = new Set([...previous, ...ids]);
    if (!active || document.hidden) return;
    const incoming = newBgmEntrances(messages, previous, mountedAt.current, Date.now() / 1000, userId, receiveAudio);
    const latest = incoming[incoming.length - 1];
    if (latest?.payload?.uri) void playBgm(latest.payload.uri);
  }, [messages, active, userId, receiveAudio]);

  useEffect(() => { if (!active) { setDock(false); activeBgm?.pause(); } }, [active]);
  const data = activity?.bgm;
  return <>
    {dock && data?.style && activity ? <aside className="bgm-chat-dock" aria-label={t("bgm.pressToEnter")}><header><strong>{t("bgm.pressToEnter")}</strong><span>{pressedTrack ? t("bgm.keyPlaying") : `${seconds}s`}</span><button aria-label={t("common.close")} onClick={() => setDock(false)} type="button"><BgmIcon name="close" /></button></header><BgmKeychain disabled={busy || Boolean(pressedTrack)} playingKey={pressedTrack} onPress={(key) => void enter(activity, key)} slots={data.slots} style={data.style} tracks={data.tracks} /><small>{t(pressedTrack ? "bgm.keyPlaying" : "bgm.autoDismiss")}</small></aside> : null}
    {error ? <aside className="bgm-chat-fallback" role="status"><span>{error}</span><button onClick={() => setError("")} type="button">{t("common.close")}</button></aside> : null}
  </>;
}

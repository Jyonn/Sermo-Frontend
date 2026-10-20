import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO, ChatMessage } from "../types";
import { BgmKeychain } from "./BgmActivity";
import "./BgmChatEntrance.css";
import { BgmIcon } from "./BgmIcon";
import { localBgmUri } from "../lib/bgmMedia";
import { newBgmEntrances } from "../lib/bgmEntrance";

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
  const [error, setError] = useState("");
  const alive = useRef(true);
  const attempted = useRef(false);
  const seen = useRef(new Set<string>());
  const mountedAt = useRef(Date.now() / 1000);
  const userId = session?.user.user_id;

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void api.getMyBgm(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setActivity(result);
      if (result?.bgm?.mode === "manual") setDock(true);
    }).catch(() => undefined);
    const stopWhenHidden = () => { if (document.hidden) { activeBgm?.pause(); setDock(false); } };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => { alive.current = false; controller.abort(); activeBgm?.pause(); document.removeEventListener("visibilitychange", stopWhenHidden); };
  }, [chatId, userId, session?.user.space_id]);

  useEffect(() => {
    if (!dock || !active || document.hidden) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, 3 - Math.floor((performance.now() - start) / 1000));
      setSeconds(remaining);
      if (!remaining) { setDock(false); window.clearInterval(timer); }
    }, 100);
    return () => window.clearInterval(timer);
  }, [dock, active]);

  async function enter(track?: string) {
    if (!activity || busy || !active || document.hidden) return;
    setBusy(true); setDock(false); setError("");
    try {
      const response = await api.enterWithBgm(activity.key, chatId, crypto.randomUUID(), track);
      if (!alive.current || !response.sent || !response.uri || !response.title) return;
      await playBgm(response.uri);
    } catch { if (alive.current) setError(t("bgm.entranceFailed")); }
    finally { if (alive.current) setBusy(false); }
  }

  useEffect(() => {
    if (!active || activity?.bgm?.mode !== "auto" || attempted.current) return;
    attempted.current = true;
    void enter();
  }, [activity, active]);

  useEffect(() => {
    if (!messages.length) return;
    const ids = new Set(messages.map((message) => String(message.id)));
    const previous = seen.current;
    seen.current = new Set([...previous, ...ids]);
    if (!active || document.hidden) return;
    const incoming = newBgmEntrances(messages, previous, mountedAt.current, Date.now() / 1000, userId);
    const latest = incoming[incoming.length - 1];
    if (latest?.payload?.uri) void playBgm(latest.payload.uri);
  }, [messages, active, userId]);

  useEffect(() => { if (!active) { setDock(false); activeBgm?.pause(); } }, [active]);
  const data = activity?.bgm;
  return <>
    {dock && data?.style ? <aside className="bgm-chat-dock" aria-label={t("bgm.pressToEnter")}><header><strong>{t("bgm.pressToEnter")}</strong><span>{seconds}s</span><button aria-label={t("common.close")} onClick={() => setDock(false)} type="button"><BgmIcon name="close" /></button></header><BgmKeychain onPress={(key) => void enter(key)} slots={data.slots} style={data.style} tracks={data.tracks} /><small>{t("bgm.autoDismiss")}</small></aside> : null}
    {error ? <aside className="bgm-chat-fallback" role="status"><span>{error}</span><button onClick={() => setError("")} type="button">{t("common.close")}</button></aside> : null}
  </>;
}

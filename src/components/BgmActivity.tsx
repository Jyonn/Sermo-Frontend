import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { localBgmUri } from "../lib/bgmMedia";
import type { ActivityCampaignDTO } from "../types";
import { ActivityCampaignCard } from "./ActivityCampaignCard";
import { BgmIcon } from "./BgmIcon";
import { BgmKeychain } from "./BgmKeychain";
import { BottomSheet } from "./BottomSheet";
import "./BgmActivity.css";
export { BgmKeychain } from "./BgmKeychain";

export function BgmBanner({ onClick, activity }: { onClick: () => void; activity?: ActivityCampaignDTO }) {
  const { t, language } = useI18n();
  const title = activity ? (language.startsWith("zh") ? activity.title : activity.title_en || activity.title) : t("bgm.bannerTitle");
  return <ActivityCampaignCard activity={activity ?? { key: "main-character-bgm-2026", theme: "bgm" }} title={title} eyebrow={t("bgm.limited")} hint={t("bgm.bannerHint")} className="square-activity-banner" onClick={onClick} />;
}

export function BgmActivity({ activity, onUpdate, onTask }: { activity: ActivityCampaignDTO; onUpdate: (activity: ActivityCampaignDTO) => void; onTask: (kind: string) => void }) {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const data = activity.bgm;
  const [style, setStyle] = useState<"blue" | "pink">(data?.style ?? "blue");
  const [panel, setPanel] = useState<"tracks" | "tasks" | "rules" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const request = useRef(0);
  const version = useRef(0);
  const alive = useRef(true);
  const updateRef = useRef(onUpdate);
  updateRef.current = onUpdate;
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    const current = version.current;
    void api.getActivity(activity.key, controller.signal).then((result) => {
      if (!controller.signal.aborted && current === version.current) updateRef.current(result);
    }).catch(() => undefined);
    return () => { alive.current = false; controller.abort(); request.current++; audio.current?.pause(); };
  }, [activity.key]);
  if (!data) return null;
  const owned = data.tracks.filter((item) => item.owned);
  const next = data.tracks.find((item) => !item.owned);
  const deviceStyle = data.joined && data.style ? data.style : style;
  const date = (seconds: number) => new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(new Date(seconds * 1000));
  async function configure(slots?: string[]) {
    if (busy) return;
    version.current++; setBusy(true); setError("");
    try { const updated = await api.configureBgm(activity.key, deviceStyle, slots); if (alive.current) updateRef.current(updated); }
    catch { if (alive.current) setError(t("bgm.saveFailed")); }
    finally { if (alive.current) setBusy(false); }
  }
  async function play(key: string) {
    const track = data?.tracks.find((item) => item.key === key);
    if (!track?.owned || !track.uri) return;
    const current = ++request.current;
    audio.current?.pause();
    setPlaying(null);
    if (playing === key) { setPlaying(null); return; }
    const player = new Audio(localBgmUri(track.uri, window.location.origin));
    audio.current = player; player.volume = .5;
    const reset = () => { if (request.current === current && alive.current) setPlaying(null); };
    player.onended = reset; player.onpause = reset;
    player.onerror = () => { reset(); if (alive.current && request.current === current) setError(t("bgm.playFailed")); };
    setError("");
    try { await player.play(); if (alive.current && request.current === current) setPlaying(key); }
    catch { reset(); if (alive.current && request.current === current) setError(t("bgm.playFailed")); }
  }
  return <div className="bgm-activity">
    <header className="bgm-masthead"><span>{t("bgm.limited")}</span><time>{date(activity.starts_at)} — {activity.ends_at ? date(activity.ends_at) : "—"}</time></header>
    <section className="bgm-intro"><small>YOUR MOMENT, YOUR SOUND</small><h2>{t(data.joined ? "bgm.homeTitle" : "bgm.chooseTitle")}</h2><p>{t(data.joined ? "bgm.homeHint" : "bgm.chooseHint")}</p></section>
    {!data.ready ? <p className="bgm-feedback" role="status">{t("bgm.preparing")}</p> : !data.joined ? <>
      <div className="bgm-style-options">{(["blue", "pink"] as const).map((value) => <button disabled={busy} aria-pressed={style === value} className={`bgm-style-option is-${value}${style === value ? " is-selected" : ""}`} key={value} onClick={() => setStyle(value)} type="button"><BgmKeychain style={value} /><strong>{t(`bgm.style.${value}`)}</strong><small>{t(`bgm.styleHint.${value}`)}</small><BgmIcon name={style === value ? "check_circle" : "radio_button_unchecked"} /></button>)}</div>
      <p className="bgm-footnote">{t("bgm.sharedProgress")}</p>
      <button className="primary-button bgm-join" disabled={busy || !activity.active || !activity.verified} onClick={() => void configure()} type="button">{t(busy ? "common.processing" : !activity.verified ? "bgm.verifyFirst" : !activity.active ? "bgm.ended" : "bgm.join")}</button>
    </> : <>
      <section className="bgm-device-stage"><BgmKeychain onPress={(key) => void play(key)} playingKey={playing} slots={data.slots} style={deviceStyle} tracks={data.tracks} /><div className="bgm-key-legend"><span className="is-inactive">{t("bgm.keyInactive")}</span><span className="is-ready">{t("bgm.keyReady")}</span><span className="is-playing">{t("bgm.keyPlaying")}</span></div><div className="bgm-owned"><strong>{t("bgm.collected", { count: owned.length })}</strong><span>{t("bgm.journey", { days: data.active_days, points: data.points })}</span></div><progress aria-label={t("bgm.collectionProgress")} max={12} value={owned.length} /></section>
      {next ? <aside className="bgm-next"><BgmIcon name="music_note" /><div><strong>{t("bgm.nextTrack", { title: next.title })}</strong><span>{t("bgm.remaining", { days: Math.max(0, next.days - data.active_days), points: Math.max(0, next.points - data.points) })}</span></div></aside> : <p className="bgm-complete">{t("bgm.complete")}</p>}
    </>}
    <nav className="bgm-secondary-menu" aria-label={t("bgm.sections")}>
      {data.joined ? <><button onClick={() => setPanel("tracks")} type="button"><BgmIcon name="music_note" />{t("bgm.tracks")}</button><button onClick={() => setPanel("tasks")} type="button"><BgmIcon name="edit_square" />{t("bgm.tasks")}</button></> : null}
      <button onClick={() => setPanel("rules")} type="button"><BgmIcon name="chat_bubble" />{t("bgm.rulesShort")}</button>
    </nav>
    {data.joined ? <button className="bgm-settings-link" onClick={() => navigate("/app/menu?panel=personalization")} type="button">{t("bgm.settingsLocation")}<BgmIcon name="arrow_forward" /></button> : null}
    {error ? <p className="bgm-feedback" role="alert">{error}<button onClick={() => setError("")} type="button">{t("common.close")}</button></p> : null}
    <BottomSheet open={panel !== null} onClose={() => setPanel(null)} title={t(panel === "tracks" ? "bgm.tracks" : panel === "tasks" ? "bgm.tasks" : "bgm.rules")} className="bgm-info-sheet">
      {panel === "tracks" ? <section className="bgm-tracks">{data.tracks.map((track, index) => <article className={`bgm-track${track.owned ? " is-owned" : ""}`} key={track.key}><span className={`bgm-track-art tone-${index % 4}`}><BgmIcon name={track.owned ? "music_note" : "lock"} /><small>{String(index + 1).padStart(2, "0")}</small></span><div><strong>{track.title}</strong><small>{track.author ? `${track.author} · ` : ""}{Math.ceil(track.duration)}s</small>{!track.owned ? <span>{t("bgm.gate", { days: track.days, points: track.points })}</span> : null}</div>{track.owned ? <div className="bgm-track-actions"><button aria-label={t(playing === track.key ? "bgm.stopPlayback" : "bgm.playTrack", { title: track.title })} onClick={() => void play(track.key)} type="button"><BgmIcon name={playing === track.key ? "pause" : "play_arrow"} /></button><button disabled={busy || (!data.slots.includes(track.key) && data.slots.length >= 6)} onClick={() => void configure(data.slots.includes(track.key) ? data.slots.filter((key) => key !== track.key) : [...data.slots, track.key])} type="button">{t(data.slots.includes(track.key) ? "bgm.remove" : "bgm.equip")}</button></div> : <BgmIcon name="lock" />}</article>)}</section> : null}
      {panel === "tasks" ? <section className="bgm-task-list"><header><strong>{t("bgm.todayPoints", { points: data.today_points })}</strong><small>{t(activity.today_earned ? "bgm.activeToday" : "bgm.activeHint")}</small></header>{data.tasks.map((task) => <article key={task.kind}><BgmIcon name={({ publish: "edit_square", comment: "chat_bubble", like: "favorite" })[task.kind]} /><div><strong>{t(`bgm.task.${task.kind}`)}</strong><small>{t("bgm.taskReward", { count: task.limit, points: task.points })}</small></div><button disabled={!activity.active || task.count >= task.limit} onClick={() => { setPanel(null); onTask(task.kind); }} type="button">{task.count >= task.limit ? t("bgm.done") : `${task.count} / ${task.limit}`}<BgmIcon name="arrow_forward" /></button></article>)}</section> : null}
      {panel === "rules" ? <section className="bgm-rules"><ol>{([1, 2, 3, 4] as const).map((number) => <li key={number}>{t(`bgm.rule${number}`)}</li>)}</ol><p>{t("bgm.sharedProgress")}</p></section> : null}
    </BottomSheet>
  </div>;
}

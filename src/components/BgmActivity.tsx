import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import "./BgmActivity.css";
import { BgmIcon } from "./BgmIcon";
import { localBgmUri } from "../lib/bgmMedia";
import { ActivityCampaignCard, ActivityTitle } from "./ActivityCampaignCard";
import { SettingSelect } from "./SettingRow";
import { BGM_KEY_CENTERS } from "../lib/bgmEntrance";

export function BgmKeychain({ style, slots = [], tracks = [], onPress }: {
  style: "blue" | "pink";
  slots?: string[];
  tracks?: NonNullable<ActivityCampaignDTO["bgm"]>["tracks"];
  onPress?: (key: string) => void;
}) {
  const { t } = useI18n();
  return <div className={`bgm-keychain is-${style}`}>
    {Array.from({ length: 6 }, (_, index) => {
      const track = tracks.find((item) => item.key === slots[index]);
      if (!onPress) return null;
      const [left, top] = BGM_KEY_CENTERS[style][index];
      return <button aria-label={track ? t("bgm.playTrack", { title: track.title }) : t("bgm.emptySlot", { number: index + 1 })} className={`bgm-key${track ? " is-filled" : ""}`} disabled={!track} key={index} onClick={() => track && onPress?.(track.key)} style={{ left: `${left}%`, top: `${top}%` }} type="button">{track ? index + 1 : <BgmIcon name={"add"} />}</button>;
    })}
  </div>;
}

export function BgmBanner({ onClick, activity }: { onClick: () => void; activity?: ActivityCampaignDTO }) {
  const { t, language } = useI18n();
  const title = activity ? (language.startsWith("zh") ? activity.title : activity.title_en || activity.title) : t("bgm.bannerTitle");
  return <ActivityCampaignCard activity={activity ?? { key: "main-character-bgm-2026", theme: "bgm" }} title={title} eyebrow={t("bgm.limited")} hint={t("bgm.bannerHint")} className="square-activity-banner" onClick={onClick} />;
}

export function BgmActivity({ activity, onUpdate, onTask }: { activity: ActivityCampaignDTO; onUpdate: (activity: ActivityCampaignDTO) => void; onTask: (kind: string) => void }) {
  const { t, language } = useI18n();
  const data = activity.bgm;
  const [style, setStyle] = useState<"blue" | "pink">(data?.style ?? "blue");
  const [tab, setTab] = useState<"tracks" | "tasks">("tracks");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [mode, setMode] = useState(data?.mode ?? "off");
  const [track, setTrack] = useState(data?.track ?? "1");
  const audio = useRef<HTMLAudioElement | null>(null);
  const playRequest = useRef(0);
  const version = useRef(0);
  const updateRef = useRef(onUpdate);
  updateRef.current = onUpdate;
  useEffect(() => {
    const controller = new AbortController();
    const current = version.current;
    void api.getActivity(activity.key, controller.signal).then((result) => {
      if (!controller.signal.aborted && version.current === current) updateRef.current(result);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [activity.key]);
  useEffect(() => () => { playRequest.current++; audio.current?.pause(); }, []);
  if (!data) return null;
  const owned = data.tracks.filter((track) => track.owned);
  const next = data.tracks.find((track) => !track.owned);
  const date = (seconds: number) => new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(new Date(seconds * 1000));

  async function configure(slots?: string[], savePreferences = false) {
    if (busy) return;
    version.current++; setBusy(true); setError("");
    try { onUpdate(await api.configureBgm(activity.key, style, slots, savePreferences ? { mode, track, receive_audio: true } : undefined)); }
    catch { setError(t("bgm.saveFailed")); }
    finally { setBusy(false); }
  }

  async function play(key: string) {
    const track = data?.tracks.find((item) => item.key === key);
    if (!track?.uri) return;
    const request = ++playRequest.current;
    audio.current?.pause();
    if (playing === key) { setPlaying(null); return; }
    const player = new Audio(localBgmUri(track.uri, window.location.origin));
    audio.current = player;
    player.volume = 0.5;
    player.onended = () => { if (playRequest.current === request) setPlaying(null); };
    player.onerror = () => { if (playRequest.current === request) { setPlaying(null); setError(t("bgm.playFailed")); } };
    setPlaying(key); setError("");
    try { await player.play(); } catch { if (playRequest.current === request) { setPlaying(null); setError(t("bgm.playFailed")); } }
  }

  return <div className="bgm-activity">
    <header className="bgm-masthead"><span>{t("bgm.limited")}</span><time>{date(activity.starts_at)} — {activity.ends_at ? date(activity.ends_at) : "—"}</time></header>
    <section className="bgm-intro"><small>YOUR MOMENT, YOUR SOUND</small><div className="bgm-event-title"><ActivityTitle activity={activity} title={language.startsWith("zh") ? activity.title : activity.title_en || activity.title} /></div><h2>{t(data.joined ? "bgm.homeTitle" : "bgm.chooseTitle")}</h2><p>{t(data.joined ? "bgm.homeHint" : "bgm.chooseHint")}</p></section>
    {!data.ready ? <p className="bgm-feedback" role="status">{t("bgm.preparing")}</p> : !data.joined ? <>
      <div className="bgm-style-options">{(["blue", "pink"] as const).map((value) => <button aria-pressed={style === value} className={`bgm-style-option is-${value}${style === value ? " is-selected" : ""}`} key={value} onClick={() => setStyle(value)} type="button"><BgmKeychain style={value} /><span><strong>{t(`bgm.style.${value}`)}</strong><small>{t(`bgm.styleHint.${value}`)}</small></span><BgmIcon name={style === value ? "check_circle" : "radio_button_unchecked"} /></button>)}</div>
      <button className="primary-button bgm-join" disabled={busy || !activity.active || !activity.verified} onClick={() => void configure()} type="button">{busy ? t("common.processing") : !activity.verified ? t("bgm.verifyFirst") : !activity.active ? t("bgm.ended") : t("bgm.join")}</button><p className="bgm-footnote">{t("bgm.sharedProgress")}</p>
    </> : <>
      <section className="bgm-device-stage"><div className="bgm-style-switch" aria-label={t("bgm.switchStyle")}>{(["blue", "pink"] as const).map((value) => <button aria-label={t(`bgm.style.${value}`)} aria-pressed={style === value} className={`is-${value}`} disabled={busy} key={value} onClick={() => setStyle(value)} type="button" />)}{style !== data.style ? <button disabled={busy} onClick={() => void configure()} type="button">{t("common.save")}</button> : null}</div><BgmKeychain onPress={(key) => void play(key)} slots={data.slots} style={style} tracks={data.tracks} /><div className="bgm-owned"><strong>{t("bgm.collected", { count: owned.length })}</strong><span>{t("bgm.journey", { days: data.active_days, points: data.points })}</span></div><progress aria-label={t("bgm.collectionProgress")} max={12} value={owned.length} /></section>
      <details className="bgm-settings"><summary>{t("bgm.settings")}</summary><SettingSelect label={t("bgm.entranceMode")} disabled={busy} value={mode} onChange={setMode} options={(["off", "auto", "manual"] as const).map((value) => ({ value, label: t(`bgm.mode.${value}`) }))} />{mode === "auto" ? <SettingSelect label={t("bgm.entranceTrack")} disabled={busy} value={track} onChange={setTrack} options={[{ value: "random", label: t("bgm.random") }, ...owned.map((item) => ({ value: item.key, label: item.title }))]} /> : null}<p>{t("bgm.playbackHint")}</p><button className="primary-button" disabled={busy || (mode === "manual" && !data.slots.length)} onClick={() => void configure(undefined, true)} type="button">{busy ? t("common.processing") : t("common.save")}</button></details>
      <nav className="bgm-tabs" aria-label={t("bgm.sections")}>{(["tracks", "tasks"] as const).map((value) => <button aria-pressed={tab === value} className={tab === value ? "is-active" : ""} key={value} onClick={() => setTab(value)} type="button">{t(`bgm.${value}`)}</button>)}</nav>
      {tab === "tracks" ? <section className="bgm-tracks">{data.tracks.map((track, index) => <article className={`bgm-track${track.owned ? " is-owned" : ""}`} key={track.key}><span className={`bgm-track-art tone-${index % 4}`}><BgmIcon name={track.owned ? "music_note" : "lock"} /><small>{String(index + 1).padStart(2, "0")}</small></span><div><strong>{track.title}</strong><small>{track.author ? `${track.author} · ` : ""}{Math.ceil(track.duration)}s</small>{!track.owned ? <span>{t("bgm.gate", { days: track.days, points: track.points })}</span> : null}</div>{track.owned ? <div className="bgm-track-actions"><button aria-label={t("bgm.playTrack", { title: track.title })} onClick={() => void play(track.key)} type="button"><BgmIcon name={playing === track.key ? "pause" : "play_arrow"} /></button><button disabled={busy || (!data.slots.includes(track.key) && data.slots.length >= 6)} onClick={() => void configure(data.slots.includes(track.key) ? data.slots.filter((key) => key !== track.key) : [...data.slots, track.key])} type="button">{t(data.slots.includes(track.key) ? "bgm.remove" : "bgm.equip")}</button></div> : <span className="bgm-track-lock"><BgmIcon name="lock" /></span>}</article>)}</section> : <section className="bgm-task-list"><header><strong>{t("bgm.todayPoints", { points: data.today_points })}</strong><small>{t(activity.today_earned ? "bgm.activeToday" : "bgm.activeHint")}</small></header>{data.tasks.map((task) => <article key={task.kind}><BgmIcon name={({ publish: "edit_square", comment: "chat_bubble", like: "favorite" })[task.kind]} /><div><strong>{t(`bgm.task.${task.kind}`)}</strong><small>{t("bgm.taskReward", { count: task.limit, points: task.points })}</small></div><button disabled={!activity.active || task.count >= task.limit} onClick={() => onTask(task.kind)} type="button">{task.count >= task.limit ? t("bgm.done") : `${task.count} / ${task.limit}`}<BgmIcon name="arrow_forward" /></button></article>)}</section>}
      {next ? <aside className="bgm-next"><BgmIcon name="auto_awesome" /><div><strong>{t("bgm.nextTrack", { title: next.title })}</strong><span>{t("bgm.remaining", { days: Math.max(0, next.days - data.active_days), points: Math.max(0, next.points - data.points) })}</span></div></aside> : <p className="bgm-complete">{t("bgm.complete")}</p>}
    </>}
    {error ? <p className="bgm-feedback" role="alert">{error}<button onClick={() => setError("")} type="button">{t("common.close")}</button></p> : null}
    <details className="bgm-rules"><summary>{t("bgm.rules")}</summary><ol>{([1, 2, 3, 4] as const).map((number) => <li key={number}>{t(`bgm.rule${number}`)}</li>)}</ol></details>
  </div>;
}

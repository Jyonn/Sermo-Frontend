import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n, type TranslationKey } from "../lib/language";
import { copyText } from "../lib/presentation";
import { buildSpaceHrefForCurrentHost, getDetectedSpaceSlug } from "../lib/spaceEntry";
import { showToast } from "../lib/toast";
import { duelSeconds, validDuelDigits, type DuelInvitation, type DuelLobby, type DuelMatch } from "../lib/numberDuel";
import type { ActivityCampaignDTO, ChatDTO } from "../types";
import { BottomSheet } from "./BottomSheet";
import { ConfirmDialog } from "./ConfirmDialog";
import "./NumberDuelActivity.css";

export function NumberDuelActivity({ activity }: { activity: ActivityCampaignDTO }) {
  const { t: translate, locale } = useI18n();
  const t = (key: TranslationKey | `duel.${string}`, values?: Record<string, string | number | undefined>) => translate(key as TranslationKey, values);
  const { session } = useAuth();
  const [lobby, setLobby] = useState<DuelLobby | null>(null);
  const [stake, setStake] = useState(10);
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("room")?.toUpperCase().slice(0, 8) ?? "");
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now() / 1000);
  const [invitation, setInvitation] = useState<DuelInvitation | null>(null);
  const [sheet, setSheet] = useState<"rules" | "share" | null>(null);
  const [leave, setLeave] = useState(false);
  const [chats, setChats] = useState<ChatDTO[] | null>(null);
  const selected = useRef<string>();
  const generation = useRef(0);
  const alive = useRef(true);
  const clockOffset = useRef(0);
  const mutation = useRef(false);
  const reads = useRef(0);
  const match = lobby?.match ?? null;

  function failure(cause: unknown) {
    const name = cause instanceof ApiError ? cause.identifier.split(/[@.]/).pop()?.toLowerCase() : "";
    const known = ["invalid", "closed", "forbidden", "account", "busy", "locked", "tier"];
    return t(known.includes(name ?? "") ? `duel.error.${name}` : "duel.error.network");
  }
  async function refresh(signal?: AbortSignal) {
    const version = generation.current;
    const read = ++reads.current;
    try {
      const data = await api.getNumberDuel(activity.key, selected.current, signal);
      if (!alive.current || signal?.aborted || version !== generation.current || read !== reads.current) return;
      if (!selected.current && data.match) selected.current = data.match.id;
      clockOffset.current = data.server_time - Date.now() / 1000;
      setLobby(data); setOffline(false);
    } catch (cause) {
      if (!alive.current || signal?.aborted || version !== generation.current || read !== reads.current) return;
      setOffline(true);
      if (!lobby) setError(failure(cause));
    }
  }
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void refresh(controller.signal);
    const poll = window.setInterval(() => { if (!document.hidden && !mutation.current) void refresh(controller.signal); }, 1800);
    const tick = window.setInterval(() => setNow(Date.now() / 1000 + clockOffset.current), 250);
    const resume = () => { if (!document.hidden && !mutation.current) void refresh(controller.signal); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => { alive.current = false; generation.current++; controller.abort(); clearInterval(poll); clearInterval(tick); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); };
  }, [activity.key]);
  useEffect(() => { setDigits(""); }, [match?.id, match?.status, match?.round]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (mutation.current) return;
    mutation.current = true; generation.current++; setBusy(true); setError("");
    try {
      const data = await api.numberDuelAction(activity.key, { action, ...(match ? { id: match.id } : {}), ...extra });
      if (!alive.current) return;
      selected.current = data.id;
      setLobby((current) => current ? { ...current, match: data } : current);
      setInvitation(null); setLeave(false);
      await refresh();
    } catch (cause) { if (alive.current) setError(failure(cause)); }
    finally { mutation.current = false; if (alive.current) setBusy(false); }
  }
  async function preview() {
    if (busy) return;
    setBusy(true); setError("");
    try { const value = await api.previewNumberDuel(activity.key, code.trim()); if (alive.current) setInvitation(value); }
    catch (cause) { if (alive.current) setError(failure(cause)); }
    finally { if (alive.current) setBusy(false); }
  }
  function invitationUrl() {
    const path = `/app/square/activities/${activity.key}`;
    const search = match?.status === "waiting" ? `?room=${match.code}` : "";
    const slug = getDetectedSpaceSlug();
    return slug ? buildSpaceHrefForCurrentHost(slug, path, search) : new URL(path + search, location.origin).href;
  }
  async function copyInvite() {
    try { await copyText(invitationUrl()); showToast(t("duel.copied"), "success"); }
    catch { showToast(t("duel.error.network"), "error"); }
  }
  async function openShare() {
    setSheet("share"); setChats(null);
    try { const values = await api.getChats(); if (alive.current) setChats(values.filter((item) => item.purpose !== "submission")); }
    catch { if (alive.current) { setChats([]); setError(t("duel.error.network")); } }
  }
  async function share(chat: ChatDTO) {
    if (busy) return;
    setBusy(true);
    try {
      const text = t("duel.inviteMessage", { code: match?.code, points: match?.stake, url: invitationUrl() });
      await api.sendMessage(chat.chat_id, 0, text, undefined, crypto.randomUUID());
      if (alive.current) { setSheet(null); showToast(t("duel.sent"), "success"); }
    } catch { if (alive.current) setError(t("duel.error.network")); }
    finally { if (alive.current) setBusy(false); }
  }
  const seconds = match ? duelSeconds(match.deadline, now) : 0;
  const myGuess = match?.guesses.find((row) => row.mine && row.round === match.round);
  const done = match?.status === "finished";
  const date = (value: number) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(value * 1000);
  const secretStage = match?.status === "secrets";
  const canEnter = Boolean(lobby?.eligible && lobby.active);
  function showMatch(value: string | undefined) {
    generation.current++; selected.current = value;
    setLobby((current) => current ? { ...current, match: null } : current);
    setError(""); void refresh();
  }
  return <div className="number-duel">
    <div className="duel-topline"><span>{t("duel.week")}</span><span>{lobby?.ends_at ? t("duel.until", { date: date(lobby.ends_at) }) : ""}</span><button type="button" onClick={() => setSheet("rules")}>{t("duel.rules")}<span className="material-symbols-outlined" aria-hidden="true">info</span></button></div>
    {offline ? <p className="duel-notice" role="status">{t("duel.reconnecting")}<button type="button" onClick={() => void refresh()}>{t("duel.retry")}</button></p> : null}
    {error ? <p className="duel-error" role="alert">{error}<button aria-label={t("common.close")} type="button" onClick={() => setError("")}>×</button></p> : null}
    {!lobby ? <p className="duel-loading" role="status">{t("common.loading")}</p> : !match ? <>
      <section className="duel-hero"><div><small>{t("duel.eyebrow")}</small><h2>{t("duel.headline")}</h2><p>{t("duel.subtitle")}</p></div><img src="/activity/number-duel/digits.svg" alt="" /></section>
      <div className="duel-daily"><span>{t("duel.today")} <strong>{lobby.daily.matches}<small> / {lobby.daily.match_limit}</small></strong></span><span>{t("duel.earned")} <strong>+{lobby.daily.points}</strong></span><span className="duel-first">{t(lobby.daily.matches === 0 ? "duel.firstDouble" : "duel.noLoss")}</span></div>
      {!lobby.eligible ? <p className="duel-notice">{t("duel.verify")}</p> : !lobby.active ? <p className="duel-notice">{t("duel.ended")}</p> : lobby.daily.matches >= lobby.daily.match_limit ? <p className="duel-notice">{t("duel.practice")}</p> : null}
      <section className="duel-entry-grid">
        <div className="duel-create"><h3>{t("duel.createTitle")}</h3><p>{t("duel.tierHint")}</p><div className="duel-tiers">{[10, 20, 50].map((value, index) => <button aria-pressed={stake === value} disabled={busy || !canEnter || !lobby.tiers.includes(value)} type="button" key={value} onClick={() => setStake(value)}><strong>{value}</strong><small>{t("duel.tierLevel", { level: [1, 8, 14][index] })}</small></button>)}</div><button className="button" disabled={busy || !canEnter} onClick={() => void act("create", { stake })} type="button">{t("duel.create")}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button></div>
        <form className="duel-join" onSubmit={(event) => { event.preventDefault(); void preview(); }}><h3>{t("duel.joinTitle")}</h3><label htmlFor="duel-room-code">{t("duel.roomCode")}</label><input autoCapitalize="characters" autoComplete="off" id="duel-room-code" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))} placeholder="ABCDEFGH" /><button className="ghost-button" disabled={busy || !canEnter || code.length !== 8} type="submit">{t("duel.join")}</button></form>
      </section>
      <div className="duel-record-grid"><section><h3>{t("duel.history")}</h3>{lobby.history.length ? <div className="duel-records">{lobby.history.map((row) => <button key={row.id} type="button" onClick={() => showMatch(row.id)}><span>{row.opponent || t("duel.waitingPeer")}<small>{date(row.finished_at)}</small></span><b>{t(row.reason === "normal" ? `duel.outcome.${row.outcome}` : "duel.cancelled")}</b><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>)}</div> : <p className="duel-empty">{t("duel.noHistory")}</p>}</section><section><h3>{t("duel.leaders")}</h3>{lobby.leaders.length ? <ol className="duel-leaders">{lobby.leaders.map((row) => <li key={row.user_id}><span>{row.name}</span><b>+{row.points}</b></li>)}</ol> : <p className="duel-empty">{t("duel.noLeaders")}</p>}</section></div>
    </> : <>
      <header className="duel-match-heading"><div><small>{t("duel.roomCode")} · {match.code}</small><h2>{done ? t(match.reason === "normal" ? `duel.outcome.${match.outcome}` : "duel.cancelled") : t(match.status === "waiting" ? "duel.waiting" : secretStage ? "duel.setSecret" : "duel.round", { round: match.round, total: lobby.max_rounds })}</h2></div>{!done ? <time className={`duel-timer${seconds <= 5 ? " is-urgent" : ""}`} aria-label={t("duel.seconds", { count: seconds })}>{seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : `${seconds}s`}</time> : <strong className="duel-result-points">+{match.points}</strong>}</header>
      <div className="duel-versus"><span>{session?.user.name ?? t("duel.you")}<small>{match.own_secret ? t("duel.secretLocked") : t("duel.you")}</small></span><b>VS</b><span>{match.opponent?.name ?? t("duel.waitingPeer")}<small>{t("duel.stake", { points: match.stake })}</small></span></div>
      {match.status === "waiting" ? <section className="duel-waiting"><div className="duel-invite-code">{match.code}</div><p>{t("duel.inviteHint")}</p><button className="button" type="button" onClick={() => void openShare()}>{t("duel.invite")}</button><button className="ghost-button" type="button" onClick={() => void copyInvite()}>{t("duel.copyLink")}</button></section> : done ? <section className="duel-result"><p>{t(match.reason === "normal" ? match.reward_reason === "pair" ? "duel.samePeer" : match.reward_reason === "quota" ? "duel.practice" : "duel.resultHint" : `duel.finish.${["ended", "forfeit", "inactive", "timeout"].includes(match.reason) ? match.reason : "timeout"}`)}</p><div className="duel-secrets"><span>{t("duel.yourSecret")}<strong>{match.own_secret ?? "—"}</strong></span><span>{t("duel.theirSecret")}<strong>{match.opponent_secret ?? "—"}</strong></span></div><button className="button" type="button" onClick={() => showMatch(undefined)}>{t("duel.backLobby")}</button></section> : <section className="duel-play-area">
        {secretStage && match.own_secret ? <div className="duel-round-wait"><span className="material-symbols-outlined" aria-hidden="true">lock</span><strong>{match.own_secret}</strong><p>{t("duel.waitSecret")}</p></div> : !secretStage && myGuess ? <div className="duel-round-wait"><strong>{myGuess.value}</strong><span className="duel-feedback"><b>{myGuess.exact}A</b><b>{myGuess.misplaced}B</b></span><p>{t("duel.waitGuess")}</p></div> : <form onSubmit={(event) => { event.preventDefault(); void act(secretStage ? "secret" : "guess", { value: digits, round: match.round }); }}>
          <label htmlFor="duel-digits">{t(secretStage ? "duel.secretHint" : "duel.guessHint")}</label><input autoFocus id="duel-digits" className="duel-digit-input" autoComplete="off" inputMode="numeric" maxLength={4} value={digits} onChange={(event) => setDigits(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="0 1 2 3" aria-describedby="duel-digit-help" /><small id="duel-digit-help">{t(digits.length === 4 && !validDuelDigits(digits) ? "duel.error.invalid" : "duel.digitHint")}</small><button className="button" disabled={busy || !validDuelDigits(digits) || seconds === 0} type="submit">{t(secretStage ? "duel.lockSecret" : "duel.submit")}</button>
        </form>}
        {!secretStage ? <p className="duel-round-note">{t("duel.roundHint")}</p> : null}
      </section>}
      {(match.status === "playing" || done) && match.guesses.length ? <section className="duel-round-history"><h3>{t("duel.roundHistory")}</h3><div className="duel-history-label"><span>#</span><span>{t("duel.you")}</span><span>{match.opponent?.name}</span></div>{Array.from({ length: done ? match.round : match.round - 1 }, (_, index) => index + 1).reverse().map((round) => <div className="duel-history-row" key={round}><small>{String(round).padStart(2, "0")}</small>{[true, false].map((mine) => { const row = match.guesses.find((item) => item.round === round && item.mine === mine); return <span key={String(mine)}><strong>{row?.value ?? "—"}</strong>{row ? <small><b>{row.exact}A</b> {row.misplaced}B</small> : <small>{t("duel.skipped")}</small>}</span>; })}</div>)}<p className="duel-ab-legend">{t("duel.feedbackHint")}</p></section> : null}
      {!done ? <button className="duel-leave" disabled={busy} onClick={() => setLeave(true)} type="button">{t("duel.leave")}</button> : null}
    </>}
    <ConfirmDialog open={Boolean(invitation)} title={t("duel.acceptTitle", { name: invitation?.name })} description={t("duel.acceptHint", { points: invitation?.stake })} busy={busy} onClose={() => setInvitation(null)} onConfirm={() => void act("join", { code: invitation?.code, stake: invitation?.stake })} confirmLabel={t("duel.accept")} />
    <ConfirmDialog open={leave} title={t("duel.leave")} description={t("duel.leaveHint")} busy={busy} onClose={() => setLeave(false)} onConfirm={() => void act("leave")} danger />
    <BottomSheet open={sheet === "rules"} onClose={() => setSheet(null)} title={t("duel.rules")}><ol className="duel-rule-list">{[1, 2, 3, 4, 5, 6].map((index) => <li key={index}>{t(`duel.rule${index}`)}</li>)}</ol></BottomSheet>
    <BottomSheet open={sheet === "share"} onClose={() => setSheet(null)} title={t("duel.invite")}><div className="duel-share"><button type="button" className="ghost-button" onClick={() => void copyInvite()}>{t("duel.copyLink")}</button>{navigator.share ? <button type="button" className="ghost-button" onClick={() => { void navigator.share({ title: t("duel.title"), text: t("duel.inviteHint"), url: invitationUrl() }).catch(() => undefined); }}>{t("duel.systemShare")}</button> : null}<h3>{t("duel.shareChat")}</h3>{chats === null ? <p>{t("common.loading")}</p> : chats.length ? chats.map((chat) => <button className="duel-chat-target" type="button" key={chat.chat_id} disabled={busy} onClick={() => void share(chat)}><span className="material-symbols-outlined" aria-hidden="true">{chat.group ? "group" : "chat_bubble"}</span><strong>{chat.title || chat.members.find((member) => member.user_id !== session?.user.user_id)?.name}</strong><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>) : <p>{t("duel.noChats")}</p>}</div></BottomSheet>
  </div>;
}

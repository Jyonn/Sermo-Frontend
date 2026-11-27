import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {ActivityLoadingState} from './ActivityLoadingState';
import {ActivityTitle} from './ActivityCampaignCard';
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n, type TranslationKey } from "../lib/language";
import { copyText, formatRelativeTime } from "../lib/presentation";
import { buildSpaceHrefForCurrentHost, getDetectedSpaceSlug } from "../lib/spaceEntry";
import { showToast } from "../lib/toast";
import { duelSeconds, validDuelDigits, type DuelLobby, type DuelMatch } from "../lib/numberDuel";
import type { ActivityCampaignDTO, ChatDTO, UserGrowthDTO } from "../types";
import { BottomSheet } from "./BottomSheet";
import { ConfirmDialog } from "./ConfirmDialog";
import { ChatTargetPicker } from "./ChatTargetPicker";
import { NumberDuelCard } from "./NumberDuelCard";
import { UserAvatar } from "./UserAvatar";
import { signedGrowthPoints } from "../lib/growthPoints";
import { DuelGrowthProgress } from "./DuelGrowthProgress";
import "./NumberDuelActivity.css";
import "./NumberDuelDigits.css";

type DuelTranslate = (key: TranslationKey | `duel.${string}`, values?: Record<string, string | number | undefined>) => string;

function NumberDuelKeypad({digits, setDigits, disabled, secret, submit, t}: {
  digits: string;
  setDigits: (digits: string) => void;
  disabled: boolean;
  secret: boolean;
  submit: () => void;
  t: DuelTranslate;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <form className="duel-keypad-form" onSubmit={event => {
    event.preventDefault();
    if (!disabled && validDuelDigits(digits)) submit();
  }}>
    <label htmlFor="duel-digits">{t(secret ? 'duel.secretHint' : 'duel.guessHint')}</label>
    <div className="duel-digit-display">
      <input ref={input} id="duel-digits" className="duel-digit-input" autoComplete="off" inputMode="none" disabled={disabled}
        value={digits} onChange={event => setDigits(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))} />
      {Array.from({length: 4}, (_, index) => <span key={index} aria-hidden="true" className={index === digits.length ? 'is-current' : ''}>
        {digits[index] ?? '·'}
      </span>)}
    </div>
    <div className="duel-keypad" role="group" aria-label={t('duel.keypad')}>
      {'1234567890'.split('').map(digit => <button key={digit} type="button" disabled={disabled || digits.length === 4}
        onClick={() => {
          setDigits(digits + digit);
          if (window.matchMedia('(pointer: fine)').matches) input.current?.focus({preventScroll: true});
        }}>{digit}</button>)}
    </div>
    <div className="duel-keypad-actions">
      <button className="ghost-button" type="button" aria-label={t('duel.eraseDigit')} disabled={disabled || !digits}
        onClick={() => setDigits(digits.slice(0, -1))}><span className="material-symbols-outlined" aria-hidden="true">backspace</span></button>
      <button className="button" disabled={disabled || !validDuelDigits(digits)} type="submit">
        {t(secret ? 'duel.lockSecret' : 'duel.submit')}
      </button>
    </div>
  </form>;
}

function DuelRoundHistory({match, t}: {match: DuelMatch; t: DuelTranslate}) {
  const completedRounds = match.status === 'finished' ? match.round : match.round - 1;
  return <section className="duel-round-history" aria-label={t('duel.roundHistory')}>
    <h3>{t('duel.roundHistory')}</h3>
    {completedRounds <= 0 ? <p className="duel-empty">{t('duel.noRounds')}</p> : <>
      <div className="duel-history-label"><span>#</span><span>{t('duel.you')}</span><span>{match.opponent?.name}</span></div>
      <div className="duel-history-scroll" tabIndex={0}>
        {Array.from({length: completedRounds}, (_, index) => completedRounds - index).map(round => <div className="duel-history-row" key={round}>
          <small>{String(round).padStart(2, '0')}</small>
          {[true, false].map(mine => {
            const guess = match.guesses.find(row => row.round === round && row.mine === mine);
            return <span key={String(mine)}><strong>{guess?.value ?? '—'}</strong>
              <small>{guess?.value ? t('duel.exactFeedback', {count: guess.exact ?? '—'}) : t('duel.skipped')}</small></span>;
          })}
        </div>)}
      </div>
      <p className="duel-feedback-legend">{t('duel.feedbackHint')}</p>
    </>}
  </section>;
}

export function NumberDuelActivity({ activity, roomCode, shareRequest = 0 }: { activity: ActivityCampaignDTO; roomCode?: string; shareRequest?: number }) {
  const navigate = useNavigate();
  const { t: translate, locale } = useI18n();
  const t: DuelTranslate = (key, values) => translate(key as TranslationKey, values);
  const { session, patchSessionUser } = useAuth();
  const [lobby, setLobby] = useState<DuelLobby | null>(null);
  const [growth, setGrowth] = useState<UserGrowthDTO | null>(null);
  const [stake, setStake] = useState(10);
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now() / 1000);
  const [sheet, setSheet] = useState<"rules" | "share" | "history" | "leaders" | null>(null);
  const [leave, setLeave] = useState(false);
  const [chats, setChats] = useState<ChatDTO[] | null>(null);
  const [selectedChats, setSelectedChats] = useState<number[]>([]);
  const shareIds = useRef(new Map<number, string>());
  const selected = useRef<string>();
  const generation = useRef(0);
  const alive = useRef(true);
  const clockOffset = useRef(0);
  const mutation = useRef(false);
  const reads = useRef(0);
  const match = lobby?.match ?? null;

  function failure(cause: unknown) {
    const name = cause instanceof ApiError ? cause.identifier.split(/[@.]/).pop()?.toLowerCase() : "";
    const known = ["invalid", "closed", "forbidden", "account", "busy", "locked", "tier", "funds"];
    return t(known.includes(name ?? "") ? `duel.error.${name}` : "duel.error.network");
  }
  async function refresh(signal?: AbortSignal) {
    const version = generation.current;
    const read = ++reads.current;
    try {
      const data = await api.getNumberDuel(activity.key, selected.current, signal, roomCode);
      if (!alive.current || signal?.aborted || version !== generation.current || read !== reads.current) return;
      if (!selected.current && data.match) selected.current = data.match.id;
      clockOffset.current = data.server_time - Date.now() / 1000;
      setNow(data.server_time);
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
  }, [activity.key, roomCode]);
  useEffect(() => { const legacy = new URLSearchParams(location.search).get("room"); if (!roomCode && legacy && /^[A-Z2-9]{8}$/.test(legacy)) navigate(`/app/number-duel/${legacy}`, { replace: true }); }, [roomCode, navigate]);
  useEffect(() => { if (shareRequest) void openShare(); }, [shareRequest]);
  useEffect(() => { setDigits(""); }, [match?.id, match?.status, match?.round]);
  useEffect(() => { setStake(match?.own_tier ?? 10); }, [match?.id, match?.own_tier]);
  const settled = match?.status === "finished";
  useEffect(() => {
    const controller = new AbortController();
    void api.getGrowth(controller.signal).then((data) => {
      if (!controller.signal.aborted) setGrowth(data);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [activity.key, match?.id, match?.funded, settled]);
  useEffect(() => {
    if (!match?.funded) return;
    const controller = new AbortController();
    void api.getUserMe(controller.signal).then(patchSessionUser).catch(() => undefined);
    return () => controller.abort();
  }, [match?.id, match?.funded, settled, patchSessionUser]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (mutation.current) return;
    mutation.current = true; generation.current++; setBusy(true); setError("");
    try {
      const data = await api.numberDuelAction(activity.key, { action, room_flow: 2, ...(match ? { id: match.id } : {}), ...extra });
      if (!alive.current) return;
      selected.current = data.id;
      setNow(Date.now() / 1000 + clockOffset.current);
      setLobby((current) => current ? { ...current, match: data } : current);
      setLeave(false); setSheet(null);
      if (action === "create") { navigate(`/app/number-duel/${data.code}`); return; }
      await refresh();
    } catch (cause) { if (alive.current) setError(failure(cause)); }
    finally { mutation.current = false; if (alive.current) setBusy(false); }
  }
  function invitationUrl() {
    const path = roomCode ? `/app/number-duel/${roomCode}` : `/app/square/activities/${activity.key}`;
    const search = "";
    const slug = getDetectedSpaceSlug();
    return slug ? buildSpaceHrefForCurrentHost(slug, path, search) : new URL(path + search, location.origin).href;
  }
  async function copyInvite() {
    try {
      if (await copyText(invitationUrl())) showToast(t("duel.copied"), "success");
      else showToast(t("duel.error.network"), "error");
    }
    catch { showToast(t("duel.error.network"), "error"); }
  }
  async function openShare() {
    setSheet("share"); setChats(null);
    try { const values = await api.getChats(); if (alive.current) setChats(values.filter((item) => item.purpose !== "submission")); }
    catch { if (alive.current) { setChats([]); setError(t("duel.error.network")); showToast(t("duel.error.network"), "error"); } }
  }
  async function share(ids: number[]) {
    if (busy) return;
    setBusy(true);
    try {
      const text = JSON.stringify({ kind: "number_duel_room", activity_key: activity.key, room_code: roomCode, title: t("duel.title") });
      for (const id of ids) {
        if (!shareIds.current.has(id)) shareIds.current.set(id, crypto.randomUUID());
        await api.sendMessage(id, 11, text, undefined, shareIds.current.get(id));
        setSelectedChats((current) => current.filter((value) => value !== id));
      }
      shareIds.current.clear();
      if (alive.current) { setSheet(null); showToast(t("duel.sent"), "success"); }
    } catch { if (alive.current) { setError(t("duel.error.network")); showToast(t("duel.error.network"), "error"); } }
    finally { if (alive.current) setBusy(false); }
  }
  const remaining = match ? duelSeconds(match.deadline, now) : 0;
  const seconds = match?.status === 'playing' && lobby ? Math.min(remaining, lobby.round_seconds) : remaining;
  const myGuess = match?.guesses.find((row) => row.mine && row.round === match.round);
  const done = match?.status === "finished";
  const date = (value: number) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(value * 1000);
  const secretStage = match?.status === "secrets";
  const canEnter = Boolean(lobby?.eligible && lobby.active);
  function showMatch(value: string | undefined) {
    setSheet(null); navigate(value ? `/app/number-duel/${value}` : `/app/menu?panel=activities&activity=${activity.key}`);
  }
  const opponentSubmitted = match?.guesses.some(row => !row.mine && row.round === match.round);
  const stageTitle = match && (done ? t(match.reason === 'normal' ? `duel.outcome.${match.outcome}` : 'duel.cancelled')
    : t(match.status === 'waiting' ? 'duel.waiting' : match.status === 'choosing' ? 'duel.chooseTier'
      : secretStage ? 'duel.setSecret' : 'duel.round', {round: match.round, total: lobby?.max_rounds}));
  const yourSummary = secretStage ? t(match?.own_secret ? 'duel.secretLocked' : 'duel.thinking')
    : match?.status === 'playing' ? t(myGuess ? 'duel.submitted' : 'duel.thinking')
    : match?.own_tier ? t('duel.stake', {points:match.own_tier}) : t('duel.you');
  const peerSummary = secretStage ? t(match?.opponent_locked ? 'duel.secretLocked' : 'duel.thinking')
    : match?.status === 'playing' ? t(opponentSubmitted ? 'duel.submitted' : 'duel.thinking')
    : match?.opponent_tier ? t('duel.stake', {points:match.opponent_tier}) : t('duel.tierPending');

  return <div className={`number-duel${match && roomCode ? ` is-${match.status}` : ''}`}>
    <div className="duel-topline">
      {!roomCode && <time>{lobby?.ends_at ? `${date(activity.starts_at)} — ${date(lobby.ends_at)}` : t('duel.week')}</time>}
      <nav aria-label={t('duel.sections')}>
        <button type="button" onClick={() => setSheet('rules')}>{t('duel.rulesShort')}</button>
        <button type="button" onClick={() => setSheet('history')}>{t('duel.historyShort')}</button>
        <button type="button" onClick={() => setSheet('leaders')}>{t('duel.leadersShort')}</button>
      </nav>
    </div>
    {offline && <p className="duel-notice" role="status">{t('duel.reconnecting')}<button type="button" onClick={() => void refresh()}>{t('duel.retry')}</button></p>}
    {error && !sheet && <p className="duel-error" role="alert">{error}<button aria-label={t('common.close')} type="button" onClick={() => setError('')}>×</button></p>}

    {!lobby ? <ActivityLoadingState compact/> : !roomCode ? <div className="duel-lobby-layout">
      <section className="duel-hero">
        <div><ActivityTitle activity={activity} title={activity.title}/><p>{t('duel.subtitle')}</p></div>
        <img src="https://api.sermo.jyonn.space/resources/assets/77/display/17f9eb04e50c3db3663b77088c8bf4911e85959ea910c24cff77d2b5ff440f9e" alt="" />
      </section>
      <section className="duel-lobby-summary">
        <div className="duel-daily">
          <span>{t('duel.today')} <strong>{lobby.daily.matches}<small> / {lobby.daily.match_limit}</small></strong></span>
          <span>{t('duel.earned')} <strong>{signedGrowthPoints(lobby.daily.points)}</strong></span>
        </div>
        <DuelGrowthProgress growth={growth} />
        {!lobby.eligible ? <p className="duel-notice">{t('duel.verify')}</p> : !lobby.active ? <p className="duel-notice">{t('duel.ended')}</p>
          : lobby.daily.matches >= lobby.daily.match_limit ? <p className="duel-notice">{t('duel.practice')}</p> : null}
        <div className="duel-primary-actions">
          <button className="button" disabled={busy || !canEnter} type="button" onClick={() => match ? showMatch(match.code) : void act('create')}>
            {t(match ? 'duel.resumeRoom' : 'duel.createTitle')}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </button>
          <p className="duel-join-invite-hint">{t('duel.joinViaInvite')}</p>
        </div>
      </section>
    </div> : !match ? <section className="duel-room-entry">
      <NumberDuelCard room={lobby.room} />
      <p>{t(!lobby.eligible ? 'duel.verify' : !lobby.active ? 'duel.ended' : 'duel.roomEntryHint')}</p>
      {lobby.current_code ? <button type="button" className="button" onClick={() => showMatch(lobby.current_code!)}>{t('duel.resumeRoom')}</button>
        : <button type="button" className="button" disabled={busy || !canEnter || lobby.room?.status !== 'waiting'} onClick={() => void act('join', {code:roomCode})}>
          {t(lobby.room?.status === 'waiting' ? 'duel.enterRoom' : lobby.room?.status === 'finished' ? 'duel.roomEnded' : 'duel.roomStarted')}
        </button>}
    </section> : <>
      <div className="duel-table-board">
        <div className="duel-versus">
          <div className="duel-seat">
            <UserAvatar className="duel-player-avatar" name={session?.user.name ?? t('duel.you')} uri={session?.user.avatar_uri} cacheKey={session?.user.avatar_cache_key} />
            <div><strong>{t('duel.you')}</strong><small>{yourSummary}</small></div>
          </div>
          <header className="duel-match-heading">
            <h2>{stageTitle}</h2>
            {done ? <strong className={`duel-result-points${match.points < 0 ? ' is-loss' : ''}`}>{signedGrowthPoints(match.points)}</strong>
              : <time className={`duel-timer${seconds <= 5 ? ' is-urgent' : ''}`} aria-label={t('duel.seconds', {count:seconds})}>
                {seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}` : `${seconds}s`}
              </time>}
          </header>
          <div className="duel-seat is-peer">
            <UserAvatar className="duel-player-avatar" name={match.opponent?.name ?? '?'} uri={match.opponent?.avatar_uri} cacheKey={match.opponent?.avatar_cache_key} />
            <div><strong>{match.opponent?.name ?? t('duel.waitingPeer')}</strong><small>{peerSummary}</small></div>
          </div>
        </div>
      </div>
      <div className={`duel-match-grid${match.status === 'playing' || (done && match.guesses.length) ? ' has-rounds' : ''}`}>
        {match.status === 'waiting' ? <section className="duel-waiting">
          <p>{t('duel.inviteHint')}</p>
          <div className="duel-waiting-actions">
            <button className="button" type="button" onClick={() => void openShare()}>{t('duel.invite')}</button>
            <button className="ghost-button" type="button" onClick={() => void copyInvite()}>{t('duel.copyLink')}</button>
          </div>
        </section> : match.status === 'choosing' ? <section className="duel-tier-agreement">
          <div className="duel-tiers">
            {[10, 20, 50].map((value, index) => <button key={value} type="button" aria-pressed={stake === value}
              disabled={busy || !match.tiers.includes(value)} onClick={() => setStake(value)}>
              <strong>{value}</strong><small>{t('duel.tierLevel', {level:[1, 8, 14][index]})}</small>
            </button>)}
          </div>
          <p className="duel-cost-preview">{t('duel.entryConfirm', {points:stake, balance:match.balance})}</p>
          <button type="button" className="button" disabled={busy || !match.tiers.includes(stake) || match.own_tier === stake || seconds === 0}
            onClick={() => void act('tier', {stake})}>{t(match.own_tier === stake ? 'duel.waitTier' : 'duel.confirmTier', {points:stake})}</button>
        </section> : done ? <section className="duel-result">
          <p>{t(match.practice_reason || !match.funded ? 'duel.practiceMatch' : match.reason === 'normal' ? 'duel.resultHint'
            : `duel.finish.${['ended', 'forfeit', 'inactive', 'timeout'].includes(match.reason) ? match.reason : 'timeout'}`)}</p>
          <dl className="duel-entry-ledger">
            <div><dt>{t('duel.entryCost')}</dt><dd>{signedGrowthPoints(match.funded ? -match.stake : 0)}</dd></div>
            <div><dt>{t('duel.returned')}</dt><dd>{signedGrowthPoints(match.returned)}</dd></div>
          </dl>
          <div className="duel-secrets">
            <span>{t('duel.yourSecret')}<strong>{match.own_secret ?? '—'}</strong></span>
            <span>{t('duel.theirSecret')}<strong>{match.opponent_secret ?? '—'}</strong></span>
          </div>
          <button className="button" type="button" onClick={() => showMatch(undefined)}>{t('duel.backLobby')}</button>
        </section> : <section className="duel-play-area">
          {secretStage && match.own_secret ? <div className="duel-round-wait">
            <span className="material-symbols-outlined" aria-hidden="true">lock</span><strong>{match.own_secret}</strong><p>{t('duel.waitSecret')}</p>
          </div> : !secretStage && myGuess ? <div className="duel-round-wait">
            <strong>{myGuess.value}</strong>
            {myGuess.exact !== null && <span className="duel-current-feedback">{t('duel.exactFeedback', {count:myGuess.exact})}</span>}
            <p>{t('duel.waitGuess')}</p>
          </div> : <NumberDuelKeypad digits={digits} setDigits={setDigits} disabled={busy || seconds === 0} secret={secretStage} t={t}
            submit={() => void act(secretStage ? 'secret' : 'guess', {value:digits, round:match.round})} />}
        </section>}
        {(match.status === 'playing' || (done && match.guesses.length > 0)) && <DuelRoundHistory match={match} t={t} />}
      </div>
      {!done && <footer className="duel-table-footer">
        {(match.funded || match.practice_reason) && <span>{t(match.funded ? 'duel.stake' : 'duel.practiceMatch', {points:match.stake})}</span>}
        <button className="duel-leave" disabled={busy} onClick={() => setLeave(true)} type="button">{t('duel.leave')}</button>
      </footer>}
    </>}
    <ConfirmDialog open={leave} className="game-table-panel" title={t("duel.leave")} description={t("duel.leaveHint")} busy={busy} onClose={() => setLeave(false)} onConfirm={() => void act("leave")} danger />
    <BottomSheet open={sheet === "history" || sheet === "leaders"} className="game-table-panel" onClose={() => setSheet(null)} title={t(sheet === "history" ? "duel.history" : "duel.leaders")}>
      <div className="duel-panel">
        {error ? <p className="duel-error" role="alert">{error}</p> : null}
        {sheet === "history" ? lobby?.history.length ? <div className="duel-records">{lobby.history.map((row) => <button key={row.id} type="button" onClick={() => showMatch(row.code)}><span>{row.opponent || t("duel.waitingPeer")}<small>{date(row.finished_at)}</small></span><b>{t(row.reason === "normal" ? `duel.outcome.${row.outcome}` : "duel.cancelled")}</b><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>)}</div> : <p className="duel-empty">{t("duel.noHistory")}</p> : null}
        {sheet === "leaders" ? lobby?.leaders.length ? <ol className="duel-leaders">{lobby.leaders.map((row) => <li key={row.user_id}><span>{row.name}</span><b>+{row.points}</b></li>)}</ol> : <p className="duel-empty">{t("duel.noLeaders")}</p> : null}
      </div>
    </BottomSheet>
    <BottomSheet open={sheet === "rules"} className="game-table-panel" onClose={() => setSheet(null)} title={t("duel.rules")}><ol className="duel-rule-list">{[1, 2, 3, 4, 5, 6].map((index) => <li key={index}>{t(`duel.rule${index}`)}</li>)}</ol></BottomSheet>
    <ChatTargetPicker open={sheet === "share"} title={t("duel.shareChat")} emptyTitle={t("duel.noChats")} loading={chats === null} busy={busy} multiple selectedIds={selectedChats} onSelectionChange={setSelectedChats} onClose={() => { if (!busy) setSheet(null); }} onSubmit={share} beforeList={<div className="duel-share"><NumberDuelCard room={lobby?.room} /><button type="button" className="ghost-button" onClick={() => void copyInvite()}>{t("duel.copyLink")}</button>{navigator.share ? <button type="button" className="ghost-button" onClick={() => { void navigator.share({ title: t("duel.title"), url: invitationUrl() }).catch(() => undefined); }}>{t("duel.systemShare")}</button> : null}</div>} targets={[...(chats ?? [])].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.last_chat_at - a.last_chat_at).map((chat) => { const peer = chat.members.find((member) => member.user_id !== session?.user.user_id); return { id: chat.chat_id, title: chat.title || peer?.name || t("chat.group"), preview: chat.last_message?.content || t(chat.group ? "chat.group" : "square.directChat"), time: formatRelativeTime(chat.last_message?.created_at ?? chat.last_chat_at), pinned: Boolean(chat.pinned), avatarUri: peer?.avatar_uri, avatarCacheKey: peer?.avatar_cache_key, avatarFrameStyle: peer?.avatar_frame_style, groupMembers: chat.group ? chat.members.map((member) => ({ name: member.name, uri: member.avatar_uri, cacheKey: member.avatar_cache_key })) : undefined }; })} />
  </div>;
}

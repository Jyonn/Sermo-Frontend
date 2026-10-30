import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { usePageActive } from "../lib/pageActivity";
import { agendaAvailability, agendaDay, agendaDayDistance, type AgendaEvent } from "../lib/chronelleAgenda";
import { profileAgenda } from "../lib/chronelleProfile";
import { CalendarAvailabilityBar, useCalendarClock } from "./CalendarAvailabilityBar";
import { ChronelleCalendar } from "./ChronelleCalendar";
import "./ChatCalendarAvailability.css";

export interface ChatCalendarData {
  scope: string;
  ownerId: number;
  events: AgendaEvent[] | null;
  error: boolean;
  known: boolean;
  now: Date;
}

// Loaded once by ChatsPage; mobile and desktop buttons share this resource.
export function useChatCalendarAvailability(peerId?: number): ChatCalendarData | null {
  const { session } = useAuth();
  const activePage = usePageActive();
  const now = useCalendarClock(Boolean(peerId));
  const dayKey = agendaDay(now).getTime();
  const minute = Math.floor(now.getTime() / 60000);
  const scope = `${session?.user.space_id}:${session?.user.user_id}:${peerId}:${dayKey}`;
  const [data, setData] = useState<Omit<ChatCalendarData, "now"> | null>(null);
  useEffect(() => {
    if (!session || !peerId || !activePage) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => controller.abort(), 12000);
    const start = new Date(dayKey);
    const params = new URLSearchParams({ start: start.toISOString(), end: agendaDay(start, 3).toISOString() });
    void api.chronelleProfile(peerId, params, controller.signal).then(profileAgenda).then((result) => {
      if (active && !controller.signal.aborted) setData(result.hidden ? null : { scope, ownerId: peerId, events: result.events, known: result.known, error: false });
    }).catch(() => {
      if (active) setData({ scope, ownerId: peerId, events: null, known: false, error: true });
    }).finally(() => window.clearTimeout(timer));
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [session?.accessToken, scope, peerId, dayKey, minute, activePage]);
  return data?.scope === scope ? { ...data, now } : null;
}

export function ChatCalendarAvailability({ data }: { data: ChatCalendarData }) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const summary = useMemo(() => data.known && data.events ? agendaAvailability(data.events, data.now) : null, [data.known, data.events, data.now]);
  const tone = summary?.tone ?? "unknown";
  const toneLabel = t(tone === "full" ? "chronelle.loadFull" : tone === "balanced" ? "chronelle.loadBalanced" : tone === "light" ? "chronelle.loadLight" : "chronelle.title");
  const status = summary ? t(summary.busy ? "chronelle.busyNow" : "chronelle.freeNow") : t(data.error ? "chronelle.loadFailed" : data.events ? "chronelle.limitedVisibility" : "chronelle.loading");
  const scope = `${data.scope}:${data.ownerId}`;
  const positioned = position !== null;
  useLayoutEffect(() => { setOpen(false); setExpanded(false); }, [scope]);
  useEffect(() => { if (open && positioned) (expanded ? backButton : closeButton).current?.focus({ preventScroll: true }); }, [open, expanded, positioned]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = button.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewport = window.visualViewport;
      const x = viewport?.offsetLeft ?? 0;
      const y = viewport?.offsetTop ?? 0;
      const width = Math.min(380, (viewport?.width ?? window.innerWidth) - 24);
      const bottom = y + (viewport?.height ?? window.innerHeight);
      const top = Math.max(y + 12, Math.min(anchor.bottom + 10, bottom - 140));
      const next = { width, top, left: Math.max(x + 12, Math.min(anchor.right - width, x + (viewport?.width ?? window.innerWidth) - width - 12)), maxHeight: Math.max(100, bottom - top - 12) };
      setPosition((previous) => previous && previous.left === next.left && previous.top === next.top && previous.width === next.width && previous.maxHeight === next.maxHeight ? previous : next);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent | FocusEvent) => {
      const target = event.target;
      if (target instanceof Node && !panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); button.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", keydown); };
  }, [open]);
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" });
    const delta = agendaDayDistance(data.now, date);
    return delta === 0 ? time : delta === 1 ? t("chronelle.tomorrowTime", { time }) : `${date.toLocaleDateString(language, { month: "short", day: "numeric" })} ${time}`;
  };
  let forecast = "";
  if (summary) {
    if (summary.busy && summary.busyUntil !== null) {
      forecast = summary.changeMinutes < 60 ? t("chronelle.freeIn", { minutes: summary.changeMinutes }) : t("chronelle.freeAfter", { time: formatTime(summary.busyUntil) });
      if (summary.freeMinutes !== null && summary.freeMinutes > 0) {
        const hours = Math.floor(summary.freeMinutes / 60);
        const minutes = summary.freeMinutes % 60;
        const duration = hours ? minutes ? t("chronelle.durationHoursMinutes", { hours, minutes }) : t("chronelle.durationHours", { hours }) : t("chronelle.durationMinutes", { minutes });
        forecast += ` · ${t("chronelle.freeWindow", { duration })}`;
      }
    } else if (summary.restOfDayFree) {
      forecast = t("chronelle.restDayFree");
      if (summary.nextBusy !== null) forecast += ` · ${t("chronelle.nextBusyAt", { time: formatTime(summary.nextBusy) })}`;
    } else {
      forecast = t("chronelle.busyAfter", { time: formatTime(summary.nextBusy!), minutes: summary.changeMinutes });
      if (summary.nextBusyUntil !== null) forecast += ` · ${t("chronelle.busyUntil", { time: formatTime(summary.nextBusyUntil) })}`;
    }
  }
  return <>
    <button ref={button} className={`chat-details-button chat-calendar-trigger tone-${tone}`} type="button" aria-label={`${t("chronelle.chatCalendar")} · ${toneLabel} · ${status}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { setExpanded(false); setPosition(null); setOpen(!open); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M7.5 3v4M16.5 3v4M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />{Array.from({ length: 6 }, (_, i) => <rect key={i} x={7 + i % 3 * 4} y={13 + Math.floor(i / 3) * 4} width="2" height="2" rx=".4" fill="currentColor" opacity={summary && i < Math.ceil(summary.busyRatio * 6) ? 1 : .22} />)}</svg>
      {summary ? <span aria-hidden="true" className={`chat-calendar-status-dot${summary.busy ? " is-busy" : ""}`} /> : null}
    </button>
    {open ? createPortal(<div ref={panel} id={id} role="dialog" aria-label={t("chronelle.chatCalendar")} className={`chat-calendar-popover tone-${tone}`} style={position ?? { visibility: "hidden" }}>
      <header className="chat-calendar-popover-header">
        {expanded ? <button ref={backButton} type="button" aria-label={t("common.back")} onClick={() => setExpanded(false)}><span className="material-symbols-outlined">arrow_back</span></button> : <span className="chat-calendar-eyebrow">{t("chronelle.chatCalendar")}</span>}
        <button ref={closeButton} type="button" aria-label={t("common.close")} onClick={() => { setOpen(false); button.current?.focus({ preventScroll: true }); }}><span className="material-symbols-outlined">close</span></button>
      </header>
      <div className="chat-calendar-popover-content">
        {expanded ? <ChronelleCalendar key={data.scope} ownerId={data.ownerId} /> : <>
          <div className="chat-calendar-status-hero">
            <div className="chat-calendar-day-dial" aria-hidden="true"><svg viewBox="0 0 64 64"><circle className="chat-calendar-dial-track" cx="32" cy="32" r="27" /><circle className="chat-calendar-dial-fill" cx="32" cy="32" r="27" pathLength="100" strokeDasharray={`${(summary?.busyRatio ?? 0) * 100} 100`} /></svg><span className="material-symbols-outlined">{summary ? summary.busy ? "schedule" : "check" : "calendar_month"}</span></div>
            <div><small>{toneLabel}</small><strong>{status}</strong>{summary ? <span>{summary.busy ? t("chronelle.busyUntil", { time: formatTime(summary.busyUntil!) }) : t("chronelle.readyToChat")}</span> : null}</div>
          </div>
          {summary && data.events ? <>
            <div className="chat-calendar-day-overview"><span>{t("chronelle.todayOverview")}</span><small>{t("chronelle.busyPercent", { percent: Math.round(summary.busyRatio * 100) })}</small></div>
            <CalendarAvailabilityBar events={data.events} day={agendaDay(data.now)} now={data.now} />
            <div className="chat-calendar-forecast"><span className="material-symbols-outlined" aria-hidden="true">{summary.busy ? "east" : "hourglass_empty"}</span><p>{forecast}</p></div>
          </> : <p className="chat-calendar-unavailable" role="status">{status}</p>}
          <button className="chat-calendar-open-details" type="button" onClick={() => setExpanded(true)}><span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>{t("chronelle.viewSchedule")}<span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>
        </>}
      </div>
    </div>, document.body) : null}
  </>;
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../lib/language";
import { agendaWindowStart, agendaCenteredDays, agendaDayDistance, agendaDay, agendaTimeRange, agendaEventsOn, normalizeAgenda, fetchAgenda, type AgendaEvent } from "../lib/chronelleAgenda";
import { CalendarAvailabilityBar } from "./CalendarAvailabilityBar";
import chronelleIcon from "../assets/chronelle-icon.png";
import "./ChronelleCalendar.css";
import { chronelleOrigin } from "../lib/chronelleOrigin";

export function ChronelleCalendar({ calendarId, loadEvents = fetchAgenda }: { calendarId?: string; loadEvents?: (params: URLSearchParams, signal: AbortSignal) => Promise<unknown> }) {
  const { t, language } = useI18n();
  const [selectedDay, setSelectedDay] = useState(() => agendaDay());
  const [queue, setQueue] = useState<(number | Date)[]>([]);
  const [phase, setPhase] = useState<"idle" | "select" | "slide">("idle");
  const [step, setStep] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<number | undefined>(undefined);
  const cache = useRef(new Map<string, { rows: AgendaEvent[]; at: number }>());
  const keyboardFocus = useRef(false);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const center = () => { element.scrollLeft = element.clientWidth / 7 * 17; };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(element);
    if (keyboardFocus.current) {
      element.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
      keyboardFocus.current = false;
    }
    return () => observer.disconnect();
  }, [selectedDay, calendarId]);
  useEffect(() => () => window.clearTimeout(scrollTimer.current), []);
  const scrollDates = () => {
    const element = viewport.current;
    if (!element) return;
    window.clearTimeout(scrollTimer.current);
    const delta = Math.round(element.scrollLeft / (element.clientWidth / 7) - 17);
    if (!delta) return;
    if (phase !== "idle") { setQueue([]); setPhase("idle"); }
    scrollTimer.current = window.setTimeout(() => {
      setQueue([]);
      setPhase("idle");
      setSelectedDay(value => agendaDay(value, delta));
    }, Math.abs(delta) >= 14 ? 0 : 100);
  };
  const navigate = (target: number | Date) => {
    window.clearTimeout(scrollTimer.current);
    setQueue(value => [...value, target]);
  };
  const returnToday = () => {
    window.clearTimeout(scrollTimer.current);
    keyboardFocus.current = false;
    setQueue([]);
    setPhase("idle");
    setSelectedDay(agendaDay());
    setReload(value => value + 1);
  };
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (phase !== "idle" || !queue.length) return;
    const next = queue[0];
    const delta = typeof next === "number" ? next : agendaDayDistance(selectedDay, next);
    if (reducedMotion || Math.abs(delta) > 3 || delta === 0) {
      setSelectedDay(agendaDay(selectedDay, delta));
      setQueue(value => value.slice(1));
    } else {
      setStep(delta);
      setPhase("select");
    }
  }, [phase, queue, selectedDay, reducedMotion]);
  useEffect(() => {
    if (phase === "idle") return;
    const timer = window.setTimeout(() => {
      if (phase === "select") setPhase("slide");
      else {
        setSelectedDay(value => agendaDay(value, step));
        setQueue(value => value.slice(1));
        setPhase("idle");
      }
    }, reducedMotion ? 0 : phase === "select" ? 170 : 230);
    return () => window.clearTimeout(timer);
  }, [phase, step, reducedMotion]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const days = agendaCenteredDays(selectedDay, 20);
  const start = agendaWindowStart(selectedDay).getTime();
  const requestKey = `${calendarId}:${start}`;
  const valid = Boolean(calendarId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(calendarId));
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    const cached = cache.current.get(requestKey);
    if (cached && Date.now() - cached.at < 60000) {
      setEvents(cached.rows); setLoadedKey(requestKey); setState("ready");
      window.clearTimeout(timeout);
      return () => { active = false; controller.abort(); };
    }
    setState("loading");
    setEvents([]);
    const end = new Date(start);
    end.setDate(end.getDate() + 28);
    const params = new URLSearchParams({ share: calendarId!, start: new Date(start).toISOString(), end: end.toISOString() });
    const debounce = window.setTimeout(() => { void loadEvents(params, controller.signal)
      .then(normalizeAgenda)
      .then((rows) => { if (active) {
        cache.current.delete(requestKey);
        cache.current.set(requestKey, { rows, at: Date.now() });
        if (cache.current.size > 6) cache.current.delete(cache.current.keys().next().value!);
        setEvents(rows); setLoadedKey(requestKey); setState("ready");
      } })
      .catch(() => { if (active) setState("error"); })
      .finally(() => window.clearTimeout(timeout)); }, 150);
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); window.clearTimeout(debounce); };
  }, [calendarId, valid, start, requestKey, reload, loadEvents]);
  if (!valid) return null;
  const shareUrl = `${chronelleOrigin()}/#/share/${calendarId}`;
  const displayState = loadedKey !== requestKey && state !== "error" ? "loading" : state;
  const items = loadedKey === requestKey ? agendaEventsOn(events, selectedDay) : [];
  return <section className="chronelle-calendar" aria-label={t("chronelle.title")}>
    <div className="chronelle-calendar-heading"><div><img src={chronelleIcon} alt="" /><strong>{t("chronelle.title")}</strong></div><a href={shareUrl} target="_blank" rel="noopener noreferrer">{t("chronelle.open")} ↗</a></div>
    <div className="chronelle-calendar-navigation">
      <button type="button" aria-label={t("chronelle.previousDay")} onClick={() => navigate(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
      <button className="chronelle-selected-date" type="button" title={t("chronelle.returnToday")} aria-label={`${selectedDay.toLocaleDateString(language, { dateStyle: "full" })} · ${t("chronelle.returnToday")}`} onClick={returnToday}><strong aria-live="polite">{selectedDay.toLocaleDateString(language, { year: "numeric", month: "long", day: "numeric" })}</strong></button>
      <button type="button" aria-label={t("chronelle.nextDay")} onClick={() => navigate(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
    </div>
    <div ref={viewport} className="chronelle-strip-viewport" role="group" aria-label={t("chronelle.chooseDay")} onScroll={scrollDates} onKeyDown={event => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); keyboardFocus.current = true; navigate(event.key === "ArrowRight" ? 1 : -1); }
    }}>
      <div className={`chronelle-week-strip chronelle-strip-${phase}`} style={{ transform: `translateX(${-(phase === "slide" ? step : 0) * 100 / 41}%)` }}>
        <span className="chronelle-day-highlight" aria-hidden="true" style={{left: `${(20 + (phase === "idle" ? 0 : step)) * 100 / 41}%`}} />
        {days.map((day) => <button type="button" className={day.getTime() < agendaDay().getTime() ? "chronelle-past-day" : undefined} key={day.getTime()} tabIndex={day.getTime() === selectedDay.getTime() ? 0 : -1} aria-pressed={day.getTime() === selectedDay.getTime()} aria-label={day.toLocaleDateString(language, { dateStyle: "full" })} onClick={() => navigate(day)}><small>{day.toLocaleDateString(language, { weekday: "narrow" })}</small><strong>{day.getDate()}</strong><i className={loadedKey === requestKey && day.getTime() >= start && day.getTime() < agendaDay(new Date(start), 28).getTime() && agendaEventsOn(events, day).length ? "has-events" : ""} /></button>)}
      </div>
    </div>
    <div className="chronelle-agenda" aria-busy={displayState === "loading"}>
      {displayState === "ready" ? <div className="chronelle-availability">
        <CalendarAvailabilityBar events={items} day={selectedDay} />
      </div> : null}
      {displayState === "loading" ? <p role="status">{t("chronelle.loading")}</p> : displayState === "error" ? <div className="chronelle-agenda-state"><p>{t("chronelle.loadFailed")}</p><button type="button" onClick={() => { cache.current.delete(requestKey); setReload((value) => value + 1); }}>{t("common.retry")}</button></div> : !items.length ? <p>{t("chronelle.noEvents")}</p> : <ol>{items.slice(0, 5).map((event) => <li key={`${event.id}:${event.start}`}><time>{event.all_day ? t("chronelle.allDay") : agendaTimeRange(event, selectedDay, language)}</time><div><strong>{event.locked ? t("chronelle.busy") : event.title || t("chronelle.untitled")}</strong>{event.location ? <small>{event.location}</small> : null}</div></li>)}</ol>}
      {displayState === "ready" && items.length > 5 ? <a href={shareUrl} target="_blank" rel="noopener noreferrer">{t("chronelle.moreEvents", { count: items.length - 5 })} ↗</a> : null}
    </div>
    <small className="row-subtle">{t("chronelle.publicOnly")}</small>
  </section>;
}

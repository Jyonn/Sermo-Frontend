import { useEffect, useState } from "react";
import { useI18n } from "../lib/language";
import { agendaCenteredDays, agendaDayDistance, agendaDay, agendaBusyRanges, agendaTimeRange, agendaEventsOn, normalizeAgenda, type AgendaEvent } from "../lib/chronelleAgenda";
import chronelleIcon from "../assets/chronelle-icon.png";
import "./ChronelleCalendar.css";

export function ChronelleCalendar({ calendarId }: { calendarId?: string }) {
  const { t, language } = useI18n();
  const [selectedDay, setSelectedDay] = useState(() => agendaDay());
  const [queue, setQueue] = useState<(number | Date)[]>([]);
  const [phase, setPhase] = useState<"idle" | "select" | "slide">("idle");
  const [step, setStep] = useState(0);
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
  const days = agendaCenteredDays(selectedDay, 6);
  const start = agendaDay(selectedDay, -3).getTime();
  const requestKey = `${calendarId}:${start}`;
  const valid = Boolean(calendarId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(calendarId));
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setState("loading");
    setEvents([]);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const params = new URLSearchParams({ share: calendarId!, start: new Date(start).toISOString(), end: end.toISOString() });
    void fetch(`https://chronelle.jyonn.space/api/events/?${params}`, { credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Calendar unavailable"); return normalizeAgenda(await response.json()); })
      .then((rows) => { if (active) { setEvents(rows); setLoadedKey(requestKey); setState("ready"); } })
      .catch(() => { if (active) setState("error"); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [calendarId, valid, start, requestKey, reload]);
  if (!valid) return null;
  const shareUrl = `https://chronelle.jyonn.space/#/share/${calendarId}`;
  const displayState = loadedKey !== requestKey && state !== "error" ? "loading" : state;
  const items = loadedKey === requestKey ? agendaEventsOn(events, selectedDay) : [];
  const ranges = agendaBusyRanges(items, selectedDay);
  return <section className="chronelle-calendar" aria-label={t("chronelle.title")}>
    <div className="chronelle-calendar-heading"><div><img src={chronelleIcon} alt="" /><strong>{t("chronelle.title")}</strong></div><a href={shareUrl} target="_blank" rel="noopener noreferrer">{t("chronelle.open")} ↗</a></div>
    <div className="chronelle-calendar-navigation">
      <button type="button" aria-label={t("chronelle.previousDay")} onClick={() => setQueue(value => [...value, -1])}>‹</button>
      <strong aria-live="polite">{selectedDay.toLocaleDateString(language, { year: "numeric", month: "long", day: "numeric" })}</strong>
      <button type="button" aria-label={t("chronelle.nextDay")} onClick={() => setQueue(value => [...value, 1])}>›</button>
      <button className="chronelle-today" type="button" onClick={() => { setQueue([]); setPhase("idle"); setSelectedDay(agendaDay()); }}>{t("chronelle.today")}</button>
    </div>
    <div className="chronelle-strip-viewport" role="group" aria-label={t("chronelle.chooseDay")}>
      <div className={`chronelle-week-strip chronelle-strip-${phase}`} style={{ transform: `translateX(${-(3 + (phase === "slide" ? step : 0)) * 100 / 13}%)` }}>
        <span className="chronelle-day-highlight" aria-hidden="true" style={{left: `${(6 + (phase === "idle" ? 0 : step)) * 100 / 13}%`}} />
        {days.map((day, index) => <button type="button" key={day.getTime()} tabIndex={index >= 3 && index <= 9 ? 0 : -1} aria-hidden={index < 3 || index > 9 ? true : undefined} aria-pressed={day.getTime() === selectedDay.getTime()} aria-label={day.toLocaleDateString(language, { dateStyle: "full" })} onClick={() => setQueue(value => [...value, day])}><small>{day.toLocaleDateString(language, { weekday: "narrow" })}</small><strong>{day.getDate()}</strong><i className={loadedKey === requestKey && agendaEventsOn(events, day).length ? "has-events" : ""} /></button>)}
      </div>
    </div>
    <div className="chronelle-agenda" aria-busy={displayState === "loading"}>
      {displayState === "ready" ? <div className="chronelle-availability">
        <div className="chronelle-busy-bar" role="img" aria-label={`${selectedDay.toLocaleDateString(language, { dateStyle: "full" })} · ${t("chronelle.busyBar")} · ${t("chronelle.availabilityHint")}`} title={t("chronelle.availabilityHint")}>
          {ranges.map((range, index) => <i key={index} style={{ left: `${range.start}%`, width: `${range.end - range.start}%` }} />)}
        </div>
        <div className="chronelle-bar-labels"><span>00:00</span><span>12:00</span><span>24:00</span></div>
      </div> : null}
      {displayState === "loading" ? <p role="status">{t("chronelle.loading")}</p> : displayState === "error" ? <div className="chronelle-agenda-state"><p>{t("chronelle.loadFailed")}</p><button type="button" onClick={() => setReload((value) => value + 1)}>{t("common.retry")}</button></div> : !items.length ? <p>{t("chronelle.noEvents")}</p> : <ol>{items.slice(0, 5).map((event) => <li key={`${event.id}:${event.start}`}><time>{event.all_day ? t("chronelle.allDay") : agendaTimeRange(event, selectedDay, language)}</time><div><strong>{event.locked ? t("chronelle.busy") : event.title || t("chronelle.untitled")}</strong>{event.location ? <small>{event.location}</small> : null}</div></li>)}</ol>}
      {displayState === "ready" && items.length > 5 ? <a href={shareUrl} target="_blank" rel="noopener noreferrer">{t("chronelle.moreEvents", { count: items.length - 5 })} ↗</a> : null}
    </div>
    <small className="row-subtle">{t("chronelle.publicOnly")}</small>
  </section>;
}

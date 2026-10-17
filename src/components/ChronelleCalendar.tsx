import { useEffect, useState } from "react";
import { useI18n } from "../lib/language";
import { agendaWeek, agendaDate, agendaEventsOn, normalizeAgenda, type AgendaEvent } from "../lib/chronelleAgenda";
import chronelleIcon from "../assets/chronelle-icon.png";
import "./ChronelleCalendar.css";

export function ChronelleCalendar({ calendarId }: { calendarId?: string }) {
  const { t, language } = useI18n();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState((new Date().getDay() + 6) % 7);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  const days = agendaWeek(offset);
  const start = days[0].getTime();
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
      .then((rows) => { if (active) { setEvents(rows); setState("ready"); } })
      .catch(() => { if (active) setState("error"); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [calendarId, valid, start, reload]);
  if (!valid) return null;
  const shareUrl = `https://chronelle.jyonn.space/#/share/${calendarId}`;
  const items = agendaEventsOn(events, days[selected]);
  return <section className="chronelle-calendar" aria-label={t("chronelle.title")}>
    <div className="chronelle-calendar-heading"><div><img src={chronelleIcon} alt="" /><strong>{t("chronelle.title")}</strong></div><a href={shareUrl} target="_blank" rel="noopener noreferrer">{t("chronelle.open")} ↗</a></div>
    <div className="chronelle-calendar-navigation">
      <strong>{days[0].toLocaleDateString(language, { month: "long", year: "numeric" })}</strong>
      <div><button type="button" aria-label={t("chronelle.previousWeek")} onClick={() => setOffset((value) => value - 1)}>‹</button><button type="button" onClick={() => { setOffset(0); setSelected((new Date().getDay() + 6) % 7); }}>{t("chronelle.today")}</button><button type="button" aria-label={t("chronelle.nextWeek")} onClick={() => setOffset((value) => value + 1)}>›</button></div>
    </div>
    <div className="chronelle-week-strip" role="group" aria-label={t("chronelle.chooseDay")}>
      {days.map((day, index) => <button type="button" key={day.getTime()} aria-pressed={index === selected} aria-label={day.toLocaleDateString(language, { dateStyle: "full" })} onClick={() => setSelected(index)}><small>{day.toLocaleDateString(language, { weekday: "narrow" })}</small><strong>{day.getDate()}</strong><i className={agendaEventsOn(events, day).length ? "has-events" : ""} /></button>)}
    </div>
    <div className="chronelle-agenda" aria-busy={state === "loading"}>
      {state === "loading" ? <p role="status">{t("chronelle.loading")}</p> : state === "error" ? <div className="chronelle-agenda-state"><p>{t("chronelle.loadFailed")}</p><button type="button" onClick={() => setReload((value) => value + 1)}>{t("common.retry")}</button></div> : !items.length ? <p>{t("chronelle.noEvents")}</p> : <ol>{items.slice(0, 5).map((event) => <li key={`${event.id}:${event.start}`}><time>{event.all_day ? t("chronelle.allDay") : agendaDate(event.start).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })}</time><div><strong>{event.locked ? t("chronelle.busy") : event.title || t("chronelle.untitled")}</strong>{event.location ? <small>{event.location}</small> : null}</div></li>)}</ol>}
      {state === "ready" && items.length > 5 ? <a href={shareUrl} target="_blank" rel="noopener noreferrer">{t("chronelle.moreEvents", { count: items.length - 5 })} ↗</a> : null}
    </div>
    <small className="row-subtle">{t("chronelle.publicOnly")}</small>
  </section>;
}

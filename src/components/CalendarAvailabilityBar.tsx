import { useEffect, useState } from "react";
import { agendaBusyRanges, agendaDay, agendaWindowRanges, agendaDayProgress, type AgendaEvent } from "../lib/chronelleAgenda";
import { useI18n } from "../lib/language";
import "./CalendarAvailabilityBar.css";

export function useCalendarClock(enabled = true) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const update = () => { if (!document.hidden) setNow(new Date()); };
    update();
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [enabled]);
  return now;
}

export function CalendarAvailabilityBar({ events, day, now: suppliedNow, upcoming = false }: {
  events: AgendaEvent[]; day: Date; now?: Date; upcoming?: boolean;
}) {
  const clock = useCalendarClock(suppliedNow === undefined);
  const now = suppliedNow ?? clock;
  const { t, language } = useI18n();
  const { today, elapsed } = agendaDayProgress(day, now);
  const start = today ? now.getTime() : agendaDay(day).getTime();
  const end = start + 6 * 3600000;
  const ranges = upcoming ? agendaWindowRanges(events, start, end) : agendaBusyRanges(events, day);
  const label = (value: number) => new Date(value).toLocaleTimeString(language, {hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const time = now.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const description = `${day.toLocaleDateString(language, { dateStyle: "full" })} · ${t("chronelle.busyBar")} · ${t("chronelle.availabilityHint")}${today ? ` · ${t("chronelle.currentTime", { time })}` : ""}`;
  return <div className={`calendar-availability${upcoming ? ' is-upcoming' : ''}`}>
    <div className="calendar-availability-track" role="img" aria-label={description} title={description}>
      {ranges.map((range, index) => <i aria-hidden="true" className="calendar-availability-busy" key={index} style={{ left: `${range.start}%`, width: `${range.end - range.start}%` }} />)}
      {!upcoming && elapsed > 0 ? <span aria-hidden="true" className="calendar-availability-elapsed" style={{ width: `${elapsed}%` }} /> : null}
      {today ? <span aria-hidden="true" className="calendar-availability-now" style={{ left: `${upcoming ? 0 : elapsed}%` }} /> : null}
    </div>
    <div className="calendar-availability-labels" aria-hidden="true">{upcoming ? [0,2,4,6].map(hour => <span key={hour}>{label(start+hour*3600000)}</span>) : <><span>00:00</span><span>12:00</span><span>24:00</span></>}</div>
  </div>;
}

import { useEffect, useState } from "react";
import { agendaBusyRanges, agendaDayProgress, type AgendaEvent } from "../lib/chronelleAgenda";
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

export function CalendarAvailabilityBar({ events, day, now: suppliedNow }: {
  events: AgendaEvent[]; day: Date; now?: Date;
}) {
  const clock = useCalendarClock(suppliedNow === undefined);
  const now = suppliedNow ?? clock;
  const { t, language } = useI18n();
  const { today, elapsed } = agendaDayProgress(day, now);
  const time = now.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const description = `${day.toLocaleDateString(language, { dateStyle: "full" })} · ${t("chronelle.busyBar")} · ${t("chronelle.availabilityHint")}${today ? ` · ${t("chronelle.currentTime", { time })}` : ""}`;
  return <div className="calendar-availability">
    <div className="calendar-availability-track" role="img" aria-label={description} title={description}>
      {agendaBusyRanges(events, day).map((range, index) => <i aria-hidden="true" className="calendar-availability-busy" key={index} style={{ left: `${range.start}%`, width: `${range.end - range.start}%` }} />)}
      {elapsed > 0 ? <span aria-hidden="true" className="calendar-availability-elapsed" style={{ width: `${elapsed}%` }} /> : null}
      {today ? <span aria-hidden="true" className="calendar-availability-now" style={{ left: `${elapsed}%` }} /> : null}
    </div>
    <div className="calendar-availability-labels" aria-hidden="true"><span>00:00</span><span>12:00</span><span>24:00</span></div>
  </div>;
}

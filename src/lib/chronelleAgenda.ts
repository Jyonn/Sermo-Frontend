export interface AgendaEvent {
  id: string;
  start: string;
  end: string;
  all_day: boolean;
  locked: boolean;
  title: string;
  location: string;
}

export function agendaWeek(offset: number, today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7 + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day;
  });
}

export function agendaDate(value: string) {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
}

export function normalizeAgenda(value: unknown): AgendaEvent[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error("Invalid calendar response");
  return value.filter((row) => row && typeof row.start === "string" && typeof row.end === "string" && Number.isFinite(agendaDate(row.start).getTime()) && Number.isFinite(agendaDate(row.end).getTime())).map((row) => ({
    id: String(row.id), start: row.start, end: row.end, all_day: Boolean(row.all_day), locked: Boolean(row.locked),
    title: !row.locked && typeof row.title === "string" ? row.title : "",
    location: !row.locked && typeof row.location === "string" ? row.location : "",
  })).sort((a, b) => agendaDate(a.start).getTime() - agendaDate(b.start).getTime());
}

export function agendaEventsOn(events: AgendaEvent[], day: Date) {
  const end = new Date(day);
  end.setDate(end.getDate() + 1);
  return events.filter((event) => {
    const start = agendaDate(event.start).getTime();
    return start < end.getTime() && Math.max(start + 1, agendaDate(event.end).getTime()) > day.getTime();
  });
}

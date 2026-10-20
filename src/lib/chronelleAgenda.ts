export interface AgendaEvent {
  id: string;
  start: string;
  end: string;
  all_day: boolean;
  locked: boolean;
  title: string;
  location: string;
}

export function agendaDayProgress(day: Date, now: Date) {
  const start = agendaDay(day).getTime();
  const end = agendaDay(day, 1).getTime();
  return {
    today: agendaDay(now).getTime() === start,
    elapsed: Math.max(0, Math.min(100, (now.getTime() - start) / (end - start) * 100)),
  };
}

export function publicCalendarForFriend(friends: Array<{ user_id: number; chronelle_calendar_id?: string }>, peerId: number) {
  const id = friends.find((friend) => friend.user_id === peerId)?.chronelle_calendar_id;
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

export async function fetchAgenda(params: URLSearchParams, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`https://chronelle.jyonn.space/api/events/?${params}`, { credentials: "omit", referrerPolicy: "no-referrer", signal });
  if (!response.ok) throw new Error("Calendar unavailable");
  return response.json();
}

export function agendaDay(day = new Date(), delta = 0) {
  const result = new Date(day);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + delta);
  return result;
}

export function agendaCenteredDays(day: Date, radius = 3) {
  return Array.from({ length: radius * 2 + 1 }, (_, index) => agendaDay(day, index - radius));
}

export function agendaDayDistance(from: Date, to: Date) {
  const serial = (day: Date) => Date.UTC(day.getFullYear(), day.getMonth(), day.getDate());
  return Math.round((serial(to) - serial(from)) / 86400000);
}

export function agendaWindowStart(day: Date) {
  const anchor = new Date(2020, 0, 1);
  return agendaDay(anchor, Math.floor(agendaDayDistance(anchor, day) / 28) * 28);
}

export function agendaBusyRanges(events: AgendaEvent[], day: Date) {
  const start = agendaDay(day).getTime();
  const end = agendaDay(day, 1).getTime();
  const ranges = agendaEventsOn(events, agendaDay(day)).map(event => ({
    start: Math.max(start, agendaDate(event.start).getTime()),
    end: Math.min(end, Math.max(agendaDate(event.start).getTime() + 1, agendaDate(event.end).getTime())),
  })).sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged.map(range => ({ start: (range.start - start) / (end - start) * 100, end: (range.end - start) / (end - start) * 100 }));
}

export function agendaTimeRange(event: AgendaEvent, day: Date, language: string) {
  const format = (value: string) => {
    const date = agendaDate(value);
    const time = date.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
    return agendaDay(date).getTime() === agendaDay(day).getTime() ? time : `${date.toLocaleDateString(language, { month: "short", day: "numeric" })} ${time}`;
  };
  return `${format(event.start)} – ${format(event.end)}`;
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

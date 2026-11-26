import type { CalendarRange } from './chronelleBridge';

const day = 24 * 60 * 60 * 1000;

export function meetingLocalTime(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const clock = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${clock.year}-${clock.month}-${clock.day}T${clock.hour}:${clock.minute}`;
}

export function shiftMeetingDay(date: string, offset: number) {
  return new Date(Date.parse(date + 'T00:00Z') + offset * day).toISOString().slice(0, 10);
}

function instantAt(value: string, timezone: string) {
  const desired = Date.parse(value + 'Z');
  if (!Number.isFinite(desired)) throw new RangeError('Invalid meeting time');
  let instant = desired;
  for (let attempt = 0; attempt < 4; attempt++) {
    const iso = new Date(instant).toISOString();
    const local = meetingLocalTime(iso, timezone);
    if (local === value) return iso;
    instant += desired - Date.parse(local + 'Z');
  }
  throw new RangeError('Invalid meeting time');
}

export function newMeetingRange(now = Date.now(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone): CalendarRange {
  const halfHour = 30 * 60 * 1000;
  const start = Math.ceil(now / halfHour) * halfHour;
  return {
    start: new Date(start).toISOString(),
    end: new Date(start + halfHour).toISOString(),
    timezone, all_day: false,
  };
}

export function meetingTimeFields(range: CalendarRange) {
  const [from, startTime] = meetingLocalTime(range.start, range.timezone).split('T');
  const [end, endTime] = meetingLocalTime(range.end, range.timezone).split('T');
  return { from, to: range.all_day ? shiftMeetingDay(end, -1) : end, startTime, endTime };
}

export function meetingRangeFromFields(
  fields: ReturnType<typeof meetingTimeFields>, timezone: string, allDay: boolean,
): CalendarRange {
  const { from, to, startTime, endTime } = fields;
  const start = instantAt(`${from}T${allDay ? '00:00' : startTime}`, timezone);
  const end = instantAt(allDay ? `${shiftMeetingDay(to, 1)}T00:00` : `${to}T${endTime}`, timezone);
  const duration = Date.parse(end) - Date.parse(start);
  if (duration <= 0 || duration > 7 * day) throw new RangeError('Invalid meeting duration');
  return { start, end, timezone, all_day: allDay };
}

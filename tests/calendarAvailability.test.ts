import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { agendaAvailability, agendaBusyRanges, agendaDayProgress, fetchAgenda, normalizeAgenda, publicCalendarForFriend } from "../src/lib/chronelleAgenda.ts";

test("elapsed time is clipped and the live marker only belongs to today", () => {
  const day = new Date(2026, 9, 20);
  assert.deepEqual(agendaDayProgress(day, new Date(2026, 9, 20, 12)), { today: true, elapsed: 50 });
  assert.deepEqual(agendaDayProgress(day, new Date(2026, 9, 20)), { today: true, elapsed: 0 });
  assert.deepEqual(agendaDayProgress(day, new Date(2026, 9, 21)), { today: false, elapsed: 100 });
  assert.deepEqual(agendaDayProgress(day, new Date(2026, 9, 19)), { today: false, elapsed: 0 });
  assert.deepEqual(agendaBusyRanges([], day), []);
});
test("elapsed fraction follows the real duration of daylight-saving days", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    assert.ok(Math.abs(agendaDayProgress(new Date(2026, 2, 8), new Date(2026, 2, 8, 12)).elapsed - 11 / 23 * 100) < 1e-9);
    assert.ok(Math.abs(agendaDayProgress(new Date(2026, 10, 1), new Date(2026, 10, 1, 12)).elapsed - 13 / 25 * 100) < 1e-9);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test("only a matching current friend with a valid binding supplies a calendar", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(publicCalendarForFriend([{ user_id: 2, chronelle_calendar_id: id }], 2), id);
  assert.equal(publicCalendarForFriend([{ user_id: 2, chronelle_calendar_id: id }], 3), null);
  assert.equal(publicCalendarForFriend([], 2), null);
  assert.equal(publicCalendarForFriend([{ user_id: 2 }], 2), null);
  assert.equal(publicCalendarForFriend([{ user_id: 2, chronelle_calendar_id: "https://other.example/" }], 2), null);
});
test("public calendar fetch sends no cookies or authorization headers and forwards cancellation", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(String(url)).origin, "https://chronelle.jyonn.space");
    assert.equal(options?.credentials, "omit");
    assert.equal(options?.referrerPolicy, "no-referrer");
    assert.equal(options?.headers, undefined);
    assert.equal(options?.signal, controller.signal);
    return new Response("[]", { status: 200 });
  };
  try { assert.deepEqual(await fetchAgenda(new URLSearchParams({ share: "public-id" }), controller.signal), []); }
  finally { globalThis.fetch = original; }
});
test("profiles use a fine line and both chat headers share one resource and popover", () => {
  const profile = readFileSync(new URL("../src/components/ChronelleCalendar.tsx", import.meta.url), "utf8");
  const chat = readFileSync(new URL("../src/pages/ChatsPage.tsx", import.meta.url), "utf8");
  const gate = readFileSync(new URL("../src/components/ChatCalendarAvailability.tsx", import.meta.url), "utf8");
  assert.match(profile, /<CalendarAvailabilityBar events=\{items\}/);
  assert.match(gate, /<CalendarAvailabilityBar events=\{data.events\}/);
  assert.match(gate, /api.getFriends\(controller.signal\)/);
  assert.match(gate, /if \(!calendarId\) return null/);
  assert.match(gate, /data\?\.scope === scope/);
  assert.equal(chat.match(/const chatCalendar = useChatCalendarAvailability\(/g)?.length, 1);
  assert.equal(chat.match(/<ChatCalendarAvailability data=\{chatCalendar\}/g)?.length, 2);
  const headerEnd = chat.indexOf("className={`chat-pinned-bar");
  assert.doesNotMatch(chat.slice(chat.lastIndexOf("</header>", headerEnd), headerEnd), /ChatCalendarAvailability/);
  assert.match(chat, /displayedChat\?\.purpose === "normal" \? displayedDirectPeerId : undefined/);
  assert.match(gate, /<ChronelleCalendar calendarId=\{data.calendarId\}/);
  assert.match(gate, /event.key === "Escape"/);
  assert.match(gate, /pointerdown/);
  const css = readFileSync(new URL("../src/components/CalendarAvailabilityBar.css", import.meta.url), "utf8");
  assert.match(css, /height: 8px/);
  assert.doesNotMatch(css, /repeating-linear-gradient|calendar-availability-time/);
  const bar = readFileSync(new URL("../src/components/CalendarAvailabilityBar.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(bar, /<time/);
  const calendarCss = readFileSync(new URL("../src/components/ChronelleCalendar.css", import.meta.url), "utf8");
  assert.match(calendarCss, /\.chronelle-agenda \{ min-height: 72px; \}/);
  assert.doesNotMatch(profile, /chronelle-busy-bar/);
});

test("ongoing overlapping and adjacent events produce one busy period and the next real free window", () => {
  const rows = normalizeAgenda([
    { start: "2026-10-20T16:00:00", end: "2026-10-20T16:50:00" },
    { start: "2026-10-20T16:30:00", end: "2026-10-20T17:00:00" },
    { start: "2026-10-20T17:00:00", end: "2026-10-20T17:20:00" },
    { start: "2026-10-20T17:50:00", end: "2026-10-20T20:00:00" },
  ]);
  const summary = agendaAvailability(rows, new Date(2026, 9, 20, 17));
  assert.equal(summary.busy, true);
  assert.equal(summary.busyUntil, new Date(2026, 9, 20, 17, 20).getTime());
  assert.equal(summary.changeMinutes, 20);
  assert.equal(summary.freeMinutes, 30);
  const atEnd = agendaAvailability(rows, new Date(2026, 9, 20, 17, 20));
  assert.equal(atEnd.busy, false);
  assert.equal(atEnd.changeMinutes, 30);
  assert.equal(atEnd.nextBusy, new Date(2026, 9, 20, 17, 50).getTime());
  assert.equal(atEnd.nextBusyUntil, new Date(2026, 9, 20, 20).getTime());
});
test("all-day and overnight schedules preserve their actual busy-until time", () => {
  const allDay = normalizeAgenda([{ start: "2026-10-20", end: "2026-10-22", all_day: true }]);
  const summary = agendaAvailability(allDay, new Date(2026, 9, 20, 12));
  assert.equal(summary.busy, true);
  assert.equal(summary.tone, "full");
  assert.equal(summary.busyRatio, 1);
  assert.equal(summary.busyUntil, new Date(2026, 9, 22).getTime());
  assert.equal(summary.freeMinutes, null);
  assert.equal(agendaAvailability([], new Date(2026, 9, 20, 12)).restOfDayFree, true);
});
test("today load does not double-count overlaps or count tomorrow's busy time", () => {
  const rows = normalizeAgenda([
    { start: "2026-10-20T00:00:00", end: "2026-10-20T12:00:00" },
    { start: "2026-10-20T01:00:00", end: "2026-10-20T08:00:00" },
    { start: "2026-10-21T00:00:00", end: "2026-10-22T00:00:00" },
  ]);
  const summary = agendaAvailability(rows, new Date(2026, 9, 20, 20));
  assert.equal(summary.busyRatio, .5);
  assert.equal(summary.tone, "full");
  assert.equal(summary.busyMinutes, 720);
  assert.equal(summary.restOfDayFree, true);
});

test("load colors use daily occupied hours rather than requiring a nearly 24-hour schedule", () => {
  const day = new Date(2026, 9, 20, 12);
  for (const [hours, tone] of [[1, "light"], [4, "balanced"], [8, "full"]] as const) {
    const rows = normalizeAgenda([{ start: "2026-10-20T00:00:00", end: `2026-10-20T${String(hours).padStart(2, "0")}:00:00` }]);
    assert.equal(agendaAvailability(rows, day).tone, tone);
  }
});

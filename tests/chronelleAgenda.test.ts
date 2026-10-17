import assert from "node:assert/strict";
import test from "node:test";
import { agendaWindowStart, agendaCenteredDays, agendaDayDistance, agendaBusyRanges, agendaDay, agendaTimeRange, agendaWeek, normalizeAgenda, agendaEventsOn } from "../src/lib/chronelleAgenda.ts";
test("rolling dates stay bounded in DOM while browsing arbitrary historical and future dates", () => {
  for (const year of [1900, 2026, 2100]) {
    const selected = new Date(year, 0, 1);
    const days = agendaCenteredDays(selected, 20);
    assert.equal(days.length, 41);
    assert.equal(days[20].getTime(), selected.getTime());
    const start = agendaWindowStart(selected);
    assert.ok(agendaDayDistance(start, selected) >= 0);
    assert.ok(agendaDayDistance(start, selected) < 28);
    assert.equal(agendaDayDistance(start, agendaWindowStart(agendaDay(start, 28))), 28);
  }
});
test("centered strip keeps selection fourth across month and year boundaries", () => {
  const selected = new Date(2026, 0, 1);
  const days = agendaCenteredDays(selected);
  assert.equal(days.length, 7);
  assert.equal(days[3].getTime(), selected.getTime());
  assert.equal(days[0].getFullYear(), 2025);
  assert.equal(agendaDayDistance(days[0], days[6]), 6);
  const previous = process.env.TZ;
  process.env.TZ = "America/New_York";
  try { assert.equal(agendaDayDistance(new Date(2026, 2, 7), new Date(2026, 2, 9)), 2); }
  finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test("busy ranges clip to the day, merge overlaps and cover all-day intervals", () => {
  const rows = normalizeAgenda([
    {start: "2026-10-16T23:00:00", end: "2026-10-17T03:00:00"},
    {start: "2026-10-17T02:00:00", end: "2026-10-17T04:00:00"},
  ]);
  const ranges = agendaBusyRanges(rows, new Date(2026, 9, 17));
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start, 0);
  assert.ok(Math.abs(ranges[0].end - 100 / 6) < 1e-10);
  assert.deepEqual(agendaBusyRanges(normalizeAgenda([{start: "2026-10-17", end: "2026-10-18", all_day: true}]), new Date(2026, 9, 17)), [{start: 0, end: 100}]);
});
test("day navigation follows local dates across weeks, years and DST", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const day = agendaDay(new Date(2026, 2, 8, 12));
    const next = agendaDay(day, 1);
    assert.equal(next.getDate(), 9);
    assert.equal(next.getTime() - day.getTime(), 23 * 3600000);
    assert.equal(agendaDay(new Date(2026, 10, 1), 1).getTime() - new Date(2026, 10, 1).getTime(), 25 * 3600000);
    assert.equal(agendaDay(new Date(2026, 0, 1), -1).getFullYear(), 2025);
    assert.equal(agendaWeek(0, agendaDay(new Date(2026, 9, 18), 1))[0].getDate(), 19);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test("time ranges retain both endpoints and distinguish cross-day events", () => {
  const event = normalizeAgenda([{ id: 1, start: "2026-10-17T23:00:00", end: "2026-10-18T01:30:00", locked: true }])[0];
  const label = agendaTimeRange(event, new Date(2026, 9, 17), "en-GB");
  assert.match(label, /23:00/);
  assert.match(label, /18 Oct/);
  assert.match(label, /01:30/);
  assert.equal(agendaEventsOn([event, { ...event, id: "overlap" }], new Date(2026, 9, 18)).length, 2);
});
test("weeks start on Monday and navigate across month boundaries", () => {
  const days = agendaWeek(0, new Date(2026, 9, 4, 12));
  assert.equal(days[0].getDay(), 1);
  assert.equal(days[0].getMonth(), 8);
  assert.equal(days[0].getDate(), 28);
  assert.equal(agendaWeek(1, new Date(2026, 9, 4))[0].getDate(), 5);
});
test("busy-only records cannot expose titles or locations", () => {
  const rows = normalizeAgenda([{ id: "busy", start: "2026-10-17", end: "2026-10-18", all_day: true, locked: true, title: "secret", location: "secret" }]);
  assert.equal(rows[0].title, "");
  assert.equal(rows[0].location, "");
});
test("all-day intervals have exclusive ends and span multiple dates", () => {
  const rows = normalizeAgenda([{ id: "trip", start: "2026-10-17", end: "2026-10-19", all_day: true }]);
  assert.equal(agendaEventsOn(rows, new Date(2026, 9, 18)).length, 1);
  assert.equal(agendaEventsOn(rows, new Date(2026, 9, 19)).length, 0);
});
test("invalid rows are ignored and non-array responses fail explicitly", () => {
  assert.equal(normalizeAgenda([{ start: "invalid", end: "invalid" }]).length, 0);
  assert.throws(() => normalizeAgenda({ results: [] }));
});

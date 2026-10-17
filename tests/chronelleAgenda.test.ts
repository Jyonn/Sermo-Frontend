import assert from "node:assert/strict";
import test from "node:test";
import { agendaWeek, normalizeAgenda, agendaEventsOn } from "../src/lib/chronelleAgenda.ts";
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

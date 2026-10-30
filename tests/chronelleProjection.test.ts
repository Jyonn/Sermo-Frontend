import test from "node:test";
import assert from "node:assert/strict";
import { profileAgenda } from "../src/lib/chronelleProfile.ts";

test("OAuth calendars work without a legacy share ID and keep busy-only details private", () => {
  const result = profileAgenda({ status: "active", availability: "known", events: [
    { start: "2026-10-30T10:00:00", end: "2026-10-30T11:00:00", locked: true, title: "private", location: "private" },
  ] });
  assert.equal(result.hidden, false);
  assert.equal(result.known, true);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].title, "");
  assert.equal(result.events[0].location, "");
});

test("a hidden or revoked calendar cannot retain previously returned events", () => {
  assert.deepEqual(profileAgenda({ status: "hidden", availability: "known", events: [{ title: "stale" }] }), { hidden: true, known: false, events: [] });
});

test("an empty partial projection is unknown rather than a confirmed free day", () => {
  const partial = profileAgenda({ status: "active", availability: "unknown", events: [] });
  assert.equal(partial.hidden, false);
  assert.equal(partial.known, false);
  assert.deepEqual(partial.events, []);
  assert.equal(profileAgenda({ status: "active", availability: "known", events: [] }).known, true);
});

test("invalid calendar responses fail rather than silently showing free time", () => {
  assert.throws(() => profileAgenda({ status: "active", availability: "known", events: {} as unknown[] }));
});

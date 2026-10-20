import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { agendaBusyRanges, agendaDayProgress, fetchAgenda, publicCalendarForFriend } from "../src/lib/chronelleAgenda.ts";

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
test("profile and direct chats share the timeline; the compact strip sits before pins", () => {
  const profile = readFileSync(new URL("../src/components/ChronelleCalendar.tsx", import.meta.url), "utf8");
  const chat = readFileSync(new URL("../src/pages/ChatsPage.tsx", import.meta.url), "utf8");
  const gate = readFileSync(new URL("../src/components/ChatCalendarAvailability.tsx", import.meta.url), "utf8");
  assert.match(profile, /<CalendarAvailabilityBar events=\{items\}/);
  assert.match(gate, /<CalendarAvailabilityBar compact/);
  assert.match(gate, /api.getFriends\(controller.signal\)/);
  assert.match(gate, /if \(!calendarId\) return null/);
  assert.match(gate, /data.scope !== scope/);
  const index = chat.indexOf("<ChatCalendarAvailability key=");
  assert.ok(index > chat.lastIndexOf("</header>", index));
  assert.ok(index < chat.indexOf("className={`chat-pinned-bar", index));
  assert.match(chat.slice(index - 110, index), /type === "direct" && displayedChat.purpose === "normal"/);
  const css = readFileSync(new URL("../src/components/CalendarAvailabilityBar.css", import.meta.url), "utf8");
  assert.match(css, /is-compact \.calendar-availability-track \{ height: 10px; border-radius: 0/);
  assert.doesNotMatch(profile, /chronelle-busy-bar/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/pages/SquarePage.tsx", import.meta.url), "utf8");
const inbox = source.slice(source.indexOf("notificationEvents.map((event)"), source.indexOf("{notificationHistoryAvailable"));

test("inbox recognizes redacted actors and anonymous notification payloads", () => {
  assert.match(inbox, /Boolean\(event.actor\?\.anonymous \|\| event.payload.anonymous_actor\)/);
  assert.match(inbox, /anonymousActor \? t\("square.anonymousUser"\) : event.actor\?\.name/);
});

test("anonymous inbox avatars reuse Square styling instead of identity or initials", () => {
  assert.match(inbox, /anonymousActor \? <span className="square-anonymous-avatar square-notification-avatar"><span className="material-symbols-outlined">person<\/span><\/span> : <UserAvatar/);
});

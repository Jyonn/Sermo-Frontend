import assert from "node:assert/strict";
import test from "node:test";
import { chatCache } from "../src/lib/chatCache.ts";
import {
  latestWindowCandidates,
  latestWindowOverlaps,
  shouldFollowLatestWindow,
} from "../src/lib/messageWindow.ts";

const messages = (...ids: Array<number | string>) => ids.map((id) => ({ id }));

test("retains an overlapping cached tail", () => {
  assert.equal(latestWindowOverlaps(messages(1, 2, 3, 4), messages(3, 4, 5, 6)), true);
  assert.deepEqual(
    latestWindowCandidates(messages(1, 2, 3, 4), messages(3, 4, 5, 6)).map(({ id }) => id),
    [1, 2, 3, 4, 3, 4, 5, 6],
  );
});

test("drops disconnected cached server messages", () => {
  assert.equal(latestWindowOverlaps(messages(1, 2, 3), messages(90, 91, 92)), false);
  assert.deepEqual(
    latestWindowCandidates(messages(1, 2, 3), messages(90, 91, 92)).map(({ id }) => id),
    [90, 91, 92],
  );
});

test("keeps local pending or failed messages when replacing a stale tail", () => {
  assert.deepEqual(
    latestWindowCandidates(messages(1, 2, "temp:pending", "temp:failed"), messages(90, 91)).map(({ id }) => id),
    ["temp:pending", "temp:failed", 90, 91],
  );
});

test("an empty authoritative latest page removes stale server messages", () => {
  assert.deepEqual(
    latestWindowCandidates(messages(1, 2, "temp:pending"), []).map(({ id }) => id),
    ["temp:pending"],
  );
});

test("historical windows never replace the latest-attached thread cache", () => {
  const scope = "message-window-test";
  const chatId = 991;
  chatCache.setThread(scope, chatId, {
    messages: [],
    hasOlderMessages: true,
    hasNewerMessages: false,
    scrollTop: 120,
    updatedAt: 10,
  });

  chatCache.setThread(scope, chatId, {
    messages: [],
    hasOlderMessages: true,
    hasNewerMessages: true,
    scrollTop: 20,
    updatedAt: 20,
  });

  assert.equal(chatCache.getThread(scope, chatId)?.updatedAt, 10);
  assert.equal(chatCache.getThread(scope, chatId)?.scrollTop, 120);
});

test("a standalone historical window is not cached", () => {
  const scope = "message-window-test";
  const chatId = 992;
  chatCache.setThread(scope, chatId, {
    messages: [],
    hasOlderMessages: true,
    hasNewerMessages: true,
    scrollTop: 20,
    updatedAt: 20,
  });

  assert.equal(chatCache.getThread(scope, chatId), null);
});

test("only the real latest tail follows newly appended messages", () => {
  assert.equal(shouldFollowLatestWindow(false, true), true);
  assert.equal(shouldFollowLatestWindow(false, false), false);
  assert.equal(shouldFollowLatestWindow(true, true), false);
});

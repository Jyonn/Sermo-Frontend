import assert from "node:assert/strict";
import test from "node:test";
import { duelLoginReturn, duelSeconds, validDuelDigits } from "../src/lib/numberDuel.ts";
test("four ASCII digits, allowing repetition and leading zero", () => {
  assert.equal(validDuelDigits("0123"), true);
  for (const value of ["1123", "0000", "1111", "0011"]) assert.equal(validDuelDigits(value), true);
  for (const value of ["１２３４", "123", "12345", "12 3"]) assert.equal(validDuelDigits(value), false);
});
test("deadline rounds up and never goes negative", () => {
  assert.equal(duelSeconds(30, 0.1), 30);
  assert.equal(duelSeconds(30, 29.9), 1);
  assert.equal(duelSeconds(30, 31), 0);
});
test("room invitations survive login without introducing arbitrary redirects", () => {
  const path = "/app/square/activities/number-duel-2026?room=KW7D9AH2";
  assert.equal(duelLoginReturn(path), path);
  const room = "/app/number-duel/KW7D9AH2";
  assert.equal(duelLoginReturn(room), room);
  assert.equal(duelLoginReturn(room + "?next=https://evil.test"), "/app");
  for (const value of [null, {}, "https://evil.test", "//evil.test", path + "&next=https://evil.test", "/app/other"]) assert.equal(duelLoginReturn(value), "/app");
});

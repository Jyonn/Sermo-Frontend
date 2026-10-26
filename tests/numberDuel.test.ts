import assert from "node:assert/strict";
import test from "node:test";
import { duelSeconds, validDuelDigits } from "../src/lib/numberDuel.ts";
test("four distinct ASCII digits, including leading zero", () => {
  assert.equal(validDuelDigits("0123"), true);
  for (const value of ["1123", "１２３４", "123", "12345", "12 3"]) assert.equal(validDuelDigits(value), false);
});
test("deadline rounds up and never goes negative", () => {
  assert.equal(duelSeconds(30, 0.1), 30);
  assert.equal(duelSeconds(30, 29.9), 1);
  assert.equal(duelSeconds(30, 31), 0);
});

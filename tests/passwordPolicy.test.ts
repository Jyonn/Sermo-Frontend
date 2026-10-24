import assert from "node:assert/strict";
import test from "node:test";
import { meetsPasswordPolicy } from "../src/lib/passwordPolicy.ts";

const official = { min_length: 10, max_length: 128, required_classes: 3, official: true };
test("official passwords require length and three character classes", () => {
  for (const value of ["1234567890", "abcdefghij", "Short1!", "Aa1!".repeat(33), "Original1\n"]) {
    assert.equal(meetsPasswordPolicy(value, official), false);
  }
  assert.equal(meetsPasswordPolicy("BrightMoon42!", official), true);
});
test("member policy preserves spaces and counts Unicode characters", () => {
  const member = { ...official, min_length: 6, required_classes: 0, official: false };
  assert.equal(meetsPasswordPolicy(" pass ", member), true);
  assert.equal(meetsPasswordPolicy("abc", member), false);
  assert.equal(meetsPasswordPolicy("😀".repeat(129), member), false);
});

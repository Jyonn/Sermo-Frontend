import assert from "node:assert/strict";
import test from "node:test";
import { needsContentUpgrade } from "../src/lib/contentCompatibility.ts";

test("compares release components numerically", () => {
  assert.equal(needsContentUpgrade("2026.09.30.10", "2026.09.30.2"), true);
  assert.equal(needsContentUpgrade("2026.09.30.2", "2026.09.30.10"), false);
  assert.equal(needsContentUpgrade("2026.10.01.1", "2026.09.30.10"), true);
  assert.equal(needsContentUpgrade(undefined, "2026.09.30.1"), false);
  assert.equal(needsContentUpgrade("unknown", "2026.09.30.1"), false);
});

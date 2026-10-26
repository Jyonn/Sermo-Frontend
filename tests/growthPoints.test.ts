import assert from "node:assert/strict";
import test from "node:test";
import { signedGrowthPoints } from "../src/lib/growthPoints.ts";

test("growth ledger displays gains, losses and refunds without double signs", () => {
  assert.equal(signedGrowthPoints(10), "+10");
  assert.equal(signedGrowthPoints(-10), "-10");
  assert.equal(signedGrowthPoints(0), "0");
});

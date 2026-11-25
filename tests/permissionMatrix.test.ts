import assert from "node:assert/strict";
import test from "node:test";
import { groupPermissionRows } from "../src/lib/permissionMatrix.ts";
import type { CapabilitySimulationRowDTO } from "../src/types.ts";

const row = (level: number, overrides: Partial<CapabilitySimulationRowDTO> = {}): CapabilitySimulationRowDTO => ({
  growth_level: level, verification: "none", permanent_vip: false, allowed: true, ...overrides,
});

test("matrix groups only neighboring levels with identical reasons and quotas", () => {
  const higherLimit = { limits: { daily: 2, weekly: 10 } };
  const grouped = groupPermissionRows([
    row(1), row(2), row(3, higherLimit), row(4, higherLimit),
    row(5, { allowed: false, denied_by: [{ key: "chat", source: "platform" }] }),
    row(6, { allowed: false, denied_by: [{ key: "chat", source: "space" }] }),
    row(8, { allowed: false, denied_by: [{ key: "chat", source: "space" }] }),
  ], false);
  assert.deepEqual(grouped.map(({ from, through }) => [from, through]), [[1, 2], [3, 4], [5, 5], [6, 6], [8, 8]]);
});

test("matrix keeps VIP contexts independent and missing cells unknown", () => {
  const grouped = groupPermissionRows([row(1), row(1, { permanent_vip: true, verification: "dual", allowed: false })], true);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].cells[0], undefined);
  assert.equal(grouped[0].cells[3]?.allowed, false);
});

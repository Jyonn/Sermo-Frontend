import assert from "node:assert/strict";
import test from "node:test";
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", { value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
const diagnostics = await import("../src/lib/updateDiagnostics.ts");
test("failed restarts retain a bounded, credential-free report", () => {
  diagnostics.beginUpdate("2026.10.17.5");
  diagnostics.markUpdateReload();
  diagnostics.reconcileUpdate("2026.10.15.1");
  assert.equal(diagnostics.hasUpdateFailure(), true);
  assert.equal(diagnostics.getUpdateReport().entries.at(-1)?.metrics.runningVersion, "2026.10.15.1");
  for (let i = 0; i < 200; i++) diagnostics.recordUpdate(3);
  assert.equal(diagnostics.getUpdateReport().entries.length, 100);
});
test("successful restarts accept the target or a newer version", () => {
  diagnostics.beginUpdate("2026.10.17.5");
  diagnostics.markUpdateReload();
  diagnostics.reconcileUpdate("2026.10.17.6");
  assert.equal(diagnostics.hasUpdateFailure(), false);
  assert.equal(diagnostics.compareVersions("2026.10.17.10", "2026.10.17.9") > 0, true);
});

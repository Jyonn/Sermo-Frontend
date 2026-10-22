import { test } from "node:test";
import assert from "node:assert/strict";
import { updateDestination } from "../src/lib/updateDestination.ts";
import type { ExplicitUpdateCheckResult } from "../src/lib/pwaUpdate.ts";
import { readFileSync } from "node:fs";

const here = "https://sermo.6-79.cn";
const there = "https://frienden.6-79.cn";
function fixture(currentVersion: string | null = "2026.10.22.3"): ExplicitUpdateCheckResult {
  return {
    currentRelease: { id: "2026.10.22.2", publishedAt: "2026-10-22", locales: {} },
    latestVersion: "2026.10.22.4", latestRelease: null, updateAvailable: true,
    sources: [
      { key: "mirror", origin: here, status: currentVersion ? "ok" : "error", releaseId: currentVersion, release: null },
      { key: "friendenMirror", origin: there, status: "ok", releaseId: "2026.10.22.4", release: null },
    ],
  };
}

test("another site with the latest release replaces ineffective local updates", () => {
  assert.equal(updateDestination(fixture(), here), `${there}/`);
  assert.equal(updateDestination(fixture(null), here), `${there}/`);
  assert.equal(updateDestination(fixture("2026.10.22.4"), here), null);
});
test("no new version, failed sources and untrusted destinations never trigger navigation", () => {
  assert.equal(updateDestination(null, here), null);
  const result = fixture();
  result.updateAvailable = false;
  assert.equal(updateDestination(result, here), null);
  result.updateAvailable = true;
  result.sources[1].status = "error";
  assert.equal(updateDestination(result, here), null);
  result.sources[1].status = "ok";
  result.sources[1].origin = "https://untrusted.invalid";
  assert.equal(updateDestination(result, here), null);
});
test("both update surfaces share destination policy and bilingual button labels", () => {
  for (const component of ["PwaUpdatePrompt", "UpdateCheckDialog"]) {
    const source = readFileSync(new URL(`../src/components/${component}.tsx`, import.meta.url), "utf8");
    assert.match(source, /updateDestination\(result, window.location.origin\)/);
    assert.match(source, /window.location.assign\(destination\)/);
    assert.match(source, /update.wait/);
  }
  for (const language of ["en", "zh-CN"]) {
    const copy = JSON.parse(readFileSync(new URL(`../src/locales/${language}/translation.json`, import.meta.url), "utf8"));
    assert.ok(copy["update.goToNewSite"]);
    assert.ok(copy["update.wait"]);
  }
});

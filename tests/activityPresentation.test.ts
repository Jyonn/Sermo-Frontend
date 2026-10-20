import test from "node:test";
import assert from "node:assert/strict";
import { activityPresentation, safeActivityImage } from "../src/lib/activityPresentation.ts";

test("unknown campaigns never inherit Baxian artwork", () => {
  assert.equal(activityPresentation({ key: "new-event" }).artwork_url, undefined);
  assert.match(activityPresentation({ key: "main-character-bgm-2026" }).title_art_url!, /title-zh/);
});
test("custom campaign metadata allows only public image URLs", () => {
  for (const value of ["javascript:alert(1)", "//evil.test/a", "https://user:pass@example.test/a", "http://example.test/a"]) assert.equal(safeActivityImage(value), undefined);
  assert.equal(safeActivityImage("/activity/custom.png"), "/activity/custom.png");
  assert.equal(activityPresentation({ presentation: { palette: "rose", artwork_url: "https://example.test/a.png" } }).palette, "rose");
});

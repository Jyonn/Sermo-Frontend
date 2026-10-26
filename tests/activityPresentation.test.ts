import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { activityPresentation, safeActivityImage } from "../src/lib/activityPresentation.ts";

test("activity headers preserve lettering colors in dark mode", () => {
  const css = readFileSync(new URL("../src/components/ActivityCampaignCard.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /campaign-title-art\s*\{[^}]*filter:\s*brightness\(0\)/);
  assert.match(css, /height:32px/);
});

test("unknown campaigns never inherit Baxian artwork", () => {
  assert.equal(activityPresentation({ key: "new-event" }).artwork_url, undefined);
  assert.match(activityPresentation({ key: "main-character-bgm-2026" }).title_art_url!, /title-zh/);
});
test("custom campaign metadata allows only public image URLs", () => {
  for (const value of ["javascript:alert(1)", "//evil.test/a", "https://user:pass@example.test/a", "http://example.test/a"]) assert.equal(safeActivityImage(value), undefined);
  assert.equal(safeActivityImage("/activity/custom.png"), "/activity/custom.png");
  assert.equal(activityPresentation({ presentation: { palette: "rose", artwork_url: "https://example.test/a.png" } }).palette, "rose");
});

test("Code Duel uses the generated wordmark across all presentation consumers", () => {
  for (const activity of [{key:"number-duel-2026"}, {theme:"number_duel"}]) {
    assert.equal(activityPresentation(activity).title_art_url, "/activity/number-duel/title-zh-v1.webp");
  }
});
test("custom activity artwork takes precedence and unsafe URLs do not", () => {
  assert.equal(activityPresentation({theme:"number_duel",presentation:{title_art_url:"/custom-title.webp"}}).title_art_url, "/custom-title.webp");
  assert.equal(activityPresentation({theme:"number_duel",presentation:{title_art_url:"javascript:alert(1)"}}).title_art_url, "/activity/number-duel/title-zh-v1.webp");
});

import assert from "node:assert/strict";
import test from "node:test";
test('all built-in activity themes resolve dedicated navigation lettering', () => {
  for (const theme of ['explorer','number_duel','bgm','baxian','spider-man-4','starry-night','permanent-vip']) {
    assert.ok(activityPresentation({theme}).title_art_url, theme);
  }
  assert.notEqual(activityPresentation({theme:'spider-man-4'}).title_art_url,activityPresentation({theme:'starry-night'}).title_art_url);
});
import { readFileSync } from "node:fs";
import { activityPresentation, safeActivityImage } from "../src/lib/activityPresentation.ts";
import {activityDrawerClassName,activityThemeForKey} from '../src/lib/activityTheme.ts';

test('initial activity surfaces are known before a detail response arrives',()=>{
  for(const [key,theme] of [['explorer-2026','explorer'],['baxian-immortal-force-2026','baxian'],['number-duel-2026','number_duel'],['main-character-bgm-2026','bgm'],['spider-man-4-preview','spider-man-4'],['starry-night-five-evenings-2026','starry-night'],['permanent-vip-founding-100','permanent-vip']]) {
    assert.equal(activityThemeForKey(key),theme);
    assert.equal(activityPresentation({key}).title_art_url,activityPresentation({theme}).title_art_url);
  }
  assert.equal(activityThemeForKey('future-campaign'),'');
  assert.equal(activityThemeForKey(),'');
  assert.match(activityDrawerClassName('explorer-2026'),/is-explorer-activity/);
  assert.match(activityDrawerClassName('permanent-vip-founding-100'),/vip-activity-drawer/);
  assert.match(activityDrawerClassName('baxian-immortal-force-2026'),/is-baxian-activity/);
  for(const key of ['explorer-2026','permanent-vip-founding-100','future-campaign'])assert.doesNotMatch(activityDrawerClassName(key),/is-baxian-activity/);
});

test("activity headers preserve lettering colors in dark mode", () => {
  const css = readFileSync(new URL("../src/components/ActivityCampaignCard.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /campaign-title-art\s*\{[^}]*filter:\s*brightness\(0\)/);
  assert.match(css, /height:32px/);
});

test("unknown campaigns never inherit Baxian artwork", () => {
  assert.equal(activityPresentation({ key: "new-event" }).artwork_url, undefined);
  assert.match(activityPresentation({ key: "main-character-bgm-2026" }).title_art_url!, /resources\/assets\//);
});

test("Explorer forwards retain the full banner even with old or missing server artwork", () => {
  for (const activity of [{ key: "explorer-2026" }, { theme: "explorer" }, { key: "explorer-2026", presentation: { artwork_url: "https://api.sermo.jyonn.space/resources/assets/64/display/cc203db3632ee9e6ca92f77615d4f736fe0251df1f81f9b2634a418ac78b7d5b" } }]) {
    const visual = activityPresentation(activity);
    assert.equal(visual.artwork_url, "https://api.sermo.jyonn.space/resources/assets/61/display/3bc14b190070ff1eb1dcf00f1940f053548e913865ceb4d1f37cdf88641223f7");
    assert.equal(visual.title_art_url, "https://api.sermo.jyonn.space/resources/assets/76/display/8cc080b5d91ecf861bdf4dbaedc1846eecfb4f73c7de73874d5b8f776a144260");
    assert.equal(visual.artwork_layout, "image");
  }
});
test("custom campaign metadata allows only public image URLs", () => {
  for (const value of ["javascript:alert(1)", "//evil.test/a", "https://user:pass@example.test/a", "http://example.test/a"]) assert.equal(safeActivityImage(value), undefined);
  assert.equal(safeActivityImage("/activity/custom.png"), "/activity/custom.png");
  assert.equal(activityPresentation({ presentation: { palette: "rose", artwork_url: "https://example.test/a.png" } }).palette, "rose");
});

test("Code Duel uses the generated wordmark across all presentation consumers", () => {
  for (const activity of [{key:"number-duel-2026"}, {theme:"number_duel"}]) {
    assert.equal(activityPresentation(activity).title_art_url, "https://api.sermo.jyonn.space/resources/assets/79/display/f63dd318cfbf703e2d8ea775f9d356c84349dbb946e83cae65bd7a6bc1f513ff");
  }
});
test("custom activity artwork takes precedence and unsafe URLs do not", () => {
  assert.equal(activityPresentation({theme:"number_duel",presentation:{title_art_url:"/custom-title.webp"}}).title_art_url, "/custom-title.webp");
  assert.equal(activityPresentation({theme:"number_duel",presentation:{title_art_url:"javascript:alert(1)"}}).title_art_url, "https://api.sermo.jyonn.space/resources/assets/79/display/f63dd318cfbf703e2d8ea775f9d356c84349dbb946e83cae65bd7a6bc1f513ff");
});

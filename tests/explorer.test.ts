import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EXPLORER_ART, explorerRewardArt, explorerRewardPath, explorerRewardThumbnail, explorerTaskPath } from "../src/lib/explorer.ts";
import { EXPLORER_SILHOUETTES, explorerPortraitBounds, explorerSceneLayout } from "../src/lib/explorerMotion.ts";

test("all reward destinations use existing menu drawers", () => {
  assert.equal(explorerRewardPath(1), "/app/menu?panel=personalization/avatar-frames");
  assert.equal(explorerRewardPath(2), "/app/menu?panel=personalization/chat-page&section=bubbles");
  assert.equal(explorerRewardPath(3), "/app/menu?panel=personalization/chat-page&section=backgrounds");
  assert.equal(explorerRewardPath(4), "/app/menu?panel=personalization/profile-card");
  assert.equal(explorerRewardPath(5), "/app/menu");
});

test("exploration tasks open shared settings instead of duplicate forms", () => {
  assert.equal(explorerTaskPath("welcome"), explorerTaskPath("signature"));
  assert.equal(explorerTaskPath("phone"), explorerTaskPath("email"));
  assert.equal(explorerTaskPath("checkin"), "/app/menu?panel=travel-map");
  assert.equal(explorerTaskPath("complete_activity"), "/app/square");
});

test("Explorer bubbles use the shared skin contract for both senders", () => {
  const css = readFileSync(new URL("../src/components/ExplorerPersonalization.css", import.meta.url), "utf8");
  for (const sender of ["other", "self"]) {
    for (const token of ["bg", "color", "border", "shadow", "radius"]) {
      assert.ok(css.includes(`--bubble-skin-${sender}-${token}:`));
    }
  }
  assert.ok(css.includes(".is-forward-bundle"));
  assert.ok(!css.includes("@keyframes explorer-duality"));
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
});

test("all five collectibles resolve to shipped final art and preserve the matched background pair", () => {
  assert.equal(new Set([1, 2, 3, 4, 5].map(explorerRewardArt)).size, 5);
  for (const tier of [1, 2, 3, 4, 5]) {
    const thumbnail = readFileSync(new URL(`../public${explorerRewardThumbnail(tier)}`, import.meta.url));
    assert.ok(thumbnail.length < 15_000, `tier ${tier} thumbnail exceeds the mobile budget`);
  }
  for (const asset of Object.values(EXPLORER_ART)) {
    const bytes = readFileSync(new URL(`../public${asset}`, import.meta.url));
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.ok(bytes.length < 500_000, `${asset} exceeds the mobile asset budget`);
  }
  const scene = readFileSync(new URL("../src/components/ExplorerTransformationWallpaper.tsx", import.meta.url), "utf8");
  assert.ok(scene.includes("EXPLORER_ART.background"));
  assert.ok(scene.includes("EXPLORER_ART.backgroundAlternate"));
});

test("Explorer uses two local portrait layers and profile scenes remain opt-in", () => {
  const tiles = readFileSync(new URL("../src/components/ExplorerTransformationWallpaper.tsx", import.meta.url), "utf8");
  assert.match(tiles, /className="explorer-transformation-actor"/);
  assert.ok(!tiles.includes("<use "));
  assert.ok(!tiles.includes("requestAnimationFrame"));
  const css = readFileSync(new URL("../src/components/ExplorerPersonalization.css", import.meta.url), "utf8");
  assert.match(css, /animation-play-state: paused/);
  assert.match(css, /\.explorer-living-wallpaper \{[^}]*background: #0c2138;/);
  assert.ok(!css.includes("@keyframes explorer-duality"));
  assert.match(css, /inset: 14%; width: 72%; height: 72%; border-radius: 12%/);
  assert.ok(!css.includes('background: url("/activity/explorer-2026/ai-v2.webp")'));
  const card = readFileSync(new URL("../src/components/UserProfileCard.tsx", import.meta.url), "utf8");
  assert.match(card, /profileTheme === "explorer-romance" \? <ExplorerProfileScene/);
  const profile = readFileSync(new URL("../src/components/UserProfilePanel.tsx", import.meta.url), "utf8");
  assert.match(profile, /profileTheme=\{user.profile_card_theme\}/);
});

test("gold flash bounds contain complete bodies without covering the sky or city", () => {
  for (const name of ["conan", "shinichi"] as const) {
    const bounds = explorerPortraitBounds(name);
    assert.ok(bounds.width < 300 && bounds.height < 550);
    for (const [x,y] of EXPLORER_SILHOUETTES[name].flat()) {
      assert.ok(x > bounds.left && x < bounds.left + bounds.width);
      assert.ok(y > bounds.top && y < bounds.top + bounds.height);
    }
  }
  const scene = readFileSync(new URL("../src/components/ExplorerTransformationWallpaper.tsx", import.meta.url), "utf8");
  assert.match(scene, /root\.dataset\.ready/);
  assert.ok(!scene.includes("getContext"));
  assert.ok(!scene.includes("hardwareConcurrency"));
  assert.ok(readFileSync(new URL("../public/activity/explorer-2026/roof-night-v4.webp", import.meta.url)).length < 500_000);
});

test("landscape keeps the standing figure inside the viewport and cover layers aligned", () => {
  for (const [width, height] of [[390,768],[438,314],[844,314],[1440,900]]) {
    const layout = explorerSceneLayout(width, height);
    const cover = layout.width / 960;
    const feet = layout.top + 1266 * cover;
    const head = feet - 516 * cover * layout.figureScale;
    assert.ok(head >= 0 && feet <= height, `${width}x${height} clips the standing figure`);
    assert.ok(layout.width >= width && layout.height >= height);
    assert.ok(layout.figureScale > 0 && layout.figureScale <= 1);
  }
});

test("avatar frames stay outside the shared clip and gallery previews use real wearable components", () => {
  const css = readFileSync(new URL("../src/components/ExplorerPersonalization.css", import.meta.url), "utf8");
  assert.match(css, /\.user-avatar\.has-avatar-frame > \.avatar-frame-clip\.avatar-frame-explorer-conan \{[^}]*overflow: visible;/);
  const gallery = readFileSync(new URL("../src/components/ExplorerRewardGallery.tsx", import.meta.url), "utf8");
  assert.match(gallery, /<UserAvatar className="explorer-avatar-preview" frame="explorer-conan"/);
  assert.match(gallery, /<FriendenLivingWallpaper theme="explorer-duality"/);
  assert.match(gallery, /<UserProfileCard/);
  assert.match(gallery, /aria-pressed=\{item.tier === reward.tier\}/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EXPLORER_ART, explorerRewardArt, explorerRewardPath, explorerRewardThumbnail, explorerTaskPath } from "../src/lib/explorer.ts";

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
  assert.ok(css.includes("@keyframes explorer-duality"));
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
  const scene = readFileSync(new URL("../src/components/ExplorerPixelWallpaper.tsx", import.meta.url), "utf8");
  assert.ok(scene.includes(EXPLORER_ART.background));
  assert.ok(scene.includes(EXPLORER_ART.backgroundAlternate));
});

test("Explorer motion uses unique tile clips and pauses offscreen; profile scenes are opt-in", () => {
  const tiles = readFileSync(new URL("../src/components/ExplorerPixelWallpaper.tsx", import.meta.url), "utf8");
  assert.match(tiles, /useId\(\)/);
  assert.match(tiles, /length: 150/);
  assert.match(tiles, /clipPath=/);
  const css = readFileSync(new URL("../src/components/ExplorerPersonalization.css", import.meta.url), "utf8");
  assert.match(css, /animation-play-state: paused/);
  assert.match(css, /\.explorer-living-wallpaper \{[^}]*background: #0c2138;/);
  assert.match(css, /\.explorer-pixel-portrait, \.explorer-pixel-sparks \{ display: none/);
  assert.match(css, /inset: 14%; width: 72%; height: 72%; border-radius: 12%/);
  assert.ok(!css.includes('background: url("/activity/explorer-2026/ai-v2.webp")'));
  const card = readFileSync(new URL("../src/components/UserProfileCard.tsx", import.meta.url), "utf8");
  assert.match(card, /profileTheme === "explorer-romance" \? <ExplorerProfileScene/);
  const profile = readFileSync(new URL("../src/components/UserProfilePanel.tsx", import.meta.url), "utf8");
  assert.match(profile, /profileTheme=\{user.profile_card_theme\}/);
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

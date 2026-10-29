import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { explorerRewardPath, explorerTaskPath } from "../src/lib/explorer.ts";

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

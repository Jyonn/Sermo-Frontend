import assert from "node:assert/strict";
import test from "node:test";
import {
  getSquareFeedLayout,
  setSquareFeedLayout,
  setSquareLayoutUnified,
} from "../src/lib/useSquareFeedLayout.ts";

test("unified layout masks channel preferences and restores them when turned off", () => {
  const scope = "test-square-layout";
  const channels = ["explore", "friends", "user"] as const;
  setSquareFeedLayout(scope, "masonry", "explore");
  setSquareFeedLayout(scope, "masonry", "user");
  assert.deepEqual(channels.map((channel) => getSquareFeedLayout(scope, channel)), ["list", "list", "list"]);

  setSquareLayoutUnified(scope, false);
  assert.equal(getSquareFeedLayout(scope, "explore"), "masonry");
  assert.equal(getSquareFeedLayout(scope, "friends"), "list");
  assert.equal(getSquareFeedLayout(scope, "user"), "masonry");

  setSquareLayoutUnified(scope, true);
  assert.equal(getSquareFeedLayout(scope, "user"), "list");
  setSquareLayoutUnified(scope, false);
  assert.equal(getSquareFeedLayout(scope, "user"), "masonry");
  assert.equal(getSquareFeedLayout("another-account", "user"), "list");
});

import assert from "node:assert/strict";
import test from "node:test";
import { applySessionUserPatch, mergeSessionUser } from "../src/lib/sessionUser.ts";

const previous = { user_id: 1, space_id: 2, name: "User", avatar_uri: "https://example.test/old.png", avatar_cache_key: "old" };

test("legacy refresh retains avatar presentation without retaining old token metadata", () => {
  const merged = mergeSessionUser(previous, { user_id: 1, space_id: 2, name: "New name", expire: 100 });
  assert.equal(merged.avatar_uri, previous.avatar_uri);
  assert.equal(merged.name, "New name");
  assert.equal(merged.expire, 100);
});

test("explicit avatar update or removal overrides the cached avatar", () => {
  assert.equal(mergeSessionUser(previous, { ...previous, avatar_uri: "", avatar_cache_key: "" }).avatar_uri, "");
  assert.equal(mergeSessionUser(previous, { ...previous, avatar_uri: "https://example.test/new.png" }).avatar_uri, "https://example.test/new.png");
});

test("avatars never leak across account or space identities", () => {
  for (const identity of [{ user_id: 3, space_id: 2 }, { user_id: 1, space_id: 3 }]) {
    const refreshed = { ...identity, name: "Other" };
    assert.deepEqual(mergeSessionUser(previous, refreshed), refreshed);
  }
});

test("changing avatar without a new explicit cache key invalidates the previous identity", () => {
  assert.equal(applySessionUserPatch(previous, { avatar_uri: "https://example.test/new.png" }).avatar_cache_key, undefined);
  assert.equal(applySessionUserPatch(previous, { avatar_uri: previous.avatar_uri }).avatar_cache_key, "old");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeSquareFeedRefresh,
  normalizeSquareFeedSnapshot,
  squareFeedCacheKey,
} from "../src/lib/squareFeedCache.ts";

const statements = (...ids: number[]) => ids.map((statement_id) => ({ statement_id }));

test("builds an isolated cache key for every feed", () => {
  assert.equal(squareFeedCacheKey("all", null), "square:all");
  assert.equal(squareFeedCacheKey("friends", null), "square:friends");
  assert.equal(squareFeedCacheKey("mine", null), "square:mine");
  assert.equal(squareFeedCacheKey("user", 42), "square:user:42");
  assert.equal(squareFeedCacheKey("user", null), "square:all");
});

test("normalizes the legacy array cache format", () => {
  assert.deepEqual(normalizeSquareFeedSnapshot(statements(3, 2, 1)), {
    items: statements(3, 2, 1),
    hasMore: false,
    trusted: false,
  });
});

test("recognizes versioned feed snapshots as safe to restore", () => {
  assert.deepEqual(normalizeSquareFeedSnapshot({
    version: 2,
    items: statements(3, 2, 1),
    hasMore: true,
  }), {
    items: statements(3, 2, 1),
    hasMore: true,
    trusted: true,
  });
});

test("keeps cached pages when the refreshed first page overlaps", () => {
  const result = mergeSquareFeedRefresh(
    statements(8, 7, 6, 5, 4, 3, 2, 1),
    statements(10, 9, 8, 7, 6),
  );
  assert.equal(result.connected, true);
  assert.deepEqual(result.items.map((item) => item.statement_id), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
});

test("drops disconnected cached pages instead of restoring an invalid position", () => {
  const result = mergeSquareFeedRefresh(statements(5, 4, 3), statements(30, 29, 28));
  assert.equal(result.connected, false);
  assert.deepEqual(result.items.map((item) => item.statement_id), [30, 29, 28]);
});

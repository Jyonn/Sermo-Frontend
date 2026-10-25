import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeCompact, type CompactPayload } from "../src/lib/compactTransport.ts";

test("message schemas and deduplicated users preserve nested content with independent objects", () => {
  const packed: CompactPayload = {
    format: "compact-v1", kind: "messages",
    schemas: [["avatar", "name", "user_id"], ["content", "mentions", "reply_to", "user"]],
    records: [[0, null, "Friend", 7], [1, "reply", [-1], null, [-2, 0]], [1, "hello", [-1, [-2, 0]], [-2, 1], [-2, 0]]],
    root: [-1, [-2, 2], [-2, 2]],
  };
  const rows = decodeCompact<any[]>(packed, "messages");
  assert.equal(rows[0].reply_to.user.user_id, 7);
  assert.deepEqual(rows[0].mentions, [{ avatar: null, name: "Friend", user_id: 7 }]);
  rows[0].user.name = "Changed";
  assert.equal(rows[1].user.name, "Friend");
  assert.equal(rows[0].mentions[0].name, "Friend");
});

test("growth fields and legacy payloads remain unchanged", () => {
  const packed: CompactPayload = { format: "compact-v1", kind: "growth", schemas: [["capabilities", "levels", "pending_level", "progress"]], records: [[0, [-2, 1], [-1, false, 0, "", null], null, 0.75], [1]], root: [-2, 0] };
  packed.schemas.push([]);
  assert.deepEqual(decodeCompact(packed, "growth"), { capabilities: {}, levels: [false, 0, "", null], pending_level: null, progress: .75 });
  const legacy = { score: 20, levels: [] };
  assert.equal(decodeCompact(legacy, "growth"), legacy);
  assert.deepEqual(decodeCompact([], "messages"), []);
});

test("invalid references, schema lengths, cross-endpoint data and cycles fail explicitly", () => {
  const packed: CompactPayload = { format: "compact-v1", kind: "messages", schemas: [["user"]], records: [[0, [-2, 0]]], root: [-2, 0] };
  assert.throws(() => decodeCompact(packed, "messages"), /reference/);
  assert.throws(() => decodeCompact(packed, "growth"), /Unsupported/);
  packed.root = [-2, 99];
  assert.throws(() => decodeCompact(packed, "messages"), /reference/);
  packed.root = [-2, 0]; packed.records = [[0]];
  assert.throws(() => decodeCompact(packed, "messages"), /schema/);
});

test("message paging, growth and founder acknowledgement negotiate compact transport", () => {
  const source = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  const messages = source.slice(source.indexOf("  getMessages("), source.indexOf("  searchMessages("));
  assert.match(messages, /query: \{ \.\.\.params, format: "compact-v1" \}/);
  assert.match(messages, /decodeCompact<ChatMessageDTO\[\]>/);
  const growth = source.slice(source.indexOf("  getGrowth("), source.indexOf("  getFeatureDiscoveries("));
  assert.equal((growth.match(/format: "compact-v1"/g) ?? []).length, 3);
  assert.equal((growth.match(/decodeCompact<UserGrowthDTO>/g) ?? []).length, 3);
  assert.match(growth, /acknowledgeFounderMedal/);
});

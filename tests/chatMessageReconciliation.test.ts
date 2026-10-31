import assert from "node:assert/strict";
import test from "node:test";
import { mergeMessages, preserveStableMediaUri, sortMessages } from "../src/lib/chatMessageReconciliation.ts";
import type { ChatMessage } from "../src/types.ts";

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 1, clientId: "server:1", from: "self", type: 0, kind: "text", name: "Me", time: "", createdAt: 100, text: "Hello", status: "sent", ...overrides };
}

test("delivery replaces an optimistic message while retaining its render identity", () => {
  const pending = message({ id: "local:1", clientId: "local:1", status: "pending" });
  const delivered = message({ id: 8, clientId: "server:8" });
  const result = mergeMessages([pending], [delivered]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, delivered.id);
  assert.equal(result[0].clientId, pending.clientId);
  assert.equal(result[0].status, "sent");
  assert.equal(pending.status, "pending");
  assert.deepEqual(mergeMessages([delivered], [pending]), [delivered]);
});

test("repeated delivery is idempotent and unrelated optimistic messages survive", () => {
  const delivered = message();
  const other = message({ id: "local:2", clientId: "local:2", text: "Different", status: "pending" });
  const result = mergeMessages([delivered, other], [delivered, delivered]);
  assert.deepEqual(result.map(({ id }) => id), [delivered.id, other.id]);
  assert.deepEqual(mergeMessages(result, [delivered]), result);
});

test("sticker confirmation matches content hashes and failed text can be confirmed", () => {
  const sticker = message({ id: "local:1", clientId: "local:1", kind: "sticker", status: "pending", payload: { kind: "sticker", content_hash: "same" } });
  assert.equal(mergeMessages([sticker], [{ ...sticker, id: 9, clientId: "server:9", status: "sent" }]).length, 1);
  assert.equal(mergeMessages([message({ status: "failed" })], [message({ id: 2, clientId: "server:2" })]).length, 1);
});

test("signed media URL refresh keeps fresh credentials and local appearance", () => {
  const existing = message({ kind: "image", localPreviewUri: "blob:preview", isPermanentVip: true, payload: { kind: "image", uri: "https://media.test/photo?e=1&token=old" } });
  const incoming = message({ kind: "image", payload: { kind: "image", uri: "https://media.test/photo?e=2&token=new" } });
  const result = preserveStableMediaUri(existing, incoming);
  assert.equal(result.payload?.uri, incoming.payload?.uri);
  assert.equal(result.localPreviewUri, "blob:preview");
  assert.equal(result.isPermanentVip, true);
  assert.equal(preserveStableMediaUri(existing, { ...incoming, payload: { kind: "image", uri: "https://media.test/different" } }).payload?.uri, "https://media.test/different");
});

test("chronological sorting resolves timestamp ties without mutating input", () => {
  const rows = [message({ id: "local:1" }), message({ id: 2 }), message({ id: 1 })];
  assert.deepEqual(sortMessages(rows).map((row) => row.id), [1, 2, "local:1"]);
  assert.equal(rows[0].id, "local:1");
});

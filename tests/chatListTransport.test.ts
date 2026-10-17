import assert from "node:assert/strict";
import test from "node:test";
import { decodeChatList, type CompactChatList } from "../src/lib/chatListTransport.ts";
import type { ChatDTO } from "../src/types.ts";

const pack = (records: Record<string, unknown>[]) => {
  const schemas = records.map((row) => Object.keys(row));
  return { schemas, rows: records.map((row, index) => [index, Object.values(row)] as [number, unknown[]]) };
};
function fixture(): CompactChatList {
  return { format: "compact-v1", users: pack([{ user_id: 1, name: "A", avatar_uri: "https://example.test/a.png" }, { user_id: 2, name: "B", official: false }]), chats: pack([
    { chat_id: 1, owner: 0, members: [[0, { joined_at: 10, submission_role: null, group_chat_mute: { active: true } }], [1, {}]], last_message: { user: 1, content: "@1", mentions: [0], reply_to: { user: 0, content: "reply" }, payload: { images: ["unchanged"] } }, unread_count: 3, pinned: true },
    { chat_id: 2, owner: null, members: [[0, { joined_at: 20, group_chat_mute: null }]], last_message: null, unread_count: 0, submission: { status: "draft" } },
  ]) };
}
test("restores member context, message identities, nulls and untouched fields", () => {
  const result = decodeChatList(fixture());
  assert.equal(result[0].owner?.name, "A");
  assert.equal(result[0].last_message?.user.name, "B");
  assert.equal(result[0].last_message?.mentions?.[0].name, "A");
  assert.equal(result[0].members[0].joined_at, 10);
  assert.equal(result[1].members[0].joined_at, 20);
  assert.equal(result[1].owner, null);
  assert.equal(result[1].last_message, null);
  assert.equal(result[0].unread_count, 3);
  assert.equal(result[1].submission?.status, "draft");
  assert.deepEqual(result[0].last_message?.payload, { images: ["unchanged"] });
});
test("decompression never shares mutable identity objects across contexts", () => {
  const result = decodeChatList(fixture());
  result[0].members[0].name = "changed";
  assert.equal(result[1].members[0].name, "A");
  assert.equal(result[0].owner?.name, "A");
});
test("legacy servers work without an additional fallback request", () => {
  const legacy: ChatDTO[] = [];
  assert.equal(decodeChatList(legacy), legacy);
});
test("invalid user references and schema shapes fail explicitly", () => {
  const invalid = fixture();
  invalid.users.rows = [];
  assert.throws(() => decodeChatList(invalid), /reference/);
  const invalidSchema = fixture();
  invalidSchema.chats.rows[0][1] = [];
  assert.throws(() => decodeChatList(invalidSchema), /schema/);
});

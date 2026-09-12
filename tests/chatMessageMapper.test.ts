import assert from "node:assert/strict";
import test from "node:test";
import { mapChatMessageDTO, messageKindFromType } from "../src/lib/chatMessageMapper.ts";
import type { ChatMessageDTO } from "../src/types.ts";

const expectedKinds = [
  "text", "image", "file", "system", "video", "audio", "location", "map_access",
  "statement", "sticker", "forward_bundle", "activity", "official_notice", "submission_invite",
];

function message(type = 0): ChatMessageDTO {
  return {
    message_id: 42,
    user: { user_id: 7, name: "测试用户" },
    type,
    content: "原始内容",
    created_at: 123,
  };
}

test("maps every server message type through one canonical table", () => {
  expectedKinds.forEach((kind, type) => assert.equal(messageKindFromType(type), kind));
  assert.equal(messageKindFromType(999), "text");
});

test("normalizes sender, payload text, and display time consistently", () => {
  const source = message();
  source.payload = { kind: "text", text: "结构化内容" };
  const mapped = mapChatMessageDTO(source, 7, (value) => `time:${value}`);

  assert.equal(mapped.from, "self");
  assert.equal(mapped.text, "结构化内容");
  assert.equal(mapped.time, "time:123");
  assert.equal(mapped.clientId, "server:42");
});

test("creates the canonical text payload when an old response has none", () => {
  assert.deepEqual(mapChatMessageDTO(message(), 99).payload, { kind: "text", text: "原始内容" });
});

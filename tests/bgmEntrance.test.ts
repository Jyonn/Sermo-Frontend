import test from "node:test";
import assert from "node:assert/strict";
import { BGM_KEY_CENTERS, mergeBgmEntranceMessages, newBgmEntrances } from "../src/lib/bgmEntrance.ts";
import { mapChatMessageDTO } from "../src/lib/chatMessageMapper.ts";

const system = () => mapChatMessageDTO({ message_id: 11, type: 3, created_at: 101, user: { user_id: 7, name: "Alice" }, content: "Alice entered with Track", payload: { kind: "system", event: "bgm_entrance", text: "Alice entered with Track" } }, 1);
const audio = () => mapChatMessageDTO({ message_id: 12, type: 5, created_at: 101, user: { user_id: 7, name: "Alice" }, content: "", payload: { kind: "audio", bgm_entrance: true, uri: "https://example.test/a.mp3", song_title: "Track", system_message_id: 11 } }, 1);

test("legacy system/audio pair becomes one system message with inline playback", () => {
  const first = system();
  const result = mergeBgmEntranceMessages([first, audio()]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 11);
  assert.equal(result[0].text, first.text);
  assert.equal(result[0].payload?.uri, "https://example.test/a.mp3");
  assert.equal(first.payload?.uri, undefined);
});
test("pairing handles out-of-order delivery and paginated orphan audio safely", () => {
  assert.equal(mergeBgmEntranceMessages([audio(), system()]).length, 1);
  assert.equal(mergeBgmEntranceMessages([audio()]).length, 1);
  assert.equal(mergeBgmEntranceMessages([{ ...system(), userId: 8 }, audio()]).length, 2);
  assert.equal(mergeBgmEntranceMessages([{ ...system(), payload: { kind: "system", event: "other" } }, audio()]).length, 2);
});
test("new peer sounds need neither participation nor an opt-in preference", () => {
  assert.equal(newBgmEntrances([audio()], new Set(), 100, 102, 1).length, 1);
  assert.equal(newBgmEntrances([audio()], new Set(["12"]), 100, 102, 1).length, 0);
  assert.equal(newBgmEntrances([audio()], new Set(), 102, 103, 1).length, 0);
  assert.equal(newBgmEntrances([audio()], new Set(), 100, 120, 1).length, 0);
  assert.equal(newBgmEntrances([audio()], new Set(), 100, 102, 7).length, 0);
});
test("each keychain style has six independently calibrated hit targets", () => {
  for (const centers of Object.values(BGM_KEY_CENTERS)) {
    assert.equal(centers.length, 6);
    assert.equal(new Set(centers.map((point) => point.join(','))).size, 6);
    for (const [x, y] of centers) assert.ok(x > 25 && x < 90 && y > 25 && y < 85);
  }
  assert.notDeepEqual(BGM_KEY_CENTERS.blue, BGM_KEY_CENTERS.pink);
  assert.ok(BGM_KEY_CENTERS.blue[3][0] > BGM_KEY_CENTERS.blue[0][0]);
});

import assert from "node:assert/strict";
import test from "node:test";
import { diffSquareRevisionText } from "../src/lib/squareRevisionText.ts";

test("retains the entire caption and highlights the punctuation that was added", () => {
  assert.deepEqual(diffSquareRevisionText("四十段只是王者的上限", "四十段只是王者的上限。"), {
    parts: [{ text: "四十段只是王者的上限", changed: false }, { text: "。", changed: true }],
    removed: [],
  });
});

test("highlights independent replacements and keeps the intervening lines", () => {
  const before = "今天（早上）\n见到小明。";
  const after = "今天（下午）\n见到小李。";
  const diff = diffSquareRevisionText(before, after);
  assert.equal(diff.parts.map(part => part.text).join(""), after);
  assert.deepEqual(diff.parts.filter(part => part.changed).map(part => part.text), ["下午", "李"]);
  assert.deepEqual(diff.removed, ["早上", "明"]);
});

test("keeps emoji clusters and inline emoticon tokens intact", () => {
  assert.deepEqual(diffSquareRevisionText("👩‍💻[em]e4[/em]", "👩‍💻[em]e5[/em]"), {
    parts: [{ text: "👩‍💻", changed: false }, { text: "[em]e5[/em]", changed: true }],
    removed: ["[em]e4[/em]"],
  });
});

test("preserves the full current caption when an edit only removes text", () => {
  assert.deepEqual(diffSquareRevisionText("好，晚点聊。", "好。"), {
    parts: [{ text: "好。", changed: false }],
    removed: ["，晚点聊"],
  });
});

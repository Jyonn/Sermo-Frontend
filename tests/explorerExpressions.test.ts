import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EXPLORER_EXPRESSIONS, explorerExpressionForMessage, explorerExpressionSrc } from "../src/lib/explorerExpressions.ts";

test("message choices survive rerenders and appending other messages", () => {
  const clientId = "d726d193-6657-47a8-92e3-d02cc670f17f";
  const original = explorerExpressionForMessage(clientId);
  for (let index = 0; index < 100; index++) explorerExpressionForMessage(`another-message-${index}`);
  assert.equal(explorerExpressionForMessage(clientId), original);
});

test("message IDs distribute across all ten distinct faces", () => {
  const counts = new Map(EXPLORER_EXPRESSIONS.map((face) => [face, 0]));
  for (let index = 0; index < 5000; index++) {
    const face = explorerExpressionForMessage(`sample-message-${index}`);
    counts.set(face, counts.get(face)! + 1);
  }
  for (const count of counts.values()) assert.ok(count > 350 && count < 650);
});

test("all ten transparent portraits ship within a small mobile budget", () => {
  assert.equal(new Set(EXPLORER_EXPRESSIONS.map(explorerExpressionSrc)).size, 10);
  const files = EXPLORER_EXPRESSIONS.map((face) => readFileSync(new URL(`../public${explorerExpressionSrc(face)}`, import.meta.url)));
  assert.equal(new Set(files.map((file) => file.toString("base64"))).size, 10);
  for (const bytes of files) {
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.ok(bytes.length < 25_000);
  }
});

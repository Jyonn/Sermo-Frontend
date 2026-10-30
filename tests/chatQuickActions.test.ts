import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";
import { DEFAULT_CHAT_ACTIONS, availableChatActions, normalizeChatActions } from "../src/lib/chatQuickActions.ts";

test("preferences recover safely from stale or malformed storage and retain user order", () => {
  for (const value of [null, {}, "locked", [], ["retired"]]) assert.deepEqual(normalizeChatActions(value), [...DEFAULT_CHAT_ACTIONS]);
  assert.deepEqual(normalizeChatActions(["status", "copy", "status", "retired", "locked"]), ["status", "copy", "locked"]);
  assert.deepEqual(normalizeChatActions(["calendar"]), ["calendar"]);
  assert.deepEqual(normalizeChatActions(["search", "status", "copy", "locked", "calendar"]), ["search", "status", "copy", "locked"]);
});
test("unavailable actions vanish while remaining actions retain their configured order", () => {
  assert.deepEqual(availableChatActions([...DEFAULT_CHAT_ACTIONS], { locked: true, calendar: true, status: true }), ["locked", "calendar", "status"]);
  assert.deepEqual(availableChatActions(["status", "copy", "locked"], { copy: true, status: true }), ["status", "copy"]);
  assert.deepEqual(availableChatActions(["calendar"], { status: true }), []);
  assert.deepEqual(availableChatActions([...DEFAULT_CHAT_ACTIONS], {}), []);
});
test("quick action copy is available in every supported language", () => {
  const keys = ["title", "status", "settingsHint", "order", "moveUp", "moveDown", "reset", "noCopies", "online", "onlineCount", "detailActions"];
  for (const language of ["zh-CN", "zh-TW", "en", "ja", "ko", "es"]) {
    const copy = JSON.parse(fs.readFileSync(new URL(`../src/locales/${language}/translation.json`, import.meta.url), "utf8"));
    for (const key of keys) assert.ok(copy[`quickActions.${key}`]?.trim(), `${language}:${key}`);
  }
});

test("the shared row expands one to four equal slots, routes actions and never passes avatar frames", () => {
  const require = createRequire(import.meta.url); const exports: Record<string, any> = {};
  const Avatar = () => null;
  const source = fs.readFileSync(new URL("../src/components/ChatQuickActions.tsx", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require(name: string) {
    if (name === "../lib/language") return { useI18n: () => ({ t: (key: string) => key }) };
    if (name === "./UserAvatar") return { UserAvatar: Avatar };
    if (name.endsWith(".css")) return {};
    return require(name);
  } });
  const elements = (node: any): any[] => node?.props ? [node, ...React.Children.toArray(node.props.children).flatMap(elements)] : [];
  const selected: string[] = [];
  const props = { lockedCount: 3, lockedPreview: "locked", lockedBy: "author", copyCount: 2, copyPreview: "copy", members: Array.from({ length: 8 }, (_, userId) => ({ userId, name: "member", online: userId < 6 })), onLocked: () => selected.push("locked"), onCopy: () => selected.push("copy"), onStatus: () => selected.push("status") };
  for (let count = 1; count <= 4; count++) {
    const row = exports.ChatQuickActions({ ...props, actions: DEFAULT_CHAT_ACTIONS.slice(0, count), calendar: React.createElement("button", null, "calendar") });
    assert.equal(row.props.style.gridTemplateColumns, `repeat(${count}, minmax(0, 1fr))`);
    assert.equal(React.Children.count(row.props.children), count);
  }
  const row = exports.ChatQuickActions({ ...props, actions: ["status", "copy", "locked"] });
  const buttons = elements(row).filter(node => node.type === "button");
  buttons.forEach(button => button.props.onClick());
  assert.deepEqual(selected, ["status", "copy", "locked"]);
  const avatars = elements(row).filter(node => node.type === Avatar);
  assert.equal(avatars.length, 5);
  assert.ok(avatars.every(node => node.props.frame === undefined));
  assert.equal(exports.ChatQuickActions({ ...props, actions: [] }), null);
});

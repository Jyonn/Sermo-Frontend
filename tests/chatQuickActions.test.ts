import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";
import { DEFAULT_CHAT_ACTIONS, availableChatActions, normalizeChatActions, actionsForKind, reorderChatActions } from "../src/lib/chatQuickActions.ts";

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
test("legacy preferences migrate separately and direct chats never contain presence", () => {
  assert.deepEqual(actionsForKind([...DEFAULT_CHAT_ACTIONS], "direct"), ["locked", "calendar"]);
  assert.deepEqual(actionsForKind([...DEFAULT_CHAT_ACTIONS], "group"), ["locked", "copy", "status"]);
  const value = { direct: ["search", "calendar"], group: ["status", "locked"] };
  assert.deepEqual(actionsForKind(value, "direct"), ["search", "calendar"]);
  assert.deepEqual(actionsForKind(value, "group"), ["status", "locked"]);
  assert.deepEqual(actionsForKind(["status"], "direct"), ["locked", "calendar"]);
});
test("dragging retains neighbors and neither duplicates nor loses actions", () => {
  assert.deepEqual(reorderChatActions(["locked", "copy", "status"], "status", "locked"), ["status", "locked", "copy"]);
  assert.deepEqual(reorderChatActions(["locked", "copy", "status"], "locked", "status"), ["copy", "status", "locked"]);
  assert.deepEqual(reorderChatActions(["locked"], "search", "locked"), ["locked"]);
});
test("saving either tab preserves the other tab and isolates account storage", () => {
  const values = new Map<string, string>(); const exports: Record<string, any> = {};
  const source = fs.readFileSync(new URL("../src/lib/useChatQuickActions.ts", import.meta.url), "utf8");
  values.set("frienden:chat-quick-actions:v1:space:user", JSON.stringify(["status", "calendar", "locked", "copy"]));
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, Event, window: { dispatchEvent() {} }, localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
    require(name: string) { if (name === "react") return { useMemo: (fn: () => unknown) => fn(), useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() }; if (name === "./chatQuickActions") return { actionsForKind }; throw new Error(name); },
  });
  assert.deepEqual(exports.useChatQuickActions("space:user", "direct").actions, ["calendar", "locked"]);
  assert.equal(exports.useChatQuickActions("space:user", "direct").save(["search"]), true);
  assert.deepEqual(exports.useChatQuickActions("space:user", "group").actions, ["status", "locked", "copy"]);
  exports.useChatQuickActions("space:user", "group").save(["copy", "status"]);
  assert.deepEqual(exports.useChatQuickActions("space:user", "direct").actions, ["search"]);
  assert.deepEqual(exports.useChatQuickActions("space:other", "direct").actions, ["locked", "calendar"]);
});
test("quick action copy is available in every supported language", () => {
  const keys = ["title", "status", "entryHint", "order", "dragHint", "direct", "group", "selected", "available", "remove", "preview", "reset", "noCopies", "online", "onlineCount", "detailActions"];
  for (const language of ["zh-CN", "zh-TW", "en", "ja", "ko", "es"]) {
    const copy = JSON.parse(fs.readFileSync(new URL(`../src/locales/${language}/translation.json`, import.meta.url), "utf8"));
    for (const key of keys) assert.ok(copy[`quickActions.${key}`]?.trim(), `${language}:${key}`);
  }
});

test("the shared row retains one to four ordered actions, routes actions and never passes avatar frames", () => {
  const require = createRequire(import.meta.url); const exports: Record<string, any> = {};
  const Avatar = () => null;
  const source = fs.readFileSync(new URL("../src/components/ChatQuickActions.tsx", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require(name: string) {
    if (name === "../lib/language") return { useI18n: () => ({ t: (key: string) => key }) };
    if (name === "./UserAvatar") return { UserAvatar: Avatar };
    if (name === "./ChatActionIcon") return { ChatActionIcon: () => null };
    if (name === "../lib/useQuickActionLayout") return { useQuickActionLayout: () => ({ current: null }) };
    if (name.endsWith(".css")) return {};
    return require(name);
  } });
  const elements = (node: any): any[] => node?.props ? [node, ...React.Children.toArray(node.props.children).flatMap(elements)] : [];
  const selected: string[] = [];
  const props = { lockedCount: 3, lockedPreview: "locked", lockedBy: "author", copyCount: 2, copyPreview: "copy", members: Array.from({ length: 8 }, (_, userId) => ({ userId, name: "member", online: userId < 6 })), onLocked: () => selected.push("locked"), onCopy: () => selected.push("copy"), onStatus: () => selected.push("status") };
  for (let count = 1; count <= 4; count++) {
    const row = exports.ChatQuickActions({ ...props, actions: DEFAULT_CHAT_ACTIONS.slice(0, count), calendar: React.createElement("button", null, "calendar") });
    assert.equal(row.props.style, undefined);
    const actions = React.Children.toArray(row.props.children).filter((child: any) => child.props["data-action"]);
    assert.equal(actions.length, count);
    assert.deepEqual(actions.map((child: any) => child.props["data-action"]), DEFAULT_CHAT_ACTIONS.slice(0, count));
  }
  const row = exports.ChatQuickActions({ ...props, actions: ["status", "copy", "locked"] });
  const buttons = elements(row).filter(node => node.type === "button");
  buttons.forEach(button => button.props.onClick());
  assert.deepEqual(selected, ["status", "copy", "locked"]);
  const avatars = elements(row).filter(node => node.type === Avatar);
  assert.equal(avatars.length, 5);
  assert.ok(avatars.every(node => node.props.frame === undefined));
  const hidden = exports.ChatQuickActions({ ...props, actions: [] });
  assert.equal(hidden.props["aria-hidden"], true);
  assert.equal(hidden.props.inert, "");
  const loading = exports.ChatQuickActions({ ...props, actions: [], loading: true });
  assert.equal(loading.props["aria-busy"], true);
  assert.equal(loading.props["aria-hidden"], false);
  const collapsed = exports.ChatQuickActions({ ...props, actions: ["locked"], open: false });
  assert.equal(collapsed.props["aria-hidden"], true);
  assert.equal(elements(collapsed).filter(node => node.type === "button").length, 1, "keep children mounted for the exit transition");
  assert.equal(collapsed.props.inert, "", "collapsed controls cannot receive input or focus");
});

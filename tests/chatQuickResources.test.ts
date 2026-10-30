import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as groupCopy from "../src/lib/groupCopy.ts";

function resources() {
  const states: any[] = []; let cursor = 0; let effect: (() => () => void) | undefined; let cleanup: (() => void) | undefined;
  const events = new EventTarget();
  const requests: Array<{ chatId: number; resolve: (data: any) => void; reject: (error: Error) => void }> = [];
  const timers: Array<() => void> = [];
  class ApiError extends Error { status: number; constructor(status: number) { super("denied"); this.status = status; } }
  const exports: Record<string, any> = {};
  const source = fs.readFileSync(new URL("../src/lib/useGroupCopySuggestions.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, AbortController, Set, document: { hidden: false },
    window: { addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), setInterval: () => 1, clearInterval() {}, setTimeout: (fn: () => void) => { timers.push(fn); return timers.length; }, clearTimeout() {} },
    require(name: string) {
      if (name === "react") return { useEffect(fn: () => () => void) { effect = fn; }, useState(initial: any) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], (next: any) => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; } };
      if (name === "./api") return { ApiError, api: { getCopySuggestions: (chatId: number) => new Promise((resolve, reject) => requests.push({ chatId, resolve, reject })) } };
      if (name === "./chatSync") return { CHAT_SYNC_EVENT: "sync" };
      if (name === "./groupCopy") return groupCopy;
      throw new Error(name);
    },
  });
  const render = (chatId: number) => { cursor = 0; return exports.useGroupCopySuggestions(chatId, 7); };
  return { requests, render, ApiError, flushTimers() { timers.splice(0).forEach(fn => fn()); }, mount(chatId: number) { cleanup?.(); const value = render(chatId); cleanup = effect?.(); return value; }, emit(type: string, detail: any) { const event = new Event(type); Object.assign(event, { detail }); events.dispatchEvent(event); }, dispose() { cleanup?.(); } };
}
const item = (id: number) => ({ message_id: id, content: "text", author: "member", created_at: Date.now() / 1000, copied: false });
const flush = () => new Promise(setImmediate);

test("switching chats never exposes the previous suggestions or accepts an aborted response", async () => {
  const h = resources(); h.mount(10); h.mount(20);
  h.requests[0].resolve({ items: [item(1)] }); await flush();
  assert.equal(h.render(20).items.length, 0);
  h.requests[1].resolve({ items: [item(2)] }); await flush();
  assert.equal(h.render(20).items[0].message_id, 2);
  assert.equal(h.render(10).items.length, 0);
  h.dispose();
});
test("copies and removals during loading survive the delayed server snapshot", async () => {
  const h = resources(); h.mount(10);
  h.emit(groupCopy.GROUP_COPY_EVENT, { chatId: 10, userId: 7, ids: [1] });
  h.emit(groupCopy.GROUP_COPY_REMOVED, { chatId: 10, ids: [2] });
  h.requests[0].resolve({ items: [item(1), item(2), item(3)] }); await flush();
  assert.deepEqual(Array.from(h.render(10).items, (value: any) => value.message_id), [3, 1]);
  assert.equal(h.render(10).items[1].copied, true);
  h.dispose();
});
test("permission denial clears suggestions rather than retaining previously visible text", async () => {
  const h = resources(); h.mount(10);
  h.requests[0].resolve({ items: [item(1)] }); await flush();
  h.emit("sync", { items: [{ chatId: 10 }], removed: [] }); h.flushTimers();
  h.requests[1].reject(new h.ApiError(403)); await flush();
  assert.equal(h.render(10).items.length, 0);
  assert.equal(h.render(10).error, true);
  h.dispose();
});

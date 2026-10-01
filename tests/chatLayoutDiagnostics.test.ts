import assert from "node:assert/strict";
import test from "node:test";

const stored = new Map<string, string>();
const browser = Object.assign(new EventTarget(), {
  localStorage: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); },
    removeItem: (key: string) => { stored.delete(key); },
  },
  setTimeout,
  clearTimeout,
});
Object.defineProperty(globalThis, "window", { configurable: true, value: browser });

const diagnostics = await import("../src/lib/chatLayoutDiagnostics.ts");

test("layout diagnostics are opt-in, bounded, and numeric-only", () => {
  diagnostics.recordChatLayout("viewport", { height: 600 });
  assert.equal(diagnostics.getChatLayoutDiagnostics().entries.length, 0);

  diagnostics.setChatLayoutDiagnosticsEnabled(true);
  for (let index = 0; index < 185; index += 1) {
    diagnostics.recordChatLayout("layout", { height: index, unsafe: "message text" } as never);
  }
  const entries = diagnostics.getChatLayoutDiagnostics().entries;
  assert.equal(entries.length, 180);
  assert.deepEqual(entries[0].metrics, { height: 5 });
  assert.equal(diagnostics.chatLayoutDiagnosticsReport().includes("message text"), false);

  diagnostics.setChatLayoutDiagnosticsEnabled(false);
  diagnostics.recordChatLayout("layout", { height: 999 });
  assert.equal(diagnostics.getChatLayoutDiagnostics().entries.length, 180);
  diagnostics.clearChatLayoutDiagnostics();
  assert.equal(diagnostics.getChatLayoutDiagnostics().entries.length, 0);
});

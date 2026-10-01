import assert from "node:assert/strict";
import test from "node:test";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    dispatchEvent: () => true,
    setTimeout,
    clearTimeout,
  },
});

const diagnostics = await import("../src/lib/chatLayoutDiagnostics.ts");

test("persistent debugger remains visible independently of recording", () => {
  diagnostics.setDebuggerVisible(true);
  assert.equal(diagnostics.getChatLayoutDiagnostics().debuggerVisible, true);
  assert.equal(storage.get("sermo:developer-tools-visible"), "true");
  assert.equal(diagnostics.getChatLayoutDiagnostics().recording, false);

  diagnostics.setChatLayoutDiagnosticsEnabled(true);
  diagnostics.recordChatLayout("keyboard", { open: true });
  assert.equal(diagnostics.getChatLayoutDiagnostics().entries.length, 1);

  diagnostics.setChatLayoutDiagnosticsRecording(false);
  assert.equal(storage.get("sermo:chat-layout-diagnostics-recording"), "false");
  diagnostics.recordChatLayout("keyboard", { open: false });
  assert.equal(diagnostics.getChatLayoutDiagnostics().entries.length, 1);

  diagnostics.setChatLayoutDiagnosticsRecording(true);
  diagnostics.recordChatLayout("keyboard", { open: false });
  assert.equal(diagnostics.getChatLayoutDiagnostics().entries.length, 2);

  diagnostics.setChatLayoutDiagnosticsEnabled(false);
  assert.equal(diagnostics.getChatLayoutDiagnostics().recording, false);
  assert.equal(diagnostics.getChatLayoutDiagnostics().debuggerVisible, true);
  assert.equal(diagnostics.getChatLayoutDiagnostics().entries.length, 2);
  diagnostics.setChatLayoutDiagnosticsRecording(true);
  assert.equal(diagnostics.getChatLayoutDiagnostics().recording, false);

  diagnostics.setDebuggerVisible(false);
  diagnostics.clearChatLayoutDiagnostics();
});

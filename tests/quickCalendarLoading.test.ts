import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("calendar loading settles for hidden calendars, failures and rapid conversation changes", async () => {
  const states: any[] = []; let cursor = 0; let effect: (() => () => void) | undefined; let cleanup: (() => void) | undefined;
  const requests: Array<{ resolve: (value: any) => void; reject: (error: Error) => void }> = [];
  const exports: Record<string, any> = {};
  const now = new Date(2026, 9, 31, 12);
  const source = fs.readFileSync(new URL("../src/components/ChatCalendarAvailability.tsx", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, AbortController, URLSearchParams, Date, window: { setTimeout: () => 1, clearTimeout() {} },
    require(name: string) {
      if (name === "react") return { useEffect(fn: () => () => void) { effect = fn; }, useState(initial: any) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], (next: any) => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; } };
      if (name === "../lib/auth") return { useAuth: () => ({ session: { accessToken: "test", user: { space_id: 1, user_id: 2 } } }) };
      if (name === "../lib/pageActivity") return { usePageActive: () => true };
      if (name === "./CalendarAvailabilityBar") return { useCalendarClock: () => now };
      if (name === "../lib/chronelleAgenda") return { agendaDay: (date: Date, offset = 0) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset) };
      if (name === "../lib/chronelleProfile") return { profileAgenda: (value: any) => value };
      if (name === "../lib/api") return { ApiError: Error, api: { chronelleProfile: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) } };
      return {};
    },
  });
  const render = (peer?: number) => { cursor = 0; return exports.useChatCalendarAvailability(peer); };
  const mount = (peer: number) => { cleanup?.(); render(peer); cleanup = effect?.(); };
  const flush = () => new Promise(setImmediate);
  assert.equal(render().loading, false);
  mount(10); assert.equal(render(10).loading, true);
  requests[0].resolve({ hidden: true }); await flush();
  assert.equal(render(10).loading, false); assert.equal(render(10).data, null);
  mount(20); mount(30);
  requests[1].resolve({ hidden: false, known: true, events: [] }); await flush();
  assert.equal(render(30).loading, true); assert.equal(render(30).data, null);
  requests[2].reject(new Error("offline")); await flush();
  assert.equal(render(30).loading, false); assert.equal(render(30).data.error, true);
  cleanup?.();
});

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function memory(refresh: (session: any) => Promise<any> = async (session) => session) {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), key: (index: number) => Array.from(values.keys())[index] ?? null, get length() { return values.size; } };
  class ApiError extends Error { status = 401; }
  const exports: Record<string, any> = {};
  const source = fs.readFileSync(new URL("../src/lib/pwaAccounts.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, window: { localStorage: storage }, Date, Map, DOMException,
    require(name: string) {
      if (name === "./api") return { ApiError, refreshDetachedAuthSession: refresh };
      if (name === "./recentSpaces") return { listRecentSpaces: () => [] };
      throw new Error(name);
    },
  });
  return { api: exports, storage, ApiError };
}
const session = (id: number) => ({ accessToken: "fixture", refreshToken: `fixture-${id}`, user: { user_id: id } });

test("active identity is remembered exactly and logout clears its launch preference", () => {
  const { api } = memory();
  api.rememberPwaAccountSession(session(1), "same-space");
  api.rememberPwaAccountSession(session(2), "same-space");
  assert.equal(api.getDefaultPwaAccountKey(), "same-space:2");
  assert.equal(api.listPwaCachedAccounts().length, 2);
  api.forgetPwaAccountSession(session(2), "same-space");
  assert.equal(api.getDefaultPwaAccountKey(), "");
  assert.equal(api.listPwaCachedAccounts()[0].key, "same-space:1");
});

test("expired cached identity cannot reappear from scoped storage after refresh", async () => {
  let error: Error;
  const { api, storage, ApiError } = memory(async () => { throw error; });
  error = new ApiError("expired");
  api.rememberPwaAccountSession(session(1), "space");
  storage.setItem("sermo.auth.session:space", JSON.stringify(session(1)));
  assert.equal((await api.refreshPwaCachedAccounts()).length, 0);
  assert.equal(storage.getItem("sermo.auth.session:space"), null);
});

test("transient refresh failure retains cached identity for offline startup", async () => {
  const { api } = memory(async () => { throw new Error("offline"); });
  api.rememberPwaAccountSession(session(1), "space");
  assert.equal((await api.refreshPwaCachedAccounts())[0].key, "space:1");
});

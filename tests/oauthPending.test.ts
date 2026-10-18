import assert from "node:assert/strict";
import test from "node:test";
import { rememberOAuthRequest, readOAuthRequest, clearOAuthRequest, rememberAdminOAuthRequest, readAdminOAuthRequest } from "../src/lib/oauthPending.ts";
import { oauthVerificationReturn, oauthVerificationTarget } from "../src/lib/oauthConsent.ts";

test("space request survives registration and both verification returns without rebuilding OAuth parameters", () => {
  const saved = new Map<string,string>();
  const storage = { getItem: (key:string) => saved.get(key) ?? null, setItem: (key:string,value:string) => saved.set(key,value), removeItem: (key:string) => saved.delete(key) };
  Object.defineProperty(globalThis, "sessionStorage", { configurable:true, value:storage });
  const now=Date.now;
  const start=now();
  try {
    const search="?request_id="+"a".repeat(43);
    rememberAdminOAuthRequest(search);
    assert.equal(readAdminOAuthRequest(),`/oauth/authorize${search}`);
    Date.now=()=>start+20*60_000;
    assert.equal(readOAuthRequest(),`/oauth/authorize${search}`);
    for (const channel of ["email","phone"] as const) {
      const target=oauthVerificationTarget(channel,search);
      assert.equal(oauthVerificationReturn(target.state,"?oauth=1",readOAuthRequest()),`/oauth/authorize${search}`);
    }
    Date.now=()=>start+31*60_000;
    assert.equal(readOAuthRequest(),null);
    Date.now=()=>start;
    rememberOAuthRequest(search);
    clearOAuthRequest();
    assert.equal(readOAuthRequest(),null);
    assert.equal(readAdminOAuthRequest(),null);
    rememberOAuthRequest("?client_id=legacy");
    assert.equal(readAdminOAuthRequest(),null);
    Date.now=()=>start+11*60_000;
    assert.equal(readOAuthRequest(),null);
  } finally {
    Date.now=now;
    Reflect.deleteProperty(globalThis,"sessionStorage");
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { rememberOAuthRequest, readOAuthRequest, clearOAuthRequest, rememberAdminOAuthRequest, readAdminOAuthRequest, beginOAuthLogin, isOAuthLoginPending, completeOAuthLogin, oauthReturnForAccount } from "../src/lib/oauthPending.ts";
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

test("a newly selected identity replaces only the legacy login hint and never alters bound requests",()=>{
  const pending="/oauth/authorize?client_id=fixture&state=a%2Bb%2Fc%3D&code_challenge="+"a".repeat(43)+"&redirect_uri=https%3A%2F%2Fexample.test%2Fcallback%3Fx%3D1&login_hint=old%3A1";
  const before=new URLSearchParams(pending.slice('/oauth/authorize'.length));
  const after=new URLSearchParams(oauthReturnForAccount(pending,'new',2).slice('/oauth/authorize'.length));
  for(const key of ['client_id','state','code_challenge','redirect_uri'])assert.equal(after.get(key),before.get(key));
  assert.equal(after.get('login_hint'),'new:2');
  const bound='/oauth/authorize?request_id='+'a'.repeat(43);
  assert.equal(oauthReturnForAccount(bound,'new',2),bound);
});

test("explicit sign-in blocks automatic OAuth resume until login, and cancel/back cannot restore it", () => {
  const saved=new Map<string,string>();
  Object.defineProperty(globalThis,"sessionStorage",{configurable:true,value:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v),removeItem:(k:string)=>saved.delete(k)}});
  const search="?client_id=fixture&state=opaque%2Bstate%2Fkeep&code_challenge="+"a".repeat(43)+"&scope=profile%20email";
  try {
    beginOAuthLogin(search);
    assert.equal(isOAuthLoginPending(),true);
    assert.equal(readOAuthRequest(),"/oauth/authorize"+search);
    rememberOAuthRequest(search); // Going Back to consent does not clear login intent.
    assert.equal(isOAuthLoginPending(),true);
    completeOAuthLogin();
    assert.equal(isOAuthLoginPending(),false);
    assert.equal(readOAuthRequest(),"/oauth/authorize"+search);
    beginOAuthLogin(search);
    clearOAuthRequest();
    assert.equal(isOAuthLoginPending(),false);
    assert.equal(readOAuthRequest(),null);
    rememberOAuthRequest("?request_id="+"b".repeat(43));
    assert.equal(isOAuthLoginPending(),false);
  } finally { Reflect.deleteProperty(globalThis,"sessionStorage"); }
});

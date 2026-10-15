import assert from "node:assert/strict";
import test from "node:test";
import { buildStillfolioLoginUrl, parseSermoLoginHint } from "../src/lib/stillfolioLogin.ts";

test("launch URL targets the automatic login entry with only account selection context", () => {
  const url = new URL(buildStillfolioLoginUrl("WZRY", 54));
  assert.equal(url.origin, "https://stillfolio.jyonn.space");
  assert.equal(url.pathname, "/auth/sermo/start");
  assert.deepEqual([...url.searchParams], [["source", "sermo"], ["login_hint", "wzry:54"]]);
});

test("account hints accept safe space and user identifiers", () => {
  assert.deepEqual(parseSermoLoginHint("jzdxq:57"), { slug: "jzdxq", userId: 57 });
  for (const value of [null, "", "../oauth:57", "space/path:57", "space:0", "space:-1", "space:1.5", "space:9007199254740992", "space:57:1"]) {
    assert.equal(parseSermoLoginHint(value), null, String(value));
  }
});

test("missing or invalid account context still opens the safe login entry", () => {
  const url = new URL(buildStillfolioLoginUrl("../other", 57));
  assert.equal(url.pathname, "/auth/sermo/start");
  assert.equal(url.searchParams.has("login_hint"), false);
});

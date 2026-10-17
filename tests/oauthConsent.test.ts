import assert from "node:assert/strict";
import test from "node:test";
import { oauthVerificationTarget, oauthVerificationReturn, safeOAuthVerificationReturn, oauthIconUrl } from "../src/lib/oauthConsent.ts";

test("both existing contact flows retain the opaque OAuth request exactly", () => {
  const search = "?client_id=any-app&redirect_uri=https%3A%2F%2Fapp.example%2Fcallback%3Fa%3D1&state=a%2Bb%2Fc%3D%3D&scope=profile%20email&code_challenge=abc&code_challenge_method=S256&response_type=code&login_hint=space%3A7";
  for (const channel of ["email", "phone"] as const) {
    const target = oauthVerificationTarget(channel, search);
    assert.match(target.to, new RegExp(`sheet=${channel}-verification&oauth=1`));
    assert.equal(oauthVerificationReturn(target.state, target.to.split("?")[1], null), `/oauth/authorize${search}`);
    assert.equal(oauthVerificationReturn(null, "?oauth=1", `/oauth/authorize${search}`), `/oauth/authorize${search}`);
    assert.equal(oauthVerificationReturn(target.state, "?sheet=email-verification", `/oauth/authorize${search}`), null);
  }
});

test("verification never returns to an external URL, unrelated route or fragment", () => {
  for (const value of ["https://evil.test/oauth/authorize?a=1", "//evil.test/oauth/authorize?a=1", "/app/chats", "/oauth/authorize-other?a=1", "/oauth/authorize?a=1#fragment", "/oauth/authorize/../app?x=1", null]) assert.equal(safeOAuthVerificationReturn(value), null);
});

test("requester icons require safe HTTPS and never infer a client-specific logo", () => {
  assert.equal(oauthIconUrl("https://brand.example/icon.svg?v=1"), "https://brand.example/icon.svg?v=1");
  for (const value of [undefined, "", "http://brand.example/icon.png", "data:image/svg+xml,test", "javascript:alert(1)", "https://user:secret@brand.example/icon.png", "https://brand.example/icon.svg#fragment"]) assert.equal(oauthIconUrl(value), null);
});

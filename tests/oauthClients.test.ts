import assert from "node:assert/strict";
import test from "node:test";
import { validOAuthReturn } from "../src/lib/oauthClients.ts";

test("accept exact registered callbacks including loopback and existing query", () => {
  for (const callback of ["https://example.com/cb", "https://example.com/cb?tenant=a", "http://127.0.0.1:8001/api/auth/friendom/callback/"]) {
    const url = new URL(callback);
    url.searchParams.append("code", "c".repeat(43));
    url.searchParams.append("state", "s".repeat(32));
    assert.equal(validOAuthReturn(url.href, callback, "s".repeat(32)), true);
  }
});

test("reject changed host, path, query, state, fragment, duplicate parameters", () => {
  const callback = "https://example.com/cb?tenant=a";
  const valid = `${callback}&code=abc&state=state`;
  for (const uri of [valid.replace("example.com", "evil.com"), valid.replace("/cb", "/other"), valid.replace("tenant=a", "tenant=b"), valid.replace("state=state", "state=other"), `${valid}#fragment`, `${valid}&code=second`, `${valid}&state=state`, `${valid}&extra=yes`, `${callback}&state=state`]) {
    assert.equal(validOAuthReturn(uri, callback, "state"), false);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { oauthClient } from "../src/lib/oauthClients.ts";

test("Supervision local has its own exact loopback callback and profile-only scope", () => {
  const client = oauthClient("supervision-local", "https://stillfolio.example/callback");
  assert.equal(client?.callback, "http://127.0.0.1:8001/api/auth/friendom/callback/");
  assert.deepEqual(client?.scopes, ["profile"]);
  assert.equal(client?.nameKey, "apps.supervision");
  assert.equal(client?.label, "SUPERVISION");
});

test("Chronelle has an exact callback and profile-only scopes", () => {
  const client = oauthClient("chronelle", "https://stillfolio.example/callback");
  assert.equal(client?.callback, "https://chronelle.jyonn.space/api/profile/sermo/callback/");
  assert.deepEqual(client?.scopes, ["profile"]);
  assert.equal(client?.nameKey, "chronelle.title");
});

test("StillFolio retains its callback override and scopes; unknown clients are rejected", () => {
  const client = oauthClient("stillfolio", "https://stillfolio.example/callback");
  assert.equal(client?.callback, "https://stillfolio.example/callback");
  assert.deepEqual(client?.scopes, ["profile", "phone", "vip"]);
  assert.equal(oauthClient("unknown", ""), null);
  assert.equal(oauthClient(null, ""), null);
});

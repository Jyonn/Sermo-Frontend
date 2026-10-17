import assert from "node:assert/strict";
import test from "node:test";
import { currentOAuthRevision, filterOAuthApplications, oauthApplicationName, oauthApplicationStatus } from "../src/lib/oauthApplicationPresentation.ts";
import type { OAuthApplication } from "../src/lib/oauthClients.ts";

const app = (id: number, name: string): OAuthApplication => ({ id, client_id: name.toLowerCase(), owner_id: null, enabled: true, version: 1, approved_revision_id: id, revisions: [{ id, name, description: "", redirect_uris: ["https://example.com/cb"], scopes: ["profile"], loopback_uris: [], status: "approved", review_note: "", reviewed_at: null, reviewed_by: "" }], audit: [] });

test("pending configuration never replaces the approved name or scope summary", () => {
  const item = app(1, "Approved");
  item.revisions.unshift({ ...item.revisions[0], id: 2, name: "Pending rename", scopes: ["profile", "email"], status: "pending" });
  assert.equal(oauthApplicationName(item), "Approved");
  assert.deepEqual(currentOAuthRevision(item)?.scopes, ["profile"]);
  assert.equal(oauthApplicationStatus(item), "pending");
  item.enabled = false;
  assert.equal(oauthApplicationStatus(item), "disabled");
  assert.deepEqual(filterOAuthApplications([item], "pending", "pending rename"), [item]);
  assert.deepEqual(filterOAuthApplications([item], "enabled", ""), []);
});

test("directory filters work with missing approval, empty revisions and public client IDs", () => {
  const active = app(1, "Alpha");
  const draft = { ...app(2, "Beta"), approved_revision_id: null };
  draft.revisions[0].status = "draft";
  const disabled = { ...app(3, "Gamma"), enabled: false };
  const empty = { ...app(4, "Empty"), approved_revision_id: null, revisions: [] };
  assert.equal(oauthApplicationName(empty), "empty");
  assert.equal(oauthApplicationStatus(empty), "draft");
  assert.deepEqual(filterOAuthApplications([active, draft, disabled, empty], "enabled", ""), [active]);
  assert.deepEqual(filterOAuthApplications([active, draft, disabled], "disabled", " GAMMA "), [disabled]);
  assert.deepEqual(filterOAuthApplications([active, draft, disabled], "all", "beta"), [draft]);
});

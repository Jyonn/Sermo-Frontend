import assert from "node:assert/strict";
import test from "node:test";
import { canManageOAuthApplications } from "../src/lib/oauthDeveloperAccess.ts";
import type { SpaceDTO } from "../src/types.ts";

test("developer management is fail-closed, grant-driven and scoped to the current account", () => {
  const dev = { space_id: 1, slug: "dev", oauth_developer_available: true } as SpaceDTO;
  assert.equal(canManageOAuthApplications(dev, 1), true);
  assert.equal(canManageOAuthApplications({ ...dev, slug: "other" }, 1), true);
  assert.equal(canManageOAuthApplications({ ...dev, oauth_developer_available: false }, 1), false);
  assert.equal(canManageOAuthApplications({ ...dev, oauth_developer_available: undefined }, 1), false);
  assert.equal(canManageOAuthApplications(dev, 2), false);
  assert.equal(canManageOAuthApplications(null, 1), false);
});

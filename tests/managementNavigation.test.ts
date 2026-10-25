import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { managementSection, managementSettingsForSection, platformManagementSections, spaceManagementSections } from "../src/lib/managementNavigation.ts";

test("management destinations support deep links, safe fallbacks and the former space menu", () => {
  for (const section of spaceManagementSections) assert.equal(managementSection(section, spaceManagementSections, "members"), section);
  for (const section of platformManagementSections) assert.equal(managementSection(section, platformManagementSections, "overview"), section);
  assert.equal(managementSection("menu", spaceManagementSections, "members"), "basics");
  assert.equal(managementSection("emailReview", spaceManagementSections, "members"), "members");
  assert.equal(managementSection("unknown", platformManagementSections, "overview"), "overview");
  assert.equal(managementSection(null, platformManagementSections, "overview"), "overview");
});

test("space tasks are inline destinations, only contextual operations remain drawers", () => {
  const source = readFileSync(new URL("../src/pages/SpaceAdminDashboardPage.tsx", import.meta.url), "utf8");
  for (const section of spaceManagementSections) assert.ok(source.includes(`activeTab === "${section}"`) || section === "features");
  assert.doesNotMatch(source, /historyKey="admin-(?:operators|activities|square-mutes|features|unverified-policy|basic-settings|verification)"/);
  assert.match(source, /historyKey="admin-member-detail"/);
  assert.match(source, /requestedTab === "square" \|\| requestedTab === "mutes"/);
  assert.match(source, /next.set\("section", section\)/);
});

test("platform separates delivery history from message inspection and preserves scoped workspaces", () => {
  const source = readFileSync(new URL("../src/pages/PlatformAdminPage.tsx", import.meta.url), "utf8");
  assert.match(source, /section === "emailReview" \? <EmailReviewPanel/);
  assert.doesNotMatch(source, /section === "emails" \?[^\n]*<EmailReviewPanel/);
  assert.match(source, /<PermissionWorkspace scope="platform"/);
  assert.match(source, /<OAuthApplicationWorkspace platform/);
  assert.match(source, /next.set\("section", value\)/);
  assert.match(source, /historyKey="platform-debug-report"/);
  assert.match(source, /request === debugRequest.current/);
  assert.doesNotMatch(source, /aria-label="查看调试报告"/);
});

test("saving one settings page cannot publish another page's unsaved switches or access rules", () => {
  const saved = { name: "Original", member_limit: 30, level_names: ["A"], chat_enabled: 1, group_square_enabled: 1, unverified_group_policy: 0, oauth_developer_enabled: 0 };
  const draft = { name: "Draft", member_limit: 50, level_names: ["B"], chat_enabled: 0, group_square_enabled: 0, unverified_group_policy: 2, oauth_developer_enabled: 1 };
  assert.deepEqual(managementSettingsForSection("basics", saved, draft), { ...saved, name: "Draft", member_limit: 50 });
  assert.deepEqual(managementSettingsForSection("levels", saved, draft), { ...saved, level_names: ["B"] });
  assert.deepEqual(managementSettingsForSection("features", saved, draft), { ...saved, chat_enabled: 0, group_square_enabled: 0, oauth_developer_enabled: 1 });
  assert.deepEqual(managementSettingsForSection("access", saved, draft), { ...saved, unverified_group_policy: 2 });
  assert.deepEqual(managementSettingsForSection("members", saved, draft), saved);
  assert.equal(saved.name, "Original");
  assert.equal(draft.name, "Draft");
});

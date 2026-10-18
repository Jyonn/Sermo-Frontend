import assert from "node:assert/strict";
import test from "node:test";
import { SITE_ORIGINS, migrationDestination } from "../src/lib/siteOrigins.ts";
import { approvedMigrationDestination, claimMigrationNotice, MIGRATION_NOTICE_INTERVAL } from "../src/lib/siteMigration.ts";

const ready = { enabled: true, readyOrigins: SITE_ORIGINS.slice(0, 2).map((site) => site.origin) };
test("only exact legacy hosts migrate to the matching new site without request parameters", () => {
  assert.equal(migrationDestination("sermo.jyonn.space"), "https://frienden.jyonn.space");
  assert.equal(migrationDestination("sermo.6-79.cn"), "https://frienden.6-79.cn");
  for (const host of ["frienden.jyonn.space", "frienden.6-79.cn", "localhost", "sermo.jyonn.space.evil.test"]) assert.equal(migrationDestination(host), null);
});
test("notices require explicit readiness for both new sites", () => {
  for (const config of [null, {}, { ...ready, enabled: false }, { enabled: true, readyOrigins: [ready.readyOrigins[0]] }]) assert.equal(approvedMigrationDestination("sermo.jyonn.space", config), null);
  assert.equal(approvedMigrationDestination("sermo.jyonn.space", ready), ready.readyOrigins[0]);
  assert.equal(approvedMigrationDestination("frienden.jyonn.space", ready), null);
});
test("weekly limit is recorded on display, including reloads and future timestamps", () => {
  let value: string | null = null;
  const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
  const now = 1_000_000;
  assert.equal(claimMigrationNotice(storage, now), true);
  assert.equal(claimMigrationNotice(storage, now), false);
  assert.equal(claimMigrationNotice(storage, now + MIGRATION_NOTICE_INTERVAL - 1), false);
  assert.equal(claimMigrationNotice(storage, now - 100), false);
  assert.equal(claimMigrationNotice(storage, now + MIGRATION_NOTICE_INTERVAL), true);
});
test("unavailable storage suppresses the notice instead of repeatedly interrupting", () => {
  assert.equal(claimMigrationNotice({ getItem: () => { throw Error("blocked"); }, setItem() {} }), false);
});

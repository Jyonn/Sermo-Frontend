import assert from "node:assert/strict";
import test from "node:test";
import { groupSwitchAccounts } from "../src/lib/accountGroups.ts";
import { pwaLaunchAccount } from "../src/lib/pwaLaunch.ts";
import type { SwitchAccountDTO } from "../src/types";
import { activityBannerStops } from "../src/lib/activityBannerStops.ts";

test("banner navigation skips unreachable duplicate stops when multiple cards fit", () => {
  assert.deepEqual(activityBannerStops(300, 1236, [0, 312, 624, 936]), [0, 312, 624, 936]);
  assert.deepEqual(activityBannerStops(900, 1204, [0, 304, 608, 912]), [0, 304]);
  assert.deepEqual(activityBannerStops(1200, 1200, [0, 404, 808]), [0]);
});

test("switcher groups all identities by space without merging admin and regular accounts", () => {
  const account = (space: number, user: number, official = false) => ({ space: { space_id: space }, user: { user_id: user, official } }) as SwitchAccountDTO;
  const groups = groupSwitchAccounts([account(1, 10), account(2, 20), account(1, 11, true)]);
  assert.deepEqual(groups.map((group) => group.accounts.map(({ user }) => user.user_id)), [[10, 11], [20]]);
  assert.equal(groups[0].accounts[1].user.official, true);
  assert.deepEqual(groupSwitchAccounts([]), []);
});

test("installed launch restores the exact last identity, including another account in the same space", () => {
  const accounts = [{ key: "space:admin" }, { key: "space:regular" }, { key: "other:regular" }];
  assert.equal(pwaLaunchAccount(accounts, "?source=pwa&shortcut=menu", "space:regular", false), accounts[1]);
  assert.equal(pwaLaunchAccount(accounts, "?source=pwa", "removed:account", false), undefined);
  for (const search of ["", "?choose=1&source=pwa", "?source=pwa&oauth_login=1"]) {
    assert.equal(pwaLaunchAccount(accounts, search, "space:regular", false), undefined);
  }
  assert.equal(pwaLaunchAccount(accounts, "?source=pwa", "space:regular", true), undefined);
});

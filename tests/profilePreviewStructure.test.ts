import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const menu = readFileSync(new URL("../src/pages/MenuPage.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/components/UserProfilePanel.tsx", import.meta.url), "utf8");
const sharedDrawer = readFileSync(new URL("../src/components/MyProfileCardDrawer.tsx", import.meta.url), "utf8");
test("my card uses the same full-bleed drawer composition as other profiles", () => {
  const drawer = sharedDrawer.slice(sharedDrawer.indexOf('<SideDrawer headerless historyKey="my-profile-card"'));
  const content = drawer.slice(0, drawer.indexOf("</SideDrawer>"));
  assert.match(content, /<UserProfilePanel/);
  assert.doesNotMatch(content, /more-apps-drawer|<UserProfileCard/);
  assert.match(content, /previewAudience=\{audience\}/);
  assert.match(content, /floatingAccessory=/);
  assert.doesNotMatch(panel, /profile\.cardAudience/);
});
test("my card entry follows the basic fields in its own section", () => {
  const basic = menu.slice(menu.indexOf('<SideDrawer historyKey="basic-info"'), menu.indexOf('<MyProfileCardDrawer'));
  assert.ok(basic.indexOf('aria-label={t("profile.myCard")}') > basic.indexOf('t("profile.welcome")'));
});
test("preview relationship controls cannot mutate the current user's friendships", () => {
  for (const action of ["openChat", "sendRequest", "updateReminder", "openGroupPicker", "setRemoveConfirmOpen"]) {
    const buttons = panel.split("\n").filter((line) => line.includes("<button"));
    const matching = buttons.filter((button) => button.includes(`${action}(`));
    assert.ok(matching.length, action);
    assert.ok(matching.every((button) => /disabled=\{preview(?:\s*\|\||\})/.test(button)), action);
  }
});
test("recent posts load independently, without a seven-day cutoff or anonymous identity", () => {
  const requestGroup = panel.slice(panel.indexOf("Promise.all(["), panel.indexOf(".then(([friends"));
  assert.doesNotMatch(requestGroup, /getSquareStatements/);
  assert.match(panel, /getSquareStatements\(\{ limit: 5, scope: isSelfAccount \? "mine" : "all", user_id: userId \}/);
  assert.doesNotMatch(panel, /RECENT_STATEMENT_WINDOW_SECONDS/);
  assert.match(panel, /setRecentState\("error"\)/);
});
test("profile rows cannot stretch when the stranger preview has fewer sections", () => {
  const styles = readFileSync(new URL("../src/styles/app/20-profile-settings.css", import.meta.url), "utf8");
  const rule = styles.match(/\n\.user-profile-panel \{([^}]+)\}/)?.[1];
  assert.match(rule ?? "", /align-content: start/);
});

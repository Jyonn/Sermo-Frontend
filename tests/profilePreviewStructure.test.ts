import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const menu = readFileSync(new URL("../src/pages/MenuPage.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/components/UserProfilePanel.tsx", import.meta.url), "utf8");
test("my card uses the same full-bleed drawer composition as other profiles", () => {
  const drawer = menu.slice(menu.indexOf('<SideDrawer headerless historyKey="my-profile-card"'));
  const content = drawer.slice(0, drawer.indexOf("</SideDrawer>"));
  assert.match(content, /<UserProfilePanel/);
  assert.doesNotMatch(content, /more-apps-drawer|<UserProfileCard/);
  assert.match(content, /previewAudience=\{cardAudience\}/);
  assert.match(content, /floatingAccessory=/);
  assert.doesNotMatch(panel, /profile\.cardAudience/);
});
test("my card entry follows the basic fields in its own section", () => {
  const basic = menu.slice(menu.indexOf('<SideDrawer historyKey="basic-info"'), menu.indexOf('<SideDrawer headerless historyKey="my-profile-card"'));
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

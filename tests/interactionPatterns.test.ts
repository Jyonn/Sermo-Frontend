import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInstance } from "i18next";
import { DEFAULT_SHEET_STOPS, sheetRelease, sheetStops, tourPosition } from "../src/lib/interactionPatterns.ts";

test("sheet stops are ordered, bounded and have a safe fallback", () => {
  assert.deepEqual(sheetStops([.8, .3, .6, .3, NaN, -1, 1]), [.3, .6, .8]);
  assert.deepEqual(sheetStops([]), DEFAULT_SHEET_STOPS);
  assert.equal(sheetRelease(DEFAULT_SHEET_STOPS, 1, -180, 900), 2);
  assert.equal(sheetRelease(DEFAULT_SHEET_STOPS, 1, 260, 900), 0);
  assert.equal(sheetRelease(DEFAULT_SHEET_STOPS, 0, 180, 900), null);
  assert.equal(sheetRelease(DEFAULT_SHEET_STOPS, 2, -500, 900), 2);
});

test("tour positions stay inside narrow screens and flip above bottom targets", () => {
  for (const width of [320, 390, 1280]) {
    const position = tourPosition({ top: 600, bottom: 650, left: width - 30, width: 30 }, width, 800, 240);
    assert.ok(position.left >= 16);
    assert.ok(position.left + position.width <= width - 16);
    assert.ok(position.top >= 16 && position.top + 240 <= 784);
  }
  assert.equal(tourPosition(null, 390, 844, 240).top, 302);
});

test("high risk confirmation is explicit and never globally confirms Enter", () => {
  const confirm = readFileSync(new URL("../src/components/ConfirmDialog.tsx", import.meta.url), "utf8");
  const alert = readFileSync(new URL("../src/components/AlertDialog.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(confirm, /event\.key === "Enter"/);
  assert.match(confirm, /dismissible && !busy/);
  assert.match(alert, /dismissible=\{false\}/);
  assert.match(confirm, /"alertdialog"/);
});

test("real integrations use one shared action sheet, alert dialog and inline alert", () => {
  const menu = readFileSync(new URL("../src/pages/MenuPage.tsx", import.meta.url), "utf8");
  const friend = readFileSync(new URL("../src/components/AddFriendDrawer.tsx", import.meta.url), "utf8");
  assert.match(menu, /<ActionSheet\s+open=\{bindMoreOpen\}/);
  assert.match(menu, /<AlertDialog\s+danger\s+busy=\{accountDeleteSaving\}/);
  assert.match(friend, /<InlineAlert id="friend-search-error"/);
  assert.match(friend, /aria-describedby=\{searchError/);
});

for (const language of ["en", "zh-CN"]) test(`interaction copy interpolates in ${language}`, async () => {
  const translation = JSON.parse(readFileSync(new URL(`../src/locales/${language}/translation.json`, import.meta.url), "utf8"));
  const i18n = createInstance();
  await i18n.init({ lng: language, resources: { [language]: { translation } } });
  for (const key of Object.keys(translation).filter((key) => key.startsWith("patterns."))) assert.doesNotMatch(String(i18n.t(key, { current: 1, total: 3 })), /[{}]/, key);
});

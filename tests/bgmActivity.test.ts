import assert from "node:assert/strict";
import mapping from "../src/lib/activityAssetManifest.json" with {type:"json"};
import { readFileSync } from "node:fs";
import test from "node:test";
import { createInstance } from "i18next";
import { localBgmUri } from "../src/lib/bgmMedia.ts";

test("legacy public clips resolve to the shared resource service without rewriting third-party URLs", () => {
  assert.equal(localBgmUri("https://frienden.jyonn.space/activity/bgm/01.mp3", "https://frienden.6-79.cn"), mapping["/activity/bgm/01.mp3"]);
  const api = "https://api.sermo.jyonn.space/messages/media/blob";
  assert.equal(localBgmUri(api, "https://frienden.6-79.cn"), api);
  const external = "https://example.test/activity/bgm/01.mp3";
  assert.equal(localBgmUri(external, "https://frienden.6-79.cn"), external);
});

test("device variants use distinct centralized artwork", () => {
  assert.notEqual(mapping["/activity/bgm/device-blue-v2.png"],mapping["/activity/bgm/device-pink-v2.png"]);
  const css=readFileSync(new URL("../src/components/BgmActivity.css",import.meta.url),"utf8");
  for(const style of ['blue','pink'] as const)assert.ok(css.includes(mapping[`/activity/bgm/device-${style}-v2.png`]));
  const activity = readFileSync(new URL("../src/components/BgmActivity.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(activity, /SettingSelect|bgm-style-switch|bgm-event-title/);
  assert.match(activity, /<BottomSheet/);
});

test("the twelve supplied clips match the manifest, are short and have distinct content", () => {
  const rows = JSON.parse(readFileSync(new URL("../src/lib/bgmCatalog.json", import.meta.url), "utf8"));
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((row: { sha256: string }) => row.sha256)).size, 12);
  for (const row of rows) {
    const uri=(mapping as Record<string,string>)[`/activity/bgm/${row.file}`];
    assert.ok(uri.endsWith(row.sha256));
    assert.ok(row.duration > 0 && row.duration <= 20);
    assert.ok(row.title);
  }
});

for (const language of ["zh-CN", "en"]) {
  test(`BGM interpolation resolves in ${language}`, async () => {
    const translation = JSON.parse(readFileSync(new URL(`../src/locales/${language}/translation.json`, import.meta.url), "utf8"));
    const i18n = createInstance();
    await i18n.init({ lng: language, resources: { [language]: { translation } }, interpolation: { escapeValue: false } });
    for (const key of Object.keys(translation).filter((key) => key.startsWith("bgm."))) {
      assert.doesNotMatch(String(i18n.t(key, { count: 3, minutes: 3, days: 15, points: 90, title: "囚笼", actor: "Alice", number: 1, time: "9:59" })), /[{}]/, key);
    }
    assert.equal(translation["bgm.authorUnknown"], undefined);
    assert.equal(i18n.t("bgm.entranceMessage", { actor: "Alice", title: "Track" }), language === "zh-CN" ? "Alice 进入聊天" : "Alice entered the chat");
  });
}

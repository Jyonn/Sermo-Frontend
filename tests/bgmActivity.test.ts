import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createInstance } from "i18next";
import { localBgmUri } from "../src/lib/bgmMedia.ts";

test("public clips stay on the user's current mirror without rewriting API or third-party URLs", () => {
  assert.equal(localBgmUri("https://frienden.jyonn.space/activity/bgm/01.mp3", "https://frienden.6-79.cn"), "https://frienden.6-79.cn/activity/bgm/01.mp3");
  const api = "https://api.sermo.jyonn.space/messages/media/blob";
  assert.equal(localBgmUri(api, "https://frienden.6-79.cn"), api);
  const external = "https://example.test/activity/bgm/01.mp3";
  assert.equal(localBgmUri(external, "https://frienden.6-79.cn"), external);
});

test("the twelve supplied clips match the manifest, are short and have distinct content", () => {
  const rows = JSON.parse(readFileSync(new URL("../public/activity/bgm/catalog.json", import.meta.url), "utf8"));
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((row: { sha256: string }) => row.sha256)).size, 12);
  for (const row of rows) {
    const bytes = readFileSync(new URL(`../public/activity/bgm/${row.file}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), row.sha256);
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
      assert.doesNotMatch(String(i18n.t(key, { count: 3, days: 15, points: 240, title: "囚笼", actor: "Alice", number: 1 })), /[{}]/, key);
    }
    assert.equal(translation["bgm.authorUnknown"], undefined);
    assert.equal(i18n.t("bgm.entranceMessage", { actor: "Alice", title: "Track" }), language === "zh-CN" ? "Alice 进入聊天" : "Alice entered the chat");
  });
}

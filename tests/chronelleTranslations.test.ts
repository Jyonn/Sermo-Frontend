import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createInstance } from "i18next";

for (const language of ["zh-CN", "en"]) {
  test(`calendar placeholders render through i18next (${language})`, async () => {
    const translation = JSON.parse(readFileSync(new URL(`../src/locales/${language}/translation.json`, import.meta.url), "utf8"));
    const i18n = createInstance();
    await i18n.init({
      resources: { [language]: { translation } },
      lng: language,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    const values = { time: "17:00", minutes: 20, hours: 1, percent: 0, duration: "30 min", count: 2 };
    for (const [key, template] of Object.entries(translation)) {
      if (!key.startsWith("chronelle.") || typeof template !== "string" || !template.includes("{")) continue;
      assert.doesNotMatch(String(i18n.t(key, values)), /[{}]/, key);
    }
    const chinese = language === "zh-CN";
    assert.equal(i18n.t("chronelle.busyUntil", values), chinese ? "忙碌至 17:00" : "Busy until 17:00");
    assert.equal(i18n.t("chronelle.busyPercent", { percent: 0 }), chinese ? "忙碌占比 0%" : "0% busy");
    assert.equal(i18n.t("chronelle.busyPercent", { percent: 100 }), chinese ? "忙碌占比 100%" : "100% busy");
    const duration = i18n.t("chronelle.durationHoursMinutes", { hours: 1, minutes: 30 });
    assert.equal(i18n.t("chronelle.freeWindow", { duration }), chinese ? "可空闲 1 小时 30 分钟" : "Free for 1 hr 30 min");
    const time = i18n.t("chronelle.tomorrowTime", { time: "08:00" });
    assert.equal(i18n.t("chronelle.busyUntil", { time }), chinese ? "忙碌至 明天 08:00" : "Busy until Tomorrow at 08:00");
  });
}

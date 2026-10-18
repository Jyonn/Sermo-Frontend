import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as sites from "../src/lib/siteOrigins.ts";
import * as migration from "../src/lib/siteMigration.ts";

const require = createRequire(import.meta.url);
const messages = JSON.parse(fs.readFileSync(new URL("../src/locales/zh-CN/translation.json", import.meta.url), "utf8"));
function load(name: string) {
  const exports: Record<string, any> = {};
  const source = fs.readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, URL, window: { location: { origin: "https://sermo.jyonn.space" } },
    document: { body: {} },
    require: (name: string) => {
      if (name === "react-dom") return { createPortal: (element: React.ReactNode) => element };
      if (name === "../lib/language") return { useI18n: () => ({ language: "zh-CN", t: (key: string) => messages[key] ?? key }) };
      if (name === "../lib/bodyLock") return { useBodyScrollLock: () => undefined };
      if (name === "../lib/usePwaUpdateActivation") return { usePwaUpdateActivation: () => ({ phase: "idle", install() {} }) };
      if (name === "./UpdateReportButton") return { UpdateFailureFeedback: () => null };
      if (name === "../lib/siteOrigins") return sites;
      if (name === "../lib/siteMigration") return migration;
      if (name.endsWith(".css")) return {};
      return require(name);
    },
  });
  return exports;
}
test("actual migration card states the maintenance date and uses a clean destination", () => {
  const { MigrationNoticeCard } = load("SiteMigrationNotice");
  const html = renderToStaticMarkup(React.createElement(MigrationNoticeCard, { destination: "https://frienden.6-79.cn", onClose() {} }));
  assert.match(html, /2026 年 12 月 31 日/);
  assert.match(html, /Sermo 言浪旧域名/);
  assert.match(html, /迁移至 Frienden 友间/);
  assert.match(html, /href="https:\/\/frienden\.6-79\.cn\/"/);
  assert.match(html, /referrerPolicy="no-referrer"/i);
  assert.match(html, /aria-label="关闭"/);
  assert.doesNotMatch(html, /state=|code=|token=|redirect_uri=/);
});
test("actual update dialog lists four labeled sites with clean links even before the first check", () => {
  const { UpdateCheckDialog } = load("UpdateCheckDialog");
  const html = renderToStaticMarkup(React.createElement(UpdateCheckDialog, { open: true, checking: false, result: null, onCheck() {}, onClose() {} }));
  for (const site of sites.SITE_ORIGINS) {
    assert.ok(html.includes(`href="${site.origin}/"`));
    assert.ok(html.includes(messages[site.labelKey]));
  }
  assert.equal((html.match(/referrerPolicy="no-referrer"/gi) || []).length, 4);
  assert.equal((html.match(/Frienden 友间 · 新/g) || []).length, 2);
  assert.equal((html.match(/Sermo 言浪 · 旧/g) || []).length, 2);
  assert.doesNotMatch(html, /state=|code=|token=|redirect_uri=/);
});

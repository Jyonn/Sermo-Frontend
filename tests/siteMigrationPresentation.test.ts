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
import * as consent from "../src/lib/oauthConsent.ts";
import * as destination from "../src/lib/updateDestination.ts";

const require = createRequire(import.meta.url);
const messages = JSON.parse(fs.readFileSync(new URL("../src/locales/zh-CN/translation.json", import.meta.url), "utf8"));
function load(name: string, iconState?: { value: boolean }) {
  const exports: Record<string, any> = {};
  const source = fs.readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, URL, window: { location: { origin: "https://sermo.jyonn.space" } },
    document: { body: {} },
    require: (name: string) => {
      if (name === "react" && iconState) return { ...React, useState: () => [iconState.value, (next: boolean) => { iconState.value = next; }] };
      if (name === "react-dom") return { createPortal: (element: React.ReactNode) => element };
      if (name === "../lib/language") return { useI18n: () => ({ language: "zh-CN", t: (key: string, params?: Record<string, string>) => (messages[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_: string, name: string) => params?.[name] ?? "") }) };
      if (name === "../lib/bodyLock") return { useBodyScrollLock: () => undefined };
      if (name === "../lib/usePwaUpdateActivation") return { usePwaUpdateActivation: () => ({ phase: "idle", install() {} }) };
      if (name === "./UpdateReportButton") return { UpdateFailureFeedback: () => null };
      if (name === "../lib/siteOrigins") return sites;
      if (name === "../lib/updateDestination") return destination;
      if (name === "../lib/siteMigration") return migration;
      if (name === "../lib/oauthConsent") return consent;
      if (name === "./OAuthConsentBrand") return load("OAuthConsentBrand", iconState);
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
  assert.match(html, /src="\/icons\/sermo-192.png"/);
  assert.match(html, /src="\/icons\/frienden-192.png\?v=2"/);
  assert.equal((html.match(/class="migration-brand-icon"/g) || []).length, 2);
  assert.match(html, /migration-brand-arrow/);
  assert.match(html, /href="https:\/\/frienden\.6-79\.cn\/"/);
  assert.match(html, /referrerPolicy="no-referrer"/i);
  assert.match(html, /aria-label="关闭"/);
  assert.doesNotMatch(html, /state=|code=|token=|redirect_uri=/);
});
test("the shared production icon handles a failed image with a named neutral fallback", () => {
  const state = { value: false };
  const { BrandIcon } = load("OAuthConsentBrand", state);
  const props = { src: "/icons/sermo-192.png", name: "Sermo 言浪", className: "migration-brand-icon" };
  const first = BrandIcon(props);
  assert.equal(first.props.children.type, "img");
  first.props.children.props.onError();
  assert.equal(state.value, true);
  const html = renderToStaticMarkup(BrandIcon(props));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /role="img"/);
  assert.match(html, /Sermo 言浪/);
});
test("failed logos leave the notice readable, actionable and correctly named", () => {
  const { MigrationNoticeCard } = load("SiteMigrationNotice", { value: true });
  const html = renderToStaticMarkup(React.createElement(MigrationNoticeCard, { destination: "https://frienden.jyonn.space", onClose() {} }));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /Sermo 言浪/);
  assert.match(html, /Frienden 友间/);
  assert.match(html, /2026 年 12 月 31 日/);
  assert.match(html, /href="https:\/\/frienden\.jyonn\.space\/"/);
  assert.match(html, /aria-label="关闭"/);
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
test("cross-site update dialog offers navigation and waiting instead of installation", () => {
  const { UpdateCheckDialog } = load("UpdateCheckDialog");
  const result = {
    currentRelease: { id: "2026.10.22.3" }, latestVersion: "2026.10.22.4", updateAvailable: true,
    sources: sites.SITE_ORIGINS.map((site) => ({ ...site, status: "ok", releaseId: site.key === "primary" ? "2026.10.22.3" : "2026.10.22.4" })),
  };
  const props = { open: true, checking: false, result, onCheck() {}, onClose() {} };
  const crossSite = renderToStaticMarkup(React.createElement(UpdateCheckDialog, props));
  assert.match(crossSite, /前往新站点/);
  assert.match(crossSite, /再等等/);
  assert.doesNotMatch(crossSite, /立即更新/);
  result.sources.forEach((source) => { source.releaseId = "2026.10.22.4"; });
  const local = renderToStaticMarkup(React.createElement(UpdateCheckDialog, props));
  assert.match(local, /立即更新/);
  assert.doesNotMatch(local, /前往新站点|再等等/);
});

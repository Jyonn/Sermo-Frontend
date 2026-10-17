import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as consent from "../src/lib/oauthConsent.ts";

const require = createRequire(import.meta.url);
const { StaticRouter } = require("react-router-dom/server");
// Render the production component; isolate language/storage and decorative icons.
const exports: Record<string, any> = {};
const source = fs.readFileSync(new URL("../src/components/OAuthVerificationCard.tsx", import.meta.url), "utf8");
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports, require: (name: string) => {
    if (name === "../lib/language") return { useI18n: () => ({ t: (key: string) => key }) };
    if (name === "../lib/oauthConsent") return consent;
    if (name === "../lib/oauthPending") return { rememberOAuthRequest: () => undefined };
    if (name === "./ContactChannelIcon") return { ContactChannelIcon: () => React.createElement("span", { "aria-hidden": true }) };
    return require(name);
  },
});
const render = (missing: consent.OAuthVerificationChannel[] | null, eligible = false, failed = false) => renderToStaticMarkup(React.createElement(StaticRouter, { location: "/oauth/authorize" },
  React.createElement(exports.OAuthVerificationCard, { eligibility: missing === null ? null : { eligible, missing_verifications: missing }, search: "?state=opaque%2Bvalue&client_id=test", failed, onReload: () => undefined })));

test("both missing verifications link to their corresponding existing flow", () => {
  const html = render(["email", "phone"]);
  assert.match(html, /sheet=email-verification/);
  assert.match(html, /sheet=phone-verification/);
  assert.doesNotMatch(html, /is-complete|apps.allow/);
});

test("one missing verification exposes only that action and marks the other complete", () => {
  for (const missing of ["email", "phone"] as const) {
    const html = render([missing]);
    assert.match(html, new RegExp(`sheet=${missing}-verification`));
    assert.doesNotMatch(html, new RegExp(`sheet=${missing === "email" ? "phone" : "email"}-verification`));
    assert.equal((html.match(/is-complete/g) || []).length, 1);
  }
});

test("verified state removes the guide; loading and errors never imply completion", () => {
  assert.equal(render([], true), "");
  for (const failed of [false, true]) {
    const html = render(null, false, failed);
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /apps.allow|is-complete|sheet=/);
    assert.equal(html.includes("common.retry"), failed);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import postcss from "postcss";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const permission = read("components/PermissionWorkspace.tsx");
const parsed = ts.createSourceFile("permission.tsx", permission, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = parsed.statements.filter((node) => ts.isFunctionDeclaration(node) && ["isAtom", "defaultAtom", "expressionRows", "rowsExpression", "hasExpression", "formatExpression", "capabilityChain", "InheritedPolicySummary"].includes(node.name?.text ?? "") || ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => declaration.name.getText(parsed) === "FIELD_META"));
const context = { exports: {} as any, require: createRequire(import.meta.url), isChineseLanguage: (language: string) => language.startsWith("zh") };
vm.runInNewContext(ts.transpileModule(`${declarations.map((node) => node.getText(parsed)).join("\n")}\nexports.Summary=InheritedPolicySummary; exports.rows=expressionRows; exports.expression=rowsExpression;`, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText, context);

test("inherited constraints stay available in a compact native disclosure without nested heading cards", () => {
  const selected = { key: "chat", title: "聊天", title_en: "Chat", depth: 0, parent: null, platform_policy: { requirement: { field: "growth_level", op: "gte", value: 3 }, denial: { field: "official", op: "eq", value: true } } };
  const t = (key: string, values?: any) => values?.count ? `${values.count} inherited rules` : key;
  const html = renderToStaticMarkup(React.createElement(context.exports.Summary, { entries: [selected], selected, language: "en", scope: "space", t }));
  assert.match(html, /<details/);
  assert.match(html, /<summary><span>2 inherited rules/);
  assert.match(html, /growthLevel/);
  assert.match(html, /denyIf/);
  assert.doesNotMatch(html, /<h[1-6]|<header| open=/);
  const baseline = renderToStaticMarkup(React.createElement(context.exports.Summary, { entries: [selected], selected, language: "en", scope: "platform", t }));
  assert.doesNotMatch(baseline, /<details/);
  assert.match(baseline, /noInheritedRules/);
});

test("rule layout changes retain allow-any and negated policy expression serialization", () => {
  const expression = { any: [{ field: "growth_level", op: "gte", value: 3 }, { not: { field: "official", op: "eq", value: true } }] };
  const model = context.exports.rows(expression);
  assert.equal(model.mode, "any");
  assert.equal(model.rows[1].negated, true);
  assert.equal(JSON.stringify(context.exports.expression(model.mode, model.rows)), JSON.stringify(expression));
});

test("member and settings pages use one compact toolbar and direct fields rather than nested cards", () => {
  const source = read("pages/SpaceAdminDashboardPage.tsx");
  assert.match(source, /className="admin-members-toolbar"/);
  assert.doesNotMatch(source, /className="admin-members-overview"|className="admin-filter-tabs"/);
  const basics = source.slice(source.indexOf('{activeTab === "basics"'), source.indexOf('{activeTab === "verification"'));
  assert.match(basics, /className="management-setting-fields"/);
  assert.match(basics, /className="management-level-fields"/);
  assert.doesNotMatch(basics, /admin-policy-card|admin-policy-drawer|<h[1-6]/);
  assert.match(basics, /aria-describedby="admin-space-capacity-hint"/);
  assert.match(permission, /setChoosingCapability\(false\)/);
  assert.match(permission, /editorPanel.current\?\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(permission, /event.key === "Escape"/);
  assert.match(permission, /loadError \? <FeedbackState tone="error"/);
  assert.doesNotMatch(permission, /className="permission-inheritance"|className="permission-matrix-placeholder"/);
});

test("interior styles use app themes and responsive containment without duplicate declarations", () => {
  for (const path of ["components/ManagementContent.css", "styles/permission-workspace.css"]) {
    const css = read(path);
    const selectors = new Set<string>();
    postcss.parse(css).walkRules((rule) => {
      const parents: string[] = [];
      for (let node = rule.parent; node; node = node.parent) if (node.type === "atrule") parents.unshift(`${node.name} ${node.params}`);
      const key = `${parents.join("/")} ${rule.selector}`;
      assert.ok(!selectors.has(key), key);
      selectors.add(key);
      const properties = new Set<string>();
      rule.walkDecls((declaration) => { assert.ok(!properties.has(declaration.prop), declaration.prop); properties.add(declaration.prop); });
    });
    assert.match(css, /var\(--text-muted\)/);
    assert.doesNotMatch(css, /prefers-color-scheme|backdrop-filter/);
  }
  const css = read("styles/permission-workspace.css");
  assert.match(css, /:not\(\.is-choosing\) \.permission-tree-content \{ display: none/);
  assert.match(css, /@container permission-editor/);
  assert.match(css, /max-height: 560px/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("both administration scopes share one responsive navigation and retain their auth boundaries", () => {
  for (const file of ["pages/SpaceAdminDashboardPage.tsx", "pages/PlatformAdminPage.tsx"]) {
    const source = read(file);
    assert.match(source, /<ManagementWorkspace/);
    assert.doesNotMatch(source, /className="(?:admin-mobile-nav|platform-mobile-nav|admin-app-nav|platform-sidebar)"/);
  }
  assert.match(read("pages/SpaceAdminDashboardPage.tsx"), /useAdminAuth\(\)/);
  assert.match(read("pages/PlatformAdminPage.tsx"), /session \? <PlatformAdminConsole \/> : <PlatformAdminLogin \/>/);
  const component = read("components/ManagementWorkspace.tsx");
  assert.match(component, /scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\)/);
  assert.match(component, /aria-current=\{item.group.id === activeItem\?\.group.id \? "page" : undefined\}/);
  assert.match(component, /lastDestination.current\[item.group.id\] \?\? item.id/);
  assert.match(component, /<PageTabs label=\{activeItem\?\.group.label/);
  assert.match(component, /surfaceClassName="management-detail"/);
  assert.match(component, /onClick=\{onLogout\}/);
});

test("management adapts to portrait, compact rail and short landscape without duplicate CSS blocks", () => {
  const css = read("components/ManagementWorkspace.css");
  const ast = postcss.parse(css);
  const rules = new Set<string>();
  ast.walkRules((rule) => {
    const parents: string[] = [];
    for (let parent = rule.parent; parent; parent = parent.parent) if (parent.type === "atrule") parents.unshift(`${parent.name} ${parent.params}`);
    const key = `${parents.join("/")} ${rule.selector}`;
    assert.ok(!rules.has(key), `Repeated rule: ${key}`);
    rules.add(key);
    const properties = new Set<string>();
    rule.walkDecls((declaration) => {
      assert.ok(!properties.has(declaration.prop), `Repeated property: ${declaration.prop}`);
      properties.add(declaration.prop);
    });
  });
  assert.match(css, /height: 100dvh/);
  assert.match(css, /max-width: 1179px/);
  assert.match(css, /max-width: 719px/);
  assert.match(css, /max-height: 560px/);
  assert.match(css, /@container management-permissions/);
  assert.match(css, /\.management-nav[\s\S]*overflow: auto/);
  assert.match(css, /\.management-detail[\s\S]*var\(--line-soft\)/);
});

test("management navigation labels have Chinese and English translations", () => {
  for (const locale of ["zh-CN", "en"]) {
    const messages = JSON.parse(read(`locales/${locale}/translation.json`));
    for (const key of ["platformTitle", "secureSession", "oauth", "overview", "spaces", "permissions", "reviews", "emails", "emailReview", "audit", "debug", "security", ...["people", "community", "operations", "configuration", "access", "overview", "governance", "services", "observability", "security"].map((group) => `group.${group}`)]) assert.ok(messages[`management.${key}`]);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const css = (name: string) => postcss.parse(readFileSync(new URL(`../src/styles/app/${name}.css`, import.meta.url), "utf8"));
function declarations(file: string, selector: string) {
  const result: Record<string, string> = {};
  css(file).walkRules((rule) => {
    if (rule.selector.split(",").map((item) => item.trim()).includes(selector)) {
      rule.walkDecls((decl) => { result[decl.prop] = decl.value; });
    }
  });
  return result;
}

test("shared borders and secondary controls use theme tokens", () => {
  assert.equal(declarations("00-foundation", ".panel").border, "1px solid var(--line-soft)");
  assert.equal(declarations("00-foundation", ".ghost-button").background, "var(--control-surface)");
  for (const selector of [".input-dialog", ".confirm-dialog", ".async-dialog"]) {
    assert.equal(declarations("20-profile-settings", selector).border, "1px solid var(--line-soft)");
  }
  assert.equal(declarations("10-chat-city", ".sheet-close").background, "var(--control-surface)");
  assert.equal(declarations("10-chat-city", ".sheet-header")["border-bottom"], "1px solid var(--line-soft)");
});

test("dark composer outside a chat scene never falls back to currentColor", () => {
  const dark = declarations("10-chat-city", 'html[data-theme="dark"] .composer-input-wrap');
  assert.equal(dark["border-color"], "var(--chat-chrome-border, var(--line-soft))");
  assert.equal(dark.background, "var(--chat-input-surface, var(--bg-elevated))");
});

test("search aliases resolve and themed profile copy inherits readable colors", () => {
  const root = declarations("00-foundation", ":root");
  for (const token of ["--surface", "--text-main", "--text-strong", "--line"]) assert.ok(root[token]);
  assert.equal(declarations("60-profile-themes", ".user-profile-recent-statement").color, "var(--profile-ink)");
  assert.equal(declarations("60-profile-themes", ".user-profile-panel .user-profile-recent-statement small").color, "var(--profile-muted)");
  assert.match(declarations("60-profile-themes", ".user-profile-panel .user-profile-create-group-icon").background, /var\(--profile-card\)/);
});

test("shared chrome no longer hardcodes pale neutral borders", () => {
  for (const file of ["00-foundation", "10-chat-city", "20-profile-settings", "40-square-platform"]) {
    css(file).walkDecls(/^border(?:-.+)?$/, (decl) => {
      assert.doesNotMatch(decl.value, /rgba\(\s*(?:215\s*,\s*220\s*,\s*231|232\s*,\s*235\s*,\s*242|226\s*,\s*232\s*,\s*240|229\s*,\s*233\s*,\s*240)\s*,\s*0?\.[5-9]/, `${file}: ${decl.toString()}`);
    });
  }
});

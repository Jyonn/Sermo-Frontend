import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";

const source = readFileSync(new URL("../src/components/DrawerTabs.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const module = { exports: {} as any };
runInNewContext(compiled, { module, exports: module.exports, require: createRequire(import.meta.url) });
const { DrawerTabs } = module.exports;
const items = [{ value: "apps", label: "Apps" }, { value: "plugins", label: "Plugins" }];

test("drawer tabs expose selected state and one keyboard entry point", () => {
  const html = renderToStaticMarkup(DrawerTabs({ label: "Tools", items, value: "apps", onChange() {} }));
  assert.match(html, /role="tablist" aria-label="Tools"/);
  assert.match(html, /aria-selected="true" tabindex="0"/);
  assert.match(html, /aria-selected="false" tabindex="-1"/);
});

test("drawer tab keyboard navigation wraps and moves focus", () => {
  const changes: string[] = [];
  const focused: number[] = [];
  const tabs = DrawerTabs({ label: "Tools", items, value: "apps", onChange: (value: string) => changes.push(value) }).props.children;
  function press(index: number, key: string) {
    let prevented = false;
    tabs[index].props.onKeyDown({ key, preventDefault() { prevented = true; }, currentTarget: { parentElement: { querySelectorAll: () => items.map((_, i) => ({ focus() { focused.push(i); } })) } } });
    return prevented;
  }
  assert.equal(press(0, "ArrowLeft"), true);
  assert.equal(press(1, "ArrowRight"), true);
  assert.equal(press(1, "Home"), true);
  assert.equal(press(0, "End"), true);
  assert.equal(press(0, "Tab"), false);
  assert.deepEqual(changes, ["plugins", "apps", "apps", "plugins"]);
  assert.deepEqual(focused, [1, 0, 0, 1]);
});

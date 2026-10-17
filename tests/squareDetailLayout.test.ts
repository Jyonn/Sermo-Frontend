import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const square = readFileSync(new URL("../src/pages/SquarePage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles/app/40-square-platform.css", import.meta.url), "utf8");
function rule(selector: string) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, selector);
  return css.slice(start, css.indexOf("}", start));
}
test("the route-backed statement drawer has a scoped viewport layout", () => {
  assert.match(square, /<SideDrawer className="square-statement-detail-drawer" historyMode="route"/);
  assert.match(rule(".square-statement-detail-drawer.side-drawer"), /height: 100dvh/);
  const body = rule(".square-statement-detail-drawer.side-drawer > .drawer-body");
  assert.match(body, /padding: 0/);
  assert.match(body, /min-height: 0/);
  assert.match(body, /overflow: hidden/);
});
test("only comments scroll and the composer reserves safe-area spacing", () => {
  const content = rule(".square-statement-detail-drawer .square-comments-drawer");
  assert.match(content, /min-height: 0/);
  assert.match(content, /padding: 0/);
  assert.match(rule(".square-statement-detail-drawer .square-comments-scroll"), /overflow-y: auto/);
  const composer = rule(".square-statement-detail-drawer .square-comments-drawer > .square-comment-composer");
  assert.match(composer, /flex: 0 0 auto/);
  assert.match(composer, /max\(12px, env\(safe-area-inset-bottom\)\)/);
});

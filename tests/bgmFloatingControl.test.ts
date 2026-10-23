import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function harness() {
  const state: any[] = [];
  let cursor = 0;
  let opened = 0;
  const exports: any = {};
  const hooks = {
    useRef(value: any) { const i = cursor++; return state[i] ??= { current: value }; },
    useState(value: any) { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], (next: any) => { state[i] = next; }]; },
    useLayoutEffect() {},
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/components/BgmFloatingControl.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports,
    require(name: string) {
      if (name === "react") return hooks;
      if (name === "../lib/language") return { useI18n: () => ({ t: (key: string) => key }) };
      if (name === "./BgmIcon") return { BgmIcon: () => null };
      return require(name);
    },
  });
  return {
    render(remaining = 0, busy = false) {
      cursor = 0;
      const root = exports.BgmFloatingControl({ remaining, busy, onOpen: () => opened++ });
      // Supply the bounds normally measured by ResizeObserver.
      state[3] = { width: 320, height: 480 };
      return root.props.children.props;
    },
    get opened() { return opened; },
  };
}
const event = (x: number, y: number) => ({ button: 0, clientX: x, clientY: y, pointerId: 1, currentTarget: { setPointerCapture() {}, releasePointerCapture() {} } });

test("floating keys open when ready and remain locked throughout cooldown or sending", () => {
  const ui = harness();
  ui.render().onClick();
  assert.equal(ui.opened, 1);
  for (const remaining of [600, 59, 1]) {
    const button = ui.render(remaining);
    assert.equal(button["aria-disabled"], true);
    button.onClick();
  }
  ui.render(0, true).onClick();
  assert.equal(ui.opened, 1);
  ui.render(0).onClick();
  assert.equal(ui.opened, 2);
});
test("dragging snaps to the nearest edge without activating, including during cooldown", () => {
  const ui = harness(); ui.render();
  const button = ui.render(120);
  button.onPointerDown(event(270, 300));
  button.onPointerMove(event(-100, -200));
  button.onPointerUp(event(-100, -200));
  button.onClick();
  assert.equal(ui.opened, 0);
  assert.equal(ui.render(120).style.transform, "translate(0px, 0px)");
});
test("canceled drags reset motion and never open the panel", () => {
  const ui = harness(); ui.render();
  const button = ui.render();
  button.onPointerDown(event(270, 300));
  button.onPointerMove(event(140, 220));
  button.onPointerCancel();
  button.onClick();
  assert.equal(ui.opened, 0);
  assert.doesNotMatch(ui.render().className, /is-dragging/);
});

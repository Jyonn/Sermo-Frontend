import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { desktopPanelLayout, desktopPanelMode, topDesktopPanel } from "../src/lib/desktopPanels.ts";

test("desktop modes are limited to the four application workspaces", () => {
  for (const path of ["/app/menu", "/app/notifications", "/app/notifications/friends/42"]) assert.equal(desktopPanelMode(path), "split");
  for (const path of ["/app/chats/2", "/app/square", "/app/square/statements/3", "/app/submissions/new"]) assert.equal(desktopPanelMode(path), "floating");
  for (const path of ["/admin", "/space/dashboard", "/app/menufake", "/oauth/authorize", "/"]) assert.equal(desktopPanelMode(path), null);
});

test("deep links and nested views expose only the deepest active layer", () => {
  const layers = [{ id: "child", depth: 2, wide: false }, { id: "parent", depth: 0, wide: false }];
  assert.equal(topDesktopPanel(layers)?.id, "child");
  assert.equal(topDesktopPanel(layers.filter((item) => item.id !== "child"))?.id, "parent");
  assert.equal(topDesktopPanel([...layers, { id: "newest", depth: 2, wide: true }])?.wide, true);
  assert.equal(topDesktopPanel([]), undefined);
});

test("desktop container keeps scroll unlocked, uses a transparent dismiss layer and hides parents", () => {
  const source = readFileSync(new URL("../src/components/SideDrawer.tsx", import.meta.url), "utf8");
  assert.match(source, /useBodyScrollLock\(visible && !desktopPanel\)/);
  assert.match(source, /aria-modal=\{desktopPanel \? undefined : true\}/);
  assert.match(source, /hidden=\{desktopPanel && panels\?\.topId !== drawerId\}/);
  assert.match(source, /onClick=\{desktopPanel \? undefined : requestClose\}/);
  assert.match(source, /panels\?\.topId === drawerId/);
  assert.match(source, /className="desktop-panel-dismiss-mask" onClick=\{requestClose\}/);
  assert.match(source, /desktopPanel && !panels\?\.single/);
  const css = readFileSync(new URL("../src/components/DesktopPanelWorkspace.css", import.meta.url), "utf8");
  assert.match(css, /background: transparent/);
  assert.match(css, /transition: grid-template-columns/);
});

test("two panels respect phone minimum, fixed detail width and original primary maximum", () => {
  assert.deepEqual(desktopPanelLayout(1440), { presentation: "dual", primary: 960, secondary: 390 });
  assert.deepEqual(desktopPanelLayout(1000), { presentation: "dual", primary: 594, secondary: 390 });
  assert.deepEqual(desktopPanelLayout(796), { presentation: "dual", primary: 390, secondary: 390 });
  assert.deepEqual(desktopPanelLayout(795), { presentation: "single", primary: 0, secondary: 390 });
  assert.equal(desktopPanelLayout(320).secondary, 320);
  assert.equal(desktopPanelLayout(0).secondary, 0);
});

test("navigation expansion can switch the same desktop from dual panels to a single detail", () => {
  assert.equal(desktopPanelLayout(1024 - 140).presentation, "dual");
  assert.equal(desktopPanelLayout(1024 - 252).presentation, "single");
});

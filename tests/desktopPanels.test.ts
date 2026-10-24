import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { desktopPanelMode, topDesktopPanel } from "../src/lib/desktopPanels.ts";

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

test("desktop container does not lock the page, mask it or expose hidden parents", () => {
  const source = readFileSync(new URL("../src/components/SideDrawer.tsx", import.meta.url), "utf8");
  assert.match(source, /useBodyScrollLock\(visible && !desktopPanel\)/);
  assert.match(source, /aria-modal=\{desktopPanel \? undefined : true\}/);
  assert.match(source, /hidden=\{desktopPanel && panels\?\.topId !== drawerId\}/);
  assert.match(source, /onClick=\{desktopPanel \? undefined : requestClose\}/);
  assert.match(source, /panels\?\.topId === drawerId/);
});

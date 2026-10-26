import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conversationPanelLayout, desktopPanelLayout, desktopPanelMode, topDesktopPanel } from "../src/lib/desktopPanels.ts";

test("desktop modes distinguish member panels and management floating surfaces", () => {
  for (const path of ["/app/menu", "/app/developer", "/app/notifications", "/app/notifications/friends/42"]) assert.equal(desktopPanelMode(path), "split");
  for (const path of ["/app/chats/2", "/app/square", "/app/square/statements/3", "/app/submissions/new", "/admin", "/space/dashboard"]) assert.equal(desktopPanelMode(path), "floating");
  for (const path of ["/administrator", "/space", "/space/dashboardfake", "/app/menufake", "/oauth/authorize", "/"]) assert.equal(desktopPanelMode(path), null);
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
  assert.match(source, /desktopPanel && panels\?\.floating && panels.topId === drawerId/);
  const css = readFileSync(new URL("../src/components/DesktopPanelWorkspace.css", import.meta.url), "utf8");
  assert.match(css, /background: transparent/);
  assert.match(css, /transition: grid-template-columns/);
});

test("two panels respect phone minimum, fixed detail width and original primary maximum", () => {
  assert.deepEqual(desktopPanelLayout(1440), { presentation: "dual", primary: 960, secondary: 390 });
  assert.deepEqual(desktopPanelLayout(1000), { presentation: "dual", primary: 594, secondary: 390 });
  assert.deepEqual(desktopPanelLayout(796), { presentation: "dual", primary: 390, secondary: 390 });
  assert.deepEqual(desktopPanelLayout(795), { presentation: "single", primary: 0, secondary: 795 });
  assert.equal(desktopPanelLayout(660).secondary, 660);
  assert.equal(desktopPanelLayout(320).secondary, 320);
  assert.equal(desktopPanelLayout(0).secondary, 0);
});

test("all four tabs use the same tablet boundary and native details retain complete content", () => {
  const workspace = readFileSync(new URL("../src/components/DesktopPanelWorkspace.tsx", import.meta.url), "utf8");
  const chats = readFileSync(new URL("../src/pages/ChatsPage.tsx", import.meta.url), "utf8");
  const square = readFileSync(new URL("../src/pages/SquarePage.tsx", import.meta.url), "utf8");
  assert.match(workspace, /min-width: 720px/);
  assert.match(workspace, /const floating = enabled && mode === "floating";/);
  assert.match(workspace, /const split = enabled && mode === "split";/);
  assert.match(chats, /workspaceSelected=\{Boolean\(displayedChat\)\}/);
  assert.match(chats, /useMobileComposerLayout\(\)/);
  assert.match(readFileSync(new URL("../src/components/ChatComposerLayout.tsx", import.meta.url), "utf8"), /max-width: 719px/);
  assert.match(square, /min-width: 720px/);
  assert.match(square, /className="native-current-statement">\{desktopWorkspace \? renderFeedStatement\(activeCommentStatement, true\) : null\}/);
  assert.match(workspace, /mode === "floating" \? conversationPanelLayout\(available,/);
  assert.match(square, /className="native-panel-close" onClick=\{closeInlineStatement\}/);
});

test("Square keeps readable cards and adapts actions to the panel rather than the viewport", () => {
  assert.deepEqual(conversationPanelLayout(856, true), { presentation: "dual", primary: 360, secondary: 480 });
  assert.deepEqual(conversationPanelLayout(855, true), { presentation: "single", primary: 0, secondary: 855 });
  for (let width = 856; width <= 2000; width++) {
    const layout = conversationPanelLayout(width, true);
    assert.ok(layout.primary >= 360 && layout.primary <= 420);
    assert.ok(layout.secondary >= 480 && layout.secondary <= 960);
    assert.ok(layout.secondary > layout.primary);
    assert.ok(layout.primary + layout.secondary + 16 <= width + 1e-9);
  }
  const css = readFileSync(new URL("../src/styles/app/10-chat-city.css", import.meta.url), "utf8");
  assert.match(css, /@container square-feed \(max-width: 440px\)/);
  const square = readFileSync(new URL("../src/pages/SquarePage.tsx", import.meta.url), "utf8");
  assert.match(square, /aria-label=\{t\("square.publish"\)\}/);
});

test("chat and Square reserve a narrow list and prioritize detail space", () => {
  assert.deepEqual(conversationPanelLayout(1440), { presentation: "dual", primary: 340, secondary: 960 });
  assert.deepEqual(conversationPanelLayout(776), { presentation: "dual", primary: 280, secondary: 480 });
  assert.deepEqual(conversationPanelLayout(775), { presentation: "single", primary: 0, secondary: 775 });
  assert.deepEqual(conversationPanelLayout(660), { presentation: "single", primary: 0, secondary: 660 });
  assert.deepEqual(conversationPanelLayout(0), { presentation: "single", primary: 0, secondary: 0 });
  for (let width = 776; width <= 2000; width++) {
    const layout = conversationPanelLayout(width);
    assert.ok(layout.primary >= 280 && layout.primary <= 340);
    assert.ok(layout.secondary >= 480 && layout.secondary <= 960);
    assert.ok(layout.secondary > layout.primary);
    assert.ok(layout.primary + layout.secondary + 16 <= width + 1e-9);
  }
  assert.equal(desktopPanelLayout(1440).secondary, 390);
});

test("navigation expansion can switch the same desktop from dual panels to a single detail", () => {
  assert.equal(desktopPanelLayout(1024 - 140).presentation, "dual");
  assert.equal(desktopPanelLayout(1024 - 252).presentation, "single");
});

test("single detail removes hidden list paint layers and keeps detail in its grid track", () => {
  const css = readFileSync(new URL("../src/components/DesktopPanelWorkspace.css", import.meta.url), "utf8");
  assert.match(css, /\.native-detail-single > \.chat-mobile-layout > \.mobile-chat-list-screen,\s*\.native-detail-single > \.square-desktop-workspace > \.square-feed-screen\s*\{ display: none; \}/);
  assert.match(css, /\.native-detail-single > \.chat-mobile-layout > \.chat-main-pane,\s*\.native-detail-single > \.square-desktop-workspace > \.square-desktop-detail-pane\s*\{ grid-column: 2; \}/);
  const submission = readFileSync(new URL("../src/styles/submission-workspace.css", import.meta.url), "utf8");
  assert.doesNotMatch(submission, /\.desktop-panel-workspace\.shell \.mobile-chat-list-screen\.is-submission-list \{[^}]*display:/);
  assert.match(submission, /grid-template-rows: 110px minmax\(0, 1fr\)/);
});

test("wide editors expand instead of inheriting phone-width detail panels", () => {
  assert.equal(desktopPanelLayout(1100, true).secondary, 660);
  assert.equal(desktopPanelLayout(1100, true).presentation, "dual");
  assert.deepEqual(desktopPanelLayout(900, true), {presentation:"single",primary:0,secondary:900});
  for (let width = 0; width < 2200; width++) {
    const layout = desktopPanelLayout(width, true);
    assert.ok(layout.primary + layout.secondary + (layout.presentation === "dual" ? 16 : 0) <= width);
  }
});

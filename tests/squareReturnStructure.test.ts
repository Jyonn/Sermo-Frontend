import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const square = readFileSync(new URL("../src/pages/SquarePage.tsx", import.meta.url), "utf8");
test("detail transitions cannot overwrite feed scroll history", () => {
  assert.match(square, /if \(inlineStatementId !== null \|\| workspaceDetailActive \|\| inlineStatementExpanded\) return/);
  assert.match(square, /const workspaceDetailActive=inlineRouteActive\|\|noteDesktopPanel/);
  assert.match(square, /feedDetailWasActiveRef\.current && !detailActive/);
  assert.match(square, /\$\{activeFeedCacheKey\}:anchor/);
});
test("mobile Square blur has a stable first-paint surface", () => {
  const css = readFileSync(new URL("../src/styles/app/20-profile-settings.css", import.meta.url), "utf8");
  assert.match(css, /\.square-community-shell \.tab-sticky-header::before \{\s*opacity: 1;\s*transition: none/);
});
test("masonry details share the desktop workspace and retain the mobile drawer", () => {
  assert.match(square, /const noteDesktopPanel=noteDetailActive&&desktopWorkspace/);
  assert.match(square, /workspaceSelected=\{workspaceDetailActive\}/);
  assert.match(square, /noteDesktopPanel\?noteDetailContent:inlineRouteActive/);
  assert.match(square, /open=\{noteDetailActive&&!desktopWorkspace\}/);
  const css=readFileSync(new URL('../src/components/SquareNoteDetail.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/height:min\(125vw|height:min\(720px/);
  assert.match(css,/square-reader-photo>button\{position:absolute;inset:0/);
});

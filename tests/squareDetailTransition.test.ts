import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const square = readFileSync(new URL("../src/pages/SquarePage.tsx", import.meta.url), "utf8");
test("mobile detail captures its origin without scrolling or timer-driven phases", () => {
  const mobileOpen = square.slice(square.indexOf("const sourceRect = statementCardRefs"), square.indexOf("const openStatementDrawer"));
  assert.match(mobileOpen, /setInlineStatementExpanded\(true\)/);
  assert.match(mobileOpen, /setInlineTransitionPhase\("preparing"\)/);
  assert.match(mobileOpen, /getBoundingClientRect/);
  assert.doesNotMatch(mobileOpen, /setTimeout|requestAnimationFrame|alignStatementBelowHeader/);
  assert.match(square, /animateSquareDetail\(nodes, origin, true/);
  assert.match(square, /prepareDetailImages\(nodes.surface, controller.signal\)/);
});
test("feed remains mounted and detail does not overwrite feed card refs", () => {
  assert.doesNotMatch(square, /inlineStatementExpanded && !desktopWorkspace \? null : \(\s*<VirtualDynamicList/);
  assert.match(square, /cardRef=\{inDetail \? undefined/);
  assert.match(square, /renderFeedStatement\(activeCommentStatement, true\)/);
  assert.match(square, /preserveFeedLayout=\{inDetail && !desktopWorkspace\}/);
});
test("detail media loads eagerly and cached video covers are checked before paint", () => {
  assert.match(square, /loading=\{detail \? "eager" : "lazy"\}/);
  assert.match(square, /eager=\{detail\}/);
  const video = readFileSync(new URL("../src/components/StatementVideoThumbnail.tsx", import.meta.url), "utf8");
  assert.match(video, /useLayoutEffect\(\(\) =>/);
  assert.match(video, /imageRef.current\?\.complete && imageRef.current.naturalWidth > 0/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const square = readFileSync(new URL("../src/pages/SquarePage.tsx", import.meta.url), "utf8");
test("mobile detail commits once without delayed scrolling or reverse morphs", () => {
  const mobileOpen = square.slice(square.indexOf("// Commit one opaque detail surface"), square.indexOf("const openStatementDrawer"));
  assert.match(mobileOpen, /setInlineStatementExpanded\(true\)/);
  assert.match(mobileOpen, /setInlineTransitionPhase\("open"\)/);
  assert.doesNotMatch(mobileOpen, /setTimeout|requestAnimationFrame|alignStatementBelowHeader/);
  assert.match(square, /if \(!desktopWorkspace\) \{\s*finishInlineStatementClose\(navigateAfter\)/);
});
test("feed remains mounted and detail does not overwrite feed card refs", () => {
  assert.doesNotMatch(square, /inlineStatementExpanded && !desktopWorkspace \? null : \(\s*<VirtualDynamicList/);
  assert.match(square, /cardRef=\{inDetail \? undefined/);
  assert.match(square, /renderFeedStatement\(activeCommentStatement, true\)/);
});
test("detail media loads eagerly and cached video covers are checked before paint", () => {
  assert.match(square, /loading=\{detail \? "eager" : "lazy"\}/);
  assert.match(square, /eager=\{detail\}/);
  const video = readFileSync(new URL("../src/components/StatementVideoThumbnail.tsx", import.meta.url), "utf8");
  assert.match(video, /useLayoutEffect\(\(\) =>/);
  assert.match(video, /imageRef.current\?\.complete && imageRef.current.naturalWidth > 0/);
});

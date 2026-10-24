import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { legacySubmissionDestination } from "../src/lib/submissionRouting.ts";

const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("old submission links preserve detail and role without reviving the Square workspace", () => {
  assert.equal(legacySubmissionDestination("/app/square", "?workspace=submissions&view=reviewer&submission=66"), "/app/submissions/66?view=reviewer");
  assert.equal(legacySubmissionDestination("/app/square/submissions/66", "?view=author"), "/app/submissions/66?view=author");
  assert.equal(legacySubmissionDestination("/app/square", "?workspace=submissions"), "/app/submissions");
  assert.equal(legacySubmissionDestination("/app/square", "?workspace=submissions&submission=0&view=other"), "/app/submissions");
  assert.equal(legacySubmissionDestination("/app/square", "?workspace=submissions&submission=https://evil.test&token=secret"), "/app/submissions");
  assert.equal(legacySubmissionDestination("/app/square/statements/66", "?view=reviewer"), null);
  assert.equal(legacySubmissionDestination("/app/square", "?user_id=5"), null);
});

test("submission navigation is independent and remains feature gated", () => {
  const nav = read("components/AppBottomNav.tsx");
  assert.match(nav, /key: "submissions", href: "\/app\/submissions"/);
  assert.match(nav, /pathname.startsWith\("\/app\/submissions"\)\) return "submissions"/);
  assert.match(nav, /route.key === "submissions"\) return features.ready && features.submissionEnabled/);
  const app = read("App.tsx");
  assert.match(app, /RequireSubmissionFeature><ChatsPage purpose="submission" \/>/);
  assert.doesNotMatch(app, /squareIntegrated/);
});

test("Square no longer fetches submission lists or renders a mixed workspace", () => {
  const square = read("pages/SquarePage.tsx");
  assert.doesNotMatch(square, /getChats\(undefined, "submission"|getSubmissionRecipients|squareWorkspace|submissionTransitioning|squareIntegrated/);
  const chats = read("pages/ChatsPage.tsx");
  assert.doesNotMatch(chats, /squareIntegrated|embeddedListOnly|onReturnToSquare|submission-avatar-stack|is-submission-item|submission-status-filters/);
  assert.match(chats, /<PageTabs label=\{t\("submission.switchView"\)\}/);
  assert.match(chats, /<SelectControl label=\{t\("submission.filterLabel"\)\}/);
  assert.match(chats, /submission-thread-row/);
  assert.match(chats, /navigate\(`\/app\/submissions\?view=\$\{role\}`\)/);
});

test("settings and submission filters share the same keyboard-accessible dropdown", () => {
  const source = read("components/SettingRow.tsx");
  assert.match(source, /export function SelectControl/);
  assert.match(source, /trailing=\{<SelectControl \{\.\.\.props\} \/>\}/);
  assert.match(source, /event.key === "Escape"/);
  assert.match(source, /"ArrowDown", "ArrowUp", "Home", "End"/);
});

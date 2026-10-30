import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

test("search preserves its drawer parent from details and opens directly from quick actions", () => {
  const source = fs.readFileSync(new URL("../src/pages/ChatsPage.tsx", import.meta.url), "utf8");
  const handler = source.match(/const openMessageSearch = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(handler, "shared search handler exists");
  for (const parentOpen of [false, true]) {
    const state: Record<string, unknown> = { details: parentOpen, search: false, keyword: "old", type: 2, expanded: true };
    const setters = Object.fromEntries(Object.entries({
      setDetailsSheetOpen: "details", setMessageSearchOpen: "search", setMessageSearchKeyword: "keyword",
      setMessageSearchType: "type", setMessageSearchResults: "results", setMessageSearchState: "state", setQuickActionsExpanded: "expanded",
    }).map(([setter, key]) => [setter, (value: unknown) => { state[key] = value; }]));
    vm.runInNewContext(handler[1], setters);
    assert.equal(state.details, parentOpen, "parent must not trigger history.back during the child push");
    assert.equal(state.search, true);
    assert.equal(state.keyword, "");
    assert.equal(state.type, null);
    assert.equal(state.expanded, false);
  }
});

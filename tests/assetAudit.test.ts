import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import postcss from "postcss";
import { auditAssets, policy } from "../scripts/audit-assets.mjs";

function fixture(fn: (root: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "frienden-assets-test-"));
  try {
    for (const file of policy.protected) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), "fixture");
    }
    fs.mkdirSync(path.join(root, "src"));
    fn(root);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
test("clean assets ignore API paths and dynamic filenames", () => fixture(root => {
  fs.writeFileSync(path.join(root, "src/test.ts"), 'const api="/maps/me"; const dynamic=`/assets/avatars/v2/${id}.png`;');
  assert.deepEqual(auditAssets(root).failures, []);
}));
test("retired source assets fail without deleting anything automatically", () => fixture(root => {
  const file = path.join(root, policy.retired.find((p: string) => p.endsWith(".webp"))!);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, "retired");
  assert.ok(auditAssets(root).failures.some(item => item.includes("Retired asset remains")));
  assert.ok(fs.existsSync(file));
}));
test("missing static resources are detected even with query strings", () => fixture(root => {
  fs.writeFileSync(path.join(root, "src/test.css"), '.art{background:url("/icons/missing.png?v=2")}');
  assert.ok(auditAssets(root).failures.some(item => item.includes("/icons/missing.png")));
}));
test("built audit rejects stale directories and missing compatibility files", () => fixture(root => {
  fs.cpSync(path.join(root, "public"), path.join(root, "dist"), { recursive: true });
  assert.deepEqual(auditAssets(root, true).failures, []);
  fs.mkdirSync(path.join(root, "dist/assets/xiaobai"), { recursive: true });
  fs.rmSync(path.join(root, "dist/icons/sermo-192.png"));
  const failures = auditAssets(root, true).failures;
  assert.ok(failures.some(item => item.includes("Retired asset remains")));
  assert.ok(failures.some(item => item.includes("Required compatibility asset missing")));
}));
test("retired Xiaobai bubbles normalize to default, supported themes are unchanged", () => {
  const source = fs.readFileSync(new URL("../src/pages/ChatsPage.tsx", import.meta.url), "utf8");
  const fn = source.slice(source.indexOf("function visibleBubbleStyle("), source.indexOf("const MENTION_SELECTION_ACCENTS"));
  const script = ts.transpileModule(`${fn}; visibleBubbleStyle(value);`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  assert.equal(vm.runInNewContext(script, { value: "xiaobai" }), "default");
  assert.equal(vm.runInNewContext(script, { value: "fufu" }), "fufu");
  const styles = fs.readFileSync(new URL("../src/styles/app/39-personalization-tools.css", import.meta.url), "utf8");
  const avatar = fs.readFileSync(new URL("../src/components/UserAvatar.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(styles + avatar, /xiaobai/i);
  postcss.parse(styles).walkRules(rule => {
    let depth = 0;
    for (const char of rule.selector) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      assert.ok(depth >= 0, rule.selector);
    }
    assert.equal(depth, 0, rule.selector);
  });
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("../scripts/prepare-github-pages.mjs", import.meta.url);
test("Pages gets a real extensionless authorization entry with the exact app bootstrap", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "frienden-pages-entry-"));
  try {
    fs.mkdirSync(path.join(root, "dist"));
    const html = '<!doctype html><meta name="frienden-release" content="test"><script type="module" src="/assets/app.js"></script>';
    fs.writeFileSync(path.join(root, "dist/index.html"), html);
    const result = spawnSync(process.execPath, [script.pathname], { cwd: root, env: { ...process.env, SERMO_CNAME: "frienden.jyonn.space" }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(root, "dist/oauth/authorize.html"), "utf8"), html);
    assert.equal(fs.readFileSync(path.join(root, "dist/404.html"), "utf8"), html);
    assert.equal(fs.readFileSync(path.join(root, "dist/CNAME"), "utf8"), "frienden.jyonn.space\n");
    assert.equal(fs.existsSync(path.join(root, "dist/oauth/authorize/index.html")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

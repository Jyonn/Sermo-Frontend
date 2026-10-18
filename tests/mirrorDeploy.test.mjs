import assert from "node:assert/strict";
import test from "node:test";
import { deploymentPlan, ENTRY_FILES, entryFileArguments } from "../scripts/mirror-deploy-plan.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const env = { MIRROR_HOST: "example.test", MIRROR_KEY: "~/Resources/Subscription/Server/tencent", MIRROR_DIRECTORY: "/home/ubuntu/sermo-frontend/dist" };

test("deployment preserves old assets and excludes entries until the final stages", () => {
  const plan = deploymentPlan(env);
  assert.equal(plan.destination, "ubuntu@example.test:/home/ubuntu/sermo-frontend/dist/");
  assert.ok(plan.resources.includes("dist/"));
  for (const file of [...ENTRY_FILES, "release.json"]) assert.ok(plan.resources.includes(`--exclude=/${file}`));
  assert.ok(!plan.common.some((value) => value.startsWith("--delete")));
  assert.ok(plan.common.includes("-azc"));
  assert.match(plan.common.at(-1), /StrictHostKeyChecking=yes/);
});

test("dry run and unsafe configuration fail safely", () => {
  assert.ok(deploymentPlan(env, true).common.includes("--dry-run"));
  for (const change of [{ MIRROR_HOST: "" }, { MIRROR_HOST: "-bad" }, { MIRROR_PORT: "70000" }, { MIRROR_DIRECTORY: "/" }, { MIRROR_DIRECTORY: "/home/../dist" }, { MIRROR_KEY: "relative" }]) {
    assert.throws(() => deploymentPlan({ ...env, ...change }));
  }
});

test("entry publication keeps nested authorization HTML out of resources and preserves its path", () => {
  assert.ok(deploymentPlan(env).resources.includes("--exclude=/oauth/authorize.html"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "frienden-mirror-entries-"));
  try {
    fs.mkdirSync(path.join(root, "dist/oauth"), { recursive: true });
    fs.mkdirSync(path.join(root, "published"));
    for (const file of ENTRY_FILES) fs.writeFileSync(path.join(root, "dist", file), `content:${file}`);
    const result = spawnSync("rsync", ["-a", ...entryFileArguments(ENTRY_FILES), "../published/"], { cwd: path.join(root, "dist"), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    for (const file of ENTRY_FILES) assert.equal(fs.readFileSync(path.join(root, "published", file), "utf8"), `content:${file}`);
    assert.equal(fs.existsSync(path.join(root, "published/authorize.html")), false);
    assert.equal(fs.existsSync(path.join(root, "published/dist")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

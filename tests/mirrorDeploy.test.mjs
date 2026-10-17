import assert from "node:assert/strict";
import test from "node:test";
import { deploymentPlan, ENTRY_FILES } from "../scripts/mirror-deploy-plan.mjs";

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

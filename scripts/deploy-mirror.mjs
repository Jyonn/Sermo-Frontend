import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { deploymentPlan, ENTRY_FILES, entryFileArguments } from "./mirror-deploy-plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const dryRun = process.argv.includes("--dry-run");
if (process.argv.slice(2).some((value) => value !== "--dry-run")) throw new Error("Only --dry-run is supported");
const env = { ...process.env };
const config = path.join(root, ".env.deploy.local");
if (fs.existsSync(config)) {
  for (const line of fs.readFileSync(config, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) throw new Error("Invalid deployment configuration line");
    if (env[match[1]] === undefined) env[match[1]] = match[2].trim();
  }
}
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { stdio: "inherit", cwd });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
};
const lock = path.join(root, ".mirror-deploy.lock");
let locked = false;
try {
  const plan = deploymentPlan(env, dryRun);
  fs.accessSync(plan.key, fs.constants.R_OK);
  const origin = new URL(env.MIRROR_PUBLIC_ORIGIN);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("MIRROR_PUBLIC_ORIGIN must be an HTTPS origin");
  fs.mkdirSync(lock);
  locked = true;
  const buildScript = env.MIRROR_BUILD_SCRIPT || "build:mirror";
  if (!["build:mirror", "build:frienden-mirror"].includes(buildScript)) throw new Error("Unsupported mirror build script");
  if (origin.origin === "https://frienden.6-79.cn" && buildScript !== "build:frienden-mirror") throw new Error("Frienden mirror requires its matching build");
  if (buildScript === "build:frienden-mirror" && origin.origin !== "https://frienden.6-79.cn") throw new Error("Frienden build requires its own mirror origin");
  if (buildScript === "build:frienden-mirror" && !env.MIRROR_DIRECTORY?.endsWith("/frienden-frontend/dist")) throw new Error("Frienden build requires its own mirror directory");
  run("npm", ["run", buildScript]);
  const expected = JSON.parse(fs.readFileSync("dist/release.json", "utf8")).id;
  console.log(`${dryRun ? "Preview" : "Deploy"} mirror release ${expected}`);
  run("rsync", [...plan.resources, plan.destination]);
  const entries = ENTRY_FILES.filter((name) => fs.existsSync(`dist/${name}`));
  run("rsync", [...plan.common, ...entryFileArguments(entries), plan.destination], path.join(root, "dist"));
  run("rsync", [...plan.common, "dist/release.json", plan.destination]);
  if (dryRun) console.log("Dry run finished; no remote files changed.");
  else {
    const url = new URL("/release.json", origin);
    url.searchParams.set("deploy", `${expected}-${Date.now()}`);
    const response = await fetch(url, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok || (await response.json()).id !== expected) throw new Error("Mirror release verification failed; do not report deployment success");
    console.log(`Mirror verified: ${expected}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (locked) fs.rmdirSync(lock);
}

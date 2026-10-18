import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Reuse the operator's existing gh/git authorization. No deployment token is created.
const repository = "Jyonn/Frienden-Frontend";
const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
if (process.argv.length > 2) throw new Error("No arguments supported");
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
  return result.stdout.trim();
}
const lock = path.join(root, ".mirror-deploy.lock");
fs.mkdirSync(lock);
try {
  const sourceCommit = run("git", ["rev-parse", "HEAD"]);
  console.log("Building Frienden Pages with the shared deployment lock");
  run("npm", ["run", "build:frienden"]);
  const release = JSON.parse(fs.readFileSync("dist/release.json", "utf8")).id;
  if (fs.readFileSync("dist/CNAME", "utf8").trim() !== "frienden.jyonn.space") throw new Error("Wrong build target");
  for (const file of fs.readdirSync("dist", { recursive: true })) {
    const source = path.join("dist", file);
    if (!fs.statSync(source).isFile()) continue;
    if (file.endsWith(".map") || file.startsWith("tmp/") || file.startsWith(".env")) throw new Error("Unexpected deployment file");
    if (fs.statSync(source).size > 95 * 1024 * 1024) throw new Error("Deployment file exceeds GitHub file limit");
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "frienden-pages-"));
  try {
    run("gh", ["repo", "clone", repository, temporary, "--", "--depth=1", "--single-branch"]);
    const site = path.join(temporary, "site");
    fs.mkdirSync(site, { recursive: true });
    // Preserve previous hashed assets for stale clients; replace entry/release files.
    fs.cpSync(path.join(root, "dist"), site, { recursive: true });
    const workflows = path.join(temporary, ".github/workflows");
    fs.mkdirSync(workflows, { recursive: true });
    fs.copyFileSync("scripts/frienden-pages-workflow.yml", path.join(workflows, "deploy-pages.yml"));
    fs.writeFileSync(path.join(temporary, "README.md"), `# Frienden deployment\n\nPublic static build artifacts only. Source: https://github.com/Jyonn/Sermo-Frontend/commit/${sourceCommit}\n\nRelease: ${release}\nDomain: https://frienden.jyonn.space\n`);
    run("git", ["add", "site", ".github/workflows/deploy-pages.yml", "README.md"], temporary);
    if (!run("git", ["diff", "--cached", "--name-only"], temporary)) console.log("Frienden deployment already matches this build");
    else {
      run("git", ["commit", "-m", `Publish Frienden ${release}`], temporary);
      run("git", ["push", "origin", "HEAD:main"], temporary);
    }
    console.log(`Frienden ${release} pushed; verify the Pages run and public HTTPS release ID`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
} finally {
  fs.rmdirSync(lock);
}

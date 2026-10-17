import path from "node:path";
import os from "node:os";

export const ENTRY_FILES = ["index.html", "404.html", "sw.js", "sw-release.js"];

export function deploymentPlan(env, dryRun = false) {
  const host = env.MIRROR_HOST || "";
  const user = env.MIRROR_USER || "ubuntu";
  const port = env.MIRROR_PORT || "22";
  const directory = env.MIRROR_DIRECTORY || "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host)) throw new Error("Set a confirmed MIRROR_HOST in .env.deploy.local");
  if (!/^[a-zA-Z0-9_-]+$/.test(user) || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("Invalid SSH user or port");
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)+dist$/.test(directory)) throw new Error("MIRROR_DIRECTORY must be an absolute safe path ending in /dist");
  let key = env.MIRROR_KEY || "";
  if (key.startsWith("~/")) key = path.join(os.homedir(), key.slice(2));
  if (!path.isAbsolute(key)) throw new Error("MIRROR_KEY must be an absolute path or ~/ path");
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  const ssh = ["ssh", "-i", key, "-p", port, "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3"];
  const common = ["-azc", "--itemize-changes", "--delay-updates", ...(dryRun ? ["--dry-run"] : []), "-e", ssh.map(quote).join(" ")];
  return {
    key, destination: `${user}@${host}:${directory}/`, common,
    resources: [...common, ...[...ENTRY_FILES, "release.json"].map((name) => `--exclude=/${name}`), "dist/"],
  };
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export const policy = JSON.parse(fs.readFileSync(new URL("retired-assets.json", import.meta.url), "utf8"));

export function walk(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  });
}

export function auditAssets(root, built = false) {
  const failures = [];
  for (const relative of [...policy.retired, ...policy.protected]) {
    if (path.isAbsolute(relative) || relative.split("/").includes("..")) throw new Error("Unsafe asset policy path");
  }
  for (const relative of policy.retired) {
    const candidate = built ? relative.startsWith("public/") ? `dist/${relative.slice(7)}` : null : relative;
    if (candidate && fs.existsSync(path.join(root, candidate))) failures.push(`Retired asset remains: ${candidate}`);
  }
  for (const relative of policy.protected) {
    const candidate = built ? `dist/${relative.slice(7)}` : relative;
    if (!fs.existsSync(path.join(root, candidate))) failures.push(`Required compatibility asset missing: ${candidate}`);
  }
  // Templates and server-selected assets need runtime checks, not guessed deletion.
  const sourceFiles = [
    ...walk(path.join(root, "src")).filter(file => /\.(css|tsx?|json)$/.test(file)),
    ...["index.html", "public/manifest.json", "public/sw.js", "public/site-migration.json"].map(file => path.join(root, file)).filter(file => fs.existsSync(file)),
  ];
  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/["'`](\/(?:assets|icons|activity|fonts|miniprogram-assets|labs|maps)\/[^"'`\s)]+)["'`]/g)) {
      const resource = match[1].split(/[?#]/)[0];
      if (resource.includes("${") || !/\.(?:png|jpe?g|webp|svg|gif|ico|avif|woff2?|ttf|glb|json|mp3|ogg|wav)$/i.test(resource)) continue;
      const candidate = path.join(root, built ? "dist" : "public", resource.slice(1));
      if (!fs.existsSync(candidate)) failures.push(`Missing literal asset ${resource} in ${path.relative(root, file)}`);
    }
  }
  const directory = path.join(root, built ? "dist" : "public");
  const files = walk(directory);
  return { failures: [...new Set(failures)], files: files.length, bytes: files.reduce((total, file) => total + fs.statSync(file).size, 0) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const built = process.argv.includes("--built");
  const result = auditAssets(projectRoot, built);
  console.log(JSON.stringify({ scope: built ? "dist" : "public", ...result }, null, 2));
  if (result.failures.length) process.exitCode = 1;
}

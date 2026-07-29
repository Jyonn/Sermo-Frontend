import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "release-notes.json");
const publicDirectory = path.join(root, "public");
const releasePath = path.join(publicDirectory, "release.json");
const workerReleasePath = path.join(publicDirectory, "sw-release.js");

const fail = (message) => {
  console.error(`Invalid release notes: ${message}`);
  process.exit(1);
};

if (!fs.existsSync(sourcePath)) fail("release-notes.json is missing");

let release;
try {
  release = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
} catch {
  fail("release-notes.json is not valid JSON");
}

if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(release.id ?? "")) {
  fail("id must use YYYY.MM.DD.N format");
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(release.publishedAt ?? "")) {
  fail("publishedAt must use YYYY-MM-DD format");
}

for (const locale of ["zh-CN", "en"]) {
  const content = release.locales?.[locale];
  if (!content?.title?.trim()) fail(`${locale} title is required`);
  if (!Array.isArray(content.items) || content.items.length < 1 || content.items.length > 5) {
    fail(`${locale} must contain 1-5 update items`);
  }
  if (content.items.some((item) => typeof item !== "string" || !item.trim())) {
    fail(`${locale} update items must be non-empty strings`);
  }
}

fs.mkdirSync(publicDirectory, { recursive: true });
fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);
fs.writeFileSync(
  workerReleasePath,
  `self.SERMO_RELEASE_ID = ${JSON.stringify(release.id)};\n`,
);

console.log(`Prepared release ${release.id}`);

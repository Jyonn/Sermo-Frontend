import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const en = JSON.parse(fs.readFileSync(path.join(root, "src/locales/en/translation.json"), "utf8"));
const zhCN = JSON.parse(fs.readFileSync(path.join(root, "src/locales/zh-CN/translation.json"), "utf8"));
const enKeys = Object.keys(en).sort();
const zhKeys = Object.keys(zhCN).sort();
const missingInEnglish = zhKeys.filter((key) => !(key in en));
const missingInChinese = enKeys.filter((key) => !(key in zhCN));

const sourceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(target);
  }
}
walk(path.join(root, "src"));

const referencedKeys = new Set();
const hardcodedChinese = [];
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bt\(\s*["']([^"']+)["']/g)) {
    referencedKeys.add(match[1]);
  }
  source.split(/\r?\n/).forEach((line, index) => {
    if (/\p{Script=Han}/u.test(line)) {
      hardcodedChinese.push(`${path.relative(root, file)}:${index + 1}`);
    }
  });
}
const unknownKeys = [...referencedKeys].filter((key) => !(key in en)).sort();

if (missingInEnglish.length || missingInChinese.length || unknownKeys.length || hardcodedChinese.length) {
  if (missingInEnglish.length) console.error("Missing in English:", missingInEnglish.join(", "));
  if (missingInChinese.length) console.error("Missing in Chinese:", missingInChinese.join(", "));
  if (unknownKeys.length) console.error("Unknown translation keys:", unknownKeys.join(", "));
  if (hardcodedChinese.length) console.error("Hardcoded Chinese in source:", hardcodedChinese.join(", "));
  process.exit(1);
}

console.log(`i18n resources OK: ${enKeys.length} keys across 2 locales`);

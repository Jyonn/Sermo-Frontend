import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const localesRoot = path.join(root, "src/locales");
const localeNames = fs.readdirSync(localesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(localesRoot, entry.name, "translation.json")))
  .map((entry) => entry.name)
  .sort();
const resources = Object.fromEntries(localeNames.map((locale) => [
  locale,
  JSON.parse(fs.readFileSync(path.join(localesRoot, locale, "translation.json"), "utf8")),
]));
const en = resources.en;
const zhCN = resources["zh-CN"];
const enKeys = Object.keys(en).sort();
const zhKeys = Object.keys(zhCN).sort();
const missingInEnglish = zhKeys.filter((key) => !(key in en));
const missingInChinese = enKeys.filter((key) => !(key in zhCN));
const localeMismatches = [];
const placeholderMismatches = [];
const emptyTranslations = [];
const placeholders = (value) => [...String(value).matchAll(/\{\{\s*([^,}\s]+)[^}]*\}\}/g)]
  .map((match) => match[1])
  .sort();
for (const [locale, resource] of Object.entries(resources)) {
  const keys = Object.keys(resource).sort();
  const missing = enKeys.filter((key) => !(key in resource));
  const extra = keys.filter((key) => !(key in en));
  if (missing.length || extra.length) {
    localeMismatches.push(`${locale}: missing [${missing.join(", ")}], extra [${extra.join(", ")}]`);
  }
  for (const key of enKeys) {
    if (!(key in resource)) continue;
    if (!String(resource[key]).trim()) emptyTranslations.push(`${locale}:${key}`);
    if (placeholders(en[key]).join("|") !== placeholders(resource[key]).join("|")) {
      placeholderMismatches.push(`${locale}:${key}`);
    }
  }
}

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
const hardcodedChineseExemptFiles = new Set([
  "src/pages/PlatformAdminPage.tsx",
  "src/pages/SquareComposerLabPage.tsx",
]);
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bt\(\s*["']([^"']+)["']/g)) {
    referencedKeys.add(match[1]);
  }
  source.split(/\r?\n/).forEach((line, index) => {
    const relativeFile = path.relative(root, file);
    if (/\p{Script=Han}/u.test(line) && !hardcodedChineseExemptFiles.has(relativeFile) && !line.includes("i18n-ignore")) {
      hardcodedChinese.push(`${relativeFile}:${index + 1}`);
    }
  });
}
const unknownKeys = [...referencedKeys].filter((key) => !(key in en)).sort();

if (missingInEnglish.length || missingInChinese.length || localeMismatches.length || placeholderMismatches.length || emptyTranslations.length || unknownKeys.length || hardcodedChinese.length) {
  if (missingInEnglish.length) console.error("Missing in English:", missingInEnglish.join(", "));
  if (missingInChinese.length) console.error("Missing in Chinese:", missingInChinese.join(", "));
  if (localeMismatches.length) console.error("Locale key mismatches:", localeMismatches.join("\n"));
  if (placeholderMismatches.length) console.error("Placeholder mismatches:", placeholderMismatches.join(", "));
  if (emptyTranslations.length) console.error("Empty translations:", emptyTranslations.join(", "));
  if (unknownKeys.length) console.error("Unknown translation keys:", unknownKeys.join(", "));
  if (hardcodedChinese.length) console.error("Hardcoded Chinese in source:", hardcodedChinese.join(", "));
  process.exit(1);
}

console.log(`i18n resources OK: ${enKeys.length} keys across ${localeNames.length} locales`);

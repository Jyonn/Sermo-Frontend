import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import postcss from "postcss";

const root = process.cwd();
const styleDir = path.join(root, "src/styles/app");
const baselinePath = path.join(root, "style-debt-baseline.json");
const expectedFiles = [
  "00-foundation.css",
  "10-chat-city.css",
  "20-profile-settings.css",
  "30-personalization.css",
  "35-avatar-frames.css",
  "39-personalization-tools.css",
  "40-square-platform.css",
  "50-chat-settings.css",
  "60-profile-themes.css",
  "70-square-composer.css",
  "80-chat-messages.css",
  "81-chat-moderation.css",
  "90-viewport.css",
];

const normalizeSelector = (selector) => selector.replace(/\s+/g, " ").trim();

function isInsideKeyframes(rule) {
  let current = rule.parent;
  while (current) {
    if (current.type === "atrule" && /keyframes$/i.test(current.name)) return true;
    current = current.parent;
  }
  return false;
}

function ruleContext(rule) {
  const context = [];
  let current = rule.parent;
  while (current) {
    if (current.type === "atrule") {
      context.unshift(`@${current.name} ${current.params}`.trim());
    }
    current = current.parent;
  }
  return context.join(" > ");
}

function selectorWeight(selector) {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
  const classes = selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g)?.length ?? 0;
  return ids * 100 + classes * 10;
}

async function collectMetrics() {
  const diskFiles = (await readdir(styleDir))
    .filter((file) => file.endsWith(".css"))
    .sort();
  const unexpectedFiles = diskFiles.filter((file) => !expectedFiles.includes(file));
  const missingFiles = expectedFiles.filter((file) => !diskFiles.includes(file));
  const ruleOwners = new Map();
  const perFile = {};
  let rules = 0;
  let important = 0;
  let duplicateDeclarations = 0;
  let complexSelectors = 0;
  let longLines = 0;

  for (const file of expectedFiles.filter((name) => diskFiles.includes(name))) {
    const source = await readFile(path.join(styleDir, file), "utf8");
    const fileMetrics = {
      rules: 0,
      important: 0,
      duplicateDeclarations: 0,
      complexSelectors: 0,
      longLines: 0,
    };
    fileMetrics.longLines = source.split("\n").filter((line) => line.length > 500).length;
    longLines += fileMetrics.longLines;
    const parsed = postcss.parse(source, { from: file });

    parsed.walkRules((rule) => {
      if (isInsideKeyframes(rule)) return;
      rules += 1;
      fileMetrics.rules += 1;
      const selector = normalizeSelector(rule.selector);
      const ruleKey = `${ruleContext(rule)}\n${selector}`;
      const owners = ruleOwners.get(ruleKey) ?? [];
      owners.push(file);
      ruleOwners.set(ruleKey, owners);

      const declarations = new Set();
      rule.each((child) => {
        if (child.type !== "decl") return;
        const property = child.prop.toLowerCase();
        if (declarations.has(property)) {
          duplicateDeclarations += 1;
          fileMetrics.duplicateDeclarations += 1;
        }
        declarations.add(property);
      });
      if (selectorWeight(selector) > 120) {
        complexSelectors += 1;
        fileMetrics.complexSelectors += 1;
      }
    });

    parsed.walkDecls((declaration) => {
      if (!declaration.important) return;
      important += 1;
      fileMetrics.important += 1;
    });
    perFile[file] = fileMetrics;
  }

  const duplicateRuleBlocks = [...ruleOwners.values()].filter(
    (owners) => owners.length > 1,
  ).length;
  const crossFileDuplicateSelectors = [...ruleOwners.values()].filter(
    (owners) => new Set(owners).size > 1,
  ).length;

  return {
    expectedFiles,
    unexpectedFiles,
    missingFiles,
    totals: {
      rules,
      important,
      duplicateDeclarations,
      duplicateRuleBlocks,
      crossFileDuplicateSelectors,
      complexSelectors,
      longLines,
      compatibilityRules: 0,
    },
    perFile,
  };
}

function compareBudget(actual, budget, prefix = "") {
  const errors = [];
  for (const [key, maximum] of Object.entries(budget)) {
    const value = actual[key];
    if (typeof maximum === "number" && value > maximum) {
      errors.push(`${prefix}${key}: ${value} exceeds the debt budget of ${maximum}`);
    }
  }
  return errors;
}

const metrics = await collectMetrics();

if (process.argv.includes("--update-baseline")) {
  const baseline = {
    totals: metrics.totals,
    perFile: Object.fromEntries(
      Object.entries(metrics.perFile).map(([file, values]) => [
        file,
        {
          important: values.important,
          duplicateDeclarations: values.duplicateDeclarations,
          complexSelectors: values.complexSelectors,
          longLines: values.longLines,
        },
      ]),
    ),
  };
  await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Updated ${path.relative(root, baselinePath)}`);
  process.exit(0);
}

const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const errors = [
  ...metrics.missingFiles.map((file) => `Missing stylesheet module: ${file}`),
  ...metrics.unexpectedFiles.map((file) => `Unregistered stylesheet module: ${file}`),
  ...compareBudget(metrics.totals, baseline.totals, "total "),
];

for (const [file, budget] of Object.entries(baseline.perFile)) {
  if (!metrics.perFile[file]) continue;
  errors.push(...compareBudget(metrics.perFile[file], budget, `${file} `));
}

const expectedImports = `${expectedFiles
  .map((file) => `@import "./src/styles/app/${file}";`)
  .join("\n")}\n`;
const actualImports = await readFile(path.join(root, "styles.css"), "utf8");
if (actualImports !== expectedImports) {
  errors.push("styles.css must contain only the registered module imports in numeric order");
}

console.log(JSON.stringify(metrics.totals, null, 2));
if (errors.length > 0) {
  console.error(`\nStyle architecture check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("Style architecture check passed.");

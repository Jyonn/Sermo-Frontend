import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json" with { type: "json" };

countries.registerLocale(en);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(root, "public/maps/adm1");
const indexOnly = process.argv.includes("--index-only");
const requested = process.argv.slice(2).filter((value) => value !== "--index-only").map((code) => code.toUpperCase());
const countryCodes = requested.length ? requested : Object.keys(countries.getAlpha3Codes()).sort();
const chinaSubdivisionCodes = {
  Hainan: "CN-HI", Taiwan: "CN-TW", Guangxi: "CN-GX", Fujian: "CN-FJ",
  Yunnan: "CN-YN", Guizhou: "CN-GZ", Jiangxi: "CN-JX", Hunan: "CN-HN",
  Zhejiang: "CN-ZJ", Shanghai: "CN-SH", Chongqing: "CN-CQ", Hubei: "CN-HB",
  Sichuan: "CN-SC", Anhui: "CN-AH", Jiangsu: "CN-JS", Henan: "CN-HA",
  Tibet: "CN-XZ", Shandong: "CN-SD", Qinghai: "CN-QH", Ningxia: "CN-NX",
  Shaanxi: "CN-SN", Tianjin: "CN-TJ", Shanxi: "CN-SX", Beijing: "CN-BJ",
  Gansu: "CN-GS", Hebei: "CN-HE", Liaoning: "CN-LN", Jilin: "CN-JL",
  Xinjiang: "CN-XJ", "Inner Mongolia": "CN-NM", Heilongjiang: "CN-HL",
  Macau: "CN-MO", "Hong Kong": "CN-HK", Guangzhou: "CN-GD",
};

await mkdir(outputDir, { recursive: true });

function compactFeature(feature, countryCode) {
  const properties = feature.properties ?? {};
  const name = String(properties.shapeName || properties.name || properties.NAME_1 || properties.name_1 || "").trim();
  const chinaCode = countryCode === "CHN"
    ? Object.entries(chinaSubdivisionCodes).find(([prefix]) => name.startsWith(prefix))?.[1]
    : null;
  const sourceCode = properties.shapeISO === countryCode ? "" : properties.shapeISO;
  const code = String(chinaCode || sourceCode || properties.iso_3166_2 || properties.adm1_code || properties.shapeID || name).trim();
  return {
    type: "Feature",
    properties: { name: name || code, code: code || name },
    geometry: feature.geometry,
  };
}

function geometryBounds(features) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (value) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      bounds[0] = Math.min(bounds[0], value[0]);
      bounds[1] = Math.min(bounds[1], value[1]);
      bounds[2] = Math.max(bounds[2], value[0]);
      bounds[3] = Math.max(bounds[3], value[1]);
      return;
    }
    value.forEach(visit);
  };
  features.forEach((item) => visit(item.geometry?.coordinates));
  return bounds.every(Number.isFinite) ? bounds : undefined;
}

async function download(code) {
  const geometryUrl = `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/${code}/ADM1/geoBoundaries-${code}-ADM1_simplified.geojson`;
  const geometryResponse = await fetch(geometryUrl, { signal: AbortSignal.timeout(30000) });
  if (!geometryResponse.ok) throw new Error(`geometry ${geometryResponse.status}`);
  const geometry = await geometryResponse.json();
  const payload = {
    type: "FeatureCollection",
    features: (geometry.features ?? []).map((feature) => compactFeature(feature, code)).filter((item) => item.geometry && item.properties.name),
  };
  if (!payload.features.length) throw new Error("empty geometry");
  const serialized = JSON.stringify(payload);
  await writeFile(resolve(outputDir, `${code}.json`), serialized);
  return {
    code,
    available: true,
    regions: payload.features.length,
    bytes: Buffer.byteLength(serialized),
    bounds: geometryBounds(payload.features),
  };
}

const index = [];
for (let offset = 0; !indexOnly && offset < countryCodes.length; offset += 5) {
  const batch = countryCodes.slice(offset, offset + 5);
  const results = await Promise.all(batch.map(async (code) => {
    try {
      const result = await download(code);
      process.stdout.write(`✓ ${code} ${result.regions}\n`);
      return result;
    } catch (error) {
      process.stdout.write(`· ${code} unavailable (${error.message})\n`);
      return { code, available: false, regions: 0, bytes: 0 };
    }
  }));
  index.push(...results);
}

const previousIndexPath = resolve(root, "public/maps/index.json");
let previous = [];
try {
  previous = JSON.parse(await readFile(previousIndexPath, "utf8")).countries ?? [];
} catch {
  // First cache generation.
}
const merged = new Map(previous.map((item) => [item.code, item]));
index.forEach((item) => merged.set(item.code, item));
await Promise.all([...merged.values()].map(async (item) => {
  if (!item.available || item.bounds) return;
  try {
    const payload = JSON.parse(await readFile(resolve(outputDir, `${item.code}.json`), "utf8"));
    item.bounds = geometryBounds(payload.features ?? []);
  } catch {
    // Keep unavailable legacy entries unchanged.
  }
}));
await writeFile(previousIndexPath, JSON.stringify({
  source: "geoBoundaries gbOpen ADM1",
  license: "CC BY 4.0",
  generated_at: new Date().toISOString(),
  countries: [...merged.values()].sort((a, b) => a.code.localeCompare(b.code)),
}, null, 2));

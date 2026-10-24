import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const manifest = JSON.parse(read("public/manifest.json"));
function opaquePng(file: string, size: number) {
  const png = fs.readFileSync(new URL(`../public${file}`, import.meta.url));
  assert.equal(png.subarray(1,4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
  assert.equal(png[25], 2, `${file} must be RGB without alpha`);
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    assert.notEqual(png.subarray(offset+4,offset+8).toString(), "tRNS");
    offset += length + 12;
  }
}
test("every install and shortcut icon is square and fully opaque", () => {
  for (const icon of manifest.icons) opaquePng(icon.src, Number(icon.sizes.split("x")[0]));
  for (const shortcut of manifest.shortcuts) for (const icon of shortcut.icons) opaquePng(icon.src, 512);
  opaquePng("/icons/frienden-app-180-v3.png", 180);
  opaquePng("/icons/frienden-app-32-v3.png", 32);
  const html = read("index.html");
  assert.match(html, /apple-touch-icon[^>]+frienden-app-180-v3.png/);
  assert.match(html, /apple-mobile-web-app-title" content="Frienden 友间"/);
});
test("install brand is space-independent across prompts, guides and OS metadata", () => {
  assert.equal(manifest.name, "Frienden 友间");
  assert.equal(manifest.short_name, manifest.name);
  assert.equal(manifest.id, "/?source=pwa");
  assert.equal(manifest.start_url, "/pwa?source=pwa");
  for (const locale of ["en", "zh-CN"]) assert.equal(JSON.parse(read(`src/locales/${locale}/translation.json`))["pwa.appName"], manifest.name);
  for (const file of ["PwaRecommendation", "PwaInstallSheet"]) {
    const code = read(`src/components/${file}.tsx`);
    assert.match(code, /const appName = t\("pwa.appName"\)/);
    assert.doesNotMatch(code, /spaceName|getSpaceMe/);
  }
  const sw = read("public/sw.js");
  assert.match(sw, /sermo-shell-v11/);
  assert.match(sw, /frienden-app-512-v3.png/);
});
test("developer avatar retains the original brand and a separate editable DEV tag", () => {
  opaquePng("/icons/frienden-dev-512.png", 512);
  for (const number of [1,2,3]) {
    const svg = read(`logos/dev/concept-${number}.svg`);
    assert.match(svg, /viewBox="0 0 512 512"/);
    assert.match(svg, /id="brand-mark"/);
    assert.match(svg, /id="developer-tag"/);
    assert.match(svg, /frienden-512.png/);
  }
});

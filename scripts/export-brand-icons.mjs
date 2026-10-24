// Optional artwork tool, not a build dependency. Requires Sharp in the tool runtime.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const sharp = createRequire(import.meta.url)("sharp");
const root = fileURLToPath(new URL("../", import.meta.url));
const mark = await fs.readFile(path.join(root, "public/icons/frienden-512.png"));
const background = "#f7f4ec";
for (const [name, size, inset] of [["frienden-app-32-v3.png",32,.1],["frienden-app-180-v3.png",180,.1],["frienden-app-192-v3.png",192,.1],["frienden-app-512-v3.png",512,.1],["frienden-app-maskable-192-v3.png",192,.16],["frienden-app-maskable-512-v3.png",512,.16]]) {
  const edge = Math.round(size * inset);
  const logo = await sharp(mark).resize(size - edge * 2, size - edge * 2).png().toBuffer();
  await sharp({ create: { width:size, height:size, channels:3, background } }).composite([{ input:logo,left:edge,top:edge }]).removeAlpha().png().toFile(path.join(root,"public/icons",name));
}
for (const number of [1,2,3]) {
  const svg = (await fs.readFile(path.join(root, `logos/dev/concept-${number}.svg`), "utf8")).replace('../../public/icons/frienden-512.png', `data:image/png;base64,${mark.toString("base64")}`);
  await sharp(Buffer.from(svg)).resize(512,512).flatten({ background }).removeAlpha().png().toFile(path.join(root,`logos/dev/concept-${number}.png`));
}
await fs.copyFile(path.join(root,"logos/dev/concept-3.png"),path.join(root,"public/icons/frienden-dev-512.png"));
console.log("Exported opaque PWA icons and three DEV avatar concepts.");

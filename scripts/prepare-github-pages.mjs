import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const index = path.join(dist, "index.html");

if (!fs.existsSync(index)) {
  throw new Error("dist/index.html is missing");
}

// GitHub Pages serves 404.html for unknown SPA routes while preserving the URL.
fs.copyFileSync(index, path.join(dist, "404.html"));
fs.writeFileSync(path.join(dist, "CNAME"), "sermo.jyonn.space\n");

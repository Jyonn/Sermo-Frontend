import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from '/Users/jyonn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, 'source', 'spider-avatar-frame.svg');
const assets = path.join(here, 'assets');

await sharp(source, { density: 192 }).resize(1024, 1024).png().toFile(path.join(assets, 'spider-avatar-frame-1024.png'));
await sharp(source, { density: 192 }).resize(512, 512).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(assets, 'spider-avatar-frame-512.webp'));
await sharp(source, { density: 192 }).resize(256, 256).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(assets, 'spider-avatar-frame-256.webp'));

console.log('Built Spider-Man avatar frame assets.');

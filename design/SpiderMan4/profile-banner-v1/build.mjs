import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from '/Users/jyonn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, 'source', 'profile-banner-imagegen-master.png');
const assets = path.join(here, 'assets');

await sharp(source)
  .png({ compressionLevel: 9 })
  .toFile(path.join(assets, 'spider-profile-banner-1774x887.png'));

await sharp(source)
  .resize(1536, 768, { fit: 'cover', position: 'centre' })
  .webp({ quality: 91 })
  .toFile(path.join(assets, 'spider-profile-banner-1536x768.webp'));

await sharp(source)
  .resize(1024, 512, { fit: 'cover', position: 'centre' })
  .webp({ quality: 88 })
  .toFile(path.join(assets, 'spider-profile-banner-1024x512.webp'));

// 1.75:1 safe crop for narrow profile drawers and mobile profile pages.
await sharp(source)
  .resize(1400, 800, { fit: 'cover', position: 'centre' })
  .webp({ quality: 90 })
  .toFile(path.join(assets, 'spider-profile-banner-mobile-1400x800.webp'));

// Wide crop used by compact profile cards and collection previews.
await sharp(source)
  .resize(1200, 480, { fit: 'cover', position: 'centre' })
  .webp({ quality: 88 })
  .toFile(path.join(assets, 'spider-profile-banner-preview-1200x480.webp'));

console.log('Built Spider-Man profile banner assets.');

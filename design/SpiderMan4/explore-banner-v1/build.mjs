import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from '/Users/jyonn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, 'source', 'official-poster-reference.jpg');
const assets = path.join(here, 'assets');

const width = 2160;
const height = 720;

const background = await sharp(source)
  .extract({ left: 0, top: 255, width: 2000, height: 667 })
  .resize(width, height, { fit: 'fill' })
  .modulate({ brightness: 0.76, saturation: 0.88 })
  .sharpen({ sigma: 0.7 })
  .png()
  .toBuffer();

const atmosphere = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#07101d" stop-opacity="0.98"/>
        <stop offset="0.38" stop-color="#0a1423" stop-opacity="0.86"/>
        <stop offset="0.64" stop-color="#09121f" stop-opacity="0.26"/>
        <stop offset="1" stop-color="#050a12" stop-opacity="0.18"/>
      </linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.56" stop-color="#050b14" stop-opacity="0"/>
        <stop offset="1" stop-color="#03070d" stop-opacity="0.73"/>
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="13"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#shade)"/>
    <rect width="${width}" height="${height}" fill="url(#floor)"/>
    <ellipse cx="1160" cy="620" rx="560" ry="75" fill="#d8202f" opacity="0.12" filter="url(#glow)"/>
    <path d="M-30 585 C360 460 650 535 965 382 C1280 229 1585 312 2200 68" fill="none" stroke="#f4f7fb" stroke-width="4" opacity="0.17"/>
    <path d="M-40 605 C360 480 655 555 978 401 C1295 249 1605 330 2210 88" fill="none" stroke="#d6e5f5" stroke-width="1.5" opacity="0.22"/>
  </svg>`);

const copy = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur"/>
        <feOffset dy="5" result="offset"/>
        <feFlood flood-color="#000" flood-opacity="0.72"/>
        <feComposite in2="offset" operator="in"/>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#e11d2e"/>
        <stop offset="0.72" stop-color="#f34a43"/>
        <stop offset="1" stop-color="#f2be3f"/>
      </linearGradient>
    </defs>
    <g transform="translate(118 132)" filter="url(#shadow)">
      <text x="0" y="0" dominant-baseline="hanging" fill="#f5f7fa"
        font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="42" font-weight="650" letter-spacing="9">探索页限时活动</text>
      <text x="0" y="82" dominant-baseline="hanging" fill="#ffffff"
        font-family="Arial Narrow, Helvetica Neue, sans-serif" font-size="102" font-weight="900" letter-spacing="-3">SPIDER-MAN</text>
      <text x="5" y="190" dominant-baseline="hanging" fill="url(#line)"
        font-family="Arial Narrow, Helvetica Neue, sans-serif" font-size="59" font-style="italic" font-weight="900" letter-spacing="10">BRAND NEW DAY</text>
      <rect x="4" y="278" width="668" height="5" rx="2.5" fill="url(#line)"/>
      <text x="4" y="316" dominant-baseline="hanging" fill="#cbd3dc"
        font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="34" font-weight="500" letter-spacing="3">新的身份，新的城市篇章</text>
    </g>
    <g transform="translate(1790 589)">
      <rect width="270" height="78" rx="39" fill="#070d16" fill-opacity="0.76" stroke="#f2f5f8" stroke-opacity="0.42" stroke-width="2"/>
      <circle cx="40" cy="39" r="8" fill="#e52937"/>
      <text x="68" y="40" dominant-baseline="middle" fill="#ffffff"
        font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="34" font-weight="650" letter-spacing="5">敬请期待</text>
    </g>
  </svg>`);

const clean = await sharp(background)
  .composite([{ input: atmosphere }])
  .png()
  .toBuffer();

await sharp(clean).png({ compressionLevel: 9 }).toFile(path.join(assets, 'explore-banner-background-2160x720.png'));
await sharp(clean).webp({ quality: 90 }).toFile(path.join(assets, 'explore-banner-background-2160x720.webp'));

const finished = await sharp(clean)
  .composite([{ input: copy }])
  .png()
  .toBuffer();

await sharp(finished).png({ compressionLevel: 9 }).toFile(path.join(assets, 'explore-banner-coming-soon-2160x720.png'));
await sharp(finished).webp({ quality: 90 }).toFile(path.join(assets, 'explore-banner-coming-soon-2160x720.webp'));

await sharp(finished).resize(1080, 360).webp({ quality: 88 }).toFile(path.join(assets, 'explore-banner-coming-soon-1080x360.webp'));

console.log('Built Spider-Man Explore banner assets.');

// One-shot asset builder. Renders the brand SVG icons → PNG files Expo needs.
// Run: node scripts/generate-icons.mjs
//
// Outputs:
//   assets/icon.png             1024×1024  square w/ blue background (iOS + Android legacy)
//   assets/adaptive-icon.png    1024×1024  trophy only on transparent (Android adaptive)
//   assets/splash-icon.png      1024×1024  trophy only on transparent (splash overlay)
//   assets/favicon.png          196×196    web tab icon (square w/ background)

import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '..', 'assets');

const FULL_SVG = readFileSync(join(ASSETS, 'icon-source.svg'));
const FG_SVG = readFileSync(join(ASSETS, 'icon-foreground-source.svg'));

async function render(svg, outName, size) {
  await sharp(svg, { density: 600 })
    .resize(size, size)
    .png()
    .toFile(join(ASSETS, outName));
  console.log(`✓ ${outName} (${size}×${size})`);
}

await render(FULL_SVG, 'icon.png', 1024);
await render(FG_SVG, 'adaptive-icon.png', 1024);
await render(FG_SVG, 'splash-icon.png', 1024);
await render(FULL_SVG, 'favicon.png', 196);

console.log('Done.');

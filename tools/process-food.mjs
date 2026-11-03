import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const RENDER_DIR = join(ROOT, 'art', 'food-render');
const OUT_DIR = join(ROOT, 'src', 'assets', 'icons', 'inventory-painted');
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json');

/**
 * Centers and resizes a transparent 3D render into a standard 256x256 inventory icon.
 */
async function processFoodIcon(inputPng, outputWebpName) {
  const inputBuffer = await readFile(inputPng);

  // 1. Trim transparent padding
  const trimmed = await sharp(inputBuffer)
    .trim({ threshold: 5 })
    .toBuffer({ resolveWithObject: true });

  // 2. Resize inside 224x224 bounding box
  const resized = await sharp(trimmed.data)
    .resize(224, 224, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  // 3. Center into 256x256 transparent square
  const padLeft = Math.floor((256 - resized.info.width) / 2);
  const padTop = Math.floor((256 - resized.info.height) / 2);
  const padRight = 256 - resized.info.width - padLeft;
  const padBottom = 256 - resized.info.height - padTop;

  const destPath = join(OUT_DIR, outputWebpName);
  await sharp(resized.data)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 94, alphaQuality: 100 })
    .toFile(destPath);

  console.log(`Saved: ${outputWebpName} (${resized.info.width}x${resized.info.height} -> 256x256)`);
}

async function main() {
  console.log('Processing food renders into 256x256 WebP icons...');

  // 1. pan_duro
  await processFoodIcon(join(RENDER_DIR, 'pan_duro.png'), 'pan-duro.webp');
  await processFoodIcon(join(RENDER_DIR, 'pan_duro.png'), 'comida-0.webp');

  // 2. comida_1 to comida_5
  for (let tier = 1; tier <= 5; tier++) {
    await processFoodIcon(join(RENDER_DIR, `comida_${tier}.png`), `comida-${tier}.webp`);
  }

  // 3. base comida fallback
  await processFoodIcon(join(RENDER_DIR, 'comida_1.png'), 'comida.webp');

  // 4. Update manifest.json
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const newIcons = [
    'pan-duro.webp',
    'comida.webp',
    'comida-0.webp',
    'comida-1.webp',
    'comida-2.webp',
    'comida-3.webp',
    'comida-4.webp',
    'comida-5.webp',
  ];

  for (const icon of newIcons) {
    if (!manifest.files.includes(icon)) {
      manifest.files.push(icon);
    }
  }
  manifest.files.sort();
  manifest.food = newIcons;
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Updated manifest.json: now has ${manifest.files.length} files registered.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

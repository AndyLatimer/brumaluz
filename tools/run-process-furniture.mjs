import { generateFurnitureFromPng } from './process-furniture.mjs';
import { join } from 'node:path';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const RENDER_DIR = 'art/furniture-render';
const OUT_DIR = 'src/assets/icons/inventory-painted';

const kinds = [
  'taburete',
  'mesa',
  'biblioteca',
  'estacion',
  'silla',
  'banco',
  'mesita',
  'arcon',
  'alfombra',
  'farol',
  'macetero',
  'biombo',
];

for (const kind of kinds) {
  const pngPath = join(RENDER_DIR, `${kind}.png`);
  console.log(`Processing furniture ${kind} from ${pngPath}...`);
  await generateFurnitureFromPng(pngPath, kind, OUT_DIR);
}

// Update manifest.json
const manifestPath = join(OUT_DIR, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
const files = (await readdir(OUT_DIR)).filter(f => f.endsWith('.webp')).sort();
manifest.files = files;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`Updated manifest with ${files.length} webp icons.`);


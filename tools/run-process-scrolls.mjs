import { generateScrollFromPng } from './process-scrolls.mjs';
import { join } from 'node:path';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const RENDER_DIR = 'art/scrolls-render';
const OUT_DIR = 'src/assets/icons/inventory-painted';

const elements = ['fire', 'frost', 'lightning', 'vampirism', 'dark'];

for (const elem of elements) {
  const pngPath = join(RENDER_DIR, `${elem}.png`);
  console.log(`Processing ${elem} from ${pngPath}...`);
  await generateScrollFromPng(pngPath, elem, OUT_DIR);
}

// Update manifest.json
const manifestPath = join(OUT_DIR, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
const files = (await readdir(OUT_DIR)).filter(f => f.endsWith('.webp')).sort();
manifest.files = files;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`Updated manifest with ${files.length} webp icons.`);


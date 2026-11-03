import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zstdDecompressSync } from 'node:zlib';
import { test } from 'node:test';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readLibraryCatalog } from '../tools/library-catalog.mjs';
import { mapEditorPlugin } from '../tools/map-editor-plugin.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const libraryDir = join(root, 'src', 'assets', 'library');
const packId = 'pompelin-world-props';
const manifest = JSON.parse(await readFile(join(root, 'art', 'world-props', 'manifest.json'), 'utf8'));
const own = JSON.parse(await readFile(join(libraryDir, packId, 'catalog.json'), 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

test('editable Blender file contains all 18 world-prop collections and shared painted atlas', async () => {
  const bytes = await readFile(join(root, 'art', 'world-props', 'pompelin-world-props.blend'));
  const blend = bytes.readUInt32LE(0) === 0xfd2fb528 ? zstdDecompressSync(bytes) : bytes;
  assert.equal(blend.subarray(0, 7).toString(), 'BLENDER');
  assert.equal(manifest.assets.length, 18);
  for (const asset of manifest.assets) {
    assert.ok(blend.includes(Buffer.from(asset.name)), `Missing Blender collection: ${asset.name}`);
  }
  assert.ok(blend.includes(Buffer.from('Pompelin_WorldProps_Painted_Atlas')));
});

test('pompelin-world-props pack is registered in the library catalog with self-contained grounded GLBs', async () => {
  const combined = await readLibraryCatalog(libraryDir);
  assert.ok(combined.packs.some(pack => pack.id === packId && pack.label === 'Pompelín · Caminos y campamentos'));
  assert.equal(own.assets.length, 18);
  assert.equal(combined.assets.filter(a => a.pack === packId).length, 18);

  for (const asset of own.assets) {
    const entry = manifest.assets.find(item => item.name === asset.name);
    assert.ok(entry, asset.name);
    assert.equal(asset.label, entry.label);
    assert.equal(asset.category, entry.category);
    const bytes = await readFile(join(libraryDir, asset.path));
    assert.equal(bytes.length, asset.bytes, asset.id);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.id);
    const gltf = (await io.read(join(libraryDir, asset.path))).getRoot();
    assert.equal(gltf.listMeshes().length, 1, asset.id);
    assert.equal(gltf.listMaterials().length, 1, asset.id);
    assert.ok(gltf.listTextures().length > 0, asset.id);
    const bounds = getBounds(gltf.listScenes()[0]);
    assert.deepEqual(bounds, asset.bounds, asset.id);
    assert.ok(Math.abs(bounds.min[1]) < 0.025, `${asset.id}: must rest on ground Y=0`);
  }
});

test('pompelin-world-props pack loads in /assets.html and in /maps.html map editor', { timeout: 120000 }, async () => {
  let server, browser;
  const temporary = await mkdtemp(join(tmpdir(), 'brumaluz-world-props-'));
  const mapsDir = join(temporary, 'maps');
  const publishDir = join(temporary, 'published');
  try {
    server = await createServer({
      root,
      logLevel: 'error',
      plugins: [mapEditorPlugin({ mapsDir, publishDir, sqlFile: join(temporary, 'world.sql') })],
      server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, temporary] } },
    });
    await server.listen();
    const url = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    // 1. Verify Asset Library (/assets.html)
    await page.goto(`${url}/assets.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('Listo.'), null, { timeout: 60000 });
    await page.locator('#pack').selectOption(packId);
    assert.equal(await page.locator('#asset option').count(), 18);
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('Listo.'), null, { timeout: 30000 });

    // 2. Verify Map Editor index, scale, 3D instantiation & collision boxes
    const mapAssetCheck = await page.evaluate(async packId => {
      const { loadMapAssetIndex, defaultScale, instantiateMapAsset, collisionBox } = await import('/src/world/mapAssets.ts');
      const assets = (await loadMapAssetIndex()).filter(asset => asset.group === packId);
      const out = [];
      for (const asset of assets) {
        const object = await instantiateMapAsset(asset.id);
        const box = await collisionBox(asset.id);
        let meshes = 0;
        object.traverse(part => { if (part.isMesh) meshes++; });
        out.push({
          id: asset.id,
          name: asset.name,
          groupLabel: asset.groupLabel,
          category: asset.category,
          scale: defaultScale(asset),
          meshes,
          collision: [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite) && !box.isEmpty(),
        });
      }
      return out;
    }, packId);

    assert.equal(mapAssetCheck.length, 18);
    for (const item of mapAssetCheck) {
      const expected = own.assets.find(a => a.id === item.id);
      assert.equal(item.name, expected.label);
      assert.equal(item.groupLabel, 'Pompelín · Caminos y campamentos');
      assert.equal(item.category, expected.category);
      assert.deepEqual(item.scale, [1, 1, 1]);
      assert.ok(item.meshes > 0 && item.collision, item.id);
    }

    // 3. Verify Map Editor UI (/maps.html) shows the new pack group chip and all 18 cards
    await page.goto(`${url}/maps.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 });
    const groupChip = page.locator('#catalog-groups button', { hasText: 'Pompelín · Caminos y campamentos' });
    assert.equal(await groupChip.count(), 1);
    await groupChip.click();
    assert.equal(await page.locator('#catalog-grid .asset').count(), 18);

    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server?.close();
    assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + sep));
    await rm(temporary, { recursive: true });
  }
});

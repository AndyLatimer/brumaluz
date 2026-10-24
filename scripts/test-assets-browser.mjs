import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { readLibraryCatalog } from '../tools/library-catalog.mjs';

const expectedCatalog = await readLibraryCatalog(fileURLToPath(new URL('../src/assets/library/', import.meta.url)));

const url = 'http://127.0.0.1:4182';
let server, browser;
before(async () => {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4182', '--strictPort']);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Library dev server did not start')), 15000);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Library server exited: ${code}`)));
    server.stdout.on('data', data => {
      if (stripVTControlCharacters(data.toString()).includes(url)) { clearTimeout(timer); resolve(); }
    });
    server.stderr.on('data', data => process.stderr.write(data));
  });
  assert.equal((await fetch(`${url}/assets.html`)).status, 200);
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
});
after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit'); server.kill(); await stopped;
  }
});
test('new resources load in a real browser and full animation families play in the library', { timeout: 240000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.location().url !== `${url}/favicon.ico`
      || message.type() === 'warning' && /PropertyBinding|No target node|extension/i.test(message.text())) errors.push(message.text());
  });
  try {
    await page.goto(`${url}/assets.html`);
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Listo.'), null, { timeout: 60000 });
    assert.equal(await page.locator('#summary').textContent(), `${expectedCatalog.assets.length} recursos de ${expectedCatalog.packs.length} paquetes`);
    const result = await page.evaluate(async () => {
      const { catalog, loadLibraryAsset } = await import('/src/art/library.ts');
      const old = ['resources', 'forest', 'adventurers', 'skeletons', 'dungeon'];
      let count = 0, meshes = 0;
      for (const asset of catalog.assets.filter(asset => !old.includes(asset.pack))) {
        const { gltf } = await loadLibraryAsset(asset.id);
        const geometries = new Set(), materials = new Set(), textures = new Set();
        gltf.scene.traverse(object => {
          if (!object.isMesh) return;
          meshes++;
          geometries.add(object.geometry);
          if (object.isSkinnedMesh) object.skeleton.dispose();
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            materials.add(material);
            for (const value of Object.values(material)) if (value?.isTexture) {
              if (!value.image?.width || !value.image?.height) throw new Error(`Unloaded texture: ${asset.id}`);
              textures.add(value);
            }
          }
          const positions = object.geometry.attributes.position;
          for (let index = 0; index < positions.count; index++) if (![positions.getX(index), positions.getY(index), positions.getZ(index)].every(Number.isFinite)) {
            throw new Error(`Invalid geometry: ${asset.id}`);
          }
        });
        for (const value of [...geometries, ...materials, ...textures]) value.dispose();
        count++;
      }
      return { count, meshes };
    });
    const old = ['resources', 'forest', 'adventurers', 'skeletons', 'dungeon'];
    const expected = expectedCatalog.assets.filter(asset => !old.includes(asset.pack)).length;
    assert.equal(result.count, expected);
    assert.ok(result.meshes > expected);
    await page.locator('#pack').selectOption('restaurant');
    assert.equal(await page.locator('#asset option').count(), 68);
    assert.equal(await page.locator('#asset option').filter({ hasText: /fridge|stove|oven|burger|ketchup|papertowel/ }).count(), 0);
    await page.locator('#pack').selectOption('character-animations');
    for (const [name, count] of [['Mannequin_Medium', 139], ['Mannequin_Large', 34]]) {
      const id = `character-animations/characters/${name}`;
      await page.locator('#asset').selectOption(id);
      await page.waitForFunction(({ name, count }) =>
        document.querySelector('#status').textContent.startsWith('Listo.')
        && document.querySelector('#details').textContent.startsWith(name + ' ·')
        && document.querySelector('#animation').options.length === count + 1, { name, count });
      for (let index = 0; index < count; index++) {
        await page.locator('#animation').selectOption(String(index));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
    }
    await page.locator('#pack').selectOption('kenney-hexagon');
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Listo.')
      && document.querySelector('#details').textContent.includes(' · Kenney ·'));
    assert.equal(await page.locator('#asset option').count(), 72);
    await page.locator('#pack').selectOption('medieval-builder');
    assert.equal(await page.locator('#asset option').count(), 229);
    await page.locator('#search').fill('watermill_wheel');
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Listo.')
      && document.querySelector('#details').textContent.startsWith('watermill_wheel ·'));
    assert.equal(await page.locator('#download').getAttribute('download'), 'watermill_wheel.glb');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

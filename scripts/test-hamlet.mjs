import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zstdDecompressSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
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
const packId = 'brumaluz-hamlet';
const manifest = JSON.parse(await readFile(join(root, 'art', 'hamlet', 'manifest.json'), 'utf8'));
const own = JSON.parse(await readFile(join(libraryDir, packId, 'catalog.json'), 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

test('the editable Blender project contains every exported asset', async () => {
  const bytes = await readFile(join(root, 'art', 'hamlet', 'brumaluz-hamlet.blend'));
  // Blender 5 saves compressed projects as Zstandard frames.
  const blend = bytes.readUInt32LE(0) === 0xfd2fb528 ? zstdDecompressSync(bytes) : bytes;
  assert.equal(blend.subarray(0, 7).toString(), 'BLENDER');
  for (const asset of manifest.assets) assert.ok(blend.includes(Buffer.from(asset.name)), `Missing Blender collection: ${asset.name}`);
  assert.ok(blend.includes(Buffer.from('Brumaluz_Hamlet_Painted_Atlas')));
});

test('Blender construction has closed frames, four bed supports and no suspended groups', { timeout: 45000 }, async t => {
  const blender=process.env.BLENDER_PATH ?? (process.platform==='win32'
    ? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' : 'blender');
  const result=spawnSync(blender,[
    '--background',join(root,'art','hamlet','brumaluz-hamlet.blend'),
    '--python-exit-code','1','--python',join(root,'tools','blender','audit_hamlet_joinery.py'),
  ],{cwd:root,encoding:'utf8',windowsHide:true,timeout:40000,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  if(result.error?.code==='ENOENT') { t.skip('Install Blender or set BLENDER_PATH to inspect native construction.'); return; }
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr||result.stdout);
  const checks=JSON.parse(await readFile(join(root,'art','hamlet','review','joinery-checks.json'),'utf8'));
  assert.equal(checks.bedPosts,4);
  assert.ok(checks.closedWindows>0);
  assert.ok(checks.continuousFrames>=checks.closedWindows);
  assert.equal(checks.suspendedCandidates,0,'Review named separated groups in joinery-candidates.json');
});

test('original Blender pack joins the library without changing the imported inventory or its license', async () => {
  const imported = JSON.parse(await readFile(join(libraryDir, 'catalog.json'), 'utf8'));
  const combined = await readLibraryCatalog(libraryDir);
  assert.ok(!imported.packs.some(pack => pack.id === packId));
  assert.deepEqual(combined.assets.slice(0, imported.assets.length), imported.assets);
  assert.deepEqual(combined.packs.slice(0, imported.packs.length), imported.packs);
  assert.equal(own.packs.length, 1);
  assert.equal(own.packs[0].id, packId);
  assert.equal(own.packs[0].license, null);
  assert.equal(own.packs[0].count, manifest.assets.length);
  assert.deepEqual(own.assets.map(asset => asset.name), manifest.assets.map(asset => asset.name));
  const arboleda = JSON.parse(await readFile(join(libraryDir, 'brumaluz-arboleda', 'catalog.json'), 'utf8'));
  assert.equal(combined.assets.length, imported.assets.length + own.assets.length + arboleda.assets.length);
  assert.equal(new Set(combined.assets.map(asset => asset.id)).size, combined.assets.length);
  assert.ok(own.assets.length > 0);
});

test('every exported GLB is self-contained, grounded, finite and matches the recorded bounds and geometry', async () => {
  for (const asset of own.assets) {
    const entry = manifest.assets.find(entry => entry.name === asset.name);
    assert.equal(asset.label, entry.label);
    assert.equal(asset.category, entry.category);
    const bytes = await readFile(join(libraryDir, asset.path));
    assert.equal(bytes.length, asset.bytes, asset.id);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.id);
    assert.equal(bytes.readUInt32LE(0), 0x46546c67, asset.id);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
    assert.ok((json.buffers ?? []).every(buffer => !buffer.uri), `${asset.id}: external buffer`);
    assert.ok((json.images ?? []).every(image => image.bufferView !== undefined && !image.uri), `${asset.id}: external image`);
    const gltf = (await io.read(join(libraryDir, asset.path))).getRoot();
    assert.equal(gltf.listSkins().length, 0, asset.id);
    assert.equal(gltf.listAnimations().length, 0, asset.id);
    assert.equal(gltf.listMeshes().length, asset.meshes, asset.id);
    assert.equal(gltf.listMeshes().length, 1, `${asset.id}: exports use one mesh`);
    assert.equal(gltf.listMaterials().length, 1, `${asset.id}: exports share one atlas material`);
    assert.ok(gltf.listTextures().length > 0, `${asset.id}: painted atlas must be embedded`);
    assert.ok(gltf.listMaterials()[0].getBaseColorTexture()?.getImage()?.byteLength > 0, asset.id);
    assert.equal(gltf.listScenes().length, 1, asset.id);
    const bounds = getBounds(gltf.listScenes()[0]);
    assert.deepEqual(bounds, asset.bounds, asset.id);
    assert.ok(Math.abs(bounds.min[1]) < 0.025, `${asset.id}: origin must sit on the ground`);
    assert.ok(bounds.max.every((value, axis) => Number.isFinite(value) && value > bounds.min[axis]), asset.id);
    let triangles = 0;
    for (const mesh of gltf.listMeshes()) for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      assert.ok(position?.getCount() > 0, asset.id);
      assert.ok(Array.from(position.getArray()).every(Number.isFinite), asset.id);
      triangles += (primitive.getIndices()?.getCount() ?? position.getCount()) / 3;
    }
    assert.equal(triangles, asset.triangles, asset.id);
    assert.ok(triangles <= (asset.category === 'Edificios' ? 18000 : 7000), `${asset.id}: map triangle budget exceeded (${triangles})`);
    for (const texture of gltf.listTextures()) assert.ok(texture.getImage()?.byteLength > 0, asset.id);
  }
});

test('Blender pack loads in the map editor at metre scale and publishes GLB imports for the game', { timeout: 180000 }, async () => {
  let server, browser;
  const temporary = await mkdtemp(join(tmpdir(), 'brumaluz-hamlet-'));
  const mapsDir = join(temporary, 'maps');
  const publishDir = join(temporary, 'published');
  try {
    server = await createServer({
      root, configFile: false, logLevel: 'error', assetsInclude: ['**/*.glb'],
      plugins: [mapEditorPlugin({ mapsDir, publishDir, sqlFile: join(temporary, 'world.sql') })],
      server: { host: '127.0.0.1', port: 0, fs: { allow: [root, temporary] } },
    });
    await server.listen();
    const url = server.resolvedUrls.local[0].replace(/\/$/, '');
    browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
      headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${url}/assets.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Listo.'), null, { timeout: 60000 });
    await page.locator('#pack').selectOption(packId);
    assert.equal(await page.locator('#asset option').count(), own.assets.length);
    const result = await page.evaluate(async packId => {
      const { loadMapAssetIndex, defaultScale, instantiateMapAsset, collisionBox } = await import('/src/world/mapAssets.ts');
      const assets = (await loadMapAssetIndex()).filter(asset => asset.group === packId);
      const data = [];
      for (const asset of assets) {
        const object = await instantiateMapAsset(asset.id);
        const box = await collisionBox(asset.id);
        let meshes = 0;
        object.traverse(part => { if (part.isMesh) meshes++; });
        data.push({ id: asset.id, name: asset.name, category: asset.category, scale: defaultScale(asset), meshes,
          collision: [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite) && !box.isEmpty() });
      }
      return data;
    }, packId);
    assert.equal(result.length, own.assets.length);
    for (const entry of result) {
      const asset = own.assets.find(asset => asset.id === entry.id);
      assert.equal(entry.name, asset.label);
      assert.equal(entry.category, asset.category);
      assert.deepEqual(entry.scale, [1, 1, 1]);
      assert.ok(entry.meshes > 0 && entry.collision, entry.id);
    }
    assert.deepEqual(errors, []);
    const maps = await server.ssrLoadModule('/src/data/maps.ts');
    const map = maps.newMap('hamlet_test', 'Barrio artesanal', { width: 32, depth: 32, cell: 2 });
    const asset = own.assets[0];
    map.objects.push({ id: 'pieza', asset: asset.id, layer: map.layers[0].id, position: [5, 0, 5], rotation: [0, 0, 0], scale: [1, 1, 1], collision: 'auto' });
    const saved = await fetch(`${url}/__dev/maps/${map.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-None-Match': '*' }, body: JSON.stringify(map) });
    assert.equal(saved.status, 201, await saved.text());
    const published = await fetch(`${url}/__dev/maps/__published`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: map.id }) });
    const publication = await published.json();
    assert.equal(published.status, 200, JSON.stringify(publication));
    assert.equal(publication.published.assets, 1);
    assert.equal(publication.published.bytes, asset.bytes);
    const output = join(publishDir, 'maps', `${map.id}.ts`);
    const module = await server.ssrLoadModule(output);
    assert.ok(module.assets[asset.id].includes('.glb'));
    assert.ok((await readFile(output, 'utf8')).includes(asset.path + '?url'));
  } finally {
    await browser?.close();
    await server?.close();
    // El único árbol eliminado es el directorio temporal creado por esta prueba.
    assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + sep));
    await rm(temporary, { recursive: true });
  }
});

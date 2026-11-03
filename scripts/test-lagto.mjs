import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zstdDecompressSync } from 'node:zlib';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readLibraryCatalog } from '../tools/library-catalog.mjs';
import { mapEditorPlugin } from '../tools/map-editor-plugin.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const libraryDir = join(root, 'src', 'assets', 'library');
const packId = 'brumaluz-lagto';
const artDir = join(root, 'art', 'lagto');
const manifest = JSON.parse(await readFile(join(artDir, 'manifest.json'), 'utf8'));
const own = JSON.parse(await readFile(join(libraryDir, packId, 'catalog.json'), 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

test('editable Blender project contains all 50 Lagto collections and shared painted atlas', async () => {
  const bytes = await readFile(join(artDir, 'brumaluz-lagto.blend'));
  const blend = bytes.readUInt32LE(0) === 0xfd2fb528 ? zstdDecompressSync(bytes) : bytes;
  assert.equal(blend.subarray(0, 7).toString(), 'BLENDER');
  assert.equal(manifest.assets.length, 50);
  for (const asset of manifest.assets) {
    assert.ok(blend.includes(Buffer.from(asset.name)), `Falta la colección en Blender: ${asset.name}`);
  }
  assert.ok(blend.includes(Buffer.from('Brumaluz_Lagto_Painted_Atlas')));
});

test('brumaluz-lagto pack is registered in the library catalog with self-contained grounded GLBs', async () => {
  const combined = await readLibraryCatalog(libraryDir);
  assert.ok(combined.packs.some(pack => pack.id === packId && pack.label === "Cumbres de Cobre · Pueblo Lagto'"));
  assert.equal(own.assets.length, 50);
  assert.equal(combined.assets.filter(a => a.pack === packId).length, 50);

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
    assert.ok(Math.abs(bounds.min[1]) < 0.025, `${asset.id}: debe apoyar en el suelo Y=0`);
  }
});

test('Lagto pack loads and displays in /assets.html and /maps.html', { timeout: 120000 }, async () => {
  let server, browser;
  const temporary = await mkdtemp(join(tmpdir(), 'brumaluz-lagto-test-'));
  const mapsDir = join(temporary, 'maps');
  const publishDir = join(temporary, 'published');
  try {
    server = await createServer({
      root,
      logLevel: 'error',
      plugins: [mapEditorPlugin({ mapsDir, publishDir, sqlFile: join(temporary, 'world.sql') })],
      server: { host: '127.0.0.1', port: 0, hmr: false, watch: {ignored:['**/*']}, fs: { allow: [root, temporary] } },
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

    // 1. Vista de recursos (/assets.html)
    await page.goto(`${url}/assets.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('Listo.'), null, { timeout: 60000 });
    await page.locator('#pack').selectOption(packId);
    assert.equal(await page.locator('#asset option').count(), 50);
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('Listo.'), null, { timeout: 30000 });

    // 2. Editor de mapas (/maps.html)
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
          category: asset.category,
          scale: defaultScale(asset),
          meshes,
          hasBox: !box.isEmpty(),
        });
      }
      return { total: assets.length, sample: out };
    }, packId);

    assert.equal(mapAssetCheck.total, 50, 'Los 50 modelos deben estar disponibles en el editor de mapas');
    for (const item of mapAssetCheck.sample) {
      assert.deepEqual(item.scale, [1, 1, 1], `Escala incorrecta en ${item.id}`);
      assert.ok(item.meshes > 0, `No se instanció la malla para ${item.id}`);
      assert.ok(item.hasBox, `Caja de colisión vacía para ${item.id}`);
    }
    assert.equal(errors.length, 0, `Errores en el navegador: ${errors.join('; ')}`);
  } finally {
    await browser?.close();
    await server?.close();
  }
});

test('all Lagto models have embedded PBR surfaces, filtered UVs and clean indexed triangles',async()=>{
 for(const asset of own.assets){
  const doc=await io.read(join(libraryDir,asset.path)),root=doc.getRoot(),material=root.listMaterials()[0];
  assert.equal(root.getExtras().materialsVersion,2,asset.name);
  assert.equal(material.getAlphaMode(),'OPAQUE',asset.name);
  assert.ok(material.getBaseColorTexture()&&material.getNormalTexture()&&material.getMetallicRoughnessTexture()&&material.getEmissiveTexture(),`${asset.name}: complete PBR maps`);
  assert.equal(material.getBaseColorTextureInfo().getMinFilter(),9987,`${asset.name}: mipmaps`);
  assert.equal(root.listTextures().length,4,`${asset.name}: four shared atlases`);
  for(const t of root.listTextures())assert.deepEqual(t.getSize(),[2048,1024]);
  for(const primitive of root.listMeshes()[0].listPrimitives()){
   const positions=primitive.getAttribute('POSITION').getArray(),normals=primitive.getAttribute('NORMAL').getArray(),uv=primitive.getAttribute('TEXCOORD_0').getArray(),indices=primitive.getIndices().getArray(),seen=new Set();
   assert.ok(Array.from(positions).every(Number.isFinite));assert.ok(Array.from(normals).every(Number.isFinite));
   assert.ok(Array.from(uv).every(n=>n>0&&n<1),`${asset.name}: atlas gutters`);
   for(let i=0;i<indices.length;i+=3){
    const points=[0,1,2].map(j=>Array.from(positions.subarray(indices[i+j]*3,indices[i+j]*3+3)));
    const[a,b,c]=points,u=b.map((n,k)=>n-a[k]),v=c.map((n,k)=>n-a[k]);
    assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>=1e-9,`${asset.name}: zero-area triangle`);
    const key=points.map(p=>p.map(n=>Math.round(n*1e7)).join(',')).sort().join('|');assert.ok(!seen.has(key),`${asset.name}: duplicate triangle`);seen.add(key);
    for(let j=0;j<3;j++){const n=indices[i+j]*3;assert.ok(Math.abs(Math.hypot(normals[n],normals[n+1],normals[n+2])-1)<.002,`${asset.name}: unit normal`);}
   }
  }
 }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { zstdDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { readLibraryCatalog } from '../tools/library-catalog.mjs';

const library = new URL('../src/assets/library/', import.meta.url);
const art = new URL('../art/arboleda/', import.meta.url);
const own = JSON.parse(await readFile(new URL('brumaluz-arboleda/catalog.json', library), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('manifest.json', art), 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

test('all 30 grove assets have editable Blender collections and join the shared library', async () => {
  const bytes = await readFile(new URL('brumaluz-arboleda.blend', art));
  const blend = bytes.readUInt32LE(0) === 0xfd2fb528 ? zstdDecompressSync(bytes) : bytes;
  assert.equal(blend.subarray(0,7).toString(), 'BLENDER');
  assert.equal(own.assets.length, 30);
  assert.deepEqual(own.assets.map(a=>a.name), manifest.assets.map(a=>a.name));
  for (const a of own.assets) assert.ok(blend.includes(Buffer.from(a.name)), a.name);
  assert.ok(blend.includes(Buffer.from('Brumaluz_Arboleda_Painted_Atlas')));
  const combined = await readLibraryCatalog(fileURLToPath(library));
  assert.equal(combined.assets.filter(a=>a.pack==='brumaluz-arboleda').length, 30);
  assert.equal(new Set(combined.assets.map(a=>a.id)).size, combined.assets.length);
  assert.equal(own.packs[0].license, null);
});

test('each GLB has embedded paint, finite vertices, a ground origin and a map geometry budget', async () => {
  for (const a of own.assets) {
    const url = new URL(a.path, library);
    const bytes = await readFile(url);
    assert.equal(bytes.length,a.bytes,a.id);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256,a.id);
    const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    assert.ok(json.buffers.every(b=>!b.uri),a.id);
    assert.ok(json.images.every(i=>i.bufferView!==undefined && !i.uri),a.id);
    const gltf=(await io.readBinary(bytes)).getRoot();
    assert.equal(gltf.listScenes().length,1,a.id);
    assert.equal(gltf.listMeshes().length,1,a.id);
    assert.equal(gltf.listMaterials().length,1,a.id);
    assert.ok(gltf.listMaterials()[0].getBaseColorTexture()?.getImage()?.byteLength>0,a.id);
    const bounds=getBounds(gltf.listScenes()[0]);
    assert.deepEqual(bounds,a.bounds,a.id);
    assert.ok(Math.abs(bounds.min[1])<.025,a.id);
    assert.ok([...bounds.min,...bounds.max].every(Number.isFinite),a.id);
    let triangles=0;
    for(const p of gltf.listMeshes()[0].listPrimitives()) {
      assert.ok(Array.from(p.getAttribute('POSITION').getArray()).every(Number.isFinite),a.id);
      triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
    }
    assert.equal(triangles,a.triangles,a.id);
    assert.ok(triangles<=(a.category==='Edificios'?20000:12000),`${a.id}: ${triangles} triangles`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { zstdDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
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
      const position=p.getAttribute('POSITION');
      assert.ok(Array.from(position.getArray()).every(Number.isFinite),a.id);
      const indices=p.getIndices()?.getArray()??Uint32Array.from({length:position.getCount()},(_,i)=>i);
      const xyz=position.getArray();
      for(let i=0;i<indices.length;i+=3) {
        const a0=indices[i]*3,b0=indices[i+1]*3,c0=indices[i+2]*3;
        const ux=xyz[b0]-xyz[a0],uy=xyz[b0+1]-xyz[a0+1],uz=xyz[b0+2]-xyz[a0+2];
        const vx=xyz[c0]-xyz[a0],vy=xyz[c0+1]-xyz[a0+1],vz=xyz[c0+2]-xyz[a0+2];
        const areaSquared=(uy*vz-uz*vy)**2+(uz*vx-ux*vz)**2+(ux*vy-uy*vx)**2;
        assert.ok(areaSquared>1e-20,`${a.id}: degenerate exported triangle ${i/3}`);
      }
      triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
    }
    assert.equal(triangles,a.triangles,a.id);
    assert.ok(triangles<=(a.category==='Edificios'?20000:12000),`${a.id}: ${triangles} triangles`);
  }
});

test('native surfaces have no exposed coplanar overlaps or intersecting roof shingles', {timeout:90000}, async t => {
  const blender=process.env.BLENDER_PATH??(process.platform==='win32'?'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe':'blender');
  const result=spawnSync(blender,[
    '--background',fileURLToPath(new URL('brumaluz-arboleda.blend',art)),
    '--python-exit-code','1','--python',fileURLToPath(new URL('../tools/blender/audit_arboleda_surfaces.py',import.meta.url)),
    '--','--strict',
  ],{encoding:'utf8',windowsHide:true,timeout:85000,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  if(result.error?.code==='ENOENT') { t.skip('Blender is needed to inspect native construction.'); return; }
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  const audit=JSON.parse(await readFile(new URL('review/surface-audit.json',art),'utf8'));
  assert.equal(audit.assets.length,30);
  assert.equal(audit.degenerateTriangles,0);
  assert.equal(audit.nonManifoldEdges,0);
  assert.equal(audit.exposedCoplanarPairs,0);
  assert.equal(audit.roofCrossings,0);
});

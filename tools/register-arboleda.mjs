import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'src/assets/library');
const pack = 'brumaluz-arboleda';
const manifest = JSON.parse(await readFile(join(root, 'art/arboleda/manifest.json'), 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const assets = [];
const names = new Set();
for (const entry of manifest.assets) {
  const { name, label, category, description } = entry;
  if (!/^[a-z][a-z0-9_]*$/.test(name) || names.has(name)) throw new Error(`Nombre inválido: ${name}`);
  names.add(name);
  const id = `${pack}/objects/${name}`;
  const path = `${id}.glb`;
  const bytes = await readFile(join(directory, path));
  const gltf = (await io.read(join(directory, path))).getRoot();
  const bounds = getBounds(gltf.listScenes()[0]);
  if (![...bounds.min, ...bounds.max].every(Number.isFinite) || Math.abs(bounds.min[1]) > .025) throw new Error(`Origen o límites incorrectos: ${name}`);
  const triangles = gltf.listMeshes().flatMap(m => m.listPrimitives()).reduce((n,p) => n+(p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount())/3,0);
  if (gltf.listMeshes().length !== 1 || gltf.listMaterials().length !== 1 || !gltf.listTextures().length) throw new Error(`Exportación sin atlas unificado: ${name}`);
  assets.push({ id, pack, kind: 'objects', name, label, category, description, path,
    source: `art/arboleda/brumaluz-arboleda.blend#${name}`, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), meshes: 1, skins: 0,
    rig: null, animations: [], bounds, triangles, materials: 1 });
}
await writeFile(join(directory, pack, 'catalog.json'), JSON.stringify({ version: 1,
  packs: [{ id: pack, label: manifest.title, author: manifest.author, description: manifest.description,
    count: assets.length, source: 'art/arboleda/brumaluz-arboleda.blend', license: null }], assets,
}, null, 2)+'\n');
console.log(`Arboleda: ${assets.length} modelos registrados, ${(assets.reduce((n,a)=>n+a.bytes,0)/1024/1024).toFixed(2)} MB.`);

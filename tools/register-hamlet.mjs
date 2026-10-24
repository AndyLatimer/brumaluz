import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const root = fileURLToPath(new URL('../', import.meta.url));
const pack = 'brumaluz-hamlet';
const directory = join(root, 'src', 'assets', 'library');
const manifest = JSON.parse(await readFile(join(root, 'art', 'hamlet', 'manifest.json'), 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const names = new Set();
const assets = [];
if (!Array.isArray(manifest.assets) || !manifest.assets.length) throw new Error('El manifiesto del barrio no contiene recursos.');

for (const entry of manifest.assets) {
  const { name, label, category } = entry;
  if (!/^[a-z][a-z0-9_-]*$/.test(name) || names.has(name)) throw new Error(`Nombre de recurso no válido o duplicado: ${name}`);
  if (!label?.trim() || !category?.trim()) throw new Error(`Falta etiqueta o categoría: ${name}`);
  names.add(name);
  const id = `${pack}/objects/${name}`;
  const path = `${id}.glb`;
  const filename = join(directory, path);
  const bytes = await readFile(filename);
  const document = await io.read(filename);
  const gltf = document.getRoot();
  const scenes = gltf.listScenes();
  if (scenes.length !== 1 || !gltf.listMeshes().length) throw new Error(`El recurso necesita una escena con geometría: ${name}`);
  const bounds = getBounds(scenes[0]);
  if (![...bounds.min, ...bounds.max].every(Number.isFinite)) throw new Error(`Límites no válidos: ${name}`);
  const triangles = gltf.listMeshes().flatMap(mesh => mesh.listPrimitives()).reduce((count, primitive) =>
    count + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0) / 3, 0);
  assets.push({
    id, pack, kind: 'objects', name, label, category, path,
    source: `art/hamlet/brumaluz-hamlet.blend#${name}`,
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    meshes: gltf.listMeshes().length, skins: gltf.listSkins().length, rig: null,
    animations: gltf.listAnimations().map(animation => animation.getName()), bounds,
    triangles, materials: gltf.listMaterials().length,
  });
}

const catalog = {
  version: 1,
  packs: [{
    id: pack, label: 'Brumaluz · Barrio artesanal', author: manifest.author ?? 'Brumaluz',
    description: manifest.description ?? 'Edificios, mobiliario y decoración originales para el editor de mapas.',
    targetProject: manifest.targetProject ?? 'Rusty Hearts',
    count: assets.length, source: 'art/hamlet/brumaluz-hamlet.blend',
    // El pack original no hereda la licencia CC0 de los paquetes importados.
    license: null,
  }],
  assets,
};
const target = join(directory, pack, 'catalog.json');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Registrados ${assets.length} recursos del barrio artesanal (${(assets.reduce((total, asset) => total + asset.bytes, 0) / 1024 / 1024).toFixed(2)} MB).`);

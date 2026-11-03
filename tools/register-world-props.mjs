import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const root = fileURLToPath(new URL('../', import.meta.url));
const pack = 'pompelin-world-props';
const directory = join(root, 'src', 'assets', 'library');
const artDir = join(root, 'art', 'world-props');
const manifestPath = join(artDir, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const names = new Set();
const assets = [];

if (!Array.isArray(manifest.assets) || !manifest.assets.length) {
  throw new Error('El manifiesto de props del mapa mundo no contiene recursos.');
}

await mkdir(join(directory, pack, 'objects'), { recursive: true });
await mkdir(join(directory, pack, 'textures'), { recursive: true });

const artAtlas = join(artDir, 'textures', 'world-props-atlas.png');
const libAtlas = join(directory, pack, 'textures', 'world-props-atlas.png');
if (existsSync(artAtlas) && !existsSync(libAtlas)) {
  await copyFile(artAtlas, libAtlas);
}

for (const entry of manifest.assets) {
  const { name, label, category, description } = entry;
  if (!/^[a-z][a-z0-9_-]*$/.test(name) || names.has(name)) {
    throw new Error(`Nombre de recurso no válido o duplicado: ${name}`);
  }
  if (!label?.trim() || !category?.trim()) {
    throw new Error(`Falta etiqueta o categoría: ${name}`);
  }
  names.add(name);
  const id = `${pack}/objects/${name}`;
  const path = `${id}.glb`;
  const filename = join(directory, path);
  const artGlb = join(artDir, 'objects', `${name}.glb`);
  if (!existsSync(filename) && existsSync(artGlb)) {
    await copyFile(artGlb, filename);
  }
  const bytes = await readFile(filename);
  const document = await io.read(filename);
  const gltf = document.getRoot();
  const scenes = gltf.listScenes();
  if (scenes.length !== 1 || !gltf.listMeshes().length) {
    throw new Error(`El recurso necesita una escena con geometría: ${name}`);
  }
  const bounds = getBounds(scenes[0]);
  if (![...bounds.min, ...bounds.max].every(Number.isFinite) || Math.abs(bounds.min[1]) > 0.025) {
    throw new Error(`Origen o límites no válidos: ${name}`);
  }
  const triangles = gltf.listMeshes().flatMap(mesh => mesh.listPrimitives()).reduce(
    (count, primitive) => count + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0) / 3,
    0,
  );
  if (gltf.listMeshes().length !== 1 || gltf.listMaterials().length !== 1 || !gltf.listTextures().length) {
    throw new Error(`Exportación sin atlas unificado: ${name}`);
  }
  assets.push({
    id,
    pack,
    kind: 'objects',
    name,
    label,
    category,
    description: description ?? '',
    path,
    source: `art/world-props/pompelin-world-props.blend#${name}`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    meshes: gltf.listMeshes().length,
    skins: gltf.listSkins().length,
    rig: null,
    animations: gltf.listAnimations().map(animation => animation.getName()),
    bounds,
    triangles,
    materials: gltf.listMaterials().length,
  });
}

const catalog = {
  version: 1,
  packs: [{
    id: pack,
    label: 'Pompelín · Caminos y campamentos',
    author: manifest.author ?? 'Brumaluz',
    description: manifest.description ?? 'Atrezo original de Blender para el mapa mundo de Pompelín: hitos, señales, humilladeros, ruinas, hogueras, tiendas, refugios, suministros, carromatos, almiares y embarcaderos. Escala métrica, +Y arriba y +Z frente en GLB.',
    count: assets.length,
    source: 'art/world-props/pompelin-world-props.blend',
    license: null,
  }],
  assets,
};

const target = join(directory, pack, 'catalog.json');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Registrados ${assets.length} recursos de Pompelín · Caminos y campamentos (${(assets.reduce((total, asset) => total + asset.bytes, 0) / 1024 / 1024).toFixed(2)} MB).`);


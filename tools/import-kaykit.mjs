import { Document, NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Mesh } from 'three';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packs, assetName, restaurantMedieval, restaurantExclusion } from './kaykit-packs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, '.art-sources');
const output = path.join(root, 'src', 'assets', 'library');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function filesIn(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files.sort();
}

// Preserve independently exported OBJ pieces, including multi-material glass.
async function readOBJ(filename) {
  const text = await readFile(filename, 'utf8');
  const materialFile = text.match(/^mtllib (.+)\r?$/m)?.[1].trim();
  if (!materialFile) throw new Error(`Missing MTL: ${filename}`);
  const mtl = await readFile(path.join(path.dirname(filename), materialFile), 'utf8');
  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene(path.basename(filename, '.obj'));
  const materials = new Map(), textures = new Map();
  for (const block of mtl.split(/^newmtl /m).slice(1)) {
    const name = block.split(/\r?\n/, 1)[0].trim();
    const diffuse = block.match(/^Kd (.+)\r?$/m)?.[1].trim().split(/\s+/).map(Number);
    const opacity = Number(block.match(/^d (.+)\r?$/m)?.[1] ?? 1);
    if (!diffuse || diffuse.length !== 3 || ![...diffuse, opacity].every(Number.isFinite)) throw new Error(`Invalid MTL color: ${filename}:${name}`);
    const material = document.createMaterial(name).setBaseColorFactor([...diffuse, opacity]).setRoughnessFactor(1);
    if (opacity < 1) material.setAlphaMode('BLEND').setDoubleSided(true);
    const image = block.match(/^map_Kd (.+)\r?$/m)?.[1].trim();
    if (image) {
      if (!textures.has(image)) textures.set(image, document.createTexture(image).setMimeType('image/png')
        .setImage(await readFile(path.join(path.dirname(filename), image))));
      material.setBaseColorTexture(textures.get(image));
    }
    materials.set(name, material);
  }
  if (!materials.size) throw new Error(`Missing OBJ materials: ${filename}`);
  const object = new OBJLoader().parse(text);
  object.traverse(child => {
    if (!(child instanceof Mesh)) return;
    const mesh = document.createMesh(child.name);
    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const groups = child.geometry.groups.length ? child.geometry.groups
      : [{ start: 0, count: child.geometry.getAttribute('position').count, materialIndex: 0 }];
    for (const group of groups) {
      const materialName = sourceMaterials[group.materialIndex ?? 0].name;
      const material = materials.get(materialName);
      if (!material) throw new Error(`Unknown OBJ material: ${filename}:${materialName}`);
      const primitive = document.createPrimitive().setMaterial(material);
      for (const [attribute, semantic, type] of [
        ['position', 'POSITION', 'VEC3'], ['normal', 'NORMAL', 'VEC3'], ['uv', 'TEXCOORD_0', 'VEC2'],
      ]) {
        const value = child.geometry.getAttribute(attribute);
        if (value) primitive.setAttribute(semantic, document.createAccessor().setBuffer(buffer).setType(type)
          .setArray(Float32Array.from(value.array.subarray(group.start * value.itemSize, (group.start + group.count) * value.itemSize))));
      }
      mesh.addPrimitive(primitive);
    }
    scene.addChild(document.createNode(child.name).setMesh(mesh));
    child.geometry.dispose();
    for (const value of Array.isArray(child.material) ? child.material : [child.material]) value.dispose();
  });
  return document;
}

const catalog = { version: 1, author: 'Kay Lousberg y Kenney', license: 'CC0-1.0', packs: [], assets: [] };
const inventory = { version: 1, packs: [] };
for (const [id, directory, label, author = 'Kay Lousberg'] of packs) {
  const packSource = path.join(source, directory);
  const files = await filesIn(packSource);
  const license = await readFile(path.join(packSource, 'License.txt'), 'utf8');
  if (!license.includes('Creative Commons Zero, CC0')) throw new Error(`Unrecognized license: ${directory}`);
  await mkdir(path.join(output, id), { recursive: true });
  await copyFile(path.join(packSource, 'License.txt'), path.join(output, id, 'LICENSE.txt'));
  const sourceFiles = [];
  for (const file of files) {
    const bytes = await readFile(path.join(packSource, file));
    sourceFiles.push({ path: file, bytes: bytes.length, sha256: digest(bytes) });
  }
  inventory.packs.push({ id, directory, files: sourceFiles });
  const models = files.filter(file => /\.(gltf|glb)$/i.test(file));
  const names = new Set(models.map(assetName));
  const objOnly = files.filter(file => /\.obj$/i.test(file) && !names.has(assetName(file)));
  const excluded = [];
  const start = catalog.assets.length;
  for (const file of [...models, ...objOnly]) {
    const name = assetName(file);
    if (id === 'restaurant' && !restaurantMedieval.has(name)) {
      excluded.push({ source: file, reason: restaurantExclusion });
      continue;
    }
    const kind = /^animations\//i.test(file) ? 'animations' : /(?:^|\/)characters\//i.test(file) ? 'characters' : 'objects';
    const assetId = `${id}/${kind}/${name}`;
    if (catalog.assets.some(asset => asset.id === assetId)) throw new Error(`Duplicate asset: ${assetId}`);
    const document = file.endsWith('.obj')
      ? await readOBJ(path.join(packSource, file))
      : await io.read(path.join(packSource, file));
    const assetRoot = document.getRoot();
    const scenes = assetRoot.listScenes();
    if (scenes.length !== 1) throw new Error(`Expected one scene: ${file}`);
    const bounds = getBounds(scenes[0]);
    const assetPath = `${assetId}.glb`;
    await mkdir(path.dirname(path.join(output, assetPath)), { recursive: true });
    await io.write(path.join(output, assetPath), document);
    const bytes = await readFile(path.join(output, assetPath));
    catalog.assets.push({
      id: assetId, pack: id, kind, name, path: assetPath, source: file,
      bytes: bytes.length, sha256: digest(bytes),
      meshes: assetRoot.listMeshes().length, skins: assetRoot.listSkins().length,
      rig: assetRoot.listSkins().length ? /(?:Rig|Mannequin)_Large/.test(name) ? 'large' : 'medium' : null,
      animations: assetRoot.listAnimations().map(animation => animation.getName()),
      bounds: [...bounds.min, ...bounds.max].every(Number.isFinite) ? bounds : null,
    });
  }
  const count = catalog.assets.length - start;
  if (id === 'restaurant') {
    const selectedNames = new Set(catalog.assets.filter(asset => asset.pack === id).map(asset => asset.name));
    for (const name of restaurantMedieval) if (!selectedNames.has(name)) throw new Error(`Missing curated restaurant model: ${name}`);
  }
  catalog.packs.push({ id, label, author, directory, count, sourceFiles: files.length, license: `${id}/LICENSE.txt`, excluded });
  console.log(`${id}: ${files.length} original files, ${count} GLB (${objOnly.length} OBJ-only pieces)`);
}
await writeFile(path.join(output, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
await writeFile(path.join(output, 'sources.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(`Imported ${catalog.assets.length} assets without pruning meshes, skins or animations.`);

import { Document, NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Mesh } from 'three';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, '.art-sources');
const output = path.join(root, 'src', 'assets', 'library');
const packs = [
  ['resources', 'KayKit_ResourceBits_1.0_FREE', 'Recursos y materiales'],
  ['forest', 'KayKit_Forest_Nature_Pack_1.0_FREE', 'Bosque y naturaleza'],
  ['adventurers', 'KayKit_Adventurers_2.0_FREE', 'Aventureros'],
  ['skeletons', 'KayKit_Skeletons_1.1_FREE', 'Esqueletos'],
  ['dungeon', 'KayKit_Dungeon_Pack_1.1_FREE', 'Mazmorras'],
];
const io = new NodeIO();
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

// Five detachable dungeon pieces have no separate glTF export in the source pack.
async function readOBJ(filename) {
  const text = await readFile(filename, 'utf8');
  const materialFile = text.match(/^mtllib (.+)\r?$/m)?.[1].trim();
  if (!materialFile) throw new Error(`Missing MTL: ${filename}`);
  const mtl = await readFile(path.join(path.dirname(filename), materialFile), 'utf8');
  if ((mtl.match(/^newmtl /gm) ?? []).length !== 1) throw new Error(`Expected one OBJ material: ${filename}`);
  const image = mtl.match(/^map_Kd (.+)\r?$/m)?.[1].trim();
  if (!image) throw new Error(`Missing OBJ texture: ${filename}`);
  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene(path.basename(filename, '.obj'));
  const texture = document.createTexture(image).setMimeType('image/png')
    .setImage(await readFile(path.join(path.dirname(filename), image)));
  const material = document.createMaterial('texture').setBaseColorTexture(texture).setRoughnessFactor(1);
  const object = new OBJLoader().parse(text);
  object.traverse(child => {
    if (!(child instanceof Mesh)) return;
    const primitive = document.createPrimitive().setMaterial(material);
    for (const [attribute, semantic, type] of [
      ['position', 'POSITION', 'VEC3'], ['normal', 'NORMAL', 'VEC3'], ['uv', 'TEXCOORD_0', 'VEC2'],
    ]) {
      const value = child.geometry.getAttribute(attribute);
      if (value) primitive.setAttribute(semantic, document.createAccessor().setBuffer(buffer).setType(type)
        .setArray(Float32Array.from(value.array)));
    }
    scene.addChild(document.createNode(child.name).setMesh(document.createMesh(child.name).addPrimitive(primitive)));
    child.geometry.dispose();
    for (const value of Array.isArray(child.material) ? child.material : [child.material]) value.dispose();
  });
  return document;
}

const catalog = { version: 1, author: 'Kay Lousberg', license: 'CC0-1.0', packs: [], assets: [] };
const inventory = { version: 1, packs: [] };
for (const [id, directory, label] of packs) {
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
  const names = new Set(models.map(file => path.posix.basename(file, path.posix.extname(file))));
  const objOnly = files.filter(file => /\.obj$/i.test(file) && !names.has(path.posix.basename(file, '.obj')));
  const start = catalog.assets.length;
  for (const file of [...models, ...objOnly]) {
    const name = path.posix.basename(file, path.posix.extname(file));
    const kind = /^animations\//i.test(file) ? 'animations' : /^characters\//i.test(file) ? 'characters' : 'objects';
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
      animations: assetRoot.listAnimations().map(animation => animation.getName()),
      bounds: [...bounds.min, ...bounds.max].every(Number.isFinite) ? bounds : null,
    });
  }
  const count = catalog.assets.length - start;
  catalog.packs.push({ id, label, directory, count, sourceFiles: files.length, license: `${id}/LICENSE.txt` });
  console.log(`${id}: ${files.length} original files, ${count} GLB (${objOnly.length} OBJ-only pieces)`);
}
await writeFile(path.join(output, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
await writeFile(path.join(output, 'sources.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(`Imported ${catalog.assets.length} assets without pruning meshes, skins or animations.`);

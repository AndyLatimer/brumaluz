import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { packs, assetName, restaurantMedieval, restaurantExclusion } from '../tools/kaykit-packs.mjs';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Mesh } from 'three';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'src', 'assets', 'library');
const catalog = JSON.parse(await readFile(path.join(directory, 'catalog.json'), 'utf8'));
const inventory = JSON.parse(await readFile(path.join(directory, 'sources.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

test('all twelve packs and every selected unique model are represented, including OBJ-only pieces', () => {
  assert.deepEqual(catalog.packs.map(pack => pack.id), packs.map(pack => pack[0]));
  assert.equal(catalog.assets.length, 1021);
  assert.equal(new Set(catalog.assets.map(asset => asset.id)).size, catalog.assets.length);
  assert.equal(catalog.assets.filter(asset => asset.kind === 'characters').length, 12);
  assert.equal(catalog.assets.filter(asset => asset.kind === 'animations').length, 18);
  for (const pack of catalog.packs) {
    const originals = inventory.packs.find(value => value.id === pack.id);
    assert.ok(originals);
    assert.equal(originals.files.length, pack.sourceFiles);
    const models = originals.files.filter(file => /\.(gltf|glb)$/i.test(file.path));
    const modelNames = new Set(models.map(file => assetName(file.path)));
    const objOnly = originals.files.filter(file => file.path.endsWith('.obj')
      && !modelNames.has(assetName(file.path)));
    const assets = catalog.assets.filter(asset => asset.pack === pack.id);
    assert.equal(assets.length, pack.count);
    assert.deepEqual([...assets.map(asset => asset.source), ...pack.excluded.map(entry => entry.source)].sort(),
      [...models, ...objOnly].map(file => file.path).sort());
    if (pack.id === 'restaurant') {
      assert.deepEqual(assets.map(asset => asset.name).sort(), [...restaurantMedieval].sort());
      assert.equal(pack.excluded.length, 82);
      assert.ok(pack.excluded.every(entry => entry.reason === restaurantExclusion));
    } else assert.deepEqual(pack.excluded, []);
  }
});

test('every GLB is readable, self-contained and matches its recorded geometry, skins and clips', async () => {
  for (const asset of catalog.assets) {
    const filename = path.join(directory, asset.path);
    const bytes = await readFile(filename);
    assert.equal(bytes.length, asset.bytes, asset.id);
    assert.equal(hash(bytes), asset.sha256, asset.id);
    assert.equal(bytes.readUInt32LE(0), 0x46546c67, asset.id);
    const jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
    assert.ok((json.buffers ?? []).every(buffer => !buffer.uri), `External buffer: ${asset.id}`);
    assert.ok((json.images ?? []).every(image => image.bufferView !== undefined && !image.uri), `External image: ${asset.id}`);
    const document = await io.read(filename);
    const gltf = document.getRoot();
    assert.equal(gltf.listMeshes().length, asset.meshes, asset.id);
    assert.equal(gltf.listSkins().length, asset.skins, asset.id);
    assert.deepEqual(gltf.listAnimations().map(clip => clip.getName()), asset.animations, asset.id);
    assert.ok(asset.meshes > 0 && asset.bounds, asset.id);
    for (const texture of gltf.listTextures()) assert.ok(texture.getImage()?.byteLength > 0, asset.id);
    for (const mesh of gltf.listMeshes()) for (const primitive of mesh.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION');
      assert.ok(positions?.getCount() > 0, asset.id);
      assert.ok(Array.from(positions.getArray()).every(Number.isFinite), asset.id);
    }
  }
});

test('original files are preserved byte-for-byte and conversion preserves source content', async t => {
  const sources = path.join(root, '.art-sources');
  try { await access(sources); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    t.skip('Original ZIP extraction is local; run tools/extract-kaykit.ps1 to verify it.');
    return;
  }
  for (const pack of inventory.packs) {
    const source = path.join(sources, pack.directory);
    const entries = await readdir(source, { recursive: true, withFileTypes: true });
    assert.equal(entries.filter(entry => entry.isFile()).length, pack.files.length, pack.id);
    for (const file of pack.files) {
      const bytes = await readFile(path.join(source, file.path));
      assert.equal(bytes.length, file.bytes, file.path);
      assert.equal(hash(bytes), file.sha256, file.path);
    }
    const license = await readFile(path.join(directory, pack.id, 'LICENSE.txt'));
    assert.equal(hash(license), pack.files.find(file => file.path === 'License.txt').sha256, pack.id);
    for (const asset of catalog.assets.filter(value => value.pack === pack.id)) {
      if (asset.source.endsWith('.obj')) {
        const filename = path.join(source, asset.source);
        const object = new OBJLoader().parse(await readFile(filename, 'utf8'));
        const meshes = [];
        object.traverse(child => { if (child instanceof Mesh) meshes.push(child); });
        const converted = (await io.read(path.join(directory, asset.path))).getRoot();
        assert.equal(converted.listMeshes().length, meshes.length, asset.id);
        for (let index = 0; index < meshes.length; index++) {
          const geometry = meshes[index].geometry;
          const mesh = meshes[index];
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const groups = geometry.groups.length ? geometry.groups
            : [{ start: 0, count: geometry.getAttribute('position').count, materialIndex: 0 }];
          const primitives = converted.listMeshes()[index].listPrimitives();
          assert.equal(primitives.length, groups.length, asset.id);
          for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            const group = groups[groupIndex], primitive = primitives[groupIndex];
            assert.equal(primitive.getMaterial().getName(), materials[group.materialIndex ?? 0].name, asset.id);
            for (const [attribute, semantic] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['uv', 'TEXCOORD_0']]) {
              const value = geometry.getAttribute(attribute);
              if (value) assert.deepEqual(primitive.getAttribute(semantic).getArray(),
                value.array.subarray(group.start * value.itemSize, (group.start + group.count) * value.itemSize), asset.id);
            }
          }
          geometry.dispose();
          for (const material of Array.isArray(meshes[index].material) ? meshes[index].material : [meshes[index].material]) material.dispose();
        }
        const mtl = await readFile(filename.replace(/\.obj$/, '.mtl'), 'utf8');
        for (const material of converted.listMaterials()) {
          const block = mtl.split(/^newmtl /m).slice(1).find(block => block.split(/\r?\n/, 1)[0].trim() === material.getName());
          assert.ok(block, `${asset.id}:${material.getName()}`);
          const diffuse = block.match(/^Kd (.+)\r?$/m)[1].trim().split(/\s+/).map(Number);
          const opacity = Number(block.match(/^d (.+)\r?$/m)?.[1] ?? 1);
          assert.deepEqual(material.getBaseColorFactor(), [...diffuse, opacity], asset.id);
          assert.equal(material.getAlphaMode(), opacity < 1 ? 'BLEND' : 'OPAQUE', asset.id);
          const texture = block.match(/^map_Kd (.+)\r?$/m)?.[1].trim();
          if (texture) assert.equal(hash(material.getBaseColorTexture().getImage()),
            hash(await readFile(path.join(path.dirname(filename), texture))), asset.id);
          else assert.equal(material.getBaseColorTexture(), null, asset.id);
        }
        continue;
      }
      const original = (await io.read(path.join(source, asset.source))).getRoot();
      const converted = (await io.read(path.join(directory, asset.path))).getRoot();
      for (const method of ['listMeshes', 'listSkins', 'listTextures', 'listNodes', 'listAnimations']) {
        assert.equal(converted[method]().length, original[method]().length, `${asset.id}: ${method}`);
      }
      const accessorHashes = gltf => gltf.listAccessors().map(accessor => {
        const array = accessor.getArray();
        return `${accessor.getType()}:${accessor.getComponentType()}:${accessor.getNormalized()}:${hash(
          new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
        )}`;
      }).sort();
      assert.deepEqual(accessorHashes(converted), accessorHashes(original), asset.id);
      assert.deepEqual(converted.listAnimations().map(clip => [clip.getName(), clip.listChannels().length, clip.listSamplers().length]),
        original.listAnimations().map(clip => [clip.getName(), clip.listChannels().length, clip.listSamplers().length]), asset.id);
      assert.deepEqual(converted.listSkins().map(skin => skin.listJoints().map(joint => joint.getName())),
        original.listSkins().map(skin => skin.listJoints().map(joint => joint.getName())), asset.id);
      for (let index = 0; index < original.listTextures().length; index++) {
        assert.equal(hash(converted.listTextures()[index].getImage()), hash(original.listTextures()[index].getImage()), asset.id);
      }
      assert.deepEqual(converted.listExtensionsUsed().map(extension => extension.extensionName).sort(),
        original.listExtensionsUsed().map(extension => extension.extensionName).sort(), asset.id);
      for (let index = 0; index < original.listMaterials().length; index++) {
        const extension = 'KHR_materials_emissive_strength';
        const expected = original.listMaterials()[index].getExtension(extension);
        const actual = converted.listMaterials()[index].getExtension(extension);
        if (expected) assert.equal(actual.getEmissiveStrength(), expected.getEmissiveStrength(), asset.id);
      }
    }
  }
});

test('all 260 character/clip combinations have compatible named animation targets', async () => {
  let combinations = 0;
  for (const asset of catalog.assets.filter(asset => asset.kind === 'characters' && ['adventurers', 'skeletons'].includes(asset.pack))) {
    const character = (await io.read(path.join(directory, asset.path))).getRoot();
    const names = character.listNodes().map(node => node.getName());
    for (const library of catalog.assets.filter(value => value.pack === asset.pack && value.kind === 'animations')) {
      const animations = (await io.read(path.join(directory, library.path))).getRoot().listAnimations();
      for (const clip of animations) {
        for (const channel of clip.listChannels()) {
          const target = channel.getTargetNode().getName();
          assert.equal(names.filter(name => name === target).length, 1, `${asset.id}: ${clip.getName()}: ${target}`);
        }
        combinations++;
      }
    }
  }
  assert.equal(combinations, 260);
});

test('full Medium and Large libraries preserve all 173 clips and bind only to their own rig family', async () => {
  const libraries = catalog.assets.filter(asset => asset.pack === 'character-animations' && asset.kind === 'animations');
  assert.equal(libraries.length, 14);
  assert.equal(libraries.reduce((count, asset) => count + asset.animations.length, 0), 173);
  const documents = new Map();
  for (const asset of libraries) documents.set(asset.id, (await io.read(path.join(directory, asset.path))).getRoot());
  let combinations = 0;
  for (const asset of catalog.assets.filter(asset => asset.kind === 'characters')) {
    const character = (await io.read(path.join(directory, asset.path))).getRoot();
    for (const library of libraries.filter(library => library.rig === asset.rig)) {
      for (const clip of documents.get(library.id).listAnimations()) {
        for (const channel of clip.listChannels()) {
          const source = channel.getTargetNode();
          const targets = character.listNodes().filter(node => node.getName() === source.getName());
          if (asset.name === 'Mannequin_Medium' && ['handslot.l', 'handslot.r'].includes(source.getName())) {
            assert.equal(targets.length, 0, 'Original mannequin has no hand attachment helpers');
            assert.ok(character.listNodes().some(node => node.getName() === source.getParentNode().getName()));
            continue;
          }
          assert.equal(targets.length, 1, `${asset.id}:${clip.getName()}:${source.getName()}`);
          source.getMatrix().forEach((value, index) => assert.ok(Math.abs(value - targets[0].getMatrix()[index]) < 1e-4,
            `${asset.id}:${clip.getName()}:${source.getName()}: rest pose`));
        }
        combinations++;
      }
    }
  }
  assert.equal(combinations, 1563);
});

test('library and preview are not imported by the production entry point', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.ok(!html.includes('assetsPreview'));
  const config = await readFile(path.join(root, 'vite.config.ts'), 'utf8');
  assert.ok(!config.includes('assets.html'));
});

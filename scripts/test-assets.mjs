import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
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
const io = new NodeIO();

test('all five packs and every unique model are represented, including OBJ-only pieces', () => {
  assert.equal(catalog.packs.length, 5);
  assert.equal(catalog.assets.length, 455);
  assert.equal(new Set(catalog.assets.map(asset => asset.id)).size, catalog.assets.length);
  assert.equal(catalog.assets.filter(asset => asset.kind === 'characters').length, 10);
  assert.equal(catalog.assets.filter(asset => asset.kind === 'animations').length, 4);
  for (const pack of catalog.packs) {
    const originals = inventory.packs.find(value => value.id === pack.id);
    assert.ok(originals);
    assert.equal(originals.files.length, pack.sourceFiles);
    const models = originals.files.filter(file => /\.(gltf|glb)$/i.test(file.path));
    const modelNames = new Set(models.map(file => path.posix.basename(file.path, path.posix.extname(file.path))));
    const objOnly = originals.files.filter(file => file.path.endsWith('.obj')
      && !modelNames.has(path.posix.basename(file.path, '.obj')));
    const assets = catalog.assets.filter(asset => asset.pack === pack.id);
    assert.equal(assets.length, pack.count);
    assert.deepEqual(assets.map(asset => asset.source).sort(), [...models, ...objOnly].map(file => file.path).sort());
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
          const primitive = converted.listMeshes()[index].listPrimitives()[0];
          for (const [attribute, semantic] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['uv', 'TEXCOORD_0']]) {
            assert.deepEqual(primitive.getAttribute(semantic).getArray(), geometry.getAttribute(attribute).array, asset.id);
          }
          geometry.dispose();
          for (const material of Array.isArray(meshes[index].material) ? meshes[index].material : [meshes[index].material]) material.dispose();
        }
        const mtl = await readFile(filename.replace(/\.obj$/, '.mtl'), 'utf8');
        assert.match(mtl, /^Kd 1\.000000 1\.000000 1\.000000\r?$/m, asset.id);
        assert.match(mtl, /^d 1\.000000\r?$/m, asset.id);
        const texture = mtl.match(/^map_Kd (.+)\r?$/m)[1].trim();
        assert.equal(hash(converted.listTextures()[0].getImage()),
          hash(await readFile(path.join(path.dirname(filename), texture))), asset.id);
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
    }
  }
});

test('all 260 character/clip combinations have compatible named animation targets', async () => {
  let combinations = 0;
  for (const asset of catalog.assets.filter(asset => asset.kind === 'characters')) {
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

test('library and preview are not imported by the production entry point', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.ok(!html.includes('assetsPreview'));
  const config = await readFile(path.join(root, 'vite.config.ts'), 'utf8');
  assert.ok(!config.includes('assets.html'));
});

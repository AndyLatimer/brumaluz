import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { serverSql, serverSqlFiles } from './server-sql.mjs';

const io = new NodeIO();
const file = path => new URL(`../${path}`, import.meta.url);
const read = path => readFile(file(path));
const readDocument = path => io.read(fileURLToPath(file(path)));
const variants = JSON.parse(await read('src/art/mapVariants.json'));
const catalog = JSON.parse(await read('src/assets/library/catalog.json'));

function bounds(document) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION').getArray();
    for (let i = 0; i < positions.length; i++) {
      min[i % 3] = Math.min(min[i % 3], positions[i]);
      max[i % 3] = Math.max(max[i % 3], positions[i]);
    }
  }
  return [...min, ...max];
}

test('medieval bridge variants add detail while preserving the original library and scale', async () => {
  for (const [id, path] of Object.entries(variants)) {
    const originalFile = `src/assets/library/${id}.glb`;
    const originalBytes = await read(originalFile);
    const asset = catalog.assets.find(asset => asset.id === id);
    assert.equal(createHash('sha256').update(originalBytes).digest('hex'), asset.sha256);
    const original = await readDocument(originalFile);
    const improved = await readDocument(`src/assets/${path}`);
    const originalBounds = bounds(original), improvedBounds = bounds(improved);
    originalBounds.forEach((value, i) => assert.ok(Math.abs(value - improvedBounds[i]) < 0.02, `${id}: changed bounds`));
    const root = improved.getRoot();
    assert.ok(root.listMaterials().some(material => material.getNormalTexture()));
    assert.ok(root.listMeshes()[0].listPrimitives().some(primitive => primitive.getAttribute('POSITION').getName().startsWith('bevelled-coping')));
    const triangles = root.listMeshes().flatMap(mesh => mesh.listPrimitives()).reduce((count, primitive) => count + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3, 0);
    assert.ok(triangles < 3000, `${id}: excessive triangle count`);
  }
});

test('all embedded bridge PNGs decompress as standard PNGs with the expected pixel count', async () => {
  for (const path of [...Object.values(variants), 'models/props/wooden-bridge.glb']) {
    const document = await readDocument(`src/assets/${path}`);
    for (const texture of document.getRoot().listTextures()) {
      assert.equal(texture.getMimeType(), 'image/png');
      const png = Buffer.from(texture.getImage());
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20), channels = png[25] === 6 ? 4 : 3;
      const data = [];
      for (let offset = 8; offset < png.length;) {
        const length = png.readUInt32BE(offset);
        if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') data.push(png.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
      }
      assert.equal(inflateSync(Buffer.concat(data)).length, height * (width * channels + 1), `${path}: ${texture.getName()}`);
    }
  }
});

test('the legacy bridge command delegates to the generator without editing canonical files', async () => {
  const source = (await read('tools/improve-medieval-bridges.mjs')).toString();
  assert.match(source, /import '\.\.\/scripts\/build-medieval-bridges\.mjs'/);
  assert.doesNotMatch(source, /NodeIO|writeFile|\.write\(/);
  const pkg = JSON.parse(await read('package.json'));
  assert.match(pkg.scripts['art:build:medieval'], /scripts\/build-medieval-bridges\.mjs/);
});

test('server SQL assembly separates files and the story IF encloses CASE before THEN', async () => {
  const parts = await Promise.all(serverSqlFiles().map(path => readFile(path, 'utf8')));
  assert.equal(serverSql(), parts.join('\n\n'));
  const story = (await read('supabase/server/13-story-quests.sql')).toString();
  assert.match(story, /if coalesce\(c\.data->>'location','brumaluz'\)<>\(case when p_action='report' then 'brumaluz' else 'casa_de_isberto_interior' end\)\s+then/);
});

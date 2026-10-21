import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { createServer } from 'vite';
import { expandBrumaluz, EXPANSION_PREFIX, sidePoint, AVENUES } from '../tools/expand-brumaluz.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const dryRun = process.env.BRUMALUZ_EXPANSION_DRY_RUN === '1';
let server, maps, runtime, map, terrain, collision;

async function assetBoxes(doc) {
  const boxes = new Map();
  const city = await new NodeIO().read('src/assets/models/city.glb');
  for (const root of city.getRoot().listScenes()[0].listChildren()) {
    root.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    const box = new THREE.Box3();
    root.traverse(node => {
      if (/windmill_top_fan|watermill_wheel/.test(node.getName())) return;
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        const positions = primitive.getAttribute('POSITION');
        if (!positions) continue;
        box.union(new THREE.Box3(
          new THREE.Vector3(...positions.getMin([])), new THREE.Vector3(...positions.getMax([])),
        ).applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix())));
      }
    });
    boxes.set(`city/${root.getName()}`, box);
  }
  boxes.set('builtin/bench', new THREE.Box3(new THREE.Vector3(-.725, 0, -.21), new THREE.Vector3(.725, 1.09, .21)));
  boxes.set('builtin/lamppost', new THREE.Box3(new THREE.Vector3(-.14, 0, -.14), new THREE.Vector3(.14, 3.15, .14)));
  const catalog = await json('src/assets/library/catalog.json');
  for (const asset of catalog.assets) {
    boxes.set(asset.id, new THREE.Box3(new THREE.Vector3(...asset.bounds.min), new THREE.Vector3(...asset.bounds.max)));
  }
  for (const object of doc.objects) assert.ok(boxes.has(object.asset), `Known asset: ${object.asset}`);
  return boxes;
}

before(async () => {
  server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true } });
  maps = await server.ssrLoadModule('/src/data/maps.ts');
  runtime = await server.ssrLoadModule('/src/world/mapRuntime.ts');
  const draft = await json('src/data/maps/brumaluz.json');
  map = maps.validateMap(dryRun ? expandBrumaluz(draft, maps) : draft);
  terrain = maps.decodeTerrain(map.terrain);
  collision = runtime.buildCollision(map, new runtime.TerrainField(terrain), await assetBoxes(map));
});
after(async () => { await server?.close(); });

test('normal capital expands fourfold and preserves every inherited object, marker and terrain cell', () => {
  assert.equal(map.id, 'brumaluz');
  assert.equal(map.settings.kind, 'city');
  assert.deepEqual([terrain.columns, terrain.rows, terrain.cell, terrain.origin], [481, 481, 1, [-240, -240]]);
  assert.ok(map.objects.length >= 3000);
  const oldObjects = map.objects.filter(object => !object.id.startsWith(EXPANSION_PREFIX));
  const oldMarkers = map.markers.filter(marker => !marker.id.startsWith(EXPANSION_PREFIX));
  assert.equal(oldObjects.length, 982);
  assert.equal(hash(oldObjects), 'bfd69b8d28ff662f1ba7fb985b29e1b1983fa24f1af971104989e1c73049c278');
  assert.equal(hash(oldMarkers), 'ccb4af1ee3f0ab6fd1c36763b0bc01a1ead68779ea80a20108acb96e65a58187');
  const originalTerrain = maps.createTerrain(240, 240, 1);
  for (let z = -120; z <= 120; z++) for (let x = -120; x <= 120; x++) {
    const from = (z + 240) * 481 + x + 240, to = (z + 120) * 241 + x + 120;
    for (const key of ['heights', 'paint', 'grass']) originalTerrain[key][to] = terrain[key][from];
  }
  assert.equal(hash(maps.encodeTerrain(originalTerrain)), 'ac43b108e85e0e303c214a05e9479a054dbc58fa0a3a8db76e81d78ffdf83ef6');
  const door = map.markers.find(marker => marker.id === 'mknnlaak');
  assert.equal(door.position[0], 23.5); assert.equal(door.position[2], -48.5); assert.equal(door.radius, 2.2);
});

test('outer terrain is gently graded and populated in all four districts without filling future reserves', () => {
  let maxStep = 0, peak = 0;
  for (let j = 0; j < 481; j++) for (let i = 0; i < 481; i++) {
    const x = i - 240, z = j - 240;
    if (Math.max(Math.abs(x), Math.abs(z)) <= 120) continue;
    const index = j * 481 + i, y = terrain.heights[index];
    peak = Math.max(peak, y);
    if (i < 480) maxStep = Math.max(maxStep, Math.abs(y - terrain.heights[index + 1]));
    if (j < 480) maxStep = Math.max(maxStep, Math.abs(y - terrain.heights[index + 481]));
  }
  assert.ok(peak > 6 && peak < 10, `Rolling hills peak at ${peak} m`);
  assert.ok(maxStep < .65, `Largest outer 1 m terrain rise: ${maxStep}`);
  const added = map.objects.filter(object => object.id.startsWith(EXPANSION_PREFIX));
  assert.equal(added.filter(object => / · casa /.test(object.name ?? '')).length, 128);
  assert.ok(added.filter(object => object.layer === 'ensanche_civico').length >= 180);
  for (let side = 0; side < 4; side++) {
    assert.ok(map.markers.some(marker => marker.id === `ensanche_barrio_${side}`));
    const [cx, cz] = sidePoint(side, 0, 178);
    assert.ok(added.filter(object => Math.hypot(object.position[0] - cx, object.position[2] - cz) < 135).length > 300);
  }
  assert.ok(!collision.blocked(0, -232), 'Northern future-content meadow remains walkable');
});

function walk(points, label) {
  let samples = 0;
  for (let segment = 1; segment < points.length; segment++) {
    const [ax, az] = points[segment - 1], [bx, bz] = points[segment];
    const count = Math.ceil(Math.hypot(bx - ax, bz - az) / .4);
    let from = new THREE.Vector3(ax, collision.groundY(ax, az), az);
    for (let step = 1; step <= count; step++) {
      const x = ax + (bx - ax) * step / count, z = az + (bz - az) * step / count;
      assert.ok(!collision.blocked(x, z), `${label}: terrain blocked at ${x},${z}`);
      const target = new THREE.Vector3(x, collision.groundY(x, z), z);
      const result = collision.collide(from, target);
      assert.ok(Math.hypot(result.x - x, result.z - z) < .03, `${label}: collision at ${x},${z}, diverted to ${result.x},${result.z}`);
      from = target; samples++;
    }
  }
  return samples;
}

test('both promenade circuits, twenty cross streets and all four civic squares have clear walking lanes', () => {
  let samples = 0;
  for (const radius of [146.6, 148, 149.4, 206.6, 208, 209.4]) {
    const ring = [[-radius, -radius], [radius, -radius], [radius, radius], [-radius, radius], [-radius, -radius]];
    samples += walk(ring, `Promenade ${radius}`);
  }
  for (let side = 0; side < 4; side++) for (const u of AVENUES) {
    for (const offset of [-1.4, 0, 1.4]) {
      samples += walk([sidePoint(side, u + offset, 148), sidePoint(side, u + offset, 208)], `Street ${side}/${u}/${offset}`);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const offset of [-1.4, 0, 1.4]) {
      samples += walk([[sx * 148, sz * 174 + offset], [sx * 208, sz * 174 + offset]], `Square ${sx}/${sz} east-west`);
      samples += walk([[sx * 174 + offset, sz * 148], [sx * 174 + offset, sz * 208]], `Square ${sx}/${sz} north-south`);
    }
  }
  assert.ok(samples > 33000, `${samples} character-radius collision samples`);
});

test('all ten ferry portals and arrivals are unobstructed, resolve locally and retain the continental gates', () => {
  const portals = map.markers.filter(marker => marker.id.startsWith('ensanche_ferry_') && marker.type === 'portal');
  assert.equal(portals.length, 10);
  for (const portal of portals) {
    assert.equal(portal.trigger, 'interact'); assert.equal(portal.target.map, 'brumaluz');
    const arrival = map.markers.find(marker => marker.id === portal.target.arrival && marker.type === 'arrival');
    assert.ok(arrival, `Arrival for ${portal.id}`);
    for (const marker of [portal, arrival]) {
      const [x, , z] = marker.position;
      const p = new THREE.Vector3(x, collision.groundY(x, z), z);
      const out = collision.collide(p, p);
      assert.ok(!collision.blocked(x, z), marker.id);
      assert.ok(Math.hypot(out.x - x, out.z - z) < .03, `${marker.id}: obstructed at ${x},${z}`);
      walk([[x - .7, z], [x + .7, z]], marker.id);
      walk([[x, z - .7], [x, z + .7]], marker.id);
    }
  }
  for (const id of ['este', 'oeste', 'noreste', 'sureste', 'suroeste']) {
    const gate = map.markers.find(marker => marker.id === `salida_${id}`);
    assert.equal(gate.target.map, 'pompelin');
    assert.ok(map.markers.some(marker => marker.id === `llegada_${id}`));
  }
});

test('normal published map matches the editable expansion and publication preserves the other maps', { skip: dryRun }, async () => {
  assert.deepEqual(await json('src/data/world/maps/brumaluz.json'), map);
  for (const id of ['brumaluz_2', 'casa_de_isberto_interior', 'pompelin']) {
    assert.equal((await json(`src/data/world/maps/${id}.json`)).id, id);
  }
  const sql = await readFile('supabase/world.sql', 'utf8');
  assert.match(sql, /"minX":-240,"minZ":-240,"maxX":240,"maxZ":240/);
  for (const portal of map.markers.filter(marker => marker.id.startsWith('ensanche_ferry_') && marker.type === 'portal')) {
    assert.ok(sql.includes(`'${portal.id}'`), `SQL registers ${portal.id}`);
  }
});

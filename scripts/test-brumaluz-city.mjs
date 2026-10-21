import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createServer } from 'vite';
import { assetBoxes } from '../tools/asset-bounds.mjs';
import { buildBrumaluz, DISTRICTS, GATES, PREFIX, RING, polar, roads } from '../tools/build-brumaluz.mjs';

// Brumaluz amurallada: `node --test scripts/test-brumaluz-city.mjs` revisa el borrador publicado.
// Con BRUMALUZ_CITY_DRY_RUN=1 genera la ciudad en memoria a partir del borrador actual sin guardarla.
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const dryRun = process.env.BRUMALUZ_CITY_DRY_RUN === '1';
let server, maps, runtime, map, terrain, collision;

before(async () => {
  server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true } });
  maps = await server.ssrLoadModule('/src/data/maps.ts');
  runtime = await server.ssrLoadModule('/src/world/mapRuntime.ts');
  const draft = await json('src/data/maps/brumaluz.json');
  map = maps.validateMap(dryRun ? buildBrumaluz(draft, maps) : draft);
  terrain = maps.decodeTerrain(map.terrain);
  const boxes = await assetBoxes();
  for (const object of map.objects) assert.ok(boxes.has(object.asset), `Recurso conocido: ${object.asset}`);
  collision = runtime.buildCollision(map, new runtime.TerrainField(terrain), boxes);
});
after(async () => { await server?.close(); });

const heightAt = (x, z) => maps.sampleHeight(terrain, x + 240, z + 240);

function walk(points, label) {
  let samples = 0;
  for (let segment = 1; segment < points.length; segment++) {
    const [ax, az] = points[segment - 1], [bx, bz] = points[segment];
    const count = Math.ceil(Math.hypot(bx - ax, bz - az) / .4);
    let from = new THREE.Vector3(ax, collision.groundY(ax, az), az);
    for (let step = 1; step <= count; step++) {
      const x = ax + (bx - ax) * step / count, z = az + (bz - az) * step / count;
      assert.ok(!collision.blocked(x, z), `${label}: terreno bloqueado en ${x.toFixed(1)},${z.toFixed(1)}`);
      const target = new THREE.Vector3(x, collision.groundY(x, z), z);
      const result = collision.collide(from, target);
      assert.ok(Math.hypot(result.x - x, result.z - z) < .03, `${label}: choque en ${x.toFixed(1)},${z.toFixed(1)}`);
      from = target; samples++;
    }
  }
  return samples;
}
const arc = (radius, from, to, step = 1) => {
  const points = [];
  for (let angle = from; angle <= to; angle += step / radius * 180 / Math.PI) points.push(polar(radius, angle));
  points.push(polar(radius, to));
  return points;
};
const radial = (angle, r0, r1, offset = 0) => [r0, r1].map(r => {
  const [x, z] = polar(r, angle), c = Math.cos(angle * Math.PI / 180), s = Math.sin(angle * Math.PI / 180);
  return [x - s * offset, z + c * offset];
});

test('el casco antiguo se conserva y el foso es tierra firme salvo el estanque', async () => {
  assert.deepEqual([terrain.columns, terrain.rows, terrain.cell, terrain.origin], [481, 481, 1, [-240, -240]]);
  assert.equal(map.objects.filter(object => object.asset === 'city/hex_water').length, 0);
  assert.ok(!map.objects.some(object => object.id.startsWith('ensanche_')) && !map.markers.some(marker => marker.id.startsWith('ensanche_')));
  // Lo heredado (sin prefijo) es el casco antiguo: no se extiende más allá de su borde.
  for (const object of map.objects.filter(item => !item.id.startsWith(PREFIX))) {
    assert.ok(Math.hypot(object.position[0], object.position[2]) < 92, `${object.id} pertenece al casco antiguo`);
  }
  assert.ok(map.objects.filter(object => object.asset.startsWith('city/hex_')).length >= 390, 'Casillas del casco');
  for (const id of ['spawn', 'mknnlaak', 'npc_isberto', 'interact_well']) assert.ok(map.markers.some(marker => marker.id === id), id);
  const level = map.settings.water.level;
  const [px, pz] = polar(130, 165);
  let pond = 0;
  for (let z = -230; z <= 230; z++) for (let x = -230; x <= 230; x++) {
    if (Math.hypot(x, z) > RING.wall - 4) continue;
    const h = terrain.heights[(z + 240) * 481 + x + 240];
    if (Math.hypot(x - px, z - pz) < 16) { if (h < level - 0.3) pond++; continue; }
    assert.ok(h > level + 0.15, `Sin agua suelta en ${x},${z} (${h})`);
  }
  assert.ok(pond > 200, `Estanque con agua (${pond} celdas)`);
});

test('seis barrios con cientos de casas, casas gremiales, colinas y muralla con torres', () => {
  const generated = map.objects.filter(object => object.id.startsWith(PREFIX));
  const houses = generated.filter(object => / · casa \d+$/.test(object.name ?? ''));
  assert.ok(houses.length >= 550, `${houses.length} casas`);
  for (const district of DISTRICTS) {
    assert.ok(map.markers.some(marker => marker.name === district), district);
    assert.ok(houses.filter(object => object.name.startsWith(district)).length >= 40, `Casas en ${district}`);
  }
  for (const name of ['Casa de los Telares', 'Casa de los Canteros', 'Lonja de los Mercaderes', 'Archivo de la Capital']) {
    assert.ok(generated.filter(object => object.name === name && object.asset.startsWith('dungeon/')).length >= 20, name);
  }
  const towers = new Set(generated.filter(object => / · casa torre \d+$/.test(object.name ?? '')).map(object => object.name));
  assert.ok(towers.size >= 10, `${towers.size} casas torre compuestas`);
  for (const [id, minimum] of [['colina_molino', 8], ['colina_cantera', 9], ['colina_mirador', 6]]) {
    const hill = map.markers.find(marker => marker.id === `${PREFIX}${id}`);
    const [x, , z] = hill.position, r = Math.hypot(x, z);
    const around = Math.min(...[-1, 1].map(side => heightAt(x / r * (r + side * 26), z / r * (r + side * 26))));
    assert.ok(heightAt(x, z) - around >= minimum, `${id}: ${heightAt(x, z) - around} m sobre su entorno`);
  }
  const walls = generated.filter(object => object.asset === 'city/wall_straight');
  const arcCovered = walls.reduce((sum, object) => sum + object.scale[0] * 2, 0);
  assert.ok(arcCovered > 2 * Math.PI * RING.wall - 5 * 8 - 10, `Muralla continua (${arcCovered.toFixed(0)} m)`);
  assert.equal(generated.filter(object => object.asset === 'city/wall_straight_gate').length, GATES.filter(gate => gate.id).length);
});

test('anillos, calles mayores, puertas viejas y plazas tienen paso libre', () => {
  let samples = 0;
  const plazas = Array.from({ length: 6 }, (_, k) => 60 * k);
  for (const radius of [RING.inner - 2, RING.inner + 2, RING.middle - 2, RING.middle + 2, RING.ronda]) {
    for (const angle of plazas) {
      const skip = radius > 150 && radius < 170 ? 17 / radius * 180 / Math.PI : 0;
      samples += walk(arc(radius, angle + skip, angle + 60 - skip), `Anillo ${radius} desde ${angle}°`);
    }
  }
  for (const gate of GATES) {
    const end = gate.id ? 236 : RING.ronda;
    for (const offset of [-1.3, 0, 1.3]) {
      samples += walk(radial(gate.angle, 84, RING.middle - 17, offset), `Calle mayor ${gate.angle}° (${offset})`);
      samples += walk(radial(gate.angle, RING.middle + 17, end, offset), `Calle mayor ${gate.angle}° (${offset})`);
    }
    // Desde dentro del casco antiguo, por su puerta, hasta el anillo interior.
    samples += walk(radial(gate.angle, gate.id ? 62 : 72, RING.inner), `Puerta vieja ${gate.angle}°`); // la del noroeste da al castillo
    samples += walk(arc(10, 0, 360, 0.5).map(([x, z]) => { const [cx, cz] = polar(RING.middle, gate.angle); return [cx + x, cz + z]; }), `Plaza ${gate.angle}°`);
  }
  for (let k = 0; k < 6; k++) for (const offset of [-1.2, 1.2]) samples += walk(radial(30 + 60 * k, RING.inner + 4, RING.ronda - 3, offset), `Calle ${30 + 60 * k}°`);
  for (const lane of roads().filter(road => road.lane)) {
    samples += lane.type === 'radial'
      ? walk(radial(lane.angle, lane.r0 + 4, lane.r1 - 4), `Calleja ${lane.angle}°`)
      : walk(arc(lane.radius, lane.from + 4, lane.to - 4), `Calleja ${lane.radius} m (${lane.from}°)`);
  }
  assert.ok(samples > 25000, `${samples} muestras de paso`);
});

test('las puertas al continente llevan a Pompelín y sus llegadas están despejadas', () => {
  for (const gate of GATES.filter(item => item.id)) {
    const portal = map.markers.find(marker => marker.id === `salida_${gate.id}`);
    const arrival = map.markers.find(marker => marker.id === `llegada_${gate.id}`);
    assert.equal(portal.target.map, 'pompelin');
    assert.equal(portal.trigger, 'walk');
    assert.ok(Math.hypot(portal.position[0], portal.position[2]) > RING.wall, `${portal.id} fuera de la muralla`);
    assert.ok(Math.hypot(arrival.position[0], arrival.position[2]) < RING.ronda, `${arrival.id} dentro`);
    for (const marker of [portal, arrival]) {
      const [x, , z] = marker.position;
      walk([[x - .7, z], [x + .7, z]], marker.id);
      walk([[x, z - .7], [x, z + .7]], marker.id);
    }
    // Hay que pisar el portal para salir por la puerta: el hueco queda dentro de su radio.
    const [gx, gz] = polar(RING.wall + 1.6, gate.angle);
    assert.ok(Math.hypot(gx - portal.position[0], gz - portal.position[2]) < portal.radius, `${portal.id} cubre la salida`);
  }
});

test('la publicación coincide con el borrador', { skip: dryRun }, async () => {
  assert.deepEqual(await json('src/data/world/maps/brumaluz.json'), map);
  const sql = await readFile('supabase/world.sql', 'utf8');
  assert.match(sql, /"minX":-240,"minZ":-240,"maxX":240,"maxZ":240/);
  assert.ok(!sql.includes('ensanche_ferry'), 'Sin transbordadores en el SQL');
});

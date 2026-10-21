import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createServer } from 'vite';
import { assetBoxes } from '../tools/asset-bounds.mjs';
import {
  buildBrumaluz, DIRS, DISTRICTS, GATES, HALF, PREFIX, RINGS, WALL_PIECE, WALL_RADIUS,
  hexDist, hexToWorld, polar, tileRoadMask, worldToHex,
} from '../tools/build-brumaluz.mjs';

// Brumaluz agrandada dentro de una sola muralla, con todo el suelo de casillas hexagonales:
// `npm run test:brumaluz` revisa el borrador publicado; con BRUMALUZ_CITY_DRY_RUN=1 genera la ciudad
// en memoria a partir del borrador actual, sin guardarla.
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const dryRun = process.env.BRUMALUZ_CITY_DRY_RUN === '1';
let server, maps, runtime, map, terrain, collision, tiles, boxes;

before(async () => {
  server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true } });
  maps = await server.ssrLoadModule('/src/data/maps.ts');
  runtime = await server.ssrLoadModule('/src/world/mapRuntime.ts');
  const draft = await json('src/data/maps/brumaluz.json');
  map = maps.validateMap(dryRun ? buildBrumaluz(draft, maps, await assetBoxes()) : draft);
  terrain = maps.decodeTerrain(map.terrain);
  // Las mismas cajas de colisión que el juego (planta a ras de suelo).
  boxes = await assetBoxes({ footprint: true, only: new Set(map.objects.map(object => object.asset)) });
  for (const object of map.objects) assert.ok(boxes.has(object.asset), `Recurso conocido: ${object.asset}`);
  collision = runtime.buildCollision(map, new runtime.TerrainField(terrain), boxes);
  tiles = new Map();
  for (const object of map.objects.filter(item => item.asset.startsWith('city/hex_'))) {
    const key = worldToHex(object.position[0], object.position[2]).join(',');
    assert.ok(!tiles.has(key), `Una sola casilla en ${key}`);
    tiles.set(key, object);
  }
});
after(async () => { await server?.close(); });

const heightAt = (x, z) => maps.sampleHeight(terrain, x + HALF, z + HALF);
const cell = (k, n) => [DIRS[k % 6][0] * n, DIRS[k % 6][1] * n];
const centers = list => list.map(([q, r]) => hexToWorld(q, r));

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
/** Desplaza un recorrido `offset` m a la izquierda de su avance. */
const shift = (points, offset) => {
  const [ax, az] = points[0], [bx, bz] = points[points.length - 1], length = Math.hypot(bx - ax, bz - az);
  return points.map(([x, z]) => [x - (bz - az) / length * offset, z + (bx - ax) / length * offset]);
};

test('el casco antiguo sigue en el centro, sin foso ni muralla propia, y todo el suelo son casillas', () => {
  assert.deepEqual([terrain.columns, terrain.rows, terrain.cell, terrain.origin], [HALF * 2 + 1, HALF * 2 + 1, 1, [-HALF, -HALF]]);
  assert.ok(!map.objects.some(object => object.id.startsWith('ensanche_')) && !map.markers.some(marker => marker.id.startsWith('ensanche_')));
  assert.ok(!map.objects.some(object => !object.id.startsWith(PREFIX) && object.asset.startsWith('city/wall_straight')), 'Sin la muralla vieja');
  for (const object of map.objects.filter(item => !item.id.startsWith(PREFIX))) {
    assert.ok(Math.hypot(object.position[0], object.position[2]) < 92, `${object.id} pertenece al casco antiguo`);
  }
  for (const id of ['spawn', 'mknnlaak', 'npc_isberto', 'interact_well']) assert.ok(map.markers.some(marker => marker.id === id), id);
  for (let q = -40; q <= 40; q++) for (let r = -40; r <= 40; r++) {
    const [x, z] = hexToWorld(q, r);
    if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) continue;
    assert.ok(tiles.has(`${q},${r}`), `Casilla en ${q},${r}`);
  }
  const water = map.objects.filter(object => object.asset === 'city/hex_water');
  assert.ok(water.length >= 4 && water.length <= 8, `${water.length} casillas de laguna`);
  for (const object of water) assert.equal(hexDist(...worldToHex(object.position[0], object.position[2])), RINGS.island + 1);
});

test('cada salida de camino de una casilla conecta con su vecina', () => {
  let edges = 0;
  for (const [key, object] of tiles) {
    const m = tileRoadMask(object.asset, object.rotation[1]);
    const [q, r] = key.split(',').map(Number);
    for (let i = 0; i < 6; i++) {
      if (!(m & (1 << i))) continue;
      const neighbor = tiles.get(`${q + DIRS[i][0]},${r + DIRS[i][1]}`);
      if (!neighbor) continue; // sale del mapa (camino al continente)
      const back = tileRoadMask(neighbor.asset, neighbor.rotation[1]) & (1 << ((i + 3) % 6));
      assert.ok(back || /river_crossing/.test(neighbor.asset), `Camino cortado entre ${key} y su vecina ${i}`);
      edges++;
    }
  }
  assert.ok(edges > 1500, `${edges} uniones de camino`);
});

test('seis barrios con casas en sus casillas, casas gremiales, colinas y muralla con torres', () => {
  const generated = map.objects.filter(object => object.id.startsWith(PREFIX));
  const houses = generated.filter(object => / · casa \d+$/.test(object.name ?? ''));
  assert.ok(houses.length >= 220, `${houses.length} casas`);
  for (const district of DISTRICTS) {
    assert.ok(map.markers.some(marker => marker.name === district), district);
    assert.ok(houses.filter(object => object.name.startsWith(district)).length >= 20, `Casas en ${district}`);
  }
  for (const house of houses) {
    const [q, r] = worldToHex(house.position[0], house.position[2]), [x, z] = hexToWorld(q, r);
    assert.ok(Math.hypot(house.position[0] - x, house.position[2] - z) < 0.01, `${house.name} en el centro de su casilla`);
  }
  // Edificios ya construidos del pack: ninguno hecho a mano con piezas de muro y puerta.
  for (const name of ['Casa de los Telares', 'Casa de los Canteros', 'Lonja de los Mercaderes', 'Archivo de la Capital']) {
    assert.equal(generated.filter(object => object.name === name).length, 1, name);
  }
  assert.ok(!generated.some(object => WALL_PIECE.test(object.asset)), 'Sin edificios montados con muros, puertas o suelos');
  for (const id of ['colina_molino', 'colina_cantera', 'colina_mirador']) {
    const [x, , z] = map.markers.find(marker => marker.id === `${PREFIX}${id}`).position, r = Math.hypot(x, z);
    const around = Math.min(...[-1, 1].map(side => heightAt(x / r * (r + side * 14), z / r * (r + side * 14))));
    assert.ok(heightAt(x, z) - around >= 4, `${id}: ${(heightAt(x, z) - around).toFixed(1)} m sobre su entorno`);
  }
  const walls = generated.filter(object => object.asset === 'city/wall_straight');
  const length = walls.reduce((sum, object) => sum + object.scale[0] * 2, 0);
  assert.ok(length > 6 * WALL_RADIUS - 5 * 8 - 5, `Muralla continua (${length.toFixed(0)} m)`);
  assert.equal(generated.filter(object => object.asset === 'city/wall_straight_gate').length, GATES.filter(gate => gate.id).length);
});

test('calles mayores, anillos, calles de barrio y puertas viejas tienen paso libre', () => {
  let samples = 0;
  for (const [k, gate] of GATES.entries()) {
    // Desde dentro del casco antiguo, por donde estaba su puerta, hasta la muralla nueva (y fuera, al portal).
    const path = centers([cell(k, gate.id ? 6 : 9), cell(k, gate.id ? 24 : RINGS.ronda)]);
    for (const offset of gate.id ? [-1.3, 0, 1.3] : [0]) samples += walk(shift(path, offset), `Calle mayor ${gate.angle}° (${offset})`);
  }
  for (const radius of [RINGS.inner, RINGS.middle, RINGS.ronda]) for (let k = 0; k < 6; k++) {
    const side = [];
    for (let j = 0; j <= radius; j++) side.push([cell(k, radius)[0] + DIRS[(k + 2) % 6][0] * j, cell(k, radius)[1] + DIRS[(k + 2) % 6][1] * j]);
    const path = centers(side);
    for (const offset of [-1, 1]) samples += walk(shift(path, offset), `Anillo ${radius}, lado ${k} (${offset})`);
  }
  for (let k = 0; k < 6; k++) {
    // Calle de barrio: del centro del lado del anillo interior hasta la ronda, paralela a una calle mayor.
    const start = [cell(k, RINGS.inner)[0] + DIRS[(k + 2) % 6][0] * 7, cell(k, RINGS.inner)[1] + DIRS[(k + 2) % 6][1] * 7];
    const end = [start[0] + DIRS[(k + 1) % 6][0] * (RINGS.ronda - RINGS.inner), start[1] + DIRS[(k + 1) % 6][1] * (RINGS.ronda - RINGS.inner)];
    samples += walk(centers([start, end]), `Calle de barrio ${k}`);
  }
  assert.ok(samples > 8000, `${samples} muestras de paso`);
});

test('las escaleras de las casas llevan hasta el rellano de la puerta', () => {
  // Medidas del modelo (fachada hacia +Z): centro de la escalera en X, pie, punto ante la puerta (a un radio del muro)
  // y altura del zócalo.
  const STAIRS = { 'city/home_B': { x: 0.125, foot: 0.57, top: 0.36, height: 0.21 }, 'city/tavern': { x: -0.145, foot: 0.64, top: 0.46, height: 0.21 } };
  let checked = 0;
  for (const object of map.objects) {
    const stairs = STAIRS[object.asset];
    if (!stairs || !object.id.startsWith(PREFIX)) continue;
    const [x, , z] = object.position, s = object.scale[0], c = Math.cos(object.rotation[1]), sn = Math.sin(object.rotation[1]);
    const at = lz => [x + stairs.x * s * c + lz * s * sn, z - stairs.x * s * sn + lz * s * c];
    const path = [at(stairs.foot + 0.25), at(stairs.top)];
    walk(path, `Escalera de ${object.name}`);
    // Al subir, la superficie crece sin saltos (como la sigue el juego) y acaba en el rellano.
    let previous = collision.groundY(...path[0]);
    for (let t = 0; t <= 1; t += 0.02) {
      const [px, pz] = [path[0][0] + (path[1][0] - path[0][0]) * t, path[0][1] + (path[1][1] - path[0][1]) * t];
      const y = collision.platformY(px, pz) ?? collision.groundY(px, pz);
      assert.ok(Math.abs(y - previous) < 0.35, `${object.name}: escalón brusco (${(y - previous).toFixed(2)} m)`);
      previous = y;
    }
    const base = object.position[1];
    assert.ok(previous - base > stairs.height * object.scale[1] * 0.75, `${object.name}: se sube casi hasta la altura de la puerta (${(previous - base).toFixed(2)} m)`);
    checked++;
  }
  assert.ok(checked >= 20, `${checked} escaleras comprobadas`);
});

test('el agua se cruza: las lagunas se nadan y el río se vadea', () => {
  const lagoons = map.objects.filter(object => object.asset === 'city/hex_water');
  for (const lagoon of lagoons) {
    const [x, , z] = lagoon.position, water = collision.waterAt(x, z);
    assert.ok(water?.deep, `Laguna en ${x},${z}: se nada`);
    assert.ok(Math.abs(water.surface - (lagoon.position[1] - 0.2 * lagoon.scale[1])) < 0.01, 'Superficie a la altura de la lámina');
  }
  const river = map.objects.find(object => object.asset === 'city/hex_river_A');
  const shallow = collision.waterAt(river.position[0], river.position[2] + 0.2);
  assert.ok(shallow && !shallow.deep, 'El río del casco se vadea');
  assert.equal(collision.waterAt(0, 0), null, 'La plaza está en seco');
  // De la orilla a la laguna y de vuelta, sin que nada lo impida.
  const [lx, , lz] = lagoons.find(object => object.position[0] > 0).position;
  walk([[lx - 9, lz], [lx, lz], [lx - 9, lz]], 'Entrar y salir de la laguna');
  // Y se cruza el río de orilla a orilla.
  walk([[river.position[0] + 2, river.position[2] - 5], [river.position[0] + 2, river.position[2] + 5]], 'Vadear el río');
});

test('faroles, toldos y arbustos chocan como lo que son', () => {
  const field = new runtime.TerrainField(terrain);
  const shapesOf = asset => map.objects.filter(object => object.asset === asset && object.collision === 'auto')
    .map(object => runtime.objectCollision(object, boxes.get(asset), field));
  const lamps = shapesOf('builtin/lamppost');
  assert.ok(lamps.length > 20);
  for (const { shapes } of lamps) assert.ok(shapes.length === 1 && shapes[0].r > 0 && shapes[0].r <= 0.15, 'Cada farol es un poste fino');
  for (const { shapes } of shapesOf('city/tent')) assert.ok(shapes.length === 4 && shapes.every(shape => shape.r <= 0.15), 'Bajo un toldo se pasa: solo chocan sus postes');
  for (const { shapes, platforms } of shapesOf('forest/objects/Bush_4_A_Color1')) assert.ok(shapes.length === 1 && !platforms.length, 'Los arbustos se rodean, no se pisan');
});

test('las puertas al continente llevan a Pompelín y sus llegadas están despejadas', () => {
  for (const gate of GATES.filter(item => item.id)) {
    const portal = map.markers.find(marker => marker.id === `salida_${gate.id}`);
    const arrival = map.markers.find(marker => marker.id === `llegada_${gate.id}`);
    assert.equal(portal.target.map, 'pompelin');
    assert.equal(portal.trigger, 'walk');
    assert.ok(Math.hypot(portal.position[0], portal.position[2]) > WALL_RADIUS, `${portal.id} fuera de la muralla`);
    assert.ok(Math.hypot(arrival.position[0], arrival.position[2]) < WALL_RADIUS - 8, `${arrival.id} dentro`);
    for (const marker of [portal, arrival]) {
      const [x, , z] = marker.position;
      walk([[x - .7, z], [x + .7, z]], marker.id);
      walk([[x, z - .7], [x, z + .7]], marker.id);
    }
    // Hay que pisar el portal para salir por la puerta: el hueco queda dentro de su radio.
    const [gx, gz] = polar(WALL_RADIUS + 1.6, gate.angle);
    assert.ok(Math.hypot(gx - portal.position[0], gz - portal.position[2]) < portal.radius, `${portal.id} cubre la salida`);
  }
});

test('la publicación coincide con el borrador', { skip: dryRun }, async () => {
  assert.deepEqual(await json('src/data/world/maps/brumaluz.json'), map);
  const sql = await readFile('supabase/world.sql', 'utf8');
  assert.ok(sql.includes(`"minX":-${HALF},"minZ":-${HALF},"maxX":${HALF},"maxZ":${HALF}`), 'Límites del mapa en el SQL');
  assert.ok(!sql.includes('ensanche_ferry'), 'Sin transbordadores en el SQL');
});

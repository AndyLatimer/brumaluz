import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import * as THREE from 'three';
import { createServer } from 'vite';

// Agua pintada con el editor (lagos, lagunas, ríos): formato, colisiones (nadar o vadear) y cascadas.
let server, maps, runtime, water;

before(async () => {
  server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true } });
  maps = await server.ssrLoadModule('/src/data/maps.ts');
  runtime = await server.ssrLoadModule('/src/world/mapRuntime.ts');
  water = await server.ssrLoadModule('/src/world/water.ts');
});
after(async () => { await server?.close(); });

/** Terreno de 40 × 20 m: un lago de 2 m de hondo a la izquierda y un río somero que cae 1,5 m en x = 10. */
function scene() {
  const map = maps.newMap('agua', 'Agua', { width: 40, depth: 20, cell: 1 });
  const data = maps.decodeTerrain(map.terrain);
  data.water = new Float32Array(data.heights.length).fill(NaN);
  for (let j = 0; j < data.rows; j++) for (let i = 0; i < data.columns; i++) {
    const x = data.origin[0] + i, z = data.origin[1] + j, index = j * data.columns + i;
    if (x < -5) { data.heights[index] = -2; data.water[index] = 0; } // lago
    else if (Math.abs(z) <= 2) { data.heights[index] = x < 10 ? -0.4 : -1.9; data.water[index] = x < 10 ? 0 : -1.5; } // río con salto
    else data.heights[index] = x < 10 ? 0.5 : -1;
  }
  map.terrain = maps.encodeTerrain(data);
  return maps.validateMap(map);
}

test('el agua pintada se guarda y se recupera, y los mapas sin agua no la llevan', () => {
  const dry = maps.newMap('seco', 'Seco');
  assert.equal(dry.terrain.water, undefined, 'Sin agua no se guarda nada');
  const map = scene();
  assert.ok(map.terrain.water, 'Con agua se guarda');
  const data = maps.decodeTerrain(map.terrain);
  assert.equal(data.water[0], 0);
  assert.ok(Number.isNaN(data.water[data.water.length - 1]), 'Lo seco sigue seco');
  const resized = maps.resampleTerrain(data, 20, 10, 1);
  assert.ok(resized.water && resized.water.some(Number.isFinite), 'Al cambiar de tamaño el agua se conserva');
});

test('se nada en lo hondo, se vadea en el río y la orilla queda a mitad de celda', () => {
  const map = scene();
  const collision = runtime.buildCollision(map, new runtime.TerrainField(maps.decodeTerrain(map.terrain)), new Map());
  assert.deepEqual(collision.waterAt(-12, 5), { surface: 0, deep: true });
  const river = collision.waterAt(0, 0);
  assert.ok(river && !river.deep && river.surface === 0, 'El río es somero');
  assert.equal(collision.waterAt(0, 6), null, 'Fuera del río, seco');
  assert.ok(collision.waterAt(0, 2.4), 'A 0,4 de celda del último vértice mojado, aún hay agua');
  assert.equal(collision.waterAt(0, 2.6), null, 'Más allá de la mitad de la celda, seco');
  // Se cruza el río y se baja la cascada nadando hasta el tramo de abajo.
  assert.ok(!collision.blocked(0, 0));
});

test('una cascada se baja, pero no se remonta nadando', () => {
  const map = scene();
  const collision = runtime.buildCollision(map, new runtime.TerrainField(maps.decodeTerrain(map.terrain)), new Map());
  const down = collision.collide(new THREE.Vector3(8, 0, 0), new THREE.Vector3(13, 0, 0));
  assert.ok(down.x > 12.5, `Río abajo se pasa (x=${down.x})`);
  const up = collision.collide(new THREE.Vector3(13, 0, 0), new THREE.Vector3(8, 0, 0));
  assert.ok(up.x > 9.5, `Río arriba, la cascada frena (x=${up.x})`);
});

test('un río de casillas solo cae por el extremo de su cauce, no por sus orillas', () => {
  const map = maps.newMap('cauce', 'Cauce', { width: 40, depth: 40, cell: 1 });
  const layer = map.layers[0].id;
  const tile = (id, asset, x, z, y) => ({ id, asset, layer, position: [x, y, z], rotation: [0, 0, 0], scale: [4, 1.12, 4], collision: 'auto' });
  // Río (cauce a lo largo de X) con una laguna 1 m más baja en su extremo oeste y otra junto a su orilla.
  map.objects.push(tile('rio', 'city/hex_river_A', 0, 0, 0), tile('extremo', 'city/hex_water', -8, 0, -1), tile('orilla', 'city/hex_water', -4, 6.928, -1));
  const field = new runtime.TerrainField(maps.decodeTerrain(map.terrain));
  const layerWater = new water.WaterLayer(maps.validateMap(map), field, new runtime.TerrainSurface(field));
  assert.equal(layerWater.falls.length, 1, 'Una sola cascada');
  assert.ok(Math.abs(layerWater.falls[0].x + 4.6) < 0.1 && Math.abs(layerWater.falls[0].z) < 0.1, `Al final del cauce (${layerWater.falls[0].x}, ${layerWater.falls[0].z})`);
});

test('las luciérnagas no van en los interiores salvo que el mapa lo pida', () => {
  assert.equal(maps.mapFireflies({}), true);
  assert.equal(maps.mapFireflies({ kind: 'interior' }), false);
  assert.equal(maps.mapFireflies({ kind: 'interior', fireflies: true }), true);
  assert.equal(maps.mapFireflies({ kind: 'city', fireflies: false }), false);
  const map = maps.newMap('casa', 'Casa');
  map.settings.kind = 'interior'; map.settings.fireflies = false;
  assert.equal(maps.validateMap(JSON.parse(JSON.stringify(map))).settings.fireflies, false, 'El ajuste se guarda');
});

test('donde el agua da un salto hay cascada y la superficie no se dibuja inclinada', () => {
  const map = scene();
  const field = new runtime.TerrainField(maps.decodeTerrain(map.terrain));
  const layer = new water.WaterLayer(map, field, new runtime.TerrainSurface(field));
  assert.ok(layer.falls.length >= 1, 'Cascada en el salto del río');
  for (const fall of layer.falls) {
    assert.ok(Math.abs(fall.x - 10) <= 1, `Cascada en el salto (x=${fall.x})`);
    assert.ok(Math.abs(fall.drop - 1.5) < 0.01, 'Cae 1,5 m');
  }
  const names = layer.root.children.map(child => child.name);
  assert.ok(names.includes('painted-water') && names.includes('waterfalls') && names.includes('waterfall-foam'), names.join(', '));
  const surface = layer.root.getObjectByName('painted-water').geometry.getAttribute('position');
  for (let i = 0; i < surface.count; i += 4) {
    const ys = [0, 1, 2, 3].map(k => surface.getY(i + k));
    assert.ok(Math.max(...ys) - Math.min(...ys) <= water.FALL_STEP + 1e-6, 'Ninguna celda de agua inclinada por un salto');
  }
});

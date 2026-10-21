import assert from 'node:assert/strict';
import { request } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

export const EXPANSION_PREFIX = 'ensanche_';
export const AVENUES = [-128, -64, 0, 64, 128];
export const DISTRICTS = ['Barrio de los Telares', 'Barrio del Olmo', 'Huertas del Alba', 'Barrio de los Canteros'];
export const sidePoint = (side, u, v) => [[u, -v], [v, u], [-u, v], [-v, -u]][side].map(value => value || 0);
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const rounded = value => Math.round(value * 1000) / 1000;

export function roadDistance(x, z) {
  const ax = Math.abs(x), az = Math.abs(z), edge = Math.max(ax, az), cross = Math.min(ax, az);
  let distance = Infinity;
  if (cross <= 210) distance = Math.min(Math.abs(edge - 148), Math.abs(edge - 208));
  if (edge >= 148 && edge <= 208 && cross <= 132) {
    distance = Math.min(distance, ...AVENUES.map(avenue => Math.abs((ax > az ? z : x) - avenue)));
  }
  if (ax >= 148 && ax <= 208 && az >= 148 && az <= 208) {
    distance = Math.min(distance, Math.abs(ax - 174), Math.abs(az - 174));
  }
  return distance;
}

/** The original waterfront is retained; ferries join it to the continuous outer street network. */
export function expandBrumaluz(source, maps) {
  assert.equal(source.id, 'brumaluz');
  assert.equal(source.terrain.columns, 241, 'Only expand the original 240 m draft, never regenerate an edited expansion.');
  assert.equal(source.terrain.rows, 241);
  assert.equal(source.terrain.cell, 1);
  assert.deepEqual(source.terrain.origin, [-120, -120]);
  assert.ok(!source.objects.some(object => object.id.startsWith(EXPANSION_PREFIX)));
  const map = structuredClone(source);
  const old = maps.decodeTerrain(source.terrain);
  const terrain = maps.createTerrain(480, 480, 1, 0, 1, 50);
  const mat = id => maps.GROUND_MATERIALS.findIndex(material => material.id === id);
  const oldIndex = (x, z) => (z + 120) * 241 + x + 120;
  const index = (x, z) => (z + 240) * 481 + x + 240;
  const rolling = (x, z) => 1.8 + Math.sin(x / 57) * .75 + Math.cos(z / 62) * .65
    + Math.sin((x + z) / 79) * .45
    + 5.5 * Math.exp(-((x + 205) ** 2 + (z + 210) ** 2) / 2300)
    + 4.7 * Math.exp(-((x - 215) ** 2 + (z - 205) ** 2) / 2000);
  for (let z = -240; z <= 240; z++) for (let x = -240; x <= 240; x++) {
    const i = index(x, z), edge = Math.max(Math.abs(x), Math.abs(z));
    if (edge <= 120) {
      const before = oldIndex(x, z);
      terrain.heights[i] = old.heights[before];
      terrain.paint[i] = old.paint[before];
      terrain.grass[i] = old.grass[before];
      continue;
    }
    const blend = smooth((edge - 120) / 25);
    const bx = Math.max(-120, Math.min(120, x)), bz = Math.max(-120, Math.min(120, z));
    terrain.heights[i] = old.heights[oldIndex(bx, bz)] * (1 - blend) + rolling(x, z) * blend;
    const road = roadDistance(x, z);
    terrain.paint[i] = mat(edge < 131 ? 'sand' : road < 3.2 ? 'cobble' : edge > 216 ? 'forest' : 'meadow');
    terrain.grass[i] = road < 4 || edge < 136 ? 0 : edge > 216 ? 80 : 45;
  }
  const height = (x, z) => maps.sampleHeight(terrain, x + 240, z + 240);
  const flatten = (x, z, radius) => {
    const y = height(x, z);
    for (let dz = -radius - 3; dz <= radius + 3; dz++) for (let dx = -radius - 3; dx <= radius + 3; dx++) {
      const px = Math.round(x + dx), pz = Math.round(z + dz);
      if (Math.max(Math.abs(px), Math.abs(pz)) <= 120 || Math.max(Math.abs(px), Math.abs(pz)) > 240) continue;
      const amount = 1 - smooth((Math.hypot(dx, dz) - radius) / 3);
      const i = index(px, pz);
      terrain.heights[i] += (y - terrain.heights[i]) * amount;
    }
    return y;
  };
  map.layers.push(
    { id: 'ensanche_casas', name: 'Ensanche · viviendas y patios', visible: true, locked: false },
    { id: 'ensanche_civico', name: 'Ensanche · edificios compuestos', visible: true, locked: false },
    { id: 'ensanche_verde', name: 'Ensanche · jardines y afueras', visible: true, locked: false },
    { id: 'ensanche_logica', name: 'Ensanche · barrios y transbordadores', visible: true, locked: false },
  );
  let serial = 0;
  const add = (asset, x, z, scale = 1, yaw = 0, layer = 'ensanche_casas', options = {}) => {
    const { y = height(x, z), ...rest } = options;
    const object = {
      id: `${EXPANSION_PREFIX}${String(serial++).padStart(4, '0')}`, asset, layer,
      position: [rounded(x), rounded(y), rounded(z)], rotation: [0, rounded(yaw), 0],
      scale: (Array.isArray(scale) ? scale : [scale, scale, scale]), collision: 'auto', ...rest,
    };
    map.objects.push(object);
    return object;
  };
  const marker = (id, type, name, x, z, extra = {}) => {
    const value = {
      id: `${EXPANSION_PREFIX}${id}`, type, name, layer: 'ensanche_logica',
      position: [x, rounded(height(x, z)), z], radius: 1, rotationY: 0, ...extra,
    };
    map.markers.push(value);
    return value;
  };
  const patch = (cx, cz, radius, material) => {
    for (let z = Math.ceil(cz - radius); z <= cz + radius; z++) for (let x = Math.ceil(cx - radius); x <= cx + radius; x++) {
      if (Math.hypot(x - cx, z - cz) > radius || Math.max(Math.abs(x), Math.abs(z)) <= 120) continue;
      const i = index(x, z);
      terrain.paint[i] = mat(material); terrain.grass[i] = 0;
    }
  };
  // Lots face the promenade or the outer lane; the five transverse streets stay open.
  for (let side = 0; side < 4; side++) {
    const [mx, mz] = sidePoint(side, 0, 178);
    marker(`barrio_${side}`, 'zone', DISTRICTS[side], mx, mz, { radius: 40, text: DISTRICTS[side] });
    for (let row = 0; row < 2; row++) for (let u = -120; u <= 120; u += 16) {
      const v = row ? 190 : 166, [x, z] = sidePoint(side, u, v), yaw = -side * Math.PI / 2 + (row ? Math.PI : 0);
      const ground = flatten(x, z, 4.8);
      const alternate = (u + 120) / 16 + row + side;
      const asset = alternate % 5 === 0 ? 'medieval-builder/objects/house' : `city/home_${alternate % 2 ? 'A' : 'B'}`;
      add(asset, x, z, asset.startsWith('city/') ? 5.5 : 4, yaw, 'ensanche_casas', {
        y: ground, name: `${DISTRICTS[side]} · casa ${row + 1}-${(u + 120) / 16 + 1}`,
      });
      patch(x, z, 5.5, 'dirt');
      const point = (du, dv) => sidePoint(side, u + du, v + dv);
      for (const [du, dv] of [[-5, 5], [5, 5]]) {
        const [tx, tz] = point(du, dv);
        add(alternate % 2 ? 'city/tree_single_A' : 'city/tree_single_B', tx, tz, 3.4, yaw, 'ensanche_verde');
      }
      for (const [du, dv] of [[-5, -3], [5, -3], [-4, 7], [4, 7]]) {
        const [bx, bz] = point(du, dv);
        add('forest/objects/Bush_1_A_Color1', bx, bz, .65, yaw, 'ensanche_verde');
      }
      const [cx, cz] = point(4, 1), [bx, bz] = point(-4, 0);
      add(alternate % 2 ? 'city/barrel' : 'city/crate_A_small', cx, cz, 3, yaw);
      add('builtin/bench', bx, bz, 1, yaw);
      const [px, pz] = point(0, row ? 8 : -8);
      patch(px, pz, 2.2, 'path');
    }
    for (let u = -120; u <= 120; u += 16) {
      for (const v of [143, 213]) {
        const [x, z] = sidePoint(side, u, v);
        add('builtin/lamppost', x, z, 1, 0, 'ensanche_casas', { name: 'Farol del ensanche' });
      }
    }
  }
  // Four independently editable public buildings made from walls, floors, pillars and roof panels.
  const civicNames = ['Lonja de artesanos', 'Archivo de la capital', 'Pabellón de las huertas', 'Casa de los canteros'];
  for (let corner = 0; corner < 4; corner++) {
    const sx = corner % 2 ? 1 : -1, sz = corner < 2 ? -1 : 1, x = sx * 188, z = sz * 188;
    const y = flatten(x, z, 10);
    const civic = (asset, dx, dz, scale = 1, yaw = 0, lift = 0, extra = {}) =>
      add(`dungeon/objects/${asset}`, x + dx, z + dz, scale, yaw, 'ensanche_civico',
        { y: y + lift, name: `${civicNames[corner]} · ${asset}`, walkable: false, ...extra });
    patch(sx * 174, sz * 174, 19, 'cobble');
    marker(`plaza_${corner}`, 'zone', `Plaza · ${civicNames[corner]}`, sx * 174, sz * 174, { radius: 20, text: 'Plaza pública y reserva para servicios futuros.' });
    for (const dx of [-6, -2, 2, 6]) for (const dz of [-4, 0, 4]) {
      civic('floor_tile_large', dx, dz, 1, 0, -.04, { collision: 'none' });
      civic('floor_wood_large', dx, dz, 1.04, 0, 4.05, { collision: 'none', tint: corner % 2 ? '#9b735b' : '#887b69' });
    }
    for (const dx of [-6, -2, 2, 6]) {
      civic('wall_window_open', dx, sz * 6);
      if (Math.abs(dx) > 2) civic('wall_window_open', dx, -sz * 6);
    }
    for (const dx of [-8, 8]) for (const dz of [-4, 0, 4]) civic('wall_window_open', dx, dz, 1, Math.PI / 2);
    for (const dx of [-3.5, 3.5]) civic('pillar', dx, -sz * 6, [.45, 1, .45]);
    for (const [dx, dz] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) civic('pillar', dx, dz, [.55, 1.15, .55]);
    add('city/flag', x, z, 5, 0, 'ensanche_civico', { y: y + 4.1, collision: 'none', name: civicNames[corner] });
    for (const [dx, dz] of [[-3, 0], [3, 0]]) civic('table_small_decorated_A', dx, dz, .9);
    const wx = sx * 160, wz = sz * 160;
    flatten(wx, wz, 3);
    add('city/well', wx, wz, 4.2, 0, 'ensanche_civico', { name: 'Pozo de la plaza' });
    for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      add('city/tree_single_B', wx + dx, wz + dz, 4, 0, 'ensanche_verde');
    }
  }
  // Productive gardens occupy two outer strips, away from both promenade and cross streets.
  for (const side of [1, 2]) for (const u of [-110, -94, -78, -46, -30, -14, 18, 34, 50, 82, 98, 114]) {
    for (const v of [220, 228]) {
      const [x, z] = sidePoint(side, u, v);
      flatten(x, z, 3);
      patch(x, z, 3.4, 'farmland');
      add('medieval-builder/objects/farm_plot', x, z, 3.8, -side * Math.PI / 2, 'ensanche_verde', { collision: 'none', name: 'Huerta cultivada' });
      for (const du of [-1.6, 1.6]) {
        const [wx, wz] = sidePoint(side, u + du, v);
        add('medieval-builder/objects/farm_wheat', wx, wz, 2.1, 0, 'ensanche_verde', { collision: 'none' });
      }
    }
  }
  // The green belt remains open for later content: trees are clustered, never spread across a road.
  let seed = 40721;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 0; k < 440; k++) {
    const side = k % 4, u = -230 + random() * 460, v = 218 + random() * 17;
    if ((side === 1 || side === 2) && Math.abs(u) < 138) continue;
    const [x, z] = sidePoint(side, u, v);
    add(k % 3 ? 'city/tree_single_A' : 'city/tree_single_B', x, z, 3.8 + random() * 2.8, random() * 6.28, 'ensanche_verde');
    if (k % 3 === 0) add('city/rock_single_C', x + 2, z + 1.5, 4 + random() * 3, random() * 6, 'ensanche_verde');
  }
  // Small gardens on the inner bank leave the 148 m promenade completely unobstructed.
  for (let side = 0; side < 4; side++) for (let u = -120; u <= 120; u += 8) {
    const [x, z] = sidePoint(side, u, 138);
    if (Math.abs(u) < 10) continue;
    add('city/tree_single_A', x, z, 3.2, side, 'ensanche_verde');
    const [bx, bz] = sidePoint(side, u + 2.5, 140);
    add('forest/objects/Bush_1_A_Color1', bx, bz, .7, side, 'ensanche_verde');
  }
  map.terrain = maps.encodeTerrain(terrain);
  // Recompute after all terrain pads so every new prop sits on the final ground.
  for (const object of map.objects.slice(source.objects.length)) {
    if (object.layer === 'ensanche_civico') continue;
    object.position[1] = rounded(height(object.position[0], object.position[2]));
  }
  const ferries = [
    ['este', [68, 0], [148, 0]],
    ['oeste', [-68, 0], [-148, 0]],
    ['noreste', [34, -59], [64, -148]],
    ['sureste', [34, 59], [64, 148]],
    ['suroeste', [-34, 59], [-64, 148]],
  ];
  for (const [id, inner, outer] of ferries) {
    marker(`ferry_${id}_interior`, 'portal', `Transbordador · al ensanche ${id}`, ...inner, {
      radius: 2, trigger: 'interact', text: 'Cruzar el canal hacia los barrios exteriores.',
      target: { map: 'brumaluz', arrival: `${EXPANSION_PREFIX}ferry_${id}_llegada_exterior` },
    });
    marker(`ferry_${id}_exterior`, 'portal', `Transbordador · al casco antiguo`, ...outer, {
      radius: 2, trigger: 'interact', text: 'Regresar al casco antiguo sin alterar sus puertas continentales.',
      target: { map: 'brumaluz', arrival: `${EXPANSION_PREFIX}ferry_${id}_llegada_interior` },
    });
    marker(`ferry_${id}_llegada_interior`, 'arrival', `Desde el ensanche · ${id}`, ...inner);
    marker(`ferry_${id}_llegada_exterior`, 'arrival', `Desde el casco antiguo · ${id}`, ...outer);
    const [x, z] = outer;
    for (const offset of [-4.8, 4.8]) {
      const northSouth = Math.abs(z) > Math.abs(x);
      add('builtin/lamppost', x + (northSouth ? offset : 0), z + (northSouth ? 0 : offset), 1, 0, 'ensanche_casas', { name: 'Embarcadero del transbordador' });
    }
  }
  marker('reserva_norte', 'note', 'Prados del norte · reserva de expansión', 0, -232, { radius: 15, text: 'Espacio libre para futuras misiones y edificios; no bloquear las calles del ensanche.' });
  map.description = 'Brumaluz, capital de Pompelín · 480 × 480 m. Casco antiguo y canal originales conservados; cuatro barrios exteriores unidos por paseos, plazas de edificios modulares, huertas y lomas verdes. Los transbordadores conectan el ensanche sin mover las puertas continentales.';
  delete map.preview; // The old 240 m image would misrepresent the expanded loading screen.
  return maps.validateMap(map);
}

function api(path, method = 'GET', value, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = value === undefined ? undefined : JSON.stringify(value);
    const req = request({
      hostname: 'localhost', port: Number(process.env.MAP_EDITOR_PORT || 4190), path: `/__dev/maps/${path}`, method,
      headers: { ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}), ...headers },
    }, response => {
      let text = '';
      response.setEncoding('utf8'); response.on('data', chunk => { text += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`${method} ${path}: ${response.statusCode}: ${text}`));
        resolve({ value: JSON.parse(text), headers: response.headers });
      });
    });
    req.on('error', reject); req.end(body);
  });
}

async function main() {
  const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true } });
  try {
    const maps = await server.ssrLoadModule('/src/data/maps.ts');
    const before = await api('brumaluz');
    const expanded = expandBrumaluz(before.value, maps);
    assert.ok(before.headers.etag, 'Refuse to save without concurrency protection.');
    const saved = await api('brumaluz', 'PUT', expanded, { 'If-Match': before.headers.etag });
    const current = await api('brumaluz');
    assert.equal(JSON.stringify(current.value.objects), JSON.stringify(expanded.objects));
    assert.equal(JSON.stringify(current.value.markers), JSON.stringify(expanded.markers));
    assert.deepEqual(current.value.terrain, expanded.terrain);
    const publication = await api('__published', 'POST', { id: 'brumaluz' });
    console.log(JSON.stringify({
      objectsBefore: before.value.objects.length, objectsAfter: current.value.objects.length,
      originalMarkers: before.value.markers.length, markersAfter: current.value.markers.length,
      revision: saved.headers.etag, publication: publication.value,
    }, null, 2));
  } finally { await server.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

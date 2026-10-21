// Auditoría de un mapa con las colisiones del juego: objetos sólidos que se pisan, calles invadidas y edificios
// asentados en mucha pendiente. Uso: node tools/audit-map.mjs [mapa.json] [--list]
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { assetBoxes } from './asset-bounds.mjs';
import { DIRS, hexToWorld, tileRoadMask, worldToHex } from './build-brumaluz.mjs';

const ROAD_CLEARANCE = 1.2;
const BUILDING = /^city\/(home_|tavern|market|blacksmith|church|castle|windmill|watermill|lumbermill|barracks|archeryrange|tower_|well|stage)|^medieval-builder\/objects\/(house|market|mill|lumbermill|barracks|watchtower|mine|well)/;

/** Separación entre dos formas de colisión (negativa si se solapan), por ejes separadores. */
function overlap(a, b) {
  const corners = s => {
    if (s.hx === undefined) return null;
    const pts = [];
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
      const lx = sx * s.hx, lz = sz * s.hz;
      pts.push([s.x + lx * s.cos + lz * s.sin, s.z - lx * s.sin + lz * s.cos]);
    }
    return pts;
  };
  const ca = corners(a), cb = corners(b);
  if (!ca && !cb) return Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
  if (!ca || !cb) {
    const [c, box] = ca ? [b, a] : [a, b];
    const dx = c.x - box.x, dz = c.z - box.z;
    const lx = dx * box.cos - dz * box.sin, lz = dx * box.sin + dz * box.cos;
    const nx = Math.max(-box.hx, Math.min(box.hx, lx)), nz = Math.max(-box.hz, Math.min(box.hz, lz));
    return Math.hypot(lx - nx, lz - nz) - c.r;
  }
  let gap = -Infinity;
  for (const shape of [a, b]) for (const [ax, az] of [[shape.cos, -shape.sin], [shape.sin, shape.cos]]) {
    const project = pts => pts.map(([x, z]) => x * ax + z * az);
    const pa = project(ca), pb = project(cb);
    gap = Math.max(gap, Math.min(...pb) - Math.max(...pa), Math.min(...pa) - Math.max(...pb));
  }
  return gap;
}

export async function auditMap(map, { maps, runtime, boxes }) {
  const field = new runtime.TerrainField(maps.decodeTerrain(map.terrain));
  const byId = new Map(map.objects.map(object => [object.id, object]));
  const shapes = [];
  for (const object of map.objects) {
    if (object.asset.startsWith('city/hex_')) continue;
    for (const shape of runtime.objectCollision(object, boxes.get(object.asset), field).shapes) shapes.push({ ...shape, object });
  }
  // Rejilla para no comparar todo con todo.
  const grid = new Map(), cell = 8;
  for (const shape of shapes) {
    const reach = shape.hx === undefined ? shape.r : Math.hypot(shape.hx, shape.hz);
    for (let gx = Math.floor((shape.x - reach) / cell); gx <= Math.floor((shape.x + reach) / cell); gx++)
      for (let gz = Math.floor((shape.z - reach) / cell); gz <= Math.floor((shape.z + reach) / cell); gz++)
        (grid.get(`${gx},${gz}`) ?? grid.set(`${gx},${gz}`, []).get(`${gx},${gz}`)).push(shape);
  }
  const overlaps = new Map();
  for (const list of grid.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.object === b.object) continue;
    const gap = overlap(a, b);
    if (gap >= -0.15) continue;
    // La muralla y las vallas se montan con tramos que se tocan.
    if ((a.object.layer === b.object.layer && /muralla/.test(a.object.layer)) || (a.object.asset === b.object.asset && /fence/.test(a.object.asset))) continue;
    const key = [a.object.id, b.object.id].sort().join('|');
    if (!overlaps.has(key) || overlaps.get(key).gap > gap) overlaps.set(key, { a: a.object, b: b.object, gap });
  }
  // Calles: puntos del centro de cada casilla de calle y de su franja hacia cada salida.
  const roadPoints = [];
  // Casillas de calle con algo en su centro (pozo o puesto de una plaza): adorno intencionado, no cuentan.
  const decorated = new Set(map.objects.filter(o => !o.asset.startsWith('city/hex_') && !/lamppost|flag/.test(o.asset)).map(o => { const [q, r] = worldToHex(o.position[0], o.position[2]), [x, z] = hexToWorld(q, r); return Math.hypot(o.position[0] - x, o.position[2] - z) < 1 ? q + ',' + r : null; }).filter(Boolean));
  for (const object of map.objects) {
    if (!object.asset.startsWith('city/hex_road')) continue;
    if (decorated.has(worldToHex(object.position[0], object.position[2]).join(','))) continue;
    const m = tileRoadMask(object.asset, object.rotation[1]), [cx, cz] = [object.position[0], object.position[2]];
    roadPoints.push([cx, cz]);
    for (let i = 0; i < 6; i++) if (m & (1 << i)) {
      const [ex, ez] = hexToWorld(...DIRS[i]), len = Math.hypot(ex, ez);
      for (const t of [1.5, 3]) roadPoints.push([cx + ex / len * t, cz + ez / len * t]);
    }
  }
  const blockedRoads = new Map();
  for (const [x, z] of roadPoints) for (const shape of grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []) {
    const point = { x, z, r: ROAD_CLEARANCE };
    if (overlap(point, shape) < 0 && !(shape.topY !== undefined && shape.topY - field.heightAt(x, z) < 0.3)) blockedRoads.set(shape.object.id, shape.object);
  }
  // Pendiente bajo los edificios: diferencia de altura del terreno bajo su planta.
  const slopes = [];
  for (const object of map.objects) {
    if (!BUILDING.test(object.asset)) continue;
    const box = boxes.get(object.asset);
    if (!box) continue;
    const [x, , z] = object.position, s = object.scale[0], c = Math.cos(object.rotation[1]), sn = Math.sin(object.rotation[1]);
    const heights = [];
    for (const fx of [-1, 0, 1]) for (const fz of [-1, 0, 1]) {
      const lx = (fx < 0 ? box.min.x : fx > 0 ? box.max.x : 0) * s, lz = (fz < 0 ? box.min.z : fz > 0 ? box.max.z : 0) * s;
      heights.push(field.heightAt(x + lx * c + lz * sn, z - lx * sn + lz * c));
    }
    const base = object.conform ? field.heightAt(x, z) + object.position[1] : object.position[1];
    const sink = Math.max(...heights) - base, float = base - Math.min(...heights);
    if (sink > 0.5 || float > 0.6) slopes.push({ object, sink: +sink.toFixed(2), float: +float.toFixed(2) });
  }
  return { overlaps: [...overlaps.values()], blockedRoads: [...blockedRoads.values()], slopes, byId };
}

if (process.argv[1]?.endsWith('audit-map.mjs')) {
  const file = process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'src/data/maps/brumaluz.json';
  const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true } });
  try {
    const maps = await server.ssrLoadModule('/src/data/maps.ts');
    const runtime = await server.ssrLoadModule('/src/world/mapRuntime.ts');
    const map = JSON.parse(await readFile(file, 'utf8'));
    // Las mismas cajas de colisión que el juego (planta a ras de suelo).
    const boxes = await assetBoxes({ footprint: true, only: new Set(map.objects.map(object => object.asset)) });
    const report = await auditMap(map, { maps, runtime, boxes });
    const kind = o => `${o.id.startsWith('urbe_') ? 'nuevo' : 'casco'}:${o.asset.split('/').pop()}`;
    const tally = list => { const t = new Map(); for (const k of list) t.set(k, (t.get(k) ?? 0) + 1); return [...t].sort((a, b) => b[1] - a[1]); };
    console.log(`Solapes entre objetos sólidos: ${report.overlaps.length}`);
    for (const [k, n] of tally(report.overlaps.map(o => [kind(o.a), kind(o.b)].sort().join(' × '))).slice(0, 25)) console.log(`  ${n}× ${k}`);
    console.log(`Objetos que invaden una calle: ${report.blockedRoads.length}`);
    for (const [k, n] of tally(report.blockedRoads.map(kind)).slice(0, 20)) console.log(`  ${n}× ${k}`);
    console.log(`Edificios en mucha pendiente: ${report.slopes.length}`);
    for (const s of report.slopes.slice(0, 15)) console.log(`  ${kind(s.object)} ${s.object.name ?? ''} hundido ${s.sink} m, al aire ${s.float} m`);
    if (process.argv.includes('--list')) for (const o of report.overlaps) console.log(`  ${o.a.id} ${o.a.asset} × ${o.b.id} ${o.b.asset} (${o.gap.toFixed(2)} m) en ${o.a.position[0].toFixed(0)},${o.a.position[2].toFixed(0)}`);
  } finally { await server.close(); }
}

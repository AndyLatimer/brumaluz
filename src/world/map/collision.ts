// Colisiones del mapa: formas de los objetos, escaleras, agua y suelo.
import * as THREE from 'three';
import { type MapObject, type MapCollider, type MapDocument, type MapMarker, FALL_STEP } from '../../data/maps';
import type { TerrainField } from './terrain';

// ---------------------------------------------------------------------------
// Colisiones
// ---------------------------------------------------------------------------

export interface CollisionShape {
  x: number; z: number; r: number;
  hx?: number; hz?: number; cos?: number; sin?: number;
  /** Altura superior: por encima se puede pasar (saltos y plataformas). */
  topY?: number; bottomY?: number;
  source: 'object' | 'collider' | 'marker';
  sourceId: string;
}
/**
 * Superficie a la que se puede subir. Con `slope` es una rampa (la altura cambia `slope` m por metro hacia +Z local);
 * las que lo definen, aunque sea 0, son superficies explícitas (escaleras): cuentan desde el suelo hasta 2 m sobre él.
 */
export interface PlatformShape { x: number; z: number; y: number; hx: number; hz: number; cos: number; sin: number; sourceId: string; slope?: number }
export const CHARACTER_RADIUS = 0.45;
/**
 * Piezas de city.glb con escalera ante la puerta (medidas del modelo sin escalar, fachada hacia +Z): `blocks` son las
 * partes macizas (`top`: altura), `x` el ancho de la escalera, `door`–`landing` el rellano a altura `height` y
 * `landing`–`foot` los peldaños, que bajan hasta el suelo.
 */
export const STAIRS: Record<string, { blocks: { x: [number, number]; z: [number, number]; top: number }[]; x: [number, number]; door: number; landing: number; foot: number; height: number }> = {
  home_B: { blocks: [{ x: [-0.44, 0.44], z: [-0.54, 0.27], top: 1.28 }], x: [0, 0.25], door: 0.27, landing: 0.37, foot: 0.57, height: 0.21 },
  tavern: {
    blocks: [{ x: [-0.6, 0.58], z: [-0.71, 0.36], top: 1.4 }, { x: [0.22, 0.58], z: [0.36, 0.64], top: 0.3 }],
    x: [-0.25, -0.04], door: 0.36, landing: 0.42, foot: 0.64, height: 0.21,
  },
};
export const CITY_TREE_RADIUS: Record<string, number> = {
  tree_single_A: 0.34, tree_single_B: 0.38, trees_A_large: 0.72, trees_B_large: 0.72,
  trees_A_medium: 0.64, trees_B_medium: 0.64, trees_A_small: 0.52, trees_B_small: 0.52,
};
/** Formas de colisión automáticas o explícitas de un objeto, en coordenadas de mundo. */
export function objectCollision(object: MapObject, box: THREE.Box3 | undefined, field: TerrainField) {
  const shapes: CollisionShape[] = [], platforms: PlatformShape[] = [];
  if (object.hidden || object.collision === 'none') return { shapes, platforms };
  const [x, y, z] = object.position, [sx, sy, sz] = object.scale, ry = object.rotation[1];
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const name = object.asset.slice(object.asset.lastIndexOf('/') + 1);
  const city = object.asset.startsWith('city/');
  const baseY = object.conform ? field.heightAt(x, z) + y : y;
  const sourceId = object.id;
  if (!box || box.isEmpty()) {
    if (object.collision !== 'auto') shapes.push({ x, z, r: 0.5, source: 'object', sourceId });
    return { shapes, platforms };
  }
  const cx = (box.min.x + box.max.x) / 2 * sx, cz = (box.min.z + box.max.z) / 2 * sz;
  const hx = (box.max.x - box.min.x) / 2 * sx, hz = (box.max.z - box.min.z) / 2 * sz;
  const wx = x + cx * cos + cz * sin, wz = z - cx * sin + cz * cos;
  const topY = baseY + box.max.y * sy, bottomY = baseY + box.min.y * sy;
  const addBox = (ox: number, oz: number, bx: number, bz: number) => shapes.push({
    x: x + ox * cos + oz * sin, z: z - ox * sin + oz * cos, r: 0, hx: bx, hz: bz, cos, sin, topY, bottomY, source: 'object', sourceId,
  });
  if (object.collision === 'auto') {
    const stairs = city ? STAIRS[name] : undefined;
    if (stairs) {
      // Casas con escalera: el cuerpo bloquea; el rellano de la puerta y los peldaños (una rampa) se pueden pisar.
      const local = (lx: number, lz: number) => [x + lx * sx * cos + lz * sz * sin, z - lx * sx * sin + lz * sz * cos];
      for (const block of stairs.blocks) {
        const [bx, bz] = local((block.x[0] + block.x[1]) / 2, (block.z[0] + block.z[1]) / 2);
        shapes.push({ x: bx, z: bz, r: 0, hx: (block.x[1] - block.x[0]) / 2 * sx, hz: (block.z[1] - block.z[0]) / 2 * sz, cos, sin,
          topY: baseY + block.top * sy, bottomY, source: 'object', sourceId });
      }
      const [lx0, lx1] = stairs.x, [landing, foot] = [stairs.landing, stairs.foot];
      const [px, pz] = local((lx0 + lx1) / 2, (stairs.door + landing) / 2);
      platforms.push({ x: px, z: pz, y: baseY + stairs.height * sy, hx: (lx1 - lx0) / 2 * sx, hz: (landing - stairs.door) / 2 * sz, cos, sin, sourceId, slope: 0 });
      const [rx, rz] = local((lx0 + lx1) / 2, (landing + foot) / 2);
      platforms.push({ x: rx, z: rz, y: baseY + stairs.height / 2 * sy, hx: (lx1 - lx0) / 2 * sx, hz: (foot - landing) / 2 * sz, cos, sin, sourceId,
        slope: -stairs.height * sy / ((foot - landing) * sz) });
      return { shapes, platforms };
    }
    if (city && /^(hex_|cloud|flag|waterlily|waterplant)/.test(name)) {
      // El agua de las casillas ya no bloquea: se vadea o se nada (ver `waterAt`).
      return { shapes, platforms };
    }
    // Postes y faroles: finos a ras de suelo pero altos, se chocan como un poste (las plantas altas se atraviesan).
    if (Math.max(hx, hz) < 0.18 && topY - bottomY > 1.4 && !/flower|plant|grass|lily|wheat|reed/i.test(name)) {
      shapes.push({ x: wx, z: wz, r: Math.max(hx, hz, 0.1), topY, bottomY, source: 'object', sourceId });
      return { shapes, platforms };
    }
    if (Math.max(hx, hz) < 0.18 || topY - bottomY < 0.12) return { shapes, platforms };
    // Toldo abierto: solo sus cuatro postes; por debajo se pasa.
    if (city && name === 'tent') {
      for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const px = cx + ox * (hx - 0.03 * sx), pz = cz + oz * (hz - 0.03 * sz);
        shapes.push({ x: x + px * cos + pz * sin, z: z - px * sin + pz * cos, r: 0.03 * sx, topY, bottomY, source: 'object', sourceId });
      }
      return { shapes, platforms };
    }
    // Arbustos: se rodean (redondos), no se pisan.
    if (/^Bush_/i.test(name)) {
      shapes.push({ x: wx, z: wz, r: Math.max(hx, hz) * 0.8, topY, bottomY, source: 'object', sourceId });
      return { shapes, platforms };
    }
    if (city && (name.startsWith('trees_') || name.startsWith('tree_single_'))) {
      const radius = CITY_TREE_RADIUS[name] ?? (name.endsWith('_large') ? 0.72 : name.endsWith('_medium') ? 0.64 : 0.52);
      shapes.push({ x, z, r: radius * sx / 4, source: 'object', sourceId });
      return { shapes, platforms };
    }
    // Colinas: las de árboles y montañas ocupan casi toda su base hexagonal; las lomas sueltas son alargadas y bajan
    // suaves hacia los bordes.
    if (city && /^(hills_|mountain_)/.test(name)) {
      shapes.push({ x: wx, z: wz, r: Math.max(hx, hz) * 0.8, source: 'object', sourceId });
      return { shapes, platforms };
    }
    if (city && name.startsWith('hill_')) {
      addBox(cx, cz, hx * 0.72, hz * 0.72);
      return { shapes, platforms };
    }
    if (!city && /tree|pine|birch|oak/i.test(name) && !/stump|log|fallen/i.test(name)) {
      shapes.push({ x: wx, z: wz, r: THREE.MathUtils.clamp(Math.min(hx, hz) * 0.3, 0.25, 1.2), source: 'object', sourceId });
      return { shapes, platforms };
    }
    if (city && name === 'wall_straight_gate') {
      for (const side of [-1, 1]) addBox(cx + side * 0.75 * sx, cz, 0.25 * sx, hz);
      return { shapes, platforms };
    }
    addBox(cx, cz, hx + (city && name === 'wall_straight' ? 0.05 : 0), hz);
  } else if (object.collision === 'box') addBox(cx, cz, hx, hz);
  else shapes.push({ x: wx, z: wz, r: Math.max(hx, hz), topY, bottomY, source: 'object', sourceId });
  const rise = topY - field.heightAt(wx, wz);
  const walkable = object.walkable ?? (object.collision !== 'circle' && rise >= 0.3 && rise <= 1.2 && hx >= 0.3 && hz >= 0.3);
  if (walkable) platforms.push({ x: wx, z: wz, y: topY, hx, hz, cos, sin, sourceId });
  return { shapes, platforms };
}
export function colliderCollision(collider: MapCollider) {
  const [x, y, z] = collider.position, cos = Math.cos(collider.rotationY), sin = Math.sin(collider.rotationY);
  const topY = y + collider.size[1];
  const shape: CollisionShape = collider.shape === 'box'
    ? { x, z, r: 0, hx: collider.size[0] / 2, hz: collider.size[2] / 2, cos, sin, topY, bottomY: y, source: 'collider', sourceId: collider.id }
    : { x, z, r: collider.size[0] / 2, topY, bottomY: y, source: 'collider', sourceId: collider.id };
  const platform: PlatformShape | null = collider.walkable
    ? { x, z, y: topY, hx: collider.shape === 'box' ? collider.size[0] / 2 : collider.size[0] / 2 * 0.7, hz: collider.shape === 'box' ? collider.size[2] / 2 : collider.size[0] / 2 * 0.7, cos, sin, sourceId: collider.id }
    : null;
  return { shape, platform };
}
export class SpatialHash<T extends { x: number; z: number }> {
  private cells = new Map<string, T[]>();
  constructor(private size = 8) {}
  insert(item: T, radius: number) {
    const s = this.size;
    for (let gx = Math.floor((item.x - radius) / s); gx <= Math.floor((item.x + radius) / s); gx++) {
      for (let gz = Math.floor((item.z - radius) / s); gz <= Math.floor((item.z + radius) / s); gz++) {
        const key = `${gx},${gz}`;
        (this.cells.get(key) ?? this.cells.set(key, []).get(key)!).push(item);
      }
    }
  }
  query(x: number, z: number) { return this.cells.get(`${Math.floor(x / this.size)},${Math.floor(z / this.size)}`) ?? []; }
}
/** Agua en un punto: altura de la superficie y si cubre lo bastante para nadar (si no, se vadea). */
export interface WaterSample { surface: number; deep: boolean }
/** Profundidad (m) a partir de la cual se nada en vez de vadear. */
export const SWIM_DEPTH = 1.1;
/**
 * Piezas de city.glb con agua (medidas del modelo sin escalar): altura de la lámina y, en los ríos, la franja del
 * cauce a lo largo del eje X local. `deep`: las casillas de agua cubren; los ríos del pack son someros (se vadean).
 */
export const WATER_TILES: Record<string, { surface: number; channel?: [number, number]; deep: boolean }> = {
  hex_water: { surface: -0.2, deep: true },
  hex_river_A: { surface: -0.1, channel: [-0.42, 0.52], deep: false },
  hex_river_crossing_A: { surface: -0.1, channel: [-0.42, 0.52], deep: false },
};
export interface MapCollision {
  shapes: CollisionShape[];
  platforms: PlatformShape[];
  collide(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3;
  groundY(x: number, z: number): number;
  platformY(x: number, z: number): number | null;
  blocked(x: number, z: number): boolean;
  /** Agua en un punto (casillas de agua o río, o la lámina general del mapa), o null en seco. */
  waterAt(x: number, z: number): WaterSample | null;
}
export function buildCollision(
  doc: Pick<MapDocument, 'objects' | 'colliders' | 'markers' | 'layers' | 'settings'>,
  field: TerrainField,
  boxes: ReadonlyMap<string, THREE.Box3>,
): MapCollision {
  const shapes: CollisionShape[] = [], platforms: PlatformShape[] = [];
  const hiddenLayers = new Set(doc.layers.filter(layer => !layer.visible).map(layer => layer.id));
  for (const object of doc.objects) {
    if (hiddenLayers.has(object.layer)) continue;
    const result = objectCollision(object, boxes.get(object.asset), field);
    shapes.push(...result.shapes); platforms.push(...result.platforms);
  }
  for (const collider of doc.colliders) {
    if (hiddenLayers.has(collider.layer)) continue;
    const { shape, platform } = colliderCollision(collider);
    shapes.push(shape);
    if (platform) platforms.push(platform);
  }
  for (const marker of doc.markers as MapMarker[]) {
    if (marker.type === 'npc' && !hiddenLayers.has(marker.layer)) shapes.push({ x: marker.position[0], z: marker.position[2], r: 0.5, source: 'marker', sourceId: marker.id });
  }
  const ME = CHARACTER_RADIUS;
  const shapeHash = new SpatialHash<CollisionShape>(), platformHash = new SpatialHash<PlatformShape>();
  for (const shape of shapes) shapeHash.insert(shape, (shape.hx === undefined ? shape.r : Math.hypot(shape.hx, shape.hz!)) + ME + 0.3);
  for (const platform of platforms) platformHash.insert(platform, Math.hypot(platform.hx, platform.hz));
  const water = doc.settings.water;
  const bounded = doc.settings.bounded;
  const groundY = (x: number, z: number) => field.heightAt(x, z);
  // El agua ya no es un muro: solo bloquean los límites del mapa.
  const blocked = (x: number, z: number) => bounded && !field.contains(x, z, 0.5);
  const waterTiles: { x: number; z: number; cos: number; sin: number; sx: number; sy: number; sz: number; y: number; conform: boolean; spec: typeof WATER_TILES[string] }[] = [];
  for (const object of doc.objects) {
    const spec = object.asset.startsWith('city/') ? WATER_TILES[object.asset.slice(5)] : undefined;
    if (!spec || object.hidden || hiddenLayers.has(object.layer)) continue;
    const [sx, sy, sz] = object.scale;
    waterTiles.push({ x: object.position[0], z: object.position[2], cos: Math.cos(object.rotation[1]), sin: Math.sin(object.rotation[1]), sx, sy, sz, y: object.position[1], conform: !!object.conform, spec });
  }
  const waterHash = new SpatialHash<typeof waterTiles[number]>();
  for (const tile of waterTiles) waterHash.insert(tile, 1.2 * Math.max(tile.sx, tile.sz));
  const waterAt = (x: number, z: number): WaterSample | null => {
    for (const tile of waterHash.query(x, z)) {
      const dx = x - tile.x, dz = z - tile.z;
      const lx = (dx * tile.cos - dz * tile.sin) / tile.sx, lz = (dx * tile.sin + dz * tile.cos) / tile.sz;
      // Hexágono de la casilla: apotema 1 en unidades del modelo, con lados perpendiculares a 0°, 60° y 120°.
      if (Math.abs(lx) > 1 || Math.abs(lx * 0.5 + lz * 0.866) > 1 || Math.abs(lx * 0.5 - lz * 0.866) > 1) continue;
      const channel = tile.spec.channel;
      if (channel && (lz < channel[0] || lz > channel[1])) continue;
      const base = tile.conform ? field.heightAt(x, z) + tile.y : tile.y;
      return { surface: base + tile.spec.surface * tile.sy, deep: tile.spec.deep };
    }
    // Agua pintada en el editor (lagos, ríos): la más alta entre ella y la lámina general.
    const painted = field.waterAt(x, z);
    const ground = field.heightAt(x, z);
    const level = Math.max(painted ?? -Infinity, water.enabled ? water.level : -Infinity);
    if (level > ground) return { surface: level, deep: level - ground >= SWIM_DEPTH };
    return null;
  };
  const pushOut = (out: THREE.Vector3, c: CollisionShape, from: THREE.Vector3) => {
    const dx = out.x - c.x, dz = out.z - c.z;
    if (c.hx === undefined || c.hz === undefined || c.cos === undefined || c.sin === undefined) {
      const d = Math.hypot(dx, dz), min = c.r + ME;
      if (d >= min) return;
      let nx = dx, nz = dz;
      if (d <= 1e-4) {
        nx = from.x - c.x; nz = from.z - c.z;
        if (Math.hypot(nx, nz) <= 1e-4) { nx = from.x - out.x; nz = from.z - out.z; }
        if (Math.hypot(nx, nz) <= 1e-4) { nx = 1; nz = 0; }
      }
      const length = Math.hypot(nx, nz);
      out.x = c.x + (nx / length) * min; out.z = c.z + (nz / length) * min;
      return;
    }
    const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
    const nx = THREE.MathUtils.clamp(lx, -c.hx, c.hx), nz = THREE.MathUtils.clamp(lz, -c.hz, c.hz);
    const ox = lx - nx, oz = lz - nz;
    let px: number, pz: number;
    const d = Math.hypot(ox, oz);
    if (d > 1e-4) {
      if (d >= ME) return;
      px = nx + (ox / d) * ME; pz = nz + (oz / d) * ME;
    } else {
      const gx = c.hx - Math.abs(lx), gz = c.hz - Math.abs(lz);
      const fromDx = (from.x - c.x) * c.cos - (from.z - c.z) * c.sin;
      const fromDz = (from.x - c.x) * c.sin + (from.z - c.z) * c.cos;
      const signX = Math.sign(lx || fromDx || 1), signZ = Math.sign(lz || fromDz || 1);
      if (gx < gz) { px = signX * (c.hx + ME); pz = lz; } else { px = lx; pz = signZ * (c.hz + ME); }
    }
    out.x = c.x + px * c.cos + pz * c.sin;
    out.z = c.z - px * c.sin + pz * c.cos;
  };
  const platformY = (x: number, z: number) => {
    const floor = groundY(x, z);
    let top: number | null = null;
    for (const platform of platformHash.query(x, z)) {
      const dx = x - platform.x, dz = z - platform.z;
      const lx = dx * platform.cos - dz * platform.sin, lz = dx * platform.sin + dz * platform.cos;
      if (Math.abs(lx) > platform.hx || Math.abs(lz) > platform.hz) continue;
      const y = platform.y + (platform.slope ?? 0) * lz;
      // Las superficies explícitas (escaleras) cuentan desde el suelo, para que el pie de una rampa enlace con él.
      const explicit = platform.slope !== undefined;
      if (y <= floor + (explicit ? 0.01 : 0.2) || y > floor + (explicit ? 2 : 1.2) || (top !== null && y <= top)) continue;
      top = y;
    }
    return top;
  };
  const collide = (from: THREE.Vector3, to: THREE.Vector3) => {
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.max(1, Math.ceil(distance / 0.2));
    const out = from.clone();
    // Nadando, lo que cuenta es la superficie del agua: el fondo puede tener desniveles.
    const support = (x: number, z: number) => { const w = waterAt(x, z); return w?.deep ? Math.max(groundY(x, z), w.surface - SWIM_DEPTH) : groundY(x, z); };
    // Al agua profunda uno se puede tirar desde cualquier altura, y desde ella se sale trepando a una orilla de
    // hasta 1,7 m sobre la superficie; en tierra, solo escalones de 0,55 m.
    const legal = (x: number, z: number, previous: THREE.Vector3) => {
      if (blocked(x, z)) return false;
      // Una cascada se baja (de un salto o dejándose caer), pero no se remonta: no se entra en un agua cuya superficie
      // queda muy por encima de donde se está (otra agua más baja o el suelo al pie del salto).
      const toWater = waterAt(x, z);
      if (toWater && toWater.surface - (waterAt(previous.x, previous.z)?.surface ?? groundY(previous.x, previous.z)) > FALL_STEP) return false;
      const rise = support(x, z) - support(previous.x, previous.z);
      if (rise <= 0 && waterAt(x, z)?.deep) return true;
      const from = waterAt(previous.x, previous.z);
      if (from?.deep && rise > 0) return groundY(x, z) - from.surface <= 1.7;
      return Math.abs(rise) <= 0.55;
    };
    for (let step = 1; step <= steps; step++) {
      const previous = out.clone();
      const candidate = from.clone().lerp(to, step / steps);
      if (!legal(candidate.x, candidate.z, previous)) {
        const canX = legal(candidate.x, previous.z, previous), canZ = legal(previous.x, candidate.z, previous);
        if (canX && canZ) {
          if (Math.abs(candidate.x - previous.x) >= Math.abs(candidate.z - previous.z)) candidate.z = previous.z; else candidate.x = previous.x;
        } else if (canX) candidate.z = previous.z;
        else if (canZ) candidate.x = previous.x;
        else { candidate.x = previous.x; candidate.z = previous.z; }
      }
      for (let iteration = 0; iteration < 6; iteration++) {
        const bx = candidate.x, bz = candidate.z;
        for (const c of shapeHash.query(candidate.x, candidate.z)) {
          const feet = Math.min(previous.y, candidate.y);
          if (c.topY !== undefined && feet >= c.topY - 0.08) continue;
          if (c.bottomY !== undefined && feet + 1.6 <= c.bottomY) continue;
          pushOut(candidate, c, previous);
        }
        if (Math.hypot(candidate.x - bx, candidate.z - bz) < 1e-4) break;
      }
      if (!legal(candidate.x, candidate.z, previous)) { candidate.x = previous.x; candidate.z = previous.z; }
      out.copy(candidate);
    }
    return out;
  };
  return { shapes, platforms, collide, groundY, platformY, blocked, waterAt };
}

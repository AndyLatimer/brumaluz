// Formato de los mapas del editor visual. Es independiente de Three.js para
// poder validarlo tanto en el navegador como en el servidor de desarrollo.

export const MAP_FORMAT = 1;
export const MAP_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const MAX_MAP_BYTES = 48_000_000;
export const MAX_TERRAIN_VERTICES = 1_100_000;
export const MAP_LIMITS = { objects: 30_000, colliders: 6_000, markers: 3_000, layers: 64 } as const;

export type Vec3 = [number, number, number];

export const GROUND_MATERIALS = [
  { id: 'grass', label: 'Hierba', color: '#8aca78' },
  { id: 'meadow', label: 'Pradera', color: '#a9c96a' },
  { id: 'forest', label: 'Bosque', color: '#5f8f4e' },
  { id: 'dirt', label: 'Tierra', color: '#a07b52' },
  { id: 'path', label: 'Camino', color: '#c9a76f' },
  { id: 'farmland', label: 'Labranza', color: '#7d5b3b' },
  { id: 'stone', label: 'Piedra', color: '#9c9a8f' },
  { id: 'cobble', label: 'Empedrado', color: '#7f7d78' },
  { id: 'sand', label: 'Arena', color: '#e0cf95' },
  { id: 'mud', label: 'Barro', color: '#6b5642' },
  { id: 'snow', label: 'Nieve', color: '#eef2f2' },
  { id: 'ash', label: 'Ceniza', color: '#5c5a5f' },
] as const;

export const SKY_PRESETS = ['day', 'sunset', 'dusk', 'night', 'overcast'] as const;
export type SkyPreset = typeof SKY_PRESETS[number];
export const COLLISION_MODES = ['auto', 'none', 'box', 'circle'] as const;
export type CollisionMode = typeof COLLISION_MODES[number];
export const MARKER_TYPES = ['spawn', 'npc', 'interaction', 'zone', 'light', 'note', 'portal', 'arrival'] as const;
export type MarkerType = typeof MARKER_TYPES[number];
/** Qué representa el mapa dentro de Pompelín; decide el texto de la pantalla de carga. */
export const MAP_KINDS = ['world', 'city', 'zone', 'interior'] as const;
export type MapKind = typeof MAP_KINDS[number];
export const MAP_KIND_LABELS: Record<MapKind, string> = { world: 'Mundo', city: 'Ciudad', zone: 'Zona exterior', interior: 'Interior' };
/** `walk`: viaja al pisar la zona. `interact`: hay que pulsar E y confirmar. */
export const PORTAL_TRIGGERS = ['walk', 'interact'] as const;
export type PortalTrigger = typeof PORTAL_TRIGGERS[number];
export interface PortalTarget { map: string; arrival?: string }

export interface MapLayer { id: string; name: string; visible: boolean; locked: boolean }

export interface MapObject {
  id: string;
  /** `city/<pieza>`, `builtin/<pieza>` o un ID de la biblioteca (`pack/objects/nombre`). */
  asset: string;
  name?: string;
  layer: string;
  position: Vec3;
  /** Radianes, orden YXZ. */
  rotation: Vec3;
  scale: Vec3;
  collision: CollisionMode;
  /** Plataforma sobre la que se puede subir. Sin valor: decide el motor según su altura. */
  walkable?: boolean;
  /** Se deforma con el terreno; `position[1]` pasa a ser un desplazamiento sobre él. */
  conform?: boolean;
  tint?: string;
  locked?: boolean;
  hidden?: boolean;
}

export interface MapCollider {
  id: string;
  name?: string;
  layer: string;
  shape: 'box' | 'cylinder';
  /** Centro de la base. */
  position: Vec3;
  rotationY: number;
  /** Ancho, alto y fondo. En cilindros el diámetro es `size[0]`. */
  size: Vec3;
  walkable: boolean;
}

export interface MapMarker {
  id: string;
  type: MarkerType;
  name: string;
  layer: string;
  position: Vec3;
  rotationY: number;
  radius: number;
  npcId?: string;
  text?: string;
  color?: string;
  /** Solo portales: mapa y punto de llegada de destino. */
  target?: PortalTarget;
  trigger?: PortalTrigger;
}

export interface MapSettings {
  sky: SkyPreset;
  /** 0 = sin niebla, 1 = muy densa. */
  fog: number;
  water: { enabled: boolean; level: number; color: string; opacity: number };
  clouds: boolean;
  /** Impide salir de los límites del terreno al pasear. */
  bounded: boolean;
  kind?: MapKind;
  /** Región de Pompelín que se muestra al cargar (p. ej. «Pompelín central»). */
  region?: string;
  /** Consejo de la pantalla de carga. */
  loadingTip?: string;
}

export interface MapTerrain {
  /** Vértices por fila y columna. */
  columns: number;
  rows: number;
  /** Metros entre vértices. */
  cell: number;
  /** Esquina mínima (x, z) del terreno. */
  origin: [number, number];
  /** Int16 little-endian en centímetros, base64. */
  heights: string;
  /** Uint8 con el índice de GROUND_MATERIALS, base64. */
  paint: string;
  /** Uint8 con la densidad de hierba (0-255), base64. */
  grass: string;
}

export interface MapDocument {
  format: typeof MAP_FORMAT;
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  settings: MapSettings;
  terrain: MapTerrain;
  layers: MapLayer[];
  objects: MapObject[];
  colliders: MapCollider[];
  markers: MapMarker[];
  /** Miniatura JPEG en data URL. */
  preview?: string;
}

export interface MapSummary {
  id: string; name: string; description: string; updatedAt: string; objects: number; size: [number, number]; preview?: string; revision: string;
  kind: MapKind;
  region?: string;
  portals: { id: string; name: string; target?: PortalTarget }[];
  arrivals: { id: string; name: string }[];
}

export interface TerrainData {
  columns: number; rows: number; cell: number; origin: [number, number];
  heights: Float32Array; paint: Uint8Array; grass: Uint8Array;
}

export class MapValidationError extends Error {}
const fail = (path: string, message: string): never => { throw new MapValidationError(`${path}: ${message}`); };
const record = (value: unknown, path: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'debe ser un objeto');
  return value as Record<string, unknown>;
};
const text = (value: unknown, path: string, max: number, required = true) => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') return fail(path, 'debe ser texto');
  if (value.length > max) fail(path, `admite como máximo ${max} caracteres`);
  if (required && !value.trim()) fail(path, 'no puede estar vacío');
  return value;
};
const num = (value: unknown, path: string, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(path, 'debe ser un número');
  if (value < min || value > max) fail(path, `debe estar entre ${min} y ${max}`);
  return value;
};
const int = (value: unknown, path: string, min: number, max: number) => {
  const result = num(value, path, min, max);
  if (!Number.isInteger(result)) fail(path, 'debe ser entero');
  return result;
};
const bool = (value: unknown, path: string, optional = false) => {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'boolean') return fail(path, 'debe ser verdadero o falso');
  return value;
};
const vec3 = (value: unknown, path: string, min: number, max: number): Vec3 => {
  if (!Array.isArray(value) || value.length !== 3) return fail(path, 'debe tener tres números');
  return value.map((item, index) => num(item, `${path}[${index}]`, min, max)) as Vec3;
};
const color = (value: unknown, path: string, optional = false) => {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return fail(path, 'debe ser un color #rrggbb');
  return value.toLowerCase();
};
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const identifier = (value: unknown, path: string) => {
  if (typeof value !== 'string' || !ID.test(value)) return fail(path, 'ID no válido');
  return value;
};
export const ASSET_ID = /^(?:(?:city|builtin)\/[A-Za-z0-9_-]{1,80}|[a-z0-9-]{1,40}\/(?:objects|characters)\/[A-Za-z0-9_.-]{1,100})$/;
const isoDate = (value: unknown, path: string) => {
  const result = text(value, path, 40)!;
  if (Number.isNaN(Date.parse(result))) fail(path, 'fecha no válida');
  return result;
};
const list = (value: unknown, path: string, max: number) => {
  if (!Array.isArray(value)) return fail(path, 'debe ser una lista');
  if (value.length > max) fail(path, `admite como máximo ${max} elementos`);
  return value as unknown[];
};

export function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
export function bytesBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
const base64Length = (bytes: number) => Math.ceil(bytes / 3) * 4;

function validateTerrain(value: unknown): MapTerrain {
  const terrain = record(value, 'terrain');
  const columns = int(terrain.columns, 'terrain.columns', 2, 2049);
  const rows = int(terrain.rows, 'terrain.rows', 2, 2049);
  if (columns * rows > MAX_TERRAIN_VERTICES) fail('terrain', `admite como máximo ${MAX_TERRAIN_VERTICES} vértices`);
  const cell = num(terrain.cell, 'terrain.cell', 0.25, 16);
  if (!Array.isArray(terrain.origin) || terrain.origin.length !== 2) fail('terrain.origin', 'debe tener dos números');
  const origin = (terrain.origin as unknown[]).map((item, index) => num(item, `terrain.origin[${index}]`, -100_000, 100_000)) as [number, number];
  const count = columns * rows;
  const encoded = (key: 'heights' | 'paint' | 'grass', bytes: number) => {
    const result = terrain[key];
    if (typeof result !== 'string' || result.length !== base64Length(bytes) || !/^[A-Za-z0-9+/]*={0,2}$/.test(result)) {
      return fail(`terrain.${key}`, `debe contener ${bytes} bytes en base64`);
    }
    return result;
  };
  const heights = encoded('heights', count * 2), paint = encoded('paint', count), grass = encoded('grass', count);
  const paintBytes = base64Bytes(paint);
  if (paintBytes.length !== count) fail('terrain.paint', 'tamaño incorrecto');
  if (paintBytes.some(index => index >= GROUND_MATERIALS.length)) fail('terrain.paint', 'contiene materiales desconocidos');
  if (base64Bytes(heights).length !== count * 2 || base64Bytes(grass).length !== count) fail('terrain', 'tamaño de datos incorrecto');
  return { columns, rows, cell, origin, heights, paint, grass };
}

export function validateMap(value: unknown): MapDocument {
  const map = record(value, 'mapa');
  if (map.format !== MAP_FORMAT) fail('format', `debe ser ${MAP_FORMAT}`);
  if (typeof map.id !== 'string' || !MAP_ID.test(map.id)) fail('id', 'usa minúsculas, números, guiones o guiones bajos (máx. 64)');
  const settingsValue = record(map.settings, 'settings');
  if (!SKY_PRESETS.includes(settingsValue.sky as SkyPreset)) fail('settings.sky', 'cielo desconocido');
  const water = record(settingsValue.water, 'settings.water');
  const settings: MapSettings = {
    sky: settingsValue.sky as SkyPreset,
    fog: num(settingsValue.fog, 'settings.fog', 0, 1),
    water: {
      enabled: bool(water.enabled, 'settings.water.enabled')!,
      level: num(water.level, 'settings.water.level', -1000, 1000),
      color: color(water.color, 'settings.water.color')!,
      opacity: num(water.opacity, 'settings.water.opacity', 0.05, 1),
    },
    clouds: bool(settingsValue.clouds, 'settings.clouds')!,
    bounded: bool(settingsValue.bounded, 'settings.bounded')!,
  };
  if (settingsValue.kind !== undefined) {
    if (!MAP_KINDS.includes(settingsValue.kind as MapKind)) fail('settings.kind', 'tipo de mapa desconocido');
    settings.kind = settingsValue.kind as MapKind;
  }
  const region = text(settingsValue.region, 'settings.region', 80, false)?.trim(); if (region) settings.region = region;
  const tip = text(settingsValue.loadingTip, 'settings.loadingTip', 300, false)?.trim(); if (tip) settings.loadingTip = tip;
  const layers = list(map.layers, 'layers', MAP_LIMITS.layers).map((item, index) => {
    const layer = record(item, `layers[${index}]`);
    return {
      id: identifier(layer.id, `layers[${index}].id`), name: text(layer.name, `layers[${index}].name`, 80)!,
      visible: bool(layer.visible, `layers[${index}].visible`)!, locked: bool(layer.locked, `layers[${index}].locked`)!,
    };
  });
  if (!layers.length) fail('layers', 'debe haber al menos una capa');
  const layerIds = new Set<string>();
  for (const layer of layers) { if (layerIds.has(layer.id)) fail('layers', `capa repetida: ${layer.id}`); layerIds.add(layer.id); }
  const used = new Set<string>();
  const unique = (id: string, path: string) => { if (used.has(id)) fail(path, `ID repetido: ${id}`); used.add(id); return id; };
  const layerOf = (value: unknown, path: string) => {
    const id = identifier(value, path);
    if (!layerIds.has(id)) fail(path, `capa desconocida: ${id}`);
    return id;
  };
  const LIMIT = 100_000;
  const objects = list(map.objects, 'objects', MAP_LIMITS.objects).map((item, index): MapObject => {
    const path = `objects[${index}]`, object = record(item, path);
    if (typeof object.asset !== 'string' || !ASSET_ID.test(object.asset)) fail(`${path}.asset`, 'recurso no válido');
    if (!COLLISION_MODES.includes(object.collision as CollisionMode)) fail(`${path}.collision`, 'modo desconocido');
    const result: MapObject = {
      id: unique(identifier(object.id, `${path}.id`), `${path}.id`),
      asset: object.asset as string,
      layer: layerOf(object.layer, `${path}.layer`),
      position: vec3(object.position, `${path}.position`, -LIMIT, LIMIT),
      rotation: vec3(object.rotation, `${path}.rotation`, -1000, 1000),
      scale: vec3(object.scale, `${path}.scale`, 0.001, 1000),
      collision: object.collision as CollisionMode,
    };
    const name = text(object.name, `${path}.name`, 120, false); if (name) result.name = name;
    const walkable = bool(object.walkable, `${path}.walkable`, true); if (walkable !== undefined) result.walkable = walkable;
    if (bool(object.conform, `${path}.conform`, true)) result.conform = true;
    const tint = color(object.tint, `${path}.tint`, true); if (tint) result.tint = tint;
    if (bool(object.locked, `${path}.locked`, true)) result.locked = true;
    if (bool(object.hidden, `${path}.hidden`, true)) result.hidden = true;
    return result;
  });
  const colliders = list(map.colliders, 'colliders', MAP_LIMITS.colliders).map((item, index): MapCollider => {
    const path = `colliders[${index}]`, collider = record(item, path);
    if (collider.shape !== 'box' && collider.shape !== 'cylinder') fail(`${path}.shape`, 'forma desconocida');
    const result: MapCollider = {
      id: unique(identifier(collider.id, `${path}.id`), `${path}.id`),
      layer: layerOf(collider.layer, `${path}.layer`),
      shape: collider.shape as MapCollider['shape'],
      position: vec3(collider.position, `${path}.position`, -LIMIT, LIMIT),
      rotationY: num(collider.rotationY, `${path}.rotationY`, -1000, 1000),
      size: vec3(collider.size, `${path}.size`, 0.05, 1000),
      walkable: bool(collider.walkable, `${path}.walkable`)!,
    };
    const name = text(collider.name, `${path}.name`, 120, false); if (name) result.name = name;
    return result;
  });
  const markers = list(map.markers, 'markers', MAP_LIMITS.markers).map((item, index): MapMarker => {
    const path = `markers[${index}]`, marker = record(item, path);
    if (!MARKER_TYPES.includes(marker.type as MarkerType)) fail(`${path}.type`, 'tipo desconocido');
    const result: MapMarker = {
      id: unique(identifier(marker.id, `${path}.id`), `${path}.id`),
      type: marker.type as MarkerType,
      name: text(marker.name, `${path}.name`, 120)!,
      layer: layerOf(marker.layer, `${path}.layer`),
      position: vec3(marker.position, `${path}.position`, -LIMIT, LIMIT),
      rotationY: num(marker.rotationY, `${path}.rotationY`, -1000, 1000),
      radius: num(marker.radius, `${path}.radius`, 0, 1000),
    };
    if (marker.npcId !== undefined && marker.npcId !== '') {
      if (typeof marker.npcId !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(marker.npcId)) fail(`${path}.npcId`, 'ID de NPC no válido');
      result.npcId = marker.npcId as string;
    }
    const note = text(marker.text, `${path}.text`, 4000, false); if (note) result.text = note;
    const tint = color(marker.color, `${path}.color`, true); if (tint) result.color = tint;
    if (result.type === 'portal') {
      if (marker.target !== undefined && marker.target !== null) {
        const target = record(marker.target, `${path}.target`);
        if (typeof target.map !== 'string' || !MAP_ID.test(target.map)) fail(`${path}.target.map`, 'ID de mapa no válido');
        result.target = { map: target.map as string };
        if (target.arrival !== undefined && target.arrival !== '') result.target.arrival = identifier(target.arrival, `${path}.target.arrival`);
      }
      if (marker.trigger !== undefined) {
        if (!PORTAL_TRIGGERS.includes(marker.trigger as PortalTrigger)) fail(`${path}.trigger`, 'activación desconocida');
        result.trigger = marker.trigger as PortalTrigger;
      }
    }
    return result;
  });
  const result: MapDocument = {
    format: MAP_FORMAT,
    id: map.id as string,
    name: text(map.name, 'name', 120)!,
    description: text(map.description, 'description', 4000, false) ?? '',
    createdAt: isoDate(map.createdAt, 'createdAt'),
    updatedAt: isoDate(map.updatedAt, 'updatedAt'),
    settings,
    terrain: validateTerrain(map.terrain),
    layers, objects, colliders, markers,
  };
  if (map.preview !== undefined) {
    if (typeof map.preview !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(map.preview) || map.preview.length > 400_000) {
      fail('preview', 'miniatura no válida (máx. 400 KB)');
    }
    result.preview = map.preview as string;
  }
  return result;
}

export function decodeTerrain(terrain: MapTerrain): TerrainData {
  const count = terrain.columns * terrain.rows;
  const raw = base64Bytes(terrain.heights);
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const heights = new Float32Array(count);
  for (let i = 0; i < count; i++) heights[i] = view.getInt16(i * 2, true) / 100;
  return {
    columns: terrain.columns, rows: terrain.rows, cell: terrain.cell, origin: [...terrain.origin],
    heights, paint: base64Bytes(terrain.paint), grass: base64Bytes(terrain.grass),
  };
}

export function encodeTerrain(data: TerrainData): MapTerrain {
  const count = data.columns * data.rows;
  const raw = new Uint8Array(count * 2);
  const view = new DataView(raw.buffer);
  for (let i = 0; i < count; i++) view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(data.heights[i] * 100))), true);
  return {
    columns: data.columns, rows: data.rows, cell: data.cell, origin: [...data.origin],
    heights: bytesBase64(raw), paint: bytesBase64(data.paint), grass: bytesBase64(data.grass),
  };
}

export function createTerrain(width: number, depth: number, cell: number, height = 0, paint = 0, grass = 0): TerrainData {
  const columns = Math.max(2, Math.round(width / cell) + 1), rows = Math.max(2, Math.round(depth / cell) + 1);
  const count = columns * rows;
  return {
    columns, rows, cell,
    origin: [-((columns - 1) * cell) / 2, -((rows - 1) * cell) / 2],
    heights: new Float32Array(count).fill(height), paint: new Uint8Array(count).fill(paint), grass: new Uint8Array(count).fill(grass),
  };
}

/** Remuestrea el terreno a otro tamaño o resolución manteniendo el centro. */
export function resampleTerrain(source: TerrainData, width: number, depth: number, cell: number): TerrainData {
  const target = createTerrain(width, depth, cell);
  const centerX = source.origin[0] + ((source.columns - 1) * source.cell) / 2;
  const centerZ = source.origin[1] + ((source.rows - 1) * source.cell) / 2;
  target.origin = [centerX - ((target.columns - 1) * cell) / 2, centerZ - ((target.rows - 1) * cell) / 2];
  for (let j = 0; j < target.rows; j++) for (let i = 0; i < target.columns; i++) {
    const x = target.origin[0] + i * cell, z = target.origin[1] + j * cell;
    const fx = Math.max(0, Math.min(source.columns - 1, (x - source.origin[0]) / source.cell));
    const fz = Math.max(0, Math.min(source.rows - 1, (z - source.origin[1]) / source.cell));
    const index = j * target.columns + i;
    target.heights[index] = sampleHeight(source, fx, fz);
    const nearest = Math.round(fz) * source.columns + Math.round(fx);
    target.paint[index] = source.paint[nearest];
    target.grass[index] = source.grass[nearest];
  }
  return target;
}

/** Altura bilineal en coordenadas de rejilla (columna, fila). */
export function sampleHeight(data: TerrainData, fx: number, fz: number) {
  const i0 = Math.max(0, Math.min(data.columns - 2, Math.floor(fx))), j0 = Math.max(0, Math.min(data.rows - 2, Math.floor(fz)));
  const tx = Math.max(0, Math.min(1, fx - i0)), tz = Math.max(0, Math.min(1, fz - j0));
  const a = data.heights[j0 * data.columns + i0], b = data.heights[j0 * data.columns + i0 + 1];
  const c = data.heights[(j0 + 1) * data.columns + i0], d = data.heights[(j0 + 1) * data.columns + i0 + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

export const DEFAULT_LAYERS: MapLayer[] = [
  { id: 'suelo', name: 'Suelo y casillas', visible: true, locked: false },
  { id: 'edificios', name: 'Edificios', visible: true, locked: false },
  { id: 'naturaleza', name: 'Naturaleza', visible: true, locked: false },
  { id: 'atrezo', name: 'Atrezo', visible: true, locked: false },
  { id: 'logica', name: 'Lógica y marcadores', visible: true, locked: false },
];

export function newMap(id: string, name: string, options: { width?: number; depth?: number; cell?: number; height?: number; paint?: number; grass?: number } = {}): MapDocument {
  const now = new Date().toISOString();
  const terrain = createTerrain(options.width ?? 128, options.depth ?? 128, options.cell ?? 1, options.height ?? 0, options.paint ?? 0, options.grass ?? 110);
  return {
    format: MAP_FORMAT, id, name, description: '', createdAt: now, updatedAt: now,
    settings: { sky: 'sunset', fog: 0.35, water: { enabled: false, level: -0.6, color: '#4f8fb0', opacity: 0.82 }, clouds: true, bounded: true },
    terrain: encodeTerrain(terrain),
    layers: DEFAULT_LAYERS.map(layer => ({ ...layer })),
    objects: [], colliders: [],
    markers: [{ id: 'spawn', type: 'spawn', name: 'Aparición', layer: 'logica', position: [0, 0, 0], rotationY: 0, radius: 1 }],
  };
}

export function mapSummary(map: MapDocument, revision: string): MapSummary {
  const visible = new Set(map.layers.filter(layer => layer.visible).map(layer => layer.id));
  return {
    id: map.id, name: map.name, description: map.description, updatedAt: map.updatedAt, objects: map.objects.length,
    size: [(map.terrain.columns - 1) * map.terrain.cell, (map.terrain.rows - 1) * map.terrain.cell], preview: map.preview, revision,
    kind: mapKind(map), region: map.settings.region,
    portals: map.markers.filter(marker => marker.type === 'portal' && visible.has(marker.layer))
      .map(marker => ({ id: marker.id, name: marker.name, ...(marker.target ? { target: { ...marker.target } } : {}) })),
    arrivals: map.markers.filter(marker => marker.type === 'arrival' && visible.has(marker.layer)).map(marker => ({ id: marker.id, name: marker.name })),
  };
}

export const mapKind = (map: Pick<MapDocument, 'settings'>): MapKind => map.settings.kind ?? 'zone';
export const portalTrigger = (marker: MapMarker): PortalTrigger => marker.trigger ?? 'walk';

/** Una llegada nombrada nunca se sustituye por otra silenciosamente. */
export function arrivalPoint(map: Pick<MapDocument, 'markers'>, arrival?: string) {
  if (arrival) return map.markers.find(marker => marker.type === 'arrival' && marker.id === arrival);
  return map.markers.find(marker => marker.type === 'spawn')
    ?? map.markers.find(marker => marker.type === 'arrival');
}

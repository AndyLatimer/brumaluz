import * as THREE from 'three';
import { WaterLayer } from '../../world/water';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  decodeTerrain, MAP_LIMITS, newMap,
  type MapCollider, type MapDocument, type MapMarker, type MapObject, type TerrainData,
} from '../../data/maps';
import {
  GrassField, MapEnvironment, MaterialVariants, ObjectLayer, TerrainField, TerrainSurface, buildCollision,
  type MapAssetProvider, type MapCollision,
} from '../../world/mapRuntime';
import { collisionBox, loadMapAssetTemplate, type MapAssetInfo } from '../../world/mapAssets';
import { CollisionOverlay, ColliderLayer, MarkerLayer } from './overlays';
import { History, type SceneState } from './history';
import { ResourceLayer } from '../../world/resourceLayer';

// Estado compartido del editor: escena, documento, índices, selección e historial.

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: (Node | string | null | undefined | false)[]) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value as EventListener);
    else if (typeof value !== 'string' && key in node) (node as unknown as Record<string, unknown>)[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}

export const viewport = $('viewport');
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;
viewport.prepend(renderer.domElement);
export const labels = el('div', { class: 'labels' });
viewport.append(labels);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
camera.position.set(40, 45, 60);
export const controls = new OrbitControls(camera, renderer.domElement);
controls.mouseButtons = { LEFT: -1 as THREE.MOUSE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.minDistance = 2;
controls.maxDistance = 1400;
controls.zoomToCursor = true;

export const provider: MapAssetProvider = { template: loadMapAssetTemplate, collisionBox };
export const materials = new MaterialVariants();
export const environment = new MapEnvironment(scene);
export const grass = new GrassField();
export const objectLayer = new ObjectLayer(provider, materials);
export const colliderLayer = new ColliderLayer();
export const collisionOverlay = new CollisionOverlay();
export const history = new History();

export interface NpcModelSource { model(npcId: string): Promise<THREE.Object3D | null> }
export const npcModels: NpcModelSource = { model: async () => null };
export const markerLayer = new MarkerLayer(labels, npcId => npcModels.model(npcId));
scene.add(environment.root, grass.root, objectLayer.root, colliderLayer.root, markerLayer.root, collisionOverlay.root);

export type ToolId = 'select' | 'place' | 'scatter' | 'erase' | 'sculpt' | 'paint' | 'water' | 'grass' | 'collider' | 'marker' | 'collectible';
export type EntityKind = 'o' | 'c' | 'm';
export type Entity =
  | { kind: 'o'; key: string; data: MapObject }
  | { kind: 'c'; key: string; data: MapCollider }
  | { kind: 'm'; key: string; data: MapMarker };

export const state = {
  doc: newMap('mapa_nuevo', 'Mapa nuevo'),
  field: new TerrainField(decodeTerrain(newMap('x', 'x').terrain)),
  surface: null as TerrainSurface | null,
  terrainMin: 0,
  terrainMax: 0,
  revision: null as string | null,
  savedId: null as string | null,
  dirty: false,
  tool: 'select' as ToolId,
  selection: new Set<string>(),
  hover: null as string | null,
  view: { grid: true, collisions: false, markers: true, grass: true },
  /** Imantado: rejilla cuadrada, casillas hexagonales de Pompelín (8 m) o libre. */
  snap: { mode: 'grid' as 'off' | 'grid' | 'hex', step: 1, angle: 15 },
  activeLayer: 'auto',
  assets: [] as MapAssetInfo[],
  assetById: new Map<string, MapAssetInfo>(),
  collision: null as MapCollision | null,
  boxes: new Map<string, THREE.Box3>(),
};

const index = { o: new Map<string, MapObject>(), c: new Map<string, MapCollider>(), m: new Map<string, MapMarker>() };
export function reindex() {
  index.o = new Map(state.doc.objects.map(item => [item.id, item]));
  index.c = new Map(state.doc.colliders.map(item => [item.id, item]));
  index.m = new Map(state.doc.markers.map(item => [item.id, item]));
}
export function entity(key: string): Entity | null {
  const kind = key[0] as EntityKind, id = key.slice(2);
  if (kind === 'o') { const data = index.o.get(id); return data ? { kind, key, data } : null; }
  if (kind === 'c') { const data = index.c.get(id); return data ? { kind, key, data } : null; }
  if (kind === 'm') { const data = index.m.get(id); return data ? { kind, key, data } : null; }
  return null;
}
export const selected = () => [...state.selection].map(entity).filter((item): item is Entity => !!item);
export function uid(prefix: string) {
  const used = (id: string) => index.o.has(id) || index.c.has(id) || index.m.has(id);
  let id: string;
  do id = `${prefix}${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 1296).toString(36)}`; while (used(id));
  return id;
}

export function layerOf(id: string) { return state.doc.layers.find(layer => layer.id === id); }
export function pickable(item: Entity) {
  const layer = layerOf(item.data.layer);
  if (!layer || !layer.visible || layer.locked) return false;
  if (item.kind === 'o' && (item.data.locked || item.data.hidden)) return false;
  return true;
}
export function layerFor(info: MapAssetInfo | undefined, fallback = 'atrezo') {
  const wanted = state.activeLayer !== 'auto' ? state.activeLayer
    : !info ? fallback
      : info.tile || (info.hex && info.group === 'city') ? 'suelo'
        : /Edificios|Construcción|Murallas/.test(info.category) ? 'edificios'
          : /Naturaleza/.test(info.category) ? 'naturaleza' : fallback;
  return layerOf(wanted) ? wanted : state.doc.layers[0].id;
}
export function displayPosition(object: MapObject, target = new THREE.Vector3()) {
  const [x, y, z] = object.position;
  return target.set(x, object.conform ? state.field.heightAt(x, z) + y : y, z);
}
export function entityPosition(item: Entity, target = new THREE.Vector3()) {
  if (item.kind === 'o') return displayPosition(item.data, target);
  return target.set(...item.data.position);
}
const HEX_S = 4, SQ3 = Math.sqrt(3);
/** Centro de la casilla hexagonal de Pompelín (misma rejilla que `city.ts`). */
export function hexCenter(x: number, z: number): [number, number] {
  const r = z / (SQ3 * HEX_S), q = (x / HEX_S - r) / 2;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(-q - r);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs + q + r);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return [(2 * rq + rr) * HEX_S, rr * SQ3 * HEX_S];
}
export const HEX_RADIUS = HEX_S * 2 / SQ3;
/** Aplica el imantado actual a un punto del suelo. `free` lo desactiva (tecla Ctrl). */
export function snapXZ(x: number, z: number, free = false): [number, number] {
  if (free || state.snap.mode === 'off') return [x, z];
  if (state.snap.mode === 'hex') return hexCenter(x, z);
  const step = state.snap.step;
  return [Math.round(x / step) * step, Math.round(z / step) * step];
}
export const snapAngle = (angle: number, free = false) => {
  if (free || !state.snap.angle) return angle;
  const step = THREE.MathUtils.degToRad(state.snap.angle);
  return Math.round(angle / step) * step;
};

// ---------------------------------------------------------------------------
// Terreno
// ---------------------------------------------------------------------------

export function measureTerrain() {
  let min = Infinity, max = -Infinity;
  for (const value of state.field.data.heights) { if (value < min) min = value; if (value > max) max = value; }
  state.terrainMin = min; state.terrainMax = max;
}
/** Sustituye el terreno completo (nuevo mapa, redimensionar o deshacer con otro tamaño). */
export function setTerrain(data: TerrainData) {
  const sameSize = state.surface && data.columns === state.field.columns && data.rows === state.field.rows
    && data.cell === state.field.cell && data.origin[0] === state.field.minX && data.origin[1] === state.field.minZ;
  if (sameSize && state.surface) {
    state.field.data.heights.set(data.heights); state.field.data.paint.set(data.paint); state.field.data.grass.set(data.grass);
    state.field.data.water = data.water?.slice();
    state.surface.update();
  } else {
    if (state.surface) { state.surface.mesh.removeFromParent(); state.surface.dispose(); }
    state.field = new TerrainField(data);
    state.surface = new TerrainSurface(state.field);
    materials.bind(state.surface);
    scene.add(state.surface.mesh);
  }
  measureTerrain();
  environment.apply(state.doc.settings, state.field);
  if (!waterLayer) { waterLayer = new WaterLayer(state.doc, state.field, state.surface!, { tiles: false }); scene.add(waterLayer.root); }
  else waterLayer.bind(state.field, state.surface!);
  rebuildGrass();
}
export function rebuildGrass() { grass.rebuild(state.field, environment.waterLevel); }
/** Agua pintada con la herramienta «Agua» (la misma que se ve en el juego). Las casillas de agua se ven como en el pack. */
export let waterLayer: WaterLayer | null = null;
export function rebuildWater() { waterLayer?.rebuildPainted(); }
const tmpBox = new THREE.Box3(), tmpPoint = new THREE.Vector3();
/** Intersección del rayo con el campo de alturas (marcha + bisección). */
export function rayTerrain(ray: THREE.Ray, out = new THREE.Vector3()): THREE.Vector3 | null {
  const field = state.field;
  tmpBox.min.set(field.minX, state.terrainMin - 0.05, field.minZ);
  tmpBox.max.set(field.maxX, state.terrainMax + 0.05, field.maxZ);
  let t0: number;
  if (tmpBox.containsPoint(ray.origin)) t0 = 0;
  else {
    const enter = ray.intersectBox(tmpBox, tmpPoint);
    if (!enter) return null;
    t0 = ray.origin.distanceTo(enter);
  }
  const t1 = t0 + tmpBox.getSize(tmpPoint).length();
  const step = Math.max(0.1, field.cell * 0.5);
  let previous = t0;
  for (let t = t0; t <= t1; t += step) {
    ray.at(t, out);
    if (out.y <= field.heightAt(out.x, out.z)) {
      let a = previous, b = t;
      for (let k = 0; k < 10; k++) {
        const m = (a + b) / 2;
        ray.at(m, out);
        if (out.y <= field.heightAt(out.x, out.z)) b = m; else a = m;
      }
      ray.at(b, out);
      out.y = field.heightAt(out.x, out.z);
      return out;
    }
    previous = t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sincronización, colisiones e historial
// ---------------------------------------------------------------------------

export const events = {
  changed: new Set<() => void>(),
  selection: new Set<() => void>(),
  document: new Set<() => void>(),
  dirty: new Set<() => void>(),
};
const emit = (set: Set<() => void>) => { for (const listener of set) listener(); };

/** Actualiza la escena a partir del documento. */
export function syncScene() {
  objectLayer.sync(state.doc.objects, state.doc.layers);
  colliderLayer.sync(state.doc.colliders, state.doc.layers);
  markerLayer.sync(state.doc.markers, state.doc.layers, state.field);
  syncResources();
  for (const key of [...state.selection]) if (!entity(key)) state.selection.delete(key);
  scheduleCollision();
  emit(events.changed);
}
let resourcePreview:ResourceLayer|null=null,resourceMap='';
/** Derived resources are a preview, never duplicated into the editable map document. */
function syncResources(){
 const signature=`${state.doc.id}:${state.field.data.heights.length}`;
 if(resourceMap===signature&&resourcePreview){resourcePreview.fitTerrain((x,z)=>state.field.heightAt(x,z));return;}
 resourcePreview?.dispose();resourceMap=signature;
 resourcePreview=new ResourceLayer(state.doc.id,(x,z)=>state.field.heightAt(x,z));
 resourcePreview.root.name='editor-resource-preview';scene.add(resourcePreview.root);
}
let collisionTimer = 0;
export function scheduleCollision(delay = 250) {
  clearTimeout(collisionTimer);
  collisionTimer = window.setTimeout(() => { void rebuildCollision(); }, delay);
}
export async function rebuildCollision() {
  const missing = [...new Set(state.doc.objects.map(object => object.asset))].filter(asset => !state.boxes.has(asset));
  await Promise.all(missing.map(async asset => state.boxes.set(asset, await collisionBox(asset).catch(() => new THREE.Box3()))));
  state.collision = buildCollision(state.doc, state.field, state.boxes);
  if (state.view.collisions || state.tool === 'collider') collisionOverlay.rebuild(state.collision, state.field);
  collisionOverlay.root.visible = state.view.collisions || state.tool === 'collider';
  return state.collision;
}
export const sceneState = (): SceneState => ({
  name: state.doc.name, description: state.doc.description, settings: state.doc.settings, layers: state.doc.layers,
  objects: state.doc.objects, colliders: state.doc.colliders, markers: state.doc.markers,
});
export function markDirty(value = true) { state.dirty = value; emit(events.dirty); }
/** Registra una acción deshacible. */
export function commit(label: string, terrainChanged = false) {
  if (history.push(label, sceneState(), state.field.data, terrainChanged)) markDirty();
}
export function setSelection(keys: Iterable<string>) {
  state.selection = new Set(keys);
  emit(events.selection);
}
export function restore(direction: 'undo' | 'redo') {
  const before = history.currentTerrain();
  const result = direction === 'undo' ? history.undo() : history.redo();
  if (!result) return;
  Object.assign(state.doc, result.scene);
  if (result.terrainRef !== before) setTerrain(result.terrain);
  else environment.apply(state.doc.settings, state.field);
  reindex();
  syncScene();
  emit(events.selection);
  emit(events.document);
  markDirty();
}
export function openDocument(doc: MapDocument, revision: string | null, savedId: string | null) {
  state.doc = doc;
  state.revision = revision;
  state.savedId = savedId;
  state.selection.clear();
  if (!doc.layers.length) doc.layers.push({ id: 'suelo', name: 'Suelo', visible: true, locked: false });
  if (state.activeLayer !== 'auto' && !layerOf(state.activeLayer)) state.activeLayer = 'auto';
  setTerrain(decodeTerrain(doc.terrain));
  if (doc.settings.clouds) void environment.setClouds(provider, state.field);
  reindex();
  syncScene();
  history.reset(sceneState(), state.field.data);
  markDirty(false);
  emit(events.document);
  emit(events.selection);
}
export function checkLimits(extra: { objects?: number; colliders?: number; markers?: number }) {
  const over = (count: number, limit: number) => count > limit;
  if (over(state.doc.objects.length + (extra.objects ?? 0), MAP_LIMITS.objects)) return `Límite de ${MAP_LIMITS.objects} objetos alcanzado.`;
  if (over(state.doc.colliders.length + (extra.colliders ?? 0), MAP_LIMITS.colliders)) return `Límite de ${MAP_LIMITS.colliders} colisionadores alcanzado.`;
  if (over(state.doc.markers.length + (extra.markers ?? 0), MAP_LIMITS.markers)) return `Límite de ${MAP_LIMITS.markers} marcadores alcanzado.`;
  return null;
}

/** Elimina entidades por clave (sin registrar en el historial). */
export function removeEntities(keys: Iterable<string>) {
  const remove = new Set(keys);
  if (!remove.size) return 0;
  const before = state.doc.objects.length + state.doc.colliders.length + state.doc.markers.length;
  state.doc.objects = state.doc.objects.filter(item => !remove.has(`o:${item.id}`));
  state.doc.colliders = state.doc.colliders.filter(item => !remove.has(`c:${item.id}`));
  state.doc.markers = state.doc.markers.filter(item => !remove.has(`m:${item.id}`));
  for (const key of remove) state.selection.delete(key);
  reindex();
  return before - (state.doc.objects.length + state.doc.colliders.length + state.doc.markers.length);
}

let statusTimer = 0;
export function status(text: string, kind: 'info' | 'error' = 'info') {
  const node = $('hint-info');
  node.textContent = text;
  node.style.color = kind === 'error' ? 'var(--danger)' : '';
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => { node.textContent = ''; }, kind === 'error' ? 9000 : 4000);
}

export function renderEditorView() {
  const fog = scene.fog;
  if (camera.position.y - controls.target.y > 100) scene.fog = null;
  try { renderer.render(scene, camera); }
  finally { scene.fog = fog; }
}

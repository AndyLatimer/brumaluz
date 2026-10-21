import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { MapObject } from '../../data/maps';
import { applyObjectTransform } from '../../world/mapRuntime';
import {
  $, camera, colliderLayer, commit, controls, el, entity, entityPosition, events, markerLayer, objectLayer,
  pickable, rayTerrain, rebuildCollision, renderer, scene, selected, setSelection, snapAngle, snapXZ, state,
  status, syncScene, uid, viewport, checkLimits, reindex, type Entity, type ToolId,
} from './core';

// Infraestructura de herramientas: puntero, raycast, cursor de pincel, selección y gizmo.

export interface Tool {
  id: ToolId; icon: string; shortcut: string; label: string;
  activate?(): void;
  deactivate?(): void;
  down?(event: PointerEvent, hit: THREE.Vector3 | null): void;
  move?(event: PointerEvent, hit: THREE.Vector3 | null): void;
  up?(event: PointerEvent, hit: THREE.Vector3 | null): void;
  /** Se llama cada fotograma (pinceles que actúan mientras se mantiene pulsado). */
  frame?(dt: number): void;
  key?(event: KeyboardEvent): boolean;
  options?(): (HTMLElement | string)[];
  /** Radio del cursor circular, si la herramienta es un pincel. */
  brush?(): { radius: number; color: string } | null;
}
export const tools = new Map<ToolId, Tool>();
export const registerTool = (tool: Tool) => { tools.set(tool.id, tool); };
export const toolEvents = new Set<() => void>();

export const pointer = {
  ndc: new THREE.Vector2(), x: 0, y: 0, inside: false, down: false,
  ground: null as THREE.Vector3 | null, raycaster: new THREE.Raycaster(),
  shift: false, ctrl: false, alt: false,
};

function updatePointer(event: PointerEvent | MouseEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
  pointer.ndc.set(pointer.x / rect.width * 2 - 1, -(pointer.y / rect.height) * 2 + 1);
  pointer.shift = event.shiftKey; pointer.ctrl = event.ctrlKey || event.metaKey; pointer.alt = event.altKey;
  pointer.raycaster.setFromCamera(pointer.ndc, camera);
  pointer.ground = rayTerrain(pointer.raycaster.ray, pointer.ground ?? new THREE.Vector3());
  return pointer.ground;
}

/** Busca la entidad bajo el puntero (objeto, colisionador o marcador). */
export function pickEntity(kinds = 'ocm', filter: (item: Entity) => boolean = pickable): { key: string; point: THREE.Vector3 } | null {
  const roots: THREE.Object3D[] = [];
  if (kinds.includes('m') && markerLayer.root.visible) roots.push(markerLayer.root);
  if (kinds.includes('c') && colliderLayer.root.visible) roots.push(colliderLayer.root);
  if (kinds.includes('o')) roots.push(objectLayer.root);
  const hits = pointer.raycaster.intersectObjects(roots, true);
  const groundDistance = pointer.ground ? pointer.ground.distanceTo(pointer.raycaster.ray.origin) : Infinity;
  for (const hit of hits) {
    if (!hit.object.visible || hit.distance > groundDistance + 0.05 && !hit.object.userData.entity?.startsWith('m:')) continue;
    let node: THREE.Object3D | null = hit.object, key: string | null = null;
    while (node && !key) {
      if (node.userData.entity) key = node.userData.entity;
      else if (node.userData.mapObjectId) key = `o:${node.userData.mapObjectId}`;
      else if (!node.visible) break;
      node = node.parent;
    }
    if (!key) continue;
    const item = entity(key);
    if (item && filter(item)) return { key, point: hit.point };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cursor del pincel
// ---------------------------------------------------------------------------

const RING = 72;
const ringGeometry = new THREE.BufferGeometry();
ringGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RING + 1) * 3 * 2), 3));
const ringMaterial = new THREE.LineBasicMaterial({ color: '#ffd27a', depthTest: false, transparent: true });
const brushRing = new THREE.LineSegments(ringGeometry, ringMaterial);
brushRing.renderOrder = 20; brushRing.frustumCulled = false; brushRing.visible = false; brushRing.name = 'editor-brush';
scene.add(brushRing);
function updateBrushCursor() {
  const brush = tools.get(state.tool)?.brush?.();
  brushRing.visible = !!brush && !!pointer.ground && pointer.inside;
  if (!brushRing.visible || !brush || !pointer.ground) return;
  ringMaterial.color.set(brush.color);
  const position = ringGeometry.getAttribute('position') as THREE.BufferAttribute;
  const { x, z } = pointer.ground;
  let k = 0;
  const put = (r: number, a: number) => {
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    position.setXYZ(k++, px, state.field.heightAt(px, pz) + 0.08, pz);
  };
  for (let i = 0; i < RING; i++) { put(brush.radius, i / RING * Math.PI * 2); put(brush.radius, (i + 1) / RING * Math.PI * 2); }
  put(0.25, 0); put(0.25, Math.PI);
  position.needsUpdate = true;
  ringGeometry.setDrawRange(0, k);
}

// ---------------------------------------------------------------------------
// Cambio de herramienta y opciones
// ---------------------------------------------------------------------------

export function setTool(id: ToolId) {
  if (!tools.has(id)) return;
  if (state.tool !== id) tools.get(state.tool)?.deactivate?.();
  state.tool = id;
  tools.get(id)?.activate?.();
  for (const button of document.querySelectorAll<HTMLButtonElement>('#tools [data-tool]')) button.setAttribute('aria-pressed', String(button.dataset.tool === id));
  renderToolOptions();
  void rebuildCollision();
  updateBrushCursor();
  updateGizmo();
  for (const listener of toolEvents) listener();
}
export function renderToolOptions() {
  const tool = tools.get(state.tool);
  $('tool-options').replaceChildren(...(tool?.options?.() ?? []));
}
export function renderToolbar() {
  const box = $('tools');
  box.replaceChildren();
  const order: ToolId[] = ['select', 'place', 'scatter', 'erase', 'sculpt', 'paint', 'water', 'grass', 'collider', 'marker'];
  order.forEach((id, i) => {
    const tool = tools.get(id);
    if (!tool) return;
    if (i === 4 || i === 8) box.append(el('hr'));
    box.append(el('button', { type: 'button', 'data-tool': id, title: `${tool.label} (${tool.shortcut.toUpperCase()})`, 'aria-pressed': String(state.tool === id), onclick: () => setTool(id) }, tool.icon, el('small', {}, tool.shortcut.toUpperCase())));
  });
}

/** Controles reutilizables para `#tool-options`. */
export function rangeOption(label: string, value: number, min: number, max: number, step: number, set: (value: number) => void, format = (v: number) => String(v)) {
  const output = el('span', {}, format(value));
  const input = el('input', { type: 'range', min, max, step, value: String(value) });
  input.addEventListener('input', () => { set(Number(input.value)); output.textContent = format(Number(input.value)); });
  return el('label', {}, label, input, output);
}
export function checkOption(label: string, value: boolean, set: (value: boolean) => void, title?: string) {
  const input = el('input', { type: 'checkbox', checked: value });
  input.addEventListener('change', () => set(input.checked));
  return el('label', { title }, input, label);
}
export function selectOption<T extends string>(label: string, value: T, options: readonly (readonly [T, string])[], set: (value: T) => void) {
  const select = el('select', {}, ...options.map(([id, name]) => el('option', { value: id, selected: id === value }, name)));
  select.addEventListener('change', () => set(select.value as T));
  return el('label', {}, label, select);
}
export function snapOptions() {
  return [
    selectOption('Imán', state.snap.mode, [['off', 'Libre'], ['grid', 'Rejilla'], ['hex', 'Hexágonos']] as const, mode => { state.snap.mode = mode; updateGizmo(); }),
    rangeOption('Paso', state.snap.step, 0.25, 8, 0.25, value => { state.snap.step = value; updateGizmo(); }, v => `${v} m`),
    rangeOption('Giro', state.snap.angle, 0, 90, 5, value => { state.snap.angle = value; updateGizmo(); }, v => v ? `${v}°` : 'libre'),
  ];
}

// ---------------------------------------------------------------------------
// Gizmo de transformación (mover, rotar, escalar) sobre la selección
// ---------------------------------------------------------------------------

export const transform = new TransformControls(camera, renderer.domElement);
const gizmo = transform.getHelper();
scene.add(gizmo);
const pivot = new THREE.Object3D();
scene.add(pivot);
transform.setSize(0.9);
transform.addEventListener('dragging-changed', event => { controls.enabled = !event.value; });

interface Start { item: Entity; world: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3; rotY: number; offsetY: number; size?: [number, number, number]; radius?: number }
let starts: Start[] = [];
const pivotStart = { position: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) };
export const gizmoState = { mode: 'translate' as 'translate' | 'rotate' | 'scale', space: 'world' as 'world' | 'local' };

const transformable = () => selected().filter(item => !(item.kind === 'o' && item.data.locked) && pickable(item));
export function updateGizmo() {
  const items = state.tool === 'select' || state.tool === 'collider' || state.tool === 'marker' ? transformable() : [];
  if (!items.length || transform.dragging) {
    if (!transform.dragging) { transform.detach(); }
    return;
  }
  const center = new THREE.Vector3(), point = new THREE.Vector3();
  for (const item of items) center.add(entityPosition(item, point));
  center.divideScalar(items.length);
  pivot.position.copy(center);
  pivot.scale.set(1, 1, 1);
  const single = items.length === 1 ? items[0] : null;
  if (single && (gizmoState.space === 'local' || gizmoState.mode === 'scale')) {
    if (single.kind === 'o') pivot.quaternion.setFromEuler(new THREE.Euler(...single.data.rotation, 'YXZ'));
    else pivot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), single.data.rotationY);
  } else pivot.quaternion.identity();
  pivot.updateMatrixWorld();
  const flatOnly = items.every(item => item.kind !== 'o');
  transform.setMode(gizmoState.mode);
  transform.setSpace(single && gizmoState.mode === 'scale' ? 'local' : single ? gizmoState.space : 'world');
  transform.showX = transform.showZ = !(gizmoState.mode === 'rotate' && flatOnly);
  transform.showY = true;
  transform.setTranslationSnap(state.snap.mode === 'grid' ? state.snap.step : null);
  transform.setRotationSnap(state.snap.angle ? THREE.MathUtils.degToRad(state.snap.angle) : null);
  transform.setScaleSnap(0.05);
  transform.attach(pivot);
}

transform.addEventListener('mouseDown', () => {
  if (pointer.alt) duplicateSelection(false);
  const items = transformable();
  pivotStart.position.copy(pivot.position); pivotStart.quat.copy(pivot.quaternion); pivotStart.scale.copy(pivot.scale);
  starts = items.map(item => {
    const world = entityPosition(item, new THREE.Vector3());
    if (item.kind === 'o') {
      return { item, world, quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(...item.data.rotation, 'YXZ')), scale: new THREE.Vector3(...item.data.scale), rotY: item.data.rotation[1], offsetY: item.data.position[1] };
    }
    return {
      item, world, quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.data.rotationY), scale: new THREE.Vector3(1, 1, 1), rotY: item.data.rotationY, offsetY: item.data.position[1],
      size: item.kind === 'c' ? [...item.data.size] : undefined, radius: item.kind === 'm' ? item.data.radius : undefined,
    };
  });
});

transform.addEventListener('objectChange', () => {
  if (!starts.length) return;
  if (gizmoState.mode === 'translate' && state.snap.mode === 'hex' && starts.length) {
    // Las casillas se imantan al centro del hexágono: se ajusta la primera y las demás la siguen.
    const first = starts[0].world, moved = pivot.position.clone().sub(pivotStart.position).add(first);
    const [hx, hz] = snapXZ(moved.x, moved.z, pointer.ctrl);
    pivot.position.x += hx - moved.x; pivot.position.z += hz - moved.z;
  }
  const deltaQ = pivot.quaternion.clone().multiply(pivotStart.quat.clone().invert());
  const scale = new THREE.Vector3(pivot.scale.x / pivotStart.scale.x, pivot.scale.y / pivotStart.scale.y, pivot.scale.z / pivotStart.scale.z);
  const deltaYaw = new THREE.Euler().setFromQuaternion(deltaQ, 'YXZ').y;
  const local = pivotStart.quat.clone();
  for (const start of starts) {
    const offset = start.world.clone().sub(pivotStart.position);
    if (gizmoState.mode === 'scale') offset.applyQuaternion(local.clone().invert()).multiply(scale).applyQuaternion(local);
    offset.applyQuaternion(deltaQ);
    const world = offset.add(pivot.position);
    const { item } = start;
    if (item.kind === 'o') {
      const object = item.data;
      const dy = world.y - start.world.y;
      object.position = [world.x, object.conform ? start.offsetY + dy : world.y, world.z];
      if (gizmoState.mode === 'rotate') {
        const euler = new THREE.Euler().setFromQuaternion(deltaQ.clone().multiply(start.quat), 'YXZ');
        object.rotation = [euler.x, euler.y, euler.z];
      }
      if (gizmoState.mode === 'scale') {
        // Un solo objeto se escala en sus propios ejes; varios, de forma uniforme.
        const u = Math.cbrt(scale.x * scale.y * scale.z);
        object.scale = starts.length > 1 ? [start.scale.x * u, start.scale.y * u, start.scale.z * u] : [start.scale.x * scale.x, start.scale.y * scale.y, start.scale.z * scale.z];
        object.scale = object.scale.map(v => Math.max(0.01, Math.min(500, v))) as [number, number, number];
      }
      const view = objectLayer.views.get(object.id);
      if (view) applyObjectTransform(view.container, object);
    } else {
      item.data.position = [world.x, world.y, world.z];
      if (gizmoState.mode === 'rotate') item.data.rotationY = start.rotY + deltaYaw;
      if (gizmoState.mode === 'scale') {
        if (item.kind === 'c' && start.size) {
          const flat = Math.max(scale.x, scale.z);
          item.data.size = item.data.shape === 'box'
            ? [start.size[0] * scale.x, start.size[1] * scale.y, start.size[2] * scale.z].map(v => Math.max(0.05, v)) as [number, number, number]
            : [Math.max(0.05, start.size[0] * flat), Math.max(0.05, start.size[1] * scale.y), Math.max(0.05, start.size[0] * flat)];
        }
        if (item.kind === 'm' && start.radius !== undefined) item.data.radius = Math.max(0, Math.min(500, start.radius * Math.max(scale.x, scale.z)));
      }
    }
  }
  if (starts.some(start => start.item.kind === 'c')) colliderLayer.sync(state.doc.colliders, state.doc.layers);
  if (starts.some(start => start.item.kind === 'm')) markerLayer.sync(state.doc.markers, state.doc.layers, state.field);
  for (const listener of events.selection) listener();
});

transform.addEventListener('mouseUp', () => {
  if (!starts.length) return;
  const label = gizmoState.mode === 'translate' ? 'Mover' : gizmoState.mode === 'rotate' ? 'Rotar' : 'Escalar';
  starts = [];
  syncScene();
  commit(label);
  updateGizmo();
});

// ---------------------------------------------------------------------------
// Operaciones sobre la selección
// ---------------------------------------------------------------------------

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** Duplica la selección; con `offset` la desplaza un paso para que se vea. */
export function duplicateSelection(offset = true) {
  const items = selected();
  if (!items.length) return;
  const limit = checkLimits({
    objects: items.filter(item => item.kind === 'o').length,
    colliders: items.filter(item => item.kind === 'c').length,
    markers: items.filter(item => item.kind === 'm').length,
  });
  if (limit) { status(limit, 'error'); return; }
  const step = offset ? Math.max(1, state.snap.mode === 'grid' ? state.snap.step : 2) : 0;
  const keys = pasteEntities(items.map(item => ({ kind: item.kind, data: clone(item.data) })), step);
  setSelection(keys);
  if (offset) commit('Duplicar');
}
export function pasteEntities(items: { kind: Entity['kind']; data: Entity['data'] }[], offsetX = 0, offsetZ = offsetX) {
  const keys: string[] = [];
  for (const { kind, data } of items) {
    const copy = clone(data);
    copy.id = uid(kind === 'o' ? 'o' : kind === 'c' ? 'col' : 'mk');
    copy.position = [copy.position[0] + offsetX, copy.position[1], copy.position[2] + offsetZ];
    if (!state.doc.layers.some(layer => layer.id === copy.layer)) copy.layer = state.doc.layers[0].id;
    if (kind === 'o') state.doc.objects.push(copy as MapObject);
    else if (kind === 'c') state.doc.colliders.push(copy as typeof state.doc.colliders[number]);
    else state.doc.markers.push(copy as typeof state.doc.markers[number]);
    keys.push(`${kind}:${copy.id}`);
    reindex();
  }
  syncScene();
  return keys;
}
/** Gira la selección alrededor de su centro (tecla R). */
export function rotateSelection(angle: number) {
  const items = selected().filter(item => !(item.kind === 'o' && item.data.locked));
  if (!items.length) return false;
  const center = new THREE.Vector3(), point = new THREE.Vector3();
  for (const item of items) center.add(entityPosition(item, point));
  center.divideScalar(items.length);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (const item of items) {
    const [x, y, z] = item.data.position;
    const dx = x - center.x, dz = z - center.z;
    item.data.position = [center.x + dx * cos + dz * sin, y, center.z - dx * sin + dz * cos];
    if (item.kind === 'o') item.data.rotation = [item.data.rotation[0], snapAngle(item.data.rotation[1] + angle, true), item.data.rotation[2]];
    else item.data.rotationY += angle;
  }
  syncScene(); commit('Girar'); updateGizmo();
  return true;
}
/** Asienta la selección sobre el terreno (tecla G). */
export function dropSelection() {
  const items = selected();
  for (const item of items) {
    const [x, , z] = item.data.position;
    if (item.kind === 'o' && item.data.conform) item.data.position = [x, 0, z];
    else if (item.kind === 'm' && item.data.type === 'light') continue;
    else item.data.position = [x, state.field.heightAt(x, z), z];
  }
  if (items.length) { syncScene(); commit('Asentar en el suelo'); updateGizmo(); }
}

// ---------------------------------------------------------------------------
// Resaltado de la selección
// ---------------------------------------------------------------------------

const highlights = new THREE.Group();
highlights.name = 'editor-selection';
scene.add(highlights);
const MAX_HIGHLIGHTS = 250;
export function refreshHighlights() {
  for (const child of highlights.children) (child as THREE.BoxHelper).geometry.dispose();
  highlights.clear();
  for (const item of selected().slice(0, MAX_HIGHLIGHTS)) {
    const target = item.kind === 'o' ? objectLayer.views.get(item.data.id)?.container
      : item.kind === 'c' ? colliderLayer.get(item.data.id) : markerLayer.group(item.data.id);
    if (!target) continue;
    const helper = new THREE.BoxHelper(target, item.kind === 'o' && item.data.locked ? '#9a9a9a' : '#ffcf6a');
    (helper.material as THREE.LineBasicMaterial).depthTest = false;
    helper.renderOrder = 15;
    helper.userData.target = target;
    highlights.add(helper);
  }
}
/** Las cajas siguen a los objetos (cargas asíncronas, arrastres). */
export function updateHighlights() {
  for (const child of highlights.children) (child as THREE.BoxHelper).update();
}

// ---------------------------------------------------------------------------
// Herramienta de selección (con selección por caja)
// ---------------------------------------------------------------------------

let boxStart: { x: number; y: number } | null = null;
const boxEl = el('div', { class: 'selection-box', hidden: true });
viewport.append(boxEl);

export function selectClick(event: PointerEvent, kinds = 'ocm') {
  const hit = pickEntity(kinds);
  if (hit) {
    const next = new Set(event.shiftKey || event.ctrlKey ? state.selection : []);
    if ((event.shiftKey || event.ctrlKey) && next.has(hit.key)) next.delete(hit.key); else next.add(hit.key);
    setSelection(next);
    return true;
  }
  return false;
}

registerTool({
  id: 'select', icon: '⬚', shortcut: 'v', label: 'Seleccionar y transformar',
  down(event) {
    if (selectClick(event)) return;
    boxStart = { x: pointer.x, y: pointer.y };
  },
  move() {
    if (!boxStart) return;
    const x = Math.min(boxStart.x, pointer.x), y = Math.min(boxStart.y, pointer.y);
    const w = Math.abs(pointer.x - boxStart.x), h = Math.abs(pointer.y - boxStart.y);
    boxEl.hidden = w < 4 && h < 4;
    Object.assign(boxEl.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  },
  up(event) {
    if (!boxStart) return;
    const start = boxStart;
    boxStart = null;
    const wasBox = !boxEl.hidden;
    boxEl.hidden = true;
    if (!wasBox) { if (!event.shiftKey && !event.ctrlKey) setSelection([]); return; }
    const rect = renderer.domElement.getBoundingClientRect();
    const x0 = Math.min(start.x, pointer.x), x1 = Math.max(start.x, pointer.x);
    const y0 = Math.min(start.y, pointer.y), y1 = Math.max(start.y, pointer.y);
    const point = new THREE.Vector3();
    const next = new Set(event.shiftKey || event.ctrlKey ? state.selection : []);
    const consider = (item: Entity) => {
      if (!pickable(item)) return;
      if (item.kind === 'm' && !state.view.markers) return;
      entityPosition(item, point).project(camera);
      if (point.z > 1) return;
      const sx = (point.x * 0.5 + 0.5) * rect.width, sy = (-point.y * 0.5 + 0.5) * rect.height;
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) next.add(item.key);
    };
    for (const data of state.doc.objects) consider({ kind: 'o', key: `o:${data.id}`, data });
    for (const data of state.doc.colliders) consider({ kind: 'c', key: `c:${data.id}`, data });
    for (const data of state.doc.markers) consider({ kind: 'm', key: `m:${data.id}`, data });
    setSelection(next);
  },
  options: () => [
    el('span', { class: 'hint' }, 'Gizmo:'),
    ...(['translate', 'rotate', 'scale'] as const).map((mode, i) => el('button', {
      type: 'button', 'aria-pressed': String(gizmoState.mode === mode), title: `Tecla ${i + 1}`,
      onclick: () => { gizmoState.mode = mode; updateGizmo(); renderToolOptions(); },
    }, ['Mover', 'Rotar', 'Escalar'][i])),
    el('button', { type: 'button', title: 'Ejes del mundo o del objeto', onclick: () => { gizmoState.space = gizmoState.space === 'world' ? 'local' : 'world'; updateGizmo(); renderToolOptions(); } }, gizmoState.space === 'world' ? 'Ejes: mundo' : 'Ejes: objeto'),
    ...snapOptions(),
  ],
});

// ---------------------------------------------------------------------------
// Eventos del puntero
// ---------------------------------------------------------------------------

let lastMove = 0;
export function initPointer() {
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', event => {
    dom.focus({ preventScroll: true });
    updatePointer(event);
    if (event.button !== 0 || transform.dragging || transform.axis !== null || document.body.classList.contains('walking')) return;
    pointer.down = true;
    dom.setPointerCapture(event.pointerId);
    tools.get(state.tool)?.down?.(event, pointer.ground);
  });
  dom.addEventListener('pointermove', event => {
    updatePointer(event);
    pointer.inside = true;
    updateBrushCursor();
    const now = performance.now();
    if (now - lastMove > 30 || pointer.down) {
      lastMove = now;
      tools.get(state.tool)?.move?.(event, pointer.ground);
    }
    const g = pointer.ground;
    $('cursor-info').textContent = g ? `x ${g.x.toFixed(1)} · z ${g.z.toFixed(1)} · alt ${g.y.toFixed(2)} m` : '';
  });
  const finish = (event: PointerEvent) => {
    if (!pointer.down) return;
    pointer.down = false;
    updatePointer(event);
    if (dom.hasPointerCapture(event.pointerId)) dom.releasePointerCapture(event.pointerId);
    tools.get(state.tool)?.up?.(event, pointer.ground);
  };
  dom.addEventListener('pointerup', finish);
  dom.addEventListener('pointercancel', finish);
  dom.addEventListener('pointerleave', () => { pointer.inside = false; updateBrushCursor(); });
  dom.addEventListener('contextmenu', event => event.preventDefault());
  window.addEventListener('keydown', event => { pointer.alt = event.altKey; pointer.ctrl = event.ctrlKey || event.metaKey; pointer.shift = event.shiftKey; });
  window.addEventListener('keyup', event => { pointer.alt = event.altKey; pointer.ctrl = event.ctrlKey || event.metaKey; pointer.shift = event.shiftKey; });
  events.selection.add(() => { refreshHighlights(); updateGizmo(); });
  events.changed.add(() => { refreshHighlights(); });
}
/** Llamado cada fotograma desde el bucle principal. */
export function toolFrame(dt: number) {
  if (pointer.down) tools.get(state.tool)?.frame?.(dt);
  updateHighlights();
}
export { updateBrushCursor };

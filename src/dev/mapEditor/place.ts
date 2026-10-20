import * as THREE from 'three';
import { MARKER_TYPES, type MapCollider, type MapMarker, type MapObject, type MarkerType } from '../../data/maps';
import { applyObjectTransform } from '../../world/mapRuntime';
import { defaultScale, loadMapAssetTemplate } from '../../world/mapAssets';
import { MARKER_COLORS, MARKER_LABELS } from './overlays';
import {
  checkLimits, commit, el, layerFor, objectLayer, reindex, scene, setSelection, snapAngle, snapXZ, state,
  status, syncScene, uid,
} from './core';
import {
  checkOption, pickEntity, pointer, rangeOption, registerTool, renderToolOptions, selectClick, selectOption, setTool, snapOptions,
  updateGizmo,
} from './tools';

// Colocar recursos (con vista fantasma y trazos), marcadores y colisionadores.

export const placement = {
  asset: '' as string,
  yaw: 0,
  scale: 1,
  randomYaw: false,
  randomScale: 0,
  stack: true,
  follow: false,
  conform: 'auto' as 'auto' | 'on' | 'off',
};
export const placementEvents = new Set<() => void>();

const ghost = new THREE.Group();
ghost.name = 'editor-ghost';
ghost.visible = false;
scene.add(ghost);
let ghostAsset = '';
let ghostReady = false;
const ghostMaterial = new Map<THREE.Material, THREE.Material>();
function ghostify(material: THREE.Material) {
  let copy = ghostMaterial.get(material);
  if (!copy) {
    copy = material.clone();
    copy.transparent = true; copy.opacity = 0.55; copy.depthWrite = false;
    ghostMaterial.set(material, copy);
  }
  return copy;
}
async function loadGhost(asset: string) {
  if (ghostAsset === asset) return;
  ghostAsset = asset; ghostReady = false;
  ghost.clear();
  if (!asset) return;
  const template = await loadMapAssetTemplate(asset).catch(() => null);
  if (!template || ghostAsset !== asset) return;
  const copy = template.clone(true);
  copy.traverse(part => {
    if (part instanceof THREE.Mesh) {
      part.material = Array.isArray(part.material) ? part.material.map(ghostify) : ghostify(part.material);
      part.castShadow = false;
      part.raycast = () => {};
    }
  });
  ghost.add(copy);
  ghostReady = true;
}

export function chooseAsset(id: string, switchTool = true) {
  placement.asset = id;
  void loadGhost(id);
  for (const listener of placementEvents) listener();
  if (switchTool && state.tool !== 'place' && state.tool !== 'scatter') setTool('place');
  else if (state.tool === 'place') renderToolOptions();
}

const conformFor = (asset: string) => {
  if (placement.conform !== 'auto') return placement.conform === 'on';
  const info = state.assetById.get(asset);
  return !!info && (info.tile || info.hex);
};
let strokeScale = 1, strokeYaw = 0;
function rollRandom() {
  strokeScale = placement.scale * (1 + (Math.random() * 2 - 1) * placement.randomScale);
  strokeYaw = placement.randomYaw ? Math.random() * Math.PI * 2 : 0;
}
rollRandom();

/** Calcula la transformación de la pieza bajo el puntero. */
function candidate(hit: THREE.Vector3 | null): MapObject | null {
  if (!hit || !placement.asset) return null;
  const info = state.assetById.get(placement.asset);
  const base = info ? defaultScale(info) : [1, 1, 1];
  const [x, z] = snapXZ(hit.x, hit.z, pointer.ctrl);
  let y = state.field.heightAt(x, z);
  const conform = conformFor(placement.asset);
  if (placement.stack && !conform) {
    // Apilar: si el puntero está sobre otro objeto, se apoya encima.
    const picked = pickEntity('o');
    if (picked && picked.point.y > y + 0.02) y = picked.point.y;
  }
  return {
    id: '', asset: placement.asset, layer: layerFor(info), name: undefined,
    position: [x, conform ? 0 : y, z],
    rotation: [0, snapAngle(placement.yaw + strokeYaw, true), 0],
    scale: [base[0] * strokeScale, base[1] * strokeScale, base[2] * strokeScale],
    collision: 'auto', conform: conform || undefined,
  };
}
function showGhost(object: MapObject | null) {
  ghost.visible = !!object && ghostReady && pointer.inside;
  if (!object) return;
  applyObjectTransform(ghost, object);
  if (object.conform) ghost.position.y = state.field.heightAt(object.position[0], object.position[2]);
}

let stroke: { last: THREE.Vector3; placed: string[]; spacing: number } | null = null;
function footprint(object: MapObject) {
  const info = state.assetById.get(object.asset);
  if (!info) return 2;
  const sx = (info.bounds.max[0] - info.bounds.min[0]) * Math.abs(object.scale[0]);
  const sz = (info.bounds.max[2] - info.bounds.min[2]) * Math.abs(object.scale[2]);
  return Math.max(0.3, Math.max(sx, sz));
}
function addObject(object: MapObject) {
  const limit = checkLimits({ objects: 1 });
  if (limit) { status(limit, 'error'); return null; }
  object.id = uid('o');
  if (!object.conform) delete object.conform;
  delete object.name;
  state.doc.objects.push(object);
  reindex();
  objectLayer.sync(state.doc.objects, state.doc.layers);
  return object.id;
}

/** Suelta un recurso arrastrado desde el catálogo sobre el punto del terreno. */
export function dropAsset(id: string, hit: THREE.Vector3) {
  const previous = placement.asset, stack = placement.stack;
  placement.asset = id; placement.stack = false;
  const object = candidate(hit);
  placement.asset = previous; placement.stack = stack;
  if (!object) return;
  const added = addObject(object);
  if (!added) return;
  syncScene();
  setSelection([`o:${added}`]);
  commit('Colocar');
}

registerTool({
  id: 'place', icon: '✚', shortcut: 'b', label: 'Colocar recurso',
  activate() { void loadGhost(placement.asset); },
  deactivate() { ghost.visible = false; },
  down(_event, hit) {
    if (!placement.asset) { status('Elige un recurso en el catálogo.'); return; }
    const object = candidate(hit);
    if (!object) return;
    const id = addObject(object);
    if (!id) return;
    stroke = { last: new THREE.Vector3(object.position[0], 0, object.position[2]), placed: [id], spacing: footprint(object) };
  },
  move(_event, hit) {
    const object = candidate(hit);
    if (stroke && object) {
      // Trazo: al arrastrar se colocan copias seguidas (vallas, muros, filas de árboles).
      const point = new THREE.Vector3(object.position[0], 0, object.position[2]);
      const distance = point.distanceTo(stroke.last);
      if (distance >= stroke.spacing * 0.98) {
        if (placement.follow) {
          const yaw = Math.atan2(point.x - stroke.last.x, point.z - stroke.last.z) - Math.PI / 2;
          object.rotation[1] = snapAngle(yaw, pointer.ctrl);
        }
        const id = addObject(object);
        if (id) { stroke.placed.push(id); stroke.last.copy(point); }
        rollRandom();
      }
    }
    showGhost(candidate(hit));
  },
  up() {
    if (!stroke) return;
    const count = stroke.placed.length;
    setSelection(stroke.placed.map(id => `o:${id}`));
    stroke = null;
    rollRandom();
    syncScene();
    commit(count > 1 ? `Colocar ${count} piezas` : 'Colocar');
  },
  key(event) {
    if (event.code === 'KeyR' && !event.ctrlKey) {
      placement.yaw += (event.shiftKey ? 15 : 45) * Math.PI / 180;
      showGhost(candidate(pointer.ground));
      return true;
    }
    return false;
  },
  options() {
    const info = state.assetById.get(placement.asset);
    return [
      el('strong', {}, info ? info.name : 'Elige un recurso del catálogo'),
      rangeOption('Escala', placement.scale, 0.1, 4, 0.05, value => { placement.scale = value; rollRandom(); }, v => `×${v}`),
      rangeOption('Variación', placement.randomScale, 0, 0.6, 0.05, value => { placement.randomScale = value; rollRandom(); }, v => `±${Math.round(v * 100)}%`),
      checkOption('Giro aleatorio', placement.randomYaw, value => { placement.randomYaw = value; rollRandom(); }),
      checkOption('Seguir el trazo', placement.follow, value => { placement.follow = value; }, 'Al arrastrar, las piezas se orientan según la dirección (vallas, muros)'),
      checkOption('Apilar', placement.stack, value => { placement.stack = value; }, 'Apoyar sobre otros objetos'),
      selectOption('Pegar al relieve', placement.conform, [['auto', 'Auto'], ['on', 'Sí'], ['off', 'No']] as const, value => { placement.conform = value; }),
      ...snapOptions(),
      el('span', { class: 'hint' }, 'R girar · arrastra para hacer filas · Ctrl sin imán'),
    ];
  },
});

// ---------------------------------------------------------------------------
// Marcadores
// ---------------------------------------------------------------------------

export const markerOptions = { type: 'npc' as MarkerType, radius: 1.5, npcId: '' };
export const npcChoices: { id: string; name: string }[] = [];
const MARKER_RADIUS: Record<MarkerType, number> = { spawn: 1, npc: 1.5, interaction: 2, zone: 8, light: 9, note: 1, portal: 3, arrival: 1 };

registerTool({
  id: 'marker', icon: '⚑', shortcut: 'm', label: 'Marcadores (aparición, NPC, zonas, luces…)',
  activate() { updateGizmo(); },
  down(event, hit) {
    if (selectClick(event, 'm')) return;
    if (!hit) return;
    const limit = checkLimits({ markers: 1 });
    if (limit) { status(limit, 'error'); return; }
    const type = markerOptions.type;
    const [x, z] = snapXZ(hit.x, hit.z, pointer.ctrl);
    const count = state.doc.markers.filter(marker => marker.type === type).length + 1;
    const npc = type === 'npc' ? npcChoices.find(choice => choice.id === markerOptions.npcId) : undefined;
    const marker: MapMarker = {
      id: uid('mk'), type, name: npc ? npc.name : `${MARKER_LABELS[type]} ${count}`, layer: layerFor(undefined, 'logica'),
      position: [x, type === 'light' ? state.field.heightAt(x, z) + 3.2 : state.field.heightAt(x, z), z],
      rotationY: 0, radius: markerOptions.radius,
    };
    if (npc) marker.npcId = npc.id;
    if (type === 'note') marker.text = '';
    if (type === 'portal') { marker.trigger = 'walk'; marker.name = `Portal ${count}`; }
    state.doc.markers.push(marker);
    reindex(); syncScene();
    setSelection([`m:${marker.id}`]);
    commit(`Marcador: ${MARKER_LABELS[type]}`);
  },
  options: () => [
    el('div', { class: 'kind-chips' }, ...MARKER_TYPES.map(type => el('button', {
      type: 'button', 'aria-pressed': String(markerOptions.type === type), style: `--kind:${MARKER_COLORS[type]}`,
      onclick: () => { markerOptions.type = type; markerOptions.radius = MARKER_RADIUS[type]; renderToolOptions(); },
    }, MARKER_LABELS[type]))),
    ...(markerOptions.type === 'npc' ? [selectOption('NPC', markerOptions.npcId, [['', '— genérico —'], ...npcChoices.map(npc => [npc.id, npc.name] as const)], value => { markerOptions.npcId = value; })] : []),
    rangeOption('Radio', markerOptions.radius, 0, 40, 0.5, value => { markerOptions.radius = value; }, v => `${v} m`),
    ...(markerOptions.type === 'portal' ? [el('span', { class: 'hint' }, 'Portal: lleva a otro mapa con pantalla de carga. Elige el destino en el inspector (o usa «Conectar ida y vuelta»).')] : []),
    ...(markerOptions.type === 'arrival' ? [el('span', { class: 'hint' }, 'Llegada: punto donde aparece quien viene de otro mapa. La flecha indica hacia dónde mira.')] : []),
    el('span', { class: 'hint' }, 'Clic en el suelo para añadir · clic en un marcador para seleccionarlo'),
  ],
});

// ---------------------------------------------------------------------------
// Colisionadores
// ---------------------------------------------------------------------------

export const colliderOptions = { shape: 'box' as 'box' | 'cylinder', height: 2.5, walkable: false };
const previewMaterial = new THREE.MeshBasicMaterial({ color: '#4ea8ff', transparent: true, opacity: 0.3, depthWrite: false });
const previewBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const preview = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(previewBox, previewMaterial);
const previewCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 32).translate(0, 0.5, 0);
preview.visible = false; preview.renderOrder = 6;
scene.add(preview);
let drawStart: THREE.Vector3 | null = null;

function colliderFrom(start: THREE.Vector3, end: THREE.Vector3): MapCollider {
  const [ex, ez] = snapXZ(end.x, end.z, pointer.ctrl);
  const height = colliderOptions.height;
  if (colliderOptions.shape === 'cylinder') {
    const radius = Math.max(0.25, Math.hypot(ex - start.x, ez - start.z));
    const base = state.field.heightAt(start.x, start.z);
    return { id: '', layer: layerFor(undefined, 'logica'), shape: 'cylinder', position: [start.x, base, start.z], rotationY: 0, size: [radius * 2, height, radius * 2], walkable: colliderOptions.walkable };
  }
  const cx = (start.x + ex) / 2, cz = (start.z + ez) / 2;
  const w = Math.max(0.25, Math.abs(ex - start.x)), d = Math.max(0.25, Math.abs(ez - start.z));
  let base = Infinity;
  for (const [x, z] of [[start.x, start.z], [ex, ez], [start.x, ez], [ex, start.z], [cx, cz]]) base = Math.min(base, state.field.heightAt(x, z));
  return { id: '', layer: layerFor(undefined, 'logica'), shape: 'box', position: [cx, base, cz], rotationY: 0, size: [w, height, d], walkable: colliderOptions.walkable };
}

registerTool({
  id: 'collider', icon: '▣', shortcut: 'c', label: 'Colisiones: dibujar cajas y cilindros',
  activate() { updateGizmo(); },
  deactivate() { preview.visible = false; drawStart = null; },
  down(event, hit) {
    if (selectClick(event, 'c')) return;
    if (!hit) return;
    const [x, z] = snapXZ(hit.x, hit.z, pointer.ctrl);
    drawStart = new THREE.Vector3(x, hit.y, z);
  },
  move(_event, hit) {
    if (!drawStart || !hit) { preview.visible = false; return; }
    const collider = colliderFrom(drawStart, hit);
    preview.geometry = collider.shape === 'box' ? previewBox : previewCylinder;
    preview.position.set(...collider.position);
    preview.scale.set(collider.size[0], collider.size[1], collider.size[2]);
    previewMaterial.color.set(collider.walkable ? '#59d68a' : '#4ea8ff');
    preview.visible = true;
  },
  up(event, hit) {
    preview.visible = false;
    if (!drawStart) return;
    const start = drawStart;
    drawStart = null;
    if (!hit) return;
    const collider = colliderFrom(start, hit);
    if (collider.size[0] < 0.3 && collider.size[2] < 0.3) { if (!event.shiftKey) setSelection([]); return; }
    const limit = checkLimits({ colliders: 1 });
    if (limit) { status(limit, 'error'); return; }
    collider.id = uid('col');
    state.doc.colliders.push(collider);
    reindex(); syncScene();
    setSelection([`c:${collider.id}`]);
    commit('Colisionador');
  },
  options: () => [
    el('div', { class: 'kind-chips' },
      el('button', { type: 'button', style: '--kind:#7fb8ff', 'aria-pressed': String(colliderOptions.shape === 'box'), onclick: () => { colliderOptions.shape = 'box'; renderToolOptions(); } }, '▭ Caja'),
      el('button', { type: 'button', style: '--kind:#7fb8ff', 'aria-pressed': String(colliderOptions.shape === 'cylinder'), onclick: () => { colliderOptions.shape = 'cylinder'; renderToolOptions(); } }, '◯ Cilindro')),
    rangeOption('Altura', colliderOptions.height, 0.1, 20, 0.1, value => { colliderOptions.height = value; }, v => `${v} m`),
    checkOption('Plataforma transitable', colliderOptions.walkable, value => { colliderOptions.walkable = value; }, 'Se puede subir encima (escaleras, tarimas, puentes)'),
    ...snapOptions().slice(0, 2),
    el('span', { class: 'hint' }, 'Arrastra en el suelo para dibujar · naranja: automáticas de los objetos · azul: propias · verde: plataformas'),
  ],
});

import * as THREE from 'three';
import './mapEditor.css';
import npcCatalogJson from '../../data/npcs.json';
import { validateNpcCatalog } from '../../data/npcs';
import { defaultChar } from '../../data/data';
import { Character, loadKits } from '../../character/character';
import { createNpc } from '../../character/npc';
import { loadMapAssetIndex } from '../../world/mapAssets';
import {
  $, camera, collisionOverlay, commit, controls, entity, environment, events, grass, history, markerLayer, npcModels,
  objectLayer, rebuildCollision, removeEntities, renderer, renderEditorView, restore, scene, selected, setSelection, state, status, syncScene,
  viewport, type Entity, type ToolId,
} from './core';
import {
  duplicateSelection, dropSelection, gizmoState, initPointer, pasteEntities, pointer, renderToolOptions, renderToolbar,
  rotateSelection, setTool, toolFrame, tools, transform, updateGizmo,
} from './tools';
import { npcChoices } from './place';
import { resizeBrush } from './brush';
import { focusSelection, initLeftPanel, renderCatalogFilters } from './catalog';
import { initRightPanel } from './panels';
import { boot, exportJson, frameAll, fromPompelin, fromOverworld, importJson, initMapSelector, newDialog, openDialog, publish, refreshPublished, save, startDrafts, topView, updateTitle } from './docs';
import { WalkMode } from './walk';
import { snapXZ } from './core';

if (!import.meta.env.DEV) throw new Error('El editor de mapas solo está disponible en desarrollo.');
// Acceso de depuración para la consola y las pruebas automáticas.
(window as unknown as { __mapEditor: unknown }).__mapEditor = { state, scene, camera, controls, THREE };

// ---------------------------------------------------------------------------
// Rejilla dibujada sobre el relieve (comparte la geometría del terreno)
// ---------------------------------------------------------------------------

const gridMaterial = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
  uniforms: { step: { value: 1 }, center: { value: new THREE.Vector3() }, color: { value: new THREE.Color('#fff6d8') } },
  vertexShader: 'varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform float step; uniform vec3 center; uniform vec3 color; varying vec3 vWorld;
    float lines(vec2 p){ vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(g.x, g.y), 1.0); }
    void main(){
      float minor = lines(vWorld.xz / step), major = lines(vWorld.xz / (step * 8.0));
      float fade = 1.0 - smoothstep(40.0 + step * 30.0, 120.0 + step * 90.0, distance(vWorld.xz, center.xz));
      float a = max(minor * 0.22, major * 0.42) * fade;
      if (a < 0.01) discard;
      gl_FragColor = vec4(color, a);
    }`,
});
const grid = new THREE.Mesh(new THREE.BufferGeometry(), gridMaterial);
grid.name = 'editor-grid';
grid.frustumCulled = false;
grid.renderOrder = 2;
grid.raycast = () => {};
scene.add(grid);
function updateGrid() {
  if (state.surface && grid.geometry !== state.surface.mesh.geometry) grid.geometry = state.surface.mesh.geometry;
  grid.visible = state.view.grid && !!state.surface && !walk.active;
  gridMaterial.uniforms.step.value = state.snap.mode === 'grid' ? Math.max(0.25, state.snap.step) : 1;
  gridMaterial.uniforms.center.value.copy(controls.target);
}

// ---------------------------------------------------------------------------
// Paseo
// ---------------------------------------------------------------------------

const walkHint = $('walk-hint');
const savedCamera = { position: new THREE.Vector3(), target: new THREE.Vector3() };
// Ayudas del editor que se ocultan al pasear (rejilla, marcadores, selección, colisiones…).
const hiddenWhileWalking = new Map<THREE.Object3D, boolean>();
function setEditorHelpersVisible(visible: boolean) {
  if (!visible) {
    hiddenWhileWalking.clear();
    for (const child of scene.children) if (child.name.startsWith('editor-') && child.name !== 'editor-walker') { hiddenWhileWalking.set(child, child.visible); child.visible = false; }
  } else {
    for (const [child, was] of hiddenWhileWalking) child.visible = was;
    hiddenWhileWalking.clear();
  }
}
const walk = new WalkMode(scene, camera, renderer.domElement, () => state.collision!, async () => {
  await loadKits();
  return new Character(defaultChar(), { outfit: true });
}, () => {
  document.body.classList.remove('walking');
  setEditorHelpersVisible(true);
  walkHint.hidden = true;
  controls.enabled = true;
  camera.position.copy(savedCamera.position);
  controls.target.copy(savedCamera.target);
  controls.update();
  updateGizmo();
});
async function toggleWalk() {
  if (walk.active) { walk.stop(); return; }
  status('Preparando el paseo…');
  await rebuildCollision();
  const spawn = state.doc.markers.find(marker => marker.type === 'spawn');
  const start = pointer.ground && pointer.inside ? pointer.ground.clone()
    : spawn ? new THREE.Vector3(...spawn.position) : controls.target.clone();
  const yaw = !pointer.inside && spawn ? spawn.rotationY : Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) + Math.PI;
  savedCamera.position.copy(camera.position); savedCamera.target.copy(controls.target);
  controls.enabled = false;
  transform.detach();
  document.body.classList.add('walking');
  setEditorHelpersVisible(false);
  walkHint.hidden = false;
  await walk.start(start, yaw);
  renderer.domElement.focus();
}

// ---------------------------------------------------------------------------
// Barra superior y conmutadores de vista
// ---------------------------------------------------------------------------

function setView(key: keyof typeof state.view, value: boolean) {
  state.view[key] = value;
  document.querySelector(`[data-toggle="${key}"]`)?.setAttribute('aria-pressed', String(value));
  markerLayer.root.visible = state.view.markers;
  grass.root.visible = state.view.grass;
  if (key === 'collisions') void rebuildCollision();
}
const ACTIONS: Record<string, () => unknown> = {
  new: newDialog, open: openDialog, save: () => save(), 'save-as': () => save(true), export: exportJson,
  undo: () => restore('undo'), redo: () => restore('redo'), 'top-view': topView, 'frame-all': frameAll,
  walk: toggleWalk, help: () => $<HTMLDialogElement>('help-dialog').showModal(), pompelin: fromPompelin, overworld: fromOverworld, publish,
};
function initTopbar() {
  initMapSelector();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
    const run = ACTIONS[button.dataset.action!];
    if (run) button.addEventListener('click', () => { void run(); });
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-toggle]')) {
    const key = button.dataset.toggle as keyof typeof state.view;
    button.addEventListener('click', () => setView(key, !state.view[key]));
  }
  $<HTMLInputElement>('import-file').addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void importJson(file);
  });
  const undo = document.querySelector<HTMLButtonElement>('[data-action="undo"]')!, redo = document.querySelector<HTMLButtonElement>('[data-action="redo"]')!;
  history.onChange = () => {
    undo.disabled = !history.canUndo; redo.disabled = !history.canRedo;
    undo.title = history.canUndo ? `Deshacer: ${history.undoLabel} (Ctrl+Z)` : 'Nada que deshacer';
    redo.title = history.canRedo ? `Rehacer: ${history.redoLabel} (Ctrl+Y)` : 'Nada que rehacer';
  };
  viewport.addEventListener('focus-selection', focusSelection);
}

// ---------------------------------------------------------------------------
// Teclado
// ---------------------------------------------------------------------------

const TOOL_KEYS: Record<string, ToolId> = { KeyV: 'select', KeyB: 'place', KeyN: 'scatter', KeyX: 'erase', KeyT: 'sculpt', KeyP: 'paint', KeyH: 'grass', KeyC: 'collider', KeyM: 'marker' };
const held = new Set<string>();
let clipboard: { kind: Entity['kind']; data: Entity['data'] }[] = [];

function onKey(event: KeyboardEvent) {
  const typing = (event.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]');
  const ctrl = event.ctrlKey || event.metaKey;
  if (ctrl && event.code === 'KeyS') { event.preventDefault(); void save(event.shiftKey); return; }
  const activeDialog = document.querySelector<HTMLDialogElement>('dialog[open]');
  if (activeDialog && event.code === 'Escape') { event.preventDefault(); activeDialog.close(); return; }
  if (typing || activeDialog) return;
  if (walk.active) return;
  if (ctrl) {
    const handled = (() => {
      switch (event.code) {
        case 'KeyZ': restore(event.shiftKey ? 'redo' : 'undo'); return true;
        case 'KeyY': restore('redo'); return true;
        case 'KeyO': void openDialog(); return true;
        case 'KeyD': duplicateSelection(); return true;
        case 'KeyA': setSelection([
          ...state.doc.objects.filter(item => !item.locked && !item.hidden).map(item => `o:${item.id}`),
          ...state.doc.colliders.map(item => `c:${item.id}`), ...state.doc.markers.map(item => `m:${item.id}`),
        ].filter(key => { const item = entity(key); return !!item && state.doc.layers.some(layer => layer.id === item.data.layer && layer.visible && !layer.locked); })); return true;
        case 'KeyC': clipboard = selected().map(item => ({ kind: item.kind, data: JSON.parse(JSON.stringify(item.data)) })); status(`${clipboard.length} copiados`); return true;
        case 'KeyV': {
          if (!clipboard.length) return true;
          const center = clipboard.reduce((sum, item) => [sum[0] + item.data.position[0] / clipboard.length, sum[1] + item.data.position[2] / clipboard.length], [0, 0]);
          const target = pointer.ground && pointer.inside ? snapXZ(pointer.ground.x, pointer.ground.z) : [center[0] + 2, center[1] + 2];
          setSelection(pasteEntities(clipboard, target[0] - center[0], target[1] - center[1]));
          commit('Pegar');
          return true;
        }
      }
      return false;
    })();
    if (handled) event.preventDefault();
    return;
  }
  if (tools.get(state.tool)?.key?.(event)) { event.preventDefault(); return; }
  switch (event.code) {
    case 'F1': event.preventDefault(); $<HTMLDialogElement>('help-dialog').showModal(); return;
    case 'Delete': case 'Backspace': {
      const keys = selected().filter(item => !(item.kind === 'o' && item.data.locked)).map(item => item.key);
      if (keys.length) { removeEntities(keys); syncScene(); commit(`Borrar ${keys.length}`); setSelection([]); }
      event.preventDefault();
      return;
    }
    case 'Escape':
      if (state.selection.size) setSelection([]);
      else if (state.tool !== 'select') setTool('select');
      return;
    case 'KeyF': focusSelection(); return;
    case 'Home': topView(); return;
    case 'KeyJ': void toggleWalk(); return;
    case 'KeyK': setView('collisions', !state.view.collisions); return;
    case 'KeyG': dropSelection(); return;
    case 'KeyR': rotateSelection((event.shiftKey ? 15 : 45) * Math.PI / 180); return;
    case 'Digit1': case 'Digit2': case 'Digit3':
      gizmoState.mode = (['translate', 'rotate', 'scale'] as const)[Number(event.code.slice(-1)) - 1];
      if (state.tool !== 'select') setTool('select'); else { updateGizmo(); renderToolOptions(); }
      return;
    case 'BracketLeft': resizeBrush(1 / 1.2); return;
    case 'BracketRight': resizeBrush(1.2); return;
  }
  const tool = TOOL_KEYS[event.code];
  if (tool && !event.altKey) { setTool(tool); return; }
  if (/^(Key[WASDQE]|Arrow)/.test(event.code)) { held.add(event.code); event.preventDefault(); }
}

/** Movimiento de cámara con WASD/flechas y giro con Q/E. */
function moveCamera(dt: number) {
  if (!held.size || walk.active) return;
  const distance = camera.position.distanceTo(controls.target);
  const speed = Math.max(8, distance * 1.1) * dt * (pointer.shift ? 2.5 : 1);
  const forward = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const move = new THREE.Vector3();
  if (held.has('KeyW') || held.has('ArrowUp')) move.add(forward);
  if (held.has('KeyS') || held.has('ArrowDown')) move.sub(forward);
  if (held.has('KeyD') || held.has('ArrowRight')) move.add(right);
  if (held.has('KeyA') || held.has('ArrowLeft')) move.sub(right);
  if (move.lengthSq()) { move.normalize().multiplyScalar(speed); camera.position.add(move); controls.target.add(move); }
  const turn = (held.has('KeyQ') ? 1 : 0) - (held.has('KeyE') ? 1 : 0);
  if (turn) {
    const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn * dt * 1.6);
    camera.position.copy(controls.target).add(offset);
  }
  // El objetivo de la cámara sigue la altura del terreno para no hundirse al cruzar colinas.
  const ground = state.field.heightAt(controls.target.x, controls.target.z);
  const dy = (ground - controls.target.y) * Math.min(1, dt * 6);
  controls.target.y += dy; camera.position.y += dy;
}

// ---------------------------------------------------------------------------
// Bucle
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();
let frames = 0, fpsTime = 0, fps = 0;
function resize() {
  const { clientWidth: width, clientHeight: height } = viewport;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
function loop() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  moveCamera(dt);
  if (!walk.active) controls.update();
  walk.update(dt, t);
  const near = walk.active ? .1 : Math.max(.1, camera.position.distanceTo(controls.target) / 100);
  if (Math.abs(camera.near - near) > .01) { camera.near = near; camera.updateProjectionMatrix(); }
  const focus = walk.active ? walk.position : controls.target;
  const extent = walk.active ? 40 : camera.position.distanceTo(controls.target) * 0.9;
  environment.follow(focus, extent);
  environment.update(t, camera.position);
  // En vista de edición las nubes estorban: solo se ven al pasear o a ras de suelo.
  environment.clouds.visible = state.doc.settings.clouds && (walk.active || camera.position.y - controls.target.y < 30);
  grass.update(t);
  objectLayer.update(t);
  if (!walk.active) toolFrame(dt);
  updateGrid();
  markerLayer.updateLabels(camera, viewport.clientWidth, viewport.clientHeight, state.view.markers && !walk.active);
  renderEditorView();
  frames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0;
    const doc = state.doc;
    $('scene-info').textContent = `${doc.objects.length} objetos · ${doc.colliders.length} colisionadores · ${doc.markers.length} marcadores · ${state.selection.size} sel. · ${fps} fps`;
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

async function start() {
  const loading = $('loading');
  try {
    initPointer();
    renderToolbar();
    initTopbar();
    initLeftPanel();
    initRightPanel();
    startDrafts();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', event => held.delete(event.code));
    window.addEventListener('blur', () => held.clear());
    new ResizeObserver(resize).observe(viewport);
    resize();
    events.document.add(updateTitle);
    events.document.add(() => { updateGizmo(); collisionOverlay.root.visible = state.view.collisions; });

    const npcs = validateNpcCatalog(npcCatalogJson).npcs;
    npcChoices.push(...npcs.map(npc => ({ id: npc.id, name: npc.name })));
    let kits: Promise<void> | null = null;
    npcModels.model = async id => {
      const definition = npcs.find(npc => npc.id === id);
      if (!definition) return null;
      kits ??= loadKits().then(() => undefined);
      await kits;
      return (await createNpc(definition)).root;
    };

    loading.textContent = 'Cargando catálogo de recursos…';
    state.assets = await loadMapAssetIndex();
    state.assetById = new Map(state.assets.map(info => [info.id, info]));
    renderCatalogFilters();
    setTool('select');
    loading.textContent = 'Abriendo mapa…';
    await boot();
void refreshPublished();
    loading.hidden = true;
    requestAnimationFrame(loop);
    void objectLayer.ready().then(() => status(`Listo · ${state.assets.length} recursos disponibles`));
  } catch (error) {
    loading.textContent = `No se pudo iniciar el editor: ${(error as Error).message}`;
    console.error(error);
  }
}
void start();

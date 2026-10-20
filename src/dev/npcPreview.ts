import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadKits } from '../character/character';
import { createNpc } from '../character/npc';
import {
  RACES, CLASSES, ATTRIBUTES, HAIR_NAMES, HAIR_COLORS, CLOTH_NAMES, CLOTH, EYE_COLOR_NAMES, EYE_COLORS,
  HAIR_ACCS, HAIR_ACC_VALUES, ACCS, MAKEUPS, ACC_COLORS, ACC_COLOR_NAMES, randomChar, type CharData,
} from '../data/data';
import { FACE_KITS, FACE_LABELS, HAIR_STYLES, BEARDS, EYE_SHAPES, BROWS, NOSES, MOUTHS, DETAILS } from '../character/head';
import { npcAppearance, newNpc, validateNpc, validateNpcCatalog, npcCharacter, WORLD_NPC_IDS, type NpcDefinition, type NpcCatalog } from '../data/npcs';
import { MAX_HEALTH, evaluate } from '../data/stats';
import { EQUIPPABLE } from '../data/equipment';
import { STARTER_MODELS } from '../data/starterItems';
import { itemLabel } from '../data/items';
import { catalog, loadLibraryAsset } from '../art/library';
import { NPC_CLOTHING, NPC_CLOTHING_SLOTS, REQUIRED_CLOTHING_SLOTS, defaultNpcClothing, type NpcClothingSlot, type ClothingSource } from '../data/npcClothing';
import { npcBadgeIcons, renderNpcBadge } from '../ui/npcBadges';
import './npcPreview.css';

if (!import.meta.env.DEV) throw new Error('El creador de NPCs solo esta disponible en desarrollo.');
const element = <T extends HTMLElement>(id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Falta el control ${id}.`);
  return node as T;
};
const status = element('status'), form = element<HTMLFormElement>('editor');
const library = element<HTMLSelectElement>('library');
const animation = element<HTMLSelectElement>('animation');
const badgeChoice = element<HTMLSelectElement>('badge-choice'), badgeInput = element<HTMLInputElement>('npc-badgeIcon');
const appearanceControls = new Map<keyof NpcDefinition['appearance'], HTMLInputElement | HTMLSelectElement>();
const renderControls = new Map<keyof NpcDefinition['render'], HTMLInputElement | HTMLSelectElement>();
const clothingControls = new Map<NpcClothingSlot, { piece: HTMLSelectElement; primary: HTMLSelectElement; secondary: HTMLSelectElement }>();
let catalogState: NpcCatalog = { version: 1, npcs: [] }, revision = '', savedId: string | null = null;
let savedSnapshot = '';
let dirty = false, busy = false, ready = false, closed = false, previewRequest = 0, buildRequest = 0;
let draft = newNpc();
let character: Awaited<ReturnType<typeof createNpc>> | undefined;

function message(text: string, error = false) {
  status.textContent = text; status.dataset.error = String(error);
}
function markDirty(value: boolean) {
  dirty = value;
  document.title = `${dirty ? '* ' : ''}Creador de NPCs · Brumaluz`;
}
function label(text: string, control: HTMLElement, parent: HTMLElement) {
  const row = document.createElement('label');
  row.append(document.createTextNode(text), control); parent.append(row);
}
type Option = { value: string; label: string; color?: string };
function selectControl(id: string, title: string, options: Option[], parent: HTMLElement) {
  const select = document.createElement('select'); select.id = id;
  for (const option of options) {
    const node = new window.Option(option.label, option.value);
    if (option.color) node.style.backgroundColor = option.color;
    select.add(node);
  }
  label(title, select, parent); return select;
}
function numberControl(id: string, title: string, min: number, max: number, step: number, parent: HTMLElement) {
  const input = document.createElement('input');
  Object.assign(input, { id, type: 'number', min: String(min), max: String(max), step: String(step), required: true });
  label(title, input, parent); return input;
}
const options = (labels: string[], values?: readonly number[], colors?: string[]): Option[] =>
  labels.map((label, index) => ({ value: String(values?.[index] ?? index), label, color: colors?.[index] }));
const appearanceParent = element('appearance');
function appearanceSelect(key: keyof NpcDefinition['appearance'], title: string, values: Option[]) {
  appearanceControls.set(key, selectControl(`appearance-${key}`, title, values, appearanceParent));
}
appearanceSelect('race', 'Linaje', Object.entries(RACES).map(([value, race]) => ({ value, label: race.label })));
appearanceSelect('cls', 'Clase de referencia (no cambia la ropa)', Object.entries(CLASSES).map(([value, cls]) => ({ value, label: cls.label })));
appearanceSelect('sex', 'Presentación', options(['Masculina', 'Femenina']));
appearanceControls.set('height', numberControl('appearance-height', 'Altura del cuerpo (0–1)', 0, 1, .01, appearanceParent));
appearanceControls.set('build', numberControl('appearance-build', 'Complexión (0–1)', 0, 1, .01, appearanceParent));
appearanceSelect('skin', 'Color de piel', []);
appearanceSelect('face', 'Rostro', options(FACE_KITS.map(kit => FACE_LABELS[kit])));
for (const [key, title, values, colors] of [
  ['hair', 'Peinado', HAIR_STYLES], ['hairColor', 'Color del pelo', HAIR_NAMES, HAIR_COLORS],
  ['beard', 'Barba', BEARDS], ['eyeShape', 'Forma de ojos', EYE_SHAPES],
  ['eyeColor', 'Color de ojos', EYE_COLOR_NAMES, EYE_COLORS], ['brows', 'Cejas', BROWS],
  ['nose', 'Nariz', NOSES], ['mouth', 'Boca', MOUTHS], ['detail', 'Detalles de cara', DETAILS],
  ['trait', 'Rasgo de linaje', []], ['hairAccColor', 'Color del adorno', ACC_COLOR_NAMES, ACC_COLORS],
  ['acc', 'Complemento', ACCS], ['accColor', 'Color del complemento', ACC_COLOR_NAMES, ACC_COLORS],
  ['makeup', 'Maquillaje', MAKEUPS], ['makeupColor', 'Color del maquillaje', ACC_COLOR_NAMES, ACC_COLORS],
] as const) appearanceSelect(key, title, options([...values], undefined, colors ? [...colors] : undefined));
appearanceSelect('hairAcc', 'Adorno del pelo', options(HAIR_ACCS, HAIR_ACC_VALUES));
const attributes = new Map<keyof typeof ATTRIBUTES, HTMLInputElement>();
for (const key of Object.keys(ATTRIBUTES) as (keyof typeof ATTRIBUTES)[]) {
  attributes.set(key, numberControl(`attribute-${key}`, ATTRIBUTES[key].label, 0, 10000, 1, element('attributes')));
}
const renderParent = element('render');
const preset = selectControl('clothing-preset', 'Rellenar el atuendo desde una base', NPC_CLOTHING.filter(piece => piece.slot === 'torso')
  .map(piece => ({ value: piece.source, label: piece.label })), element('clothing-presets'));
for (const slot of Object.keys(NPC_CLOTHING_SLOTS) as NpcClothingSlot[]) {
  const row = document.createElement('section'); row.className = 'clothing-row';
  const title = document.createElement('h3'); title.textContent = NPC_CLOTHING_SLOTS[slot]; row.append(title);
  const fields = document.createElement('div'); fields.className = 'fields'; row.append(fields);
  const choices = NPC_CLOTHING.filter(piece => piece.slot === slot).map(piece => ({ value: piece.id, label: piece.label }));
  if (!REQUIRED_CLOTHING_SLOTS.includes(slot)) choices.unshift({ value: '', label: 'Sin pieza' });
  const colors = [{ value: '-1', label: 'Original del recurso' }, ...options(CLOTH_NAMES, undefined, CLOTH)];
  clothingControls.set(slot, {
    piece: selectControl(`clothing-${slot}`, 'Prenda', choices, fields),
    primary: selectControl(`clothing-${slot}-primary`, 'Color principal', colors, fields),
    secondary: selectControl(`clothing-${slot}-secondary`, 'Color secundario', colors, fields),
  });
  element('clothing').append(row);
}
for (const [key, title, min, max] of [['scale', 'Escala global', .1, 3], ['width', 'Anchura extra', .5, 1.5], ['height', 'Altura extra', .5, 1.5]] as const) {
  renderControls.set(key, numberControl(`render-${key}`, title, min, max, .01, renderParent));
}
for (const slot of ['weapon', 'offhand'] as const) {
  renderControls.set(slot, selectControl(`render-${slot}`, slot === 'weapon' ? 'Mano principal' : 'Mano secundaria',
    [{ value: '', label: 'Vacía' }, ...Object.entries(EQUIPPABLE).filter(([id, item]) => item.slot === slot && Object.hasOwn(STARTER_MODELS, id))
      .map(([value]) => ({ value, label: itemLabel(value) }))], renderParent));
}
function raceOptions(race: CharData['race'], skin: number, trait: number) {
  const definition = RACES[race];
  for (const [key, labels, colors, selected] of [
    ['skin', definition.skinNames, definition.skins, skin], ['trait', definition.traits.length ? definition.traits : ['Ninguno'], undefined, trait],
  ] as const) {
    const control = appearanceControls.get(key) as HTMLSelectElement;
    control.replaceChildren(...options([...labels], undefined, colors ? [...colors] : undefined).map(value => {
      const option = new window.Option(value.label, value.value);
      if (value.color) option.style.backgroundColor = value.color;
      return option;
    }));
    control.value = String(Math.min(selected, control.options.length - 1));
  }
}
function fill(npc: NpcDefinition) {
  draft = structuredClone(npc);
  for (const key of ['id', 'name', 'subtitle', 'notes'] as const) element<HTMLInputElement>(`npc-${key}`).value = npc[key];
  badgeInput.value = npc.badgeIcon; refreshBadgeChoice(npc.badgeIcon);
  element<HTMLInputElement>('npc-id').readOnly = savedId !== null;
  element('save').textContent = savedId ? 'Guardar cambios en este NPC' : 'Registrar nuevo NPC';
  raceOptions(npc.appearance.race, npc.appearance.skin, npc.appearance.trait);
  for (const [key, control] of appearanceControls) control.value = String(npc.appearance[key]);
  for (const [key, control] of renderControls) control.value = String(npc.render[key]);
  for (const [slot, controls] of clothingControls) {
    controls.piece.value = npc.render.clothing[slot].piece;
    controls.primary.value = String(npc.render.clothing[slot].primary);
    controls.secondary.value = String(npc.render.clothing[slot].secondary);
  }
  for (const key of ['level', 'maxHealth', 'health'] as const) element<HTMLInputElement>(`npc-${key}`).value = String(npc.stats[key]);
  for (const [key, control] of attributes) control.value = String(npc.stats.attributes[key]);
  return preview();
}
function read(): NpcDefinition {
  const appearance = Object.fromEntries([...appearanceControls].map(([key, control]) =>
    [key, key === 'race' || key === 'cls' ? control.value : control.value === '' ? NaN : Number(control.value)]));
  const render = Object.fromEntries([...renderControls].map(([key, control]) => [key,
    ['scale', 'width', 'height'].includes(key) ? control.value === '' ? NaN : Number(control.value) : control.value]));
  const clothing = Object.fromEntries([...clothingControls].map(([slot, controls]) => [slot, {
    piece: controls.piece.value, primary: Number(controls.primary.value), secondary: Number(controls.secondary.value),
  }]));
  return validateNpc({
    id: element<HTMLInputElement>('npc-id').value, name: element<HTMLInputElement>('npc-name').value,
    subtitle: element<HTMLInputElement>('npc-subtitle').value, notes: element<HTMLTextAreaElement>('npc-notes').value, badgeIcon: badgeInput.value,
    appearance, render: { ...render, clothing }, stats: {
      level: element<HTMLInputElement>('npc-level').valueAsNumber,
      maxHealth: element<HTMLInputElement>('npc-maxHealth').valueAsNumber,
      health: element<HTMLInputElement>('npc-health').valueAsNumber,
      attributes: Object.fromEntries([...attributes].map(([key, control]) => [key, control.valueAsNumber])),
    },
  });
}
function refreshLibrary(selected = library.value) {
  library.replaceChildren(new window.Option('Selecciona una ficha…', ''), ...catalogState.npcs.map(npc => new window.Option(`${npc.name} · ${npc.id}`, npc.id)));
  library.value = catalogState.npcs.some(npc => npc.id === selected) ? selected : '';
  updateDeleteControl();
}
function updateDeleteControl() {
  const protectedNpc = WORLD_NPC_IDS.some(id => id === library.value);
  element<HTMLButtonElement>('delete').disabled = protectedNpc;
  element('delete').title = protectedNpc ? 'Los NPCs existentes del mundo se editan; no se eliminan desde el taller.' : '';
}
function refreshBadgeChoice(id: string) {
  badgeChoice.replaceChildren(new window.Option('Automático según su función', ''),
    ...npcBadgeIcons.map(icon => new window.Option(icon.id, icon.id)));
  const available = npcBadgeIcons.some(icon => icon.id === id);
  if (id && !available) badgeChoice.add(new window.Option(`Pendiente: ${id}`, id));
  badgeChoice.value = id;
  element('badge-note').textContent = id && !available
    ? `Icono reservado: ${id}. Falta su imagen en src/assets/npc-badges; se conserva el icono automático hasta añadirla.`
    : 'El icono aparece en el recuadro del NPC, no en la ropa ni sobre su nombre. Deja el ID vacío para usar el icono automático.';
}
async function request(method: 'GET' | 'PUT', catalog?: NpcCatalog) {
  const response = await fetch('/__dev/npcs', { method, cache: 'no-store',
    headers: method === 'PUT' ? { 'Content-Type': 'application/json', 'If-Match': revision } : {},
    body: method === 'PUT' ? JSON.stringify(catalog) : undefined,
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(typeof body === 'object' && body && 'error' in body ? String(body.error) : `Error HTTP ${response.status}.`);
  const next = validateNpcCatalog(body), nextRevision = response.headers.get('ETag');
  if (!nextRevision) throw new Error('El servidor no devolvió la revisión del catálogo; recarga la biblioteca.');
  catalogState = next; revision = nextRevision;
}
async function operation(action: () => Promise<void>) {
  if (busy) return;
  busy = true;
  element<HTMLFieldSetElement>('library-controls').disabled = true;
  element<HTMLFieldSetElement>('editor-controls').disabled = true;
  try { await action(); }
  catch (error) { console.error('Taller de NPCs:', error); message(error instanceof Error ? error.message : String(error), true); }
  finally {
    busy = false;
    element<HTMLFieldSetElement>('library-controls').disabled = !ready;
    element<HTMLFieldSetElement>('editor-controls').disabled = !ready;
  }
}
const discard = () => !dirty || window.confirm('Hay cambios sin guardar. ¿Descartar el borrador? Puedes cancelarlo y exportarlo primero.');
function uniqueId(base = 'nuevo_npc') {
  let id = base, index = 2;
  while (catalogState.npcs.some(npc => npc.id === id) || id === savedId) id = `${base.slice(0, 57)}_${index++}`;
  return id;
}
function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const canvas = element<HTMLCanvasElement>('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#d9dfdc');
scene.add(new THREE.HemisphereLight('#fff5e5', '#8e9caa', 2.4));
const light = new THREE.DirectionalLight('#fff0d5', 3); light.position.set(-3, 6, 4); light.castShadow = true;
scene.add(light);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#c3cdc6', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.01; floor.receiveShadow = true; scene.add(floor);
const camera = new THREE.PerspectiveCamera(32, 1, .01, 100);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.minDistance = .1; controls.maxDistance = 50;
let lastFrame = '', time = 0, previous = performance.now();
function frame() {
  if (!character) return;
  character.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(character.root), center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const distance = Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.35;
  controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(0, .12 * distance, distance)); controls.update();
}
const clipSources = catalog.assets.filter(asset => asset.pack === 'character-animations' && asset.kind === 'animations' && asset.rig === 'medium');
const clipCache = new Map<string, Promise<THREE.AnimationClip[]>>();
for (const source of clipSources) {
  const group = document.createElement('optgroup'); group.label = source.name.replace('Rig_Medium_', '');
  source.animations.forEach((name, index) => group.append(new window.Option(name, `${source.id}:${index}`)));
  animation.append(group);
}
async function playAnimation() {
  const version = ++previewRequest, actor = character;
  if (!actor) return;
  actor.revive(); actor.stopGesture(); actor.setGait('idle');
  const value = animation.value;
  if (value === 'idle' || value === 'walk' || value === 'run') { actor.setGait(value); return; }
  const split = value.lastIndexOf(':'), id = value.slice(0, split), index = Number(value.slice(split + 1));
  if (!clipCache.has(id)) {
    const promise = loadLibraryAsset(id).then(({ gltf }) => {
      const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>();
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
      for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
      return gltf.animations;
    }).catch(error => { clipCache.delete(id); throw error; });
    clipCache.set(id, promise);
  }
  try {
    const clip = (await clipCache.get(id)!)[index];
    if (closed || version !== previewRequest || actor !== character) return;
    if (!clip) throw new Error('El clip solicitado no existe.');
    actor.playClip(clip);
  } catch (error) {
    console.error('Animación del NPC:', error);
    message(`No se pudo reproducir la animación: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}
async function preview() {
  if (!ready || closed) return;
  const version = ++buildRequest;
  try {
    const current = read(); draft = current;
    const next = await createNpc(current);
    if (closed || version !== buildRequest) { next.dispose(); return; }
    character?.dispose(); character = next; scene.add(next.root);
    element('preview-name').textContent = current.name;
    element('preview-subtitle').textContent = current.subtitle;
    element('preview-stats').textContent = `Nivel ${current.stats.level} · Vida ${current.stats.health} / ${current.stats.maxHealth}`;
    element('card-name').textContent = current.name;
    element('card-subtitle').textContent = current.subtitle;
    refreshBadgeChoice(current.badgeIcon);
    renderNpcBadge(element('badge-preview'), current.id === 'testiculos' ? 'debug' : 'resident', current.subtitle || current.name, current.badgeIcon);
    const signature = JSON.stringify([current.render.scale, current.render.width, current.render.height, current.appearance.height, current.appearance.build]);
    if (signature !== lastFrame) { frame(); lastFrame = signature; }
    await playAnimation();
  } catch (error) {
    if (version === buildRequest && !closed) message(`No se pudo actualizar; se mantiene la última vista previa: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}
form.addEventListener('change', event => {
  if (busy || event.target === preset) return;
  if (event.target === appearanceControls.get('race')) {
    raceOptions(appearanceControls.get('race')!.value as CharData['race'], 0, 0);
  }
  markDirty(true); message('Borrador modificado. Pulsa Guardar para registrarlo en el proyecto.');
  void preview();
});
form.addEventListener('input', event => { if (!busy && event.target !== preset) markDirty(true); });
form.addEventListener('submit', event => {
  event.preventDefault();
  void operation(async () => {
    const npc = read();
    if (!savedId && catalogState.npcs.some(entry => entry.id === npc.id)) throw new Error('Ya existe ese ID. Abre su ficha para editarla o elige otro ID.');
    const npcs = savedId ? catalogState.npcs.map(entry => entry.id === savedId ? npc : entry) : [...catalogState.npcs, npc];
    if (savedId && !catalogState.npcs.some(entry => entry.id === savedId)) throw new Error('La ficha original no está en la biblioteca. Recarga antes de guardar.');
    if (savedId && JSON.stringify(catalogState.npcs.find(entry => entry.id === savedId)) !== savedSnapshot
      && !window.confirm('La ficha guardada cambió desde que la abriste. ¿Reemplazar esa versión con tu borrador actual?')) return;
    await request('PUT', { version: 1, npcs });
    savedId = npc.id; savedSnapshot = JSON.stringify(npc); element<HTMLInputElement>('npc-id').readOnly = true;
    element('save').textContent = 'Guardar cambios en este NPC';
    refreshLibrary(npc.id); markDirty(false); message(`Guardado en el proyecto: ${npc.name} (${npc.id}). No se ha colocado en el mundo.`);
  });
});
element('load').onclick = () => {
  const npc = catalogState.npcs.find(npc => npc.id === library.value);
  if (!npc) { message('Selecciona una ficha guardada.', true); return; }
  if (!discard()) return;
  savedId = npc.id; savedSnapshot = JSON.stringify(npc); fill(npc); markDirty(false); message(`Ficha cargada: ${npc.name}.`);
};
library.onchange = updateDeleteControl;
badgeChoice.onchange = () => { badgeInput.value = badgeChoice.value; };
element('reload').onclick = () => void operation(async () => {
  await request('GET'); refreshLibrary();
  message('Biblioteca recargada. El borrador se conserva; si había un conflicto, revisa la ficha actual antes de guardar.');
});
element('new').onclick = () => {
  if (!discard()) return;
  savedId = null; fill(newNpc(uniqueId())); markDirty(true); message('Nueva ficha sin guardar.');
};
element('duplicate').onclick = () => {
  try {
    const npc = read(); npc.id = uniqueId(npc.id); npc.name = `${npc.name.slice(0, 72)} (copia)`;
    savedId = null; fill(npc); markDirty(true); message('Copia independiente sin guardar. Ajusta su ID antes de registrarla.');
  } catch (error) { message(String(error instanceof Error ? error.message : error), true); }
};
element('delete').onclick = () => void operation(async () => {
  const npc = catalogState.npcs.find(npc => npc.id === library.value);
  if (!npc) throw new Error('Selecciona la ficha que quieres eliminar.');
  if (!window.confirm(`¿Eliminar del proyecto a ${npc.name} (${npc.id})?${dirty ? ' Hay un borrador sin guardar que se conservará.' : ''}`)) return;
  await request('PUT', { version: 1, npcs: catalogState.npcs.filter(entry => entry.id !== npc.id) });
  if (savedId === npc.id) {
    savedId = null; element<HTMLInputElement>('npc-id').readOnly = false;
    element('save').textContent = 'Registrar nuevo NPC'; markDirty(true);
  }
  refreshLibrary(); message('Ficha eliminada del proyecto. La vista previa se conserva como borrador.');
});
element('export').onclick = () => {
  try { const npc = read(); download(npc, `${npc.id}.json`); message('Ficha exportada. Esto no sustituye el guardado en el proyecto.'); }
  catch (error) { message(error instanceof Error ? error.message : String(error), true); }
};
element('export-library').onclick = () => download(catalogState, 'brumaluz-npcs.json');
element<HTMLInputElement>('import').onchange = event => void operation(async () => {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = '';
  if (!file) return;
  if (file.size > 4_000_000) throw new Error('El archivo supera los 4 MB.');
  const value: unknown = JSON.parse(await file.text());
  if (typeof value === 'object' && value && 'version' in value) {
    const incoming = validateNpcCatalog(value);
    const collisions = incoming.npcs.filter(npc => catalogState.npcs.some(existing => existing.id === npc.id));
    if (collisions.length) throw new Error(`La biblioteca contiene IDs existentes: ${collisions.slice(0, 5).map(npc => npc.id).join(', ')}. No se ha importado nada. Importa fichas individuales para duplicarlas.`);
    if (!window.confirm(`¿Registrar ${incoming.npcs.length} NPCs de la biblioteca importada en el proyecto? El borrador se conservará.`)) return;
    const merged = validateNpcCatalog({ version: 1, npcs: [...catalogState.npcs, ...incoming.npcs] });
    await request('PUT', merged); refreshLibrary();
    message(`Biblioteca importada: ${incoming.npcs.length} fichas registradas. El borrador se conserva.`);
    return;
  }
  const npc = validateNpc(value);
  if (!discard()) return;
  if (catalogState.npcs.some(entry => entry.id === npc.id)) {
    npc.id = uniqueId(npc.id);
    message('La ficha importada tenía un ID existente: se ha creado una copia con otro ID. Aún no está guardada.');
  } else message('Ficha importada como borrador. Pulsa Guardar para registrarla en el proyecto.');
  savedId = null; fill(npc); markDirty(true);
});
element('random').onclick = () => {
  try { const npc = read(); npc.appearance = npcAppearance(randomChar()); fill(npc); markDirty(true); message('Apariencia aleatoria, sin modificar identidad ni estadísticas.'); }
  catch (error) { message(error instanceof Error ? error.message : String(error), true); }
};
element('apply-clothing-preset').onclick = () => {
  try {
    const npc = read(), source = preset.value as ClothingSource;
    if (!window.confirm('¿Sustituir las piezas del único atuendo por esta base? Después puedes mezclarlas y recolorearlas una a una.')) return;
    npc.render.clothing = defaultNpcClothing(source, -1, -1);
    if (NPC_CLOTHING.some(piece => piece.id === `${source}.head`)) npc.render.clothing.head.piece = `${source}.head`;
    if (source === 'helpers') for (const slot of ['overlay', 'footwear'] as const) npc.render.clothing[slot].piece = `helpers.${slot}`;
    void fill(npc); markDirty(true); message('Base aplicada al único atuendo del NPC. Puedes cambiar cualquier pieza. Aún sin guardar.');
  } catch (error) { message(error instanceof Error ? error.message : String(error), true); }
};
element('suggest-health').onclick = () => {
  try {
    const npc = read(), data = npcCharacter(npc);
    const health = evaluate(MAX_HEALTH, data);
    element<HTMLInputElement>('npc-maxHealth').value = String(health); element<HTMLInputElement>('npc-health').value = String(health);
    markDirty(true); void preview(); message('Vida sugerida aplicada y restaurada al máximo. Aún sin guardar.');
  } catch (error) { message(error instanceof Error ? error.message : String(error), true); }
};
animation.onchange = () => void playAnimation();
for (const [id, action] of [
  ['wave', () => character?.wave()], ['speak', () => character?.speak(4)], ['pickup', () => character?.pickUp()],
  ['consume', () => character?.useItem()], ['hit', () => character?.hit()], ['die', () => character?.die()], ['frame', frame],
] as const) element(id).onclick = action;
const resize = new ResizeObserver(() => {
  if (!canvas.clientWidth || !canvas.clientHeight) return;
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix(); frame();
});
resize.observe(canvas);
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => {
  closed = true; previewRequest++; buildRequest++; renderer.setAnimationLoop(null); resize.disconnect(); controls.dispose();
  character?.dispose(); floor.geometry.dispose(); floor.material.dispose(); renderer.dispose();
});
await operation(async () => {
  await Promise.all([loadKits(), request('GET')]);
  ready = true; refreshLibrary(); await fill(draft); markDirty(false);
  if (status.dataset.error === 'true') throw new Error(status.textContent ?? 'No se pudo preparar la vista previa.');
  message('Listo. Crea una ficha o abre un NPC de la biblioteca. Nada se coloca automáticamente en el mapa.');
  renderer.setAnimationLoop(now => {
    const delta = Math.min((now - previous) / 1000, .1); previous = now;
    if (element<HTMLInputElement>('playing').checked) time += delta;
    character?.update(time); controls.update(); renderer.render(scene, camera);
  });
});

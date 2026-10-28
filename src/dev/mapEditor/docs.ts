import * as THREE from 'three';
import {
  GROUND_MATERIALS, MAP_ID, MAP_KIND_LABELS, MAX_MAP_BYTES, MAX_TERRAIN_VERTICES, encodeTerrain, newMap, validateMap, type MapDocument,
} from '../../data/maps';
import {
  $, camera, controls, el, events, markDirty, openDocument, renderer, renderEditorView, scene, state, status,
} from './core';
import { MapApiError, clearDraft, deleteMap, getPublished, listMaps, loadDraft, loadMap, publishMap, saveDraft, saveMap, unpublishMap, type PublishedInfo } from './store';
import { pompelinTemplate } from './pompelin';
import { overworldTemplate } from './overworld';
import { transform } from './tools';

// Documento: nuevo, abrir, guardar, guardar como, importar, exportar y borradores automáticos.

const LAST_KEY = 'brumaluz.mapEditor.last';
let switchingMap = false, selectorRequest = 0;

export async function refreshMapSelector() {
  const request = ++selectorRequest;
  const selector = $<HTMLSelectElement>('map-selector');
  try {
    const maps = await listMaps();
    if (request !== selectorRequest) return;
    const options = maps.map(map => el('option', {
      value: map.id, disabled: 'error' in map,
    }, 'error' in map ? `${map.name} · archivo no válido` : `${map.name} · ${MAP_KIND_LABELS[map.kind]}`));
    if (!maps.some(map => map.id === 'brumaluz')) options.unshift(el('option', { value: 'brumaluz' }, 'Brumaluz · crear copia de la capital'));
    if (!maps.some(map => map.id === state.doc.id) && state.doc.id !== 'brumaluz') {
      options.unshift(el('option', { value: state.doc.id }, `${state.doc.name} · sin guardar`));
    }
    selector.replaceChildren(...options);
    selector.value = state.doc.id;
  } catch (error) {
    status(`No se pudo actualizar el selector de mapas: ${(error as Error).message}`, 'error');
  }
}

export function initMapSelector() {
  const selector = $<HTMLSelectElement>('map-selector');
  selector.addEventListener('focus', () => { if (!switchingMap) void refreshMapSelector(); });
  selector.addEventListener('change', async () => {
    const id = selector.value;
    selector.value = state.doc.id;
    if (id === state.doc.id || switchingMap || saving || publishing) return;
    if (!confirmDiscard()) return;
    switchingMap = true;
    selector.disabled = true;
    try {
      const maps = await listMaps();
      if (id === 'brumaluz' && !maps.some(map => map.id === id)) {
        const doc = await pompelinTemplate('brumaluz', 'Brumaluz');
        const result = await saveMap(doc, null);
        openDocument(doc, result.revision, doc.id);
        localStorage.setItem(LAST_KEY, doc.id);
        frameAll();
        status('Brumaluz lista para editar. Es el mapa detallado al entrar en la capital; publica para llevar tus cambios al juego.');
      } else {
        await openById(id);
      }
    } catch (error) {
      status(`No se pudo cambiar de mapa: ${(error as Error).message}`, 'error');
    } finally {
      switchingMap = false;
      selector.disabled = false;
      await refreshMapSelector();
    }
  });
  events.document.add(() => { void refreshMapSelector(); });
  window.addEventListener('focus', () => { if (!switchingMap) void refreshMapSelector(); });
  void refreshMapSelector();
}

/** Documento listo para guardar (terreno codificado). */
export function serialize(): MapDocument {
  return { ...state.doc, terrain: encodeTerrain(state.field.data), updatedAt: new Date().toISOString() };
}

/** Vista previa JPEG del encuadre actual, sin gizmo ni ayudas. */
function capturePreview() {
  const hidden: THREE.Object3D[] = [];
  for (const name of ['editor-selection', 'editor-ghost', 'editor-colliders', 'editor-markers', 'editor-collisions', 'editor-grid', 'editor-brush']) {
    const object = scene.getObjectByName(name);
    if (object?.visible) { object.visible = false; hidden.push(object); }
  }
  const gizmo = transform.getHelper();
  const gizmoVisible = gizmo.visible;
  gizmo.visible = false;
  renderEditorView();
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 240;
  const source = renderer.domElement;
  const ratio = canvas.width / canvas.height;
  let sw = source.width, sh = source.width / ratio;
  if (sh > source.height) { sh = source.height; sw = sh * ratio; }
  canvas.getContext('2d')!.drawImage(source, (source.width - sw) / 2, (source.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  for (const object of hidden) object.visible = true;
  gizmo.visible = gizmoVisible;
  return canvas.toDataURL('image/jpeg', 0.78);
}

export function updateTitle() {
  $('map-title').textContent = `${state.doc.name} · ${state.doc.id}`;
  const badge = $('save-state');
  badge.className = `save-state${state.dirty ? ' dirty' : ''}`;
  badge.textContent = state.dirty ? (state.savedId ? 'Cambios sin guardar' : 'Sin guardar') : state.savedId ? 'Guardado' : '';
  document.title = `${state.dirty ? '• ' : ''}${state.doc.name} · Editor de mapas`;
  updatePublishedBadge();
}

// ---------------------------------------------------------------------------
// Publicar en el juego
// ---------------------------------------------------------------------------

let published: PublishedInfo[] = [], publishing = false;
const megabytes = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

function updatePublishedBadge() {
  const badge = document.getElementById('published-state');
  if (!badge) return;
  const current = published.find(map => map.id === state.doc.id);
  const live = !!current && state.savedId === state.doc.id;
  badge.hidden = !published.length;
  badge.classList.toggle('live', live);
  badge.textContent = live ? (state.dirty ? '● En el juego · cambios sin publicar' : '● En el juego') : `${published.length} mapas publicados`;
  badge.title = current ? `Publicado el ${new Date(current.publishedAt).toLocaleString('es')}.` : 'Los mapas publicados conservan sus conexiones.';
}
export async function refreshPublished() {
  try { published = await getPublished(); } catch (error) { status(`No se pudo consultar la publicación: ${(error as Error).message}`, 'error'); }
  updatePublishedBadge();
  return published;
}

/** Avisos sobre lo que el juego necesita del mapa (no impiden publicar). */
export function publishWarnings(doc: MapDocument) {
  const warnings: string[] = [];
  const visible = new Set(doc.layers.filter(layer => layer.visible).map(layer => layer.id));
  const markers = doc.markers.filter(marker => visible.has(marker.layer));
  if (!markers.some(marker => marker.type === 'spawn')) warnings.push('No hay marcador de aparición: el jugador aparecerá en el centro del mapa.');
  for (const npc of doc.id === 'brumaluz' ? ['testiculos', 'isberto'] : []) {
    if (!markers.some(marker => marker.type === 'npc' && marker.npcId === npc)) warnings.push(`Falta el marcador de NPC «${npc}»: no aparecerá en la ciudad.`);
  }
  if (doc.layers.some(layer => !layer.visible)) warnings.push('Las capas ocultas no se publican.');
  for (const marker of markers.filter(marker => marker.type === 'portal')) {
    if (!marker.target) warnings.push(`El portal «${marker.name}» no tiene destino.`);
  }
  return warnings;
}

export async function publish() {
  if (publishing || saving) return;
  const warnings = publishWarnings(state.doc);
  const message = `¿Publicar «${state.doc.name}» en el mundo de Pompelín?\n\n`
    + 'Se conserva el resto de mapas publicados. Se guardará el mapa y las pestañas del juego se recargarán. '
    + 'Para los viajes online aplica después el SQL generado con «npm run db:apply» y despliega el juego con los mismos mapas.'
    + (warnings.length ? `\n\nAvisos:\n• ${warnings.join('\n• ')}` : '');
  if (!confirm(message)) return;
  if (state.dirty || state.savedId !== state.doc.id) {
    if (!await save()) return;
  }
  publishing = true;
  status('Publicando en el juego…');
  try {
    const result = await publishMap(state.doc.id, state.revision);
    published = [...published.filter(map => map.id !== result.id), result];
    status(`Publicado: ${result.objects} objetos, ${result.assets} recursos (${megabytes(result.bytes)}). SQL generado: supabase/world.sql. Aplica «npm run db:apply» para habilitar portales y coleccionables online.`);
    if (result.warnings?.length) alert(`Publicado con caminos cerrados:\n\n${result.warnings.join('\n')}\n\nPublica los destinos para abrirlos.`);
  } catch (error) {
    status(`No se pudo publicar: ${(error as Error).message}`, 'error');
  } finally {
    publishing = false;
    updatePublishedBadge();
  }
}

export async function unpublish() {
  if (!confirm('¿Retirar todos los mapas publicados? El juego volverá a Brumaluz procedural (tus mapas guardados no se tocan).')) return false;
  try {
    await unpublishMap();
    published = [];
    status('El juego vuelve a usar la ciudad procedural.');
    return true;
  } catch (error) {
    status(`No se pudo quitar la publicación: ${(error as Error).message}`, 'error');
    return false;
  } finally { updatePublishedBadge(); }
}

let saving = false;
export async function save(asNew = false): Promise<boolean> {
  if (saving) return false;
  if (asNew) return saveAsDialog();
  saving = true;
  $('save-state').textContent = 'Guardando…';
  try {
    const doc = serialize();
    doc.preview = capturePreview();
    validateMap(doc);
    const json = JSON.stringify(doc);
    if (json.length > MAX_MAP_BYTES) throw new Error(`El mapa ocupa ${(json.length / 1e6).toFixed(1)} MB y el máximo es ${MAX_MAP_BYTES / 1e6} MB. Reduce el terreno o la resolución.`);
    let result;
    try {
      result = await saveMap(doc, state.savedId === doc.id ? state.revision : null);
    } catch (error) {
      if (!(error instanceof MapApiError) || (error.status !== 409 && error.status !== 412)) throw error;
      const overwrite = confirm(state.savedId === doc.id
        ? 'El archivo del mapa ha cambiado fuera de este editor (otra pestaña o a mano).\n\n¿Sobrescribirlo con tu versión?'
        : `Ya existe un mapa con el ID «${doc.id}».\n\n¿Sobrescribirlo?`);
      if (!overwrite) { status('Guardado cancelado.'); return false; }
      const current = await loadMap(doc.id);
      result = await saveMap(doc, current.revision);
    }
    state.doc.updatedAt = doc.updatedAt;
    state.doc.preview = doc.preview;
    state.revision = result.revision;
    state.savedId = doc.id;
    localStorage.setItem(LAST_KEY, doc.id);
    markDirty(false);
    void refreshMapSelector();
    await clearDraft();
    status(`Guardado en src/data/maps/${doc.id}.json`);
    return true;
  } catch (error) {
    status(`No se pudo guardar: ${(error as Error).message}`, 'error');
    $('save-state').className = 'save-state error';
    $('save-state').textContent = 'Error al guardar';
    return false;
  } finally { saving = false; }
}

// ---------------------------------------------------------------------------
// Diálogo «nuevo» / «guardar como»
// ---------------------------------------------------------------------------

const slug = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^[^a-z0-9]+|_+$/g, '').slice(0, 64) || 'mapa';

function formDialog(mode: 'new' | 'save-as'): Promise<FormData | null> {
  const dialog = $<HTMLDialogElement>('new-dialog');
  const form = $<HTMLFormElement>('new-form');
  $('new-title').textContent = mode === 'new' ? 'Nuevo mapa' : 'Guardar como';
  (form.querySelector('.new-terrain') as HTMLElement).hidden = mode !== 'new';
  for (const input of form.querySelectorAll<HTMLInputElement>('.new-terrain input, .new-terrain select')) input.disabled = mode !== 'new';
  const name = form.elements.namedItem('name') as HTMLInputElement, id = form.elements.namedItem('id') as HTMLInputElement;
  name.value = mode === 'new' ? 'Mapa nuevo' : state.doc.name;
  id.value = mode === 'new' ? 'mapa_nuevo' : state.savedId ? `${state.doc.id}_copia` : state.doc.id;
  let touched = false;
  id.oninput = () => { touched = true; };
  name.oninput = () => { if (!touched) id.value = slug(name.value); };
  const paint = form.elements.namedItem('paint') as HTMLSelectElement;
  if (!paint.options.length) paint.append(...GROUND_MATERIALS.map((material, index) => el('option', { value: String(index) }, material.label)));
  const note = $('new-note');
  const update = () => {
    const width = Number((form.elements.namedItem('width') as HTMLInputElement).value), depth = Number((form.elements.namedItem('depth') as HTMLInputElement).value);
    const cell = Number((form.elements.namedItem('cell') as HTMLSelectElement).value);
    const vertices = (Math.round(width / cell) + 1) * (Math.round(depth / cell) + 1);
    note.textContent = mode === 'new' ? `${vertices.toLocaleString('es')} vértices de terreno${vertices > MAX_TERRAIN_VERTICES ? ' — demasiados, sube la celda o reduce el tamaño' : ''}.` : 'Se guardará una copia con este ID; el original no cambia.';
  };
  form.oninput = update;
  update();
  dialog.showModal();
  return new Promise(resolve => {
    dialog.onclose = () => {
      if (dialog.returnValue !== 'ok') { resolve(null); return; }
      resolve(new FormData(form));
    };
  });
}

export async function newDialog() {
  if (!confirmDiscard()) return;
  const data = await formDialog('new');
  if (!data) return;
  const id = String(data.get('id'));
  if (!MAP_ID.test(id)) { status('ID no válido.', 'error'); return; }
  const width = Number(data.get('width')), depth = Number(data.get('depth')), cell = Number(data.get('cell'));
  if ((Math.round(width / cell) + 1) * (Math.round(depth / cell) + 1) > MAX_TERRAIN_VERTICES) { status('Terreno demasiado grande para esa celda.', 'error'); return; }
  const doc = newMap(id, String(data.get('name')).trim() || id, { width, depth, cell, paint: Number(data.get('paint')), grass: Number(data.get('grass')) });
  openDocument(doc, null, null);
  frameAll();
  markDirty(true);
}

async function saveAsDialog() {
  const data = await formDialog('save-as');
  if (!data) return false;
  const id = String(data.get('id'));
  if (!MAP_ID.test(id)) { status('ID no válido.', 'error'); return false; }
  state.doc.id = id;
  state.doc.name = String(data.get('name')).trim() || id;
  if (state.savedId !== id) { state.revision = null; state.savedId = null; }
  for (const listener of events.document) listener();
  const ok = await save(false);
  return ok;
}

// ---------------------------------------------------------------------------
// Abrir
// ---------------------------------------------------------------------------

export function confirmDiscard() {
  return !state.dirty || confirm('Hay cambios sin guardar en el mapa actual. ¿Descartarlos?');
}
export async function openById(id: string) {
  const { map, revision } = await loadMap(id);
  openDocument(map, revision, map.id);
  localStorage.setItem(LAST_KEY, map.id);
  frameAll();
  status(`Abierto: ${map.name}`);
}
export async function openDialog() {
  const dialog = $<HTMLDialogElement>('open-dialog');
  const list = $('map-list');
  list.replaceChildren(el('p', { class: 'hint' }, 'Cargando…'));
  $('published-hint').replaceChildren();
  if (!dialog.open) dialog.showModal();
  try {
    const [maps] = await Promise.all([listMaps(), refreshPublished()]);
    renderPublishedHint();
    if (!maps.length) { list.replaceChildren(el('p', { class: 'hint' }, 'Todavía no hay mapas guardados.')); return; }
    list.replaceChildren(...maps.map(entry => {
      if ('error' in entry) {
        return el('div', { class: 'map-card error' }, el('div', { class: 'noimg' }), el('strong', {}, entry.name ?? entry.id), el('div', { class: 'meta' }, `No se puede abrir: ${entry.error}`));
      }
      const open = async () => {
        if (!confirmDiscard()) return;
        dialog.close();
        try { await openById(entry.id); } catch (error) { status(`No se pudo abrir: ${(error as Error).message}`, 'error'); }
      };
      const live = published.some(map => map.id === entry.id);
      return el('div', { class: `map-card${live ? ' published' : ''}` },
        entry.preview ? el('img', { src: entry.preview, alt: '' }) : el('div', { class: 'noimg' }),
        el('strong', {}, entry.name, live ? el('span', { class: 'published-tag' }, 'En el juego') : null),
        el('div', { class: 'meta' }, `${entry.id} · ${entry.size[0]}×${entry.size[1]} m · ${entry.objects} objetos · ${new Date(entry.updatedAt).toLocaleString('es')}`),
        entry.description ? el('div', { class: 'meta' }, entry.description) : null,
        el('div', { class: 'meta' }, ...entry.portals.map(portal => el('div', {}, `↗ ${portal.name} → ${portal.target?.map ?? 'sin destino'}${portal.target?.arrival ? ` / ${portal.target.arrival}` : ''}`))),
        el('div', { class: 'row' },
          el('button', { type: 'button', class: 'accent', onclick: open }, 'Abrir'),
          ...(live ? [el('button', { type: 'button', onclick: async () => {
            if (!confirm(`¿Retirar «${entry.name}» del juego? Sus mapas guardados no se borran; los portales a este destino quedarán cerrados.`)) return;
            try { await unpublishMap(entry.id); await refreshPublished(); void openDialog(); }
            catch (error) { status(`No se pudo retirar: ${(error as Error).message}`, 'error'); }
          } }, 'Retirar del juego')] : []),
          el('button', { type: 'button', class: 'danger', onclick: async () => {
            if (!confirm(`¿Eliminar definitivamente «${entry.name}» (src/data/maps/${entry.id}.json)?`)) return;
            try {
              await deleteMap(entry.id, entry.revision);
              if (state.savedId === entry.id) { state.savedId = null; state.revision = null; markDirty(true); }
              void openDialog();
            } catch (error) { status(`No se pudo eliminar: ${(error as Error).message}`, 'error'); }
          } }, 'Eliminar')));
    }));
  } catch (error) {
    const offline = error instanceof TypeError;
    list.replaceChildren(el('p', { class: 'hint' }, offline
      ? 'No hay conexión con el servidor de desarrollo. Arranca «npm run dev» y recarga la página.'
      : `No se pudo listar: ${(error as Error).message}`));
  }
}
function renderPublishedHint() {
  const hint = $('published-hint');
  if (!published.length) { hint.replaceChildren('Pompelín es el mundo; Brumaluz, su capital. Publica cada mapa para habilitarlo. Sin Brumaluz publicada se conserva la capital procedural.'); return; }
  hint.replaceChildren(
    `${published.length} mapas publicados: ${published.map(map => map.name).join(', ')}. SQL: supabase/world.sql. `,
    el('button', { type: 'button', class: 'link', onclick: async () => { if (await unpublish()) void openDialog(); } }, 'Retirar todos / Brumaluz procedural'),
  );
}
export async function fromPompelin() {
  if (!confirmDiscard()) return;
  $<HTMLDialogElement>('open-dialog').close();
  $('loading').hidden = false;
  $('loading').textContent = 'Convirtiendo Brumaluz en un mapa editable…';
  try {
    const existing = new Set((await listMaps()).map(entry => entry.id));
    let id = 'brumaluz', n = 2;
    while (existing.has(id)) id = `brumaluz_${n++}`;
    const doc = await pompelinTemplate(id, 'Brumaluz');
    openDocument(doc, null, null);
    markDirty(true);
    frameAll();
    status('Capital de Pompelín: Brumaluz lista. Guárdala para conservarla.');
  } catch (error) {
    status(`No se pudo crear la plantilla: ${(error as Error).message}`, 'error');
  } finally { $('loading').hidden = true; }
}

export async function fromOverworld() {
  if (!confirmDiscard()) return;
  $<HTMLDialogElement>('open-dialog').close();
  try {
    const maps = await listMaps();
    if (maps.some(map => map.id === 'pompelin')) { await openById('pompelin'); return; }
    openDocument(overworldTemplate(), null, null);
    markDirty(true); frameAll();
    status('Pompelín creado a partir del dibujo. Todas las regiones y conexiones son editables; guarda para conservarlo.');
  } catch (error) { status(`No se pudo crear Pompelín: ${(error as Error).message}`, 'error'); }
}

// ---------------------------------------------------------------------------
// Importar y exportar
// ---------------------------------------------------------------------------

export function exportJson() {
  const blob = new Blob([JSON.stringify(serialize())], { type: 'application/json' });
  const link = el('a', { href: URL.createObjectURL(blob), download: `${state.doc.id}.json` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}
export async function importJson(file: File) {
  if (!confirmDiscard()) return;
  try {
    if (file.size > MAX_MAP_BYTES) throw new Error('El archivo es demasiado grande.');
    const doc = validateMap(JSON.parse(await file.text()));
    openDocument(doc, null, null);
    markDirty(true);
    frameAll();
    status(`Importado «${doc.name}». Guárdalo para añadirlo al proyecto.`);
  } catch (error) { status(`No se pudo importar: ${(error as Error).message}`, 'error'); }
}

// ---------------------------------------------------------------------------
// Borrador automático
// ---------------------------------------------------------------------------

let draftTimer = 0;
export function startDrafts() {
  events.dirty.add(() => {
    updateTitle();
    if (!state.dirty) return;
    clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => { void saveDraft({ map: serialize(), revision: state.revision, savedId: state.savedId, at: Date.now() }); }, 4000);
  });
  window.addEventListener('beforeunload', event => {
    if (!state.dirty) return;
    void saveDraft({ map: serialize(), revision: state.revision, savedId: state.savedId, at: Date.now() });
    event.preventDefault();
  });
}
/** Al arrancar: recupera un borrador pendiente, o abre el último mapa, o uno nuevo. */
export async function boot() {
  const draft = await loadDraft();
  if (draft && confirm(`Hay un borrador sin guardar de «${draft.map.name}» (${new Date(draft.at).toLocaleString('es')}).\n\n¿Recuperarlo?`)) {
    try {
      openDocument(validateMap(draft.map), draft.revision, draft.savedId);
      markDirty(true);
      frameAll();
      status('Borrador recuperado.');
      return;
    } catch (error) { status(`El borrador no es válido: ${(error as Error).message}`, 'error'); }
  }
  if (draft) await clearDraft();
  const last = localStorage.getItem(LAST_KEY);
  if (last) {
    try { await openById(last); return; } catch { localStorage.removeItem(LAST_KEY); }
  }
  openDocument(newMap('mapa_nuevo', 'Mapa nuevo'), null, null);
  frameAll();
}

export function frameAll() {
  const field = state.field;
  const cx = (field.minX + field.maxX) / 2, cz = (field.minZ + field.maxZ) / 2;
  const radius = Math.hypot(field.maxX - field.minX, field.maxZ - field.minZ) / 2;
  const halfAngle = Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.min(1, camera.aspect));
  const distance = radius / Math.sin(halfAngle) * 1.08;
  controls.maxDistance = Math.max(1400, distance * 3);
  camera.far = Math.max(4000, distance * 5);
  camera.updateProjectionMatrix();
  controls.target.set(cx, 0, cz);
  camera.position.set(.35, .55, .6).normalize().multiplyScalar(distance).add(controls.target);
  controls.update();
}
export function topView() {
  const distance = Math.max(30, camera.position.distanceTo(controls.target));
  camera.position.set(controls.target.x, controls.target.y + distance, controls.target.z + 0.01);
  controls.update();
}

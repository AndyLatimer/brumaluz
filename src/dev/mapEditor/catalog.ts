import { MARKER_LABELS } from './overlays';
import { $, camera, commit, controls, el, entityPosition, events, entity, layerOf, setSelection, state, syncScene, type Entity } from './core';
import { chooseAsset, dropAsset, placement, placementEvents } from './place';
import { scatter, toggleScatterAsset } from './brush';
import { lazyThumb } from './thumbnails';
import { rayTerrain } from './core';
import * as THREE from 'three';

// Panel izquierdo: catálogo de recursos, capas y lista de elementos de la escena.

const RECENT_KEY = 'brumaluz.mapEditor.recent';
const recent: string[] = (() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; } })();
function remember(id: string) {
  const index = recent.indexOf(id);
  if (index >= 0) recent.splice(index, 1);
  recent.unshift(id);
  recent.length = Math.min(recent.length, 40);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

const catalog = { group: 'all', category: '', query: '', limit: 240 };
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Los recursos tienen nombres en inglés: el buscador acepta también palabras en español.
const SYNONYMS: Record<string, string[]> = {
  casa: ['house', 'home', 'hut', 'cottage'], arbol: ['tree', 'pine', 'oak', 'birch'], arboles: ['tree'], pino: ['pine', 'tree'], roca: ['rock', 'stone', 'boulder'],
  piedra: ['stone', 'rock'], barril: ['barrel'], caja: ['crate', 'box', 'chest'], cofre: ['chest'], valla: ['fence'], muro: ['wall'], muralla: ['wall'],
  puente: ['bridge'], torre: ['tower'], puerta: ['door', 'gate'], ventana: ['window'], tejado: ['roof'], escalera: ['stair', 'ladder'],
  mesa: ['table'], silla: ['chair', 'stool'], banco: ['bench'], cama: ['bed'], estanteria: ['shelf', 'bookcase'], libro: ['book'],
  flor: ['flower'], flores: ['flower'], arbusto: ['bush', 'shrub'], hierba: ['grass'], seta: ['mushroom'], hongo: ['mushroom'],
  agua: ['water'], rio: ['river', 'water'], camino: ['road', 'path'], calle: ['road', 'street'], pozo: ['well'], molino: ['windmill', 'mill'],
  farol: ['lamp', 'lantern', 'lamppost'], lampara: ['lamp', 'lantern'], antorcha: ['torch'], vela: ['candle'], fuego: ['fire', 'campfire'], hoguera: ['campfire'],
  espada: ['sword'], hacha: ['axe'], escudo: ['shield'], arco: ['bow'], lanza: ['spear'], martillo: ['hammer'], pico: ['pickaxe'],
  tienda: ['tent', 'market', 'stall', 'shop'], mercado: ['market', 'stall'], carro: ['cart', 'wagon'], barco: ['boat', 'ship'],
  saco: ['sack', 'bag'], comida: ['food'], pan: ['bread'], botella: ['bottle'], jarra: ['mug', 'jug'], olla: ['pot'],
  esqueleto: ['skeleton'], calavera: ['skull'], hueso: ['bone'], tumba: ['grave', 'tomb'], lapida: ['grave', 'tombstone'],
  iglesia: ['church'], castillo: ['castle'], cuartel: ['barracks'], herreria: ['blacksmith', 'forge'], taberna: ['tavern'], granja: ['farm'],
  trigo: ['wheat'], campo: ['field', 'farm'], nube: ['cloud'], montana: ['mountain', 'hill'], colina: ['hill'], bandera: ['flag', 'banner'],
  estandarte: ['banner'], cartel: ['sign'], letrero: ['sign'], columna: ['column', 'pillar'], suelo: ['floor', 'tile'], baldosa: ['tile'],
};
let searchIndex = new Map<string, string>();

export function renderCatalogFilters() {
  const groups = new Map<string, string>();
  for (const info of state.assets) groups.set(info.group, info.groupLabel);
  searchIndex = new Map(state.assets.map(info => [info.id, normalize(`${info.name} ${info.id} ${info.category} ${info.groupLabel}`)]));
  const chip = (id: string, label: string, active: boolean, onclick: () => void) => el('button', { type: 'button', 'aria-pressed': String(active), onclick }, label);
  $('catalog-groups').replaceChildren(
    chip('all', 'Todo', catalog.group === 'all', () => { catalog.group = 'all'; catalog.category = ''; renderCatalogFilters(); }),
    chip('recent', '★ Recientes', catalog.group === 'recent', () => { catalog.group = 'recent'; catalog.category = ''; renderCatalogFilters(); }),
    ...[...groups].map(([id, label]) => chip(id, label, catalog.group === id, () => { catalog.group = id; catalog.category = ''; renderCatalogFilters(); })),
  );
  const categories = new Map<string, number>();
  for (const info of state.assets) if (catalog.group === 'all' || info.group === catalog.group) categories.set(info.category, (categories.get(info.category) ?? 0) + 1);
  $('catalog-categories').replaceChildren(...(catalog.group === 'recent' ? [] : [
    chip('', 'Todas', !catalog.category, () => { catalog.category = ''; renderCatalogFilters(); }),
    ...[...categories].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([category, count]) => chip(category, `${category} ${count}`, catalog.category === category, () => { catalog.category = category; renderCatalogFilters(); })),
  ]));
  catalog.limit = 240;
  renderCatalogGrid();
}

function filteredAssets() {
  const words = normalize(catalog.query).split(/\s+/).filter(Boolean).map(word => [word, ...(SYNONYMS[word] ?? SYNONYMS[word.replace(/e?s$/, '')] ?? [])]);
  const base = catalog.group === 'recent' ? recent.map(id => state.assetById.get(id)).filter(info => !!info) : state.assets;
  return base.filter(info => (catalog.group === 'all' || catalog.group === 'recent' || info.group === catalog.group)
    && (!catalog.category || info.category === catalog.category)
    && words.every(options => { const text = searchIndex.get(info.id) ?? ''; return options.some(word => text.includes(word)); }));
}

export function renderCatalogGrid() {
  const list = filteredAssets();
  $('catalog-count').textContent = `${list.length} recursos · clic: colocar · Ctrl+clic: dispersar · arrastra al mapa`;
  const grid = $('catalog-grid');
  grid.replaceChildren(...list.slice(0, catalog.limit).map(info => {
    const image = el('img', { alt: '', draggable: false, loading: 'lazy' });
    lazyThumb(image, info.id);
    const card = el('button', {
      type: 'button', class: `asset${placement.asset === info.id ? ' selected' : ''}${scatter.assets.has(info.id) ? ' scatter' : ''}`,
      title: `${info.name}\n${info.id}\n${info.groupLabel} · ${info.category}`, draggable: true, 'data-asset': info.id,
    }, image, el('span', {}, info.name));
    card.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey) toggleScatterAsset(info.id);
      else { remember(info.id); chooseAsset(info.id); }
    });
    card.addEventListener('dragstart', event => { event.dataTransfer?.setData('text/x-brumaluz-asset', info.id); event.dataTransfer!.effectAllowed = 'copy'; });
    return card;
  }));
  if (list.length > catalog.limit) {
    grid.append(el('button', { type: 'button', class: 'more', onclick: () => { catalog.limit += 240; renderCatalogGrid(); } }, `Mostrar más (${list.length - catalog.limit})`));
  }
}
function markCatalogSelection() {
  for (const card of document.querySelectorAll<HTMLElement>('#catalog-grid .asset')) {
    card.classList.toggle('selected', card.dataset.asset === placement.asset);
    card.classList.toggle('scatter', scatter.assets.has(card.dataset.asset!));
  }
}

// ---------------------------------------------------------------------------
// Capas
// ---------------------------------------------------------------------------

export function renderLayers() {
  const box = $('layers');
  box.replaceChildren(...state.doc.layers.map(layer => {
    const count = state.doc.objects.filter(object => object.layer === layer.id).length
      + state.doc.colliders.filter(item => item.layer === layer.id).length + state.doc.markers.filter(item => item.layer === layer.id).length;
    const name = el('input', { value: layer.name, title: `${layer.id} · ${count} elementos`, maxLength: 60 });
    name.addEventListener('change', () => { layer.name = name.value.trim() || layer.id; commit('Renombrar capa'); renderLayers(); });
    return el('div', { class: `layer${state.activeLayer === layer.id ? ' active' : ''}` },
      el('button', { type: 'button', title: layer.visible ? 'Ocultar' : 'Mostrar', onclick: () => { layer.visible = !layer.visible; syncScene(); commit(layer.visible ? 'Mostrar capa' : 'Ocultar capa'); renderLayers(); } }, layer.visible ? '👁' : '—'),
      el('button', { type: 'button', title: layer.locked ? 'Desbloquear' : 'Bloquear', onclick: () => { layer.locked = !layer.locked; setSelection([...state.selection].filter(key => entity(key)?.data.layer !== layer.id)); commit(layer.locked ? 'Bloquear capa' : 'Desbloquear capa'); renderLayers(); } }, layer.locked ? '🔒' : '🔓'),
      name,
      el('span', { class: 'row' },
        el('button', { type: 'button', title: 'Seleccionar su contenido', onclick: () => selectLayer(layer.id) }, String(count)),
        el('button', { type: 'button', class: 'danger', title: 'Eliminar capa (su contenido pasa a la primera)', disabled: state.doc.layers.length <= 1, onclick: () => deleteLayer(layer.id) }, '×')),
    );
  }));
  const active = $<HTMLSelectElement>('active-layer');
  active.replaceChildren(el('option', { value: 'auto' }, 'Automática (según tipo)'), ...state.doc.layers.map(layer => el('option', { value: layer.id }, layer.name)));
  active.value = state.activeLayer;
}
function selectLayer(id: string) {
  const layer = layerOf(id);
  if (!layer || layer.locked || !layer.visible) return;
  setSelection([
    ...state.doc.objects.filter(item => item.layer === id && !item.locked && !item.hidden).map(item => `o:${item.id}`),
    ...state.doc.colliders.filter(item => item.layer === id).map(item => `c:${item.id}`),
    ...state.doc.markers.filter(item => item.layer === id).map(item => `m:${item.id}`),
  ]);
}
function deleteLayer(id: string) {
  const index = state.doc.layers.findIndex(layer => layer.id === id);
  if (index < 0 || state.doc.layers.length <= 1) return;
  state.doc.layers.splice(index, 1);
  const fallback = state.doc.layers[0].id;
  for (const list of [state.doc.objects, state.doc.colliders, state.doc.markers]) for (const item of list) if (item.layer === id) item.layer = fallback;
  if (state.activeLayer === id) state.activeLayer = 'auto';
  syncScene(); commit('Eliminar capa'); renderLayers();
}
export function addLayer() {
  if (state.doc.layers.length >= 64) return;
  let n = state.doc.layers.length + 1, id = `capa${n}`;
  while (layerOf(id)) id = `capa${++n}`;
  state.doc.layers.push({ id, name: `Capa ${n}`, visible: true, locked: false });
  state.activeLayer = id;
  commit('Nueva capa'); renderLayers();
}

// ---------------------------------------------------------------------------
// Lista de elementos
// ---------------------------------------------------------------------------

const KIND_ICON = { o: '▪', c: '▣', m: '⚑' } as const;
const OUTLINER_LIMIT = 600;
export function entityLabel(item: Entity) {
  if (item.kind === 'o') return item.data.name || state.assetById.get(item.data.asset)?.name || item.data.asset;
  if (item.kind === 'c') return item.data.name || (item.data.shape === 'box' ? 'Caja de colisión' : 'Cilindro de colisión');
  return `${item.data.name} · ${MARKER_LABELS[item.data.type]}`;
}
let outlinerFrame = 0;
export function renderOutliner() {
  cancelAnimationFrame(outlinerFrame);
  outlinerFrame = requestAnimationFrame(() => {
    if ($('outliner').closest('section')?.hidden) return;
    const query = normalize(($('outliner-search') as HTMLInputElement).value.trim());
    const items: Entity[] = [
      ...state.doc.markers.map(data => ({ kind: 'm' as const, key: `m:${data.id}`, data })),
      ...state.doc.colliders.map(data => ({ kind: 'c' as const, key: `c:${data.id}`, data })),
      ...state.doc.objects.map(data => ({ kind: 'o' as const, key: `o:${data.id}`, data })),
    ];
    const matches = query ? items.filter(item => normalize(`${entityLabel(item)} ${item.data.id} ${item.kind === 'o' ? item.data.asset : item.kind === 'm' ? item.data.type : item.data.shape}`).includes(query)) : items;
    const box = $('outliner');
    box.replaceChildren(...matches.slice(0, OUTLINER_LIMIT).map(item => {
      const flags = item.kind === 'o' ? `${item.data.locked ? '🔒' : ''}${item.data.hidden ? '◌' : ''}` : '';
      const row = el('div', { class: `item${state.selection.has(item.key) ? ' selected' : ''}`, 'data-key': item.key, title: item.data.id },
        el('span', { class: 'kind' }, KIND_ICON[item.kind]), el('span', { class: 'name' }, entityLabel(item)), flags && el('span', {}, flags));
      row.addEventListener('click', event => {
        const next = new Set(event.shiftKey || event.ctrlKey ? state.selection : []);
        if ((event.shiftKey || event.ctrlKey) && next.has(item.key)) next.delete(item.key); else next.add(item.key);
        setSelection(next);
      });
      row.addEventListener('dblclick', () => focusSelection());
      return row;
    }));
    if (matches.length > OUTLINER_LIMIT) box.append(el('p', { class: 'hint' }, `…y ${matches.length - OUTLINER_LIMIT} más. Filtra para encontrarlos.`));
  });
}

/** Encuadra la selección con la cámara (F). */
export function focusSelection() {
  const items = [...state.selection].map(entity).filter((item): item is Entity => !!item);
  if (!items.length) return;
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const item of items) box.expandByPoint(entityPosition(item, point));
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(6, box.getSize(point).length() * 0.8);
  const direction = camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, radius * 1.8);
}

export function initLeftPanel() {
  for (const tab of document.querySelectorAll<HTMLButtonElement>('#left [data-tab]')) {
    tab.addEventListener('click', () => {
      for (const other of document.querySelectorAll<HTMLButtonElement>('#left [data-tab]')) other.setAttribute('aria-selected', String(other === tab));
      for (const panel of document.querySelectorAll<HTMLElement>('#left [data-panel]')) panel.hidden = panel.dataset.panel !== tab.dataset.tab;
      if (tab.dataset.tab === 'outliner') { renderLayers(); renderOutliner(); }
    });
  }
  const search = $<HTMLInputElement>('catalog-search');
  let timer = 0;
  search.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => { catalog.query = search.value; catalog.limit = 240; renderCatalogGrid(); }, 120); });
  $('outliner-search').addEventListener('input', renderOutliner);
  $<HTMLSelectElement>('active-layer').addEventListener('change', event => { state.activeLayer = (event.target as HTMLSelectElement).value; renderLayers(); });
  document.querySelector('[data-action="add-layer"]')?.addEventListener('click', addLayer);
  placementEvents.add(markCatalogSelection);
  events.selection.add(renderOutliner);
  events.changed.add(renderOutliner);
  events.document.add(() => { renderLayers(); renderOutliner(); });
  // Arrastrar desde el catálogo y soltar en el mapa.
  const viewport = $('viewport');
  viewport.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('text/x-brumaluz-asset')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
  viewport.addEventListener('drop', event => {
    const id = event.dataTransfer?.getData('text/x-brumaluz-asset');
    if (!id) return;
    event.preventDefault();
    const rect = viewport.querySelector('canvas')!.getBoundingClientRect();
    const ndc = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hit = rayTerrain(raycaster.ray);
    if (hit) { remember(id); dropAsset(id, hit); }
  });
}

import * as THREE from 'three';
import {
  COLLISION_MODES, GROUND_MATERIALS, MARKER_TYPES, MAP_KINDS, MAP_KIND_LABELS, MAX_TERRAIN_VERTICES, SKY_PRESETS, resampleTerrain,
  type MapCollider, type MapMarker, type MapObject, type Vec3,
} from '../../data/maps';
import { MARKER_LABELS } from './overlays';
import {
  $, commit, el, environment, events, markerLayer, provider, rebuildGrass, removeEntities, selected, setSelection, setTerrain,
  state, syncScene, status, type Entity,
} from './core';
import { chooseAsset, npcChoices, placement } from './place';
import { dropSelection, duplicateSelection, updateGizmo } from './tools';
import { entityLabel, renderLayers } from './catalog';
import { thumbnail } from './thumbnails';
import { listMaps, loadMap, saveMap } from './store';
import { mapFireflies, mapSummary, newMap, type MapSummary } from '../../data/maps';
import { brumaluzGateMarkers } from '../../data/pompelin';

// Panel derecho: propiedades de la selección y ajustes generales del mapa.

const DEG = 180 / Math.PI;
const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
const COLLISION_LABELS: Record<string, string> = { auto: 'Automática (caja del modelo)', none: 'Sin colisión', box: 'Caja', circle: 'Círculo' };
const SKY_LABELS: Record<string, string> = { day: 'Día', sunset: 'Atardecer', dusk: 'Anochecer', night: 'Noche', overcast: 'Nublado' };

function apply(label: string, mutate: () => void) {
  mutate();
  syncScene();
  commit(label);
  updateGizmo();
  renderProperties();
}
const field = (label: string, ...control: (Node | string)[]) => el('label', {}, el('span', {}, label), ...(control.length > 1 ? [el('span', { class: 'row' }, ...control)] : control));
function text(value: string, set: (value: string) => void, attrs: Record<string, unknown> = {}) {
  const input = el('input', { type: 'text', value, ...attrs });
  input.addEventListener('change', () => set(input.value));
  return input;
}
function number(value: number, set: (value: number) => void, step = 0.1, attrs: Record<string, unknown> = {}) {
  const input = el('input', { type: 'number', value: String(round(value)), step, ...attrs });
  input.addEventListener('change', () => { if (input.value !== '' && Number.isFinite(Number(input.value))) set(Number(input.value)); });
  return input;
}
function vec(value: readonly number[], set: (value: Vec3) => void, step = 0.1, scale = 1) {
  const inputs = [0, 1, 2].map(i => el('input', { type: 'number', step, value: String(round(value[i] * scale)) }));
  for (const input of inputs) input.addEventListener('change', () => {
    const next = inputs.map(item => Number(item.value) / scale);
    if (next.every(Number.isFinite)) set(next as Vec3);
  });
  return el('div', { class: 'vec' }, ...inputs);
}
function check(value: boolean, set: (value: boolean) => void) {
  const input = el('input', { type: 'checkbox', checked: value });
  input.addEventListener('change', () => set(input.checked));
  return input;
}
function choice<T extends string>(value: T, options: readonly (readonly [T, string])[], set: (value: T) => void) {
  const select = el('select', {}, ...options.map(([id, label]) => el('option', { value: id, selected: id === value }, label)));
  select.addEventListener('change', () => set(select.value as T));
  return select;
}
const layerChoice = (value: string, set: (value: string) => void) => choice(value, state.doc.layers.map(layer => [layer.id, layer.name] as const), set);

function actions(items: Entity[]) {
  return el('div', { class: 'row wrap' },
    el('button', { type: 'button', title: 'G', onclick: dropSelection }, 'Asentar en el suelo'),
    el('button', { type: 'button', title: 'Ctrl+D', onclick: () => duplicateSelection() }, 'Duplicar'),
    el('button', { type: 'button', title: 'F', onclick: () => $('viewport').dispatchEvent(new CustomEvent('focus-selection')) }, 'Enfocar'),
    el('button', { type: 'button', class: 'danger', title: 'Supr', onclick: () => { removeEntities(items.map(item => item.key)); syncScene(); commit('Borrar'); setSelection([]); } }, 'Borrar'));
}

function objectProps(object: MapObject) {
  const info = state.assetById.get(object.asset);
  const preview = el('img', { class: 'preview-thumb', alt: '' });
  thumbnail(object.asset).then(url => { preview.src = url; }).catch(() => preview.remove());
  return [
    el('div', { class: 'title' }, entityLabel({ kind: 'o', key: `o:${object.id}`, data: object })),
    preview,
    el('div', { class: 'asset-id' }, `${object.asset} · ${object.id}`),
    field('Nombre', text(object.name ?? '', value => apply('Nombre', () => { object.name = value.trim() || undefined; }), { placeholder: info?.name ?? '' })),
    field('Capa', layerChoice(object.layer, value => apply('Capa', () => { object.layer = value; }))),
    field(object.conform ? 'Posición (y: sobre el suelo)' : 'Posición', vec(object.position, value => apply('Mover', () => { object.position = value; }))),
    field('Rotación (°)', vec(object.rotation, value => apply('Rotar', () => { object.rotation = value; }), 5, DEG)),
    field('Escala', vec(object.scale, value => apply('Escalar', () => { object.scale = value.map(v => Math.max(0.01, v)) as Vec3; }), 0.05)),
    field('Escala uniforme', number(1, value => apply('Escalar', () => { object.scale = object.scale.map(v => Math.max(0.01, v * value)) as Vec3; }), 0.05, { title: 'Multiplica la escala actual' })),
    field('Colisión', choice(object.collision, COLLISION_MODES.map(mode => [mode, COLLISION_LABELS[mode]] as const), value => apply('Colisión', () => { object.collision = value; }))),
    field('Transitable', choice(object.walkable === undefined ? 'auto' : object.walkable ? 'yes' : 'no', [['auto', 'Automático (según altura)'], ['yes', 'Sí, se puede subir'], ['no', 'No']] as const,
      value => apply('Transitable', () => { object.walkable = value === 'auto' ? undefined : value === 'yes'; }))),
    field('Pegar al relieve', check(!!object.conform, value => apply('Pegar al relieve', () => {
      const ground = state.field.heightAt(object.position[0], object.position[2]);
      object.position = [object.position[0], value ? object.position[1] - ground : object.position[1] + ground, object.position[2]];
      object.conform = value || undefined;
    }))),
    field('Tinte', el('input', { type: 'color', value: object.tint ?? '#ffffff', onchange: (event: Event) => apply('Tinte', () => { object.tint = (event.target as HTMLInputElement).value; }) }),
      el('button', { type: 'button', disabled: !object.tint, onclick: () => apply('Quitar tinte', () => { delete object.tint; }) }, 'Quitar')),
    field('Bloqueado', check(!!object.locked, value => apply(value ? 'Bloquear' : 'Desbloquear', () => { object.locked = value || undefined; if (value) state.selection.delete(`o:${object.id}`); }))),
    field('Oculto', check(!!object.hidden, value => apply(value ? 'Ocultar' : 'Mostrar', () => { object.hidden = value || undefined; }))),
    el('div', { class: 'row wrap' },
      el('button', { type: 'button', onclick: () => chooseAsset(object.asset) }, 'Colocar más como este'),
      el('button', { type: 'button', disabled: !placement.asset || placement.asset === object.asset, title: 'Sustituye el modelo por el recurso elegido en el catálogo',
        onclick: () => apply('Reemplazar recurso', () => { object.asset = placement.asset; }) }, 'Reemplazar por el elegido')),
  ];
}

function colliderProps(collider: MapCollider) {
  return [
    el('div', { class: 'title' }, entityLabel({ kind: 'c', key: `c:${collider.id}`, data: collider })),
    el('div', { class: 'asset-id' }, collider.id),
    field('Nombre', text(collider.name ?? '', value => apply('Nombre', () => { collider.name = value.trim() || undefined; }))),
    field('Capa', layerChoice(collider.layer, value => apply('Capa', () => { collider.layer = value; }))),
    field('Forma', choice(collider.shape, [['box', 'Caja'], ['cylinder', 'Cilindro']] as const, value => apply('Forma', () => { collider.shape = value; }))),
    field('Posición (base)', vec(collider.position, value => apply('Mover', () => { collider.position = value; }))),
    field('Giro (°)', number(collider.rotationY * DEG, value => apply('Rotar', () => { collider.rotationY = value / DEG; }), 5)),
    field(collider.shape === 'box' ? 'Tamaño' : 'Diámetro, alto', vec(collider.size, value => apply('Tamaño', () => { collider.size = value.map(v => Math.max(0.05, v)) as Vec3; }))),
    field('Plataforma', check(collider.walkable, value => apply('Plataforma', () => { collider.walkable = value; }))),
    el('p', { class: 'hint' }, collider.walkable ? 'El personaje puede subirse encima.' : 'Bloquea el paso del personaje.'),
  ];
}

function markerProps(marker: MapMarker) {
  return [
    el('div', { class: 'title' }, marker.name),
    el('div', { class: 'asset-id' }, marker.id),
    field('Nombre', text(marker.name, value => apply('Nombre', () => { marker.name = value.trim().slice(0, 80) || MARKER_LABELS[marker.type]; }))),
    field('Tipo', choice(marker.type, MARKER_TYPES.map(type => [type, MARKER_LABELS[type]] as const), value => apply('Tipo', () => { marker.type = value; }))),
    ...(marker.type === 'npc' ? [field('NPC', choice(marker.npcId ?? '', [['', '— genérico —'], ...npcChoices.map(npc => [npc.id, npc.name] as const)], value => apply('NPC', () => {
      marker.npcId = value || undefined;
      const npc = npcChoices.find(item => item.id === value);
      if (npc && /^NPC \d+$/.test(marker.name)) marker.name = npc.name;
    })))] : []),
    ...(marker.type === 'portal' ? [portalProps(marker)] : []),
    ...(marker.type === 'arrival' ? [el('p', { class: 'hint' }, 'Punto de llegada desde otro mapa. Sitúalo fuera del radio de la salida para que el jugador no rebote. La flecha indica hacia dónde mira.')] : []),
    field('Capa', layerChoice(marker.layer, value => apply('Capa', () => { marker.layer = value; }))),
    field('Posición', vec(marker.position, value => apply('Mover', () => { marker.position = value; }))),
    field('Orientación (°)', number(marker.rotationY * DEG, value => apply('Rotar', () => { marker.rotationY = value / DEG; }), 5)),
    field(marker.type === 'light' ? 'Alcance (m)' : 'Radio (m)', number(marker.radius, value => apply('Radio', () => { marker.radius = Math.max(0, Math.min(500, value)); }), 0.5)),
    field('Color', el('input', { type: 'color', value: marker.color ?? '#ffffff', onchange: (event: Event) => apply('Color', () => { marker.color = (event.target as HTMLInputElement).value; }) }),
      el('button', { type: 'button', disabled: !marker.color, onclick: () => apply('Color', () => { delete marker.color; }) }, 'Por defecto')),
    field('Texto / datos', (() => {
      const area = el('textarea', { rows: 3, maxLength: 2000, placeholder: 'Notas, ID de misión, diálogo…' }, marker.text ?? '');
      area.addEventListener('change', () => apply('Texto', () => { marker.text = area.value || undefined; }));
      return area;
    })()),
  ];
}

function portalProps(marker: MapMarker) {
  const box = el('div', { class: 'portal-properties' });
  const render = (maps: MapSummary[]) => {
    if (!box.isConnected && selected()[0]?.data !== marker) return;
    const target = maps.find(map => map.id === marker.target?.map);
    const arrivals = target?.arrivals ?? [];
    const options: [string, string][] = [['', '— elige un mapa —'], ...maps.map(map => [map.id, `${map.name} (${MAP_KIND_LABELS[map.kind]})`] as [string, string])];
    if (marker.target && !target) options.push([marker.target.map, `${marker.target.map} (no disponible)`]);
    box.replaceChildren(
      field('Mapa de destino', choice(marker.target?.map ?? '', options, value => apply('Destino del portal', () => {
        marker.target = value ? { map: value } : undefined;
      }))),
      field('Llegada', choice(marker.target?.arrival ?? '', [
        ['', 'Aparición principal'], ...arrivals.map(arrival => [arrival.id, arrival.name] as [string, string]),
        ...(marker.target?.arrival && !arrivals.some(arrival => arrival.id === marker.target?.arrival) ? [[marker.target.arrival, `${marker.target.arrival} (no encontrada)`] as [string, string]] : []),
      ], value => apply('Llegada del portal', () => { if (marker.target) marker.target.arrival = value || undefined; }))),
      field('Activación', choice(marker.trigger ?? 'walk', [['walk', 'Al caminar dentro'], ['interact', 'Pulsar E (sin confirmación)']], value => apply('Activación', () => { marker.trigger = value; }))),
      el('p', { class: 'hint' }, 'El radio marca la zona de salida. Publica también el destino para habilitar el viaje en el juego.'),
      el('button', { type: 'button', disabled: !target?.revision || target.id === state.doc.id, onclick: async () => {
        if (!marker.target) return;
        if (!confirm('Se guardarán ambos mapas y se añadirán llegadas y una salida de regreso. Después podrás moverlas visualmente. ¿Continuar?')) return;
        try {
          const source = state.doc;
          const docs = await import('./docs');
          if (!await docs.save()) return;
          if (state.doc !== source || !source.markers.includes(marker)) throw new Error('El mapa o el portal cambiaron durante el guardado. Vuelve a seleccionarlo.');
          const { map: destination, revision } = await loadMap(marker.target.map);
          if (destination.markers.length + 2 > 3000 || state.doc.markers.length + 1 > 3000) throw new Error('Límite de marcadores alcanzado.');
          const spawn = destination.markers.find(item => item.type === 'spawn');
          const base = spawn?.position ?? [0, 0, 0];
          const layer = destination.layers.find(item => item.visible && !item.locked);
          if (!layer) throw new Error('El mapa de destino no tiene ninguna capa visible y desbloqueada.');
          const uid = () => `link_${crypto.randomUUID().slice(0, 8)}`;
          const sourceArrival = uid(), targetArrival = uid();
          destination.markers.push(
            { id: targetArrival, type: 'arrival', name: `Desde ${state.doc.name}`, layer: layer.id, position: [...base], rotationY: spawn?.rotationY ?? 0, radius: 1 },
            { id: uid(), type: 'portal', name: `Volver a ${state.doc.name}`, layer: layer.id, position: [base[0] + 7, base[1], base[2]], rotationY: 0, radius: 2, trigger: 'interact', target: { map: state.doc.id, arrival: sourceArrival } },
          );
          destination.updatedAt = new Date().toISOString();
          await saveMap(destination, revision);
          if (state.doc !== source || !source.markers.includes(marker)) throw new Error('El destino se guardó, pero el mapa actual ha cambiado. Reabre el origen antes de conectarlo.');
          apply('Conectar ida y vuelta', () => {
            state.doc.markers.push({ id: sourceArrival, type: 'arrival', name: `Desde ${destination.name}`, layer: marker.layer,
              position: [marker.position[0] - Math.sin(marker.rotationY) * (marker.radius + 3), marker.position[1], marker.position[2] - Math.cos(marker.rotationY) * (marker.radius + 3)],
              rotationY: marker.rotationY, radius: 1 });
            marker.target = { map: destination.id, arrival: targetArrival };
          });
          if (!await docs.save()) throw new Error('El destino se guardó; falta guardar el mapa actual con sus nuevas llegadas.');
          status('Ida y vuelta conectadas. Abre el destino para colocar su portal donde quieras. Publica ambos mapas.');
        } catch (error) { status(`No se pudo conectar: ${(error as Error).message}`, 'error'); }
      } }, 'Conectar ida y vuelta'),
      el('button', { type: 'button', disabled: !target?.revision || target.id === state.doc.id, onclick: async () => {
        if (!marker.target) return;
        try { const docs = await import('./docs'); await docs.openById(marker.target.map); }
        catch (error) { status(`No se pudo abrir el destino: ${(error as Error).message}`, 'error'); }
      } }, 'Abrir destino'),
    );
  };
  box.append(el('p', { class: 'hint' }, 'Cargando destinos…'));
  void listMaps().then(entries => {
    const maps = entries.filter((entry): entry is MapSummary => !('error' in entry));
    const current = mapSummary(state.doc, state.revision ?? '');
    if (current.id !== 'brumaluz' && !maps.some(map => map.id === 'brumaluz')) {
      const capital = newMap('brumaluz', 'Brumaluz (capital procedural)', { width: 4, depth: 4 });
      capital.settings.kind = 'city'; capital.markers = brumaluzGateMarkers();
      maps.push(mapSummary(capital, ''));
    }
    render([...maps.filter(map => map.id !== current.id), current]);
  }).catch(error => box.replaceChildren(el('p', { class: 'error' }, `No se pudieron cargar los destinos: ${error.message}`)));
  return box;
}

function multiProps(items: Entity[]) {
  const objects = items.filter((item): item is Extract<Entity, { kind: 'o' }> => item.kind === 'o').map(item => item.data);
  const counts = { o: objects.length, c: items.filter(item => item.kind === 'c').length, m: items.filter(item => item.kind === 'm').length };
  return [
    el('div', { class: 'title' }, `${items.length} elementos`),
    el('p', { class: 'hint' }, `${counts.o} objetos · ${counts.c} colisionadores · ${counts.m} marcadores`),
    field('Capa', choice('', [['', '— cambiar —'], ...state.doc.layers.map(layer => [layer.id, layer.name] as const)], value => { if (value) apply('Capa', () => { for (const item of items) item.data.layer = value; }); })),
    ...(objects.length ? [
      field('Colisión', choice('', [['', '— cambiar —'], ...COLLISION_MODES.map(mode => [mode, COLLISION_LABELS[mode]] as const)] as const, value => { if (value) apply('Colisión', () => { for (const object of objects) object.collision = value; }); })),
      field('Escala ×', number(1, value => apply('Escalar', () => { for (const object of objects) object.scale = object.scale.map(v => Math.max(0.01, v * value)) as Vec3; }), 0.05)),
      field('Tinte', el('input', { type: 'color', value: '#ffffff', onchange: (event: Event) => apply('Tinte', () => { for (const object of objects) object.tint = (event.target as HTMLInputElement).value; }) }),
        el('button', { type: 'button', onclick: () => apply('Quitar tinte', () => { for (const object of objects) delete object.tint; }) }, 'Quitar')),
      el('div', { class: 'row wrap' },
        el('button', { type: 'button', onclick: () => apply('Bloquear', () => { for (const object of objects) object.locked = true; state.selection.clear(); }) }, 'Bloquear'),
        el('button', { type: 'button', onclick: () => apply('Ocultar', () => { for (const object of objects) object.hidden = true; }) }, 'Ocultar'),
        el('button', { type: 'button', onclick: () => apply('Mostrar', () => { for (const object of objects) delete object.hidden; }) }, 'Mostrar'),
        el('button', { type: 'button', onclick: () => apply('Giro aleatorio', () => { for (const object of objects) object.rotation = [object.rotation[0], Math.random() * Math.PI * 2, object.rotation[2]]; }) }, 'Giro aleatorio')),
    ] : []),
  ];
}

function emptyProps() {
  const doc = state.doc;
  const locked = doc.objects.filter(object => object.locked).length;
  return [
    el('div', { class: 'title' }, 'Nada seleccionado'),
    el('p', { class: 'hint' }, 'Clic en un elemento para seleccionarlo, Mayús+clic para añadir, o arrastra en vacío para seleccionar por caja.'),
    el('p', { class: 'hint' }, `${doc.objects.length} objetos · ${doc.colliders.length} colisionadores · ${doc.markers.length} marcadores`),
    ...(locked ? [el('button', { type: 'button', onclick: () => apply('Desbloquear todo', () => { for (const object of doc.objects) delete object.locked; }) }, `Desbloquear ${locked} objetos`)] : []),
  ];
}

let frame = 0;
export function renderProperties() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const items = selected();
    const box = $('properties');
    // No rehacer el panel mientras se escribe en él.
    if (box.contains(document.activeElement) && document.activeElement?.matches('input[type=text], textarea')) return;
    const body = items.length === 0 ? emptyProps()
      : items.length > 1 ? [...multiProps(items), actions(items)]
        : [...(items[0].kind === 'o' ? objectProps(items[0].data) : items[0].kind === 'c' ? colliderProps(items[0].data) : markerProps(items[0].data)), actions(items)];
    box.replaceChildren(el('div', { class: 'props' }, ...body));
  });
}

// ---------------------------------------------------------------------------
// Ajustes del mapa
// ---------------------------------------------------------------------------

function settingsChanged(label: string, grassToo = false) {
  environment.apply(state.doc.settings, state.field);
  if (state.doc.settings.clouds) void environment.setClouds(provider, state.field);
  if (grassToo) rebuildGrass();
  commit(label);
}
export function renderMapSettings() {
  const doc = state.doc, s = doc.settings;
  const width = (state.field.columns - 1) * state.field.cell, depth = (state.field.rows - 1) * state.field.cell;
  const size = { width, depth, cell: state.field.cell };
  const description = el('textarea', { rows: 3, maxLength: 2000 }, doc.description);
  description.addEventListener('change', () => { doc.description = description.value; commit('Descripción'); });
  const vertices = () => (Math.round(size.width / size.cell) + 1) * (Math.round(size.depth / size.cell) + 1);
  const resizeNote = el('p', { class: 'hint' });
  const updateNote = () => {
    const count = vertices();
    resizeNote.textContent = `${count.toLocaleString('es')} vértices${count > MAX_TERRAIN_VERTICES ? ' — demasiados' : ''}. Los objetos no se mueven; el relieve se conserva centrado.`;
  };
  updateNote();
  const fillMaterial = el('select', {}, ...GROUND_MATERIALS.map((material, index) => el('option', { value: String(index) }, material.label)));
  $('map-settings').replaceChildren(el('div', { class: 'props' },
    el('div', { class: 'title' }, doc.name),
    el('div', { class: 'asset-id' }, `${doc.id}.json${state.savedId ? '' : ' · sin guardar todavía'}`),
    field('Nombre', text(doc.name, value => { doc.name = value.trim().slice(0, 80) || doc.name; commit('Nombre del mapa'); renderMapSettings(); for (const listener of events.dirty) listener(); }, { maxLength: 80 })),
    field('Descripción', description),
    el('h3', {}, 'Lugar de Pompelín'),
    field('Tipo', choice(s.kind ?? 'zone', MAP_KINDS.map(kind => [kind, MAP_KIND_LABELS[kind]] as const), value => { s.kind = value; commit('Tipo de mapa'); })),
    field('Región', text(s.region ?? '', value => { s.region = value.slice(0, 80); commit('Región'); }, { maxLength: 80, placeholder: 'Pompelín central' })),
    field('Consejo al cargar', text(s.loadingTip ?? '', value => { s.loadingTip = value.slice(0, 300); commit('Consejo al cargar'); }, { maxLength: 300 })),
    el('p', { class: 'hint' }, 'Pompelín es el mundo y Brumaluz su capital. Usa marcadores Portal y Llegada para conectar ciudades, exteriores e interiores. La miniatura guardada sirve como fondo de carga.'),
    el('h3', {}, 'Ambiente'),
    field('Cielo', choice(s.sky, SKY_PRESETS.map(sky => [sky, SKY_LABELS[sky]] as const), value => { s.sky = value; settingsChanged('Cielo'); })),
    field('Niebla', (() => { const input = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: String(s.fog) }); input.addEventListener('input', () => { s.fog = Number(input.value); environment.apply(s, state.field); }); input.addEventListener('change', () => commit('Niebla')); return input; })()),
    field('Nubes', check(s.clouds, value => { s.clouds = value; settingsChanged('Nubes'); })),
    field('Luciérnagas', check(mapFireflies(s), value => { s.fireflies = value; commit('Luciérnagas'); })),
    field('Bordes cerrados', check(s.bounded, value => { s.bounded = value; settingsChanged('Bordes'); })),
    el('h3', {}, 'Agua'),
    field('Agua', check(s.water.enabled, value => { s.water.enabled = value; settingsChanged('Agua', true); renderMapSettings(); })),
    ...(s.water.enabled ? [
      field('Nivel (m)', number(s.water.level, value => { s.water.level = value; settingsChanged('Nivel del agua', true); }, 0.05)),
      field('Color', el('input', { type: 'color', value: s.water.color, onchange: (event: Event) => { s.water.color = (event.target as HTMLInputElement).value; settingsChanged('Color del agua'); } })),
      field('Opacidad', (() => { const input = el('input', { type: 'range', min: 0.1, max: 1, step: 0.02, value: String(s.water.opacity) }); input.addEventListener('input', () => { s.water.opacity = Number(input.value); environment.apply(s, state.field); }); input.addEventListener('change', () => commit('Opacidad del agua')); return input; })()),
    ] : []),
    el('h3', {}, 'Terreno'),
    el('p', { class: 'hint' }, `${width} × ${depth} m · celda ${state.field.cell} m · alturas ${state.terrainMin.toFixed(1)} a ${state.terrainMax.toFixed(1)} m`),
    field('Ancho, fondo', number(width, value => { size.width = value; updateNote(); }, 8, { min: 8, max: 10000 }), number(depth, value => { size.depth = value; updateNote(); }, 8, { min: 8, max: 10000 })),
    field('Celda', choice(String(state.field.cell), [['0.5', '0,5 m'], ['1', '1 m'], ['2', '2 m'], ['4', '4 m'], ['8', '8 m · continente'], ['16', '16 m · gran extensión']] as const, value => { size.cell = Number(value); updateNote(); })),
    resizeNote,
    el('button', { type: 'button', onclick: () => {
      if (vertices() > MAX_TERRAIN_VERTICES) { status('Terreno demasiado grande para esa celda. Usa una celda mayor.', 'error'); return; }
      const width = THREE.MathUtils.clamp(size.width, 8, 10000), depth = THREE.MathUtils.clamp(size.depth, 8, 10000);
      setTerrain(resampleTerrain(state.field.data, width, depth, size.cell));
      markerLayer.sync(state.doc.markers, state.doc.layers, state.field);
      syncScene(); commit('Redimensionar terreno', true); renderMapSettings();
    } }, 'Aplicar tamaño'),
    field('Rellenar suelo', fillMaterial, el('button', { type: 'button', onclick: () => {
      state.field.data.paint.fill(Number(fillMaterial.value)); state.surface?.update(); commit('Rellenar suelo', true);
    } }, 'Pintar todo')),
    field('Hierba', el('button', { type: 'button', onclick: () => { state.field.data.grass.fill(0); rebuildGrass(); commit('Quitar hierba', true); } }, 'Quitar toda'),
      el('button', { type: 'button', onclick: () => { state.field.data.grass.fill(140); rebuildGrass(); commit('Llenar de hierba', true); } }, 'Llenar')),
    field('Relieve', el('button', { type: 'button', onclick: () => {
      state.field.data.heights.fill(0); setTerrain(state.field.data); syncScene(); commit('Aplanar todo', true); renderMapSettings();
    } }, 'Aplanar todo a 0')),
    el('h3', {}, 'Capas'),
    el('p', { class: 'hint' }, 'Gestiona capas desde la pestaña «Escena» del panel izquierdo.'),
    el('button', { type: 'button', onclick: () => { document.querySelector<HTMLButtonElement>('#left [data-tab="outliner"]')?.click(); renderLayers(); } }, 'Ir a capas'),
  ));
}

export function initRightPanel() {
  for (const tab of document.querySelectorAll<HTMLButtonElement>('#right [data-tab]')) {
    tab.addEventListener('click', () => {
      for (const other of document.querySelectorAll<HTMLButtonElement>('#right [data-tab]')) other.setAttribute('aria-selected', String(other === tab));
      for (const panel of document.querySelectorAll<HTMLElement>('#right [data-panel]')) panel.hidden = panel.dataset.panel !== tab.dataset.tab;
      if (tab.dataset.tab === 'map') renderMapSettings();
    });
  }
  events.selection.add(renderProperties);
  events.changed.add(renderProperties);
  events.document.add(() => { renderProperties(); renderMapSettings(); });
}

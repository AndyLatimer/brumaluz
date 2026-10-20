import * as THREE from 'three';
import { GROUND_MATERIALS, type MapObject } from '../../data/maps';
import type { TerrainRegion } from '../../world/mapRuntime';
import { defaultScale } from '../../world/mapAssets';
import {
  checkLimits, commit, el, environment, layerFor, markerLayer, measureTerrain, objectLayer, pickable, rebuildGrass,
  reindex, removeEntities, scheduleCollision, state, status, syncScene, uid,
} from './core';
import { checkOption, pointer, rangeOption, registerTool, renderToolOptions, selectOption, setTool } from './tools';
import { placement, placementEvents } from './place';

// Pinceles: dispersar, borrar, esculpir el relieve, pintar el suelo y la hierba.

export const brush = { radius: 6, strength: 0.5, hardness: 0.4 };
const MAX_HEIGHT = 320;

function brushOptions() {
  return [
    rangeOption('Tamaño', brush.radius, 0.5, 60, 0.5, value => { brush.radius = value; }, v => `${v} m`),
    rangeOption('Fuerza', brush.strength, 0.02, 1, 0.02, value => { brush.strength = value; }, v => `${Math.round(v * 100)}%`),
    rangeOption('Dureza', brush.hardness, 0, 0.95, 0.05, value => { brush.hardness = value; }, v => `${Math.round(v * 100)}%`),
  ];
}
export function resizeBrush(factor: number) {
  brush.radius = THREE.MathUtils.clamp(Math.round(brush.radius * factor * 2) / 2, 0.5, 60);
  renderToolOptions();
}

// ---------------------------------------------------------------------------
// Terreno: región modificada y actualización diferida
// ---------------------------------------------------------------------------

let dirtyRegion: TerrainRegion | null = null;
let grassTimer = 0;
function touch(region: TerrainRegion) {
  const columns = state.field.columns, rows = state.field.rows;
  const grown = { i0: Math.max(0, region.i0 - 1), i1: Math.min(columns - 1, region.i1 + 1), j0: Math.max(0, region.j0 - 1), j1: Math.min(rows - 1, region.j1 + 1) };
  state.surface?.update(grown);
  dirtyRegion = dirtyRegion ? {
    i0: Math.min(dirtyRegion.i0, grown.i0), i1: Math.max(dirtyRegion.i1, grown.i1),
    j0: Math.min(dirtyRegion.j0, grown.j0), j1: Math.max(dirtyRegion.j1, grown.j1),
  } : grown;
}
function endTerrainStroke(label: string, grassNow = true) {
  if (!dirtyRegion) return;
  dirtyRegion = null;
  measureTerrain();
  clearTimeout(grassTimer);
  if (grassNow) rebuildGrass();
  markerLayer.sync(state.doc.markers, state.doc.layers, state.field);
  scheduleCollision();
  commit(label, true);
}

// ---------------------------------------------------------------------------
// Esculpir
// ---------------------------------------------------------------------------

type SculptMode = 'raise' | 'lower' | 'smooth' | 'flatten' | 'noise' | 'water';
export const sculpt = { mode: 'raise' as SculptMode, target: 0 };
const SCULPT_MODES: [SculptMode, string][] = [
  ['raise', '▲ Subir'], ['lower', '▼ Bajar'], ['smooth', '≈ Suavizar'], ['flatten', '▬ Aplanar'], ['noise', '⁂ Rugosidad'], ['water', '≋ Cauce'],
];
const noise = (x: number, z: number) => Math.sin(x * 0.71 + Math.sin(z * 0.37) * 2) * Math.cos(z * 0.63 + Math.sin(x * 0.29) * 2)
  + 0.5 * Math.sin(x * 1.9 + z * 1.3) * Math.cos(z * 2.1 - x * 0.7);

function applySculpt(dt: number) {
  const hit = pointer.ground;
  if (!hit) return;
  const field = state.field, heights = field.data.heights;
  let mode = sculpt.mode;
  if (pointer.shift) mode = 'smooth';
  else if (pointer.ctrl && mode === 'raise') mode = 'lower';
  else if (pointer.ctrl && mode === 'lower') mode = 'raise';
  const rate = brush.strength * dt;
  let snapshot: Float32Array | null = null;
  if (mode === 'smooth') snapshot = heights.slice();
  const columns = field.columns, rows = field.rows;
  const water = environment.waterLevel ?? state.doc.settings.water.level;
  const region = field.forEachInRadius(hit.x, hit.z, brush.radius, brush.hardness, (index, weight, i, j) => {
    const h = heights[index];
    let next = h;
    if (mode === 'raise') next = h + weight * rate * 8;
    else if (mode === 'lower') next = h - weight * rate * 8;
    else if (mode === 'flatten') next = h + (sculpt.target - h) * Math.min(1, weight * rate * 10);
    else if (mode === 'water') next = h + (water - 0.9 - h) * Math.min(1, weight * rate * 6);
    else if (mode === 'noise') next = h + noise(field.minX + i * field.cell, field.minZ + j * field.cell) * weight * rate * 3;
    else if (snapshot) {
      const a = snapshot[j * columns + Math.max(0, i - 1)], b = snapshot[j * columns + Math.min(columns - 1, i + 1)];
      const c = snapshot[Math.max(0, j - 1) * columns + i], d = snapshot[Math.min(rows - 1, j + 1) * columns + i];
      next = h + ((a + b + c + d) / 4 - h) * Math.min(1, weight * rate * 12);
    }
    heights[index] = THREE.MathUtils.clamp(Math.round(next * 100) / 100, -MAX_HEIGHT, MAX_HEIGHT);
    if (heights[index] < state.terrainMin) state.terrainMin = heights[index];
    if (heights[index] > state.terrainMax) state.terrainMax = heights[index];
  });
  touch(region);
}

registerTool({
  id: 'sculpt', icon: '⛰', shortcut: 't', label: 'Esculpir el relieve',
  brush: () => ({ radius: brush.radius, color: '#ffd27a' }),
  down() {
    if (pointer.alt && pointer.ground) {
      sculpt.target = Math.round(pointer.ground.y * 100) / 100;
      sculpt.mode = 'flatten';
      renderToolOptions();
      status(`Altura tomada: ${sculpt.target.toFixed(2)} m`);
      pointer.down = false;
      return;
    }
    if (sculpt.mode === 'flatten' && pointer.ground && pointer.ctrl) sculpt.target = pointer.ground.y;
    applySculpt(1 / 60);
  },
  frame: dt => applySculpt(Math.min(dt, 0.05)),
  up: () => endTerrainStroke('Esculpir'),
  options: () => [
    el('div', { class: 'swatches' }, ...SCULPT_MODES.map(([mode, label]) => el('button', {
      type: 'button', class: sculpt.mode === mode ? 'active' : '', onclick: () => { sculpt.mode = mode; renderToolOptions(); },
    }, label))),
    ...(sculpt.mode === 'flatten' ? [rangeOption('Altura', sculpt.target, -20, 60, 0.25, value => { sculpt.target = value; }, v => `${v} m`)] : []),
    ...brushOptions(),
    el('span', { class: 'hint' }, 'Ctrl invierte · Mayús suaviza · Alt+clic toma la altura · [ ] tamaño'),
  ],
});

// ---------------------------------------------------------------------------
// Pintar el suelo
// ---------------------------------------------------------------------------

export const paint = { material: 4, clearGrass: false };
function applyPaint() {
  const hit = pointer.ground;
  if (!hit) return;
  const data = state.field.data;
  const region = state.field.forEachInRadius(hit.x, hit.z, brush.radius, brush.hardness, (index, weight) => {
    // Borde granulado: más natural que un corte limpio.
    if (weight >= 0.98 || Math.random() < weight * (0.35 + brush.strength)) {
      data.paint[index] = paint.material;
      if (paint.clearGrass) data.grass[index] = 0;
    }
  });
  touch(region);
}
registerTool({
  id: 'paint', icon: '🖌', shortcut: 'p', label: 'Pintar el suelo',
  brush: () => ({ radius: brush.radius, color: GROUND_MATERIALS[paint.material]?.color ?? '#fff' }),
  down() {
    if (pointer.alt && pointer.ground) {
      const field = state.field;
      const i = Math.round(field.gridX(pointer.ground.x)), j = Math.round(field.gridZ(pointer.ground.z));
      paint.material = field.data.paint[field.index(i, j)] ?? 0;
      renderToolOptions();
      pointer.down = false;
      return;
    }
    applyPaint();
  },
  move: () => { if (pointer.down) applyPaint(); },
  up: () => endTerrainStroke('Pintar suelo', paint.clearGrass),
  options: () => [
    el('div', { class: 'swatches' }, ...GROUND_MATERIALS.map((material, index) => el('button', {
      type: 'button', class: paint.material === index ? 'active' : '', title: material.label,
      style: `background:${material.color};color:${index === 10 || index === 8 ? '#222' : '#fff'}`,
      onclick: () => { paint.material = index; renderToolOptions(); },
    }, material.label))),
    checkOption('Quitar hierba', paint.clearGrass, value => { paint.clearGrass = value; }),
    ...brushOptions(),
    el('span', { class: 'hint' }, 'Alt+clic toma el material'),
  ],
});

// ---------------------------------------------------------------------------
// Hierba
// ---------------------------------------------------------------------------

export const grassBrush = { target: 160 };
function applyGrass(dt: number) {
  const hit = pointer.ground;
  if (!hit) return;
  const data = state.field.data;
  const remove = pointer.ctrl;
  const region = state.field.forEachInRadius(hit.x, hit.z, brush.radius, brush.hardness, (index, weight) => {
    const current = data.grass[index];
    const goal = remove ? 0 : grassBrush.target;
    data.grass[index] = Math.round(current + (goal - current) * Math.min(1, weight * brush.strength * dt * 10));
  });
  touch(region);
  clearTimeout(grassTimer);
  grassTimer = window.setTimeout(rebuildGrass, 220);
}
registerTool({
  id: 'grass', icon: '🌿', shortcut: 'h', label: 'Hierba: añadir o quitar',
  brush: () => ({ radius: brush.radius, color: pointer.ctrl ? '#ff8a6a' : '#8be07a' }),
  down: () => applyGrass(1 / 30),
  frame: dt => applyGrass(Math.min(dt, 0.05)),
  up: () => endTerrainStroke('Hierba'),
  options: () => [
    rangeOption('Densidad', grassBrush.target, 0, 255, 5, value => { grassBrush.target = value; }, v => `${Math.round(v / 2.55)}%`),
    ...brushOptions(),
    el('span', { class: 'hint' }, 'Ctrl quita · la hierba no crece bajo el agua'),
  ],
});

// ---------------------------------------------------------------------------
// Dispersar
// ---------------------------------------------------------------------------

/** Recursos para dispersar (Ctrl+clic en el catálogo). Si está vacío se usa el recurso de «Colocar». */
export const scatter = { assets: new Set<string>(), density: 3, scaleMin: 0.8, scaleMax: 1.25, spacing: 1.5, avoidWater: true, tilt: 0 };
let scatterStroke: string[] = [];
let scatterLast: THREE.Vector3 | null = null;
let scatterClock = 0;
export function toggleScatterAsset(id: string) {
  if (scatter.assets.has(id)) scatter.assets.delete(id); else scatter.assets.add(id);
  for (const listener of placementEvents) listener();
  if (state.tool !== 'scatter' && scatter.assets.size) setTool('scatter');
  else if (state.tool === 'scatter') renderToolOptions();
}
function scatterPool() { return scatter.assets.size ? [...scatter.assets] : placement.asset ? [placement.asset] : []; }

function applyScatter() {
  const hit = pointer.ground;
  const pool = scatterPool();
  if (!hit || !pool.length) return;
  const r = brush.radius;
  const attempts = Math.max(1, Math.round(scatter.density * Math.PI * r * r / 100));
  const nearby = state.doc.objects.filter(object => Math.abs(object.position[0] - hit.x) < r + scatter.spacing && Math.abs(object.position[2] - hit.z) < r + scatter.spacing);
  const water = environment.waterLevel;
  let added = 0;
  for (let k = 0; k < attempts; k++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
    const x = hit.x + Math.cos(a) * d, z = hit.z + Math.sin(a) * d;
    if (!state.field.contains(x, z)) continue;
    const y = state.field.heightAt(x, z);
    if (scatter.avoidWater && water !== null && y < water + 0.05) continue;
    if (nearby.some(object => Math.hypot(object.position[0] - x, object.position[2] - z) < scatter.spacing)) continue;
    const limit = checkLimits({ objects: 1 });
    if (limit) { status(limit, 'error'); break; }
    const asset = pool[Math.floor(Math.random() * pool.length)];
    const info = state.assetById.get(asset);
    const base = info ? defaultScale(info) : [1, 1, 1];
    const s = scatter.scaleMin + Math.random() * (scatter.scaleMax - scatter.scaleMin);
    const tilt = scatter.tilt * Math.PI / 180;
    const object: MapObject = {
      id: uid('o'), asset, layer: layerFor(info, 'naturaleza'),
      position: [x, y - 0.02, z],
      rotation: [(Math.random() - 0.5) * tilt, Math.random() * Math.PI * 2, (Math.random() - 0.5) * tilt],
      scale: [base[0] * s, base[1] * s, base[2] * s], collision: 'auto',
    };
    state.doc.objects.push(object);
    nearby.push(object);
    scatterStroke.push(object.id);
    added++;
  }
  if (added) { reindex(); objectLayer.sync(state.doc.objects, state.doc.layers); }
}
registerTool({
  id: 'scatter', icon: '✲', shortcut: 'n', label: 'Dispersar (bosques, rocas, flores…)',
  brush: () => ({ radius: brush.radius, color: '#a6e07a' }),
  down() {
    if (!scatterPool().length) { status('Ctrl+clic en el catálogo para elegir qué dispersar.'); pointer.down = false; return; }
    scatterStroke = []; scatterLast = pointer.ground?.clone() ?? null; scatterClock = 0;
    applyScatter();
  },
  frame(dt) {
    scatterClock += dt;
    const moved = pointer.ground && scatterLast ? pointer.ground.distanceTo(scatterLast) : 0;
    if (moved > brush.radius * 0.6 || scatterClock > 0.35) {
      scatterClock = 0; scatterLast = pointer.ground?.clone() ?? null;
      applyScatter();
    }
  },
  up() {
    if (!scatterStroke.length) return;
    const count = scatterStroke.length;
    scatterStroke = [];
    syncScene();
    commit(`Dispersar ${count}`);
  },
  options() {
    const pool = scatterPool();
    return [
      el('strong', {}, pool.length ? `${pool.length} recurso${pool.length > 1 ? 's' : ''}` : 'Ctrl+clic en el catálogo'),
      ...(scatter.assets.size ? [el('button', { type: 'button', onclick: () => { scatter.assets.clear(); for (const l of placementEvents) l(); renderToolOptions(); } }, 'Vaciar')] : []),
      rangeOption('Densidad', scatter.density, 0.1, 10, 0.1, value => { scatter.density = value; }, v => `${v}/100 m²`),
      rangeOption('Separación', scatter.spacing, 0.2, 12, 0.1, value => { scatter.spacing = value; }, v => `${v} m`),
      rangeOption('Escala mín.', scatter.scaleMin, 0.2, 3, 0.05, value => { scatter.scaleMin = Math.min(value, scatter.scaleMax); }, v => `×${v}`),
      rangeOption('Escala máx.', scatter.scaleMax, 0.2, 3, 0.05, value => { scatter.scaleMax = Math.max(value, scatter.scaleMin); }, v => `×${v}`),
      rangeOption('Inclinación', scatter.tilt, 0, 25, 1, value => { scatter.tilt = value; }, v => `${v}°`),
      checkOption('Evitar el agua', scatter.avoidWater, value => { scatter.avoidWater = value; }),
      rangeOption('Tamaño', brush.radius, 0.5, 60, 0.5, value => { brush.radius = value; }, v => `${v} m`),
    ];
  },
});

// ---------------------------------------------------------------------------
// Borrar con pincel
// ---------------------------------------------------------------------------

export const erase = { filter: 'all' as 'all' | 'pool' | 'layer' };
let erased = 0;
function applyErase() {
  const hit = pointer.ground;
  if (!hit) return;
  const pool = new Set(scatterPool());
  const r2 = brush.radius * brush.radius;
  const keys: string[] = [];
  for (const object of state.doc.objects) {
    const dx = object.position[0] - hit.x, dz = object.position[2] - hit.z;
    if (dx * dx + dz * dz > r2) continue;
    if (!pickable({ kind: 'o', key: `o:${object.id}`, data: object })) continue;
    if (erase.filter === 'pool' && !pool.has(object.asset)) continue;
    if (erase.filter === 'layer' && state.activeLayer !== 'auto' && object.layer !== state.activeLayer) continue;
    keys.push(`o:${object.id}`);
  }
  if (!keys.length) return;
  erased += removeEntities(keys);
  objectLayer.sync(state.doc.objects, state.doc.layers);
}
registerTool({
  id: 'erase', icon: '⌫', shortcut: 'x', label: 'Borrar objetos con pincel',
  brush: () => ({ radius: brush.radius, color: '#ff6a5a' }),
  down: () => { erased = 0; applyErase(); },
  move: () => { if (pointer.down) applyErase(); },
  up() {
    if (!erased) return;
    const count = erased;
    erased = 0;
    syncScene();
    commit(`Borrar ${count}`);
  },
  options: () => [
    selectOption('Borra', erase.filter, [['all', 'Todo lo desbloqueado'], ['pool', 'Solo los recursos elegidos'], ['layer', 'Solo la capa activa']] as const, value => { erase.filter = value; }),
    rangeOption('Tamaño', brush.radius, 0.5, 60, 0.5, value => { brush.radius = value; }, v => `${v} m`),
    el('span', { class: 'hint' }, 'Las capas o piezas bloqueadas no se borran'),
  ],
});

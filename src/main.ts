import * as THREE from 'three';
import { world } from './paint';
import { buildEnv } from './env';
import { Character } from './character';
import {
  CharData, Race, ClassId, RACES, CLASSES, EYES, EYE_NAMES, HAIR_COLORS, CLOTH, CLOTH_NAMES,
  EYE_SHAPES, BROWS, faceOptions, detailOptions, defaultChar, randomChar, randomName, sanitize,
} from './data';

THREE.ColorManagement.enabled = false;

// ---------------- Estado ----------------
const SAVE_KEY = 'brumaluz.personaje';
let state: CharData = defaultChar();
try {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) state = sanitize(JSON.parse(saved));
} catch { /* sin almacenamiento: empezamos de cero */ }
if (!state.name) state.name = randomName(state.race);

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* ignorar */ }
}

// ---------------- Render ----------------
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 600);
const env = buildEnv(scene);

const holder = new THREE.Group();
holder.rotation.y = -0.3;
scene.add(holder);

let tab = 'raza';
let char: Character;
let pendingHop = false;
let rebuildQueued = false;

function rebuildNow() {
  rebuildQueued = false;
  char?.dispose();
  char = new Character({ ...state }, { outfit: tab === 'clase' });
  holder.add(char.root);
  char.update(clock.getElapsedTime());
  if (pendingHop) char.hop();
  pendingHop = false;
  save();
}
/** Reconstruye como mucho una vez por fotograma (los deslizadores disparan mucho). */
function rebuild(hop = false) {
  pendingHop ||= hop;
  if (!rebuildQueued) { rebuildQueued = true; requestAnimationFrame(rebuildNow); }
}

// ---------------- Cámara ----------------
type Focus = 'body' | 'face';
let focus: Focus = 'body';
let zoom = 1;
const camTarget = new THREE.Vector3(0, 1, 0);
let camDist = 4.4;
const tmp = new THREE.Vector3();

function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const panel = document.getElementById('panel')!.getBoundingClientRect();
  const mobile = w <= 760;
  const ox = mobile ? 0 : -(panel.right + 12) / 2;
  const oy = mobile ? (h - panel.top) / 2 : 0;
  camera.setViewOffset(w, h, ox, oy, w, h);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', layout);

function updateCamera(dt: number) {
  const head = char.headWorld(tmp);
  const mobile = window.innerWidth <= 760;
  let ty: number, dist: number;
  if (focus === 'face') { ty = head.y - 0.03; dist = 1.15; }
  else { ty = head.y * 0.52; dist = 2.9 + head.y * 1.1; }
  if (mobile) { dist *= focus === 'face' ? 1.5 : 1.75; ty += focus === 'face' ? 0.02 : 0.15; }
  dist *= zoom;
  const k = 1 - Math.exp(-dt * 4);
  camTarget.y += (ty - camTarget.y) * k;
  camDist += (dist - camDist) * k;
  camera.position.set(0, camTarget.y + camDist * 0.08, camDist);
  camera.lookAt(camTarget);
}

// Girar al personaje arrastrando
let dragging = false, lastX = 0, spinVel = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  holder.rotation.y += dx * 0.01;
  spinVel = dx * 0.01;
});
const endDrag = () => { dragging = false; canvas.classList.remove('drag'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom = THREE.MathUtils.clamp(zoom * (1 + e.deltaY * 0.001), 0.6, 1.4); }, { passive: false });

// ---------------- Interfaz ----------------
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const RACE_ICONS: Record<Race, string> = { humano: '🛡️', elfo: '🌿', lagto: '🦎', pelso: '🐱' };
const CLASS_ICONS: Record<ClassId, string> = { guerrero: '⚔️', mago: '✨', picaro: '🗡️', clerigo: '☀️', explorador: '🏹' };

function set<K extends keyof CharData>(key: K, value: CharData[K], hop = false) {
  state[key] = value;
  state = sanitize(state as unknown as Record<string, unknown>);
  rebuild(hop);
  refreshUI();
}

function cards<T extends string>(el: HTMLElement, items: Record<T, { label: string }>, icons: Record<T, string>, onPick: (k: T) => void) {
  el.innerHTML = '';
  (Object.keys(items) as T[]).forEach((k) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.dataset.k = k;
    b.innerHTML = `<span class="ic">${icons[k]}</span>${items[k].label}`;
    b.onclick = () => onPick(k);
    el.appendChild(b);
  });
}

function swatches(el: HTMLElement, colors: () => string[], key: 'skin' | 'eyes' | 'hairColor' | 'primary' | 'secondary', names: () => string[]) {
  return () => {
    el.innerHTML = '';
    const ns = names();
    colors().forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'sw' + (state[key] === i ? ' active' : '');
      b.style.background = c;
      b.title = ns[i] ?? '';
      b.setAttribute('aria-label', ns[i] ?? c);
      b.onclick = () => set(key, i);
      el.appendChild(b);
    });
  };
}

function stepper(key: 'detail' | 'hair' | 'eyeShape' | 'brows' | 'nose' | 'mouth', list: () => string[]) {
  const el = $(`.stepper[data-key="${key}"]`);
  el.innerHTML = `<button aria-label="Anterior">‹</button><div class="val"></div><button aria-label="Siguiente">›</button>`;
  const [prev, , next] = Array.from(el.children) as HTMLElement[];
  prev.onclick = () => { const l = list(); set(key, (state[key] + l.length - 1) % l.length); };
  next.onclick = () => { const l = list(); set(key, (state[key] + 1) % l.length); };
  return () => {
    const l = list();
    if (!l.length) return;
    (el.querySelector('.val') as HTMLElement).innerHTML = `${l[state[key]]}<small>${state[key] + 1} / ${l.length}</small>`;
  };
}

cards($('#races'), RACES, RACE_ICONS, (k) => {
  state.race = k;
  set('race', k, true);
});
cards($('#classes'), CLASSES, CLASS_ICONS, (k) => {
  const c = CLASSES[k];
  state.primary = c.primary;
  state.secondary = c.secondary;
  set('cls', k, true);
});

const renders = [
  swatches($('#skin'), () => RACES[state.race].skins, 'skin', () => RACES[state.race].skinNames),
  swatches($('#eyes'), () => EYES, 'eyes', () => EYE_NAMES),
  swatches($('#hairColor'), () => HAIR_COLORS, 'hairColor', () => []),
  swatches($('#primary'), () => CLOTH, 'primary', () => CLOTH_NAMES),
  swatches($('#secondary'), () => CLOTH, 'secondary', () => CLOTH_NAMES),
  stepper('detail', () => detailOptions(state.race, state.sex)?.list ?? []),
  stepper('hair', () => RACES[state.race].hairStyles),
  stepper('eyeShape', () => EYE_SHAPES),
  stepper('brows', () => BROWS),
  stepper('nose', () => faceOptions(state.race).nose),
  stepper('mouth', () => faceOptions(state.race).mouth),
];

document.querySelectorAll<HTMLButtonElement>('#sex button').forEach((b) => {
  b.onclick = () => set('sex', Number(b.dataset.v) as 0 | 1, true);
});
for (const key of ['height', 'build'] as const) {
  const input = $<HTMLInputElement>('#' + key);
  input.oninput = () => set(key, Number(input.value));
}

const nameInput = $<HTMLInputElement>('#name');
nameInput.oninput = () => { state.name = nameInput.value; save(); };
$('#dice').onclick = () => { state.name = randomName(state.race); refreshUI(); save(); };

function refreshUI() {
  document.querySelectorAll<HTMLElement>('#races .card').forEach((c) => c.classList.toggle('active', c.dataset.k === state.race));
  document.querySelectorAll<HTMLElement>('#classes .card').forEach((c) => c.classList.toggle('active', c.dataset.k === state.cls));
  $('#raceDesc').textContent = RACES[state.race].desc;
  $('#classDesc').textContent = CLASSES[state.cls].desc;
  document.querySelectorAll<HTMLElement>('#sex button').forEach((b) => b.classList.toggle('active', Number(b.dataset.v) === state.sex));
  $<HTMLInputElement>('#height').value = String(state.height);
  $<HTMLInputElement>('#build').value = String(state.build);
  const det = detailOptions(state.race, state.sex);
  $('#detailBox').hidden = !det;
  if (det) $('#detailLabel').textContent = det.label;
  $('#hairLabel').textContent = RACES[state.race].hairLabel;
  const F = faceOptions(state.race);
  $('#browBox').hidden = !F.brows;
  $('#noseLabel').textContent = F.noseLabel;
  if (document.activeElement !== nameInput) nameInput.value = state.name;
  renders.forEach((r) => r());
}

// Pestañas: cambian el encuadre y, en Clase, visten al personaje
function selectTab(name: string) {
  const wasOutfit = tab === 'clase';
  tab = name;
  document.querySelectorAll<HTMLElement>('#tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  document.querySelectorAll<HTMLElement>('#pages section').forEach((s) => s.classList.toggle('active', s.dataset.page === name));
  focus = name === 'rostro' || name === 'cabello' ? 'face' : 'body';
  zoom = 1;
  if (wasOutfit !== (name === 'clase')) rebuild(name === 'clase');
}
document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) => { b.onclick = () => selectTab(b.dataset.tab!); });

$('#random').onclick = () => {
  state = randomChar();
  rebuild(true);
  refreshUI();
};
$('#wave').onclick = () => char.wave();

let toastTimer = 0;
function toast(title: string, text: string, error = false) {
  const t = $('#toast');
  t.innerHTML = `<h2>${title}</h2><p>${text}</p>`;
  t.classList.toggle('error', error);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 3200);
}

$('#enter').onclick = () => {
  const name = state.name.trim();
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{3,16}$/.test(name)) {
    toast('Un momento…', 'Tu nombre necesita entre 3 y 16 letras.', true);
    nameInput.focus();
    return;
  }
  state.name = name[0].toUpperCase() + name.slice(1);
  save();
  holder.rotation.y = 0; spinVel = 0;
  if (tab !== 'clase') selectTab('clase');
  focus = 'body';
  setTimeout(() => char.wave(), 60);
  toast(`¡Saludos, ${state.name}!`, `${RACES[state.race].label} · ${CLASSES[state.cls].label}. Las puertas de Brumaluz se abrirán muy pronto.`);
};

// ---------------- Bucle ----------------
const clock = new THREE.Clock();
rebuildNow();
refreshUI();
layout();

let last = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  const dt = Math.min(t - last, 0.05);
  last = t;
  world.uTime.value = t;
  if (!dragging) {
    holder.rotation.y += spinVel;
    spinVel *= 0.92;
  }
  char.update(t);
  env.update(t);
  updateCamera(dt);
  renderer.render(scene, camera);
});

requestAnimationFrame(() => setTimeout(() => $('#loading').classList.add('hide'), 400));

// Gancho de depuración para pruebas desde la consola.
(window as unknown as { brumaluz: object }).brumaluz = {
  set(d: Partial<CharData>) { state = sanitize({ ...state, ...d } as unknown as Record<string, unknown>); rebuildNow(); refreshUI(); },
  tab: selectTab,
  wave() { char.wave(); },
  time() { const t0 = performance.now(); rebuildNow(); return performance.now() - t0; },
};

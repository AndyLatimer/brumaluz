import * as THREE from 'three';
import { world } from './paint';
import { buildEnv } from './env';
import { Character, loadKits } from './character';
import { setupStage, castShadows } from './render';
import { buildCity, City } from './city';
import { FACE_KITS, FACE_LABELS, HAIR_STYLES, BEARDS, EYE_SHAPES, BROWS, NOSES, MOUTHS, DETAILS } from './head';
import {
  CharData, Race, ClassId, RACES, CLASSES, HAIR_COLORS, HAIR_NAMES, CLOTH, CLOTH_NAMES, EYE_COLORS, EYE_COLOR_NAMES,
  defaultChar, randomChar, randomName, sanitize,
} from './data';


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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 900);
const env = buildEnv(scene);
const lowEnd = window.innerWidth <= 760 || /Mobi|Android/i.test(navigator.userAgent);
const stage = setupStage(renderer, scene, camera, lowEnd);

const holder = new THREE.Group();
holder.rotation.y = -0.3;
scene.add(holder);

let tab = 'raza';
let mode: 'create' | 'play' = 'create';
let city: City;
let char: Character;
let pendingHop = false;
let rebuildQueued = false;

function rebuildNow() {
  rebuildQueued = false;
  char?.dispose();
  char = new Character({ ...state }, { outfit: tab === 'clase' || mode === 'play' });
  holder.add(char.root);
  castShadows(char.root);
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
  stage.resize(w, h);
  camera.aspect = w / h;
  if (mode === 'play') {
    camera.clearViewOffset();
  } else {
    const panel = document.getElementById('panel')!.getBoundingClientRect();
    const mobile = w <= 760;
    const ox = mobile ? 0 : -(panel.right + 12) / 2;
    const oy = mobile ? (h - panel.top) / 2 : 0;
    camera.setViewOffset(w, h, ox, oy, w, h);
  }
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', layout);

// Cámara en tercera persona del modo exploración
let yaw = 0, pitch = 0.55, followDist = 12;
const camPos = new THREE.Vector3();
function updatePlayCamera(dt: number) {
  const target = tmp.copy(holder.position).add(new THREE.Vector3(0, 1.3, 0));
  const k = 1 - Math.exp(-dt * 8);
  camTarget.lerp(target, k);
  const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(followDist);
  camPos.copy(camTarget).add(off);
  camPos.y = Math.max(camPos.y, city.groundY(camPos.x, camPos.z) + 0.6);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

function updateCamera(dt: number) {
  if (mode === 'play') return updatePlayCamera(dt);
  const head = char.headWorld(tmp);
  const mobile = window.innerWidth <= 760;
  let ty: number, dist: number;
  if (focus === 'face') { ty = head.y - 0.06; dist = 2.6; }
  else { ty = head.y * 0.5; dist = 3.6 + head.y * 1.3; }
  if (mobile) { dist *= focus === 'face' ? 1.5 : 1.75; ty += focus === 'face' ? 0.02 : 0.15; }
  dist *= zoom;
  const k = 1 - Math.exp(-dt * 4);
  camTarget.y += (ty - camTarget.y) * k;
  camDist += (dist - camDist) * k;
  camTarget.x = holder.position.x; camTarget.z = holder.position.z;
  const cy = city.spawnYaw;
  camera.position.set(holder.position.x + Math.sin(cy) * camDist, camTarget.y + camDist * 0.08, holder.position.z + Math.cos(cy) * camDist);
  camera.lookAt(camTarget);
}

// Girar al personaje arrastrando
let dragging = false, lastX = 0, lastY = 0, spinVel = 0, dragDist = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; dragDist = 0; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  dragDist += Math.abs(dx) + Math.abs(dy);
  if (mode === 'play') {
    yaw -= dx * 0.008;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.006, 0.12, 1.25);
  } else {
    holder.rotation.y += dx * 0.01;
    spinVel = dx * 0.01;
  }
});
const endDrag = (e: PointerEvent) => {
  if (dragging && mode === 'play' && dragDist < 6) clickToMove(e);
  dragging = false;
  canvas.classList.remove('drag');
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { dragging = false; canvas.classList.remove('drag'); });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (mode === 'play') followDist = THREE.MathUtils.clamp(followDist * (1 + e.deltaY * 0.001), 4, 26);
  else zoom = THREE.MathUtils.clamp(zoom * (1 + e.deltaY * 0.001), 0.6, 1.4);
}, { passive: false });

// ---------------- Exploración ----------------
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (mode !== 'play' || (e.target as HTMLElement).tagName === 'INPUT') return;
  keys.add(e.code);
  if (e.code === 'KeyE') char.wave();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
let moveTarget: THREE.Vector3 | null = null;
const marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.38, 32), new THREE.MeshBasicMaterial({ color: '#ffe2a0', transparent: true, opacity: 0.85, depthWrite: false }));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);
const ray = new THREE.Raycaster();
function clickToMove(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.1), p)) return;
  moveTarget = p;
  marker.position.set(p.x, city.groundY(p.x, p.z) + 0.03, p.z);
  marker.visible = true;
}
function updatePlay(dt: number) {
  const input = new THREE.Vector2(
    (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0),
  );
  const dir = new THREE.Vector3();
  if (input.lengthSq() > 0) {
    moveTarget = null;
    marker.visible = false;
    const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), rt = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    dir.addScaledVector(rt, input.x).addScaledVector(f, -input.y).normalize();
  } else if (moveTarget) {
    dir.set(moveTarget.x - holder.position.x, 0, moveTarget.z - holder.position.z);
    if (dir.length() < 0.25) { moveTarget = null; marker.visible = false; dir.set(0, 0, 0); } else dir.normalize();
  }
  const walk = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = dir.lengthSq() ? (walk ? 2.4 : 6.2) : 0;
  char.setGait(speed === 0 ? 'idle' : walk ? 'walk' : 'run');
  if (speed > 0) {
    const from = holder.position.clone();
    const to = from.clone().addScaledVector(dir, speed * dt);
    const p = city.collide(from, to);
    if (moveTarget && p.distanceTo(to) > speed * dt * 0.7) { moveTarget = null; marker.visible = false; }
    holder.position.x = p.x; holder.position.z = p.z;
    // girar hacia donde camina
    const want = Math.atan2(dir.x, dir.z);
    let d = want - holder.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    holder.rotation.y += d * (1 - Math.exp(-dt * 14));
  }
  holder.position.y += (city.groundY(holder.position.x, holder.position.z) - holder.position.y) * (1 - Math.exp(-dt * 12));
  if (marker.visible) marker.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 6) * 0.1);
}

function enterPlay() {
  mode = 'play';
  document.body.classList.add('playing');
  $('#hudName').textContent = state.name;
  $('#hudClass').textContent = `${RACES[state.race].label} · ${CLASSES[state.cls].label}`;
  yaw = city.spawnYaw; pitch = 0.55; followDist = 12;
  camera.fov = 50;
  holder.rotation.y = city.spawnYaw + Math.PI;
  camTarget.copy(holder.position).add(new THREE.Vector3(0, 1.3, 0));
  rebuildNow();
  layout();
}
function exitPlay() {
  mode = 'create';
  document.body.classList.remove('playing');
  keys.clear();
  moveTarget = null;
  marker.visible = false;
  holder.position.copy(city.spawn);
  holder.rotation.y = city.spawnYaw - 0.3;
  camera.fov = 30;
  char.setGait('idle');
  rebuildNow();
  layout();
}

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

function swatches(el: HTMLElement, colors: () => string[], key: 'skin' | 'hairColor' | 'eyeColor' | 'primary' | 'secondary', names: () => string[]) {
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

function stepper(key: 'face' | 'trait' | 'hair' | 'beard' | 'eyeShape' | 'brows' | 'nose' | 'mouth' | 'detail', list: () => string[]) {
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
  swatches($('#hairColor'), () => HAIR_COLORS, 'hairColor', () => HAIR_NAMES),
  swatches($('#primary'), () => CLOTH, 'primary', () => CLOTH_NAMES),
  swatches($('#secondary'), () => CLOTH, 'secondary', () => CLOTH_NAMES),
  swatches($('#eyeColor'), () => EYE_COLORS, 'eyeColor', () => EYE_COLOR_NAMES),
  stepper('face', () => FACE_KITS.map((k) => FACE_LABELS[k])),
  stepper('hair', () => HAIR_STYLES),
  stepper('beard', () => BEARDS),
  stepper('eyeShape', () => EYE_SHAPES),
  stepper('brows', () => BROWS),
  stepper('nose', () => NOSES),
  stepper('mouth', () => MOUTHS),
  stepper('detail', () => DETAILS),
  stepper('trait', () => RACES[state.race].traits),
];

document.querySelectorAll<HTMLButtonElement>('#sex button').forEach((b) => {
  b.onclick = () => {
    const sex = Number(b.dataset.v) as 0 | 1;
    if (sex !== state.sex) {
      if (sex === 1) { state.face = 0; state.hair = 3; state.beard = 0; state.eyeShape = 1; } else { state.face = 1; state.hair = 1; state.eyeShape = 0; }
    }
    set('sex', sex, true);
  };
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
  const R = RACES[state.race];
  $('#traitBox').hidden = !R.traitLabel;
  if (R.traitLabel) $('#traitLabel').textContent = R.traitLabel;
  $('#hairNote').textContent = state.race === 'pelso' ? 'El color también tiñe las orejas y la cola.' : '';
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
  spinVel = 0;
  focus = 'body';
  enterPlay();
  setTimeout(() => char.wave(), 60);
  toast(`¡Te damos la bienvenida, ${state.name}!`, 'Pasea por la ciudad: WASD o clic para moverte, arrastra para mirar.');
};
$('#back').onclick = () => exitPlay();

// ---------------- Bucle ----------------
const clock = new THREE.Clock();
try {
  await loadKits();
  city = await buildCity();
} catch (e) {
  $('#loading p').textContent = 'No se pudo cargar Brumaluz: ' + (e instanceof Error ? e.message : String(e));
  throw e;
}
scene.add(city.root);
holder.position.copy(city.spawn);
holder.rotation.y = city.spawnYaw - 0.3;
rebuildNow();
refreshUI();
layout();

let last = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  const dt = Math.min(t - last, 0.05);
  last = t;
  world.uTime.value = t;
  if (mode === 'play') updatePlay(dt);
  else if (!dragging) {
    holder.rotation.y += spinVel;
    spinVel *= 0.92;
  }
  char.update(t);
  env.update(t);
  city.update(t);
  stage.follow(holder.position, mode === 'play');
  updateCamera(dt);
  stage.render();
});

requestAnimationFrame(() => setTimeout(() => $('#loading').classList.add('hide'), 400));

// Gancho de depuración para pruebas desde la consola.
(window as unknown as { brumaluz: object }).brumaluz = {
  set(d: Partial<CharData>) { state = sanitize({ ...state, ...d } as unknown as Record<string, unknown>); rebuildNow(); refreshUI(); },
  tab: selectTab,
  wave() { char.wave(); },
  play: () => enterPlay(),
  spin(a: number) { holder.rotation.y = a; spinVel = 0; },
  move(x: number, z: number) { holder.position.set(x, 0, z); },
  view(y: number, p: number, d: number) { yaw = y; pitch = p; followDist = d; },
  time() { const t0 = performance.now(); rebuildNow(); return performance.now() - t0; },
};

import * as THREE from 'three';
import {
  accountConfigError, currentSession, getAccountClient, getProfileUsername, listCharacters, onAuthChange,
  requestPasswordReset, saveCharacter as persistCharacter, signIn, signOut, signUp, updatePassword, type SavedCharacter,
  deleteCharacter as removeCharacter, MAX_CHARACTERS_PER_ACCOUNT,
} from './services/account';
import type { User } from '@supabase/supabase-js';
import { applyLanguage, getLanguage, setLanguage, t, raceText, classText } from './ui/i18n';
import { world } from './world/paint';
import { buildEnv } from './world/env';
import { Character, loadKits } from './character/character';
import { createCharacterPortrait } from './character/portrait';
import { setupStage, castShadows } from './world/render';
import { buildCity, City } from './world/city';
import { AmbientSoundscape } from './world/audio';
import { FACE_KITS, FACE_LABELS, HAIR_STYLES, BEARDS, EYE_SHAPES, BROWS, NOSES, MOUTHS, DETAILS } from './character/head';
import {
  CharData, Race, ClassId, RACES, CLASSES, ATTRIBUTES, ATTRIBUTE_POINTS_AVAILABLE, ATTRIBUTE_BASE_VALUE, ATTRIBUTE_MAX_VALUE, AttributeId, HAIR_COLORS, HAIR_NAMES, CLOTH, CLOTH_NAMES, EYE_COLORS, EYE_COLOR_NAMES,
  defaultChar, randomChar, randomName, sanitize, HAIR_ACCS, HAIR_ACC_VALUES, ACCS, MAKEUPS, ACC_COLORS, ACC_COLOR_NAMES, LOCATIONS,
} from './data/data';
import { vitalsOf } from './data/stats';
import { TITLES } from './data/titles';
import { renderInventory, renderSheet } from './ui/playerWindows';
import { classIcon } from './ui/classIcons';
import { initTooltips } from './ui/tooltip';
import { renderControls } from './ui/controls';
import { loadSettings, saveSettings } from './services/settings';


// ---------------- Estado ----------------
let state: CharData = defaultChar();
if (!state.name) state.name = randomName(state.race);

let activeCharacterId: string | null = null;
let currentUser: User | null = null;
let currentUsername: string | null = null;
let cachedCharacters: SavedCharacter[] = [];
let accountSyncId = 0;
let savingCharacter = false;
let passwordRecoveryUser: User | null = null;

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
const ambientSoundscape = new AmbientSoundscape();
let ambientEnabled = localStorage.getItem('brumaluz-ambient') !== 'off';
const settings = loadSettings();
function applyVolumes() {
  ambientSoundscape.setLevel((settings.ambientVolume / 100) * (settings.masterVolume / 100));
}
applyVolumes();

function rebuildNow() {
  rebuildQueued = false;
  char?.dispose();
  char = new Character({ ...state }, { outfit: mode === 'create' && tab === 'clase' });
  holder.add(char.root);
  castShadows(char.root);
  char.update(clock.getElapsedTime());
  if (pendingHop) char.hop();
  pendingHop = false;
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
const playerVel = new THREE.Vector3();
let zoomTarget = 12;
function updatePlayCamera(dt: number) {
  // el objetivo se adelanta un poco en la dirección de marcha y la cámara lo sigue con holgura
  const target = tmp.copy(holder.position).add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(playerVel, 0.12);
  const k = 1 - Math.exp(-dt * 5);
  camTarget.lerp(target, k);
  followDist += (zoomTarget - followDist) * (1 - Math.exp(-dt * 8));
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
    yaw -= dx * 0.006;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.005, 0.05, 1.4);
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
  if (mode === 'play') zoomTarget = THREE.MathUtils.clamp(zoomTarget * (1 + e.deltaY * 0.001), 3, 30);
  else zoom = THREE.MathUtils.clamp(zoom * (1 + e.deltaY * 0.001), 0.6, 1.4);
}, { passive: false });

// ---------------- Exploración ----------------
const keys = new Set<string>();
let running = true;
let jumpDuration = 0;
let jumpElapsed = 0;
let jumpHeight = 0;
let groundHeight = 0;
function startJump() {
  if (jumpDuration > 0 && jumpElapsed < jumpDuration) return;
  jumpDuration = char.jump();
  if (jumpDuration <= 0) return;
  jumpElapsed = 0;
}
window.addEventListener('keydown', (e) => {
  if (mode !== 'play') return;
  if (optionsOpen) {
    if (e.code === 'Escape') { e.preventDefault(); setOptionsOpen(false); }
    return;
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    if (e.repeat) return;
    if (openWindow) setWindow(null);
    else setPlayerMenuOpen(!playerMenuOpen);
    return;
  }
  if (e.code === 'Escape') {
    e.preventDefault();
    if (e.repeat) return;
    if (openWindow) setWindow(null);
    else if (playerMenuOpen) setPlayerMenuOpen(false);
    else setGameMenuOpen(!gameMenuOpen);
    return;
  }
  if (gameMenuOpen || playerMenuOpen || openWindow || (e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    if (!e.repeat) running = !running;
    return;
  }
  keys.add(e.code);
  if (e.code === 'KeyE') char.wave();
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) startJump();
  } else if (e.code.startsWith('Arrow')) e.preventDefault();
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
  let distance = ray.ray.origin.distanceTo(p);
  for (let i = 0; i < 8; i++) {
    ray.ray.at(distance, p);
    const heightDifference = p.y - city.groundY(p.x, p.z);
    if (Math.abs(heightDifference) < 0.05) break;
    if (Math.abs(ray.ray.direction.y) < 1e-3) return;
    distance += heightDifference / -ray.ray.direction.y;
    if (distance < 0) return;
  }
  p.y = city.groundY(p.x, p.z);
  moveTarget = p;
  marker.position.set(p.x, city.groundY(p.x, p.z) + 0.03, p.z);
  marker.visible = true;
}
function updatePlay(dt: number) {
  const input = new THREE.Vector2(
    (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0),
  );
  // Movimiento relativo a la cámara: W va hacia donde mira la cámara, A/D van a los lados
  const dir = new THREE.Vector3();
  let clickMoving = false;
  if (input.lengthSq() > 0) {
    moveTarget = null;
    marker.visible = false;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    dir.set(fx * -input.y + -fz * input.x, 0, fz * -input.y + fx * input.x).normalize();
  } else if (moveTarget) {
    dir.set(moveTarget.x - holder.position.x, 0, moveTarget.z - holder.position.z);
    if (dir.length() < 0.25) { moveTarget = null; marker.visible = false; dir.set(0, 0, 0); } else { dir.normalize(); clickMoving = true; }
  }
  if (!dragging && clickMoving) {
    // al ir con clic la cámara se recoloca poco a poco tras el personaje
    let back = Math.atan2(-dir.x, -dir.z) - yaw;
    back = Math.atan2(Math.sin(back), Math.cos(back));
    yaw += back * (1 - Math.exp(-dt * 1.5));
  }
  // aceleración y frenada suaves
  const maxSpeed = dir.lengthSq() ? (running ? 6.2 : 2.4) : 0;
  const wantVel = dir.clone().multiplyScalar(maxSpeed);
  playerVel.lerp(wantVel, 1 - Math.exp(-dt * (maxSpeed > 0 ? 9 : 11)));
  const speed = playerVel.length();
  if (speed < 0.05) playerVel.set(0, 0, 0);
  char.setGait(speed < 0.35 ? 'idle' : speed > 4 ? 'run' : 'walk');
  if (speed >= 0.05) {
    const from = holder.position.clone();
    const to = from.clone().addScaledVector(playerVel, dt);
    const p = city.collide(from, to);
    if (moveTarget && p.distanceTo(to) > speed * dt * 0.7) { moveTarget = null; marker.visible = false; }
    holder.position.x = p.x; holder.position.z = p.z;
    if (speed > 0.35) {
      const want = Math.atan2(playerVel.x, playerVel.z);
      let d = want - holder.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      holder.rotation.y += d * (1 - Math.exp(-dt * 12));
    }
  }
  if (jumpDuration > 0 && jumpElapsed < jumpDuration) {
    jumpElapsed = Math.min(jumpElapsed + dt, jumpDuration);
    const jumpProgress = jumpElapsed / jumpDuration;
    jumpHeight = 4 * jumpProgress * (1 - jumpProgress) * 0.7; // parábola: gravedad real, sin flotar
  } else {
    jumpElapsed = jumpDuration;
    jumpHeight = 0;
  }
  groundHeight += (city.groundY(holder.position.x, holder.position.z) - groundHeight) * (1 - Math.exp(-dt * 12));
  holder.position.y = groundHeight + jumpHeight;
  if (marker.visible) marker.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 6) * 0.1);
}

function updateHud() {
  const v = vitalsOf(state);
  const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;
  const setBar = (id: string, value: number, max: number, text: string) => {
    $(`#${id}-fill`).style.width = pct(value, max);
    $(`#${id}-text`).textContent = text;
    $(`#${id}-fill`).parentElement?.setAttribute('aria-valuenow', String(value));
  };
  $('#hud-class-icon').innerHTML = classIcon(state.cls, 'hud');
  $('#hud-name').textContent = state.name;
  $('#hud-level').textContent = `${t('Nivel')} ${state.level}`;
  setBar('hud-health', v.health, v.maxHealth, `${v.health} / ${v.maxHealth}`);
  setBar('hud-resource', v.resource, v.maxResource, `${v.resource} / ${v.maxResource}`);
  $('#hud-resource').className = `hud-bar hud-resource ${v.resourceKind}`;
  $('#hud-resource').setAttribute('aria-label', t(v.resourceKind === 'mana' ? 'Maná' : 'Estamina'));
  setBar('hud-xp', v.experience, v.experienceNeeded, `${v.experience} / ${v.experienceNeeded} XP`);
  const hudTips: [string, string][] = [['hud-health', 'Vida'], ['hud-resource', v.resourceKind === 'mana' ? 'Maná' : 'Estamina'], ['hud-xp', 'Experiencia']];
  for (const [id, label] of hudTips) $(`#${id}-fill`).parentElement!.title = `${t(label)}|${$(`#${id}-text`).textContent}`;
  $('#hud-class-icon').title = `${classText(state)}|${t('Nivel')} ${state.level}`;
  refreshNameplateText();
}

const nameplate = { el: null as unknown as HTMLElement, shown: false };
const nameplateAnchor = new THREE.Vector3();
function refreshNameplateText() {
  $('#nameplate-name').textContent = state.name;
  const title = $('#nameplate-title');
  title.textContent = state.title === 'none' ? '' : t(TITLES[state.title].label);
  title.hidden = state.title === 'none';
}
// Coloca la placa sobre la cabeza del personaje proyectando su posición en pantalla.
function updateNameplate() {
  nameplate.el ??= $('#nameplate');
  const visible = mode === 'play' && settings.nameplates;
  if (visible) {
    camera.updateMatrixWorld();
    nameplateAnchor.set(holder.position.x, holder.position.y + 1.95 + (state.height - 0.5) * 0.3, holder.position.z).project(camera);
    const inView = nameplateAnchor.z < 1 && Math.abs(nameplateAnchor.x) < 1.2 && Math.abs(nameplateAnchor.y) < 1.2;
    if (inView) {
      const x = (nameplateAnchor.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-nameplateAnchor.y * 0.5 + 0.5) * window.innerHeight;
      nameplate.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    nameplate.el.hidden = !inView;
  } else if (!nameplate.el.hidden) nameplate.el.hidden = true;
}

function enterPlay() {
  updateHud();
  state.location = city.locationId;
  mode = 'play';
  document.body.classList.add('playing');
  void setAmbientEnabled(ambientEnabled);
  yaw = city.spawnYaw; pitch = 0.55; followDist = 12; zoomTarget = 12; playerVel.set(0, 0, 0);
  running = true;
  groundHeight = holder.position.y;
  jumpElapsed = jumpDuration;
  jumpHeight = 0;
  camera.fov = 50;
  holder.rotation.y = city.spawnYaw + Math.PI;
  camTarget.copy(holder.position).add(new THREE.Vector3(0, 1.3, 0));
  rebuildNow();
  layout();
}
function exitPlay() {
  mode = 'create';
  void ambientSoundscape.setEnabled(false);
  setGameMenuOpen(false, false);
  setPlayerMenuOpen(false, false);
  setWindow(null, false);
  keys.clear();
  moveTarget = null;
  marker.visible = false;
  holder.position.copy(city.spawn);
  running = true;
  groundHeight = city.spawn.y;
  jumpElapsed = jumpDuration;
  jumpHeight = 0;
  holder.rotation.y = city.spawnYaw - 0.3;
  camera.fov = 30;
  char.setGait('idle');
  rebuildNow();
  layout();
}

// ---------------- Interfaz ----------------
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const RACE_ICONS: Record<Race, string> = { humano: '🛡️', elfo: '🌿', lagto: '🦎', pelso: '🐱' };
const CLASS_ICONS: Record<ClassId, string> = { guerrero: classIcon('guerrero'), mago: classIcon('mago'), picaro: classIcon('picaro'), clerigo: classIcon('clerigo'), explorador: classIcon('explorador') };

applyLanguage(document);
initTooltips();

function refreshLanguageDependentUI() {
  const language = getLanguage();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-language]')) {
    const selected = button.dataset.language === language;
    button.setAttribute('aria-pressed', String(selected));
    button.title = t(button.dataset.language === 'es' ? 'Español' : 'English');
  }
  refreshUI();
  renderControls($('#controls-view'));
  refreshAmbientControls();
  if (currentUser) displayCharacters(cachedCharacters);
  $('#auth-submit').textContent = authMode === 'register' ? t('Crear cuenta') : t('Iniciar sesión');
  $('#forgot-password').textContent = t('¿Olvidaste tu contraseña?');
  if (characterPendingDeletion) {
    $('#delete-dialog-description').textContent = t('Vas a borrar definitivamente a {name}. Esta acción no se puede deshacer.', { name: characterPendingDeletion.name });
  }
  renderToast();
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-language]')) {
  button.onclick = () => setLanguage(button.dataset.language === 'en' ? 'en' : 'es');
  const selected = button.dataset.language === getLanguage();
  button.setAttribute('aria-pressed', String(selected));
  button.title = t(button.dataset.language === 'es' ? 'Español' : 'English');
}
document.addEventListener('brumaluz-language-change', refreshLanguageDependentUI);

let gameMenuOpen = false;

function setGameMenuOpen(open: boolean, restoreFocus = true) {
  gameMenuOpen = open;
  if (open) { setPlayerMenuOpen(false, false); setWindow(null, false); }
  const toggle = $<HTMLButtonElement>('#game-menu-toggle');
  const panel = $('#game-menu-panel');
  panel.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', t(open ? 'Cerrar menú' : 'Abrir menú'));
  $('#game-menu-message').textContent = '';
  $('#game-menu-message').classList.remove('error');
  keys.clear();
  if (open) $<HTMLButtonElement>('#game-menu-characters').focus();
  else if (restoreFocus) toggle.focus();
}

// ---------------- Menú de personaje (Tab) ----------------
let playerMenuOpen = false;
let openWindow: 'inventory' | 'sheet' | null = null;

function setPlayerMenuOpen(open: boolean, restoreFocus = true) {
  playerMenuOpen = open;
  if (open) { setGameMenuOpen(false, false); setWindow(null, false); }
  const toggle = $<HTMLButtonElement>('#player-menu-toggle');
  $('#player-menu-panel').hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  keys.clear();
  if (open) $<HTMLButtonElement>('#player-menu-panel [data-window]').focus();
  else if (restoreFocus) toggle.blur();
}

function setWindow(win: 'inventory' | 'sheet' | null, closeMenu = true) {
  openWindow = win;
  $('#window-backdrop').hidden = !win;
  keys.clear();
  if (!win) return;
  if (closeMenu) setPlayerMenuOpen(false, false);
  const body = $('#window-body');
  $('#window-title').textContent = t(win === 'inventory' ? 'Inventario' : 'Ficha de personaje');
  $('#window-backdrop .game-window').classList.toggle('wide', win === 'sheet');
  $('#window-backdrop .game-window').classList.toggle('xl', win === 'inventory');
  if (win === 'inventory') renderInventory(body, state, renderer);
  else renderSheet(body, state, renderer, (title) => {
    state.title = title;
    updateHud();
    void saveCurrentCharacter();
  });
  $<HTMLButtonElement>('#window-close').focus();
}

$('#player-menu-toggle').onclick = () => setPlayerMenuOpen(!playerMenuOpen);
for (const b of document.querySelectorAll<HTMLButtonElement>('#player-menu-panel [data-window]')) {
  b.onclick = () => setWindow(b.dataset.window as 'inventory' | 'sheet');
}
$('#window-close').onclick = () => setWindow(null);
$('#window-backdrop').addEventListener('pointerdown', (e) => { if (e.target === e.currentTarget) setWindow(null); });
document.addEventListener('click', (event) => {
  if (playerMenuOpen && event.target instanceof Node && !$('#player-menu').contains(event.target)) setPlayerMenuOpen(false, false);
});

async function setAmbientEnabled(enabled: boolean) {
  ambientEnabled = enabled;
  refreshAmbientControls();
  localStorage.setItem('brumaluz-ambient', enabled ? 'on' : 'off');
  try {
    await ambientSoundscape.setEnabled(enabled);
  } catch (error) {
    reportAmbientError(error);
  }
}

function refreshAmbientControls() {
  $('#opt-nameplates').setAttribute('aria-checked', String(settings.nameplates));
  $('#opt-ambient').setAttribute('aria-checked', String(ambientEnabled));
  $<HTMLInputElement>('#opt-ambient-volume').disabled = !ambientEnabled;
  for (const [id, value] of [['ambient', settings.ambientVolume], ['master', settings.masterVolume]] as const) {
    const input = $<HTMLInputElement>(`#opt-${id}-volume`);
    input.value = String(value);
    input.style.setProperty('--fill', `${value}%`);
    $(`#opt-${id}-value`).textContent = `${value}%`;
  }
}

function reportAmbientError(error: unknown) {
  console.error('No se pudo iniciar el sonido ambiental:', error);
  ambientEnabled = false;
  void ambientSoundscape.setEnabled(false);
  refreshAmbientControls();
  $('#options-message').textContent = t('No se pudo iniciar el sonido ambiental.');
  localStorage.setItem('brumaluz-ambient', 'off');
}

// ---------------- Ventana de opciones ----------------
let optionsOpen = false;
function setOptionsOpen(open: boolean) {
  optionsOpen = open;
  $('#options-backdrop').hidden = !open;
  keys.clear();
  if (open) {
    setGameMenuOpen(false, false);
    $('#options-message').textContent = '';
    refreshAmbientControls();
    renderControls($('#controls-view'));
    $<HTMLButtonElement>('.options-tab[aria-selected="true"]').focus();
  } else $<HTMLButtonElement>('#game-menu-toggle').focus();
}
function selectOptionsTab(tab: string) {
  for (const b of document.querySelectorAll<HTMLButtonElement>('.options-tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  for (const p of document.querySelectorAll<HTMLElement>('.options-pane')) p.hidden = p.dataset.pane !== tab;
}
for (const b of document.querySelectorAll<HTMLButtonElement>('.options-tab')) b.onclick = () => selectOptionsTab(b.dataset.tab!);
$('#game-menu-options').onclick = () => setOptionsOpen(true);
$('#options-close').onclick = () => setOptionsOpen(false);
$('#options-backdrop').addEventListener('pointerdown', (e) => { if (e.target === e.currentTarget) setOptionsOpen(false); });
$('#opt-ambient').onclick = () => { void setAmbientEnabled(!ambientEnabled); };
$('#opt-nameplates').onclick = () => {
  settings.nameplates = !settings.nameplates;
  saveSettings(settings);
  refreshAmbientControls();
};
for (const id of ['ambient', 'master'] as const) {
  $<HTMLInputElement>(`#opt-${id}-volume`).oninput = (e) => {
    settings[id === 'ambient' ? 'ambientVolume' : 'masterVolume'] = Number((e.target as HTMLInputElement).value);
    saveSettings(settings);
    applyVolumes();
    refreshAmbientControls();
  };
}
refreshAmbientControls();

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
    b.innerHTML = `<span class="ic">${icons[k]}</span>${t(items[k].label)}`;
    b.onclick = () => onPick(k);
    el.appendChild(b);
  });
}

function swatches(el: HTMLElement, colors: () => string[], key: 'skin' | 'hairColor' | 'eyeColor' | 'primary' | 'secondary' | 'clothA' | 'clothB' | 'hairAccColor' | 'makeupColor' | 'accColor', names: () => string[]) {
  return () => {
    el.innerHTML = '';
    const ns = names();
    colors().forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'sw' + (state[key] === i ? ' active' : '');
      b.style.background = c;
      b.title = t(ns[i] ?? '');
      b.setAttribute('aria-label', t(ns[i] ?? c));
      b.onclick = () => set(key, i);
      el.appendChild(b);
    });
  };
}

function stepper(key: 'face' | 'trait' | 'hair' | 'beard' | 'eyeShape' | 'brows' | 'nose' | 'mouth' | 'detail' | 'cape' | 'hairAcc' | 'acc' | 'makeup', list: () => string[], values?: number[]) {
  const el = $(`.stepper[data-key="${key}"]`);
  el.innerHTML = `<button aria-label="${t('Anterior')}">‹</button><div class="val"></div><button aria-label="${t('Siguiente')}">›</button>`;
  const [prev, , next] = Array.from(el.children) as HTMLElement[];
  prev.onclick = () => { const l = list(), indices = values ?? l.map((_, i) => i), current = Math.max(0, indices.indexOf(state[key])); set(key, indices[(current + l.length - 1) % l.length]); };
  next.onclick = () => { const l = list(), indices = values ?? l.map((_, i) => i), current = Math.max(0, indices.indexOf(state[key])); set(key, indices[(current + 1) % l.length]); };
  return () => {
    const l = list();
    if (!l.length) return;
    const indices = values ?? l.map((_, i) => i), current = Math.max(0, indices.indexOf(state[key]));
    (el.querySelector('.val') as HTMLElement).innerHTML = `${t(l[current])}<small>${current + 1} / ${l.length}</small>`;
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
  stepper('makeup', () => MAKEUPS),
  swatches($('#makeupColor'), () => ACC_COLORS, 'makeupColor', () => ACC_COLOR_NAMES),
  stepper('hairAcc', () => HAIR_ACCS, HAIR_ACC_VALUES),
  stepper('acc', () => ACCS),
  swatches($('#clothA'), () => CLOTH, 'clothA', () => CLOTH_NAMES),
  swatches($('#clothB'), () => CLOTH, 'clothB', () => CLOTH_NAMES),
  swatches($('#hairAccColor'), () => ACC_COLORS, 'hairAccColor', () => ACC_COLOR_NAMES),
  swatches($('#accColor'), () => ACC_COLORS, 'accColor', () => ACC_COLOR_NAMES),
];

document.querySelectorAll<HTMLButtonElement>('#sex button').forEach((b) => {
  b.onclick = () => {
    const sex = Number(b.dataset.v) as 0 | 1;
    // al cambiar de sexo se aplica una personalización de partida acorde (todo se puede cambiar después)
    if (sex !== state.sex) {
      if (sex === 1) Object.assign(state, { face: 0, hair: 3, beard: 0, eyeShape: 1, brows: 0, makeup: Math.max(state.makeup, 1) });
      else Object.assign(state, { face: 3, hair: 2, eyeShape: 7, brows: 2, makeup: 0 });
    }
    set('sex', sex, true);
  };
});
for (const key of ['height', 'build'] as const) {
  const input = $<HTMLInputElement>('#' + key);
  input.oninput = () => set(key, Number(input.value));
}

const nameInput = $<HTMLInputElement>('#name');
nameInput.oninput = () => { state.name = nameInput.value; };
$('#dice').onclick = () => { state.name = randomName(state.race); refreshUI(); };

function refreshUI() {
  document.querySelectorAll<HTMLElement>('#races .card').forEach((c) => c.classList.toggle('active', c.dataset.k === state.race));
  document.querySelectorAll<HTMLElement>('#classes .card').forEach((c) => c.classList.toggle('active', c.dataset.k === state.cls));
  $('#raceDesc').textContent = t(RACES[state.race].desc);
  const stats = $('#raceStats');
  stats.replaceChildren();
  const assigned = Object.values(state.attributePoints).reduce((sum, points) => sum + points, 0);
  const remaining = ATTRIBUTE_POINTS_AVAILABLE - assigned;
  $('#attributePointsLeft').textContent = t('Puntos para repartir: {remaining} de {total}', { remaining, total: ATTRIBUTE_POINTS_AVAILABLE });
  (Object.keys(ATTRIBUTES) as AttributeId[]).forEach((key) => {
    const row = document.createElement('div');
    row.className = 'race-stat';
    const label = document.createElement('span');
    label.className = 'race-stat-name';
    label.textContent = t(ATTRIBUTES[key].label);
    const value = document.createElement('strong');
    value.className = 'race-stat-score';
    const racialBonus = RACES[state.race].bonuses[key];
    const allocated = state.attributePoints[key];
    const bonus = racialBonus + allocated;
    const total = ATTRIBUTE_BASE_VALUE + bonus;
    value.textContent = bonus ? `${ATTRIBUTE_BASE_VALUE} +${bonus} = ${total}` : String(ATTRIBUTE_BASE_VALUE);
    if (bonus) value.classList.add('attribute-bonus');
    value.setAttribute('aria-label', t('Base {base} · bonificación racial +{racial} · puntos asignados +{allocated} · máximo {max}', {
      base: ATTRIBUTE_BASE_VALUE, racial: racialBonus, allocated, max: ATTRIBUTE_MAX_VALUE,
    }));
    const description = document.createElement('span');
    description.className = 'race-stat-description';
    description.textContent = t(ATTRIBUTES[key].desc);
    const controls = document.createElement('span');
    controls.className = 'attribute-controls';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '−';
    remove.disabled = allocated === 0;
    remove.setAttribute('aria-label', t('Quitar un punto de {attribute}', { attribute: t(ATTRIBUTES[key].label) }));
    remove.onclick = () => {
      state.attributePoints[key] -= 1;
      refreshUI();
    };
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = '+';
    add.disabled = remaining === 0 || ATTRIBUTE_BASE_VALUE + bonus >= ATTRIBUTE_MAX_VALUE;
    add.setAttribute('aria-label', t('Añadir un punto a {attribute}', { attribute: t(ATTRIBUTES[key].label) }));
    add.onclick = () => {
      state.attributePoints[key] += 1;
      refreshUI();
    };
    controls.append(remove, add);
    row.append(label, value, controls, description);
    stats.appendChild(row);
  });
  $('#classDesc').textContent = t(CLASSES[state.cls].desc);
  document.querySelectorAll<HTMLElement>('#sex button').forEach((b) => b.classList.toggle('active', Number(b.dataset.v) === state.sex));
  $<HTMLInputElement>('#height').value = String(state.height);
  $<HTMLInputElement>('#build').value = String(state.build);
  const R = RACES[state.race];
  $('#traitBox').hidden = !R.traitLabel;
  $('#noseBox').hidden = state.race === 'pelso' || state.race === 'lagto';
  $('#makeupColorBox').hidden = ![2, 3, 4].includes(state.makeup);
  if (R.traitLabel) $('#traitLabel').textContent = state.race === 'lagto' ? t('Cresta del linaje') : t(R.traitLabel);
  $('#hairNote').textContent = '';
  if (document.activeElement !== nameInput) nameInput.value = state.name;
  renders.forEach((r) => r());
}

// Pestañas: cambian el encuadre y, en Clase, visten al personaje
function selectTab(name: string) {
  const wasOutfit = tab === 'clase';
  tab = name;
  const tabButtons = [...document.querySelectorAll<HTMLButtonElement>('#tabs button')];
  const selectedIndex = tabButtons.findIndex((button) => button.dataset.tab === name);
  if (selectedIndex >= 0) $('#panel').style.setProperty('--tab-marker-left', `${(selectedIndex + 0.5) * 100 / tabButtons.length}%`);
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
let toastSourceTitle = '';
let toastSourceText = '';
let toastValues: Record<string, string | number> = {};
function renderToast() {
  if (!toastSourceTitle && !toastSourceText) return;
  const element = $('#toast');
  const heading = document.createElement('h2');
  heading.textContent = t(toastSourceTitle, toastValues);
  const message = document.createElement('p');
  message.textContent = t(toastSourceText, toastValues);
  element.replaceChildren(heading, message);
}
function toast(title: string, text: string, error = false, values: Record<string, string | number> = {}) {
  toastSourceTitle = title;
  toastSourceText = text;
  toastValues = values;
  renderToast();
  const element = $('#toast');
  element.classList.toggle('error', error);
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element.classList.remove('show'), 3200);
}

function showAuthScreen(message = '') {
  syncBackdropTime();
  document.body.classList.add('auth-visible');
  document.body.classList.remove('characters-visible');
  $('#account-gate').hidden = false;
  $('#auth-screen').hidden = false;
  $('#character-screen').hidden = true;
  $('#auth-title').textContent = t('Un nuevo capítulo');
  $('#auth-intro').textContent = t('Inicia sesión o crea una cuenta para entrar en el mundo de Brumaluz.');
  $('#auth-intro').hidden = false;
  $('.auth-switch').hidden = false;
  authForm.hidden = false;
  $('#recovery-request-form').hidden = true;
  $('#password-update-form').hidden = true;
  if (authMode !== 'login') $('[data-auth-mode="login"]').click();
  $('#auth-message').textContent = message;
  $('#auth-message').classList.remove('error');
}

function showRecoveryRequestScreen() {
  syncBackdropTime();
  document.body.classList.add('auth-visible');
  document.body.classList.remove('characters-visible');
  $('#account-gate').hidden = false;
  $('#auth-screen').hidden = false;
  $('#character-screen').hidden = true;
  $('#auth-title').textContent = t('Recuperar contraseña');
  $('#auth-intro').hidden = true;
  $('.auth-switch').hidden = true;
  authForm.hidden = true;
  $('#password-update-form').hidden = true;
  $('#recovery-request-form').hidden = false;
  $<HTMLInputElement>('#recovery-email').value = $<HTMLInputElement>('#auth-email').value.trim();
  $('#recovery-request-message').textContent = '';
  $('#recovery-request-message').classList.remove('error');
  $<HTMLInputElement>('#recovery-email').focus();
}

function showPasswordUpdateScreen(user: User) {
  passwordRecoveryUser = user;
  currentUser = user;
  syncBackdropTime();
  document.body.classList.add('auth-visible');
  document.body.classList.remove('characters-visible');
  $('#account-gate').hidden = false;
  $('#auth-screen').hidden = false;
  $('#character-screen').hidden = true;
  $('#auth-title').textContent = t('Nueva contraseña');
  $('#auth-intro').hidden = true;
  $('.auth-switch').hidden = true;
  authForm.hidden = true;
  $('#recovery-request-form').hidden = true;
  $('#password-update-form').hidden = false;
  $<HTMLInputElement>('#new-password').value = '';
  $<HTMLInputElement>('#confirm-new-password').value = '';
  $('#password-update-message').textContent = '';
  $('#password-update-message').classList.remove('error');
  $<HTMLInputElement>('#new-password').focus();
}

function showEditor() {
  document.body.classList.remove('auth-visible', 'characters-visible');
  $('#account-gate').hidden = true;
  document.querySelectorAll<HTMLElement>('#tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === 'raza'));
  document.querySelectorAll<HTMLElement>('#pages section').forEach((section) => section.classList.toggle('active', section.dataset.page === 'raza'));
  tab = 'raza';
  $('#panel').style.setProperty('--tab-marker-left', '10%');
  focus = 'body';
  zoom = 1;
  refreshUI();
  rebuildNow();
  layout();
}

function showCharacterScreen() {
  syncBackdropTime();
  document.body.classList.remove('auth-visible');
  document.body.classList.add('characters-visible');
  $('#account-gate').hidden = false;
  $('#auth-screen').hidden = true;
  $('#character-screen').hidden = false;
  $('#account-username').textContent = currentUsername ?? t('Nombre de usuario pendiente de asignación');
  $('#account-email').textContent = currentUser?.email ?? '';
  $('#character-message').classList.remove('error');
}

function syncBackdropTime() {
  const hour = new Date().getHours();
  document.body.classList.toggle('daytime', hour >= 6 && hour < 18);
}

function displayCharacters(characters: SavedCharacter[]) {
  cachedCharacters = characters;
  const list = $('#character-list');
  list.replaceChildren();
  $('#character-count').textContent = `(${characters.length}/${MAX_CHARACTERS_PER_ACCOUNT})`;
  if (!characters.length) {
    const empty = document.createElement('p');
    empty.className = 'account-intro';
    empty.textContent = t('Aún no tienes personajes. Crea uno para comenzar tu aventura.');
    list.appendChild(empty);
  }
  for (const saved of characters) {
    const record = document.createElement('article');
    record.className = 'character-card';
    const info = document.createElement('div');
    info.className = 'character-info';
    const copy = document.createElement('div');
    copy.className = 'character-copy';
    const name = document.createElement('strong');
    name.textContent = saved.name;
    const detail = document.createElement('span');
    detail.className = 'character-detail';
    const data = characterFromRecord(saved);
    detail.textContent = `${raceText(data)} · ${classText(data)}`;
    const portrait = createCharacterPortrait(data, renderer);
    portrait.className = 'character-portrait';
    portrait.setAttribute('aria-hidden', 'true');
    const level = document.createElement('span');
    level.className = 'character-level';
    level.textContent = `${t('Nivel')} ${data.level}`;
    const location = document.createElement('span');
    location.className = 'character-location';
    const locationIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    locationIcon.setAttribute('viewBox', '0 0 24 24');
    locationIcon.setAttribute('aria-hidden', 'true');
    locationIcon.innerHTML = '<path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4l8-4.6Z"/><path d="M8 16V9.5l4-2.3 4 2.3V16M6.5 16h11M10 11h.01M14 11h.01M11 16v-2.5h2V16"/>';
    const locationName = t(LOCATIONS[data.location]);
    location.append(locationIcon, document.createTextNode(locationName));
    location.setAttribute('aria-label', t('Ubicación: {location}', { location: locationName }));
    copy.append(name, detail, level, location);
    info.append(portrait, copy);
    const actions = document.createElement('div');
    actions.className = 'character-actions';
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'btn gold';
    play.textContent = t('Jugar');
    play.onclick = () => {
      loadCharacter(saved);
      showEditor();
      enterPlay();
    };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn danger';
    remove.textContent = t('Borrar');
    remove.setAttribute('aria-label', `${t('Borrar')} ${saved.name}`);
    remove.onclick = () => openDeleteDialog(saved);
    actions.append(play, remove);
    record.append(info, actions);
    const classBadge = document.createElement('span');
    classBadge.className = 'character-class-icon';
    classBadge.title = classText(data);
    classBadge.innerHTML = classIcon(data.cls, `card${saved.id}`);
    record.append(classBadge);
    list.appendChild(record);
  }
  const atCharacterLimit = characters.length >= MAX_CHARACTERS_PER_ACCOUNT;
  $<HTMLButtonElement>('#new-character').disabled = atCharacterLimit;
  $('#character-limit-message').textContent = atCharacterLimit
    ? t('Has alcanzado el máximo de {max} personajes por cuenta. Borra uno para crear otro.', { max: MAX_CHARACTERS_PER_ACCOUNT })
    : t('Puedes tener hasta {max} personajes en tu cuenta.', { max: MAX_CHARACTERS_PER_ACCOUNT });
}

let characterPendingDeletion: SavedCharacter | null = null;
let deletingCharacter = false;

function openDeleteDialog(character: SavedCharacter) {
  characterPendingDeletion = character;
  $('#delete-dialog-description').textContent = t('Vas a borrar definitivamente a {name}. Esta acción no se puede deshacer.', { name: character.name });
  deleteNameInput.disabled = false;
  deleteNameInput.value = '';
  $('#delete-dialog-message').textContent = '';
  $<HTMLButtonElement>('#confirm-delete').disabled = true;
  $('#delete-dialog-backdrop').hidden = false;
  $<HTMLInputElement>('#delete-character-name').focus();
}

function closeDeleteDialog() {
  if (deletingCharacter) return;
  characterPendingDeletion = null;
  $('#delete-dialog-backdrop').hidden = true;
}

const deleteNameInput = $<HTMLInputElement>('#delete-character-name');
const deleteConfirmButton = $<HTMLButtonElement>('#confirm-delete');
deleteNameInput.oninput = () => {
  deleteConfirmButton.disabled = !characterPendingDeletion || deleteNameInput.value !== characterPendingDeletion.name;
  $('#delete-dialog-message').textContent = '';
};
$('#cancel-delete').onclick = closeDeleteDialog;
$('#delete-dialog-backdrop').addEventListener('click', (event) => {
  if (event.target === $('#delete-dialog-backdrop')) closeDeleteDialog();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('#delete-dialog-backdrop').hidden) closeDeleteDialog();
});
deleteConfirmButton.onclick = async () => {
  const selected = characterPendingDeletion;
  const user = currentUser;
  if (!selected || !user || deleteNameInput.value !== selected.name || deleteConfirmButton.disabled) return;

  deleteConfirmButton.disabled = true;
  deleteNameInput.disabled = true;
  deletingCharacter = true;
  $('#cancel-delete').setAttribute('disabled', 'true');
  $('#delete-dialog-message').textContent = t('Borrando personaje…');
  try {
    await removeCharacter(user.id, selected.id);
    deletingCharacter = false;
    if (activeCharacterId === selected.id) activeCharacterId = null;
    closeDeleteDialog();
    if (currentUser?.id === user.id) await loadCharacterSelection(user);
  } catch (error) {
    deletingCharacter = false;
    deleteNameInput.disabled = false;
    $('#delete-dialog-message').textContent = errorMessage(error);
    $('#cancel-delete').removeAttribute('disabled');
    deleteConfirmButton.disabled = deleteNameInput.value !== selected.name;
  }
};

function characterFromRecord(saved: SavedCharacter) {
  if (!saved.data || typeof saved.data !== 'object' || Array.isArray(saved.data)) {
    throw new Error(`Los datos guardados de ${saved.name} no tienen un formato válido.`);
  }
  const character = sanitize(saved.data as Record<string, unknown>);
  character.name = saved.name;
  return character;
}

function loadCharacter(saved: SavedCharacter) {
  state = characterFromRecord(saved);
  activeCharacterId = saved.id;
}

async function loadCharacterSelection(user: User) {
  const syncId = ++accountSyncId;
  currentUsername = null;
  currentUser = user;
  showCharacterScreen();
  $('#account-username').textContent = t('Cargando…');
  $('#character-list').replaceChildren();
  $('#character-message').textContent = t('Cargando tus personajes…');
  try {
    const [charactersResult, usernameResult] = await Promise.allSettled([
      listCharacters(user.id),
      getProfileUsername(user.id),
    ]);
    if (syncId !== accountSyncId || currentUser?.id !== user.id) return;
    if (charactersResult.status === 'rejected') throw charactersResult.reason;
    displayCharacters(charactersResult.value);
    if (usernameResult.status === 'fulfilled') {
      currentUsername = usernameResult.value;
      $('#account-username').textContent = currentUsername ?? t('Nombre de usuario pendiente de asignación');
      $('#character-message').textContent = '';
      $('#character-message').classList.remove('error');
    } else {
      $('#account-username').textContent = t('No se pudo cargar el nombre de usuario');
      $('#character-message').textContent = errorMessage(usernameResult.reason);
      $('#character-message').classList.add('error');
    }
  } catch (error) {
    if (syncId !== accountSyncId) return;
    $('#character-message').textContent = errorMessage(error);
    $('#character-message').classList.add('error');
  }
}

async function syncAccount(sessionUser: User | null) {
  if (!sessionUser) {
    if (mode === 'play') exitPlay();
    accountSyncId++;
    currentUser = null;
    currentUsername = null;
    activeCharacterId = null;
    showAuthScreen();
    return;
  }
  if (currentUser && currentUser.id !== sessionUser.id && mode === 'play') exitPlay();
  await loadCharacterSelection(sessionUser);
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    if (error.message.includes('USERNAME_ALREADY_TAKEN') || error.message.includes('profiles_username_unique')) {
      return t('Ese nombre de usuario ya está en uso. Elige otro.');
    }
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
    return t('Ya tienes un personaje con ese nombre. Elige otro.');
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const message = error.message;
    if (message.includes('Invalid login credentials')) return t('Correo o contraseña incorrectos.');
    if (message.includes('Email not confirmed')) return t('Confirma tu correo antes de iniciar sesión.');
    if (message.includes('User already registered')) return t('Ya existe una cuenta con ese correo.');
    return t(message);
  }
  return t('Ha ocurrido un error inesperado. Inténtalo de nuevo.');
}

function validCharacterName() {
  const name = state.name.trim();
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{3,16}$/.test(name)) {
    toast('Un momento…', 'Tu nombre necesita entre 3 y 16 letras.', true);
    nameInput.focus();
    return false;
  }
  state.name = name[0].toUpperCase() + name.slice(1);
  nameInput.value = state.name;
  return true;
}

async function saveCurrentCharacter() {
  if (savingCharacter || !currentUser || !validCharacterName()) return false;
  savingCharacter = true;
  try {
    activeCharacterId = await persistCharacter(currentUser.id, activeCharacterId, state);
    return true;
  } catch (error) {
    toast('No se pudo guardar', errorMessage(error), true);
    return false;
  } finally {
    savingCharacter = false;
  }
}

async function returnToCharacters() {
  if (mode === 'play') {
    state.location = city.locationId;
    if (!(await saveCurrentCharacter())) return;
    exitPlay();
  }
  if (currentUser) await loadCharacterSelection(currentUser);
}

function startNewCharacter() {
  if (!currentUser || $<HTMLButtonElement>('#new-character').disabled) return;
  state = defaultChar();
  state.name = randomName(state.race);
  activeCharacterId = null;
  showEditor();
}

const authForm = $<HTMLFormElement>('#auth-form');
let authMode: 'login' | 'register' = 'login';
document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((button) => {
  button.onclick = () => {
    authMode = button.dataset.authMode === 'register' ? 'register' : 'login';
    document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]').forEach((option) => {
      const active = option === button;
      option.classList.toggle('active', active);
      option.setAttribute('aria-selected', String(active));
    });
    const confirmField = $<HTMLDivElement>('#confirm-password-field');
    const confirmInput = $<HTMLInputElement>('#auth-confirm-password');
    const usernameField = $<HTMLDivElement>('#username-field');
    const usernameInput = $<HTMLInputElement>('#auth-username');
    confirmField.hidden = authMode !== 'register';
    confirmInput.required = authMode === 'register';
    usernameField.hidden = authMode !== 'register';
    usernameInput.required = authMode === 'register';
    $('#forgot-password').hidden = authMode !== 'login';
    $<HTMLInputElement>('#auth-password').autocomplete = authMode === 'register' ? 'new-password' : 'current-password';
    $('#auth-submit').textContent = authMode === 'register' ? t('Crear cuenta') : t('Iniciar sesión');
    $('#auth-message').textContent = '';
    $('#auth-message').classList.remove('error');
  };
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = $<HTMLInputElement>('#auth-username').value.trim();
  const email = $<HTMLInputElement>('#auth-email').value.trim();
  const password = $<HTMLInputElement>('#auth-password').value;
  const message = $('#auth-message');
  const submit = $<HTMLButtonElement>('#auth-submit');
  if (authMode === 'register' && !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    message.textContent = t('El nombre de usuario debe tener entre 3 y 20 caracteres: letras, números o guion bajo.');
    message.classList.add('error');
    return;
  }
  if (authMode === 'register' && password !== $<HTMLInputElement>('#auth-confirm-password').value) {
    message.textContent = t('Las contraseñas no coinciden.');
    message.classList.add('error');
    return;
  }
  submit.disabled = true;
  message.classList.remove('error');
  message.textContent = authMode === 'register' ? t('Creando tu cuenta…') : t('Iniciando sesión…');
  try {
    if (authMode === 'register') {
      const result = await signUp(username, email, password);
      if (!result.session) {
        $('[data-auth-mode="login"]').click();
        message.textContent = t('Cuenta creada. Revisa tu correo para confirmar la dirección y luego inicia sesión.');
      } else {
        await syncAccount(result.user);
      }
    } else {
      const result = await signIn(email, password);
      await syncAccount(result.user);
    }
  } catch (error) {
    message.textContent = errorMessage(error);
    message.classList.add('error');
  } finally {
    submit.disabled = false;
  }
});

$('#forgot-password').onclick = showRecoveryRequestScreen;
$('#recovery-back-to-login').onclick = () => showAuthScreen();

$('#recovery-request-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const emailInput = $<HTMLInputElement>('#recovery-email');
  const submit = $<HTMLButtonElement>('#recovery-request-submit');
  const message = $('#recovery-request-message');
  submit.disabled = true;
  message.classList.remove('error');
  message.textContent = t('Enviando el enlace…');
  try {
    await requestPasswordReset(emailInput.value.trim(), `${window.location.origin}${window.location.pathname}`);
    message.textContent = t('Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña. Revisa también la carpeta de spam.');
  } catch (error) {
    message.textContent = errorMessage(error);
    message.classList.add('error');
  } finally {
    submit.disabled = false;
  }
});

$<HTMLFormElement>('#password-update-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = $<HTMLInputElement>('#new-password').value;
  const confirmPassword = $<HTMLInputElement>('#confirm-new-password').value;
  const submit = $<HTMLButtonElement>('#password-update-submit');
  const message = $('#password-update-message');
  if (password !== confirmPassword) {
    message.textContent = t('Las contraseñas no coinciden.');
    message.classList.add('error');
    return;
  }
  if (!passwordRecoveryUser) {
    message.textContent = t('El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo.');
    message.classList.add('error');
    return;
  }
  submit.disabled = true;
  message.classList.remove('error');
  message.textContent = t('Actualizando la contraseña…');
  try {
    await updatePassword(password);
    const user = passwordRecoveryUser;
    passwordRecoveryUser = null;
    await syncAccount(user);
    $('#character-message').textContent = t('Contraseña actualizada correctamente.');
  } catch (error) {
    message.textContent = errorMessage(error);
    message.classList.add('error');
  } finally {
    submit.disabled = false;
  }
});

$('#sign-out').onclick = async () => {
  try {
    await signOut();
    await syncAccount(null);
  } catch (error) {
    $('#character-message').textContent = errorMessage(error);
    $('#character-message').classList.add('error');
  }
};
$('#new-character').onclick = startNewCharacter;
$('#account-characters').onclick = () => { void returnToCharacters(); };
$('#game-menu-toggle').onclick = () => setGameMenuOpen(!gameMenuOpen);
$('#game-menu-characters').onclick = () => { void returnToCharacters(); };
$('#game-menu-logout').onclick = async () => {
  const logoutButton = $<HTMLButtonElement>('#game-menu-logout');
  logoutButton.disabled = true;
  $('#game-menu-message').textContent = t('Cerrando sesión…');
  try {
    if (mode === 'play') {
      state.location = city.locationId;
      if (!(await saveCurrentCharacter())) return;
    }
    await signOut();
    await syncAccount(null);
  } catch (error) {
    $('#game-menu-message').textContent = errorMessage(error);
    $('#game-menu-message').classList.add('error');
  } finally {
    logoutButton.disabled = false;
  }
};
document.addEventListener('click', (event) => {
  const menu = $('#game-menu');
  if (gameMenuOpen && event.target instanceof Node && !menu.contains(event.target)) {
    setGameMenuOpen(false, false);
  }
});
$('#enter').onclick = async () => {
  if (ambientEnabled) {
    try {
      await ambientSoundscape.prepare();
    } catch (error) {
      reportAmbientError(error);
    }
  }
  if (!(await saveCurrentCharacter())) return;
  spinVel = 0;
  focus = 'body';
  enterPlay();
  setTimeout(() => char.wave(), 60);
  toast('¡Te damos la bienvenida, {name}!', 'Tu aventura en Brumaluz comienza ahora.', false, { name: state.name });
};

async function initializeAccountAccess() {
  try {
    if (!getAccountClient()) {
      $('#auth-config-error').textContent = `${t(accountConfigError())} ${t('Copia .env.example como .env.local, añade los datos del proyecto y reinicia Vite.')}`;
      $('#auth-config-error').hidden = false;
      $('.auth-switch').hidden = true;
      authForm.hidden = true;
      return;
    }
    onAuthChange((event, _session, user) => {
      if (event === 'PASSWORD_RECOVERY' && user) {
        showPasswordUpdateScreen(user);
        return;
      }
      if (passwordRecoveryUser && event !== 'SIGNED_OUT') return;
      void syncAccount(user);
    });
    await syncAccount((await currentSession())?.user ?? null);
  } catch (error) {
    showAuthScreen();
    $('#auth-message').textContent = errorMessage(error);
    $('#auth-message').classList.add('error');
  }
}

// ---------------- Bucle ----------------
/** ?test: sin ciudad ni posproceso, para revisar personajes rápido (capturas automáticas). */
const TEST = new URLSearchParams(location.search).has('test');
function testCity(): City {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9b48a' }));
  ground.receiveShadow = true;
  root.add(ground);
  return { root, locationId: 'brumaluz', vendorSpots: [], collide: (_f, t) => t, groundY: () => 0, spawn: new THREE.Vector3(), spawnYaw: 0, update() {} };
}
const clock = new THREE.Clock();
try {
  await loadKits();
  city = TEST ? testCity() : await buildCity();
} catch (e) {
  $('#loading p').textContent = t('No se pudo cargar Brumaluz: ') + (e instanceof Error ? e.message : String(e));
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
  city.update(t, mode === 'play' ? holder.position : undefined);
  stage.follow(holder.position, mode === 'play');
  updateCamera(dt);
  updateNameplate();
  if (TEST) renderer.render(scene, camera); else stage.render();
});

requestAnimationFrame(() => setTimeout(() => $('#loading').classList.add('hide'), 400));
syncBackdropTime();
window.setInterval(syncBackdropTime, 60_000);
if (TEST) {
  $('#account-gate').hidden = true;
  document.body.classList.remove('auth-visible', 'characters-visible');
} else {
  void initializeAccountAccess();
}

// Gancho de depuración para pruebas desde la consola.
(window as unknown as { brumaluz: object }).brumaluz = {
  set(d: Partial<CharData>) { state = sanitize({ ...state, ...d } as unknown as Record<string, unknown>); rebuildNow(); refreshUI(); },
  tab: selectTab,
  wave() { char.wave(); },
  play: () => enterPlay(),
  spin(a: number) { holder.rotation.y = a; spinVel = 0; },
  move(x: number, z: number) { holder.position.set(x, 0, z); },
  view(y: number, p: number, d: number) { yaw = y; pitch = p; followDist = d; zoomTarget = d; },
  char: () => char,
  city: () => city,
  time() { const t0 = performance.now(); rebuildNow(); return performance.now() - t0; },
};

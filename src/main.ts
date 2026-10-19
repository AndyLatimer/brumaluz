import * as THREE from 'three';
import {
  accountConfigError, currentSession, getAccountClient, getProfileUsername, listCharacters, onAuthChange,
  requestPasswordReset, createCharacter, enterCharacter, characterActions, spendAttributePoints, upgradeCharacterSkill, setCharacterTitle, getMyTitles,
  signIn, signOut, signUp, updatePassword, type SavedCharacter, type CharacterAction,
  buyFromVendor, sellToVendor, useItem, moveInventoryItem, welcomeAction, sendChatMessage, subscribeChat,
  deleteCharacter as removeCharacter, MAX_CHARACTERS_PER_ACCOUNT,
  startCombat, combatAction, changeEquipment, lootCorpse, shadowAction,
} from './services/account';
import { captureTopDown } from './world/mapCapture';
import { initMinimap, updateMinimap, setMinimapImage, setMapPlayerCount, toggleMinimap } from './ui/minimap';
import { initChat, chatReceive, chatCombat, chatSystem, chatNpc, chatSelfSay, setChatSelf, setChatSpeechListener, focusChat, clearChat } from './ui/chatWindow';
import { simulateAction, simulateSpend, simulateBuy, simulateSell, simulateUse, simulateWelcome, addItem } from './services/devActions';
import type { User } from '@supabase/supabase-js';
import { applyLanguage, getLanguage, setLanguage, t, raceText, classText } from './ui/i18n';
import { world } from './world/paint';
import { buildEnv } from './world/env';
import { Character, loadKits } from './character/character';
import { createCharacterPortrait } from './character/portrait';
import { setupStage, castShadows } from './world/render';
import { createGraphics } from './world/graphics';
import { RemotePlayers } from './world/players';
import { renderSocial } from './ui/socialWindow';
import { startFriendNotifications } from './ui/friendNotifications';
import { createPlayerInteractions } from './ui/playerInteractions';
import { createTradeWindow } from './ui/tradeWindow';
import { createTargetFrame, type NpcType, type TargetDetails } from './ui/targetFrame';
import { getParty, observeParty, startParty, stopParty, partySelf, isPartyLeader } from './services/party';
import { initPartyHud } from './ui/partyPanel';
import { WorldConnection, parseCombatEncounter, parsePublicVitals, type CombatEncounter, type WorldSnapshot } from './services/multiplayer';
import { buildCity, City, COMBAT_SITE, type Interactable } from './world/city';
import { AmbientSoundscape } from './world/audio';
import { FACE_KITS, FACE_LABELS, HAIR_STYLES, BEARDS, EYE_SHAPES, BROWS, NOSES, MOUTHS, DETAILS } from './character/head';
import {
  CharData, Race, ClassId, RACES, CLASSES, ATTRIBUTES, ATTRIBUTE_POINTS_AVAILABLE, ATTRIBUTE_BASE_VALUE, ATTRIBUTE_MAX_VALUE, MAX_LEVEL, unspentAttributePoints, AttributeId, HAIR_COLORS, HAIR_NAMES, CLOTH, CLOTH_NAMES, EYE_COLORS, EYE_COLOR_NAMES,
  defaultChar, randomChar, randomName, sanitize, HAIR_ACCS, HAIR_ACC_VALUES, ACCS, MAKEUPS, ACC_COLORS, ACC_COLOR_NAMES, LOCATIONS,
} from './data/data';
import { vitalsOf, experienceToNextLevel, attributeTotal, OVERHEAL } from './data/stats';
import { TITLES, isReservedTitle, setGrantedTitles, PHOENIX_ICON } from './data/titles';
import { openDialog, openConversation, closeDialog, advanceDialog, chooseDialog, moveDialogChoice, isDialogOpen, exitDialog, refreshDialog, setDialogLogger, type DialogLine, type DialogChoice, type Conversation } from './ui/dialog';
import { renderInventory, renderSheet } from './ui/playerWindows';
import { renderVendor } from './ui/vendorWindow';
import { initActionBar, renderActionBar, autoAssignToActionBar, assignSkillToActionBar, useActionBarSlot, actionBarSlotForKey, toggleActionBarPage } from './ui/actionBar';
import { renderSkills, skillAction } from './ui/skillsWindow';
import { skillIcon } from './ui/skillIcons';
import { classIcon } from './ui/classIcons';
import { initTooltips } from './ui/tooltip';
import { renderControls } from './ui/controls';
import { loadSettings, saveSettings } from './services/settings';
import { initMenuMusic } from './ui/menuMusic';
import { initBuffLayout, renderBuffs } from './ui/buffs';
import { beginTransition } from './ui/transitionLoading';
import type { FoodBuff } from './data/food';
import { WELCOME_START, WELCOME_BADGE, WELCOME_TITLE, SHADOW_TITLE, SHADOW_RETURN, shadowObjective, welcomeObjective, parseShadowQuest, type WelcomeAction, type ShadowAction } from './data/quests';
import { EQUIPPABLE, hasCombatWeapon, transferEquipment } from './data/equipment';
import type { EquipmentSlot } from './data/inventory';
import { renderLoot } from './ui/lootWindow';
import { createWelcomeWorld } from './world/welcome';
import { createQuestTracker, renderQuestJournal, welcomeConversation } from './ui/questWindow';
import { COMBAT_KITS, MAX_SKILL_RANK, resolveCombat, skillRank, unspentSkillPoints, upgradeSkill, type CombatState } from './data/combat';


// ---------------- Estado ----------------
let state: CharData = defaultChar();
let skillReadyAt = 0;
let lockedEnemy = false;
let combatApproach = false;
if (!state.name) state.name = randomName(state.race);
function isbertoUnlocked() {
  return state.welcome?.stage === 'completed';
}

let activeCharacterId: string | null = null;
let currentUser: User | null = null;
let currentUsername: string | null = null;
let cachedCharacters: SavedCharacter[] = [];
let accountSyncId = 0;
let savingCharacter = false;
let enteringWorld = false;
let passwordRecoveryUser: User | null = null;

// ---------------- Render ----------------
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const graphics = createGraphics(canvas);
const renderer = graphics.renderer;
graphics.resize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 900);
const env = buildEnv(scene);
const lowEnd = graphics.compatible || window.innerWidth <= 760 || /Mobi|Android/i.test(navigator.userAgent);
const stage = (() => {
  try {
    return setupStage(renderer, scene, camera, lowEnd, graphics.compatible);
  } catch (error) {
    graphics.fail('No se pudo dibujar el mundo 3D. Prueba el modo compatible.', error);
    throw error;
  }
})();

const holder = new THREE.Group();
holder.rotation.y = -0.3;
scene.add(holder);

let tab = 'raza';
let mode: 'create' | 'play' = 'create';
let playGeneration = 0;
function characterContext() {
  const character = state;
  const characterId = activeCharacterId;
  const userId = currentUser?.id;
  const generation = playGeneration;
  const accountGeneration = accountSyncId;
  return () => state === character && activeCharacterId === characterId && currentUser?.id === userId && playGeneration === generation && accountSyncId === accountGeneration;
}
let city: City;
let char: Character;
let pendingHop = false;
let rebuildQueued = false;
const ambientSoundscape = new AmbientSoundscape();
const menuMusic = initMenuMusic();
if (import.meta.hot) import.meta.hot.dispose(() => {
  void ambientSoundscape.dispose().catch((error: unknown) => console.error('No se pudo cerrar el sonido ambiental:', error));
  void menuMusic.dispose().catch((error: unknown) => console.error('No se pudo cerrar la música:', error));
});
let ambientEnabled = localStorage.getItem('brumaluz-ambient') !== 'off';
const settings = loadSettings();
function applyVolumes() {
  ambientSoundscape.setLevel((settings.ambientVolume / 100) * (settings.masterVolume / 100));
  menuMusic.setLevel(settings.masterVolume / 100);
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
  graphics.resize(w, h);
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
let conversationActor: THREE.Object3D | null = null;
let conversationFacing = 0;
let conversationSide = 1;
let conversationOffset = 0;
let returningFromConversation = false;
let conversationShot = '';
let conversationOrbitYaw = 0, conversationOrbitPitch = 0;
let pendingIsbertoIntroduction = false;
const conversationPosition = new THREE.Vector3();
const conversationRay = new THREE.Raycaster();
let conversationObstacles: THREE.Object3D[] = [];
function beginConversation(actor: THREE.Object3D, conversation: Conversation) {
  closeDialog();
  conversationActor = actor;
  conversationShot = '';
  conversationOrbitYaw = 0; conversationOrbitPitch = 0;
  conversationFacing = actor.rotation.y;
  const direction = actor.position.clone().sub(holder.position);
  const side = new THREE.Vector3(direction.z, 0, -direction.x);
  conversationSide = side.dot(camera.position.clone().sub(holder.position)) >= 0 ? 1 : -1;
  if (direction.lengthSq() > .01) {
    holder.rotation.y = Math.atan2(direction.x, direction.z);
    actor.rotation.y = holder.rotation.y + Math.PI;
  }
  playerVel.set(0, 0, 0);
  openConversation(conversation, () => {
    actor.rotation.y = conversationFacing;
    conversationActor = null;
    returningFromConversation = true;
  });
}
function updateConversationCamera(dt: number) {
  const actor = conversationActor!;
  const dialogTop = document.getElementById('dialog')!.getBoundingClientRect().top;
  const sceneTop = 24;
  const sceneBottom = Math.max(sceneTop + 60, dialogTop - 16);
  const visibleHeight = sceneBottom - sceneTop;
  const target = holder.position.clone().add(actor.position).multiplyScalar(.5);
  target.y = Math.max(holder.position.y, actor.position.y) + 1;
  const direction = actor.position.clone().sub(holder.position).setY(0);
  if (direction.lengthSq() < .01) direction.set(0, 0, 1);
  direction.normalize();
  const side = new THREE.Vector3(direction.z, 0, -direction.x).multiplyScalar(conversationSide);
  side.addScaledVector(direction, .25).normalize();
  const halfFov = THREE.MathUtils.degToRad(camera.fov * .5);
  const distance = Math.max(
    1.35 / Math.tan(halfFov) * window.innerHeight / visibleHeight,
    (holder.position.distanceTo(actor.position) * .5 + .8) / (Math.tan(halfFov) * camera.aspect),
  );
  const position = target.clone().addScaledVector(side, distance);
  position.y += distance * .18;
  position.y = Math.max(position.y, city.groundY(position.x, position.z) + .6);
  const shot = `${target.x}:${target.z}:${distance.toFixed(2)}`;
  if (shot !== conversationShot) {
    conversationShot = shot;
    city.root.updateWorldMatrix(true, true);
    conversationObstacles = [
      ...env.cameraObstacles,
      ...city.root.children.filter(object => !object.name.startsWith('hex_') && object.name !== 'grass_tufts' && !object.name.startsWith('wildflower_')),
      ...npcActors.filter(npc => npc.character.root !== actor).map(npc => npc.character.root),
      ...remotePlayers.list().map(player => player.root),
    ];
    for (const obstacle of conversationObstacles) obstacle.updateWorldMatrix(true, true);
    let bestClearance = -1;
    findShot: for (const elevation of [.18, .65, 1]) {
      for (const angle of [0, Math.PI, Math.PI / 3, -Math.PI / 3, 2 * Math.PI / 3, -2 * Math.PI / 3, Math.PI / 2, -Math.PI / 2]) {
        const offset = side.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle).multiplyScalar(distance);
        offset.y = distance * elevation;
        const candidate = target.clone().add(offset);
        candidate.y = Math.max(candidate.y, city.groundY(candidate.x, candidate.z) + .6);
        let clearance = 1;
        for (const subject of [holder, actor]) {
          const shoulder = new THREE.Vector3(-offset.z, 0, offset.x).normalize();
          for (const [height, width] of [[.2, 0], [subject === welcomeWorld.root ? .4 : .8, -.3], [subject === welcomeWorld.root ? .4 : .8, .3], [subject === welcomeWorld.root ? .95 : 2.1, 0]]) {
            const origin = subject.position.clone().addScaledVector(shoulder, width);
            origin.y += height;
            const path = candidate.clone().sub(origin);
            conversationRay.set(origin, path.clone().normalize());
            conversationRay.far = path.length();
            const hit = conversationRay.intersectObjects(conversationObstacles, true)[0];
            if (hit) clearance = Math.min(clearance, hit.distance / path.length());
          }
        }
        if (clearance > bestClearance) {
          bestClearance = clearance;
          conversationPosition.copy(candidate);
        }
        if (clearance === 1) break findShot;
      }
    }
  }
  position.copy(conversationPosition);
  if (conversationOrbitYaw || conversationOrbitPitch) {
    const orbit = new THREE.Spherical().setFromVector3(position.clone().sub(target));
    orbit.theta += conversationOrbitYaw;
    orbit.phi = THREE.MathUtils.clamp(orbit.phi + conversationOrbitPitch, .18, Math.PI / 2 - .06);
    const offset = new THREE.Vector3().setFromSpherical(orbit);
    conversationRay.set(target, offset.clone().normalize());
    conversationRay.far = offset.length();
    const obstruction = conversationRay.intersectObjects(conversationObstacles, true)[0];
    if (obstruction) offset.setLength(Math.max(.6, obstruction.distance - .3));
    position.copy(target).add(offset);
    position.y = Math.max(position.y, city.groundY(position.x, position.z) + .6);
  }
  const k = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1 - Math.exp(-dt * 8);
  camTarget.lerp(target, k);
  camera.position.lerp(position, k);
  camera.lookAt(camTarget);
  conversationOffset += ((window.innerHeight - sceneTop - sceneBottom) * .5 - conversationOffset) * k;
  camera.setViewOffset(window.innerWidth, window.innerHeight, 0, conversationOffset, window.innerWidth, window.innerHeight);
}
function updatePlayCamera(dt: number) {
  if (conversationActor && isDialogOpen()) { updateConversationCamera(dt); return; }
  // el objetivo se adelanta un poco en la dirección de marcha y la cámara lo sigue con holgura
  const target = tmp.copy(holder.position).add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(playerVel, 0.12);
  const k = 1 - Math.exp(-dt * 5);
  camTarget.lerp(target, k);
  followDist += (zoomTarget - followDist) * (1 - Math.exp(-dt * 8));
  const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(followDist);
  camPos.copy(camTarget).add(off);
  camPos.y = Math.max(camPos.y, city.groundY(camPos.x, camPos.z) + 0.6);
  if (returningFromConversation) {
    const blend = 1 - Math.exp(-dt * 8);
    camera.position.lerp(camPos, blend);
    conversationOffset *= 1 - blend;
    camera.setViewOffset(window.innerWidth, window.innerHeight, 0, conversationOffset, window.innerWidth, window.innerHeight);
    if (camera.position.distanceTo(camPos) < .02 && Math.abs(conversationOffset) < .1) {
      returningFromConversation = false;
      conversationOffset = 0;
      camera.clearViewOffset();
    }
  } else camera.position.copy(camPos);
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
canvas.addEventListener('pointerdown', (e) => { if (isDialogOpen() && !conversationActor) return; dragging = true; dragDist = 0; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  dragDist += Math.abs(dx) + Math.abs(dy);
  if (conversationActor && isDialogOpen()) {
    conversationOrbitYaw -= dx * .006;
    conversationOrbitPitch = THREE.MathUtils.clamp(conversationOrbitPitch + dy * .005, -1.2, 1.2);
  } else if (mode === 'play') {
    yaw -= dx * 0.006;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.005, 0.05, 1.4);
  } else {
    holder.rotation.y += dx * 0.01;
    spinVel = dx * 0.01;
  }
});
const endDrag = (e: PointerEvent) => {
  if (dragging && mode === 'play' && !isDialogOpen() && !tradeWindow.isOpen && !playerInteractions.isOpen && dragDist < 6 && !clickNpc(e)) clickToMove(e);
  dragging = false;
  canvas.classList.remove('drag');
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { dragging = false; canvas.classList.remove('drag'); });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (isDialogOpen()) return;
  if (mode === 'play') zoomTarget = THREE.MathUtils.clamp(zoomTarget * (1 + e.deltaY * 0.001), 3, 30);
  else zoom = THREE.MathUtils.clamp(zoom * (1 + e.deltaY * 0.001), 0.6, 1.4);
}, { passive: false });

// ---------------- Exploración ----------------
const keys = new Set<string>();
let running = true;
let jumpDuration = 0;
let jumpElapsed = 0;
let jumpHeight = 0;
let waveSequence = 0;
let groundHeight = 0;
function startJump() {
  if (jumpDuration > 0 && jumpElapsed < jumpDuration) return;
  jumpDuration = char.jump();
  if (jumpDuration <= 0) return;
  jumpElapsed = 0;
}
window.addEventListener('keydown', (e) => {
  if (mode !== 'play') return;
  if (tradeWindow.isOpen) { tradeWindow.key(e); return; }
  if (dead) {
    e.preventDefault();
    if (!e.repeat && (e.code === 'KeyE' || e.code === 'Enter')) respawn();
    return;
  }
  if (playerInteractions.isOpen) {
    playerInteractions.key(e);
    return;
  }
  if (optionsOpen) {
    if (e.code === 'Escape' || (e.code === 'KeyO' && !e.repeat)) { e.preventDefault(); setOptionsOpen(false); }
    return;
  }
  if (isDialogOpen()) {
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'Enter') advanceDialog();
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') moveDialogChoice(-1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') moveDialogChoice(1);
    else if (/^Digit[1-9]$/.test(e.code)) chooseDialog(Number(e.code.slice(5)) - 1);
    else if (e.code === 'Escape' || e.code === 'Tab') exitDialog();
    return;
  }
  if (openWindow === 'loot' && e.code === 'KeyE') {
    e.preventDefault();
    const focused = document.activeElement;
    const selected = focused instanceof HTMLButtonElement && focused.matches('.loot-item:not(:disabled)') ? focused
      : $('#window-body').querySelector<HTMLButtonElement>('.loot-item:not(:disabled)');
    if (!e.repeat) selected?.click();
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
    else if (lockedEnemy) releaseCombatTarget();
    else setGameMenuOpen(!gameMenuOpen);
    return;
  }
  if (e.code === 'Enter' && !gameMenuOpen && !playerMenuOpen && !openWindow) {
    e.preventDefault();
    if (!e.repeat) focusChat();
    return;
  }
  if (!e.repeat && !gameMenuOpen && openWindow !== 'vendor' && (e.target as HTMLElement).tagName !== 'INPUT') {
    const win = e.code === 'KeyI' ? 'inventory' : e.code === 'KeyC' ? 'sheet' : e.code === 'KeyJ' ? 'quests' : e.code === 'KeyK' ? 'skills' : null;
    if (win) { e.preventDefault(); setWindow(openWindow === win ? null : win); return; }
    if (e.code === 'KeyO') { e.preventDefault(); setWindow(null, false); setPlayerMenuOpen(false, false); setOptionsOpen(true); return; }
  }
  if (gameMenuOpen || playerMenuOpen || (openWindow && openWindow !== 'loot') || (e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    if (!e.repeat) running = !running;
    return;
  }
  if(e.code==='KeyF'){
    e.preventDefault();
    if(e.repeat)return;
    lockCombatTarget();
    return;
  }
  const barSlot = actionBarSlotForKey(e.code);
  if (e.code === 'KeyZ') {
    if (!e.repeat) toggleActionBarPage();
    return;
  }
  if (e.code === 'Backquote' || e.key === 'º') {
    if (!e.repeat) toggleMinimap();
    return;
  }
  if (barSlot >= 0) {
    if (!e.repeat) useActionBarSlot(barSlot);
    return;
  }
  keys.add(e.code);
  if (e.code === 'KeyE' && !e.repeat) interact();
  if (e.code === 'IntlBackslash' || e.key === '<') { char.wave(); waveSequence++; }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) startJump();
  } else if (e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// ---------------- Interacción (tecla E) ----------------
const playerInteractions = createPlayerInteractions((target) => tradeWindow.invite(target));
const INTERACTIONS: Record<string, () => DialogLine[]> = {
  well: () => [{ speaker: state.name, text: '(Te asomas al pozo, es realmente profundo)' }],
};
function nearestInteractable(): Interactable | null {
  let best: Interactable | null = null, bestDistance = Infinity;
  const corpses: Interactable[] = combatTargetRoot && combatEncounter?.status === 'defeated'
    ? [{ id: 'corpse:shadowling', position: combatTargetRoot.position, radius: 3, label: 'Registrar cuerpo' }] : [];
  if (corpses[0] && !combatEncounter?.looted && holder.position.distanceTo(corpses[0].position) <= 3) return corpses[0];
  for (const item of [...corpses, ...city.interactables, ...welcomeWorld.interactions()]) {
    if (item.id === 'npc:isberto' && !isbertoUnlocked()) continue;
    const distance = Math.hypot(item.position.x - holder.position.x, item.position.z - holder.position.z);
    if (distance <= item.radius && distance < bestDistance) { best = item; bestDistance = distance; }
  }
  return best;
}
function nearestInteraction() {
  const item = nearestInteractable();
  let distance = item ? Math.hypot(item.position.x - holder.position.x, item.position.z - holder.position.z) : Infinity;
  let player: ReturnType<RemotePlayers['list']>[number] | null = null;
  for (const candidate of remotePlayers.list()) {
    const d = Math.hypot(candidate.root.position.x - holder.position.x, candidate.root.position.z - holder.position.z);
    if (d <= TALK_RANGE && d < distance) { player = candidate; distance = d; }
  }
  return { item: player ? null : item, player };
}
function talkTo(npcId: string) {
  pendingTalk = null;
  if (npcId === 'gnomi') { talkGnomi(); return; }
  if (npcId === 'isberto' && !isbertoUnlocked()) return;
  const conv = NPCS[npcId]?.conversation;
  if (!conv) return;
  keys.clear();
  moveTarget = null;
  marker.visible = false;
  const actor = npcActors.find(npc => npc.id === npcId);
  if (actor) beginConversation(actor.character.root, { ...conv, subtitle: NPCS[npcId].title });
}
function interact() {
  if (mode !== 'play' || dead || tradeWindow.isOpen || playerInteractions.isOpen || isDialogOpen() || openWindow || gameMenuOpen || playerMenuOpen || optionsOpen) return;
  const { item, player } = nearestInteraction();
  if (player) {
    pendingTalk = null;
    keys.clear();
    moveTarget = null;
    marker.visible = false;
    playerVel.set(0, 0, 0);
    void playerInteractions.open(player);
    return;
  }
  if (item?.id === 'welcome:gnomi') { talkGnomi(); return; }
  if (item?.id === 'welcome:badge') { void performWelcome('collect'); return; }
  if (item?.id === 'corpse:shadowling') { setWindow('loot'); return; }
  const npcId = item?.id.startsWith('npc:') ? item.id.slice(4) : null;
  if (npcId) { talkTo(npcId); return; }
  const lines = item && INTERACTIONS[item.id]?.();
  if (!lines) return;
  keys.clear();
  moveTarget = null;
  marker.visible = false;
  openDialog(lines);
}
document.getElementById('interact-prompt')!.addEventListener('click', () => interact());
// Clic en un NPC: si está cerca habla con él; si no, camina hasta él y habla al llegar.
let pendingTalk: string | null = null;
const TALK_RANGE = 2.3;
function clickNpc(e: PointerEvent) {
  if (dead || isDialogOpen() || !npcActors.length) return false;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  if (combatTargetRoot && combatEncounter?.status === 'defeated' && ray.intersectObject(combatTargetRoot, true).length) {
    if (holder.position.distanceTo(combatTargetRoot.position) <= 3) setWindow('loot');
    else toast('Botín', 'Acércate al cuerpo para recoger el botín.', true);
    return true;
  }
  if(combatTargetRoot&&combatEncounter?.status==='active'&&ray.intersectObject(combatTargetRoot,true).length){
    lockCombatTarget(true);
    return true;
  }
  if (welcomeWorld.root.visible && ray.intersectObject(welcomeWorld.root, true).length) {
    if (holder.position.distanceTo(welcomeWorld.root.position) <= TALK_RANGE) talkGnomi();
    else {
      moveTarget = welcomeWorld.root.position.clone();
      pendingTalk = 'gnomi';
    }
    return true;
  }
  for (const hit of ray.intersectObjects(npcActors.filter(npc => npc.id !== 'isberto' || isbertoUnlocked()).map((n) => n.character.root), true)) {
    const npc = npcActors.find((n) => { let o: THREE.Object3D | null = hit.object; while (o) { if (o === n.character.root) return true; o = o.parent; } return false; });
    if (!npc || !NPCS[npc.id]) continue;
    const p = npc.character.root.position;
    if (Math.hypot(p.x - holder.position.x, p.z - holder.position.z) <= TALK_RANGE) talkTo(npc.id);
    else {
      pendingTalk = npc.id;
      moveTarget = new THREE.Vector3(p.x, city.groundY(p.x, p.z), p.z);
      marker.visible = false;
    }
    return true;
  }
  return false;
}
function updateInteractPrompt() {
  const prompt = $('#interact-prompt');
  if (playerInteractions.isOpen) {
    const target = remotePlayers.list().find((player) => player.id === playerInteractions.targetId);
    if (mode !== 'play' || dead || !target || Math.hypot(target.root.position.x - holder.position.x, target.root.position.z - holder.position.z) > TALK_RANGE) playerInteractions.close();
  }
  const interaction = mode === 'play' && !dead && !tradeWindow.isOpen && !playerInteractions.isOpen && !isDialogOpen() && !gameMenuOpen && !playerMenuOpen && !openWindow && !optionsOpen ? nearestInteraction() : null;
  prompt.hidden = !interaction?.item && !interaction?.player;
  if (interaction?.item || interaction?.player) {
    const label = interaction.player ? t('Interactuar') : t(interaction.item!.label);
    if ($('#interact-label').textContent !== label) $('#interact-label').textContent = label;
  }
}
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
  combatApproach=false;pendingCombatSkill=false;
  marker.position.set(p.x, city.groundY(p.x, p.z) + 0.03, p.z);
  marker.visible = true;
}
function updatePlay(dt: number) {
  if (dead) { keys.clear(); moveTarget = null; marker.visible = false; }
  if (pendingTalk === 'isberto' && !isbertoUnlocked()) pendingTalk = null;
  if (pendingTalk) {
    const npc = npcActors.find((n) => n.id === pendingTalk);
    const position = pendingTalk === 'gnomi' && welcomeWorld.root.visible ? welcomeWorld.root.position : npc?.character.root.position;
    if (!position || !moveTarget || dead) pendingTalk = null;
    else if (Math.hypot(position.x - holder.position.x, position.z - holder.position.z) <= TALK_RANGE) talkTo(pendingTalk);
  }
  const input = new THREE.Vector2(
    (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0),
  );
  // Movimiento relativo a la cámara: W va hacia donde mira la cámara, A/D van a los lados
  const dir = new THREE.Vector3();
  let clickMoving = false;
  if (input.lengthSq() > 0) {
    combatApproach=false;pendingCombatSkill=false;
    moveTarget = null;
    marker.visible = false;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    dir.set(fx * -input.y + -fz * input.x, 0, fz * -input.y + fx * input.x).normalize();
  } else if (moveTarget) {
    dir.set(moveTarget.x - holder.position.x, 0, moveTarget.z - holder.position.z);
    if (dir.length() < 0.25) { moveTarget = null; marker.visible = false; dir.set(0, 0, 0); } else { dir.normalize(); clickMoving = true; }
  } else if(combatAuto&&combatApproach&&combatTargetRoot&&combatEncounter?.status==='active'){
    const range=COMBAT_KITS[state.cls].range;
    const dx=combatTargetRoot.position.x-holder.position.x,dz=combatTargetRoot.position.z-holder.position.z;
    if(Math.hypot(dx,dz)>range-.1){dir.set(dx,0,dz).normalize();clickMoving=true;}
  }
  if (!dragging && clickMoving && !lockedEnemy) {
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

function tickWorldCombat(time:number) {
  renderActionBar();
  if(!combatTargetRoot||combatEncounter?.status!=='active')return;
  const ring = combatTargetRoot.getObjectByName('combat-lock-ring');
  if (ring) ring.visible = lockedEnemy;
  if (lockedEnemy && combatTargetRoot.position.distanceTo(holder.position) > 35) releaseCombatTarget();
  combatTargetRoot.rotation.y=Math.sin(time*1.6)*.15;
  combatTargetRoot.scale.y=.97+Math.sin(time*4)*.035;
  const kit=COMBAT_KITS[state.cls];
  const distance=Math.hypot(combatTargetRoot.position.x-holder.position.x,combatTargetRoot.position.z-holder.position.z);
  if(pendingCombatSkill&&lockedEnemy&&distance<=kit.range){
    pendingCombatSkill=false;moveTarget=null;playerVel.set(0,0,0);
    void performWorldCombatAction('skill');return;
  }
  const wallTime=performance.now()/1000;
  if(TEST&&!activeCharacterId&&localCombatState&&localCombatState.health>0&&distance<=2&&wallTime>=nextLocalEnemyAttack){
    nextLocalEnemyAttack=wallTime+2;
    const current = vitalsOf(state);
    localCombatState={...localCombatState,health:Math.max(0,current.health-8),maxHealth:current.maxHealth,resource:current.resource};
    const vitals=vitalsOf(state);
    applyCombatResult({
      encounter:combatEncounter,
      vitals:{health:localCombatState.health,maxHealth:localCombatState.maxHealth,overheal:0,
        resource:localCombatState.resource,maxResource:vitals.maxResource,resourceKind:vitals.resourceKind},
      damage:0,healing:0,
    });
    return;
  }
  if(dead||!lockedEnemy||!combatAuto||combatBusy)return;
  if(distance>kit.range)return;
  if(time<nextCombatAttack)return;
  nextCombatAttack=time+kit.interval;
  void performWorldCombatAction('attack');
}
function useWorldCombatSkill() {
  if (mode !== 'play' || dead || combatBusy) return;
  if (performance.now() < skillReadyAt) { toast('Habilidad', 'La acción se está recuperando.', true); return; }
  const kit = COMBAT_KITS[state.cls];
  if (!kit.skill.healing && !hasCombatWeapon(state)) { toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (vitalsOf(state).resource < kit.skill.cost) { toast('Habilidad', 'No tienes recurso suficiente.', true); return; }
  if (!kit.skill.healing && (!lockedEnemy || combatEncounter?.status !== 'active')) {
    toast('Habilidad', 'Fija un enemigo visible con F.', true); return;
  }
  if(state.cls!=='clerigo'&&combatTargetRoot){
    const range=COMBAT_KITS[state.cls].range;
    const distance=Math.hypot(combatTargetRoot.position.x-holder.position.x,combatTargetRoot.position.z-holder.position.z);
    if(distance>range){
      pendingCombatSkill=true;combatAuto=false;
      moveTarget=combatTargetRoot.position.clone();marker.visible=false;
      return;
    }
  }
  pendingCombatSkill=false;
  void performWorldCombatAction('skill');
}
function releaseCombatTarget() {
  lockedEnemy = false; combatAuto = false; combatApproach = false; pendingCombatSkill = false;
  moveTarget = null; marker.visible = false;
  $('#combat-auto').setAttribute('aria-pressed', 'false');
}
function lockCombatTarget(clicked = false) {
  if (!hasCombatWeapon(state)) { toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (combatEncounter?.status !== 'active' || !combatTargetRoot || (!clicked && targetFrame.current()?.id !== 'enemy:shadowling')) {
    toast('Combate', 'Mira a un enemigo visible para fijarlo con F.', true); return;
  }
  lockedEnemy = true; combatAuto = true; combatApproach = true; pendingCombatSkill = false; nextCombatAttack = 0;
  $('#combat-auto').setAttribute('aria-pressed', 'true');
}
const restartClass = (el: HTMLElement, cls: string) => {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  el.addEventListener('animationend', (e) => { if (e.target === el) el.classList.remove(cls); }, { once: true });
};
/** Número flotante que sube desde la cabeza del personaje. */
function floatText(text: string, cls: string) {
  const anchor = new THREE.Vector3(holder.position.x, holder.position.y + 1.6, holder.position.z).project(camera);
  const float = document.createElement('div');
  float.className = `damage-float ${cls}`;
  float.textContent = text;
  float.style.transform = `translate(${((anchor.x * 0.5 + 0.5) * window.innerWidth).toFixed(0)}px, ${((-anchor.y * 0.5 + 0.5) * window.innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
  document.body.appendChild(float);
  float.addEventListener('animationend', () => float.remove());
}

/** Pide una acción al servidor (que decide el resultado) y copia sus datos al estado local. En ?test se simula en local. */
let actionBusy = false;
async function serverAction(action: CharacterAction): Promise<boolean> {
  return runOnServer((id) => characterActions[action](id), () => simulateAction(state, action));
}
/** Ejecuta una petición al servidor con el personaje activo (o su simulación local en ?test) y copia el resultado al estado. */
async function runOnServer(call: (id: string) => Promise<Record<string, unknown>>, simulate: () => void): Promise<boolean> {
  if (actionBusy) return false;
  const stillCurrent = characterContext();
  actionBusy = true;
  try {
    if (activeCharacterId) {
      const data = await call(activeCharacterId);
      if (!stillCurrent()) return false;
      const next = sanitize(data);
      const at = typeof data.food_at === 'number' ? data.food_at : 0;
      const foodCurrent = next.foodRevision > state.foodRevision || (next.foodRevision === state.foodRevision && at >= foodSampleAt);
      if (!foodCurrent) { next.foodBuff = state.foodBuff; next.foodRevision = state.foodRevision; }
      Object.assign(state, next);
      if (data.combatEncounter !== undefined) setCombatEncounter(data.combatEncounter);
      if (foodCurrent) resetFoodTimer(at);
    }
    else if (TEST) { tickFood(); simulate(); resetFoodTimer(); }
    else return false;
    resetOverheal();
    renderActionBar();
    return true;
  } catch (error) {
    if (stillCurrent()) toast('No se pudo completar la acción', errorMessage(error), true);
    return false;
  } finally {
    actionBusy = false;
  }
}

function talkGnomi() {
  if (actionBusy) return;
  keys.clear(); moveTarget = null; pendingTalk = null; marker.visible = false;
  if (state.shadowQuest === 'returning' || state.shadowQuest === 'returned') {
    const arrived = Math.hypot(holder.position.x - SHADOW_RETURN.x, holder.position.z - SHADOW_RETURN.z) <= 4;
    beginConversation(welcomeWorld.root, {
      speaker:'Gnomi', subtitle:'Ayudante del Gremio', start:'intro',
      nodes:{
        intro: state.shadowQuest === 'returned'
          ? {text:'Aquí estamos bien por ahora. Lo de esa criatura sigue siendo un misterio… Ya tendremos tiempo de darle vueltas.'}
          : arrived
            ? {text:'Ya estamos de vuelta en la plaza del pozo. Menudo paseo… y menuda cosa tan rara hemos encontrado. Por ahora nos quedamos aquí, ¿te parece?',
              choices:[{text:'Quedarnos en la plaza',action:()=>performShadow('return'),next:'rest'}]}
            : {text:'Volvamos a la plaza del pozo. Te acompaño. Después de lo del ganado, me apetece un rincón conocido.'},
        rest:{text:'Aquí estamos bien por ahora. Lo de esa criatura sigue siendo un misterio… Ya tendremos tiempo de darle vueltas.'},
      },
    });
    return;
  }
  if (!state.welcome) {
    beginConversation(welcomeWorld.root, {
      speaker:'Gnomi',subtitle:'Ayudante del Gremio',start:'intro',
      nodes:{intro:{text:'¡Hola! Soy Gnomi, del Gremio de Ayudantes. Ahora mismo no tengo ningún encargo para ti, pero seguro que nos cruzamos pronto.'}},
    });
    return;
  }
  if (state.welcome.origin === null) welcomeWorld.greet();
  beginConversation(welcomeWorld.root, welcomeConversation(state, performWelcome));
}
async function performShadow(action: ShadowAction) {
  const target = action === 'return' ? SHADOW_RETURN : npcActors.find(npc => npc.id === 'isberto')?.character.root.position;
  if (!target || Math.hypot(holder.position.x - target.x, holder.position.z - target.z) > (action === 'return' ? 4 : 6)) {
    toast('No se pudo completar la acción', 'Acércate al objetivo para continuar la misión.', true);
    return false;
  }
  const success = await runOnServer(id => shadowAction(id, action), () => {
    if ((action === 'report' && state.shadowQuest !== 'defeated') || (action === 'return' && state.shadowQuest !== 'returning')) {
      throw new Error(t('No puedes continuar este paso de la misión todavía.'));
    }
    state.shadowQuest = action === 'report' ? 'returning' : 'returned';
  });
  if (success) updateHud();
  return success;
}
async function performWelcome(action: WelcomeAction, origin?: number) {
  const stillCurrent = characterContext();
  const position = action === 'collect' ? WELCOME_BADGE : action === 'claim' ? welcomeWorld.root.position : WELCOME_START;
  if (Math.hypot(holder.position.x - position.x, holder.position.z - position.z) > (action === 'collect' ? 2.5 : 3.5)) {
    toast('No se pudo completar la acción', 'Acércate al objetivo para continuar la misión.', true);
    return false;
  }
  const finish = beginTransition('Guardando misión…');
  try {
    const success = await runOnServer(id => welcomeAction(id, action, origin), () => simulateWelcome(state, action, origin));
    if (!success || !stillCurrent()) return false;
    updateHud();
    if (openWindow === 'quests') setWindow('quests', false);
    if (action !== 'origin') {
      const message = action === 'claim' ? 'Misión completada: 40 XP y 5 pelines.' : action === 'collect' ? 'Has encontrado el distintivo. Habla con Gnomi.' : 'Misión aceptada. Gnomi te acompaña.';
      toast(WELCOME_TITLE, message);
    }
    if (action === 'claim') {
      if (TEST && !activeCharacterId) state.isbertoPosition = { x: holder.position.x + 2, z: holder.position.z };
      pendingIsbertoIntroduction = true;
    }
    return true;
  } finally { finish(); }
}

/** Vida + sobrecuración: lo que el jugador puede perder antes de caer. */
const totalHealth = () => { const v = vitalsOf(state); return v.health + v.overheal; };
let foodBase = 0, foodSince = 0, foodSampleAt = 0, foodRunning = false;
function resetFoodTimer(at = 0) {
  foodBase = state.foodBuff?.remaining ?? 0;
  foodSince = performance.now();
  foodSampleAt = at;
  renderBuffs(state, !foodRunning);
}
function setFoodRunning(running: boolean) {
  tickFood();
  foodRunning = running;
  resetFoodTimer(foodSampleAt);
}
function receiveFood(food: { buff: FoodBuff | null; revision: number; at: number }) {
  if (food.revision < state.foodRevision || (food.revision === state.foodRevision && food.at < foodSampleAt)) return;
  const hadBuff = !!state.foodBuff;
  state.foodBuff = food.buff;
  state.foodRevision = food.revision;
  resetFoodTimer(food.at);
  if (hadBuff !== !!state.foodBuff) {
    updateHud();
    if (openWindow === 'sheet') setWindow('sheet', false);
  }
}
function tickFood() {
  const buff = state.foodBuff;
  if (!buff || !foodRunning) return;
  const remaining = Math.max(0, foodBase - (performance.now() - foodSince) / 1000);
  if (remaining <= 0) {
    state.foodBuff = null;
    updateHud();
    if (openWindow === 'sheet') setWindow('sheet', false);
  } else {
    buff.remaining = remaining;
    renderBuffs(state, false);
  }
}
/** La sobrecuración se pierde con el tiempo: el servidor guarda el valor al recibirla y el cliente lo descuenta en pantalla. */
let overhealBase = 0, overhealSince = 0;
function resetOverheal() { overhealBase = state.overheal; overhealSince = performance.now(); }
function tickOverheal() {
  if (overhealBase <= 0 && state.overheal <= 0) return;
  const left = Math.max(0, overhealBase - Math.floor(((performance.now() - overhealSince) / 1000) * OVERHEAL.decayPerSecond));
  if (left !== state.overheal) { state.overheal = left; updateHud(); }
}

/** Resta vida al jugador (el servidor decide cuánta) y lo muestra: viñeta roja, golpe, sacudida de cámara, número flotante y barra. */
let shakeUntil = 0;
let dead = false;
async function damagePlayer(source = 'Algo') {
  if (dead) return;
  const before = totalHealth();
  if (!(await serverAction('damage'))) return;
  const amount = before - totalHealth();
  chatCombat(t('{who} te hace {n} puntos de daño.', { who: t(source), n: amount }));
  updateHud();
  restartClass($('#damage-vignette'), 'hit');
  restartClass($('.hud-health'), 'hurt');
  shakeUntil = clock.getElapsedTime() + 0.35;
  floatText(`-${amount}`, 'damage');
  if (vitalsOf(state).health === 0) { die(); return; }
  char.hit();
}

/** Muerte: cae al suelo, se apaga el color del mundo y aparece la pantalla de reaparición. */
function die() {
  releaseCombatTarget();
  playerInteractions.close();
  dead = true;
  closeDialog();
  setGameMenuOpen(false, false);
  setPlayerMenuOpen(false, false);
  setWindow(null, false);
  keys.clear();
  moveTarget = null;
  marker.visible = false;
  playerVel.set(0, 0, 0);
  char.die();
  document.body.classList.add('dead');
  $('#death-screen').hidden = false;
}

/** Reaparece en la capital (por ahora, el punto de inicio de Brumaluz) con la vida completa. */
async function respawn() {
  if (!dead || !(await serverAction('respawn'))) return;
  dead = false;
  $('#death-screen').hidden = true;
  document.body.classList.remove('dead');
  holder.position.copy(city.spawn);
  holder.rotation.y = city.spawnYaw + Math.PI;
  groundHeight = city.spawn.y;
  jumpElapsed = jumpDuration;
  jumpHeight = 0;
  yaw = city.spawnYaw;
  playerVel.set(0, 0, 0);
  char.revive();
  updateHud();
  restartClass($('#heal-vignette'), 'hit');
  restartClass($('.hud-health'), 'healed');
}

/** Cura al jugador (sin pasar del máximo) con viñeta verde, destellos ascendentes, animación y número flotante. */
async function healPlayer(source = 'Algo') {
  if (dead) return;
  const before = totalHealth();
  if (!(await serverAction('heal'))) return;
  const healed = totalHealth() - before;
  chatCombat(t('{who} te cura {n} puntos de vida.', { who: t(source), n: healed }), 'heal');
  updateHud();
  restartClass($('#heal-vignette'), 'hit');
  restartClass($('.hud-health'), 'healed');
  char.heal();
  floatText(`+${healed}`, 'heal');
  for (let i = 0; i < 12; i++) {
    const spark = document.createElement('div');
    spark.className = 'heal-spark';
    spark.textContent = '✦';
    spark.style.left = `${50 + (Math.random() - 0.5) * 14}%`;
    spark.style.top = `${52 + (Math.random() - 0.5) * 16}%`;
    spark.style.setProperty('--dx', `${((Math.random() - 0.5) * 120).toFixed(0)}px`);
    spark.style.animationDelay = `${(Math.random() * 0.45).toFixed(2)}s`;
    document.body.appendChild(spark);
    spark.addEventListener('animationend', () => spark.remove());
  }
}
const sparkBurst = (count: number, cls: string, glyph = '✦') => {
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('div');
    spark.className = `heal-spark ${cls}`;
    spark.textContent = glyph;
    spark.style.left = `${50 + (Math.random() - 0.5) * 18}%`;
    spark.style.top = `${52 + (Math.random() - 0.5) * 18}%`;
    spark.style.setProperty('--dx', `${((Math.random() - 0.5) * 220).toFixed(0)}px`);
    spark.style.animationDelay = `${(Math.random() * 0.5).toFixed(2)}s`;
    document.body.appendChild(spark);
    spark.addEventListener('animationend', () => spark.remove());
  }
};

/** Da experiencia al jugador: destellos dorados, barra brillante y, si completa niveles, celebración extra. */
let xpSettle = 0;
async function gainExperience() {
  if (dead) return;
  if (state.level >= MAX_LEVEL) { floatText(t('Nivel máximo'), 'xp'); return; }
  const startLevel = state.level, startPoints = unspentAttributePoints(state), startTotal = state.experience;
  if (!(await serverAction('xp'))) return;
  // XP realmente ganada: lo recorrido dentro de los niveles que ha cruzado.
  let amount = state.experience - startTotal;
  for (let level = startLevel; level < state.level; level++) amount += experienceToNextLevel(level);
  const leveled = state.level > startLevel;
  if (leveled) {
    // La barra se llena del todo antes de vaciarse al nuevo nivel.
    $('#hud-xp-fill').style.width = '100%';
    window.clearTimeout(xpSettle);
    xpSettle = window.setTimeout(updateHud, 700);
  } else updateHud();
  restartClass($('#xp-vignette'), 'hit');
  restartClass($('.hud-xp'), 'gain');
  floatText(`+${amount} XP`, 'xp');
  chatSystem(t('Has recibido {n} puntos de experiencia.', { n: amount }));
  if (leveled) chatSystem(t('¡Has subido al nivel {n}!', { n: state.level }));
  sparkBurst(14, 'xp');
  if (!leveled) { char.heal(); return; }
  char.wave();
  restartClass($('#levelup-flash'), 'hit');
  $('#levelup-title').textContent = `${t('Nivel')} ${state.level}`;
  const gained = unspentAttributePoints(state) - startPoints;
  const pointsLine = $('#levelup-points');
  pointsLine.hidden = gained <= 0;
  pointsLine.textContent = t('+{n} punto de atributo', { n: gained });
  restartClass($('#levelup-banner'), 'show');
  sparkBurst(30, 'xp big', '★');
  restartClass($('#hud-level'), 'pop');
}

/** Da 100 pelines (NPC de pruebas): el servidor suma el dinero y el cliente solo lo muestra. */
async function receiveMoney() {
  if (dead || !(await serverAction('money'))) return;
  floatText(`+100 ${t('Pelines')}`, 'xp');
  chatSystem(t('Has recibido {n} pelines.', { n: 100 }));
  sparkBurst(10, 'xp', '●');
}

// ---------------- Comercio ----------------
let vendor: { id: string; name: string } | null = null;
function openVendor(id: string) {
  const def = NPCS[id];
  if (!def) return;
  vendor = { id, name: def.name };
  setWindow('vendor');
}
async function vendorTransaction(call: (id: string, vendorId: string) => Promise<Record<string, unknown>>, simulate: () => void, bought?: string) {
  if (!vendor) return;
  const vendorId = vendor.id;
  if (await runOnServer((id) => call(id, vendorId), simulate)) {
    if (bought) autoAssignToActionBar(bought);
    if (openWindow === 'vendor') setWindow('vendor', false);
  }
}
const buyItem = (item: string) => vendorTransaction((id, v) => buyFromVendor(id, v, item), () => simulateBuy(state, vendor!.id, item), item);
const sellItem = (slot: number) => vendorTransaction((id, v) => sellToVendor(id, v, slot), () => simulateSell(state, slot));

async function moveInventorySlot(from: number, to: number) {
  const source = state.inventory[from], target = state.inventory[to];
  if (!source || from === to || dead) return;
  const moved = await runOnServer(id => moveInventoryItem(id,from,to,source,target), () => {
    [state.inventory[from],state.inventory[to]] = [target,source];
  });
  if (moved && openWindow === 'inventory') setWindow('inventory',false);
}
async function updateEquipment(slot: EquipmentSlot, bag: number | null) {
  const source = bag === null ? state.equipment[slot] : state.inventory[bag];
  if (!source || dead) return;
  if (!(await runOnServer(id => changeEquipment(id, slot, bag, source), () => transferEquipment(state, slot, bag, source)))) return;
  if (!hasCombatWeapon(state)) releaseCombatTarget();
  rebuildNow(); updateHud();
  if (openWindow === 'inventory') setWindow('inventory', false);
}
function equipInventoryItem(bag: number) {
  const item = state.inventory[bag], meta = item && EQUIPPABLE[item.id];
  if (meta) void updateEquipment(meta.slot, bag);
}

/** Usa un objeto de la mochila (clic en el hueco). */
async function useInventoryItem(slot: number) {
  if (dead) return;
  const before = totalHealth();
  const resourceBefore = vitalsOf(state).resource;
  if (!(await runOnServer((id) => useItem(id, slot), () => simulateUse(state, slot)))) return;
  const healed = totalHealth() - before;
  const restored = vitalsOf(state).resource - resourceBefore;
  if (restored > 0) chatCombat(t('Recuperas {n} puntos de {resource}.', { n: restored, resource: t(vitalsOf(state).resourceKind === 'mana' ? 'Maná' : 'Estamina') }), 'heal');
  if (healed > 0) chatCombat(t('Te curas {n} puntos de vida.', { n: healed }), 'heal');
  updateHud();
  if (healed > 0) {
    restartClass($('#heal-vignette'), 'hit');
    restartClass($('.hud-health'), 'healed');
    char.heal();
    floatText(`+${healed}`, 'heal');
  }
  if (openWindow === 'inventory') setWindow('inventory', false);
}
initActionBar({
  storageKey: () => `brumaluz-actionbar:${activeCharacterId ?? 'test'}`,
  count: (item) => state.inventory.reduce((sum, s) => sum + (s?.id === item ? s.count : 0), 0),
  bound: (item) => state.inventory.find(s => s?.id === item)?.bound === true,
  use: (item) => {
    const slot = state.inventory.findIndex((s) => s?.id === item);
    if (slot < 0) toast('No te quedan', '', true); else void useInventoryItem(slot);
  },
  skill: () => ({
    id: skillAction(state.cls), cls: state.cls, rank: skillRank(state), icon: skillIcon(COMBAT_KITS[state.cls].skill.id),
    cooldown: Math.max(0, (skillReadyAt - performance.now()) / 1000), duration: COMBAT_KITS[state.cls].skill.cooldown,
    available: !dead && (COMBAT_KITS[state.cls].skill.healing === true || hasCombatWeapon(state)) && vitalsOf(state).resource >= COMBAT_KITS[state.cls].skill.cost,
  }),
  useSkill: useWorldCombatSkill,
});
/** Quita al instante los efectos de pantalla temporales (flotantes, destellos, viñetas, cartel de nivel). */
function clearScreenEffects() {
  document.querySelectorAll('.damage-float, .heal-spark').forEach((el) => el.remove());
  for (const id of ['damage-vignette', 'heal-vignette', 'xp-vignette', 'levelup-flash']) $(`#${id}`).classList.remove('hit');
  $('#levelup-banner').classList.remove('show');
  $('#low-health-vignette').classList.remove('on');
  window.clearTimeout(xpSettle);
}
function applyCameraShake() {
  const left = shakeUntil - clock.getElapsedTime();
  if (left <= 0) return;
  const k = left / 0.35, t = clock.getElapsedTime() * 70;
  camera.position.x += Math.sin(t) * 0.07 * k;
  camera.position.y += Math.cos(t * 1.3) * 0.07 * k;
}

function updateHud() {
  renderActionBar();
  renderBuffs(state, !foodRunning);
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
  setBar('hud-health', v.health, v.maxHealth, `${v.health} / ${v.maxHealth}${v.overheal > 0 ? ` (+${v.overheal})` : ''}`);
  // La sobrecuración se dibuja tras el final de la vida; si no cabe en la barra, se pega al borde derecho.
  const healthPct = (v.health / v.maxHealth) * 100, overPct = (v.overheal / v.maxHealth) * 100;
  const overEnd = Math.min(100, healthPct + overPct);
  $('#hud-health-over').style.left = `${Math.max(overEnd - overPct, 0)}%`;
  $('#hud-health-over').style.width = `${Math.min(overPct, overEnd)}%`;
  $('.hud-health').classList.toggle('overhealed', v.overheal > 0);
  const lowHealth = v.health > 0 && v.health / v.maxHealth < 0.25;
  $('.hud-health').classList.toggle('low', lowHealth);
  $('#low-health-vignette').classList.toggle('on', lowHealth && mode === 'play');
  setBar('hud-resource', v.resource, v.maxResource, `${v.resource} / ${v.maxResource}`);
  $('#hud-resource').className = `hud-bar hud-resource ${v.resourceKind}`;
  $('#hud-resource').setAttribute('aria-label', t(v.resourceKind === 'mana' ? 'Maná' : 'Estamina'));
  setBar('hud-xp', v.experience, v.experienceNeeded, `${v.experience} / ${v.experienceNeeded} XP`);
  const hudTips: [string, string][] = [['hud-health', 'Vida'], ['hud-resource', v.resourceKind === 'mana' ? 'Maná' : 'Estamina'], ['hud-xp', 'Experiencia']];
  for (const [id, label] of hudTips) $(`#${id}-fill`).parentElement!.title = `${t(label)}|${$(`#${id}-text`).textContent}`;
  $('#hud-class-icon').title = `${classText(state)}|${t('Nivel')} ${state.level}`;
  const canImproveSkill = skillRank(state) < MAX_SKILL_RANK && unspentSkillPoints(state) > 0;
  $('#player-menu-toggle').classList.toggle('has-points', unspentAttributePoints(state) > 0 || canImproveSkill);
  document.querySelector('#player-menu-panel [data-window="skills"]')!.classList.toggle('has-points', canImproveSkill);
  document.querySelector<HTMLButtonElement>('[data-window="quests"]')!.hidden = !state.welcome;
  document.querySelector('#player-menu-panel [data-window="sheet"]')!.classList.toggle('has-points', unspentAttributePoints(state) > 0);
  refreshNameplateText();
}

const nameplate = { el: null as unknown as HTMLElement, shown: false };
const nameplateAnchor = new THREE.Vector3();
function refreshNameplateText() {
  $('#nameplate-name').textContent = state.name;
  const title = $('#nameplate-title');
  title.replaceChildren();
  if (state.title !== 'none') {
    if (isReservedTitle(state.title)) title.insertAdjacentHTML('beforeend', PHOENIX_ICON);
    title.append(t(TITLES[state.title].label));
  }
  title.classList.toggle('staff-title', state.title !== 'none' && isReservedTitle(state.title));
  title.hidden = state.title === 'none';
}
// Bocadillo de habla sobre tu personaje (solo mensajes públicos del chat); los NPC únicamente mueven la boca.
const speech = { el: null as HTMLElement | null, until: 0 };
const speechSeconds = (text: string) => Math.min(8, 2.5 + text.length * 0.06);
function playerSay(name: string, text: string) {
  const secs = speechSeconds(text);
  char.speak(secs);
  if (!speech.el) {
    speech.el = document.createElement('div');
    speech.el.className = 'speech-bubble';
    speech.el.setAttribute('aria-hidden', 'true');
    speech.el.hidden = true;
    speech.el.innerHTML = '<b></b><span></span>';
    document.body.appendChild(speech.el);
  }
  speech.el.querySelector('b')!.textContent = name;
  speech.el.querySelector('span')!.textContent = text;
  speech.until = performance.now() + secs * 1000;
  speech.el.classList.remove('pop');
  void speech.el.offsetWidth;
  speech.el.classList.add('pop');
}
function npcSay(name: string, text: string) {
  if (name === 'Gnomi') { welcomeWorld.speak(speechSeconds(text)); return; }
  const npc = npcActors.find((n) => NPCS[n.id]?.name === name);
  npc?.character.speak(speechSeconds(text));
}
// Coloca la placa sobre la cabeza del personaje proyectando su posición en pantalla.
function updateNameplate() {
  nameplate.el ??= $('#nameplate');
  const visible = mode === 'play' && settings.nameplates;
  if (speech.el) {
    const show = mode === 'play' && !dead && performance.now() < speech.until;
    if (show) {
      camera.updateMatrixWorld();
      nameplateAnchor.set(holder.position.x, holder.position.y + 1.95 + (state.height - 0.5) * 0.3, holder.position.z).project(camera);
      const inView = nameplateAnchor.z > -1 && nameplateAnchor.z < 1
        && Math.abs(nameplateAnchor.x) < 1.2 && Math.abs(nameplateAnchor.y) < 1.2;
      if (inView) {
        const x = (nameplateAnchor.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-nameplateAnchor.y * 0.5 + 0.5) * window.innerHeight - (settings.nameplates ? nameplate.el.offsetHeight + 8 : 6);
        speech.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      }
      speech.el.hidden = !inView;
    } else if (!speech.el.hidden) speech.el.hidden = true;
  }
  if (visible) {
    camera.updateMatrixWorld();
    nameplateAnchor.set(holder.position.x, holder.position.y + 1.95 + (state.height - 0.5) * 0.3, holder.position.z).project(camera);
    const inView = nameplateAnchor.z > -1 && nameplateAnchor.z < 1
      && Math.abs(nameplateAnchor.x) < 1.2 && Math.abs(nameplateAnchor.y) < 1.2;
    if (inView) {
      const x = (nameplateAnchor.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-nameplateAnchor.y * 0.5 + 0.5) * window.innerHeight;
      nameplate.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    nameplate.el.hidden = !inView;
  } else if (!nameplate.el.hidden) nameplate.el.hidden = true;
  for (const npc of npcActors) {
    if (npc.id === 'isberto' && !npc.character.root.visible) { npc.plate.hidden = true; continue; }
    npc.anchor.set(npc.character.root.position.x, npc.character.root.position.y + 1.95, npc.character.root.position.z).project(camera);
    const inView = visible && npc.anchor.z > -1 && npc.anchor.z < 1
      && Math.abs(npc.anchor.x) < 1.2 && Math.abs(npc.anchor.y) < 1.2;
    if (inView) {
      const x = (npc.anchor.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-npc.anchor.y * 0.5 + 0.5) * window.innerHeight;
      npc.plate.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    npc.plate.hidden = !inView;
  }
}

function enterPlay() {
  playGeneration++;
  if (TEST && new URLSearchParams(location.search).has('welcome') && !state.welcome) state.welcome = { origin: null, stage: 'available' };
  if (state.health === 0) state.health = -1; // personaje guardado muerto: vuelve con la vida completa
  dead = false;
  $('#death-screen').hidden = true;
  document.body.classList.remove('dead');
  updateHud();
  mode = 'play';
  if (TEST) { resetFoodTimer(); setFoodRunning(true); }
  document.body.classList.add('playing');
  menuMusic.sync();
  void setAmbientEnabled(ambientEnabled);
  yaw = city.spawnYaw; pitch = 0.55; followDist = 12; zoomTarget = 12; playerVel.set(0, 0, 0);
  if (state.position) {
    holder.position.set(state.position.x, city.groundY(state.position.x, state.position.z), state.position.z);
    yaw = state.position.yaw;
  } else holder.position.copy(city.spawn);
  running = true;
  groundHeight = holder.position.y;
  jumpElapsed = jumpDuration;
  jumpHeight = 0;
  camera.fov = 50;
  holder.rotation.y = yaw + Math.PI;
  camTarget.copy(holder.position).add(new THREE.Vector3(0, 1.3, 0));
  rebuildNow();
  layout();
  startChat();
  stopFriendNotifications?.();
  stopFriendNotifications = !TEST && currentUser ? startFriendNotifications() : null;
  if(!TEST && currentUser) startParty(currentUser.id,error=>chatSystem(t('No se pudo actualizar el grupo: {error}',{error:errorMessage(error)}),true));
  refreshWorldStatus();
  worldConnection?.start();
}
let chatUnsubscribe: (() => void) | null = null;
let stopFriendNotifications: (() => void) | null = null;
let chatSeq = 0;
function startChat() {
  stopChat();
  setChatSelf(currentUser?.id ?? null);
  chatSystem(t('Pulsa Enter para chatear. Escribe /ayuda para ver los comandos.'));
  if (TEST || !activeCharacterId) {
    chatSystem(t('Modo prueba: el chat no está conectado al servidor.'));
    return;
  }
  const id = ++chatSeq;
  const off = subscribeChat((m) => { if (id === chatSeq) chatReceive(m); });
  chatUnsubscribe = off;
}
function stopChat() {
  chatSeq++;
  chatUnsubscribe?.();
  chatUnsubscribe = null;
  clearChat();
}
function exitPlay() {
  pendingIsbertoIntroduction = false;
  setFoodRunning(false);
  stopParty();
  stopFriendNotifications?.();
  stopFriendNotifications = null;
  playerInteractions.close();
  playGeneration++;
  stopMultiplayer();
  stopChat();
  dead = false;
  clearScreenEffects();
  closeDialog();
  $('#interact-prompt').hidden = true;
  $('#death-screen').hidden = true;
  document.body.classList.remove('dead', 'playing');
  if (state.health === 0) state.health = -1;
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
$('#combat-auto').addEventListener('click',()=>{
  if (lockedEnemy && combatAuto) releaseCombatTarget();
  else lockCombatTarget();
});
$('#respawn').addEventListener('click', respawn);
const RACE_ICONS: Record<Race, string> = { humano: '🛡️', elfo: '🌿', lagto: '🦎', pelso: '🐱' };
const CLASS_ICONS: Record<ClassId, string> = { guerrero: classIcon('guerrero'), mago: classIcon('mago'), picaro: classIcon('picaro'), clerigo: classIcon('clerigo'), explorador: classIcon('explorador') };

applyLanguage(document);
initTooltips();
const tradeWindow = createTradeWindow({
  active(id) { return mode==='play' && activeCharacterId===id && !dead; },
  inventory(value) {
    state.inventory = value.inventory;
    if(value.wallet) state.wallet.pelines = value.wallet.pelines;
    updateHud();
  },
  opened() {
    playerInteractions.close();
    setWindow(null,false);
    keys.clear(); moveTarget=null; marker.visible=false;
  },
  notify(text) { chatSystem(text); },
});
window.setInterval(()=>{
  tradeWindow.setCharacter(mode==='play' && !TEST && !dead ? activeCharacterId : null);
},250);
initChat({
  onFocus: () => { keys.clear(); moveTarget = null; },
  zone: () => state.location,
  send: async (body, channel, to) => {
    if (TEST || !activeCharacterId) {
      if (channel === 'whisper') throw new Error(t('Los susurros no funcionan en modo prueba.'));
      chatSelfSay(state.name, body);
      playerSay(state.name, body);
      return;
    }
    const sequence = chatSeq;
    const message = await sendChatMessage(activeCharacterId, body, channel, to);
    if (sequence === chatSeq) chatReceive(message);
  },
});
initMinimap({
  player: () => ({ x: holder.position.x, z: holder.position.z, facing: holder.rotation.y }),
  markers: () => [
    ...npcActors.filter(npc => npc.id !== 'isberto' || isbertoUnlocked())
      .map((npc) => ({ id: npc.id, name: NPCS[npc.id].name, x: npc.character.root.position.x, z: npc.character.root.position.z })),
    ...(state.welcome && state.welcome.stage !== 'completed' ? [{
      id: 'welcome', name: t(welcomeObjective(state.welcome)), quest: true,
      ...(state.welcome.stage === 'active' ? WELCOME_BADGE : { x: welcomeWorld.root.position.x, z: welcomeWorld.root.position.z }),
    }] : []),
    ...(isbertoUnlocked() && state.shadowQuest !== 'returned' ? [{
      id:'shadow-quest',name:t(shadowObjective(state.shadowQuest)),quest:true,
      ...shadowQuestTarget(),
    }] : []),
    ...getParty().members.filter(member=>member.userId!==partySelf() && member.location===state.location).map(member=>({
      id:member.characterId,name:member.data.name,x:member.position.x,z:member.position.z,party:true,leader:member.userId===getParty().members[0]?.userId,
    })),
  ],
  zone: () => LOCATIONS[state.location],
});
initPartyHud();
let previousPartyInvites=new Set<string>();
observeParty(party=>{
  const peers=Math.max(0,party.members.length-1);
  const bonusChanged=(state.partyPeers ?? 0)!==peers;
  state.partyPeers=peers;
  const leader=$('#hud-party-leader');
  leader.hidden=!isPartyLeader();leader.setAttribute('aria-label',t('Líder'));leader.title=t('Líder del grupo');
  $('#player-menu-toggle').classList.toggle('has-party-invite',party.incoming.length>0);
  document.querySelector('[data-window="social"]')?.classList.toggle('has-party-invite',party.incoming.length>0);
  for(const invite of party.incoming) if(!previousPartyInvites.has(invite.id)){
    toast('Invitación de grupo','~{name} te invita a su grupo. Abre Social → Grupo para responder.',false,{name:invite.username});
    chatSystem(t('~{name} te invita a su grupo. Abre Social → Grupo para responder.',{name:invite.username}));
  }
  previousPartyInvites=new Set(party.incoming.map(invite=>invite.id));
  for(const response of party.responses){
    const message=response.accepted?'~{name} ha aceptado tu invitación y se ha unido al grupo.':'~{name} ha rechazado tu invitación de grupo.';
    toast('Invitación de grupo',message,false,{name:response.username});
    chatSystem(t(message,{name:response.username}));
  }
  if(mode==='play') {
    updateHud();
    if(bonusChanged && openWindow==='sheet')setWindow('sheet',false);
  }
});
setChatSpeechListener((name, text, own, userId) => {
  if (own) playerSay(name, text);
  else remotePlayers.say(userId, name, text);
});
setDialogLogger((speaker, text) => {
  if (speaker === null) char.speak(speechSeconds(text));
  else npcSay(speaker, t(text));
});

function refreshLanguageDependentUI() {
  remotePlayers.refreshLanguage();
  if (mode === 'play' && worldConnection) refreshWorldStatus();
  const language = getLanguage();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-language]')) {
    const selected = button.dataset.language === language;
    button.setAttribute('aria-pressed', String(selected));
    button.title = t(button.dataset.language === 'es' ? 'Español' : 'English');
  }
  refreshUI();
  renderBuffs(state, !foodRunning);
  renderControls($('#controls-view'));
  refreshAmbientControls();
  if (openWindow === 'sheet' || openWindow === 'vendor' || openWindow === 'quests' || openWindow === 'skills') setWindow(openWindow, false);
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
document.addEventListener('brumaluz-language-change', refreshDialog);
document.addEventListener('brumaluz-language-change', refreshLanguageDependentUI);

let gameMenuOpen = false;

function setGameMenuOpen(open: boolean, restoreFocus = true) {
  if (open) playerInteractions.close();
  gameMenuOpen = open;
  refreshOverlayHud();
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
type PlayerWindow = 'inventory' | 'sheet' | 'vendor' | 'social' | 'quests' | 'skills' | 'loot';
let openWindow: PlayerWindow | null = null;
let closeSocial: (() => void) | null = null;

function refreshOverlayHud() {
  document.body.classList.toggle('ui-menu-open', gameMenuOpen || playerMenuOpen || (!!openWindow && openWindow !== 'loot') || optionsOpen);
  document.body.classList.toggle('inventory-open', openWindow === 'inventory' || openWindow === 'skills');
}

function setPlayerMenuOpen(open: boolean, restoreFocus = true) {
  if (open) playerInteractions.close();
  playerMenuOpen = open;
  refreshOverlayHud();
  if (open) { setGameMenuOpen(false, false); setWindow(null, false); }
  const toggle = $<HTMLButtonElement>('#player-menu-toggle');
  $('#player-menu-panel').hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  keys.clear();
  if (open) $<HTMLButtonElement>('#player-menu-panel [data-window]').focus();
  else if (restoreFocus) toggle.blur();
}

/** Reparto de puntos sin confirmar en la ficha: solo cuenta al pulsar «Confirmar». */
let pointDraft: Partial<Record<AttributeId, number>> = {};
const draftTotal = () => Object.values(pointDraft).reduce((sum, n) => sum + (n ?? 0), 0);

function setWindow(win: PlayerWindow | null, closeMenu = true) {
  const body = $('#window-body');
  const refreshingSheet = win === 'sheet' && openWindow === 'sheet';
  const sheetScroll = refreshingSheet ? body.scrollTop : 0;
  const focused = refreshingSheet && document.activeElement instanceof HTMLElement && body.contains(document.activeElement)
    ? document.activeElement : null;
  const focusedAttribute = focused?.closest<HTMLElement>('[data-attribute]');
  const focusedControl = focusedAttribute && focused instanceof HTMLButtonElement ? [...focusedAttribute.querySelectorAll('button')].indexOf(focused) : -1;
  playerInteractions.close();
  closeSocial?.();
  closeSocial = null;
  if (win !== openWindow) pointDraft = {};
  openWindow = win;
  refreshOverlayHud();
  document.body.classList.toggle('window-open', !!win && win !== 'loot');
  document.body.classList.toggle('window-full', !!win && win !== 'loot');
  $('#window-backdrop').classList.toggle('loot-overlay', win === 'loot');
  $('#window-backdrop').classList.toggle('quest-overlay', win === 'quests');
  $('#window-backdrop .game-window').classList.toggle('loot-window-frame', win === 'loot');
  $('#window-backdrop .game-window').setAttribute('aria-modal', String(win !== 'loot'));
  document.body.classList.toggle('skills-open', win === 'skills');
  $('#window-backdrop').hidden = !win;
  $('#window-backdrop .game-window').classList.toggle('social-window-frame', win === 'social');
  $('#window-backdrop .game-window').classList.toggle('quest-window-frame', win === 'quests');
  $('#window-backdrop .game-window').classList.toggle('inventory-window-frame', win === 'inventory');
  $('#window-backdrop .game-window').classList.toggle('skills-window-frame', win === 'skills');
  $('#window-backdrop .game-window').classList.toggle('sheet-window-frame', win === 'sheet' || win === 'vendor');
  $('#window-confirm').hidden = true;
  keys.clear();
  if (!win) { vendor = null; return; }
  if (closeMenu) setPlayerMenuOpen(false, false);
  $('#window-title').textContent = win === 'vendor' ? vendor!.name : t(win === 'skills' ? 'Habilidades' : win === 'quests' ? 'Diario de misiones' : win === 'inventory' ? 'Inventario' : win === 'social' ? 'Social' : 'Ficha de personaje');
  $('#window-backdrop .game-window').classList.toggle('wide', win === 'sheet' || win === 'vendor' || win === 'social' || win === 'skills');
  $('#window-backdrop .game-window').classList.toggle('xl', win === 'inventory' || win === 'sheet' || win === 'vendor');
  if (win === 'loot') {
    moveTarget = null; pendingTalk = null; marker.visible = false; playerVel.set(0, 0, 0);
    $('#window-title').textContent = t('Botín de la criatura');
    if (combatEncounter?.status === 'defeated' && !combatEncounter.looted) renderLoot(body, combatEncounter, collectCorpseLoot);
    else { setWindow(null); return; }
  }
  else if (win === 'inventory') renderInventory(body, state, renderer, (slot) => void useInventoryItem(slot), (from,to) => void moveInventorySlot(from,to), equipInventoryItem, slot => void updateEquipment(slot, null));
  else if (win === 'skills') renderSkills(body, state, assignSkillToActionBar, async (id, rank) => {
    const previousView = body.firstElementChild;
    const success = await runOnServer(character => upgradeCharacterSkill(character, id, rank), () => upgradeSkill(state, id, rank));
    if (success) {
      updateHud();
      if (openWindow === 'skills' && body.firstElementChild !== previousView) setWindow('skills', false);
    }
    return success;
  });
  else if (win === 'quests') renderQuestJournal(body, state);
  else if (win === 'vendor') renderVendor(body, state, vendor!.id, { onBuy: (item) => void buyItem(item), onSell: (slot) => void sellItem(slot) });
  else if (win === 'social') closeSocial = renderSocial(body, (username) => {
    setWindow(null);
    focusChat(`/w ~${username} `);
  });
  else renderSheet(body, state, renderer, async (title) => {
    const stillCurrent = characterContext();
    await runOnServer((id) => setCharacterTitle(id, title), () => { state.title = title; });
    if (!stillCurrent()) return;
    updateHud();
    if (openWindow === 'sheet') setWindow('sheet', false);
  }, {
    draft: pointDraft,
    onAdd: (id) => {
      if (unspentAttributePoints(state) - draftTotal() <= 0 || attributeTotal(state, id) + (pointDraft[id] ?? 0) >= ATTRIBUTE_MAX_VALUE) return;
      pointDraft[id] = (pointDraft[id] ?? 0) + 1;
      setWindow('sheet', false);
    },
    onRemove: (id) => {
      if (!pointDraft[id]) return;
      pointDraft[id]! -= 1;
      setWindow('sheet', false);
    },
  });
  $('#window-confirm').hidden = win !== 'sheet' || draftTotal() === 0;
  const restoredAttribute = focusedAttribute?.dataset.attribute
    ? body.querySelector<HTMLElement>(`[data-attribute="${CSS.escape(focusedAttribute.dataset.attribute)}"]`) : null;
  const restoredControl = restoredAttribute?.querySelectorAll('button')[focusedControl];
  const focusTarget = restoredControl && !restoredControl.disabled ? restoredControl : restoredAttribute;
  (focusTarget ?? (win === 'loot' ? body.querySelector<HTMLButtonElement>('.loot-item') : null) ?? $<HTMLButtonElement>('#window-close')).focus({ preventScroll: refreshingSheet });
  body.scrollTop = sheetScroll;
}
$('#window-confirm').onclick = async () => {
  const confirm = $<HTMLButtonElement>('#window-confirm');
  if (confirm.disabled) return;
  confirm.disabled = true;
  const stillCurrent = characterContext();
  const draft = { ...pointDraft };
  try {
    if (!(await runOnServer((id) => spendAttributePoints(id, draft), () => simulateSpend(state, draft)))) return;
    pointDraft = {};
  } catch (error) {
    toast('No se pudo guardar', errorMessage(error), true);
  } finally {
    confirm.disabled = false;
  }
  if (stillCurrent()) {
    updateHud();
    if (openWindow === 'sheet') setWindow('sheet', false);
  }
};

$('#player-menu-toggle').onclick = () => setPlayerMenuOpen(!playerMenuOpen);
for (const b of document.querySelectorAll<HTMLButtonElement>('#player-menu-panel [data-window]')) {
  b.onclick = () => setWindow(b.dataset.window as PlayerWindow);
}
$('#window-close').onclick = () => setWindow(null);
$('#window-backdrop').addEventListener('pointerdown', (e) => { if (e.target === e.currentTarget) setWindow(null); });
document.addEventListener('click', (event) => {
  if (playerMenuOpen && event.target instanceof Node && !$('#player-menu').contains(event.target)) setPlayerMenuOpen(false, false);
});

let ambientChange = 0;
async function setAmbientEnabled(enabled: boolean) {
  const version = ++ambientChange;
  ambientEnabled = enabled;
  refreshAmbientControls();
  localStorage.setItem('brumaluz-ambient', enabled ? 'on' : 'off');
  $('#options-message').textContent = enabled ? t('Activando sonido ambiental…') : '';
  try {
    await ambientSoundscape.setEnabled(enabled);
    if (version === ambientChange) $('#options-message').textContent = '';
  } catch (error) {
    if (version === ambientChange) reportAmbientError(error);
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
  if (open) playerInteractions.close();
  optionsOpen = open;
  refreshOverlayHud();
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
  chatSystem(`${t(title)}: ${t(text, values)}`, error);
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
  menuMusic.sync();
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
  menuMusic.sync();
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
  menuMusic.sync();
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
  menuMusic.sync();
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
  menuMusic.sync();
  $('#auth-screen').hidden = true;
  $('#character-screen').hidden = false;
  $('#account-username').textContent = currentUsername ?? t('Nombre de usuario pendiente de asignación');
  $('#account-email').textContent = currentUser?.email ?? '';
  $('#character-message').classList.remove('error');
}

function syncBackdropTime() {
  const hour = new Date().getHours();
  document.body.classList.toggle('daytime', hour >= 6 && hour < 18);
  menuMusic.sync();
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
    play.onclick = async () => {
      if (enteringWorld) return;
      enteringWorld = true;
      play.disabled = true;
      const finishTransition = beginTransition('Entrando en Brumaluz…');
      try {
        loadCharacter(saved);
        if (!(await loadWorldState())) return;
        showEditor();
        enterPlay();
      } finally {
        finishTransition();
        enteringWorld = false;
        play.disabled = false;
      }
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
  if (enteringWorld) return;
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
    stopMultiplayer();
    if (mode === 'play') exitPlay();
    accountSyncId++;
    currentUser = null;
    currentUsername = null;
    activeCharacterId = null;
    showAuthScreen();
    return;
  }
  if (currentUser?.id === sessionUser.id && (mode === 'play' || worldConnection || enteringWorld || savingCharacter)) return;
  if (currentUser?.id !== sessionUser.id) stopMultiplayer();
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

/** Crea el personaje en el servidor si aún no existe (el servidor valida el nombre, el reparto inicial y la apariencia). */
async function createCurrentCharacter() {
  if (activeCharacterId) return true;
  if (savingCharacter || !currentUser || !validCharacterName()) return false;
  savingCharacter = true;
  const stillCurrent = characterContext();
  try {
    const id = await createCharacter(state);
    if (!stillCurrent()) return false;
    activeCharacterId = id;
    return true;
  } catch (error) {
    if (stillCurrent()) toast('No se pudo guardar', errorMessage(error), true);
    return false;
  } finally {
    savingCharacter = false;
  }
}

/** Pide al servidor los datos vigentes del personaje antes de entrar al mundo. */
async function loadWorldState() {
  if (!activeCharacterId) { if (TEST) setGrantedTitles(['rey_de_pompelin']); return TEST; }
  const characterId = activeCharacterId;
  const userId = currentUser?.id;
  const syncId = accountSyncId;
  const stillCurrent = () => activeCharacterId === characterId && currentUser?.id === userId && accountSyncId === syncId;
  try {
    const data = await enterCharacter(characterId);
    if (!stillCurrent()) return false;
    Object.assign(state, sanitize(data));
    resetFoodTimer(typeof data.food_at === 'number' ? data.food_at : 0);
    resetOverheal();
    const titles = await getMyTitles();
    if (!stillCurrent()) return false;
    setGrantedTitles(titles);
    await prepareMultiplayer();
    skillReadyAt = performance.now() + Math.max(0, Number(data.combatNextSkill ?? 0) - Date.now() / 1000) * 1000;
    return stillCurrent();
  } catch (error) {
    if (!stillCurrent()) return false;
    stopMultiplayer();
    toast('No se pudo guardar', errorMessage(error), true);
    return false;
  }
}

const remotePlayers = new RemotePlayers(scene, (x, z) => city.groundY(x, z));
let worldConnection: WorldConnection | null = null;
let worldRetrying = false;

function refreshWorldStatus() {
  setMapPlayerCount(worldRetrying ? null : remotePlayers.list().length + 1);
}
function receiveWorld(value: WorldSnapshot) {
  if (value.food) receiveFood(value.food);
  if (value.selfVitals) {
    const changed = state.health !== value.selfVitals.health || state.resource !== value.selfVitals.resource;
    const tookDamage=value.selfVitals.health<state.health;
    state.health = value.selfVitals.health;
    state.resource = value.selfVitals.resource;
    state.overheal=value.selfVitals.overheal;
    if(tookDamage)char.hit();
    if (state.health === 0 && !dead) die();
    if (changed) updateHud();
  }
  if(value.encounter!==undefined)setCombatEncounter(value.encounter);
  state.position = value.position;
  if (value.status === 'corrected') {
    holder.position.set(value.position.x, city.groundY(value.position.x, value.position.z), value.position.z);
    groundHeight = holder.position.y;
    playerVel.set(0, 0, 0);
    moveTarget = null;
    marker.visible = false;
  }
  remotePlayers.receive(value.players);
  refreshWorldStatus();
}
async function prepareMultiplayer() {
  stopMultiplayer();
  if (TEST || !activeCharacterId) return;
  waveSequence = 0;
  const connection = new WorldConnection(activeCharacterId, {
    motion: () => ({ x: holder.position.x, z: holder.position.z, yaw, facing: holder.rotation.y, jump: Math.min(0.7, Math.max(0, jumpHeight)), wave: waveSequence }),
    receive: receiveWorld,
    stale: () => { remotePlayers.clear(); refreshWorldStatus(); },
    connection: (status) => {
      worldRetrying = status === 'retrying';
      setFoodRunning(!worldRetrying);
      refreshWorldStatus();
      if (worldRetrying) chatSystem(t('Conexión al mundo interrumpida. Reintentando…'));
    },
    replaced: () => {
      exitPlay();
      if (currentUser) void loadCharacterSelection(currentUser);
      toast('Sesión de juego cerrada', 'Tu cuenta ha entrado al mundo desde otra pestaña o equipo.', true);
    },
  });
  worldConnection = connection;
  const initial = await connection.join();
  if (worldConnection !== connection || !initial) throw new Error(t('La entrada al mundo se ha cancelado.'));
  receiveWorld(initial);
}
function stopMultiplayer() {
  setFoodRunning(false);
  const connection = worldConnection;
  worldConnection = null;
  const stopped = connection?.stop();
  remotePlayers.clear();
  setCombatEncounter(null);
  localCombatState = null;
  skillReadyAt = 0;
  setMapPlayerCount(null);
  return stopped;
}
window.addEventListener('pagehide', stopMultiplayer);
window.addEventListener('pageshow', (event) => { if (event.persisted && mode === 'play') void returnToCharacters(); });

async function returnToCharacters() {
  const finishTransition = beginTransition('Volviendo a tus personajes…');
  try {
    const user = currentUser;
    if (mode === 'play') {
      const stopped = stopMultiplayer();
      exitPlay();
      await stopped;
    }
    if (user && currentUser?.id === user.id) await loadCharacterSelection(user);
  } finally {
    finishTransition();
  }
}

function startNewCharacter() {
  if (!currentUser || enteringWorld || $<HTMLButtonElement>('#new-character').disabled) return;
  state = defaultChar();
  state.name = randomName(state.race);
  activeCharacterId = null;
  showEditor();
}

const authForm = $<HTMLFormElement>('#auth-form');
const rememberEmailKey = 'brumaluz-remembered-email';
const authEmail = $<HTMLInputElement>('#auth-email');
const rememberEmail = $<HTMLInputElement>('#auth-remember');
const rememberedEmail = localStorage.getItem(rememberEmailKey);
if (rememberedEmail) {
  authEmail.value = rememberedEmail;
  rememberEmail.checked = true;
}
function persistRememberedEmail() {
  if (rememberEmail.checked && authEmail.value.trim() && authEmail.validity.valid) {
    localStorage.setItem(rememberEmailKey, authEmail.value.trim());
  } else localStorage.removeItem(rememberEmailKey);
}
rememberEmail.addEventListener('change', persistRememberedEmail);
authEmail.addEventListener('input', () => {
  if (authMode === 'login') persistRememberedEmail();
});
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
    $('#remember-email-field').hidden = authMode !== 'login';
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
      persistRememberedEmail();
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
    toast('No se pudo completar la acción', errorMessage(error), true);
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
    if (mode === 'play') await returnToCharacters();
    await signOut();
    await syncAccount(null);
  } catch (error) {
    toast('No se pudo completar la acción', errorMessage(error), true);
    $('#character-message').textContent = errorMessage(error);
    $('#character-message').classList.add('error');
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
  if (enteringWorld) return;
  if (unspentAttributePoints(state) > 0) {
    toast('Un momento…', 'Reparte todos tus puntos de atributo antes de empezar.', true);
    return;
  }
  enteringWorld = true;
  const enter = $<HTMLButtonElement>('#enter');
  enter.disabled = true;
  const finishTransition = beginTransition('Preparando tu aventura…');
  const stillCurrent = characterContext();
  try {
    if (ambientEnabled) {
      try {
        await ambientSoundscape.prepare();
      } catch (error) {
        reportAmbientError(error);
      }
    }
    if (!stillCurrent()) return;
    if (!(await createCurrentCharacter())) return;
    if (!(await loadWorldState())) return;
    focus = 'body';
    enterPlay();
    setTimeout(() => { if (mode === 'play') { char.wave(); waveSequence++; } }, 60);
    toast('¡Te damos la bienvenida, {name}!', 'Tu aventura en Brumaluz comienza ahora.', false, { name: state.name });
  } finally {
    finishTransition();
    enteringWorld = false;
    enter.disabled = false;
  }
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
const LOCAL_COMBAT_SITE = TEST ? { x: 0, z: -6 } : COMBAT_SITE;
function testCity(): City {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(32, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9b48a' }));
  ground.receiveShadow = true;
  root.add(ground);
  return { root, locationId: 'brumaluz', npcSites: [
    { id: 'testiculos', position: new THREE.Vector3(2, 0, -1), yaw: Math.PI / 2 },
    { id: 'isberto', position: new THREE.Vector3(LOCAL_COMBAT_SITE.x - 3, 0, LOCAL_COMBAT_SITE.z), yaw: Math.PI / 2 },
  ], interactables: [{ id: 'well', position: new THREE.Vector3(0, 0, -2), radius: 3, label: 'Asomarse al pozo' }], vendorSpots: [], collide: (_f, t) => t, groundY: () => 0, spawn: new THREE.Vector3(), spawnYaw: 0, update() {} };
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
const welcomeWorld = createWelcomeWorld(scene, city);
const questTracker = createQuestTracker(() => setWindow('quests'));
const welcomePlate = document.createElement('div');
welcomePlate.className = 'nameplate npc welcome-nameplate';
welcomePlate.textContent = 'Gnomi';
welcomePlate.hidden = true;
document.body.append(welcomePlate);
const questMarker = document.createElement('div');
questMarker.id = 'quest-objective-marker';
questMarker.hidden = true;
const questDirection = document.createElement('span');
questDirection.className = 'quest-direction-arrow';
questDirection.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 16-8-4-8 4Z"/></svg>';
const questDistance = document.createElement('span');
questMarker.append(questDirection, questDistance);
document.body.append(questMarker);
const questAnchor = new THREE.Vector3();
const questView = new THREE.Vector3();
let welcomeHintSaid = false;
let welcomeTravelSaid = false;
function shadowQuestTarget(): { x: number; z: number } {
  if (state.shadowQuest === 'returning' || state.shadowQuest === 'returned') return SHADOW_RETURN;
  if (state.shadowQuest === 'active' && combatTargetRoot) return combatTargetRoot.position;
  return npcActors.find(npc => npc.id === 'isberto')?.character.root.position
    ?? state.isbertoPosition ?? {x: -3, z: TEST ? LOCAL_COMBAT_SITE.z : COMBAT_SITE.z};
}
function updateWelcome(dt: number, time: number) {
  welcomeWorld.update(state.welcome, mode === 'play', holder.position, dead || isDialogOpen() || !!openWindow ? 0 : dt, time, conversationActor === welcomeWorld.root, state.shadowQuest === 'returned');
  const visible = mode === 'play' && !dead && !openWindow && !gameMenuOpen && !playerMenuOpen && !optionsOpen && !tradeWindow.isOpen && !isDialogOpen();
  questTracker.update(state, visible);
  welcomePlate.hidden = true;
  questMarker.hidden = true;
  if (!welcomeWorld.root.visible || !visible) return;
  camera.updateMatrixWorld();
  questAnchor.copy(welcomeWorld.root.position).add(new THREE.Vector3(0, 1.1, 0)).project(camera);
  if (questAnchor.z > -1 && questAnchor.z < 1 && Math.abs(questAnchor.x) < 1 && Math.abs(questAnchor.y) < 1) {
    welcomePlate.hidden = false;
    welcomePlate.style.transform = `translate(${(questAnchor.x * .5 + .5) * innerWidth}px, ${(-questAnchor.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`;
  }
  if (!state.welcome) return;
  if (state.welcome.stage === 'completed' && state.shadowQuest === 'returned') return;
  const shadowTarget = state.welcome.stage === 'completed'
    ? shadowQuestTarget() : null;
  const target = shadowTarget ?? (state.welcome.stage === 'active' ? welcomeWorld.lost.position : welcomeWorld.root.position);
  const distance = Math.hypot(target.x - holder.position.x, target.z - holder.position.z);
  if (state.welcome.stage === 'active' && !welcomeTravelSaid && Math.hypot(holder.position.x - WELCOME_START.x, holder.position.z - WELCOME_START.z) > 5 && distance > 8) {
    welcomeTravelSaid = true;
    const line = t('El mercado queda por aquí. Yo venía mirando los puestos… Tendría que haber mirado también el distintivo.');
    chatNpc('Gnomi', line);
    welcomeWorld.speak(speechSeconds(line));
  }
  if (state.welcome.stage === 'active' && distance < 8 && !welcomeHintSaid) {
    welcomeHintSaid = true;
    chatNpc('Gnomi', t('Por aquí estuve mirando los puestos. ¡A ver si mi distintivo también se quedó mirando!'));
    welcomeWorld.speak(5);
  }
  if (state.welcome.stage !== 'active') { welcomeHintSaid = false; welcomeTravelSaid = false; }
  questAnchor.set(target.x, city.groundY(target.x, target.z) + (state.welcome.stage === 'active' ? .55 : 1.3), target.z).project(camera);
  const screenX = (questAnchor.x * .5 + .5) * innerWidth, screenY = (-questAnchor.y * .5 + .5) * innerHeight;
  const marginX = Math.min(64, innerWidth / 4), marginY = Math.min(100, innerHeight / 4);
  const onScreen = questAnchor.z > -1 && questAnchor.z < 1 && screenX >= marginX && screenX <= innerWidth - marginX && screenY >= marginY && screenY <= innerHeight - marginY;
  questMarker.hidden = false;
  questMarker.classList.toggle('offscreen', !onScreen);
  questDirection.hidden = onScreen;
  questDistance.textContent = `${onScreen ? state.welcome.stage === 'available' ? '! ' : '◆ ' : ''}${Math.round(distance)} m`;
  if (onScreen) {
    questMarker.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%,-100%)`;
  } else {
    questView.set(target.x, city.groundY(target.x, target.z) + (state.welcome.stage === 'active' ? .55 : 1.3), target.z).applyMatrix4(camera.matrixWorldInverse);
    let dx = questView.x * camera.projectionMatrix.elements[0], dy = -questView.y * camera.projectionMatrix.elements[5];
    // Targets behind the camera still point to their actual side, rather than mirroring after projection.
    if (questView.z >= 0) dy = Math.max(Math.abs(dy), .5);
    if (Math.abs(dx) + Math.abs(dy) < .0001) { dx = 0; dy = 1; }
    dx *= innerWidth; dy *= innerHeight;
    const halfW = innerWidth / 2 - marginX, halfH = innerHeight / 2 - marginY;
    const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
    const x = innerWidth / 2 + dx * scale, y = innerHeight / 2 + dy * scale;
    questDirection.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
    questMarker.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`;
  }
}
if (import.meta.hot) import.meta.hot.dispose(() => welcomeWorld.dispose());
try {
  setMinimapImage(captureTopDown(renderer, scene, city.root, graphics.compatible ? 1024 : lowEnd ? 1536 : 2560));
} catch (e) {
  console.warn('Sin imagen para el minimapa:', e);
}

// ---------------- NPCs ----------------
interface NpcDef {
  name: string;
  look: Partial<CharData>;
  type: NpcType;
  title: string;
  level: number;
  vitals: TargetDetails['vitals'];
  conversation: Conversation;
  barks?: string[];
}
// Mismas opciones y mismo orden en todos los nodos del NPC de prueba.
const testChoices: DialogChoice[] = [
  { text: 'Hola', next: 'hola' },
  { text: 'Recibir 10 puntos de daño', next: 'dano', action: () => void damagePlayer('Testículos, the Debugger') },
  { text: 'Recibir 10 puntos de vida', next: 'cura', action: () => void healPlayer('Testículos, the Debugger') },
  { text: 'Recibir 200 puntos de experiencia', next: 'xp', action: () => void gainExperience() },
  { text: 'Recibir 100 pelines', next: 'dinero', action: () => void receiveMoney() },
  { text: 'Comerciar', action: () => openVendor('testiculos') },
];
function isbertoConversation(): Conversation {
  if (state.shadowQuest === 'defeated') return {
    speaker:'Isberto', subtitle:'Granjero · explorador retirado', start:'intro',
    nodes:{
      intro:{text:'Gracias por ocuparte de esa criatura. El ganado ya está más tranquilo, pero yo no. He recorrido unos cuantos caminos y nunca había visto nada parecido.',next:'gnomi'},
      gnomi:{speaker:'Gnomi',subtitle:'Ayudante del Gremio',text:'Yo tampoco sé qué era. Y mira que me cruzo con gente y bichos de todas clases… Esto no me suena de nada.',next:'isberto'},
      isberto:{text:'Pues no vamos a ponerle nombre por inventar. Si has recogido algo de sus restos, guárdalo. Por ahora no sabemos qué significa.',next:'return'},
      return:{speaker:'Gnomi',subtitle:'Ayudante del Gremio',text:'Dejemos a Isberto cuidar del ganado. Volvamos a la plaza del pozo; te acompaño.',
        choices:[{text:'Volver con Gnomi a la plaza',action:()=>performShadow('report')}]},
    },
  };
  const text = state.shadowQuest === 'returned' || state.shadowQuest === 'returning'
    ? 'El ganado está tranquilo. Sobre aquella criatura, sigo sin saber nada más. Gracias por echarme una mano.'
    : state.shadowQuest === 'active' ? 'La criatura sigue junto al ganado. Ten cuidado.'
    : 'Una cosa negra y rara se ha metido entre el ganado. No reconozco la criatura, y a estas alturas ya he tenido bastantes aventuras. Si te ves con ganas, échale un ojo. Yo me quedo vigilando el camino.';
  const offer = !state.shadowQuest;
  return {
    speaker:'Isberto', subtitle:'Granjero · explorador retirado', start:'intro',
    nodes:{intro:{text,
      ...(offer ? {quest:{title:SHADOW_TITLE,objective:'Derrota a la criatura, habla con Isberto y vuelve con Gnomi a la plaza del pozo.',experience:0,pelines:0}} : {}),
      ...(offer || (state.shadowQuest === 'active' && combatEncounter?.status !== 'active')
        ? {choices:[{text:offer ? 'Aceptar misión' : 'Volver a investigar',action:beginIsbertoEncounter}]} : {}),
    }},
  };
}
const NPCS: Record<string, NpcDef> = {
  isberto: {
    name:'Isberto',
    type:'resident',
    title:'Granjero · explorador retirado',
    level:1,
    vitals:{health:100,maxHealth:100,overheal:0,resource:50,maxResource:50,resourceKind:'stamina'},
    look:{race:'humano',sex:0,hair:3,hairColor:5,beard:2,clothA:3,clothB:6,height:.45,build:.62},
    get conversation() { return isbertoConversation(); },
  },
  testiculos: {
    name: 'Testículos, the Debugger',
    type: 'debug',
    title: 'Depuración',
    level: 1,
    vitals: { health: 100, maxHealth: 100, overheal: 0, resource: 100, maxResource: 100, resourceKind: 'mana' },
    look: { race: 'elfo', sex: 0, hair: 4, hairColor: 8, clothA: 2, clothB: 9 },
    barks: [
      '¿Alguien ha visto mi documentación? Ah, no, no tengo.',
      'Psst, viajero... ¿quieres probar mis pociones? Son de mentira, pero curan.',
      'Un día más depurando el universo.',
    ],
    conversation: {
      speaker: 'Testículos, the Debugger',
      start: 'intro',
      nodes: {
        intro: { text: '¡Saludos, viajero! Soy un NPC de prueba, no tengo lore ni ganas de tenerlo.', choices: testChoices },
        hola: { text: '¡Hola! Si estás leyendo esto, el sistema de conversaciones funciona. Ya me dejas en paz.' },
        dano: { text: 'Pum. Diez puntos de daño, recién salidos del horno. Mira tu barra de vida.', choices: testChoices },
        cura: { text: 'Cataplof. Diez puntos de vida, cortesía de la casa. Sin receta ni efectos secundarios.', choices: testChoices },
        xp: { text: 'Toma, doscientos puntos de experiencia recién impresos. Mira la barra dorada, y si subes de nivel, no me des las gracias.', choices: testChoices },
        dinero: { text: 'Cien pelines calentitos, recién acuñados. No preguntes de dónde salen. Gástalos en mi tienda: «Comerciar».', choices: testChoices },
      },
    },
  },
};
const npcActors: { id: string; character: Character; plate: HTMLElement; anchor: THREE.Vector3 }[] = [];
let isbertoPositionKey = '';
for (const site of city.npcSites) {
  const def = NPCS[site.id];
  if (!def) continue;
  const npcData = sanitize({ ...defaultChar(), ...def.look, name: def.name } as unknown as Record<string, unknown>);
  const character = new Character(npcData, { outfit: false });
  character.root.name = `npc:${site.id}`;
  character.root.position.copy(site.position);
  character.root.rotation.y = site.yaw;
  character.root.visible = site.id !== 'isberto' || isbertoUnlocked();
  castShadows(character.root);
  scene.add(character.root);
  // Placa verde: NPC no hostil
  const plate = document.createElement('div');
  plate.className = 'nameplate npc';
  plate.hidden = true;
  plate.setAttribute('aria-hidden', 'true');
  plate.innerHTML = '<strong></strong>';
  plate.querySelector('strong')!.textContent = def.name;
  document.body.appendChild(plate);
  npcActors.push({ id: site.id, character, plate, anchor: new THREE.Vector3() });
  city.interactables.push({ id: `npc:${site.id}`, position: character.root.position, radius: 2.6, label: 'Hablar' });
}
let combatEncounter: CombatEncounter|null=null;
let combatTargetRoot: THREE.Group|null=null;
let combatAuto=false;
let combatBusy=false;
let nextCombatAttack=0;
let nextLocalEnemyAttack=0;
let pendingCombatSkill=false;
let localCombatState:CombatState|null=null;
function buildShadowling(encounter:CombatEncounter) {
  const root=new THREE.Group();
  root.name='combat-enemy';
  const body=new THREE.Mesh(
    new THREE.SphereGeometry(.72,20,16),
    new THREE.MeshStandardMaterial({color:'#302337',roughness:.8,emissive:'#21112d',emissiveIntensity:.5}),
  );
  body.scale.set(.9,1.15,.82);body.position.y=.85;body.castShadow=true;root.add(body);
  for(const x of [-.23,.23]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.105,12,10),new THREE.MeshStandardMaterial({
      color:'#d4a4ff',emissive:'#a83dff',emissiveIntensity:2.1,roughness:.25,
    }));
    eye.position.set(x,1.02,.58);root.add(eye);
  }
  for(const x of [-.35,.35]){
    const foot=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),new THREE.MeshStandardMaterial({color:'#23192b',roughness:1}));
    foot.scale.set(1,.45,1.2);foot.position.set(x,.18,.02);foot.castShadow=true;root.add(foot);
  }
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.82,.035,8,32),new THREE.MeshBasicMaterial({color:'#c694f6',transparent:true,opacity:.85}));
  ring.name='combat-lock-ring';
  ring.rotation.x=-Math.PI/2;ring.position.y=.04;root.add(ring);
  root.position.set(encounter.x,city.groundY(encounter.x,encounter.z),encounter.z);
  castShadows(root);
  scene.add(root);
  return root;
}
function setCombatEncounter(value:unknown) {
  const previousStatus = combatEncounter?.status;
  combatEncounter=parseCombatEncounter(value);
  if(combatEncounter?.status==='active'||(combatEncounter?.status==='defeated' && !combatEncounter.looted)){
    if(!combatTargetRoot)combatTargetRoot=buildShadowling(combatEncounter);
    combatTargetRoot.position.set(combatEncounter.x,city.groundY(combatEncounter.x,combatEncounter.z),combatEncounter.z);
    const corpse = combatEncounter.status === 'defeated';
    combatTargetRoot.name = corpse ? 'combat-corpse' : 'combat-enemy';
    combatTargetRoot.rotation.z = corpse ? Math.PI / 2 : 0;
    combatTargetRoot.scale.setScalar(corpse ? .8 : 1);
    combatTargetRoot.position.y += corpse ? .12 : 0;
    if (corpse) releaseCombatTarget();
    $('#combat-controls').hidden=corpse;
    $('#combat-auto').setAttribute('aria-pressed',String(combatAuto));
    const ring = combatTargetRoot.getObjectByName('combat-lock-ring');
    if (ring) ring.visible = !corpse && lockedEnemy;
    combatTargetRoot.userData.looted = combatEncounter.looted;
    if (corpse && previousStatus !== 'defeated') chatCombat(t('La criatura extraña ha caído.'));
  }else{
    if (openWindow === 'loot') setWindow(null, false);
    if(combatTargetRoot){
      scene.remove(combatTargetRoot);
      combatTargetRoot.traverse(part=>{
        const mesh=part as THREE.Mesh;
        if(mesh.isMesh){mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();}
      });
      combatTargetRoot=null;
    }
    releaseCombatTarget();
    $('#combat-controls').hidden=true;
  }
}
function applyCombatResult(value:Record<string,unknown>) {
  const before=vitalsOf(state).health;
  if(value.vitals) {
    const vitals=parsePublicVitals(value.vitals);
    state.health=vitals.health;state.resource=vitals.resource;state.overheal=vitals.overheal;
  }
  if(value.encounter!==undefined)setCombatEncounter(value.encounter);
  if(value.quest !== undefined) state.shadowQuest = parseShadowQuest(value.quest);
  if (typeof value.skillCooldown === 'number') skillReadyAt = performance.now() + Math.max(0, value.skillCooldown) * 1000;
  if(state.health===0&&combatEncounter?.status==='active')setCombatEncounter({...combatEncounter,status:'failed'});
  resetOverheal();updateHud();
  if(vitalsOf(state).health<before){char.hit();chatCombat(t('La criatura extraña te hiere.'));}
  if(state.health===0&&!dead)die();
  if(typeof value.damage==='number'&&value.damage>0){
    char.attack(value.damage>10);
    chatCombat(t('Golpeas a la criatura extraña por {n}.',{n:value.damage}));
  }
  if(typeof value.healing==='number'&&value.healing>0){
    char.heal();chatCombat(t('Recuperas {n} puntos de vida.',{n:value.healing}),'heal');
  }
  if(combatEncounter?.status==='defeated'){
    combatAuto=false;
  }
}
async function collectCorpseLoot(slot: number | null) {
  const corpse = combatEncounter;
  if (!corpse || corpse.status !== 'defeated' || !corpse.instanceId || !combatTargetRoot) return false;
  if (holder.position.distanceTo(combatTargetRoot.position) > 3) {
    toast('Botín', 'Acércate al cuerpo para recoger el botín.', true); return false;
  }
  const instanceId = corpse.instanceId;
  const stillCurrent = characterContext();
  const success = await runOnServer(id => lootCorpse(id, instanceId, slot), () => {
    const remaining = corpse.loot.map(item => item ? { ...item } : null);
    const inventory = state.inventory.map(item => item ? { ...item } : null);
    try {
      remaining.forEach((item, i) => {
        if (!item || (slot !== null && slot !== i)) return;
        for (let n = 0; n < item.count; n++) addItem(state, item.id);
        remaining[i] = null;
      });
    } catch (error) { state.inventory = inventory; throw error; }
    const looted = remaining.every(item => !item);
    setCombatEncounter({ ...corpse, loot: remaining, looted });
  });
  if (!success || !stillCurrent()) return false;
  updateHud();
  if (openWindow === 'loot') setWindow(combatEncounter?.looted ? null : 'loot', false);
  return true;
}
const lootAnchor = new THREE.Vector3();
function positionLootWindow() {
  if (!combatTargetRoot || !combatEncounter || combatEncounter.looted || dead || holder.position.distanceTo(combatTargetRoot.position) > 3) {
    setWindow(null, false); return;
  }
  const panel = $('#window-backdrop .game-window');
  lootAnchor.copy(combatTargetRoot.position).add(new THREE.Vector3(0, .6, 0)).project(camera);
  const x = (lootAnchor.x * .5 + .5) * innerWidth;
  const y = (-lootAnchor.y * .5 + .5) * innerHeight;
  const left = Math.max(12, Math.min(innerWidth - panel.offsetWidth - 12, x + 36));
  const top = Math.max(80, Math.min(innerHeight - panel.offsetHeight - 90, y - panel.offsetHeight * .5));
  panel.style.setProperty('--loot-left', `${left}px`);
  panel.style.setProperty('--loot-top', `${top}px`);
}
async function beginIsbertoEncounter() {
  if (!isbertoUnlocked()) {
    toast('No se pudo iniciar el combate', t('Primero debes completar la bienvenida con Gnomi.'), true);
    return false;
  }
  if(!activeCharacterId){
    if(!TEST)throw new Error('Inicia sesión con un personaje para empezar el combate.');
    const vitals=vitalsOf(state);
    if (state.shadowQuest && state.shadowQuest !== 'active') throw new Error(t('La criatura ya ha sido derrotada. Continúa la misión.'));
    if (combatEncounter?.status === 'defeated' && !combatEncounter.looted) throw new Error('Recoge primero los restos de la criatura caída.');
    state.shadowQuest = 'active';
    localCombatState={
      health:vitals.health,maxHealth:vitals.maxHealth,resource:vitals.resource,
      enemyHealth:100,nextAttack:0,nextSkill:0,
    };
    setCombatEncounter({
      id:'shadowling',status:'active',health:100,maxHealth:100,
      x:LOCAL_COMBAT_SITE.x+3.5,z:LOCAL_COMBAT_SITE.z,enemyAttackAt:performance.now()/1000+2,
      instanceId: crypto.randomUUID(), loot: [], looted: false,
    });
    releaseCombatTarget();nextCombatAttack=0;nextLocalEnemyAttack=performance.now()/1000+2;
    return true;
  }
  const stillCurrent=characterContext();
  const result=await startCombat(activeCharacterId);
  if(!stillCurrent())return false;
  applyCombatResult(result);
  releaseCombatTarget();nextCombatAttack=0;
  return true;
}
async function performWorldCombatAction(action:'attack'|'skill') {
  if(combatBusy)return;
  const healing = action === 'skill' && state.cls === 'clerigo';
  if (!healing && !hasCombatWeapon(state)) { releaseCombatTarget(); toast('Combate', 'Equipa un arma de tu clase para atacar.', true); return; }
  if (!healing && (!lockedEnemy || !combatEncounter || combatEncounter.status !== 'active')) return;
  if(!activeCharacterId&&TEST){
    const current = vitalsOf(state);
    localCombatState = {
      health:current.health,maxHealth:current.maxHealth,resource:current.resource,
      enemyHealth:combatEncounter?.health ?? 0,nextAttack:localCombatState?.nextAttack ?? 0,nextSkill:localCombatState?.nextSkill ?? 0,
    };
    const distance=combatTargetRoot ? Math.hypot(combatTargetRoot.position.x-holder.position.x,combatTargetRoot.position.z-holder.position.z) : 0;
    try{
      const result=resolveCombat(state.cls,localCombatState,action,performance.now()/1000,distance,state.level,skillRank(state));
      localCombatState=result.state;
      if (action === 'skill') skillReadyAt = performance.now() + COMBAT_KITS[state.cls].skill.cooldown * 1000;
      applyCombatResult({
        ...(combatEncounter ? {encounter:{...combatEncounter,health:result.state.enemyHealth,status:result.state.enemyHealth===0?'defeated':'active',
          ...(result.state.enemyHealth === 0 ? {loot:[{id:'esencia_sombria',count:1,bound:true}],looted:false} : {})},
          quest: result.state.enemyHealth === 0 ? 'defeated' : 'active'} : {}),
        vitals:{health:result.state.health,maxHealth:result.state.maxHealth,overheal:0,
          resource:result.state.resource,maxResource:vitalsOf(state).maxResource,resourceKind:vitalsOf(state).resourceKind},
        damage:result.damage.reduce((sum,hit)=>sum+hit,0),healing:result.healing,
      });
    }catch(error){toast('No se pudo completar la acción',errorMessage(error),true);}
    return;
  }
  const characterId=activeCharacterId;
  if(!characterId)return;
  combatBusy=true;
  const stillCurrent=characterContext();
  try{
    const result=await combatAction(characterId,action === 'skill' ? COMBAT_KITS[state.cls].skill.id : 'attack');
    if(!stillCurrent())return;
    applyCombatResult(result);
    if (action === 'skill') skillReadyAt = performance.now() + COMBAT_KITS[state.cls].skill.cooldown * 1000;
  }catch(error){
    const message=errorMessage(error);
    if(action === 'skill' || !/recuperando|fuera de alcance/i.test(message))toast('No se pudo completar la acción',message,true);
  }finally{combatBusy=false;}
}
// Los NPC comentan algo de vez en cuando si estás cerca (canal NPC del chat).
const barkCooldown = new Map<string, number>();
window.setInterval(() => {
  if (mode !== 'play' || dead) return;
  const now = Date.now();
  for (const npc of npcActors) {
    if (npc.id === 'isberto' && !isbertoUnlocked()) continue;
    const barks = NPCS[npc.id]?.barks;
    if (!barks?.length || now < (barkCooldown.get(npc.id) ?? 0)) continue;
    if (Math.hypot(npc.character.root.position.x - holder.position.x, npc.character.root.position.z - holder.position.z) > 8) continue;
    barkCooldown.set(npc.id, now + 40000 + Math.random() * 40000);
    const line = t(barks[Math.floor(Math.random() * barks.length)]);
    chatNpc(NPCS[npc.id].name, line);
    npcSay(NPCS[npc.id].name, line);
  }
}, 4000);
const targetFrame = createTargetFrame(canvas, camera, city.root);
function updateTargetFrame() {
  const enabled = mode === 'play' && !dead && !tradeWindow.isOpen && !isDialogOpen() && !gameMenuOpen && !playerMenuOpen && !openWindow && !optionsOpen && !playerInteractions.isOpen;
  if (!enabled) { targetFrame.update([], false, holder.position); return; }
  const targets: TargetDetails[] = remotePlayers.list().map((player) => ({
    ...player, identity: { kind: 'player', username: player.username, cls: player.cls, title: player.title },
  }));
  for (const npc of npcActors) {
    if (npc.id === 'isberto' && !isbertoUnlocked()) continue;
    const def = NPCS[npc.id];
    targets.push({ id: `npc:${npc.id}`, root: npc.character.root, name: def.name, level: def.level, height: npc.character.d.height,
      vitals: def.vitals, identity: { kind: 'npc', type: def.type, title: def.title } });
  }
  if(combatTargetRoot&&combatEncounter?.status==='active')targets.push({
    id:'enemy:shadowling',root:combatTargetRoot,name:'Sombra extraña',level:1,height:0,
    vitals:{health:combatEncounter.health,maxHealth:combatEncounter.maxHealth,overheal:0,resource:0,maxResource:1,resourceKind:'stamina'},
    identity:{kind:'npc',type:'hostile',title:'Criatura extraña'},
  });
  if (welcomeWorld.root.visible) targets.push({
    id: 'npc:gnomi', root: welcomeWorld.root, name: 'Gnomi', level: 1, height: 0,
    vitals: { health: 100, maxHealth: 100, overheal: 0, resource: 80, maxResource: 80, resourceKind: 'stamina' },
    identity: { kind: 'npc', type: 'resident', title: 'Ayudante de bienvenida' },
  });
  targetFrame.update(targets, true, holder.position, lockedEnemy ? 'enemy:shadowling' : null);
}
holder.position.copy(city.spawn);
holder.rotation.y = city.spawnYaw - 0.3;
rebuildNow();
refreshUI();
layout();

let last = 0;
renderer.setAnimationLoop(() => {
  if (graphics.failed) return;
  const t = clock.getElapsedTime();
  const dt = Math.min(t - last, 0.05);
  last = t;
  world.uTime.value = t;
  if (mode === 'play') { updatePlay(dt); tickWorldCombat(t); tickOverheal(); tickFood(); }
  else if (!dragging) {
    holder.rotation.y += spinVel;
    spinVel *= 0.92;
  }
  char.update(t);
  const isberto = npcActors.find(npc => npc.id === 'isberto');
  if (isberto) {
    const site = state.isbertoPosition ?? city.npcSites.find(site => site.id === 'isberto')?.position;
    const positionKey = site ? `${site.x}:${site.z}` : '';
    if (site && positionKey !== isbertoPositionKey) {
      isbertoPositionKey = positionKey;
      const destination = new THREE.Vector3(site.x, city.groundY(site.x, site.z), site.z);
      isberto.character.root.position.copy(city.collide(destination, destination.clone()));
      isberto.character.root.position.y = city.groundY(isberto.character.root.position.x, isberto.character.root.position.z);
    }
    if (pendingIsbertoIntroduction && mode === 'play' && !dead && !actionBusy) {
      pendingIsbertoIntroduction = false;
      isberto.character.root.visible = true;
      talkTo('isberto');
    }
  }
  for (const npc of npcActors) {
    if (npc.id === 'isberto') npc.character.root.visible = isbertoUnlocked();
    npc.character.update(t);
  }
  city.update(t, mode === 'play' ? holder.position : undefined);
  stage.follow(holder.position, mode === 'play');
  updateCamera(dt);
  if (openWindow === 'loot') positionLootWindow();
  updateWelcome(dt, t);
  applyCameraShake();
  updateNameplate();
  if (mode === 'play') remotePlayers.update(t, dt, camera, settings.nameplates);
  updateInteractPrompt();
  updateTargetFrame();
  if (mode === 'play') updateMinimap();
  try {
    if (TEST) renderer.render(scene, camera); else stage.render();
  } catch (error) {
    graphics.fail('No se pudo dibujar el mundo 3D. Prueba el modo compatible.', error);
  }
});

requestAnimationFrame(() => setTimeout(() => $('#loading').classList.add('hide'), 400));
initBuffLayout();
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
  wave() { char.wave(); waveSequence++; },
  speak(s: number) { char.speak(s); },
  play: () => enterPlay(),
  spin(a: number) { holder.rotation.y = a; spinVel = 0; },
  move(x: number, z: number) { holder.position.set(x, 0, z); },
  view(y: number, p: number, d: number) { yaw = y; pitch = p; followDist = d; zoomTarget = d; },
  char: () => char,
  camera: () => camera,
  city: () => city,
  players: () => remotePlayers.list(),
  time() { const t0 = performance.now(); rebuildNow(); return performance.now() - t0; },
};

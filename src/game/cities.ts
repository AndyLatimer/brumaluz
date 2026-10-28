// Mapas: carga, cambio de mapa, portales y NPC de cada lugar.
import * as THREE from 'three';
import { type City, buildCity, type CityPortal } from '../world/city';
import { publishedMaps, loadPublishedMap } from '../world/mapCity';
import { setMinimapImage } from '../ui/minimap';
import { captureTopDown } from '../world/mapCapture';
import { play, story, session, talk, fight, view, ui } from './state';
import { type WorldNpcId, isWorldNpcId } from '../data/npcs';
import { createNpc } from '../character/npc';
import type { Character } from '../character/character';
import { ISBERTO_HOUSE, ISBERTO_INSIDE } from '../data/quests';
import { castShadows } from '../world/render';
import { closeDialog, isDialogOpen } from '../ui/dialog';
import { isInCombat } from '../data/combat';
import { beginMapTransition } from '../ui/transitionLoading';
import { locationName } from '../data/data';
import { chatSystem } from '../ui/chatWindow';
import { LOCAL_COMBAT_SITE, TEST, scene, renderer, graphics, lowEnd, marker, keys, playerVel, env, holder, camTarget } from './stage';
import { groundPoint, facingTo, cinematic, restoreStoryFog, removeMonsterPreview, doorLocked } from '../story/scenes';
import { isbertoVisible } from '../story/quests';
import { setWindow } from '../ui/menus';
import { endIsbertoArrival } from '../story/isbertoArrival';
import { remotePlayers, receiveWorld } from './worldClient';
import { setCombatEncounter } from './combat';
import { toast } from '../ui/toast';
import { updateHud } from './hud';
import { buildProfessionWorld } from '../world/professionWorld';
import { errorMessage } from './server';
import { returnToCharacters } from '../ui/characterSelect';
import { storyLock } from './conversation';
import { tradeWindow } from '../ui/gameInterface';

export const portalWarnings = new Set<string>();
export function testCity(): City {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(32, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9b48a' }));
  ground.receiveShadow = true;
  root.add(ground);
  return { root, locationId: 'brumaluz', npcSites: [
    { id: 'testiculos', position: new THREE.Vector3(2, 0, -1), yaw: Math.PI / 2 },
    { id: 'isberto', position: new THREE.Vector3(LOCAL_COMBAT_SITE.x - 3, 0, LOCAL_COMBAT_SITE.z), yaw: Math.PI / 2 },
  ], interactables: [{ id: 'well', position: new THREE.Vector3(0, 0, -2), radius: 3, label: 'Asomarse al pozo' }], seats: [], vendorSpots: [], portals: [], arrivals: {}, collide: (_f, t) => t, groundY: () => 0, platformY: () => null, spawn: new THREE.Vector3(), spawnYaw: 0, update() {} };
}
export const loadedCities = new Map<string, City>();
export async function gameCity(id: string): Promise<City> {
  const cached = loadedCities.get(id);
  if (cached) return cached;
  const result = TEST && !new URLSearchParams(location.search).has('welcome') ? testCity() : publishedMaps()[id]
    ? (await loadPublishedMap(id, scene)).city
    : id === 'brumaluz' ? await buildCity()
      : (() => { throw new Error(`El mapa «${id}» no está incluido en esta versión del juego.`); })();
  buildProfessionWorld(result);
  // Interior masters are built only when their workshop is visited.
  await Promise.all(result.npcSites.map(async site=>{
    if(!isWorldNpcId(site.id))return;
    if(!session.worldCharacters[site.id])session.worldCharacters[site.id]=await createNpc(session.registeredNpcs[site.id]);
  }));
  loadedCities.set(id, result);
  return result;
}
export function refreshCityMinimap() {
  try {
    setMinimapImage(captureTopDown(renderer, scene, play.city.root, graphics.compatible ? 1024 : lowEnd ? 1536 : 2560, play.city.mapBounds), play.city.mapBounds);
  } catch (e) {
    setMinimapImage(null, play.city.mapBounds);
    console.warn('Sin imagen para el minimapa:', e);
  }
}
export const npcActors: { id: WorldNpcId; character: Character; plate: HTMLElement; anchor: THREE.Vector3 }[] = [];
/** NPC del mapa actual; en su casa, también Isberto (el mapa del interior no lo incluye). */
export function npcSitesHere() {
  if (play.city.locationId !== ISBERTO_HOUSE || play.city.npcSites.some(site => site.id === 'isberto')) return play.city.npcSites;
  const position = groundPoint(ISBERTO_INSIDE);
  const door = play.city.arrivals[Object.keys(play.city.arrivals)[0]];
  return [...play.city.npcSites, { id: 'isberto', position, yaw: door ? facingTo(position, door.position) : Math.PI }];
}
export function placeCityNpcs() {
for (const npc of npcActors.splice(0)) {
  npc.character.root.removeFromParent();
  npc.plate.remove();
}
story.isbertoPositionKey = '';
play.city.interactables = play.city.interactables.filter(item => !item.id.startsWith('npc:'));
for (const site of npcSitesHere()) {
  const def = story.NPCS[site.id];
  if (!def) continue;
  if (!isWorldNpcId(site.id)) throw new Error(`Falta el personaje registrado ${site.id}.`);
  const character = session.worldCharacters[site.id];
  if(!character)throw new Error(`Falta cargar el personaje ${site.id}.`);
  character.root.name = `npc:${site.id}`;
  character.root.position.copy(site.position);
  character.root.rotation.y = site.yaw;
  character.root.visible = site.id !== 'isberto' || isbertoVisible();
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
  play.city.interactables.push({ id: `npc:${site.id}`, position: character.root.position, radius: 2.6, label: 'Hablar' });
}
}
export async function switchGameMap(id: string) {
  if (play.city.locationId === id) return;
  const next = await gameCity(id);
  setWindow(null, false);
  closeDialog();
  endIsbertoArrival();
  cinematic.cancel();
  restoreStoryFog();
  removeMonsterPreview();
  play.pendingTalk = null;
  play.moveTarget = null; marker.visible = false;
  keys.clear(); playerVel.set(0, 0, 0);
  play.city.root.removeFromParent();
  play.city = next;
  scene.add(play.city.root);
  env.setLampposts(id === 'brumaluz' && !publishedMaps().brumaluz);
  talk.conversationShot = '';
  remotePlayers.clear();
  placeCityNpcs();
  story.houseTourArmed = true;
  if (id === 'brumaluz' && session.state.shadowQuest === 'returning') story.isbertoGuide = null;
  play.portalsArmed = false;
  setCombatEncounter(fight.combatEncounter);
  refreshCityMinimap();
}
export function placeAfterTravel(position: { x: number; z: number; yaw: number }) {
  holder.position.set(position.x, play.city.groundY(position.x, position.z), position.z);
  view.yaw = position.yaw; holder.rotation.y = view.yaw + Math.PI;
  play.groundHeight = holder.position.y; play.lastPlatformY = null;
  play.jumpElapsed = play.jumpDuration; play.jumpHeight = 0;
  playerVel.set(0, 0, 0); play.moveTarget = null; marker.visible = false;
  camTarget.copy(holder.position).add(new THREE.Vector3(0, 1.3, 0));
  play.portalsArmed = false;
}
export async function travelPortal(portal: CityPortal) {
  if (play.mapTravelling || play.dead) return;
  if (doorLocked(portal)) { toast('Casa de Isberto', 'La casa está cerrada. Isberto te invitará cuando hayas registrado los restos de la criatura.', true); return; }
  if (isInCombat(fight.combatEncounter)) {
    toast('No se pudo viajar', 'Termina el combate activo antes de usar este portal.', true);
    return;
  }
  if (!portal.target) { toast('Camino cerrado', 'Este portal todavía no tiene un destino.', false); return; }
  const target = portal.target;
  if (target.map !== 'brumaluz' && !publishedMaps()[target.map]) {
    toast('Camino cerrado', 'El mapa de destino todavía no está publicado.', true);
    return;
  }
  play.char.stand();
  play.mapTravelling = true;
  keys.clear(); playerVel.set(0, 0, 0); play.moveTarget = null; marker.visible = false;
  const entry = publishedMaps()[target.map];
  const connection = session.worldConnection;
  let finish = () => {};
  let serverMoved = false;
  try {
    const module = entry ? await entry.load() : null;
    const preview = module && typeof module.map === 'object' && module.map && 'preview' in module.map && typeof module.map.preview === 'string'
      ? module.map.preview : undefined;
    finish = beginMapTransition({ name: locationName(target.map), region: entry?.region, loadingTip: entry?.loadingTip, preview });
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    // Carga antes de pedir el viaje: un recurso defectuoso nunca deja al jugador en un mapa que no puede ver.
    const destination = await gameCity(target.map);
    if (play.mode !== 'play') return;
    if (!connection || TEST) {
      const arrival = target.arrival ? destination.arrivals[target.arrival] : undefined;
      if (target.arrival && !arrival) throw new Error(`No existe la llegada «${target.arrival}» en el destino.`);
      await switchGameMap(target.map);
      session.state.location = target.map;
      session.state.position = { x: (arrival?.position ?? play.city.spawn).x, z: (arrival?.position ?? play.city.spawn).z, yaw: arrival?.yaw ?? play.city.spawnYaw };
      placeAfterTravel(session.state.position);
    } else {
      const result = await connection.travel(portal.id);
      serverMoved = true;
      if (connection !== session.worldConnection || play.mode !== 'play') return;
      if (result.location !== target.map) throw new Error('El destino del servidor no coincide con la publicación local. Actualiza el SQL del mundo.');
      await switchGameMap(result.location);
      session.state.location = result.location;
      receiveWorld(result);
      placeAfterTravel(result.position);
    }
    updateHud();
    chatSystem(`Has llegado a ${locationName(session.state.location)}.`);
  } catch (error) {
    console.error('No se pudo viajar por el portal.', error);
    toast('No se pudo viajar', errorMessage(error), true);
    // Ante una respuesta perdida, vuelve a selección: reentrar recupera mapa y posición autoritativos.
    if (connection && (serverMoved || session.worldConnection === connection)) await returnToCharacters();
  } finally {
    play.mapTravelling = false;
    finish();
    if (connection === session.worldConnection) connection?.resume();
  }
}
export function updatePortals() {
  if (play.mode !== 'play' || play.mapTravelling || play.dead || isDialogOpen() || storyLock() || ui.openWindow || ui.gameMenuOpen || ui.playerMenuOpen || ui.worldMenuOpen || ui.optionsOpen || tradeWindow.isOpen) return;
  const inside = play.city.portals.filter(portal => Math.hypot(holder.position.x - portal.position.x, holder.position.z - portal.position.z) <= portal.radius);
  // Hay que salir de todas las zonas de portal tras una llegada para evitar viajes de ida y vuelta infinitos.
  if (!inside.length) { play.portalsArmed = true; return; }
  if (!play.portalsArmed) return;
  const portal = inside.find(portal => portal.trigger === 'walk');
  if (!portal) return;
  play.portalsArmed = false;
  if (!portal.target || (portal.target.map !== 'brumaluz' && !publishedMaps()[portal.target.map])) {
    const key = `${play.city.locationId}:${portal.id}`;
    if (!portalWarnings.has(key)) {
      portalWarnings.add(key);
      toast('Camino cerrado', 'Este destino todavía no está publicado.', false);
    }
    return;
  }
  void travelPortal(portal);
}

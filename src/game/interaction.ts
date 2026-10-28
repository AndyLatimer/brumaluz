// Interacción con el mundo: lo que hay cerca (tecla E), hablar con NPC y moverse con clic.
import * as THREE from 'three';
import { createPlayerInteractions } from '../ui/playerInteractions';
import { type DialogLine, isDialogOpen, openDialog } from '../ui/dialog';
import { session, fight, play, story, ui } from './state';
import type { Interactable } from '../world/city';
import { BANK_SPOTS, BANK_INTERACT_RADIUS } from '../data/bank';
import { ISBERTO_HOUSE, HOUSE_BED, BED_RADIUS } from '../data/quests';
import type { RemotePlayers } from '../world/players';
import { t } from '../ui/i18n';
import { isInCombat } from '../data/combat';
import { tradeWindow } from '../ui/gameInterface';
import { holder, keys, marker, playerVel, canvas, ray, camera } from './stage';
import { houseOpen, isbertoVisible, talkGnomi, restInBed, performWelcome } from '../story/quests';
import { groundPoint, doorLocked } from '../story/scenes';
import { remotePlayers } from './worldClient';
import { npcActors, travelPortal } from './cities';
import { beginConversation, storyLock } from './conversation';
import { toast } from '../ui/toast';
import { setWindow } from '../ui/menus';
import { openBank } from './inventory';
import { pickUpCoinBag, pickUpFairyDust } from './vitals';
import { lockCombatTarget } from './combat';
import { wildernessInteractions, openWildernessCorpse, clickWilderness } from './wilderness';
import { $ } from '../ui/dom';
import { professionInteractions } from '../world/professionWorld';
import { gatherResource, performProfession } from './professions';
import { selectProfessionTab } from '../ui/professionsWindow';

// ---------------- Interacción (tecla E) ----------------
export const playerInteractions = createPlayerInteractions((target) => tradeWindow.invite(target));
export const INTERACTIONS: Record<string, () => DialogLine[]> = {
  well: () => [{ speaker: session.state.name, text: '(Te asomas al pozo, es realmente profundo)' }],
};
/** Stop at the object before reaching for it, instead of sliding through the gesture. */
function prepareObjectInteraction(item: Interactable, gesture: 'inspect' | 'pickup' | null = null) {
  play.pendingTalk = null;
  keys.clear(); play.moveTarget = null; marker.visible = false; playerVel.set(0,0,0);
  fight.combatApproach = false;
  play.char.setGait('idle');
  const dx = item.position.x-holder.position.x, dz = item.position.z-holder.position.z;
  if (dx*dx+dz*dz > .01) holder.rotation.y = Math.atan2(dx,dz);
  if (gesture === 'inspect') play.char.inspect();
  else if (gesture === 'pickup') play.char.pickUp();
}
export function nearestInteractable(): Interactable | null {
  let best: Interactable | null = null, bestDistance = Infinity;
  const corpses: Interactable[] = fight.combatTargetRoot && fight.combatEncounter?.status === 'defeated'
    ? [{ id: 'corpse:shadowling', position: fight.combatTargetRoot.position, radius: 3, label: 'Registrar cuerpo' }] : [];
  if (corpses[0] && !fight.combatEncounter?.looted && holder.position.distanceTo(corpses[0].position) <= 3) return corpses[0];
  const portals = play.city.portals.filter(portal => portal.trigger === 'interact').map(portal => ({
    id: `portal:${portal.id}`, label: portal.name, position: portal.position, radius: portal.radius,
  }));
  const spot = BANK_SPOTS[play.city.locationId];
  const banks: Interactable[] = spot && houseOpen()
    ? [{ id: 'bank:chest', label: 'Abrir el banco', position: new THREE.Vector3(spot.x, play.city.groundY(spot.x, spot.z), spot.z), radius: BANK_INTERACT_RADIUS }] : [];
  const beds: Interactable[] = play.city.locationId === ISBERTO_HOUSE && houseOpen()
    ? [{ id: 'house:bed', label: 'Descansar', position: groundPoint(HOUSE_BED), radius: BED_RADIUS }] : [];
  const seats: Interactable[] = play.city.seats.map(seat => ({
    id: `seat:${seat.id}`, label: 'Sentarse', position: seat.position, radius: 2.2,
  }));
  for (const item of [...portals, ...corpses, ...banks, ...beds, ...seats, ...wildernessInteractions(), ...professionInteractions(play.city,session.state.rpg), ...play.city.interactables, ...story.welcomeWorld.interactions(), ...story.coinBags.interactions(), ...story.fairyDust.interactions()]) {
    if (item.id === 'npc:isberto' && !isbertoVisible()) continue;
    const distance = Math.hypot(item.position.x - holder.position.x, item.position.z - holder.position.z);
    if (distance <= item.radius && distance < bestDistance) { best = item; bestDistance = distance; }
  }
  return best;
}
export function nearestInteraction() {
  const item = nearestInteractable();
  let distance = item ? Math.hypot(item.position.x - holder.position.x, item.position.z - holder.position.z) : Infinity;
  let player: ReturnType<RemotePlayers['list']>[number] | null = null;
  for (const candidate of remotePlayers.list()) {
    const d = Math.hypot(candidate.root.position.x - holder.position.x, candidate.root.position.z - holder.position.z);
    if (d <= TALK_RANGE && d < distance) { player = candidate; distance = d; }
  }
  return { item: player ? null : item, player };
}
export function talkTo(npcId: string) {
  play.pendingTalk = null;
  if (npcId === 'gnomi') { talkGnomi(); return; }
  if (npcId === 'isberto' && !isbertoVisible()) return;
  const conv = story.NPCS[npcId]?.conversation;
  if (!conv) return;
  keys.clear();
  play.moveTarget = null;
  marker.visible = false;
  const actor = npcActors.find(npc => npc.id === npcId);
  if (actor) beginConversation(actor.character.root, { ...conv, subtitle: story.NPCS[npcId].title });
}
export function interact() {
  if (play.mode !== 'play' || play.mapTravelling || play.dead || storyLock() || tradeWindow.isOpen || playerInteractions.isOpen || isDialogOpen() || ui.openWindow || ui.gameMenuOpen || ui.playerMenuOpen || ui.worldMenuOpen || ui.optionsOpen) return;
  if(isInCombat(fight.combatEncounter)||fight.combatAuto&&fight.combatEncounter?.status==='active')return;
  if (play.char.isSeated) { play.char.stand(); return; }
  const { item, player } = nearestInteraction();
  if (player) {
    play.pendingTalk = null;
    keys.clear();
    play.moveTarget = null;
    marker.visible = false;
    playerVel.set(0, 0, 0);
    void playerInteractions.open(player);
    return;
  }
  if (item?.id === 'welcome:gnomi') { talkGnomi(); return; }
  if (item?.id.startsWith('seat:')) {
    if (isInCombat(fight.combatEncounter) || play.jumpHeight > 0.05) return;
    const seat = play.city.seats.find(candidate => candidate.id === item.id.slice(5));
    if (!seat || !play.char.sit(seat.seatHeight)) return;
    play.pendingTalk = null;
    keys.clear();
    play.moveTarget = null;
    marker.visible = false;
    playerVel.set(0, 0, 0);
    holder.position.copy(seat.position);
    holder.rotation.y = seat.yaw;
    play.groundHeight = seat.position.y;
    play.lastPlatformY = null;
    return;
  }
  if(item?.id.startsWith('wildloot:')){prepareObjectInteraction(item,'pickup');openWildernessCorpse(item.id.slice(9));return;}
  if(item?.id.startsWith('resource:')){prepareObjectInteraction(item);void gatherResource(item.id.slice(9));return;}
  if(item?.id.startsWith('station:')){prepareObjectInteraction(item,'inspect');const job=item.id.slice(8);selectProfessionTab(job==='reparacion'?'tools':'recipes',job==='reparacion'?'herreria':job);setWindow('professions');void performProfession('state');return;}
  if (item?.id.startsWith('portal:')) {
    const portal = play.city.portals.find(portal => portal.id === item.id.slice(7));
    if (portal && doorLocked(portal)) { toast('Casa de Isberto', 'La puerta está cerrada con llave.', true); return; }
    if (portal) void travelPortal(portal);
    return;
  }
  if (item?.id === 'house:bed') { void restInBed(); return; }
  if (item?.id === 'welcome:badge') { prepareObjectInteraction(item);void performWelcome('collect'); return; }
  if (item?.id === 'corpse:shadowling') { prepareObjectInteraction(item,'pickup');fight.lootEncounter=null;fight.lootTargetRoot=null;setWindow('loot'); return; }
  if (item?.id === 'bank:chest') { prepareObjectInteraction(item,'inspect');void openBank(); return; }
  if (item?.id.startsWith('coinbag:')) { prepareObjectInteraction(item);void pickUpCoinBag(item.id.slice('coinbag:'.length)); return; }
  if (item?.id.startsWith('fairydust:')) { prepareObjectInteraction(item);void pickUpFairyDust(item.id.slice('fairydust:'.length)); return; }
  const npcId = item?.id.startsWith('npc:') ? item.id.slice(4) : null;
  if (npcId) { talkTo(npcId); return; }
  const lines = item && (INTERACTIONS[item.id]?.() ?? (item.text ? [{ speaker: session.state.name, text: item.text }] : undefined));
  if (!lines) return;
  if (item) prepareObjectInteraction(item,'inspect');
  keys.clear();
  play.moveTarget = null;
  marker.visible = false;
  openDialog(lines);
}
// Clic en un NPC: si está cerca habla con él; si no, camina hasta él y habla al llegar.

export const TALK_RANGE = 2.3;
export function clickNpc(e: PointerEvent) {
  if (play.dead || isDialogOpen()) return false;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  if(play.city.locationId==='pompelin'&&clickWilderness(ray))return true;
  if (fight.combatTargetRoot && fight.combatEncounter?.status === 'defeated' && ray.intersectObject(fight.combatTargetRoot, true).length) {
    if (holder.position.distanceTo(fight.combatTargetRoot.position) <= 3) {
      prepareObjectInteraction({id:'corpse:shadowling',position:fight.combatTargetRoot.position,radius:3,label:'Registrar cuerpo'},'pickup');
      setWindow('loot');
    }
    else toast('Botín', 'Acércate al cuerpo para recoger el botín.', true);
    return true;
  }
  if(fight.combatTargetRoot&&fight.combatEncounter?.status==='active'&&ray.intersectObject(fight.combatTargetRoot,true).length){
    lockCombatTarget(true);
    return true;
  }
  if(isInCombat(fight.combatEncounter)||fight.combatAuto&&fight.combatEncounter?.status==='active')return false;
  if (story.welcomeWorld.root.visible && ray.intersectObject(story.welcomeWorld.root, true).length) {
    if (holder.position.distanceTo(story.welcomeWorld.root.position) <= TALK_RANGE) talkGnomi();
    else {
      play.moveTarget = story.welcomeWorld.root.position.clone();
      play.pendingTalk = 'gnomi';
    }
    return true;
  }
  for (const hit of ray.intersectObjects(npcActors.filter(npc => npc.id !== 'isberto' || isbertoVisible()).map((n) => n.character.root), true)) {
    const npc = npcActors.find((n) => { let o: THREE.Object3D | null = hit.object; while (o) { if (o === n.character.root) return true; o = o.parent; } return false; });
    if (!npc || !story.NPCS[npc.id]) continue;
    const p = npc.character.root.position;
    if (Math.hypot(p.x - holder.position.x, p.z - holder.position.z) <= TALK_RANGE) talkTo(npc.id);
    else {
      play.pendingTalk = npc.id;
      play.moveTarget = new THREE.Vector3(p.x, play.city.groundY(p.x, p.z), p.z);
      marker.visible = false;
    }
    return true;
  }
  return false;
}
export function updateInteractPrompt() {
  const prompt = $('#interact-prompt');
  if (playerInteractions.isOpen) {
    const target = remotePlayers.list().find((player) => player.id === playerInteractions.targetId);
    if (play.mode !== 'play' || play.dead || !target || Math.hypot(target.root.position.x - holder.position.x, target.root.position.z - holder.position.z) > TALK_RANGE) playerInteractions.close();
  }
  const canInteract = play.mode === 'play' && !play.mapTravelling && !play.dead && !storyLock() && !tradeWindow.isOpen && !playerInteractions.isOpen && !isDialogOpen() && !ui.gameMenuOpen && !ui.playerMenuOpen && !ui.worldMenuOpen && !ui.openWindow && !ui.optionsOpen && !isInCombat(fight.combatEncounter) && !(fight.combatAuto&&fight.combatEncounter?.status==='active');
  const seated = play.mode === 'play' && play.char.isSeated;
  const interaction = canInteract && !seated ? nearestInteraction() : null;
  prompt.hidden = seated ? !canInteract : !interaction?.item && !interaction?.player;
  if (seated && canInteract) {
    const label = t('Levantarse');
    if ($('#interact-label').textContent !== label) $('#interact-label').textContent = label;
    return;
  }
  if (interaction?.item || interaction?.player) {
    let label = interaction.player ? t('Interactuar') : interaction.item?.id === 'welcome:gnomi'
      ? t('Hablar con {name}', { name: session.registeredNpcs.gnomi.name }) : t(interaction.item!.label);
    if (interaction.item?.id.startsWith('portal:') && isInCombat(fight.combatEncounter)) label += ` · ${t('Bloqueado: combate activo')}`;
    const door = interaction.item?.id.startsWith('portal:') ? play.city.portals.find(portal => `portal:${portal.id}` === interaction.item!.id) : null;
    if (door && doorLocked(door)) label += ` · ${t('Cerrada')}`;
    if ($('#interact-label').textContent !== label) $('#interact-label').textContent = label;
  } else $('#interact-label').textContent = '';
}
export function clickToMove(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.1), p)) return;
  let distance = ray.ray.origin.distanceTo(p);
  for (let i = 0; i < 8; i++) {
    ray.ray.at(distance, p);
    const heightDifference = p.y - play.city.groundY(p.x, p.z);
    if (Math.abs(heightDifference) < 0.05) break;
    if (Math.abs(ray.ray.direction.y) < 1e-3) return;
    distance += heightDifference / -ray.ray.direction.y;
    if (distance < 0) return;
  }
  p.y = play.city.groundY(p.x, p.z);
  play.moveTarget = p;
  fight.combatApproach=false;fight.pendingCombatSkill=false;
  marker.position.set(p.x, play.city.groundY(p.x, p.z) + 0.03, p.z);
  marker.visible = true;
}
/** Botón de interacción y limpieza de teclas al perder el foco. */
export function installInteraction() {
  document.getElementById('interact-prompt')!.addEventListener('click', () => interact());
  window.addEventListener('blur', () => keys.clear());
}

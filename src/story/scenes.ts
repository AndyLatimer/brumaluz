// Escenas de la historia: llegada a Brumaluz, la criatura, la vuelta de Isberto y su casa.
import * as THREE from 'three';
import { createCinematics, orbitShot, dollyShot } from '../world/cinematic';
import { chatNpc } from '../ui/chatWindow';
import { t } from '../ui/i18n';
import { play, story, session, view, fight, talk, ui } from '../game/state';
import { INTRO_GATE, WELCOME_START, INTRO_ENTRY, INTRO_GNOMI_FROM, SHADOW_REPORT_RADIUS, ISBERTO_WAY, HOUSE_BED, ISBERTO_HOUSE } from '../data/quests';
import { welcomeAction } from '../services/account';
import { simulateWelcome } from '../services/devActions';
import { buildShadowEnemy, playShadowEnemyAction, updateShadowEnemy } from '../world/shadowEnemy';
import { castShadows } from '../world/render';
import { isDialogOpen } from '../ui/dialog';
import { storyPath } from '../world/storyPath';
import { BANK_SPOTS } from '../data/bank';
import type { CityPortal } from '../world/city';
import { npcSay } from '../game/hud';
import { holder, scene, LOCAL_COMBAT_SITE, clock } from '../game/stage';
import { characterContext } from '../game/avatar';
import { runOnServer } from '../game/server';
import { placeAfterTravel, npcActors, npcSitesHere } from '../game/cities';
import { talkGnomi, houseOpen } from './quests';
import { talkTo } from '../game/interaction';
import { beginIsbertoArrival } from './isbertoArrival';
import { storyLock } from '../game/conversation';
import { tradeWindow } from '../ui/gameInterface';

export const cinematic = createCinematics();
// ---------------- Historia: cinemáticas y escenas ----------------
export function groundPoint(p: { x: number; z: number }) { return new THREE.Vector3(p.x, play.city.groundY(p.x, p.z), p.z); }
export const facingTo = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(to.x - from.x, to.z - from.z);
/** Devuelve true cuando el personaje ha llegado; un bloqueo no cuenta como llegada. */
export function walkPlayer(dt: number) {
  if (!story.playerScript) return true;
  const to = story.playerScript.target.clone().sub(holder.position).setY(0);
  const distance = to.length();
  if (distance < .1) { play.char.setGait('idle'); return true; }
  const next = holder.position.clone().addScaledVector(to, Math.min(distance, dt * story.playerScript.speed) / distance);
  const corrected = play.city.collide(holder.position, next);
  const moved = corrected.distanceToSquared(holder.position) > 1e-6;
  holder.rotation.y = facingTo(holder.position, story.playerScript.target);
  holder.position.set(corrected.x, play.city.groundY(corrected.x, corrected.z), corrected.z);
  play.groundHeight = holder.position.y; play.lastPlatformY = null;
  play.char.setGait(moved ? 'walk' : 'idle');
  return false;
}
export function restoreStoryFog() {
  if (story.storyFog && scene.fog instanceof THREE.Fog) Object.assign(scene.fog, story.storyFog);
  story.storyFog = null;
}
/** La cinemática de llegada: personaje recién creado, aún en la Puerta del Este y sin haber hablado con Gnomi. */
export function introPending() {
  return play.city.locationId === 'brumaluz' && session.state.welcome?.stage === 'available' && session.state.welcome.origin === null && !session.state.introSeen
    && Math.hypot(holder.position.x - INTRO_GATE.x, holder.position.z - INTRO_GATE.z) < 26;
}
/** El salto de escena y el final natural dejan exactamente el mismo estado persistente. */
export async function finishIntro() {
  const stillCurrent = characterContext(), connection = session.worldConnection;
  story.introFinishing = true; story.playerScript = null; play.char.setGait('idle');
  restoreStoryFog();
  try {
    await connection?.suspend();
    if (!stillCurrent()) return;
    const success = await runOnServer(id => welcomeAction(id, 'arrive'), () => simulateWelcome(session.state, 'arrive'));
    if (!stillCurrent()) return;
    if (!success) { story.introArmed = true; return; }
    if (session.state.position) placeAfterTravel(session.state.position);
    story.welcomeWorld.release();
    const meet = groundPoint(WELCOME_START);
    story.welcomeWorld.place(meet, facingTo(meet, holder.position));
    holder.rotation.y = facingTo(holder.position, meet); view.yaw = holder.rotation.y - Math.PI;
    talkGnomi();
  } finally {
    if (stillCurrent()) story.introFinishing = false;
    if (connection === session.worldConnection) connection?.resume();
  }
}
/** Vuelo sobre Brumaluz, entrada por la puerta y Gnomi, que busca su distintivo hasta que se topa con el jugador. */
export function playIntro() {
  const generation = play.playGeneration;
  const entry = groundPoint(INTRO_ENTRY), meet = groundPoint(WELCOME_START), from = groundPoint(INTRO_GNOMI_FROM);
  const gate = groundPoint(INTRO_GATE), centre = groundPoint({ x: 0, z: 0 });
  const out = gate.clone().sub(meet).setY(0).normalize(), side = new THREE.Vector3(-out.z, 0, out.x);
  const heading = Math.atan2(out.x, out.z);
  const gnomi = session.registeredNpcs.gnomi.name;
  const up = (v: THREE.Vector3, y: number) => v.clone().setY(v.y + y);
  // Retenido en su sitio desde ya: si no, su lógica normal lo devolvería a su punto de espera.
  story.welcomeWorld.place(from, facingTo(from, meet));
  story.welcomeWorld.walkTo(from, 0);
  if (scene.fog instanceof THREE.Fog) {
    story.storyFog = { near: scene.fog.near, far: scene.fog.far };
    scene.fog.near = 160; scene.fog.far = 450;
  }
  story.playerScript = { target: entry, speed: 2.3 };
  cinematic.play([
    { duration: 3, line: { text: 'La Puerta del Este', eyebrow: 'Tu historia empieza aquí', detail: 'Un paso al otro lado. Todo un mundo por delante.' },
      camera: () => ({ position: up(holder.position.clone().addScaledVector(out, 8).addScaledVector(side, 3.4), 4.2), target: up(holder.position, 1.1) }),
      update: dt => { walkPlayer(dt); } },
    { duration: 5.5, line: { text: 'Brumaluz', eyebrow: 'Capital de Pompelín', detail: 'Cada gran historia empieza con algo pequeño.' },
      camera: orbitShot(centre, [96, 80], [64, 48], [heading - 2.2, heading - 1.25], 2),
      update: dt => { walkPlayer(dt); } },
    { duration: 4, blend: 1.6,
      camera: dollyShot(
        { position: up(centre.clone().addScaledVector(out, 25), 48), target: centre.clone().addScaledVector(out, 80) },
        { position: up(entry.clone().addScaledVector(out, -7).addScaledVector(side, 4), 4), target: up(entry, 1.1) }),
      update: dt => { walkPlayer(dt); } },
    { duration: 2, blend: 1,
      camera: () => ({ position: up(holder.position.clone().addScaledVector(out, -4.8).addScaledVector(side, 1.6), 1.6), target: up(holder.position, 1.25) }),
      update: dt => { walkPlayer(dt); } },
    { duration: 7, minimum: 4.5, blend: .9, line: { speaker: gnomi, text: 'Puerta del Este, nueva asignación, bienvenida impecable… Solo falta el distintivo. Ay, Gnomi. El distintivo.' },
      start: () => { story.playerScript = null; play.char.setGait('idle'); restoreStoryFog(); story.welcomeWorld.walkTo(meet, 1.6, true); },
      camera: () => ({ position: up(story.welcomeWorld.root.position.clone().addScaledVector(out, 3).addScaledVector(side, 1.7), 1.5), target: up(story.welcomeWorld.root.position, .55) }),
      update: () => story.welcomeWorld.arrived },
    { duration: 3.6, blend: .8, line: { speaker: gnomi, text: '¡Ah, ya estás aquí! ¡Te estaba esperando! Mirando al suelo, sí. Pero esperando.' },
      start: () => { story.welcomeWorld.release(); story.welcomeWorld.greet(); },
      camera: () => {
        const middle = holder.position.clone().add(story.welcomeWorld.root.position).multiplyScalar(.5);
        return { position: up(middle.clone().addScaledVector(side, 3.6).addScaledVector(out, -.6), 1.3), target: up(middle, .75) };
      } },
  ], () => {
    story.playerScript = null;
    if (generation !== play.playGeneration || play.mode !== 'play') return;
    void finishIntro();
  });
}
/** Tras devolver el distintivo: la criatura que ronda la herrería de Isberto. */
export function playMonsterReveal() {
  const generation = play.playGeneration;
  removeMonsterPreview();
  const site = groundPoint({ x: LOCAL_COMBAT_SITE.x + 3.5, z: LOCAL_COMBAT_SITE.z });
  story.monsterPreview = buildShadowEnemy(site.x, site.z, site.y);
  story.monsterPreview.name = 'story-shadow-preview';
  castShadows(story.monsterPreview);
  scene.add(story.monsterPreview);
  const isberto = session.registeredNpcs.isberto.name;
  const look = site.clone().setY(site.y + .7);
  cinematic.play([
    { duration: 5.2, line: { speaker: isberto, text: 'Ahí la tienes, junto a mi herrería. Se pega al calor de la fragua. Ya he despejado la zona.' },
      camera: orbitShot(site, [7.5, 5.2], [3.4, 1.8], [-.9, -.1], .7) },
    { duration: 4.2, blend: .6, line: { speaker: isberto, text: 'No sé de dónde ha salido. Sí sé que no se va a quedar. Mírala bien: hasta eso tiene que dejar un hueco al atacar.' },
      start: () => playShadowEnemyAction(story.monsterPreview, 'attack', clock.getElapsedTime()),
      camera: dollyShot({ position: new THREE.Vector3(site.x + 3.4, site.y + 1.2, site.z - 1.6), target: look },
        { position: new THREE.Vector3(site.x + 2.2, site.y + .9, site.z - 1), target: look }) },
  ], () => {
    removeMonsterPreview();
    if (generation === play.playGeneration && play.mode === 'play') talkTo('isberto');
  });
}
export function removeMonsterPreview() {
  if (!story.monsterPreview) return;
  story.monsterPreview.removeFromParent();
  story.monsterPreview.traverse(part => {
    const mesh = part as THREE.Mesh;
    if (mesh.isMesh) { mesh.geometry.dispose(); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose(); }
  });
  story.monsterPreview = null;
}
/** ¿Ya se registraron los restos de la criatura? (sin cuerpo pendiente, sí). */
export const corpseLooted = () => fight.combatEncounter?.status === 'defeated' && fight.combatEncounter.looted;
/** Tras registrar los restos, Isberto acude junto al jugador. */
export function playIsbertoReturn() {
  const isberto = npcActors.find(npc => npc.id === 'isberto');
  if (!isberto) return;
  const away = holder.position.clone().sub(fight.combatTargetRoot?.position ?? holder.position).setY(0);
  if (away.lengthSq() < .01) away.set(-1, 0, 0);
  away.normalize();
  let spot = holder.position.clone().addScaledVector(away, 2.6);
  // El punto debe quedar junto a los restos y dejar espacio entre ambos interlocutores.
  for (const angle of [0, Math.PI / 2, -Math.PI / 2, Math.PI, Math.PI / 4, -Math.PI / 4]) {
    const direction = away.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const candidate = play.city.collide(holder.position, holder.position.clone().addScaledVector(direction, 2.6));
    if (Math.hypot(candidate.x - holder.position.x, candidate.z - holder.position.z) >= 2
      && Math.hypot(candidate.x - fight.combatEncounter!.x, candidate.z - fight.combatEncounter!.z) <= SHADOW_REPORT_RADIUS) { spot = candidate; break; }
  }
  story.isbertoMeet = play.city.collide(holder.position, spot);
  story.isbertoMeet.y = play.city.groundY(story.isbertoMeet.x, story.isbertoMeet.z);
  isberto.character.root.position.copy(story.isbertoMeet);
  story.isbertoPositionKey = `${play.city.locationId}:${story.isbertoMeet.x}:${story.isbertoMeet.z}`;
  isberto.character.root.visible = true;
  beginIsbertoArrival(isberto.character, () => talkTo('isberto'));
}
/** Dónde está Isberto cuando no guía al jugador ni va de camino. */
export function isbertoSpot() {
  const site = npcSitesHere().find(site => site.id === 'isberto')?.position;
  if (play.city.locationId !== 'brumaluz') return site;
  if (session.state.shadowQuest === 'defeated' && story.isbertoMeet) return story.isbertoMeet;
  return session.state.isbertoPosition ?? site;
}
/** Isberto camina hasta su casa y espera al jugador si se queda atrás. */
export function updateIsbertoGuide(dt: number) {
  const isberto = npcActors.find(npc => npc.id === 'isberto');
  if (!isberto || session.state.shadowQuest !== 'returning' || play.city.locationId !== 'brumaluz') { story.isbertoGuide = null; return; }
  const root = isberto.character.root;
  if (!story.isbertoGuide) {
    // Al volver a entrar, Isberto ya espera en su puerta.
    root.position.copy(groundPoint(ISBERTO_WAY[ISBERTO_WAY.length - 1]));
    story.isbertoGuide = [];
  }
  if (talk.isbertoArrival || isDialogOpen() || cinematic.active) return;
  const target = story.isbertoGuide[0];
  const toPlayer = Math.hypot(holder.position.x - root.position.x, holder.position.z - root.position.z);
  let speed = 0;
  const playerAhead = target && target.clone().sub(root.position).dot(holder.position.clone().sub(root.position)) > 0;
  if (target && (toPlayer < 9 || playerAhead) && dt > 0) {
    const way = target.clone().sub(root.position).setY(0);
    const distance = way.length();
    if (distance < .3) story.isbertoGuide.shift();
    else {
      speed = 2.3;
      const corrected = play.city.collide(root.position, root.position.clone().addScaledVector(way, Math.min(distance, dt * speed) / distance));
      if (corrected.distanceToSquared(root.position) < 1e-6) {
        speed = 0;
        story.guideBlocked += dt;
        if (story.guideBlocked > 1) { story.isbertoGuide = storyPath(play.city, root.position, groundPoint(ISBERTO_WAY[ISBERTO_WAY.length - 1])); story.guideBlocked = 0; }
      }
      else {
        story.guideBlocked = 0;
        const angle = facingTo(root.position, corrected);
        root.rotation.y += Math.atan2(Math.sin(angle - root.rotation.y), Math.cos(angle - root.rotation.y)) * Math.min(1, dt * 10);
        root.position.copy(corrected);
      }
      root.position.y = play.city.groundY(root.position.x, root.position.z);
    }
  }
  if (!speed) {
    const angle = facingTo(root.position, holder.position);
    root.rotation.y += Math.atan2(Math.sin(angle - root.rotation.y), Math.cos(angle - root.rotation.y)) * Math.min(1, dt * 5);
  }
  const gait = speed > 3 ? 'run' : speed ? 'walk' : 'idle';
  root.userData.gait = gait;
  isberto.character.setGait(gait);
}
/** Ya dentro de su casa, Isberto enseña la cama y el cofre. */
export function playHouseTour() {
  const generation = play.playGeneration;
  const name = session.registeredNpcs.isberto.name;
  const bed = groundPoint(HOUSE_BED), chest = groundPoint(BANK_SPOTS[ISBERTO_HOUSE]);
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, play.city.groundY(x, z) + y, z);
  const isberto = npcActors.find(npc => npc.id === 'isberto')?.character.root;
  if (isberto) isberto.rotation.y = facingTo(isberto.position, holder.position);
  cinematic.play([
    { duration: 4, line: { speaker: name, text: 'Pasa. Y límpiate las botas, que acabo de barrer.' },
      camera: dollyShot({ position: at(-3, 2.5, -3.1), target: at(.4, .9, 1.3) }, { position: at(-2.6, 2.2, -2.5), target: at(.5, .9, 1.4) }) },
    { duration: 4.6, blend: .9, line: { speaker: name, text: 'Esa cama es tuya cuando necesites descansar. Duermes un rato y te levantas como nuevo.' },
      camera: dollyShot({ position: at(1, 1.8, -.2), target: bed.clone().setY(bed.y + .4) }, { position: at(.5, 1.5, -.9), target: bed.clone().setY(bed.y + .4) }) },
    { duration: 4.6, blend: .9, line: { speaker: name, text: 'Y ese cofre de la esquina es para tus cosas. Lo que guardes ahí, ahí se queda: nadie más lo toca.' },
      camera: dollyShot({ position: at(1.4, 1.65, 1.35), target: chest.clone().setY(chest.y + .4) }, { position: at(1.6, 1.45, 1.7), target: chest.clone().setY(chest.y + .4) }) },
  ], () => {
    if (generation === play.playGeneration && play.mode === 'play' && play.city.locationId === ISBERTO_HOUSE) talkTo('isberto');
  });
}
/** La puerta de Isberto sigue cerrada hasta que él invita al jugador. */
export const doorLocked = (portal: CityPortal) => portal.target?.map === ISBERTO_HOUSE && !houseOpen();
export function updateStory(dt: number, time: number) {
  if (story.monsterPreview) updateShadowEnemy(story.monsterPreview, time, dt, holder.position, false);
  if (play.mode !== 'play' || play.mapTravelling || play.dead) return;
  const idle = !storyLock() && !isDialogOpen() && !ui.openWindow && !play.actionBusy && !tradeWindow.isOpen && !talk.pendingIsbertoIntroduction;
  if (story.introArmed && idle) { story.introArmed = false; if (introPending()) playIntro(); }
  if (session.state.shadowQuest === 'defeated' && corpseLooted() && fight.combatEncounter && play.city.locationId === 'brumaluz' && !story.isbertoReturnShown
    && Math.hypot(holder.position.x - fight.combatEncounter.x, holder.position.z - fight.combatEncounter.z) <= SHADOW_REPORT_RADIUS - 2) {
    story.isbertoReturnDelay = idle ? story.isbertoReturnDelay + dt : 0;
    if (story.isbertoReturnDelay > 1.2) { story.isbertoReturnShown = true; playIsbertoReturn(); }
  }
  if (story.houseTourArmed && idle && play.city.locationId === ISBERTO_HOUSE) { story.houseTourArmed = false; if (session.state.shadowQuest === 'returning') playHouseTour(); }
  updateIsbertoGuide(dt);
}
/** Las frases de las escenas pasan también al chat. */
export function installStoryLines() {
  cinematic.onLine((speaker, text) => { if (speaker) { chatNpc(speaker, t(text)); npcSay(speaker, t(text)); } });
}

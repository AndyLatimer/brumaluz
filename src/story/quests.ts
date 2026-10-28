// Misiones de la historia: Gnomi, Isberto, la cama de su casa y los indicadores de objetivo.
import * as THREE from 'three';
import { session, play, story, fight, talk, ui } from '../game/state';
import { ISBERTO_HOUSE, type ShadowAction, ISBERTO_TALK_RADIUS, SHADOW_REPORT_RADIUS, ISBERTO_WAY, SHADOW_RETURN, SHADOW_TITLE, HOUSE_BED, BED_RADIUS, type WelcomeAction, WELCOME_BADGE, WELCOME_START, WELCOME_TALK_RADIUS, WELCOME_TITLE, ISBERTO_INSIDE, ISBERTO_DOOR } from '../data/quests';
import { welcomeConversation } from '../ui/questWindow';
import { shadowAction, restAction, welcomeAction, askGnomiAboutDust } from '../services/account';
import { t } from '../ui/i18n';
import { storyPath } from '../world/storyPath';
import { isInCombat } from '../data/combat';
import { vitalsOf } from '../data/stats';
import { beginTransition } from '../ui/transitionLoading';
import { simulateWelcome } from '../services/devActions';
import { COMBAT_SITE } from '../world/city';
import { isDialogOpen } from '../ui/dialog';
import { TARGET_RANGE } from '../ui/targetFrame';
import { chatNpc } from '../ui/chatWindow';
import { keys, marker, holder, playerVel, TEST, LOCAL_COMBAT_SITE, camera } from '../game/stage';
import { beginConversation, storyLock } from '../game/conversation';
import { npcActors } from '../game/cities';
import { corpseLooted, groundPoint } from './scenes';
import { toast } from '../ui/toast';
import { runOnServer } from '../game/server';
import { updateHud, speechSeconds } from '../game/hud';
import { characterContext } from '../game/avatar';
import { tradeWindow, questTracking, personalWaypoints } from '../ui/gameInterface';
import { settings } from '../game/audio';
import {professionTutorialConversation} from './professionTutorial';
import {performProfession} from '../game/professions';
import {tutorialTarget} from '../data/professionTutorial';

export function isbertoUnlocked() {
  return session.state.welcome?.stage === 'completed';
}
/** Isberto se ve en Brumaluz hasta que invita al jugador a casa; desde entonces, dentro de ella. */
export function isbertoVisible() {
  if (play.city.locationId === 'taller_herreria_interior') return true;
  if (!isbertoUnlocked()) return false;
  // Al entregar el distintivo aún estamos hablando con Gnomi: Isberto entra después.
  if (talk.pendingIsbertoIntroduction) return false;
  if (play.city.locationId === ISBERTO_HOUSE) return session.state.shadowQuest === 'returning' || session.state.shadowQuest === 'returned';
  return session.state.shadowQuest !== 'returned';
}
/** La casa de Isberto (su cama y su cofre) se abre cuando él invita al jugador; antes de la historia, siempre. */
export function houseOpen() {
  return !session.state.welcome || session.state.shadowQuest === 'returning' || session.state.shadowQuest === 'returned';
}
export function talkGnomi(showDust = true) {
  if (play.actionBusy) return;
  keys.clear(); play.moveTarget = null; play.pendingTalk = null; marker.visible = false;
  if (showDust && session.state.fairyDustQuest === 'ask_gnomi') {
    beginConversation(story.welcomeWorld.root, {
      speaker: session.registeredNpcs.gnomi.name, subtitle: session.registeredNpcs.gnomi.subtitle, emblem: 'guild', start: 'intro',
      nodes: {
        intro: { text: '¡Hola! ¿En qué puedo echarte una mano?', choices: [
          { text: 'He encontrado este polvo. ¿Sabes qué es?', action: performFairyDustQuest, next: 'dust' },
          { text: 'Quería hablar de otra cosa.', action: () => { talkGnomi(false); return false; } },
        ] },
        dust: { text: "Oh… parece polvo de hada. Mira cómo brilla. Hasta en la palma de la mano parece que le han quedado estrellitas.\n\nNo sé para qué sirve. Yo preguntaría en La Arboleda; quizá allí sepan más. Guárdalo bien mientras tanto, ¿sí?", choices: [
          { text: 'Gracias, Gnomi.' },
          { text: 'Quería hablar de otra cosa.', action: () => { talkGnomi(false); return false; } },
        ] },
      },
    });
    return;
  }
  if (session.state.shadowQuest === 'returning' || session.state.shadowQuest === 'returned') {
    if(session.state.shadowQuest==='returned'){
      beginConversation(story.welcomeWorld.root,professionTutorialConversation(()=>session.state,performProfession,session.registeredNpcs.gnomi.name,session.registeredNpcs.gnomi.subtitle));return;
    }
    beginConversation(story.welcomeWorld.root, {
      speaker:session.registeredNpcs.gnomi.name, subtitle:session.registeredNpcs.gnomi.subtitle, emblem:'guild', start:'intro',
      nodes:{
        intro: {text:"Ve con Isberto; su casa está junto al camino de la herrería. Tiene cara de pocos amigos, pero ya ves… te está esperando.\n\nYo me vuelvo a la plaza del pozo. Descansa, que los talleres no se van a ir a ninguna parte."},
      },
    });
    return;
  }
  if (!session.state.welcome) {
    beginConversation(story.welcomeWorld.root,professionTutorialConversation(()=>session.state,performProfession,session.registeredNpcs.gnomi.name,session.registeredNpcs.gnomi.subtitle));return;
  }
  if (session.state.welcome.origin === null) story.welcomeWorld.greet();
  beginConversation(story.welcomeWorld.root, { ...welcomeConversation(session.state, performWelcome), speaker: session.registeredNpcs.gnomi.name, subtitle: session.registeredNpcs.gnomi.subtitle });
}
export async function performFairyDustQuest() {
  if (play.city.locationId !== 'brumaluz' || !story.welcomeWorld.root.visible
    || Math.hypot(holder.position.x-story.welcomeWorld.root.position.x,holder.position.z-story.welcomeWorld.root.position.z)>3.5) {
    toast('No se pudo completar la acción', 'Acércate a Gnomi para preguntarle por el polvo de hada.', true);
    return false;
  }
  const success = await runOnServer(askGnomiAboutDust, () => {
    if (session.state.fairyDustQuest !== 'ask_gnomi') throw new Error(t('Esta conversación sobre el polvo de hada ya no está pendiente.'));
    session.state.fairyDustQuest = 'arboleda';
  });
  if (success) updateHud();
  return success;
}
export async function performShadow(action: ShadowAction) {
  const target = npcActors.find(npc => npc.id === 'isberto')?.character.root.position;
  if (!target || play.city.locationId !== (action === 'report' ? 'brumaluz' : ISBERTO_HOUSE)
    || Math.hypot(holder.position.x - target.x, holder.position.z - target.z) > ISBERTO_TALK_RADIUS
    || (action === 'report' && (!corpseLooted() || !fight.combatEncounter
      || Math.hypot(holder.position.x - fight.combatEncounter.x, holder.position.z - fight.combatEncounter.z) > SHADOW_REPORT_RADIUS))) {
    toast('No se pudo completar la acción', 'Acércate al objetivo para continuar la misión.', true);
    return false;
  }
  const success = await runOnServer(id => shadowAction(id, action), () => {
    if ((action === 'report' && session.state.shadowQuest !== 'defeated') || (action === 'return' && session.state.shadowQuest !== 'returning')) {
      throw new Error(t('No puedes continuar este paso de la misión todavía.'));
    }
    session.state.shadowQuest = action === 'report' ? 'returning' : 'returned';
  });
  if (!success) return false;
  updateHud();
  if (action === 'report') {
    // Isberto echa a andar hacia su casa y Gnomi vuelve a la plaza del pozo.
    story.isbertoGuide = storyPath(play.city, target.clone(), groundPoint(ISBERTO_WAY[ISBERTO_WAY.length - 1]));
    story.welcomeWorld.leave(groundPoint(SHADOW_RETURN));
  } else toast(SHADOW_TITLE, 'Misión completada: Isberto te ofrece su cama y su cofre.', false, {}, 'reward');
  return true;
}
/** Cama de Isberto: vida y recurso al máximo. */
export async function restInBed() {
  if (story.resting || storyLock() || play.actionBusy || play.dead || play.city.locationId !== ISBERTO_HOUSE || !houseOpen()
    || isInCombat(fight.combatEncounter) || Math.hypot(holder.position.x - HOUSE_BED.x, holder.position.z - HOUSE_BED.z) > BED_RADIUS) return;
  const stillCurrent = characterContext();
  const vitals = vitalsOf(session.state);
  if (vitals.health >= vitals.maxHealth && vitals.resource >= vitals.maxResource) {
    toast('Cama de Isberto', 'Ya estás descansado. Vuelve cuando lo necesites.');
    return;
  }
  keys.clear(); play.moveTarget = null; marker.visible = false;
  playerVel.set(0, 0, 0); story.resting = true;
  restFade.hidden = false;
  void restFade.offsetWidth;
  restFade.classList.add('show');
  const started = performance.now();
  const success = await runOnServer(id => restAction(id), () => { session.state.health = -1; session.state.resource = -1; });
  await new Promise(resolve => setTimeout(resolve, Math.max(0, 1100 - (performance.now() - started))));
  if (!stillCurrent()) return;
  story.resting = false;
  restFade.classList.remove('show');
  setTimeout(() => { if (!restFade.classList.contains('show')) restFade.hidden = true; }, 700);
  if (!success) return;
  updateHud();
  toast('Has descansado', 'Recuperas toda la vida y la energía.');
}
export const restFade = document.createElement('div');
export async function performWelcome(action: WelcomeAction, origin?: number) {
  const stillCurrent = characterContext();
  const position = action === 'collect' ? WELCOME_BADGE : action === 'claim' ? story.welcomeWorld.root.position : WELCOME_START;
  if (Math.hypot(holder.position.x - position.x, holder.position.z - position.z) > (action === 'collect' ? 2.5 : action === 'claim' ? 3.5 : WELCOME_TALK_RADIUS - .3)) {
    toast('No se pudo completar la acción', 'Acércate al objetivo para continuar la misión.', true);
    return false;
  }
  const finish = beginTransition('Guardando misión…');
  try {
    const success = await runOnServer(id => welcomeAction(id, action, origin), () => simulateWelcome(session.state, action, origin));
    if (!success || !stillCurrent()) return false;
    if (action === 'collect') play.char.pickUp();
    if (action === 'claim') {
      if (TEST && !session.activeCharacterId) session.state.isbertoPosition = { x: holder.position.x + 2, z: holder.position.z };
      talk.pendingIsbertoIntroduction = true;
    }
    updateHud();
    if (action !== 'origin') {
      const message = action === 'claim' ? 'Misión completada: 40 XP y 5 pelines.' : action === 'collect' ? 'Has encontrado el distintivo. Habla con Gnomi.' : 'Misión aceptada. Gnomi te acompaña.';
      toast(WELCOME_TITLE, message, false, {}, action === 'claim' ? 'reward' : 'quest');
    }
    return true;
  } finally { finish(); }
}
export const questAnchor = new THREE.Vector3();
export function shadowQuestTarget(): { x: number; z: number } {
  if (session.state.shadowQuest === 'returning' || session.state.shadowQuest === 'returned') {
    return play.city.locationId === ISBERTO_HOUSE ? npcActors.find(npc => npc.id === 'isberto')?.character.root.position ?? ISBERTO_INSIDE : ISBERTO_DOOR;
  }
  if ((session.state.shadowQuest === 'active' || (session.state.shadowQuest === 'defeated' && (!corpseLooted() || !story.isbertoReturnShown))) && fight.combatTargetRoot) return fight.combatTargetRoot.position;
  if (session.state.shadowQuest === 'defeated' && !story.isbertoReturnShown && fight.combatEncounter) return fight.combatEncounter;
  return npcActors.find(npc => npc.id === 'isberto')?.character.root.position
    ?? session.state.isbertoPosition ?? {x: -3, z: TEST ? LOCAL_COMBAT_SITE.z : COMBAT_SITE.z};
}
export function updateWelcome(dt: number, time: number) {
  story.welcomeWorld.update(session.state.welcome, play.mode === 'play' && play.city.locationId === 'brumaluz', holder.position, play.dead || talk.isbertoArrival || isDialogOpen() || !!ui.openWindow ? 0 : dt, time, talk.conversationActor === story.welcomeWorld.root, session.state.shadowQuest === 'returning' || session.state.shadowQuest === 'returned');
  const visible = play.mode === 'play' && !play.dead && !storyLock() && !ui.openWindow && !ui.gameMenuOpen && !ui.playerMenuOpen && !ui.worldMenuOpen && !ui.optionsOpen && !tradeWindow.isOpen && !isDialogOpen();
  ui.questTracker.update(session.state, visible, corpseLooted());
  ui.welcomePlate.hidden = true;
  ui.questIndicator.hide();
  const professionTracked=questTracking.current(session.state)==='profession';
  if(visible&&professionTracked){const target=tutorialTarget(session.state,play.city.locationId);if(target)ui.questIndicator.update({...target,y:play.city.groundY(target.x,target.z)+1},holder.position,camera);}
  if (!story.welcomeWorld.root.visible || !visible) return;
  camera.updateMatrixWorld();
  const welcomeHeight = 1.1 * session.registeredNpcs.gnomi.render.scale / .48 * session.registeredNpcs.gnomi.render.height / .92;
  questAnchor.copy(story.welcomeWorld.root.position).add(new THREE.Vector3(0, welcomeHeight, 0)).project(camera);
  if (settings.nameplates && story.welcomeWorld.root.position.distanceToSquared(holder.position) <= TARGET_RANGE * TARGET_RANGE && questAnchor.z > -1 && questAnchor.z < 1 && Math.abs(questAnchor.x) < 1 && Math.abs(questAnchor.y) < 1) {
    ui.welcomePlate.hidden = false;
    ui.welcomePlate.style.transform = `translate(${(questAnchor.x * .5 + .5) * innerWidth}px, ${(-questAnchor.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`;
  }
  if(professionTracked)return;
  if (questTracking.current(session.state) === 'fairy-dust') {
    if (session.state.fairyDustQuest === 'ask_gnomi') {
      const target = story.welcomeWorld.root.position;
      ui.questIndicator.update({ x: target.x, y: target.y + 1.3, z: target.z }, holder.position, camera);
    }
    return;
  }
  if (!session.state.welcome) return;
  if (session.state.welcome.stage === 'completed' && session.state.shadowQuest === 'returned') return;
  const shadowTarget = session.state.welcome.stage === 'completed'
    ? shadowQuestTarget() : null;
  const target = shadowTarget ?? (session.state.welcome.stage === 'active' ? story.welcomeWorld.lost.position : story.welcomeWorld.root.position);
  const distance = Math.hypot(target.x - holder.position.x, target.z - holder.position.z);
  if (session.state.welcome.stage === 'active' && !story.welcomeTravelSaid && Math.hypot(holder.position.x - WELCOME_START.x, holder.position.z - WELCOME_START.z) > 5 && distance > 8) {
    story.welcomeTravelSaid = true;
    const line = t('El mercado queda por aquí. Me paré junto a los puestos antes de ir a la puerta. Lo llevaba puesto entonces… creo.');
    chatNpc(session.registeredNpcs.gnomi.name, line);
    story.welcomeWorld.speak(speechSeconds(line));
  }
  if (session.state.welcome.stage === 'active' && distance < 8 && !story.welcomeHintSaid) {
    story.welcomeHintSaid = true;
    chatNpc(session.registeredNpcs.gnomi.name, t('Por aquí estuve. Espera… ¿no ves algo que brilla junto al puesto?'));
    story.welcomeWorld.speak(5);
  }
  if (session.state.welcome.stage !== 'active') { story.welcomeHintSaid = false; story.welcomeTravelSaid = false; }
  if (questTracking.current(session.state)) ui.questIndicator.update({ x: target.x, y: play.city.groundY(target.x, target.z) + (session.state.welcome.stage === 'active' ? .55 : 1.3), z: target.z }, holder.position, camera);
}
export function updatePersonalWaypoint() {
  ui.waypointIndicator.hide();
  const point = personalWaypoints.get(play.city.locationId);
  if (!point || play.mode !== 'play' || play.mapTravelling || play.dead || storyLock() || isDialogOpen() || ui.openWindow || ui.gameMenuOpen || ui.playerMenuOpen || ui.worldMenuOpen || ui.optionsOpen || tradeWindow.isOpen) return;
  ui.waypointIndicator.update({ ...point, y: play.city.groundY(point.x, point.z) + .8 }, holder.position, camera);
  ui.waypointIndicator.element.classList.toggle('arrived', Math.hypot(point.x - holder.position.x, point.z - holder.position.z) < 2);
}
/** Fundido a negro de la cama de Isberto. */
export function installRestFade() {
  restFade.id = 'rest-fade';
  restFade.hidden = true;
  document.body.append(restFade);
}

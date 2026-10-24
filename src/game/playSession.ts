// Entrar y salir de la partida: estado inicial, chat y conexiones.
import * as THREE from 'three';
import { play, story, session, view, talk } from './state';
import { INTRO_GATE } from '../data/quests';
import { starterEquipment } from '../data/combat';
import { startFriendNotifications } from '../ui/friendNotifications';
import { startParty, stopParty } from '../services/party';
import { chatSystem, setChatSelf, chatReceive, clearChat } from '../ui/chatWindow';
import { t } from '../ui/i18n';
import { subscribeChat } from '../services/account';
import { closeDialog } from '../ui/dialog';
import { TEST, playerVel, holder, camera, camTarget, layout, keys, marker } from './stage';
import { $ } from '../ui/dom';
import { updateHud } from './hud';
import { resetFoodTimer, setFoodRunning } from './vitals';
import { menuMusic, setAmbientEnabled, ambientSoundscape } from './audio';
import { rebuildNow } from './avatar';
import { errorMessage } from './server';
import { refreshWorldStatus, stopMultiplayer } from './worldClient';
import { endIsbertoArrival } from '../story/isbertoArrival';
import { cinematic, restoreStoryFog, removeMonsterPreview } from '../story/scenes';
import { restFade } from '../story/quests';
import { playerInteractions } from './interaction';
import { clearScreenEffects } from './camera';
import { setGameMenuOpen, setPlayerMenuOpen, setWorldMenuOpen, setWindow } from '../ui/menus';
import { clearToasts } from '../ui/toast';

export function enterPlay() {
  clearToasts();
  play.playGeneration++;
  story.introArmed = true; story.houseTourArmed = true;
  story.isbertoReturnShown = false; story.isbertoReturnDelay = 0; story.isbertoMeet = null; story.isbertoGuide = null;
  if (TEST && new URLSearchParams(location.search).has('welcome') && !session.state.welcome) {
    session.state.welcome = { origin: null, stage: 'available' };
    session.state.introSeen = false;
    session.state.position = { ...INTRO_GATE };
    session.state.equipment = starterEquipment(session.state.cls);
  }
  if (session.state.health === 0) session.state.health = -1; // personaje guardado muerto: vuelve con la vida completa
  play.dead = false;
  $('#death-screen').hidden = true;
  document.body.classList.remove('dead');
  updateHud();
  play.mode = 'play';
  if (TEST) { resetFoodTimer(); setFoodRunning(true); }
  document.body.classList.add('playing');
  menuMusic.sync();
  void setAmbientEnabled(play.ambientEnabled);
  view.yaw = play.city.spawnYaw; view.pitch = 0.55; view.followDist = 12; view.zoomTarget = 12; playerVel.set(0, 0, 0);
  if (session.state.position) {
    const savedY = play.city.platformY(session.state.position.x, session.state.position.z) ?? play.city.groundY(session.state.position.x, session.state.position.z);
    holder.position.set(session.state.position.x, savedY, session.state.position.z);
    view.yaw = session.state.position.yaw;
  } else holder.position.copy(play.city.spawn);
  play.running = true;
  play.groundHeight = holder.position.y; play.lastPlatformY = null;
  play.jumpElapsed = play.jumpDuration;
  play.jumpHeight = 0;
  camera.fov = 50;
  holder.rotation.y = view.yaw + Math.PI;
  camTarget.copy(holder.position).add(new THREE.Vector3(0, 1.3, 0));
  rebuildNow();
  layout();
  startChat();
  session.stopFriendNotifications?.();
  session.stopFriendNotifications = !TEST && session.currentUser ? startFriendNotifications() : null;
  if(!TEST && session.currentUser) startParty(session.currentUser.id,error=>chatSystem(t('No se pudo actualizar el grupo: {error}',{error:errorMessage(error)}),true));
  refreshWorldStatus();
  session.worldConnection?.start();
}
export function startChat() {
  stopChat();
  setChatSelf(session.currentUser?.id ?? null);
  chatSystem(t('Pulsa Enter para chatear. Escribe /ayuda para ver los comandos.'));
  if (TEST || !session.activeCharacterId) {
    chatSystem(t('Modo prueba: el chat no está conectado al servidor.'));
    return;
  }
  const id = ++session.chatSeq;
  const off = subscribeChat((m) => { if (id === session.chatSeq) chatReceive(m); });
  session.chatUnsubscribe = off;
}
export function stopChat() {
  session.chatSeq++;
  session.chatUnsubscribe?.();
  session.chatUnsubscribe = null;
  clearChat();
}
export function exitPlay() {
  clearToasts();
  talk.pendingIsbertoIntroduction = false;
  endIsbertoArrival();
  story.playerScript = null;
  play.playGeneration++;
  cinematic.cancel();
  restoreStoryFog();
  story.introFinishing = false; story.resting = false;
  restFade.classList.remove('show'); restFade.hidden = true;
  removeMonsterPreview();
  setFoodRunning(false);
  stopParty();
  session.stopFriendNotifications?.();
  session.stopFriendNotifications = null;
  playerInteractions.close();
  play.playGeneration++;
  stopMultiplayer();
  stopChat();
  play.dead = false;
  clearScreenEffects();
  closeDialog();
  $('#interact-prompt').hidden = true;
  $('#death-screen').hidden = true;
  document.body.classList.remove('dead', 'playing');
  if (session.state.health === 0) session.state.health = -1;
  play.mode = 'create';
  void ambientSoundscape.setEnabled(false);
  setGameMenuOpen(false, false);
  setPlayerMenuOpen(false, false);
  setWorldMenuOpen(false, false);
  setWindow(null, false);
  keys.clear();
  play.moveTarget = null;
  marker.visible = false;
  holder.position.copy(play.city.spawn);
  play.running = true;
  play.groundHeight = play.city.spawn.y; play.lastPlatformY = null;
  play.jumpElapsed = play.jumpDuration;
  play.jumpHeight = 0;
  holder.rotation.y = play.city.spawnYaw - 0.3;
  camera.fov = 30;
  play.char.stand();
  play.char.setGait('idle');
  rebuildNow();
  layout();
}

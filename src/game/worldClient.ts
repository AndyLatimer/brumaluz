// Conexión con el mundo compartido: estado del servidor y jugadores remotos.
import { session, vitals, play, view, fight } from './state';
import { setGrantedTitles } from '../data/titles';
import { enterCharacter, getMyTitles } from '../services/account';
import { sanitize } from '../data/data';
import { RemotePlayers } from '../world/players';
import { setMapPlayerCount } from '../ui/minimap';
import { type WorldSnapshot, WorldConnection } from '../services/multiplayer';
import { chatSystem } from '../ui/chatWindow';
import { t } from '../ui/i18n';
import { TEST, scene, waterFx, holder, playerVel, marker } from './stage';
import { switchGameMap } from './cities';
import { resetFoodTimer, resetOverheal, receiveFood, die, setFoodRunning } from './vitals';
import { toast } from '../ui/toast';
import { errorMessage } from './server';
import { updateHud } from './hud';
import { setCombatEncounter, resetCombatActions } from './combat';
import { exitPlay } from './playSession';
import { loadCharacterSelection, returnToCharacters } from '../ui/characterSelect';
import { acceptSnapshot } from './snapshotOrder';
import { combatFloat } from './combatFeedback';

/** Pide al servidor los datos vigentes del personaje antes de entrar al mundo. */
export async function loadWorldState() {
  if (!session.activeCharacterId) { if (TEST) setGrantedTitles(['rey_de_pompelin']); return TEST; }
  const characterId = session.activeCharacterId;
  const userId = session.currentUser?.id;
  const syncId = session.accountSyncId;
  const stillCurrent = () => session.activeCharacterId === characterId && session.currentUser?.id === userId && session.accountSyncId === syncId;
  try {
    const data = await enterCharacter(characterId);
    if (!stillCurrent()) return false;
    Object.assign(session.state, sanitize(data));
    await switchGameMap(session.state.location);
    if (!stillCurrent()) return false;
    resetFoodTimer(typeof data.food_at === 'number' ? data.food_at : 0);
    resetOverheal();
    const titles = await getMyTitles();
    if (!stillCurrent()) return false;
    setGrantedTitles(titles);
    await prepareMultiplayer();
    vitals.skillReadyAt = performance.now() + Math.max(0, Number(data.combatNextSkill ?? 0) - Date.now() / 1000) * 1000;
    return stillCurrent();
  } catch (error) {
    if (!stillCurrent()) return false;
    stopMultiplayer();
    toast('No se pudo guardar', errorMessage(error), true);
    return false;
  }
}
export const remotePlayers = new RemotePlayers(scene, (x, z) => play.city.groundY(x, z), (x, z) => play.city.platformY(x, z), (x, z) => play.city.waterAt?.(x, z) ?? null, waterFx);
export function refreshWorldStatus() {
  setMapPlayerCount(session.worldRetrying ? null : remotePlayers.list().length + 1);
}
export function receiveWorld(value: WorldSnapshot) {
  if (value.food) receiveFood(value.food);
  const current=acceptSnapshot('vitals',value.selfVitals?.serverRevision);
  if (current&&value.selfVitals) {
    const changed = session.state.health !== value.selfVitals.health || session.state.resource !== value.selfVitals.resource;
    const lostHealth=Math.max(0,session.state.health-value.selfVitals.health),tookDamage=lostHealth>0;
    session.state.health = value.selfVitals.health;
    session.state.resource = value.selfVitals.resource;
    session.state.overheal=value.selfVitals.overheal;
    if(value.selfVitals.barrier!==undefined&&session.state.enchantState)session.state.enchantState.barrier=value.selfVitals.barrier;
    if(tookDamage){if(!fight.combatBusy)play.char.hit();combatFloat(lostHealth,holder.position,'incoming');}
    if (session.state.health === 0 && !play.dead) die();
    if (changed) updateHud();
  }
  if(current&&value.encounter!==undefined)setCombatEncounter(value.encounter);
  session.state.position = value.position;
  if (value.status === 'corrected') {
    const correctedY = play.city.platformY(value.position.x, value.position.z) ?? play.city.groundY(value.position.x, value.position.z);
    holder.position.set(value.position.x, correctedY, value.position.z);
    play.groundHeight = holder.position.y; play.lastPlatformY = null;
    playerVel.set(0, 0, 0);
    play.moveTarget = null;
    marker.visible = false;
  }
  remotePlayers.receive(value.players);
  refreshWorldStatus();
}
export async function prepareMultiplayer() {
  stopMultiplayer();
  if (TEST || !session.activeCharacterId) return;
  play.waveSequence = 0;
  const connection = new WorldConnection(session.activeCharacterId, {
    motion: () => ({ x: holder.position.x, z: holder.position.z, yaw: view.yaw, facing: holder.rotation.y,
      jump: Math.min(2.4, Math.max(0, holder.position.y - play.city.groundY(holder.position.x, holder.position.z))), wave: play.waveSequence }),
    receive: receiveWorld,
    stale: () => { remotePlayers.clear(); refreshWorldStatus(); },
    connection: (status) => {
      session.worldRetrying = status === 'retrying';
      setFoodRunning(!session.worldRetrying);
      refreshWorldStatus();
      if (session.worldRetrying) chatSystem(t('Conexión al mundo interrumpida. Reintentando…'));
    },
    replaced: () => {
      exitPlay();
      if (session.currentUser) void loadCharacterSelection(session.currentUser);
      toast('Sesión de juego cerrada', 'Tu cuenta ha entrado al mundo desde otra pestaña o equipo.', true);
    },
  });
  session.worldConnection = connection;
  const initial = await connection.join();
  if (session.worldConnection !== connection || !initial) throw new Error(t('La entrada al mundo se ha cancelado.'));
  receiveWorld(initial);
}
export function stopMultiplayer() {
  resetCombatActions();
  setFoodRunning(false);
  const connection = session.worldConnection;
  session.worldConnection = null;
  const stopped = connection?.stop();
  remotePlayers.clear();
  setCombatEncounter(null);
  fight.localCombatState = null;
  vitals.skillReadyAt = 0;
  setMapPlayerCount(null);
  return stopped;
}
/** Cierra y reanuda la conexión al ocultar o mostrar la página. */
export function installWorldClient() {
  window.addEventListener('pagehide', stopMultiplayer);
  window.addEventListener('pageshow', (event) => { if (event.persisted && play.mode === 'play') void returnToCharacters(); });
}

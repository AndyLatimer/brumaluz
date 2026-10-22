// El personaje del jugador: reconstrucción del modelo y contexto para descartar respuestas viejas del servidor.
import { session, play, ui } from './state';
import { Character } from '../character/character';
import { castShadows } from '../world/render';
import { holder, clock } from './stage';

export function characterContext() {
  const character = session.state;
  const characterId = session.activeCharacterId;
  const userId = session.currentUser?.id;
  const generation = play.playGeneration;
  const accountGeneration = session.accountSyncId;
  return () => session.state === character && session.activeCharacterId === characterId && session.currentUser?.id === userId && play.playGeneration === generation && session.accountSyncId === accountGeneration;
}
export function rebuildNow() {
  play.rebuildQueued = false;
  play.char?.dispose();
  play.char = new Character({ ...session.state }, { outfit: play.mode === 'create' && ui.tab === 'clase' });
  holder.add(play.char.root);
  castShadows(play.char.root);
  play.char.update(clock.getElapsedTime());
  if (play.pendingHop) play.char.hop();
  play.pendingHop = false;
}
/** Reconstruye como mucho una vez por fotograma (los deslizadores disparan mucho). */
export function rebuild(hop = false) {
  play.pendingHop ||= hop;
  if (!play.rebuildQueued) { play.rebuildQueued = true; requestAnimationFrame(rebuildNow); }
}

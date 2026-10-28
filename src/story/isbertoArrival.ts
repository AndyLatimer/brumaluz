// Isberto entra corriendo y frena al llegar junto al jugador.
import * as THREE from 'three';
import type { Character } from '../character/character';
import { closeDialog } from '../ui/dialog';
import { play, view, talk } from '../game/state';
import { t } from '../ui/i18n';
import { talkTo } from '../game/interaction';
import { setWindow, setGameMenuOpen, setPlayerMenuOpen, setWorldMenuOpen } from '../ui/menus';
import { setOptionsOpen } from '../ui/options';
import { keys, marker, playerVel, canvas, holder } from '../game/stage';
import { cinematic } from './scenes';

export const arrivalOverlay = document.createElement('div');
export function beginIsbertoArrival(character: Character, then: () => void = () => talkTo('isberto')) {
  // Cancelar antes de crear el nuevo trayecto: la limpieza anterior no debe borrarlo.
  cinematic.cancel();
  closeDialog();
  setWindow(null, false);
  setGameMenuOpen(false, false);
  setPlayerMenuOpen(false, false);
  setWorldMenuOpen(false, false);
  setOptionsOpen(false);
  keys.clear(); play.moveTarget = null; play.pendingTalk = null; marker.visible = false;
  playerVel.set(0, 0, 0);
  view.dragging = false; canvas.classList.remove('drag');
  const destination = character.root.position.clone();
  let bestPath = [destination];
  // Build a short reversible route from the meeting point, never across blocked terrain.
  for (const angle of [view.yaw + Math.PI / 2, view.yaw - Math.PI / 2, view.yaw, view.yaw + Math.PI, view.yaw + Math.PI / 4, view.yaw - Math.PI / 4]) {
    const path = [destination.clone()];
    for (let step = 0; step < 36; step++) {
      const from = path[path.length - 1];
      const next = from.clone().add(new THREE.Vector3(Math.sin(angle) * .25, 0, Math.cos(angle) * .25));
      next.y = play.city.groundY(next.x, next.z);
      const corrected = play.city.collide(from, next.clone());
      if (Math.hypot(corrected.x - next.x, corrected.z - next.z) > .05
        || Math.hypot(next.x - holder.position.x, next.z - holder.position.z) < 1) break;
      path.push(next);
    }
    if (path.length > bestPath.length) bestPath = path;
    if (path.length === 37) break;
  }
  if (bestPath.length < 2) {
    // Si el encuentro está encajonado, resolverlo junto al jugador sin mostrar errores de escena.
    character.root.visible = true;
    then();
    return;
  }
  const path = bestPath.reverse();
  character.root.position.copy(path.shift()!);
  character.root.visible = true;
  character.root.rotation.y = Math.atan2(path[0].x - character.root.position.x, path[0].z - character.root.position.z);
  talk.isbertoArrival = { character, path, then };
  character.setGait('run');
  character.root.userData.gait = 'run';
  talk.conversationActor = character.root;
  talk.conversationShot = '';
  talk.conversationOrbitYaw = 0; talk.conversationOrbitPitch = 0;
  talk.conversationSide = 1;
  arrivalOverlay.setAttribute('aria-label', t('Isberto se acerca…'));
  arrivalOverlay.hidden = false;
  document.body.classList.add('conversation-open');
  const generation = play.playGeneration;
  cinematic.play([{ id: 'isberto-arrival', duration: Math.max(2.6, path.length * .25 / 3 + .5), minimum: 1.5,
    update: () => !talk.isbertoArrival?.path.length }], () => {
    const next = talk.isbertoArrival?.then;
    endIsbertoArrival();
    if (generation === play.playGeneration && play.mode === 'play' && !play.dead) next?.();
  }, endIsbertoArrival);
}
export function endIsbertoArrival() {
  if (!talk.isbertoArrival) return;
  const destination = talk.isbertoArrival.path[talk.isbertoArrival.path.length - 1];
  if (destination) talk.isbertoArrival.character.root.position.copy(destination);
  talk.isbertoArrival.character.setGait('idle');
  talk.isbertoArrival.character.root.userData.gait = 'idle';
  const root = talk.isbertoArrival.character.root;
  root.rotation.y = Math.atan2(holder.position.x - root.position.x, holder.position.z - root.position.z);
  talk.isbertoArrival = null;
  talk.conversationActor = null;
  talk.returningFromConversation = true;
  arrivalOverlay.hidden = true;
  document.body.classList.remove('conversation-open');
}
export function updateIsbertoArrival(dt: number) {
  if (!talk.isbertoArrival) return;
  if (play.mode !== 'play' || play.dead) { endIsbertoArrival(); return; }
  const { character, path } = talk.isbertoArrival;
  const position = character.root.position;
  const destination = path[path.length - 1];
  const remaining = destination ? Math.hypot(destination.x - position.x, destination.z - position.z) : 0;
  const speed = remaining > 1.6 ? 4.2 : 2;
  const gait = path.length ? speed > 3 ? 'run' : 'walk' : 'idle';
  character.setGait(gait); character.root.userData.gait = gait;
  // Consumir el paso completo evita pequeños parones en cada punto del camino.
  let budget = dt * speed;
  while (path.length && budget > 0) {
    const target = path[0];
    const distance = Math.hypot(target.x - position.x, target.z - position.z);
    if (distance < .001) { path.shift(); continue; }
    const step = Math.min(distance, budget);
    const angle = Math.atan2(target.x - position.x, target.z - position.z);
    character.root.rotation.y += Math.atan2(Math.sin(angle - character.root.rotation.y), Math.cos(angle - character.root.rotation.y)) * Math.min(1, dt * 12);
    position.x += (target.x - position.x) * step / distance;
    position.z += (target.z - position.z) * step / distance;
    position.y = play.city.groundY(position.x, position.z);
    budget -= step;
    if (distance <= step + .001) path.shift();
  }
}
/** Rótulo de la llegada de Isberto. */
export function installArrivalOverlay() {
  arrivalOverlay.id = 'story-arrival';
  arrivalOverlay.hidden = true;
  arrivalOverlay.setAttribute('role', 'status');
  document.body.append(arrivalOverlay);
}

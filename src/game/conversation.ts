// Conversaciones con NPC: quién mira a quién y la cámara de diálogo que encuadra a ambos.
import * as THREE from 'three';
import { talk, story, session, play } from './state';
import { type Conversation, closeDialog, openConversation, isDialogOpen } from '../ui/dialog';
import { cinematic } from '../story/scenes';
import { holder, camera, playerVel, env, camTarget } from './stage';
import { npcActors } from './cities';
import { remotePlayers } from './worldClient';

export const conversationFacings = new Map<THREE.Object3D, number>();
/** Llegada de Isberto o cinemática en curso: el jugador no controla al personaje. */
export const storyLock = () => !!talk.isbertoArrival || cinematic.active || story.introFinishing || story.resting;
export const conversationPosition = new THREE.Vector3();
export const conversationRay = new THREE.Raycaster();
export function beginConversation(actor: THREE.Object3D, conversation: Conversation) {
  closeDialog();
  talk.conversationActor = actor;
  talk.conversationShot = '';
  talk.conversationOrbitYaw = 0; talk.conversationOrbitPitch = 0;
  conversationFacings.set(actor, actor.rotation.y);
  const direction = actor.position.clone().sub(holder.position);
  const side = new THREE.Vector3(direction.z, 0, -direction.x);
  talk.conversationSide = side.dot(camera.position.clone().sub(holder.position)) >= 0 ? 1 : -1;
  if (direction.lengthSq() > .01) {
    holder.rotation.y = Math.atan2(direction.x, direction.z);
    actor.rotation.y = holder.rotation.y + Math.PI;
  }
  playerVel.set(0, 0, 0);
  openConversation(conversation, () => {
    for (const [participant, facing] of conversationFacings) participant.rotation.y = facing;
    conversationFacings.clear();
    talk.conversationActor = null;
    talk.returningFromConversation = true;
  });
}
export function focusConversationSpeaker(speaker: string) {
  if (!talk.conversationActor || talk.isbertoArrival) return;
  const actor = speaker === session.registeredNpcs.gnomi.name ? story.welcomeWorld.root
    : npcActors.find(npc => story.NPCS[npc.id].name === speaker)?.character.root;
  if (!actor || !actor.visible || actor === talk.conversationActor) return;
  if (!conversationFacings.has(actor)) conversationFacings.set(actor, actor.rotation.y);
  talk.conversationActor = actor;
  talk.conversationShot = '';
}
export function updateConversationFacing(dt: number) {
  if (!talk.conversationActor || (!isDialogOpen() && !talk.isbertoArrival)) return;
  const direction = talk.conversationActor.position.clone().sub(holder.position);
  if (direction.lengthSq() < .01) return;
  const angle = Math.atan2(direction.x, direction.z);
  const blend = 1 - Math.exp(-dt * 10);
  holder.rotation.y += Math.atan2(Math.sin(angle - holder.rotation.y), Math.cos(angle - holder.rotation.y)) * blend;
  if (!talk.isbertoArrival) talk.conversationActor.rotation.y = angle + Math.PI;
}
export function updateConversationCamera(dt: number) {
  const actor = talk.conversationActor!;
  const dialogTop = talk.isbertoArrival ? innerHeight - 70 : document.getElementById('dialog')!.getBoundingClientRect().top;
  const sceneTop = 24;
  const sceneBottom = Math.max(sceneTop + 60, dialogTop - 16);
  const visibleHeight = sceneBottom - sceneTop;
  const target = holder.position.clone().add(actor.position).multiplyScalar(.5);
  target.y = Math.max(holder.position.y, actor.position.y) + 1;
  const direction = actor.position.clone().sub(holder.position).setY(0);
  if (direction.lengthSq() < .01) direction.set(0, 0, 1);
  direction.normalize();
  const side = new THREE.Vector3(direction.z, 0, -direction.x).multiplyScalar(talk.conversationSide);
  side.addScaledVector(direction, .25).normalize();
  const halfFov = THREE.MathUtils.degToRad(camera.fov * .5);
  const distance = Math.max(
    1.35 / Math.tan(halfFov) * window.innerHeight / visibleHeight,
    (holder.position.distanceTo(actor.position) * .5 + .8) / (Math.tan(halfFov) * camera.aspect),
  );
  const position = target.clone().addScaledVector(side, distance);
  position.y += distance * .18;
  position.y = Math.max(position.y, play.city.groundY(position.x, position.z) + .6);
  const shot = `${target.x}:${target.z}:${distance.toFixed(2)}`;
  if (shot !== talk.conversationShot) {
    talk.conversationShot = shot;
    play.city.root.updateWorldMatrix(true, true);
    talk.conversationObstacles = [
      ...env.cameraObstacles,
      ...play.city.root.children
        // Las ciudades del editor agrupan sus piezas en «map-objects» (por celdas del campo de visión):
        // se evalúan una a una para ignorar las baldosas.
        .flatMap(object => object.name === 'map-objects'
          ? object.children.flatMap(chunk => chunk.userData.mapChunk ? [...chunk.children, ...(chunk.userData.originals ?? [])] : [chunk]).filter(piece => !String(piece.userData.mapAsset ?? '').startsWith('city/hex_'))
          : [object])
        .filter(object => !object.name.startsWith('hex_') && object.name !== 'grass_tufts' && !object.name.startsWith('wildflower_') && object.name !== 'map-environment'),
      ...npcActors.filter(npc => npc.character.root !== actor).map(npc => npc.character.root),
      ...remotePlayers.list().map(player => player.root),
    ];
    for (const obstacle of talk.conversationObstacles) obstacle.updateWorldMatrix(true, true);
    let bestClearance = -1;
    findShot: for (const elevation of [.18, .65, 1]) {
      for (const angle of [0, Math.PI, Math.PI / 3, -Math.PI / 3, 2 * Math.PI / 3, -2 * Math.PI / 3, Math.PI / 2, -Math.PI / 2]) {
        const offset = side.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle).multiplyScalar(distance);
        offset.y = distance * elevation;
        const candidate = target.clone().add(offset);
        candidate.y = Math.max(candidate.y, play.city.groundY(candidate.x, candidate.z) + .6);
        let clearance = 1;
        for (const subject of [holder, actor]) {
          const shoulder = new THREE.Vector3(-offset.z, 0, offset.x).normalize();
          for (const [height, width] of [[.2, 0], [subject === story.welcomeWorld.root ? .4 : .8, -.3], [subject === story.welcomeWorld.root ? .4 : .8, .3], [subject === story.welcomeWorld.root ? .95 : 2.1, 0]]) {
            const origin = subject.position.clone().addScaledVector(shoulder, width);
            origin.y += height;
            const path = candidate.clone().sub(origin);
            conversationRay.set(origin, path.clone().normalize());
            conversationRay.far = path.length();
            const hit = conversationRay.intersectObjects(talk.conversationObstacles, true)[0];
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
  if (talk.conversationOrbitYaw || talk.conversationOrbitPitch) {
    const orbit = new THREE.Spherical().setFromVector3(position.clone().sub(target));
    orbit.theta += talk.conversationOrbitYaw;
    orbit.phi = THREE.MathUtils.clamp(orbit.phi + talk.conversationOrbitPitch, .18, Math.PI / 2 - .06);
    const offset = new THREE.Vector3().setFromSpherical(orbit);
    conversationRay.set(target, offset.clone().normalize());
    conversationRay.far = offset.length();
    const obstruction = conversationRay.intersectObjects(talk.conversationObstacles, true)[0];
    if (obstruction) offset.setLength(Math.max(.6, obstruction.distance - .3));
    position.copy(target).add(offset);
    position.y = Math.max(position.y, play.city.groundY(position.x, position.z) + .6);
  }
  const k = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1 - Math.exp(-dt * 8);
  camTarget.lerp(target, k);
  camera.position.lerp(position, k);
  camera.lookAt(camTarget);
  talk.conversationOffset += ((window.innerHeight - sceneTop - sceneBottom) * .5 - talk.conversationOffset) * k;
  camera.setViewOffset(window.innerWidth, window.innerHeight, 0, talk.conversationOffset, window.innerWidth, window.innerHeight);
}

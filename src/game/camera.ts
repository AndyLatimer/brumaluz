// Cámara de exploración: seguimiento del personaje, paredes que no tapan y sacudidas.
import * as THREE from 'three';
import { talk, view, play, vitals } from './state';
import { isDialogOpen } from '../ui/dialog';
import { cinematic } from '../story/scenes';
import { camera, camTarget, tmp, holder, playerVel, camPos, clock } from './stage';
import { updateConversationCamera } from './conversation';
import { $ } from '../ui/dom';

export function updatePlayCamera(dt: number) {
  const shot = cinematic.active ? cinematic.frame(dt) : null;
  if (shot) {
    camera.clearViewOffset(); talk.conversationOffset = 0;
    camera.position.copy(shot.position);
    camTarget.copy(shot.target);
    camera.lookAt(camTarget);
    talk.returningFromConversation = true;
    return;
  }
  if (talk.conversationActor && (isDialogOpen() || talk.isbertoArrival)) { updateConversationCamera(dt); return; }
  // el objetivo se adelanta un poco en la dirección de marcha y la cámara lo sigue con holgura
  const target = tmp.copy(holder.position).add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(playerVel, 0.12);
  const k = 1 - Math.exp(-dt * 5);
  camTarget.lerp(target, k);
  view.followDist += (view.zoomTarget - view.followDist) * (1 - Math.exp(-dt * 8));
  const off = new THREE.Vector3(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch)).multiplyScalar(view.followDist);
  camPos.copy(camTarget).add(off);
  camPos.y = Math.max(camPos.y, play.city.groundY(camPos.x, camPos.z) + 0.6);
  // Ni bajo el agua: la cámara se queda siempre por encima de la superficie.
  const cameraWater = play.city.waterAt?.(camPos.x, camPos.z);
  if (cameraWater) camPos.y = Math.max(camPos.y, cameraWater.surface + 0.5);
  if (talk.returningFromConversation) {
    const blend = 1 - Math.exp(-dt * 8);
    camera.position.lerp(camPos, blend);
    talk.conversationOffset *= 1 - blend;
    camera.setViewOffset(window.innerWidth, window.innerHeight, 0, talk.conversationOffset, window.innerWidth, window.innerHeight);
    if (camera.position.distanceTo(camPos) < .02 && Math.abs(talk.conversationOffset) < .1) {
      talk.returningFromConversation = false;
      talk.conversationOffset = 0;
      camera.clearViewOffset();
    }
  } else camera.position.copy(camPos);
  camera.lookAt(camTarget);
}
export const OCCLUSION_RING = 6, OCCLUSION_RING_RADIUS = 2.2;
export const occlusionPoints = Array.from({ length: 5 + OCCLUSION_RING }, () => new THREE.Vector3());
/**
 * Pies, pecho, cabeza y ambos lados del pecho del personaje, más un anillo a ras de suelo a su alrededor:
 * si algo tapa cualquiera de ellos, se atenúa (así también se ve dónde pisa, p. ej. tras una pared).
 */
export function occlusionTargets() {
  const [feet, chest, head, left, right] = occlusionPoints;
  const p = cinematic.scriptedCamera ? cinematic.focus : holder.position;
  feet.set(p.x, p.y + .35, p.z); chest.set(p.x, p.y + 1, p.z); head.set(p.x, p.y + 1.7, p.z);
  const sideX = camera.position.z - p.z, sideZ = p.x - camera.position.x, length = Math.hypot(sideX, sideZ) || 1;
  left.set(p.x + sideX / length * .45, p.y + 1, p.z + sideZ / length * .45);
  right.set(p.x - sideX / length * .45, p.y + 1, p.z - sideZ / length * .45);
  for (let i = 0; i < OCCLUSION_RING; i++) {
    const angle = i / OCCLUSION_RING * Math.PI * 2, x = p.x + Math.cos(angle) * OCCLUSION_RING_RADIUS, z = p.z + Math.sin(angle) * OCCLUSION_RING_RADIUS;
    occlusionPoints[5 + i].set(x, play.city.groundY(x, z) + .6, z);
  }
  return occlusionPoints;
}
export function updateCamera(dt: number) {
  if (play.mode === 'play') return updatePlayCamera(dt);
  const head = play.char.headWorld(tmp);
  const mobile = window.innerWidth <= 760;
  let ty: number, dist: number;
  if (view.focus === 'face') { ty = head.y - 0.06; dist = 2.6; }
  else { ty = head.y * 0.5; dist = 3.6 + head.y * 1.3; }
  if (mobile) { dist *= view.focus === 'face' ? 1.5 : 1.75; ty += view.focus === 'face' ? 0.02 : 0.15; }
  dist *= view.zoom;
  const k = 1 - Math.exp(-dt * 4);
  camTarget.y += (ty - camTarget.y) * k;
  view.camDist += (dist - view.camDist) * k;
  camTarget.x = holder.position.x; camTarget.z = holder.position.z;
  const cy = play.city.spawnYaw;
  camera.position.set(holder.position.x + Math.sin(cy) * view.camDist, camTarget.y + view.camDist * 0.08, holder.position.z + Math.cos(cy) * view.camDist);
  camera.lookAt(camTarget);
}
/** Quita al instante los efectos de pantalla temporales (flotantes, destellos, viñetas, cartel de nivel). */
export function clearScreenEffects() {
  document.querySelectorAll('.damage-float, .heal-spark').forEach((el) => el.remove());
  for (const id of ['damage-vignette', 'heal-vignette', 'xp-vignette', 'levelup-flash']) $(`#${id}`).classList.remove('hit');
  $('#levelup-banner').classList.remove('show');
  $('#low-health-vignette').classList.remove('on');
  window.clearTimeout(vitals.xpSettle);
}
export function applyCameraShake() {
  const left = view.shakeUntil - clock.getElapsedTime();
  if (left <= 0) return;
  const k = left / 0.35, t = clock.getElapsedTime() * 70;
  camera.position.x += Math.sin(t) * 0.07 * k;
  camera.position.y += Math.cos(t * 1.3) * 0.07 * k;
}

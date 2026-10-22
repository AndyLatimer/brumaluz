// Movimiento del personaje en cada fotograma: teclado, clic, saltos, agua y plataformas.
import * as THREE from 'three';
import { play, story, fight, view, session } from './state';
import { COMBAT_KITS } from '../data/combat';
import { storyLock } from './conversation';
import { keys, playerVel, marker, holder, waterFx, clock } from './stage';
import { isbertoVisible } from '../story/quests';
import { npcActors } from './cities';
import { TALK_RANGE, talkTo } from './interaction';

export function updatePlay(dt: number) {
  if (storyLock()) {
    keys.clear(); playerVel.set(0, 0, 0); play.moveTarget = null; marker.visible = false;
    if (!story.playerScript) play.char.setGait('idle');
    return;
  }
  if (play.dead) { keys.clear(); play.moveTarget = null; marker.visible = false; }
  if (play.pendingTalk === 'isberto' && !isbertoVisible()) play.pendingTalk = null;
  if (play.pendingTalk) {
    const npc = npcActors.find((n) => n.id === play.pendingTalk);
    const position = play.pendingTalk === 'gnomi' && story.welcomeWorld.root.visible ? story.welcomeWorld.root.position : npc?.character.root.position;
    if (!position || !play.moveTarget || play.dead) play.pendingTalk = null;
    else if (Math.hypot(position.x - holder.position.x, position.z - holder.position.z) <= TALK_RANGE) talkTo(play.pendingTalk);
  }
  const input = new THREE.Vector2(
    (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0),
  );
  // Movimiento relativo a la cámara: W va hacia donde mira la cámara, A/D van a los lados
  const dir = new THREE.Vector3();
  let clickMoving = false;
  if (input.lengthSq() > 0) {
    fight.combatApproach=false;fight.pendingCombatSkill=false;
    play.moveTarget = null;
    marker.visible = false;
    const fx = -Math.sin(view.yaw), fz = -Math.cos(view.yaw);
    dir.set(fx * -input.y + -fz * input.x, 0, fz * -input.y + fx * input.x).normalize();
  } else if (play.moveTarget) {
    dir.set(play.moveTarget.x - holder.position.x, 0, play.moveTarget.z - holder.position.z);
    if (dir.length() < 0.25) { play.moveTarget = null; marker.visible = false; dir.set(0, 0, 0); } else { dir.normalize(); clickMoving = true; }
  } else if(fight.combatAuto&&fight.combatApproach&&fight.combatTargetRoot&&fight.combatEncounter?.status==='active'){
    const range=COMBAT_KITS[session.state.cls].range;
    const dx=fight.combatTargetRoot.position.x-holder.position.x,dz=fight.combatTargetRoot.position.z-holder.position.z;
    if(Math.hypot(dx,dz)>range-.1){dir.set(dx,0,dz).normalize();clickMoving=true;}
  }
  if (!view.dragging && clickMoving && !fight.lockedEnemy) {
    // al ir con clic la cámara se recoloca poco a poco tras el personaje
    let back = Math.atan2(-dir.x, -dir.z) - view.yaw;
    back = Math.atan2(Math.sin(back), Math.cos(back));
    view.yaw += back * (1 - Math.exp(-dt * 1.5));
  }

  // aceleración y frenada suaves
  // En el agua se va más despacio: vadeando un poco, nadando bastante (sin «correr»).
  const water = play.mode === 'play' ? play.city.waterAt?.(holder.position.x, holder.position.z) ?? null : null;
  const waterPace = water?.deep ? 0.5 : water ? 0.75 : 1;
  const maxSpeed = dir.lengthSq() ? (play.running ? 6.2 : 2.4) * waterPace : 0;
  const wantVel = dir.clone().multiplyScalar(maxSpeed);
  playerVel.lerp(wantVel, 1 - Math.exp(-dt * (maxSpeed > 0 ? 9 : 11)));
  const speed = playerVel.length();
  if (speed < 0.05) playerVel.set(0, 0, 0);
  play.char.setGait(speed < 0.35 ? 'idle' : speed > 4 ? 'run' : 'walk');
  if (speed >= 0.05) {
    const from = holder.position.clone();
    const to = from.clone().addScaledVector(playerVel, dt);
    const p = play.city.collide(from, to);
    if (play.moveTarget && p.distanceTo(to) > speed * dt * 0.7) { play.moveTarget = null; marker.visible = false; }
    holder.position.x = p.x; holder.position.z = p.z;
    if (speed > 0.35) {
      const want = Math.atan2(playerVel.x, playerVel.z);
      let d = want - holder.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      holder.rotation.y += d * (1 - Math.exp(-dt * 12));
    }
  }
  const wasJumping = play.jumpDuration > 0 && play.jumpElapsed < play.jumpDuration;
  const previousJumpHeight = play.jumpHeight;
  const previousFootY = holder.position.y;
  if (wasJumping) {
    play.jumpElapsed = Math.min(play.jumpElapsed + dt, play.jumpDuration);
    const jumpProgress = play.jumpElapsed / play.jumpDuration;
    play.jumpHeight = 4 * jumpProgress * (1 - jumpProgress) * 1.15; // arco más alto, con caída continua
  } else {
    play.jumpElapsed = play.jumpDuration;
    play.jumpHeight = 0;
  }
  const platform = play.city.platformY(holder.position.x, holder.position.z);
  let supportY = play.city.groundY(holder.position.x, holder.position.z);
  // Nadando, el personaje queda a la altura de la superficie (la postura lo hunde hasta los hombros).
  const swimming = !!water?.deep && !play.dead;
  play.char.setSwimming(swimming);
  if (swimming) supportY = Math.max(supportY, water!.surface);
  waterFx.track('me', holder.position, water, playerVel.length(), dt);
  // Se sube a una superficie cercana a los pies, y se sigue sobre ella mientras no dé un salto brusco (rampas, escaleras).
  const onPlatform = platform !== null && (Math.abs(platform - play.groundHeight) < 0.22 || (play.lastPlatformY !== null && Math.abs(platform - play.lastPlatformY) < 0.35));
  if (onPlatform) supportY = platform;
  if (onPlatform && play.lastPlatformY !== null) play.groundHeight = supportY;
  else play.groundHeight += (supportY - play.groundHeight) * (1 - Math.exp(-dt * 12));
  play.lastPlatformY = onPlatform ? platform : null;
  if (wasJumping && play.jumpHeight < previousJumpHeight && platform !== null
    && previousFootY >= platform && play.groundHeight + play.jumpHeight <= platform) {
    play.groundHeight = platform;
    play.jumpElapsed = play.jumpDuration;
    play.jumpHeight = 0;
  }
  holder.position.y = play.groundHeight + play.jumpHeight;
  if (marker.visible) marker.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 6) * 0.1);
}

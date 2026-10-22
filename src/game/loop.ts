// Bucle de la partida: cada fotograma mueve, anima, actualiza la interfaz y dibuja.

import * as THREE from 'three';
import { worldHour } from '../data/worldClock';
import { beginIsbertoArrival, updateIsbertoArrival } from '../story/isbertoArrival';
import { isbertoVisible, updateWelcome, updatePersonalWaypoint } from '../story/quests';
import { isbertoSpot, playMonsterReveal, updateStory, cinematic } from '../story/scenes';
import { isDialogOpen } from '../ui/dialog';
import { setWindow } from '../ui/menus';
import { updateMinimap } from '../ui/minimap';
import { GOLDEN_HOUR } from '../world/dayNight';
import { publishedMaps } from '../world/mapCity';
import { world } from '../world/paint';
import { settings } from './audio';
import { updateCamera, occlusionTargets, applyCameraShake } from './camera';
import { npcActors, updatePortals } from './cities';
import { tickWorldCombat, positionLootWindow } from './combat';
import { storyLock, updateConversationFacing } from './conversation';
import { updateNameplate } from './hud';
import { updateInteractPrompt } from './interaction';
import { nearBank } from './inventory';
import { updatePlay } from './movement';
import { renderer, graphics, clock, holder, waterFx, dayNight, env, stage, camera, TEST, scene } from './stage';
import { play, view, story, talk, ui, session } from './state';
import { updateTargetFrame } from './targets';
import { tickOverheal, tickFood } from './vitals';
import { remotePlayers } from './worldClient';

/** Arranca el bucle de render (una vez, al terminar de cargar). */
export function startGameLoop() {
  renderer.setAnimationLoop(() => {
    if (graphics.failed) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(t - play.last, 0.05);
    play.last = t;
    world.uTime.value = t;
    if (play.mode === 'play' && !play.mapTravelling) { updatePlay(dt); tickWorldCombat(t,dt); tickOverheal(); tickFood(); }
    else if (!view.dragging) {
      holder.rotation.y += view.spinVel;
      view.spinVel *= 0.92;
    }
    play.char.update(t);
    const isberto = npcActors.find(npc => npc.id === 'isberto');
    if (isberto) {
      const site = story.isbertoGuide || talk.isbertoArrival ? null : isbertoSpot();
      const positionKey = site ? `${play.city.locationId}:${site.x}:${site.z}` : '';
      if (site && positionKey !== story.isbertoPositionKey) {
        story.isbertoPositionKey = positionKey;
        const destination = new THREE.Vector3(site.x, play.city.groundY(site.x, site.z), site.z);
        isberto.character.root.position.copy(play.city.collide(destination, destination.clone()));
        isberto.character.root.position.y = play.city.groundY(isberto.character.root.position.x, isberto.character.root.position.z);
      }
      if (talk.pendingIsbertoIntroduction && play.mode === 'play' && !play.dead && !play.actionBusy && !isDialogOpen() && !storyLock()) {
        talk.pendingIsbertoIntroduction = false;
        beginIsbertoArrival(isberto.character, playMonsterReveal);
      }
    }
    updateIsbertoArrival(dt);
    updateStory(dt, t);
    updateConversationFacing(dt);
    for (const npc of npcActors) {
      if (npc.id === 'isberto') npc.character.root.visible = isbertoVisible();
      npc.character.update(t);
    }
    // En las cinemáticas se dibuja lo que mira la cámara, aunque quede lejos del personaje.
    play.city.update(t, play.mode === 'play' ? cinematic.scriptedCamera ? cinematic.focus : holder.position : undefined);
    waterFx.update(dt);
    // Salpicaduras y ondas al pie de las cascadas cercanas.
    play.fallTimer -= dt;
    if (play.fallTimer <= 0 && play.city.waterFalls?.length) {
      play.fallTimer = 0.18;
      for (const fall of play.city.waterFalls) {
        if (Math.hypot(fall.x - holder.position.x, fall.z - holder.position.z) > 45) continue;
        const along = (Math.random() - 0.5) * fall.width * 0.8;
        waterFx.ripple(fall.x + along * 0.3, fall.y, fall.z + along * 0.3, 1 + fall.drop * 0.6, 1.2);
        if (Math.random() < 0.35) waterFx.splash(fall.x, fall.y, fall.z, 0.3 + fall.drop * 0.15);
      }
    }
    if (play.city.locationId !== play.skyLocation) {
      play.skyLocation = play.city.locationId; play.skyIndoor = publishedMaps()[play.skyLocation]?.kind === 'interior';
      dayNight.setWindows(play.city.skyWindows ?? []);
      env.setFireflies(!play.skyIndoor && (play.city.fireflies ?? true));
    }
    dayNight.update(play.mode === 'play' ? worldHour() : GOLDEN_HOUR, play.mode === 'play' && play.skyIndoor);
    env.update(t, play.mode === 'play' ? holder.position : undefined, play.city.groundY);
    stage.follow(cinematic.scriptedCamera ? cinematic.focus : holder.position, play.mode === 'play');
    updateCamera(dt);
    // Cámara sin estorbos: en los interiores, las paredes entre la cámara y el personaje se vuelven transparentes.
    play.city.fadeOccluders?.(camera.position, play.mode === 'play' ? occlusionTargets() : [], dt);
    dayNight.follow(camera.position);
    if (ui.openWindow === 'loot') positionLootWindow();
    updateWelcome(dt, t);
    updatePersonalWaypoint();
    story.coinBags.update(session.state.coinBags, play.mode === 'play' && play.city.locationId === 'brumaluz', t);
    updatePortals();
    applyCameraShake();
    updateNameplate();
    if (play.mode === 'play') remotePlayers.update(t, dt, camera, settings.nameplates);
    updateInteractPrompt();
    updateTargetFrame();
    if (play.mode === 'play') updateMinimap();
    if (play.mode === 'play') ui.updateZoneMap?.();
    if (ui.openWindow === 'bank' && (play.mode !== 'play' || play.dead || !nearBank())) setWindow(null);
    try {
      if (TEST) renderer.render(scene, camera); else stage.render();
    } catch (error) {
      graphics.fail('No se pudo dibujar el mundo 3D. Prueba el modo compatible.', error);
    }
  });
}

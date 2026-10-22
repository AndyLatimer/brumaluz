// Gancho de depuración para pruebas desde la consola.

import { CharData, sanitize } from '../data/data';
import { refreshUI, selectTab } from '../ui/creator';
import { rebuildNow } from './avatar';
import { updateHud } from './hud';
import { enterPlay } from './playSession';
import { holder, playerVel, marker, camera, renderer, scene, stage } from './stage';
import { session, play, view } from './state';
import { remotePlayers } from './worldClient';

/** Expone `window.brumaluz` para las pruebas y la consola. */
export function installDebugHook() {
  (window as unknown as { brumaluz: object }).brumaluz = {
    set(d: Partial<CharData>) { session.state = sanitize({ ...session.state, ...d } as unknown as Record<string, unknown>); rebuildNow(); refreshUI(); updateHud(); },
    tab: selectTab,
    wave() { play.char.wave(); play.waveSequence++; },
    speak(s: number) { play.char.speak(s); },
    play: () => enterPlay(),
    spin(a: number) { holder.rotation.y = a; view.spinVel = 0; },
    move(x: number, z: number) {
      holder.position.set(x, play.city ? play.city.groundY(x, z) : 0, z);
      play.groundHeight = holder.position.y; play.lastPlatformY = null;
      playerVel.set(0, 0, 0);
      play.moveTarget = null;
      marker.visible = false;
      if (session.state) {
        session.state.position = { ...session.state.position, x, z, yaw: view.yaw };
      }
    },
    view(y: number, p: number, d: number) { view.yaw = y; view.pitch = p; view.followDist = d; view.zoomTarget = d; },
    char: () => play.char,
    camera: () => camera,
    city: () => play.city,
    /** Para medir el rendimiento desde las pruebas. */
    debug: () => ({ renderer, scene, stage, camera }),
    players: () => remotePlayers.list(),
    time() { const t0 = performance.now(); rebuildNow(); return performance.now() - t0; },
  };
}

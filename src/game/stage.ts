// Escena 3D compartida: lienzo, renderizador, cámara, entorno y los objetos que mueve el jugador.
import * as THREE from 'three';
import { createGraphics } from '../world/graphics';
import { buildEnv } from '../world/env';
import { setupStage } from '../world/render';
import { buildDayNight } from '../world/dayNight';
import { WaterFx } from '../world/waterFx';
import { play } from './state';
import { COMBAT_SITE } from '../world/city';
import { createCreatorStage } from '../world/creatorStage';

// ---------------- Render ----------------
export const canvas = document.getElementById('scene') as HTMLCanvasElement;
export const graphics = createGraphics(canvas);
export const renderer = graphics.renderer;
graphics.resize(window.innerWidth, window.innerHeight);
export const scene = new THREE.Scene();
// La escena no se mueve: si recalculara su matriz cada fotograma, three.js recalcularía también la de todo lo que contiene.
scene.matrixAutoUpdate = false;
export const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 900);
export const env = buildEnv(scene);
export const lowEnd = graphics.compatible || window.innerWidth <= 760 || /Mobi|Android/i.test(navigator.userAgent);
export const stage = (() => {
  try {
    return setupStage(renderer, scene, camera, lowEnd, graphics.compatible);
  } catch (error) {
    graphics.fail('No se pudo dibujar el mundo 3D. Prueba el modo compatible.', error);
    throw error;
  }
})();
// Cielo y luces según la hora del mundo; interiores con vacío negro y cielo solo en las ventanas.
export const dayNight = buildDayNight(renderer, scene, stage, !graphics.compatible);
// Ondas y salpicaduras al nadar o vadear (las del jugador y las de los demás).
export const waterFx = new WaterFx();
scene.add(waterFx.root);
export const holder = new THREE.Group();
export const creatorStage = createCreatorStage(scene);
holder.rotation.y = -0.3;
scene.add(holder);
export const camTarget = new THREE.Vector3(0, 1, 0);
export const tmp = new THREE.Vector3();
export function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  graphics.resize(w, h);
  stage.resize(w, h);
  camera.aspect = w / h;
  if (play.mode === 'play') {
    camera.clearViewOffset();
  } else {
    const panel = document.getElementById('panel')!.getBoundingClientRect();
    const mobile = w <= 760;
    const ox = mobile ? 0 : -(panel.right + 12) / 2;
    const previewTop = Math.min(136, h * .18);
    const oy = mobile ? (h - panel.top - previewTop) / 2 : 0;
    camera.setViewOffset(w, h, ox, oy, w, h);
  }
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', layout);
export const camPos = new THREE.Vector3();
export const playerVel = new THREE.Vector3();
// ---------------- Exploración ----------------
export const keys = new Set<string>();
export const marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.38, 32), new THREE.MeshBasicMaterial({ color: '#ffe2a0', transparent: true, opacity: 0.85, depthWrite: false }));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);
export const ray = new THREE.Raycaster();
// ---------------- Bucle ----------------
/** ?test: sin ciudad ni posproceso, para revisar personajes rápido (capturas automáticas). */
export const TEST = new URLSearchParams(location.search).has('test');
export const LOCAL_COMBAT_SITE = TEST && !new URLSearchParams(location.search).has('welcome') ? { x: 0, z: -6 } : COMBAT_SITE;
export const clock = new THREE.Clock();

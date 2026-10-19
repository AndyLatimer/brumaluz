import * as THREE from 'three';
import type { City, Interactable } from './city';
import { WELCOME_START, WELCOME_BADGE, type WelcomeProgress } from '../data/quests';
import { Character } from '../character/character';
import { defaultChar } from '../data/data';

/** Personal actors: never added to shared world presence or NPC spawn tables. */
export function createWelcomeWorld(scene: THREE.Scene, city: City) {
  const root = new THREE.Group();
  root.name = 'gnomi-personal';
  root.visible = false;
  root.position.set(WELCOME_START.x, city.groundY(WELCOME_START.x, WELCOME_START.z), WELCOME_START.z);
  scene.add(root);
  const character = new Character({
    ...defaultChar(), name: 'Gnomi', race: 'humano', sex: 0,
    face: 0, hair: 0, hairColor: 6, beard: 1, eyeShape: 4, eyeColor: 2,
    brows: 0, nose: 5, mouth: 0, detail: 1, height: .25, build: .7,
    clothA: 1, clothB: 5,
  }, { outfit: false, wardrobe: 'helpers', proportions: { width: 1.06, height: .92 } });
  const body = new THREE.Group();
  body.name = 'gnomi-rig';
  body.scale.setScalar(.48);
  body.add(character.root);
  root.add(body);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function part(geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, parent = root) {
    let material = materials.get(color);
    if (!material) { material = new THREE.MeshStandardMaterial({ color, roughness: .86 }); materials.set(color, material); }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const badgeMount = new THREE.Group();
  badgeMount.position.set(-.16, .06, .27);
  character.attachToChest(badgeMount);
  const badge = part(new THREE.CircleGeometry(.09, 24), '#e4be68', 0, 0, .015, badgeMount);
  badge.name = 'gnomi-worn-badge';
  part(new THREE.TorusGeometry(.055, .014, 8, 20), '#cab080', 0, .025, .01, badgeMount);
  const lost = new THREE.Group();
  lost.name = 'gnomi-lost-badge';
  part(new THREE.CylinderGeometry(.14, .14, .035, 8), '#d5a950', 0, .06, 0, lost);
  part(new THREE.TorusGeometry(.05, .012, 5, 10), '#f2d789', 0, .085, 0, lost).rotation.x = Math.PI / 2;
  scene.add(lost);
  lost.visible = false;
  lost.position.set(WELCOME_BADGE.x, city.groundY(WELCOME_BADGE.x, WELCOME_BADGE.z), WELCOME_BADGE.z);
  const interaction: Interactable = { id: 'welcome:gnomi', position: root.position, radius: 2.6, label: 'Hablar con Gnomi' };
  const pickup: Interactable = { id: 'welcome:badge', position: lost.position, radius: 2.5, label: 'Recoger distintivo' };
  let lastStage = '';
  let trail: THREE.Vector3[] = [];
  const sample = new THREE.Vector3();
  const destination = new THREE.Vector3();
  let gait: 'idle' | 'walk' | 'run' = 'idle';
  let movingUntil = 0;
  function rejoin(player: THREE.Vector3) {
    destination.copy(player).add(new THREE.Vector3(1.25, 0, .65));
    root.position.copy(city.collide(player, destination));
    trail = []; sample.copy(player);
  }
  function update(progress: WelcomeProgress | null, playing: boolean, player: THREE.Vector3, dt: number, time: number, talking = false) {
    root.visible = playing;
    lost.visible = root.visible && progress?.stage === 'active';
    if (!root.visible) { lastStage = ''; trail = []; return; }
    if (!progress) {
      root.position.set(WELCOME_START.x, city.groundY(WELCOME_START.x, WELCOME_START.z), WELCOME_START.z);
      if (player.distanceTo(root.position) < 4) root.rotation.y = Math.atan2(player.x - root.position.x, player.z - root.position.z);
      gait = 'idle'; movingUntil = 0;
      root.userData.gait = gait;
      character.setGait(gait);
      character.update(time);
      lastStage = '';
      trail = [];
      return;
    }
    const following = progress.stage === 'active' || progress.stage === 'found' || progress.stage === 'completed';
    const wasFollowing = lastStage === 'active' || lastStage === 'found' || lastStage === 'completed';
    badge.visible = progress.stage === 'completed';
    if (progress.stage === 'completed' && lastStage !== 'completed' && !badge.userData.returned) {
      badge.userData.returned = true;
      character.hop();
      character.speak(6);
    }
    if (progress.stage !== 'completed') badge.userData.returned = false;
    if (lastStage !== progress.stage && !(talking && progress.stage === 'completed')) {
      if (!following) root.position.set(WELCOME_START.x, city.groundY(WELCOME_START.x, WELCOME_START.z), WELCOME_START.z);
      if (following && !wasFollowing) {
        if (lastStage === '' || root.position.distanceTo(player) < .8) rejoin(player);
        trail = []; sample.copy(player);
      }
      lastStage = progress.stage;
    }
    let moving = false;
    let speed = 0;
    if (following && !talking) {
      if (sample.distanceToSquared(player) > .16) {
        trail.push(player.clone()); sample.copy(player);
        if (trail.length > 400) trail.shift();
      }
      if (root.position.distanceTo(player) > 20) {
        rejoin(player);
      }
      // Consume reached waypoints without resetting the gait between consecutive trail segments.
      while (trail.length && root.position.distanceTo(trail[0]) < .35) trail.shift();
      const target = trail[0];
      if (target && (trail.length > 3 || root.position.distanceTo(player) > 2)) {
        destination.copy(target).sub(root.position); destination.y = 0;
        const distance = destination.length();
        if (distance >= .35 && dt > 0) {
          speed = root.position.distanceTo(player) > 4 ? 5 : 2.6;
          destination.multiplyScalar(Math.min(distance, dt * speed) / distance).add(root.position);
          const corrected = city.collide(root.position, destination);
          moving = dt > 0 && corrected.distanceToSquared(root.position) > .00001;
          if (moving) {
            const angle = Math.atan2(corrected.x - root.position.x, corrected.z - root.position.z);
            root.rotation.y += Math.atan2(Math.sin(angle - root.rotation.y), Math.cos(angle - root.rotation.y)) * Math.min(1, dt * 12);
          }
          root.position.copy(corrected);
        }
      }
    }
    root.position.y = city.groundY(root.position.x, root.position.z);
    if (!moving && player.distanceTo(root.position) < 4) root.rotation.y = Math.atan2(player.x - root.position.x, player.z - root.position.z);
    if (moving) { movingUntil = time + .18; gait = speed > 3 ? 'run' : 'walk'; }
    if (dt <= 0 || talking || (!moving && time >= movingUntil)) gait = 'idle';
    root.userData.gait = gait;
    character.setGait(gait);
    character.update(time);
    lost.rotation.y = time * .4;
  }
  return {
    root, lost, update,
    speak: (seconds: number) => character.speak(seconds),
    greet: () => character.wave(),
    interactions: () => root.visible ? lost.visible ? [interaction, pickup] : [interaction] : [],
    dispose() {
      root.removeFromParent(); lost.removeFromParent();
      badgeMount.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      character.dispose();
      for (const group of [root, lost]) group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      materials.forEach(material => material.dispose());
    },
  };
}

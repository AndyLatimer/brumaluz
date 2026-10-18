import * as THREE from 'three';
import type { City, Interactable } from './city';
import { WELCOME_START, WELCOME_BADGE, type WelcomeProgress } from '../data/quests';

/** Personal actors: never added to shared world presence or NPC spawn tables. */
export function createWelcomeWorld(scene: THREE.Scene, city: City) {
  const root = new THREE.Group();
  root.name = 'gnomi-personal';
  root.visible = false;
  scene.add(root);
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
  const ball = (r: number) => new THREE.SphereGeometry(r, 14, 10);
  part(new THREE.CylinderGeometry(.19, .25, .4, 12), '#356caa', 0, .47, 0);
  part(ball(.23), '#efbe98', 0, .84, 0);
  part(ball(.075), '#e6a27e', 0, .82, .23);
  for (const x of [-.085, .085]) {
    part(ball(.035), '#fff5de', x, .89, .201);
    part(ball(.018), '#302c26', x, .885, .23);
  }
  const hat = part(new THREE.ConeGeometry(.255, .5, 16), '#b53a39', .025, 1.22, 0);
  hat.rotation.z = -.12;
  part(new THREE.CylinderGeometry(.25, .25, .06, 16), '#96302e', 0, .99, 0);
  const beard = part(new THREE.ConeGeometry(.14, .18, 12), '#eadbc5', 0, .68, .16);
  beard.rotation.x = Math.PI;
  part(new THREE.CylinderGeometry(.235, .24, .055, 12), '#704b32', 0, .36, 0);
  part(new THREE.BoxGeometry(.09, .08, .025), '#d8b66b', 0, .36, .24);
  const badge = part(new THREE.CircleGeometry(.055, 8), '#e4be68', -.1, .55, .212);
  const legs = [-.12, .12].map(x => {
    const leg = new THREE.Group(); leg.position.set(x, .28, 0); root.add(leg);
    part(new THREE.CylinderGeometry(.07, .07, .18, 8), '#445e80', 0, -.07, 0, leg);
    part(new THREE.BoxGeometry(.14, .09, .22), '#5a4030', 0, -.205, .035, leg);
    return leg;
  });
  const arms = [-1, 1].map(side => {
    const arm = new THREE.Group(); arm.position.set(side * .23, .62, 0); root.add(arm);
    part(new THREE.CylinderGeometry(.065, .065, .24, 8), '#356caa', 0, -.1, 0, arm);
    part(ball(.067), '#efbe98', 0, -.24, 0, arm);
    arm.rotation.z = side * .13;
    return arm;
  });
  // The little empty badge loop remains visible until the returned insignia is worn.
  part(new THREE.TorusGeometry(.047, .011, 5, 10), '#cab080', -.1, .55, .216);
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
  function rejoin(player: THREE.Vector3) {
    destination.copy(player).add(new THREE.Vector3(1.25, 0, .65));
    root.position.copy(city.collide(player, destination));
    trail = []; sample.copy(player);
  }
  function update(progress: WelcomeProgress | null, playing: boolean, player: THREE.Vector3, dt: number, time: number) {
    root.visible = playing && progress !== null;
    lost.visible = root.visible && progress?.stage === 'active';
    if (!root.visible || !progress) { lastStage = ''; trail = []; return; }
    const following = progress.stage === 'active' || progress.stage === 'found';
    const wasFollowing = lastStage === 'active' || lastStage === 'found';
    badge.visible = progress.stage === 'completed';
    if (lastStage !== progress.stage) {
      if (!following) root.position.set(WELCOME_START.x, city.groundY(WELCOME_START.x, WELCOME_START.z), WELCOME_START.z);
      if (following && !wasFollowing) {
        if (lastStage === '' || root.position.distanceTo(player) < .8) rejoin(player);
        trail = []; sample.copy(player);
      }
      lastStage = progress.stage;
    }
    let moving = false;
    if (following) {
      if (sample.distanceToSquared(player) > .16) {
        trail.push(player.clone()); sample.copy(player);
        if (trail.length > 400) trail.shift();
      }
      if (root.position.distanceTo(player) > 20) {
        rejoin(player);
      }
      const target = trail[0];
      if (target && (trail.length > 3 || root.position.distanceTo(player) > 2)) {
        destination.copy(target).sub(root.position); destination.y = 0;
        const distance = destination.length();
        if (distance < .35) trail.shift();
        else {
          destination.multiplyScalar(Math.min(distance, dt * 5) / distance).add(root.position);
          const corrected = city.collide(root.position, destination);
          moving = corrected.distanceToSquared(root.position) > .00001;
          root.rotation.y = Math.atan2(destination.x - root.position.x, destination.z - root.position.z);
          root.position.copy(corrected);
        }
      }
    }
    root.position.y = city.groundY(root.position.x, root.position.z);
    if (!moving && player.distanceTo(root.position) < 4) root.rotation.y = Math.atan2(player.x - root.position.x, player.z - root.position.z);
    legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(time * 11 + i * Math.PI) * .55 : 0; });
    arms.forEach((arm, i) => { arm.rotation.x = moving ? -Math.sin(time * 11 + i * Math.PI) * .35 : 0; });
    lost.rotation.y = time * .4;
  }
  return {
    root, lost, update,
    interactions: () => root.visible ? lost.visible ? [interaction, pickup] : [interaction] : [],
    dispose() {
      root.removeFromParent(); lost.removeFromParent();
      for (const group of [root, lost]) group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      materials.forEach(material => material.dispose());
    },
  };
}

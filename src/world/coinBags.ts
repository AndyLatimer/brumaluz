import * as THREE from 'three';
import type { City, Interactable } from './city';
import { COIN_BAGS, COIN_BAG_REACH } from '../data/coinBags';
import { loadProp } from './props';

const VANISH_SECONDS = .45;

/** Destello de cuatro puntas, dibujado una vez y compartido por todas las bolsas. */
function sparkleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const glow = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  glow.addColorStop(0, 'rgba(255,246,200,1)');
  glow.addColorStop(.25, 'rgba(255,214,110,.55)');
  glow.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = glow;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r = i % 2 ? 6 : 31;
    g[i ? 'lineTo' : 'moveTo'](32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.fill();
  return new THREE.CanvasTexture(canvas);
}

/** Bolsas de pelines personales: cada jugador ve solo las que aún no ha recogido. */
export function createCoinBags(scene: THREE.Scene, city: City) {
  const texture = sparkleTexture();
  const sparkleMaterial = new THREE.SpriteMaterial({
    map: texture, color: '#ffd77a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const bags = COIN_BAGS.map((spot, index) => {
    const root = new THREE.Group();
    root.name = `coin-bag:${spot.id}`;
    root.position.set(spot.x, city.groundY(spot.x, spot.z), spot.z);
    root.rotation.y = spot.yaw;
    root.visible = false;
    const sparkle = new THREE.Sprite(sparkleMaterial.clone());
    sparkle.position.set(.05, .55, .05);
    root.add(sparkle);
    scene.add(root);
    void loadProp('coin-bag').then(model => { if (root.parent) root.add(model); });
    const interaction: Interactable = { id: `coinbag:${spot.id}`, position: root.position, radius: COIN_BAG_REACH, label: 'Recoger bolsa de pelines' };
    return { spot, root, sparkle, interaction, phase: index * 1.7, vanishAt: null as number | null };
  });
  let playing = false;

  function update(collected: readonly string[], visible: boolean, time: number) {
    playing = visible;
    for (const bag of bags) {
      const taken = collected.includes(bag.spot.id);
      if (taken && bag.vanishAt === null && bag.root.visible && visible) bag.vanishAt = time;
      if (!taken) bag.vanishAt = null;
      const vanish = bag.vanishAt === null ? 0 : Math.min((time - bag.vanishAt) / VANISH_SECONDS, 1);
      bag.root.visible = visible && (!taken || (bag.vanishAt !== null && vanish < 1));
      if (!bag.root.visible) continue;
      // Al recogerla, la bolsa da un saltito y se encoge; mientras tanto, solo un destello intermitente.
      bag.root.position.y = city.groundY(bag.spot.x, bag.spot.z) + Math.sin(vanish * Math.PI) * .35;
      bag.root.scale.setScalar(1 - vanish * vanish);
      const twinkle = Math.max(0, Math.sin(time * 2.3 + bag.phase));
      const material = bag.sparkle.material;
      material.opacity = taken ? 1 - vanish : twinkle * twinkle;
      material.rotation = time * .8 + bag.phase;
      bag.sparkle.scale.setScalar(taken ? .5 + vanish * .6 : .18 + twinkle * .22);
    }
  }

  return {
    update,
    /** Bolsas al alcance de E; se ocultan en cuanto el servidor confirma la recogida. */
    interactions: (): Interactable[] => playing
      ? bags.filter(bag => bag.root.visible && bag.vanishAt === null).map(bag => bag.interaction) : [],
    dispose() {
      for (const bag of bags) {
        bag.root.removeFromParent();
        bag.sparkle.material.dispose();
      }
      sparkleMaterial.dispose();
      texture.dispose();
    },
  };
}

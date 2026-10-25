import * as THREE from 'three';
import type { City, Interactable } from './city';
import { FAIRY_DUST_SPOTS, FAIRY_DUST_REACH } from '../data/fairyDust';
import { loadProp } from './props';

const VANISH_SECONDS = .45;

/** Destello mágico de cuatro puntas, azul pastel, compartido por todos los montones de polvo. */
function sparkleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const glow = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  glow.addColorStop(0, 'rgba(220,240,255,1)');
  glow.addColorStop(.25, 'rgba(180,220,255,.55)');
  glow.addColorStop(1, 'rgba(140,200,255,0)');
  g.fillStyle = glow;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r = i % 2 ? 6 : 31;
    g[i ? 'lineTo' : 'moveTo'](32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.fill();
  return new THREE.CanvasTexture(canvas);
}

/** Polvos de hada personales: cada jugador ve solo los montones que aún no ha recogido. */
export function createFairyDust(scene: THREE.Scene, citySource: City | (() => City)) {
  let city = typeof citySource === 'function' ? citySource() : citySource;
  const texture = sparkleTexture();
  const sparkleMaterial = new THREE.SpriteMaterial({
    map: texture, color: '#a8d8ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const spots = city.fairyDustSpots ?? FAIRY_DUST_SPOTS.map(d => ({ id: d.id, x: d.x, z: d.z, yaw: d.yaw }));
  const dusts = spots.map((spot, index) => {
    const root = new THREE.Group();
    root.name = `fairy-dust:${spot.id}`;
    root.position.set(spot.x, city.groundY(spot.x, spot.z), spot.z);
    root.rotation.y = spot.yaw;
    root.visible = false;
    const sparkle = new THREE.Sprite(sparkleMaterial.clone());
    sparkle.position.set(.05, .45, .05);
    root.add(sparkle);
    scene.add(root);
    void loadProp('fairy-dust').then(model => { if (root.parent) root.add(model); });
    const interaction: Interactable = {
      id: `fairydust:${spot.id}`,
      position: root.position,
      radius: FAIRY_DUST_REACH,
      label: 'Recoger polvos de hada',
    };
    return { spot, root, sparkle, interaction, phase: index * 1.7, vanishAt: null as number | null };
  });
  let playing = false;

  function update(collected: readonly string[], visible: boolean, time: number) {
    if (typeof citySource === 'function') city = citySource();
    playing = visible;
    for (const dust of dusts) {
      const taken = collected.includes(dust.spot.id);
      if (taken && dust.vanishAt === null && dust.root.visible && visible) dust.vanishAt = time;
      if (!taken) dust.vanishAt = null;
      const vanish = dust.vanishAt === null ? 0 : Math.min((time - dust.vanishAt) / VANISH_SECONDS, 1);
      dust.root.visible = visible && (!taken || (dust.vanishAt !== null && vanish < 1));
      if (!dust.root.visible) continue;
      // Al recogerlo, el montón brilla más y se encoge; mientras tanto, solo un destello intermitente.
      dust.root.position.y = city.groundY(dust.spot.x, dust.spot.z) + Math.sin(vanish * Math.PI) * .35;
      dust.root.scale.setScalar(1 - vanish * vanish);
      const twinkle = Math.max(0, Math.sin(time * 2.3 + dust.phase));
      const material = dust.sparkle.material;
      material.opacity = taken ? 1 - vanish : twinkle * twinkle;
      material.rotation = time * .8 + dust.phase;
      dust.sparkle.scale.setScalar(taken ? .5 + vanish * .6 : .18 + twinkle * .22);
    }
  }

  return {
    update,
    /** Montones al alcance de E; se ocultan en cuanto el servidor confirma la recogida. */
    interactions: (): Interactable[] => playing
      ? dusts.filter(dust => dust.root.visible && dust.vanishAt === null).map(dust => dust.interaction) : [],
    dispose() {
      for (const dust of dusts) {
        dust.root.removeFromParent();
        dust.sparkle.material.dispose();
      }
      sparkleMaterial.dispose();
      texture.dispose();
    },
  };
}

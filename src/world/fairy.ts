import * as THREE from 'three';
import { softDot } from './paint';

/** Hadita ambiental del tamaño de una mariposa: vestido de pétalo, moñito y cuatro alas. */
export function buildFairy(color: THREE.ColorRepresentation) {
  const root = new THREE.Group();
  root.name = 'ambient-fairy';
  root.raycast = () => {};
  const skin = new THREE.MeshBasicMaterial({ color: '#ffe4ce' });
  const dress = new THREE.MeshBasicMaterial({ color });
  const hair = new THREE.MeshBasicMaterial({ color: '#ffd684' });
  const eyes = new THREE.MeshBasicMaterial({ color: '#49354e' });
  const sphere = new THREE.SphereGeometry(1, 10, 8);
  function bead(material: THREE.Material, position: [number, number, number], scale: [number, number, number], parent: THREE.Object3D = root) {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.fromArray(position);
    mesh.scale.fromArray(scale);
    mesh.raycast = () => {};
    parent.add(mesh);
    return mesh;
  }
  bead(skin, [0, 0.13, 0], [0.058, 0.063, 0.055]);
  bead(hair, [0, 0.165, -0.012], [0.061, 0.041, 0.051]);
  bead(hair, [0, 0.205, -0.018], [0.029, 0.029, 0.029]);
  bead(dress, [0, 0.198, 0.006], [0.032, 0.012, 0.017]);
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.092, 0.16, 7), dress);
  skirt.position.y = 0.008;
  skirt.raycast = () => {};
  root.add(skirt);
  for (const sign of [-1, 1]) {
    bead(skin, [sign * 0.075, 0.043, 0], [0.018, 0.047, 0.018]).rotation.z = sign * 0.65;
    bead(skin, [sign * 0.029, -0.102, 0], [0.015, 0.04, 0.016]);
    bead(eyes, [sign * 0.021, 0.137, 0.05], [0.007, 0.01, 0.005]);
  }
  const wingMaterial = new THREE.MeshBasicMaterial({ color: '#e2faff', transparent: true, opacity: 0.72, depthWrite: false });
  const wings = [-1, 1].map(sign => {
    const pivot = new THREE.Group();
    pivot.position.set(sign * 0.02, 0.055, -0.035);
    bead(wingMaterial, [sign * 0.077, 0.057, 0], [0.071, 0.115, 0.008], pivot).rotation.z = -sign * 0.5;
    bead(wingMaterial, [sign * 0.058, -0.043, 0], [0.057, 0.071, 0.008], pivot).rotation.z = sign * 0.45;
    root.add(pivot);
    return pivot;
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softDot('rgba(255,244,222,0.45)', 'rgba(255,210,244,0)'),
    color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.position.y = 0.06;
  glow.scale.setScalar(0.56);
  glow.raycast = () => {};
  root.add(glow);
  return {
    root,
    flutter(t: number) {
      wings.forEach((wing, i) => { wing.rotation.y = (i ? 1 : -1) * (0.35 + Math.sin(t * 23) * 0.65); });
      root.rotation.z = Math.sin(t * 2.2) * 0.12;
      glow.material.opacity = 0.65 + 0.2 * Math.sin(t * 3);
    },
  };
}

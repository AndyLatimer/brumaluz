// Complementos: adornos del pelo, gafas, bufandas, joyas y maquillaje.
import * as THREE from 'three';
import type { HeadOptions, CreatorParts } from './types';
import type { Analysis } from './analysis';
import { CENTER, V, PI, smoothNormals } from './geometry';
import { earringAnchor } from './earringAnchor';

/** Complementos de la cabeza (parte de buildHead). */
export function buildAccessories({ o, extraMat, topRay, headRay, decals, A, E, frontZ, onFace, parts, pushOut, beast, blushMat, facing, topAt, conform }: { o: HeadOptions; extraMat: (c: string) => THREE.Material; topRay: THREE.Group<THREE.Object3DEventMap>; headRay: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.MeshBasicMaterial, THREE.Object3DEventMap>; decals: THREE.Object3D[]; A: Analysis; E: { rx: number; ry: number; tilt: number; lid: number; hl?: number; }; frontZ: (x: number, y: number) => number; onFace: (x: number, y: number, out?: number) => THREE.Vector3; parts: CreatorParts; pushOut: (g: THREE.BufferGeometry, margin: number) => THREE.BufferGeometry<THREE.NormalBufferAttributes>; beast: boolean; blushMat: THREE.MeshBasicMaterial; facing: (x: number, y: number) => THREE.Euler; topAt: (x: number, z: number) => THREE.Vector3; conform: (group: THREE.Object3D, lift: number) => void }) {
  const accCol = o.accColor ?? '#e8b84a';
  const accMat = extraMat(accCol);
  const hairAccMat = extraMat(o.hairAccColor ?? '#e8b84a');
  const makeupCol = o.makeupColor ?? '#f08aa8';
  /** Punto del pelo (o de la cabeza) en una dirección desde el centro, un poco por fuera. */
  const onHair = (dir: THREE.Vector3, out = 0.01) => {
    const d = dir.clone().normalize();
    const hit = new THREE.Raycaster(CENTER.clone().addScaledVector(d, 2), d.clone().negate()).intersectObjects([topRay, headRay], true)[0];
    return (hit ? hit.point : CENTER.clone().addScaledVector(d, 0.55)).addScaledVector(d, out);
  };
  const onHairSurface = (dir: THREE.Vector3, out: number) => {
    const d = dir.clone().normalize();
    const hit = new THREE.Raycaster(CENTER.clone().addScaledVector(d, 2), d.clone().negate()).intersectObjects([topRay, headRay], true)[0];
    if (!hit) return { point: CENTER.clone().addScaledVector(d, 0.55).addScaledVector(d, out), normal: d };
    const normal = hit.face!.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    return { point: hit.point.clone().addScaledVector(normal, out), normal };
  };
  /** Objeto mirando hacia fuera según una dirección. */
  const place = (obj: THREE.Object3D, direction: THREE.Vector3, roll = 0) => {
    // La base y la orientación usan la misma superficie final, incluso sobre un moño.
    const { point, normal } = onHairSurface(direction, 0.006);
    obj.name = 'character-hair-ornament';
    obj.position.copy(point);
    obj.quaternion.setFromUnitVectors(V(0, 0, 1), normal).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), roll));
    decals.push(obj);
    return obj;
  };
  const flower = (r: number, petal: string, heart = '#ffd65a', n = 5) => {
    const g = new THREE.Group();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * PI * 2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6), extraMat(petal));
      m.scale.set(1, 0.72, 0.38);
      m.position.set(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, 0);
      m.rotation.z = a;
      g.add(m);
    }
    const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 10, 6), extraMat(heart));
    c.scale.z = 0.6; c.position.z = r * 0.2;
    g.add(c);
    return g;
  };
  const star = (r: number, depth: number) => {
    const sh = new THREE.Shape();
    for (let k = 0; k < 10; k++) { const a = PI / 2 + (k / 10) * PI * 2, rr = k % 2 ? r * 0.45 : r; k ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: r * 0.12, bevelSegments: 2 }).translate(0, 0, -depth / 2);
  };
  const ring = (pts: THREE.Vector3[], r: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 6), mat);
    decals.push(m);
    return m;
  };
  if (o.hat === 'none') switch (o.hairAcc ?? 0) {
    case 1: { const d = V(0.6, 0.6, 0.55); place(flower(0.06, o.hairAccColor ?? '#e8b84a'), d); break; }
    case 2: {
      const d = V(0.5, 0.8, 0.3), g = new THREE.Group();
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 12).rotateZ(sx * PI / 2).translate(sx * 0.08, 0, 0), hairAccMat);
        w.scale.set(1, 1, 0.45);
        g.add(w);
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.1, 2, 6), hairAccMat);
        tail.position.set(sx * 0.03, -0.08, 0); tail.rotation.z = sx * 0.35; tail.scale.z = 0.4;
        g.add(tail);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), hairAccMat);
      g.add(knot);
      place(g, d, -0.4);
      break;
    }
    case 3: { const d = V(-0.65, 0.6, 0.5); place(new THREE.Mesh(star(0.06, 0.018), hairAccMat), d, 0.2); break; }
    case 4: {
      const N = 9;
      for (let k = 0; k < N; k++) {
        const a = -PI * 0.5 + (k / (N - 1)) * PI;
        const d = V(Math.sin(a) * 0.8, 0.6, Math.cos(a) * 0.55 + 0.05);
        place(flower(0.038, k % 2 ? o.hairAccColor ?? '#e8b84a' : '#fff4f8', k % 2 ? '#ffd65a' : '#ffb0c8'), d, k);
      }
      break;
    }
    case 7: {
      const d = V(-0.68, 0.48, 0.72), pin = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.14, 3, 8), hairAccMat);
      bar.rotation.z = -0.58;
      bar.scale.z = 0.45;
      pin.add(bar);
      for (const x of [-0.06, 0.06]) {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), extraMat('#f2dfb0'));
        rivet.position.set(x, x * -0.68, 0.004);
        pin.add(rivet);
      }
      place(pin, d, -0.35);
      break;
    }
    case 8: {
      const d = V(0.62, 0.72, 0.38), brooch = new THREE.Group();
      const badgeShape = new THREE.Shape();
      badgeShape.moveTo(0, 0.075);
      badgeShape.lineTo(0.052, 0.035);
      badgeShape.lineTo(0.042, -0.035);
      badgeShape.lineTo(0, -0.075);
      badgeShape.lineTo(-0.042, -0.035);
      badgeShape.lineTo(-0.052, 0.035);
      badgeShape.closePath();
      const badge = new THREE.Mesh(new THREE.ExtrudeGeometry(badgeShape, {
        depth: 0.018, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2,
      }).translate(0, 0, -0.009), hairAccMat);
      brooch.add(badge);
      const emblem = new THREE.Shape();
      for (let k = 0; k < 8; k++) {
        const angle = PI / 2 + k * PI / 4;
        const radius = k % 2 === 0 ? 0.034 : 0.012;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        if (k === 0) emblem.moveTo(x, y);
        else emblem.lineTo(x, y);
      }
      emblem.closePath();
      const emblemGeometry = new THREE.ExtrudeGeometry(emblem, { depth: 0.004, bevelEnabled: false }).translate(0, 0, 0.011);
      brooch.add(new THREE.Mesh(emblemGeometry, extraMat('#382b1c')));
      place(brooch, d, 0.12);
      break;
    }
    case 9: {
      const d = V(-0.72, 0.45, 0.7), pin = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), hairAccMat);
        leaf.scale.set(0.026, 0.058, 0.009);
        leaf.position.set((k - 1) * 0.035, (k - 1) * 0.035, 0);
        leaf.rotation.z = k % 2 ? -0.6 : 0.5;
        pin.add(leaf);
      }
      place(pin, d, -0.3);
      break;
    }
    case 10: {
      const d = V(0.62, 0.65, 0.55), moon = new THREE.Group();
      moon.add(new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 8, 28, PI * 1.48).rotateZ(PI * 0.26), hairAccMat));
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), extraMat('#fff2ca'));
      bead.position.set(0.038, -0.06, 0); moon.add(bead);
      place(moon, d, -0.15);
      break;
    }
    case 11: {
      const points: THREE.Vector3[] = [];
      for (let k = 0; k <= 32; k++) {
        const a = -1.5 + k / 32 * 3;
        const anchor = onHairSurface(V(Math.sin(a), 0.55, Math.cos(a)), 0.008);
        points.push(anchor.point);
        if (k % 4 === 0) {
          const bead = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), hairAccMat);
          bead.position.copy(anchor.point); bead.name = 'character-hair-ornament'; decals.push(bead);
        }
      }
      ring(points, 0.006, extraMat('#80603d')).name = 'character-hair-ornament';
      break;
    }
  }
  const glasses = (sides: number[]) => {
    const metal = extraMat(accCol), lens = new THREE.MeshStandardMaterial({ color: '#dff2ff', transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false });
    for (const s of sides) {
      const x = s * A.eyeX * 0.96, y = A.eyeY - 0.012;
      // No invadir la lente opuesta con ojos grandes; también deja sitio al puente.
      const r = Math.min(Math.max(E.rx, E.ry) * 1.4, A.eyeX * 0.96 - 0.026);
      const g = new THREE.Group();
      g.name = 'character-glasses-lens';
      g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.009, 6, 28), metal));
      if (o.acc === 10) g.scale.y = 0.78;
      const l = new THREE.Mesh(new THREE.CircleGeometry(r, 24), lens);
      l.renderOrder = 3;
      g.add(l);
      // las dos lentes en un mismo plano delante de la cara (como unas gafas de verdad)
      const z = Math.max(frontZ(0, y) + 0.065, frontZ(x, y) + 0.055);
      g.position.set(x, y, z);
      decals.push(g);
      if (sides.length === 2) {
        const temple = onHair(V(s, -0.12, 0.05), 0.012);
        const arm = ring([V(x + s * r, y, z), V(s * 0.37, y, z - 0.025), temple], 0.007, metal);
        arm.name = 'character-glasses-arm';
      }
    }
    return metal;
  };
  const acc = o.acc ?? 0;
  if (acc === 1 || acc === 6 || acc === 10) {
    const metal = glasses([-1, 1]);
    const y = A.eyeY - 0.012, x = A.eyeX * 0.96;
    const r = Math.min(Math.max(E.rx, E.ry) * 1.4, x - 0.026);
    const z = Math.max(frontZ(0, y) + 0.065, frontZ(x, y) + 0.055);
    const bridge = ring([V(-x + r, y, z), V(0, y + 0.022, z + 0.006), V(x - r, y, z)], 0.007, metal);
    bridge.name = 'character-glasses-bridge';
  }
  if (acc === 5) {
    glasses([1]);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 4), accMat);
    chain.position.copy(onFace(A.eyeX + 0.06, A.eyeY - 0.2, 0.03)); chain.rotation.z = 0.25;
    decals.push(chain);
  }
  if (acc === 2 || acc === 6) {
    // bufanda de lana: rosca al cuello y una punta que cuelga
    const wool = extraMat(accCol);
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.075, 10, 28).rotateX(PI / 2), wool);
    sc.position.set(0, 1.15, 0.0); sc.scale.set(1, 1, 0.92); sc.rotation.x = 0.12;
    sc.name = 'character-neck-accessory';
    decals.push(sc);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.2, 4, 8), wool);
    tail.position.set(0.17, 0.98, 0.3); tail.rotation.set(0.25, 0, 0.18); tail.scale.z = 0.55;
    tail.name = 'character-neck-accessory';
    decals.push(tail);
  }
  if (acc === 3) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 16; k++) { const a = -PI * 0.85 + (k / 16) * PI * 1.7; pts.push(V(Math.sin(a) * 0.3, 1.13 - Math.cos(a) * 0.1 - (1 + Math.cos(a)) * 0.0, Math.cos(a) * 0.3 + 0.02)); }
    ring(pts, 0.008, extraMat('#e8b84a')).name = 'character-neck-accessory';
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), new THREE.MeshStandardMaterial({ color: accCol, roughness: 0.15, metalness: 0.2, emissive: accCol, emissiveIntensity: 0.25 }));
    gem.scale.set(0.9, 1.25, 0.6);
    gem.position.copy(pts[8]).add(V(0, -0.04, 0.01));
    gem.name = 'character-neck-accessory';
    decals.push(gem);
  }
  if (acc === 4 || acc === 8 || acc === 9) for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.name = 'character-earring';
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), extraMat('#e8b84a')));
    const drop = new THREE.Mesh(acc === 8 ? new THREE.TorusGeometry(0.045, 0.008, 8, 24) : acc === 9
      ? new THREE.TorusGeometry(0.033, 0.009, 8, 24, PI * 1.5).rotateZ(PI * 0.25)
      : new THREE.SphereGeometry(0.03, 10, 8), extraMat(accCol));
    drop.scale.y = 1.3; drop.position.y = -0.055;
    g.add(drop);
    g.position.copy(earringAnchor(o, s, topAt, onHair));
    decals.push(g);
  }
  if (acc === 7) {
    const geometry = parts['rogue-mask'].clone();
    pushOut(geometry, .035);
    if (beast) {
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const front = THREE.MathUtils.smoothstep(positions.getZ(i), .1, .4);
        positions.setZ(i, positions.getZ(i) + front * .1);
      }
    }
    geometry.computeVertexNormals();
    const mask = new THREE.Mesh(smoothNormals(geometry, 65), extraMat(accCol));
    mask.name = 'traveler-mask';
    decals.push(mask);
  }
  // maquillaje
  const mk = o.makeup ?? 0;
  if (mk === 2 || mk === 4) {
    const shadow = new THREE.MeshBasicMaterial({ map: blushMat.map, color: makeupCol, transparent: true, opacity: 0.75, depthWrite: false });
    for (const s of [-1, 1]) {
      const x = s * A.eyeX * 0.96, y = A.eyeY - 0.012 + E.ry * 0.95;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(E.rx * 3.6, E.ry * 1.6, 12, 4), shadow);
      const r = facing(x, y);
      const patch = new THREE.Group();
      patch.position.copy(onFace(x, y, 0.009)); patch.rotation.set(r.x, r.y, 0); patch.add(m);
      conform(patch, 0.005); m.renderOrder = 2; decals.push(patch);
    }
  }
  if (mk === 5 || mk === 7) for (const s of [-1, 1]) for (let k = 0; k < (mk === 7 ? 6 : 3); k++) {
    const x = s * (A.eyeX + 0.06 + k * 0.035), y = A.eyeY - 0.1 - (k % 2) * 0.04;
    const m = new THREE.Mesh(star((mk === 7 ? 0.008 : 0.014) + (k === 1 ? 0.006 : 0), 0.002), new THREE.MeshBasicMaterial({ color: mk === 7 ? makeupCol : '#fffbe8' }));
    const r = facing(x, y);
    m.position.copy(onFace(x, y, 0.008)); m.rotation.set(r.x, r.y, k);
    decals.push(m);
  }

  const tops = { [-1]: topAt(-0.27, -0.04), [1]: topAt(0.27, -0.04) } as Record<number, THREE.Vector3>;
  return { makeupCol, tops, onHair };
}

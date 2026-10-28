// Complementos: adornos del pelo, gafas, bufandas, joyas y maquillaje.
import * as THREE from 'three';
import type { HeadOptions, CreatorParts } from './types';
import type { Analysis } from './analysis';
import { CENTER, V, PI } from './geometry';
import type { HeadAnatomy } from './anatomy';
import { accessorySelection } from './accessoryLayers';
import { tailoredBow, sculptedFlower, tailoredScarf } from './tailoredDetails';
import { crescentGeometry, leafSprig } from './ornamentGeometry';
import { accessorySurfaces } from './accessorySurfaces';
import { fitEyewear, eyewearTemple, fittedTravelerMask } from './faceAccessoryFit';
import { neckJewelry } from './neckJewelry';
import { fitHairOrnament, hairCirclet } from './hairOrnamentFit';

const hairContacts = new Map<string, { point: THREE.Vector3; normal: THREE.Vector3 }>();

/** Complementos de la cabeza (parte de buildHead). */
export function buildAccessories({ o, anatomy, skinParts = [], extraMat, topRay, headRay, decals, A, E, frontZ, onFace, parts, blushMat, facing, topAt, conform }: { o: HeadOptions; anatomy: HeadAnatomy; skinParts?: THREE.BufferGeometry[]; extraMat: (c: string) => THREE.Material; topRay: THREE.Group<THREE.Object3DEventMap>; headRay: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.MeshBasicMaterial, THREE.Object3DEventMap>; decals: THREE.Object3D[]; A: Analysis; E: { rx: number; ry: number; tilt: number; lid: number; hl?: number; }; frontZ: (x: number, y: number) => number; onFace: (x: number, y: number, out?: number) => THREE.Vector3; parts: CreatorParts; blushMat: THREE.MeshBasicMaterial; facing: (x: number, y: number) => THREE.Euler; topAt: (x: number, z: number) => THREE.Vector3; conform: (group: THREE.Object3D, lift: number) => void }) {
  const accCol = o.accColor ?? '#e8b84a';
  const hairAccMat = extraMat(o.hairAccColor ?? '#e8b84a');
  const makeupCol = o.makeupColor ?? '#f08aa8';
  const { eyewear, neckwear, earrings, mask: faceCovering } = accessorySelection(o.acc ?? 0);
  const surfaces = accessorySurfaces(o, topRay, headRay, skinParts, frontZ);
  const frame = fitEyewear(A, E, eyewear, surfaces, onFace);
  const hairContact = (dir: THREE.Vector3) => {
    const d = dir.clone().normalize();
    const key = `${o.face}/${o.hair}/${o.hat}/${Math.round(d.x * 1e5)},${Math.round(d.y * 1e5)},${Math.round(d.z * 1e5)}`;
    const cached = hairContacts.get(key);
    if (cached) return { point: cached.point.clone(), normal: cached.normal.clone() };
    const hit = new THREE.Raycaster(CENTER.clone().addScaledVector(d, 2), d.clone().negate()).intersectObjects([topRay, headRay], true)[0];
    const point = hit?.point.clone() ?? CENTER.clone().addScaledVector(d, .55);
    const normal = hit?.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize() ?? d.clone();
    if (normal.dot(d) < 0) normal.negate();
    hairContacts.set(key, { point: point.clone(), normal: normal.clone() });
    if (hairContacts.size > 1024) hairContacts.delete(hairContacts.keys().next().value!);
    return { point, normal };
  };
  /** Punto del pelo (o de la cabeza) en una dirección desde el centro, un poco por fuera. */
  const onHair = (dir: THREE.Vector3, out = 0.01) => {
    return hairContact(dir).point.addScaledVector(dir.clone().normalize(), out);
  };
  const onHairSurface = (dir: THREE.Vector3, out: number) => {
    const { point, normal } = hairContact(dir);
    return { point: point.addScaledVector(normal, out), normal };
  };
  /** Objeto mirando hacia fuera según una dirección. */
  const place = (obj: THREE.Object3D, direction: THREE.Vector3, roll = 0) => {
    obj.name = 'character-hair-ornament';
    fitHairOrnament(obj, direction, roll, anatomy, onHairSurface);
    decals.push(obj);
    return obj;
  };
  const flower = (r: number, petal: string, heart = '#ffd65a', n = 5) => {
    return sculptedFlower(r, petal, heart, n);
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
      place(tailoredBow(o.hairAccColor ?? '#e8b84a'), V(0.5, 0.8, 0.3), -.4);
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
      place(leafSprig(o.hairAccColor ?? '#e8b84a'), V(-0.72, 0.45, 0.7), -.3);
      break;
    }
    case 10: {
      const d = V(0.62, 0.65, 0.55), moon = new THREE.Group();
      moon.add(new THREE.Mesh(crescentGeometry(.052, .009), hairAccMat));
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), extraMat('#fff2ca'));
      bead.position.set(0.038, -0.06, 0); moon.add(bead);
      moon.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(.029, -.043, 0), V(.033, -.053, 0), V(.038, -.06, 0)]), 12, .0025, 5), hairAccMat));
      place(moon, d, -0.15);
      break;
    }
    case 11: {
      const points = hairCirclet(anatomy, onHairSurface);
      for (let k = 0; k < points.length; k++) {
        if (k % 4 === 0) {
          const bead = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), hairAccMat);
          bead.position.copy(points[k]); bead.name = 'character-hair-ornament'; decals.push(bead);
        }
      }
      ring(points, 0.006, extraMat('#80603d')).name = 'character-hair-ornament';
      break;
    }
  }
  const glasses = (sides: number[]) => {
    const metal = extraMat(accCol), lens = new THREE.MeshStandardMaterial({ color: '#dff2ff', transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false });
    for (const s of sides) {
      const { y, rx, ry, z } = frame, x = s * frame.x;
      const g = new THREE.Group();
      g.name = 'character-glasses-lens';
      g.userData.fit = { ...frame, x };
      const outline: THREE.Vector3[] = [];
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * PI * 2, cos = Math.cos(a), sin = Math.sin(a);
        outline.push(eyewear === 11 ? V(rx * Math.sign(cos) * Math.abs(cos) ** .5, ry * Math.sign(sin) * Math.abs(sin) ** .5, 0) : V(rx * cos, ry * sin, 0));
      }
      const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 48, .009, 6, true), metal);
      rim.name = 'character-glasses-rim'; g.add(rim);
      const lensShape = new THREE.Shape(outline.map(point => new THREE.Vector2(point.x, point.y)));
      const l = new THREE.Mesh(new THREE.ShapeGeometry(lensShape), lens);
      l.name = 'character-glasses-glass'; l.renderOrder = 3;
      g.add(l);
      g.position.set(x, y, z);
      decals.push(g);
      if (sides.length === 2) {
        const attachment = anatomy.ear(s), support = attachment.temple.clone().addScaledVector(attachment.normal, .007);
        const arm = ring(eyewearTemple(V(x + s * rx, y, z), support, s, surfaces), .007, metal);
        arm.name = 'character-glasses-arm';
        arm.userData.earSide = s;
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(.0045, .0045, .018, 10), metal);
        hinge.position.set(x + s * rx, y, z - .003); hinge.name = 'character-glasses-hinge'; decals.push(hinge);
        const padX = x - s * rx * .83, padY = y - .022, padZ = surfaces.front(padX, padY) + .008;
        const pad = new THREE.Mesh(new THREE.CapsuleGeometry(.006, .009, 3, 8), extraMat('#dbd4bc'));
        pad.name = 'character-glasses-pad'; pad.position.set(padX, padY, padZ); pad.rotation.z = s * .3; decals.push(pad);
        ring([V(x - s * rx * .86, y - .008, z - .002), V(padX, padY, padZ + .005)], .0027, metal).name = 'character-glasses-pad-stem';
      }
    }
    return metal;
  };
  if (eyewear === 1 || eyewear === 10 || eyewear === 11) {
    const metal = glasses([-1, 1]);
    const { x, y, rx, z } = frame;
    const bridge = ring([V(-x + rx, y, z), V(0, y + .022, Math.max(z + .006, surfaces.front(0, y + .022) + .018)), V(x - rx, y, z)], .007, metal);
    bridge.name = 'character-glasses-bridge';
  }
  if (eyewear === 5) {
    const metal = glasses([1]), { x, y, rx, ry, z } = frame;
    const root = V(x + rx * .7, y - ry * .7, z), points = [root];
    for (let k = 1; k <= 14; k++) {
      const t = k / 14, px = root.x + .022 * Math.sin(t * PI), py = root.y - .24 * t;
      points.push(V(px, py, Math.max(root.z + .018 * Math.sin(t * PI), surfaces.front(px, py) + .025)));
    }
    ring(points, .003, metal).name = 'character-monocle-chain';
  }
  if (neckwear === 2) {
    decals.push(...tailoredScarf(accCol));
  }
  if (neckwear === 3 || neckwear === 12) decals.push(...neckJewelry(accCol, neckwear === 12));
  if (earrings) for (const s of [-1, 1]) {
    const ear = anatomy.ear(s), g = new THREE.Group();
    g.name = 'character-earring'; g.userData.earSide = s; g.visible = ear.visible;
    const outward = ear.normal.clone().setY(0).normalize();
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 1, 0).cross(outward).normalize(), V(0, 1, 0), outward));
    g.scale.setScalar(Math.max(.75, ear.scale));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(.016, 12, 10), extraMat('#e8b84a')));
    const drop = new THREE.Mesh(earrings === 8 ? new THREE.TorusGeometry(0.045, 0.008, 8, 24) : earrings === 9
      ? crescentGeometry(.033, .006)
      : new THREE.SphereGeometry(earrings === 13 ? .023 : .03, 12, 10), extraMat(earrings === 13 ? '#fff1da' : accCol));
    drop.scale.y = earrings === 13 ? 1 : 1.3;
    drop.position.set(0, earrings === 13 ? -.038 : -.075, .018);
    const hookEnd = earrings === 13 ? -.022 : earrings === 8 ? -.02 : -.04;
    const hook = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, -.008, 0), V(0, -.02, .014), V(0, hookEnd, .018)]), 16, .0035, 6), extraMat('#e8b84a'));
    hook.name = 'character-earring-hook'; g.add(hook);
    g.add(drop);
    g.position.copy(ear.lobe).addScaledVector(ear.normal, .012);
    decals.push(g);
  }
  if (faceCovering === 7) {
    const geometry = fittedTravelerMask(parts['rogue-mask'], o, A, frame, eyewear, surfaces);
    const mask = new THREE.Mesh(geometry, extraMat(accCol));
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

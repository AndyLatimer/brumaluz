// Detalles de la cara (rubor, pecas, cicatriz…) y las marcas propias de cada linaje.
import * as THREE from 'three';
import { coatMark } from '../../data/data';
import type { HeadOptions } from './types';
import { V, softBlushTexture, PI } from './geometry';
import { detailParts } from './detailLayers';

/** Detalles de la cara de la cabeza (parte de buildHead). */
export function buildFaceDetails({ extraMat, facing, onFace, conform, decals, rayHead, nose, o, mouthY }: { extraMat: (c: string) => THREE.Material; facing: (x: number, y: number) => THREE.Euler; onFace: (x: number, y: number, out?: number) => THREE.Vector3; conform: (grp: THREE.Object3D, lift: number, clampY?: number) => void; decals: THREE.Object3D[]; rayHead: (o: THREE.Vector3, d: THREE.Vector3) => { point: THREE.Vector3; normal: THREE.Vector3; } | null; nose: THREE.Vector3; o: HeadOptions; mouthY: number }) {
  const decal = (geo: THREE.BufferGeometry, color: string, x: number, y: number, rz = 0, sc = V(1, 1, 1), out = 0.005) => {
    // pegado a la curva de la cara (en las mejillas no se despega)
    const m = new THREE.Mesh(geo, extraMat(color));
    m.rotation.z = rz;
    m.scale.copy(sc);
    const g = new THREE.Group(), r = facing(x, y);
    g.position.copy(onFace(x, y, 0.01));
    g.rotation.set(r.x, r.y, 0);
    g.add(m);
    conform(g, out);
    decals.push(g);
  };
  const warPaintStripe = (x: number, y: number, angle: number) => {
    const width = 0.15, height = 0.03, round = height / 2, across = 24, rows = 6;
    const positions: number[] = [], indices: number[] = [];
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (let row = 0; row <= rows; row++) {
      const v = row / rows, localY = (v - 0.5) * height;
      const endInset = round * (1 - Math.sqrt(Math.max(0, 1 - ((v - 0.5) * 2) ** 2)));
      for (let col = 0; col <= across; col++) {
        const u = col / across;
        const localX = THREE.MathUtils.lerp(-width / 2 + endInset, width / 2 - endInset, u);
        const px = x + localX * cos - localY * sin;
        const py = y + localX * sin + localY * cos;
        const hit = rayHead(V(px, py, 2), V(0, 0, -1));
        if (!hit) throw new Error(`Unable to project war paint onto face at (${px.toFixed(3)}, ${py.toFixed(3)})`);
        const point = hit.point.addScaledVector(hit.normal, 0.007);
        positions.push(point.x, point.y, point.z);
      }
    }
    for (let row = 0; row < rows; row++) for (let col = 0; col < across; col++) {
      const a = row * (across + 1) + col, b = a + 1, c = a + across + 1, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    decals.push(new THREE.Mesh(geometry, extraMat('#3a6ab8')));
  };
  const cheekY = nose.y - 0.04;
  const details = detailParts(o.detail);
  const blushMat = new THREE.MeshBasicMaterial({ map: softBlushTexture(), color: o.makeup === 9 ? o.makeupColor : '#ff6f7a', transparent: true, opacity: details.includes(1) || o.makeup === 9 ? 0.85 : o.race === 'lagto' ? 0.16 : (o.makeup ?? 0) > 0 ? 0.42 : 0.24, depthWrite: false });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14, 12, 8), blushMat);
    const r = facing(s * 0.27, cheekY);
    const patch = new THREE.Group();
    patch.position.copy(onFace(s * 0.27, cheekY, 0.008));
    patch.rotation.set(r.x, r.y, 0); patch.add(m);
    conform(patch, 0.004);
    m.renderOrder = 2;
    decals.push(patch);
  }
  for (const detail of details) switch (detail) {
    case 1: break;
    case 2: for (const s of [-1, 1]) for (let k = 0; k < 5; k++) decal(new THREE.CircleGeometry(0.011, 6), '#a0603a', s * (0.2 + (k % 3) * 0.045), cheekY + (k % 2 ? 0.03 : -0.01) - (k > 2 ? 0.035 : 0), 0, V(1, 1, 1), 0.006); break;
    case 3: // cicatriz en la mejilla, con puntadas
      decal(new THREE.CapsuleGeometry(0.008, 0.11, 2, 6), '#c47a70', 0.27, cheekY + 0.01, 0.5, V(1, 1, 0.4), 0.008);
      for (const k of [-1, 0, 1]) decal(new THREE.CapsuleGeometry(0.004, 0.04, 2, 4), '#a8605a', 0.27 - k * 0.03 * Math.sin(0.5), cheekY + 0.01 + k * 0.03 * Math.cos(0.5), 0.5 + PI / 2, V(1, 1, 0.4), 0.01);
      break;
    case 4: for (const s of [-1, 1]) for (let k = 0; k < 2; k++) warPaintStripe(s * 0.3, cheekY + 0.02 - k * 0.055, s * -0.2); break;
    case 5: decal(new THREE.CircleGeometry(0.016, 10), '#3a2420', 0.2, mouthY + 0.01, 0, V(1, 1, 1), 0.006); break;
    case 6:
      for (let k = 0; k < 19; k++) {
        const x = (k - 9) * 0.033, y = cheekY + 0.025 + Math.sin(k * 2.4) * 0.033;
        decal(new THREE.CircleGeometry(0.006 + k % 3 * 0.0018, 8), '#a3704e', x, y, 0, V(1, 0.85, 1), 0.005);
      }
      break;
    case 7:
      for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
        const x = side * (0.19 + k * 0.042), y = cheekY + Math.sin(k * 1.7) * 0.043;
        decal(new THREE.CircleGeometry(k === 1 ? 0.013 : 0.008, 8), '#e0bb74', x, y);
        if (k < 3) decal(new THREE.CapsuleGeometry(0.002, 0.04, 2, 4), '#d1ad71', x + side * 0.02, y - 0.003, side * -0.9, V(1, 1, 0.3));
      }
      break;
    case 8:
      for (const side of [-1, 1]) {
        decal(new THREE.CircleGeometry(0.035, 24), '#638469', side * 0.29, cheekY, side * 0.65, V(0.55, 1.5, 1));
        decal(new THREE.CapsuleGeometry(0.0025, 0.075, 2, 4), '#c8c593', side * 0.29, cheekY, side * 0.65, V(1, 1, 0.3), 0.007);
      }
      break;
    case 9:
      decal(new THREE.CapsuleGeometry(0.006, 0.11, 2, 6), '#d79b87', -0.22, nose.y + 0.22, -0.3, V(1, 1, 0.3), 0.018);
      break;
    case 10:
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++)
        decal(new THREE.CircleGeometry(0.018 - k * 0.003, 4), '#568a82', side * (0.22 + k * 0.047), cheekY - k * 0.017, PI / 4, V(0.65, 1, 1));
      break;
  }
  return { decal, cheekY, blushMat };
}
/** Rasgos del linaje en la cara de la cabeza (parte de buildHead). */
export function buildLineageMarks({ o, decal, nose, cheekY }: { o: HeadOptions; decal: (geo: THREE.BufferGeometry, color: string, x: number, y: number, rz?: number, sc?: THREE.Vector3, out?: number) => void; nose: THREE.Vector3; cheekY: number }) {
  if (o.race === 'pelso') {
    // pelaje: nariz, bigotes y marcas propias de cada color
    const blob = (r: number) => new THREE.RingGeometry(0.0001, r, 40, 4);
    const coat = coatMark(o.skin ?? '');
    decal(new THREE.CircleGeometry(0.036, 3).rotateZ(-PI / 2), coat?.nose ?? '#e8828e', 0, nose.y - 0.015, 0, V(1.35, 0.9, 1), 0.012);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++)
      decal(new THREE.CapsuleGeometry(0.0045, 0.1, 6, 16).rotateZ(PI / 2), coat?.whisker ?? '#5a3a30', sx * 0.3, cheekY - 0.01 - k * 0.028, sx * (0.12 - k * 0.12), V(1, 1, 0.5), 0.008);
    if (coat && coat.mark !== 'plain') {
      const mc = coat.markColor, kind = coat.mark;
      const stripe = (x: number, y: number, len: number, w: number, rz: number) => decal(new THREE.CapsuleGeometry(w, len, 6, 16), mc, x, y, rz, V(1, 1, 0.4), 0.006);
      if (kind === 'tabby') {
        // "M" de la frente: la raya central es la más larga y las laterales se abren
        stripe(0, 1.85, 0.11, 0.017, 0);
        for (const sx of [-1, 1]) {
          stripe(sx * 0.075, 1.838, 0.085, 0.015, -sx * 0.22);
          stripe(sx * 0.15, 1.805, 0.06, 0.012, -sx * 0.5);
          // rayas de mejilla en diagonal, bajo el ojo y fuera de los bigotes
          stripe(sx * 0.36, cheekY + 0.11, 0.07, 0.012, sx * 0.9);
          stripe(sx * 0.37, cheekY + 0.065, 0.06, 0.011, sx * 1.2);
        }
      } else if (kind === 'spots') {
        const pts: [number, number, number, number][] = [[-0.09, 1.85, 0.02, 1.2], [0.05, 1.87, 0.015, 1], [0.11, 1.81, 0.019, 0.8], [-0.03, 1.79, 0.013, 1], [-0.35, cheekY + 0.07, 0.019, 1.3], [0.36, cheekY + 0.045, 0.022, 0.9], [-0.31, cheekY - 0.005, 0.013, 1], [0.32, cheekY - 0.022, 0.016, 1.2]];
        for (const [sx, sy, r, st] of pts) decal(blob(r), mc, sx, sy, 0.4, V(1, st, 1), 0.006);
      } else if (kind === 'mask') {
        // antifaz siamés: hocico y arco sobre los ojos
        decal(blob(0.095), mc, 0, nose.y - 0.025, 0, V(1.35, 1, 1), 0.007);
        for (const sx of [-1, 1]) decal(blob(0.055), mc, sx * 0.17, nose.y + 0.075, 0, V(1.3, 0.7, 1), 0.007);
      } else {
        // parches de bicolor / carey
        decal(blob(0.1), mc, -0.2, 1.83, 0.3, V(1.1, 1.3, 1), 0.007);
        decal(blob(0.045), mc, 0.4, cheekY + 0.14, 0, V(1, 1.3, 1), 0.007);
        decal(blob(0.03), mc, 0.1, 1.9, 0, V(1.2, 1, 1), 0.007);
      }
    }
  }
  if (o.race === 'lagto') {
    for (const sx of [-1, 1]) decal(new THREE.CircleGeometry(0.011, 8), '#1e2a20', sx * 0.032, nose.y - 0.01, 0, V(1.4, 0.8, 1), 0.01);
    // escamas: lunares algo más oscuros en frente y mejillas
    const sc = new THREE.Color(o.skin ?? '#7cc06a').multiplyScalar(0.72).getHexString();
    const spots: [number, number, number][] = [[0, 1.86, 0.03], [-0.09, 1.82, 0.022], [0.09, 1.82, 0.022], [0, 1.76, 0.018], [-0.36, cheekY + 0.05, 0.02], [-0.33, cheekY - 0.01, 0.015], [0.36, cheekY + 0.05, 0.02], [0.33, cheekY - 0.01, 0.015]];
    for (const [sx, sy, r] of spots) decal(new THREE.CircleGeometry(r, 6), '#' + sc, sx, sy, 0.3, V(1, 1, 1), 0.006);
  }
}

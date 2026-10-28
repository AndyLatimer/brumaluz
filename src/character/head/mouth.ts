// La boca y la superficie de la cara en la que se apoyan sus rasgos.
import * as THREE from 'three';
import type { HeadOptions } from './types';
import { V, piece, PI, C_DARK, compose, C_WHITE } from './geometry';

/** Boca de la cabeza (parte de buildHead). */
export function buildMouth({ rayHead, nose, o }: { rayHead: (o: THREE.Vector3, d: THREE.Vector3) => { point: THREE.Vector3; normal: THREE.Vector3; } | null; nose: THREE.Vector3; o: HeadOptions }) {
  const surface = (x: number, y: number) => {
    const hit = rayHead(V(x, y, 2), V(0, 0, -1));
    return hit ? { p: hit.point, n: hit.normal } : { p: V(x, y, 0.45), n: V(0, 0, 1) };
  };
  const onFace = (x: number, y: number, out = 0.004) => { const s = surface(x, y); return s.p.add(s.n.clone().multiplyScalar(out)); };
  const facing = (x: number, y: number) => { const n = surface(x, y).n; return new THREE.Euler(-Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)), Math.atan2(n.x, n.z), 0); };
  const mouthY = nose.y - 0.105;
  const mouth: THREE.BufferGeometry[] = [];
  const teeth: THREE.BufferGeometry[] = [];
  const arc = (r: number, t: number, a0: number, a1: number) => new THREE.TorusGeometry(r, t, 5, 14, a1 - a0).rotateZ(a0);
  const mp = onFace(0, mouthY, 0.012), mr = facing(0, mouthY);
  const mouthZ = mp.z - 0.012;
  const expression = (points: [number, number][], thickness: number) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => V(x, y, 0)));
    return piece(new THREE.TubeGeometry(curve, 28, thickness, 6, false), C_DARK, compose(mp, mr, V(1, 1, .45)));
  };
  switch (o.mouth) {
    case 0:
      if (o.race === 'pelso') for (const sx of [-1, 1]) mouth.push(piece(arc(0.03, 0.011, PI * 1.05, PI * 1.95), C_DARK, compose(mp.clone().add(V(sx * 0.03, 0.022, 0)), mr, V(1, 1, 0.4))));
      else mouth.push(piece(arc(0.06, 0.014, PI * 1.2, PI * 1.8), C_DARK, compose(mp.clone().add(V(0, 0.05, 0)), mr, V(1, 0.85, 0.4))));
      break;
    case 1: mouth.push(piece(new THREE.CircleGeometry(0.075, 14, PI, PI), C_DARK, compose(mp.clone().add(V(0, 0.012, 0.004)), mr, V(1, 0.85, 1)))); break;
    case 2: mouth.push(piece(new THREE.CapsuleGeometry(0.011, 0.08, 3, 6).rotateZ(PI / 2), C_DARK, compose(mp, mr, V(1, 1, 0.5)))); break;
    case 3: mouth.push(piece(new THREE.TorusGeometry(0.034, 0.012, 5, 14), C_DARK, compose(mp, mr, V(0.85, 1.05, 0.5)))); break;
    case 4: mouth.push(expression([[-.050, .006], [-.022, -.015], [.012, -.012], [.051, .024]], .010)); break;
    case 6: mouth.push(expression([[-.029, .002], [0, -.008], [.029, .002]], .0075)); break;
    case 8: mouth.push(expression([[-.058, -.004], [-.022, -.005], [.016, .004], [.043, .021], [.045, .029]], .009)); break;
    case 7:
    case 5:
      mouth.push(piece(arc(0.06, 0.014, PI * 1.2, PI * 1.8), C_DARK, compose(mp.clone().add(V(0, 0.05, 0)), mr, V(1, 0.85, 0.4))));
      teeth.push(piece(new THREE.ConeGeometry(0.018, 0.04, 4).rotateX(PI), C_WHITE, compose(onFace(0.04, mouthY - 0.012, 0.012), mr, V(1, 1, 0.6)), 0.1, 0.1));
      if (o.mouth === 7) teeth.push(piece(new THREE.ConeGeometry(0.018, 0.04, 4).rotateX(PI), C_WHITE, compose(onFace(-0.04, mouthY - 0.012, 0.012), mr, V(1, 1, 0.6)), 0.1, 0.1));
      break;
  }
  return { mouthY, facing, onFace, surface, mouthZ, mp, mouth, teeth, mr };
}

// Ojos y cejas.
import * as THREE from 'three';
import type { Analysis } from './analysis';
import type { HeadOptions, HeadKit } from './types';
import { PI, piece, C_HAIR, M } from './geometry';
import { fabricSurface } from './tailoredDetails';
import { EYE_CONTOURS, eyeBounds, eyePatch } from './eyeContours';

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------

/** Ojos: radio horizontal y vertical, inclinación, párpado (0 = ninguno). */
export const EYE = [
  { rx: 0.05, ry: 0.065, tilt: 0, lid: 0 }, { rx: 0.062, ry: 0.08, tilt: 0, lid: 0 }, { rx: 0.038, ry: 0.048, tilt: 0, lid: 0 },
  { rx: 0.058, ry: 0.042, tilt: 0.3, lid: 0 }, { rx: 0.055, ry: 0.06, tilt: -0.25, lid: 0 }, { rx: 0.056, ry: 0.06, tilt: 0, lid: 0.55 },
  { rx: 0.06, ry: 0.06, tilt: 0, lid: 0 },
  // masculinos: más pequeños, párpado recto y brillos discretos
  { rx: 0.047, ry: 0.054, tilt: 0.06, lid: 0.12, hl: 0.7 }, { rx: 0.053, ry: 0.044, tilt: 0.2, lid: 0.16, hl: 0.65 },
  { rx: 0.061, ry: 0.046, tilt: 0.12, lid: 0.04 }, { rx: 0.053, ry: 0.075, tilt: -0.08, lid: 0, hl: 0.9 },
  { rx: 0.057, ry: 0.052, tilt: 0, lid: 0.24, hl: 0.75 }, { rx: 0.057, ry: 0.069, tilt: 0.16, lid: 0, hl: 1.1 },
] as { rx: number; ry: number; tilt: number; lid: number; hl?: number }[];
/** Cejas: grosor, largo, altura extra, giro (+ = preocupada), curva. */
export const BROW = [
  { t: 0.022, l: 0.15, dy: 0, rot: 0.05, arc: 0.2 }, { t: 0.012, l: 0.14, dy: 0.008, rot: 0.04, arc: 0.3 }, { t: 0.034, l: 0.17, dy: -0.004, rot: 0, arc: 0.1 },
  { t: 0.02, l: 0.14, dy: 0.04, rot: 0.02, arc: 0.45 }, { t: 0.026, l: 0.16, dy: -0.01, rot: 0.38, arc: 0 }, { t: 0.022, l: 0.15, dy: 0.015, rot: -0.32, arc: 0.1 },
  { t: 0.018, l: 0.155, dy: 0.014, rot: -0.1, arc: 0.8 },
  { t: 0.021, l: 0.16, dy: 0.004, rot: 0, arc: 0 },
  { t: 0.016, l: 0.13, dy: 0.012, rot: 0.1, arc: 0.4 },
];
/** Ojos y cejas de la cabeza (parte de buildHead). */
export function buildEyes({ extraMat, A, facing, onFace, E, o, beast, E0, conform, B, material }: { extraMat: (c: string) => THREE.Material; A: Analysis; facing: (x: number, y: number) => THREE.Euler; onFace: (x: number, y: number, out?: number) => THREE.Vector3; E: { rx: number; ry: number; tilt: number; lid: number; hl?: number; }; o: HeadOptions; beast: boolean; E0: { rx: number; ry: number; tilt: number; lid: number; hl?: number; }; conform: (grp: THREE.Object3D, lift: number, clampY?: number) => void; B: { t: number; l: number; dy: number; rot: number; arc: number; }; material: (kit: HeadKit) => THREE.Material }) {
  const decals: THREE.Object3D[] = [];
  const eyes: THREE.Object3D[] = [];
  const happy: THREE.Object3D[] = [];
  const closed: THREE.Object3D[] = [];
  const pupil = extraMat('#16101a'), white = extraMat('#ffffff');
  for (const s of [-1, 1]) {
    const x = s * A.eyeX * 0.96, y = A.eyeY - 0.012;
    const r = facing(x, y);
    const eye = new THREE.Group();
    eye.position.copy(onFace(x, y, 0.014));
    eye.rotation.set(r.x, r.y, s * E.tilt);
    eye.name = 'character-eye';
    eye.userData.eyeShape = o.eyeShape;
    const profile = EYE_CONTOURS[o.eyeShape] ?? EYE_CONTOURS[0];
    const iris = new THREE.Color(o.eyeColor);
    const patch = (name: string, z: number, mat: THREE.Material, outline = 1,
      ellipse?: { rx: number; ry: number; x: number; y: number }) => {
      const mesh = new THREE.Mesh(eyePatch(o.eyeShape, E.rx * outline, E.ry * outline, s, ellipse), mat);
      mesh.name = name; mesh.position.z = z; eye.add(mesh); return mesh;
    };
    patch('eye-outline', 0, pupil, 1.08);
    patch('eye-iris', .003, extraMat('#' + iris.clone().multiplyScalar(.62).getHexString()));
    patch('eye-iris-light', .005, extraMat('#' + iris.clone().lerp(new THREE.Color('#ffffff'), .28).getHexString()), 1,
      { rx: E.rx * .88, ry: E.ry * .75, x: 0, y: -E.ry * .28 });
    const middle = (profile.top - profile.bottom) * E.ry * .28;
    patch('eye-pupil', .008, pupil, 1, {
      rx: E.rx * (beast ? .16 : profile.pupil), ry: E.ry * (beast ? .80 : .58), x: 0, y: middle,
    });
    const hlk = E0.hl ?? 1;
    // Reflections follow each opening, including the half-closed lids.
    const bounds = eyeBounds(o.eyeShape, -.30);
    const reflectionY = (bounds.bottom + (bounds.top - bounds.bottom) * .74) * E.ry;
    patch('eye-reflection', .012, white, 1, {
      rx: E.rx * .25 * hlk, ry: E.ry * .22 * hlk, x: -s * E.rx * .30, y: reflectionY,
    });
    patch('eye-reflection-small', .012, white, 1, {
      rx: E.rx * .11 * hlk, ry: E.ry * .10 * hlk, x: s * E.rx * .34, y: -E.ry * profile.bottom * .48,
    });
    const lidPoints = Array.from({ length: 33 }, (_, i) => {
      const u = i / 32 * 2 - 1;
      return new THREE.Vector3(s * u * E.rx * 1.035, eyeBounds(o.eyeShape, u).top * E.ry * 1.035, .010);
    });
    const lidLine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lidPoints), 32, .006, 5, false),
      o.makeup === 8 ? extraMat(o.makeupColor ?? '#638469') : pupil);
    lidLine.name = 'eye-upper-lid'; eye.add(lidLine);
    const lashes = (o.makeup ?? 0) > 0;
    const wing = new THREE.Mesh(new THREE.ConeGeometry(.009, .032, 4).translate(0, .016, 0), pupil);
    wing.position.set(s * E.rx * .98, eyeBounds(o.eyeShape, .94).top * E.ry, .012);
    wing.rotation.z = -s * (lashes ? .95 : 1.25);
    wing.scale.set(1, o.makeup === 6 ? 1.65 : lashes ? 1 : .55, .3); eye.add(wing);
    if (lashes) for (const u of [.65, .83]) {
      const lash = new THREE.Mesh(new THREE.ConeGeometry(.007, .028, 4).translate(0, .014, 0), pupil);
      lash.position.set(s * E.rx * u, eyeBounds(o.eyeShape, u).top * E.ry, .012);
      lash.rotation.z = -s * (u + .05); lash.scale.z = .3; eye.add(lash);
    }
    conform(eye, .007);
    decals.push(eye);
    // ojos de alegría: arco cerrado
    const hap = new THREE.Group();
    hap.position.copy(eye.position); hap.rotation.copy(eye.rotation);
    const arcM = new THREE.Mesh(new THREE.TorusGeometry(E.rx * 0.95, 0.016, 5, 18, PI * 0.9).rotateZ(PI * 0.05), pupil);
    arcM.position.y = -E.ry * 0.25; arcM.scale.set(1, 0.85, 0.4);
    hap.add(arcM);
    conform(hap, 0.009);
    hap.visible = false;
    decals.push(hap);
    happy.push(hap);
    // Resting eyelids have a shallow downward curve, unlike the smiling eyes.
    const lid = new THREE.Group();
    lid.name = 'closed-eyelid';
    lid.position.copy(eye.position); lid.rotation.copy(eye.rotation);
    const restingArc = new THREE.Mesh(new THREE.TorusGeometry(E.rx * .95, .008, 5, 18, PI * .9).rotateZ(PI * 1.05), pupil);
    restingArc.scale.set(1, .2, .4);
    lid.add(restingArc); conform(lid, .009); lid.visible = false;
    decals.push(lid); closed.push(lid);
    eyes.push(eye);
    // ceja
    if (B.t > 0) {
      const by = y + E.ry + 0.055 + B.dy, bx = x + s * 0.01;
      const angle = -s * B.rot;
      const peak = [.56, .66, .42, .48, .30, .72, .70, .5, .46][o.brows] ?? .56;
      const taper = o.brows === 2 ? .22 : o.brows === 1 || o.brows === 6 ? .78 : .55;
      const bg = fabricSurface((u, v) => {
        const along = (u * 2 - 1), outer = (along * s + 1) / 2;
        const dx = along * (B.l / 2 + B.t * .8);
        const arch = outer < peak ? outer / peak : (1 - outer) / (1 - peak);
        const curve = o.brows === 5 || o.brows === 6 ? arch : Math.sin(Math.PI * arch / 2);
        const thickness = B.t * (1 - outer * taper) * Math.sin(Math.PI * THREE.MathUtils.clamp(u, .0001, .9999)) ** (o.brows === 7 ? .20 : .45);
        const dy = v * thickness + (curve - 1) * B.l * B.arc * .25;
        return onFace(bx + dx * Math.cos(angle) - dy * Math.sin(angle), by + dx * Math.sin(angle) + dy * Math.cos(angle), .003 + .0035 * (1 - v * v) * Math.sin(Math.PI * u));
      }, 32, 8, .0025);
      // los Lagto' no tienen pelo en las cejas: arco de escamas algo más oscuro
      const brow = o.race === 'lagto'
        ? new THREE.Mesh(bg, extraMat('#' + new THREE.Color(o.skin ?? '#7cc06a').multiplyScalar(0.7).getHexString()))
        : new THREE.Mesh(piece(bg, C_HAIR, M(), 0.3, 0.6), material(o.face));
      brow.name = 'character-eyebrow';
      decals.push(brow);
    }
  }
  return { decals, eyes, happy, closed };
}

// Ojos y cejas.
import * as THREE from 'three';
import type { Analysis } from './analysis';
import type { HeadOptions, HeadKit } from './types';
import { PI, piece, C_HAIR, M } from './geometry';

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
] as { rx: number; ry: number; tilt: number; lid: number; hl?: number }[];
/** Cejas: grosor, largo, altura extra, giro (+ = preocupada), curva. */
export const BROW = [
  { t: 0.022, l: 0.15, dy: 0, rot: 0.05, arc: 0.2 }, { t: 0.012, l: 0.14, dy: 0.008, rot: 0.04, arc: 0.3 }, { t: 0.034, l: 0.17, dy: -0.004, rot: 0, arc: 0.1 },
  { t: 0.02, l: 0.14, dy: 0.04, rot: 0.02, arc: 0.45 }, { t: 0.026, l: 0.16, dy: -0.01, rot: 0.38, arc: 0 }, { t: 0.022, l: 0.15, dy: 0.015, rot: -0.32, arc: 0.1 },
];
/** Ojos y cejas de la cabeza (parte de buildHead). */
export function buildEyes({ extraMat, A, facing, onFace, E, o, beast, E0, conform, B, material }: { extraMat: (c: string) => THREE.Material; A: Analysis; facing: (x: number, y: number) => THREE.Euler; onFace: (x: number, y: number, out?: number) => THREE.Vector3; E: { rx: number; ry: number; tilt: number; lid: number; hl?: number; }; o: HeadOptions; beast: boolean; E0: { rx: number; ry: number; tilt: number; lid: number; hl?: number; }; conform: (grp: THREE.Object3D, lift: number, clampY?: number) => void; B: { t: number; l: number; dy: number; rot: number; arc: number; }; material: (kit: HeadKit) => THREE.Material }) {
  const decals: THREE.Object3D[] = [];
  const eyes: THREE.Object3D[] = [];
  const happy: THREE.Object3D[] = [];
  const pupil = extraMat('#16101a'), white = extraMat('#ffffff');
  for (const s of [-1, 1]) {
    const x = s * A.eyeX * 0.96, y = A.eyeY - 0.012;
    const r = facing(x, y);
    const eye = new THREE.Group();
    eye.position.copy(onFace(x, y, 0.014));
    eye.rotation.set(r.x, r.y, s * E.tilt);
    // ojo estilo cozy: contorno oscuro, iris con degradado, pupila grande y dos brillos
    const disc = (rx: number, ry: number, z: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), mat);
      m.scale.set(rx, ry, 0.012);
      m.position.z = z;
      eye.add(m);
      return m;
    };
    const iris = new THREE.Color(o.eyeColor);
    disc(E.rx * 1.08, E.ry * 1.08, 0, pupil);
    disc(E.rx, E.ry, 0.003, extraMat('#' + iris.clone().multiplyScalar(0.62).getHexString()));
    const low = disc(E.rx * 0.78, E.ry * 0.62, 0.005, extraMat('#' + iris.clone().lerp(new THREE.Color('#ffffff'), 0.28).getHexString()));
    low.position.y = -E.ry * 0.3;
    // pupila: rasgada en gatos y lagartos
    if (beast) disc(E.rx * 0.16, E.ry * 0.78, 0.008, pupil);
    else disc(E.rx * 0.5, E.ry * 0.55, 0.008, pupil).position.y = E.ry * 0.05;
    const hlk = E0.hl ?? 1;
    const hl1 = disc(E.rx * 0.3 * hlk, E.ry * 0.27 * hlk, 0.012, white);
    hl1.position.set(-s * E.rx * 0.32, E.ry * 0.38, 0.012);
    const hl2 = disc(E.rx * 0.14 * hlk, E.ry * 0.12 * hlk, 0.012, white);
    hl2.position.set(s * E.rx * 0.34, -E.ry * 0.42, 0.012);
    // línea del párpado superior y pestañas
    const lidLine = new THREE.Mesh(new THREE.TorusGeometry(1, 0.14, 5, 24, PI * 0.86).rotateZ(PI * 0.07), pupil);
    lidLine.scale.set(E.rx * 1.1, E.ry * 1.1, 0.3);
    lidLine.position.z = 0.012;
    eye.add(lidLine);
    // rabillo del delineado hacia fuera
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 4).translate(0, 0.025, 0), pupil);
    wing.position.set(s * E.rx * 1.02, E.ry * 0.28, 0.012);
    // con pestañas, el rabillo es más largo y sube (el ojo «dulce» de antes)
    const lashes = (o.makeup ?? 0) > 0;
    wing.rotation.z = -s * (lashes ? 1.05 : 1.35);
    wing.scale.set(o.makeup === 6 ? 1.3 : 1, o.makeup === 6 ? 2 : lashes ? 1.1 : 0.7, 0.3);
    eye.add(wing);
    // brillo inferior suave del iris
    const shine = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 4, 16, PI * 0.6).rotateZ(PI * 1.2), extraMat('#' + iris.clone().lerp(new THREE.Color('#ffffff'), 0.6).getHexString()));
    shine.scale.set(E.rx * 0.82, E.ry * 0.82, 0.3);
    shine.position.z = 0.009;
    eye.add(shine);
    if (lashes) for (const k of [0, 1]) {
      const lash = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 4).translate(0, 0.025, 0), pupil);
      lash.position.set(s * E.rx * (0.82 + k * 0.05), E.ry * (0.62 - k * 0.32), 0.012);
      lash.rotation.z = -s * (0.9 + k * 0.5);
      lash.scale.set(1, o.makeup === 6 ? 1.4 : 1, 0.3);
      eye.add(lash);
    }
    // ojos soñolientos: el párpado corta el ojo por arriba en recto
    conform(eye, 0.007, E.lid ? E.ry * (1 - E.lid * 1.4) : undefined);
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
    eyes.push(eye);
    // ceja
    if (B.t > 0) {
      const by = y + E.ry + 0.055 + B.dy, bx = x + s * 0.01;
      const bg = new THREE.CapsuleGeometry(B.t * 0.95, B.l, 3, 8).rotateZ(PI / 2);
      // afilada hacia fuera y con un leve arco
      const bp = bg.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const u = THREE.MathUtils.clamp(bp.getX(i) / (B.l * 0.5 + B.t), -1, 1), out = (u * s + 1) / 2;
        bp.setY(i, bp.getY(i) * (1 - out * 0.45) - u * u * B.l * B.arc * 0.25);
      }
      bg.computeVertexNormals();
      // los Lagto' no tienen pelo en las cejas: arco de escamas algo más oscuro
      const brow = o.race === 'lagto'
        ? new THREE.Mesh(bg, extraMat('#' + new THREE.Color(o.skin ?? '#7cc06a').multiplyScalar(0.7).getHexString()))
        : new THREE.Mesh(piece(bg, C_HAIR, M(), 0.3, 0.6), material(o.face));
      const br = facing(bx, by);
      const bg2 = new THREE.Group();
      bg2.position.copy(onFace(bx, by, 0.01));
      bg2.rotation.set(br.x, br.y, 0);
      brow.rotation.z = s * -B.rot;
      brow.scale.set(1, 1, 0.55);
      bg2.add(brow);
      conform(bg2, B.t * 0.45);
      decals.push(bg2);
    }
  }
  return { decals, eyes, happy };
}

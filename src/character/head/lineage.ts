// Rasgos de cada linaje anclados a la cabeza: orejas, crestas y cuernos.
import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';
import type { HeadKit, HeadOptions } from './types';
import type { HeadAnatomy } from './anatomy';
import { smoothNormals, V, mergeGeoms, HEAD_C, paintCell, C_SKIN, CENTER } from './geometry';

/** Anclajes para rasgos del linaje de la cabeza (parte de buildHead). */
export function buildLineageFeatures({ hairPieces, pushOut, extras, headRay, o, headAt, skinParts, anatomy }: { hairPieces: { geo: THREE.BufferGeometry; kit: HeadKit }[]; pushOut: (g: THREE.BufferGeometry, margin: number) => THREE.BufferGeometry<THREE.NormalBufferAttributes>; extras: { geo: THREE.BufferGeometry; kit: HeadKit }[]; headRay: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.MeshBasicMaterial, THREE.Object3DEventMap>; o: HeadOptions; headAt: (dir: THREE.Vector3, out?: number) => THREE.Vector3; skinParts: THREE.BufferGeometry[]; anatomy: HeadAnatomy }) {
  // subdivisión: cara y pelo redondeados en vez de facetados
  // (Loop encoge un poco las formas convexas: se infla lo mismo para no abrir huecos)
  const subdiv = (g: THREE.BufferGeometry, deg: number, inflate = 0) => {
    const out = LoopSubdivision.modify(g, 1, { split: false, uvSmooth: false, preserveEdges: true });
    if (out !== g) g.dispose();
    smoothNormals(out, deg);
    if (inflate) {
      // dirección promediada por posición: los vértices repetidos se mueven juntos (sin grietas)
      const p = out.attributes.position, n = out.attributes.normal, acc = new Map<string, THREE.Vector3>();
      const key = (i: number) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
      const keys: string[] = [];
      for (let i = 0; i < p.count; i++) { const k = key(i); keys.push(k); (acc.get(k) ?? acc.set(k, V(0, 0, 0)).get(k)!).add(V(n.getX(i), n.getY(i), n.getZ(i))); }
      for (const v of acc.values()) v.normalize().multiplyScalar(inflate);
      for (let i = 0; i < p.count; i++) { const d = acc.get(keys[i])!; p.setXYZ(i, p.getX(i) + d.x, p.getY(i) + d.y, p.getZ(i) + d.z); }
    }
    return out;
  };
  // pelo final (ya redondeado): los adornos y rasgos se apoyan sobre él
  const byKit = new Map<HeadKit, THREE.BufferGeometry[]>();
  for (const h of hairPieces) (byKit.get(h.kit) ?? byKit.set(h.kit, []).get(h.kit)!).push(h.geo);
  const finalHair: { geo: THREE.BufferGeometry; kit: HeadKit }[] = [];
  for (const [kit, gs] of byKit) {
    const ready = gs.filter(geometry => geometry.userData.surfaceReady);
    const raw = mergeGeoms(gs.filter(geometry => !geometry.userData.surfaceReady));
    if (raw) ready.push(smoothNormals(pushOut(subdiv(raw, 70, 0.003), o.hair === 7 ? -0.012 : 0.012), 70));
    const g = mergeGeoms(ready);
    if (g) finalHair.push({ geo: g, kit });
  }
  const hairGeos = [...finalHair, ...extras].map((h) => h.geo);
  const topRay = new THREE.Group();
  for (const g of hairGeos) topRay.add(new THREE.Mesh(g, headRay.material));
  // Human ears grow from the same anatomical landmarks used by their jewellery.
  if (o.race === 'humano' || !o.race) for (const side of [-1, 1]) {
    const ear = anatomy.ear(side); if (!ear.visible) continue;
    const geometry = new THREE.SphereGeometry(1, 20, 16);
    geometry.scale(.035, .1, .07); geometry.applyQuaternion(ear.rotation); geometry.translate(ear.root.x, ear.root.y, ear.root.z);
    geometry.userData.earSide = side;
    skinParts.push(paintCell(geometry, C_SKIN, .3, .6));
  }
  const topAt = (x: number, z: number) => {
    const rc = new THREE.Raycaster(V(x, 3, z), V(0, -1, 0));
    const hit = rc.intersectObject(topRay, true)[0] ?? rc.intersectObject(headRay)[0];
    return hit ? hit.point : V(x, 2.1, z);
  };
  const crest: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  for (let k = 0; k < 6; k++) {
    const a = 0.45 - k * 0.36, dir = V(0, Math.cos(a), Math.sin(a));
    const rc = new THREE.Raycaster(CENTER.clone().add(dir.clone().multiplyScalar(2)), dir.clone().negate());
    const hit = rc.intersectObjects([topRay, headRay], true)[0];
    crest.push({ p: hit ? hit.point : CENTER.clone().add(dir.clone().multiplyScalar(0.52)), n: dir });
  }
  return { topRay, topAt, finalHair, crest };
}

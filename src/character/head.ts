// ---------------------------------------------------------------------------
// Cabezas modulares a partir de las cuatro cabezas de KayKit Adventurers.
// Cada cabeza se separa por las celdas de su paleta en cara, pelo y barba; así
// cualquier cara se combina con cualquier peinado o barba. Ojos, cejas, nariz y
// orejas se deforman vértice a vértice, y las piezas añadidas (coletas, moños,
// bocas, orejas de elfo o gato, crestas) se pintan con la misma paleta.
// Todo se calcula en el espacio de la malla original y al final se pasa al
// espacio del hueso "head", del que cuelga como malla rígida.
// ---------------------------------------------------------------------------
// Este módulo es la API pública (tipos, nombres de las opciones y buildHead); cada parte vive en src/character/head/.
import * as THREE from 'three';
import type { HeadKit, HeadSource, HeadOptions, CreatorParts, HeadResult } from './head/types';
import { smoothNormals, mergeGeoms, V, piece, C_DARK, compose } from './head/geometry';
import { analyse } from './head/analysis';
import { buildSkull } from './head/skull';
import { buildHair } from './head/hair';
import { buildMouth } from './head/mouth';
import { buildBeard } from './head/beard';
import { buildEyes } from './head/eyes';
import { buildFaceDetails, buildLineageMarks } from './head/faceDetails';
import { buildLineageFeatures } from './head/lineage';
import { buildAccessories } from './head/accessories';
import { createHeadAnatomy } from './head/anatomy';
import { hasTravelerMask } from './head/accessoryLayers';

export type { HeadKit, HeadSource, CreatorParts, HeadOptions, HeadResult } from './head/types';

export const HAIR_STYLES = ['Rapado', 'Corto con flequillo', 'Despeinado', 'Media melena', 'Coleta', 'Moño', 'Dos coletas', 'Cresta', 'Melena larga', 'Trenza', 'Moños dobles', 'Rizos', 'Corte asimétrico', 'Corto pegado', 'Melena de explorador', 'Flequillo de viajero', 'Trenza lateral', 'Trenzas de la Arboleda', 'Moño de artesano', 'Coleta de aventurero', 'Ondas de Bruma', 'Corona trenzada', 'Trenza alta', 'Moño trenzado', 'Melena a un lado', 'Rizos cortos', 'Trenzas recogidas', 'Dos moños trenzados'];
export const BEARDS = ['Ninguna', 'Barba recortada', 'Barba completa', 'Perilla y bigote', 'Bigote', 'Perilla', 'Patillas', 'Barba de tres días', 'Bigote de artesano'];
export const EYE_SHAPES = ['Normales', 'Grandes', 'Pequeños', 'Rasgados', 'Dulces', 'Soñolientos', 'Redondos', 'Varoniles', 'Afilados', 'Almendrados', 'Curiosos', 'Serenos', 'Vivaces'];
export const BROWS = ['Naturales', 'Finas', 'Gruesas', 'Altas', 'Preocupadas', 'Enfadadas', 'Arqueadas', 'Rectas', 'Suaves'];
export const NOSES = ['Pequeña', 'Grande', 'Respingona', 'Ancha', 'Aguileña', 'Botón', 'Recta', 'Redondeada', 'Delicada'];
export const MOUTHS = ['Sonrisa', 'Sonrisa abierta', 'Seria', 'Sorpresa', 'Pícara', 'Colmillo', 'Sonrisa tímida', 'Dos colmillos', 'Sonrisa de lado'];
export { DETAILS } from './head/detailLayers';
export const FACE_LABELS: Record<HeadKit, string> = { Mage: 'Serio', Knight: 'Noble', Rogue: 'Dulce', Barbarian: 'Cuadrada' };
export const FACE_KITS: HeadKit[] = ['Rogue', 'Mage', 'Knight', 'Barbarian'];

export function buildHead(sources: Record<HeadKit, HeadSource>, o: HeadOptions, material: (kit: HeadKit) => THREE.Material, extraMat: (c: string) => THREE.Material, parts: CreatorParts): HeadResult {
  const A = analyse(sources[o.face === 'Barbarian' ? 'Mage' : o.face]);
  const group = new THREE.Group();
  const ownedMaterials: THREE.Material[] = [];
  const toBone = A.src.toBone;

  const { headR, fitHairShell, settle, pushOut, headAt, rayHead, nose, E, beast, E0, B, extras, headRay, skinParts, frontZ, headMesh } = buildSkull({ o, A, material });

  const { hairCell, hairPieces } = buildHair({ o, headR, fitHairShell, settle, pushOut, sources, parts, headAt });

  const { mouthY, facing, onFace, surface, mouthZ, mp, mouth, teeth, mr } = buildMouth({ rayHead, nose, o });

  const { conform, beardGeos } = buildBeard({ o, mouthY, rayHead, headR, hairCell });

  const { decals, eyes, happy, closed } = buildEyes({ extraMat, A, facing, onFace, E, o, beast, E0, conform, B, material });

  const { decal, cheekY, blushMat } = buildFaceDetails({ extraMat, facing, onFace, conform, decals, rayHead, nose, o, mouthY });

  buildLineageMarks({ o, decal, nose, cheekY });

  const anatomy = createHeadAnatomy(o, headAt);
  const { topRay, topAt, finalHair, crest } = buildLineageFeatures({ hairPieces, pushOut, extras, headRay, o, headAt, skinParts, anatomy });

  const { makeupCol, tops, onHair } = buildAccessories({ o, extraMat, topRay, headRay, decals, A, E, frontZ, onFace, parts, blushMat, facing, topAt, conform, anatomy, skinParts });

  // ---------- Montaje en el espacio del hueso ----------
  const finish = (m: THREE.Mesh) => { m.geometry.applyMatrix4(toBone); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  headMesh.name='character-skull';
  finish(headMesh);
  for (const g of skinParts) {
    const mesh = finish(new THREE.Mesh(smoothNormals(g, 80), material(o.face)));
    if (g.userData.earSide) {
      const ear = new THREE.Group(), fit = anatomy.ear(g.userData.earSide);
      ear.name = 'character-ear'; ear.userData.earSide = g.userData.earSide; ear.userData.earKind = fit.kind;
      ear.userData.earLobeLocal = fit.lobe.applyMatrix4(toBone).toArray();
      mesh.name = 'character-ear-outer'; ear.add(mesh); group.add(ear);
    }
  }
  for (const h of extras) finish(new THREE.Mesh(h.geo, material(h.kit)));
  for (const h of finalHair) {
    const hairMaterial = material(h.kit);
    const doubleSided = hairMaterial.clone();
    doubleSided.side = THREE.DoubleSide;
    ownedMaterials.push(doubleSided);
    const mesh = finish(new THREE.Mesh(h.geo, doubleSided));
    mesh.name = 'character-hair';
    // Authored locks and their thin backing cast onto skin; self-shadowing between them creates acne.
    mesh.receiveShadow = ![12, 13, 14, 15].includes(o.hair);
  }
  for (const g of beardGeos) { const beard = new THREE.Mesh(g, material(o.face)); beard.name = 'character-beard'; finish(beard); }
  // la boca sigue la curva de la cara (en la cara "Dulce" los labios abultan y la tapaban)
  const hugFace = (g: THREE.BufferGeometry | null) => {
    if (!g) return g;
    const p = g.attributes.position, memo = new Map<string, number>();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), k = `${Math.round(x * 300)},${Math.round(y * 300)}`;
      let sz = memo.get(k);
      if (sz === undefined) { sz = surface(x, y).p.z; memo.set(k, sz); }
      p.setZ(i, sz + 0.004 + Math.min(0.004, Math.max(0, p.getZ(i) - mouthZ) * 0.25));
    }
    g.computeVertexNormals();
    return g;
  };
  // La boca vive en un grupo propio para poder animarla al hablar: la boca en reposo se oculta y una boca
  // abierta (óvalo oscuro) se abre y cierra. Las geometrías se centran en el pivote para escalar desde ahí.
  const mouthRig = new THREE.Group();
  mouthRig.name = 'character-mouth-rig';
  mouthRig.visible = !hasTravelerMask(o.acc ?? 0);
  mouthRig.position.copy(mp);
  const rest = new THREE.Group();
  mouthRig.add(rest);
  const addMouthMesh = (parent: THREE.Object3D, g: THREE.BufferGeometry, mat: THREE.Material, origin: THREE.Vector3) => {
    g.translate(-origin.x, -origin.y, -origin.z);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
  };
  const mg = hugFace(mergeGeoms(mouth));
  const lips = o.makeup === 3 || o.makeup === 4;
  if (mg) addMouthMesh(rest, mg, lips ? extraMat(makeupCol) : material(o.face), mp);
  const tg = hugFace(mergeGeoms(teeth));
  if (tg) addMouthMesh(rest, tg, material(o.face), mp);
  const openCenter = mp.clone().add(V(0, 0.02, 0));
  const openPivot = new THREE.Group();
  openPivot.position.copy(openCenter).sub(mp);
  openPivot.visible = false;
  mouthRig.add(openPivot);
  const og = hugFace(piece(new THREE.CircleGeometry(0.05, 18), C_DARK, compose(openCenter, mr, V(1, 0.8, 1))));
  if (og) addMouthMesh(openPivot, og, material(o.face), openCenter);
  mouthRig.updateMatrix();
  mouthRig.applyMatrix4(toBone);
  group.add(mouthRig);
  for (const d of decals) {
    d.updateMatrix();
    d.applyMatrix4(toBone);
    d.castShadow = false;
    group.add(d);
  }
  // Las geometrías compartidas con los proxies ya están en espacio del hueso.
  // Los anclajes consultados después del montaje siguen recibiendo coordenadas
  // originales: compensar esa conversión también en las superficies de raycast.
  const fromBone = toBone.clone().invert();
  for (const proxy of [topRay, headRay]) {
    proxy.matrixAutoUpdate = false;
    proxy.matrix.copy(fromBone);
    proxy.updateMatrixWorld(true);
  }
  headRay.material.dispose();
  // Incluye materiales locales de lentes, rubor y maquillaje en el ciclo de vida.
  group.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    for (const mat of Array.isArray(node.material) ? node.material : [node.material])
      if (!ownedMaterials.includes(mat)) ownedMaterials.push(mat);
  });
  return {
    group,
    anatomy,
    ownedMaterials,
    toBone,
    eyes,
    happy,
    closed,
    mouth: { rest, open: openPivot },
    skullSurface: dir => headAt(dir, 0),
    anchors: {
      ear: (s) => anatomy.ear(s).root, top: (s) => tops[s < 0 ? -1 : 1].clone(), crest,
      // punto real de la superficie (pelo o cabeza) en una dirección, hundido hacia dentro
      surf: (dir, sink = 0.05) => { const n = dir.clone().normalize(); return { p: onHair(n, -sink), n }; },
    },
  };
}

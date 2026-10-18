import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from '../world/load';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import mageUrl from '../assets/models/Mage.glb?url';
import knightUrl from '../assets/models/Knight.glb?url';
import rogueUrl from '../assets/models/Rogue.glb?url';
import barbarianUrl from '../assets/models/Barbarian.glb?url';
import { CharData, RACES, CLOTH, HAIR_COLORS, EYE_COLORS, ACC_COLORS, coatMark } from '../data/data';
import { buildHead, paintCell, smoothNormals, HeadSource, HeadKit, FACE_KITS, HeadResult } from './head';
import { softDot } from '../world/paint';

// ---------------------------------------------------------------------------
// Personajes a partir del pack "KayKit Adventurers" (Kay Lousberg, CC0).
// Las piezas (cabeza, cuerpo, brazos, piernas, capa, sombrero, armas) de los
// cuatro modelos comparten esqueleto, así que se combinan libremente sobre el
// esqueleto del modelo base (que trae las animaciones). Los colores se cambian
// repintando las celdas de su paleta en degradado (cuadrícula 8×8).
// ---------------------------------------------------------------------------

type Kit = 'Mage' | 'Knight' | 'Rogue' | 'Barbarian';
const URLS: Record<Kit, string> = { Mage: mageUrl, Knight: knightUrl, Rogue: rogueUrl, Barbarian: barbarianUrl };
const kits = {} as Record<Kit, GLTF>;

const heads = {} as Record<HeadKit, HeadSource>;

export async function loadKits() {
  await Promise.all((Object.keys(URLS) as Kit[]).map(async (k) => { kits[k] = await loadGLB(URLS[k]); }));
  // sombreado suave en cuerpos, ropa y accesorios (las aristas marcadas se mantienen)
  for (const k of Object.keys(URLS) as Kit[]) kits[k].scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.name.endsWith('_Head')) smoothNormals(m.geometry, 50);
  });
  for (const k of Object.keys(URLS) as Kit[]) {
    const src = kits[k].scene.getObjectByName(`${k}_Head`) as THREE.SkinnedMesh;
    const hi = src.skeleton.bones.findIndex((b) => b.name === 'head');
    const toBone = new THREE.Matrix4().multiplyMatrices(src.skeleton.boneInverses[hi], src.bindMatrix);
    heads[k] = { kit: k, geometry: src.geometry, toBone };
  }
}

// Celdas de la paleta por función
const SKIN = [0, 8, 39, 47];
const HAIR = [1, 9];
const CLOTH_CELLS: Record<Kit, { primary: number[]; secondary: number[] }> = {
  Mage: { primary: [16, 17, 23, 24, 25, 31], secondary: [35, 43] },
  Rogue: { primary: [16, 17, 24, 25, 33, 41], secondary: [5, 13, 35, 43] },
  Knight: { primary: [16, 24, 34, 42], secondary: [18, 26] },
  Barbarian: { primary: [16, 17, 24, 25, 34, 42], secondary: [18, 26] },
};

interface Outfit { kit: Kit; hat?: string; items: { kit: Kit; name: string }[]; cape: boolean; idle: string }
const OUTFITS: Record<CharData['cls'], Outfit> = {
  guerrero: { kit: 'Knight', hat: 'Knight_Helmet', cape: true, idle: 'Idle', items: [{ kit: 'Knight', name: '1H_Sword' }, { kit: 'Knight', name: 'Badge_Shield' }] },
  mago: { kit: 'Mage', hat: 'Mage_Hat', cape: true, idle: 'Idle', items: [{ kit: 'Mage', name: '2H_Staff' }] },
  picaro: { kit: 'Rogue', cape: true, idle: 'Idle', items: [{ kit: 'Rogue', name: 'Knife' }, { kit: 'Rogue', name: 'Knife_Offhand' }] },
  clerigo: { kit: 'Mage', cape: true, idle: 'Idle', items: [{ kit: 'Mage', name: '1H_Wand' }, { kit: 'Mage', name: 'Spellbook' }] },
  explorador: { kit: 'Barbarian', hat: 'Barbarian_Hat', cape: true, idle: 'Idle', items: [{ kit: 'Rogue', name: '1H_Crossbow' }] },
};
/** Atuendo básico común con el que empiezan todos los personajes. */
const VILLAGER: Outfit = { kit: 'Rogue', cape: false, idle: 'Idle', items: [] };

// ---------------------------------------------------------------------------
// Repintado de la paleta
// ---------------------------------------------------------------------------

const texCache = new Map<string, THREE.Texture>();
const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Copia la textura cambiando el color de algunas celdas, conservando su degradado. */
function recolor(src: THREE.Texture, kit: Kit, map: [number[], string][]): THREE.Texture {
  const key = kit + '|' + map.map(([c, h]) => c.join(',') + h).join(';');
  let t = texCache.get(key);
  if (t) return t;
  const img = src.image as HTMLImageElement | ImageBitmap;
  const W = img.width, H = img.height, C = W / 8;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(img as CanvasImageSource, 0, 0);
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const refAt = (c: number) => {
    const i = ((Math.floor(c / 8) * C + 8) * W + (c % 8) * C + C / 2) * 4;
    return lum(px[i], px[i + 1], px[i + 2]) / 255;
  };
  for (const [cells, hex] of map) {
    const target = new THREE.Color(hex).convertLinearToSRGB();
    const ref = refAt(cells[0]) || 0.01;
    for (const c of cells) {
      const x0 = (c % 8) * C, y0 = Math.floor(c / 8) * C;
      for (let y = y0; y < y0 + C; y++) for (let x = x0; x < x0 + C; x++) {
        const i = (y * W + x) * 4;
        const k = lum(px[i], px[i + 1], px[i + 2]) / 255 / ref;
        px[i] = Math.min(255, target.r * k * 255);
        px[i + 1] = Math.min(255, target.g * k * 255);
        px[i + 2] = Math.min(255, target.b * k * 255);
      }
    }
  }
  ctx.putImageData(data, 0, 0);
  t = new THREE.CanvasTexture(cv);
  t.flipY = src.flipY;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = src.magFilter;
  t.minFilter = src.minFilter;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// ---------------------------------------------------------------------------
// Personaje
// ---------------------------------------------------------------------------

export interface BuildOpts { outfit: boolean }

const PI = Math.PI;
/** KayKit mide ~2.4 unidades: lo llevamos a ~1.55 m, proporción de la escena. */
const UNIT = 0.65;

/** Luz de contorno cálida para integrar los materiales del personaje en la escena. */
function charm(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      {
        vec3 vd = normalize(vViewPosition);
        float fr = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.0);
        outgoingLight += vec3(1.0, 0.82, 0.66) * fr * 0.22 * (0.4 + diffuseColor.rgb);
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'charm';
  return m;
}

export class Character {
  root = new THREE.Group();
  private model!: THREE.Object3D;
  private bones = new Map<string, THREE.Bone>();
  private mixer!: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private idle!: THREE.AnimationAction;
  private lastT = -1;
  private tail?: THREE.Object3D[];
  private ears: THREE.Object3D[] = [];
  private glow?: THREE.Sprite;
  private eyes: { o: THREE.Object3D; sy: number }[] = [];
  private nextBlink = 1 + Math.random() * 2;
  private blinkT = -1;
  private happy: THREE.Object3D[] = [];
  private happyReq = false;
  private happyUntil = -1;
  private owned: { dispose(): void }[] = [];

  constructor(public d: CharData, public opts: BuildOpts) {
    this.build();
  }

  private build() {
    const d = this.d, R = RACES[d.race];
    const outfit = this.opts.outfit ? OUTFITS[d.cls] : VILLAGER;
    const base = kits.Mage;

    // Esqueleto base (con animaciones): se clona y se le quitan sus mallas
    this.model = cloneSkinned(base.scene);
    const strip: THREE.Object3D[] = [];
    this.model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones.set(o.name, o as THREE.Bone);
      else if ((o as THREE.Mesh).isMesh) strip.push(o);
    });
    strip.forEach((o) => o.removeFromParent());
    this.root.add(this.model);

    // Proporciones
    this.model.scale.setScalar(UNIT);

    // Colores
    const skin = R.skins[d.skin];
    const hair = HAIR_COLORS[d.hairColor];
    const P = this.opts.outfit ? CLOTH[d.primary] : CLOTH[d.clothA];
    const S = this.opts.outfit ? CLOTH[d.secondary] : CLOTH[d.clothB];
    const matCache = new Map<string, THREE.MeshStandardMaterial>();
    const mat = (kit: Kit, withCloth: boolean) => {
      const k = kit + withCloth;
      let m = matCache.get(k);
      if (!m) {
        const map: [number[], string][] = [[SKIN, skin], [HAIR, hair]];
        if (withCloth) map.push([CLOTH_CELLS[kit].primary, P], [CLOTH_CELLS[kit].secondary, S]);
        // la cota de diario es acolchada: el gris metálico pasa a ser tela
        if (withCloth && !this.opts.outfit && kit === 'Knight') map.push([[11], P]);
        const src = (kits[kit].scene.getObjectByProperty('isMesh', true) as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m = charm(new THREE.MeshStandardMaterial({ map: recolor(src.map!, kit, map), roughness: 0.7, metalness: 0 }));
        matCache.set(k, m);
        this.owned.push(m);
      }
      return m;
    };
    const capeMat = (kit: Kit) => {
      const m = mat(kit, true).clone();
      m.side = THREE.DoubleSide;
      this.owned.push(m);
      return m;
    };

    // Cabeza modular: material propio con color de ojos y de boca
    const headMats = new Map<HeadKit, THREE.MeshStandardMaterial>();
    const headMat = (kit: HeadKit) => {
      let m = headMats.get(kit);
      if (!m) {
        const src = (kits[kit].scene.getObjectByProperty('isMesh', true) as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m = charm(new THREE.MeshStandardMaterial({ map: recolor(src.map!, kit, [[SKIN, skin], [HAIR, hair], [[10], EYE_COLORS[d.eyeColor]], [[2], '#6a2c30']]), roughness: 0.6 }));
        headMats.set(kit, m);
        this.owned.push(m);
      }
      return m;
    };
    const flatMats = new Map<string, THREE.MeshStandardMaterial>();
    const flatMat = (c: string) => {
      let m = flatMats.get(c);
      if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }); flatMats.set(c, m); this.owned.push(m); }
      return m;
    };
    const hatKind = !outfit.hat ? 'none' : outfit.hat === 'Knight_Helmet' ? 'helmet' : outfit.hat === 'Mage_Hat' ? 'wizard' : 'bear';
    const head = buildHead(heads, {
      face: FACE_KITS[d.face] ?? 'Mage', hair: d.hair, beard: d.beard, eyeShape: d.eyeShape, brows: d.brows, nose: d.nose,
      mouth: d.mouth, detail: d.detail, eyeColor: EYE_COLORS[d.eyeColor], flattenEars: d.race !== 'humano', hat: hatKind, race: d.race, skin,
      hairAcc: d.hairAcc, hairAccColor: ACC_COLORS[d.hairAccColor], acc: d.acc, makeup: d.makeup, makeupColor: ACC_COLORS[d.makeupColor], accColor: ACC_COLORS[d.accColor],
    }, headMat, flatMat);
    this.bones.get('head')!.add(head.group);
    this.owned.push(...head.ownedMaterials);
    this.eyes = head.eyes.map((e) => ({ o: e, sy: e.scale.y }));
    this.happy = head.happy;
    head.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) this.owned.push((o as THREE.Mesh).geometry); });

    // Piezas
    if (this.opts.outfit) {
      for (const part of ['Body', 'ArmLeft', 'ArmRight', 'LegLeft', 'LegRight']) this.addSkinned(outfit.kit, `${outfit.kit}_${part}`, mat(outfit.kit, true));
      // Capas desactivadas temporalmente; restaurar esta línea para reactivarlas:
      // if (outfit.cape) { const cm = capeMat(outfit.kit); this.addRigid(outfit.kit, `${outfit.kit}_Cape`, cm); this.addMantle(outfit.kit, outfit.kit, cm); }
    } else {
      const kit = VILLAGER.kit;
      this.addSkinned(kit, `${kit}_Body`, mat(kit, true));
      for (const side of ['Left', 'Right']) {
        this.addSkinned(kit, `${kit}_Arm${side}`, mat(kit, true));
        this.addSkinned(kit, `${kit}_Leg${side}`, mat(kit, true));
      }
      // Restaurar esta línea junto con el selector de capa para habilitar capas en ropa diaria:
      // if (d.cape > 0) { const cm = capeMat(kit); this.addRigid(kit, `${kit}_Cape`, cm); this.addMantle(kit, kit, cm); }
    }
    if (outfit.hat) {
      // el sombrero, un pelín más grande: tapa el pelo sin tener que hundirlo
      // doble cara: el interior del casco/sombrero no debe desaparecer según el ángulo
      const hatMat = mat(outfit.kit, true).clone();
      hatMat.side = THREE.DoubleSide;
      this.owned.push(hatMat);
      const hat = this.addRigid(outfit.kit, outfit.hat, hatMat);
      if (hat) hat.scale.multiplyScalar(1.06);
    }
    for (const it of outfit.items) {
      const o = this.addRigid(it.kit, it.name, mat(it.kit, it.kit === outfit.kit));
      if (it.name === '2H_Staff' && o) this.addGlow(o);
      // el libro cuelga de la mano, agarrado por el canto
      if (it.name === 'Spellbook' && o) { o.quaternion.set(-0.3637, 0.6065, 0.3641, -0.6061).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)); o.position.set(-0.21, 0, 0); }
    }

    // Rasgos del linaje
    this.addRaceTraits(d, head, headMat(FACE_KITS[d.face] ?? 'Mage'), flatMat, hatKind);

    // Animaciones
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of base.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.idle = this.actions.get(outfit.idle) ?? this.actions.get('Idle')!;
    this.idle.play();
    this.applyBodyShape();
    this.mixer.addEventListener('finished', (e) => {
      if (e.action !== this.oneShot) return;
      this.oneShot = null;
      this.playGait(e.action);
    });

    // Sombra de contacto suave
    const shMat = new THREE.MeshBasicMaterial({ map: softDot('rgba(40,20,30,0.35)', 'rgba(40,20,30,0)'), transparent: true, depthWrite: false });
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shMat);
    sh.rotation.x = -PI / 2;
    sh.position.y = 0.005;
    sh.scale.set(0.9, 0.75, 1);
    this.root.add(sh);
    this.owned.push(shMat, shMat.map!, sh.geometry);
  }

  /** Clona una malla con esqueleto de otro modelo y la ata al esqueleto base por nombre de hueso. */
  private addSkinned(kit: Kit, name: string, material: THREE.Material) {
    const src = kits[kit].scene.getObjectByName(name) as THREE.SkinnedMesh | undefined;
    if (!src) return;
    const m = new THREE.SkinnedMesh(src.geometry, material);
    m.name = name;
    const bones = src.skeleton.bones.map((b) => this.bones.get(b.name)!);
    const holder = this.model.getObjectByName(src.parent!.name) ?? this.model;
    holder.add(m);
    m.position.copy(src.position);
    m.quaternion.copy(src.quaternion);
    m.scale.copy(src.scale);
    m.bind(new THREE.Skeleton(bones, src.skeleton.boneInverses), src.bindMatrix);
    m.frustumCulled = false;
    return m;
  }

  /**
   * Parte delantera de la capa: esclavina sobre los hombros con el color de la
   * capa y un broche, para que se vea también de frente.
   */
  private addMantle(bodyKit: Kit, capeKit: Kit, material: THREE.Material) {
    const body = kits[bodyKit].scene.getObjectByName(`${bodyKit}_Body`) as THREE.SkinnedMesh | undefined;
    const cape = kits[capeKit].scene.getObjectByName(`${capeKit}_Cape`) as THREE.Mesh | undefined;
    const chest = this.bones.get('chest');
    if (!body || !cape || !chest) return;
    const ci = body.skeleton.bones.findIndex((b) => b.name === 'chest');
    const toBone = new THREE.Matrix4().multiplyMatrices(body.skeleton.boneInverses[ci], body.bindMatrix);
    // tamaño del torso a la altura de los hombros
    const probe = new THREE.Mesh(body.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const rc = new THREE.Raycaster(), y = 1.13;
    const hitAt = (o: THREE.Vector3, d: THREE.Vector3, fb: number) => { rc.set(o, d); const h = rc.intersectObject(probe)[0]; return h ? h.point : null; };
    const zf = hitAt(new THREE.Vector3(0, y, 2), new THREE.Vector3(0, 0, -1), 0)?.z ?? 0.25;
    const xs = hitAt(new THREE.Vector3(2, y, 0), new THREE.Vector3(-1, 0, 0), 0)?.x ?? 0.3;
    const zb = hitAt(new THREE.Vector3(0, y, -2), new THREE.Vector3(0, 0, 1), 0)?.z ?? -0.25;
    probe.material.dispose();
    // color: el mismo punto de la textura que la capa
    const cuv = (cape.geometry.attributes.uv as THREE.BufferAttribute), count = new Map<number, number>();
    for (let i = 0; i < cuv.count; i++) {
      const c = Math.min(7, Math.floor(cuv.getY(i) * 8)) * 8 + Math.min(7, Math.floor(cuv.getX(i) * 8));
      count.set(c, (count.get(c) ?? 0) + 1);
    }
    const cell = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const u = ((cell % 8) + 0.5) / 8, v = (Math.floor(cell / 8) + 0.5) / 8;
    const g = new THREE.TorusGeometry(1, 0.085, 10, 40);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
    g.rotateX(PI / 2);
    const rx = xs + 0.01, rzF = zf + 0.01, rzB = -zb + 0.01;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setX(i, p.getX(i) * rx);
      p.setZ(i, p.getZ(i) * (p.getZ(i) > 0 ? rzF : rzB));
      // cae un poco por delante y por los lados, como una esclavina
      const fz = Math.max(0, p.getZ(i)) / rzF;
      p.setY(i, p.getY(i) * 0.9 + y - fz * fz * 0.05);
    }
    g.computeVertexNormals();
    g.applyMatrix4(toBone);
    this.owned.push(g);
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    chest.add(m);
    const columns = 8, rows = 4, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const panelWidth = rx * 0.82;
    const capeU = ((cell % 8) + 0.5) / 8, capeV = (Math.floor(cell / 8) + 0.5) / 8;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const panelY = y - 0.08 - t * 0.22;
      const side = hitAt(new THREE.Vector3(2, panelY, 0), new THREE.Vector3(-1, 0, 0), 0)?.x ?? rx;
      const width = Math.min(panelWidth, side * 0.88) * (1 - t * 0.32);
      for (let col = 0; col <= columns; col++) {
        const u = col / columns, x = (u * 2 - 1) * width;
        const panelYDrop = t * (1 - Math.abs(u * 2 - 1)) * 0.04;
        const vertexY = panelY - panelYDrop;
        const curvedZ = rzF * Math.sqrt(Math.max(0.2, 1 - (x / (rx * 1.12)) ** 2));
        const front = hitAt(new THREE.Vector3(x, vertexY, 2), new THREE.Vector3(0, 0, -1), 0)?.z ?? curvedZ;
        positions.push(x, vertexY, front + 0.085);
        uvs.push(capeU, capeV);
        if (row < rows && col < columns) {
          const a = row * (columns + 1) + col, b = a + columns + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const panel = new THREE.BufferGeometry();
    panel.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    panel.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    panel.setIndex(indices);
    panel.computeVertexNormals();
    panel.applyMatrix4(toBone);
    this.owned.push(panel);
    const drapeMaterial = (material as THREE.MeshStandardMaterial).clone();
    drapeMaterial.color.setScalar(0.78);
    drapeMaterial.polygonOffset = true;
    drapeMaterial.polygonOffsetFactor = -1;
    drapeMaterial.polygonOffsetUnits = -1;
    this.owned.push(drapeMaterial);
    const drape = new THREE.Mesh(panel, drapeMaterial);
    drape.castShadow = true;
    chest.add(drape);
    // broche dorado
    const bg = new THREE.SphereGeometry(0.045, 14, 10).scale(1, 1, 0.5).translate(0, y - 0.06, zf + 0.07).applyMatrix4(toBone);
    this.owned.push(bg);
    const gold = new THREE.MeshStandardMaterial({ color: '#e8b84a', roughness: 0.3, metalness: 0.6 });
    this.owned.push(gold);
    chest.add(new THREE.Mesh(bg, gold));
  }

  /** Clona una pieza rígida (sombrero, arma) y la cuelga del mismo hueso en el esqueleto base. */
  private addRigid(kit: Kit, name: string, material: THREE.Material) {
    const src = kits[kit].scene.getObjectByName(name);
    if (!src) return;
    const o = src.clone(true);
    o.traverse((c) => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = material; });
    o.visible = true;
    const parent = this.model.getObjectByName(src.parent!.name) ?? this.model;
    parent.add(o);
    return o;
  }

  private addGlow(staff: THREE.Object3D) {
    const geo = ((staff as THREE.Mesh).geometry ?? (staff.getObjectByProperty('isMesh', true) as THREE.Mesh).geometry);
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const glowMat = new THREE.SpriteMaterial({ map: softDot('rgba(170,255,200,0.9)', 'rgba(80,255,160,0)'), blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Sprite(glowMat);
    glow.position.set((bb.min.x + bb.max.x) / 2, bb.max.y * 0.94, (bb.min.z + bb.max.z) / 2);
    glow.scale.setScalar(0.45);
    staff.add(glow);
    this.glow = glow;
    this.owned.push(glowMat, glowMat.map!);
  }

  private addRaceTraits(d: CharData, head: HeadResult, mat: THREE.Material, flatMat: (c: string) => THREE.Material, hat: string) {
    if (d.race === 'humano') return;
    const bone = this.bones.get('head')!;
    const A = head.anchors;
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const own = <G extends THREE.BufferGeometry>(g: G) => { this.owned.push(g); return g; };
    /** Pivote colocado en un punto del espacio de la malla de la cabeza. */
    const pivot = (p: THREE.Vector3) => {
      const holder = new THREE.Group();
      holder.matrixAutoUpdate = false;
      holder.matrix.copy(head.toBone).multiply(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
      bone.add(holder);
      const g = new THREE.Group();
      holder.add(g);
      return g;
    };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D) => {
      const o = new THREE.Mesh(own(g), m);
      o.castShadow = true;
      parent.add(o);
      return o;
    };
    /** Cono orientado según una dirección y aplanado. */
    const cone = (r: number, h: number, seg: number, dir: THREE.Vector3, flat = 1, roll = 0) => {
      const g = new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0);
      g.scale(1, 1, flat);
      g.rotateY(roll);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()));
      return g;
    };

    if (d.race === 'elfo') {
      for (const s of [-1, 1]) {
        const len = [0.5, 0.3, 0.42][d.trait];
        const dir = d.trait === 2 ? V(s, -0.25, -0.35) : V(s, 0.5, -0.3);
        const g = paintCell(cone(0.1, len, 8, dir, 0.4), 0, 0.15, 0.5);
        mesh(g.translate(-s * 0.02, 0, 0), mat, pivot(A.ear(s)));
      }
    }
    if (d.race === 'pelso') {
      // orejas y cola siguen el pelaje, no el color de pelo
      const coat = coatMark(RACES.pelso.skins[d.skin]);
      const furMat: THREE.Material = coat?.mark === 'mask' ? flatMat(coat.markColor) : mat;
      const innerCol = coat?.ear ?? '#f2a6ae';
      for (const s of [-1, 1]) {
        const g = pivot(A.top(s).add(V(s * 0.02, -0.06, 0)));
        g.rotation.z = -s * 0.3;
        if (d.trait === 2) g.rotation.x = 0.7;
        if (d.trait === 1) {
          const ear = new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
          ear.scale(1, 1.3, 0.5);
          mesh(paintCell(ear.translate(0, -0.05, 0), 0), furMat, g);
          const inner = new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
          inner.scale(1, 1.2, 0.3).translate(0, 0.0, 0.05);
          mesh(inner, flatMat(innerCol), g);
        } else {
          // la base se hunde en la cabeza para que la oreja nazca de ella y no flote
          mesh(paintCell(new THREE.ConeGeometry(0.19, 0.46, 4).rotateY(Math.PI / 4).scale(1, 1, 0.6).translate(0, 0.11, 0), 0), furMat, g);
          mesh(new THREE.ConeGeometry(0.1, 0.26, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3).translate(0, 0.1, 0.07), flatMat(innerCol), g);
        }
        this.ears.push(g);
      }
      this.addTail(furMat, 0, 0.055, 0.035, [[0, 0, 0], [0, -0.1, -0.16], [0, -0.04, -0.34], [0, 0.16, -0.44], [0.04, 0.33, -0.42]]);
    }
    if (d.race === 'lagto') {
      if (hat === 'none' && d.trait === 0) A.crest.forEach((c, i) => {
        const h = [0.16, 0.22, 0.24, 0.22, 0.18, 0.13][i];
        mesh(paintCell(cone(0.09, h, 4, c.n, 1).scale(0.35, 1, 1), 0, 0.5, 0.95), mat, pivot(c.p.clone().addScaledVector(c.n, -0.04)));
      });
      if (hat === 'none' && d.trait === 1) for (const s of [-1, 1]) {
        // cuernos que nacen de la superficie de la cabeza, con la base hundida
        const { p, n } = A.surf(V(s * 0.6, 0.75, -0.25), 0.05);
        const dir = n.clone().multiplyScalar(0.7).add(V(0, 0.15, -0.55));
        mesh(cone(0.075, 0.4, 8, dir), flatMat('#efe4c8'), pivot(p));
      }
      if (d.trait === 2) for (const s of [-1, 1]) {
        // aletas laterales ancladas a la superficie y hundidas en la cabeza
        const { p, n } = A.surf(V(s, -0.05, -0.1), 0.12);
        const dir = n.clone().multiplyScalar(0.8).add(V(0, 0.2, -0.6));
        const g = new THREE.ConeGeometry(0.2, 0.5, 3).translate(0, 0.2, 0);
        g.scale(1, 1, 0.22);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize()));
        mesh(paintCell(g, 0, 0.5, 0.95), mat, pivot(p));
      }
      this.addTail(mat, 0, 0.11, 0.015, [[0, 0, 0], [0, -0.08, -0.2], [0, -0.16, -0.42], [0, -0.17, -0.66]]);
    }
  }

  /** Cola articulada: una cadena de segmentos que se balancea. */
  private addTail(mat: THREE.Material, cell: number, r0: number, r1: number, raw: [number, number, number][]) {
    const hips = this.bones.get('hips')!;
    this.model.updateMatrixWorld(true);
    const sc = 1 / hips.getWorldScale(new THREE.Vector3()).y;
    // que la cola no atraviese el suelo: el punto más bajo queda por encima
    const hipsY = hips.getWorldPosition(new THREE.Vector3()).y - this.root.position.y;
    const lowest = Math.min(...raw.map((p) => p[1])) - 0.02 - r0;
    if (hipsY + lowest < 0.06) { const k = (hipsY - 0.06 - 0.02 - r0) / -Math.min(...raw.map((p) => p[1])); raw = raw.map(([x, y, z]) => [x, y < 0 ? y * Math.max(k, 0) : y, z]); }
    const root = new THREE.Group();
    root.position.set(0, -0.02 * sc, -0.16 * sc);
    hips.add(root);
    const curve = new THREE.CatmullRomCurve3(raw.map((p) => new THREE.Vector3(...p).multiplyScalar(sc)));
    const N = 6;
    const segs: THREE.Object3D[] = [];
    let parent: THREE.Object3D = root, prev = curve.getPoint(0);
    for (let i = 0; i < N; i++) {
      const a = curve.getPoint(i / N), b = curve.getPoint((i + 1) / N);
      const g = new THREE.Group();
      g.position.copy(a.clone().sub(prev));
      parent.add(g);
      const len = a.distanceTo(b);
      const rr = (r0 + (r1 - r0) * ((i + 0.5) / N)) * sc;
      const cg = paintCell(new THREE.CapsuleGeometry(rr, len, 4, 8), cell, 0.2, 0.8);
      this.owned.push(cg);
      const m = new THREE.Mesh(cg, mat);
      m.position.copy(b.clone().sub(a).multiplyScalar(0.5));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.castShadow = true;
      g.add(m);
      segs.push(g);
      parent = g;
      prev = a;
    }
    this.tail = segs;
  }

  // ---------------- Animación ----------------
  private play(name: string) {
    const a = this.actions.get(name);
    if (!a) return 0;
    const from = this.oneShot ?? this.gaitAction();
    this.oneShot = a;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    if (from !== a) from.crossFadeTo(a, 0.2, false);
    return a.getClip().duration;
  }
  private gait: 'idle' | 'walk' | 'run' = 'idle';
  private oneShot: THREE.AnimationAction | null = null;
  private gaitAction(gait = this.gait) {
    return gait === 'idle' ? this.idle : this.actions.get(gait === 'walk' ? 'Walking_A' : 'Running_A') ?? this.idle;
  }
  private playGait(from?: THREE.AnimationAction) {
    const action = this.gaitAction();
    action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (from && from !== action) from.crossFadeTo(action, 0.28, false);
    else action.fadeIn(0.28);
  }
  /** Cambia entre reposo, caminar y correr con transición suave. */
  setGait(g: 'idle' | 'walk' | 'run') {
    if (g === this.gait) return;
    const from = this.gaitAction();
    this.gait = g;
    if (this.oneShot) return;
    this.playGait(from);
  }
  wave() { this.play('Cheer'); this.happyReq = true; }
  hop() { this.play(this.opts.outfit && this.d.cls === 'mago' ? 'Spellcast_Raise' : 'Interact'); }
  private jumpAction: THREE.AnimationAction | null = null;
  private jumpTime = -1;
  private jumpLength = 0;
  /** El salto se mezcla por encima de la locomoción con un peso suave, para que no parezca un clip aparte. */
  jump() {
    const act = this.actions.get('Jump_Full_Short');
    if (!act) return 0;
    if (this.jumpTime >= 0) return this.jumpLength;
    const speed = act.getClip().duration / 0.62;
    act.reset().setLoop(THREE.LoopOnce, 1);
    act.clampWhenFinished = true;
    act.timeScale = speed;
    act.play();
    act.setEffectiveWeight(0);
    this.jumpAction = act;
    this.jumpTime = 0;
    this.jumpLength = act.getClip().duration / speed;
    return this.jumpLength;
  }
  private updateJump(dt: number) {
    if (this.jumpTime < 0 || !this.jumpAction) return;
    this.jumpTime += dt;
    const p = this.jumpTime / this.jumpLength;
    if (p >= 1) { this.jumpAction.stop(); this.jumpAction = null; this.jumpTime = -1; return; }
    const smooth = (a: number, b: number, x: number) => { const k = Math.min(Math.max((x - a) / (b - a), 0), 1); return k * k * (3 - 2 * k); };
    const envelope = smooth(0, 0.2, p) * (1 - smooth(0.55, 0.95, p));
    this.jumpAction.setEffectiveWeight(envelope * 0.4);
  }

  /** Centro aproximado de la cara, para encuadrar la cámara. */
  headWorld(target = new THREE.Vector3()) {
    return this.bones.get('head')!.getWorldPosition(target).add(new THREE.Vector3(0, 0.5 * this.model.scale.y, 0));
  }

  update(t: number) {
    const dt = this.lastT < 0 ? 0 : Math.min(t - this.lastT, 0.1);
    this.lastT = t;
    this.updateJump(dt);
    this.mixer.update(dt);
    // Animation tracks reset bone scales, so reapply the chosen proportions afterward.
    this.applyBodyShape();
    if (this.tail) this.tail.forEach((g, i) => { g.rotation.y = Math.sin(t * 1.6 - i * 0.6) * 0.16; g.rotation.x = Math.sin(t * 1.1 - i * 0.5) * 0.05; });
    this.ears.forEach((e, i) => { e.rotation.x = (e.userData.rx ??= e.rotation.x) - Math.max(0, Math.sin(t * 0.7 + i * 0.4) - 0.97) * 8; });
    if (this.glow) this.glow.scale.setScalar(0.45 + Math.sin(t * 3) * 0.05);
    // parpadeo (a veces doble)
    if (t > this.nextBlink) { this.blinkT = t; this.nextBlink = t + (Math.random() < 0.2 ? 0.25 : 2 + Math.random() * 3.5); }
    const bp = (t - this.blinkT) / 0.14;
    const k = bp >= 0 && bp <= 1 ? Math.max(0.08, Math.abs(bp * 2 - 1)) : 1;
    for (const e of this.eyes) e.o.scale.y = e.sy * k;
    // al saludar, ojos cerrados de alegría (^ ^)
    if (this.happyReq) { this.happyUntil = t + 1.7; this.happyReq = false; }
    const joy = t < this.happyUntil && t > this.happyUntil - 1.45;
    for (const e of this.eyes) e.o.visible = !joy;
    for (const h of this.happy) h.visible = joy;
  }

  private applyBodyShape() {
    const height = this.d.height * 2 - 1;
    const build = this.d.build * 2 - 1;
    const scale = (name: string, x: number, y: number, z: number) => {
      this.bones.get(name)?.scale.set(x, y, z);
    };
    this.model.scale.set(UNIT, UNIT * (1 + height * 0.16), UNIT);
    const hipsX = 1 + build * 0.05, hipsZ = 1 + build * 0.06;
    const spineX = 1 + build * 0.05, spineY = 1, spineZ = 1 + build * 0.08;
    const chestX = 1 + build * 0.08, chestY = 1, chestZ = 1 + build * 0.1;
    scale('hips', hipsX, 1, hipsZ);
    scale('spine', spineX, spineY, spineZ);
    scale('chest', chestX, chestY, chestZ);
    scale('head', (1 + build * 0.015) / (hipsX * spineX * chestX), (1 + build * 0.01) / (spineY * chestY), (1 + build * 0.015) / (hipsZ * spineZ * chestZ));
    for (const side of ['l', 'r']) {
      scale(`upperarm.${side}`, 1 + build * 0.05, 1, 1 + build * 0.05);
      scale(`lowerarm.${side}`, 1 + build * 0.04, 1, 1 + build * 0.04);
      scale(`upperleg.${side}`, 1 + build * 0.06, 1, 1 + build * 0.06);
      scale(`lowerleg.${side}`, 1 + build * 0.05, 1, 1 + build * 0.05);
    }
    this.model.position.y = 0;
  }

  dispose() {
    this.root.removeFromParent();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.owned.forEach((o) => o.dispose());
  }
}

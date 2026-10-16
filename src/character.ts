import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from './load';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import mageUrl from './assets/models/Mage.glb?url';
import knightUrl from './assets/models/Knight.glb?url';
import rogueUrl from './assets/models/Rogue.glb?url';
import barbarianUrl from './assets/models/Barbarian.glb?url';
import { CharData, RACES, CLOTH, HAIR_COLORS, EYE_COLORS } from './data';
import { buildHead, paintCell, smoothNormals, HeadSource, HeadKit, FACE_KITS, HeadResult } from './head';
import { softDot } from './paint';

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
  Mage: { primary: [16, 17, 23, 24, 25, 31], secondary: [18, 26, 33, 41] },
  Rogue: { primary: [16, 17, 24, 25, 33, 41], secondary: [5, 13, 21, 29, 35, 43] },
  Knight: { primary: [16, 24, 34, 42], secondary: [20, 28] },
  Barbarian: { primary: [16, 17, 24, 25, 34, 42], secondary: [33, 41] },
};

interface Outfit { kit: Kit; hat?: string; items: { kit: Kit; name: string }[]; cape: boolean; idle: string }
const OUTFITS: Record<CharData['cls'], Outfit> = {
  guerrero: { kit: 'Knight', hat: 'Knight_Helmet', cape: true, idle: 'Idle', items: [{ kit: 'Knight', name: '1H_Sword' }, { kit: 'Knight', name: 'Badge_Shield' }] },
  mago: { kit: 'Mage', hat: 'Mage_Hat', cape: true, idle: 'Idle', items: [{ kit: 'Mage', name: '2H_Staff' }] },
  picaro: { kit: 'Rogue', cape: true, idle: 'Idle', items: [{ kit: 'Rogue', name: 'Knife' }, { kit: 'Rogue', name: 'Knife_Offhand' }] },
  clerigo: { kit: 'Mage', cape: true, idle: 'Idle', items: [{ kit: 'Mage', name: '1H_Wand' }, { kit: 'Mage', name: 'Spellbook' }] },
  explorador: { kit: 'Barbarian', hat: 'Barbarian_Hat', cape: true, idle: 'Idle', items: [{ kit: 'Rogue', name: '1H_Crossbow' }] },
};
/** Ropa sencilla de aldeano fuera de la pestaña Clase. */
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

/**
 * Toque "premium" para los materiales del personaje: luz de contorno cálida
 * (fresnel) y, en la cabeza, el anillo de brillo del pelo típico del anime.
 */
function charm(m: THREE.MeshStandardMaterial, hairRing = false) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      {
        vec3 vd = normalize(vViewPosition);
        float fr = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.0);
        outgoingLight += vec3(1.0, 0.82, 0.66) * fr * 0.22 * (0.4 + diffuseColor.rgb);
        ${hairRing ? `
        vec2 cell = floor(vMapUv * 8.0);
        if (cell.x == 1.0 && cell.y < 2.0) {
          float ny = normal.y;
          float ring = smoothstep(0.3, 0.5, ny) * (1.0 - smoothstep(0.62, 0.82, ny));
          outgoingLight += (diffuseColor.rgb * 0.7 + 0.18) * ring * 0.55;
        }` : ''}
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => (hairRing ? 'charm-hair' : 'charm');
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
    const h = 0.94 + d.height * 0.12, w = 0.92 + d.build * 0.18;
    const k = UNIT * h;
    this.model.scale.set(k * w, k, k * w);

    // Colores
    const skin = R.skins[d.skin];
    const hair = HAIR_COLORS[d.hairColor];
    const P = this.opts.outfit ? CLOTH[d.primary] : '#d9c9a8';
    const S = this.opts.outfit ? CLOTH[d.secondary] : '#8a5a34';
    const matCache = new Map<string, THREE.MeshStandardMaterial>();
    const mat = (kit: Kit, withCloth: boolean) => {
      const k = kit + withCloth;
      let m = matCache.get(k);
      if (!m) {
        const map: [number[], string][] = [[SKIN, skin], [HAIR, hair]];
        if (withCloth) map.push([CLOTH_CELLS[kit].primary, P], [CLOTH_CELLS[kit].secondary, S]);
        const src = (kits[kit].scene.getObjectByProperty('isMesh', true) as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m = charm(new THREE.MeshStandardMaterial({ map: recolor(src.map!, kit, map), roughness: 0.7, metalness: 0 }));
        matCache.set(k, m);
        this.owned.push(m);
      }
      return m;
    };

    // Cabeza modular: material propio con color de ojos y de boca
    const headMats = new Map<HeadKit, THREE.MeshStandardMaterial>();
    const headMat = (kit: HeadKit) => {
      let m = headMats.get(kit);
      if (!m) {
        const src = (kits[kit].scene.getObjectByProperty('isMesh', true) as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m = charm(new THREE.MeshStandardMaterial({ map: recolor(src.map!, kit, [[SKIN, skin], [HAIR, hair], [[10], EYE_COLORS[d.eyeColor]], [[2], '#6a2c30']]), roughness: 0.6 }), true);
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
      mouth: d.mouth, detail: d.detail, eyeColor: EYE_COLORS[d.eyeColor], fem: d.sex === 1, flattenEars: d.race !== 'humano', hat: hatKind, race: d.race, skin,
    }, headMat, flatMat);
    this.bones.get('head')!.add(head.group);
    this.eyes = head.eyes.map((e) => ({ o: e, sy: e.scale.y }));
    head.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) this.owned.push((o as THREE.Mesh).geometry); });

    // Piezas
    for (const part of ['Body', 'ArmLeft', 'ArmRight', 'LegLeft', 'LegRight']) this.addSkinned(outfit.kit, `${outfit.kit}_${part}`, mat(outfit.kit, true));
    if (outfit.cape) this.addRigid(outfit.kit, `${outfit.kit}_Cape`, mat(outfit.kit, true));
    if (outfit.hat) this.addRigid(outfit.kit, outfit.hat, mat(outfit.kit, true));
    for (const it of outfit.items) {
      const o = this.addRigid(it.kit, it.name, mat(it.kit, it.kit === outfit.kit));
      if (it.name === '2H_Staff' && o) this.addGlow(o);
    }

    // Rasgos del linaje
    this.addRaceTraits(d, head, headMat(FACE_KITS[d.face] ?? 'Mage'), flatMat, hatKind);

    // Animaciones
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of base.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.idle = this.actions.get(outfit.idle) ?? this.actions.get('Idle')!;
    this.idle.play();
    this.mixer.addEventListener('finished', (e) => {
      if (e.action !== this.idle) { this.idle.reset().fadeIn(0.3).play(); e.action.fadeOut(0.3); }
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
      for (const s of [-1, 1]) {
        const g = pivot(A.top(s).add(V(s * 0.02, -0.06, 0)));
        g.rotation.z = -s * 0.3;
        if (d.trait === 2) g.rotation.x = 0.7;
        if (d.trait === 1) {
          const ear = new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
          ear.scale(1, 1.3, 0.5);
          mesh(paintCell(ear, 1), mat, g);
          const inner = new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
          inner.scale(1, 1.2, 0.3).translate(0, 0.0, 0.05);
          mesh(inner, flatMat('#f2a6ae'), g);
        } else {
          mesh(paintCell(new THREE.ConeGeometry(0.17, 0.34, 4).rotateY(Math.PI / 4).scale(1, 1, 0.55).translate(0, 0.17, 0), 1), mat, g);
          mesh(new THREE.ConeGeometry(0.1, 0.24, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3).translate(0, 0.12, 0.055), flatMat('#f2a6ae'), g);
        }
        this.ears.push(g);
      }
      this.addTail(mat, 1, 0.055, 0.035, [[0, 0, 0], [0, -0.1, -0.16], [0, -0.04, -0.34], [0, 0.16, -0.44], [0.04, 0.33, -0.42]]);
    }
    if (d.race === 'lagto') {
      if (hat === 'none' && d.trait === 0) A.crest.forEach((c, i) => {
        const h = [0.16, 0.22, 0.24, 0.22, 0.18, 0.13][i];
        mesh(paintCell(cone(0.09, h, 4, c.n, 1).scale(0.35, 1, 1), 0, 0.5, 0.95), mat, pivot(c.p.clone().addScaledVector(c.n, -0.04)));
      });
      if (hat === 'none' && d.trait === 1) for (const s of [-1, 1]) {
        const base = A.crest[1].p.clone().add(V(s * 0.22, -0.06, -0.05));
        mesh(cone(0.07, 0.36, 8, V(s * 0.35, 0.6, -0.75)), flatMat('#efe4c8'), pivot(base));
      }
      if (d.trait === 2) for (const s of [-1, 1]) {
        const g = new THREE.ConeGeometry(0.16, 0.34, 3).translate(0, 0.17, 0);
        g.scale(1, 1, 0.2);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(s, 0.15, -0.7).normalize()));
        mesh(paintCell(g, 0, 0.5, 0.95), mat, pivot(A.ear(s)));
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
    if (!a) return;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.fadeIn(0.25).play();
    this.idle.fadeOut(0.25);
  }
  private gait: 'idle' | 'walk' | 'run' = 'idle';
  /** Cambia entre reposo, caminar y correr con transición suave. */
  setGait(g: 'idle' | 'walk' | 'run') {
    if (g === this.gait) return;
    const pick = (x: string) => (x === 'idle' ? this.idle : this.actions.get(x === 'walk' ? 'Walking_A' : 'Running_A')!);
    const from = pick(this.gait), to = pick(g);
    this.mixer.stopAllAction();
    from.play();
    to.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    from.crossFadeTo(to, 0.2, false);
    this.gait = g;
  }
  wave() { this.play('Cheer'); }
  hop() { this.play(this.opts.outfit && this.d.cls === 'mago' ? 'Spellcast_Raise' : 'Interact'); }

  /** Centro aproximado de la cara, para encuadrar la cámara. */
  headWorld(target = new THREE.Vector3()) {
    return this.bones.get('head')!.getWorldPosition(target).add(new THREE.Vector3(0, 0.5 * this.model.scale.y, 0));
  }

  update(t: number) {
    const dt = this.lastT < 0 ? 0 : Math.min(t - this.lastT, 0.1);
    this.lastT = t;
    this.mixer.update(dt);
    if (this.tail) this.tail.forEach((g, i) => { g.rotation.y = Math.sin(t * 1.6 - i * 0.6) * 0.16; g.rotation.x = Math.sin(t * 1.1 - i * 0.5) * 0.05; });
    this.ears.forEach((e, i) => { e.rotation.x = (e.userData.rx ??= e.rotation.x) - Math.max(0, Math.sin(t * 0.7 + i * 0.4) - 0.97) * 8; });
    if (this.glow) this.glow.scale.setScalar(0.45 + Math.sin(t * 3) * 0.05);
    // parpadeo (a veces doble)
    if (t > this.nextBlink) { this.blinkT = t; this.nextBlink = t + (Math.random() < 0.2 ? 0.25 : 2 + Math.random() * 3.5); }
    const bp = (t - this.blinkT) / 0.14;
    const k = bp >= 0 && bp <= 1 ? Math.max(0.08, Math.abs(bp * 2 - 1)) : 1;
    for (const e of this.eyes) e.o.scale.y = e.sy * k;
  }

  dispose() {
    this.root.removeFromParent();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.owned.forEach((o) => o.dispose());
  }
}

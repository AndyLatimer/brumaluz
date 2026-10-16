import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import mageUrl from './assets/models/Mage.glb?url';
import knightUrl from './assets/models/Knight.glb?url';
import rogueUrl from './assets/models/Rogue.glb?url';
import barbarianUrl from './assets/models/Barbarian.glb?url';
import { CharData, RACES, CLOTH, HAIR_COLORS, FACES } from './data';
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

export async function loadKits() {
  const loader = new GLTFLoader();
  await Promise.all((Object.keys(URLS) as Kit[]).map(async (k) => { kits[k] = await loader.loadAsync(URLS[k]); }));
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
        m = new THREE.MeshStandardMaterial({ map: recolor(src.map!, kit, map), roughness: 0.7, metalness: 0 });
        matCache.set(k, m);
        this.owned.push(m);
      }
      return m;
    };

    // Piezas
    const face = FACES[d.sex][d.face] ?? FACES[d.sex][0];
    const headKit = face.head as Kit;
    this.addSkinned(headKit, `${headKit}_Head`, mat(headKit, false));
    for (const part of ['Body', 'ArmLeft', 'ArmRight', 'LegLeft', 'LegRight']) this.addSkinned(outfit.kit, `${outfit.kit}_${part}`, mat(outfit.kit, true));
    if (outfit.cape) this.addRigid(outfit.kit, `${outfit.kit}_Cape`, mat(outfit.kit, true));
    if (outfit.hat) this.addRigid(outfit.kit, outfit.hat, mat(outfit.kit, true));
    for (const it of outfit.items) {
      const o = this.addRigid(it.kit, it.name, mat(it.kit, it.kit === outfit.kit));
      if (it.name === '2H_Staff' && o) this.addGlow(o);
    }

    // Rasgos del linaje
    this.addRaceTraits(d, skin, hair, !!outfit.hat, `${headKit}_Head`);

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

  private addRaceTraits(d: CharData, skin: string, hair: string, hat: boolean, headName: string) {
    if (d.race === 'humano') return;
    const head = this.bones.get('head')!;
    const hips = this.bones.get('hips')!;
    this.model.updateMatrixWorld(true);
    // caja de la cabeza en el espacio del hueso
    const headMesh = this.model.getObjectByName(headName) as THREE.SkinnedMesh;
    headMesh.computeBoundingBox();
    const hb = headMesh.boundingBox!.clone().applyMatrix4(headMesh.matrixWorld);
    const corners = [hb.min, hb.max].flatMap((a) => [hb.min, hb.max].flatMap((b) => [hb.min, hb.max].map((c) => head.worldToLocal(new THREE.Vector3(a.x, b.y, c.z)))));
    const lb = new THREE.Box3().setFromPoints(corners);
    const hc = lb.getCenter(new THREE.Vector3());
    const hsz = lb.getSize(new THREE.Vector3());
    const hw = hsz.x / 2, hh = hsz.y / 2, hd = hsz.z / 2;

    const smooth = (c: THREE.ColorRepresentation, rough = 0.75) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: rough }); this.owned.push(m); return m; };
    const skinM = smooth(skin), hairM = smooth(hair, 0.6), innerM = smooth('#f2a6ae');
    const geo = <G extends THREE.BufferGeometry>(g: G) => { this.owned.push(g); return g; };

    if (d.race === 'elfo') {
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(hc.x + s * hw * 0.86, hc.y - hh * 0.12, hc.z - hd * 0.02);
        const len = [0.62, 0.36, 0.5][d.trait] * hh;
        const ear = new THREE.Mesh(geo(new THREE.ConeGeometry(hh * 0.14, len, 10).translate(0, len / 2, 0)), skinM);
        ear.scale.z = 0.45;
        ear.rotation.z = -s * (d.trait === 2 ? 2.1 : 1.2);
        ear.rotation.y = s * 0.3;
        g.add(ear);
        head.add(g);
      }
    }
    if (d.race === 'pelso') {
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(hc.x + s * hw * 0.52, hc.y + hh * (hat ? 1.05 : 0.82), hc.z - hd * 0.1);
        g.rotation.z = -s * 0.3;
        const H = hh * (d.trait === 1 ? 0.4 : 0.55), Rr = hh * (d.trait === 1 ? 0.24 : 0.22);
        let outer: THREE.Mesh;
        if (d.trait === 1) {
          outer = new THREE.Mesh(geo(new THREE.SphereGeometry(Rr, 14, 8, 0, PI * 2, 0, PI / 2)), hairM);
          outer.scale.set(1, 1.4, 0.5);
        } else {
          outer = new THREE.Mesh(geo(new THREE.ConeGeometry(Rr, H, 4, 1).translate(0, H / 2, 0)), hairM);
          outer.scale.z = 0.5;
          outer.rotation.y = PI / 4;
          const inner = new THREE.Mesh(geo(new THREE.ConeGeometry(Rr * 0.6, H * 0.72, 4, 1).translate(0, H * 0.36, 0)), innerM);
          inner.scale.z = 0.3;
          inner.rotation.y = PI / 4;
          inner.position.set(0, Rr * 0.06, Rr * 0.14);
          g.add(inner);
        }
        if (d.trait === 2) g.rotation.x = 0.85;
        g.add(outer);
        head.add(g);
        this.ears.push(g);
      }
      this.addTail(hips, hairM, 0.05, 0.03, [[0, 0, 0], [0, -0.12, -0.16], [0, -0.05, -0.34], [0, 0.18, -0.44], [0.04, 0.36, -0.42]]);
    }
    if (d.race === 'lagto') {
      const crestM = smooth(new THREE.Color(skin).multiplyScalar(0.62), 0.5);
      if (!hat && d.trait === 0) for (let i = 0; i < 5; i++) {
        const f = 0.45 - i * 0.32;
        const sp = new THREE.Mesh(geo(new THREE.ConeGeometry(hh * 0.13, hh * (0.45 - i * 0.05), 6).translate(0, hh * 0.2, 0)), crestM);
        sp.position.set(hc.x, hc.y + Math.cos(f) * hh * 0.92, hc.z + Math.sin(f) * hd * 0.92);
        sp.rotation.x = f;
        sp.scale.x = 0.45;
        head.add(sp);
      }
      if (!hat && d.trait === 1) for (const s of [-1, 1]) {
        const c = new THREE.Mesh(geo(new THREE.ConeGeometry(hh * 0.12, hh * 0.65, 10).translate(0, hh * 0.32, 0)), smooth('#efe4c8', 0.4));
        c.position.set(hc.x + s * hw * 0.45, hc.y + hh * 0.72, hc.z - hd * 0.25);
        c.rotation.set(-0.75, 0, -s * 0.35);
        head.add(c);
      }
      if (d.trait === 2) for (const s of [-1, 1]) {
        const fin = new THREE.Mesh(geo(new THREE.ConeGeometry(hh * 0.3, hh * 0.6, 3).translate(0, hh * 0.3, 0)), crestM);
        fin.position.set(hc.x + s * hw * 0.88, hc.y - hh * 0.05, hc.z - hd * 0.1);
        fin.rotation.set(0, s * 0.3, -s * 1.35);
        fin.scale.z = 0.2;
        head.add(fin);
      }
      this.addTail(hips, skinM, 0.12, 0.012, [[0, 0, 0], [0, -0.18, -0.2], [0, -0.38, -0.42], [0, -0.45, -0.66]]);
    }
  }

  /** Cola articulada: una cadena de segmentos que se balancea. */
  private addTail(hips: THREE.Bone, mat: THREE.Material, r0: number, r1: number, raw: [number, number, number][]) {
    const sc = 1 / hips.getWorldScale(new THREE.Vector3()).y;
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
      const cg = new THREE.CapsuleGeometry(rr, len, 6, 12);
      this.owned.push(cg);
      const m = new THREE.Mesh(cg, mat);
      m.position.copy(b.clone().sub(a).multiplyScalar(0.5));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
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
  }

  dispose() {
    this.root.removeFromParent();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.owned.forEach((o) => o.dispose());
  }
}

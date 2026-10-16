import * as THREE from 'three';
import n0003 from '@pmndrs/assets/normals/0003.webp';
import n0004 from '@pmndrs/assets/normals/0004.webp';
import n0006 from '@pmndrs/assets/normals/0006.webp';
import n0010 from '@pmndrs/assets/normals/0010.webp';
import n0011 from '@pmndrs/assets/normals/0011.webp';
import n0014 from '@pmndrs/assets/normals/0014.webp';
import n0018 from '@pmndrs/assets/normals/0018.webp';
import n0019 from '@pmndrs/assets/normals/0019.webp';
import n0021 from '@pmndrs/assets/normals/0021.webp';
import n0024 from '@pmndrs/assets/normals/0024.webp';
import n0026 from '@pmndrs/assets/normals/0026.webp';
import n0027 from '@pmndrs/assets/normals/0027.webp';

// ---------------------------------------------------------------------------
// Texturas "pintadas a mano" generadas por código.
// Cada textura es un mapa de detalle en escala de grises (~0.8 de media) que el
// shader multiplica por el color del material. Así cambiar colores es gratis.
// ---------------------------------------------------------------------------

export type Kind =
  | 'plain' | 'skin' | 'cloth' | 'leather' | 'metal' | 'hair' | 'wood'
  | 'stone' | 'cobble' | 'grass' | 'fur' | 'roof' | 'plaster' | 'leaf' | 'scales' | 'silk';

const SIZE = 256;
const texCache = new Map<Kind, THREE.Texture>();

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

// Dibuja con repetición en los bordes para que la textura sea continua.
function tiled(fn: (ox: number, oy: number) => void) {
  for (const ox of [-SIZE, 0, SIZE]) for (const oy of [-SIZE, 0, SIZE]) fn(ox, oy);
}

function dab(ctx: Ctx, x: number, y: number, w: number, h: number, rot: number, v: number, a: number) {
  ctx.fillStyle = `rgba(${v},${v},${v},${a})`;
  tiled((ox, oy) => {
    ctx.save();
    ctx.translate(x + ox, y + oy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(w, 0.5), Math.max(h, 0.5), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function line(ctx: Ctx, pts: [number, number][], width: number, v: number, a: number) {
  ctx.strokeStyle = `rgba(${v},${v},${v},${a})`;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  tiled((ox, oy) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + ox, y + oy) : ctx.moveTo(x + ox, y + oy)));
    ctx.stroke();
  });
}

const painters: Record<Kind, (ctx: Ctx, r: () => number) => void> = {
  plain(ctx, r) {
    for (let i = 0; i < 160; i++) dab(ctx, r() * SIZE, r() * SIZE, 10 + r() * 30, 6 + r() * 14, r() * 3, 190 + r() * 30, 0.12);
  },
  skin(ctx, r) {
    for (let i = 0; i < 260; i++) dab(ctx, r() * SIZE, r() * SIZE, 10 + r() * 28, 6 + r() * 12, r() * 3, 192 + r() * 24, 0.14);
  },
  cloth(ctx, r) {
    for (let i = 0; i < 520; i++) {
      const rot = (r() < 0.5 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.3;
      dab(ctx, r() * SIZE, r() * SIZE, 8 + r() * 22, 1.5 + r() * 3, rot, 170 + r() * 65, 0.22);
    }
    for (let y = 0; y < SIZE; y += 4) line(ctx, [[0, y], [SIZE, y]], 1, 120, 0.05);
    for (let x = 0; x < SIZE; x += 4) line(ctx, [[x, 0], [x, SIZE]], 1, 120, 0.04);
    // pliegues
    for (let i = 0; i < 14; i++) {
      const x = r() * SIZE;
      line(ctx, [[x, 0], [x + (r() - 0.5) * 30, SIZE * 0.5], [x + (r() - 0.5) * 30, SIZE]], 6 + r() * 8, 150, 0.12);
      line(ctx, [[x + 7, 0], [x + 7 + (r() - 0.5) * 20, SIZE]], 3, 240, 0.1);
    }
  },
  leather(ctx, r) {
    for (let i = 0; i < 380; i++) dab(ctx, r() * SIZE, r() * SIZE, 6 + r() * 18, 4 + r() * 10, r() * 3, 150 + r() * 80, 0.2);
    for (let i = 0; i < 26; i++) {
      const x = r() * SIZE, y = r() * SIZE;
      line(ctx, [[x, y], [x + (r() - 0.5) * 40, y + (r() - 0.5) * 20], [x + (r() - 0.5) * 60, y + (r() - 0.5) * 30]], 1.5, 110, 0.35);
    }
    for (const y of [10, SIZE - 10]) for (let x = 0; x < SIZE; x += 12) line(ctx, [[x, y], [x + 6, y]], 2, 240, 0.6);
  },
  metal(ctx, r) {
    const g = ctx.createLinearGradient(0, 0, 0, SIZE);
    g.addColorStop(0, 'rgba(255,255,255,0.25)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 260; i++) dab(ctx, r() * SIZE, r() * SIZE, 30 + r() * 90, 1 + r() * 2.5, (r() - 0.5) * 0.1, 120 + r() * 100, 0.3);
    for (let i = 0; i < 40; i++) {
      const x = r() * SIZE, y = r() * SIZE, a = r() * Math.PI;
      line(ctx, [[x, y], [x + Math.cos(a) * 14, y + Math.sin(a) * 14]], 1, 255, 0.5);
    }
  },
  hair(ctx, r) {
    for (let i = 0; i < 1100; i++) {
      const x = r() * SIZE, y = r() * SIZE, len = 40 + r() * 120, bend = (r() - 0.5) * 10;
      line(ctx, [[x, y], [x + bend, y + len * 0.5], [x + bend * 0.5, y + len]], 1 + r() * 2.5, 110 + r() * 145, 0.3);
    }
    // franja de brillo pintada (anisotrópica)
    for (let i = 0; i < 300; i++) {
      const x = r() * SIZE, y = SIZE * (0.22 + r() * 0.12);
      line(ctx, [[x, y], [x + (r() - 0.5) * 4, y + 10 + r() * 20]], 1.5, 255, 0.35);
    }
  },
  wood(ctx, r) {
    for (let i = 0; i < 70; i++) {
      const y = r() * SIZE, amp = 2 + r() * 5, ph = r() * 6;
      const pts: [number, number][] = [];
      for (let x = 0; x <= SIZE; x += 16) pts.push([x, y + Math.sin(x / 40 + ph) * amp]);
      line(ctx, pts, 1 + r() * 3, 130 + r() * 110, 0.35);
    }
    for (let i = 0; i < 4; i++) {
      const x = r() * SIZE, y = r() * SIZE;
      dab(ctx, x, y, 10, 5, 0, 110, 0.5);
      dab(ctx, x, y, 5, 2.5, 0, 80, 0.6);
    }
  },
  stone(ctx, r) {
    for (let i = 0; i < 400; i++) dab(ctx, r() * SIZE, r() * SIZE, 6 + r() * 22, 4 + r() * 14, r() * 3, 150 + r() * 90, 0.18);
    for (let i = 0; i < 18; i++) {
      const x = r() * SIZE, y = r() * SIZE;
      line(ctx, [[x, y], [x + (r() - 0.5) * 30, y + r() * 20], [x + (r() - 0.5) * 40, y + r() * 40]], 1.5, 90, 0.4);
    }
  },
  cobble(ctx, r) {
    ctx.fillStyle = 'rgb(95,95,95)'; ctx.fillRect(0, 0, SIZE, SIZE);
    const n = 8, c = SIZE / n;
    for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
      const off = gy % 2 ? c / 2 : 0;
      const cx = gx * c + off + (r() - 0.5) * 6, cy = gy * c + c / 2 + (r() - 0.5) * 6;
      const w = c * 0.43, h = c * 0.4, v = 175 + r() * 50;
      tiled((ox, oy) => {
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.beginPath(); ctx.ellipse(cx + ox, cy + oy, w, h, (r() - 0.5) * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.ellipse(cx + ox - 3, cy + oy - 4, w * 0.7, h * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.ellipse(cx + ox + 2, cy + oy + h * 0.55, w * 0.8, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      });
      for (let k = 0; k < 4; k++) dab(ctx, cx + (r() - 0.5) * w, cy + (r() - 0.5) * h, 3 + r() * 6, 2 + r() * 4, r() * 3, 150 + r() * 90, 0.25);
    }
  },
  grass(ctx, r) {
    for (let i = 0; i < 200; i++) dab(ctx, r() * SIZE, r() * SIZE, 10 + r() * 30, 8 + r() * 20, r() * 3, 170 + r() * 60, 0.15);
    for (let i = 0; i < 1400; i++) {
      const x = r() * SIZE, y = r() * SIZE, h = 4 + r() * 9;
      line(ctx, [[x, y], [x + (r() - 0.5) * 4, y - h]], 1.5, 150 + r() * 105, 0.4);
    }
  },
  fur(ctx, r) {
    for (let i = 0; i < 1500; i++) {
      const x = r() * SIZE, y = r() * SIZE, a = Math.PI / 2 + (r() - 0.5) * 0.8, l = 5 + r() * 9;
      line(ctx, [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 1.5 + r(), 140 + r() * 115, 0.45);
    }
  },
  roof(ctx, r) {
    const rows = 10, rh = SIZE / rows;
    for (let row = 0; row < rows; row++) {
      const cols = 8, cw = SIZE / cols, off = row % 2 ? cw / 2 : 0;
      for (let col = 0; col < cols; col++) {
        const x = col * cw + off, y = row * rh, v = 160 + r() * 70;
        tiled((ox, oy) => {
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.beginPath(); ctx.roundRect(x + ox + 1, y + oy + 1, cw - 2, rh + 4, [0, 0, 8, 8]); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(x + ox + 1, y + oy + rh, cw - 2, 3);
        });
      }
    }
  },
  plaster(ctx, r) {
    for (let i = 0; i < 300; i++) dab(ctx, r() * SIZE, r() * SIZE, 10 + r() * 30, 6 + r() * 18, r() * 3, 185 + r() * 50, 0.16);
    for (let i = 0; i < 10; i++) dab(ctx, r() * SIZE, r() * SIZE, 8 + r() * 10, 4 + r() * 6, r() * 3, 150, 0.25);
  },
  scales(ctx, r) {
    const n = 10, c = SIZE / n;
    for (let gy = 0; gy < n * 2; gy++) for (let gx = 0; gx < n; gx++) {
      const x = gx * c + (gy % 2 ? c / 2 : 0), y = gy * c * 0.5;
      const v = 175 + r() * 50;
      tiled((ox, oy) => {
        const g = ctx.createRadialGradient(x + ox, y + oy - c * 0.15, 1, x + ox, y + oy, c * 0.62);
        g.addColorStop(0, `rgb(${v + 30},${v + 30},${v + 30})`);
        g.addColorStop(0.75, `rgb(${v},${v},${v})`);
        g.addColorStop(1, 'rgb(120,120,120)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x + ox, y + oy, c * 0.55, c * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      });
    }
  },
  silk(ctx, r) {
    for (let i = 0; i < 220; i++) dab(ctx, r() * SIZE, r() * SIZE, 20 + r() * 50, 3 + r() * 6, (r() - 0.5) * 0.4, 185 + r() * 50, 0.14);
  },
  leaf(ctx, r) {
    for (let i = 0; i < 700; i++) {
      const v = 130 + r() * 125;
      dab(ctx, r() * SIZE, r() * SIZE, 5 + r() * 8, 3 + r() * 4, r() * 3, v, 0.45);
    }
  },
};

export function detailTex(kind: Kind): THREE.Texture {
  let t = texCache.get(kind);
  if (t) return t;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(204,204,204)';
  ctx.fillRect(0, 0, SIZE, SIZE);
  painters[kind](ctx, mulberry32(kind.length * 9973 + kind.charCodeAt(0) * 31));
  t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  texCache.set(kind, t);
  return t;
}

// Patrones (blanco = marca): rayas de gato atigrado y manchas de lagarto.
const patCache = new Map<string, THREE.Texture>();
export function patternTex(kind: 'stripes' | 'spots'): THREE.Texture {
  let t = patCache.get(kind);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE);
  const r = mulberry32(kind === 'stripes' ? 11 : 23);
  if (kind === 'stripes') {
    for (let i = 0; i < 9; i++) {
      const y = (i / 9) * SIZE + r() * 8, amp = 6 + r() * 8, ph = r() * 6;
      const pts: [number, number][] = [];
      for (let x = 0; x <= SIZE; x += 8) pts.push([x, y + Math.sin(x / 30 + ph) * amp]);
      line(ctx, pts, 7 + r() * 8, 255, 0.9);
    }
  } else {
    for (let i = 0; i < 40; i++) dab(ctx, r() * SIZE, r() * SIZE, 6 + r() * 12, 5 + r() * 10, r() * 3, 255, 0.9);
  }
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  patCache.set(kind, t);
  return t;
}

// Iris pintado, colocado donde mira la esfera (u = 0.25, v = 0.5).
const irisCache = new Map<string, THREE.Texture>();
export function irisTex(color: string, slit: boolean, sclera = '#fbf6ee'): THREE.Texture {
  const key = color + slit + sclera;
  let t = irisCache.get(key);
  if (t) return t;
  const W = 512, H = 256, cx = 128, cy = 128, R = 54;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = sclera; ctx.fillRect(0, 0, W, H);
  const col = new THREE.Color(color);
  const css = (k: number, l = 0) => {
    const cc = col.clone().multiplyScalar(k).lerp(new THREE.Color('#ffffff'), l);
    return `rgb(${Math.min(255, cc.r * 255) | 0},${Math.min(255, cc.g * 255) | 0},${Math.min(255, cc.b * 255) | 0})`;
  };
  const g = ctx.createRadialGradient(cx, cy + 10, 4, cx, cy, R);
  g.addColorStop(0, css(1.1, 0.45));
  g.addColorStop(0.45, css(1.0, 0.1));
  g.addColorStop(0.85, css(0.7));
  g.addColorStop(1, css(0.35));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  const r = mulberry32(5);
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, r0 = R * (0.3 + r() * 0.2), r1 = R * (0.75 + r() * 0.2);
    ctx.strokeStyle = r() < 0.5 ? css(1.3, 0.35) : css(0.6);
    ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = css(0.25); ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, Math.PI * 2); ctx.stroke();
  // sombra del párpado superior
  const sh = ctx.createLinearGradient(0, cy - R, 0, cy - R * 0.2);
  sh.addColorStop(0, 'rgba(20,10,20,0.45)'); sh.addColorStop(1, 'rgba(20,10,20,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#120a10';
  ctx.beginPath();
  if (slit) ctx.ellipse(cx, cy, 7, R * 0.82, 0, 0, Math.PI * 2);
  else ctx.arc(cx, cy, R * 0.4, 0, Math.PI * 2);
  ctx.fill();
  t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  irisCache.set(key, t);
  return t;
}

// ---------------------------------------------------------------------------
// Materiales PBR "pintados": MeshPhysicalMaterial (luz real, sombras, reflejos
// del HDRI, terciopelo en telas, barniz en ojos y metal) más inyecciones propias:
// proyección triplanar para las mallas esculpidas, tintes por zona, oclusión
// horneada, relieve fotográfico, brillo anisotrópico de pelo y luz de borde.
// ---------------------------------------------------------------------------


export const world = {
  uTime: { value: 0 },
};

const loader = new THREE.TextureLoader();
const nrmCache = new Map<string, THREE.Texture>();
function nrmTex(url: string) {
  let t = nrmCache.get(url);
  if (!t) {
    t = loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    nrmCache.set(url, t);
  }
  return t;
}

/** Comportamiento físico de cada tipo de superficie. */
interface Surface { rough: number; metal?: number; sheen?: number; coat?: number; nrm?: string; nScale?: number; nRepeat?: number }
const SURF: Record<Kind, Surface> = {
  plain: { rough: 0.6 },
  skin: { rough: 0.58, sheen: 0.35, nrm: n0021, nScale: 0.25, nRepeat: 3 },
  fur: { rough: 0.85, sheen: 0.8, nrm: n0011, nScale: 0.35, nRepeat: 2 },
  scales: { rough: 0.42, coat: 0.25, nrm: n0027, nScale: 0.7, nRepeat: 1.6 },
  cloth: { rough: 0.88, sheen: 0.7, nrm: n0014, nScale: 0.45, nRepeat: 1.4 },
  silk: { rough: 0.42, sheen: 1, nrm: n0014, nScale: 0.2, nRepeat: 1.2 },
  leather: { rough: 0.55, coat: 0.18, nrm: n0003, nScale: 0.55, nRepeat: 1.6 },
  metal: { rough: 0.32, metal: 0.92, coat: 0.3, nrm: n0004, nScale: 0.3, nRepeat: 1 },
  hair: { rough: 0.5, sheen: 0.3, nrm: n0019, nScale: 0.6, nRepeat: 2.5 },
  wood: { rough: 0.72, nrm: n0019, nScale: 0.7, nRepeat: 1 },
  stone: { rough: 0.9, nrm: n0024, nScale: 0.8, nRepeat: 1 },
  cobble: { rough: 0.85, nrm: n0026, nScale: 0.9, nRepeat: 1 },
  grass: { rough: 0.95, nrm: n0010, nScale: 0.5, nRepeat: 1 },
  roof: { rough: 0.85, nrm: n0018, nScale: 0.5, nRepeat: 1 },
  plaster: { rough: 0.95, nrm: n0006, nScale: 0.6, nRepeat: 1 },
  leaf: { rough: 0.8, sheen: 0.4, nrm: n0010, nScale: 0.5, nRepeat: 1 },
};

export interface PaintOpts {
  /** Malla esculpida: textura triplanar + tintes y oclusión por vértice. */
  sdf?: boolean;
  triScale?: number;
  map?: THREE.Texture;
  pattern?: 'stripes' | 'spots';
  patternAmt?: number;
  light?: THREE.ColorRepresentation;
  dark?: THREE.ColorRepresentation;
  blush?: THREE.ColorRepresentation;
  sss?: number;
  hair?: boolean;
  rim?: number;
  spec?: number;
  emissive?: number;
  texAmt?: number;
  ground?: number;
  repeat?: [number, number];
  side?: THREE.Side;
  wave?: number;
  rough?: number;
  metal?: number;
  coat?: number;
}

const VERT_HEAD = /* glsl */ `
  uniform vec2 uRepeat;
  uniform float uWave;
  uniform float uTime;
  uniform float uTriScale;
  varying vec2 vDUv;
  #ifdef TRI
    attribute vec3 tint;
    attribute float ao;
    varying vec3 vTint;
    varying float vAO;
    varying vec3 vObjP;
    varying vec3 vObjN;
  #endif
`;
const VERT_BODY = /* glsl */ `
  #ifdef TRI
    vDUv = vec2(0.0);
    vTint = tint;
    vAO = ao;
    vObjP = position * uTriScale;
    vObjN = normal;
  #else
    vDUv = uv * uRepeat;
    if (uWave > 0.0) {
      float kw = 1.0 - uv.y;
      transformed.z += sin(uTime * 2.2 + transformed.y * 3.0 + transformed.x * 2.0) * uWave * kw;
      transformed.x += cos(uTime * 1.7 + transformed.y * 2.0) * uWave * 0.4 * kw;
    }
  #endif
`;

const FRAG_HEAD = /* glsl */ `
  uniform sampler2D uDetail;
  uniform float uTexAmt;
  uniform sampler2D uNrm;
  uniform float uNrmScale;
  uniform float uNrmRepeat;
  uniform sampler2D uPattern;
  uniform float uPatternAmt;
  uniform vec3 uLight;
  uniform vec3 uDark;
  uniform vec3 uBlush;
  uniform float uRim;
  uniform float uSSS;
  uniform mat3 normalMatrix;
  varying vec2 vDUv;
  #ifdef TRI
    varying vec3 vTint;
    varying float vAO;
    varying vec3 vObjP;
    varying vec3 vObjN;
    vec3 triW() { vec3 b = pow(abs(normalize(vObjN)), vec3(4.0)); return b / (b.x + b.y + b.z); }
    float tri(sampler2D t, float k) {
      vec3 bw = triW(); vec3 p = vObjP * k;
      return texture2D(t, p.zy).r * bw.x + texture2D(t, p.xz).r * bw.y + texture2D(t, p.xy).r * bw.z;
    }
    // relieve triplanar (mezcla "whiteout")
    vec3 triNormal(vec3 n) {
      vec3 bw = triW(); vec3 p = vObjP * uNrmRepeat;
      vec3 tx = texture2D(uNrm, p.zy).xyz * 2.0 - 1.0;
      vec3 ty = texture2D(uNrm, p.xz).xyz * 2.0 - 1.0;
      vec3 tz = texture2D(uNrm, p.xy).xyz * 2.0 - 1.0;
      tx.xy *= uNrmScale; ty.xy *= uNrmScale; tz.xy *= uNrmScale;
      tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
      ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
      tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
      return normalize(tx.zyx * bw.x + ty.xzy * bw.y + tz.xyz * bw.z);
    }
  #endif
`;

const FRAG_MAP = /* glsl */ `
  #include <map_fragment>
  float detailTex = 1.0;
  #ifndef COLORMAP
    #ifdef TRI
      detailTex = mix(1.0, tri(uDetail, 1.0) * 1.25, uTexAmt);
    #else
      detailTex = mix(1.0, texture2D(uDetail, vDUv).r * 1.25, uTexAmt);
    #endif
    diffuseColor.rgb *= detailTex;
  #endif
  #ifdef TRI
    diffuseColor.rgb = mix(diffuseColor.rgb, uLight * mix(1.0, detailTex, 0.6), clamp(vTint.x, 0.0, 1.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, uDark * detailTex, clamp(vTint.y, 0.0, 1.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, uBlush * detailTex, clamp(vTint.z, 0.0, 1.0) * 0.5);
    if (uPatternAmt > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, uDark * detailTex, tri(uPattern, 1.0) * uPatternAmt * (1.0 - clamp(vTint.x, 0.0, 1.0)));
  #endif
`;

const FRAG_ROUGH = /* glsl */ `
  #include <roughnessmap_fragment>
  #ifdef TRI
    // labios: más brillantes
    roughnessFactor = mix(roughnessFactor, 0.28, smoothstep(0.9, 1.0, vTint.z));
  #endif
`;

const FRAG_NORMAL = /* glsl */ `
  #include <normal_fragment_maps>
  #ifdef TRI
    if (uNrmScale > 0.0) {
      vec3 n0 = normalize(vObjN);
      vec3 delta = triNormal(n0) - n0;
      normal = normalize(normal + normalMatrix * delta);
    }
  #endif
`;

const FRAG_AO = /* glsl */ `
  #include <aomap_fragment>
  #ifdef TRI
    float cav = smoothstep(0.12, 1.0, vAO);
    reflectedLight.indirectDiffuse *= cav;
    reflectedLight.indirectSpecular *= cav;
    reflectedLight.directDiffuse *= mix(0.5, 1.0, cav);
    reflectedLight.directSpecular *= cav;
    // las sombras de contacto tiran a violeta, como en una ilustración
    reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.035, 0.015, 0.05) * (1.0 - cav);
  #endif
`;

const FRAG_OUT = /* glsl */ `
  {
    vec3 Vv = normalize(vViewPosition);
    float occ = 1.0;
    #ifdef TRI
      occ = smoothstep(0.12, 1.0, vAO);
    #endif
    float rim = pow(1.0 - clamp(dot(normal, Vv), 0.0, 1.0), 3.0);
    outgoingLight += rim * uRim * vec3(1.0, 0.72, 0.45) * 0.45 * occ;
    #if NUM_DIR_LIGHTS > 0
      vec3 Ld = directionalLights[0].direction;
      float ndl = dot(normal, Ld) * 0.5 + 0.5;
      // dispersión subsuperficial: borde cálido entre luz y sombra
      outgoingLight += diffuseColor.rgb * vec3(0.5, 0.12, 0.06) * uSSS * smoothstep(0.2, 0.5, ndl) * (1.0 - smoothstep(0.5, 0.8, ndl)) * directionalLights[0].color * 0.25;
      #ifdef HAIR
        // brillo anisotrópico: franja de luz que recorre los mechones
        vec3 Hh = normalize(Ld + Vv);
        vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vec3 T = up - normal * dot(normal, up);
        T = length(T) > 0.01 ? normalize(T) : vec3(1.0, 0.0, 0.0);
        float jit = (detailTex - 1.0) * 1.2;
        vec3 T1 = normalize(T + normal * (0.18 + jit));
        vec3 T2 = normalize(T + normal * (-0.22 + jit));
        float d1 = dot(T1, Hh), d2 = dot(T2, Hh);
        float s1 = pow(sqrt(max(1.0 - d1 * d1, 0.0)), 110.0);
        float s2 = pow(sqrt(max(1.0 - d2 * d2, 0.0)), 28.0);
        outgoingLight += (s1 * vec3(1.0, 0.95, 0.85) * 0.5 + s2 * diffuseColor.rgb * 0.7) * occ * directionalLights[0].color * 0.3 * smoothstep(0.3, 0.7, ndl);
      #endif
    #endif
  }
  #include <opaque_fragment>
`;

/** Material físico con las inyecciones del estilo pintado. */
export function paint(color: THREE.ColorRepresentation, kind: Kind = 'plain', o: PaintOpts = {}) {
  const S = SURF[kind];
  const col = new THREE.Color(color);
  const defines: Record<string, string> = {};
  if (o.sdf) defines.TRI = '';
  if (o.map) defines.COLORMAP = '';
  if (o.hair && o.sdf) defines.HAIR = '';
  const spec = o.spec ?? 0;
  const mat = new THREE.MeshPhysicalMaterial({
    color: col,
    roughness: o.rough ?? Math.max(0.12, S.rough - spec * 0.35),
    metalness: o.metal ?? S.metal ?? 0,
    sheen: S.sheen ?? 0,
    sheenColor: col.clone().lerp(new THREE.Color('#ffffff'), 0.45),
    sheenRoughness: 0.55,
    clearcoat: o.coat ?? (S.coat ?? 0) + spec * 0.3,
    clearcoatRoughness: 0.35,
    side: o.side ?? THREE.FrontSide,
    map: o.map ?? null,
    emissive: o.emissive ? col : new THREE.Color(0),
    emissiveIntensity: (o.emissive ?? 0) * 1.6,
    envMapIntensity: 1,
  });
  if (kind === 'skin' && o.sdf) mat.sheenColor = new THREE.Color('#ff9a80');
  // relieve en piezas rígidas: mapa normal estándar por UV
  const uvNrm = !o.sdf && !o.map && S.nrm && kind !== 'plain';
  if (uvNrm) {
    // el clon comparte la imagen (Source): se sube a la GPU cuando termina de cargar
    const t = nrmTex(S.nrm!).clone();
    t.repeat.set(...(o.repeat ?? [1, 1]));
    mat.normalMap = t;
    mat.normalScale.setScalar((S.nScale ?? 0.5) * 0.8);
  }
  const uniforms = {
    uTime: world.uTime,
    uDetail: { value: detailTex(kind) },
    uTexAmt: { value: o.texAmt ?? 1 },
    uRepeat: { value: new THREE.Vector2(...(o.repeat ?? [1, 1])) },
    uTriScale: { value: o.triScale ?? 3 },
    uNrm: { value: S.nrm ? nrmTex(S.nrm) : detailTex('plain') },
    uNrmScale: { value: o.sdf && S.nrm ? S.nScale ?? 0.5 : 0 },
    uNrmRepeat: { value: S.nRepeat ?? 1 },
    uPattern: { value: o.pattern ? patternTex(o.pattern) : detailTex('plain') },
    uPatternAmt: { value: o.pattern ? o.patternAmt ?? 0.75 : 0 },
    uLight: { value: new THREE.Color(o.light ?? '#ffffff') },
    uDark: { value: new THREE.Color(o.dark ?? '#000000') },
    uBlush: { value: new THREE.Color(o.blush ?? '#e0605a') },
    uRim: { value: o.rim ?? 0.35 },
    uSSS: { value: o.sss ?? 0 },
    uWave: { value: o.wave ?? 0 },
  };
  mat.userData.uniforms = uniforms;
  mat.defines = { ...(mat.defines ?? {}), ...defines };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <map_fragment>', FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
      .replace('#include <aomap_fragment>', FRAG_AO)
      .replace('#include <opaque_fragment>', FRAG_OUT);
  };
  mat.customProgramCacheKey = () => 'paint|' + Object.keys(defines).join(',') + (uvNrm ? '|n' : '');
  return mat;
}

// Textura suave radial para brillos, sombras y partículas.
export function softDot(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)'): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

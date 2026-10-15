import * as THREE from 'three';

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
  irisCache.set(key, t);
  return t;
}

// ---------------------------------------------------------------------------
// Material pintado: iluminación "a pincel" con sombras frías, luces cálidas,
// luz de borde dorada, brillo de metal estilizado y niebla atmosférica.
// ---------------------------------------------------------------------------

export const world = {
  uLightDir: { value: new THREE.Vector3(-0.45, 0.75, 0.55).normalize() },
  uFogColor: { value: new THREE.Color('#e3a985') },
  uFogNear: { value: 14 },
  uFogFar: { value: 95 },
  uTime: { value: 0 },
};

const vertexShader = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  uniform vec2 uRepeat;
  uniform float uWave;
  uniform float uTime;
  uniform float uTriScale;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vView;
  #ifdef TRI
    attribute vec3 tint;
    varying vec3 vTint;
    varying vec3 vObjP;
    varying vec3 vObjN;
  #endif
  void main() {
    #ifdef TRI
      vUv = vec2(0.0);
      vTint = tint;
      vObjP = position * uTriScale;
      vObjN = normal;
    #else
      vUv = uv * uRepeat;
    #endif
    vec3 transformed = position;
    vec3 objectNormal = normal;
    #ifndef TRI
    if (uWave > 0.0) {
      float k = (1.0 - uv.y);
      transformed.z += sin(uTime * 2.2 + transformed.y * 3.0 + transformed.x * 2.0) * uWave * k;
      transformed.x += cos(uTime * 1.7 + transformed.y * 2.0) * uWave * 0.4 * k;
    }
    #endif
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <skinning_vertex>
    vec4 w = modelMatrix * vec4(transformed, 1.0);
    vWorld = w.xyz;
    vN = normalize((vec4(normalMatrix * objectNormal, 0.0) * viewMatrix).xyz);
    vView = cameraPosition - w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform sampler2D uMap;
  uniform float uTexAmt;
  uniform float uRim;
  uniform float uSpec;
  uniform float uEmissive;
  uniform float uGround;
  uniform vec3 uLightDir;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform sampler2D uPattern;
  uniform float uPatternAmt;
  uniform vec3 uLight;
  uniform vec3 uDark;
  uniform vec3 uBlush;
  uniform float uSSS;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vView;
  #ifdef TRI
    varying vec3 vTint;
    varying vec3 vObjP;
    varying vec3 vObjN;
    float tri(sampler2D t) {
      vec3 bw = pow(abs(normalize(vObjN)), vec3(4.0));
      bw /= (bw.x + bw.y + bw.z);
      return texture2D(t, vObjP.zy).r * bw.x + texture2D(t, vObjP.xz).r * bw.y + texture2D(t, vObjP.xy).r * bw.z;
    }
  #endif
  void main() {
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vView);
    vec3 L = normalize(uLightDir);
    #ifdef COLORMAP
      vec3 base = texture2D(uMap, vUv).rgb * uColor;
    #else
      #ifdef TRI
        float tex = mix(1.0, tri(uMap) * 1.25, uTexAmt);
      #else
        float tex = mix(1.0, texture2D(uMap, vUv).r * 1.25, uTexAmt);
      #endif
      vec3 base = uColor * tex;
    #endif
    #ifdef TRI
      base = mix(base, uLight * mix(1.0, tex, 0.6), clamp(vTint.x, 0.0, 1.0));
      base = mix(base, uDark * tex, clamp(vTint.y, 0.0, 1.0));
      base = mix(base, uBlush * tex, clamp(vTint.z, 0.0, 1.0) * 0.45);
      if (uPatternAmt > 0.0) base = mix(base, uDark * tex, tri(uPattern) * uPatternAmt * (1.0 - clamp(vTint.x, 0.0, 1.0)));
    #endif

    float ndl = dot(N, L) * 0.5 + 0.5;
    float lit = smoothstep(0.28, 0.78, ndl);
    vec3 shade = base * vec3(0.46, 0.43, 0.62);
    vec3 light = base * vec3(1.13, 1.04, 0.9);
    vec3 col = mix(shade, light, lit);
    // dispersión subsuperficial pintada: borde cálido entre luz y sombra
    col += base * vec3(0.32, 0.08, 0.04) * uSSS * smoothstep(0.18, 0.5, ndl) * (1.0 - smoothstep(0.5, 0.82, ndl));

    // rebote del cielo y oclusión cerca del suelo
    col += base * 0.12 * clamp(N.y, 0.0, 1.0) * vec3(0.7, 0.8, 1.0);
    if (uGround > 0.0) col *= mix(0.62, 1.0, smoothstep(0.0, uGround, vWorld.y));

    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += rim * uRim * vec3(1.0, 0.74, 0.45);

    if (uSpec > 0.0) {
      vec3 H = normalize(L + V);
      float s = pow(max(dot(N, H), 0.0), 36.0);
      col += smoothstep(0.35, 0.75, s) * uSpec * vec3(1.0, 0.93, 0.78);
    }
    col = mix(col, uColor * 1.15, uEmissive);
    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, length(vView)));
    gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
  }
`;

export interface PaintOpts {
  /** Malla esculpida: textura triplanar + tintes por vértice. */
  sdf?: boolean;
  triScale?: number;
  map?: THREE.Texture;
  pattern?: 'stripes' | 'spots';
  patternAmt?: number;
  light?: THREE.ColorRepresentation;
  dark?: THREE.ColorRepresentation;
  blush?: THREE.ColorRepresentation;
  sss?: number;
  rim?: number;
  spec?: number;
  emissive?: number;
  texAmt?: number;
  ground?: number;
  repeat?: [number, number];
  side?: THREE.Side;
  wave?: number;
}

export function paint(color: THREE.ColorRepresentation, kind: Kind = 'plain', o: PaintOpts = {}) {
  const defines: Record<string, string> = {};
  if (o.sdf) defines.TRI = '';
  if (o.map) defines.COLORMAP = '';
  return new THREE.ShaderMaterial({
    defines,
    uniforms: {
      ...world,
      uColor: { value: new THREE.Color(color) },
      uMap: { value: o.map ?? detailTex(kind) },
      uTriScale: { value: o.triScale ?? 3 },
      uPattern: { value: o.pattern ? patternTex(o.pattern) : detailTex('plain') },
      uPatternAmt: { value: o.pattern ? o.patternAmt ?? 0.75 : 0 },
      uLight: { value: new THREE.Color(o.light ?? '#ffffff') },
      uDark: { value: new THREE.Color(o.dark ?? '#000000') },
      uBlush: { value: new THREE.Color(o.blush ?? '#e0605a') },
      uSSS: { value: o.sss ?? 0 },
      uTexAmt: { value: o.texAmt ?? 1 },
      uRepeat: { value: new THREE.Vector2(...(o.repeat ?? [1, 1])) },
      uRim: { value: o.rim ?? 0.35 },
      uSpec: { value: o.spec ?? 0 },
      uEmissive: { value: o.emissive ?? 0 },
      uGround: { value: o.ground ?? 0.9 },
      uWave: { value: o.wave ?? 0 },
    },
    vertexShader,
    fragmentShader,
    side: o.side ?? THREE.FrontSide,
  });
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
  return new THREE.CanvasTexture(c);
}

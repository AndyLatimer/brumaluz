import * as THREE from 'three';
import { paint, softDot, world } from './paint';

// Plaza de Brumaluz al atardecer: escenario del creador de personaje.

const PI = Math.PI;

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

export interface Env {
  update(t: number): void;
}

export function buildEnv(scene: THREE.Scene): Env {
  const r = rng(7);
  const flames: THREE.Sprite[] = [];
  const banners: THREE.ShaderMaterial[] = [];

  // ---------------- Cielo pintado ----------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uSun: { value: new THREE.Vector3(0.35, 0.12, -1).normalize() } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uSun; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 top = vec3(0.27,0.33,0.58);
          vec3 mid = vec3(0.78,0.55,0.62);
          vec3 hor = vec3(0.98,0.72,0.48);
          vec3 col = mix(hor, mid, smoothstep(0.0, 0.18, h));
          col = mix(col, top, smoothstep(0.15, 0.6, h));
          float s = max(dot(normalize(vDir), uSun), 0.0);
          col += vec3(1.0,0.75,0.4) * pow(s, 12.0) * 0.5 + vec3(1.0,0.9,0.7) * pow(s, 400.0);
          if (h < 0.0) col = hor;
          gl_FragColor = vec4(col,1.0);
        }`,
    }),
  );
  scene.add(sky);

  // Nubes pintadas
  const cloudTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < 26; i++) {
      const x = 40 + r() * 176, y = 60 + (r() - 0.5) * 30, rad = 18 + r() * 28;
      const g = ctx.createRadialGradient(x, y - rad * 0.3, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,236,220,0.95)');
      g.addColorStop(0.6, 'rgba(246,190,170,0.6)');
      g.addColorStop(1, 'rgba(220,150,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, PI * 2); ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  })();
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
    const a = -PI / 2 + (r() - 0.5) * 2.6;
    s.position.set(Math.cos(a) * 180, 35 + r() * 45, Math.sin(a) * 180);
    s.scale.set(60 + r() * 50, 22 + r() * 14, 1);
    scene.add(s);
  }

  // ---------------- Suelo ----------------
  const ground = mesh(scene, new THREE.CircleGeometry(160, 48), paint('#7d9150', 'grass', { repeat: [60, 60], ground: 0, rim: 0 }), 0, -0.36);
  ground.rotation.x = -PI / 2;
  const plaza = mesh(scene, new THREE.CircleGeometry(11, 48), paint('#b3a693', 'cobble', { repeat: [9, 9], ground: 0, rim: 0 }), 0, -0.35);
  plaza.rotation.x = -PI / 2;

  // Tarima central
  const stone = paint('#958a7c', 'stone', { repeat: [6, 1], ground: 0, rim: 0.15 });
  mesh(scene, new THREE.CylinderGeometry(1.95, 2.0, 0.18, 40), stone, 0, -0.26);
  mesh(scene, new THREE.CylinderGeometry(1.6, 1.65, 0.2, 40), stone, 0, -0.1);
  const top = mesh(scene, new THREE.CircleGeometry(1.6, 40), paint('#c2b49c', 'cobble', { repeat: [3, 3], ground: 0, rim: 0 }), 0, 0.001);
  top.rotation.x = -PI / 2;
  const trim = mesh(scene, new THREE.TorusGeometry(1.6, 0.035, 8, 64), paint('#d8ac52', 'metal', { spec: 0.8, ground: 0 }), 0, 0.005);
  trim.rotation.x = PI / 2;
  // alfombra
  const rug = mesh(scene, new THREE.CircleGeometry(1.0, 40), paint('#8b2f3a', 'cloth', { repeat: [3, 3], ground: 0, rim: 0 }), 0, 0.004);
  rug.rotation.x = -PI / 2;
  const rugTrim = mesh(scene, new THREE.TorusGeometry(0.96, 0.03, 6, 48), paint('#d8ac52', 'cloth', { ground: 0 }), 0, 0.006);
  rugTrim.rotation.x = PI / 2;
  rugTrim.scale.z = 0.2;

  // ---------------- Casas con entramado de madera ----------------
  const plaster = ['#efe2c4', '#e8d3b0', '#f2e8d2', '#e2c9a6'];
  const roofs = ['#a24a32', '#6b5d86', '#8a4a35', '#4f6f86', '#9b6a3a'];
  const beam = paint('#5a3a24', 'wood', { ground: 0 });
  const winMat = paint('#ffcf7a', 'plain', { emissive: 0.9, texAmt: 0, ground: 0 });
  const houses = new THREE.Group();
  scene.add(houses);
  const N = 13;
  for (let i = 0; i < N; i++) {
    const a = -PI / 2 + (i / (N - 1) - 0.5) * PI * 1.35;
    const dist = 13 + r() * 3;
    const w = 3 + r() * 1.8, dpt = 3.2, h = 2.8 + r() * 2.2;
    const hg = new THREE.Group();
    hg.position.set(Math.cos(a) * dist, -0.36, Math.sin(a) * dist);
    hg.lookAt(0, -0.36, 0);
    houses.add(hg);
    const pm = paint(plaster[i % 4], 'plaster', { ground: 0, repeat: [1.5, 1.5] });
    mesh(hg, new THREE.BoxGeometry(w, 1.2, dpt), paint('#9a8f80', 'stone', { ground: 0 }), 0, 0.6, 0);
    mesh(hg, new THREE.BoxGeometry(w + 0.25, h - 1.2, dpt + 0.25), pm, 0, 1.2 + (h - 1.2) / 2, 0);
    // vigas
    const fz = (dpt + 0.25) / 2 + 0.02;
    for (const bx of [-w / 2, 0, w / 2]) mesh(hg, new THREE.BoxGeometry(0.16, h - 1.2, 0.08), beam, bx, 1.2 + (h - 1.2) / 2, fz);
    mesh(hg, new THREE.BoxGeometry(w + 0.35, 0.16, 0.1), beam, 0, 1.25, fz);
    mesh(hg, new THREE.BoxGeometry(w + 0.35, 0.16, 0.1), beam, 0, h - 0.05, fz);
    const diag = mesh(hg, new THREE.BoxGeometry(0.12, (h - 1.2) * 1.1, 0.08), beam, -w / 4, 1.2 + (h - 1.2) / 2, fz);
    diag.rotation.z = 0.6;
    // ventanas encendidas
    for (const wx of [-w / 4, w / 4]) {
      if (r() < 0.25) continue;
      mesh(hg, new THREE.BoxGeometry(0.5, 0.6, 0.06), winMat, wx + 0.1, 1.2 + (h - 1.2) * 0.55, fz + 0.01);
      mesh(hg, new THREE.BoxGeometry(0.6, 0.08, 0.12), beam, wx + 0.1, 1.2 + (h - 1.2) * 0.55 - 0.34, fz + 0.03);
    }
    // puerta
    mesh(hg, new THREE.BoxGeometry(0.8, 1.3, 0.08), paint('#6b4226', 'wood', { ground: 0 }), w / 4 - 0.2, 0.65, dpt / 2 + 0.03);
    // tejado a dos aguas
    const roofH = 1.6 + r() * 1.2;
    const rs = new THREE.Shape();
    rs.moveTo(-(w + 0.8) / 2, 0); rs.lineTo(0, roofH); rs.lineTo((w + 0.8) / 2, 0); rs.lineTo(-(w + 0.8) / 2, 0);
    const rg = new THREE.ExtrudeGeometry(rs, { depth: dpt + 0.8, bevelEnabled: false });
    rg.translate(0, 0, -(dpt + 0.8) / 2);
    const rm = paint(roofs[i % roofs.length], 'roof', { ground: 0, repeat: [0.6, 0.6], rim: 0.2 });
    mesh(hg, rg, rm, 0, h, 0);
    // chimenea
    if (r() < 0.6) mesh(hg, new THREE.BoxGeometry(0.45, 1.4, 0.45), paint('#8a7f72', 'stone', { ground: 0 }), w / 4, h + roofH * 0.55, -0.4);
  }

  // ---------------- Castillo lejano ----------------
  const far = new THREE.Group();
  far.position.set(-10, -0.36, -75);
  scene.add(far);
  const hill = mesh(far, new THREE.SphereGeometry(30, 32, 16), paint('#6f8550', 'grass', { ground: 0, repeat: [8, 8], rim: 0 }), 0, -18, 0);
  hill.scale.set(1.5, 1, 1);
  const cs = paint('#c9b9a4', 'stone', { ground: 0, repeat: [3, 3] });
  const cr = paint('#5f6f9a', 'roof', { ground: 0, repeat: [0.5, 0.5] });
  mesh(far, new THREE.BoxGeometry(14, 8, 8), cs, 0, 13, 0);
  for (const [x, z, h, rad] of [[-8, 2, 16, 2.2], [8, 2, 14, 2], [0, -2, 22, 2.6], [-4, 5, 11, 1.6], [5, 5, 12, 1.6]] as const) {
    mesh(far, new THREE.CylinderGeometry(rad, rad * 1.05, h, 16), cs, x, 9 + h / 2, z);
    mesh(far, new THREE.ConeGeometry(rad * 1.35, rad * 2.6, 16), cr, x, 9 + h + rad * 1.3, z);
    const fl = mesh(far, new THREE.PlaneGeometry(1.6, 0.9), paint('#b8402f', 'cloth', { ground: 0, side: THREE.DoubleSide }), x + 0.8, 9 + h + rad * 2.6 + 0.6, z);
    mesh(far, new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), beam, x, 9 + h + rad * 2.6 + 0.3, z);
    fl.rotation.y = 0.3;
  }

  // ---------------- Árboles ----------------
  const leafCols = ['#5f8a3e', '#7a9a42', '#4f7a45', '#93a24a', '#c98a3a'];
  const trunk = paint('#6b4a2e', 'wood', { ground: 0 });
  const trees: [number, number][] = [[-6.5, -6], [7, -5.5], [-9, -1.5], [9.5, -1], [-4, -10], [4.5, -10.5], [-11, 3.5], [11, 4]];
  for (const [x, z] of trees) {
    const t = new THREE.Group();
    t.position.set(x, -0.36, z);
    const sc = 0.9 + r() * 0.5;
    t.scale.setScalar(sc);
    scene.add(t);
    const tr = mesh(t, new THREE.CylinderGeometry(0.18, 0.3, 2.4, 10), trunk, 0, 1.2, 0);
    tr.rotation.z = (r() - 0.5) * 0.15;
    const lm = paint(leafCols[Math.floor(r() * leafCols.length)], 'leaf', { ground: 0, rim: 0.55, repeat: [2, 2] });
    for (let k = 0; k < 5; k++) {
      const b = mesh(t, new THREE.IcosahedronGeometry(0.9 + r() * 0.5, 1), lm, (r() - 0.5) * 1.4, 2.6 + r() * 1.3, (r() - 0.5) * 1.4);
      b.scale.y = 0.85;
    }
  }

  // ---------------- Farolas ----------------
  const iron = paint('#3a3533', 'metal', { spec: 0.5, ground: 0 });
  const flameTex = softDot('rgba(255,210,120,1)', 'rgba(255,120,40,0)');
  for (const [x, z] of [[-3.3, -2.0], [3.3, -2.0], [-3.0, 3.2], [3.0, 3.2]] as const) {
    const g = new THREE.Group();
    g.position.set(x, -0.36, z);
    scene.add(g);
    mesh(g, new THREE.CylinderGeometry(0.06, 0.09, 2.6, 8), iron, 0, 1.3, 0);
    mesh(g, new THREE.CylinderGeometry(0.16, 0.2, 0.15, 8), iron, 0, 0.08, 0);
    mesh(g, new THREE.BoxGeometry(0.28, 0.36, 0.28), paint('#ffd88a', 'plain', { emissive: 0.85, texAmt: 0, ground: 0 }), 0, 2.75, 0);
    mesh(g, new THREE.ConeGeometry(0.26, 0.22, 4), iron, 0, 3.04, 0, PI / 4);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    fl.position.set(0, 2.75, 0);
    fl.scale.setScalar(1.4);
    g.add(fl);
    flames.push(fl);
  }

  // ---------------- Estandartes ----------------
  for (const [x, col] of [[-2.6, '#8b2a2a'], [2.6, '#2f4f8b']] as const) {
    const g = new THREE.Group();
    g.position.set(x, -0.36, -3.6);
    scene.add(g);
    mesh(g, new THREE.CylinderGeometry(0.05, 0.06, 3.6, 8), beam, 0, 1.8, 0);
    const bar = mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), beam, 0, 3.4, 0);
    bar.rotation.z = PI / 2;
    mesh(g, new THREE.SphereGeometry(0.07, 10, 8), paint('#d8ac52', 'metal', { spec: 1, ground: 0 }), 0, 3.65, 0);
    const bm = paint(col, 'cloth', { side: THREE.DoubleSide, wave: 0.06, ground: 0 });
    banners.push(bm);
    const bg = new THREE.PlaneGeometry(0.8, 1.7, 6, 12).translate(0, -0.85, 0);
    mesh(g, bg, bm, 0, 3.38, 0.04);
    const emb = mesh(g, new THREE.CircleGeometry(0.2, 20), paint('#e2b55a', 'metal', { spec: 0.6, ground: 0 }), 0, 2.9, 0.06);
    emb.scale.y = 1.15;
  }

  // ---------------- Atrezo: barriles, cajas, flores ----------------
  const wood = paint('#8a5e36', 'wood', { ground: 0 });
  const band = paint('#4a4440', 'metal', { spec: 0.4, ground: 0 });
  for (const [x, z] of [[3.4, 0.6], [3.9, 0.0], [-3.6, 0.8]] as const) {
    mesh(scene, new THREE.CylinderGeometry(0.34, 0.34, 0.85, 14), wood, x, -0.36 + 0.43, z);
    for (const y of [0.15, 0.7]) {
      const b = mesh(scene, new THREE.TorusGeometry(0.35, 0.025, 6, 20), band, x, -0.36 + y, z);
      b.rotation.x = PI / 2;
    }
  }
  for (const [x, z, s] of [[-3.4, -0.2, 0.7], [-3.9, 0.3, 0.5], [-3.55, -0.1, 0.45]] as const) {
    const c = mesh(scene, new THREE.BoxGeometry(s, s, s), paint('#a87a48', 'wood', { ground: 0 }), x, -0.36 + s / 2 + (s === 0.45 ? 0.7 : 0), z, r());
    void c;
  }
  const flowerCols = ['#e86a7a', '#f2c14e', '#b78bd8', '#f29a5a', '#ffffff'];
  for (let i = 0; i < 70; i++) {
    const a = r() * PI * 2, d = 2.2 + r() * 0.6;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (z < -1.5 && Math.abs(x) < 1.2) continue;
    mesh(scene, new THREE.SphereGeometry(0.06 + r() * 0.04, 6, 5), paint(flowerCols[i % flowerCols.length], 'plain', { ground: 0, rim: 0.4 }), x, -0.3 + r() * 0.05, z);
    if (i % 3 === 0) mesh(scene, new THREE.SphereGeometry(0.14, 7, 5), paint('#5f8a3e', 'leaf', { ground: 0 }), x + 0.08, -0.32, z + 0.05);
  }

  // ---------------- Luciérnagas / polen ----------------
  const COUNT = 140;
  const pg = new THREE.BufferGeometry();
  const base = new Float32Array(COUNT * 3), seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = r() * PI * 2, d = 0.8 + r() * 7;
    base[i * 3] = Math.cos(a) * d; base[i * 3 + 1] = r() * 3.5; base[i * 3 + 2] = Math.sin(a) * d;
    seeds[i] = r() * 100;
  }
  pg.setAttribute('position', new THREE.BufferAttribute(base, 3));
  pg.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const pm = new THREE.ShaderMaterial({
    uniforms: { uTime: world.uTime, uTex: { value: softDot('rgba(255,230,150,1)', 'rgba(255,180,80,0)') } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; attribute float seed; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime*0.3 + seed) * 0.4;
        p.y += sin(uTime*0.5 + seed*1.7) * 0.3;
        p.z += cos(uTime*0.25 + seed*0.7) * 0.4;
        vA = 0.5 + 0.5 * sin(uTime * 2.0 + seed * 3.0);
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = (14.0 + 10.0 * vA) * (5.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uTex; varying float vA; void main(){ gl_FragColor = texture2D(uTex, gl_PointCoord) * vA; }`,
  });
  scene.add(new THREE.Points(pg, pm));

  return {
    update(t: number) {
      flames.forEach((f, i) => f.scale.setScalar(1.3 + Math.sin(t * 9 + i * 2) * 0.08 + Math.sin(t * 23 + i) * 0.05));
      void banners;
    },
  };
}

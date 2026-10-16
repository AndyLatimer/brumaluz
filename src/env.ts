import * as THREE from 'three';
import { softDot, world } from './paint';

// Cielo de atardecer, faroles de la plaza y luciérnagas.

const PI = Math.PI;

export interface Env {
  update(t: number): void;
}

export function buildEnv(scene: THREE.Scene): Env {
  const flames: THREE.Sprite[] = [];

  // ---------------- Cielo pintado ----------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uSun: { value: new THREE.Vector3(-0.62, 0.25, 0.42).normalize() } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uSun; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 top = vec3(0.32,0.45,0.78);
          vec3 mid = vec3(0.86,0.62,0.66);
          vec3 hor = vec3(1.0,0.78,0.55);
          vec3 col = mix(hor, mid, smoothstep(0.0, 0.2, h));
          col = mix(col, top, smoothstep(0.18, 0.65, h));
          float s = max(dot(normalize(vDir), uSun), 0.0);
          col += vec3(1.0,0.75,0.4) * pow(s, 10.0) * 0.45 + vec3(1.0,0.9,0.7) * pow(s, 300.0);
          if (h < 0.0) col = mix(hor, vec3(0.36,0.62,0.86), smoothstep(0.0, -0.08, h));
          gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
        }`,
    }),
  );
  scene.add(sky);

  // ---------------- Faroles de la plaza ----------------
  const iron = new THREE.MeshStandardMaterial({ color: '#3a3533', roughness: 0.5, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#ffd88a', emissive: '#ffb24a', emissiveIntensity: 2.2 });
  const flameTex = softDot('rgba(255,210,120,1)', 'rgba(255,120,40,0)');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 6;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * 6.2, 0, Math.sin(a) * 6.2);
    scene.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.6, 8), iron);
    pole.position.y = 1.3;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), glass);
    lamp.position.y = 2.75;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.22, 4), iron);
    cap.position.y = 3.04;
    cap.rotation.y = PI / 4;
    for (const m of [pole, cap]) { m.castShadow = true; }
    g.add(pole, lamp, cap);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    fl.position.y = 2.75;
    fl.scale.setScalar(1.3);
    g.add(fl);
    flames.push(fl);
  }

  // ---------------- Luciérnagas / polen ----------------
  const COUNT = 220;
  const pg = new THREE.BufferGeometry();
  const base = new Float32Array(COUNT * 3), seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * PI * 2, d = 1 + Math.random() * 30;
    base[i * 3] = Math.cos(a) * d; base[i * 3 + 1] = 0.3 + Math.random() * 4; base[i * 3 + 2] = Math.sin(a) * d;
    seeds[i] = Math.random() * 100;
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
        p.x += sin(uTime*0.3 + seed) * 0.6;
        p.y += sin(uTime*0.5 + seed*1.7) * 0.4;
        p.z += cos(uTime*0.25 + seed*0.7) * 0.6;
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
      flames.forEach((f, i) => f.scale.setScalar(1.25 + Math.sin(t * 9 + i * 2) * 0.08 + Math.sin(t * 23 + i) * 0.05));
    },
  };
}

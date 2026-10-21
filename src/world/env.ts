import * as THREE from 'three';
import { softDot, world } from './paint';
import { daylight } from './dayNight';

// Faroles de la plaza, luciérnagas y pájaros (el cielo lo pone el ciclo de día y noche, src/world/dayNight.ts).

const PI = Math.PI;

export interface Env {
  cameraObstacles: THREE.Object3D[];
  /** Muestra u oculta los faroles fijos de la plaza (solo existen en la Brumaluz procedural; los mapas del editor traen los suyos). */
  setLampposts(visible: boolean): void;
  /** Muestra u oculta las luciérnagas (los interiores no las llevan). */
  setFireflies(visible: boolean): void;
  update(t: number): void;
}

export function buildEnv(scene: THREE.Scene): Env {
  const flames: THREE.Sprite[] = [];
  const lampposts: THREE.Group[] = [];
  const lamppostParts: THREE.Object3D[] = [];
  const cameraObstacles: THREE.Object3D[] = [];
  const songbirds: { mesh: THREE.LineSegments; radius: number; height: number; speed: number; phase: number }[] = [];

  // ---------------- Faroles de la plaza ----------------
  const iron = new THREE.MeshStandardMaterial({ color: '#3a3533', roughness: 0.5, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#ffd88a', emissive: '#ffb24a', emissiveIntensity: 2.2 });
  const flameTex = softDot('rgba(255,210,120,1)', 'rgba(255,120,40,0)');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 6;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * 6.2, 0, Math.sin(a) * 6.2);
    scene.add(g);
    lampposts.push(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.6, 8), iron);
    pole.position.y = 1.3;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), glass);
    lamp.position.y = 2.75;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.22, 4), iron);
    cap.position.y = 3.04;
    cap.rotation.y = PI / 4;
    for (const m of [pole, cap]) { m.castShadow = true; }
    g.add(pole, lamp, cap);
    cameraObstacles.push(pole, lamp, cap);
    lamppostParts.push(pole, lamp, cap);
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
    uniforms: { uTime: world.uTime, uNight: daylight.uNight, uTex: { value: softDot('rgba(255,230,150,1)', 'rgba(255,180,80,0)') } },
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
    // De día apenas se ven (polen); de noche brillan las luciérnagas.
    fragmentShader: `uniform sampler2D uTex; uniform float uNight; varying float vA; void main(){ gl_FragColor = texture2D(uTex, gl_PointCoord) * vA * (0.3 + 0.9 * uNight); }`,
  });
  const fireflies = new THREE.Points(pg, pm);
  scene.add(fireflies);

  // Bandada lejana: siluetas discretas que cruzan el cielo sobre las murallas.
  const birdMaterial = new THREE.LineBasicMaterial({ color: '#624d50', transparent: true, opacity: 0.7, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.32, 0, 0, 0, 0.08, 0,
      0, 0.08, 0, 0.32, 0, 0,
    ], 3));
    const mesh = new THREE.LineSegments(geometry, birdMaterial);
    mesh.frustumCulled = false;
    scene.add(mesh);
    songbirds.push({
      mesh,
      radius: 34 + Math.random() * 28,
      height: 17 + Math.random() * 9,
      speed: 0.035 + Math.random() * 0.02,
      phase: Math.random() * PI * 2,
    });
  }

  return {
    cameraObstacles,
    setLampposts(visible: boolean) {
      for (const lamppost of lampposts) lamppost.visible = visible;
      for (const part of lamppostParts) {
        const index = cameraObstacles.indexOf(part);
        if (visible && index < 0) cameraObstacles.push(part);
        else if (!visible && index >= 0) cameraObstacles.splice(index, 1);
      }
    },
    setFireflies(visible: boolean) { fireflies.visible = visible; },
    update(t: number) {
      const night = daylight.night;
      glass.emissiveIntensity = 0.6 + 1.8 * night;
      flames.forEach((f, i) => {
        f.scale.setScalar(1.25 + Math.sin(t * 9 + i * 2) * 0.08 + Math.sin(t * 23 + i) * 0.05);
        f.material.opacity = 0.4 + 0.6 * night;
      });
      // Los pájaros se recogen al anochecer.
      for (const bird of songbirds) bird.mesh.visible = night < 0.6;
      songbirds.forEach((bird, i) => {
        const angle = t * bird.speed + bird.phase;
        bird.mesh.position.set(Math.cos(angle) * bird.radius, bird.height + Math.sin(angle * 1.7 + i) * 1.2, Math.sin(angle) * bird.radius);
        bird.mesh.rotation.y = -angle;
        const positions = bird.mesh.geometry.attributes.position as THREE.BufferAttribute;
        const flap = Math.sin(t * 9 + bird.phase) * 0.12;
        positions.setY(1, 0.08 + flap);
        positions.setY(2, 0.08 + flap);
        positions.needsUpdate = true;
      });
    },
  };
}

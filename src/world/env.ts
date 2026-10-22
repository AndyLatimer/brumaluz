import * as THREE from 'three';
import { softDot, world } from './paint';
import { daylight } from './dayNight';
import { buildFairy } from './fairy';

// Faroles de la plaza, luciérnagas, mariposas y pájaros (el cielo lo pone el ciclo de día y noche, src/world/dayNight.ts).

const PI = Math.PI;

export interface Env {
  cameraObstacles: THREE.Object3D[];
  /** Muestra u oculta los faroles fijos de la plaza (solo existen en la Brumaluz procedural; los mapas del editor traen los suyos). */
  setLampposts(visible: boolean): void;
  /** Muestra u oculta luciérnagas, mariposas y haditas (los interiores no las llevan). */
  setFireflies(visible: boolean): void;
  /** Anima lo vivo; `focus` (el jugador) y `groundY` situan luciérnagas y mariposas a su alrededor. */
  update(t: number, focus?: THREE.Vector3, groundY?: (x: number, z: number) => number): void;
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

  // ---------------- Luciérnagas (de noche) ----------------
  // Repartidas en un cuadrado de 2·RANGE m que se repite alrededor del jugador: siempre hay unas cuantas cerca,
  // cada una en su sitio del mundo (no viajan con él).
  const COUNT = 220, RANGE = 30;
  const pg = new THREE.BufferGeometry();
  const base = new Float32Array(COUNT * 3), seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    base[i * 3] = (Math.random() * 2 - 1) * RANGE; base[i * 3 + 1] = 0.3 + Math.random() * 3; base[i * 3 + 2] = (Math.random() * 2 - 1) * RANGE;
    seeds[i] = Math.random() * 100;
  }
  const center = { value: new THREE.Vector3() };
  pg.setAttribute('position', new THREE.BufferAttribute(base, 3));
  pg.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const pm = new THREE.ShaderMaterial({
    uniforms: { uTime: world.uTime, uNight: daylight.uNight, uCenter: center, uTex: { value: softDot('rgba(255,230,150,1)', 'rgba(255,180,80,0)') } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform vec3 uCenter; attribute float seed; varying float vA;
      void main(){
        vec3 p = position;
        p.xz = uCenter.xz + mod(p.xz - uCenter.xz + ${RANGE.toFixed(1)}, ${(2 * RANGE).toFixed(1)}) - ${RANGE.toFixed(1)};
        p.y += uCenter.y;
        p.x += sin(uTime*0.3 + seed) * 0.6;
        p.y += sin(uTime*0.5 + seed*1.7) * 0.4;
        p.z += cos(uTime*0.25 + seed*0.7) * 0.6;
        vA = 0.5 + 0.5 * sin(uTime * 2.0 + seed * 3.0);
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = (14.0 + 10.0 * vA) * (5.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    // Solo brillan de noche: se encienden al anochecer y se apagan al amanecer.
    fragmentShader: `uniform sampler2D uTex; uniform float uNight; varying float vA; void main(){ gl_FragColor = texture2D(uTex, gl_PointCoord) * vA * 1.2 * smoothstep(0.35, 0.85, uNight); }`,
  });
  const fireflies = new THREE.Points(pg, pm);
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  // ---------------- Mariposas (de día) ----------------
  // Revolotean a poca altura cerca del jugador; al alejarse, cada una busca otro sitio. Las alas baten en el
  // sombreador (cada ejemplar a su ritmo) y el vuelo se calcula aquí.
  const BUTTERFLIES = 10;
  const wing = (sign: number) => [
    0, 0, -0.02, sign * 0.13, 0, 0.09, sign * 0.15, 0, -0.01, // ala delantera
    0, 0, -0.02, sign * 0.15, 0, -0.01, sign * 0.09, 0, -0.11, // ala trasera
  ];
  const butterflyGeometry = new THREE.BufferGeometry();
  butterflyGeometry.setAttribute('position', new THREE.Float32BufferAttribute([...wing(1), ...wing(-1)], 3));
  butterflyGeometry.computeVertexNormals();
  // Sin iluminación: al batir, la cara de abajo de las alas se vería negra (y solo vuelan de día).
  const butterflyMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  butterflyMaterial.onBeforeCompile = shader => {
    shader.uniforms.uTime = world.uTime;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float flap = sin(uTime * 15.0 + float(gl_InstanceID) * 2.3) * 0.75 + 0.35;
        transformed = vec3(position.x * cos(flap), abs(position.x) * sin(flap), position.z);`);
  };
  const butterflies = new THREE.InstancedMesh(butterflyGeometry, butterflyMaterial, BUTTERFLIES);
  butterflies.frustumCulled = false;
  const palette = ['#e8c24e', '#ece8dc', '#e08a40', '#8fb3e2', '#e49ab6', '#b8d36c'].map(color => new THREE.Color(color));
  const flyers = Array.from({ length: BUTTERFLIES }, (_, i) => {
    butterflies.setColorAt(i, palette[i % palette.length]);
    return { home: new THREE.Vector3(Infinity, 0, 0), phase: Math.random() * 100, speed: 0.6 + Math.random() * 0.5, size: 1.5 + Math.random() * 0.7 };
  });
  scene.add(butterflies);
  const flyer = new THREE.Object3D();
  // Proporción aproximada de 4 hadas por 18 mariposas, sin aumentar la población de mariposas.
  const FAIRIES = Math.round(BUTTERFLIES * 4 / 18);
  const fairies = Array.from({ length: FAIRIES }, (_, i) => {
    const fairy = buildFairy(['#efb5e0', '#b5e5ca'][i % 2]);
    fairy.root.visible = false;
    scene.add(fairy.root);
    return { ...fairy, home: new THREE.Vector3(Infinity, 0, 0), phase: Math.random() * 100, speed: 0.45 + Math.random() * 0.25 };
  });
  let crittersEnabled = true;

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
    setFireflies(visible: boolean) { crittersEnabled = visible; },
    update(t: number, focus?: THREE.Vector3, groundY?: (x: number, z: number) => number) {
      // Luciérnagas de noche y mariposas de día (en los interiores, ninguna de las dos).
      const night = daylight.night;
      fireflies.visible = crittersEnabled && night > 0.3;
      butterflies.visible = crittersEnabled && night < 0.75 && !!focus;
      if (focus) center.value.copy(focus);
      if (butterflies.visible && focus) {
        const ground = groundY ?? (() => focus.y);
        const scale = THREE.MathUtils.smoothstep(0.75 - night, 0, 0.4); // al anochecer se van haciendo pequeñas
        flyers.forEach((item, i) => {
          if (Math.hypot(item.home.x - focus.x, item.home.z - focus.z) > 20) {
            // Aparecen en un anillo alejado del jugador; conservan su vuelo y su cantidad.
            const angle = Math.random() * PI * 2, distance = 10 + Math.random() * 8;
            item.home.set(focus.x + Math.cos(angle) * distance, 0, focus.z + Math.sin(angle) * distance);
            item.home.y = ground(item.home.x, item.home.z);
          }
          const s = t * item.speed + item.phase;
          const x = item.home.x + Math.sin(s * 0.7) * 2.2 + Math.sin(s * 1.9) * 0.6;
          const z = item.home.z + Math.cos(s * 0.5) * 2.2 + Math.cos(s * 2.3) * 0.5;
          flyer.position.set(x, item.home.y + 0.7 + Math.sin(s * 1.3) * 0.35 + Math.sin(s * 5.1) * 0.08, z);
          // Mira hacia donde vuela (derivada del recorrido).
          const vx = Math.cos(s * 0.7) * 1.54 + Math.cos(s * 1.9) * 1.14, vz = -Math.sin(s * 0.5) * 1.1 - Math.sin(s * 2.3) * 1.15;
          flyer.rotation.set(0, Math.atan2(vx, vz), 0);
          flyer.scale.setScalar(item.size * scale);
          flyer.updateMatrix();
          butterflies.setMatrixAt(i, flyer.matrix);
        });
        butterflies.instanceMatrix.needsUpdate = true;
      }
      for (const fairy of fairies) {
        fairy.root.visible = butterflies.visible;
        if (!fairy.root.visible || !focus) continue;
        if (Math.hypot(fairy.home.x - focus.x, fairy.home.z - focus.z) > 20) {
          // La misma zona de aparición alejada que las mariposas.
          const angle = Math.random() * PI * 2, distance = 10 + Math.random() * 8;
          const x = focus.x + Math.cos(angle) * distance, z = focus.z + Math.sin(angle) * distance;
          fairy.home.set(x, groundY ? groundY(x, z) : focus.y, z);
        }
        const s = t * fairy.speed + fairy.phase;
        fairy.root.position.set(
          fairy.home.x + Math.sin(s * 0.7) * 1.7,
          fairy.home.y + 0.95 + Math.sin(s * 1.4) * 0.25,
          fairy.home.z + Math.cos(s * 0.6) * 1.7,
        );
        fairy.root.rotation.y = Math.atan2(Math.cos(s * 0.7) * 0.7, -Math.sin(s * 0.6) * 0.6);
        fairy.root.scale.setScalar(1.1 * THREE.MathUtils.smoothstep(0.75 - night, 0, 0.4));
        fairy.flutter(t + fairy.phase);
      }
      glass.emissiveIntensity = 0.6 + 1.8 * night;
      flames.forEach((f, i) => {
        f.scale.setScalar(1.25 + Math.sin(t * 9 + i * 2) * 0.08 + Math.sin(t * 23 + i) * 0.05);
        f.material.opacity = 0.4 + 0.6 * night;
      });
      // Los pájaros se recogen al anochecer.
      for (const bird of songbirds) bird.mesh.visible = crittersEnabled && night < 0.6;
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

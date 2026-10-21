import * as THREE from 'three';
import { daylight } from './dayNight';

// Ondas y salpicaduras en la superficie del agua. Todo sale de dos conjuntos fijos (anillos y gotas) que se
// reutilizan: no se crea nada mientras se juega.

const RINGS = 48;
const DROPS = 96;

interface Ring { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; age: number; life: number; size: number }
/** Color de ondas y gotas a plena luz (de noche se apagan con el agua). */
const RING_COLOR = new THREE.Color('#eaf8ff'), DROP_COLOR = new THREE.Color('#f2fbff');
interface Drop { velocity: THREE.Vector3; age: number; life: number; floor: number }

export class WaterFx {
  readonly root = new THREE.Group();
  private rings: Ring[] = [];
  private nextRing = 0;
  private drops: Drop[] = [];
  private nextDrop = 0;
  private dropMesh: THREE.InstancedMesh;
  private matrix = new THREE.Matrix4();
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  /** Tiempo hasta la siguiente onda de cada nadador (por clave). */
  private timers = new Map<string, number>();
  /** Si cada nadador estaba ya en el agua el fotograma anterior (para salpicar al entrar). */
  private inWater = new Map<string, boolean>();

  constructor() {
    this.root.name = 'water-fx';
    this.root.userData.hideFromMinimap = true;
    const ringGeometry = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < RINGS; i++) {
      const material = new THREE.MeshBasicMaterial({ color: '#eaf8ff', transparent: true, opacity: 0, depthWrite: false, fog: true });
      const mesh = new THREE.Mesh(ringGeometry, material);
      mesh.visible = false;
      mesh.renderOrder = 2;
      mesh.raycast = () => {};
      this.root.add(mesh);
      this.rings.push({ mesh, material, age: 0, life: 0, size: 1 });
    }
    this.dropMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.06, 6, 4),
      new THREE.MeshBasicMaterial({ color: '#f2fbff', transparent: true, opacity: 0.85, depthWrite: false }),
      DROPS,
    );
    this.dropMesh.frustumCulled = false;
    this.dropMesh.raycast = () => {};
    for (let i = 0; i < DROPS; i++) {
      this.dropMesh.setMatrixAt(i, this.hidden);
      this.drops.push({ velocity: new THREE.Vector3(), age: 1, life: 0, floor: 0 });
    }
    this.root.add(this.dropMesh);
  }

  /** Una onda que se abre desde (x, z) sobre la superficie `y`. */
  ripple(x: number, y: number, z: number, size = 1.4, life = 1.4) {
    const ring = this.rings[this.nextRing];
    this.nextRing = (this.nextRing + 1) % RINGS;
    ring.mesh.position.set(x, y + 0.03, z);
    ring.mesh.visible = true;
    ring.age = 0; ring.life = life; ring.size = size;
  }

  /** Salpicadura: gotas que saltan y caen de vuelta al agua, más un par de ondas. */
  splash(x: number, y: number, z: number, strength = 1) {
    for (let i = 0; i < Math.round(14 * strength); i++) {
      const drop = this.drops[this.nextDrop];
      this.nextDrop = (this.nextDrop + 1) % DROPS;
      const angle = Math.random() * Math.PI * 2, speed = (0.8 + Math.random() * 1.6) * strength;
      drop.velocity.set(Math.cos(angle) * speed, (2.2 + Math.random() * 2) * strength, Math.sin(angle) * speed);
      drop.age = 0; drop.life = 0.9; drop.floor = y;
      this.matrix.makeTranslation(x, y + 0.1, z);
      this.dropMesh.setMatrixAt(this.nextDrop === 0 ? DROPS - 1 : this.nextDrop - 1, this.matrix);
    }
    this.ripple(x, y, z, 1.6 * strength, 1.1);
    this.ripple(x, y, z, 2.6 * strength, 1.8);
  }

  /**
   * Un personaje (`key`) en el agua: onda periódica a su alrededor (más seguida si se mueve) y salpicadura al
   * entrar. `water` null: está en seco.
   */
  track(key: string, position: THREE.Vector3, water: { surface: number; deep: boolean } | null, speed: number, dt: number) {
    const was = this.inWater.get(key) ?? false;
    this.inWater.set(key, !!water);
    if (!water) { this.timers.delete(key); return; }
    if (!was) this.splash(position.x, water.surface, position.z, water.deep ? 1 : 0.6);
    const left = (this.timers.get(key) ?? 0) - dt;
    if (left > 0) { this.timers.set(key, left); return; }
    const moving = speed > 0.35;
    this.ripple(position.x, water.surface, position.z, water.deep ? (moving ? 1.6 : 1.2) : 0.9, moving ? 1.1 : 1.6);
    if (moving && water.deep && Math.random() < 0.5) this.splash(position.x, water.surface, position.z, 0.35);
    this.timers.set(key, moving ? 0.28 : 0.9);
  }

  forget(key: string) { this.timers.delete(key); this.inWater.delete(key); }

  update(dt: number) {
    const light = daylight.water.light.value;
    (this.dropMesh.material as THREE.MeshBasicMaterial).color.copy(DROP_COLOR).multiplyScalar(light);
    for (const ring of this.rings) {
      if (!ring.mesh.visible) continue;
      ring.material.color.copy(RING_COLOR).multiplyScalar(light);
      ring.age += dt;
      const p = ring.age / ring.life;
      if (p >= 1) { ring.mesh.visible = false; continue; }
      const scale = ring.size * (0.25 + Math.sqrt(p) * 0.95);
      ring.mesh.scale.set(scale, 1, scale);
      ring.material.opacity = 0.55 * (1 - p) * Math.min(1, p * 6);
    }
    let changed = false;
    for (let i = 0; i < DROPS; i++) {
      const drop = this.drops[i];
      if (drop.age >= drop.life) continue;
      drop.age += dt;
      this.dropMesh.getMatrixAt(i, this.matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(this.matrix);
      drop.velocity.y -= 9.8 * dt;
      position.addScaledVector(drop.velocity, dt);
      if (position.y < drop.floor || drop.age >= drop.life) { drop.age = drop.life; this.dropMesh.setMatrixAt(i, this.hidden); }
      else this.dropMesh.setMatrixAt(i, this.matrix.makeTranslation(position.x, position.y, position.z));
      changed = true;
    }
    if (changed) this.dropMesh.instanceMatrix.needsUpdate = true;
  }
}

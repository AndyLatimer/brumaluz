import * as THREE from 'three';
import type { Character } from '../../character/character';
import type { MapCollision } from '../../world/mapRuntime';

// Modo paseo: un personaje con el mismo movimiento, colisiones y salto que el juego,
// para comprobar el mapa a ras de suelo.

export class WalkMode {
  active = false;
  private holder = new THREE.Group();
  private character: Character | null = null;
  private keys = new Set<string>();
  private velocity = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0.32;
  private distance = 6.5;
  private ground = 0;
  private jumpDuration = 0;
  private jumpElapsed = 0;
  private jumpHeight = 0;
  private dragging = false;
  private abort: AbortController | null = null;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
    private collision: () => MapCollision,
    private makeCharacter: () => Promise<Character>,
    private onExit: () => void,
  ) { this.holder.name = 'editor-walker'; }

  async start(position: THREE.Vector3, yaw: number) {
    if (this.active) return;
    this.character ??= await this.makeCharacter();
    if (!this.holder.children.includes(this.character.root)) this.holder.add(this.character.root);
    const collision = this.collision();
    this.holder.position.copy(position);
    this.ground = collision.platformY(position.x, position.z) ?? collision.groundY(position.x, position.z);
    this.holder.position.y = this.ground;
    this.holder.rotation.y = yaw;
    this.yaw = yaw + Math.PI;
    this.velocity.set(0, 0, 0);
    this.jumpDuration = this.jumpElapsed = this.jumpHeight = 0;
    this.scene.add(this.holder);
    this.active = true;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    window.addEventListener('keydown', event => {
      if ((event.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      if (event.code === 'Escape') { event.preventDefault(); this.stop(); return; }
      if (event.code === 'Space') { event.preventDefault(); this.startJump(); }
      this.keys.add(event.code);
    }, { signal });
    window.addEventListener('keyup', event => this.keys.delete(event.code), { signal });
    window.addEventListener('blur', () => this.keys.clear(), { signal });
    this.dom.addEventListener('pointerdown', event => { if (event.button === 2 || event.button === 0) { this.dragging = true; this.dom.setPointerCapture(event.pointerId); } }, { signal });
    this.dom.addEventListener('pointerup', event => { this.dragging = false; if (this.dom.hasPointerCapture(event.pointerId)) this.dom.releasePointerCapture(event.pointerId); }, { signal });
    this.dom.addEventListener('pointermove', event => {
      if (!this.dragging) return;
      this.yaw -= event.movementX * 0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch + event.movementY * 0.004, -0.2, 1.3);
    }, { signal });
    this.dom.addEventListener('wheel', event => { event.preventDefault(); this.distance = THREE.MathUtils.clamp(this.distance * (1 + Math.sign(event.deltaY) * 0.1), 2.5, 22); }, { signal, passive: false });
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.abort?.abort();
    this.keys.clear();
    this.holder.removeFromParent();
    this.onExit();
  }

  get position() { return this.holder.position; }

  private startJump() {
    if (!this.character || (this.jumpDuration > 0 && this.jumpElapsed < this.jumpDuration)) return;
    this.jumpDuration = this.character.jump() || 0.82;
    this.jumpElapsed = 0;
  }

  update(dt: number, t: number) {
    if (!this.active || !this.character) return;
    const collision = this.collision();
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const dir = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dir.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dir.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dir.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dir.sub(right);
    if (dir.lengthSq()) dir.normalize();
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const maxSpeed = dir.lengthSq() ? (running ? 6.2 : 2.4) : 0;
    this.velocity.lerp(dir.multiplyScalar(maxSpeed), 1 - Math.exp(-dt * (maxSpeed > 0 ? 9 : 11)));
    const speed = this.velocity.length();
    if (speed < 0.05) this.velocity.set(0, 0, 0);
    this.character.setGait(speed < 0.35 ? 'idle' : speed > 4 ? 'run' : 'walk');
    const holder = this.holder;
    if (speed >= 0.05) {
      const from = holder.position.clone();
      const to = from.clone().addScaledVector(this.velocity, dt);
      const p = collision.collide(from, to);
      holder.position.x = p.x; holder.position.z = p.z;
      if (speed > 0.35) {
        let d = Math.atan2(this.velocity.x, this.velocity.z) - holder.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        holder.rotation.y += d * (1 - Math.exp(-dt * 12));
      }
    }
    const wasJumping = this.jumpDuration > 0 && this.jumpElapsed < this.jumpDuration;
    const previousJump = this.jumpHeight, previousFoot = holder.position.y;
    if (wasJumping) {
      this.jumpElapsed = Math.min(this.jumpElapsed + dt, this.jumpDuration);
      const p = this.jumpElapsed / this.jumpDuration;
      this.jumpHeight = 4 * p * (1 - p) * 1.15;
    } else { this.jumpElapsed = this.jumpDuration; this.jumpHeight = 0; }
    const platform = collision.platformY(holder.position.x, holder.position.z);
    let support = collision.groundY(holder.position.x, holder.position.z);
    if (platform !== null && Math.abs(platform - this.ground) < 0.22) support = platform;
    this.ground += (support - this.ground) * (1 - Math.exp(-dt * 12));
    if (wasJumping && this.jumpHeight < previousJump && platform !== null && previousFoot >= platform && this.ground + this.jumpHeight <= platform) {
      this.ground = platform; this.jumpElapsed = this.jumpDuration; this.jumpHeight = 0;
    }
    holder.position.y = this.ground + this.jumpHeight;
    this.character.update(t);
    const focus = holder.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const offset = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.distance);
    this.camera.position.copy(focus).add(offset);
    const floor = collision.groundY(this.camera.position.x, this.camera.position.z) + 0.4;
    if (this.camera.position.y < floor) this.camera.position.y = floor;
    this.camera.lookAt(focus);
  }
}

import * as THREE from 'three';
import type { Character } from '../character/character';

export const POPULATION_VISUAL_LIMITS = {
  normal: { distance: 72, visible: 24, shadows: 22 },
  compatible: { distance: 56, visible: 16, shadows: 0 },
  near: 14, medium: 32,
} as const;

interface ResidentView {
  id: string;
  character: Character;
  pinned(): boolean;
  meshes: THREE.Mesh[];
  nextAnimation: number;
  shadows: boolean | undefined;
  distance: number;
  parent: THREE.Object3D | null;
}
export interface PopulationPresentationStats { total: number; visible: number; animated: number; near: number; medium: number; far: number }

/** Rendering and skeleton work depend on the current view, not the population of the whole city. */
export class PopulationPresentation {
  private actors: ResidentView[];
  private frustum = new THREE.Frustum();
  private matrix = new THREE.Matrix4();
  private sphere = new THREE.Sphere(new THREE.Vector3(), 2);
  private stats: PopulationPresentationStats;

  constructor(actors: Iterable<{ id: string; character: Character; pinned(): boolean }>) {
    this.actors = [...actors].map(actor => {
      const meshes: THREE.Mesh[] = [];
      actor.character.root.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
      actor.character.root.visible = false;
      const parent = actor.character.root.parent;
      actor.character.root.removeFromParent();
      return { ...actor, meshes, parent, nextAnimation: -Infinity, shadows: undefined, distance: Infinity };
    });
    this.stats = { total: this.actors.length, visible: 0, animated: 0, near: 0, medium: 0, far: 0 };
  }

  snapshot() { return { ...this.stats }; }

  update(t: number, camera: THREE.Camera, focus: THREE.Vector3, playing: boolean, compatible: boolean) {
    const limits = compatible ? POPULATION_VISUAL_LIMITS.compatible : POPULATION_VISUAL_LIMITS.normal;
    this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const candidates: ResidentView[] = [];
    for (const actor of this.actors) {
      actor.distance = actor.character.root.position.distanceToSquared(focus);
      this.sphere.center.copy(actor.character.root.position); this.sphere.center.y += .9;
      if (playing && (actor.pinned() || (actor.distance <= limits.distance ** 2 && this.frustum.intersectsSphere(this.sphere)))) candidates.push(actor);
      else { actor.character.root.visible = false; actor.character.root.removeFromParent(); }
    }
    candidates.sort((a, b) => Number(b.pinned()) - Number(a.pinned()) || a.distance - b.distance);
    this.stats = { total: this.actors.length, visible: 0, animated: 0, near: 0, medium: 0, far: 0 };
    for (const actor of candidates) {
      const pinned = actor.pinned();
      if (!pinned && this.stats.visible >= limits.visible) { actor.character.root.visible = false; actor.character.root.removeFromParent(); continue; }
      const entering = !actor.character.root.visible;
      actor.character.root.visible = true;
      if (!actor.character.root.parent) actor.parent?.add(actor.character.root);
      this.stats.visible++;
      const near = pinned || actor.distance <= POPULATION_VISUAL_LIMITS.near ** 2;
      const medium = !near && actor.distance <= POPULATION_VISUAL_LIMITS.medium ** 2;
      this.stats[near ? 'near' : medium ? 'medium' : 'far']++;
      const interval = near ? 0 : medium ? 1 / 15 : 1 / 10;
      if (entering || near || t >= actor.nextAnimation) {
        actor.character.update(t);
        actor.nextAnimation = t + interval;
        this.stats.animated++;
      }
      const shadows = limits.shadows > 0 && actor.distance <= limits.shadows ** 2;
      if (shadows !== actor.shadows) {
        for (const mesh of actor.meshes) mesh.castShadow = shadows;
        actor.shadows = shadows;
      }
    }
  }

  dispose() { for (const actor of this.actors) { actor.character.root.visible = false; actor.character.root.removeFromParent(); } this.actors = []; }
}

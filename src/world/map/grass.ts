// Hierba: matas instanciadas sobre el terreno.
import * as THREE from 'three';
import { type TerrainField, type TerrainRegion, hash2 } from './terrain';

// ---------------------------------------------------------------------------
// Hierba y flores
// ---------------------------------------------------------------------------

export const MAX_TUFTS = 320_000;
/** Patches are small enough to cull without throwing away grass near their edges. */
export const GRASS_PATCH_SIZE = 40;
export const GRASS_VIEW_DISTANCE = 60;
export function tuftGeometry() {
  const blades = [
    [0, 0.09, 0.78, '#547f35'], [Math.PI / 3, 0.08, 1.02, '#78a943'], [(Math.PI * 2) / 3, 0.09, 0.68, '#68983c'],
    [Math.PI / 6, 0.075, 0.9, '#8ab94d'], [(Math.PI * 5) / 6, 0.08, 0.72, '#5f8e37'], [Math.PI, 0.08, 0.86, '#6b9e3e'],
  ] as const;
  const positions: number[] = [], colors: number[] = [];
  const base = new THREE.Color(), tip = new THREE.Color();
  for (const [angle, width, height, hex] of blades) {
    const sx = Math.cos(angle) * width / 2, sz = Math.sin(angle) * width / 2;
    const lean = 0.12;
    base.set(hex).multiplyScalar(0.72); tip.set(hex).multiplyScalar(1.12);
    positions.push(-sx, 0, -sz, sx, 0, sz, Math.cos(angle + Math.PI / 2) * lean, height, Math.sin(angle + Math.PI / 2) * lean);
    colors.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
export class GrassField {
  readonly root = new THREE.Group();
  private time = { value: 0 };
  private focus = { value: new THREE.Vector2() };
  private range = { value: new THREE.Vector2(1e8, 2e8) };
  private patches: { root: THREE.Group; x: number; z: number }[] = [];
  private material: THREE.MeshStandardMaterial;
  private flowerMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  private stemMaterial = new THREE.MeshStandardMaterial({ color: '#64843d', roughness: 1 });
  private geometry = tuftGeometry();
  private headGeometry = new THREE.IcosahedronGeometry(0.075, 0);
  private stemGeometry = new THREE.CylinderGeometry(0.015, 0.03, 0.32, 4).translate(0, 0.16, 0);
  count = 0;
  constructor() {
    this.root.name = 'map-grass';
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    for (const [material, sway] of [[this.material, true], [this.flowerMaterial, false], [this.stemMaterial, false]] as const) {
      material.onBeforeCompile = shader => {
        shader.uniforms.grassTime = this.time;
        shader.uniforms.grassFocus = this.focus;
        shader.uniforms.grassRange = this.range;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float grassTime;\nuniform vec2 grassFocus;\nuniform vec2 grassRange;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec2 grassRoot = (modelMatrix * instanceMatrix[3]).xz;
            float grassVisibility = 1.0 - smoothstep(grassRange.x, grassRange.y, distance(grassRoot, grassFocus));
            ${sway ? `float sway = sin(grassTime * 1.7 + grassRoot.x * 0.31 + grassRoot.y * 0.23) * 0.08 + sin(grassTime * 3.1 + grassRoot.x) * 0.025;
            transformed.x += sway * position.y;
            transformed.z += sway * 0.6 * position.y;` : ''}
            transformed *= grassVisibility;
          #endif`);
      };
      material.customProgramCacheKey = () => `brumaluz-map-grass-v2-${sway ? 'sway' : 'still'}`;
    }
    // The atlas briefly reveals the whole landscape, including shader-faded grass.
    this.root.userData.revealAll = () => {
      const previous = this.range.value.clone();
      const hidden = this.patches.filter(patch => !patch.root.visible);
      this.range.value.set(1e8, 2e8);
      for (const patch of hidden) patch.root.visible = true;
      return () => { this.range.value.copy(previous); for (const patch of hidden) patch.root.visible = false; };
    };
  }
  rebuild(field: TerrainField, waterLevel: number | null, region?: TerrainRegion) {
    void region;
    this.clearPatches();
    const { columns, rows, cell, minX, minZ, data } = field;
    const perVertex = 4 * cell * cell;
    let total = 0;
    for (let index = 0; index < data.grass.length; index++) total += data.grass[index] / 255 * perVertex;
    const thin = total > MAX_TUFTS ? MAX_TUFTS / total : 1;
    const patches = new Map<string, { x: number; z: number; matrices: number[]; flowers: number[] }>();
    const patchAt = (x: number, z: number) => {
      const gx = Math.floor(x / GRASS_PATCH_SIZE), gz = Math.floor(z / GRASS_PATCH_SIZE), key = `${gx},${gz}`;
      let patch = patches.get(key);
      if (!patch) patches.set(key, patch = { x: (gx + .5) * GRASS_PATCH_SIZE, z: (gz + .5) * GRASS_PATCH_SIZE, matrices: [], flowers: [] });
      return patch;
    };
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const density = data.grass[j * columns + i];
      if (!density) continue;
      const wanted = density / 255 * perVertex * thin;
      let n = Math.floor(wanted);
      if (hash2(i * 3 + 1, j * 7 + 2) < wanted - n) n++;
      for (let k = 0; k < n; k++) {
        const x = minX + (i + hash2(i * 13 + k, j * 5 + 1) - 0.5) * cell;
        const z = minZ + (j + hash2(i * 7 + 3, j * 11 + k) - 0.5) * cell;
        if (!field.contains(x, z)) continue;
        const y = field.heightAt(x, z);
        if (waterLevel !== null && y < waterLevel + 0.05) continue;
        if (field.waterAt(x, z) !== null) continue; // ni bajo el agua pintada
        const r = hash2(i + k * 17, j * 3 + k);
        if (r < 0.05 && density > 60) { patchAt(x, z).flowers.push(x, y, z, r * 20); continue; }
        rotation.setFromAxisAngle(up, r * Math.PI * 2);
        const s = 0.9 + hash2(i * 31 + k, j * 29) * 0.5;
        position.set(x, y - 0.02, z); scale.set(s, s * 0.6, s);
        matrix.compose(position, rotation, scale);
        patchAt(x, z).matrices.push(...matrix.elements);
      }
    }
    this.count = 0;
    const palette = ['#d3a0a0', '#9c8bb2', '#e3ddd1', '#91a8a2', '#e6c86a'].map(value => new THREE.Color(value));
    for (const { x, z, matrices, flowers } of patches.values()) {
      const root = new THREE.Group();
      root.name = 'grass-patch';
      root.userData.mapChunk = true;
      this.root.add(root);
      this.patches.push({ root, x, z });
      const count = matrices.length / 16;
      this.count += count;
      if (count) {
        const mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
        mesh.instanceMatrix.array.set(matrices);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        mesh.name = 'grass_tufts';
        mesh.raycast = () => {};
        root.add(mesh);
      }
      const flowerCount = flowers.length / 4;
      if (flowerCount) {
        const stems = new THREE.InstancedMesh(this.stemGeometry, this.stemMaterial, flowerCount);
        const heads = new THREE.InstancedMesh(this.headGeometry, this.flowerMaterial, flowerCount);
        for (let f = 0; f < flowerCount; f++) {
          const [x, y, z, hue] = flowers.slice(f * 4, f * 4 + 4);
          rotation.identity(); scale.set(1, 1, 1);
          stems.setMatrixAt(f, matrix.compose(position.set(x, y, z), rotation, scale));
          heads.setMatrixAt(f, matrix.compose(position.set(x, y + 0.34, z), rotation, scale.set(1, 0.6, 1)));
          heads.setColorAt(f, palette[Math.floor(hue) % palette.length]);
        }
        for (const mesh of [stems, heads]) { mesh.raycast = () => {}; mesh.computeBoundingSphere(); root.add(mesh); }
      }
    }
  }
  /** Without a focus the editor shows all grass; the game fades it before culling patches. */
  update(t: number, focus?: THREE.Vector3, distance = GRASS_VIEW_DISTANCE) {
    this.time.value = t;
    const limited = !!focus && Number.isFinite(distance);
    const reach = Math.max(1, distance);
    if (limited) { this.focus.value.set(focus!.x, focus!.z); this.range.value.set(reach * .6, reach); }
    else this.range.value.set(1e8, 2e8);
    const halfDiagonal = GRASS_PATCH_SIZE * Math.SQRT1_2;
    for (const patch of this.patches) patch.root.visible = !limited || Math.hypot(patch.x - focus!.x, patch.z - focus!.z) <= reach + halfDiagonal;
  }
  private clearPatches() {
    for (const patch of this.patches) {
      patch.root.traverse(child => { if ((child as THREE.InstancedMesh).isInstancedMesh) (child as THREE.InstancedMesh).dispose(); });
      patch.root.removeFromParent();
    }
    this.patches.length = 0;
  }
  dispose() {
    this.clearPatches();
    this.geometry.dispose(); this.headGeometry.dispose(); this.stemGeometry.dispose();
    this.material.dispose(); this.flowerMaterial.dispose(); this.stemMaterial.dispose();
  }
}

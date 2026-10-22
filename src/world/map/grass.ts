// Hierba: matas instanciadas sobre el terreno.
import * as THREE from 'three';
import { type TerrainField, type TerrainRegion, hash2 } from './terrain';

// ---------------------------------------------------------------------------
// Hierba y flores
// ---------------------------------------------------------------------------

export const MAX_TUFTS = 320_000;
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
    const time = this.time;
    this.material.onBeforeCompile = shader => {
      shader.uniforms.grassTime = time;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float grassTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec2 grassRoot = instanceMatrix[3].xz;
            float sway = sin(grassTime * 1.7 + grassRoot.x * 0.31 + grassRoot.y * 0.23) * 0.08 + sin(grassTime * 3.1 + grassRoot.x) * 0.025;
            transformed.x += sway * position.y;
            transformed.z += sway * 0.6 * position.y;
          #endif`);
    };
    this.material.customProgramCacheKey = () => 'brumaluz-map-grass-v1';
  }
  rebuild(field: TerrainField, waterLevel: number | null, region?: TerrainRegion) {
    void region;
    for (const child of [...this.root.children]) { this.root.remove(child); (child as THREE.InstancedMesh).dispose(); }
    const { columns, rows, cell, minX, minZ, data } = field;
    const perVertex = 4 * cell * cell;
    let total = 0;
    for (let index = 0; index < data.grass.length; index++) total += data.grass[index] / 255 * perVertex;
    const thin = total > MAX_TUFTS ? MAX_TUFTS / total : 1;
    const matrices: number[] = [];
    const flowers: number[] = [];
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
        if (r < 0.05 && density > 60) { flowers.push(x, y, z, r * 20); continue; }
        rotation.setFromAxisAngle(up, r * Math.PI * 2);
        const s = 0.9 + hash2(i * 31 + k, j * 29) * 0.5;
        position.set(x, y - 0.02, z); scale.set(s, s * 0.6, s);
        matrix.compose(position, rotation, scale);
        matrices.push(...matrix.elements);
      }
    }
    this.count = matrices.length / 16;
    if (this.count) {
      const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.count);
      mesh.instanceMatrix.array.set(matrices);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.name = 'grass_tufts';
      mesh.raycast = () => {};
      this.root.add(mesh);
    }
    const flowerCount = flowers.length / 4;
    if (flowerCount) {
      const palette = ['#d3a0a0', '#9c8bb2', '#e3ddd1', '#91a8a2', '#e6c86a'].map(value => new THREE.Color(value));
      const stems = new THREE.InstancedMesh(this.stemGeometry, this.stemMaterial, flowerCount);
      const heads = new THREE.InstancedMesh(this.headGeometry, this.flowerMaterial, flowerCount);
      for (let f = 0; f < flowerCount; f++) {
        const [x, y, z, hue] = flowers.slice(f * 4, f * 4 + 4);
        rotation.identity(); scale.set(1, 1, 1);
        stems.setMatrixAt(f, matrix.compose(position.set(x, y, z), rotation, scale));
        heads.setMatrixAt(f, matrix.compose(position.set(x, y + 0.34, z), rotation, scale.set(1, 0.6, 1)));
        heads.setColorAt(f, palette[Math.floor(hue) % palette.length]);
      }
      for (const mesh of [stems, heads]) { mesh.raycast = () => {}; mesh.castShadow = true; mesh.computeBoundingSphere(); this.root.add(mesh); }
    }
  }
  update(t: number) { this.time.value = t; }
  dispose() {
    for (const child of this.root.children) (child as THREE.InstancedMesh).dispose();
    this.geometry.dispose(); this.headGeometry.dispose(); this.stemGeometry.dispose();
    this.material.dispose(); this.flowerMaterial.dispose(); this.stemMaterial.dispose();
  }
}

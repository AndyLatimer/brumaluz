// Terreno del mapa: alturas por casilla y su superficie pintada.
import * as THREE from 'three';
import { type TerrainData, sampleHeight, sampleWater, GROUND_MATERIALS } from '../../data/maps';

// ---------------------------------------------------------------------------
// Terreno
// ---------------------------------------------------------------------------

export class TerrainField {
  constructor(public data: TerrainData) {}
  get columns() { return this.data.columns; }
  get rows() { return this.data.rows; }
  get cell() { return this.data.cell; }
  get minX() { return this.data.origin[0]; }
  get minZ() { return this.data.origin[1]; }
  get maxX() { return this.data.origin[0] + (this.data.columns - 1) * this.data.cell; }
  get maxZ() { return this.data.origin[1] + (this.data.rows - 1) * this.data.cell; }
  gridX(x: number) { return (x - this.data.origin[0]) / this.data.cell; }
  gridZ(z: number) { return (z - this.data.origin[1]) / this.data.cell; }
  contains(x: number, z: number, margin = 0) {
    return x >= this.minX + margin && x <= this.maxX - margin && z >= this.minZ + margin && z <= this.maxZ - margin;
  }
  heightAt(x: number, z: number) { return sampleHeight(this.data, this.gridX(x), this.gridZ(z)); }
  /** Lámina del agua pintada en el editor, o null en seco (o si queda por debajo del suelo). */
  waterAt(x: number, z: number) {
    const level = sampleWater(this.data, this.gridX(x), this.gridZ(z));
    return level !== null && level > this.heightAt(x, z) + 0.02 ? level : null;
  }
  index(i: number, j: number) { return j * this.data.columns + i; }
  /** Recorre los vértices dentro de un círculo con su peso de pincel (0-1). */
  forEachInRadius(x: number, z: number, radius: number, hardness: number, visit: (index: number, weight: number, i: number, j: number) => void) {
    const cell = this.data.cell;
    const i0 = Math.max(0, Math.floor(this.gridX(x - radius))), i1 = Math.min(this.columns - 1, Math.ceil(this.gridX(x + radius)));
    const j0 = Math.max(0, Math.floor(this.gridZ(z - radius))), j1 = Math.min(this.rows - 1, Math.ceil(this.gridZ(z + radius)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = this.minX + i * cell - x, dz = this.minZ + j * cell - z;
      const d = Math.hypot(dx, dz) / radius;
      if (d > 1) continue;
      const t = THREE.MathUtils.clamp((d - hardness) / Math.max(1e-3, 1 - hardness), 0, 1);
      visit(this.index(i, j), 1 - t * t * (3 - 2 * t), i, j);
    }
    return { i0, i1, j0, j1 };
  }
}
export interface TerrainRegion { i0: number; i1: number; j0: number; j1: number }
export const hash2 = (i: number, j: number) => {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const GROUND_COLORS = GROUND_MATERIALS.map(material => new THREE.Color(material.color));
/** Malla del terreno, textura de alturas para piezas deformables y uniforms compartidos. */
export class TerrainSurface {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly heightTexture: THREE.DataTexture;
  readonly uniforms = {
    mapHeight: { value: null as unknown as THREE.DataTexture },
    mapTerrain: { value: new THREE.Vector4() },
    mapTerrainSize: { value: new THREE.Vector2() },
  };
  constructor(readonly field: TerrainField) {
    const { columns, rows } = field;
    const positions = new Float32Array(columns * rows * 3), colors = new Float32Array(columns * rows * 3);
    const indexCount = (columns - 1) * (rows - 1) * 6;
    const indices = columns * rows > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let k = 0;
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < columns - 1; i++) {
      const a = j * columns + i, b = a + 1, c = a + columns, d = c + 1;
      // Diagonal alterna para que las laderas no se vean en dientes de sierra.
      if ((i + j) % 2) { indices.set([a, c, b, b, c, d], k); } else { indices.set([a, c, d, a, d, b], k); }
      k += 6;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, flatShading: true,
      // Las casillas hexagonales comparten el plano del suelo: que ganen ellas.
      polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'map-terrain';
    this.mesh.receiveShadow = true;
    this.heightTexture = new THREE.DataTexture(new Float32Array(columns * rows), columns, rows, THREE.RedFormat, THREE.FloatType);
    this.heightTexture.minFilter = this.heightTexture.magFilter = THREE.NearestFilter;
    this.uniforms.mapHeight.value = this.heightTexture;
    this.uniforms.mapTerrain.value.set(field.minX, field.minZ, field.cell, 0);
    this.uniforms.mapTerrainSize.value.set(columns, rows);
    this.update();
  }
  update(region?: TerrainRegion) {
    const { columns, rows, cell, minX, minZ, data } = this.field;
    const r = region ?? { i0: 0, i1: columns - 1, j0: 0, j1: rows - 1 };
    const position = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const color = this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    const heights = this.heightTexture.image.data as unknown as Float32Array;
    const tmp = new THREE.Color();
    for (let j = r.j0; j <= r.j1; j++) for (let i = r.i0; i <= r.i1; i++) {
      const index = j * columns + i;
      position.setXYZ(index, minX + i * cell, data.heights[index], minZ + j * cell);
      heights[index] = data.heights[index];
      tmp.copy(GROUND_COLORS[data.paint[index]] ?? GROUND_COLORS[0]).multiplyScalar(0.93 + hash2(i, j) * 0.12);
      color.setXYZ(index, tmp.r, tmp.g, tmp.b);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    this.heightTexture.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
    this.mesh.geometry.computeBoundingBox();
  }
  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.heightTexture.dispose(); }
}

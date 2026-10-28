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
  private chunks: {mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;i0:number;j0:number;i1:number;j1:number}[]=[];
  private drawMaterial:THREE.MeshStandardMaterial|null=null;
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly heightTexture: THREE.DataTexture;
  readonly uniforms = {
    mapHeight: { value: null as unknown as THREE.DataTexture },
    mapTerrain: { value: new THREE.Vector4() },
    mapTerrainSize: { value: new THREE.Vector2() },
  };
  constructor(readonly field: TerrainField, chunked=false) {
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
    // Keep the master grid for editing, height queries and tile sinking. Large
    // game worlds draw small patches so the GPU can cull distant terrain.
    if(chunked&&columns*rows>200000){
      this.drawMaterial=material;
      this.mesh.material=material.clone();this.mesh.material.visible=false;
      const size=64;
      for(let j0=0;j0<rows-1;j0+=size)for(let i0=0;i0<columns-1;i0+=size){
        const i1=Math.min(columns-1,i0+size),j1=Math.min(rows-1,j0+size),width=i1-i0+1,height=j1-j0+1;
        const geometry=new THREE.BufferGeometry(),indices=new Uint16Array((width-1)*(height-1)*6);
        geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(width*height*3),3));
        geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(width*height*3),3));
        let k=0;
        for(let z=0;z<height-1;z++)for(let x=0;x<width-1;x++){
          const a=z*width+x,b=a+1,c=a+width,d=c+1;
          indices.set((i0+x+j0+z)%2?[a,c,b,b,c,d]:[a,c,d,a,d,b],k);k+=6;
        }
        geometry.setIndex(new THREE.BufferAttribute(indices,1));
        const patch=new THREE.Mesh(geometry,material);patch.name='terrain-patch';patch.receiveShadow=true;patch.userData.mapChunk=true;
        this.mesh.add(patch);this.chunks.push({mesh:patch,i0,j0,i1,j1});
      }
      this.refreshRenderedChunks();
    }
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
    this.refreshRenderedChunks(r);
  }
  /** Also called after the visual-only depression beneath pavement tiles. */
  refreshRenderedChunks(region?:TerrainRegion){
    const master=this.mesh.geometry.getAttribute('position'),colors=this.mesh.geometry.getAttribute('color');
    for(const patch of this.chunks){
      if(region&&(patch.i1<region.i0||patch.i0>region.i1||patch.j1<region.j0||patch.j0>region.j1))continue;
      const position=patch.mesh.geometry.getAttribute('position') as THREE.BufferAttribute,color=patch.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
      let n=0;
      for(let j=patch.j0;j<=patch.j1;j++)for(let i=patch.i0;i<=patch.i1;i++){
        const index=j*this.field.columns+i;position.setXYZ(n,master.getX(index),master.getY(index),master.getZ(index));color.setXYZ(n,colors.getX(index),colors.getY(index),colors.getZ(index));n++;
      }
      position.needsUpdate=true;color.needsUpdate=true;patch.mesh.geometry.computeBoundingBox();patch.mesh.geometry.computeBoundingSphere();
    }
  }
  cull(focus:THREE.Vector3,distance:number){
    const limit=distance*distance;
    for(const patch of this.chunks){
      const box=patch.mesh.geometry.boundingBox!;
      const dx=Math.max(box.min.x-focus.x,0,focus.x-box.max.x),dz=Math.max(box.min.z-focus.z,0,focus.z-box.max.z);
      patch.mesh.visible=dx*dx+dz*dz<=limit;
    }
  }
  dispose() { for(const patch of this.chunks)patch.mesh.geometry.dispose();this.drawMaterial?.dispose();this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.heightTexture.dispose(); }
}

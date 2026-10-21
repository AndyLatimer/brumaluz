import * as THREE from 'three';
import {
  GROUND_MATERIALS, decodeTerrain, sampleHeight,
  type MapCollider, type MapDocument, type MapLayer, type MapMarker, type MapObject, type MapSettings, type TerrainData,
} from '../data/maps';

// Motor de mapas compartido por el editor visual y, más adelante, por el juego.
// No depende de la biblioteca de recursos: recibe un proveedor de modelos.

export interface MapAssetProvider {
  template(id: string): Promise<THREE.Object3D>;
  collisionBox(id: string): Promise<THREE.Box3>;
}

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

const hash2 = (i: number, j: number) => {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const GROUND_COLORS = GROUND_MATERIALS.map(material => new THREE.Color(material.color));

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

// ---------------------------------------------------------------------------
// Materiales deformables y tintes
// ---------------------------------------------------------------------------

export class MaterialVariants {
  private cache = new Map<string, THREE.Material>();
  private uniforms = {
    mapHeight: { value: null as THREE.DataTexture | null },
    mapTerrain: { value: new THREE.Vector4() },
    mapTerrainSize: { value: new THREE.Vector2() },
  };
  constructor(surface?: TerrainSurface) { if (surface) this.bind(surface); }
  /** Todas las variantes deformables comparten estos uniforms: cambiar de terreno no recompila nada. */
  bind(surface: TerrainSurface) {
    this.uniforms.mapHeight.value = surface.heightTexture;
    this.uniforms.mapTerrain.value.copy(surface.uniforms.mapTerrain.value);
    this.uniforms.mapTerrainSize.value.copy(surface.uniforms.mapTerrainSize.value);
  }
  /** `ground`: casillas hexagonales; reciben el mismo verdeo de tonos amarillos que la ciudad procedural. */
  get(source: THREE.Material, conform: boolean, tint?: string, ground = false) {
    if (!conform && !tint && !ground) return source;
    const key = `${source.uuid}|${conform ? 1 : 0}|${tint ?? ''}|${ground ? 1 : 0}`;
    let material = this.cache.get(key);
    if (material) return material;
    material = source.clone();
    if (tint && 'color' in material && material.color instanceof THREE.Color) material.color.multiply(new THREE.Color(tint));
    if (conform || ground) {
      const uniforms = this.uniforms;
      material.onBeforeCompile = shader => {
        if (ground) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          if (diffuseColor.r > 0.18 && diffuseColor.g > diffuseColor.r * 0.72 && diffuseColor.b < diffuseColor.r * 0.52) {
            diffuseColor.rgb *= vec3(0.78, 1.08, 0.75);
          }`);
        if (!conform) return;
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
          uniform sampler2D mapHeight; uniform vec4 mapTerrain; uniform vec2 mapTerrainSize;
          float mapHeightAt(vec2 p) {
            vec2 g = clamp((p - mapTerrain.xy) / mapTerrain.z, vec2(0.0), mapTerrainSize - 1.0);
            ivec2 a = ivec2(floor(g));
            ivec2 b = min(a + 1, ivec2(mapTerrainSize) - 1);
            vec2 t = g - vec2(a);
            float h00 = texelFetch(mapHeight, a, 0).r, h10 = texelFetch(mapHeight, ivec2(b.x, a.y), 0).r;
            float h01 = texelFetch(mapHeight, ivec2(a.x, b.y), 0).r, h11 = texelFetch(mapHeight, b, 0).r;
            return mix(mix(h00, h10, t.x), mix(h01, h11, t.x), t.y);
          }`).replace('#include <begin_vertex>', `#include <begin_vertex>
          #if defined(USE_INSTANCING)
            mat4 mapWorld = modelMatrix * instanceMatrix;
          #elif defined(USE_BATCHING)
            mat4 mapWorld = modelMatrix * batchingMatrix;
          #else
            mat4 mapWorld = modelMatrix;
          #endif
          vec4 mapWorldPosition = mapWorld * vec4(transformed, 1.0);
          transformed.y += mapHeightAt(mapWorldPosition.xz) / max(1e-4, length(mapWorld[1].xyz));`);
      };
      material.customProgramCacheKey = () => `brumaluz-map-v3|${conform ? 1 : 0}|${ground ? 1 : 0}|${source.type}`;
    }
    this.cache.set(key, material);
    return material;
  }
  dispose() { for (const material of this.cache.values()) material.dispose(); this.cache.clear(); }
}

// ---------------------------------------------------------------------------
// Hierba y flores
// ---------------------------------------------------------------------------

const MAX_TUFTS = 320_000;
function tuftGeometry() {
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

// ---------------------------------------------------------------------------
// Cielo, luces y agua
// ---------------------------------------------------------------------------

const SKIES = {
  day: { top: '#5d8fd6', horizon: '#cfe4f2', ground: '#9cbf8a', fog: '#c7dbe6', sun: '#fff3dc', sunIntensity: 3.1, hemiSky: '#cfe0ff', hemiGround: '#7c6a50', hemi: 0.9, sunDir: [-0.4, 0.85, 0.35] },
  sunset: { top: '#5272c7', horizon: '#ffc78c', ground: '#c99a7a', fog: '#e8b090', sun: '#ffd2a0', sunIntensity: 3.2, hemiSky: '#b8c4ff', hemiGround: '#8a5a40', hemi: 0.55, sunDir: [-0.62, 0.7, 0.42] },
  dusk: { top: '#28305f', horizon: '#c58aa0', ground: '#6a5a6a', fog: '#8a7898', sun: '#ffb39a', sunIntensity: 1.6, hemiSky: '#8f96d8', hemiGround: '#4e3c4a', hemi: 0.6, sunDir: [-0.7, 0.35, 0.4] },
  night: { top: '#070b1c', horizon: '#26355a', ground: '#141a26', fog: '#1d2740', sun: '#a9bdff', sunIntensity: 0.55, hemiSky: '#5b6fae', hemiGround: '#1a1a26', hemi: 0.45, sunDir: [0.3, 0.8, -0.4] },
  overcast: { top: '#8d989f', horizon: '#c9cfd1', ground: '#8f978a', fog: '#b9c0c4', sun: '#eef2f5', sunIntensity: 1.3, hemiSky: '#e3e8ec', hemiGround: '#6e6c62', hemi: 1.2, sunDir: [-0.3, 0.9, 0.2] },
} as const;

export class MapEnvironment {
  readonly root = new THREE.Group();
  readonly sun = new THREE.DirectionalLight();
  readonly hemi = new THREE.HemisphereLight();
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private water: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  readonly clouds = new THREE.Group();
  private cloudItems: { object: THREE.Object3D; angle: number; radius: number; speed: number }[] = [];
  private sunDirection = new THREE.Vector3();
  waterLevel: number | null = null;
  /** `lighting = false`: solo agua y nubes; el juego aporta su propio cielo, luces y niebla. */
  constructor(private scene: THREE.Scene, private lighting = true) {
    this.root.name = 'map-environment';
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, sun: { value: new THREE.Vector3() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sun; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 col = mix(horizon, top, smoothstep(0.0, 0.6, h));
          col = mix(col, ground, smoothstep(0.0, -0.15, h));
          float s = max(dot(normalize(vDir), normalize(sun)), 0.0);
          col += vec3(1.0, 0.85, 0.6) * pow(s, 12.0) * 0.35 + vec3(1.0, 0.95, 0.8) * pow(s, 400.0);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    this.sky.raycast = () => {};
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
      transparent: true, roughness: 0.12, metalness: 0.1, depthWrite: false,
    }));
    this.water.name = 'map-water';
    this.water.renderOrder = 1;
    this.water.receiveShadow = true;
    this.water.raycast = () => {};
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.root.add(this.water, this.clouds);
    if (lighting) this.root.add(this.sky, this.sun, this.sun.target, this.hemi);
  }
  apply(settings: MapSettings, field: TerrainField) {
    const sky = SKIES[settings.sky];
    const material = this.sky.material;
    material.uniforms.top.value.set(sky.top);
    material.uniforms.horizon.value.set(sky.horizon);
    material.uniforms.ground.value.set(sky.ground);
    this.sunDirection.fromArray(sky.sunDir).normalize();
    material.uniforms.sun.value.copy(this.sunDirection);
    this.sun.color.set(sky.sun); this.sun.intensity = sky.sunIntensity;
    this.hemi.color.set(sky.hemiSky); this.hemi.groundColor.set(sky.hemiGround); this.hemi.intensity = sky.hemi;
    const span = Math.max(field.maxX - field.minX, field.maxZ - field.minZ);
    const far = THREE.MathUtils.lerp(Math.max(600, span * 2.5), 70, settings.fog);
    if (this.lighting) {
      this.scene.fog = settings.fog > 0 ? new THREE.Fog(sky.fog, far * 0.25, far) : null;
      this.scene.background = new THREE.Color(sky.horizon);
    }
    const water = settings.water;
    this.water.visible = water.enabled;
    this.waterLevel = water.enabled ? water.level : null;
    this.water.material.color.set(water.color);
    this.water.material.opacity = water.opacity;
    this.water.position.set((field.minX + field.maxX) / 2, water.level, (field.minZ + field.maxZ) / 2);
    this.water.scale.set(field.maxX - field.minX + 600, 1, field.maxZ - field.minZ + 600);
    this.clouds.visible = settings.clouds;
  }
  async setClouds(provider: MapAssetProvider, field: TerrainField) {
    if (this.cloudItems.length) return;
    const template = await provider.template('city/cloud_big').catch(() => null);
    if (!template || this.cloudItems.length) return;
    const material = new THREE.MeshStandardMaterial({ color: '#fff4ea', roughness: 1, emissive: '#ffd8c0', emissiveIntensity: 0.25 });
    const span = Math.max(field.maxX - field.minX, field.maxZ - field.minZ);
    for (let i = 0; i < 12; i++) {
      const cloud = template.clone(true);
      cloud.traverse(part => { if (part instanceof THREE.Mesh) { part.material = material; part.raycast = () => {}; part.castShadow = part.receiveShadow = false; } });
      cloud.scale.setScalar(4 * (2 + hash2(i, 3) * 2));
      cloud.position.y = 40 + span * 0.12 + hash2(i, 5) * 18;
      this.clouds.add(cloud);
      this.cloudItems.push({ object: cloud, angle: hash2(i, 1) * Math.PI * 2, radius: span * 0.35 + hash2(i, 2) * span * 0.45, speed: 0.004 + hash2(i, 4) * 0.004 });
    }
  }
  /** Centra el sol y su caja de sombras en un punto. */
  follow(center: THREE.Vector3, extent: number) {
    const camera = this.sun.shadow.camera;
    const e = Math.max(10, Math.min(140, extent));
    if (camera.right !== e) { camera.left = -e; camera.right = e; camera.top = e; camera.bottom = -e; camera.near = 1; camera.far = e * 4 + 120; camera.updateProjectionMatrix(); }
    const texel = (2 * e) / this.sun.shadow.mapSize.x;
    this.sun.target.position.set(Math.round(center.x / texel) * texel, center.y, Math.round(center.z / texel) * texel);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection, e * 2 + 40);
  }
  update(t: number, center: THREE.Vector3) {
    this.sky.position.copy(center);
    for (const cloud of this.cloudItems) {
      const angle = cloud.angle + t * cloud.speed;
      cloud.object.position.x = Math.cos(angle) * cloud.radius;
      cloud.object.position.z = Math.sin(angle) * cloud.radius;
      cloud.object.rotation.y = angle;
    }
  }
}

// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

export interface ObjectView { id: string; key: string; container: THREE.Group; animations: ((t: number) => void)[]; loaded: Promise<void>; detail?: boolean }
const missing = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#d0359a', wireframe: true }));

export function applyObjectTransform(container: THREE.Object3D, object: MapObject) {
  container.position.set(...object.position);
  container.rotation.set(object.rotation[0], object.rotation[1], object.rotation[2], 'YXZ');
  container.scale.set(...object.scale);
}

function objectAnimations(asset: string, root: THREE.Object3D, seed: number) {
  const result: ((t: number) => void)[] = [];
  if (asset === 'city/windmill') {
    const fan = root.getObjectByName('building_windmill_top_fan_blue');
    if (fan) result.push(t => { fan.rotation.z = t * 0.8 + seed; });
  }
  if (/^city\/flag/.test(asset)) {
    const base = root.rotation.y;
    result.push(t => { root.rotation.y = base + Math.sin(t * 1.4 + seed) * 0.05; });
  }
  return result;
}

/** Lado (m) de las celdas en que se agrupan los objetos para el campo de visión. */
export const VIEW_CHUNK = 24;
/** Objetos cuya diagonal (ya escalada) no llega a esto se consideran detalle y se dejan de dibujar antes. */
const DETAIL_SIZE = 3;
const templateSizes = new WeakMap<THREE.Object3D, number>();
function templateSize(template: THREE.Object3D) {
  let size = templateSizes.get(template);
  if (size === undefined) {
    size = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3()).length();
    templateSizes.set(template, size);
  }
  return size;
}

export class ObjectLayer {
  readonly root = new THREE.Group();
  readonly views = new Map<string, ObjectView>();
  /** Celdas del campo de visión: `b:` edificios y piezas grandes, `d:` detalles pequeños. */
  private readonly chunks = new Map<string, THREE.Group>();
  constructor(private provider: MapAssetProvider, private materials: MaterialVariants) { this.root.name = 'map-objects'; }
  private chunk(x: number, z: number, detail: boolean) {
    const gx = Math.floor(x / VIEW_CHUNK), gz = Math.floor(z / VIEW_CHUNK), key = `${detail ? 'd' : 'b'}:${gx},${gz}`;
    let group = this.chunks.get(key);
    if (!group) {
      group = new THREE.Group();
      group.name = 'map-chunk';
      group.userData.mapChunk = true;
      group.userData.detail = detail;
      group.userData.center = new THREE.Vector2((gx + 0.5) * VIEW_CHUNK, (gz + 0.5) * VIEW_CHUNK);
      this.chunks.set(key, group);
      this.root.add(group);
    }
    return group;
  }
  private place(view: ObjectView) {
    const chunk = this.chunk(view.container.position.x, view.container.position.z, !!view.detail);
    if (view.container.parent !== chunk) chunk.add(view.container);
  }
  /**
   * Campo de visión: solo se dibujan (y animan) las celdas a menos de `distance` m de `focus`;
   * los detalles pequeños, a menos de `detailDistance`. Sin llamarlo, todo queda visible (editor).
   */
  cull(focus: THREE.Vector3, distance: number, detailDistance = distance) {
    const half = VIEW_CHUNK * Math.SQRT1_2;
    for (const chunk of this.chunks.values()) {
      const center = chunk.userData.center as THREE.Vector2;
      const reach = (chunk.userData.detail ? detailDistance : distance) + half;
      const visible = Math.hypot(center.x - focus.x, center.y - focus.z) <= reach;
      if (visible !== chunk.visible) this.setChunkVisible(chunk, visible);
    }
  }
  /** Sincroniza las vistas con el documento; reutiliza las que no cambian de recurso. */
  sync(objects: readonly MapObject[], layers: readonly MapLayer[]) {
    const visible = new Set(layers.filter(layer => layer.visible).map(layer => layer.id));
    const seen = new Set<string>();
    objects.forEach((object, order) => {
      seen.add(object.id);
      const key = `${object.asset}|${object.conform ? 1 : 0}|${object.tint ?? ''}`;
      let view = this.views.get(object.id);
      if (!view || view.key !== key) {
        if (view) this.remove(view);
        view = this.create(object, key, order);
      }
      applyObjectTransform(view.container, object);
      view.container.visible = !object.hidden && visible.has(object.layer);
      this.place(view);
    });
    for (const view of [...this.views.values()]) if (!seen.has(view.id)) this.remove(view);
  }
  private create(object: MapObject, key: string, order: number): ObjectView {
    const container = new THREE.Group();
    container.name = object.id;
    container.userData.mapObjectId = object.id;
    container.userData.mapAsset = object.asset;
    const view: ObjectView = { id: object.id, key, container, animations: [], loaded: Promise.resolve() };
    view.loaded = this.provider.template(object.asset).then(template => {
      if (this.views.get(object.id) !== view) return;
      // Los detalles pequeños pasan a sus propias celdas, que se dejan de dibujar más cerca.
      view.detail = !object.asset.startsWith('city/hex_') && templateSize(template) * Math.max(...object.scale) < DETAIL_SIZE;
      if (container.parent) this.place(view);
      const copy = template.clone(true);
      const ground = object.asset.startsWith('city/hex_');
      copy.traverse(part => {
        if (!(part instanceof THREE.Mesh)) return;
        part.material = Array.isArray(part.material)
          ? part.material.map(material => this.materials.get(material, !!object.conform, object.tint, ground))
          : this.materials.get(part.material, !!object.conform, object.tint, ground);
        part.castShadow = !object.conform && !object.asset.startsWith('city/hex_');
        part.receiveShadow = true;
        // Las piezas deformadas cambian de altura en la GPU: que no desaparezcan en los bordes.
        if (object.conform) part.frustumCulled = false;
      });
      container.add(copy);
      view.animations = objectAnimations(object.asset, copy, order * 1.37);
    }).catch(() => {
      if (this.views.get(object.id) !== view) return;
      const box = missing.clone();
      box.userData.missingAsset = object.asset;
      container.add(box);
    });
    this.views.set(object.id, view);
    return view;
  }
  private remove(view: ObjectView) {
    view.container.removeFromParent();
    this.views.delete(view.id);
  }
  async ready() { await Promise.all([...this.views.values()].map(view => view.loaded)); }
  /**
   * Solo para el juego (el editor mueve objetos): las piezas estáticas se dibujan con un BatchedMesh por material,
   * unas pocas llamadas de dibujo para todo el mapa en vez de una por pieza. Cada celda del campo de visión
   * enciende o apaga sus instancias (`cull`). Los objetos originales quedan ocultos y siguen sirviendo para los
   * rayos de la cámara. Los animados (molinos, banderas) no se agrupan.
   */
  batch() {
    this.root.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    type Group = { material: THREE.Material; castShadow: boolean; receiveShadow: boolean; conform: boolean; items: { mesh: THREE.Mesh; chunk: THREE.Group }[] };
    const groups = new Map<string, Group>();
    for (const chunk of this.chunks.values()) {
      for (const container of [...chunk.children]) {
        const view = this.views.get(container.name);
        if (!view || view.container !== container || view.animations.length || !container.visible) continue;
        const meshes: THREE.Mesh[] = [];
        let plain = true;
        container.traverse(part => {
          const mesh = part as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (Array.isArray(mesh.material) || (mesh as THREE.SkinnedMesh).isSkinnedMesh || !mesh.visible) plain = false;
          else meshes.push(mesh);
        });
        if (!plain || !meshes.length) continue;
        for (const mesh of meshes) {
          const geometry = mesh.geometry, material = mesh.material as THREE.Material;
          // Un lote exige los mismos atributos (y lo mismo con o sin índice) en todas sus geometrías.
          const layout = Object.entries(geometry.attributes).map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized ? 1 : 0}`).sort().join(',');
          const key = `${material.uuid}|${layout}|${geometry.index ? 1 : 0}|${mesh.castShadow ? 1 : 0}|${mesh.frustumCulled ? 1 : 0}`;
          let group = groups.get(key);
          if (!group) groups.set(key, group = { material, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, conform: !mesh.frustumCulled, items: [] });
          group.items.push({ mesh, chunk });
        }
        container.visible = false;
      }
    }
    const matrix = new THREE.Matrix4();
    for (const group of groups.values()) {
      const unique = [...new Set(group.items.map(item => item.mesh.geometry))];
      const vertices = unique.reduce((sum, geometry) => sum + geometry.getAttribute('position').count, 0);
      const indices = unique.reduce((sum, geometry) => sum + (geometry.index?.count ?? 0), 0);
      const batched = new THREE.BatchedMesh(group.items.length, vertices, Math.max(indices, 1), group.material);
      const ids = new Map(unique.map(geometry => [geometry, batched.addGeometry(geometry)]));
      for (const { mesh, chunk } of group.items) {
        const instance = batched.addInstance(ids.get(mesh.geometry)!);
        batched.setMatrixAt(instance, matrix.multiplyMatrices(inverse, mesh.matrixWorld));
        ((chunk.userData.instances ??= []) as [THREE.BatchedMesh, number][]).push([batched, instance]);
      }
      batched.castShadow = group.castShadow;
      batched.receiveShadow = group.receiveShadow;
      batched.sortObjects = false;
      // Las casillas que se adaptan al terreno se deforman en la GPU: su caja no sirve para recortar.
      batched.perObjectFrustumCulled = !group.conform;
      batched.frustumCulled = !group.conform;
      batched.name = 'map-batch';
      batched.raycast = () => {};
      this.root.add(batched);
    }
    // El minimapa necesita ver el mapa entero un momento.
    this.root.userData.revealAll = () => {
      const hidden = [...this.chunks.values()].filter(chunk => !chunk.visible);
      for (const chunk of hidden) this.setChunkVisible(chunk, true);
      return () => { for (const chunk of hidden) this.setChunkVisible(chunk, false); };
    };
  }
  private setChunkVisible(chunk: THREE.Group, visible: boolean) {
    chunk.visible = visible;
    for (const [batched, instance] of (chunk.userData.instances ?? []) as [THREE.BatchedMesh, number][]) batched.setVisibleAt(instance, visible);
  }
  update(t: number) {
    for (const view of this.views.values()) {
      if (!view.animations.length || view.container.parent?.visible === false) continue;
      for (const animate of view.animations) animate(t);
    }
  }
}

// ---------------------------------------------------------------------------
// Colisiones
// ---------------------------------------------------------------------------

export interface CollisionShape {
  x: number; z: number; r: number;
  hx?: number; hz?: number; cos?: number; sin?: number;
  /** Altura superior: por encima se puede pasar (saltos y plataformas). */
  topY?: number; bottomY?: number;
  source: 'object' | 'collider' | 'marker';
  sourceId: string;
}
export interface PlatformShape { x: number; z: number; y: number; hx: number; hz: number; cos: number; sin: number; sourceId: string }

export const CHARACTER_RADIUS = 0.45;
const CITY_TREE_RADIUS: Record<string, number> = {
  tree_single_A: 0.34, tree_single_B: 0.38, trees_A_large: 0.72, trees_B_large: 0.72,
  trees_A_medium: 0.64, trees_B_medium: 0.64, trees_A_small: 0.52, trees_B_small: 0.52,
};

/** Formas de colisión automáticas o explícitas de un objeto, en coordenadas de mundo. */
export function objectCollision(object: MapObject, box: THREE.Box3 | undefined, field: TerrainField) {
  const shapes: CollisionShape[] = [], platforms: PlatformShape[] = [];
  if (object.hidden || object.collision === 'none') return { shapes, platforms };
  const [x, y, z] = object.position, [sx, sy, sz] = object.scale, ry = object.rotation[1];
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const name = object.asset.slice(object.asset.lastIndexOf('/') + 1);
  const city = object.asset.startsWith('city/');
  const baseY = object.conform ? field.heightAt(x, z) + y : y;
  const sourceId = object.id;
  if (!box || box.isEmpty()) {
    if (object.collision !== 'auto') shapes.push({ x, z, r: 0.5, source: 'object', sourceId });
    return { shapes, platforms };
  }
  const cx = (box.min.x + box.max.x) / 2 * sx, cz = (box.min.z + box.max.z) / 2 * sz;
  const hx = (box.max.x - box.min.x) / 2 * sx, hz = (box.max.z - box.min.z) / 2 * sz;
  const wx = x + cx * cos + cz * sin, wz = z - cx * sin + cz * cos;
  const topY = baseY + box.max.y * sy, bottomY = baseY + box.min.y * sy;
  const addBox = (ox: number, oz: number, bx: number, bz: number) => shapes.push({
    x: x + ox * cos + oz * sin, z: z - ox * sin + oz * cos, r: 0, hx: bx, hz: bz, cos, sin, topY, bottomY, source: 'object', sourceId,
  });
  if (object.collision === 'auto') {
    if (city && /^(hex_|cloud|flag|waterlily|waterplant)/.test(name)) {
      if (/^hex_(water|river_A|river_B)$/.test(name)) shapes.push({ x, z, r: 4.3 * sx / 4, source: 'object', sourceId });
      return { shapes, platforms };
    }
    if (Math.max(hx, hz) < 0.18 || topY - bottomY < 0.12) return { shapes, platforms };
    if (city && (name.startsWith('trees_') || name.startsWith('tree_single_'))) {
      const radius = CITY_TREE_RADIUS[name] ?? (name.endsWith('_large') ? 0.72 : name.endsWith('_medium') ? 0.64 : 0.52);
      shapes.push({ x, z, r: radius * sx / 4, source: 'object', sourceId });
      return { shapes, platforms };
    }
    if (city && /^(hills_|hill_|mountain_)/.test(name)) {
      shapes.push({ x: wx, z: wz, r: Math.max(hx, hz) * 0.62, source: 'object', sourceId });
      return { shapes, platforms };
    }
    if (!city && /tree|pine|birch|oak/i.test(name) && !/stump|log|fallen/i.test(name)) {
      shapes.push({ x: wx, z: wz, r: THREE.MathUtils.clamp(Math.min(hx, hz) * 0.3, 0.25, 1.2), source: 'object', sourceId });
      return { shapes, platforms };
    }
    if (city && name === 'wall_straight_gate') {
      for (const side of [-1, 1]) addBox(cx + side * 0.75 * sx, cz, 0.25 * sx, hz);
      return { shapes, platforms };
    }
    addBox(cx, cz, hx + (city && name === 'wall_straight' ? 0.05 : 0), hz);
  } else if (object.collision === 'box') addBox(cx, cz, hx, hz);
  else shapes.push({ x: wx, z: wz, r: Math.max(hx, hz), topY, bottomY, source: 'object', sourceId });
  const rise = topY - field.heightAt(wx, wz);
  const walkable = object.walkable ?? (object.collision !== 'circle' && rise >= 0.3 && rise <= 1.2 && hx >= 0.3 && hz >= 0.3);
  if (walkable) platforms.push({ x: wx, z: wz, y: topY, hx, hz, cos, sin, sourceId });
  return { shapes, platforms };
}

export function colliderCollision(collider: MapCollider) {
  const [x, y, z] = collider.position, cos = Math.cos(collider.rotationY), sin = Math.sin(collider.rotationY);
  const topY = y + collider.size[1];
  const shape: CollisionShape = collider.shape === 'box'
    ? { x, z, r: 0, hx: collider.size[0] / 2, hz: collider.size[2] / 2, cos, sin, topY, bottomY: y, source: 'collider', sourceId: collider.id }
    : { x, z, r: collider.size[0] / 2, topY, bottomY: y, source: 'collider', sourceId: collider.id };
  const platform: PlatformShape | null = collider.walkable
    ? { x, z, y: topY, hx: collider.shape === 'box' ? collider.size[0] / 2 : collider.size[0] / 2 * 0.7, hz: collider.shape === 'box' ? collider.size[2] / 2 : collider.size[0] / 2 * 0.7, cos, sin, sourceId: collider.id }
    : null;
  return { shape, platform };
}

class SpatialHash<T extends { x: number; z: number }> {
  private cells = new Map<string, T[]>();
  constructor(private size = 8) {}
  insert(item: T, radius: number) {
    const s = this.size;
    for (let gx = Math.floor((item.x - radius) / s); gx <= Math.floor((item.x + radius) / s); gx++) {
      for (let gz = Math.floor((item.z - radius) / s); gz <= Math.floor((item.z + radius) / s); gz++) {
        const key = `${gx},${gz}`;
        (this.cells.get(key) ?? this.cells.set(key, []).get(key)!).push(item);
      }
    }
  }
  query(x: number, z: number) { return this.cells.get(`${Math.floor(x / this.size)},${Math.floor(z / this.size)}`) ?? []; }
}

export interface MapCollision {
  shapes: CollisionShape[];
  platforms: PlatformShape[];
  collide(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3;
  groundY(x: number, z: number): number;
  platformY(x: number, z: number): number | null;
  blocked(x: number, z: number): boolean;
}

export function buildCollision(
  doc: Pick<MapDocument, 'objects' | 'colliders' | 'markers' | 'layers' | 'settings'>,
  field: TerrainField,
  boxes: ReadonlyMap<string, THREE.Box3>,
): MapCollision {
  const shapes: CollisionShape[] = [], platforms: PlatformShape[] = [];
  const hiddenLayers = new Set(doc.layers.filter(layer => !layer.visible).map(layer => layer.id));
  for (const object of doc.objects) {
    if (hiddenLayers.has(object.layer)) continue;
    const result = objectCollision(object, boxes.get(object.asset), field);
    shapes.push(...result.shapes); platforms.push(...result.platforms);
  }
  for (const collider of doc.colliders) {
    if (hiddenLayers.has(collider.layer)) continue;
    const { shape, platform } = colliderCollision(collider);
    shapes.push(shape);
    if (platform) platforms.push(platform);
  }
  for (const marker of doc.markers as MapMarker[]) {
    if (marker.type === 'npc' && !hiddenLayers.has(marker.layer)) shapes.push({ x: marker.position[0], z: marker.position[2], r: 0.5, source: 'marker', sourceId: marker.id });
  }
  const ME = CHARACTER_RADIUS;
  const shapeHash = new SpatialHash<CollisionShape>(), platformHash = new SpatialHash<PlatformShape>();
  for (const shape of shapes) shapeHash.insert(shape, (shape.hx === undefined ? shape.r : Math.hypot(shape.hx, shape.hz!)) + ME + 0.3);
  for (const platform of platforms) platformHash.insert(platform, Math.hypot(platform.hx, platform.hz));
  const water = doc.settings.water;
  const bounded = doc.settings.bounded;
  const groundY = (x: number, z: number) => field.heightAt(x, z);
  const blocked = (x: number, z: number) => (bounded && !field.contains(x, z, 0.5))
    || (water.enabled && field.heightAt(x, z) < water.level - 0.15);
  const pushOut = (out: THREE.Vector3, c: CollisionShape, from: THREE.Vector3) => {
    const dx = out.x - c.x, dz = out.z - c.z;
    if (c.hx === undefined || c.hz === undefined || c.cos === undefined || c.sin === undefined) {
      const d = Math.hypot(dx, dz), min = c.r + ME;
      if (d >= min) return;
      let nx = dx, nz = dz;
      if (d <= 1e-4) {
        nx = from.x - c.x; nz = from.z - c.z;
        if (Math.hypot(nx, nz) <= 1e-4) { nx = from.x - out.x; nz = from.z - out.z; }
        if (Math.hypot(nx, nz) <= 1e-4) { nx = 1; nz = 0; }
      }
      const length = Math.hypot(nx, nz);
      out.x = c.x + (nx / length) * min; out.z = c.z + (nz / length) * min;
      return;
    }
    const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
    const nx = THREE.MathUtils.clamp(lx, -c.hx, c.hx), nz = THREE.MathUtils.clamp(lz, -c.hz, c.hz);
    const ox = lx - nx, oz = lz - nz;
    let px: number, pz: number;
    const d = Math.hypot(ox, oz);
    if (d > 1e-4) {
      if (d >= ME) return;
      px = nx + (ox / d) * ME; pz = nz + (oz / d) * ME;
    } else {
      const gx = c.hx - Math.abs(lx), gz = c.hz - Math.abs(lz);
      const fromDx = (from.x - c.x) * c.cos - (from.z - c.z) * c.sin;
      const fromDz = (from.x - c.x) * c.sin + (from.z - c.z) * c.cos;
      const signX = Math.sign(lx || fromDx || 1), signZ = Math.sign(lz || fromDz || 1);
      if (gx < gz) { px = signX * (c.hx + ME); pz = lz; } else { px = lx; pz = signZ * (c.hz + ME); }
    }
    out.x = c.x + px * c.cos + pz * c.sin;
    out.z = c.z - px * c.sin + pz * c.cos;
  };
  const platformY = (x: number, z: number) => {
    const floor = groundY(x, z);
    let top: number | null = null;
    for (const platform of platformHash.query(x, z)) {
      if (platform.y <= floor + 0.2 || platform.y > floor + 1.2 || (top !== null && platform.y <= top)) continue;
      const dx = x - platform.x, dz = z - platform.z;
      const lx = dx * platform.cos - dz * platform.sin, lz = dx * platform.sin + dz * platform.cos;
      if (Math.abs(lx) <= platform.hx && Math.abs(lz) <= platform.hz) top = platform.y;
    }
    return top;
  };
  const collide = (from: THREE.Vector3, to: THREE.Vector3) => {
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.max(1, Math.ceil(distance / 0.2));
    const out = from.clone();
    const legal = (x: number, z: number, previous: THREE.Vector3) => !blocked(x, z)
      && Math.abs(groundY(x, z) - groundY(previous.x, previous.z)) <= 0.55;
    for (let step = 1; step <= steps; step++) {
      const previous = out.clone();
      const candidate = from.clone().lerp(to, step / steps);
      if (!legal(candidate.x, candidate.z, previous)) {
        const canX = legal(candidate.x, previous.z, previous), canZ = legal(previous.x, candidate.z, previous);
        if (canX && canZ) {
          if (Math.abs(candidate.x - previous.x) >= Math.abs(candidate.z - previous.z)) candidate.z = previous.z; else candidate.x = previous.x;
        } else if (canX) candidate.z = previous.z;
        else if (canZ) candidate.x = previous.x;
        else { candidate.x = previous.x; candidate.z = previous.z; }
      }
      for (let iteration = 0; iteration < 6; iteration++) {
        const bx = candidate.x, bz = candidate.z;
        for (const c of shapeHash.query(candidate.x, candidate.z)) {
          const feet = Math.min(previous.y, candidate.y);
          if (c.topY !== undefined && feet >= c.topY - 0.08) continue;
          if (c.bottomY !== undefined && feet + 1.6 <= c.bottomY) continue;
          pushOut(candidate, c, previous);
        }
        if (Math.hypot(candidate.x - bx, candidate.z - bz) < 1e-4) break;
      }
      if (!legal(candidate.x, candidate.z, previous)) { candidate.x = previous.x; candidate.z = previous.z; }
      out.copy(candidate);
    }
    return out;
  };
  return { shapes, platforms, collide, groundY, platformY, blocked };
}

/** Carga completa de un mapa (para pruebas de paseo o para usarlo en el juego). */
/** `batch`: agrupa las piezas estáticas en InstancedMesh (juego; no sirve para editar). */
export async function loadMapWorld(doc: MapDocument, scene: THREE.Scene, provider: MapAssetProvider, options: { lighting?: boolean; batch?: boolean } = {}) {
  const field = new TerrainField(decodeTerrain(doc.terrain));
  const surface = new TerrainSurface(field);
  const materials = new MaterialVariants(surface);
  const environment = new MapEnvironment(scene, options.lighting ?? true);
  const grass = new GrassField();
  const objects = new ObjectLayer(provider, materials);
  const root = new THREE.Group();
  root.name = `map:${doc.id}`;
  root.add(environment.root, surface.mesh, grass.root, objects.root);
  environment.apply(doc.settings, field);
  if (doc.settings.clouds) await environment.setClouds(provider, field);
  grass.rebuild(field, environment.waterLevel);
  objects.sync(doc.objects, doc.layers);
  await objects.ready();
  if (options.batch) objects.batch();
  const assets = [...new Set(doc.objects.map(object => object.asset))];
  const boxes = new Map(await Promise.all(assets.map(async asset => [asset, await provider.collisionBox(asset).catch(() => new THREE.Box3())] as const)));
  const collision = buildCollision(doc, field, boxes);
  const spawn = doc.markers.find(marker => marker.type === 'spawn');
  return {
    root, field, surface, environment, grass, objects, collision,
    spawn: spawn ? new THREE.Vector3(spawn.position[0], field.heightAt(spawn.position[0], spawn.position[2]), spawn.position[2]) : new THREE.Vector3(),
    spawnYaw: spawn?.rotationY ?? 0,
    /** `view`: campo de visión (m) para edificios y para detalles; sin él se dibuja todo. */
    update(t: number, focus: THREE.Vector3, view?: { distance: number; detail: number }) {
      if (view) objects.cull(focus, view.distance, view.detail);
      grass.update(t); objects.update(t); environment.update(t, focus);
    },
  };
}

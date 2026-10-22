// Entorno del mapa: cielo, luces, niebla, agua y nubes.
import * as THREE from 'three';
import type { MapSettings } from '../../data/maps';
import { type TerrainField, hash2 } from './terrain';
import type { MapAssetProvider } from './objects';

// ---------------------------------------------------------------------------
// Cielo, luces y agua
// ---------------------------------------------------------------------------

export const SKIES = {
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
      const indoor = settings.kind === 'interior';
      this.sky.visible = !indoor;
      this.scene.fog = settings.fog > 0 ? new THREE.Fog(indoor ? '#000000' : sky.fog, far * 0.25, far) : null;
      this.scene.background = new THREE.Color(indoor ? '#000000' : sky.horizon);
      if (indoor) { this.sun.intensity *= 0.18; this.hemi.intensity *= 0.35; }
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
  /** Material de la lámina general de agua (el juego usa el mismo que en lagunas y ríos). */
  useWaterMaterial(material: THREE.Material) { this.water.material = material as THREE.MeshStandardMaterial; }
  get waterMesh() { return this.water; }
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

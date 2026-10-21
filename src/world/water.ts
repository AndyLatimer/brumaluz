import * as THREE from 'three';
import type { MapDocument, MapSettings } from '../data/maps';
import { FALL_STEP, SKIES, WATER_TILES, type TerrainField, type TerrainSurface } from './mapRuntime';

// Agua del juego y del editor: una superficie semitransparente con oleaje, reflejos, color según la profundidad
// real del fondo, cáusticas, espuma en las orillas y corriente. Sale de dos fuentes:
// - el agua pintada en el terreno con la herramienta «Agua» del editor (lagos, lagunas, ríos);
// - las casillas de agua y río del pack (en el juego sustituye a su lámina opaca).
// Donde dos aguas vecinas están a distinta altura, el agua cae en cascada.

const S = 4, SQ3 = Math.sqrt(3);
const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const hexToWorld = (q: number, r: number): [number, number] => [(2 * q + r) * S, r * SQ3 * S];
function worldToHex(x: number, z: number): [number, number] {
  const r = z / (SQ3 * S), q = (x / S - r) / 2;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(-q - r);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - (-q - r));
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

/** Cuánto sobresale la superficie sobre la lámina de una casilla (evita que parpadeen). */
const LIFT = 0.015;
/** Profundidad mínima con la que se pintan los ríos de las casillas (sus cauces son de 11 cm). */
const RIVER_DEPTH = 0.3;
export { FALL_STEP };

const NOISE = /* glsl */`
  float waterHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float waterNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(waterHash(i), waterHash(i + vec2(1, 0)), u.x), mix(waterHash(i + vec2(0, 1)), waterHash(i + vec2(1, 1)), u.x), u.y);
  }
`;

const SURFACE_VERTEX = /* glsl */`
  attribute vec2 flow;
  attribute float minDepth;
  attribute float shore;
  attribute float fade;
  varying vec3 vWorld;
  varying vec2 vFlow;
  varying float vMinDepth;
  varying float vShore;
  varying float vFade;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz; vFlow = flow; vMinDepth = minDepth; vShore = shore; vFade = fade;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const SURFACE_FRAGMENT = /* glsl */`
  uniform float time;
  uniform sampler2D mapHeight;
  uniform vec4 mapTerrain;
  uniform vec2 mapTerrainSize;
  uniform vec3 shallowColor, deepColor, foamColor, skyColor, horizonColor, sunColor, sunDir;
  uniform float light;
  varying vec3 vWorld;
  varying vec2 vFlow;
  varying float vMinDepth;
  varying float vShore;
  varying float vFade;
  #include <common>
  #include <fog_pars_fragment>
  ${NOISE}
  float bedAt(vec2 p) {
    vec2 g = clamp((p - mapTerrain.xy) / mapTerrain.z, vec2(0.0), mapTerrainSize - 1.0);
    ivec2 a = ivec2(floor(g));
    ivec2 b = min(a + 1, ivec2(mapTerrainSize) - 1);
    vec2 t = g - vec2(a);
    float h00 = texelFetch(mapHeight, a, 0).r, h10 = texelFetch(mapHeight, ivec2(b.x, a.y), 0).r;
    float h01 = texelFetch(mapHeight, ivec2(a.x, b.y), 0).r, h11 = texelFetch(mapHeight, b, 0).r;
    return mix(mix(h00, h10, t.x), mix(h01, h11, t.x), t.y);
  }
  // Oleaje: ondas direccionales (con su pendiente exacta) más ruido fino, arrastrado por la corriente.
  vec2 waveSlope(vec2 p, float calm) {
    vec2 slope = vec2(0.0);
    vec2 dirs[4] = vec2[4](vec2(0.8, 0.6), vec2(-0.5, 0.86), vec2(0.97, -0.24), vec2(-0.3, -0.95));
    float freq[4] = float[4](0.9, 1.4, 2.3, 3.1);
    float speed[4] = float[4](1.1, 1.5, 2.2, 2.7);
    float amp[4] = float[4](0.11, 0.07, 0.04, 0.025);
    for (int i = 0; i < 4; i++) {
      float phase = dot(dirs[i], p) * freq[i] + time * speed[i];
      slope += dirs[i] * (amp[i] * freq[i] * cos(phase));
    }
    float e = 0.15, n = waterNoise(p * 2.4 + time * 0.35);
    slope += vec2(waterNoise(p * 2.4 + vec2(e, 0.0) + time * 0.35) - n, waterNoise(p * 2.4 + vec2(0.0, e) + time * 0.35) - n) / e * 0.05;
    return slope * calm;
  }
  void main() {
    float speed = length(vFlow);
    vec2 flowing = vWorld.xz - vFlow * time * 1.4;
    float rawDepth = vWorld.y - bedAt(vWorld.xz);
    float depth = max(vMinDepth, rawDepth);
    // Donde corre, el agua se riza más; en un lago en calma, menos.
    vec2 slope = waveSlope(flowing, 0.75 + min(speed, 1.0) * 0.6);
    vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 V = normalize(cameraPosition - vWorld);
    float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
    vec3 R = reflect(-V, N);
    vec3 reflection = mix(horizonColor, skyColor, smoothstep(0.0, 0.6, R.y));
    float sun = max(dot(R, normalize(sunDir)), 0.0);
    vec3 glint = sunColor * (pow(sun, 220.0) * 3.0 + pow(sun, 28.0) * 0.18);

    // Color por profundidad: turquesa en lo somero, azul hondo donde cubre; el fondo se ve cada vez menos.
    float deep = smoothstep(0.05, 1.9, depth);
    // El agua no se ilumina sola: de noche su color se apaga con la luz del cielo.
    vec3 body = mix(shallowColor, deepColor, deep) * light;
    vec2 cp = vWorld.xz * 1.6 + slope * 3.0;
    float caustic = pow(1.0 - abs(waterNoise(cp + time * 0.5) - waterNoise(cp * 1.3 - time * 0.4)), 8.0);
    body += (1.0 - deep) * caustic * 0.22 * sunColor;

    // Espuma: en los bordes que lo piden, donde el agua pintada apenas cubre y en franjas que arrastra la corriente.
    // Agua del terreno (minDepth 0: pintada y lámina general): espuma donde apenas cubre el fondo.
    float paintedWater = 1.0 - step(0.0001, vMinDepth);
    float shoreLine = max(pow(vShore, 4.0), paintedWater * (1.0 - smoothstep(0.06, 0.3, rawDepth)));
    float edgeFoam = shoreLine * smoothstep(0.5, 0.8, waterNoise(flowing * 2.6 + time * 0.6) * 0.7 + shoreLine * 0.4);
    vec2 along = speed > 0.01 ? vFlow / speed : vec2(1.0, 0.0);
    float streaks = min(speed, 1.0) * smoothstep(0.72, 0.9, waterNoise(vec2(dot(flowing, along) * 0.6, dot(flowing, vec2(-along.y, along.x)) * 3.0)));
    float foam = clamp(edgeFoam + streaks * 0.35, 0.0, 1.0);

    // El cielo se refleja sobre todo al mirar de lado; de frente se ve el agua y el fondo.
    vec3 color = mix(body, reflection * 0.85, fresnel * 0.4) + glint;
    color = mix(color, foamColor * light, foam * 0.85);
    // El agua absorbe: incluso poco honda tiñe el fondo, y a partir de 1,5 m apenas se ve.
    float alpha = mix(0.66, 0.96, deep) + fresnel * 0.2 + foam * 0.5;
    // Orilla del agua pintada: se difumina en la mitad exterior de la última celda.
    alpha *= 1.0 - smoothstep(0.45, 0.95, vFade);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const FALL_VERTEX = /* glsl */`
  attribute float side;
  varying vec2 vUv;
  varying float vSide;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = uv; vSide = side;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FALL_FRAGMENT = /* glsl */`
  uniform float time;
  uniform vec3 shallowColor, foamColor;
  uniform float light;
  varying vec2 vUv;
  varying float vSide;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_fragment>
  ${NOISE}
  void main() {
    // Chorros: franjas verticales (vUv.x en metros a lo largo del borde) que bajan deprisa y se rompen abajo.
    float x = vUv.x * 2.5;
    float fall = vUv.y * 3.0 - time * 2.6;
    float streak = waterNoise(vec2(x, fall)) * 0.6 + waterNoise(vec2(x * 2.1, fall * 1.7 - time)) * 0.4;
    float white = smoothstep(0.35, 0.75, streak) * 0.85 + smoothstep(0.45, 1.0, vUv.y) * 0.7 + smoothstep(0.25, 0.0, vUv.y) * 0.35;
    vec3 color = mix(shallowColor * 1.35 + 0.08, foamColor, clamp(white, 0.0, 1.0)) * light;
    // Una cortina de agua que no deja ver a través (solo se difumina en el último palmo de cada lado).
    float sides = smoothstep(0.0, 0.04, vSide) * smoothstep(1.0, 0.96, vSide);
    float alpha = clamp(0.94 + white * 0.06, 0.0, 1.0) * sides;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const FOAM_FRAGMENT = /* glsl */`
  uniform float time;
  uniform vec3 foamColor;
  uniform float light;
  varying vec2 vUv;
  varying float vSide;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_fragment>
  ${NOISE}
  void main() {
    // Remolino de espuma al pie de la cascada: manchas que se abren y se deshacen.
    float r = length(vec2((vSide - 0.5) * 2.0, (vUv.y - 0.5) * 2.0));
    float bubbles = waterNoise(vWorld.xz * 3.0 + vec2(time * 0.9, -time * 0.6)) * 0.5 + waterNoise(vWorld.xz * 6.0 - time * 1.4) * 0.5;
    float alpha = smoothstep(1.0, 0.25, r) * smoothstep(0.35, 0.7, bubbles + (1.0 - r) * 0.35);
    gl_FragColor = vec4(foamColor * light, alpha * 0.85);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

interface WaterTile { q: number; r: number; asset: string; x: number; z: number; y: number; yaw: number; sx: number; sy: number; sz: number; conform: boolean }
export interface WaterFall { x: number; y: number; z: number; width: number; drop: number }

/** Acumula vértices de superficie con sus atributos. */
class SurfaceBuilder {
  positions: number[] = []; flows: number[] = []; depths: number[] = []; shores: number[] = []; fades: number[] = []; indices: number[] = [];
  vertex(x: number, y: number, z: number, flow: [number, number], minDepth: number, shore: number, fade = 0) {
    this.positions.push(x, y, z); this.flows.push(flow[0], flow[1]); this.depths.push(minDepth); this.shores.push(shore); this.fades.push(fade);
    return this.positions.length / 3 - 1;
  }
  mesh(material: THREE.Material, name: string) {
    if (!this.positions.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('flow', new THREE.Float32BufferAttribute(this.flows, 2));
    geometry.setAttribute('minDepth', new THREE.Float32BufferAttribute(this.depths, 1));
    geometry.setAttribute('shore', new THREE.Float32BufferAttribute(this.shores, 1));
    geometry.setAttribute('fade', new THREE.Float32BufferAttribute(this.fades, 1));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.renderOrder = 1;
    mesh.raycast = () => {};
    return mesh;
  }
}

/** Acumula láminas de cascada (y su espuma al pie) en una sola malla cada una. */
class FallBuilder {
  sheet = { positions: [] as number[], uvs: [] as number[], sides: [] as number[], indices: [] as number[] };
  foam = { positions: [] as number[], uvs: [] as number[], sides: [] as number[], indices: [] as number[] };
  /**
   * Un tramo de cascada: de `top` (borde de arriba) a `bottom` (pie), `width` m de ancho a lo largo de `tangent`.
   * `along` es la coordenada (m) del tramo a lo largo del borde, para que los chorros sigan de un tramo al siguiente;
   * `sides` es el difuminado lateral en cada extremo (0: borde abierto, 0,5: sigue otro tramo).
   */
  add(top: THREE.Vector3, bottom: THREE.Vector3, tangent: THREE.Vector2, width: number, along: number, sides: [number, number]) {
    const out = new THREE.Vector2(bottom.x - top.x, bottom.z - top.z);
    const reach = Math.max(out.length(), 0.3);
    out.normalize();
    const columns = Math.max(1, Math.round(width)), rows = 7, sheet = this.sheet, base = sheet.positions.length / 3;
    const drop = top.y - bottom.y;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
      const u = i / columns, v = j / rows;
      // Sale con impulso hacia fuera y cae: curva más pronunciada arriba.
      const forward = reach * Math.sin(v * Math.PI / 2) * 0.9 + 0.12 * v;
      const offset = (u - 0.5) * width;
      sheet.positions.push(top.x + tangent.x * offset + out.x * forward, top.y - v * (drop + 0.06), top.z + tangent.y * offset + out.y * forward);
      sheet.uvs.push(along + u * width, v);
      sheet.sides.push(sides[0] + (sides[1] - sides[0]) * u);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const a = base + j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
      sheet.indices.push(a, c, b, b, c, d);
    }
    // Espuma al pie: una franja a lo largo del tramo, un poco más allá de donde cae el agua.
    const foam = this.foam, fb = foam.positions.length / 3, length = Math.max(1.4, Math.min(3, drop * 1.6 + 0.8));
    const reachOut = reach * 0.9 + 0.3;
    const center = new THREE.Vector3(top.x + out.x * reachOut, bottom.y + 0.02, top.z + out.y * reachOut);
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const offset = (u - 0.5) * width, depth = (v - 0.5) * length;
      foam.positions.push(center.x + tangent.x * offset + out.x * depth, center.y, center.z + tangent.y * offset + out.y * depth);
      foam.uvs.push(along + u * width, v);
      foam.sides.push(sides[0] + (sides[1] - sides[0]) * u);
    }
    foam.indices.push(fb, fb + 2, fb + 1, fb + 1, fb + 2, fb + 3);
  }
  meshes(sheetMaterial: THREE.Material, foamMaterial: THREE.Material) {
    const build = (data: FallBuilder['sheet'], material: THREE.Material, name: string, order: number) => {
      if (!data.positions.length) return null;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
      geometry.setAttribute('side', new THREE.Float32BufferAttribute(data.sides, 1));
      geometry.setIndex(data.indices);
      geometry.computeBoundingSphere();
      const mesh: THREE.Object3D = new THREE.Mesh(geometry, material);
      mesh.name = name; mesh.renderOrder = order; mesh.raycast = () => {};
      return mesh;
    };
    return [build(this.sheet, sheetMaterial, 'waterfalls', 2), build(this.foam, foamMaterial, 'waterfall-foam', 3)].filter((m): m is THREE.Object3D => !!m);
  }
}

export class WaterLayer {
  readonly root = new THREE.Group();
  /** Pie de cada cascada (para ondas y salpicaduras). */
  falls: WaterFall[] = [];
  private readonly time = { value: 0 };
  readonly surfaceMaterial: THREE.ShaderMaterial;
  private readonly fallMaterial: THREE.ShaderMaterial;
  private readonly foamMaterial: THREE.ShaderMaterial;
  readonly colors;
  /** Mallas del agua pintada en el terreno (se rehacen al pintar en el editor). */
  private painted: THREE.Object3D[] = [];
  private paintedFalls: WaterFall[] = [];
  private tileFalls: WaterFall[] = [];

  constructor(doc: Pick<MapDocument, 'settings' | 'objects' | 'layers'>, private field: TerrainField, surface: TerrainSurface, options: { tiles?: boolean } = {}) {
    this.root.name = 'map-water-surfaces';
    const sky = SKIES[doc.settings.sky];
    this.colors = {
      shallowColor: { value: new THREE.Color('#18aab4') },
      deepColor: { value: new THREE.Color('#0a3470') },
      foamColor: { value: new THREE.Color('#f4fbff') },
      skyColor: { value: new THREE.Color(sky.top) },
      horizonColor: { value: new THREE.Color(sky.horizon) },
      sunColor: { value: new THREE.Color(sky.sun) },
      sunDir: { value: new THREE.Vector3(...sky.sunDir).normalize() },
      light: { value: 1 },
    };
    const shader = (vertexShader: string, fragmentShader: string, extra: Record<string, THREE.IUniform>) => {
      const material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
        vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      });
      Object.assign(material.uniforms, { time: this.time, ...extra });
      return material;
    };
    this.surfaceMaterial = shader(SURFACE_VERTEX, SURFACE_FRAGMENT, { ...this.colors, ...surface.uniforms });
    this.fallMaterial = shader(FALL_VERTEX, FALL_FRAGMENT, { shallowColor: this.colors.shallowColor, foamColor: this.colors.foamColor, light: this.colors.light });
    this.foamMaterial = shader(FALL_VERTEX, FOAM_FRAGMENT, { foamColor: this.colors.foamColor, light: this.colors.light });
    if (options.tiles ?? true) this.buildTiles(doc);
    this.rebuildPainted();
  }

  /** Otro terreno (el editor cambió de mapa o de tamaño): la profundidad se lee de él. */
  bind(field: TerrainField, surface: TerrainSurface) {
    this.field = field;
    Object.assign(this.surfaceMaterial.uniforms, surface.uniforms);
    this.rebuildPainted();
  }

  /**
   * Cielo del juego (ciclo de día y noche): el agua refleja ese cielo y recibe su luz en vez del cielo fijo del mapa.
   * Hay que llamarlo antes de dibujarla por primera vez.
   */
  useSky(sky: Pick<WaterLayer['colors'], 'skyColor' | 'horizonColor' | 'sunColor' | 'sunDir' | 'light'>) {
    for (const material of [this.surfaceMaterial, this.fallMaterial, this.foamMaterial]) {
      for (const [key, uniform] of Object.entries(sky)) if (key in material.uniforms) material.uniforms[key] = uniform;
    }
  }

  setSky(settings: MapSettings) {
    const sky = SKIES[settings.sky];
    this.colors.skyColor.value.set(sky.top);
    this.colors.horizonColor.value.set(sky.horizon);
    this.colors.sunColor.value.set(sky.sun);
    this.colors.sunDir.value.fromArray(sky.sunDir).normalize();
  }

  /** Rehace el agua pintada en el terreno (lagos y ríos de la herramienta «Agua»). */
  rebuildPainted() {
    for (const object of this.painted) { object.removeFromParent(); (object as THREE.Mesh).geometry.dispose(); }
    this.painted = [];
    this.paintedFalls = [];
    const data = this.field.data, water = data.water;
    if (water) {
      const { columns, rows, cell } = data, minX = this.field.minX, minZ = this.field.minZ;
      const at = (i: number, j: number) => (i < 0 || j < 0 || i >= columns || j >= rows) ? NaN : water[j * columns + i];
      // Corriente: cuesta abajo según la pendiente de la propia lámina (en un lago, casi quieta).
      const flowAt = (i: number, j: number): [number, number] => {
        const here = at(i, j), near = (value: number) => Number.isFinite(value) && Math.abs(value - here) <= FALL_STEP ? value : here;
        const gx = (near(at(i + 1, j)) - near(at(i - 1, j))) / (2 * cell);
        const gz = (near(at(i, j + 1)) - near(at(i, j - 1))) / (2 * cell);
        const slope = Math.hypot(gx, gz);
        if (slope < 0.004) return [0.04, 0.025];
        const strength = Math.min(1.2, slope * 9) / slope;
        return [-gx * strength, -gz * strength];
      };
      const surface = new SurfaceBuilder();
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < columns - 1; i++) {
        const corners = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].map(([ci, cj]) => ({ ci, cj, level: at(ci, cj) }));
        const wet = corners.filter(corner => Number.isFinite(corner.level));
        if (!wet.length) continue;
        const levels = wet.map(corner => corner.level);
        // Una celda con un salto grande no se dibuja inclinada: ahí va la cascada.
        if (Math.max(...levels) - Math.min(...levels) > FALL_STEP) continue;
        const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
        const ids = corners.map(corner => {
          const dry = !Number.isFinite(corner.level);
          return surface.vertex(minX + corner.ci * cell, dry ? mean : corner.level, minZ + corner.cj * cell,
            dry ? [0, 0] : flowAt(corner.ci, corner.cj), 0, 0, dry ? 1 : 0);
        });
        surface.indices.push(ids[0], ids[2], ids[1], ids[1], ids[2], ids[3]);
      }
      const mesh = surface.mesh(this.surfaceMaterial, 'painted-water');
      if (mesh) this.painted.push(mesh);
      // Cascadas: en cada borde de la rejilla entre dos vértices mojados con un salto grande.
      const falls = new FallBuilder();
      const step = (i: number, j: number, di: number, dj: number) => {
        const a = at(i, j), b = at(i + di, j + dj);
        return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > FALL_STEP ? Math.sign(a - b) : 0;
      };
      for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
        for (const [di, dj] of [[1, 0], [0, 1]] as const) {
          const sign = step(i, j, di, dj);
          if (!sign) continue;
          const [ti, tj, bi, bj] = sign > 0 ? [i, j, i + di, j + dj] : [i + di, j + dj, i, j];
          const top = new THREE.Vector3(minX + ti * cell, at(ti, tj), minZ + tj * cell);
          const bottom = new THREE.Vector3(minX + bi * cell, at(bi, bj), minZ + bj * cell);
          // El salto es en X o en Z: el tramo se extiende en la otra dirección.
          const tangent = di ? new THREE.Vector2(0, 1) : new THREE.Vector2(1, 0);
          const [pi, pj] = di ? [0, 1] : [1, 0];
          const before = step(i - pi, j - pj, di, dj) === sign, after = step(i + pi, j + pj, di, dj) === sign;
          const along = di ? top.z : top.x;
          falls.add(top, bottom, tangent, cell, along - cell / 2, [before ? 0.5 : 0, after ? 0.5 : 1]);
          if ((di ? j : i) % 3 === 0) this.paintedFalls.push({ x: bottom.x, y: bottom.y, z: bottom.z, width: cell * 3, drop: top.y - bottom.y });
        }
      }
      this.painted.push(...falls.meshes(this.fallMaterial, this.foamMaterial));
      for (const object of this.painted) this.root.add(object);
    }
    this.falls = [...this.tileFalls, ...this.paintedFalls];
  }

  /** Lagunas y ríos de las casillas del pack. */
  private buildTiles(doc: Pick<MapDocument, 'objects' | 'layers'>) {
    const field = this.field;
    const tiles = new Map<string, WaterTile>();
    const visible = new Set(doc.layers.filter(layer => layer.visible).map(layer => layer.id));
    for (const object of doc.objects) {
      const spec = object.asset.startsWith('city/') ? WATER_TILES[object.asset.slice(5)] : undefined;
      if (!spec || object.hidden || !visible.has(object.layer)) continue;
      const [q, r] = worldToHex(object.position[0], object.position[2]);
      tiles.set(`${q},${r}`, {
        q, r, asset: object.asset.slice(5), x: object.position[0], z: object.position[2], y: object.position[1], yaw: object.rotation[1],
        sx: object.scale[0], sy: object.scale[1], sz: object.scale[2], conform: !!object.conform,
      });
    }
    if (!tiles.size) return;
    const surfaceAt = (tile: WaterTile, x: number, z: number) =>
      (tile.conform ? field.heightAt(x, z) + tile.y : tile.y) + WATER_TILES[tile.asset].surface * tile.sy;
    const surface = new SurfaceBuilder();
    for (const tile of tiles.values()) {
      const spec = WATER_TILES[tile.asset];
      const c = Math.cos(tile.yaw), s = Math.sin(tile.yaw);
      const world = (lx: number, lz: number): [number, number] => [tile.x + lx * tile.sx * c + lz * tile.sz * s, tile.z - lx * tile.sx * s + lz * tile.sz * c];
      if (!spec.channel) {
        // Laguna: hexágono partido en 12 triángulos (centro, esquinas y mitad de cada lado) para que la espuma
        // solo aparezca en los lados que dan a tierra.
        const y = surfaceAt(tile, tile.x, tile.z) + LIFT;
        const calm: [number, number] = [0.04, 0.025];
        const center = surface.vertex(tile.x, y, tile.z, calm, 0.001, 0);
        const landSide = DIRS.map(([dq, dr]) => !tiles.has(`${tile.q + dq},${tile.r + dr}`));
        const corners: number[] = [], mids: number[] = [];
        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 3, half = S / SQ3;
          const [mx, mz] = [Math.cos(a) * S, Math.sin(a) * S];
          mids.push(surface.vertex(tile.x + mx, y, tile.z + mz, calm, 0.001, landSide[k] ? 1 : 0));
          const [cx, cz] = [mx - Math.sin(a) * half, mz + Math.cos(a) * half];
          corners.push(surface.vertex(tile.x + cx, y, tile.z + cz, calm, 0.001, landSide[k] || landSide[(k + 1) % 6] ? 1 : 0));
        }
        for (let k = 0; k < 6; k++) surface.indices.push(center, mids[k], corners[(k + 5) % 6], center, corners[k], mids[k]);
        continue;
      }
      // Río: tira sobre el cauce, que sigue al terreno, con la corriente cuesta abajo.
      const [z0, z1] = spec.channel;
      const [ax, az] = world(-1, (z0 + z1) / 2), [bx, bz] = world(1, (z0 + z1) / 2);
      const downhill = surfaceAt(tile, bx, bz) - surfaceAt(tile, ax, az);
      const sign = Math.abs(downhill) > 0.02 ? -Math.sign(downhill) : Math.sign(tile.x || 1) * Math.sign(c || 1);
      const flow: [number, number] = [c * sign * 0.9, -s * sign * 0.9];
      const columns = 10, rows = 3, base = surface.positions.length / 3;
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
        const lx = -1 + 2 * i / columns, lz = z0 + (z1 - z0) * j / rows;
        const [x, z] = world(lx, lz);
        surface.vertex(x, surfaceAt(tile, x, z) + LIFT, z, flow, RIVER_DEPTH, j === 0 || j === rows ? 1 : 0);
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
        const a = base + j * (columns + 1) + i, b = a + 1, d = a + columns + 1, e = d + 1;
        surface.indices.push(a, d, b, b, d, e);
      }
    }
    const mesh = surface.mesh(this.surfaceMaterial, 'tile-water');
    if (mesh) this.root.add(mesh);
    // Cascadas entre casillas vecinas cuya lámina, en el lado común, difiere en más de 15 cm. Un río solo vierte (o
    // recibe) agua por los extremos de su cauce: por sus orillas no cae nada.
    const opens = (tile: WaterTile, nx: number, nz: number) =>
      !WATER_TILES[tile.asset].channel || Math.abs(nx * Math.cos(tile.yaw) - nz * Math.sin(tile.yaw)) > 0.9;
    const falls = new FallBuilder();
    for (const tile of tiles.values()) for (let k = 0; k < 6; k++) {
      const other = tiles.get(`${tile.q + DIRS[k][0]},${tile.r + DIRS[k][1]}`);
      if (!other) continue;
      const [ex, ez] = hexToWorld(...DIRS[k]), len = Math.hypot(ex, ez), nx = ex / len, nz = ez / len;
      if (!opens(tile, nx, nz) || !opens(other, -nx, -nz)) continue;
      const [mx, mz] = [tile.x + nx * S, tile.z + nz * S];
      const top = surfaceAt(tile, mx, mz), bottom = surfaceAt(other, mx, mz), drop = top - bottom;
      if (drop < 0.15) continue;
      // Tan ancha como el cauce del río (el de arriba o el de abajo); entre dos lagunas, todo el lado.
      const river = [tile, other].find(item => WATER_TILES[item.asset].channel);
      const channel = river && WATER_TILES[river.asset].channel!;
      const width = river && channel ? (channel[1] - channel[0]) * river.sz : 2 * S / SQ3;
      falls.add(new THREE.Vector3(mx, top + LIFT, mz), new THREE.Vector3(mx + nx * 0.6, bottom + LIFT, mz + nz * 0.6),
        new THREE.Vector2(-nz, nx), width, 0, [0, 1]);
      this.tileFalls.push({ x: mx + nx * 0.6, y: bottom, z: mz + nz * 0.6, width, drop });
    }
    for (const object of falls.meshes(this.fallMaterial, this.foamMaterial)) this.root.add(object);
  }

  /** La lámina general del mapa (mares, lagos del terreno) con el mismo aspecto. */
  styleWaterPlane(plane: THREE.Mesh, settings: MapSettings) {
    if (!settings.water.enabled) return;
    const geometry = plane.geometry;
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('flow', new THREE.Float32BufferAttribute(new Float32Array(count * 2).fill(0.03), 2));
    geometry.setAttribute('minDepth', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute('shore', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute('fade', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
    plane.material = this.surfaceMaterial;
  }

  update(t: number) { this.time.value = t; }

  dispose() {
    this.root.traverse(object => { if ((object as THREE.Mesh).isMesh) (object as THREE.Mesh).geometry.dispose(); });
    this.surfaceMaterial.dispose(); this.fallMaterial.dispose(); this.foamMaterial.dispose();
  }
}

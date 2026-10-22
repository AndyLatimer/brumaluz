// Variantes de material de los objetos del mapa (colores, sombras y transparencias).
import * as THREE from 'three';
import type { TerrainSurface } from './terrain';

// ---------------------------------------------------------------------------
// Materiales deformables y tintes
// ---------------------------------------------------------------------------

export class MaterialVariants {
  private cache = new Map<string, THREE.Material>();
  private uniforms = {
    mapHeight: { value: null as THREE.DataTexture | null },
    mapTerrain: { value: new THREE.Vector4() },
    mapTerrainSize: { value: new THREE.Vector2() },
    /** Segundos de juego, para el oleaje del agua de las casillas. */
    mapTime: { value: 0 },
    /** 1: el juego pinta su propia agua encima, y el agua del atlas pasa a ser el lecho del cauce. */
    mapWaterBed: { value: 0 },
  };
  setTime(t: number) { this.uniforms.mapTime.value = t; }
  setWaterBed(on: boolean) { this.uniforms.mapWaterBed.value = on ? 1 : 0; }
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
        Object.assign(shader.uniforms, uniforms);
        if (ground) {
          // Posición en el mundo de cada fragmento, para el oleaje (con o sin instancias o lotes).
          shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
            varying vec3 vMapWorld;`).replace('#include <begin_vertex>', `#include <begin_vertex>
            #if defined(USE_INSTANCING)
              vMapWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
            #elif defined(USE_BATCHING)
              vMapWorld = (modelMatrix * batchingMatrix * vec4(transformed, 1.0)).xyz;
            #else
              vMapWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
            #endif`);
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
            varying vec3 vMapWorld;
            uniform float mapTime;
            uniform float mapWaterBed;`).replace('#include <color_fragment>', `#include <color_fragment>
          if (diffuseColor.r > 0.18 && diffuseColor.g > diffuseColor.r * 0.72 && diffuseColor.b < diffuseColor.r * 0.52) {
            diffuseColor.rgb *= vec3(0.78, 1.08, 0.75);
          }
          // Agua (los azules del atlas): ondas suaves que se desplazan y destellos en sus crestas.
          float mapWater = smoothstep(0.06, 0.18, diffuseColor.b - max(diffuseColor.r, diffuseColor.g));
          if (mapWater > 0.0 && mapWaterBed > 0.5) {
            // Lecho del cauce: arena verdosa con manchas, que se ve a través del agua del juego.
            float bedSpots = sin(vMapWorld.x * 2.3) * sin(vMapWorld.z * 1.9) * 0.5 + 0.5;
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.42, 0.45, 0.30), vec3(0.30, 0.36, 0.27), bedSpots), mapWater);
          } else if (mapWater > 0.0) {
            vec2 p = vMapWorld.xz;
            float wave = sin(p.x * 0.85 + mapTime * 1.25) * sin(p.y * 0.7 - mapTime * 1.05)
              + 0.55 * sin((p.x - p.y) * 1.9 + mapTime * 2.1) + 0.3 * sin((p.x + p.y) * 3.7 - mapTime * 2.9);
            float crest = smoothstep(1.05, 1.5, wave);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.94 + 0.08 * wave) + vec3(0.55, 0.7, 0.75) * crest * 0.45, mapWater);
          }`);
        }
        if (!conform) return;
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
      material.customProgramCacheKey = () => `brumaluz-map-v5|${conform ? 1 : 0}|${ground ? 1 : 0}|${source.type}`;
    }
    this.cache.set(key, material);
    return material;
  }
  dispose() { for (const material of this.cache.values()) material.dispose(); this.cache.clear(); }
}

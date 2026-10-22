import * as THREE from 'three';
import { loadGLB } from './load';
import cityUrl from '../assets/models/city.glb?url';
import { buildCityDetails } from './cityDetails';
import { COIN_BAGS } from '../data/coinBags';
import { WELCOME_START, WELCOME_BADGE, SHADOW_RETURN } from '../data/quests';
import { brumaluzGateMarkers } from '../data/pompelin';
import type { MapMarker } from '../data/maps';
import { type CityPortal, type CityArrival, type City, type Placement, type Collider, type Platform, type NpcSite, COMBAT_SITE } from './city/types';
import { PI, S, BLOCK, worldToHex, key, hexDist, hexToWorld, SQ3 } from './city/hex';
import { layoutCity } from './city/layout';

// ---------------------------------------------------------------------------
// Brumaluz: ciudad de casillas hexagonales con el pack "KayKit Medieval
// Hexagon" (Kay Lousberg, CC0). Cada pieza se instancia (una llamada de dibujo
// por tipo) y las calles se eligen y giran según qué vecinos son calle.
// ---------------------------------------------------------------------------
// Este módulo construye la Brumaluz procedural; tipos, rejilla y trazado viven en src/world/city/.
export * from './city/types';
export { S, hexToWorld, worldToHex } from './city/hex';

/** Portales y llegadas a partir de los marcadores de un mapa. */
export function cityLinks(markers: readonly MapMarker[], groundY: (x: number, z: number) => number) {
  const at = (position: readonly number[]) => new THREE.Vector3(position[0], groundY(position[0], position[2]), position[2]);
  const portals: CityPortal[] = markers.filter(marker => marker.type === 'portal').map(marker => ({
    id: marker.id, name: marker.name, position: at(marker.position), radius: Math.max(0.5, marker.radius),
    target: marker.target ? { ...marker.target } : undefined, trigger: marker.trigger ?? 'walk',
  }));
  const arrivals: Record<string, CityArrival> = {};
  for (const marker of markers) if (marker.type === 'arrival') arrivals[marker.id] = { position: at(marker.position), yaw: marker.rotationY };
  return { portals, arrivals };
}

export async function buildCity(): Promise<City> {
  const gltf = await loadGLB(cityUrl);
  const models = new Map<string, THREE.Object3D>();
  for (const c of gltf.scene.children) models.set(c.name, c);
  models.get('wall_straight_gate')?.traverse((part) => {
    if (part.name === 'wall_straight_gate_door_left' || part.name === 'wall_straight_gate_door_right') {
      part.rotation.y = PI / 2;
    }
  });

  const { place, rnd, nearestFoundation, grassTufts, flowers, terrainHeightAtWorld, parkBenches, tileType, R_LAND, vendorSpots, roads, liesOnRoad } = layoutCity();

  // ---------- Instanciado ----------
  const root = new THREE.Group();
  const groups = new Map<string, Placement[]>();
  for (const p of place) {
    if (!models.has(p.model)) continue;
    (groups.get(p.model) ?? groups.set(p.model, []).get(p.model)!).push(p);
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
  const material = (gltf.scene.getObjectByProperty('isMesh', true) as THREE.Mesh).material as THREE.MeshStandardMaterial;
  material.roughness = 0.85;
  const windmillFans: THREE.Object3D[] = [];
  const wavingFlags: { object: THREE.Object3D; yaw: number; phase: number }[] = [];
  const grassWindTime = { value: 0 };
  const terrainMaterial = (source: THREE.Material, greenGround = false): THREE.Material => {
    const terrain = source.clone();
    if (greenGround && terrain instanceof THREE.MeshStandardMaterial) terrain.color.set('#8aca78');
    terrain.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (diffuseColor.r > 0.18 && diffuseColor.g > diffuseColor.r * 0.72 && diffuseColor.b < diffuseColor.r * 0.52) {
          diffuseColor.rgb *= vec3(0.78, 1.08, 0.75);
        }`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        #ifdef USE_INSTANCING
          attribute vec4 cityFoundation;
        #endif
        float brumaluzTerrainHeight(vec2 p) {
          return 0.35 * sin(p.x * 0.035) * cos(p.y * 0.04)
            + 0.2 * sin((p.x + p.y * 0.65) * 0.045)
            + 1.8 * exp(-pow((p.x + 40.0) / 25.0, 2.0) - pow((p.y - 9.0) / 21.0, 2.0))
            + 1.5 * exp(-pow((p.x - 34.0) / 24.0, 2.0) - pow((p.y + 29.0) / 20.0, 2.0));
        }`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          mat4 cityWorldMatrix = modelMatrix * instanceMatrix;
          vec4 cityWorldPosition = cityWorldMatrix * vec4(transformed, 1.0);
          float cityHeight = brumaluzTerrainHeight(cityWorldPosition.xz);
          if (cityFoundation.w >= 0.0) {
            float foundationDistance = distance(cityWorldPosition.xz, cityFoundation.xy);
            float foundationBlend = 1.0 - smoothstep(cityFoundation.w, cityFoundation.w + 1.5, foundationDistance);
            cityHeight = mix(cityHeight, cityFoundation.z, foundationBlend);
          }
          transformed.y += cityHeight / cityWorldMatrix[1][1];
        #endif`,
      );
    };
    terrain.customProgramCacheKey = () => 'brumaluz-terrain-height-v2';
    return terrain;
  };
  for (const [name, ps] of groups) {
    const model = models.get(name)!;
    if (name === 'windmill' || name.startsWith('flag_')) {
      for (const p of ps) {
        const prop = model.clone(true);
        prop.position.set(p.x, p.y ?? 0, p.z);
        prop.rotation.y = p.ry;
        prop.scale.setScalar(S * (p.s ?? 1));
        prop.traverse((part) => {
          if ((part as THREE.Mesh).isMesh) {
            (part as THREE.Mesh).castShadow = true;
            (part as THREE.Mesh).receiveShadow = true;
          }
        });
        if (name === 'windmill') {
          const fan = prop.getObjectByName('building_windmill_top_fan_blue');
          if (fan) windmillFans.push(fan);
        } else {
          wavingFlags.push({ object: prop, yaw: p.ry, phase: rnd() * PI * 2 });
        }
        root.add(prop);
      }
      continue;
    }
    const isTile = name.startsWith('hex_');
    const raisedTerrain = isTile && name !== 'hex_water';
    model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const local = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
      const geometry = raisedTerrain ? mesh.geometry.clone() : mesh.geometry;
      if (raisedTerrain) {
        const foundationData = new Float32Array(ps.length * 4);
        ps.forEach((p, i) => {
          const foundation = nearestFoundation(p.x, p.z);
          if (foundation) {
            foundationData.set([foundation.x, foundation.z, foundation.y, foundation.radius], i * 4);
          } else {
            foundationData.set([0, 0, 0, -1], i * 4);
          }
        });
        geometry.setAttribute('cityFoundation', new THREE.InstancedBufferAttribute(foundationData, 4));
      }
      const tileMaterial = (source: THREE.Material | THREE.Material[]) => {
        if (!raisedTerrain) return source;
        return Array.isArray(source)
          ? source.map((item) => terrainMaterial(item, name === 'hex_grass'))
          : terrainMaterial(source, name === 'hex_grass');
      };
      const im = new THREE.InstancedMesh(geometry, tileMaterial(mesh.material), ps.length);
      ps.forEach((p, i) => {
        q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry);
        if (isTile) s4.set(S, S * 0.28, S);
        else s4.setScalar(S * (p.s ?? 1));
        p4.set(p.x, p.y ?? 0, p.z);
        m4.compose(p4, q4, s4).multiply(local);
        im.setMatrixAt(i, m4);
      });
      im.computeBoundingSphere();
      im.receiveShadow = true;
      im.castShadow = !isTile;
      im.name = name;
      root.add(im);
    });
  }

  let grassMesh: THREE.InstancedMesh | undefined;
  if (grassTufts.length) {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const blades = [
      { angle: 0, width: 0.09, height: 0.78, color: new THREE.Color('#547f35') },
      { angle: PI / 3, width: 0.08, height: 1.02, color: new THREE.Color('#78a943') },
      { angle: (PI * 2) / 3, width: 0.09, height: 0.68, color: new THREE.Color('#68983c') },
      { angle: PI / 6, width: 0.075, height: 0.9, color: new THREE.Color('#8ab94d') },
      { angle: (PI * 5) / 6, width: 0.08, height: 0.72, color: new THREE.Color('#5f8e37') },
      { angle: PI, width: 0.08, height: 0.86, color: new THREE.Color('#6b9e3e') },
    ];
    for (const [i, blade] of blades.entries()) {
      const sideX = Math.cos(blade.angle) * blade.width / 2;
      const sideZ = Math.sin(blade.angle) * blade.width / 2;
      const leanX = Math.cos(blade.angle + PI / 2) * blade.width * 0.4;
      const leanZ = Math.sin(blade.angle + PI / 2) * blade.width * 0.4;
      const rootX = Math.cos(blade.angle) * 0.07;
      const rootZ = Math.sin(blade.angle) * 0.07;
      const vertex = i * 5;
      positions.push(
        rootX - sideX, 0, rootZ - sideZ,
        rootX + sideX, 0, rootZ + sideZ,
        rootX - sideX * 0.62 + leanX, blade.height * 0.55, rootZ - sideZ * 0.62 + leanZ,
        rootX + sideX * 0.62 + leanX, blade.height * 0.55, rootZ + sideZ * 0.62 + leanZ,
        rootX + leanX * 2, blade.height, rootZ + leanZ * 2,
      );
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3, vertex + 2, vertex + 4, vertex + 3);
      for (let j = 0; j < 5; j++) colors.push(blade.color.r, blade.color.g, blade.color.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const grassMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, side: THREE.DoubleSide,
    });
    grassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.cityWindTime = grassWindTime;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        uniform float cityWindTime;`,
      ).replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float cityBladePhase = cityWindTime * 1.3 + instanceMatrix[3].x * 0.27 + instanceMatrix[3].z * 0.31;
          float cityBladeHeight = clamp(transformed.y, 0.0, 1.0);
          transformed.x += sin(cityBladePhase + cityBladeHeight * 1.4) * 0.045 * cityBladeHeight;
          transformed.z += cos(cityBladePhase + cityBladeHeight * 1.1) * 0.025 * cityBladeHeight;
        #endif`,
      );
    };
    grassMaterial.customProgramCacheKey = () => 'brumaluz-grass-wind-v1';
    grassMesh = new THREE.InstancedMesh(geometry, grassMaterial, grassTufts.length);
    grassTufts.forEach((tuft, i) => {
      q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tuft.ry);
      s4.set(tuft.s, tuft.s * 0.6, tuft.s);
      p4.set(tuft.x, tuft.y, tuft.z);
      grassMesh!.setMatrixAt(i, m4.compose(p4, q4, s4));
    });
    grassMesh.receiveShadow = true;
    grassMesh.name = 'grass_tufts';
    root.add(grassMesh);
  }
  const grassUp = new THREE.Vector3(0, 1, 0);
  const blooms = flowers.flatMap((flower) =>
    [[-0.14, 0.02], [0.13, 0.08], [0.02, -0.16]].map(([dx, dz]) => {
      const x = flower.x + dx, z = flower.z + dz;
      return { x, y: terrainHeightAtWorld(x, z) + 0.18, z, hue: flower.hue };
    }));
  if (blooms.length) {
    const stemGeometry = new THREE.CylinderGeometry(0.018, 0.035, 0.3, 5);
    const petalGeometry = new THREE.SphereGeometry(1, 6, 4);
    const centerGeometry = new THREE.SphereGeometry(0.055, 6, 4);
    const stems = new THREE.InstancedMesh(stemGeometry, new THREE.MeshStandardMaterial({ color: '#64843d', roughness: 1 }), blooms.length);
    const petals = new THREE.InstancedMesh(petalGeometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), blooms.length * 5);
    const centers = new THREE.InstancedMesh(centerGeometry, new THREE.MeshStandardMaterial({ color: '#806548', roughness: 0.85 }), blooms.length);
    const flowerMatrix = new THREE.Matrix4();
    const flowerPosition = new THREE.Vector3();
    const flowerRotation = new THREE.Quaternion();
    const flowerScale = new THREE.Vector3(1, 1, 1);
    const palette = ['#d3a0a0', '#9c8bb2', '#e3ddd1', '#91a8a2'].map((color) => new THREE.Color(color));
    blooms.forEach((flower, i) => {
      flowerRotation.identity();
      flowerPosition.set(flower.x, flower.y + 0.15, flower.z);
      stems.setMatrixAt(i, flowerMatrix.compose(flowerPosition, flowerRotation, flowerScale));
      const petalColor = palette[Math.min(palette.length - 1, Math.floor(flower.hue * palette.length))];
      for (let j = 0; j < 5; j++) {
        const angle = j * PI * 2 / 5;
        flowerPosition.set(flower.x + Math.cos(angle) * 0.065, flower.y + 0.3, flower.z + Math.sin(angle) * 0.065);
        flowerRotation.setFromAxisAngle(grassUp, angle);
        flowerScale.set(0.075, 0.04, 0.052);
        petals.setMatrixAt(i * 5 + j, flowerMatrix.compose(flowerPosition, flowerRotation, flowerScale));
        petals.setColorAt(i * 5 + j, petalColor);
      }
      flowerPosition.set(flower.x, flower.y + 0.3, flower.z);
      flowerRotation.identity();
      flowerScale.set(1, 1, 1);
      centers.setMatrixAt(i, flowerMatrix.compose(flowerPosition, flowerRotation, flowerScale));
    });
    stems.name = 'wildflower_stems';
    petals.name = 'wildflower_petals';
    centers.name = 'wildflower_centers';
    for (const mesh of [stems, petals, centers]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
  }
  if (parkBenches.length) {
    const benchParts = [
      { geometry: new THREE.BoxGeometry(1.45, 0.12, 0.42), offsets: [{ x: 0, y: 0.58, z: 0 }], color: '#795338' },
      { geometry: new THREE.BoxGeometry(1.45, 0.42, 0.1), offsets: [{ x: 0, y: 0.88, z: -0.16 }], color: '#8a6040' },
      { geometry: new THREE.BoxGeometry(0.1, 0.48, 0.1), offsets: [-0.58, 0.58].flatMap((x) => [-0.14, 0.14].map((z) => ({ x, y: 0.27, z }))), color: '#55402f' },
    ];
    for (const [partIndex, part] of benchParts.entries()) {
      const mesh = new THREE.InstancedMesh(
        part.geometry,
        new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.95 }),
        parkBenches.length * part.offsets.length,
      );
      parkBenches.forEach((bench, i) => {
        const rotation = new THREE.Quaternion().setFromAxisAngle(grassUp, bench.ry);
        for (const [offsetIndex, offset] of part.offsets.entries()) {
          const local = new THREE.Vector3(offset.x, 0, offset.z).applyAxisAngle(grassUp, bench.ry);
          const position = new THREE.Vector3(bench.x + local.x, bench.y + offset.y, bench.z + local.z);
          mesh.setMatrixAt(i * part.offsets.length + offsetIndex, new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1)));
        }
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `park_bench_${partIndex}`;
      root.add(mesh);
    }
  }
  const grassBucketSize = 4;
  const grassBucketKey = (x: number, z: number) => `${Math.floor(x / grassBucketSize)},${Math.floor(z / grassBucketSize)}`;
  const grassBuckets = new Map<string, number[]>();
  grassTufts.forEach((tuft, i) => {
    const bucket = grassBucketKey(tuft.x, tuft.z);
    (grassBuckets.get(bucket) ?? grassBuckets.set(bucket, []).get(bucket)!).push(i);
  });
  let bentGrassIndices = new Set<number>();
  const grassDirection = new THREE.Vector3();
  const grassTilt = new THREE.Quaternion();
  const grassYaw = new THREE.Quaternion();
  const grassPosition = new THREE.Vector3();
  const grassScale = new THREE.Vector3();
  const grassMatrix = new THREE.Matrix4();

  // ---------- Colisiones ----------
  // Cajas orientadas calculadas con la geometría real de cada modelo (los círculos solo para arboledas y colinas).
  const colliders: Collider[] = [];
  const platforms: Platform[] = [];
  const TREE_COLLISION_RADIUS: Record<string, number> = {
    tree_single_A: 0.34, tree_single_B: 0.38,
    trees_A_large: 0.72, trees_B_large: 0.72,
    trees_A_medium: 0.64, trees_B_medium: 0.64,
    trees_A_small: 0.52, trees_B_small: 0.52,
  };
  const NO_COLLISION = /^(hex_|cloud|flag_|waterlily_|waterplant_)/;
  const footprints = new Map<string, { cx: number; cz: number; hx: number; hz: number; maxY: number } | null>();
  const footprintOf = (name: string) => {
    if (footprints.has(name)) return footprints.get(name)!;
    const model = models.get(name);
    let result: { cx: number; cz: number; hx: number; hz: number; maxY: number } | null = null;
    if (model) {
      model.updateMatrixWorld(true);
      const box = new THREE.Box3();
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || mesh.name === 'building_windmill_top_fan_blue' || mesh.name === 'building_watermill_wheel_blue') return;
        mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
      });
      if (!box.isEmpty()) result = { cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, hx: (box.max.x - box.min.x) / 2, hz: (box.max.z - box.min.z) / 2, maxY: box.max.y };
    }
    footprints.set(name, result);
    return result;
  };
  const addBox = (p: Placement, cx: number, cz: number, hx: number, hz: number, maxY: number) => {
    const k = S * (p.s ?? 1), cos = Math.cos(p.ry), sin = Math.sin(p.ry);
    const lx = cx * k, lz = cz * k;
    const x = p.x + lx * cos + lz * sin, z = p.z - lx * sin + lz * cos;
    const topY = (p.y ?? terrainHeightAtWorld(p.x, p.z)) + maxY * k;
    colliders.push({ x, z, r: 0, hx: hx * k, hz: hz * k, cos, sin, topY });
  };
  for (const p of place) {
    if (NO_COLLISION.test(p.model)) continue;
    if (p.model.startsWith('trees_') || p.model.startsWith('tree_single_')) {
      const radius = TREE_COLLISION_RADIUS[p.model] ?? (p.model.endsWith('_large') ? 0.72 : p.model.endsWith('_medium') ? 0.64 : 0.52);
      colliders.push({ x: p.x, z: p.z, r: radius * (p.s ?? 1) });
      continue;
    }
    const f = footprintOf(p.model);
    if (!f) {
      const fallbackRadius = BLOCK[p.model];
      if (fallbackRadius !== undefined) colliders.push({ x: p.x, z: p.z, r: Math.min(fallbackRadius, 1.25) * (p.s ?? 1) });
      continue;
    }
    const k = S * (p.s ?? 1), cos = Math.cos(p.ry), sin = Math.sin(p.ry);
    if (/^(hills_|hill_|mountain_)/.test(p.model)) {
      const radius = Math.max(f.hx, f.hz) * k * 0.62;
      colliders.push({ x: p.x + f.cx * k * cos + f.cz * k * sin, z: p.z - f.cx * k * sin + f.cz * k * cos, r: radius });
      continue;
    }
    const platformY = (p.y ?? terrainHeightAtWorld(p.x, p.z)) + f.maxY * k;
    const rise = platformY - terrainHeightAtWorld(p.x + f.cx * k * cos + f.cz * k * sin, p.z - f.cx * k * sin + f.cz * k * cos);
    // Solo tratamos como plataformas las partes superiores bajas y amplias; así
    // árboles, tejados y paredes conservan su bloqueo normal.
    if (rise >= 0.3 && rise <= 1.2 && f.hx * k >= 0.3 && f.hz * k >= 0.3) {
      platforms.push({
        x: p.x + f.cx * k * cos + f.cz * k * sin,
        z: p.z - f.cx * k * sin + f.cz * k * cos,
        y: platformY, hx: f.hx * k, hz: f.hz * k, cos, sin,
      });
    }
    if (p.model === 'wall_straight_gate') {
      // dos pilares laterales y el hueco central (|x| < 0.5) libre
      for (const side of [-1, 1]) addBox(p, f.cx + side * 0.75, f.cz, 0.25, f.hz, f.maxY);
    } else if (p.model === 'wall_straight') addBox(p, f.cx, f.cz, f.hx + 0.05, f.hz, f.maxY);
    else addBox(p, f.cx, f.cz, f.hx, f.hz, f.maxY);
  }
  for (const bench of parkBenches) {
    const cos = Math.cos(bench.ry), sin = Math.sin(bench.ry);
    const seatY = bench.y + 1.09;
    colliders.push({ x: bench.x, z: bench.z, r: 0, hx: 0.83, hz: 0.32, cos, sin, topY: seatY });
    platforms.push({ x: bench.x, z: bench.z, y: seatY, hx: 0.725, hz: 0.21, cos, sin });
  }
  const blockedTile = (x: number, z: number) => {
    const [q, r] = worldToHex(x, z);
    const t = tileType.get(key(q, r));
    return hexDist(q, r) > R_LAND || t === 'water' || t === 'river';
  };
  const ME = 0.45; // radio del personaje
  const pushOut = (out: THREE.Vector3, c: Collider, from: THREE.Vector3) => {
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
      // centro dentro de la caja: sacarlo por la cara más cercana
      const gx = c.hx - Math.abs(lx), gz = c.hz - Math.abs(lz);
      const fromDx = (from.x - c.x) * c.cos - (from.z - c.z) * c.sin;
      const fromDz = (from.x - c.x) * c.sin + (from.z - c.z) * c.cos;
      const moveX = lx - fromDx, moveZ = lz - fromDz;
      const signX = Math.sign(lx || fromDx || -moveX || 1);
      const signZ = Math.sign(lz || fromDz || -moveZ || 1);
      if (gx < gz) { px = signX * (c.hx + ME); pz = lz; } else { px = lx; pz = signZ * (c.hz + ME); }
    }
    out.x = c.x + px * c.cos + pz * c.sin;
    out.z = c.z - px * c.sin + pz * c.cos;
  };
  const platformY = (x: number, z: number) => {
    const floor = terrainHeightAtWorld(x, z);
    let top: number | null = null;
    for (const platform of platforms) {
      if (platform.y <= floor + 0.2 || platform.y > floor + 1.2 || (top !== null && platform.y <= top)) continue;
      const dx = x - platform.x, dz = z - platform.z;
      const lx = dx * platform.cos - dz * platform.sin;
      const lz = dx * platform.sin + dz * platform.cos;
      if (Math.abs(lx) <= platform.hx && Math.abs(lz) <= platform.hz) top = platform.y;
    }
    return top;
  };
  const collide = (from: THREE.Vector3, to: THREE.Vector3) => {
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.max(1, Math.ceil(distance / 0.2));
    const out = from.clone();
    const legalStep = (x: number, z: number, previous: THREE.Vector3) => !blockedTile(x, z)
      && Math.abs(terrainHeightAtWorld(x, z) - terrainHeightAtWorld(previous.x, previous.z)) <= 0.55;
    for (let step = 1; step <= steps; step++) {
      const previous = out.clone();
      const candidate = from.clone().lerp(to, step / steps);
      if (!legalStep(candidate.x, candidate.z, previous)) {
        const canX = legalStep(candidate.x, previous.z, previous);
        const canZ = legalStep(previous.x, candidate.z, previous);
        if (canX && canZ) {
          if (Math.abs(candidate.x - previous.x) >= Math.abs(candidate.z - previous.z)) candidate.z = previous.z;
          else candidate.x = previous.x;
        } else if (canX) candidate.z = previous.z;
        else if (canZ) candidate.x = previous.x;
        else { candidate.x = previous.x; candidate.z = previous.z; }
      }
      for (let iteration = 0; iteration < 6; iteration++) {
        const beforeX = candidate.x, beforeZ = candidate.z;
        for (const c of colliders) {
          if (c.topY !== undefined && Math.min(previous.y, candidate.y) >= c.topY - 0.08) continue;
          pushOut(candidate, c, previous);
        }
        if (Math.hypot(candidate.x - beforeX, candidate.z - beforeZ) < 1e-4) break;
      }
      if (!legalStep(candidate.x, candidate.z, previous)) {
        candidate.x = previous.x;
        candidate.z = previous.z;
      }
      out.copy(candidate);
    }
    return out;
  };
  const groundY = (x: number, z: number) => {
    return terrainHeightAtWorld(x, z);
  };

  // Nubes a la deriva
  const clouds: THREE.Object3D[] = [];
  const cloudModel = models.get('cloud_big');
  if (cloudModel) for (let i = 0; i < 10; i++) {
    const c = cloudModel.clone(true);
    const a = rnd() * PI * 2, d = 60 + rnd() * 80;
    c.position.set(Math.cos(a) * d, 28 + rnd() * 18, Math.sin(a) * d);
    c.scale.setScalar(S * (2 + rnd() * 2));
    c.rotation.y = rnd() * 6;
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: '#fff4ea', roughness: 1, emissive: '#ffd8c0', emissiveIntensity: 0.25 }); });
    root.add(c);
    clouds.push(c);
  }

  // NPC de prueba junto a la casa más cercana al punto de aparición del jugador
  const spawnPoint = hexToWorld(0, -1.6);
  const nearestHome = place
    .filter((p) => p.model === 'home_A' || p.model === 'home_B')
    .sort((a, b) => Math.hypot(a.x - spawnPoint.x, a.z - spawnPoint.y) - Math.hypot(b.x - spawnPoint.x, b.z - spawnPoint.y))[0];
  const npcSites: NpcSite[] = [];
  if (nearestHome) {
    const front = BLOCK[nearestHome.model] + 0.8;
    const nx = nearestHome.x + Math.sin(nearestHome.ry) * front + Math.cos(nearestHome.ry) * 1.9;
    const nz = nearestHome.z + Math.cos(nearestHome.ry) * front - Math.sin(nearestHome.ry) * 1.9;
    npcSites.push({ id: 'testiculos', position: new THREE.Vector3(nx, terrainHeightAtWorld(nx, nz), nz), yaw: Math.atan2(spawnPoint.x - nx, spawnPoint.y - nz) });
    colliders.push({ x: nx, z: nz, r: 0.5 });
  }
  const farmerX=COMBAT_SITE.x-3, farmerZ=COMBAT_SITE.z;
  npcSites.push({
    id:'isberto',
    position:new THREE.Vector3(farmerX,terrainHeightAtWorld(farmerX,farmerZ),farmerZ),
    yaw:Math.atan2(COMBAT_SITE.x-farmerX,COMBAT_SITE.z-farmerZ),
  });
  colliders.push({x:farmerX,z:farmerZ,r:.5});

  const reserved = [
    { x: spawnPoint.x, z: spawnPoint.y }, WELCOME_START, WELCOME_BADGE, SHADOW_RETURN,
    COMBAT_SITE, ...COIN_BAGS, ...npcSites.map(site => site.position), ...vendorSpots.map(spot => spot.position),
  ];
  const details = await buildCityDetails(vendorSpots, groundY, (x, z, radius) => {
    if (reserved.some(point => Math.hypot(x - point.x, z - point.z) < radius + 2)) return false;
    for (let i = 0; i < 9; i++) {
      const angle = i * PI / 4;
      const px = x + (i === 8 ? 0 : Math.cos(angle) * (radius + .45));
      const pz = z + (i === 8 ? 0 : Math.sin(angle) * (radius + .45));
      const [q, r] = worldToHex(px, pz);
      if (blockedTile(px, pz) || roads.has(key(q, r)) && liesOnRoad(px, pz, q, r)) return false;
    }
    return colliders.every(collider => {
      const dx = x - collider.x, dz = z - collider.z;
      if (collider.hx === undefined || collider.hz === undefined || collider.cos === undefined || collider.sin === undefined) {
        return Math.hypot(dx, dz) > collider.r + radius + .45;
      }
      const lx = dx * collider.cos - dz * collider.sin, lz = dx * collider.sin + dz * collider.cos;
      return Math.hypot(Math.max(0, Math.abs(lx) - collider.hx), Math.max(0, Math.abs(lz) - collider.hz)) > radius + .45;
    });
  });
  root.add(details.root);
  for (const detail of details.placements) {
    colliders.push({ x: detail.x, z: detail.z, r: detail.radius, topY: detail.topY });
    const rise = detail.topY - groundY(detail.x, detail.z);
    if (detail.prop !== 'bush' && detail.prop !== 'rock'
      && rise >= .3 && rise <= 1.2 && detail.hx >= .3 && detail.hz >= .3) {
      platforms.push({
        x: detail.x, z: detail.z, y: detail.topY, hx: detail.hx, hz: detail.hz,
        cos: Math.cos(detail.yaw), sin: Math.sin(detail.yaw),
      });
    }
  }

  return {
    root,
    locationId: 'brumaluz',
    npcSites,
    interactables: (() => { const w = hexToWorld(0, 0); return [{ id: 'well', position: new THREE.Vector3(w.x, groundY(w.x, w.y), w.y), radius: 3.4, label: 'Asomarse al pozo' }]; })(),
    vendorSpots,
    collide,
    groundY,
    platformY,
    spawn: (() => { const w = hexToWorld(0, -1.6); return new THREE.Vector3(w.x, groundY(w.x, w.y), w.y); })(),
    spawnYaw: Math.atan2(0.5, SQ3 / 2),
    ...cityLinks(brumaluzGateMarkers(), groundY),
    layout: {
      placements: place, heightAt: terrainHeightAtWorld, grassTufts, benches: parkBenches, details: details.placements,
    },
    update(t: number, playerPosition?: THREE.Vector3) {
      clouds.forEach((c, i) => { c.position.x += Math.sin(i) * 0.004; c.rotation.y = t * 0.003 + i; });
      windmillFans.forEach((fan, i) => { fan.rotation.z = t * 0.8 + i; });
      wavingFlags.forEach((flag) => { flag.object.rotation.y = flag.yaw + Math.sin(t * 1.4 + flag.phase) * 0.05; });
      grassWindTime.value = t;
      if (grassMesh) {
        let updatedGrass = false;
        const candidates = new Set(bentGrassIndices);
        if (playerPosition) {
          const bx = Math.floor(playerPosition.x / grassBucketSize), bz = Math.floor(playerPosition.z / grassBucketSize);
          for (let x = bx - 1; x <= bx + 1; x++) for (let z = bz - 1; z <= bz + 1; z++) {
            for (const i of grassBuckets.get(`${x},${z}`) ?? []) candidates.add(i);
          }
        }
        const newlyBent = new Set<number>();
        for (const i of candidates) {
          const tuft = grassTufts[i];
          const dx = playerPosition ? tuft.x - playerPosition.x : 0;
          const dz = playerPosition ? tuft.z - playerPosition.z : 0;
          const distance = Math.hypot(dx, dz);
          const bend = playerPosition ? Math.max(0, 1 - distance / 3.4) * 1.25 : 0;
          if (bend === 0 && !bentGrassIndices.has(i)) continue;
          grassYaw.setFromAxisAngle(grassUp, tuft.ry);
          if (bend > 0) {
            const localAngle = Math.atan2(dz, dx) - tuft.ry;
            grassDirection.set(Math.cos(localAngle) * Math.sin(bend), Math.cos(bend), Math.sin(localAngle) * Math.sin(bend));
            grassTilt.setFromUnitVectors(grassUp, grassDirection);
            grassYaw.multiply(grassTilt);
          }
          grassPosition.set(tuft.x, tuft.y, tuft.z);
          grassScale.set(tuft.s, tuft.s * 0.6, tuft.s);
          grassMesh.setMatrixAt(i, grassMatrix.compose(grassPosition, grassYaw, grassScale));
          if (bend > 0) newlyBent.add(i);
          updatedGrass = true;
        }
        bentGrassIndices = newlyBent;
        if (updatedGrass) grassMesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

import * as THREE from 'three';
import { validateMap, type MapDocument, type MapKind } from '../data/maps';
import { isWorldNpcId } from '../data/npcs';
import { LOCATIONS } from '../data/data';
import { PUBLISHED_WORLD } from '../data/world/published';
import { loadGLB } from './load';
import { softDot } from './paint';
import { loadMapWorld } from './mapRuntime';
import { boxOf, createMapAssetProvider, LAMPPOST_FLAME_Y } from './mapAssetsCore';
import { cityLinks, type City, type CityVendorSpot, type Interactable, type NpcSite } from './city';

// Mapas del juego publicados desde el editor (`/maps.html`): el mundo de Pompelín, Brumaluz y el resto de lugares.

export interface PublishedMapMeta {
  id: string;
  name: string;
  kind: MapKind;
  region: string;
  loadingTip: string;
  publishedAt: string;
  objects: number;
  assets: number;
  bytes: number;
}
export interface PublishedMapModule { map: unknown; assets: Record<string, string> }
export interface PublishedMap extends PublishedMapMeta { load(): Promise<PublishedMapModule> }
export type PublishedWorld = Record<string, PublishedMap>;

const VENDOR_ROLES = new Set<CityVendorSpot['role']>(['merchant', 'innkeeper', 'healer', 'smith', 'miller', 'lumber']);
const MAX_LIGHTS = 12;
/** Campo de visión: margen sobre el final de la niebla y distancia a la que se dejan de dibujar los detalles pequeños. */
const VIEW_MARGIN = 30;
const DETAIL_DISTANCE = 75;

// En desarrollo, «Publicar en el juego» del editor recarga las pestañas del juego.
import.meta.hot?.on('brumaluz:city-published', () => location.reload());

/** ¿Usa el juego los mapas publicados? `?ciudad-procedural` (y las pruebas) fuerzan la Brumaluz de siempre. */
export function publishedWorldEnabled() {
  const params = new URLSearchParams(location.search);
  return !params.has('test') && !params.has('ciudad-procedural');
}

/** Mapas publicados disponibles en esta partida. */
export function publishedMaps(): Readonly<PublishedWorld> {
  return publishedWorldEnabled() ? PUBLISHED_WORLD : {};
}
for (const map of Object.values(publishedMaps())) LOCATIONS[map.id] = map.name;

export async function loadPublishedMap(id: string, scene: THREE.Scene) {
  const entry = publishedMaps()[id];
  if (!entry) throw new Error(`El mapa «${id}» no está publicado.`);
  const { map, assets } = await entry.load();
  const doc = validateMap(map);
  return { doc, city: await buildMapCity(doc, assets, scene) };
}

/**
 * Las casillas hexagonales solo tienen vértices en el borde, así que sobre una malla de terreno de 1 m
 * sus caras planas quedan por debajo de los abultamientos y el suelo asoma a manchas. En el juego
 * hundimos el terreno (solo la malla visible; las colisiones siguen usando la altura real) bajo ellas.
 */
async function sinkTerrainUnderTiles(world: Awaited<ReturnType<typeof loadMapWorld>>, doc: MapDocument, provider: ReturnType<typeof createMapAssetProvider>) {
  const { field, surface } = world;
  const { columns, rows, cell, minX, minZ } = field;
  const visibleLayers = new Set(doc.layers.filter(layer => layer.visible).map(layer => layer.id));
  const tiles = doc.objects.filter(object => object.asset.startsWith('city/hex_') && !object.hidden && visibleLayers.has(object.layer));
  if (!tiles.length) return;
  const boxes = new Map<string, THREE.Box3 | null>();
  for (const asset of new Set(tiles.map(tile => tile.asset))) {
    boxes.set(asset, await provider.template(asset).then(template => boxOf(template), () => null));
  }
  const sunk = new Uint8Array(columns * rows);
  for (const tile of tiles) {
    const box = boxes.get(tile.asset);
    if (!box || box.isEmpty()) continue;
    const [sx, , sz] = tile.scale, yaw = tile.rotation[1];
    const halfX = (box.max.x - box.min.x) / 2, halfZ = (box.max.z - box.min.z) / 2;
    const centerX = (box.min.x + box.max.x) / 2, centerZ = (box.min.z + box.max.z) / 2;
    // Hexágono: el semieje menor es la apotema y una normal de lado apunta en esa dirección.
    const apothem = Math.min(halfX, halfZ) * 1.02;
    const base = halfX < halfZ ? 0 : Math.PI / 2;
    const normals = [0, 1, 2].map(k => [Math.cos(base + k * Math.PI / 3), Math.sin(base + k * Math.PI / 3)]);
    const reach = Math.max(halfX * Math.abs(sx), halfZ * Math.abs(sz)) * 1.2 + cell;
    const [px, , pz] = tile.position;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const i0 = Math.max(0, Math.floor((px - reach - minX) / cell)), i1 = Math.min(columns - 1, Math.ceil((px + reach - minX) / cell));
    const j0 = Math.max(0, Math.floor((pz - reach - minZ) / cell)), j1 = Math.min(rows - 1, Math.ceil((pz + reach - minZ) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = minX + i * cell - px, dz = minZ + j * cell - pz;
      const lx = (dx * cos - dz * sin) / (sx || 1) - centerX, lz = (dx * sin + dz * cos) / (sz || 1) - centerZ;
      if (normals.every(([nx, nz]) => Math.abs(lx * nx + lz * nz) <= apothem)) sunk[j * columns + i] = 1;
    }
  }
  const position = surface.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  // Los vértices del borde bajan poco para que no se vea una zanja junto al último hexágono;
  // los interiores, bajo casillas grandes sobre lomas, bajan del todo.
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const index = j * columns + i;
    if (!sunk[index]) continue;
    let interior = true;
    for (let dj = -1; dj <= 1 && interior; dj++) for (let di = -1; di <= 1; di++) {
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && nj >= 0 && ni < columns && nj < rows && !sunk[nj * columns + ni]) { interior = false; break; }
    }
    position.setY(index, field.data.heights[index] - (interior ? 5 : 0.6));
  }
  position.needsUpdate = true;
  surface.mesh.geometry.computeBoundingSphere();
  surface.mesh.geometry.computeBoundingBox();
}

/** Adapta un mapa del editor a la interfaz `City` que usa el juego. */
export async function buildMapCity(doc: MapDocument, assets: Readonly<Record<string, string>>, scene: THREE.Scene): Promise<City> {
  const provider = createMapAssetProvider(async id => {
    const url = assets[id];
    if (!url) throw new Error(`El mapa publicado no incluye ${id}.`);
    return (await loadGLB(url)).scene;
  });
  const world = await loadMapWorld(doc, scene, provider, { lighting: false, batch: true });
  const { collision, field } = world;
  const root = world.root;
  root.name = `city:${doc.id}`;
  // Los nombres siguen las convenciones de city.ts: el suelo y la hierba no tapan la cámara de las conversaciones.
  world.surface.mesh.name = 'hex_terrain';
  world.grass.root.name = 'grass_tufts';
  await sinkTerrainUnderTiles(world, doc, provider);
  // Las nubes no deben salir en el minimapa.
  const clouds = world.environment.clouds;
  clouds.userData.hideFromMinimap = true;
  root.add(clouds);

  const visibleLayers = new Set(doc.layers.filter(layer => layer.visible).map(layer => layer.id));
  const markers = doc.markers.filter(marker => visibleLayers.has(marker.layer));
  const onGround = (position: readonly number[]) => new THREE.Vector3(position[0], field.heightAt(position[0], position[2]), position[2]);

  const npcSites: NpcSite[] = [];
  for (const marker of markers) {
    // Gnomi lo coloca la misión de bienvenida; los NPC del creador aún no se instancian en el mundo.
    if (marker.type !== 'npc' || !marker.npcId || marker.npcId === 'gnomi' || !isWorldNpcId(marker.npcId)) continue;
    if (npcSites.some(site => site.id === marker.npcId)) continue;
    npcSites.push({ id: marker.npcId, position: onGround(marker.position), yaw: marker.rotationY });
  }

  const interactables: Interactable[] = [], vendorSpots: CityVendorSpot[] = [];
  for (const marker of markers) {
    if (marker.type !== 'interaction') continue;
    const text = marker.text?.trim() ?? '';
    if (marker.id.startsWith('coins_') || text === 'coin-bag') continue;
    if (VENDOR_ROLES.has(text as CityVendorSpot['role'])) {
      vendorSpots.push({ id: marker.id.replace(/^vendor_/, ''), role: text as CityVendorSpot['role'], position: onGround(marker.position) });
      continue;
    }
    interactables.push(text === 'well'
      ? { id: 'well', position: onGround(marker.position), radius: marker.radius, label: marker.name || 'Asomarse al pozo' }
      : { id: `map:${marker.id}`, position: onGround(marker.position), radius: Math.max(1, marker.radius), label: marker.name || 'Examinar', text: text || undefined });
  }

  // Faroles: llama en cada farol básico y luz real en los marcadores de luz.
  const flameTexture = softDot('rgba(255,210,120,1)', 'rgba(255,120,40,0)');
  const flames: THREE.Sprite[] = [];
  for (const object of doc.objects) {
    if (object.asset !== 'builtin/lamppost' || object.hidden || !visibleLayers.has(object.layer)) continue;
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    const base = object.conform ? field.heightAt(object.position[0], object.position[2]) : 0;
    flame.position.set(object.position[0], base + object.position[1] + LAMPPOST_FLAME_Y * object.scale[1], object.position[2]);
    flame.userData.size = 1.3 * object.scale[1];
    flame.raycast = () => {};
    root.add(flame);
    flames.push(flame);
  }
  for (const marker of markers.filter(marker => marker.type === 'light').slice(0, MAX_LIGHTS)) {
    const light = new THREE.PointLight(marker.color ?? '#ffb24a', 6, Math.max(1, marker.radius) * 1.6, 1.6);
    light.position.set(...marker.position);
    root.add(light);
  }

  const spawnMarker = markers.find(marker => marker.type === 'spawn');
  return {
    root,
    locationId: doc.id,
    mapBounds: { x: (field.minX + field.maxX) / 2, z: (field.minZ + field.maxZ) / 2, extent: Math.max(field.maxX - field.minX, field.maxZ - field.minZ) / 2 },
    npcSites,
    interactables,
    vendorSpots,
    collide: collision.collide,
    groundY: collision.groundY,
    platformY: collision.platformY,
    spawn: spawnMarker ? onGround(spawnMarker.position) : world.spawn,
    spawnYaw: spawnMarker?.rotationY ?? 0,
    ...cityLinks(markers, (x, z) => field.heightAt(x, z)),
    update(t: number, playerPosition?: THREE.Vector3) {
      // Campo de visión: lo que queda tras la niebla no se dibuja (con margen para la cámara, detrás del jugador).
      const fog = scene.fog instanceof THREE.Fog ? scene.fog.far : Infinity;
      world.update(t, playerPosition ?? world.spawn, { distance: fog + VIEW_MARGIN, detail: Math.min(fog + VIEW_MARGIN, DETAIL_DISTANCE) });
      flames.forEach((flame, i) => flame.scale.setScalar(flame.userData.size * (0.96 + Math.sin(t * 9 + i * 2) * 0.06 + Math.sin(t * 23 + i) * 0.04)));
    },
  };
}

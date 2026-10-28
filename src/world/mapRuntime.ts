import * as THREE from 'three';
import { FALL_STEP, decodeTerrain, type MapDocument } from '../data/maps';
import { TerrainField, TerrainSurface } from './map/terrain';
import { MaterialVariants } from './map/materials';
import { GrassField } from './map/grass';
import { MapEnvironment } from './map/environment';
import { type MapAssetProvider, ObjectLayer } from './map/objects';
import { buildCollision } from './map/collision';
export { FALL_STEP };
// El motor de mapas está repartido en src/world/map/; este módulo lo reúne y carga mapas completos.
export * from './map/terrain';
export * from './map/materials';
export * from './map/grass';
export * from './map/environment';
export * from './map/objects';
export * from './map/collision';

/** Carga completa de un mapa (para pruebas de paseo o para usarlo en el juego). */
/** `batch`: agrupa las piezas estáticas en InstancedMesh (juego; no sirve para editar). */
export async function loadMapWorld(doc: MapDocument, scene: THREE.Scene, provider: MapAssetProvider, /** `hide`: recursos que no se dibujan (el juego pone su propia agua en lugar de la casilla opaca). */
  options: { lighting?: boolean; batch?: boolean; hide?: (asset: string) => boolean } = {}) {
  const field = new TerrainField(decodeTerrain(doc.terrain));
  const surface = new TerrainSurface(field,!!options.batch);
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
  if (options.hide) for (const view of objects.views.values()) if (options.hide(view.container.userData.mapAsset)) view.container.visible = false;
  if (options.batch) objects.batch();
  const assets = [...new Set(doc.objects.map(object => object.asset))];
  const boxes = new Map(await Promise.all(assets.map(async asset => [asset, await provider.collisionBox(asset).catch(() => new THREE.Box3())] as const)));
  const collision = buildCollision(doc, field, boxes);
  const spawn = doc.markers.find(marker => marker.type === 'spawn');
  return {
    root, field, surface, environment, grass, objects, collision, materials,
    spawn: spawn ? new THREE.Vector3(spawn.position[0], field.heightAt(spawn.position[0], spawn.position[2]), spawn.position[2]) : new THREE.Vector3(),
    spawnYaw: spawn?.rotationY ?? 0,
    /** `view`: campo de visión (m) para edificios y para detalles; sin él se dibuja todo. */
    update(t: number, focus: THREE.Vector3, view?: { distance: number; detail: number }) {
      if (view) { objects.cull(focus, view.distance, view.detail);surface.cull(focus,view.distance); }
      grass.update(t, view ? focus : undefined, view ? Math.min(60, view.detail) : undefined); objects.update(t); environment.update(t, focus);
    },
  };
}

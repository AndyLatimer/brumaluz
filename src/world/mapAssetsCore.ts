import * as THREE from 'three';
import cityUrl from '../assets/models/city.glb?url';
import { loadGLB } from './load';
import type { Vec3 } from '../data/maps';
import type { MapAssetProvider } from './mapRuntime';

// Piezas de mapa que no dependen de la biblioteca: city.glb y las piezas básicas del juego.
// El juego lo usa con un resolvedor que solo conoce los GLB del mapa publicado.

export const BUILTIN_BOUNDS: Record<string, { min: Vec3; max: Vec3; label: string }> = {
  bench: { min: [-0.725, 0, -0.21], max: [0.725, 1.09, 0.21], label: 'Banco del parque' },
  lamppost: { min: [-0.14, 0, -0.14], max: [0.14, 3.15, 0.14], label: 'Farol de la plaza' },
};
/** Altura de la llama del farol básico. */
export const LAMPPOST_FLAME_Y = 2.75;

let cityModels: Promise<Map<string, THREE.Object3D>> | undefined;
export function loadCityModels() {
  cityModels ??= loadGLB(cityUrl).then(gltf => {
    const models = new Map<string, THREE.Object3D>();
    for (const child of [...gltf.scene.children]) {
      child.position.set(0, 0, 0); child.rotation.set(0, 0, 0); child.scale.set(1, 1, 1);
      models.set(child.name, child);
    }
    models.get('wall_straight_gate')?.traverse(part => {
      if (part.name === 'wall_straight_gate_door_left' || part.name === 'wall_straight_gate_door_right') part.rotation.y = Math.PI / 2;
    });
    const material = (gltf.scene.getObjectByProperty('isMesh', true) as THREE.Mesh | undefined)?.material;
    if (material instanceof THREE.MeshStandardMaterial) material.roughness = 0.85;
    const grass = models.get('hex_grass');
    grass?.traverse(part => {
      if (part instanceof THREE.Mesh && part.material instanceof THREE.MeshStandardMaterial) {
        part.material = part.material.clone();
        (part.material as THREE.MeshStandardMaterial).color.set('#8aca78');
      }
    });
    return models;
  }).catch(error => { cityModels = undefined; throw error; });
  return cityModels;
}

export const boxOf = (object: THREE.Object3D, skip?: RegExp) => {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3();
  object.traverse(part => {
    const mesh = part as THREE.Mesh;
    if (!mesh.isMesh || skip?.test(mesh.name)) return;
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
  });
  return box;
};

/** Parte de abajo del objeto (en fracción de su altura) que cuenta para la planta de su colisión. */
export const FOOTPRINT_HEIGHT = 0.3;

/**
 * Caja de colisión: la altura del objeto entero, pero la planta solo de lo que hay a ras de suelo (el 30 % de abajo).
 * Así no cuentan aleros, tejados, copas, toldos ni los brazos de un farol, y uno se puede arrimar a las paredes.
 */
export const footprintOf = (object: THREE.Object3D, skip?: RegExp) => {
  const box = boxOf(object, skip);
  if (box.isEmpty()) return box;
  const cut = box.min.y + (box.max.y - box.min.y) * FOOTPRINT_HEIGHT;
  const foot = new THREE.Box3(), point = new THREE.Vector3();
  object.traverse(part => {
    const mesh = part as THREE.Mesh;
    if (!mesh.isMesh || skip?.test(mesh.name)) return;
    const positions = mesh.geometry.getAttribute('position');
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      if (point.y <= cut) foot.expandByPoint(point);
    }
  });
  if (foot.isEmpty()) return box;
  box.min.x = foot.min.x; box.max.x = foot.max.x; box.min.z = foot.min.z; box.max.z = foot.max.z;
  return box;
};

/** Cristal de los faroles básicos: el ciclo de día y noche lo enciende y lo apaga. */
export const LAMPPOST_GLASS = new THREE.MeshStandardMaterial({ color: '#ffd88a', emissive: '#ffb24a', emissiveIntensity: 2.2 });

/** Proveedor de plantillas compartidas; `library` resuelve los recursos de la biblioteca. */
export function createMapAssetProvider(library: (id: string) => Promise<THREE.Object3D>): MapAssetProvider & {
  instantiate(id: string): Promise<THREE.Object3D>;
} {
  const templates = new Map<string, Promise<THREE.Object3D>>();
  const template = (id: string) => {
    let value = templates.get(id);
    if (!value) {
      value = (async () => {
        if (id.startsWith('city/')) {
          const model = (await loadCityModels()).get(id.slice(5));
          if (!model) throw new Error(`Pieza desconocida: ${id}`);
          return model;
        }
        if (id.startsWith('builtin/')) return builtin(id.slice(8));
        return library(id);
      })();
      value.catch(() => templates.delete(id));
      templates.set(id, value);
    }
    return value;
  };
  return {
    template,
    async instantiate(id: string) {
      const copy = (await template(id)).clone(true);
      copy.traverse(part => {
        if (part instanceof THREE.Mesh) { part.castShadow = !id.startsWith('city/hex_'); part.receiveShadow = true; }
      });
      return copy;
    },
    /** Caja de colisión local (sin aspas de molino ni rueda de agua): ver `footprintOf`. */
    async collisionBox(id: string) { return footprintOf(await template(id), /windmill_top_fan|watermill_wheel/); },
  };
}

function builtin(name: string): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `builtin/${name}`;
  if (name === 'bench') {
    const parts: [THREE.BoxGeometry, [number, number, number][], string][] = [
      [new THREE.BoxGeometry(1.45, 0.12, 0.42), [[0, 0.58, 0]], '#795338'],
      [new THREE.BoxGeometry(1.45, 0.42, 0.1), [[0, 0.88, -0.16]], '#8a6040'],
      [new THREE.BoxGeometry(0.1, 0.48, 0.1), [-0.58, 0.58].flatMap(x => [-0.14, 0.14].map(z => [x, 0.27, z] as [number, number, number])), '#55402f'],
    ];
    for (const [geometry, offsets, color] of parts) {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
      for (const offset of offsets) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...offset); group.add(mesh); }
    }
    return group;
  }
  if (name === 'lamppost') {
    const iron = new THREE.MeshStandardMaterial({ color: '#3a3533', roughness: 0.5, metalness: 0.6 });
    const glass = LAMPPOST_GLASS;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.6, 8), iron); pole.position.y = 1.3;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), glass); lamp.position.y = LAMPPOST_FLAME_Y;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.22, 4), iron); cap.position.y = 3.04; cap.rotation.y = Math.PI / 4;
    group.add(pole, lamp, cap);
    return group;
  }
  throw new Error(`Pieza básica desconocida: builtin/${name}`);
}

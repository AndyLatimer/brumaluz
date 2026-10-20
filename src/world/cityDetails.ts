import * as THREE from 'three';
import type { CityVendorSpot } from './city';
import { loadProp, type PropId } from './props';

interface DetailSpot extends CityVendorSpot { yaw: number }
interface DetailPlacement {
  prop: PropId; x: number; y: number; z: number; yaw: number; scale: number; radius: number;
  topY: number; hx: number; hz: number;
}
const SUPPLIES: Record<CityVendorSpot['role'], readonly [PropId, PropId]> = {
  merchant: ['textiles', 'barrels'],
  innkeeper: ['tavern-table', 'barrels'],
  healer: ['textiles', 'rock'],
  smith: ['iron', 'planks'],
  miller: ['barrels', 'planks'],
  lumber: ['logs', 'planks'],
};
const SCALE: Partial<Record<PropId, number>> = { bush: 2.8, rock: .85, textiles: .42, iron: .6, 'tavern-table': .6 };

/** Small, deterministic service vignettes; new copies cost no extra draw calls. */
export async function buildCityDetails(
  spots: DetailSpot[],
  groundY: (x: number, z: number) => number,
  canPlace: (x: number, z: number, radius: number) => boolean,
) {
  const root = new THREE.Group();
  root.name = 'city-details';
  const types = [...new Set<PropId>([...Object.values(SUPPLIES).flat(), 'bush'])];
  const models = new Map(await Promise.all(types.map(async prop => [prop, await loadProp(prop)] as const)));
  const boxes = new Map([...models].map(([prop, model]) => [prop, new THREE.Box3().setFromObject(model)]));
  const placements: DetailPlacement[] = [];
  for (const spot of spots) {
    const props: PropId[] = [...SUPPLIES[spot.role], 'bush', 'bush'];
    props.forEach((prop, index) => {
      const box = boxes.get(prop)!;
      const size = box.getSize(new THREE.Vector3());
      const scale = SCALE[prop] ?? .65;
      const radius = Math.hypot(size.x, size.z) * scale / 2;
      const side = index % 2 ? -1 : 1;
      for (const distance of [2.4, 3.2, 3.6, 4, 4.8, 5.6, 6.4, 7.2, 8]) {
        for (const depth of [-.8, -1.6, -2.4, -3.2, -4, -4.8, -5.6, -6.4, 0, .8, 1.6, 2.4]) {
          const lateral = side * (distance + (index >= 2 ? 1.2 : 0));
          const x = spot.position.x + Math.cos(spot.yaw) * lateral + Math.sin(spot.yaw) * depth;
          const z = spot.position.z - Math.sin(spot.yaw) * lateral + Math.cos(spot.yaw) * depth;
          if (!canPlace(x, z, radius)
            || placements.some(other => Math.hypot(x - other.x, z - other.z) < radius + other.radius + .3)) continue;
          const height = groundY(x, z);
          const samples = [groundY(x - radius, z), groundY(x + radius, z), groundY(x, z - radius), groundY(x, z + radius)];
          if (Math.max(...samples, height) - Math.min(...samples, height) > .12) continue;
          const y = Math.min(...samples, height);
          placements.push({
            prop, x, y, z, yaw: spot.yaw, scale, radius,
            topY: y + size.y * scale, hx: size.x * scale / 2, hz: size.z * scale / 2,
          });
          return;
        }
      }
    });
  }
  const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  for (const [prop, model] of models) {
    const copies = placements.filter(placement => placement.prop === prop);
    if (!copies.length) continue;
    const box = boxes.get(prop)!;
    const center = box.getCenter(new THREE.Vector3());
    const align = new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z);
    model.updateMatrixWorld(true);
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const instances = new THREE.InstancedMesh(object.geometry, object.material, copies.length);
      instances.name = `city-detail:${prop}`;
      copies.forEach((copy, index) => {
        position.set(copy.x, copy.y, copy.z);
        rotation.setFromAxisAngle(up, copy.yaw);
        scale.setScalar(copy.scale);
        instances.setMatrixAt(index, matrix.compose(position, rotation, scale).multiply(align).multiply(object.matrixWorld));
      });
      instances.castShadow = instances.receiveShadow = true;
      instances.computeBoundingSphere();
      root.add(instances);
    });
  }
  root.userData.placements = placements;
  return { root, placements };
}

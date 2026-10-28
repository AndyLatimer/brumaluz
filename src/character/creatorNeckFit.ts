import * as THREE from 'three';
import { settleAccessory } from './equipmentFit';

type Own = (resource: { dispose(): void }) => void;

function neckGarment(model: THREE.Object3D) {
  for (const name of ['medieval-tunic', 'helpers-overalls', 'helpers-shirt']) {
    const object = model.getObjectByName(name);
    if (object) {
      let skin: THREE.SkinnedMesh | undefined;
      object.traverse(node => { if (!skin && node instanceof THREE.SkinnedMesh) skin = node; });
      if (skin) return { object, skin };
    }
  }
  let result: THREE.SkinnedMesh | undefined;
  model.traverse(node => {
    if (result || !(node instanceof THREE.SkinnedMesh) || node.name === 'character-neck-accessory') return;
    node.geometry.computeBoundingBox();
    const box = node.geometry.boundingBox!;
    if (box.min.x < -.12 && box.max.x > .12 && box.min.y < 1.06 && box.max.y > 1.18) result = node;
  });
  return result ? { object: result, skin: result } : undefined;
}

/** Fit cosmetic neck pieces to the worn torso and use its spine/chest blend in motion. */
export function fitCreatorNeckAccessory(accessory: THREE.Object3D, model: THREE.Object3D, chest: THREE.Bone, own: Own) {
  const garment = neckGarment(model);
  if (!garment) return;
  model.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  accessory.traverse(node => { if (node instanceof THREE.Mesh && !(node instanceof THREE.SkinnedMesh)) meshes.push(node); });
  for (const source of meshes) {
    const geometry = source.geometry;
    // The head builder owns this instance; only its bind-space placement changes.
    geometry.applyMatrix4(garment.skin.matrixWorld.clone().invert().multiply(source.matrixWorld));
    const count = geometry.attributes.position.count;
    const joint = Math.max(0, garment.skin.skeleton.bones.findIndex(bone => bone.name === 'chest'));
    const indices = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { indices[i * 4] = joint; weights[i * 4] = 1; }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const fitted = new THREE.SkinnedMesh(geometry, source.material);
    fitted.name = source.name; fitted.userData = { ...source.userData, creatorNeckFit: true };
    fitted.castShadow = source.castShadow; fitted.receiveShadow = source.receiveShadow;
    fitted.visible = source.visible; fitted.renderOrder = source.renderOrder; fitted.frustumCulled = false;
    // Keep the chest parent contract, while bindMode removes the parent's double transform.
    chest.add(fitted);
    const local = chest.matrixWorld.clone().invert().multiply(garment.skin.matrixWorld);
    local.decompose(fitted.position, fitted.quaternion, fitted.scale);
    fitted.bind(garment.skin.skeleton, garment.skin.bindMatrix);
    source.removeFromParent();
    settleAccessory(fitted, garment.object, own, .09);
    fitted.updateMatrixWorld(true);
  }
  // Non-mesh holders are uncommon, but an emptied one should not remain on the chest.
  if (!(accessory instanceof THREE.Mesh) && !accessory.children.length) accessory.removeFromParent();
}

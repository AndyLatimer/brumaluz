import * as THREE from 'three';
import type { HeadResult } from './types';
import { HEAD_C, V } from './geometry';

/** Fit each complete temple section over the actual equipped helmet/hood, preserving its thickness. */
export function fitEyewearToHeadwear(head: HeadResult, headwear: THREE.Object3D[]) {
  const arms: THREE.Mesh[] = [];
  head.group.traverse(node => { if (node instanceof THREE.Mesh && node.name === 'character-glasses-arm') arms.push(node); });
  if (!arms.length || !headwear.length) return 0;
  head.group.updateWorldMatrix(true, true); headwear.forEach(node => node.updateWorldMatrix(true, true));
  const bindToWorld = head.group.matrixWorld.clone().multiply(head.toBone), worldToBind = bindToWorld.clone().invert();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), probes: THREE.Mesh[] = [], seen = new Set<THREE.Mesh>();
  for (const root of headwear) root.traverse(node => {
    if (!(node instanceof THREE.Mesh) || seen.has(node) || !node.visible) return;
    seen.add(node);
    if (node instanceof THREE.SkinnedMesh) node.skeleton.update();
    const source = node.geometry.attributes.position, positions = new Float32Array(source.count * 3), point = V(0, 0, 0);
    for (let i = 0; i < source.count; i++) {
      node.getVertexPosition(i, point); point.applyMatrix4(node.matrixWorld).applyMatrix4(worldToBind);
      positions[i * 3] = point.x; positions[i * 3 + 1] = point.y; positions[i * 3 + 2] = point.z;
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (node.geometry.index) geometry.setIndex(node.geometry.index.clone());
    geometry.computeBoundingSphere(); const proxy = new THREE.Mesh(geometry, material); proxy.updateMatrixWorld(true); probes.push(proxy);
  });
  let adjusted = 0;
  const ray = new THREE.Raycaster();
  for (const arm of arms) {
    const geometry = arm.geometry as THREE.TubeGeometry, radial = geometry.parameters?.radialSegments;
    if (!radial) continue;
    const p = geometry.attributes.position, sides = radial + 1, rings = Math.floor(p.count / sides);
    const localToBind = worldToBind.clone().multiply(arm.matrixWorld), bindToLocal = localToBind.clone().invert();
    let changed = false;
    for (let ring = 0; ring < rings; ring++) {
      const center = V(0, 0, 0), point = V(0, 0, 0);
      for (let side = 0; side < radial; side++) center.add(point.fromBufferAttribute(p, ring * sides + side));
      center.divideScalar(radial).applyMatrix4(localToBind);
      const axis = V(HEAD_C.x, center.y, HEAD_C.z), direction = center.clone().sub(axis).normalize();
      ray.set(axis.clone().addScaledVector(direction, 3), direction.clone().negate());
      const hit = ray.intersectObjects(probes, false)[0];
      if (!hit) continue;
      const delta = hit.point.distanceTo(axis) + .018 - center.distanceTo(axis);
      if (delta <= 0) continue;
      for (let side = 0; side < sides; side++) {
        const index = ring * sides + side;
        point.fromBufferAttribute(p, index).applyMatrix4(localToBind).addScaledVector(direction, delta).applyMatrix4(bindToLocal);
        p.setXYZ(index, point.x, point.y, point.z);
      }
      changed = true;
    }
    if (changed) {
      adjusted++; p.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      arm.userData.support = 'headwear';
    }
  }
  probes.forEach(probe => probe.geometry.dispose()); material.dispose(); return adjusted;
}

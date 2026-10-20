import * as THREE from 'three';

/** Some original mannequins omit the two unskinned hand attachment nodes. */
export function attachAnimationHelpers(target: THREE.Object3D, source: THREE.Object3D, clips: THREE.AnimationClip[]) {
  for (const clip of clips) for (const track of clip.tracks) {
    const name = THREE.PropertyBinding.parseTrackName(track.name).nodeName;
    if (!name || target.getObjectByName(name)) continue;
    const node = source.getObjectByName(name);
    const parent = node?.parent && target.getObjectByName(node.parent.name);
    if (!(node instanceof THREE.Bone) || !/^handslot[.]?[lr]$/.test(name) || !parent) {
      throw new Error(`Objetivo de animacion incompatible: ${clip.name} / ${name}.`);
    }
    const helper = node.clone(false);
    parent.add(helper);
  }
}

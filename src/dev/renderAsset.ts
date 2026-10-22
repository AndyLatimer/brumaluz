import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const canvas = document.querySelector('canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfd6d2');
const camera = new THREE.PerspectiveCamera(35, 1, .01, 100);
scene.add(new THREE.HemisphereLight('#fff5e5', '#8e9caa', 2.4));
const key = new THREE.DirectionalLight('#fff0d5', 3);
key.position.set(-4, 7, 5); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .02;
scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#c3cdc6', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
scene.add(floor);
const holder = new THREE.Group();
scene.add(holder);

(window as any).__renderAsset = async (src: string) => {
  holder.clear();
  const gltf = await new GLTFLoader().loadAsync(src);
  holder.add(gltf.scene);
  holder.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true; });
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const fit = Math.max(size.x, size.y, size.z) * 1.7;
  camera.position.set(center.x + fit * .5, center.y + fit * .45, center.z + fit * .8);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return { size: size.toArray(), center: center.toArray() };
};
(window as any).__resize = () => {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
};
(window as any).__resize();
renderer.setAnimationLoop(() => renderer.render(scene, camera));

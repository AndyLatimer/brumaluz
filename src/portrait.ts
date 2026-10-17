import * as THREE from 'three';
import { Character } from './character';
import type { CharData } from './data';

const WIDTH = 208;
const HEIGHT = 344;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e7ca8e');
scene.add(new THREE.HemisphereLight('#fff4dc', '#8a5a40', 1.5));
const keyLight = new THREE.DirectionalLight('#fff0d5', 2.2);
keyLight.position.set(-2, 3, 4);
scene.add(keyLight);

const camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 0.1, 20);
const renderTarget = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
  format: THREE.RGBAFormat,
  type: THREE.UnsignedByteType,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  depthBuffer: true,
  stencilBuffer: false,
});
renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
renderTarget.texture.generateMipmaps = false;

export function createCharacterPortrait(data: CharData, renderer: THREE.WebGLRenderer) {
  const character = new Character({ ...data }, { outfit: true });
  const target = character.headWorld().add(new THREE.Vector3(0, -0.2, 0));
  camera.position.set(target.x, target.y, target.z + 2.6);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  scene.add(character.root);
  scene.updateMatrixWorld(true);
  character.update(0);

  const previousTarget = renderer.getRenderTarget();
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  try {
    renderer.setRenderTarget(renderTarget);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, WIDTH, HEIGHT, pixels);
  } finally {
    renderer.setRenderTarget(previousTarget);
    scene.remove(character.root);
    character.dispose();
  }

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo crear el lienzo de la vista previa del personaje.');
  const image = context.createImageData(WIDTH, HEIGHT);
  const rowSize = WIDTH * 4;
  for (let y = 0; y < HEIGHT; y++) {
    const sourceOffset = (HEIGHT - 1 - y) * rowSize;
    image.data.set(pixels.subarray(sourceOffset, sourceOffset + rowSize), y * rowSize);
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

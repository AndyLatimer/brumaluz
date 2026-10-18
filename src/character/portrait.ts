import * as THREE from 'three';
import { Character } from './character';
import type { CharData } from '../data/data';

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

export interface PortraitOptions {
  /** Muestra al personaje de pies a cabeza en lugar de busto. */
  fullBody?: boolean;
  /** Multiplicador de resolución (más nítido en pantallas grandes). */
  scale?: number;
  /** Relación ancho/alto del retrato (por defecto la del retrato estándar). */
  aspect?: number;
}

export function createCharacterPortrait(data: CharData, renderer: THREE.WebGLRenderer, options: PortraitOptions = {}) {
  const scale = options.scale ?? 1;
  const aspect = options.aspect ?? WIDTH / HEIGHT;
  const W = Math.round(WIDTH * scale);
  const H = Math.round(W / aspect);
  const target_ = scale === 1 && !options.aspect
    ? renderTarget
    : new THREE.WebGLRenderTarget(W, H, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, samples: 4, depthBuffer: true });
  camera.aspect = aspect;
  target_.texture.colorSpace = THREE.SRGBColorSpace;
  // Misma ropa que lleva el personaje dentro del juego (atuendo de aldeano con sus colores).
  const character = new Character({ ...data }, { outfit: false });
  scene.add(character.root);
  scene.updateMatrixWorld(true);
  character.update(0);
  if (options.fullBody) {
    const box = new THREE.Box3().setFromObject(character.root);
    const center = box.getCenter(new THREE.Vector3());
    const height = box.max.y - box.min.y;
    const width = box.max.x - box.min.x;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max((height * 1.12) / 2 / tan, (width * 1.15) / 2 / (tan * aspect));
    camera.position.set(center.x, center.y, box.max.z + distance);
    camera.lookAt(center);
  } else {
    const target = character.headWorld().add(new THREE.Vector3(0, -0.2, 0));
    camera.position.set(target.x, target.y, target.z + 2.6);
    camera.lookAt(target);
  }
  camera.updateProjectionMatrix();

  const previousTarget = renderer.getRenderTarget();
  const pixels = new Uint8Array(W * H * 4);
  try {
    renderer.setRenderTarget(target_);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target_, 0, 0, W, H, pixels);
  } finally {
    renderer.setRenderTarget(previousTarget);
    scene.remove(character.root);
    character.dispose();
    if (target_ !== renderTarget) target_.dispose();
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo crear el lienzo de la vista previa del personaje.');
  const image = context.createImageData(W, H);
  const rowSize = W * 4;
  for (let y = 0; y < H; y++) {
    const sourceOffset = (H - 1 - y) * rowSize;
    image.data.set(pixels.subarray(sourceOffset, sourceOffset + rowSize), y * rowSize);
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

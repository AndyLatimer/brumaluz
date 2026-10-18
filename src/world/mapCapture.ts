import * as THREE from 'three';

/** Mitad del lado (en metros) del área que cubre el mapa: el mar de Brumaluz llega a ~117 m del centro. */
export const MAP_EXTENT = 120;

/**
 * Dibuja la ciudad una sola vez desde arriba (cámara ortográfica, norte = -Z arriba) y devuelve la imagen.
 * Solo se ve `city` (sin cielo, niebla, personajes ni nubes), así que el mapa es exactamente el mundo real.
 */
export function captureTopDown(renderer: THREE.WebGLRenderer, scene: THREE.Scene, city: THREE.Object3D, size: number): HTMLCanvasElement {
  const px = Math.min(size, renderer.capabilities.maxTextureSize);
  const target = new THREE.WebGLRenderTarget(px, px, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: true });
  target.texture.colorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.OrthographicCamera(-MAP_EXTENT, MAP_EXTENT, MAP_EXTENT, -MAP_EXTENT, 1, 400);
  camera.up.set(0, 0, -1);
  camera.position.set(0, 200, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  // Oculta todo salvo la ciudad y las luces; las nubes (muy altas) taparían el mapa.
  const hidden: THREE.Object3D[] = [];
  for (const child of scene.children) {
    if (child !== city && !(child as THREE.Light).isLight && child.visible) { child.visible = false; hidden.push(child); }
  }
  for (const child of city.children) {
    if (child.position.y > 15 && child.visible) { child.visible = false; hidden.push(child); }
  }
  const { fog, background } = scene;
  const previousTarget = renderer.getRenderTarget();
  const clear = new THREE.Color();
  renderer.getClearColor(clear);
  const clearAlpha = renderer.getClearAlpha();
  const shadows = renderer.shadowMap.autoUpdate;
  scene.fog = null;
  scene.background = null;
  renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x000000, 0);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  try {
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    const data = new Uint8Array(px * px * 4);
    renderer.readRenderTargetPixels(target, 0, 0, px, px, data);
    // Las filas de WebGL van de abajo arriba: se voltean al copiarlas.
    const image = new ImageData(px, px);
    const row = px * 4;
    for (let y = 0; y < px; y++) image.data.set(data.subarray((px - 1 - y) * row, (px - y) * row), y * row);
    canvas.getContext('2d')!.putImageData(image, 0, 0);
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(clear, clearAlpha);
    renderer.shadowMap.autoUpdate = shadows;
    scene.fog = fog;
    scene.background = background;
    for (const object of hidden) object.visible = true;
    target.dispose();
  }
  return canvas;
}

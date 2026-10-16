import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// ---------------------------------------------------------------------------
// Iluminación de escena y postprocesado: sol de atardecer con sombras suaves,
// cielo/suelo, luz de contorno, reflejos de un HDRI real (Poly Haven, CC0),
// oclusión ambiental en pantalla, resplandor y tono cinematográfico.
// ---------------------------------------------------------------------------

export const SUN_DIR = new THREE.Vector3(-0.62, 0.7, 0.42).normalize();

export interface Stage {
  composer: EffectComposer;
  sun: THREE.DirectionalLight;
  resize(w: number, h: number): void;
  render(): void;
}

export function setupStage(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, lowEnd: boolean): Stage {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.fog = new THREE.Fog('#e3a985', 22, 120);

  // Sol cálido y bajo, con sombras suaves centradas en el personaje
  const sun = new THREE.DirectionalLight('#ffd2a0', 3.2);
  sun.position.copy(SUN_DIR).multiplyScalar(8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -2.2; sc.right = 2.2; sc.top = 2.6; sc.bottom = -1.2; sc.near = 1; sc.far = 20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  // Luz de cielo y rebote del suelo
  scene.add(new THREE.HemisphereLight('#b8c4ff', '#8a5a40', 0.35));
  // Contraluz rosado para separar la silueta del fondo
  const rim = new THREE.DirectionalLight('#ffb8c8', 1.4);
  rim.position.set(1.5, 2.2, -3);
  scene.add(rim);

  // Relleno suave desde la cámara: las caras se leen aunque haya sombra
  const fill = new THREE.DirectionalLight('#ffe8dc', 0.55);
  camera.add(fill);
  fill.position.set(0.3, 0.4, 1);
  fill.target = camera;
  scene.add(camera);

  // Reflejos e iluminación ambiental de un HDRI de atardecer
  scene.environmentIntensity = 0.4;
  const pmrem = new THREE.PMREMGenerator(renderer);
  import('@pmndrs/assets/hdri/sunset.exr').then((m) => {
    new EXRLoader().load(m.default, (tex) => {
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
    });
  });

  // Postprocesado
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: lowEnd ? 0 : 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  let gtao: GTAOPass | null = null;
  if (!lowEnd) {
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12 });
    gtao.blendIntensity = 0.75;
    composer.addPass(gtao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.6, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  return {
    composer,
    sun,
    resize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      gtao?.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    },
    render() { composer.render(); },
  };
}

/** Marca sombras: todo lo del personaje proyecta y recibe. */
export function castShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.Material;
      if (mat.transparent) return;
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

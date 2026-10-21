import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// ---------------------------------------------------------------------------
// Iluminación de escena y postprocesado: sol con sombras suaves, cielo/suelo, luz de contorno,
// oclusión ambiental en pantalla, resplandor y tono cinematográfico. El color, la fuerza y la dirección
// de las luces (y los reflejos del cielo) los cambia el ciclo de día y noche (src/world/dayNight.ts).
// ---------------------------------------------------------------------------

export interface Stage {
  composer: EffectComposer | null;
  sun: THREE.DirectionalLight;
  /** Hacia dónde está el sol (o la luna): lo mueve el ciclo de día y noche. */
  sunDirection: THREE.Vector3;
  hemi: THREE.HemisphereLight;
  rim: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  /** Centra el sol (y sus sombras) en un punto; `wide` para el modo exploración. */
  follow(p: THREE.Vector3, wide: boolean): void;
  resize(w: number, h: number): void;
  render(): void;
}

export function setupStage(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, lowEnd: boolean, compatible = false): Stage {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = !compatible;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.fog = new THREE.Fog('#e8b090', 45, 170);

  // Sol con sombras suaves centradas en el personaje
  const sunDirection = new THREE.Vector3(-0.62, 0.7, 0.42).normalize();
  const sun = new THREE.DirectionalLight('#ffd2a0', 3.2);
  sun.position.copy(sunDirection).multiplyScalar(8);
  sun.castShadow = !compatible;
  sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -2.2; sc.right = 2.2; sc.top = 2.6; sc.bottom = -1.2; sc.near = 1; sc.far = 20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  // Luz de cielo y rebote del suelo
  const hemi = new THREE.HemisphereLight('#b8c4ff', '#8a5a40', 0.35);
  scene.add(hemi);
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

  // Reflejos e iluminación ambiental: los pone el ciclo de día y noche a partir del cielo.
  scene.environmentIntensity = 0.4;

  // Postprocesado
  const composer = compatible ? null : new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: lowEnd || !renderer.getContext().getContextAttributes()?.antialias ? 0 : Math.min(4, renderer.capabilities.maxSamples),
  }));
  composer?.addPass(new RenderPass(scene, camera));
  let gtao: GTAOPass | null = null;
  if (composer && !lowEnd) {
    // La oclusión ambiental usa la profundidad que ya deja la pasada principal (y reconstruye las normales a partir
    // de ella) en vez de volver a dibujar toda la escena: esa segunda pasada costaba más que todo lo demás junto.
    for (const target of [composer.renderTarget1, composer.renderTarget2]) target.depthTexture = new THREE.DepthTexture(1, 1);
    // (Se crea sin texturas y se le pasan después: en three r170, setGBuffer falla si se le dan al construirlo.)
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.setGBuffer(composer.renderTarget1.depthTexture ?? undefined);
    gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12 });
    gtao.blendIntensity = 0.75;
    const pass = gtao, render = pass.render.bind(pass);
    pass.render = (r, writeBuffer, readBuffer, deltaTime, maskActive) => {
      // La escena se dibuja en el búfer de lectura del compositor, que alterna entre sus dos destinos.
      if (readBuffer.depthTexture && pass.depthTexture !== readBuffer.depthTexture) pass.setGBuffer(readBuffer.depthTexture);
      render(r, writeBuffer, readBuffer, deltaTime, maskActive);
    };
    composer.addPass(gtao);
  }
  if (composer) {
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.6, 0.88));
    composer.addPass(new OutputPass());
  }

  return {
    composer,
    sun,
    sunDirection,
    hemi,
    rim,
    fill,
    follow(p, wide) {
      const e = wide ? 16 : 9;
      if (sc.right !== e) {
        sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e;
        sc.far = 70;
        sc.updateProjectionMatrix();
      }
      sun.target.position.copy(p);
      sun.position.copy(p).addScaledVector(sunDirection, 30);
      // ajuste al texel para que las sombras no tiemblen al moverse
      const texel = (2 * e) / sun.shadow.mapSize.x;
      sun.target.position.x = Math.round(sun.target.position.x / texel) * texel;
      sun.target.position.z = Math.round(sun.target.position.z / texel) * texel;
    },
    resize(w, h) {
      composer?.setPixelRatio(renderer.getPixelRatio());
      composer?.setSize(w, h);
      gtao?.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    },
    render() {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
  };
}

/**
 * Profundidad propia para las sombras de las mallas con huesos: si compartieran la de three.js con las mallas fijas,
 * tendría que cambiar de variante en cada objeto de la pasada de sombras.
 */
const SKINNED_DEPTH = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });

/** Marca sombras: todo lo del personaje proyecta y recibe. */
export function castShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.Material;
      if (mat.transparent) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if ((m as THREE.SkinnedMesh).isSkinnedMesh && !m.customDepthMaterial) m.customDepthMaterial = SKINNED_DEPTH;
    }
  });
}

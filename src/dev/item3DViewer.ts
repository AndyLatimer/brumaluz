export interface Item3DViewerInstance {
  loadModel: (url: string) => Promise<boolean>;
  clear: () => void;
  destroy: () => void;
  resize: () => void;
}

export function createItem3DViewer(container: HTMLElement): Item3DViewerInstance {
  let initPromise: Promise<void> | null = null;
  let scene: any = null;
  let camera: any = null;
  let renderer: any = null;
  let controls: any = null;
  let currentModel: any = null;
  let animId = 0;
  let THREE: any = null;
  let GLTFLoader: any = null;

  async function ensureInit(): Promise<boolean> {
    if (renderer) return true;
    if (initPromise) {
      await initPromise;
      return Boolean(renderer);
    }

    initPromise = (async () => {
      try {
        THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const loaderMod = await import('three/examples/jsm/loaders/GLTFLoader.js');
        GLTFLoader = loaderMod.GLTFLoader;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x151f1c);

        camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(0, 1.2, 3);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;

        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxDistance = 10;
        controls.minDistance = 0.5;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.2;

        const ambientLight = new THREE.AmbientLight(0xfff5e6, 1.2);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffecd0, 2.0);
        dirLight.position.set(2, 4, 3);
        scene.add(dirLight);

        const rimLight = new THREE.DirectionalLight(0x88c0d0, 0.8);
        rimLight.position.set(-2, -1, -2);
        scene.add(rimLight);

        function resize() {
          if (!renderer || !camera) return;
          const width = container.clientWidth || 240;
          const height = container.clientHeight || 240;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }

        function animate() {
          animId = requestAnimationFrame(animate);
          controls?.update();
          if (renderer && scene && camera) {
            renderer.render(scene, camera);
          }
        }
        animate();
        resize();

        window.addEventListener('resize', resize);
      } catch (err) {
        console.warn('[Item3DViewer] Three.js o WebGL no disponible en este entorno:', err);
      }
    })();

    await initPromise;
    return Boolean(renderer);
  }

  async function loadModel(modelPath: string): Promise<boolean> {
    clear();
    if (!modelPath) return false;

    const ok = await ensureInit();
    if (!ok || !GLTFLoader || !scene) return false;

    const url = modelPath.startsWith('/') ? modelPath : `/${modelPath}`;

    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      const root = gltf.scene;

      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      root.position.x = -center.x;
      root.position.y = -box.min.y;
      root.position.z = -center.z;

      const maxDim = Math.max(size.x, size.y, size.z, 0.1);
      const scale = 1.8 / maxDim;
      const pivot = new THREE.Group();
      pivot.scale.setScalar(scale);
      pivot.add(root);

      scene.add(pivot);
      currentModel = pivot;

      camera.position.set(0, 1.5, 3);
      controls.target.set(0, 0.8, 0);
      controls.update();

      return true;
    } catch (err) {
      console.warn(`[Item3DViewer] No se pudo cargar el modelo "${url}":`, err);
      return false;
    }
  }

  function clear() {
    if (currentModel && scene) {
      scene.remove(currentModel);
      currentModel.traverse((obj: any) => {
        if (obj.isMesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: any) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      currentModel = null;
    }
  }

  function destroy() {
    cancelAnimationFrame(animId);
    clear();
    renderer?.dispose();
    controls?.dispose();
    if (renderer?.domElement && renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  }

  function resize() {
    if (!renderer || !camera) return;
    const width = container.clientWidth || 240;
    const height = container.clientHeight || 240;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  return { loadModel, clear, destroy, resize };
}

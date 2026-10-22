import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

// ---------------------------------------------------------------------------
// Carga de recursos incrustados SIN fetch: la página publicada prohíbe las
// conexiones (también a data: y blob:), así que se descodifica el base64 en
// memoria y las imágenes internas del GLB se pasan como data: URL a <img>.
// ---------------------------------------------------------------------------

export function dataUrlToBuffer(url: string): ArrayBuffer {
  const comma = url.indexOf(',');
  const bin = atob(url.slice(comma + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function bufferToDataUrl(buf: ArrayBuffer | Uint8Array, mime: string) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(s)}`;
}

// Portable GLBs repeat their embedded atlases. Decode each identical image once,
// while giving the parser independent textures for sampler and color-space setup.
const inlineImages=new Map<string,Promise<HTMLImageElement>>();
async function inlineImage(src:string){
  let pending=inlineImages.get(src);
  if(!pending){pending=new THREE.ImageLoader().loadAsync(src);inlineImages.set(src,pending);pending.catch(()=>inlineImages.delete(src))}
  return pending;
}

export async function loadGLB(url: string): Promise<GLTF> {
  const loader = new GLTFLoader();
  // texturas internas: <img src="data:..."> en lugar de fetch(blob:)
  loader.register((parser) => {
    const p = parser as unknown as {
      textureLoader: THREE.Loader;
      json: { images: { bufferView?: number; mimeType?: string; uri?: string }[] };
      getDependency(type: string, index: number): Promise<ArrayBuffer>;
      loadImageSource(i: number, l: THREE.Loader): Promise<THREE.Texture>;
    };
    p.textureLoader = new THREE.TextureLoader();
    p.loadImageSource = async (index: number) => {
      const img = p.json.images[index];
      const src = img.uri ?? bufferToDataUrl(await p.getDependency('bufferView', img.bufferView!), img.mimeType ?? 'image/png');
      const tex = new THREE.Texture(await inlineImage(src));
      tex.needsUpdate = true;
      tex.flipY = false;
      tex.userData.mimeType = img.mimeType;
      return tex;
    };
    return { name: 'brumaluz_inline_images' };
  });
  const buf = url.startsWith('data:') ? dataUrlToBuffer(url) : await (await fetch(url)).arrayBuffer();
  return loader.parseAsync(buf, '');
}

export function loadEXR(url: string): THREE.DataTexture {
  const loader = new EXRLoader();
  const buf = url.startsWith('data:') ? dataUrlToBuffer(url) : new ArrayBuffer(0);
  const d = loader.parse(buf) as unknown as { data: Float32Array | Uint16Array; width: number; height: number; format: THREE.PixelFormat; type: THREE.TextureDataType };
  const tex = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

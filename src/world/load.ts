import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

// ---------------------------------------------------------------------------
// Hosted builds fetch cacheable GLBs; standalone builds decode embedded base64.
// Embedded GLB images still use <img> so both modes work without fetch(blob:).
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
// Embedded atlases recur across many GLBs. Share their GPU source while keeping
// each parser's sampler and colour-space settings independent.
const inlineImageSources=new WeakMap<HTMLImageElement,THREE.Source>();
async function inlineImage(src:string){
  let pending=inlineImages.get(src);
  if(!pending){pending=new THREE.ImageLoader().loadAsync(src);inlineImages.set(src,pending);pending.catch(()=>inlineImages.delete(src))}
  return pending;
}

async function inlineBufferImage(buf:ArrayBuffer|Uint8Array,mime:string){
  const bytes=buf instanceof Uint8Array?buf:new Uint8Array(buf);
  let h1=2166136261>>>0,h2=16777619>>>0;
  const step=Math.max(1,bytes.length>>10);
  for(let i=0;i<bytes.length;i+=step){
    h1=Math.imul(h1^bytes[i],16777619)>>>0;
    h2=Math.imul(h2^bytes[bytes.length-1-i],2166136261)>>>0;
  }
  const key=`bin:${mime}:${bytes.length}:${h1.toString(36)}:${h2.toString(36)}`;
  let pending=inlineImages.get(key);
  if(!pending){
    pending=new THREE.ImageLoader().loadAsync(bufferToDataUrl(bytes,mime));
    inlineImages.set(key,pending);
    pending.catch(()=>inlineImages.delete(key));
  }
  return pending;
}

const MAX_CACHED_GLBS=160;
const glbBuffers=new Map<string,Promise<ArrayBuffer>>();
function fetchGlbBuffer(url:string):Promise<ArrayBuffer>{
  let pending=glbBuffers.get(url);
  if(pending){
    glbBuffers.delete(url);
    glbBuffers.set(url,pending);
    return pending;
  }
  pending=fetch(url,{signal:AbortSignal.timeout(60000)}).then(response=>{
    if(!response.ok)throw Error(`No se pudo cargar el modelo (HTTP ${response.status}).`);
    return response.arrayBuffer();
  });
  pending.catch(()=>glbBuffers.delete(url));
  glbBuffers.set(url,pending);
  while(glbBuffers.size>MAX_CACHED_GLBS){
    const oldest=glbBuffers.keys().next().value;
    if(oldest===undefined)break;
    glbBuffers.delete(oldest);
  }
  return pending;
}

let activeModels=0;
const waitingModels:(()=>void)[]=[];
/** Bound downloads and decoding together; full editors must not launch hundreds at once. */
export function loadGLB(url:string):Promise<GLTF>{
  return new Promise((resolve,reject)=>{
    const start=()=>{activeModels++;decodeGLB(url).then(resolve,reject).finally(()=>{activeModels--;waitingModels.shift()?.();});};
    if(activeModels<6)start();else waitingModels.push(start);
  });
}
async function decodeGLB(url: string): Promise<GLTF> {
  const loader = new GLTFLoader();
  // texturas internas: <img src="data:..."> en lugar de fetch(blob:)
  loader.register((parser) => {
    const p = parser as unknown as {
      textureLoader: THREE.Loader;
      json: { extras?:{pack?:string}; images: { bufferView?: number; mimeType?: string; uri?: string }[] };
      getDependency(type: string, index: number): Promise<ArrayBuffer>;
      loadImageSource(i: number, l: THREE.Loader): Promise<THREE.Texture>;
    };
    p.textureLoader = new THREE.TextureLoader();
    p.loadImageSource = async (index: number) => {
      const img = p.json.images[index];
      const image = img.uri
        ? await inlineImage(img.uri)
        : await inlineBufferImage(await p.getDependency('bufferView', img.bufferView!), img.mimeType ?? 'image/png');
      let source=inlineImageSources.get(image);
      if(!source){source=new THREE.Source(image);inlineImageSources.set(image,source);}
      const tex = new THREE.Texture();tex.source=source;
      tex.needsUpdate = true;
      tex.flipY = false;
      if(p.json.extras?.pack==='brumaluz-lagto')tex.anisotropy=4;
      tex.userData.mimeType = img.mimeType;
      return tex;
    };
    return { name: 'brumaluz_inline_images' };
  });
  const buf = url.startsWith('data:') ? dataUrlToBuffer(url) : await fetchGlbBuffer(url);
  const base=url.startsWith('data:')?'':new URL('.',new URL(url,window.location.href)).href;
  return loader.parseAsync(buf, base);
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

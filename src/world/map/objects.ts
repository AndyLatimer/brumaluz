// Objetos del mapa: carga, lotes por celdas, campo de visión, animaciones y paredes que se atenúan.
import * as THREE from 'three';
import type { MapObject, MapLayer } from '../../data/maps';
import type { MaterialVariants } from './materials';

// Motor de mapas compartido por el editor visual y, más adelante, por el juego.
// No depende de la biblioteca de recursos: recibe un proveedor de modelos.

export interface MapAssetProvider {
  template(id: string): Promise<THREE.Object3D>;
  collisionBox(id: string): Promise<THREE.Box3>;
}
// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

export interface ObjectView { id: string; key: string; container: THREE.Group; animations: ((t: number) => void)[]; loaded: Promise<void>; detail?: boolean }
export const missing = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#d0359a', wireframe: true }));
export function applyObjectTransform(container: THREE.Object3D, object: MapObject) {
  container.position.set(...object.position);
  container.rotation.set(object.rotation[0], object.rotation[1], object.rotation[2], 'YXZ');
  container.scale.set(...object.scale);
}
export function objectAnimations(asset: string, root: THREE.Object3D, seed: number) {
  const result: ((t: number) => void)[] = [];
  if (asset === 'city/windmill') {
    const fan = root.getObjectByName('building_windmill_top_fan_blue');
    if (fan) result.push(t => { fan.rotation.z = t * 0.8 + seed; });
  }
  if (/^city\/flag/.test(asset)) {
    const base = root.rotation.y;
    result.push(t => { root.rotation.y = base + Math.sin(t * 1.4 + seed) * 0.05; });
  }
  return result;
}
/** Instancia de un lote: el BatchedMesh, su índice y el objeto original al que sustituye. */
export type BatchedInstance = [THREE.BatchedMesh, number, THREE.Object3D];
/** Opacidad de lo que tapa al personaje. */
export const OCCLUDER_OPACITY = 0.18;
/** Distancia (m) por delante del personaje, vista desde la cámara, a partir de la cual una pared ya no se atenúa. */
export const OCCLUDER_FRONT_MARGIN = 0.1;
/** Lado (m) de las celdas en que se agrupan los objetos para el campo de visión. */
export const VIEW_CHUNK = 24;
/** Objetos cuya diagonal (ya escalada) no llega a esto se consideran detalle y se dejan de dibujar antes. */
export const DETAIL_SIZE = 3;
export const templateSizes = new WeakMap<THREE.Object3D, number>();
export function templateSize(template: THREE.Object3D) {
  let size = templateSizes.get(template);
  if (size === undefined) {
    size = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3()).length();
    templateSizes.set(template, size);
  }
  return size;
}
export class ObjectLayer {
  readonly root = new THREE.Group();
  readonly views = new Map<string, ObjectView>();
  /** Celdas del campo de visión: `b:` edificios y piezas grandes, `d:` detalles pequeños. */
  private readonly chunks = new Map<string, THREE.Group>();
  constructor(private provider: MapAssetProvider, private materials: MaterialVariants) { this.root.name = 'map-objects'; }
  private chunk(x: number, z: number, detail: boolean) {
    const gx = Math.floor(x / VIEW_CHUNK), gz = Math.floor(z / VIEW_CHUNK), key = `${detail ? 'd' : 'b'}:${gx},${gz}`;
    let group = this.chunks.get(key);
    if (!group) {
      group = new THREE.Group();
      group.name = 'map-chunk';
      group.userData.mapChunk = true;
      group.userData.detail = detail;
      group.userData.center = new THREE.Vector2((gx + 0.5) * VIEW_CHUNK, (gz + 0.5) * VIEW_CHUNK);
      this.chunks.set(key, group);
      this.root.add(group);
    }
    return group;
  }
  private place(view: ObjectView) {
    const chunk = this.chunk(view.container.position.x, view.container.position.z, !!view.detail);
    if (view.container.parent !== chunk) chunk.add(view.container);
  }
  /**
   * Campo de visión: solo se dibujan (y animan) las celdas a menos de `distance` m de `focus`;
   * los detalles pequeños, a menos de `detailDistance`. Sin llamarlo, todo queda visible (editor).
   */
  cull(focus: THREE.Vector3, distance: number, detailDistance = distance) {
    const half = VIEW_CHUNK * Math.SQRT1_2;
    for (const chunk of this.chunks.values()) {
      const center = chunk.userData.center as THREE.Vector2;
      const reach = (chunk.userData.detail ? detailDistance : distance) + half;
      const visible = Math.hypot(center.x - focus.x, center.y - focus.z) <= reach;
      if (visible !== chunk.visible) this.setChunkVisible(chunk, visible);
    }
  }
  /** Sincroniza las vistas con el documento; reutiliza las que no cambian de recurso. */
  sync(objects: readonly MapObject[], layers: readonly MapLayer[]) {
    const visible = new Set(layers.filter(layer => layer.visible).map(layer => layer.id));
    const seen = new Set<string>();
    objects.forEach((object, order) => {
      seen.add(object.id);
      const key = `${object.asset}|${object.conform ? 1 : 0}|${object.tint ?? ''}`;
      let view = this.views.get(object.id);
      if (!view || view.key !== key) {
        if (view) this.remove(view);
        view = this.create(object, key, order);
      }
      applyObjectTransform(view.container, object);
      view.container.visible = !object.hidden && visible.has(object.layer);
      this.place(view);
    });
    for (const view of [...this.views.values()]) if (!seen.has(view.id)) this.remove(view);
  }
  private create(object: MapObject, key: string, order: number): ObjectView {
    const container = new THREE.Group();
    container.name = object.id;
    container.userData.mapObjectId = object.id;
    container.userData.mapAsset = object.asset;
    const view: ObjectView = { id: object.id, key, container, animations: [], loaded: Promise.resolve() };
    view.loaded = this.provider.template(object.asset).then(template => {
      if (this.views.get(object.id) !== view) return;
      // Los detalles pequeños pasan a sus propias celdas, que se dejan de dibujar más cerca.
      view.detail = !object.asset.startsWith('city/hex_') && templateSize(template) * Math.max(...object.scale) < DETAIL_SIZE;
      if (container.parent) this.place(view);
      const copy = template.clone(true);
      const ground = object.asset.startsWith('city/hex_');
      copy.traverse(part => {
        if (!(part instanceof THREE.Mesh)) return;
        part.material = Array.isArray(part.material)
          ? part.material.map(material => this.materials.get(material, !!object.conform, object.tint, ground))
          : this.materials.get(part.material, !!object.conform, object.tint, ground);
        part.castShadow = !object.conform && !object.asset.startsWith('city/hex_');
        part.receiveShadow = true;
        // Las piezas deformadas cambian de altura en la GPU: que no desaparezcan en los bordes.
        if (object.conform) part.frustumCulled = false;
      });
      container.add(copy);
      view.animations = objectAnimations(object.asset, copy, order * 1.37);
    }).catch(() => {
      if (this.views.get(object.id) !== view) return;
      const box = missing.clone();
      box.userData.missingAsset = object.asset;
      container.add(box);
    });
    this.views.set(object.id, view);
    return view;
  }
  private remove(view: ObjectView) {
    view.container.removeFromParent();
    this.views.delete(view.id);
  }
  async ready() { await Promise.all([...this.views.values()].map(view => view.loaded)); }
  /**
   * Solo para el juego (el editor mueve objetos): las piezas estáticas se dibujan con un BatchedMesh por material,
   * unas pocas llamadas de dibujo para todo el mapa en vez de una por pieza. Cada celda del campo de visión
   * enciende o apaga sus instancias (`cull`). Los objetos originales quedan ocultos y siguen sirviendo para los
   * rayos de la cámara. Los animados (molinos, banderas) no se agrupan.
   */
  batch() {
    this.root.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    type Group = { material: THREE.Material; castShadow: boolean; receiveShadow: boolean; conform: boolean; items: { mesh: THREE.Mesh; chunk: THREE.Group; container: THREE.Object3D }[] };
    const groups = new Map<string, Group>();
    for (const chunk of this.chunks.values()) {
      for (const container of [...chunk.children]) {
        const view = this.views.get(container.name);
        if (!view || view.container !== container || view.animations.length || !container.visible) continue;
        const meshes: THREE.Mesh[] = [];
        let plain = true;
        container.traverse(part => {
          const mesh = part as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (Array.isArray(mesh.material) || (mesh as THREE.SkinnedMesh).isSkinnedMesh || !mesh.visible) plain = false;
          else meshes.push(mesh);
        });
        if (!plain || !meshes.length) continue;
        for (const mesh of meshes) {
          const geometry = mesh.geometry, material = mesh.material as THREE.Material;
          // Un lote exige los mismos atributos (y lo mismo con o sin índice) en todas sus geometrías.
          const layout = Object.entries(geometry.attributes).map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized ? 1 : 0}`).sort().join(',');
          const key = `${material.uuid}|${layout}|${geometry.index ? 1 : 0}|${mesh.castShadow ? 1 : 0}|${mesh.frustumCulled ? 1 : 0}`;
          let group = groups.get(key);
          if (!group) groups.set(key, group = { material, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, conform: !mesh.frustumCulled, items: [] });
          group.items.push({ mesh, chunk, container });
        }
        container.visible = false;
      }
    }
    // Los lotes usan su propia copia de cada material: si lo compartieran con piezas sueltas (molinos, banderas…),
    // three.js cambiaría su versión «con lote / sin lote» en cada dibujo y revisaría el shader cada fotograma.
    const copies = new Map<THREE.Material, THREE.Material>();
    const batchMaterial = (material: THREE.Material) => {
      let copy = copies.get(material);
      if (!copy) {
        copy = material.clone();
        copy.onBeforeCompile = material.onBeforeCompile;
        copy.customProgramCacheKey = material.customProgramCacheKey;
        copies.set(material, copy);
      }
      return copy;
    };
    // Lo mismo para las sombras: three.js usa un único material de profundidad para todo y lo cambiaría de variante
    // entre lotes, instancias y mallas sueltas en cada objeto.
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    const matrix = new THREE.Matrix4();
    for (const group of groups.values()) {
      const unique = [...new Set(group.items.map(item => item.mesh.geometry))];
      const vertices = unique.reduce((sum, geometry) => sum + geometry.getAttribute('position').count, 0);
      const indices = unique.reduce((sum, geometry) => sum + (geometry.index?.count ?? 0), 0);
      const batched = new THREE.BatchedMesh(group.items.length, vertices, Math.max(indices, 1), batchMaterial(group.material));
      const ids = new Map(unique.map(geometry => [geometry, batched.addGeometry(geometry)]));
      for (const { mesh, chunk, container } of group.items) {
        const instance = batched.addInstance(ids.get(mesh.geometry)!);
        batched.setMatrixAt(instance, matrix.multiplyMatrices(inverse, mesh.matrixWorld));
        ((chunk.userData.instances ??= []) as BatchedInstance[]).push([batched, instance, container]);
        ((container.userData.batched ??= []) as BatchedInstance[]).push([batched, instance, container]);
      }
      batched.castShadow = group.castShadow;
      batched.customDepthMaterial = depth;
      batched.receiveShadow = group.receiveShadow;
      batched.sortObjects = false;
      // Las casillas que se adaptan al terreno se deforman en la GPU: su caja no sirve para recortar.
      batched.perObjectFrustumCulled = !group.conform;
      batched.frustumCulled = !group.conform;
      batched.name = 'map-batch';
      batched.raycast = () => {};
      this.root.add(batched);
    }
    // Lo que no se anima ya no se mueve: sus matrices se calculan una vez y three.js deja de recorrerlo en cada
    // fotograma (con miles de objetos, actualizar matrices costaba más que dibujar).
    // Ojo: un padre que recalcula su matriz local obliga a recalcular a todos sus hijos, así que la raíz y las celdas
    // (que tampoco se mueven) también quedan fijas.
    this.root.updateMatrixWorld(true);
    this.root.matrixAutoUpdate = false;
    for (const chunk of this.chunks.values()) chunk.matrixAutoUpdate = false;
    for (const view of this.views.values()) {
      if (view.animations.length) continue;
      view.container.traverse(part => { part.matrixAutoUpdate = false; part.matrixWorldAutoUpdate = false; });
    }
    // Los originales sustituidos por un lote salen del grafo de escena (three.js los recorrería dos veces por
    // fotograma aunque estén ocultos). Se guardan en su celda para los rayos de la cámara y para atenuarlos.
    for (const chunk of this.chunks.values()) {
      const originals = chunk.children.filter(child => child.userData.batched);
      for (const container of originals) { chunk.remove(container); container.userData.chunk = chunk; }
      chunk.userData.originals = originals;
    }
    // El minimapa necesita ver el mapa entero un momento.
    this.root.userData.revealAll = () => {
      const hidden = [...this.chunks.values()].filter(chunk => !chunk.visible);
      for (const chunk of hidden) this.setChunkVisible(chunk, true);
      return () => { for (const chunk of hidden) this.setChunkVisible(chunk, false); };
    };
  }
  private setChunkVisible(chunk: THREE.Group, visible: boolean) {
    chunk.visible = visible;
    // Los objetos atenuados se dibujan con su copia original, no con el lote.
    for (const [batched, instance, container] of (chunk.userData.instances ?? []) as BatchedInstance[]) {
      batched.setVisibleAt(instance, visible && !this.faded.has(container));
    }
  }
  /** Objetos que tapan al personaje: opacidad actual y materiales originales de cada malla. */
  private readonly faded = new Map<THREE.Object3D, { opacity: number; materials: Map<THREE.Mesh, THREE.Material> }>();
  private readonly ray = new THREE.Raycaster();
  private readonly hits = new Set<THREE.Object3D>();
  private sinceRays = Infinity;
  /**
   * Cámara sin estorbos: los objetos cuyo recurso cumple `fadeable` y cortan las líneas entre `targets` (puntos del
   * personaje) y el ojo de la cámara se vuelven casi transparentes; al dejar de tapar recuperan su aspecto poco a
   * poco. Sin objetivos, todo vuelve a la normalidad.
   */
  fadeOccluders(eye: THREE.Vector3, targets: readonly THREE.Vector3[], dt: number, fadeable: RegExp) {
    const hits = this.hits;
    // Los rayos se lanzan unas 20 veces por segundo; la transición de opacidad sí avanza en cada fotograma.
    this.sinceRays += dt;
    if (!targets.length) hits.clear();
    else if (this.sinceRays >= 0.05) {
      this.sinceRays = 0;
      hits.clear();
      const [first] = targets, length = eye.distanceTo(first);
      const midX = (eye.x + first.x) / 2, midZ = (eye.z + first.z) / 2;
      // Margen lateral: el más alejado de los puntos respecto al primero (anillo alrededor del personaje).
      const reach = Math.max(...targets.map(target => target.distanceTo(first))) + 0.5;
      const segment = new THREE.Line3(first, eye), closest = new THREE.Vector3();
      const candidates: THREE.Object3D[] = [];
      for (const chunk of this.chunks.values()) {
        const center = chunk.userData.center as THREE.Vector2;
        if (Math.hypot(center.x - midX, center.y - midZ) > length / 2 + VIEW_CHUNK) continue;
        for (const child of new Set([...chunk.children, ...(chunk.userData.originals ?? []) as THREE.Object3D[]])) {
          if (!child.userData.mapObjectId || !fadeable.test(child.userData.mapAsset ?? '')) continue;
          const sphere = (child.userData.bounds ??= new THREE.Box3().setFromObject(child, true).getBoundingSphere(new THREE.Sphere())) as THREE.Sphere;
          segment.closestPointToPoint(sphere.center, true, closest);
          if (closest.distanceTo(sphere.center) <= sphere.radius + reach) candidates.push(child);
        }
      }
      const direction = new THREE.Vector3();
      // Solo lo que queda entre la cámara y el personaje: una pared que tiene delante (al acercarse de frente) no se
      // atenúa aunque tape los puntos del anillo que caen al otro lado.
      const forwardX = first.x - eye.x, forwardZ = first.z - eye.z, forwardLength = Math.hypot(forwardX, forwardZ) || 1;
      for (const target of targets) {
        const distance = direction.subVectors(eye, target).length();
        if (distance < 0.3) continue;
        this.ray.set(target, direction.divideScalar(distance));
        this.ray.far = distance;
        for (const hit of this.ray.intersectObjects(candidates, true)) {
          if (((hit.point.x - first.x) * forwardX + (hit.point.z - first.z) * forwardZ) / forwardLength > OCCLUDER_FRONT_MARGIN) continue;
          let node: THREE.Object3D | null = hit.object;
          while (node && !node.userData.mapObjectId) node = node.parent;
          if (node) hits.add(node);
        }
      }
    }
    const blend = 1 - Math.exp(-dt * 10);
    for (const container of hits) if (!this.faded.has(container)) this.startFade(container);
    for (const [container, state] of this.faded) {
      const goal = hits.has(container) ? OCCLUDER_OPACITY : 1;
      state.opacity += (goal - state.opacity) * blend;
      if (goal === 1 && state.opacity > 0.98) { this.endFade(container); continue; }
      for (const mesh of state.materials.keys()) (mesh.material as THREE.Material).opacity = state.opacity;
    }
  }
  private startFade(container: THREE.Object3D) {
    const materials = new Map<THREE.Mesh, THREE.Material>();
    container.traverse(part => {
      const mesh = part as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      materials.set(mesh, mesh.material);
      const faded = mesh.material.clone();
      faded.transparent = true;
      faded.depthWrite = false;
      mesh.material = faded;
    });
    this.faded.set(container, { opacity: 1, materials });
    // Si estaba en un lote, se dibuja suelto mientras dure la atenuación.
    for (const [batched, instance] of (container.userData.batched ?? []) as BatchedInstance[]) batched.setVisibleAt(instance, false);
    if (container.userData.batched) { container.visible = true; (container.userData.chunk as THREE.Group | undefined)?.add(container); }
  }
  private endFade(container: THREE.Object3D) {
    const state = this.faded.get(container)!;
    for (const [mesh, material] of state.materials) { (mesh.material as THREE.Material).dispose(); mesh.material = material; }
    this.faded.delete(container);
    if (!container.userData.batched) return;
    container.visible = false;
    const visible = container.parent?.visible !== false;
    container.removeFromParent();
    for (const [batched, instance] of container.userData.batched as BatchedInstance[]) batched.setVisibleAt(instance, visible);
  }
  update(t: number) {
    this.materials.setTime(t);
    for (const view of this.views.values()) {
      if (!view.animations.length || view.container.parent?.visible === false) continue;
      for (const animate of view.animations) animate(t);
    }
  }
}

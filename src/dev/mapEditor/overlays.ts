import * as THREE from 'three';
import type { MapCollider, MapLayer, MapMarker, MarkerType } from '../../data/maps';
import type { MapCollision, TerrainField } from '../../world/mapRuntime';
import { loadProp } from '../../world/props';

// Ayudas visuales del editor: colisiones resultantes, colisionadores propios y marcadores.

export const MARKER_COLORS: Record<MarkerType, string> = {
  spawn: '#7ee07e', npc: '#e0a84a', interaction: '#6fb7e0', zone: '#c77dd8', light: '#ffb24a', note: '#d8d8d8', portal: '#4fe0d0', arrival: '#3a9cff',
};
export const MARKER_LABELS: Record<MarkerType, string> = {
  spawn: 'Aparición', npc: 'NPC', interaction: 'Interacción', zone: 'Zona', light: 'Luz', note: 'Nota', portal: 'Portal', arrival: 'Llegada',
};

const circle = (points: number[], x: number, y: number, z: number, r: number, segments = 28) => {
  for (let k = 0; k < segments; k++) {
    const a0 = (k / segments) * Math.PI * 2, a1 = ((k + 1) / segments) * Math.PI * 2;
    points.push(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, x + Math.cos(a1) * r, y, z + Math.sin(a1) * r);
  }
};
const rect = (points: number[], x: number, y: number, z: number, hx: number, hz: number, cos: number, sin: number) => {
  // Las formas usan la convención local→mundo: x' = x + lx·cos + lz·sin, z' = z − lx·sin + lz·cos.
  const corner = (lx: number, lz: number) => [x + lx * cos + lz * sin, y, z - lx * sin + lz * cos];
  const c = [corner(-hx, -hz), corner(hx, -hz), corner(hx, hz), corner(-hx, hz)];
  for (let k = 0; k < 4; k++) points.push(...c[k], ...c[(k + 1) % 4]);
  return c;
};

/** Dibuja todas las formas de colisión calculadas para el mapa. */
export class CollisionOverlay {
  readonly root = new THREE.Group();
  constructor() { this.root.name = 'editor-collisions'; this.root.renderOrder = 5; }
  rebuild(collision: MapCollision, field: TerrainField) {
    for (const child of [...this.root.children]) { this.root.remove(child); (child as THREE.LineSegments).geometry.dispose(); }
    const groups: Record<string, number[]> = { auto: [], collider: [], marker: [], platform: [] };
    for (const shape of collision.shapes) {
      const target = groups[shape.source === 'object' ? 'auto' : shape.source];
      const ground = field.heightAt(shape.x, shape.z);
      const bottom = Math.max(ground, shape.bottomY ?? ground) + 0.05;
      const top = shape.topY !== undefined ? Math.min(shape.topY, bottom + 12) : bottom + 2;
      if (shape.hx === undefined) {
        circle(target, shape.x, bottom, shape.z, shape.r);
        circle(target, shape.x, top, shape.z, shape.r);
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2;
          target.push(shape.x + Math.cos(a) * shape.r, bottom, shape.z + Math.sin(a) * shape.r, shape.x + Math.cos(a) * shape.r, top, shape.z + Math.sin(a) * shape.r);
        }
      } else {
        const low = rect(target, shape.x, bottom, shape.z, shape.hx, shape.hz!, shape.cos!, shape.sin!);
        rect(target, shape.x, top, shape.z, shape.hx, shape.hz!, shape.cos!, shape.sin!);
        for (const corner of low) target.push(corner[0], bottom, corner[2], corner[0], top, corner[2]);
      }
    }
    for (const platform of collision.platforms) rect(groups.platform, platform.x, platform.y + 0.03, platform.z, platform.hx, platform.hz, platform.cos, platform.sin);
    const colors: Record<string, string> = { auto: '#ff9a3c', collider: '#4fa8ff', marker: '#c77dd8', platform: '#6ee06e' };
    for (const [key, points] of Object.entries(groups)) {
      if (!points.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: colors[key], depthTest: false, transparent: true, opacity: 0.85 }));
      lines.renderOrder = 10;
      lines.raycast = () => {};
      this.root.add(lines);
    }
  }
}

const colliderMaterial = new THREE.MeshBasicMaterial({ color: '#4fa8ff', transparent: true, opacity: 0.18, depthWrite: false });
const colliderWalkMaterial = new THREE.MeshBasicMaterial({ color: '#6ee06e', transparent: true, opacity: 0.22, depthWrite: false });
const boxGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 24).translate(0, 0.5, 0);
const boxEdges = new THREE.EdgesGeometry(boxGeometry), cylinderEdges = new THREE.EdgesGeometry(cylinderGeometry, 30);

/** Colisionadores propios del mapa como volúmenes seleccionables. */
export class ColliderLayer {
  readonly root = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  constructor() { this.root.name = 'editor-colliders'; }
  sync(colliders: readonly MapCollider[], layers: readonly MapLayer[]) {
    const visible = new Set(layers.filter(layer => layer.visible).map(layer => layer.id));
    const seen = new Set<string>();
    for (const collider of colliders) {
      seen.add(collider.id);
      let mesh = this.meshes.get(collider.id);
      const geometry = collider.shape === 'box' ? boxGeometry : cylinderGeometry;
      if (!mesh) {
        mesh = new THREE.Mesh(geometry, colliderMaterial);
        mesh.add(new THREE.LineSegments(collider.shape === 'box' ? boxEdges : cylinderEdges, new THREE.LineBasicMaterial({ color: '#8cc8ff' })));
        mesh.userData.entity = `c:${collider.id}`;
        mesh.renderOrder = 4;
        this.meshes.set(collider.id, mesh);
        this.root.add(mesh);
      }
      if (mesh.geometry !== geometry) {
        mesh.geometry = geometry;
        (mesh.children[0] as THREE.LineSegments).geometry = collider.shape === 'box' ? boxEdges : cylinderEdges;
      }
      mesh.material = collider.walkable ? colliderWalkMaterial : colliderMaterial;
      mesh.position.set(...collider.position);
      mesh.rotation.set(0, collider.rotationY, 0);
      mesh.scale.set(collider.size[0], collider.size[1], collider.shape === 'box' ? collider.size[2] : collider.size[0]);
      mesh.visible = visible.has(collider.layer);
    }
    for (const [id, mesh] of this.meshes) if (!seen.has(id)) { mesh.removeFromParent(); this.meshes.delete(id); }
  }
  get(id: string) { return this.meshes.get(id); }
}

interface MarkerView { group: THREE.Group; label: HTMLDivElement; key: string; light?: THREE.PointLight; npc?: Promise<void>; npcKey?: string }
const pinGeometry = new THREE.ConeGeometry(0.28, 0.9, 12).rotateX(Math.PI).translate(0, 0.45, 0);
const headGeometry = new THREE.SphereGeometry(0.32, 16, 10).translate(0, 1.15, 0);
const arrowGeometry = new THREE.ConeGeometry(0.22, 0.6, 8).rotateX(Math.PI / 2).translate(0, 0.05, 0.9);
const MAX_LIGHTS = 16;

/** Marcadores con chincheta, anillo de radio, etiqueta HTML y, si procede, NPC o luz. */
export class MarkerLayer {
  readonly root = new THREE.Group();
  private views = new Map<string, MarkerView>();
  constructor(private labels: HTMLElement, private npcModel: (npcId: string) => Promise<THREE.Object3D | null>) { this.root.name = 'editor-markers'; }
  sync(markers: readonly MapMarker[], layers: readonly MapLayer[], field: TerrainField) {
    const visible = new Set(layers.filter(layer => layer.visible).map(layer => layer.id));
    const seen = new Set<string>();
    let lights = 0;
    for (const marker of markers) {
      seen.add(marker.id);
      const color = marker.color ?? MARKER_COLORS[marker.type];
      const key = `${marker.type}|${color}|${marker.radius}|${marker.text === 'coin-bag' || marker.text === 'fairy-dust' ? marker.text : ''}`;
      let view = this.views.get(marker.id);
      if (view && view.key !== key) { this.drop(view); this.views.delete(marker.id); view = undefined; }
      if (!view) {
        view = this.create(marker, color, key);
        this.views.set(marker.id, view);
      }
      const ground = marker.type === 'light' ? marker.position[1] : Math.max(marker.position[1], field.heightAt(marker.position[0], marker.position[2]));
      view.group.position.set(marker.position[0], ground, marker.position[2]);
      view.group.rotation.y = marker.rotationY;
      view.group.visible = visible.has(marker.layer);
      view.label.textContent = marker.type === 'portal' ? `${marker.name} → ${marker.target?.map ?? 'sin destino'}` : marker.name;
      if (view.light) {
        view.light.visible = view.group.visible && lights < MAX_LIGHTS;
        if (view.light.visible) lights++;
      }
      if (marker.type === 'npc' && (marker.npcId ?? '') !== view.npcKey) this.loadNpc(view, marker.npcId ?? '');
    }
    for (const [id, view] of this.views) if (!seen.has(id)) { this.drop(view); this.views.delete(id); }
  }
  private create(marker: MapMarker, color: string, key: string): MarkerView {
    const group = new THREE.Group();
    group.userData.entity = `m:${marker.id}`;
    const material = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
    const pin = new THREE.Mesh(pinGeometry, material), head = new THREE.Mesh(headGeometry, material);
    for (const mesh of [pin, head]) { mesh.renderOrder = 8; mesh.userData.entity = `m:${marker.id}`; }
    const offset = new THREE.Group();
    offset.name = 'pin';
    offset.add(pin, head);
    group.add(offset);
    if (marker.type === 'interaction' && (marker.text === 'coin-bag' || marker.text === 'fairy-dust')) {
      offset.position.y = .6;
      void loadProp(marker.text).then(model => {
        if (!group.parent) return;
        model.name = 'collectible-model';
        model.traverse(part => { part.userData.entity = `m:${marker.id}`; });
        group.add(model);
      }).catch(() => undefined);
    }
    if (marker.type === 'spawn' || marker.type === 'npc' || marker.type === 'arrival') {
      const arrow = new THREE.Mesh(arrowGeometry, material);
      arrow.renderOrder = 8; arrow.userData.entity = `m:${marker.id}`;
      // En apariciones y llegadas, la orientación es la de la cámara: el jugador mira al lado contrario.
      if (marker.type !== 'npc') arrow.rotation.y = Math.PI;
      group.add(arrow);
    }
    if (marker.type === 'portal') {
      const radius = Math.max(0.4, marker.radius);
      const veil = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 3.2, 40, 1, true).translate(0, 1.6, 0),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      veil.name = 'portal-veil'; veil.renderOrder = 7; veil.userData.entity = `m:${marker.id}`;
      group.add(veil);
    }
    const points: number[] = [];
    circle(points, 0, 0.06, 0, Math.max(0.2, marker.radius), 48);
    const ringGeometry = new THREE.BufferGeometry();
    ringGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const ring = new THREE.LineSegments(ringGeometry, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.7 }));
    ring.renderOrder = 8; ring.raycast = () => {};
    group.add(ring);
    let light: THREE.PointLight | undefined;
    if (marker.type === 'light') {
      light = new THREE.PointLight(color, 6, Math.max(1, marker.radius) * 1.6, 1.6);
      group.add(light);
      offset.position.y = -1.15;
    }
    const label = document.createElement('div');
    label.className = 'marker-label';
    label.style.borderColor = color;
    this.labels.append(label);
    this.root.add(group);
    return { group, label, key, light };
  }
  private loadNpc(view: MarkerView, npcId: string) {
    view.npcKey = npcId;
    view.group.getObjectByName('npc-model')?.removeFromParent();
    if (!npcId) return;
    view.npc = this.npcModel(npcId).then(model => {
      if (!model || view.npcKey !== npcId) return;
      model.name = 'npc-model';
      model.traverse(part => { part.userData.entity = view.group.userData.entity; });
      view.group.add(model);
      const pin = view.group.getObjectByName('pin');
      if (pin) pin.position.y = 2.1;
    }).catch(() => undefined);
  }
  private drop(view: MarkerView) {
    const veil = view.group.getObjectByName('portal-veil') as THREE.Mesh | undefined;
    veil?.geometry.dispose(); (veil?.material as THREE.Material | undefined)?.dispose();
    view.group.removeFromParent(); view.label.remove(); view.light?.dispose();
  }
  /** Coloca las etiquetas HTML sobre cada marcador. */
  updateLabels(camera: THREE.Camera, width: number, height: number, show: boolean) {
    const point = new THREE.Vector3();
    for (const view of this.views.values()) {
      const visible = show && view.group.visible && this.root.visible;
      if (visible) {
        view.group.getWorldPosition(point);
        point.y += 2.1 + (view.group.getObjectByName('npc-model') ? 2 : 0);
        const distance = point.distanceTo(camera.position);
        point.project(camera);
        const onScreen = point.z < 1 && Math.abs(point.x) < 1.05 && Math.abs(point.y) < 1.05 && distance < 140;
        view.label.style.display = onScreen ? '' : 'none';
        if (onScreen) view.label.style.transform = `translate(${(point.x * 0.5 + 0.5) * width}px, ${(-point.y * 0.5 + 0.5) * height}px) translate(-50%, -100%)`;
      } else view.label.style.display = 'none';
    }
  }
  group(id: string) { return this.views.get(id)?.group; }
}

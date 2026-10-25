// Tipos de una ciudad o mapa del juego: lo que el resto del juego usa de ella.
import type * as THREE from 'three';
import type { LocationId } from '../../data/data';

export interface Placement { model: string; x: number; z: number; ry: number; s?: number; y?: number }
export interface Collider { x: number; z: number; r: number; hx?: number; hz?: number; cos?: number; sin?: number; topY?: number }
export interface Platform { x: number; z: number; y: number; hx: number; hz: number; cos: number; sin: number }
export interface CityVendorSpot {
  id: string;
  role: 'merchant' | 'innkeeper' | 'healer' | 'smith' | 'miller' | 'lumber';
  position: THREE.Vector3;
}
export const COMBAT_SITE = { x: 0, z: -62.35 };
export interface Interactable {
  id: string;
  position: THREE.Vector3;
  /** Distancia máxima (en unidades de mundo) a la que se puede interactuar. */
  radius: number;
  /** Texto del aviso (español; se traduce con i18n). */
  label: string;
  /** Texto que se muestra al interactuar (interacciones creadas en el editor de mapas). */
  text?: string;
}
export interface SeatSpot { id: string; position: THREE.Vector3; yaw: number; seatHeight: number }
export interface NpcSite {
  id: string;
  position: THREE.Vector3;
  /** Rotación Y del NPC (hacia dónde mira). */
  yaw: number;
}
/** Salida a otro mapa de Pompelín (marcador «Portal» del editor de mapas). */
export interface CityPortal {
  id: string;
  name: string;
  position: THREE.Vector3;
  radius: number;
  target?: { map: string; arrival?: string };
  trigger: 'walk' | 'interact';
}
/** Punto de llegada desde otro mapa; `yaw` es el de la cámara, como `spawnYaw`. */
export interface CityArrival { position: THREE.Vector3; yaw: number }
export interface City {
  root: THREE.Group;
  locationId: LocationId;
  /** Puntos donde colocar NPCs con nombre. */
  npcSites: NpcSite[];
  /** Elementos con los que se puede interactuar con la tecla E. */
  interactables: Interactable[];
  /** Asientos de muebles colocados en el mapa y bancos de la ciudad. */
  seats: SeatSpot[];
  /** Puntos despejados delante de los servicios, listos para alojar NPCs. */
  vendorSpots: CityVendorSpot[];
  /** Corrige un movimiento para no atravesar edificios ni agua. */
  collide(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3;
  groundY(x: number, z: number): number;
  lineOfSight?(from: THREE.Vector3, to: THREE.Vector3): boolean;
  /** Superficie elevada de objetos bajos, si el punto cae sobre una plataforma. */
  platformY(x: number, z: number): number | null;
  spawn: THREE.Vector3;
  /** Ángulo desde el que la cámara del creador mira al personaje (el castillo queda de fondo). */
  spawnYaw: number;
  portals: CityPortal[];
  arrivals: Record<string, CityArrival>;
  mapBounds?: { x: number; z: number; extent: number };
  /** Datos de construcción para convertir Brumaluz en un mapa editable. */
  layout?: CityLayout;
  /** Montones de polvos de hada: marcadores del editor de mapas o lista por defecto. */
  fairyDustSpots?: readonly { id: string; x: number; z: number; yaw: number }[];
  update(t: number, playerPosition?: THREE.Vector3): void;
  /** Luciérnagas y polen flotando (los interiores no las llevan). */
  fireflies?: boolean;
  /** Cielo visible exclusivamente dentro de los huecos de las ventanas abiertas. */
  skyWindows?: readonly THREE.Mesh[];
  /** Interiores: vuelve casi transparentes las paredes que tapan los puntos `targets` vistos desde `eye` (sin puntos, todo se restaura). */
  fadeOccluders?(eye: THREE.Vector3, targets: readonly THREE.Vector3[], dt: number): void;
  /** Agua en un punto: superficie y si es profunda (se nada) o somera (se vadea); null en seco. */
  waterAt?(x: number, z: number): { surface: number; deep: boolean } | null;
  /** Cascadas (pie de cada una, ancho y altura de la caída), para sus salpicaduras. */
  waterFalls?: readonly { x: number; y: number; z: number; width: number; drop: number }[];
}
export interface CityLayout {
  placements: readonly Readonly<{ model: string; x: number; y?: number; z: number; ry: number; s?: number }>[];
  heightAt(x: number, z: number): number;
  grassTufts: readonly Readonly<{ x: number; z: number }>[];
  benches: readonly Readonly<{ x: number; y: number; z: number; ry: number }>[];
  details: readonly Readonly<{ prop: string; x: number; y: number; z: number; yaw: number; scale: number }>[];
}

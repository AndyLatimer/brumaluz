import type { MapMarker } from './maps';

// Pompelín es el mundo (el continente); Brumaluz, su capital. Cada mapa del juego es un lugar
// (`location` del personaje) y los portales del editor de mapas los conectan.

export const WORLD_NAME = 'Pompelín';
export const CAPITAL_MAP = 'brumaluz';
export const OVERWORLD_MAP = 'pompelin';

const S = 4, SQ3 = Math.sqrt(3);
const hex = (q: number, r: number) => [(2 * q + r) * S, r * SQ3 * S] as const;
const round = (value: number) => Math.round(value * 1000) / 1000;

/** Puertas de la muralla de Brumaluz (la del noroeste la ocupa el castillo). */
export const BRUMALUZ_GATES = [
  { id: 'este', name: 'Puerta este', dir: [1, 0] },
  { id: 'noreste', name: 'Puerta noreste', dir: [1, -1] },
  { id: 'oeste', name: 'Puerta oeste', dir: [-1, 0] },
  { id: 'sureste', name: 'Puerta sureste', dir: [0, 1] },
  { id: 'suroeste', name: 'Puerta suroeste', dir: [-1, 1] },
] as const;
export type BrumaluzGate = typeof BRUMALUZ_GATES[number]['id'];

/**
 * Portales de salida a Pompelín (justo fuera de cada puerta) y llegadas (justo dentro, mirando a la plaza)
 * de la Brumaluz procedural. La plantilla editable de Brumaluz usa los mismos.
 */
export function brumaluzGateMarkers(heightAt: (x: number, z: number) => number = () => 0): MapMarker[] {
  const markers: MapMarker[] = [];
  for (const gate of BRUMALUZ_GATES) {
    const [px, pz] = hex(gate.dir[0] * 10.6, gate.dir[1] * 10.6);
    const [ax, az] = hex(gate.dir[0] * 8.3, gate.dir[1] * 8.3);
    markers.push({
      id: `salida_${gate.id}`, type: 'portal', name: `${gate.name}: salida a ${WORLD_NAME}`, layer: 'logica',
      position: [round(px), round(heightAt(px, pz)), round(pz)], rotationY: 0, radius: 3.2,
      target: { map: OVERWORLD_MAP, arrival: `desde_brumaluz_${gate.id}` }, trigger: 'walk',
    }, {
      id: `llegada_${gate.id}`, type: 'arrival', name: `Llegada: ${gate.name.toLowerCase()}`, layer: 'logica',
      position: [round(ax), round(heightAt(ax, az)), round(az)], rotationY: round(Math.atan2(ax, az)), radius: 1,
    });
  }
  return markers;
}

import type { MapDocument, TerrainData } from '../../data/maps';

// Deshacer/rehacer con instantáneas. Lo que no es terreno se guarda como JSON compacto;
// el terreno solo se copia cuando ha cambiado desde la instantánea anterior.

export type SceneState = Pick<MapDocument, 'name' | 'description' | 'settings' | 'layers' | 'objects' | 'colliders' | 'markers'>;
interface Entry { label: string; scene: string; terrain: TerrainData; bytes: number }

const MAX_ENTRIES = 200;
const MAX_BYTES = 320 * 1024 * 1024;

export const copyTerrain = (data: TerrainData): TerrainData => ({
  columns: data.columns, rows: data.rows, cell: data.cell, origin: [...data.origin],
  heights: data.heights.slice(), paint: data.paint.slice(), grass: data.grass.slice(),
});
const terrainBytes = (data: TerrainData) => data.heights.byteLength + data.paint.byteLength + data.grass.byteLength;

export class History {
  private entries: Entry[] = [];
  private index = -1;
  onChange = () => {};

  reset(scene: SceneState, terrain: TerrainData) {
    this.entries = [];
    this.index = -1;
    this.push('Abrir', scene, terrain, true);
  }
  /** Registra el estado actual tras una acción. */
  push(label: string, scene: SceneState, terrain: TerrainData, terrainChanged: boolean) {
    const json = JSON.stringify(scene);
    const previous = this.entries[this.index];
    if (previous && !terrainChanged && previous.scene === json) return false;
    this.entries.length = this.index + 1;
    const snapshot = terrainChanged || !previous ? copyTerrain(terrain) : previous.terrain;
    this.entries.push({ label, scene: json, terrain: snapshot, bytes: json.length * 2 + (snapshot === previous?.terrain ? 0 : terrainBytes(snapshot)) });
    this.index = this.entries.length - 1;
    let total = this.entries.reduce((sum, entry) => sum + entry.bytes, 0);
    while (this.entries.length > 2 && (this.entries.length > MAX_ENTRIES || total > MAX_BYTES)) {
      const removed = this.entries.shift()!;
      total -= removed.bytes;
      // La siguiente entrada pudo compartir el terreno de la eliminada: ahora lo «posee».
      if (this.entries[0].terrain === removed.terrain) { this.entries[0].bytes += terrainBytes(removed.terrain); total += terrainBytes(removed.terrain); }
      this.index--;
    }
    this.onChange();
    return true;
  }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.entries.length - 1; }
  get undoLabel() { return this.entries[this.index]?.label ?? ''; }
  get redoLabel() { return this.entries[this.index + 1]?.label ?? ''; }
  undo() { return this.canUndo ? this.restore(--this.index) : null; }
  redo() { return this.canRedo ? this.restore(++this.index) : null; }
  private restore(index: number) {
    const entry = this.entries[index];
    this.onChange();
    return { scene: JSON.parse(entry.scene) as SceneState, terrain: copyTerrain(entry.terrain), terrainRef: entry.terrain };
  }
  /** Indica si el terreno de la entrada actual es el mismo objeto que `ref` (para no recargar en vano). */
  currentTerrain() { return this.entries[this.index]?.terrain; }
}

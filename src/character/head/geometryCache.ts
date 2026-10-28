import type { BufferGeometry } from 'three';

/** Bounded CPU templates. Consumers own their clones; templates never enter a scene. */
export class GeometryTemplates {
  private entries = new Map<string, { geometry: BufferGeometry[]; bytes: number }>();
  private bytes = 0;
  constructor(private budget = 24 * 1024 * 1024, private limit = 32) {}
  get(key: string) {
    const entry = this.entries.get(key); if (!entry) return undefined;
    this.entries.delete(key); this.entries.set(key, entry);
    return entry.geometry.map(geometry => geometry.clone());
  }
  set(key: string, geometries: BufferGeometry[]) {
    if (this.entries.has(key)) return;
    const bytes = geometries.reduce((sum, g) => sum + Object.values(g.attributes).reduce((n, attribute) => n + attribute.array.byteLength, 0) + (g.index?.array.byteLength ?? 0), 0);
    if (bytes > this.budget || this.limit < 1) return;
    const geometry = geometries.map(source => source.clone());
    this.entries.set(key, { geometry, bytes }); this.bytes += bytes;
    while (this.bytes > this.budget || this.entries.size > this.limit) {
      const first = this.entries.keys().next().value!;
      const entry = this.entries.get(first)!; this.entries.delete(first); this.bytes -= entry.bytes;
      entry.geometry.forEach(value => value.dispose());
    }
  }
}

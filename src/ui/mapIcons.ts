const PATHS = {
  workshop: ['M3 21V11l9-7 9 7v10Z', 'M7 15h10M9 12v7m6-7v7'],
  expedition: ['M5 22V3m0 1h13l-3 5 3 5H5', 'M9 18h10m-3-3 3 3-3 3'],
  player: ['M12 2 21 21 12 16 3 21Z'],
  npc: ['M12 2.8a9.2 9.2 0 1 1 0 18.4a9.2 9.2 0 0 1 0-18.4Z', 'M12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7Z'],
  quest: ['M6 3h12l-1 15-5 4-5-4Z', 'M12 7v6m0 3v1'],
  waypoint: ['M5 22V3', 'M5 4c5-4 9 4 15 0v10c-6 4-10-4-15 0Z'],
  exit: ['M3 21V8h4V3h10v5h4v13M8 21V11a4 4 0 0 1 8 0v10M1 21h22', 'M10 16h9m-3-3 3 3-3 3'],
  interior: ['m2 11 10-8 10 8M5 9v12h14V9M9 21v-8h6v8', 'M10 6h4M12 16v2'],
};
export type MapIconKind = keyof typeof PATHS;
export interface MapPoint {
  id: string;
  name: string;
  x: number;
  z: number;
  kind?: MapIconKind;
  closed?: boolean;
}
const cachedPaths = new Map<MapIconKind, Path2D[]>();

export function mapIcon(kind: MapIconKind): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[kind].map(path => `<path d="${path}"/>`).join('')}</svg>`;
}

export function drawMapIcon(ctx: CanvasRenderingContext2D, kind: MapIconKind, x: number, y: number, size: number, color: string, rotation = 0) {
  let paths = cachedPaths.get(kind);
  if (!paths) { paths = PATHS[kind].map(path => new Path2D(path)); cachedPaths.set(kind, paths); }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(size / 24, size / 24);
  ctx.translate(-12, -12);
  ctx.lineWidth = kind === 'npc' ? 1.2 : 1.6;
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.strokeStyle = kind === 'npc' ? color : color;
  ctx.fillStyle = kind === 'player' || kind === 'waypoint' ? color : kind === 'npc' ? '#262c31' : '#262c31';
  for (const [index, path] of paths.entries()) {
    if (kind === 'npc' && index > 0) {
      ctx.fillStyle = color;
      ctx.lineWidth = 0.7;
    }
    ctx.fill(path);
    ctx.stroke(path);
    if (kind === 'npc' && index > 0) ctx.lineWidth = 1.2;
  }
  ctx.restore();
}

type MapLayer = { path: string; fill?: string; stroke?: string; width?: number };
const INK = '#493321', GOLD = '#d4ad63', LIGHT = '#fff1c9', STEEL = '#a8beb9', WOOD = '#916343';
// Shared painted layers keep the SVG map and Canvas minimap in the same family.
// Broad silhouettes and a restrained warm outline remain clear at 16–24 px.
const ART = {
  workshop: [
    { path: 'M4 21V10l8-6 8 6v11Z', fill: '#ead5a3' },
    { path: 'm2 11 10-8 10 8-2 2-8-6-8 6Z', fill: WOOD },
    { path: 'M6 14h12l-3 3H9Zm3 3h6l2 4H7Z', fill: STEEL },
    { path: 'm9 9 4-2 3 4-2 1-1-2-3 2Z', fill: GOLD },
    { path: 'M5 10 12 5l6 5', stroke: LIGHT, width: .65 },
  ],
  expedition: [
    { path: 'M5 22V3', stroke: WOOD, width: 2.4 },
    { path: 'M6 4h13l-3 5 3 5H6Z', fill: '$accent' },
    { path: 'm10 6 4 3-4 3Z', fill: LIGHT, width: .6 },
    { path: 'M5 3h2M3 22h5', stroke: GOLD, width: 1.5 },
    { path: 'M11 18h9m-3-3 3 3-3 3', stroke: GOLD, width: 1.5 },
  ],
  player: [
    { path: 'M12 2 21 21 12 16 3 21Z', fill: '$accent', width: 1.5 },
    { path: 'M12 5v9L6 18Z', fill: LIGHT, stroke: 'none' },
    { path: 'm12 14 5 4-5-2-5 2Z', fill: GOLD, stroke: 'none' },
  ],
  npc: [
    { path: 'M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Z', fill: GOLD },
    { path: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z', fill: '#36574c', width: .7 },
    { path: 'M6.5 18c.5-4 2.2-6 5.5-6s5 2 5.5 6Z', fill: '$accent', width: .8 },
    { path: 'M12 6a3.3 3.3 0 1 1 0 6.6A3.3 3.3 0 0 1 12 6Z', fill: '#eed2a5', width: .8 },
    { path: 'M6 6.5 8 5', stroke: LIGHT, width: .8 },
  ],
  quest: [
    { path: 'M6 3h12l-1 15-5 4-5-4Z', fill: GOLD },
    { path: 'M8 5h8l-.8 11.5-3.2 3-3.2-3Z', fill: '$accent', width: .65 },
    { path: 'M12 7v6', stroke: LIGHT, width: 2 },
    { path: 'M12 16v.2', stroke: LIGHT, width: 2.3 },
    { path: 'M8 5h8', stroke: LIGHT, width: .65 },
  ],
  waypoint: [
    { path: 'M5 22V3', stroke: WOOD, width: 2.4 },
    { path: 'M6 4c5-3 9 3 14 0v10c-5 3-9-3-14 0Z', fill: '$accent' },
    { path: 'm13 6 3 4-3 3-3-4Z', fill: LIGHT, width: .7 },
    { path: 'M6 5v8M3 22h5', stroke: GOLD, width: 1.1 },
  ],
  exit: [
    { path: 'M3 21V7h4V3h10v4h4v14Z', fill: STEEL },
    { path: 'M7 3h10v3H7Z', fill: '$accent', width: .7 },
    { path: 'M8 21V12a4 4 0 0 1 8 0v9Z', fill: '#4b392a' },
    { path: 'M4 8h3m10 0h3M8 4h8', stroke: LIGHT, width: .8 },
    { path: 'M10 16h10m-3-3 3 3-3 3', stroke: GOLD, width: 2 },
    { path: 'M2 22h20', stroke: WOOD, width: 1.6 },
  ],
  interior: [
    { path: 'M5 10v11h14V10Z', fill: '#ead5a3' },
    { path: 'm2 11 10-8 10 8-2 2-8-6-8 6Z', fill: WOOD },
    { path: 'M9 21v-8h6v8Z', fill: '$accent' },
    { path: 'M10 14h4m-2 2v2', stroke: LIGHT, width: .9 },
    { path: 'M6 12v7m12-7v7', stroke: GOLD, width: 1 },
  ],
  ore: [
    {path:'m2 19 3-10 7-5 7 5 3 10-10 3Z',fill:'#85877b'},
    {path:'m5 13 4-6 5 3-1 7-6 2Zm10-3 4 2 2 6-6 2Z',fill:'$accent'},
    {path:'m9 8 1 6-3 3m9-4 2 3',stroke:LIGHT,width:.9},
  ],
  gem: [
    {path:'m2 20 4-6 12 0 4 6-10 2Z',fill:'#7f8375'},
    {path:'m6 6 5-4 5 4-1 10-5 5-4-6Zm11 5 3-2 2 4-2 6-4 1Z',fill:'$accent'},
    {path:'m11 3-1 10v7m5-13-5 6-4 2',stroke:LIGHT,width:1},
  ],
  wood: [
    {path:'m3 10 11-6 7 4v7l-11 6-7-4Z',fill:'$accent'},
    {path:'m3 10 7 4v7l-7-4Z',fill:'#d4b682'},
    {path:'m5 12 3 3v3l-3-2Zm5 2 11-6m-8 9 6-4',stroke:INK,width:.9},
  ],
  herb: [
    {path:'m8 22 7-18',stroke:'#718958',width:2},
    {path:'M10 18Q0 18 3 9q8 0 7 9Zm3-5Q12 2 21 4q2 8-8 9Z',fill:'#8da664'},
    {path:'m15 6-2-3 3-2 3 2 3 2-2 3-4 1Z',fill:'$accent'},
    {path:'m6 12 4 5m7-10-4 6',stroke:LIGHT,width:.8},
  ],
  fiber: [
    {path:'m7 22 5-18 6 18',stroke:'#789158',width:1.6},
    {path:'M8 17q-7-1-6-7 7-1 6 7Zm8 0q-1-7 6-8 1 7-6 8Z',fill:'#8fa66a'},
    {path:'M5 11C0 9 2 4 5 5 5 0 11 1 11 5c5-2 6 5 2 6Zm10 5c-4-5 0-8 3-6 2-3 6 0 4 3 2 4-5 6-7 3Z',fill:'$accent'},
  ],
  fruit: [
    {path:'M12 9Q10 0 21 3q0 6-9 6Z',fill:'#8aa05b'},
    {path:'M12 10C3 3 0 17 7 21l5-1 4 1c9-5 5-18-4-11Z',fill:'$accent'},
    {path:'M7 12q-3 1-2 5',stroke:LIGHT,width:1.3},
  ],
  mushroom: [
    {path:'m9 11-1 10q4 2 8 0l-2-10Z',fill:'#e2d1ae'},
    {path:'M2 12Q3 2 12 2q8 0 10 10-11 5-20 0Z',fill:'$accent'},
    {path:'m7 7 2-1m6 0 1 1m-5 4h2',stroke:LIGHT,width:2},
  ],
  grain: [
    {path:'m7 22 7-20m-3 20 9-16',stroke:'#a88a50',width:1.6},
    {path:'M13 8Q4 4 10 2q5 0 3 6Zm-2 6Q3 9 8 7q5 0 3 7Zm-1 5q-8-5-3-7 5 0 3 7Zm4-10q0-8 5-5 1 4-5 5Zm-2 6q1-8 5-5 2 4-5 5Zm5 3q0-8 5-5 1 4-5 5Z',fill:'$accent'},
  ],
  resources:[
    {path:'M3 19q9-5 18 0l-3 3H6Z',fill:'#b18b58'},
    {path:'m4 13 4-7 5 5-2 8-6 1Z',fill:'#9bbcc0'},
    {path:'M13 18Q9 5 21 3q3 11-8 15Z',fill:'#8ca56b'},
    {path:'m9 9-2 8m11-10-5 11',stroke:LIGHT,width:.8},
  ],
} satisfies Record<string, MapLayer[]>;
export type MapIconKind = keyof typeof ART;
export interface MapPoint {
  id: string;
  name: string;
  x: number;
  z: number;
  kind?: MapIconKind;
  closed?: boolean;
  resource?: boolean;
  resourceCount?: number;
}
const ACCENT: Record<MapIconKind, string> = { workshop: GOLD, expedition: '#ac7165', player: '#e3c779', npc: '#8caa78', quest: '#7d6846', waypoint: '#698f88', exit: GOLD, interior: '#6c8b79',ore:'#c19064',gem:'#9bc8d4',wood:'#a78254',herb:'#dbc485',fiber:'#eee0bd',fruit:'#cc7b62',mushroom:'#bc8664',grain:'#dfc17a',resources:'#9cb47c' };
const cachedPaths = new Map<MapIconKind, Path2D[]>();
const paint = (color: string | undefined, accent: string) => color === '$accent' ? accent : color;

export function mapIcon(kind: MapIconKind): string {
  // Paint is also inline CSS: legacy NPC marker selectors targeted the first
  // two paths, and must not recolour individual layers of the illustration.
  return `<svg class="map-icon" data-icon-map="${kind}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g stroke-linejoin="round" stroke-linecap="round">${(ART[kind] as MapLayer[]).map(layer => {
    const fill = paint(layer.fill, ACCENT[kind]) ?? 'none', stroke = layer.stroke ?? (layer.fill ? INK : 'none'), width = layer.width ?? 1.1;
    return `<path d="${layer.path}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" style="fill:${fill};stroke:${stroke};stroke-width:${width}"/>`;
  }).join('')}</g></svg>`;
}

export function drawMapIcon(ctx: CanvasRenderingContext2D, kind: MapIconKind, x: number, y: number, size: number, color: string, rotation = 0) {
  const layers: MapLayer[] = ART[kind];
  let paths = cachedPaths.get(kind);
  if (!paths) { paths = layers.map(layer => new Path2D(layer.path)); cachedPaths.set(kind, paths); }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(size / 24, size / 24);
  ctx.translate(-12, -12);
  ctx.lineJoin = ctx.lineCap = 'round';
  layers.forEach((layer, index) => {
    const fill = paint(layer.fill, color||ACCENT[kind]), stroke = layer.stroke ?? (layer.fill ? INK : 'none');
    ctx.lineWidth = layer.width ?? 1.1;
    if (fill && fill !== 'none') { ctx.fillStyle = fill; ctx.fill(paths[index]); }
    if (stroke !== 'none') { ctx.strokeStyle = stroke; ctx.stroke(paths[index]); }
  });
  ctx.restore();
}

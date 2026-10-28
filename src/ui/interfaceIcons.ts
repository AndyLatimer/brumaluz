// Small illustrated emblems for social windows, journals and workshop utilities.
// Layered materials stay legible at 16–32 px and require no shared SVG IDs or filters.
const INK = '#49321f', GOLD = '#c69b52', LIGHT = '#f5dca0', PAPER = '#f7e8bf';
const STEEL = '#a9bdbb', GREEN = '#789568', BLUE = '#799eab', RED = '#ad6553';
const path = (d: string, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (d: string, color = LIGHT, width = 1.1) => path(d, 'none', `stroke="${color}" stroke-width="${width}"`);
const circle = (x: number, y: number, r: number, fill: string, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const shield = (fill: string) => path('m16 2 12 5-1 11c-1 6-5 10-11 13C10 28 6 24 5 18L4 7Z', GOLD)
  + path('m16 5 9 4-1 9c-.8 4.5-4 7.8-8 10-4-2.2-7.2-5.5-8-10L7 9Z', fill)
  + line('m8 8 8-3 8 3', LIGHT);
const head = (x: number, y: number, r = 3) => circle(x, y, r, '#e0b583') + line(`M${x-r+1} ${y-1}q1-2 3-1`, '#fce3b5', .8);
const envelope = () => path('M3 10h26v19H3Z', '#b8874b') + path('M4 11h24v16H4Z', PAPER)
  + path('m4 11 12 10 12-10Z', '#ead29b') + line('m4 27 8-8m16 8-8-8', '#b39159')
  + circle(16, 21, 2.4, RED) + line('m15 20 2 2', '#edc389', .7);
const star = () => path('m16 2 4.2 8.9 9.8 1.3-7.2 7 1.9 10-8.7-4.7-8.7 4.7 1.9-10-7.2-7 9.8-1.3Z', GOLD)
  + path('m16 6 3.1 7 7.5.7-5.5 5.3 1.5 7.2-6.6-3.6-6.6 3.6 1.5-7.2L5.4 13.7l7.5-.7Z', LIGHT)
  + path('m16 6 0 16.6-6.6 3.6 1.5-7.2L5.4 13.7l7.5-.7Z', '#e1b96c', 'stroke="none"')
  + line('m16 8-2.6 6-6.1.6', '#fff5d4');
const compass = () => circle(16, 17, 13, GOLD) + circle(16, 17, 10, PAPER)
  + path('m16 3 2-2h-4Z', GOLD) + line('M16 8v3m0 12v3M7 17h3m12 0h3', '#8d6c38')
  + path('m19 10-1 9-7 5 3-9Z', RED) + path('m19 10-5 5 4 4Z', STEEL) + circle(16, 17, 1.4, LIGHT)
  + line('M7 9a12 12 0 0 1 17 0', LIGHT);
const book = () => path('M3 7q7-3 13 1 6-4 13-1v22q-7-3-13 0-6-3-13 0Z', '#77755a')
  + path('M5 5q6-2 11 2 5-4 11-2v21q-6-2-11 1-5-3-11-1Z', PAPER)
  + line('M16 7v20', '#99703d') + line('M8 11h5m-5 4h5m-5 4h4m8-8h4m-4 4h4m-4 4h3', '#b7975e', .9)
  + path('M21 24v7l2-1.5 2 1.5v-7Z', RED);
const heart = () => path('M16 28S3 21 3 12a7 7 0 0 1 13-3 7 7 0 0 1 13 3c0 9-13 16-13 16Z', RED)
  + path('M16 25S6 19 6 12a4 4 0 0 1 7-3c1 2 2 2 3 2Z', '#d58a6f', 'stroke="none"')
  + line('M7 11q1-4 4-3', '#f3c8a3', 1.5);

const ART = {
  friend: shield(GREEN) + head(16, 12) + path('M10 23v-2a6 6 0 0 1 12 0v2Z', PAPER) + line('M13 19v3m6-3v3', '#b89a63'),
  group: shield(BLUE) + head(11, 12, 2.6) + head(21, 12, 2.6) + path('M7 23v-3a5 5 0 0 1 9-3 5 5 0 0 1 9 3v3Z', PAPER) + line('M16 18v5', '#a58959'),
  incoming: envelope() + path('M13 2h6v8h4l-7 7-7-7h4Z', GREEN) + line('M15 4v7h-2', '#dbe8b6'),
  outgoing: envelope() + path('m16 1 7 7h-4v8h-6V8H9Z', BLUE) + line('m13 6 3-3 3 3', '#e4f0d3'),
  whisper: path('M3 4h26v21H13l-7 6v-6H3Z', GOLD) + path('M5 6h22v17H12l-4 4v-4H5Z', PAPER)
    + line('M9 11h14M9 15h14m-14 4h8', '#9c7a42') + circle(25, 7, 2, GREEN),
  accept: shield(GREEN) + path('m9 16 4 4 10-11 3 3-13 14-7-7Z', LIGHT) + line('m10 16 3 3 10-10', '#fff6d7', .8),
  remove: circle(16, 16, 13, GOLD) + circle(16, 16, 10.5, '#7f4f3f')
    + path('m10 8 6 6 6-6 2 2-6 6 6 6-2 2-6-6-6 6-2-2 6-6-6-6Z', PAPER) + line('m10 10 6 6', '#fff8e4'),
  character: circle(16, 16, 14, GOLD) + circle(16, 16, 11.5, '#687e75') + head(16, 11, 4)
    + path('M6 25v-2a10 10 0 0 1 20 0v2l-4 3H10Z', STEEL) + path('m11 19 5 4 5-4v8H11Z', GOLD) + line('M8 23h3m10 0h3', LIGHT),
  location: compass(),
  notice: path('M11 4h10v3h-2v3l6 5-2 14H9L7 15l6-5V7h-2Z', GOLD)
    + path('M10 15h12l-2 11h-8Z', '#f5dda1') + path('M16 13v14m-7-10h14', 'none')
    + path('M16 17q5 4 0 8-5-4 0-8Z', '#e29d48') + line('M12 5h7m-7 23h8', '#fff0bc'),
  quest: path('M7 3h19v24H7q-5 0-5-4V7q0-4 5-4Z', PAPER) + path('M7 3v20H2', '#d3b16c')
    + path('M13 7h8v23l-4-3-4 3Z', GREEN) + line('M8 6v13m2-10h2m-2 5h2', '#ae874b')
    + circle(17, 13, 2.3, LIGHT),
  reward: path('M4 12h24v16H4Z', '#946d3f') + path('M3 10h26v6H3Z', GOLD)
    + path('M7 16h18v11H7Z', '#c7a16b') + path('M13 10h6v18h-6Z', GREEN)
    + path('M16 10C5 10 7 0 12 4l4 6c11 0 9-10 4-6Z', LIGHT) + line('M5 12h7m8 0h7M8 18v6', '#f8dda1'),
  warning: path('M16 3 30 28H2Z', GOLD) + path('m16 7 10 18H6Z', '#ad6553')
    + path('M14 12h4l-.7 7h-2.6Z', PAPER) + circle(16, 22, 1.5, PAPER) + line('m5 25 11-20 11 20', '#f4d794', .8),
  guildBadge: path('m8 3 8 4 8-4-3 13H11Z', GREEN) + line('m10 4 3 8m9-8-3 8', '#b6c193')
    + circle(16, 21, 10, GOLD) + circle(16, 21, 7.3, LIGHT) + path('M16 26s-6-3.8-6-7a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 3.2-6 7-6 7Z', GREEN)
    + line('m10 14 3-1', '#fff8d9', 1.3) + path('m23 27 1 1-2 1', '#966d36'),
  experience: star(),
  energy: path('M16 30V10', 'none', `stroke="${INK}" stroke-width="3"`) + path('M16 21C2 24 2 11 5 8c10-1 13 5 11 13Z', GREEN)
    + path('M16 15C14 4 22 1 29 3c1 9-4 14-13 12Z', '#a8bc7b') + line('M7 11 16 24m9-18-9 12', '#e4e7b0')
    + path('m8 1 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z', GOLD),
  recipes: book(),
  jobs: path('M5 5h22v25H5Z', '#92704a') + path('M7 7h18v20H7Z', PAPER)
    + path('M11 2h10v7H11Z', GOLD) + line('M10 13h11m-11 4h5m-5 4h4', '#ad8e5a')
    + path('m17 21 3 3 7-8 3 3-10 11-6-6Z', GREEN),
  clock: circle(16, 17, 13, GOLD) + circle(16, 17, 10, PAPER) + path('M12 1h8v3h-8Z', GOLD)
    + line('M16 9v8l5 3', INK, 1.7) + line('M7 17h2m14 0h2m-9 7v2', '#a48145') + circle(16, 17, 1.2, GOLD)
    + line('M7 8a12 12 0 0 1 17 0', LIGHT),
  lock: path('M9 14V9a7 7 0 0 1 14 0v5h-4V9a3 3 0 0 0-6 0v5Z', STEEL)
    + path('M6 13h20v17H6Z', GOLD) + path('M9 16h14v11H9Z', '#d8b77c')
    + circle(16, 20, 2.4, INK) + path('m15 21-1 4h4l-1-4Z', INK) + line('M8 15v11m2-11h12', LIGHT),
  star: star(),
  search: path('m20 18 10 10-3 3-10-10Z', '#987044') + circle(13, 13, 11, GOLD) + circle(13, 13, 8, '#9ec1c3')
    + path('M7 8q2-4 8-3l-8 14q-4-4 0-11Z', '#dbe8d7', 'stroke="none"') + line('m21 23 6 6', LIGHT),
  bag: path('m10 2 6 2 6-2-2 8c7 6 9 13 5 18-3 4-15 4-18 0-4-5-2-12 5-18Z', '#b58c55')
    + path('M10 11q6 2 12 0', 'none', `stroke="${INK}" stroke-width="3"`) + line('M10 11q6 2 12 0', LIGHT)
    + path('M13 17h6v9h-6Z', GOLD) + path('M11 19h10v5H11Z', GOLD) + line('M9 16q-4 7 0 10', '#eed2a0')
    + circle(25, 7, 3.3, LIGHT) + line('M25 5v4', '#aa7e36'),
  arrow: path('M3 13h16V6l11 10-11 10v-7H3Z', GOLD) + path('M5 15h16V11l5 5-5 5v-4H5Z', LIGHT),
  crown: path('m3 7 7 6 6-10 6 10 7-6-3 20H6Z', GOLD) + path('m6 12 5 5 5-8 5 8 5-5-2 12H8Z', '#e5bc6a')
    + path('M6 24h20v5H6Z', LIGHT) + path('m16 16 3 4-3 4-3-4Z', GREEN) + line('M8 26h16', '#ae7f35'),
  heart: heart(),
  invite: head(11, 8, 4) + path('M2 28v-7a9 9 0 0 1 18 0v7Z', STEEL) + path('m6 16 5 5 5-5v12H6Z', GOLD)
    + circle(24, 21, 7, GREEN) + line('M24 17v8m-4-4h8', PAPER, 2),
  dust: path('m17 3 3 8 8 3-8 3-3 9-3-9-8-3 8-3Z', '#a7c9ca')
    + path('m17 8 2 5 5 1-5 2-2 5-1-5-5-2 5-1Z', '#e6f3df')
    + path('m7 20 2 4 5 1-5 2-2 3-1-3-4-2 4-1Z', GOLD) + circle(26, 26, 2, LIGHT) + circle(6, 5, 1.5, '#d0dcb9'),
} as const;

export type InterfaceIconId = keyof typeof ART;
export const INTERFACE_ICON_IDS = Object.keys(ART) as InterfaceIconId[];

export function interfaceIcon(id: InterfaceIconId) {
  return `<svg class="interface-icon" data-interface-icon="${id}" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="fill:none;stroke:${INK};stroke-width:1.15;stroke-linecap:round;stroke-linejoin:round">${ART[id]}</svg>`;
}

export function interfaceIconElement(id: InterfaceIconId, className = '') {
  const wrapper = document.createElement('span');
  wrapper.innerHTML = interfaceIcon(id);
  const svg = wrapper.firstElementChild as SVGSVGElement;
  if (className) svg.classList.add(className);
  return svg;
}

// Minimapa: vista cenital estática (el norte siempre arriba, no gira) centrada en el jugador.
// La imagen del mundo se captura una vez desde arriba (src/world/mapCapture.ts); aquí solo se recorta, se hace zoom
// y se pintan encima el personaje (con la flecha de hacia dónde mira), los NPC y la brújula.
import { MAP_EXTENT } from '../world/mapCapture';
import { getLanguage, t } from './i18n';
import { drawMapIcon, type MapPoint } from './mapIcons';

export interface MinimapMarker extends MapPoint {
  party?: boolean;
  leader?: boolean;
}

export interface MinimapHooks {
  /** Posición del jugador y hacia dónde mira (`facing` = rotación Y de su modelo). */
  player: () => { x: number; z: number; facing: number };
  markers: () => MinimapMarker[];
  /** Nombre del lugar actual (en español; se traduce). */
  zone: () => string;
  openMap: () => void;
}

/** Metros que abarca el diámetro del minimapa en cada nivel de zoom. */
const VIEWS = [36, 60, 100, 2 * MAP_EXTENT];
const SEA = '#2a6684';
const STORE_KEY = 'brumaluz-minimap';

let hooks: MinimapHooks | null = null;
let image: HTMLCanvasElement | null = null;
let mapBounds = { x: 0, z: 0, extent: MAP_EXTENT };
let zoom = 1;
let off = false;
let lastZone = '';
let lastCoords = '';
let playerCount: number | null = null;
let drawn: { marker: MinimapMarker; sx: number; sy: number; inside: boolean }[] = [];
let mouse: { x: number; y: number } | null = null;

const root = () => document.getElementById('minimap')!;
const canvas = () => root().querySelector<HTMLCanvasElement>('.minimap-canvas')!;

function save() { localStorage.setItem(STORE_KEY, JSON.stringify({ zoom, off })); }

export function setMinimapImage(map: HTMLCanvasElement | null, bounds = { x: 0, z: 0, extent: MAP_EXTENT }) {
  image = map; mapBounds = bounds; VIEWS[3] = bounds.extent * 2;
}

export function currentMapImage() {
  return { image, bounds: mapBounds };
}

export function setMapPlayerCount(count: number | null) {
  playerCount = count;
  const badge = root().querySelector<HTMLElement>('.minimap-players')!;
  const label = count === null
    ? t('Conexión al mundo interrumpida. Reintentando…')
    : t(count === 1 ? '{count} jugador en este mapa' : '{count} jugadores en este mapa', { count });
  const text = count === null ? '—' : String(count);
  const value = badge.querySelector('.minimap-player-count')!;
  if (value.textContent !== text) value.textContent = text;
  if (badge.getAttribute('aria-label') !== label) {
    badge.setAttribute('aria-label', label);
    if (badge.dataset.tip !== undefined) badge.dataset.tip = label;
    else badge.title = label;
  }
  badge.classList.toggle('error', count === null);
}

function applyState() {
  root().classList.toggle('off', off);
  root().querySelector<HTMLButtonElement>('.minimap-zoom-in')!.disabled = zoom <= 0;
  root().querySelector<HTMLButtonElement>('.minimap-zoom-out')!.disabled = zoom >= VIEWS.length - 1;
}

function setZoom(next: number) {
  zoom = Math.min(Math.max(next, 0), VIEWS.length - 1);
  save();
  applyState();
}

export function toggleMinimap() {
  off = !off;
  save();
  applyState();
}

function setDirectionLetters() {
  const letters = getLanguage() === 'en' ? { n: 'N', e: 'E', s: 'S', w: 'W' } : { n: 'N', e: 'E', s: 'S', w: 'O' };
  for (const [key, value] of Object.entries(letters)) root().querySelector<HTMLElement>(`.minimap-dir.${key}`)!.textContent = value;
  canvas().setAttribute('aria-label', t('Abrir mapa de la zona'));
  lastZone = '';
  setMapPlayerCount(playerCount);
}

export function initMinimap(h: MinimapHooks) {
  hooks = h;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as { zoom?: number; off?: boolean };
    if (typeof saved.zoom === 'number') zoom = Math.min(Math.max(Math.round(saved.zoom), 0), VIEWS.length - 1);
    off = saved.off === true;
  } catch { /* se usan los valores por defecto */ }

  root().querySelector<HTMLButtonElement>('.minimap-zoom-in')!.onclick = () => setZoom(zoom - 1);
  root().querySelector<HTMLButtonElement>('.minimap-zoom-out')!.onclick = () => setZoom(zoom + 1);
  const map = canvas();
  map.setAttribute('role', 'button');
  map.tabIndex = 0;
  map.setAttribute('aria-label', t('Abrir mapa de la zona'));
  map.addEventListener('click', () => h.openMap());
  map.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); h.openMap(); }
  });
  map.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
  map.addEventListener('pointermove', (e) => {
    const rect = map.getBoundingClientRect();
    mouse = { x: ((e.clientX - rect.left) / rect.width) * map.width, y: ((e.clientY - rect.top) / rect.height) * map.height };
  });
  map.addEventListener('pointerleave', () => { mouse = null; root().querySelector<HTMLElement>('.minimap-tip')!.hidden = true; });
  setDirectionLetters();
  document.addEventListener('brumaluz-language-change', setDirectionLetters);
  applyState();
}

/** Pinta un fotograma. Se llama en cada frame mientras se juega. */
export function updateMinimap() {
  if (!hooks || off) return;
  const el = canvas();
  const css = el.clientWidth;
  if (!css) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.round(css * dpr);
  if (el.width !== size) { el.width = size; el.height = size; }
  const ctx = el.getContext('2d')!;
  const u = size / 176; // unidad de dibujo: 1 = un píxel CSS de un minimapa de 176 px
  const half = size / 2;
  const player = hooks.player();
  const view = VIEWS[zoom];
  const pxPerMeter = size / view;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = SEA;
  ctx.fillRect(0, 0, size, size);
  if (image) {
    const scale = image.width / (2 * mapBounds.extent);
    const side = view * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, (player.x - mapBounds.x + mapBounds.extent) * scale - side / 2, (player.z - mapBounds.z + mapBounds.extent) * scale - side / 2, side, side, 0, 0, size, size);
  }

  // Cono de visión: hacia dónde mira el personaje.
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
  const heading = Math.atan2(fz, fx);
  const cone = ctx.createRadialGradient(half, half, 0, half, half, half * 0.62);
  cone.addColorStop(0, 'rgba(255,236,170,.55)');
  cone.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(half, half);
  ctx.arc(half, half, half * 0.62, heading - 0.62, heading + 0.62);
  ctx.closePath();
  ctx.fill();

  // Los accesos solo aparecen dentro de la vista; las guías lejanas usan flechas.
  drawn = [];
  for (const marker of hooks.markers()) {
    const dx = (marker.x - player.x) * pxPerMeter, dz = (marker.z - player.z) * pxPerMeter;
    const distance = Math.hypot(dx, dz);
    const inside = distance < half - 13 * u;
    const kind = marker.kind ?? 'npc';
    const color = kind === 'waypoint' ? '#a5edff' : kind === 'quest' ? '#ffe19b' : kind === 'exit' ? '#d1c7ff' : kind === 'interior' ? '#ffc69d' : '#8be07a';
    if (!inside && (kind === 'exit' || kind === 'interior')) continue;
    if (!marker.party && inside) {
      const sx = half + dx, sy = half + dz;
      drawn.push({ marker, sx, sy, inside });
      ctx.save();
      ctx.globalAlpha = marker.closed ? .45 : 1;
      drawMapIcon(ctx, kind, sx, sy, (kind === 'npc' ? 16 : 22) * u, color);
      ctx.restore();
      continue;
    }
    if (inside) {
      const sx = half + dx, sy = half + dz;
      drawn.push({ marker, sx, sy, inside });
      ctx.beginPath();
      ctx.arc(sx, sy, 5.2 * u, 0, Math.PI * 2);
      ctx.fillStyle = marker.party ? (marker.leader ? '#ffd470' : '#79d7fa') : color;
      ctx.fill();
      ctx.lineWidth = 1.8 * u;
      ctx.strokeStyle = marker.party ? '#17394d' : '#1d3a18';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx - 1.3 * u, sy - 1.5 * u, 1.5 * u, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fill();
    } else {
      const angle = Math.atan2(dz, dx);
      const sx = half + Math.cos(angle) * (half - 8 * u), sy = half + Math.sin(angle) * (half - 8 * u);
      drawn.push({ marker, sx, sy, inside });
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(5 * u, 0);
      ctx.lineTo(-4 * u, 4.2 * u);
      ctx.lineTo(-4 * u, -4.2 * u);
      ctx.closePath();
      ctx.fillStyle = marker.party ? (marker.leader ? '#ffd470' : '#79d7fa') : color;
      ctx.fill();
      ctx.lineWidth = 1.4 * u;
      ctx.strokeStyle = '#1d3a18';
      ctx.stroke();
      ctx.restore();
    }
  }

  // Jugador: flecha dorada orientada según hacia dónde mira.
  drawMapIcon(ctx, 'player', half, half, 23 * u, '#fff2a6', Math.PI - player.facing);

  // Viñeta interior para integrar el mapa con el marco.
  const vignette = ctx.createRadialGradient(half, half, half * 0.72, half, half, half);
  vignette.addColorStop(0, 'rgba(20,10,4,0)');
  vignette.addColorStop(1, 'rgba(20,10,4,.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  const zone = t(hooks.zone());
  const coords = `${Math.round(player.x)}, ${Math.round(-player.z)}`; // este, norte (el norte es -Z)
  if (zone !== lastZone) { root().querySelector('.minimap-zone')!.textContent = zone; lastZone = zone; }
  if (coords !== lastCoords) { root().querySelector('.minimap-coords')!.textContent = coords; lastCoords = coords; }

  // Nombre del NPC bajo el ratón.
  const tip = root().querySelector<HTMLElement>('.minimap-tip')!;
  const hover = mouse && drawn.find((d) => Math.hypot(d.sx - mouse!.x, d.sy - mouse!.y) < 9 * u);
  if (hover) {
    tip.textContent = hover.marker.name;
    tip.hidden = false;
    tip.style.left = `${(hover.sx / size) * css}px`;
    tip.style.top = `${(hover.sy / size) * css}px`;
  } else tip.hidden = true;
}

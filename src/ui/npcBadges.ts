import { NPC_BADGE_ID, NPC_TYPES, type NpcType } from '../data/npcBadges';

// Combat keeps its new hostile emblem; other NPCs keep their original symbols.
const HOSTILE_ART = `<svg><defs>
  <linearGradient id="mask" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c28fbe"/><stop offset=".5" stop-color="#80517e"/><stop offset="1" stop-color="#432c4e"/></linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f8e4af"/><stop offset="1" stop-color="#a4773d"/></linearGradient>
  <linearGradient id="horn" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff2d4"/><stop offset="1" stop-color="#ba9c71"/></linearGradient>
  </defs><g stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 19C10 17 7 9 8 4c8 2 12 6 14 10m20 5C54 17 57 9 56 4c-8 2-12 6-14 10" fill="url(#horn)" stroke="#463121" stroke-width="2"/>
  <path d="M32 9C17 9 9 20 10 34c1 13 10 22 22 27 12-5 21-14 22-27C55 20 47 9 32 9Z" fill="url(#rim)" stroke="#392434" stroke-width="2.2"/>
  <path d="M32 14c-12 0-18 9-17 20 1 10 7 18 17 22 10-4 16-12 17-22 1-11-5-20-17-20Z" fill="url(#mask)" stroke="#442d45" stroke-width="1.5"/>
  <path d="m20 28 10 5-8 3-4-6m26-2-10 5 8 3 4-6" fill="#ffdf86" stroke="#3e253b" stroke-width="1.7"/>
  <path d="M23 43q9-4 18 0l-5 6h-8Z" fill="#2b2130" stroke="#3c2434" stroke-width="1.4"/>
  <path d="m25 41 3 7 3-7m8 0-3 7-3-7" fill="url(#horn)" stroke="#684d49" stroke-width=".8"/>
  <path d="M21 21q5-5 11-5m-2 2 2 6 2-6" fill="none" stroke="#e8c8db" stroke-width="1.2" opacity=".8"/>
  <path d="m31 36 1-4 1 4" fill="none" stroke="#cba0b9" stroke-width="1.2"/>
  </g></svg>`;
let badgeSequence = 0;

/** Inline instances never share gradient IDs, even in simultaneous target frames. */
export function npcBadgeIcon(type: NpcType, scope = 'npc-badge') {
  if (type !== 'hostile') return `<svg viewBox="0 0 24 24" aria-hidden="true">${NPC_TYPES[type].drawing}</svg>`;
  const prefix = `${scope.replace(/[^a-zA-Z0-9_-]/g, '-')}-${++badgeSequence}`;
  return HOSTILE_ART
    .replace(/<svg\b[^>]*>/, `<svg class="npc-badge-icon" data-icon-npc="${type}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`)
    .replace(/<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);
}

const files = import.meta.glob<string>('../assets/npc-badges/*.{png,webp,svg}', { eager: true, query: '?url', import: 'default' });
export const npcBadgeIcons = Object.entries(files).map(([path, url]) => {
  const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
  if (!NPC_BADGE_ID.test(id)) throw new Error(`Icono de NPC no válido: ${path}. Usa nombres como herrero.png.`);
  return { id, url };
}).sort((a, b) => a.id.localeCompare(b.id));
if (new Set(npcBadgeIcons.map(icon => icon.id)).size !== npcBadgeIcons.length) throw new Error('Hay iconos de NPC con el mismo identificador y distintas extensiones.');

export function renderNpcBadge(element: HTMLElement, type: NpcType, title: string, iconId = '', icons: readonly { id: string; url: string }[] = npcBadgeIcons) {
  const icon = icons.find(icon => icon.id === iconId);
  const defaultIcon = () => { element.innerHTML = npcBadgeIcon(type); };
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', title);
  element.dataset.badgeIcon = iconId;
  element.dataset.badgeStatus = icon ? 'ready' : iconId ? 'pending' : 'default';
  element.title = iconId && !icon ? `${title} · Icono pendiente de añadir: ${iconId}` : title;
  if (!icon) { defaultIcon(); return; }
  const image = document.createElement('img');
  image.alt = ''; image.src = icon.url;
  image.addEventListener('error', () => {
    if (image.parentElement !== element) return;
    console.error(`No se pudo cargar el icono de NPC ${iconId}.`);
    element.dataset.badgeStatus = 'error';
    element.title = `No se pudo cargar el icono ${iconId}.`;
    defaultIcon();
  }, { once: true });
  element.replaceChildren(image);
}

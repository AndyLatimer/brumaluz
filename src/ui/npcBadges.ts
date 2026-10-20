import { NPC_BADGE_ID, NPC_TYPES, type NpcType } from '../data/npcBadges';

const files = import.meta.glob<string>('../assets/npc-badges/*.{png,webp,svg}', { eager: true, query: '?url', import: 'default' });
export const npcBadgeIcons = Object.entries(files).map(([path, url]) => {
  const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
  if (!NPC_BADGE_ID.test(id)) throw new Error(`Icono de NPC no válido: ${path}. Usa nombres como herrero.png.`);
  return { id, url };
}).sort((a, b) => a.id.localeCompare(b.id));
if (new Set(npcBadgeIcons.map(icon => icon.id)).size !== npcBadgeIcons.length) throw new Error('Hay iconos de NPC con el mismo identificador y distintas extensiones.');

export function renderNpcBadge(element: HTMLElement, type: NpcType, title: string, iconId = '', icons: readonly { id: string; url: string }[] = npcBadgeIcons) {
  const icon = icons.find(icon => icon.id === iconId);
  const defaultIcon = () => { element.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${NPC_TYPES[type].drawing}</svg>`; };
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

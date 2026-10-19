import type { CombatEncounter } from '../services/multiplayer';
import { itemIcon, itemLabel } from '../data/items';
import { setItemTooltip } from './itemTooltip';
import { t } from './i18n';

export function renderLoot(container: HTMLElement, corpse: CombatEncounter, take: (slot: number | null) => Promise<boolean>) {
  container.replaceChildren();
  const root = document.createElement('section');
  root.className = 'loot-window';
  const list = document.createElement('div');
  list.className = 'loot-list';
  const status = document.createElement('p');
  status.className = 'loot-status'; status.setAttribute('role', 'status');
  const buttons: HTMLButtonElement[] = [];
  const collect = async (slot: number | null) => {
    buttons.forEach(button => button.disabled = true);
    status.textContent = t('Recogiendo…');
    const success = await take(slot);
    if (!root.isConnected) return;
    status.textContent = t(success ? 'Botín recogido.' : 'No se ha podido recoger. Vuelve a intentarlo.');
    buttons.forEach(button => button.disabled = false);
  };
  corpse.loot.forEach((item, slot) => {
    if (!item) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'loot-item';
    setItemTooltip(button, item.id, item.bound);
    button.innerHTML = itemIcon(item.id);
    const label = document.createElement('strong'); label.textContent = t(itemLabel(item.id));
    const count = document.createElement('span'); count.textContent = `×${item.count}`;
    const hint = document.createElement('small');
    const key = document.createElement('kbd'); key.textContent = 'E';
    hint.append(key, t('Recoger'));
    button.append(label, count, hint);
    button.onclick = () => void collect(slot);
    buttons.push(button); list.append(button);
  });
  if (buttons.length) {
    const all = document.createElement('button');
    all.type = 'button'; all.className = 'btn gold'; all.textContent = t('Recoger todo');
    all.onclick = () => void collect(null);
    buttons.push(all); root.append(list, all, status);
  } else {
    const empty = document.createElement('p');
    empty.className = 'loot-empty'; empty.textContent = t('El cuerpo está vacío.');
    root.append(empty);
  }
  container.append(root);
}

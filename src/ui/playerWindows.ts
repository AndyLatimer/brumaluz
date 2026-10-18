// Contenido de las ventanas del menú de personaje (Tab): inventario y ficha.
import type * as THREE from 'three';
import { ATTRIBUTES, CLASSES, RACES, ATTRIBUTE_MAX_VALUE, unspentAttributePoints, type AttributeId, type CharData } from '../data/data';
import { classIcon } from './classIcons';
import { CURRENCIES, CURRENCY_ORDER, currencyIcon } from '../data/currency';
import { EQUIPMENT_SLOTS, INVENTORY_UNLOCKED, type EquipmentSlot } from '../data/inventory';
import { createCharacterPortrait } from '../character/portrait';
import { attributeTotal, vitalsOf } from '../data/stats';
import { TITLES, TITLE_ORDER, type TitleId } from '../data/titles';
import { t, getLanguage, raceText, classText } from './i18n';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const SLOT_LABEL: Record<EquipmentSlot, string> = {
  head: 'Cabeza', pendant: 'Colgante', chest: 'Torso', hands: 'Manos', ring: 'Anillo', weapon: 'Arma', offhand: 'Mano izquierda', legs: 'Piernas', feet: 'Pies', trinket: 'Abalorio',
};

// Siluetas de las ranuras de equipo (viewBox 24, trazo).
const SLOT_ICON: Record<EquipmentSlot, string> = {
  head: '<path d="M5 15a7 7 0 0 1 14 0v5h-4v-3H9v3H5Z"/><path d="M9 12.5h6M12 3v3"/>',
  pendant: '<path d="M5 3c0 8 3 11 7 11s7-3 7-11"/><path d="M12 14l3.2 3.5L12 21l-3.200-3.500Z"/>',
  chest: '<path d="M8.500 3.500 3 6.500l2 4.500 2.500-1V20.500h9V10l2.500 1 2-4.500-5.500-3C14.500 5 13.300 5.500 12 5.500S9.500 5 8.500 3.500Z"/><path d="M12 8v12"/>',
  hands: '<path d="M7.500 21v-4.500L5.500 12V9a1.300 1.300 0 0 1 2.600 0v2V5.500a1.300 1.300 0 0 1 2.600 0V10V4.500a1.300 1.300 0 0 1 2.600 0V10V6.500a1.300 1.300 0 0 1 2.600 0V14l-1.500 3v4Z"/>',
  ring: '<circle cx="12" cy="15" r="5.500"/><path d="M9.200 7.500 12 3.500l2.800 4-2.800 2.200Z"/>',
  weapon: '<path d="M20.500 3.500 10.500 13.500M14.500 7l3 3M9.500 12.500l2 2M10 14l-5 5M4 20.500l2.500-2.500"/><path d="M20.500 3.500v3.500l-3-3Z"/>',
  offhand: '<path d="M12 3l7.500 3v5.500c0 4.800-3.200 8.200-7.500 9.500-4.300-1.300-7.500-4.700-7.500-9.500V6Z"/><path d="M12 7v10M8 11h8"/>',
  legs: '<path d="M7 3h10l1 18h-4.500L12 10l-1.500 11H6Z"/><path d="M7 7h10"/>',
  feet: '<path d="M9 3h6v8.500l5 3V19.500H5.500V15L9 13.500Z"/><path d="M5.500 17h14.500"/>',
  trinket: '<path d="M7 4h10l4 5-9 11L3 9Z"/><path d="M3 9h18M9.500 4 12 9l2.500-5M12 9v11"/>',
};

const coins = (n: number) => n.toLocaleString(getLanguage() === 'en' ? 'en-US' : 'es-ES');

function goldLine(d: CharData) {
  const row = el('div', 'wallet');
  for (const id of CURRENCY_ORDER) {
    const cur = CURRENCIES[id];
    const item = el('div', `currency ${id}${cur.premium ? ' premium' : ''}`);
    item.title = `${t(cur.label)}|${t(cur.description)}`;
    item.innerHTML = currencyIcon(id);
    item.append(el('b', undefined, coins(d.wallet[id])), el('span', undefined, t(cur.label)));
    row.append(item);
  }
  return row;
}

function equipCell(d: CharData, slot: EquipmentSlot) {
  const item = d.equipment[slot];
  const cell = el('div', `inv-slot equip${item ? ' filled' : ''}`);
  cell.title = `${t(SLOT_LABEL[slot])}|${t(item ? item.id : 'Ranura vacía')}`;
  cell.dataset.slot = slot;
  cell.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SLOT_ICON[slot]}</svg>`;
  cell.append(el('small', undefined, t(SLOT_LABEL[slot])));
  if (item) cell.append(el('b', undefined, item.id));
  return cell;
}

export function renderInventory(container: HTMLElement, d: CharData, renderer: THREE.WebGLRenderer) {
  container.replaceChildren();
  const wrap = el('div', 'inv');

  const equip = el('div', 'inv-equip');
  equip.append(el('h3', undefined, t('Equipo')));
  const doll = el('div', 'doll');
  const left = el('div', 'doll-col');
  const right = el('div', 'doll-col');
  for (const slot of EQUIPMENT_SLOTS.slice(0, 5)) left.append(equipCell(d, slot));
  for (const slot of EQUIPMENT_SLOTS.slice(5)) right.append(equipCell(d, slot));
  const stage = el('div', 'doll-stage');
  const portrait = createCharacterPortrait(d, renderer, { fullBody: true, scale: 2, aspect: 230 / 560 });
  portrait.className = 'doll-portrait';
  stage.append(portrait);
  doll.append(left, stage, right);
  equip.append(doll);

  const bag = el('div', 'inv-bag');
  const used = d.inventory.filter(Boolean).length;
  const head = el('div', 'inv-bag-head');
  head.append(el('h3', undefined, t('Mochila')), el('span', undefined, `${used} / ${INVENTORY_UNLOCKED}`));
  const grid = el('div', 'inv-grid');
  for (let i = 0; i < INVENTORY_UNLOCKED; i++) {
    const item = d.inventory[i];
    const cell = el('div', `inv-slot${item ? ' filled' : ''}`);
    cell.dataset.index = String(i);
    if (item) {
      cell.append(el('b', undefined, item.id));
      if (item.count > 1) cell.append(el('i', undefined, String(item.count)));
    }
    grid.append(cell);
  }
  const lock = el('div', 'inv-slot locked', '+');
  lock.title = `${t('Ampliar mochila')}|${t('Podrás desbloquear más huecos próximamente.')}`;
  grid.append(lock);
  bag.append(head, grid, goldLine(d));
  if (!used) bag.append(el('p', 'inv-empty', t('Tu mochila está vacía por ahora.')));

  wrap.append(equip, bag);
  container.append(wrap);
}

const SEX_ICON = [
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="14" r="5.2"/><path d="M14 10l6-6M15 4h5v5"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="5.2"/><path d="M12 14.2V22M8.5 18.5h7"/></svg>',
];

/** Selector de título con el estilo de la UI (botón dorado + lista desplegable). */
function titlePicker(current: TitleId, onChange?: (title: TitleId) => void) {
  const root = el('div', 'title-picker');
  const button = el('button', 'title-button') as HTMLButtonElement;
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.title = `${t('Título')}|${t('Se muestra bajo tu nombre sobre el personaje.')}`;
  const label = el('span', undefined, t(TITLES[current].label));
  button.append(label, el('i', 'caret'));
  const list = el('ul', 'title-list');
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  const close = () => {
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
  };
  const outside = (e: Event) => { if (!root.contains(e.target as Node)) close(); };
  const open = () => {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
  };
  for (const id of TITLE_ORDER) {
    const item = el('li', 'title-option', t(TITLES[id].label));
    item.setAttribute('role', 'option');
    item.tabIndex = 0;
    item.setAttribute('aria-selected', String(id === current));
    const pick = () => {
      current = id;
      label.textContent = t(TITLES[id].label);
      for (const o of list.children) o.setAttribute('aria-selected', String(o === item));
      close();
      button.focus();
      onChange?.(id);
    };
    item.onclick = pick;
    item.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      else if (e.key === 'Escape') { e.stopPropagation(); close(); button.focus(); }
      else if (e.key === 'ArrowDown') (item.nextElementSibling as HTMLElement | null)?.focus();
      else if (e.key === 'ArrowUp') (item.previousElementSibling as HTMLElement | null)?.focus();
    };
    list.append(item);
  }
  button.onclick = () => (list.hidden ? open() : close());
  root.append(button, list);
  return root;
}

export interface PointEditor {
  draft: Partial<Record<AttributeId, number>>;
  onAdd: (id: AttributeId) => void;
  onRemove: (id: AttributeId) => void;
}

export function renderSheet(container: HTMLElement, d: CharData, renderer: THREE.WebGLRenderer, onTitleChange?: (title: TitleId) => void, points?: PointEditor) {
  container.replaceChildren();
  const wrap = el('div', 'sheet');

  const left = el('div', 'sheet-left');
  const portrait = createCharacterPortrait(d, renderer);
  portrait.className = 'sheet-portrait';
  const badge = el('div', 'sheet-class');
  badge.innerHTML = classIcon(d.cls, 'sheet');
  badge.title = classText(d);
  left.append(portrait, badge);

  const right = el('div', 'sheet-right');
  const title = el('div', 'sheet-title');
  const nameRow = el('div', 'sheet-name-row');
  nameRow.append(el('strong', undefined, d.name), titlePicker(d.title, onTitleChange));
  const sexIcon = el('span', `sex-icon ${d.sex === 1 ? 'female' : 'male'}`);
  sexIcon.innerHTML = SEX_ICON[d.sex];
  sexIcon.title = t(d.sex === 1 ? 'Mujer' : 'Hombre');
  const detail = el('div', 'sheet-detail');
  detail.append(sexIcon, el('span', undefined, `${raceText(d)} · ${classText(d)}`));
  title.append(nameRow, detail);
  const chips = el('div', 'sheet-chips');
  chips.append(el('span', 'chip level', `${t('Nivel')} ${d.level}`));

  const v = vitalsOf(d);
  const bars = el('div', 'sheet-bars');
  const bar = (cls: string, label: string, value: number, max: number, text: string) => {
    const row = el('div', 'sheet-bar');
    const fill = el('i', cls);
    fill.style.width = `${Math.round((value / max) * 100)}%`;
    const track = el('div', 'track');
    track.append(fill, el('span', undefined, text));
    row.append(el('label', undefined, t(label)), track);
    return row;
  };
  bars.append(
    bar('hp', 'Vida', v.health, v.maxHealth, `${v.health} / ${v.maxHealth}`),
    bar(v.resourceKind, v.resourceKind === 'mana' ? 'Maná' : 'Estamina', v.resource, v.maxResource, `${v.resource} / ${v.maxResource}`),
    bar('xp', 'Experiencia', v.experience, v.experienceNeeded, `${v.experience} / ${v.experienceNeeded}`),
  );

  const attrs = el('div', 'sheet-attrs');
  attrs.append(el('h3', undefined, t('Atributos')));
  const owed = unspentAttributePoints(d);
  const draft = points?.draft ?? {};
  const drafted = Object.values(draft).reduce((sum, n) => sum + (n ?? 0), 0);
  const left_ = owed - drafted;
  if (owed > 0) {
    const line = el('p', 'sheet-points');
    line.append(el('span', 'points-badge', '!'), t('Puntos por repartir: {n}', { n: left_ }));
    attrs.append(line);
  }
  for (const id of Object.keys(ATTRIBUTES) as AttributeId[]) {
    const row = el('div', 'sheet-attr');
    row.title = `${t(ATTRIBUTES[id].label)}|${t(ATTRIBUTES[id].desc)}`;
    const extra = draft[id] ?? 0;
    const total = attributeTotal(d, id) + extra;
    const value = el('b', extra ? 'pending' : undefined, String(total));
    row.append(el('span', undefined, t(ATTRIBUTES[id].label)), value);
    if (owed > 0 && points) {
      const label = t(ATTRIBUTES[id].label);
      const remove = el('button', 'sheet-attr-add', '−') as HTMLButtonElement;
      remove.type = 'button';
      remove.disabled = extra === 0;
      remove.setAttribute('aria-label', t('Quitar un punto de {attribute}', { attribute: label }));
      remove.onclick = () => points.onRemove(id);
      const add = el('button', 'sheet-attr-add', '+') as HTMLButtonElement;
      add.type = 'button';
      add.disabled = left_ <= 0 || total >= ATTRIBUTE_MAX_VALUE;
      add.setAttribute('aria-label', t('Añadir un punto a {attribute}', { attribute: label }));
      add.onclick = () => points.onAdd(id);
      row.append(remove, add);
    }
    attrs.append(row);
  }

  right.append(title, chips, bars, attrs, goldLine(d));
  wrap.append(left, right);
  container.append(wrap);
}

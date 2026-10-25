// Contenido de las ventanas del menú de personaje (Tab): inventario y ficha.
import type * as THREE from 'three';
import { ATTRIBUTES, MAX_LEVEL, type CharData } from '../data/data';
import { classIcon } from './classIcons';
import { raceIcon } from './raceIcons';
import { renderSheetAttributes, type PointEditor } from './sheetAttributes';
export type { PointEditor } from './sheetAttributes';
import { CURRENCIES, CURRENCY_ORDER, currencyIcon } from '../data/currency';
import { EQUIPMENT_SLOTS, INVENTORY_UNLOCKED, type EquipmentSlot } from '../data/inventory';
import { itemDef, itemIcon, itemLabel } from '../data/items';
import { DRAG_ITEM_TYPE } from './actionBar';
import { createCharacterPortrait, createCharacterTurntable } from '../character/portrait';
import { attributeTotal, vitalsOf } from '../data/stats';
import { TITLES, TITLE_ORDER, isReservedTitle, isTitleAvailable, PHOENIX_ICON, type TitleId } from '../data/titles';
import { t, getLanguage, raceText, classText } from './i18n';
import { setItemTooltip } from './itemTooltip';
import { createQuestItems } from './questWindow';
import { EQUIPPABLE } from '../data/equipment';
import { attackInterval, basicAttackDamage, primaryAttribute, skillCost, skillPower, skillRank, COMBAT_KITS } from '../data/combat';
import { guardedDamage } from '../data/weapons';
import { activeSets } from '../data/sets';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const SLOT_LABEL: Record<EquipmentSlot, string> = {
  head: 'Cabeza', pendant: 'Colgante', chest: 'Torso', hands: 'Manos', ring: 'Anillo', weapon: 'Arma', offhand: 'Mano izquierda', legs: 'Piernas', trinket: 'Abalorio',
};

// Ilustraciones de las ranuras de equipo (viewBox 24).
const SLOT_ICON: Record<EquipmentSlot, string> = {
  head: '<path d="M4 16V11a8 8 0 0 1 16 0v5l-3 3H7Z" fill="#53646a" stroke="#40372e" stroke-width=".8"/><path d="M5 11a7 7 0 0 1 14 0v2H5Z" fill="#96a7a2" stroke="#e5d4a9" stroke-width=".7"/><path d="M4 13h16l-1 3H5Z" fill="#b18a4d" stroke="#55412d" stroke-width=".7"/><path d="m9 5 3-3 3 3-3 5Z" fill="#78a49b" stroke="#405a50" stroke-width=".6"/><path d="M7 17h10m-8 2h6" stroke="#d7c08b" stroke-width=".7"/><circle cx="6" cy="14.5" r=".65" fill="#f0d89a"/><circle cx="18" cy="14.5" r=".65" fill="#f0d89a"/>',
  pendant: '<path d="M5 3c0 6.5 2.1 10.3 7 11.5C16.9 13.3 19 9.5 19 3" fill="none" stroke="#986b37" stroke-width="2.6"/><path d="M6 3c.2 5.8 2 9.1 6 10.2C16 12.1 17.8 8.8 18 3" fill="none" stroke="#e2c37d" stroke-width="1.1"/><path d="m12 12 6 5-6 6-6-6Z" fill="#ad8245" stroke="#57402c" stroke-width=".7"/><path d="m12 14 3.5 3-3.5 4-3.5-4Z" fill="#6d9d91" stroke="#d8c795" stroke-width=".7"/><path d="m10.8 16.6 1.2-1.4 1.2 1.4" fill="none" stroke="#eaf0d2" stroke-width=".65"/><circle cx="12" cy="21.5" r=".7" fill="#efd895"/>',
  chest: '<path d="m8 3-5 3 2 5 3-1-1 10 5 2 5-2-1-10 3 1 2-5-5-3-4 2Z" fill="#52666b" stroke="#41372c" stroke-width=".8"/><path d="m8 3 4 3 4-3 2 2-2 6H8L6 5Z" fill="#b18a50" stroke="#e4cb91" stroke-width=".7"/><path d="m9 5 3 2 3-2-1 5h-4Z" fill="#d8c18a" stroke="#705737" stroke-width=".6"/><path d="m5 7 2-1 2 5-3 1Zm14 0-2-1-2 5 3 1Z" fill="#90a49d" stroke="#e4d4ad" stroke-width=".6"/><path d="M12 11v9m-3-5h6m-5 5 2 1 2-1" fill="none" stroke="#dfc68b" stroke-width=".8"/><circle cx="5.7" cy="7.3" r=".65" fill="#efd895"/><circle cx="18.3" cy="7.3" r=".65" fill="#efd895"/>',
  hands: '<path d="M7 20v-5l-3-4 1-2 3 2V5l2-1 1 5V3h2l1 6V4h2l1 7 2-3 2 1-3 8v3Z" fill="#a8764a" stroke="#513b2b" stroke-width=".8"/><path d="M7 17h11l-1 3H7Z" fill="#d3b06d" stroke="#705137" stroke-width=".7"/><path d="m10 13 3-2 3 2-3 3Z" fill="#70988b" stroke="#e7d299" stroke-width=".7"/><path d="M9 7v5m4-7v6m4-5v6m-9 5 3 1m3-1 3 1" fill="none" stroke="#e8d6aa" stroke-width=".65"/><path d="m5 10 2 2m12 1 1-2" fill="none" stroke="#f0d69a" stroke-width=".7"/>',
  ring: '<path d="M6 15a6 6 0 1 0 12 0 6 6 0 0 0-12 0Z" fill="#a8793d" stroke="#59402a" stroke-width=".8"/><path d="M7.7 15a4.3 4.3 0 1 0 8.6 0 4.3 4.3 0 0 0-8.6 0Z" fill="#f0ddb0" stroke="#e7c979" stroke-width=".6"/><path d="m7 6 5-4 5 4-5 6Z" fill="#71988d" stroke="#53442e" stroke-width=".8"/><path d="m8.7 6.2 3.3-2.7 3.3 2.7-3.3 3.9Z" fill="#a8c1a3"/><path d="M8 14a4.2 4.2 0 0 1 2-2.7M12 4v2" fill="none" stroke="#fff1c5" stroke-width=".7"/><circle cx="12" cy="6" r=".65" fill="#f1d486"/>',
  weapon: '<path d="m19 2 3 1-1 6L10 20l-5-5Z" fill="#627981" stroke="#44372c" stroke-width=".8"/><path d="m19 3 1.5.5-.8 4.5L10 18l-2-2Z" fill="#cbd5c9"/><path d="m18 4 1 .3-.6 3.5L9 17l-1-1Z" fill="#f3e9c7"/><path d="m19 3 .8.2-.8 4-1 .8Z" fill="#80a39a"/><path d="m5 12 7 7-2 2-7-7Z" fill="#be9956" stroke="#62472d" stroke-width=".7"/><path d="m3 15 6 6-2 2-6-6Z" fill="#78513a" stroke="#49352a" stroke-width=".7"/><path d="m4 19 2 2m-3-1 2 2" stroke="#d9b66c" stroke-width=".7"/><path d="m13 11 2 2" stroke="#fff5d6" stroke-width=".7"/>',
  offhand: '<path d="m12 2 9 4-1 8c-1 4-4 6-8 8-4-2-7-4-8-8L3 6Z" fill="#a77b43" stroke="#49392a" stroke-width=".9"/><path d="m12 4 7 3-1 7c-.8 3.3-3.2 5.2-6 6.8-2.8-1.6-5.2-3.5-6-6.8L5 7Z" fill="#6c8f83" stroke="#e1c77f" stroke-width=".7"/><path d="m12 6 5 2.2-.7 5.4c-.5 2.2-2.2 3.7-4.3 5-2.1-1.3-3.8-2.8-4.3-5L7 8.2Z" fill="#91aa98"/><path d="M12 7v10m-4-6h8" fill="none" stroke="#f0dba3" stroke-width="1.2"/><path d="m12 9 2 2-2 2-2-2Z" fill="#bd9856" stroke="#685132" stroke-width=".6"/><circle cx="12" cy="11" r=".7" fill="#f3dfaa"/><circle cx="5.1" cy="7.2" r=".6" fill="#f1d691"/><circle cx="18.9" cy="7.2" r=".6" fill="#f1d691"/>',
  legs: '<path d="M6 3h12l1 18h-5l-2-10-2 10H5Z" fill="#54696d" stroke="#40372c" stroke-width=".8"/><path d="M6 3h12v4H6Z" fill="#a47c48" stroke="#e2c889" stroke-width=".7"/><path d="M9 4h6v2H9Z" fill="#d9bc7b"/><path d="M7 8h4v4H8l-1 7H6Zm10 0h-4v4h3l1 7h1Z" fill="#829991"/><path d="m7 14 3 1-1 5H6Zm10 0-3 1 1 5h3Z" fill="#bac4ae" stroke="#e9d8ad" stroke-width=".6"/><path d="M12 7v4m-2 4 1 1m3-1-1 1" fill="none" stroke="#e5d5aa" stroke-width=".7"/><path d="M5 18h5v4H2v-2l3-1Zm9 0h5l3 2v2h-8Z" fill="#78533a" stroke="#49382b" stroke-width=".7"/>',
  trinket: '<path d="m12 2 3 4 5 1-1 5 2 4-5 2-4 4-4-4-5-2 2-4-1-5 5-1Z" fill="#a97d45" stroke="#55402d" stroke-width=".8"/><path d="m12 4 2.2 3.3 4.1.7-.8 4.1 1.2 3.2-3.8 1.5-2.9 2.9-2.9-2.9-3.8-1.5 1.2-3.2-.8-4.1 4.1-.7Z" fill="#78869b" stroke="#ddc582" stroke-width=".7"/><circle cx="12" cy="12" r="4.2" fill="#5f827e" stroke="#e9d9aa" stroke-width=".7"/><path d="m12 7 1.4 3.6L17 12l-3.6 1.4L12 17l-1.4-3.6L7 12l3.6-1.4Z" fill="#f0dfb5"/><circle cx="12" cy="12" r="1.25" fill="#c4a15b"/><path d="m12 8.3.8 2.8m2.9.9-2.8.8m-2.9.9L9.2 11" fill="none" stroke="#fff3c8" stroke-width=".6"/>',
};

const coins = (n: number) => n.toLocaleString(getLanguage() === 'en' ? 'en-US' : 'es-ES');

export function goldLine(d: CharData, includePremium = true) {
  const row = el('div', 'wallet');
  for (const id of CURRENCY_ORDER) {
    const cur = CURRENCIES[id];
    if (cur.premium && !includePremium) continue;
    const item = el('div', `currency ${id}${cur.premium ? ' premium' : ''}`);
    item.title = `${t(cur.label)}|${t(cur.description)}`;
    item.innerHTML = currencyIcon(id);
    item.append(el('b', undefined, coins(d.wallet[id])), el('span', undefined, t(cur.label)));
    row.append(item);
  }
  return row;
}

function equipCell(d: CharData, slot: EquipmentSlot, onUnequip?: (slot: EquipmentSlot) => void) {
  const item = d.equipment[slot];
  const cell = el(item && onUnequip ? 'button' : 'div', `inv-slot equip${item ? ' filled' : ''}`);
  if (cell instanceof HTMLButtonElement) cell.type = 'button';
  cell.title = `${t(SLOT_LABEL[slot])}|${t(item ? item.id : 'Ranura vacía')}`;
  cell.dataset.slot = slot;
  cell.innerHTML = `<svg class="equip-art" viewBox="0 0 24 24" aria-hidden="true">${SLOT_ICON[slot]}</svg>`;
  cell.append(el('small', undefined, t(SLOT_LABEL[slot])));
  if (item) {
    cell.removeAttribute('title');
    setItemTooltip(cell, item.id, item.bound,item);
    cell.tabIndex = 0;
    if (onUnequip) {
      cell.onclick = () => onUnequip(slot);
      cell.setAttribute('aria-label', `${t('Desequipar')}: ${t(itemLabel(item.id))}`);
    }
    if (itemDef(item.id)) {
      cell.innerHTML = itemIcon(item.id);
      cell.append(el('small', undefined, t(SLOT_LABEL[slot])));
    }
    if (onUnequip) cell.append(el('span', 'inv-action-label', t('Desequipar')));
  }
  return cell;
}

const INVENTORY_ICONS = {
  equipment: '<path d="m8 3-5 3 2 5 3-1-1 10 5 2 5-2-1-10 3 1 2-5-5-3-4 2Z" fill="#93a9ab"/><path d="m8 3 4 3 4-3-1 7H9Z" fill="#d1ba82"/><path d="M12 10v10M8 16h8" fill="none" stroke="#eee3c2"/><path d="m4 6 3-1 1 5-3 1Zm16 0-3-1-1 5 3 1Z" fill="#7c8f91"/>',
  bag: '<path d="M8 6V4a4 4 0 0 1 8 0v2M5 6h14l2 15H3Z"/><path d="M8 10h8v6H8ZM10 10v2h4v-2"/>',
  purse: '<path d="m8 3 4 2 4-2-1 5c3 2 5 5 5 8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5c0-3 2-6 5-8Z"/><path d="M8 8h8M12 12v5M10 14.5h4"/>',
  rotate: '<path d="M5 9a8 8 0 0 1 14-2l2 3M21 4v6h-6M19 15A8 8 0 0 1 5 17l-2-3M3 20v-6h6"/>',
};
const inventoryIcon = (icon: keyof typeof INVENTORY_ICONS) => `<svg viewBox="0 0 24 24" aria-hidden="true">${INVENTORY_ICONS[icon]}</svg>`;

function inventoryHeading(icon: keyof typeof INVENTORY_ICONS, label: string) {
  const heading = el('h3', 'inv-heading');
  heading.innerHTML = inventoryIcon(icon);
  heading.append(t(label));
  return heading;
}

export function renderInventory(container: HTMLElement, d: CharData, renderer: THREE.WebGLRenderer, onUse?: (slot: number) => void, onMove?: (from: number, to: number) => void, onEquip?: (slot: number) => void, onUnequip?: (slot: EquipmentSlot) => void) {
  container.replaceChildren();
  const wrap = el('div', 'inv');

  const equip = el('div', 'inv-equip');
  equip.append(inventoryHeading('equipment', 'Equipo'));
  const doll = el('div', 'doll');
  const left = el('div', 'doll-col');
  const right = el('div', 'doll-col');
  for (const slot of EQUIPMENT_SLOTS.slice(0, 5)) left.append(equipCell(d, slot, onUnequip));
  for (const slot of EQUIPMENT_SLOTS.slice(5)) right.append(equipCell(d, slot, onUnequip));
  const stage = el('div', 'doll-stage');
  const turntable = createCharacterTurntable(d, renderer, { scale: 2, aspect: 200 / 390 });
  const portrait = turntable.canvas;
  portrait.className = 'doll-portrait';
  stage.append(portrait);
  stage.title = `${t('Girar personaje')}|${t('Arrastra para girar a tu personaje.')}`;
  stage.classList.add('rotatable');
  let dragging = false, lastX = 0, yaw = 0, pending = false;
  const redraw = () => { pending = false; turntable.render(yaw); };
  stage.onpointerdown = (e) => { dragging = true; lastX = e.clientX; stage.setPointerCapture(e.pointerId); };
  stage.onpointermove = (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.012;
    lastX = e.clientX;
    if (!pending) { pending = true; requestAnimationFrame(redraw); }
  };
  stage.onpointerup = stage.onpointercancel = () => { dragging = false; };
  doll.append(left, stage, right);
  equip.append(doll);
  const rotateHint = el('p', 'inv-hint');
  rotateHint.innerHTML = inventoryIcon('rotate');
  rotateHint.append(t('Arrastra para girar'));
  equip.append(rotateHint);

  const bag = el('div', 'inv-bag');
  const used = d.inventory.slice(0, INVENTORY_UNLOCKED).filter(Boolean).length;
  const head = el('div', 'inv-bag-head');
  const capacity = el('span', 'inv-capacity', `${used} / ${INVENTORY_UNLOCKED}`);
  capacity.setAttribute('aria-label', t('{used} de {total} huecos ocupados', { used, total: INVENTORY_UNLOCKED }));
  head.append(inventoryHeading('bag', 'Mochila'), capacity);
  const grid = el('div', 'inv-grid');
  let source: number | null = null;
  for (let i = 0; i < INVENTORY_UNLOCKED; i++) {
    const item = d.inventory[i];
    const def = item ? itemDef(item.id) : undefined;
    const equippable = !!(item && onEquip && EQUIPPABLE[item.id]);
    const usable = !!(item && onUse && def?.usable) || equippable;
    const cell = el(usable ? 'button' : 'div', `inv-slot${item ? ' filled' : ''}`);
    if (cell instanceof HTMLButtonElement) cell.type = 'button';
    cell.dataset.index = String(i);
    if (item) {
      setItemTooltip(cell, item.id, item.bound,item);
      cell.tabIndex = 0;
      cell.setAttribute('aria-label', t('{name}, {n} unidades', { name: t(itemLabel(item.id)), n: item.count }));
      cell.innerHTML = itemIcon(item.id);
      if (item.count > 1) cell.append(el('i', undefined, String(item.count)));
      if (onUse && def?.usable) {
        cell.classList.add('usable');
        cell.onclick = () => { if (source === null) onUse(i); };
      }
      if (equippable && onEquip) {
        cell.classList.add('usable');
        cell.setAttribute('aria-label', `${t('Equipar')}: ${t(itemLabel(item.id))}`);
        cell.onclick = () => { if (source === null) onEquip(i); };
        cell.append(el('span', 'inv-action-label', t('Equipar')));
      }
      if (onMove || def?.usable) {
        cell.draggable = true;
        cell.ondragstart = (e) => {
          source = i;
          cell.classList.add('dragging');
          e.dataTransfer?.setData(DRAG_ITEM_TYPE, JSON.stringify({ id: item.id }));
          e.dataTransfer!.effectAllowed = 'copyMove';
        };
        cell.ondragend = () => {
          source = null;
          grid.querySelectorAll('.dragging,.drop-target').forEach(el => el.classList.remove('dragging','drop-target'));
        };
      }
    }
    if (onMove) {
      cell.ondragover = e => {
        if (source === null || source === i) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        cell.classList.add('drop-target');
      };
      cell.ondragleave = () => cell.classList.remove('drop-target');
      cell.ondrop = e => {
        e.preventDefault(); cell.classList.remove('drop-target');
        if (source === null || source === i) return;
        const from = source; source = null;
        onMove(from,i);
      };
    }
    grid.append(cell);
  }
  const lock = el('div', 'inv-slot locked');
  lock.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>';
  lock.append(el('span', undefined, t('Más espacio, próximamente')));
  lock.title = `${t('Ampliar mochila')}|${t('Podrás desbloquear más huecos próximamente.')}`;
  grid.append(lock);
  bag.append(head, grid);
  if (!used) bag.append(el('p', 'inv-empty', t('Tu mochila está vacía por ahora.')));
  const questItems = createQuestItems(d);
  if (questItems) bag.append(questItems);

  const purse = el('section', 'inv-purse');
  purse.append(inventoryHeading('purse', 'Monedero'), goldLine(d));
  wrap.append(equip, bag, purse);
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
  const label = el('span');
  const setLabel = (id: TitleId) => {
    label.replaceChildren();
    if (isReservedTitle(id)) label.insertAdjacentHTML('beforeend', PHOENIX_ICON);
    label.append(t(TITLES[id].label));
    button.classList.toggle('staff-title', isReservedTitle(id));
  };
  setLabel(current);
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
    if (id !== current && !isTitleAvailable(id)) continue;
    const item = el('li', 'title-option');
    if (isReservedTitle(id)) { item.classList.add('staff-title'); item.insertAdjacentHTML('beforeend', PHOENIX_ICON); }
    item.append(t(TITLES[id].label));
    item.setAttribute('role', 'option');
    item.tabIndex = 0;
    item.setAttribute('aria-selected', String(id === current));
    const pick = () => {
      current = id;
      label.textContent = '';
      setLabel(id);
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

const BAR_GLYPH: Record<string, string> = {
  hp: 'M12 20.5s-8-4.8-8-10.7A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.8c0 5.9-8 10.7-8 10.7Z',
  mana: 'M12 3s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11Z',
  stamina: 'M13.5 2 5 13.5h6L10 22l8.5-11.5h-6Z',
  xp: 'm12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5l-5.3 2.9 1.2-6-4.5-4.1 6-.7Z',
};


export function renderSheet(container: HTMLElement, d: CharData, renderer: THREE.WebGLRenderer, onTitleChange?: (title: TitleId) => void, points?: PointEditor) {
  container.replaceChildren();
  const wrap = el('div', 'sheet');

  const left = el('div', 'sheet-left');
  const portrait = createCharacterPortrait(d, renderer, { scale: 2 });
  portrait.className = 'sheet-portrait';
  portrait.setAttribute('role', 'img');
  portrait.setAttribute('aria-label', d.name);
  const badge = el('div', 'sheet-class');
  badge.innerHTML = classIcon(d.cls, 'sheet');
  badge.title = classText(d);
  const level = el('div', 'sheet-level');
  level.append(el('small', undefined, t('Nivel')), el('b', undefined, String(d.level)));
  left.append(portrait, badge, level);

  const right = el('div', 'sheet-right');
  const title = el('div', 'sheet-title');
  const nameRow = el('div', 'sheet-name-row');
  nameRow.append(el('strong', undefined, d.name), titlePicker(d.title, onTitleChange));
  const sexIcon = el('span', `sex-icon ${d.sex === 1 ? 'female' : 'male'}`);
  sexIcon.innerHTML = SEX_ICON[d.sex];
  sexIcon.title = t(d.sex === 1 ? 'Mujer' : 'Hombre');
  const chip = (cls: string, icon: string, text: string) => {
    const node = el('span', `sheet-chip ${cls}`);
    node.insertAdjacentHTML('beforeend', icon);
    node.append(el('span', undefined, text));
    return node;
  };
  const detail = el('div', 'sheet-detail');
  detail.append(
    chip('race', raceIcon(d.race, 'sheetchip'), raceText(d)),
    chip('class', classIcon(d.cls, 'sheetchip'), classText(d)),
    sexIcon,
  );
  title.append(nameRow, detail);
  const v = vitalsOf(d);
  const vitals = el('section', 'sheet-panel sheet-vitals');
  vitals.append(el('h3', undefined, t('Estado del personaje')));
  const bars = el('div', 'sheet-bars');
  const bar = (cls: string, label: string, description: string, value: number, max: number, text: string) => {
    const row = el('div', `sheet-bar ${cls}`);
    row.title = `${t(label)}|${t(description)}`;
    row.tabIndex = 0;
    const fill = el('i', cls);
    fill.style.width = `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
    const track = el('div', 'track');
    track.setAttribute('role', cls === 'xp' ? 'progressbar' : 'meter');
    track.setAttribute('aria-label', t(label));
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(max));
    track.setAttribute('aria-valuenow', String(value));
    track.append(fill, el('span', undefined, text));
    const name = el('span', 'sheet-bar-label');
    name.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${BAR_GLYPH[cls]}"/></svg>`;
    name.append(t(label));
    row.append(name, track);
    return row;
  };
  bars.append(
    bar('hp', 'Vida', 'Tu salud actual y máxima. Si llega a cero, caes en combate.', v.health, v.maxHealth, `${v.health} / ${v.maxHealth}`),
    bar(v.resourceKind, v.resourceKind === 'mana' ? 'Maná' : 'Estamina',
      v.resourceKind === 'mana' ? 'Tu reserva actual y máxima de energía mágica.' : 'Tu reserva actual y máxima de energía física.',
      v.resource, v.maxResource, `${v.resource} / ${v.maxResource}`),
    bar('xp', 'Experiencia', 'Tu progreso hacia el siguiente nivel.', v.experience, v.experienceNeeded, `${v.experience} / ${v.experienceNeeded}`),
  );
  vitals.append(bars);
  vitals.append(el('p', 'sheet-progress-note', d.level >= MAX_LEVEL
    ? t('Nivel máximo alcanzado')
    : t('{n} EXP para el nivel {level}', { n: v.experienceNeeded - v.experience, level: d.level + 1 })));

  const attrs = renderSheetAttributes(d, points);

  const combat = el('section','sheet-panel sheet-combat');
  combat.append(el('h3',undefined,t('Combate')));
  const number = (value:number) => value.toLocaleString(getLanguage()==='en'?'en-US':'es-ES',{maximumFractionDigits:1});
  const stat = (label:string,value:string) => { const row=el('div','sheet-combat-stat');row.append(el('span',undefined,t(label)),el('b',undefined,value));combat.append(row); };
  stat('Ataque básico',`${number(basicAttackDamage(d.cls,d.level,d.equipment,d))} · ${number(attackInterval(d.cls,d.equipment,d))} s`);
  stat(COMBAT_KITS[d.cls].skill.label,`${number(skillPower(d.cls,skillRank(d),d.equipment,d))}${d.cls==='picaro'?' × 2':''} · ${number(skillCost(d))} ${t(v.resourceKind==='mana'?'Maná':'Estamina')}`);
  stat('Reducción de daño',`${number((1-guardedDamage(d.cls,d.equipment,100,d)/100)*100)} %`);
  stat('Atributo principal',`${t(ATTRIBUTES[primaryAttribute(d.cls)].label)} · ${attributeTotal(d,primaryAttribute(d.cls))}`);
  for(const set of activeSets(d.cls,d.equipment))stat(set.name,`${set.count}/4 · 2: ${set.two>=1?t('activo'):t('inactivo')} · 4: ${set.four>=2?t('activo'):t('inactivo')}`);
  right.append(title, vitals, combat);
  wrap.append(left, right, attrs);
  container.append(wrap);
}

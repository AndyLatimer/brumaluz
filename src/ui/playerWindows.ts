// Contenido de las ventanas del menú de personaje (Tab): inventario y ficha.
import type * as THREE from 'three';
import { ATTRIBUTES, ATTRIBUTE_MAX_VALUE, MAX_LEVEL, unspentAttributePoints, type AttributeId, type CharData } from '../data/data';
import { classIcon } from './classIcons';
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

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const SLOT_LABEL: Record<EquipmentSlot, string> = {
  head: 'Cabeza', pendant: 'Colgante', chest: 'Torso', hands: 'Manos', ring: 'Anillo', weapon: 'Arma', offhand: 'Mano izquierda', legs: 'Piernas', feet: 'Pies', trinket: 'Abalorio',
};

// Ilustraciones de las ranuras de equipo (viewBox 24).
const SLOT_ICON: Record<EquipmentSlot, string> = {
  head: '<path d="M5 20v-8a7 7 0 0 1 14 0v8l-4-2H9Z" fill="#9baeb0"/><path d="M12 4v8M6 12h12" fill="none" stroke="#e9e3ca"/><path d="m7 13 4 1v3H7Zm10 0-4 1v3h4Z" fill="#4e5d61"/><path d="M9 4 12 2l3 2-3 5Z" fill="#b68b4d"/>',
  pendant: '<path d="M5 3c0 7 2 11 7 12 5-1 7-5 7-12" fill="none" stroke="#bb904c" stroke-width="2"/><path d="m12 13 5 4-5 5-5-5Z" fill="#be9953"/><path d="m12 15 2.7 2-2.7 3-2.7-3Z" fill="#6a9f99"/><path d="m11 16 1-1 1 1" fill="none" stroke="#e1f0d7"/>',
  chest: '<path d="m8 3-5 3 2 5 3-1-1 10 5 2 5-2-1-10 3 1 2-5-5-3-4 2Z" fill="#93a9ab"/><path d="m8 3 4 3 4-3-1 7H9Z" fill="#d1ba82"/><path d="M12 10v10M8 16h8" fill="none" stroke="#eee3c2"/><path d="m4 6 3-1 1 5-3 1Zm16 0-3-1-1 5 3 1Z" fill="#7c8f91"/>',
  hands: '<path d="M7 20v-5l-3-4 1-2 3 2V5l2-1 1 5V3h2l1 6V4h2l1 7 2-3 2 1-3 8v3Z" fill="#b58b60"/><path d="M7 18h11v4H7Z" fill="#8e6848"/><path d="m10 13 3-2 3 2-3 3Z" fill="#cdb274"/><path d="M10 19h5" stroke="#ecd9ae"/>',
  ring: '<circle cx="12" cy="15" r="6.5" fill="#bf984e"/><circle cx="12" cy="15" r="3.7" fill="#f0dfb7"/><path d="m7 6 5-4 5 4-5 5Z" fill="#71968f"/><path d="m7 6 5 1 5-1M12 7V2" fill="none" stroke="#d6e6cc"/><path d="M7 14a5 5 0 0 1 2-3" fill="none" stroke="#f9e3a6"/>',
  weapon: '<path d="m20 2 1 6-10 10-5-5Z" fill="#b1c2bd"/><path d="M19 5 9 15" stroke="#f3f0d7"/><path d="m5 11 8 8 2-2-8-8Z" fill="#c09b56"/><path d="m7 15 2 2-5 5-2-2Z" fill="#956a4d"/><path d="m3 18 3 3" stroke="#d6b77c"/>',
  offhand: '<path d="m12 2 9 4-1 8c-1 4-4 6-8 8-4-2-7-4-8-8L3 6Z" fill="#b99a5a"/><path d="m12 5 6 3-1 6c-.5 2.5-2.5 4-5 5.5-2.5-1.5-4.5-3-5-5.5L6 8Z" fill="#73938a"/><path d="M12 7v10M8 11h8" fill="none" stroke="#e3d5a2" stroke-width="2"/><circle cx="12" cy="11" r="1.8" fill="#c4a35b"/>',
  legs: '<path d="M6 3h12l1 18h-5l-2-10-2 10H5Z" fill="#8d9e9f"/><path d="M6 3h12v4H6Z" fill="#a38155"/><path d="M10 4h4v2h-4Z" fill="#dec181"/><path d="m7 14 3 1-1 5H6Zm10 0-3 1 1 5h3Z" fill="#b6c0b2"/><path d="M12 7v4" stroke="#e5ddbf"/>',
  feet: '<path d="M10 3h8v10l4 3v5H10v-5l2-3Z" fill="#a48056"/><path d="M4 5h8v9l4 3v5H2v-5l3-3Z" fill="#b99668"/><path d="M4 5h8v3H4ZM2 19h14v3H2Z" fill="#795c41"/><path d="M6 10h4M6 13h4M12 18h2" stroke="#e4cc96"/>',
  trinket: '<path d="m12 2 3 4 5 1-1 5 2 4-5 2-4 4-4-4-5-2 2-4-1-5 5-1Z" fill="#bb975b"/><circle cx="12" cy="12" r="5.5" fill="#8a80a0"/><path d="m12 7 1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5Z" fill="#efe0b7"/><circle cx="12" cy="12" r="1.4" fill="#c7ac69"/>',
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
    setItemTooltip(cell, item.id, item.bound);
    cell.tabIndex = 0;
    if (onUnequip) {
      cell.onclick = () => onUnequip(slot);
      cell.setAttribute('aria-label', `${t('Desequipar')}: ${t(itemLabel(item.id))}`);
    }
    if (itemDef(item.id)) {
      cell.innerHTML = itemIcon(item.id);
      cell.append(el('small', undefined, t(SLOT_LABEL[slot])));
    }
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
      setItemTooltip(cell, item.id, item.bound);
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

export interface PointEditor {
  draft: Partial<Record<AttributeId, number>>;
  onAdd: (id: AttributeId) => void;
  onRemove: (id: AttributeId) => void;
}

const ATTRIBUTE_ART: Record<AttributeId, string> = {
  fuerza: '<path d="m17 3 4 1-1 4-9 9-4-4Z" fill="#a5b8b6"/><path d="m18 6-9 9" stroke="#f8efd6"/><path d="m5 11 8 8M8 16l-5 5" stroke="#b08a48" stroke-width="3"/>',
  intelecto: '<path d="M3 5q5-2 9 1 4-3 9-1v15q-5-2-9 0-4-2-9 0Z" fill="#8e91b4"/><path d="M12 6v14M6 9l3 1M6 13l3 1M15 10l3-1M15 14l3-1" stroke="#efe5c7"/>',
  corpulencia: '<path d="m12 2 9 4-1 8c-1 4-5 7-8 8-3-1-7-4-8-8L3 6Z" fill="#91a582"/><path d="M12 7v10M7 12h10" stroke="#f2e3b6" stroke-width="3"/>',
  agilidad: '<path d="M4 19C6 10 11 3 21 3c0 8-5 15-13 15Z" fill="#81a29c"/><path d="M3 22 17 8M8 17l1-6M12 13h5" stroke="#eee3bf"/>',
  pericia: '<path d="m6 3 4 3 1 5 10 8-3 3-9-11-5-1-2-4 4 1 2-2Z" fill="#be9a69"/><circle cx="18.5" cy="19" r="1" fill="#f6e8c6"/>',
  presencia: '<path d="m3 7 5 4 4-8 4 8 5-4-3 13H6Z" fill="#c5a05e"/><path d="M7 17h10" stroke="#f7e3ac"/><circle cx="12" cy="12" r="2" fill="#ad7e88"/>',
  percepcion: '<path d="M2 12S6 5 12 5s10 7 10 7-4 7-10 7S2 12 2 12Z" fill="#ad9b78"/><circle cx="12" cy="12" r="4" fill="#71968e"/><circle cx="12" cy="12" r="1.7" fill="#3d514d"/><circle cx="13" cy="10.5" r="1" fill="#fff1ce"/>',
};

const sheetArt = (art: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${art}</svg>`;

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
  const detail = el('div', 'sheet-detail');
  detail.append(sexIcon, el('span', undefined, `${raceText(d)} · ${classText(d)}`));
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
    row.append(el('span', 'sheet-bar-label', t(label)), track);
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

  const attrs = el('section', 'sheet-panel sheet-attributes');
  const attrHead = el('div', 'sheet-section-head');
  const attrTitle = el('div');
  attrTitle.append(el('h3', undefined, t('Atributos')), el('p', 'sheet-section-note', t('La base de tu personaje, punto a punto.')));
  attrHead.append(attrTitle);
  const owed = unspentAttributePoints(d);
  const draft = points?.draft ?? {};
  const drafted = Object.values(draft).reduce((sum, n) => sum + (n ?? 0), 0);
  const left_ = owed - drafted;
  if (owed > 0) {
    const line = el('p', 'sheet-points');
    line.append(el('span', 'points-badge', '!'), t('Puntos por repartir: {n}', { n: left_ }));
    attrHead.append(line);
  }
  const grid = el('div', 'sheet-attrs');
  for (const id of Object.keys(ATTRIBUTES) as AttributeId[]) {
    const row = el('div', 'sheet-attr');
    row.dataset.attribute = id;
    row.tabIndex = -1;
    const icon = el('div', 'sheet-attr-icon');
    icon.innerHTML = sheetArt(ATTRIBUTE_ART[id]);
    const extra = draft[id] ?? 0;
    const total = attributeTotal(d, id) + extra;
    const value = el('b', extra ? 'pending' : undefined, String(total));
    const info = el('div', 'sheet-attr-info');
    const name = el('div', 'sheet-attr-name');
    name.append(el('span', undefined, t(ATTRIBUTES[id].label)), value);
    info.append(name, el('p', 'sheet-attr-description', t(ATTRIBUTES[id].desc)));
    if (extra > 0) info.append(el('small', 'sheet-draft', t('+{n} sin confirmar', { n: extra })));
    row.append(icon, info);
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
      const controls = el('div', 'sheet-attr-controls');
      controls.append(remove, add);
      row.append(controls);
    }
    grid.append(row);
  }
  attrs.append(attrHead, grid);

  right.append(title, vitals);
  wrap.append(left, right, attrs);
  container.append(wrap);
}

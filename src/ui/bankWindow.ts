// Ventana del banco de la cuenta: el baúl (madera y terciopelo) a la izquierda, la mochila a la derecha y, debajo, el
// libro de cuentas de los pelines. Los objetos se arrastran de un lado a otro (o dentro de cada lado para ordenarlos);
// soltarlos sobre un hueco lo ocupa, sobre un montón igual lo completa y sobre otro objeto los intercambia. Un clic
// sigue llevando el objeto entero al otro lado.
import type { CharData } from '../data/data';
import { currencyIcon } from '../data/currency';
import { INVENTORY_UNLOCKED, type ItemStack } from '../data/inventory';
import { itemIcon, itemLabel } from '../data/items';
import { isBankable, type BankState } from '../data/bank';
import { t } from './i18n';
import { setItemTooltip } from './itemTooltip';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

export interface BankHandlers {
  /** Guarda el objeto del hueco `slot` de la mochila; `target`, hueco del baúl (sin él, el primero libre). */
  onDeposit: (slot: number, target?: number) => void;
  /** Retira el objeto del hueco `slot` del baúl; `target`, hueco de la mochila (sin él, el primero libre). */
  onWithdraw: (slot: number, target?: number) => void;
  onMoveBank: (from: number, to: number) => void;
  onMoveBag: (from: number, to: number) => void;
  onDepositAll: () => void;
  onDepositPelines: (amount: number) => void;
  onWithdrawPelines: (amount: number) => void;
}

type Side = 'bank' | 'bag';

const CHEST_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v2H3Z" fill="#b8874d"/><path d="M3 12h18v8H3Z" fill="#9a6a3a"/><path d="M3 12h18M8 5v15M16 5v15" stroke="#5e3c22" stroke-width="1.2" fill="none"/><rect x="10" y="10.5" width="4" height="4.5" rx="1" fill="#e6c477" stroke="#6b4a26" stroke-width=".8"/><circle cx="12" cy="12.4" r=".7" fill="#5e3c22"/></svg>';
const BAG_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V6a4 4 0 0 1 8 0v1"/><path d="M5 8h14l-1.2 11.2A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.8Z"/><path d="M9 12h6"/></svg>';
const SEARCH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></svg>';
const ARROWS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14l-4-4M20 16H6l4 4"/></svg>';

/** Lo que se está arrastrando (solo dentro de esta ventana). */
let drag: { side: Side; index: number; item: ItemStack } | null = null;
/** Texto del buscador: atenúa lo que no coincide en los dos lados. Se conserva al redibujar. */
let filter = '';
/** Contenido de cada hueco en el dibujo anterior, para hacer brillar los que acaban de cambiar. */
let previous: Record<Side, string[]> | null = null;
const signature = (item: ItemStack | null | undefined) => item ? `${item.id}:${item.count}:${item.bound ? 1 : 0}` : '';

function clearDragMarks(root: ParentNode) {
  root.querySelectorAll('.dragging,.drop-target,.drop-invalid,.bank-drop-zone').forEach(node =>
    node.classList.remove('dragging', 'drop-target', 'drop-invalid', 'bank-drop-zone'));
}

/** Se puede soltar lo arrastrado en `side` (hueco `index`, o el primero libre sin él)? */
function canDrop(side: Side, index: number | null, items: Record<Side, (ItemStack | null)[]>) {
  if (!drag) return false;
  if (drag.side === side) return index !== null && index !== drag.index;
  // Al baúl solo van objetos que se pueden guardar; al retirar sobre algo de la mochila, eso pasa al baúl.
  if (side === 'bank') return isBankable(drag.item);
  const displaced = index === null ? null : items.bag[index];
  return !displaced || displaced.id === drag.item.id || isBankable(displaced);
}

function drop(side: Side, index: number | null, handlers: BankHandlers) {
  const from = drag;
  drag = null;
  if (!from) return;
  if (from.side === side) { if (index !== null && index !== from.index) (side === 'bank' ? handlers.onMoveBank : handlers.onMoveBag)(from.index, index); }
  else if (side === 'bank') handlers.onDeposit(from.index, index ?? undefined);
  else handlers.onWithdraw(from.index, index ?? undefined);
}

function slot(side: Side, index: number, item: ItemStack | null, items: Record<Side, (ItemStack | null)[]>, handlers: BankHandlers, changed: boolean) {
  const movable = !!item && (side === 'bank' || isBankable(item));
  const cell = el(movable ? 'button' : 'div', `inv-slot bank-slot${item ? ' filled' : ''}`);
  cell.dataset.index = String(index);
  if (cell instanceof HTMLButtonElement) cell.type = 'button';
  if (item) {
    setItemTooltip(cell, item.id, item.bound);
    const name = t(itemLabel(item.id));
    cell.dataset.item = item.id;
    cell.dataset.name = name.toLocaleLowerCase();
    cell.innerHTML = itemIcon(item.id);
    if (item.count > 1) cell.append(el('i', undefined, String(item.count)));
    cell.setAttribute('aria-label', `${t(side === 'bank' ? 'Retirar' : 'Guardar')}: ${name} × ${item.count}`);
    if (movable) {
      cell.classList.add('usable');
      cell.onclick = () => (side === 'bank' ? handlers.onWithdraw : handlers.onDeposit)(index);
    } else {
      cell.classList.add('bank-blocked');
      cell.setAttribute('aria-label', `${name}: ${t('ligado, no se puede guardar')}`);
    }
    // Todo se puede ordenar dentro de su lado; lo ligado no cruza al baúl.
    cell.draggable = true;
    cell.ondragstart = e => {
      drag = { side, index, item };
      cell.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', item.id);
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setDragImage(cell, cell.clientWidth / 2, cell.clientHeight / 2); }
      // El otro lado se marca entero como sitio donde soltar (si se puede).
      const other = cell.closest('.bank')?.querySelector<HTMLElement>(`.bank-panel.${side === 'bank' ? 'bag' : 'vault'}`);
      if (other && canDrop(side === 'bank' ? 'bag' : 'bank', null, items)) other.classList.add('bank-drop-zone');
    };
    cell.ondragend = () => { drag = null; const root = cell.closest('.bank'); if (root) clearDragMarks(root); };
    // Al pasar por encima, se resaltan los montones iguales del otro lado (donde se apilaría).
    cell.onmouseenter = () => cell.closest('.bank')?.querySelectorAll(`.bank-slot[data-item="${item.id}"]`).forEach(other => { if (other !== cell) other.classList.add('bank-match'); });
    cell.onmouseleave = () => cell.closest('.bank')?.querySelectorAll('.bank-match').forEach(other => other.classList.remove('bank-match'));
  }
  cell.ondragover = e => {
    if (!drag) return;
    const ok = canDrop(side, index, items);
    cell.classList.toggle('drop-target', ok);
    cell.classList.toggle('drop-invalid', !ok && !(drag.side === side && drag.index === index));
    if (!ok) return;
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };
  cell.ondragleave = () => cell.classList.remove('drop-target', 'drop-invalid');
  cell.ondrop = e => {
    e.preventDefault(); e.stopPropagation();
    const root = cell.closest('.bank');
    if (canDrop(side, index, items)) drop(side, index, handlers);
    if (root) clearDragMarks(root);
  };
  if (changed) cell.classList.add('bank-flash');
  return cell;
}

function capacity(used: number, size: number) {
  const meter = el('div', 'bank-meter');
  meter.setAttribute('role', 'meter');
  meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', String(size)); meter.setAttribute('aria-valuenow', String(used));
  meter.setAttribute('aria-label', t('Huecos ocupados'));
  const fill = el('span');
  fill.style.width = `${Math.round(used / size * 100)}%`;
  if (used >= size) meter.classList.add('full');
  meter.append(fill, el('b', undefined, `${used} / ${size}`));
  return meter;
}

function panel(side: Side, title: string, icon: string, items: (ItemStack | null)[], all: Record<Side, (ItemStack | null)[]>, handlers: BankHandlers, changed: Set<number>) {
  const section = el('section', `bank-panel ${side === 'bank' ? 'vault' : 'bag'}`);
  const head = el('header', 'bank-panel-head');
  const badge = el('span', 'bank-panel-icon');
  badge.innerHTML = icon;
  const used = items.filter(Boolean).length;
  head.append(badge, el('h3', undefined, t(title)), capacity(used, items.length));
  const grid = el('div', `bank-grid ${side}`);
  items.forEach((item, i) => grid.append(slot(side, i, item, all, handlers, changed.has(i))));
  // Soltar sobre el panel (no sobre un hueco) lo lleva al primer sitio libre de ese lado.
  section.ondragover = e => {
    if (!drag || drag.side === side || !canDrop(side, null, all)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };
  section.ondrop = e => {
    e.preventDefault();
    const root = section.closest('.bank');
    if (drag && drag.side !== side && canDrop(side, null, all)) drop(side, null, handlers);
    if (root) clearDragMarks(root);
  };
  section.append(head, grid);
  return section;
}

function ledger(d: CharData, bank: BankState, handlers: BankHandlers) {
  const form = el('form', 'bank-ledger');
  const heading = el('header', 'bank-ledger-heading');
  heading.append(el('h3', undefined, t('Mover pelines')), el('p', undefined, t('Elige una cantidad y decide dónde guardarla.')));
  const balance = (label: string, amount: number, cls: string) => {
    const button = el('button', `bank-balance ${cls}`) as HTMLButtonElement;
    button.type = 'button';
    button.innerHTML = currencyIcon('pelines');
    const text = el('span');
    text.append(el('small', undefined, t(label)), el('b', undefined, amount.toLocaleString()), el('em', undefined, t('Usar todo')));
    button.append(text);
    button.title = `${t(label)}|${t('Usar todo como cantidad')}`;
    button.setAttribute('aria-label', `${t(label)}: ${amount.toLocaleString()} · ${t('Usar todo como cantidad')}`);
    button.disabled = amount <= 0;
    return button;
  };
  const wallet = balance('En la bolsa', d.wallet.pelines, 'wallet');
  const stored = balance('En el banco', bank.pelines, 'stored');
  const balances = el('div', 'bank-ledger-balances');
  balances.append(stored, wallet);
  const middle = el('div', 'bank-ledger-middle');
  const amountLabel = el('label', 'bank-amount');
  amountLabel.append(el('span', undefined, t('Cantidad')));
  const input = el('input') as HTMLInputElement;
  input.type = 'number'; input.min = '1'; input.step = '1'; input.inputMode = 'numeric'; input.placeholder = '0';
  input.setAttribute('aria-label', t('Cantidad de pelines'));
  amountLabel.append(input);
  const chips = el('div', 'bank-chips');
  for (const amount of [10, 100, 1000]) {
    const chip = el('button', 'bank-chip', `+${amount}`) as HTMLButtonElement;
    chip.type = 'button';
    chip.setAttribute('aria-label', t('Añadir {amount} pelines', { amount }));
    chip.onclick = () => { input.value = String(Math.floor(Number(input.value) || 0) + amount); refresh(); input.focus(); };
    chips.append(chip);
  }
  const withdraw = el('button', 'btn bank-move withdraw') as HTMLButtonElement;
  withdraw.type = 'button';
  withdraw.innerHTML = '<span aria-hidden="true">→</span>';
  withdraw.append(t('Retirar'));
  withdraw.setAttribute('aria-label', t('Retirar pelines del banco a la bolsa'));
  withdraw.title = t('Transferir del banco a la bolsa');
  const deposit = el('button', 'btn gold bank-move deposit') as HTMLButtonElement;
  deposit.type = 'submit';
  deposit.append(t('Guardar'));
  deposit.insertAdjacentHTML('beforeend', '<span aria-hidden="true">←</span>');
  deposit.setAttribute('aria-label', t('Guardar pelines de la bolsa en el banco'));
  deposit.title = t('Transferir de la bolsa al banco');
  const amount = () => Math.floor(Number(input.value));
  const refresh = () => {
    const n = amount();
    deposit.disabled = !(n > 0 && n <= d.wallet.pelines);
    withdraw.disabled = !(n > 0 && n <= bank.pelines);
  };
  input.oninput = refresh;
  wallet.onclick = () => { input.value = String(d.wallet.pelines); refresh(); input.focus(); };
  stored.onclick = () => { input.value = String(bank.pelines); refresh(); input.focus(); };
  withdraw.onclick = () => { const n = amount(); if (n > 0 && n <= bank.pelines) handlers.onWithdrawPelines(n); };
  form.onsubmit = e => { e.preventDefault(); const n = amount(); if (n > 0 && n <= d.wallet.pelines) handlers.onDepositPelines(n); };
  refresh();
  middle.append(amountLabel, chips);
  const actions = el('div', 'bank-ledger-actions');
  actions.append(withdraw, deposit);
  form.append(heading, balances, middle, actions);
  return form;
}

export function renderBank(container: HTMLElement, d: CharData, bank: BankState | null, handlers: BankHandlers) {
  container.replaceChildren();
  drag = null;
  const top = el('div', 'bank-top');
  const emblem = el('span', 'bank-emblem');
  emblem.innerHTML = CHEST_ICON;
  const copy = el('div', 'bank-heading');
  copy.append(el('strong', undefined, t('Baúl de la cuenta')), el('p', undefined, t('Lo que guardes aquí lo compartirán todos tus personajes.')));
  top.append(emblem, copy);
  if (!bank) {
    previous = null;
    container.append(top, el('p', 'bank-loading', t('Abriendo el baúl…')));
    return;
  }

  const bag = d.inventory.slice(0, INVENTORY_UNLOCKED);
  const now: Record<Side, string[]> = { bank: bank.items.map(signature), bag: bag.map(signature) };
  const changed = (side: Side) => new Set(previous ? now[side].flatMap((sig, i) => sig && sig !== previous![side][i] ? [i] : []) : []);
  const items = { bank: bank.items, bag };

  // Buscador y «Guardar todo».
  const tools = el('div', 'bank-tools');
  const search = el('label', 'bank-search');
  search.innerHTML = SEARCH_ICON;
  const query = el('input') as HTMLInputElement;
  query.type = 'search'; query.placeholder = t('Buscar objeto…'); query.value = filter;
  query.setAttribute('aria-label', t('Buscar objeto'));
  search.append(query);
  const depositAll = el('button', 'btn bank-deposit-all') as HTMLButtonElement;
  depositAll.type = 'button';
  depositAll.innerHTML = ARROWS_ICON;
  depositAll.append(t('Guardar todo'));
  depositAll.title = `${t('Guardar todo')}|${t('Guarda en el baúl todo lo de la mochila que no esté ligado.')}`;
  depositAll.disabled = !bag.some(item => item && isBankable(item));
  depositAll.onclick = () => handlers.onDepositAll();
  tools.append(search, depositAll);
  top.append(tools);

  const wrap = el('div', 'bank');
  const vault = panel('bank', 'Baúl', CHEST_ICON, bank.items, items, handlers, changed('bank'));
  const bagPanel = panel('bag', 'Mochila', BAG_ICON, bag, items, handlers, changed('bag'));
  const gutter = el('div', 'bank-gutter');
  gutter.innerHTML = ARROWS_ICON;
  gutter.append(el('span', undefined, t('Arrastra')));
  wrap.append(vault, gutter, bagPanel);

  const applyFilter = () => {
    filter = query.value.trim().toLocaleLowerCase();
    wrap.classList.toggle('filtering', !!filter);
    wrap.querySelectorAll<HTMLElement>('.bank-slot.filled').forEach(cell => cell.classList.toggle('bank-hit', !!filter && !!cell.dataset.name?.includes(filter)));
  };
  query.oninput = applyFilter;
  applyFilter();

  const hint = el('p', 'bank-hint', t('Arrastra los objetos entre el baúl y la mochila, o dentro de cada uno para ordenarlos. Un clic los lleva enteros al otro lado. Los objetos ligados no se pueden guardar.'));
  container.append(top, wrap, ledger(d, bank, handlers), hint);
  previous = now;
}

// Barra de acceso rápido (teclas 1-0): por ahora solo guarda objetos usables, como las pociones.
// La barra es solo una disposición de la interfaz: qué objeto hay en cada hueco se guarda en el navegador,
// pero usar el objeto (efecto, existencias) lo decide siempre el servidor.
import { itemDef, itemIcon } from '../data/items';
import { t } from './i18n';
import { setItemTooltip } from './itemTooltip';

export const ACTION_BAR_SIZE = 10;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const DRAG_TYPE = 'application/x-brumaluz-item';

export interface ActionBarHooks {
  /** Clave de almacenamiento del personaje actual. */
  storageKey: () => string;
  /** Unidades del objeto que hay ahora en la mochila. */
  count: (item: string) => number;
  /** Se pidió usar el objeto del hueco. */
  use: (item: string) => void;
}

let hooks: ActionBarHooks;
const emptyPage = (): (string | null)[] => Array(ACTION_BAR_SIZE).fill(null);
export const ACTION_BAR_PAGES = 2;
let pages = Array.from({ length: ACTION_BAR_PAGES }, emptyPage);
let page = 0;
let slots = pages[0];
let loadedKey = '';
let signature = '';

const root = () => document.querySelector<HTMLElement>('#action-bar')!;

function load() {
  const key = hooks.storageKey();
  if (key === loadedKey) return;
  loadedKey = key;
  pages = Array.from({ length: ACTION_BAR_PAGES }, emptyPage);
  page = 0;
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    // Formato antiguo: una sola lista plana de huecos.
    const saved: unknown[][] = Array.isArray(raw) && raw.every((p) => !Array.isArray(p)) ? [raw] : Array.isArray(raw) ? raw : [];
    saved.slice(0, ACTION_BAR_PAGES).forEach((p, n) => {
      if (Array.isArray(p)) p.slice(0, ACTION_BAR_SIZE).forEach((id, i) => { if (typeof id === 'string' && itemDef(id)?.usable) pages[n][i] = id; });
    });
  } catch { /* datos corruptos: barra vacía */ }
  slots = pages[0];
  signature = '';
}

function save() {
  localStorage.setItem(loadedKey, JSON.stringify(pages));
  signature = '';
}

/** Tecla Z: alterna entre la barra principal y la secundaria. */
export function toggleActionBarPage() {
  load();
  page = (page + 1) % ACTION_BAR_PAGES;
  slots = pages[page];
  renderActionBar(true);
}

/** Dibuja la barra solo si algo ha cambiado (para no romper el arrastre ni los tooltips). */
export function renderActionBar(force = false) {
  load();
  const next = `${page}|${slots.map((id) => (id ? `${id}:${hooks.count(id)}` : '-')).join(',')}`;
  if (!force && next === signature) return;
  signature = next;
  const switcher = document.createElement('button');
  switcher.type = 'button';
  switcher.className = 'ab-page';
  switcher.title = `${t('Cambiar de barra')}|${t('Alterna entre la barra principal y la secundaria.')}`;
  switcher.innerHTML = `<kbd>Z</kbd><span>${page + 1}</span>`;
  switcher.onclick = () => { toggleActionBarPage(); switcher.blur(); };
  root().replaceChildren(switcher, ...slots.map((id, i) => slotElement(id, i)));
  if (force) {
    const bar = root();
    bar.classList.remove('flipping');
    void bar.offsetWidth;
    bar.classList.add('flipping');
    bar.style.setProperty('--ab-dir', page === 0 ? '-1' : '1');
  }
}

function slotElement(id: string | null, index: number) {
  const slot = document.createElement('div');
  slot.className = 'ab-slot';
  slot.dataset.index = String(index);
  const key = document.createElement('kbd');
  key.textContent = KEYS[index];
  slot.append(key);
  if (id) {
    const count = hooks.count(id);
    slot.classList.add('filled');
    slot.classList.toggle('empty', count === 0);
    setItemTooltip(slot, id);
    slot.tabIndex = 0;
    slot.insertAdjacentHTML('afterbegin', itemIcon(id));
    const amount = document.createElement('i');
    amount.textContent = String(count);
    slot.append(amount);
    slot.draggable = true;
    slot.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData(DRAG_TYPE, JSON.stringify({ id, from: index }));
      e.dataTransfer!.effectAllowed = 'move';
    });
  } else slot.title = `${t('Hueco vacío')}|${t('Arrastra aquí un objeto de la mochila.')}`;
  slot.addEventListener('click', () => { if (id) hooks.use(id); });
  slot.addEventListener('contextmenu', (e) => { e.preventDefault(); if (id) { slots[index] = null; save(); renderActionBar(); } });
  slot.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes(DRAG_TYPE)) { e.preventDefault(); slot.classList.add('over'); } });
  slot.addEventListener('dragleave', () => slot.classList.remove('over'));
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('over');
    const data = e.dataTransfer?.getData(DRAG_TYPE);
    if (!data) return;
    const { id: dropped, from } = JSON.parse(data) as { id: string; from?: number };
    if (!itemDef(dropped)?.usable) return;
    if (typeof from === 'number') slots[from] = slots[index];
    else for (const p of pages) p.forEach((s, n) => { if (s === dropped) p[n] = null; });
    slots[index] = dropped;
    save();
    renderActionBar();
  });
  return slot;
}

/** Pone el objeto en el primer hueco libre si aún no está en la barra (p. ej. al comprarlo). */
export function autoAssignToActionBar(item: string) {
  load();
  if (!itemDef(item)?.usable || pages.some((p) => p.includes(item))) return;
  const free = slots.indexOf(null);
  if (free < 0) return;
  slots[free] = item;
  save();
  renderActionBar();
}

/** Tecla 1-0: usa el objeto del hueco (devuelve si había algo que usar). */
export function useActionBarSlot(index: number) {
  load();
  const id = slots[index];
  if (!id) return false;
  const el = root().children[index + 1];
  el?.classList.remove('pressed');
  void (el as HTMLElement | undefined)?.offsetWidth;
  el?.classList.add('pressed');
  hooks.use(id);
  return true;
}

export const actionBarSlotForKey = (code: string) => (/^Digit[0-9]$/.test(code) ? (Number(code.slice(5)) + 9) % 10 : -1);

export const DRAG_ITEM_TYPE = DRAG_TYPE;

export function initActionBar(h: ActionBarHooks) {
  hooks = h;
  renderActionBar(true);
  document.addEventListener('brumaluz-language-change', () => renderActionBar(true));
}

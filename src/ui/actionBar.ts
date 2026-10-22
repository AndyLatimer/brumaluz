// Barra de acceso rápido (teclas 1-0): objetos usables y habilidades conocidas.
// La barra es solo una disposición de la interfaz: qué objeto hay en cada hueco se guarda en el navegador,
// pero usar el objeto (efecto, existencias) lo decide siempre el servidor.
import { itemDef, itemIcon } from '../data/items';
import { t } from './i18n';
import { setItemTooltip } from './itemTooltip';
import { DRAG_SKILL_TYPE } from './skillsWindow';
import type { ClassId } from '../data/data';
import type { Equipment } from '../data/inventory';
import { setSkillTooltip } from './skillTooltip';

export const ACTION_BAR_SIZE = 10;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const DRAG_TYPE = 'application/x-brumaluz-item';

export interface ActionBarHooks {
  /** Clave de almacenamiento del personaje actual. */
  storageKey: () => string;
  /** Unidades del objeto que hay ahora en la mochila. */
  count: (item: string) => number;
  bound: (item: string) => boolean;
  /** Se pidió usar el objeto del hueco. */
  use: (item: string) => void;
  skill: () => { id: string; cls: ClassId; rank: number; equipment?: Equipment; icon: string; cooldown: number; duration: number; available: boolean };
  useSkill: () => void;
}

let hooks: ActionBarHooks;
const emptyPage = (): (string | null)[] => Array(ACTION_BAR_SIZE).fill(null);
export const ACTION_BAR_PAGES = 2;
let pages = Array.from({ length: ACTION_BAR_PAGES }, emptyPage);
let page = 0;
let slots = pages[0];
let loadedKey = '';
let loadedSkill = '';
let signature = '';

const root = () => document.querySelector<HTMLElement>('#action-bar')!;

function load() {
  const key = hooks.storageKey();
  const skill = hooks.skill().id;
  if (key === loadedKey && skill === loadedSkill) return;
  loadedKey = key;
  loadedSkill = skill;
  pages = Array.from({ length: ACTION_BAR_PAGES }, emptyPage);
  page = 0;
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    // Formato antiguo: una sola lista plana de huecos.
    const saved: unknown[][] = Array.isArray(raw) && raw.every((p) => !Array.isArray(p)) ? [raw] : Array.isArray(raw) ? raw : [];
    saved.slice(0, ACTION_BAR_PAGES).forEach((p, n) => {
      if (Array.isArray(p)) p.slice(0, ACTION_BAR_SIZE).forEach((id, i) => { if (typeof id === 'string' && (itemDef(id)?.usable || id === hooks.skill().id)) pages[n][i] = id; });
    });
  } catch { /* datos corruptos: barra vacía */ }
  slots = pages[0];
  if (!localStorage.getItem(`${key}:learned:${skill}`)) {
    const freePage = pages.find(p => p.includes(null));
    if (freePage) {
      if (!pages.some(p => p.includes(skill))) freePage[freePage.indexOf(null)] = skill;
      localStorage.setItem(`${key}:learned:${skill}`, 'true');
      save();
    }
  }
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
  const skill = hooks.skill();
  const next = `${page}|${skill.id}:${skill.rank}:${skill.available}:${skill.equipment?.weapon?.id}:${skill.equipment?.offhand?.id}|${slots.map((id) => (id ? `${id}:${hooks.count(id)}:${hooks.bound(id)}` : '-')).join(',')}`;
  const updateCooldown = () => {
    root().querySelectorAll<HTMLElement>('.ab-slot[data-skill-id]').forEach(slot => {
      const recovering = skill.cooldown > 0;
      const wasRecovering = slot.classList.contains('on-cooldown');
      slot.classList.toggle('on-cooldown', recovering);
      slot.style.setProperty('--cooldown-sweep', `${Math.min(1, skill.cooldown / skill.duration) * 360}deg`);
      const timer = slot.querySelector<HTMLElement>('.ab-cooldown-time');
      if (timer) timer.textContent = recovering ? skill.cooldown < 1 ? skill.cooldown.toFixed(1) : String(Math.ceil(skill.cooldown)) : '';
      slot.setAttribute('aria-description', t(recovering ? 'Recuperándose: {n} s' : 'Habilidad lista', { n: Math.ceil(skill.cooldown) }));
      if (wasRecovering && !recovering) {
        slot.classList.remove('skill-ready'); void slot.offsetWidth; slot.classList.add('skill-ready');
      }
    });
  };
  if (!force && next === signature) { updateCooldown(); return; }
  signature = next;
  const switcher = document.createElement('button');
  switcher.type = 'button';
  switcher.className = 'ab-page';
  switcher.title = `${t('Cambiar de barra')}|${t('Alterna entre la barra principal y la secundaria.')}`;
  switcher.innerHTML = `<kbd>Z</kbd><span>${page + 1}</span>`;
  switcher.onclick = () => { toggleActionBarPage(); switcher.blur(); };
  root().replaceChildren(switcher, ...slots.map((id, i) => slotElement(id, i)));
  updateCooldown();
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
    const skill = hooks.skill();
    const isSkill = id.startsWith('skill:');
    const count = hooks.count(id);
    slot.classList.add('filled');
    slot.classList.toggle('empty', isSkill ? !skill.available || id !== skill.id : count === 0);
    slot.classList.toggle('on-cooldown', isSkill && skill.cooldown > 0);
    if (isSkill) {
      setSkillTooltip(slot, skill.cls, skill.rank, skill.equipment);
    } else {
      slot.dataset.itemId = id;
      setItemTooltip(slot, id, hooks.bound(id));
    }
    slot.tabIndex = 0;
    slot.setAttribute('role', 'button');
    if (!isSkill) slot.setAttribute('aria-label', slot.title.split('|')[0]);
    slot.insertAdjacentHTML('afterbegin', isSkill ? skill.icon : itemIcon(id));
    const amount = document.createElement('i');
    amount.textContent = isSkill ? '' : String(count);
    slot.append(amount);
    if (isSkill) {
      const sweep = document.createElement('span'); sweep.className = 'ab-cooldown-sweep'; sweep.setAttribute('aria-hidden','true');
      const timer = document.createElement('span'); timer.className = 'ab-cooldown-time'; timer.setAttribute('aria-hidden','true');
      slot.append(sweep, timer);
    }
    slot.draggable = true;
    slot.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData(DRAG_TYPE, JSON.stringify({ id, from: index, page }));
      e.dataTransfer!.effectAllowed = 'move';
    });
  } else slot.title = `${t('Hueco vacío')}|${t('Arrastra aquí un objeto o una habilidad.')}`;
  const use = () => { if (id) { if (id === hooks.skill().id) hooks.useSkill(); else if (!id.startsWith('skill:')) hooks.use(id); } };
  slot.addEventListener('click', use);
  slot.addEventListener('keydown', event => { if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); event.stopPropagation(); if (!event.repeat) use(); } });
  slot.addEventListener('contextmenu', (e) => { e.preventDefault(); if (id) { slots[index] = null; save(); renderActionBar(); } });
  slot.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.some(type => type === DRAG_TYPE || type === DRAG_SKILL_TYPE)) { e.preventDefault(); slot.classList.add('over'); } });
  slot.addEventListener('dragleave', () => slot.classList.remove('over'));
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('over');
    const skillDrop = e.dataTransfer?.getData(DRAG_SKILL_TYPE);
    if (skillDrop) {
      if (skillDrop !== hooks.skill().id) return;
      for (const p of pages) p.forEach((s, n) => { if (s === skillDrop) p[n] = null; });
      slots[index] = skillDrop;
      save(); renderActionBar();
      return;
    }
    const data = e.dataTransfer?.getData(DRAG_TYPE);
    if (!data) return;
    let parsed: unknown;
    try { parsed = JSON.parse(data); } catch { console.warn('Invalid action-bar drag payload'); return; }
    if (!parsed || typeof parsed !== 'object' || !('id' in parsed) || typeof parsed.id !== 'string') { console.warn('Invalid action-bar drag payload'); return; }
    const dropped = parsed.id;
    if (!itemDef(dropped)?.usable && dropped !== hooks.skill().id) return;
    const from = 'from' in parsed ? parsed.from : undefined;
    const fromPage = 'page' in parsed ? parsed.page : page;
    if (typeof from === 'number') {
      if (!Number.isInteger(from) || from < 0 || from >= ACTION_BAR_SIZE || typeof fromPage !== 'number' || !Number.isInteger(fromPage) || fromPage < 0 || fromPage >= ACTION_BAR_PAGES || pages[fromPage][from] !== dropped) { console.warn('Stale action-bar drag payload'); return; }
      pages[fromPage][from] = slots[index];
    }
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

export function assignSkillToActionBar(id: string) {
  load();
  if (id !== hooks.skill().id) return false;
  if (pages.some(p => p.includes(id))) return true;
  const freePage = pages.find(p => p.includes(null));
  if (!freePage) return false;
  freePage[freePage.indexOf(null)] = id;
  save(); renderActionBar();
  return true;
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
  if (id === hooks.skill().id) hooks.useSkill();
  else if (!id.startsWith('skill:')) hooks.use(id);
  return true;
}

export const actionBarSlotForKey = (code: string) => (/^Digit[0-9]$/.test(code) ? (Number(code.slice(5)) + 9) % 10 : -1);

export const DRAG_ITEM_TYPE = DRAG_TYPE;

export function initActionBar(h: ActionBarHooks) {
  hooks = h;
  renderActionBar(true);
  document.addEventListener('brumaluz-language-change', () => renderActionBar(true));
}

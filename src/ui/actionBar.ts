// Barra de acceso rápido (teclas 1-0): objetos usables y habilidades conocidas.
// La barra es solo una disposición de la interfaz: qué objeto hay en cada hueco se guarda en el navegador,
// pero usar el objeto (efecto, existencias) lo decide siempre el servidor.
import { itemDef, itemIcon } from '../data/items';
import { t } from './i18n';
import { setItemTooltip } from './itemTooltip';
import { DRAG_SKILL_TYPE } from './skillsWindow';
import type { ClassId } from '../data/data';
import type { Equipment } from '../data/inventory';
import { setSkillTooltip, skillTooltipEquipment } from './skillTooltip';

export const ACTION_BAR_SIZE = 10;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const DRAG_TYPE = 'application/x-brumaluz-item';

export interface CombatActionFeedback {
  state: 'idle' | 'approaching' | 'casting' | 'recovering' | 'resolving';
  /** Seconds remaining in the current preparation/recovery. */
  remaining: number;
  duration: number;
  interruptible?: boolean;
}

interface ActionBarSkill {
  id: string; cls: ClassId; rank: number; equipment?: Equipment; icon: string;
  cooldown: number; duration: number; available: boolean;
  unavailableReason?: 'dead' | 'weapon' | 'resource';
  resource?: number;
  cost?: number;
}

export interface ActionBarHooks {
  /** Clave de almacenamiento del personaje actual. */
  storageKey: () => string;
  /** Unidades del objeto que hay ahora en la mochila. */
  count: (item: string) => number;
  bound: (item: string) => boolean;
  /** Se pidió usar el objeto del hueco. */
  use: (item: string) => void;
  skill: () => ActionBarSkill;
  useSkill: () => void;
  itemCooldown?:()=>number;
  feedback?: () => CombatActionFeedback;
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
let nextStructureAt = 0;
let cachedRoot: HTMLElement | null = null;
let skillSlots: { slot: HTMLElement; timer: HTMLElement }[] = [];
let potionSlots: { slot: HTMLElement; timer: HTMLElement }[] = [];
const pressAnimations = new WeakMap<HTMLElement, Animation>();
let explainUntil = 0, explained = '';
let nextVisualAt = 0;
let languageListenerInstalled = false;

/** Keep a rejected input on its slot, without interrupting the fight with prose. */
export function explainAction(message:string){
  explained=message;explainUntil=performance.now()+650;
  for(const {slot} of skillSlots)pressSlot(slot,false);
  if(hooks)updateActionState(hooks.skill(),true);
}

const root = () => cachedRoot?.isConnected ? cachedRoot : cachedRoot = document.querySelector<HTMLElement>('#action-bar')!;

function load(skillId = hooks.skill().id) {
  const key = hooks.storageKey();
  const skill = skillId;
  if (key === loadedKey && skill === loadedSkill) return;
  loadedKey = key;
  loadedSkill = skill;
  explainUntil = 0; explained = '';
  nextVisualAt = 0;
  pages = Array.from({ length: ACTION_BAR_PAGES }, emptyPage);
  page = 0;
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    // Formato antiguo: una sola lista plana de huecos.
    const saved: unknown[][] = Array.isArray(raw) && raw.every((p) => !Array.isArray(p)) ? [raw] : Array.isArray(raw) ? raw : [];
    saved.slice(0, ACTION_BAR_PAGES).forEach((p, n) => {
      if (Array.isArray(p)) p.slice(0, ACTION_BAR_SIZE).forEach((id, i) => { if (typeof id === 'string' && (itemDef(id)?.usable || id === skill)) pages[n][i] = id; });
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

/** The tutorial follows the player's actual binding, including the other bar. */
export function actionBarSkillBinding(){
  load();
  const id=hooks.skill().id;
  for(let n=0;n<pages.length;n++){const index=pages[n].indexOf(id);if(index>=0)return{key:KEYS[index],otherPage:n!==page};}
  return null;
}

/** Dibuja la barra solo si algo ha cambiado (para no romper el arrastre ni los tooltips). */
export function renderActionBar(force = false) {
  const skill = hooks.skill();
  load(skill.id);
  const now = performance.now();
  // Inventario y tooltips no necesitan rehacerse a la frecuencia del render 3D.
  // El reloj de las recargas sí se actualiza suavemente cada frame.
  if (!force && signature && now < nextStructureAt) { updateActionState(skill); return; }
  nextStructureAt = now + 100;
  const next = `${page}|${skill.id}:${skill.rank}:${JSON.stringify(skill.equipment)}|${slots.map((id) => (id ? `${id}:${hooks.count(id)}:${hooks.bound(id)}` : '-')).join(',')}`;
  if (!force && next === signature) { updateActionState(skill); return; }
  signature = next;
  const focusedIndex = document.activeElement instanceof HTMLElement && root().contains(document.activeElement)
    ? document.activeElement.dataset.index : undefined;
  skillSlots = []; potionSlots = [];
  const switcher = document.createElement('button');
  switcher.type = 'button';
  switcher.className = 'ab-page';
  switcher.title = `${t('Cambiar de barra')}|${t('Alterna entre la barra principal y la secundaria.')}`;
  switcher.innerHTML = `<kbd>Z</kbd><span>${page + 1}</span>`;
  switcher.onclick = () => { toggleActionBarPage(); switcher.blur(); };
  root().replaceChildren(switcher, ...slots.map((id, i) => slotElement(id, i, skill)));
  if (focusedIndex !== undefined) root().querySelector<HTMLElement>(`[data-index="${focusedIndex}"]`)?.focus({preventScroll:true});
  updateActionState(skill,true);
  if (force) {
    const bar = root();
    bar.classList.remove('flipping');
    void bar.offsetWidth;
    bar.classList.add('flipping');
    bar.style.setProperty('--ab-dir', page === 0 ? '-1' : '1');
  }
}

function setText(target: HTMLElement, value: string) {
  if (target.textContent !== value) target.textContent = value;
}

function setAttribute(target: HTMLElement, name: string, value: string) {
  if (target.getAttribute(name) !== value) target.setAttribute(name, value);
}

function cooldownState(slot: HTMLElement, timer: HTMLElement, remaining: number, duration: number) {
  remaining = Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
  duration = Number.isFinite(duration) ? Math.max(.01, duration) : .01;
  const recovering = remaining > 0;
  const wasRecovering = slot.classList.contains('on-cooldown');
  slot.classList.toggle('on-cooldown', recovering);
  const sweep = `${(Math.min(1, remaining / duration) * 360).toFixed(1)}deg`;
  if(slot.style.getPropertyValue('--cooldown-sweep')!==sweep)slot.style.setProperty('--cooldown-sweep', sweep);
  setText(timer, recovering ? remaining < 1 ? (Math.ceil(remaining * 10) / 10).toFixed(1) : String(Math.ceil(remaining)) : '');
  if (recovering) slot.classList.remove('skill-ready');
  else if (wasRecovering && !slot.classList.contains('empty')) slot.classList.add('skill-ready');
}

function updateActionState(skill: ActionBarSkill,immediate=false) {
  const now=performance.now();
  if(!immediate&&now<nextVisualAt)return;
  nextVisualAt=now+1000/30;
  const feedback = hooks.feedback?.();
  for (const { slot, timer } of skillSlots) {
    // Full server snapshots replace equipment objects even when their values match.
    // Keep the tooltip's live attribute context without rebuilding the action slot.
    if(skillTooltipEquipment(slot)!==skill.equipment)setSkillTooltip(slot,skill.cls,skill.rank,skill.equipment);
    const unavailable = !skill.available;
    slot.classList.toggle('empty', unavailable);
    slot.classList.toggle('insufficient-resource', skill.unavailableReason === 'resource');
    const busy=feedback?.state==='casting'||feedback?.state==='recovering'&&!feedback.interruptible;
    setAttribute(slot, 'aria-disabled', String(unavailable||skill.cooldown>0||busy));
    cooldownState(slot, timer, skill.cooldown, skill.duration);
    const state = feedback?.state==='casting'? 'casting' : unavailable||feedback?.interruptible||feedback?.state==='resolving' ? 'idle' : feedback?.state ?? 'idle';
    slot.classList.toggle('action-rejected',now<explainUntil);
    if (slot.dataset.actionState !== state) slot.dataset.actionState = state;
    if (feedback && (state === 'casting' || state === 'recovering')) {
      slot.style.setProperty('--action-progress', `${Math.max(0, Math.min(1, 1 - feedback.remaining / Math.max(.01, feedback.duration))) * 100}%`);
    }
    const status = state === 'casting' ? t('Preparando habilidad.')
      : skill.cooldown > 0 ? t('Recuperándose: {n} s', { n: skill.cooldown < 1 ? (Math.ceil(skill.cooldown * 10) / 10).toFixed(1) : Math.ceil(skill.cooldown) })
      : skill.unavailableReason === 'dead' ? t('Debes volver a la vida.')
      : skill.unavailableReason === 'weapon' ? t('Equipa un arma de tu clase.')
      : skill.unavailableReason === 'resource' ? t('Recurso insuficiente: {current} / {cost}.', { current: Math.floor(skill.resource ?? 0), cost: Math.ceil(skill.cost ?? 0) })
      : state === 'recovering' ? t('Terminando la habilidad: {n} s',{n:feedback!.remaining.toFixed(1)})
      : state === 'approaching' ? t('Acercándote para usar la habilidad.')
      : t('Habilidad lista');
    setAttribute(slot, 'aria-description', now<explainUntil?explained:status);
  }
  const itemCooldown = hooks.itemCooldown?.() ?? 0;
  for (const { slot, timer } of potionSlots) {
    const unavailable = hooks.count(slot.dataset.itemId!) <= 0 || skill.unavailableReason === 'dead';
    slot.classList.toggle('empty',unavailable);
    cooldownState(slot, timer, itemCooldown, 15);
    setAttribute(slot,'aria-disabled',String(unavailable||itemCooldown>0));
    setAttribute(slot,'aria-description',skill.unavailableReason==='dead'?t('Debes volver a la vida.'):unavailable?t('No te quedan'):itemCooldown>0?t('Recuperándose: {n} s',{n:Math.ceil(itemCooldown)}):t('Objeto listo'));
  }
}

function pressSlot(slot: HTMLElement, available = true) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  pressAnimations.get(slot)?.cancel();
  // Web Animations reinicia la respuesta de cada pulsación sin forzar un layout.
  const animation = slot.animate(available ? [
    { transform: 'translateY(1px) scale(.94)', boxShadow: 'inset 0 0 12px #efd29980' },
    { transform: 'none', boxShadow: 'inset 0 0 0 #efd29900' },
  ] : [
    { boxShadow: 'inset 0 0 0 1px #e39076,0 0 8px #bf594960' },
    { boxShadow: 'inset 0 0 0 1px transparent,0 0 0 transparent' },
  ], { duration: 180, easing: 'ease-out' });
  pressAnimations.set(slot, animation);
}

function slotElement(id: string | null, index: number, skill: ActionBarSkill) {
  const slot = document.createElement('div');
  slot.className = 'ab-slot';
  slot.dataset.index = String(index);
  const key = document.createElement('kbd');
  key.textContent = KEYS[index];
  slot.append(key);
  if (id) {
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
    if (isSkill || itemDef(id)?.restore) {
      const sweep = document.createElement('span'); sweep.className = 'ab-cooldown-sweep'; sweep.setAttribute('aria-hidden','true');
      const timer = document.createElement('span'); timer.className = 'ab-cooldown-time'; timer.setAttribute('aria-hidden','true');
      slot.append(sweep, timer);
      (isSkill ? skillSlots : potionSlots).push({ slot, timer });
      if (isSkill) {
        const progress = document.createElement('span'); progress.className = 'ab-action-progress'; progress.setAttribute('aria-hidden', 'true');
        slot.append(progress);
      }
    }
    slot.draggable = true;
    slot.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData(DRAG_TYPE, JSON.stringify({ id, from: index, page }));
      e.dataTransfer!.effectAllowed = 'move';
    });
  } else slot.title = `${t('Hueco vacío')}|${t('Arrastra aquí un objeto o una habilidad.')}`;
  const use = () => { if (id) useActionBarSlot(index); };
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
  const skill = hooks.skill();
  const el = root().children[index + 1] as HTMLElement | undefined;
  const potionCooldown = itemDef(id)?.restore ? Math.max(0,hooks.itemCooldown?.()??0) : 0;
  const dead=skill.unavailableReason==='dead';
  const feedback=hooks.feedback?.();
  const busy=feedback?.state==='casting'||feedback?.state==='recovering'&&!feedback.interruptible;
  const available = id===skill.id ? skill.available&&skill.cooldown<=0&&!busy : !dead&&hooks.count(id)>0&&potionCooldown<=0;
  if (el) pressSlot(el,available);
  if (!available) {
    explained = id === skill.id ? skill.unavailableReason === 'dead' ? t('Debes volver a la vida.')
      : skill.unavailableReason === 'weapon' ? t('Equipa un arma de tu clase.')
      : skill.unavailableReason === 'resource' ? t('Recurso insuficiente: {current} / {cost}.',{current:Math.floor(skill.resource??0),cost:Math.ceil(skill.cost??0)})
      : busy ? t('Espera a que termine el golpe actual.')
      : t('Recuperándose: {n} s',{n:Math.ceil(skill.cooldown)})
      : dead?t('Debes volver a la vida.'):potionCooldown>0?t('Recuperándose: {n} s',{n:Math.ceil(potionCooldown)}):t('No te quedan');
    explainUntil=performance.now()+650;updateActionState(skill,true);
    return true;
  } else { explainUntil=0;explained=''; }
  if (id === skill.id) hooks.useSkill();
  else if (!id.startsWith('skill:')) hooks.use(id);
  return true;
}

export const actionBarSlotForKey = (code: string) => (/^Digit[0-9]$/.test(code) ? (Number(code.slice(5)) + 9) % 10 : -1);

export const DRAG_ITEM_TYPE = DRAG_TYPE;

export function initActionBar(h: ActionBarHooks) {
  hooks = h;
  renderActionBar(true);
  if(!languageListenerInstalled){document.addEventListener('brumaluz-language-change', () => {explainUntil=0;renderActionBar(true);});languageListenerInstalled=true;}
}

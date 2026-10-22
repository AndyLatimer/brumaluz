// Tooltip genérico con el estilo del juego. Reutiliza el atributo estándar `title`:
// basta con poner `title="..."` (o `el.title = ...`) en cualquier elemento y se mostrará aquí.
// Mientras el elemento está bajo el cursor o con foco, el `title` se guarda en `data-tip`
// para que no salga el tooltip nativo, y se restaura al salir (así i18n sigue funcionando).
// Para tooltips con título y texto usa "Título|Descripción".
import { renderItemTooltip } from './itemTooltip';
import { renderSkillTooltip, skillTooltipEquipment } from './skillTooltip';
import { COMBAT_KITS } from '../data/combat';
import type { ClassId } from '../data/data';

let tip: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
let showTimer = 0;
let frame = 0;

function ensureTip() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'game-tooltip';
  tip.id = 'game-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);
  return tip;
}

function stash(el: HTMLElement) {
  const title = el.getAttribute('title');
  if (title) {
    el.dataset.tip = title;
    el.removeAttribute('title');
  }
}

function restore(el: HTMLElement) {
  if (el.dataset.tip !== undefined && !el.hasAttribute('title')) el.setAttribute('title', el.dataset.tip);
  delete el.dataset.tip;
}

function place(target: HTMLElement) {
  const box = ensureTip();
  const r = target.getBoundingClientRect();
  const w = box.offsetWidth, h = box.offsetHeight, gap = 10;
  let x = r.left + r.width / 2 - w / 2;
  let y = r.bottom + gap;
  let below = true;
  if ((target.dataset.itemId || target.dataset.skillClass) && (r.right + gap + w <= window.innerWidth - 6 || r.left - gap - w >= 6)) {
    x = r.right + gap + w <= window.innerWidth - 6 ? r.right + gap : r.left - gap - w;
    y = r.top;
  } else if (y + h > window.innerHeight - 6) { y = r.top - h - gap; below = false; }
  x = Math.min(Math.max(x, 6), window.innerWidth - w - 6);
  y = Math.max(6, Math.min(y, window.innerHeight - h - 6));
  box.style.left = `${Math.round(x)}px`;
  box.style.top = `${Math.round(y)}px`;
  box.dataset.side = below ? 'below' : 'above';
  box.style.setProperty('--arrow-x', `${Math.round(Math.min(Math.max(r.left + r.width / 2 - x, 14), w - 14))}px`);
}

function show(target: HTMLElement) {
  const text = target.dataset.tip;
  const item = target.dataset.itemId;
  const cls = target.dataset.skillClass;
  const skillClass = cls && Object.prototype.hasOwnProperty.call(COMBAT_KITS, cls) ? cls as ClassId : null;
  if ((!text && !item && !skillClass) || !target.isConnected || !target.getClientRects().length) { hide(); return; }
  const box = ensureTip();
  box.replaceChildren();
  box.classList.toggle('item-tooltip', !!item || !!skillClass);
  box.classList.toggle('skill-tooltip', !!skillClass);
  if (skillClass) renderSkillTooltip(box, skillClass, Number(target.dataset.skillRank), skillTooltipEquipment(target));
  else if (item) renderItemTooltip(box, item, target.dataset.itemBound === 'true');
  else {
    const [head, body] = text!.includes('|') ? text!.split('|', 2) : [text!, ''];
    const strong = document.createElement('strong');
    strong.textContent = head;
    box.append(strong);
    if (body) {
      const p = document.createElement('span');
      p.textContent = body;
      box.append(p);
    }
  }
  box.hidden = false;
  const describedBy = new Set((target.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
  describedBy.add(box.id);
  target.setAttribute('aria-describedby', [...describedBy].join(' '));
  place(target);
  const watch = () => {
    if (!target.isConnected || !target.getClientRects().length) { hide(); return; }
    box.classList.add('visible');
    frame = requestAnimationFrame(watch);
  };
  frame = requestAnimationFrame(watch);
}

function hide() {
  window.clearTimeout(showTimer);
  cancelAnimationFrame(frame);
  if (current) {
    restore(current);
    const describedBy = (current.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== tip?.id);
    if (describedBy.length) current.setAttribute('aria-describedby', describedBy.join(' '));
    else current.removeAttribute('aria-describedby');
  }
  current = null;
  if (tip) { tip.classList.remove('visible'); tip.hidden = true; }
}

function enter(el: HTMLElement | null) {
  if (!el || el === current) return;
  hide();
  stash(el);
  if (!el.dataset.tip && !el.dataset.itemId && !el.dataset.skillClass) return;
  current = el;
  showTimer = window.setTimeout(() => show(el), 280);
}

export function initTooltips() {
  const find = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-item-id], [data-skill-class], [title], [data-tip]') : null);
  document.addEventListener('pointerover', (e) => { if (e.pointerType !== 'touch') enter(find(e)); });
  document.addEventListener('pointerout', (e) => {
    const el = find(e);
    if (el && el === current && !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) hide();
  });
  document.addEventListener('focusin', (e) => enter(find(e)));
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide);
  window.addEventListener('scroll', () => {
    const target = current;
    hide();
    if (target) requestAnimationFrame(() => {
      if (!current && target.isConnected && target.matches(':hover, :focus')) enter(target);
    });
  }, true);
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  document.addEventListener('brumaluz-language-change', hide);
}

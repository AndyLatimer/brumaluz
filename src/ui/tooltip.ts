// Tooltip genérico con el estilo del juego. Reutiliza el atributo estándar `title`:
// basta con poner `title="..."` (o `el.title = ...`) en cualquier elemento y se mostrará aquí.
// Mientras el elemento está bajo el cursor o con foco, el `title` se guarda en `data-tip`
// para que no salga el tooltip nativo, y se restaura al salir (así i18n sigue funcionando).
// Para tooltips con título y texto usa "Título|Descripción".

let tip: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
let showTimer = 0;

function ensureTip() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'game-tooltip';
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
  if (y + h > window.innerHeight - 6) { y = r.top - h - gap; below = false; }
  x = Math.min(Math.max(x, 6), window.innerWidth - w - 6);
  box.style.left = `${Math.round(x)}px`;
  box.style.top = `${Math.round(Math.max(y, 6))}px`;
  box.dataset.side = below ? 'below' : 'above';
  box.style.setProperty('--arrow-x', `${Math.round(Math.min(Math.max(r.left + r.width / 2 - x, 14), w - 14))}px`);
}

function show(target: HTMLElement) {
  const text = target.dataset.tip;
  if (!text) return;
  const box = ensureTip();
  const [head, body] = text.includes('|') ? text.split('|', 2) : [text, ''];
  box.replaceChildren();
  const strong = document.createElement('strong');
  strong.textContent = head;
  box.append(strong);
  if (body) {
    const p = document.createElement('span');
    p.textContent = body;
    box.append(p);
  }
  box.hidden = false;
  place(target);
  requestAnimationFrame(() => box.classList.add('visible'));
}

function hide() {
  window.clearTimeout(showTimer);
  if (current) restore(current);
  current = null;
  if (tip) { tip.classList.remove('visible'); tip.hidden = true; }
}

function enter(el: HTMLElement | null) {
  if (!el || el === current) return;
  hide();
  stash(el);
  if (!el.dataset.tip) return;
  current = el;
  showTimer = window.setTimeout(() => show(el), 280);
}

export function initTooltips() {
  const find = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>('[title], [data-tip]') : null);
  document.addEventListener('pointerover', (e) => { if (e.pointerType !== 'touch') enter(find(e)); });
  document.addEventListener('pointerout', (e) => {
    const el = find(e);
    if (el && el === current && !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) hide();
  });
  document.addEventListener('focusin', (e) => enter(find(e)));
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
}

// Animaciones de apertura y cierre para la UI que se muestra/oculta con el atributo `hidden`.
// La lógica del juego sigue usando `hidden` tal cual: al ocultar, el elemento queda marcado
// como oculto al instante, pero se mantiene pintado (inerte y sin eventos) mientras dura la salida.

const CLOSE_MS = 190;
const MAX_CLOSE_MS = 700;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Las pruebas automatizadas comprueban estados al instante; ahí la UI aparece y desaparece en seco.
export const uiMotionEnabled = () => !navigator.webdriver && !reduceMotion.matches;

const closing = new Map<HTMLElement, number>();
const watched = new WeakSet<HTMLElement>();

function finishClose(el: HTMLElement) {
  const timer = closing.get(el);
  if (timer === undefined) return;
  clearTimeout(timer);
  closing.delete(el);
  el.classList.remove('ui-closing');
  el.style.removeProperty('display');
  el.inert = false;
}

function playOpen(el: HTMLElement) {
  finishClose(el);
  el.classList.remove('ui-opening');
  if (!uiMotionEnabled()) return;
  void el.offsetWidth;
  el.classList.add('ui-opening');
}

function playClose(el: HTMLElement, observer: MutationObserver) {
  el.classList.remove('ui-opening');
  if (!uiMotionEnabled() || !el.isConnected) return;
  el.hidden = false;
  const display = getComputedStyle(el).display;
  el.hidden = true;
  observer.takeRecords();
  if (display === 'none') return;
  el.style.setProperty('display', display, 'important');
  el.inert = true;
  el.classList.add('ui-closing');
  // La salida dura lo que la animación más larga del elemento o sus hijos (p. ej. el escalonado de los menús).
  const longest = el.getAnimations({ subtree: true }).reduce((max, animation) => {
    const end = Number(animation.effect?.getComputedTiming().endTime);
    return Number.isFinite(end) ? Math.max(max, end) : max;
  }, 0);
  closing.set(el, window.setTimeout(() => finishClose(el), Math.min(MAX_CLOSE_MS, Math.max(CLOSE_MS, longest + 20))));
}

const observer: MutationObserver = new MutationObserver((records) => {
  const before = new Map<HTMLElement, boolean>();
  for (const record of records) {
    const el = record.target as HTMLElement;
    if (!before.has(el)) before.set(el, record.oldValue !== null);
  }
  for (const [el, wasHidden] of before) {
    if (wasHidden && !el.hidden) playOpen(el);
    else if (!wasHidden && el.hidden) playClose(el, observer);
    else if (!el.hidden) finishClose(el);
  }
});

/** Anima la aparición y desaparición de estos elementos cuando cambie su atributo `hidden`. */
export function animateVisibility(...elements: (HTMLElement | null | undefined)[]) {
  for (const el of elements) {
    if (!el || watched.has(el)) continue;
    watched.add(el);
    observer.observe(el, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
  }
}

/** Marca el documento para que el CSS active las transiciones de la UI y anima la entrada del HUD. */
export function initUiMotion() {
  const sync = () => document.documentElement.classList.toggle('ui-motion', uiMotionEnabled());
  sync();
  reduceMotion.addEventListener('change', sync);
  const body = document.body;
  let playing = body.classList.contains('playing'), timer = 0;
  new MutationObserver(() => {
    const now = body.classList.contains('playing');
    if (now && !playing && uiMotionEnabled()) {
      body.classList.add('hud-entering');
      clearTimeout(timer);
      timer = window.setTimeout(() => body.classList.remove('hud-entering'), 1400);
    }
    playing = now;
  }).observe(body, { attributes: true, attributeFilter: ['class'] });
}

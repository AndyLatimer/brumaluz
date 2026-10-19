// Fuente única de los controles del juego. Se muestran en Opciones > Controles.
// IMPORTANTE: cada vez que se añada o cambie un control en el juego, hay que reflejarlo aquí.
import { t } from './i18n';

export type ControlGroup = 'move' | 'action' | 'system' | 'camera';
export type MouseInput = 'click' | 'drag' | 'wheel';

export interface ControlBinding {
  /** Códigos KeyboardEvent.code de las teclas implicadas. */
  keys?: string[];
  mouse?: MouseInput;
  /** Texto en español (se traduce con i18n). */
  label: string;
  group: ControlGroup;
  /** Texto mostrado en la leyenda para las teclas. */
  caption?: string;
}

export const CONTROLS: ControlBinding[] = [
  { keys: ['KeyW', 'ArrowUp'], caption: 'W / ↑', label: 'Avanzar', group: 'move' },
  { keys: ['KeyS', 'ArrowDown'], caption: 'S / ↓', label: 'Retroceder', group: 'move' },
  { keys: ['KeyA', 'ArrowLeft'], caption: 'A / ←', label: 'Moverse a la izquierda', group: 'move' },
  { keys: ['KeyD', 'ArrowRight'], caption: 'D / →', label: 'Moverse a la derecha', group: 'move' },
  { keys: ['ShiftLeft', 'ShiftRight'], caption: 'Mayús', label: 'Alternar correr / caminar', group: 'move' },
  { keys: ['Space'], caption: 'Espacio', label: 'Saltar', group: 'action' },
  { keys: ['KeyF'], caption: 'F', label: 'Fijar enemigo visible y atacar automáticamente', group: 'action' },
  { keys: ['Escape'], caption: 'Esc', label: 'Soltar objetivo de combate', group: 'action' },
  { keys: Array.from({ length: 10 }, (_, i) => `Digit${i}`), caption: '1–0', label: 'Usar objeto o habilidad de la barra rápida', group: 'action' },
  { keys: ['KeyZ'], caption: 'Z', label: 'Cambiar de barra', group: 'action' },
  { keys: ['KeyE'], caption: 'E', label: 'Interactuar / continuar diálogo / reaparecer', group: 'action' },
  { keys: ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'], caption: '← / → · A / D', label: 'Elegir interacción con un jugador', group: 'action' },
  { keys: ['KeyE', 'Enter'], caption: 'E / Enter', label: 'Ejecutar interacción seleccionada', group: 'action' },
  { keys: ['Escape', 'Tab'], caption: 'Esc / Tab', label: 'Cerrar interacciones con un jugador', group: 'action' },
  { keys: ['IntlBackslash'], caption: '<', label: 'Saludar', group: 'action' },
  { keys: ['Escape'], caption: 'Esc', label: 'Abrir / cerrar el menú', group: 'system' },
  { keys: ['Tab'], caption: 'Tab', label: 'Abrir / cerrar el menú de personaje', group: 'system' },
  { keys: ['KeyI'], caption: 'I', label: 'Abrir / cerrar el inventario', group: 'system' },
  { keys: ['KeyC'], caption: 'C', label: 'Abrir / cerrar la ficha de personaje', group: 'system' },
  { keys: ['KeyJ'], caption: 'J', label: 'Abrir / cerrar el diario de misiones', group: 'system' },
  { keys: ['KeyK'], caption: 'K', label: 'Abrir / cerrar habilidades', group: 'system' },
  { keys: ['KeyO'], caption: 'O', label: 'Abrir / cerrar las opciones', group: 'system' },
  { keys: ['Backquote'], caption: 'º', label: 'Mostrar / ocultar el minimapa', group: 'system' },
  { mouse: 'click', label: 'Ir al punto', group: 'move' },
  { mouse: 'drag', label: 'Mover la cámara', group: 'camera' },
  { mouse: 'wheel', label: 'Acercar / alejar', group: 'camera' },
];

const GROUP_LABEL: Record<ControlGroup, string> = { move: 'Movimiento', action: 'Acciones', camera: 'Cámara', system: 'Sistema' };

const KEY_ROWS: { offset: number; keys: [string, string, number?][] }[] = [
  { offset: 0, keys: [['Escape', 'Esc', 1.5], ['Backquote', 'º']] },
  { offset: 0, keys: [['Tab', 'Tab', 1.5], ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((k) => [`Key${k}`, k] as [string, string])] },
  { offset: 0.5, keys: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((k) => [`Key${k}`, k] as [string, string]) },
  { offset: 0, keys: [['ShiftLeft', '⇧', 1.5], ['IntlBackslash', '<'], ...['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((k) => [`Key${k}`, k] as [string, string])] },
  { offset: 2.5, keys: [['Space', '', 6]] },
];

const el = (tag: string, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

function keyCap(code: string, label: string, width: number, groups: Map<string, ControlGroup>) {
  const key = el('span', 'kb-key', label);
  key.style.setProperty('--w', String(width));
  key.dataset.code = code;
  const group = groups.get(code);
  if (group) key.classList.add('bound', `g-${group}`);
  return key;
}

function mouseSvg(groups: Map<string, ControlGroup>) {
  const g = (m: MouseInput) => (groups.has(`mouse:${m}`) ? `bound g-${groups.get(`mouse:${m}`)}` : '');
  const wrap = el('div', 'kb-mouse');
  wrap.innerHTML = `<svg viewBox="0 0 70 100" aria-hidden="true">
    <path class="m-body ${g('drag')}" data-mouse="drag" d="M35 4C18 4 8 16 8 34v32c0 20 11 30 27 30s27-10 27-30V34C62 16 52 4 35 4Z"/>
    <path class="m-btn ${g('click')}" data-mouse="click" d="M35 4C19 4 9 15 8.2 32H33V4.3Z"/>
    <path class="m-btn" d="M35 4c16 0 26 11 26.8 28H37V4.3Z"/>
    <rect class="m-wheel ${g('wheel')}" data-mouse="wheel" x="31" y="12" width="8" height="18" rx="4"/>
    <path class="m-line" d="M8.2 32H61.8M35 4v28"/>
  </svg>`;
  return wrap;
}

export function renderControls(container: HTMLElement) {
  const groups = new Map<string, ControlGroup>();
  for (const c of CONTROLS) {
    for (const k of c.keys ?? []) groups.set(k, c.group);
    if (c.mouse) groups.set(`mouse:${c.mouse}`, c.group);
  }
  container.replaceChildren();

  const board = el('div', 'kb-board');
  const main = el('div', 'kb-main');
  for (const row of KEY_ROWS) {
    const r = el('div', 'kb-row');
    r.style.setProperty('--offset', String(row.offset));
    for (const [code, label, width] of row.keys) r.append(keyCap(code, code === 'Space' ? t('Espacio') : label, width ?? 1, groups));
    main.append(r);
  }
  const arrows = el('div', 'kb-arrows');
  arrows.append(keyCap('ArrowUp', '↑', 1, groups));
  const bottom = el('div', 'kb-row');
  for (const [code, label] of [['ArrowLeft', '←'], ['ArrowDown', '↓'], ['ArrowRight', '→']]) bottom.append(keyCap(code, label, 1, groups));
  arrows.append(bottom);
  board.append(main, arrows, mouseSvg(groups));
  container.append(board);

  const legend = el('div', 'kb-legend');
  for (const group of ['move', 'action', 'camera', 'system'] as ControlGroup[]) {
    const items = CONTROLS.filter((c) => c.group === group);
    if (!items.length) continue;
    const section = el('div', 'kb-group');
    const title = el('h4', `g-${group}`, t(GROUP_LABEL[group]));
    section.append(title);
    for (const c of items) {
      const row = el('div', 'kb-item');
      const caps = el('span', 'kb-caps');
      if (c.caption) caps.append(el('kbd', undefined, c.caption === 'Espacio' ? t('Espacio') : c.caption === 'Mayús' ? t('Mayús') : c.caption));
      else caps.append(el('kbd', 'mouse', t(c.mouse === 'click' ? 'Clic' : c.mouse === 'drag' ? 'Arrastrar' : 'Rueda')));
      row.append(caps, el('span', 'kb-text', t(c.label)));
      row.addEventListener('pointerenter', () => highlight(container, c, true));
      row.addEventListener('pointerleave', () => highlight(container, c, false));
      section.append(row);
    }
    legend.append(section);
  }
  container.append(legend);
}

function highlight(container: HTMLElement, c: ControlBinding, on: boolean) {
  const targets: Element[] = [];
  for (const code of c.keys ?? []) targets.push(...container.querySelectorAll(`[data-code="${code}"]`));
  if (c.mouse) targets.push(...container.querySelectorAll(`[data-mouse="${c.mouse}"]`));
  for (const node of targets) node.classList.toggle('pulse', on);
  container.classList.toggle('dimmed', on);
}

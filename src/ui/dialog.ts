// Ventana de diálogo reutilizable.
// - openDialog([{ speaker, text }, ...]): líneas simples; E avanza y cierra al final.
// - openConversation(conversation): árbol de nodos con respuestas del jugador.
//   Salvo que un nodo marque `noExit`, siempre se añade la opción «[Salir de la conversación]».
import { t } from './i18n';

export interface DialogLine {
  /** Nombre mostrado en la burbuja (no se traduce: puede ser el del jugador o un NPC). */
  speaker: string;
  /** Texto en español (se traduce con i18n). */
  text: string;
}

export interface DialogChoice {
  /** Texto de la respuesta del jugador. */
  text: string;
  /** Nodo al que lleva; sin él, la conversación termina. */
  next?: string;
  /** Opción oculta si devuelve false (para flags de misión, etc.). */
  when?: () => boolean;
  /** Se ejecuta al elegirla (activar flags, dar misiones...). */
  action?: () => void | boolean | Promise<void | boolean>;
}

export interface DialogNode {
  /** Quién habla; por defecto, el `speaker` de la conversación. */
  speaker?: string;
  text: string;
  /** Respuestas posibles. Sin ellas, E continúa a `next` o cierra. */
  choices?: DialogChoice[];
  next?: string;
  /** Impide añadir la opción automática de salir (solo para misiones o escenas obligadas). */
  noExit?: boolean;
}

export interface Conversation {
  speaker: string;
  start: string;
  nodes: Record<string, DialogNode>;
}

export const EXIT_CHOICE_TEXT = 'Salir de la conversación';

interface ChoiceView { text: string; exit: boolean; choice?: DialogChoice }

let lines: DialogLine[] = [];
let index = 0;
let conversation: Conversation | null = null;
let node: DialogNode | null = null;
let choices: ChoiceView[] = [];
let selected = 0;
let onClose: (() => void) | undefined;
let revision = 0;
let busy = false;
let actionError = '';

const root = () => document.querySelector<HTMLElement>('#dialog')!;

/** Recibe cada línea que se muestra (speaker null = respuesta del jugador); el texto va sin traducir. */
let logger: ((speaker: string | null, text: string) => void) | undefined;
export function setDialogLogger(fn: typeof logger) { logger = fn; }

export const isDialogOpen = () => !root().hidden;

function visibleChoices(n: DialogNode): ChoiceView[] {
  const list: ChoiceView[] = (n.choices ?? []).filter((c) => !c.when || c.when()).map((c) => ({ text: c.text, exit: false, choice: c }));
  if (n.choices && !n.noExit) list.push({ text: EXIT_CHOICE_TEXT, exit: true });
  return list;
}

function render() {
  const el = root();
  el.setAttribute('aria-busy', String(busy));
  let error = el.querySelector<HTMLElement>('.dialog-action-error');
  if (!error) {
    error = document.createElement('p');
    error.className = 'dialog-action-error';
    error.setAttribute('role', 'alert');
    el.append(error);
  }
  error.textContent = actionError;
  error.hidden = !actionError;
  const list = el.querySelector<HTMLElement>('.dialog-choices')!;
  const next = el.querySelector<HTMLElement>('.dialog-next')!;
  if (node && conversation) {
    el.querySelector('.dialog-speaker')!.textContent = node.speaker ?? conversation.speaker;
    el.querySelector('.dialog-text')!.textContent = t(node.text);
    list.replaceChildren(...choices.map((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dialog-choice' + (c.exit ? ' exit' : '') + (i === selected ? ' selected' : '');
      b.disabled = busy;
      const label = t(c.text);
      const marker = document.createElement('span');
      marker.className = 'dialog-choice-mark';
      marker.textContent = c.exit ? '↩' : `${i + 1}.`;
      const text = document.createElement('span');
      text.textContent = c.exit ? `[${label}]` : label;
      b.append(marker, text);
      b.onmouseenter = () => { selected = i; markSelected(); };
      b.onclick = () => chooseDialog(i);
      return b;
    }));
    list.hidden = !choices.length;
    next.textContent = t(busy ? 'Guardando…' : choices.length ? 'Elegir' : node.next ? 'Continuar' : 'Aceptar');
    return;
  }
  const line = lines[index];
  list.hidden = true;
  el.querySelector('.dialog-speaker')!.textContent = line.speaker;
  el.querySelector('.dialog-text')!.textContent = t(line.text);
  next.textContent = t(index < lines.length - 1 ? 'Continuar' : 'Aceptar');
}

function markSelected() {
  root().querySelectorAll('.dialog-choice').forEach((b, i) => b.classList.toggle('selected', i === selected));
}

export function openDialog(next: DialogLine[], closed?: () => void) {
  if (!next.length) return;
  revision++; busy = false; actionError = '';
  lines = next;
  index = 0;
  conversation = null;
  node = null;
  choices = [];
  onClose = closed;
  root().hidden = false;
  render();
  logger?.(lines[0].speaker, lines[0].text);
}

function goTo(id: string) {
  const next = conversation?.nodes[id];
  if (!next) { closeDialog(); return; }
  node = next;
  choices = visibleChoices(next);
  selected = 0;
  render();
  logger?.(next.speaker ?? conversation!.speaker, next.text);
}

export function openConversation(next: Conversation, closed?: () => void) {
  revision++; busy = false; actionError = '';
  conversation = next;
  lines = [];
  onClose = closed;
  root().hidden = false;
  goTo(next.start);
}

export function closeDialog() {
  if (!isDialogOpen()) return;
  revision++; busy = false; actionError = '';
  root().hidden = true;
  conversation = null;
  node = null;
  choices = [];
  const callback = onClose;
  onClose = undefined;
  callback?.();
}

/** Elige la respuesta número `i` (0 = primera). */
export function chooseDialog(i: number) {
  if (busy) return;
  const view = choices[i];
  if (!view) return;
  if (view.exit) { closeDialog(); return; }
  logger?.(null, view.choice!.text);
  const version = revision;
  const finish = (success: void | boolean) => {
    if (version !== revision) return;
    busy = false;
    if (success === false) { render(); return; }
    if (view.choice!.next) goTo(view.choice!.next); else closeDialog();
  };
  const fail = (error: unknown) => {
    if (version !== revision) return;
    busy = false;
    actionError = error instanceof Error ? t(error.message) : t('No se pudo completar la acción');
    console.error('Error en la conversación:', error);
    render();
  };
  actionError = '';
  try {
    const result = view.choice!.action?.();
    if (result instanceof Promise) {
      busy = true; render();
      void result.then(finish, fail);
    } else finish(result);
  } catch (error) { fail(error); }
}

/** Esc / Tab: sale de la conversación (equivale a «[Salir de la conversación]») salvo en escenas obligadas (`noExit`). */
export function exitDialog() {
  if (!isDialogOpen() || node?.noExit || busy) return;
  closeDialog();
}

/** Mueve la selección de respuestas (+1 abajo, -1 arriba). */
export function moveDialogChoice(delta: number) {
  if (!choices.length || busy) return;
  selected = (selected + delta + choices.length) % choices.length;
  markSelected();
}

/** Tecla E: elige la respuesta marcada, avanza o cierra. */
export function advanceDialog() {
  if (!isDialogOpen() || busy) return;
  if (node) {
    if (choices.length) chooseDialog(selected);
    else if (node.next) goTo(node.next);
    else closeDialog();
    return;
  }
  if (index < lines.length - 1) { index++; render(); logger?.(lines[index].speaker, lines[index].text); } else closeDialog();
}

/** Clic en el cuadro: avanza si no hay respuestas que elegir (las respuestas se eligen con su botón). */
document.addEventListener('click', (e) => {
  if (!isDialogOpen() || choices.length) return;
  if ((e.target as HTMLElement).closest('#dialog')) advanceDialog();
});

/** Vuelve a traducir la línea visible al cambiar de idioma. */
export function refreshDialog() {
  if (isDialogOpen()) render();
}

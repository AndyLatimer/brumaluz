// Avisos de viaje: se leen de uno en uno y esperan durante las conversaciones.
import { ui } from '../game/state';
import { t } from './i18n';
import { chatSystem } from './chatWindow';
import { $ } from './dom';

type ToastKind = 'notice' | 'quest' | 'reward';
interface Notice {
  title: string;
  text: string;
  error: boolean;
  values: Record<string, string | number>;
  kind: ToastKind;
  remaining: number;
  duration: number;
}
const pending: Notice[] = [];
let current: Notice | null = null;
let lastTick = 0;
let leaving = 0;
const recent = new Map<string, number>();
const captions = { notice: 'Aviso', quest: 'Diario de viaje', reward: 'Misión completada' };

function signature(notice: Pick<Notice, 'title' | 'text' | 'error' | 'kind' | 'values'>) {
  return JSON.stringify([notice.title, notice.text, notice.error, notice.kind,
    Object.entries(notice.values).sort(([a], [b]) => a.localeCompare(b))]);
}

function hideToast() {
  const element = $('#toast');
  element.classList.remove('show');
  element.inert = true;
  element.setAttribute('aria-hidden', 'true');
}

export function dismissToast() {
  if (!current) return;
  hideToast();
  current = null;
  leaving = performance.now() + 280;
}

export function renderToast() {
  if (!current) return;
  const element = $('#toast');
  element.classList.toggle('error', current.error);
  element.dataset.kind = current.kind;
  element.setAttribute('role', current.error ? 'alert' : 'status');
  element.setAttribute('aria-live', current.error ? 'assertive' : 'polite');
  element.setAttribute('aria-atomic', 'true');
  const seal = document.createElement('span');
  seal.className = 'toast-seal';
  seal.setAttribute('aria-hidden', 'true');
  const mark = current.error ? '<path d="M16 9v9m0 5v.1"/>'
    : current.kind === 'reward' ? '<path d="m9 16 5 5 10-11"/>'
    : current.kind === 'quest' ? '<path d="M10 8h12v17l-6-4-6 4Z"/>'
    : '<path d="m16 7 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/>';
  seal.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${mark}</svg>`;
  const body = document.createElement('div');
  body.className = 'toast-body';
  const caption = document.createElement('small');
  caption.textContent = t(current.error ? 'Un momento…' : captions[current.kind]);
  const heading = document.createElement('h2');
  heading.textContent = t(ui.toastSourceTitle, ui.toastValues);
  const message = document.createElement('p');
  message.textContent = t(ui.toastSourceText, ui.toastValues);
  body.append(caption, heading, message);
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'toast-dismiss';
  dismiss.setAttribute('aria-label', t('Cerrar aviso'));
  dismiss.title = t('Cerrar aviso');
  dismiss.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8"/></svg>';
  // Closing an overlay must never also target or interact with the world underneath.
  dismiss.onpointerdown = event => event.stopPropagation();
  dismiss.onclick = event => { event.stopPropagation(); dismissToast(); };
  dismiss.onkeydown = event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); dismissToast(); }
  };
  dismiss.onkeyup = event => event.stopPropagation();
  const progress = document.createElement('span');
  progress.className = 'toast-progress';
  progress.setAttribute('aria-hidden', 'true');
  element.style.setProperty('--toast-progress', String(current.remaining / current.duration));
  element.replaceChildren(seal, body, dismiss, progress);
}

function tick() {
  // Background tabs and a busy renderer can suspend timers. Unseen wall time is not reading time.
  const now = performance.now(), elapsed = Math.min(250, Math.max(0, now - lastTick));
  lastTick = now;
  const element = $('#toast');
  const reading = current && element.matches(':hover, :focus-within');
  const blocked = document.hidden || document.body.classList.contains('cinematic-open')
    || (!(current ?? pending[0])?.error && document.body.classList.contains('conversation-open'));
  if (!blocked && now >= leaving) {
    if (!current && pending.length) {
      current = pending.shift()!;
      ui.toastSourceTitle = current.title;
      ui.toastSourceText = current.text;
      ui.toastValues = current.values;
      renderToast();
      element.inert = false;
      element.removeAttribute('aria-hidden');
      element.classList.add('show');
    } else if (current && !reading) {
      current.remaining -= elapsed;
      element.style.setProperty('--toast-progress', String(Math.max(0, current.remaining / current.duration)));
      if (current.remaining <= 0) {
        dismissToast();
      }
    }
  }
  if (current || pending.length) ui.toastTimer = window.setTimeout(tick, 100);
  else ui.toastTimer = 0;
}

const duration = (notice: Pick<Notice, 'title' | 'text' | 'kind' | 'error' | 'values'>) =>
  Math.min(12000, Math.max(notice.kind === 'reward' || notice.error ? 4800 : 3600,
    (t(notice.title, notice.values).length + t(notice.text, notice.values).length) * 38));

export function toast(title: string, text: string, error = false, values: Record<string, string | number> = {}, kind: ToastKind = 'notice') {
  const total = duration({ title, text, kind, error, values });
  const notice: Notice = { title, text, error, values: { ...values }, kind, duration: total, remaining: total };
  const key = signature(notice), now = performance.now();
  const same = (other: Notice) => signature(other) === key;
  if ((current && same(current)) || pending.some(same)) return;
  for (const [key, until] of recent) if (now >= until) recent.delete(key);
  if ((recent.get(key) ?? 0) > now) return;
  recent.set(key, now + 1500);
  if (recent.size > 64) recent.delete(recent.keys().next().value!);
  // Keep one history entry per accepted notice, including while a conversation hides the card.
  chatSystem(`${t(title, values)}${text ? `: ${t(text, values)}` : ''}`, error);
  if (error) {
    if (current) { pending.unshift(current); current = null; hideToast(); }
    pending.unshift(notice);
    leaving = 0;
  } else pending.push(notice);
  if (pending.length > 8) pending.splice(8);
  if (!ui.toastTimer) { lastTick = performance.now(); tick(); }
}

export function clearToasts() {
  window.clearTimeout(ui.toastTimer);
  ui.toastTimer = 0;
  pending.length = 0;
  recent.clear();
  current = null;
  leaving = 0;
  ui.toastSourceTitle = ''; ui.toastSourceText = '';
  ui.toastValues = {};
  hideToast();
  $('#toast').replaceChildren();
}

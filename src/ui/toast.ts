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
}
const pending: Notice[] = [];
let current: Notice | null = null;
let lastTick = 0;
let leaving = 0;
const captions = { notice: 'Crónicas de Brumaluz', quest: 'Diario de viaje', reward: 'Misión completada' };

export function renderToast() {
  if (!current) return;
  const element = $('#toast');
  element.classList.toggle('error', current.error);
  element.dataset.kind = current.kind;
  element.setAttribute('role', current.error ? 'alert' : 'status');
  element.setAttribute('aria-live', current.error ? 'assertive' : 'polite');
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
  const progress = document.createElement('span');
  progress.className = 'toast-progress';
  progress.setAttribute('aria-hidden', 'true');
  element.style.setProperty('--toast-progress', String(current.remaining / duration(current)));
  element.replaceChildren(seal, body, progress);
}

function tick() {
  const now = performance.now(), elapsed = now - lastTick;
  lastTick = now;
  const blocked = document.hidden || document.body.classList.contains('cinematic-open')
    || (!(current ?? pending[0])?.error && document.body.classList.contains('conversation-open'));
  if (!blocked && now >= leaving) {
    if (!current && pending.length) {
      current = pending.shift()!;
      ui.toastSourceTitle = current.title;
      ui.toastSourceText = current.text;
      ui.toastValues = current.values;
      renderToast();
      $('#toast').classList.add('show');
    } else if (current) {
      current.remaining -= elapsed;
      $('#toast').style.setProperty('--toast-progress', String(Math.max(0, current.remaining / duration(current))));
      if (current.remaining <= 0) {
        $('#toast').classList.remove('show');
        current = null;
        leaving = now + 280;
      }
    }
  }
  if (current || pending.length) ui.toastTimer = window.setTimeout(tick, 100);
  else ui.toastTimer = 0;
}

const duration = (notice: Pick<Notice, 'title' | 'text' | 'kind' | 'error'>) =>
  Math.min(7200, Math.max(notice.kind === 'reward' || notice.error ? 4800 : 3600, (notice.title.length + notice.text.length) * 38));

export function toast(title: string, text: string, error = false, values: Record<string, string | number> = {}, kind: ToastKind = 'notice') {
  const notice: Notice = { title, text, error, values: { ...values }, kind, remaining: duration({ title, text, kind, error }) };
  chatSystem(`${t(title, values)}: ${t(text, values)}`, error);
  const same = (other: Notice) => other.title === title && other.text === text && JSON.stringify(other.values) === JSON.stringify(values);
  if ((current && same(current)) || pending.some(same)) return;
  if (error) {
    if (current) { pending.unshift(current); current = null; $('#toast').classList.remove('show'); }
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
  current = null;
  leaving = 0;
  ui.toastSourceTitle = ''; ui.toastSourceText = '';
  $('#toast').classList.remove('show');
  $('#toast').replaceChildren();
}

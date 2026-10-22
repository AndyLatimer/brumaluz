// Avisos breves en pantalla.
import { ui } from '../game/state';
import { t } from './i18n';
import { chatSystem } from './chatWindow';
import { $ } from './dom';

export function renderToast() {
  if (!ui.toastSourceTitle && !ui.toastSourceText) return;
  const element = $('#toast');
  const heading = document.createElement('h2');
  heading.textContent = t(ui.toastSourceTitle, ui.toastValues);
  const message = document.createElement('p');
  message.textContent = t(ui.toastSourceText, ui.toastValues);
  element.replaceChildren(heading, message);
}
export function toast(title: string, text: string, error = false, values: Record<string, string | number> = {}) {
  ui.toastSourceTitle = title;
  ui.toastSourceText = text;
  ui.toastValues = values;
  renderToast();
  chatSystem(`${t(title)}: ${t(text, values)}`, error);
  const element = $('#toast');
  element.classList.toggle('error', error);
  element.classList.add('show');
  clearTimeout(ui.toastTimer);
  ui.toastTimer = window.setTimeout(() => element.classList.remove('show'), 3200);
}

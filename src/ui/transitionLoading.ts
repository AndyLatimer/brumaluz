import { t } from './i18n';

const pending = new Map<symbol, string>();
let panel: HTMLDivElement | null = null;
let showTimer = 0, expandTimer = 0;

function render() {
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'transition-loading';
    panel.className = 'transition-loading';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    const spinner = document.createElement('span');
    spinner.className = 'transition-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    panel.append(spinner, document.createElement('p'));
    document.body.append(panel);
  }
  const labels = [...pending.values()];
  const label = labels[labels.length - 1];
  panel.querySelector('p')!.textContent = label ? t(label) : '';
  panel.hidden = pending.size === 0;
}

document.addEventListener('brumaluz-language-change', () => { if (panel && pending.size) render(); });

export function beginTransition(label: string) {
  const key = Symbol(label);
  pending.set(key, label);
  if (pending.size === 1) {
    document.getElementById('scene')!.setAttribute('aria-busy', 'true');
    showTimer = window.setTimeout(render, 180);
    expandTimer = window.setTimeout(() => panel?.classList.add('slow'), 1500);
  } else if (panel && !panel.hidden) render();
  return () => {
    if (!pending.delete(key)) return;
    if (pending.size) { if (panel && !panel.hidden) render(); return; }
    window.clearTimeout(showTimer);
    window.clearTimeout(expandTimer);
    document.getElementById('scene')!.removeAttribute('aria-busy');
    if (panel) { panel.hidden = true; panel.classList.remove('slow'); }
  };
}

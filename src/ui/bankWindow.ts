// Ventana del banco de la cuenta: huecos del banco a la izquierda, mochila a la derecha y pelines guardados.
// Clic en un objeto de la mochila lo guarda entero; clic en uno del banco lo retira entero.
import type { CharData } from '../data/data';
import { currencyIcon } from '../data/currency';
import { INVENTORY_UNLOCKED } from '../data/inventory';
import { itemIcon, itemLabel } from '../data/items';
import { isBankable, type BankState } from '../data/bank';
import { t } from './i18n';
import { goldLine } from './playerWindows';
import { setItemTooltip } from './itemTooltip';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

export interface BankHandlers {
  onDeposit: (slot: number) => void;
  onWithdraw: (slot: number) => void;
  onDepositPelines: (amount: number) => void;
  onWithdrawPelines: (amount: number) => void;
}

const CHEST_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v2H3Z" fill="#b8874d"/><path d="M3 12h18v8H3Z" fill="#9a6a3a"/><path d="M3 12h18M8 5v15M16 5v15" stroke="#5e3c22" stroke-width="1.2" fill="none"/><rect x="10" y="10.5" width="4" height="4.5" rx="1" fill="#e6c477" stroke="#6b4a26" stroke-width=".8"/><circle cx="12" cy="12.4" r=".7" fill="#5e3c22"/></svg>';

function slot(item: BankState['items'][number], index: number, onClick: ((index: number) => void) | null, label: string) {
  const cell = el(item && onClick ? 'button' : 'div', `inv-slot${item ? ' filled' : ''}`);
  if (cell instanceof HTMLButtonElement) {
    cell.type = 'button';
    cell.classList.add('usable');
    cell.onclick = () => onClick!(index);
  }
  cell.dataset.index = String(index);
  if (item) {
    setItemTooltip(cell, item.id, item.bound);
    cell.setAttribute('aria-label', `${t(label)}: ${t(itemLabel(item.id))} × ${item.count}`);
    cell.innerHTML = itemIcon(item.id);
    if (item.count > 1) cell.append(el('i', undefined, String(item.count)));
    if (!onClick) cell.classList.add('bank-blocked');
  }
  return cell;
}

function pelinesControl(max: number, action: string, onSubmit: (amount: number) => void) {
  const form = el('form', 'bank-pelines-form');
  const input = el('input') as HTMLInputElement;
  input.type = 'number'; input.min = '1'; input.step = '1'; input.max = String(max); input.inputMode = 'numeric';
  input.placeholder = '0';
  input.setAttribute('aria-label', t(action));
  const button = el('button', 'btn gold vendor-action', t(action)) as HTMLButtonElement;
  button.type = 'submit';
  button.disabled = max <= 0;
  input.disabled = max <= 0;
  const all = el('button', 'btn bank-all', t('Todo')) as HTMLButtonElement;
  all.type = 'button'; all.disabled = max <= 0;
  all.onclick = () => { input.value = String(max); input.focus(); };
  form.onsubmit = e => {
    e.preventDefault();
    const amount = Math.floor(Number(input.value));
    if (amount > 0 && amount <= max) onSubmit(amount);
  };
  form.append(input, all, button);
  return form;
}

export function renderBank(container: HTMLElement, d: CharData, bank: BankState | null, handlers: BankHandlers) {
  container.replaceChildren();
  const banner = el('div', 'vendor-banner bank-banner');
  const intro = el('div', 'bank-intro');
  const art = el('span', 'bank-chest');
  art.innerHTML = CHEST_ICON;
  const copy = el('div');
  copy.append(el('strong', undefined, t('Banco de la cuenta')), el('p', undefined, t('Lo que guardes aquí lo compartirán todos tus personajes.')));
  intro.append(art, copy);
  banner.append(intro, goldLine(d, false));
  if (!bank) {
    container.append(banner, el('p', 'vendor-empty', t('Abriendo el baúl…')));
    return;
  }

  const wrap = el('div', 'bank');
  const vault = el('section', 'vendor-col bank-vault');
  const used = bank.items.filter(Boolean).length;
  const vaultHead = el('div', 'inv-bag-head');
  vaultHead.append(el('h3', undefined, t('Baúl')), el('span', 'inv-capacity', `${used} / ${bank.size}`));
  vault.append(vaultHead, el('p', 'vendor-subtitle', t('Haz clic en un objeto para llevártelo a la mochila.')));
  const vaultGrid = el('div', 'inv-grid bank-grid');
  bank.items.forEach((item, i) => vaultGrid.append(slot(item, i, handlers.onWithdraw, 'Retirar')));
  vault.append(vaultGrid);

  const stored = el('div', 'bank-money');
  const balance = el('div', 'currency pelines bank-balance');
  balance.innerHTML = currencyIcon('pelines');
  balance.append(el('b', undefined, String(bank.pelines)), el('span', undefined, t('Pelines guardados')));
  stored.append(balance, pelinesControl(bank.pelines, 'Retirar', handlers.onWithdrawPelines));
  vault.append(stored);

  const bag = el('section', 'vendor-col bank-bag');
  const bagUsed = d.inventory.slice(0, INVENTORY_UNLOCKED).filter(Boolean).length;
  const bagHead = el('div', 'inv-bag-head');
  bagHead.append(el('h3', undefined, t('Mochila')), el('span', 'inv-capacity', `${bagUsed} / ${INVENTORY_UNLOCKED}`));
  bag.append(bagHead, el('p', 'vendor-subtitle', t('Haz clic en un objeto para guardarlo. Los objetos ligados no se pueden guardar.')));
  const bagGrid = el('div', 'inv-grid bank-grid bag');
  for (let i = 0; i < INVENTORY_UNLOCKED; i++) {
    const item = d.inventory[i];
    bagGrid.append(slot(item, i, item && isBankable(item) ? handlers.onDeposit : null, 'Guardar'));
  }
  bag.append(bagGrid);
  const deposit = el('div', 'bank-money');
  deposit.append(el('span', 'bank-money-label', t('Guardar pelines')), pelinesControl(d.wallet.pelines, 'Guardar', handlers.onDepositPelines));
  bag.append(deposit);

  wrap.append(vault, bag);
  container.append(banner, wrap);
}

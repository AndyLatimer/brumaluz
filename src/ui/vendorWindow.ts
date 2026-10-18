// Ventana de compra y venta con un NPC: mercancía del vendedor (sin su dinero, es infinito) y objetos del jugador.
import type { CharData } from '../data/data';
import { currencyIcon } from '../data/currency';
import { ITEMS, VENDOR_STOCK, itemIcon, itemLabel, sellPrice } from '../data/items';
import { t } from './i18n';
import { goldLine } from './playerWindows';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

export interface VendorHandlers {
  onBuy: (item: string) => void;
  onSell: (slot: number) => void;
}

const price = (amount: number) => {
  const box = el('span', 'vendor-price');
  box.innerHTML = currencyIcon('pelines');
  box.append(el('b', undefined, String(amount)));
  return box;
};

function row(item: string, label: string, amount: number, action: string, enabled: boolean, onClick: () => void, count?: number) {
  const li = el('li', 'vendor-row');
  li.title = `${t(itemLabel(item))}|${t(ITEMS[item]?.description ?? '')}`;
  const icon = el('span', 'vendor-icon');
  icon.innerHTML = itemIcon(item);
  if (count && count > 1) icon.append(el('i', undefined, String(count)));
  const button = el('button', 'btn gold vendor-action', t(action)) as HTMLButtonElement;
  button.type = 'button';
  button.disabled = !enabled;
  button.onclick = onClick;
  li.append(icon, el('span', 'vendor-name', t(label)), price(amount), button);
  return li;
}

export function renderVendor(container: HTMLElement, d: CharData, vendorId: string, handlers: VendorHandlers) {
  container.replaceChildren();
  const wrap = el('div', 'vendor');

  const shop = el('section', 'vendor-col');
  shop.append(el('h3', undefined, t('Mercancía')));
  const stock = el('ul', 'vendor-list');
  for (const id of VENDOR_STOCK[vendorId] ?? []) {
    stock.append(row(id, ITEMS[id].label, ITEMS[id].value, 'Comprar', d.wallet.pelines >= ITEMS[id].value, () => handlers.onBuy(id)));
  }
  shop.append(stock);

  const mine = el('section', 'vendor-col');
  mine.append(el('h3', undefined, t('Tus objetos')));
  const owned = el('ul', 'vendor-list');
  // Agrupa por objeto: una fila con el total; al vender se descuenta del último hueco que lo contenga.
  const groups = new Map<string, { total: number; slot: number }>();
  d.inventory.forEach((item, slot) => {
    if (!item || !ITEMS[item.id]) return;
    const g = groups.get(item.id);
    groups.set(item.id, { total: (g?.total ?? 0) + item.count, slot });
  });
  for (const [id, g] of groups) owned.append(row(id, itemLabel(id), sellPrice(id), 'Vender', true, () => handlers.onSell(g.slot), g.total));
  if (!owned.children.length) owned.append(el('li', 'vendor-empty', t('No tienes nada que vender.')));
  mine.append(owned);

  wrap.append(shop, mine);
  container.append(wrap, goldLine(d, false));
}

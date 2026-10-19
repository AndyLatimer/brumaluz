// Ventana de compra y venta con un NPC: mercancía del vendedor (sin su dinero, es infinito) y objetos del jugador.
import type { CharData } from '../data/data';
import { currencyIcon } from '../data/currency';
import { ITEMS, VENDOR_STOCK, itemIcon, itemLabel, sellPrice } from '../data/items';
import { INVENTORY_UNLOCKED } from '../data/inventory';
import { t } from './i18n';
import { goldLine } from './playerWindows';
import { setItemTooltip } from './itemTooltip';

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

function row(item: string, label: string, amount: number, action: string, enabled: boolean, onClick: () => void, count?: number, bound = false) {
  const li = el('li', 'vendor-row');
  setItemTooltip(li, item, bound);
  li.tabIndex = 0;
  const icon = el('span', 'vendor-icon');
  icon.innerHTML = itemIcon(item);
  if (count && count > 1) icon.append(el('i', undefined, String(count)));
  const button = el('button', 'btn gold vendor-action', t(action)) as HTMLButtonElement;
  button.type = 'button';
  button.disabled = !enabled;
  button.onclick = onClick;
  const info = el('div', 'vendor-info');
  info.append(el('strong', 'vendor-name', t(label)), el('span', 'vendor-effect', t(ITEMS[item].effects?.[0] ?? ITEMS[item].category)));
  const trade = el('div', 'vendor-trade');
  trade.append(price(amount), button);
  li.append(icon, info, trade);
  return li;
}

export function renderVendor(container: HTMLElement, d: CharData, vendorId: string, handlers: VendorHandlers) {
  container.replaceChildren();
  const wrap = el('div', 'vendor');
  const banner = el('div', 'vendor-banner');
  const intro = el('div');
  intro.append(el('strong', undefined, t('Provisiones para el camino')), el('p', undefined, t('Un pequeño descanso antes de tu próxima aventura.')));
  banner.append(intro, goldLine(d, false));

  const shop = el('section', 'vendor-col');
  shop.append(el('h3', undefined, t('Mercancía')));
  shop.append(el('p', 'vendor-subtitle', t('Cada compra añade una unidad a tu mochila.')));
  const stock = el('ul', 'vendor-list');
  for (const id of VENDOR_STOCK[vendorId] ?? []) {
    stock.append(row(id, ITEMS[id].label, ITEMS[id].value, 'Comprar', d.wallet.pelines >= ITEMS[id].value, () => handlers.onBuy(id)));
  }
  shop.append(stock);

  const mine = el('section', 'vendor-col');
  mine.append(el('h3', undefined, t('Tus objetos')));
  const used = d.inventory.slice(0, INVENTORY_UNLOCKED).filter(Boolean).length;
  mine.append(el('p', 'vendor-subtitle', t('Mochila: {used}/{total} · Vendes una unidad cada vez.', { used, total: INVENTORY_UNLOCKED })));
  const owned = el('ul', 'vendor-list');
  // Agrupa por objeto y vinculación; al vender se descuenta del último hueco del grupo.
  const groups = new Map<string, { id: string; bound: boolean; total: number; slot: number }>();
  d.inventory.forEach((item, slot) => {
    if (!item || !ITEMS[item.id] || ITEMS[item.id].sellable === false) return;
    const bound = item.bound === true || ITEMS[item.id].bound === true;
    const key = `${item.id}:${bound}`;
    const g = groups.get(key);
    groups.set(key, { id: item.id, bound, total: (g?.total ?? 0) + item.count, slot });
  });
  for (const g of groups.values()) owned.append(row(g.id, itemLabel(g.id), sellPrice(g.id), 'Vender', true, () => handlers.onSell(g.slot), g.total, g.bound));
  if (!owned.children.length) owned.append(el('li', 'vendor-empty', t('No tienes nada que vender.')));
  mine.append(owned);

  wrap.append(shop, mine);
  const hint = el('p', 'vendor-hint', t('Los precios se muestran en pelines. Pasa el cursor sobre un objeto para ver sus detalles.'));
  container.append(banner, wrap, hint);
}

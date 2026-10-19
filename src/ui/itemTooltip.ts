import { currencyIcon } from '../data/currency';
import { itemDef, itemIcon, itemLabel, sellPrice } from '../data/items';
import { getLanguage, t } from './i18n';
import { EQUIPPABLE } from '../data/equipment';

export function setItemTooltip(target: HTMLElement, id: string, bound = false) {
  target.dataset.itemId = id;
  target.dataset.itemBound = String(bound || itemDef(id)?.bound === true);
  target.setAttribute('aria-label', t(itemLabel(id)));
}

export function renderItemTooltip(container: HTMLElement, id: string, bound = false) {
  const item = itemDef(id);
  if (!item) {
    const name = document.createElement('strong');
    name.textContent = id;
    container.append(name);
    return;
  }
  const header = document.createElement('div');
  header.className = 'item-tip-header';
  const icon = document.createElement('div');
  icon.className = 'item-tip-icon';
  icon.innerHTML = itemIcon(id);
  const identity = document.createElement('div');
  const category = document.createElement('span');
  category.className = 'item-tip-category';
  category.textContent = t(item.category);
  const name = document.createElement('strong');
  name.className = 'item-tip-name';
  name.textContent = t(item.label);
  identity.append(category, name);
  header.append(icon, identity);
  container.append(header);
  const binding = document.createElement('p');
  binding.className = 'item-tip-binding';
  binding.textContent = t(bound || item.bound ? 'Ligado · No intercambiable' : 'Intercambiable');
  container.append(binding);

  if (item.stats?.length) {
    const stats = document.createElement('dl');
    stats.className = 'item-tip-stats';
    for (const stat of item.stats) {
      const label = document.createElement('dt');
      label.textContent = t(stat.label);
      const value = document.createElement('dd');
      value.textContent = t(stat.value);
      stats.append(label, value);
    }
    container.append(stats);
  }
  if (item.effects?.length) {
    const effects = document.createElement('section');
    effects.className = 'item-tip-effects';
    const label = document.createElement('b');
    label.textContent = t('Efectos');
    const list = document.createElement('ul');
    for (const effect of item.effects) {
      const line = document.createElement('li');
      line.textContent = t(effect);
      list.append(line);
    }
    effects.append(label, list);
    container.append(effects);
  }
  const description = document.createElement('p');
  description.className = 'item-tip-description';
  description.textContent = t(item.description);
  container.append(description);
  if (EQUIPPABLE[id]) {
    const hint = document.createElement('small');
    hint.textContent = t('Pulsa en la mochila para equipar; pulsa en Equipo para desequipar.');
    container.append(hint);
  }
  if (item.sellable === false) return;

  const footer = document.createElement('div');
  footer.className = 'item-tip-footer';
  const sale = document.createElement('div');
  sale.className = 'item-tip-sale';
  const label = document.createElement('span');
  label.textContent = t('Valor de venta');
  const price = document.createElement('b');
  price.innerHTML = currencyIcon('pelines');
  price.append(`${sellPrice(id).toLocaleString(getLanguage() === 'en' ? 'en-US' : 'es-ES')} ${t('Pelines')}`);
  sale.append(label, price);
  footer.append(sale);
  container.append(footer);
}

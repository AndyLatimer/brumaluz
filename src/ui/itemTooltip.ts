import { currencyIcon } from '../data/currency';
import { itemDef, itemIcon, itemLabel, itemRarity, sellPrice } from '../data/items';
import { ITEM_RARITIES } from '../data/itemRarity';
import { getLanguage, t } from './i18n';
import { EQUIPPABLE } from '../data/equipment';
import { CLASSES } from '../data/data';
import { COMBAT_KITS } from '../data/combat';
import { WEAPONS } from '../data/weapons';
import type { EquipmentSlot } from '../data/inventory';

const slotLabels: Record<EquipmentSlot, string> = {
  head: 'Cabeza', pendant: 'Colgante', chest: 'Pecho', hands: 'Manos', ring: 'Anillo',
  weapon: 'Arma principal', offhand: 'Mano secundaria', legs: 'Piernas', trinket: 'Abalorio',
};

export function setItemTooltip(target: HTMLElement, id: string, bound = false) {
  target.dataset.itemId = id;
  target.dataset.itemBound = String(bound || itemDef(id)?.bound === true);
  const rarity = itemRarity(id);
  target.dataset.rarity = rarity;
  target.style.setProperty('--item-rarity', ITEM_RARITIES[rarity].color);
  target.setAttribute('aria-label', `${t(itemLabel(id))} · ${t(ITEM_RARITIES[rarity].label)}`);
}

export function renderItemTooltip(container: HTMLElement, id: string, bound = false) {
  const item = itemDef(id);
  const rarity = ITEM_RARITIES[itemRarity(id)];
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
  category.textContent = `${t(rarity.label)} · ${t(item.category)}`;
  category.style.color = rarity.color;
  const name = document.createElement('strong');
  name.className = 'item-tip-name';
  name.textContent = t(item.label);
  name.style.color = rarity.color;
  identity.append(category, name);
  header.append(icon, identity);
  container.append(header);
  const equipment = EQUIPPABLE[id];
  if (equipment) {
    const requirements = document.createElement('p');
    requirements.className = 'item-tip-requirements';
    requirements.textContent = [
      slotLabels[equipment.slot] !== item.category ? t(slotLabels[equipment.slot]) : null,
      t(equipment.cls ? CLASSES[equipment.cls].label : 'Todas las clases'),
    ].filter(Boolean).join(' · ');
    container.append(requirements);
  }
  if (item.collection) {
    const collection = document.createElement('p');
    collection.className = 'item-tip-collection';
    collection.textContent = `${t('Colección')}: ${t(item.collection)}`;
    container.append(collection);
  }
  if (bound || item.bound) {
    const binding = document.createElement('span');
    binding.className = 'item-tip-binding';
    binding.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/><path d="M8 10v1"/></svg>';
    binding.append(t('Ligado'));
    binding.setAttribute('aria-label', t('Ligado · No intercambiable'));
    container.append(binding);
  }

  // Rarity already has a visible heading. A numeric catalogue tier adds no
  // information here and must not be presented as a character level requirement.
  const visibleStats = (item.stats ?? []).filter(stat => stat.label !== 'Rareza' && stat.label !== 'Categoría de equipo');
  const weapon = WEAPONS[id];
  if (weapon?.slot === 'weapon') {
    const kit = COMBAT_KITS[weapon.cls];
    const number = (value: number) => value.toLocaleString(getLanguage() === 'en' ? 'en-US' : 'es-ES');
    visibleStats.push({ label: 'Intervalo de ataque', value: `${number(kit.interval)} s` }, { label: 'Alcance', value: `${number(kit.range)} m` });
  }
  if (visibleStats.length) {
    const stats = document.createElement('dl');
    stats.className = 'item-tip-stats';
    for (const stat of visibleStats) {
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
  if (item.description) {
    const description = document.createElement('p');
    description.className = 'item-tip-description';
    description.textContent = t(item.description);
    container.append(description);
  }
  if (item.sellable === false) {
    const restriction = document.createElement('small');
    restriction.className = 'item-tip-restriction';
    restriction.textContent = t('No vendible');
    container.append(restriction);
    return;
  }

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

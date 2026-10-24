import type { CharData } from '../data/data';
import { FOOD_EFFECTS } from '../data/food';
import { itemIcon, itemLabel } from '../data/items';
import { t } from './i18n';

let signature = '';

export function renderBuffs(d: CharData, paused: boolean) {
  const root = document.getElementById('active-buffs')!;
  const buff = d.foodBuff;
  if (!buff || buff.remaining <= 0) {
    root.replaceChildren();
    root.hidden = true;
    signature = '';
    return;
  }
  root.hidden = false;
  const seconds = Math.ceil(buff.remaining);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const next = `${buff.itemId}|${seconds}|${paused}|${document.documentElement.lang}`;
  if (next === signature) return;
  signature = next;
  let badge = root.querySelector<HTMLButtonElement>('.food-buff');
  if (!badge) {
    badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'food-buff';
    badge.innerHTML = itemIcon(buff.itemId);
    badge.append(document.createElement('span'));
    root.append(badge);
  }
  if(badge.dataset.foodId!==buff.itemId){badge.innerHTML=itemIcon(buff.itemId);badge.append(document.createElement('span'));badge.dataset.foodId=buff.itemId;}
  const effect = FOOD_EFFECTS[buff.itemId];
  const title = `${t('Bien alimentado')}|${t('Origen: {item}. +{health} de vida máxima y +{resource} de maná o estamina máximos. Dura 15 minutos de conexión; se pausa al desconectarte. Comer otro renueva el tiempo, sin acumularse.', {
    item: t(itemLabel(buff.itemId)), health: effect.maxHealth, resource: effect.maxResource,
  })}`;
  if (badge.dataset.tip !== undefined) badge.dataset.tip = title;
  else badge.title = title;
  badge.querySelector('span')!.textContent = time;
  badge.setAttribute('aria-label', t('{buff}: {time} restantes{paused}', {
    buff: t('Bien alimentado'), time, paused: paused ? t(' (en pausa)') : '',
  }));
  badge.classList.toggle('paused', paused);
}

export function initBuffLayout() {
  const bar = document.getElementById('action-bar')!;
  const root = document.getElementById('active-buffs')!;
  const update = () => {
    const rect = bar.getBoundingClientRect();
    if (rect.height > 0) {
      const bottom = innerHeight - rect.top + 8;
      root.style.bottom = `${bottom}px`;
      const buffHeight = Math.max(56, root.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--interaction-bottom', `${bottom + buffHeight + 16}px`);
    }
  };
  const observer = new ResizeObserver(update);
  observer.observe(bar);
  observer.observe(root);
  window.addEventListener('resize', update);
}

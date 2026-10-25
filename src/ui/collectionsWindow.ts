import { COIN_BAGS } from '../data/coinBags';
import { FAIRY_DUST_SPOTS } from '../data/fairyDust';
import { t } from './i18n';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const realms = [
  { id: 'brumaluz', label: 'Brumaluz', available: true, icon: '<path d="M12 48V26h11v22m18 0V26h11v22" fill="#c4ad7b"/><path d="m10 26 7-14 8 14m14 0 7-14 8 14" fill="#617d7c"/><path d="M23 48V20h18v28Z" fill="#ecd7a6"/><path d="m20 20 12-12 12 12Z" fill="#5d787a"/><path d="M27 48V37a5 5 0 0 1 10 0v11" fill="#564332"/><path d="M16 32h3m-3 6h3m25-6h3m-3 6h3M29 25h6m-6 5h6M8 49h48"/><path d="M32 8V3l9 3-9 2" fill="#dfaf52"/><path d="m11 53 21 3 21-3" fill="none" stroke="#c59c55"/>' },
  { id: 'arboleda', label: 'La arboleda', available: false, icon: '<path d="M10 48q22-10 44 0l-5 5H15Z" fill="#87976a"/><path d="M28 47V23h8v24" fill="#92704a"/><path d="M30 38 20 30m14 6 9-12" fill="none"/><path d="M19 32c-15-2-11-17-1-18 0-10 16-15 23-4 13-2 20 17 7 21-4 11-20 12-29 1Z" fill="#65845c"/><path d="M18 23q-2-9 8-11m9 1q10-1 11 8" fill="none" stroke="#adc58c"/><path d="m11 37 2 3 3 1-3 1-2 3-1-3-3-1 3-1m39-28 1 2 3 1-3 1-1 3-1-3-2-1 2-1" fill="#f5d68c"/>' },
  { id: 'luna_argentea', label: 'Isla de Lunargenta', available: false, icon: '<path d="M46 9a13 13 0 0 1-16 18A14 14 0 1 0 46 9Z" fill="#dce6dc"/><path d="M10 43q16-5 27-1l13 6H12Z" fill="#929d76"/><path d="M25 42V31h9v11" fill="#e6d5af"/><path d="m23 31 7-7 7 7Z" fill="#748e98"/><path d="M19 42c-6-12-3-17 2-21m-3 9-7-5m7 1 8-5" fill="none" stroke="#5f8274"/><path d="M7 49q6-3 12 0t12 0 12 0 14 0M11 54q6-3 12 0t12 0 14 0" fill="none" stroke="#779da1"/><path d="m16 9 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill="#f5d68c"/>' },
  { id: 'cumbres_cobre', label: 'Cumbres de cobre', available: false, icon: '<path d="m6 49 15-28 10 17 10-27 18 38Z" fill="#a98264"/><path d="m21 21-6 12 6-3 5 3Zm20-10-7 19 7-5 6 5Z" fill="#eee5cf"/><path d="m31 38 10-13 1 24m-21-19 2 19" fill="none" stroke="#795d46"/><path d="m11 49 9-7 8 7m16 0 6-10 6 10" fill="#bf9569"/><path d="m28 49 4-9 5 9-5 7Z" fill="#d39860"/><path d="m32 40 0 16m-4-7h9" fill="none" stroke="#f6d49a"/><path d="M7 54h18m14 0h16" fill="none"/>' },
  { id: 'rusty_hearts', label: 'Rusty Hearts', available: false, icon: '<path d="M9 50V22h32v28Z" fill="#c6ad83"/><path d="m7 23 17-14 20 14Z" fill="#a66e4c"/><path d="M38 19V9h8v22" fill="#a18e78"/><path d="M41 5q-4-4 0-6m7 7q-3-3 0-6" fill="none" stroke="#a5977a"/><path d="M15 50V38a7 7 0 0 1 14 0v12" fill="#584331"/><path d="M19 48c-5-5 1-7 2-12 5 4 3 6 5 8 0 5-4 6-7 4Z" fill="#e0aa4c"/><path d="M39 39h17l-4 7H41l-5-3h-4v-4Zm4 7v5m-5 0h18" fill="#81908a"/><path d="M13 28h5m9 0h5M6 53h24m-6-36v6" fill="none"/>' },
] as const;

const areas = ['Brumaluz', 'Alrededores de Brumaluz'] as const;

function dustIcon() {
  const icon = el('span', 'collection-category-icon');
  icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3Zm0 2c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1ZM6 15c0-1.1 1.1-2 2.5-2s2.5 .9 2.5 2-1.1 2-2.5 2S6 16.1 6 15ZM18 15c0-1.1 1.1-2 2.5-2S23 13.9 23 15s-1.1 2-2.5 2S18 16.1 18 15ZM4 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4Zm8 0c0-1.1 1.1-2 2.5-2S16 10.9 16 12s-1.1 2-2.5 2S12 13.1 12 12Z" fill="#a8d8ff" stroke="#5b8db8" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function bagIcon() {
  const icon = el('span', 'collection-category-icon');
  icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5c.1-1.7 1.2-2.8 3-2.8s2.9 1.1 3 2.8l2.3 1.1-1 2c1.9 1.5 3.2 4.2 3.2 7 0 4.3-3.1 6.7-7.5 6.7s-7.5-2.4-7.5-6.7c0-2.8 1.3-5.5 3.2-7l-1-2Z" fill="#bd9958" stroke="#795832" stroke-width="1.2" stroke-linejoin="round"/><path d="M8.2 8.3c2.1 1.1 5.5 1.1 7.6 0M8.7 9.2l-1.2 1.1m8.8-1.1 1.2 1.1" fill="none" stroke="#f0d99c" stroke-width="1" stroke-linecap="round"/><path d="M12 11.1c1.3 1.2 2.1 2.4 2.1 3.6a2.1 2.1 0 1 1-4.2 0c0-1.2.8-2.4 2.1-3.6Z" fill="#f4d36f" stroke="#8b6429" stroke-width=".8"/><path d="M5.2 5.2a1.8 1.8 0 1 1 3.6 0 1.8 1.8 0 0 1-3.6 0ZM16.7 4.8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" fill="#e8c65f" stroke="#8b6429" stroke-width=".8"/></svg>';
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

export function renderCollections(container: HTMLElement, collectedIds: readonly string[], dustCollectedIds: readonly string[] = []) {
  const collected = new Set(collectedIds);
  const collectedDust = new Set(dustCollectedIds);
  let activeRealm: string | null = null;

  const realmBags = (realmId: string) => {
    const realmLabel = realms.find(realm => realm.id === realmId)?.label ?? realmId;
    return COIN_BAGS.filter(bag => bag.realm === realmLabel);
  };
  const foundIn = (bags: readonly (typeof COIN_BAGS)[number][]) => bags.filter(bag => collected.has(bag.id)).length;
  const foundInDust = (dusts: readonly (typeof FAIRY_DUST_SPOTS)[number][]) => dusts.filter(dust => collectedDust.has(dust.id)).length;
  const percentIn = (bags: readonly (typeof COIN_BAGS)[number][]) => bags.length ? Math.round(foundIn(bags) / bags.length * 100) : 0;
  const completionTone = (percent: number) => percent >= 100 ? 'legendary' : percent >= 50 ? 'silver' : 'bronze';

  function renderHeader() {
    const percent = percentIn(COIN_BAGS);
    const header = el('header', 'collections-hero');
    const emblem = el('span', 'collections-hero-emblem');
    emblem.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M16 5v22M5 16h22M8.2 8.2l15.6 15.6m0-15.6L8.2 23.8" fill="none" stroke="currentColor" stroke-width=".9"/><path d="m16 9 1.5 5.5L23 16l-5.5 1.5L16 23l-1.5-5.5L9 16l5.5-1.5Z" fill="currentColor"/></svg>';
    const copy = el('span', 'collections-hero-copy');
    copy.append(el('small', undefined, t('ATLAS DE HALLAZGOS')), el('strong', undefined, t('Colecciones')),
      el('span', undefined, t(activeRealm ? 'Progreso de la región' : 'Tu progreso por las regiones del mundo')));
    header.append(emblem, copy);
    if (!activeRealm) {
      const progress = el('span', `collections-hero-progress ${completionTone(percent)}`);
      if (percent === 100) {
        const celebration = el('span', 'collections-completion-celebration');
        celebration.setAttribute('aria-hidden', 'true');
        celebration.innerHTML = '<svg viewBox="0 0 46 20"><path d="M8 15 5 5l8 5 5-8 5 8 8-5-3 10Z" fill="currentColor"/><path d="m3 3 1 2 2 1-2 1-1 2-1-2-2-1 2-1Zm38 0 1 2 2 1-2 1-1 2-1-2-2-1 2-1Zm-6 5 .8 1.6 1.7.4-1.3 1.2.3 1.8-1.5-.9-1.6.9.4-1.8-1.4-1.2 1.8-.4Z" fill="currentColor"/></svg>';
        progress.append(celebration);
      }
      progress.append(el('strong', undefined, `${percent}%`), el('small', undefined, t(percent === 100 ? '¡AL 100%!' : 'COMPLETADO')));
      header.append(progress);
    }
    return header;
  }

  function renderAreas() {
    const list = el('div', 'collection-subzones');
    const realmLabel = realms.find(realm => realm.id === activeRealm)?.label;
    for (const area of areas) {
      const bags = COIN_BAGS.filter(bag => bag.realm === realmLabel && bag.area === area);
      const found = foundIn(bags);
      const details = el('details', 'collection-subzone');
      const summary = el('summary', 'collection-subzone-summary');
      summary.append(el('strong', undefined, t(area)));
      const category = el('div', `collection-category${bags.length > 0 && found === bags.length ? ' complete' : ''}`);
      category.append(bagIcon(), el('strong', undefined, t('Bolsas de pelines')),
        el('span', 'collection-category-count', `${found}/${bags.length}`));
      details.append(summary, category);
      const dusts = FAIRY_DUST_SPOTS.filter(dust => dust.realm === realmLabel && dust.area === area);
      const foundDust = foundInDust(dusts);
      const detailsDust = el('details', 'collection-subzone');
      const summaryDust = el('summary', 'collection-subzone-summary');
      summaryDust.append(el('strong', undefined, t(area)));
      const categoryDust = el('div', `collection-category${dusts.length > 0 && foundDust === dusts.length ? ' complete' : ''}`);
      categoryDust.append(dustIcon(), el('strong', undefined, t('Polvos de hada')),
        el('span', 'collection-category-count', `${foundDust}/${dusts.length}`));
      detailsDust.append(summaryDust, categoryDust);
      list.append(detailsDust);
    }
    return list;
  }

  function renderRealmPage(realm: (typeof realms)[number]) {
    const page = el('div', 'collections-realm-page');
    const back = el('button', 'collections-back', `‹ ${t('Zonas')}`);
    back.type = 'button';
    back.onclick = () => { activeRealm = null; render(); };
    const title = el('div', 'collections-realm-heading');
    title.append(el('h3', undefined, t(realm.label)), el('span', undefined, t('Elige una subzona para ver su progreso')));
    page.append(back, title, renderAreas());
    return page;
  }

  function renderRealmGrid() {
    const section = el('section', 'collections-realm-select');
    const heading = el('div', 'collections-section-heading');
    heading.append(el('h3', undefined, t('Zonas')), el('span', undefined, t('Elige una región')));
    const grid = el('div', 'collections-realm-grid');
    for (const realm of realms) {
      const bags = realmBags(realm.id);
      const tile = el('button', `collections-realm-tile${realm.available ? '' : ' locked'}`);
      tile.type = 'button';
      tile.disabled = !realm.available;
      tile.setAttribute('aria-label', t(realm.available ? '{realm}, {found} de {total} encontrados' : '{realm}, próximamente', {
        realm: t(realm.label), found: foundIn(bags), total: bags.length,
      }));
      const icon = el('span', 'collections-realm-icon');
      icon.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle class="realm-emblem-field" cx="32" cy="32" r="30"/><g class="realm-emblem-art">${realm.icon}</g></svg>`;
      tile.append(icon, el('strong', undefined, t(realm.label)));
      if (realm.available) {
        const percent = percentIn(bags);
        tile.append(el('span', `collections-tile-progress ${completionTone(percent)}`, `${percent}% ${t('completado')}`));
        tile.onclick = () => { activeRealm = realm.id; render(); };
      } else tile.append(el('span', 'collections-tile-locked', t('Próximamente')));
      grid.append(tile);
    }
    section.append(heading, grid);
    return section;
  }

  function render() {
    const root = el('div', 'collections-window');
    if (activeRealm) {
      const realm = realms.find(item => item.id === activeRealm);
      if (realm?.available) root.append(renderRealmPage(realm));
      else { activeRealm = null; root.append(renderRealmGrid()); }
    } else root.append(renderHeader(), renderRealmGrid());
    container.replaceChildren(root);
  }

  render();
}

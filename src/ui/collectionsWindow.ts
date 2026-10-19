import { COIN_BAGS } from '../data/coinBags';
import { t } from './i18n';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const realms = [
  { id: 'brumaluz', label: 'Brumaluz', available: true, icon: '<path d="M8 21V9l8-5v17M16 12h6v9M5 21h18M11 12h2m-2 4h2m5 0h2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'arboleda', label: 'La arboleda', available: false, icon: '<path d="m12 3 6 8h-3l5 7h-6v3h-4v-3H4l5-7H6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' },
  { id: 'luna_argentea', label: 'Isla de Luna Argéntea', available: false, icon: '<path d="M18.5 16.8A8.5 8.5 0 0 1 9 5.5a8.5 8.5 0 1 0 9.5 11.3Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m19 4 .8 2.2L22 7l-2.2.8L19 10l-.8-2.2L16 7l2.2-.8Z" fill="currentColor"/>' },
  { id: 'cumbres_cobre', label: 'Cumbres de cobre', available: false, icon: '<path d="m3 20 6-11 4 6 3-5 5 10ZM9 9l1.5 2.3M16 10l1 1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' },
  { id: 'rusty_hearts', label: 'Rusty Hearts', available: false, icon: '<path d="M12 21 4.8 14A4.5 4.5 0 0 1 11 7.5l1 1 1-1a4.5 4.5 0 0 1 6.2 6.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m8 13 2 2 4-4 2 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' },
] as const;

const areas = ['Brumaluz', 'Alrededores de Brumaluz'] as const;

function bagIcon() {
  const icon = el('span', 'collection-category-icon');
  icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5c.1-1.7 1.2-2.8 3-2.8s2.9 1.1 3 2.8l2.3 1.1-1 2c1.9 1.5 3.2 4.2 3.2 7 0 4.3-3.1 6.7-7.5 6.7s-7.5-2.4-7.5-6.7c0-2.8 1.3-5.5 3.2-7l-1-2Z" fill="#bd9958" stroke="#795832" stroke-width="1.2" stroke-linejoin="round"/><path d="M8.2 8.3c2.1 1.1 5.5 1.1 7.6 0M8.7 9.2l-1.2 1.1m8.8-1.1 1.2 1.1" fill="none" stroke="#f0d99c" stroke-width="1" stroke-linecap="round"/><path d="M12 11.1c1.3 1.2 2.1 2.4 2.1 3.6a2.1 2.1 0 1 1-4.2 0c0-1.2.8-2.4 2.1-3.6Z" fill="#f4d36f" stroke="#8b6429" stroke-width=".8"/><path d="M5.2 5.2a1.8 1.8 0 1 1 3.6 0 1.8 1.8 0 0 1-3.6 0ZM16.7 4.8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" fill="#e8c65f" stroke="#8b6429" stroke-width=".8"/></svg>';
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

export function renderCollections(container: HTMLElement, collectedIds: readonly string[]) {
  const collected = new Set(collectedIds);
  let activeRealm: string | null = null;

  const realmBags = (realmId: string) => {
    const realmLabel = realms.find(realm => realm.id === realmId)?.label ?? realmId;
    return COIN_BAGS.filter(bag => bag.realm === realmLabel);
  };
  const foundIn = (bags: readonly (typeof COIN_BAGS)[number][]) => bags.filter(bag => collected.has(bag.id)).length;
  const percentIn = (bags: readonly (typeof COIN_BAGS)[number][]) => bags.length ? Math.round(foundIn(bags) / bags.length * 100) : 0;
  const completionTone = (percent: number) => percent >= 100 ? 'gold' : percent >= 50 ? 'silver' : 'bronze';

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
      progress.append(el('strong', undefined, `${percent}%`), el('small', undefined, t('COMPLETADO')));
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
      const category = el('div', 'collection-category');
      category.append(bagIcon(), el('strong', undefined, t('Bolsas de pelines')),
        el('span', 'collection-category-count', `${found}/${bags.length}`));
      details.append(summary, category);
      list.append(details);
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
      const bags = realmBags(realm.label);
      const tile = el('button', `collections-realm-tile${realm.available ? '' : ' locked'}`);
      tile.type = 'button';
      tile.disabled = !realm.available;
      tile.setAttribute('aria-label', t(realm.available ? '{realm}, {found} de {total} encontrados' : '{realm}, próximamente', {
        realm: t(realm.label), found: foundIn(bags), total: bags.length,
      }));
      const icon = el('span', 'collections-realm-icon');
      icon.innerHTML = `<svg viewBox="0 0 28 28" aria-hidden="true">${realm.icon}</svg>`;
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

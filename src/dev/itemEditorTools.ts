import { ITEM_RARITIES, type ItemRarity } from '../data/itemRarity';
import { CATEGORY_LABELS, type ItemCatalogItem } from '../data/itemsCatalog';

export interface HistoryEntry<T> {
  state: T;
  timestamp: number;
}

export class HistoryManager<T> {
  private past: HistoryEntry<T>[] = [];
  private future: HistoryEntry<T>[] = [];
  private current: T;
  private readonly maxStates = 60;
  private readonly debounceMs = 400;

  constructor(initial: T) {
    this.current = structuredClone(initial);
  }

  get state(): T {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  push(next: T) {
    const now = Date.now();
    const last = this.past[this.past.length - 1];

    if (last && now - last.timestamp < this.debounceMs) {
      // Coalesce recent quick typing
      this.current = structuredClone(next);
      return;
    }

    this.past.push({ state: structuredClone(this.current), timestamp: now });
    if (this.past.length > this.maxStates) {
      this.past.shift();
    }
    this.current = structuredClone(next);
    this.future = [];
  }

  undo(): T | null {
    if (!this.canUndo) return null;
    const previous = this.past.pop()!;
    this.future.push({ state: structuredClone(this.current), timestamp: Date.now() });
    this.current = structuredClone(previous.state);
    return this.current;
  }

  redo(): T | null {
    if (!this.canRedo) return null;
    const next = this.future.pop()!;
    this.past.push({ state: structuredClone(this.current), timestamp: Date.now() });
    this.current = structuredClone(next.state);
    return this.current;
  }

  reset(newInitial: T) {
    this.current = structuredClone(newInitial);
    this.past = [];
    this.future = [];
  }
}

export type ItemSortColumn = 'id' | 'label' | 'category' | 'rarity' | 'value';
export type ItemSortDirection = 'asc' | 'desc';

export function filterAndSortItems(
  items: ItemCatalogItem[],
  options: {
    query?: string;
    category?: string;
    rarity?: string;
    status?: 'all' | 'active' | 'inactive';
    sortBy?: ItemSortColumn;
    direction?: ItemSortDirection;
  }
): ItemCatalogItem[] {
  const {
    query = '',
    category = 'all',
    rarity = 'all',
    status = 'all',
    sortBy = 'label',
    direction = 'asc',
  } = options;

  const q = query.trim().toLowerCase();

  const filtered = items.filter(item => {
    if (category !== 'all' && item.category !== category) return false;
    if (rarity !== 'all' && item.rarity !== rarity) return false;
    if (status === 'active' && item.active === false) return false;
    if (status === 'inactive' && item.active !== false) return false;

    if (!q) return true;
    return (
      item.id.toLowerCase().includes(q) ||
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  const rarityWeights: Record<ItemRarity, number> = {
    common: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    artifact: 5,
  };

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'id') {
      cmp = a.id.localeCompare(b.id);
    } else if (sortBy === 'label') {
      cmp = a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
    } else if (sortBy === 'category') {
      cmp = a.category.localeCompare(b.category);
    } else if (sortBy === 'rarity') {
      cmp = (rarityWeights[a.rarity] ?? 0) - (rarityWeights[b.rarity] ?? 0);
    } else if (sortBy === 'value') {
      cmp = (a.value ?? 0) - (b.value ?? 0);
    }

    return direction === 'asc' ? cmp : -cmp;
  });

  return filtered;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): {
  pageItems: T[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
} {
  const totalItems = items.length;
  if (pageSize <= 0) {
    return { pageItems: items, totalPages: 1, currentPage: 1, totalItems };
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return { pageItems, totalPages, currentPage, totalItems };
}

/** Renderiza el tooltip interactivo idéntico al juego oficial Brumaluz */
export function renderItemGameTooltip(item: ItemCatalogItem): string {
  const rarityMeta = ITEM_RARITIES[item.rarity] || ITEM_RARITIES.common;
  const categoryLabel = CATEGORY_LABELS[item.category] || item.category;

  const statsHtml = (item.stats || [])
    .map(s => `<li class="tooltip-stat"><span>${escapeHtml(s.label)}</span><b>${escapeHtml(s.value)}</b></li>`)
    .join('');

  const effectsHtml = (item.effectText || item.effects?.map(e => e.description || `${e.type}`) || [])
    .map(text => `<li class="tooltip-effect">❧ ${escapeHtml(text)}</li>`)
    .join('');

  const sellPrice = item.sellPrice ?? Math.max(1, Math.floor((item.value ?? 0) / 2));

  return `
    <article class="brumaluz-tooltip" style="--rarity-color:${rarityMeta.color};">
      <header class="tooltip-header">
        <div class="tooltip-icon-slot">
          <svg class="item-art" viewBox="0 0 24 24" aria-hidden="true">
            <rect x=".7" y=".7" width="22.6" height="22.6" rx="3" fill="${rarityMeta.color}" fill-opacity=".12" stroke="${rarityMeta.color}" stroke-width="1.2"/>
            ${item.icon || '<circle cx="12" cy="12" r="8" fill="#5c635b"/>'}
          </svg>
        </div>
        <div class="tooltip-title-block">
          <h4 class="tooltip-title" style="color:${rarityMeta.color};">${escapeHtml(item.label)}</h4>
          <span class="tooltip-subtitle">${escapeHtml(categoryLabel)}${item.subcategory ? ` · ${escapeHtml(item.subcategory)}` : ''} · ${rarityMeta.label}</span>
        </div>
      </header>

      ${item.description ? `<p class="tooltip-desc">${escapeHtml(item.description)}</p>` : ''}

      ${statsHtml ? `<ul class="tooltip-stats-list">${statsHtml}</ul>` : ''}

      ${effectsHtml ? `<ul class="tooltip-effects-list">${effectsHtml}</ul>` : ''}

      <footer class="tooltip-footer">
        <div class="tooltip-flags">
          ${item.bound ? '<span class="pill-bound">Ligado al personaje</span>' : ''}
          ${item.equippable ? `<span class="pill-equip">Ranura: ${item.slot || 'Equipable'}</span>` : ''}
          ${item.stack && item.stack > 1 ? `<span class="pill-stack">Pila máx: ${item.stack}</span>` : ''}
        </div>
        <div class="tooltip-economy">
          ${item.value > 0 ? `<span>Compra: <b>${item.value} 🪙 Pelines</b></span>` : '<span class="muted">No se compra</span>'}
          ${item.sellable !== false ? `<span>Venta: <b>${sellPrice} 🪙 Pelines</b></span>` : '<span class="muted">No comerciable</span>'}
        </div>
      </footer>
    </article>
  `;
}

function escapeHtml(text: string): string {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

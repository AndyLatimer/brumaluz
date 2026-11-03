/**
 * shopEditorTools.ts - Utilidades, historial, filtrado, paginación y renderizado visual para el editor de tiendas.
 */

import type {
  ShopDefinition,
  ShopReferences,
  ShopItemReference,
  ShopNpcReference,
  ShopAuditReport,
} from '../data/shopsCatalog';
import { ITEM_RARITIES, type ItemRarity } from '../data/itemRarity';
import { currencyIcon, type CurrencyId } from '../data/currency';

/**
 * Gestor de historial de cambios locales (Deshacer / Rehacer) con coalescencia de tipeo.
 */
export class HistoryManager<T> {
  private past: T[] = [];
  private present: T;
  private future: T[] = [];
  private maxStates: number;
  private lastActionTime = 0;
  private debounceMs: number;

  constructor(initial: T, maxStates = 60, debounceMs = 400) {
    this.present = structuredClone(initial);
    this.maxStates = maxStates;
    this.debounceMs = debounceMs;
  }

  get current(): T {
    return this.present;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  push(next: T, forceSeparate = false): void {
    const now = Date.now();
    const isTyping = !forceSeparate && now - this.lastActionTime < this.debounceMs;
    this.lastActionTime = now;

    if (isTyping && this.past.length > 0) {
      this.present = structuredClone(next);
      this.future = [];
      return;
    }

    this.past.push(this.present);
    if (this.past.length > this.maxStates) {
      this.past.shift();
    }
    this.present = structuredClone(next);
    this.future = [];
  }

  undo(): T | null {
    if (!this.canUndo()) return null;
    const prev = this.past.pop()!;
    this.future.unshift(this.present);
    this.present = prev;
    return structuredClone(this.present);
  }

  redo(): T | null {
    if (!this.canRedo()) return null;
    const next = this.future.shift()!;
    this.past.push(this.present);
    this.present = next;
    return structuredClone(this.present);
  }

  reset(initial: T): void {
    this.present = structuredClone(initial);
    this.past = [];
    this.future = [];
    this.lastActionTime = 0;
  }
}

export type ShopSortOrder =
  | 'name_asc'
  | 'name_desc'
  | 'id_asc'
  | 'id_desc'
  | 'items_desc'
  | 'items_asc'
  | 'category_asc';

export interface ShopFilterOptions {
  searchQuery?: string;
  category?: string;
  status?: 'all' | 'active' | 'inactive';
  npcFilter?: string; // 'all', 'assigned', 'unassigned', o un npcId específico
  sortOrder?: ShopSortOrder;
}

export function filterAndSortShops(
  shops: ShopDefinition[],
  options: ShopFilterOptions,
  refs?: ShopReferences
): ShopDefinition[] {
  const query = (options.searchQuery ?? '').trim().toLowerCase();
  const category = options.category ?? 'all';
  const status = options.status ?? 'all';
  const npcFilter = options.npcFilter ?? 'all';
  const sort = options.sortOrder ?? 'name_asc';

  const npcMap = new Map<string, ShopNpcReference>();
  if (refs?.npcs) {
    for (const n of refs.npcs) npcMap.set(n.id, n);
  }

  const itemMap = new Map<string, ShopItemReference>();
  if (refs?.items) {
    for (const it of refs.items) itemMap.set(it.id, it);
  }

  let result = shops.filter(shop => {
    // 1. Filtro por estado
    if (status === 'active' && !shop.active) return false;
    if (status === 'inactive' && shop.active) return false;

    // 2. Filtro por categoría
    if (category !== 'all' && shop.category !== category) return false;

    // 3. Filtro por NPC
    if (npcFilter === 'assigned' && !shop.npcId) return false;
    if (npcFilter === 'unassigned' && Boolean(shop.npcId)) return false;
    if (npcFilter !== 'all' && npcFilter !== 'assigned' && npcFilter !== 'unassigned') {
      if (shop.npcId !== npcFilter) return false;
    }

    // 4. Búsqueda por texto
    if (query) {
      const matchId = shop.id.toLowerCase().includes(query);
      const matchName = shop.name.toLowerCase().includes(query);
      const matchDesc = shop.description.toLowerCase().includes(query);
      const matchTags = (shop.tags || []).some(t => t.toLowerCase().includes(query));
      const matchNpcId = shop.npcId.toLowerCase().includes(query);
      const npcName = npcMap.get(shop.npcId)?.name?.toLowerCase() || '';
      const matchNpcName = npcName.includes(query);

      // Coincidencia con algún producto que vende
      const matchItem = shop.items.some(item => {
        if (item.itemId.toLowerCase().includes(query)) return true;
        const it = itemMap.get(item.itemId);
        return it ? it.label.toLowerCase().includes(query) : false;
      });

      if (!matchId && !matchName && !matchDesc && !matchTags && !matchNpcId && !matchNpcName && !matchItem) {
        return false;
      }
    }

    return true;
  });

  // Ordenación
  result.sort((a, b) => {
    switch (sort) {
      case 'name_asc':
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      case 'name_desc':
        return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' });
      case 'id_asc':
        return a.id.localeCompare(b.id);
      case 'id_desc':
        return b.id.localeCompare(a.id);
      case 'items_desc':
        return b.items.length - a.items.length;
      case 'items_asc':
        return a.items.length - b.items.length;
      case 'category_asc':
        return a.category.localeCompare(b.category);
      default:
        return 0;
    }
  });

  return result;
}

export function paginateShops(
  shops: ShopDefinition[],
  page: number,
  pageSize = 15
): { paged: ShopDefinition[]; totalPages: number; totalCount: number; currentPage: number } {
  const totalCount = shops.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const paged = shops.slice(start, start + pageSize);

  return { paged, totalPages, totalCount, currentPage };
}

/**
 * Renderiza la vista previa del escaparate de la tienda, idéntico al componente visual del juego (vendorWindow.ts).
 */
export function renderShopLivePreview(
  shop: ShopDefinition,
  refs: ShopReferences,
  audit?: ShopAuditReport
): string {
  const itemMap = new Map<string, ShopItemReference>();
  for (const it of refs.items || []) {
    itemMap.set(it.id, it);
  }

  const npcMap = new Map<string, ShopNpcReference>();
  for (const n of refs.npcs || []) {
    npcMap.set(n.id, n);
  }

  const npc = shop.npcId ? npcMap.get(shop.npcId) : null;
  const merchantName = npc ? npc.name : (shop.npcId ? `NPC: ${shop.npcId}` : 'Sin comerciante');
  const merchantSubtitle = npc ? npc.subtitle : 'Establecimiento independiente';

  const defaultCurrency: CurrencyId = shop.currency || 'pelines';

  const bannerCurrencyIcon = currencyIcon(defaultCurrency);

  let itemsHtml = '';
  if (shop.items.length === 0) {
    itemsHtml = `
      <div class="shop-preview-empty">
        <svg class="preview-empty-icon" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 10h18l-2-7H5zM5 10v11h14V10M9 21v-7h6v7"/>
        </svg>
        <p>No hay mercancías asignadas a esta tienda.</p>
        <small class="muted">Pulsa «+ Añadir producto» para incorporar objetos del catálogo.</small>
      </div>
    `;
  } else {
    itemsHtml = shop.items.map((entry, idx) => {
      const ref = itemMap.get(entry.itemId);
      const isMissing = !ref;

      const label = ref ? ref.label : `Objeto no encontrado: ${entry.itemId}`;
      const rarity: ItemRarity = (ref?.rarity as ItemRarity) || 'common';
      const rarityMeta = ITEM_RARITIES[rarity] || ITEM_RARITIES.common;
      const effectiveBuy = entry.buyPrice ?? (ref?.value ?? 0);
      const effectiveSell = entry.sellPrice ?? (ref?.sellPrice ?? Math.max(1, Math.floor((ref?.value ?? 0) / 2)));
      const itemCur = entry.currency || defaultCurrency;
      const stockBadge = entry.stock !== null && entry.stock !== undefined
        ? `<span class="preview-stock-pill" title="Unidades disponibles">${entry.stock} en stock</span>`
        : '<span class="preview-stock-pill unl" title="Suministro ilimitado">∞ ilimitado</span>';

      const iconSvg = ref?.icon
        ? `<svg class="item-art" viewBox="0 0 24 24" style="--item-rarity:${rarityMeta.color}">${ref.icon}</svg>`
        : `<svg class="item-art" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#303830"/><text x="12" y="16" text-anchor="middle" fill="#888" font-size="12">?</text></svg>`;

      return `
        <li class="preview-vendor-row ${isMissing ? 'has-error' : ''}">
          <span class="preview-vendor-icon" style="border-color: ${rarityMeta.color}88">
            ${iconSvg}
          </span>
          <div class="preview-vendor-info">
            <div class="preview-vendor-header">
              <strong class="preview-vendor-name" style="color: ${rarityMeta.color}">${escapeHtml(label)}</strong>
              ${stockBadge}
            </div>
            <span class="preview-vendor-category">
              <span class="rarity-dot" style="background-color: ${rarityMeta.color}"></span>
              ${escapeHtml(rarityMeta.label)} · ${ref ? escapeHtml(ref.category) : 'Desconocido'}
            </span>
          </div>
          <div class="preview-vendor-trade">
            <div class="preview-vendor-price" title="Precio de compra para el jugador">
              ${currencyIcon(itemCur)}
              <b>${effectiveBuy}</b>
            </div>
            <div class="preview-vendor-sell" title="Recompra al jugador: ${effectiveSell} ${itemCur}">
              <small>Venta: ${effectiveSell}</small>
            </div>
            <button type="button" class="btn gold preview-buy-btn" disabled>Comprar</button>
          </div>
        </li>
      `;
    }).join('');
  }

  const auditNotice = audit && !audit.valid ? `
    <div class="preview-audit-banner">
      <span class="audit-warning-icon">⚠️</span>
      <div>
        <strong>Esta tienda contiene advertencias o inconsistencias</strong>
        <p>${audit.issues.map(i => escapeHtml(i.message)).join('<br>')}</p>
      </div>
    </div>
  ` : '';

  return `
    <div class="shop-live-card">
      ${auditNotice}
      <!-- BANNER DE LA TIENDA -->
      <div class="preview-vendor-banner">
        <div class="preview-vendor-identity">
          <div class="preview-vendor-badge-wrap">
            <svg class="preview-merchant-svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M3 10h18l-2-7H5zM5 10v11h14V10M9 21v-7h6v7M3 10c0 4 5 4 5 0 0 4 8 4 8 0 0 4 5 4 5 0"/>
            </svg>
          </div>
          <div>
            <h3 class="preview-store-name">${escapeHtml(shop.name)}</h3>
            <p class="preview-store-merchant">${escapeHtml(merchantName)} · <span class="muted">${escapeHtml(merchantSubtitle)}</span></p>
          </div>
        </div>
        <div class="preview-gold-line">
          <span class="preview-wallet-label">Moneda:</span>
          <span class="preview-wallet-amount">${bannerCurrencyIcon} <b>${escapeHtml(defaultCurrency.toUpperCase())}</b></span>
          <span class="preview-status-pill ${shop.active ? 'active' : 'inactive'}">
            ${shop.active ? 'Activa en juego' : 'Inactiva (Borrador)'}
          </span>
        </div>
      </div>

      <!-- DESCRIPCIÓN / AMBIENTACIÓN -->
      ${shop.description ? `<p class="preview-store-description">${escapeHtml(shop.description)}</p>` : ''}

      <!-- COLUMNA DE MERCANCÍAS -->
      <div class="preview-section-title">
        <span>Mercancía disponible (${shop.items.length})</span>
        <span class="preview-stock-hint">Catálogo verificado</span>
      </div>

      <ul class="preview-vendor-list">
        ${itemsHtml}
      </ul>

      <p class="preview-vendor-hint">
        ${currencyIcon(defaultCurrency)} Los precios reflejan los valores configurados en la tienda de ${escapeHtml(shop.name)}.
      </p>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


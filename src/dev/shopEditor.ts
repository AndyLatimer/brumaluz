/**
 * shopEditor.ts - Controlador interactivo para el editor de tiendas y comerciantes de Brumaluz.
 */

import './shopEditor.css';
import {
  type ShopCatalog,
  type ShopDefinition,
  type ShopItem,
  type ShopReferences,
  SHOP_CATEGORIES,
  SHOP_TEMPLATES,
  createEmptyShop,
  createShopFromTemplate,
  duplicateShop,
  sanitizeId,
  validateShop,
  validateShopCatalog,
  auditShop,
} from '../data/shopsCatalog';
import {
  HistoryManager,
  filterAndSortShops,
  paginateShops,
  renderShopLivePreview,
  type ShopSortOrder,
} from './shopEditorTools';
import { ITEM_RARITIES, type ItemRarity } from '../data/itemRarity';
import { currencyIcon, type CurrencyId } from '../data/currency';

// Helper selector DOM
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// Estado del taller
let catalog: ShopCatalog = { version: 1, shops: [] };
let references: ShopReferences = { items: [], npcs: [], currencies: [] };
let revision = '';
let activeShop: ShopDefinition;
let isDirty = false;
let history: HistoryManager<ShopDefinition>;
let activeTab: 'general' | 'merchant' | 'products' = 'general';

// Filtros y paginación
let searchQuery = '';
let selectedCategory = 'all';
let selectedStatus: 'all' | 'active' | 'inactive' = 'all';
let selectedNpcFilter = 'all';
let sortOrder: ShopSortOrder = 'name_asc';
let currentPage = 1;
const PAGE_SIZE = 12;

// Modal de objetos
let itemPickerSearch = '';
let itemPickerCategory = 'all';
let itemPickerRarity = 'all';

// Elementos DOM principales
let statusEl: HTMLElement;
let shopsListEl: HTMLElement;
let shopCountBadge: HTMLElement;
let prevPageBtn: HTMLButtonElement;
let nextPageBtn: HTMLButtonElement;
let pageInfoEl: HTMLElement;
let livePreviewContainer: HTMLElement;
let auditBox: HTMLElement;
let modalOverlay: HTMLElement;

export async function init() {
  statusEl = $('status');
  shopsListEl = $('shops-list');
  shopCountBadge = $('shops-count-badge');
  prevPageBtn = $('prev-page-btn') as HTMLButtonElement;
  nextPageBtn = $('next-page-btn') as HTMLButtonElement;
  pageInfoEl = $('page-info');
  livePreviewContainer = $('live-preview-container');
  auditBox = $('audit-box');
  modalOverlay = $('item-picker-modal');

  setStatus('Cargando referencias y catálogo de tiendas…', 'saving');

  try {
    // 1. Cargar referencias
    const refRes = await fetch('/__dev/shops/references');
    if (refRes.ok) {
      references = await refRes.json();
    }

    // 2. Cargar catálogo de tiendas
    const catRes = await fetch('/__dev/shops');
    if (!catRes.ok) {
      throw new Error(`Error HTTP ${catRes.status}: ${catRes.statusText}`);
    }
    revision = catRes.headers.get('ETag') || '';
    catalog = validateShopCatalog(await catRes.json(), references);

    // Seleccionar primera tienda o crear una vacía
    if (catalog.shops.length > 0) {
      activeShop = structuredClone(catalog.shops[0]);
    } else {
      activeShop = createShopFromTemplate(SHOP_TEMPLATES[0].id);
      catalog.shops.push(structuredClone(activeShop));
    }

    history = new HistoryManager<ShopDefinition>(activeShop);

    setupEventListeners();
    populateSelects();
    renderLibrary();
    renderActiveShopForm();
    renderLivePreview();

    setStatus(`Catálogo cargado: ${catalog.shops.length} tiendas registradas.`, 'success');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Error al cargar el taller: ${msg}`, 'error');
  }
}

function setStatus(text: string, state: 'normal' | 'saving' | 'success' | 'error' = 'normal') {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = state !== 'normal' ? state : '';
}

function markDirty() {
  isDirty = true;
  history.push(activeShop);
  updateUndoRedoButtons();
  renderLivePreview();
  renderLibrary();
}

function updateUndoRedoButtons() {
  const undoBtn = $('undo-btn') as HTMLButtonElement;
  const redoBtn = $('redo-btn') as HTMLButtonElement;
  if (undoBtn) undoBtn.disabled = !history.canUndo();
  if (redoBtn) redoBtn.disabled = !history.canRedo();
}

function setupEventListeners() {
  // Filtro de búsqueda rápida
  $('search-input')?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    currentPage = 1;
    renderLibrary();
  });

  // Filtro por categoría
  $('category-filter')?.addEventListener('change', (e) => {
    selectedCategory = (e.target as HTMLSelectElement).value;
    currentPage = 1;
    renderLibrary();
  });

  // Filtro por estado
  $('status-filter')?.addEventListener('change', (e) => {
    selectedStatus = (e.target as HTMLSelectElement).value as 'all' | 'active' | 'inactive';
    currentPage = 1;
    renderLibrary();
  });

  // Filtro por comerciante NPC
  $('npc-filter')?.addEventListener('change', (e) => {
    selectedNpcFilter = (e.target as HTMLSelectElement).value;
    currentPage = 1;
    renderLibrary();
  });

  // Ordenación
  $('sort-filter')?.addEventListener('change', (e) => {
    sortOrder = (e.target as HTMLSelectElement).value as ShopSortOrder;
    renderLibrary();
  });

  // Píldoras de filtrado rápido
  document.querySelectorAll<HTMLButtonElement>('.filter-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.getAttribute('data-cat') || 'all';
      selectedCategory = cat;
      const select = $('category-filter') as HTMLSelectElement;
      if (select) select.value = cat;
      currentPage = 1;
      renderLibrary();
    });
  });

  // Paginación
  prevPageBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderLibrary();
    }
  });

  nextPageBtn?.addEventListener('click', () => {
    currentPage++;
    renderLibrary();
  });

  // Nueva tienda
  $('new-shop-btn')?.addEventListener('click', () => {
    createNewShopDialog();
  });

  // Duplicar tienda
  $('duplicate-shop-btn')?.addEventListener('click', () => {
    duplicateActiveShop();
  });

  // Eliminar tienda
  $('delete-shop-btn')?.addEventListener('click', () => {
    confirmDeleteActiveShop();
  });

  // Guardar tienda
  $('save-btn')?.addEventListener('click', () => {
    saveCatalog();
  });

  // Deshacer / Rehacer
  $('undo-btn')?.addEventListener('click', () => {
    const prev = history.undo();
    if (prev) {
      activeShop = prev;
      renderActiveShopForm();
      renderLivePreview();
      renderLibrary();
      updateUndoRedoButtons();
    }
  });

  $('redo-btn')?.addEventListener('click', () => {
    const next = history.redo();
    if (next) {
      activeShop = next;
      renderActiveShopForm();
      renderLivePreview();
      renderLibrary();
      updateUndoRedoButtons();
    }
  });

  // Pestañas
  document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => (c as HTMLElement).hidden = true);
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      if (targetId) {
        activeTab = targetId as 'general' | 'merchant' | 'products';
        const targetContent = $(`tab-${targetId}`);
        if (targetContent) targetContent.hidden = false;
      }
    });
  });

  // Modal de objetos: botón abrir
  $('add-product-btn')?.addEventListener('click', () => {
    openItemPicker();
  });

  // Modal de objetos: botón cerrar
  $('close-picker-btn')?.addEventListener('click', () => {
    closeItemPicker();
  });

  modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeItemPicker();
  });

  // Filtros del modal de objetos
  $('picker-search')?.addEventListener('input', (e) => {
    itemPickerSearch = (e.target as HTMLInputElement).value;
    renderItemPickerGrid();
  });

  $('picker-category')?.addEventListener('change', (e) => {
    itemPickerCategory = (e.target as HTMLSelectElement).value;
    renderItemPickerGrid();
  });

  $('picker-rarity')?.addEventListener('change', (e) => {
    itemPickerRarity = (e.target as HTMLSelectElement).value;
    renderItemPickerGrid();
  });

  // Exportar / Importar / Backup
  $('export-catalog-btn')?.addEventListener('click', () => {
    exportJson(catalog, `shops-catalog-${Date.now()}.json`);
  });

  $('backup-btn')?.addEventListener('click', async () => {
    setStatus('Creando copia de seguridad fechada…', 'saving');
    try {
      const res = await fetch('/__dev/shops/backup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Copia creada: ${data.backupFile}`, 'success');
      } else {
        setStatus(`Error al crear copia: ${data.error}`, 'error');
      }
    } catch (e: any) {
      setStatus(`Fallo de conexión al hacer backup: ${e.message}`, 'error');
    }
  });

  // Atajos de teclado (Ctrl+S, Ctrl+Z, Ctrl+Y)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveCatalog();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      $('undo-btn')?.click();
    } else if (
      ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
    ) {
      e.preventDefault();
      $('redo-btn')?.click();
    }
  });

  // Advertencia antes de salir si hay cambios sin guardar
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function populateSelects() {
  // Selector de categoría en el formulario
  const shopCatSelect = $('shop-category') as HTMLSelectElement;
  if (shopCatSelect) {
    shopCatSelect.innerHTML = Object.entries(SHOP_CATEGORIES)
      .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
      .join('');
  }

  // Selector de categoría en los filtros
  const catFilter = $('category-filter') as HTMLSelectElement;
  if (catFilter) {
    catFilter.innerHTML = '<option value="all">Todas las categorías</option>' +
      Object.entries(SHOP_CATEGORIES)
        .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
        .join('');
  }

  // Selector de NPC en el formulario
  const npcSelect = $('shop-npc') as HTMLSelectElement;
  if (npcSelect) {
    npcSelect.innerHTML = '<option value="">(Sin comerciante asignado)</option>' +
      (references.npcs || []).map(n => `<option value="${n.id}">${n.name} (${n.subtitle || n.id})</option>`).join('');
  }

  // Selector de NPC en los filtros
  const npcFilter = $('npc-filter') as HTMLSelectElement;
  if (npcFilter) {
    npcFilter.innerHTML = '<option value="all">Todos los NPCs</option>' +
      '<option value="assigned">Solo con NPC asignado</option>' +
      '<option value="unassigned">Solo sin NPC asignado</option>' +
      (references.npcs || []).map(n => `<option value="${n.id}">NPC: ${n.name}</option>`).join('');
  }

  // Selector de monedas en el formulario
  const currencySelect = $('shop-currency') as HTMLSelectElement;
  if (currencySelect) {
    currencySelect.innerHTML = (references.currencies || [
      { id: 'pelines', label: 'Pelines', premium: false },
      { id: 'lagrimas', label: 'Lágrimas de fénix', premium: true },
    ]).map(c => `<option value="${c.id}">${c.label}${c.premium ? ' (Premium)' : ''}</option>`).join('');
  }

  // Selector de categorías en el modal de objetos
  const pickerCat = $('picker-category') as HTMLSelectElement;
  if (pickerCat) {
    const cats = Array.from(new Set(references.items.map(i => i.category || 'Varios'))).sort();
    pickerCat.innerHTML = '<option value="all">Todas las familias</option>' +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }
}

function renderLibrary() {
  const filtered = filterAndSortShops(
    catalog.shops,
    {
      searchQuery,
      category: selectedCategory,
      status: selectedStatus,
      npcFilter: selectedNpcFilter,
      sortOrder,
    },
    references
  );

  const { paged, totalPages, totalCount, currentPage: page } = paginateShops(filtered, currentPage, PAGE_SIZE);

  shopCountBadge.textContent = `${totalCount} tiendas`;
  pageInfoEl.textContent = `Página ${page} de ${totalPages}`;
  prevPageBtn.disabled = page <= 1;
  nextPageBtn.disabled = page >= totalPages;

  if (paged.length === 0) {
    shopsListEl.innerHTML = `
      <li style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px;">
        No hay tiendas que coincidan con los filtros de búsqueda.
      </li>
    `;
    return;
  }

  const npcMap = new Map<string, string>();
  for (const n of references.npcs || []) {
    npcMap.set(n.id, n.name);
  }

  shopsListEl.innerHTML = paged
    .map(shop => {
      const isCurrent = activeShop && activeShop.id === shop.id;
      const catMeta = SHOP_CATEGORIES[shop.category] || SHOP_CATEGORIES.general;
      const npcName = shop.npcId ? (npcMap.get(shop.npcId) || shop.npcId) : 'Sin NPC';
      const statusClass = shop.active ? 'active-badge' : 'inactive-badge';
      const statusLabel = shop.active ? 'Activa' : 'Inactiva';

      return `
        <li class="shop-card-item ${isCurrent ? 'active' : ''}" data-id="${shop.id}">
          <div class="shop-card-title-row">
            <span class="shop-card-name">${escapeHtml(shop.name)}</span>
            <span class="shop-badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="shop-card-meta">
            <span class="shop-badge">${catMeta.label}</span>
            <span class="shop-badge npc-badge">👤 ${escapeHtml(npcName)}</span>
            <span class="pill" style="padding: 1px 5px; font-size: 10.5px;">${shop.items.length} productos</span>
          </div>
        </li>
      `;
    })
    .join('');

  // Eventos de selección de tienda
  shopsListEl.querySelectorAll<HTMLLIElement>('.shop-card-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      const target = catalog.shops.find(s => s.id === id);
      if (target) {
        activeShop = structuredClone(target);
        history.reset(activeShop);
        renderLibrary();
        renderActiveShopForm();
        renderLivePreview();
        updateUndoRedoButtons();
      }
    });
  });
}

function renderActiveShopForm() {
  if (!activeShop) return;

  // General
  const idInput = $('shop-id') as HTMLInputElement;
  const nameInput = $('shop-name') as HTMLInputElement;
  const catSelect = $('shop-category') as HTMLSelectElement;
  const activeCheck = $('shop-active') as HTMLInputElement;
  const descText = $('shop-description') as HTMLTextAreaElement;
  const tagsInput = $('shop-tags') as HTMLInputElement;

  if (idInput) idInput.value = activeShop.id;
  if (nameInput) nameInput.value = activeShop.name;
  if (catSelect) catSelect.value = activeShop.category;
  if (activeCheck) activeCheck.checked = activeShop.active;
  if (descText) descText.value = activeShop.description || '';
  if (tagsInput) tagsInput.value = (activeShop.tags || []).join(', ');

  // Merchant & Currency
  const npcSelect = $('shop-npc') as HTMLSelectElement;
  const currencySelect = $('shop-currency') as HTMLSelectElement;

  if (npcSelect) npcSelect.value = activeShop.npcId || '';
  if (currencySelect) currencySelect.value = activeShop.currency || 'pelines';

  // Vincular eventos de cambio
  idInput.onchange = () => {
    const val = sanitizeId(idInput.value);
    idInput.value = val;
    activeShop.id = val;
    markDirty();
  };

  nameInput.oninput = () => {
    activeShop.name = nameInput.value;
    markDirty();
  };

  catSelect.onchange = () => {
    activeShop.category = catSelect.value;
    markDirty();
  };

  activeCheck.onchange = () => {
    activeShop.active = activeCheck.checked;
    markDirty();
  };

  descText.oninput = () => {
    activeShop.description = descText.value;
    markDirty();
  };

  tagsInput.onchange = () => {
    activeShop.tags = tagsInput.value.split(',').map(s => s.trim()).filter(Boolean);
    markDirty();
  };

  npcSelect.onchange = () => {
    activeShop.npcId = npcSelect.value;
    markDirty();
  };

  currencySelect.onchange = () => {
    activeShop.currency = currencySelect.value as CurrencyId;
    markDirty();
  };

  renderProductsTable();
}

function renderProductsTable() {
  const tbody = $('products-tbody');
  const countLabel = $('products-count-badge');
  if (!tbody) return;

  countLabel.textContent = `${activeShop.items.length} productos`;

  if (activeShop.items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 24px; text-align: center; color: var(--text-dim);">
          Esta tienda aún no tiene productos a la venta.<br>
          <button type="button" class="btn primary sm" style="margin-top: 8px;" id="add-product-first-btn">
            + Incorporar primer producto del catálogo
          </button>
        </td>
      </tr>
    `;
    $('add-product-first-btn')?.addEventListener('click', openItemPicker);
    return;
  }

  const itemMap = new Map<string, any>();
  for (const it of references.items) itemMap.set(it.id, it);

  tbody.innerHTML = activeShop.items
    .map((item, index) => {
      const ref = itemMap.get(item.itemId);
      const isMissing = !ref;
      const label = ref ? ref.label : `[No encontrado: ${item.itemId}]`;
      const rarity: ItemRarity = ref?.rarity || 'common';
      const rarityColor = ITEM_RARITIES[rarity]?.color || '#a0a0a0';
      const effectiveBuy = item.buyPrice ?? (ref?.value ?? 0);
      const effectiveSell = item.sellPrice ?? (ref?.sellPrice ?? Math.max(1, Math.floor((ref?.value ?? 0) / 2)));
      const baseBuyVal = ref?.value ?? 0;
      const baseSellVal = ref?.sellPrice ?? Math.max(1, Math.floor(baseBuyVal / 2));

      const iconSvg = ref?.icon
        ? `<svg class="item-art" viewBox="0 0 24 24" style="--item-rarity:${rarityColor}">${ref.icon}</svg>`
        : '<span style="font-size: 14px;">📦</span>';

      return `
        <tr data-index="${index}" class="${isMissing ? 'has-error' : ''}">
          <!-- PRODUCTO -->
          <td>
            <div class="product-item-cell">
              <span class="product-thumb" style="border-color: ${rarityColor}66">
                ${iconSvg}
              </span>
              <div class="product-label-meta">
                <span class="product-label" style="color: ${rarityColor}">${escapeHtml(label)}</span>
                <span class="product-id-sub"><code>${escapeHtml(item.itemId)}</code></span>
              </div>
            </div>
          </td>

          <!-- PRECIO COMPRA -->
          <td>
            <div class="price-input-wrap">
              <input type="number" min="0" class="item-buy-price" data-index="${index}" value="${effectiveBuy}">
              <button type="button" class="quick-val-btn set-base-buy" data-index="${index}" data-val="${baseBuyVal}" title="Restablecer al valor base oficial (${baseBuyVal})">Base</button>
            </div>
          </td>

          <!-- PRECIO VENTA (RECOMPRA) -->
          <td>
            <div class="price-input-wrap">
              <input type="number" min="0" class="item-sell-price" data-index="${index}" value="${effectiveSell}">
              <button type="button" class="quick-val-btn set-base-sell" data-index="${index}" data-val="${baseSellVal}" title="Restablecer al 50% oficial (${baseSellVal})">50%</button>
            </div>
          </td>

          <!-- STOCK -->
          <td>
            <input type="number" min="0" placeholder="∞ Ilimitado" class="item-stock" data-index="${index}" value="${item.stock !== null && item.stock !== undefined ? item.stock : ''}" style="width: 80px;">
          </td>

          <!-- MONEDA -->
          <td>
            <select class="item-currency" data-index="${index}" style="padding: 4px 6px; font-size: 11.5px;">
              <option value="" ${!item.currency ? 'selected' : ''}>Heredar (${activeShop.currency || 'pelines'})</option>
              <option value="pelines" ${item.currency === 'pelines' ? 'selected' : ''}>Pelines</option>
              <option value="lagrimas" ${item.currency === 'lagrimas' ? 'selected' : ''}>Lágrimas</option>
            </select>
          </td>

          <!-- ACCIONES -->
          <td>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="btn sm secondary move-item-up" data-index="${index}" title="Subir orden" ${index === 0 ? 'disabled' : ''}>▲</button>
              <button type="button" class="btn sm secondary move-item-down" data-index="${index}" title="Bajar orden" ${index === activeShop.items.length - 1 ? 'disabled' : ''}>▼</button>
              <button type="button" class="btn sm danger remove-product-btn" data-index="${index}" title="Quitar de la tienda">✕</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Eventos de la tabla
  tbody.querySelectorAll<HTMLInputElement>('.item-buy-price').forEach(input => {
    input.addEventListener('change', () => {
      const idx = Number(input.getAttribute('data-index'));
      const val = Math.max(0, parseInt(input.value) || 0);
      activeShop.items[idx].buyPrice = val;
      markDirty();
    });
  });

  tbody.querySelectorAll<HTMLButtonElement>('.set-base-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-index'));
      const val = Number(btn.getAttribute('data-val'));
      activeShop.items[idx].buyPrice = val;
      renderProductsTable();
      markDirty();
    });
  });

  tbody.querySelectorAll<HTMLInputElement>('.item-sell-price').forEach(input => {
    input.addEventListener('change', () => {
      const idx = Number(input.getAttribute('data-index'));
      const val = Math.max(0, parseInt(input.value) || 0);
      activeShop.items[idx].sellPrice = val;
      markDirty();
    });
  });

  tbody.querySelectorAll<HTMLButtonElement>('.set-base-sell').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-index'));
      const val = Number(btn.getAttribute('data-val'));
      activeShop.items[idx].sellPrice = val;
      renderProductsTable();
      markDirty();
    });
  });

  tbody.querySelectorAll<HTMLInputElement>('.item-stock').forEach(input => {
    input.addEventListener('change', () => {
      const idx = Number(input.getAttribute('data-index'));
      if (input.value.trim() === '') {
        activeShop.items[idx].stock = null;
      } else {
        activeShop.items[idx].stock = Math.max(0, parseInt(input.value) || 0);
      }
      markDirty();
    });
  });

  tbody.querySelectorAll<HTMLSelectElement>('.item-currency').forEach(select => {
    select.addEventListener('change', () => {
      const idx = Number(select.getAttribute('data-index'));
      const val = select.value as CurrencyId || undefined;
      activeShop.items[idx].currency = val;
      markDirty();
    });
  });

  tbody.querySelectorAll<HTMLButtonElement>('.move-item-up').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-index'));
      if (idx > 0) {
        const temp = activeShop.items[idx];
        activeShop.items[idx] = activeShop.items[idx - 1];
        activeShop.items[idx - 1] = temp;
        renderProductsTable();
        markDirty();
      }
    });
  });

  tbody.querySelectorAll<HTMLButtonElement>('.move-item-down').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-index'));
      if (idx < activeShop.items.length - 1) {
        const temp = activeShop.items[idx];
        activeShop.items[idx] = activeShop.items[idx + 1];
        activeShop.items[idx + 1] = temp;
        renderProductsTable();
        markDirty();
      }
    });
  });

  tbody.querySelectorAll<HTMLButtonElement>('.remove-product-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-index'));
      activeShop.items.splice(idx, 1);
      renderProductsTable();
      markDirty();
    });
  });
}

function renderLivePreview() {
  if (!activeShop || !livePreviewContainer) return;

  const audit = auditShop(activeShop, references);

  livePreviewContainer.innerHTML = renderShopLivePreview(activeShop, references, audit);

  // Renderizar caja de auditoría en la barra lateral
  if (auditBox) {
    if (audit.issues.length === 0) {
      auditBox.innerHTML = `
        <div style="font-size: 11.5px; color: var(--accent-green); display: flex; align-items: center; gap: 6px;">
          <span>✓</span> Tienda consistente. Todos los objetos y el comerciante existen en el juego.
        </div>
      `;
    } else {
      auditBox.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 11.5px;">
          ${audit.issues
            .map(i => {
              const color = i.type === 'error' ? 'var(--accent-red)' : i.type === 'warning' ? 'var(--accent-amber)' : 'var(--text-muted)';
              const icon = i.type === 'error' ? '❌' : i.type === 'warning' ? '⚠️' : 'ℹ️';
              return `<div style="color: ${color};">${icon} ${escapeHtml(i.message)}</div>`;
            })
            .join('')}
        </div>
      `;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// MODAL DE SELECCIÓN DE PRODUCTOS
// ─────────────────────────────────────────────────────────────
function openItemPicker() {
  if (!modalOverlay) return;
  modalOverlay.hidden = false;
  itemPickerSearch = '';
  const searchInput = $('picker-search') as HTMLInputElement;
  if (searchInput) searchInput.value = '';
  renderItemPickerGrid();
}

function closeItemPicker() {
  if (!modalOverlay) return;
  modalOverlay.hidden = true;
}

function renderItemPickerGrid() {
  const grid = $('picker-grid');
  if (!grid) return;

  const q = itemPickerSearch.trim().toLowerCase();
  const cat = itemPickerCategory;
  const rar = itemPickerRarity;

  const existingItemIds = new Set(activeShop.items.map(i => i.itemId));

  const filtered = references.items.filter(it => {
    if (cat !== 'all' && it.category !== cat) return false;
    if (rar !== 'all' && it.rarity !== rar) return false;
    if (q) {
      const mId = it.id.toLowerCase().includes(q);
      const mLabel = it.label.toLowerCase().includes(q);
      const mCat = (it.category || '').toLowerCase().includes(q);
      if (!mId && !mLabel && !mCat) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 24px;">No se encontraron objetos con ese criterio.</p>';
    return;
  }

  grid.innerHTML = filtered.slice(0, 100).map(it => {
    const isAlready = existingItemIds.has(it.id);
    const rarity: ItemRarity = (it.rarity as ItemRarity) || 'common';
    const rarityMeta = ITEM_RARITIES[rarity] || ITEM_RARITIES.common;

    const iconSvg = it.icon
      ? `<svg class="item-art" viewBox="0 0 24 24" style="--item-rarity:${rarityMeta.color}">${it.icon}</svg>`
      : '<span style="font-size: 14px;">📦</span>';

    return `
      <div class="picker-item-card ${isAlready ? 'already-in-shop' : ''}" data-id="${it.id}">
        <span class="picker-item-thumb" style="border-color: ${rarityMeta.color}88">
          ${iconSvg}
        </span>
        <div class="picker-item-info">
          <span class="picker-item-name" style="color: ${rarityMeta.color}">${escapeHtml(it.label)}</span>
          <span class="picker-item-sub">${escapeHtml(it.category || 'Objeto')} · <b>${it.value} pelines</b></span>
          ${isAlready ? '<small style="color: var(--gold); font-size: 10px;">Ya en la tienda</small>' : ''}
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll<HTMLDivElement>('.picker-item-card').forEach(card => {
    card.addEventListener('click', () => {
      const itemId = card.getAttribute('data-id');
      if (itemId) {
        addItemToActiveShop(itemId);
        closeItemPicker();
      }
    });
  });
}

function addItemToActiveShop(itemId: string) {
  if (activeShop.items.some(i => i.itemId === itemId)) {
    setStatus(`El objeto "${itemId}" ya está en la tienda.`, 'error');
    return;
  }

  const ref = references.items.find(i => i.id === itemId);
  const buyPrice = ref ? ref.value : 10;
  const sellPrice = ref ? ref.sellPrice : Math.max(1, Math.floor(buyPrice / 2));

  activeShop.items.push({
    itemId,
    buyPrice,
    sellPrice,
    stock: null,
  });

  renderProductsTable();
  markDirty();
  setStatus(`Añadido "${ref ? ref.label : itemId}" a la tienda.`, 'success');
}

// ─────────────────────────────────────────────────────────────
// ACCIONES DE TIENDA: CREAR, DUPLICAR, ELIMINAR, GUARDAR
// ─────────────────────────────────────────────────────────────
function createNewShopDialog() {
  const candidateId = `tienda_${Date.now().toString(36)}`;
  const newShop = createEmptyShop(candidateId, 'Nueva tienda comercial');
  catalog.shops.unshift(newShop);
  activeShop = structuredClone(newShop);
  history.reset(activeShop);
  currentPage = 1;
  renderLibrary();
  renderActiveShopForm();
  renderLivePreview();
  markDirty();
  setStatus('Nueva tienda creada. Recuerda configurarla y guardar.', 'saving');
}

function duplicateActiveShop() {
  if (!activeShop) return;
  const existingIds = catalog.shops.map(s => s.id);
  const copy = duplicateShop(activeShop, existingIds);
  catalog.shops.unshift(copy);
  activeShop = structuredClone(copy);
  history.reset(activeShop);
  currentPage = 1;
  renderLibrary();
  renderActiveShopForm();
  renderLivePreview();
  markDirty();
  setStatus(`Tienda duplicada con ID "${copy.id}".`, 'success');
}

function confirmDeleteActiveShop() {
  if (!activeShop) return;

  const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar la tienda "${activeShop.name}" (${activeShop.id})?\nEsta acción no se puede deshacer una vez guardada.`);
  if (!confirmed) return;

  const idx = catalog.shops.findIndex(s => s.id === activeShop.id);
  if (idx !== -1) {
    catalog.shops.splice(idx, 1);
  }

  if (catalog.shops.length > 0) {
    activeShop = structuredClone(catalog.shops[0]);
  } else {
    activeShop = createShopFromTemplate(SHOP_TEMPLATES[0].id);
    catalog.shops.push(structuredClone(activeShop));
  }

  history.reset(activeShop);
  renderLibrary();
  renderActiveShopForm();
  renderLivePreview();
  markDirty();
  setStatus('Tienda eliminada del borrador. Pulsa Guardar para aplicar en disco.', 'saving');
}

async function saveCatalog() {
  setStatus('Guardando catálogo de tiendas en disco…', 'saving');

  // Sincronizar activeShop actual en catalog
  const idx = catalog.shops.findIndex(s => s.id === activeShop.id);
  if (idx !== -1) {
    catalog.shops[idx] = structuredClone(activeShop);
  } else {
    catalog.shops.push(structuredClone(activeShop));
  }

  try {
    const validated = validateShopCatalog(catalog, references);

    const res = await fetch('/__dev/shops', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': revision,
      },
      body: JSON.stringify(validated, null, 2),
    });

    if (res.status === 409) {
      throw new Error('Conflicto: El archivo cambió en disco. Recarga el taller para no sobrescribir.');
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
    }

    revision = res.headers.get('ETag') || '';
    catalog = await res.json();
    isDirty = false;
    history.reset(activeShop);
    updateUndoRedoButtons();
    renderLibrary();
    renderLivePreview();

    setStatus(`Guardado correctamente (${catalog.shops.length} tiendas confirmadas).`, 'success');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Error al guardar: ${msg}`, 'error');
  }
}

function exportJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Iniciar al cargar
window.addEventListener('DOMContentLoaded', init);


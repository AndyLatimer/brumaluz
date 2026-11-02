import './itemEditor.css';
import {
  ITEM_CATEGORIES,
  EQUIPMENT_SLOT_LABELS,
  CLASS_LABELS,
  EFFECT_TYPES,
  ITEM_TEMPLATES,
  createItemFromTemplate,
  validateItem,
  validateItemCatalog,
  getItemUsageReferences,
  sanitizeId,
  type ItemCatalogItem,
  type ItemCatalog,
  type ItemReferences,
  type ItemStatDef,
  type ItemEffectDef,
} from '../data/itemsCatalog';
import { ITEM_RARITIES, type ItemRarity } from '../data/itemRarity';
import {
  HistoryManager,
  filterAndSortItems,
  paginateItems,
  renderItemGameTooltip,
  type ItemSortColumn,
  type ItemSortDirection,
} from './itemEditorTools';
import { filterPresetIcons, PRESET_ICONS, type PresetIcon } from './itemIconsLibrary';
import { createItem3DViewer, type Item3DViewerInstance } from './item3DViewer';

// Helper seguro de selección DOM
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// Estado global de la aplicación
let catalog: ItemCatalog = { version: 1, items: [] };
let references: ItemReferences = { quests: [], vendors: [], recipes: [], coreItemIds: [] };
let revision = '';
let activeItem: ItemCatalogItem;
let isNewItem = false;
let isDirty = false;
let history: HistoryManager<ItemCatalogItem>;
let viewer3D: Item3DViewerInstance | null = null;
const selectedIds = new Set<string>();

// Estado de filtrado y paginación
let searchQuery = '';
let selectedCategory = 'all';
let selectedRarity = 'all';
let selectedStatus: 'all' | 'active' | 'inactive' = 'all';
let sortBy: ItemSortColumn = 'label';
let sortDirection: ItemSortDirection = 'asc';
let currentPage = 1;
const PAGE_SIZE = 15;

// Inicialización
async function init() {
  setStatus('Cargando catálogo de objetos...', 'normal');
  try {
    const container = $('model-viewer-container');
    if (container) {
      viewer3D = createItem3DViewer(container);
    }

    // Cargar referencias de sistemas dependientes
    const refRes = await fetch('/__dev/items/references');
    if (refRes.ok) {
      references = await refRes.json();
    }

    // Cargar catálogo de objetos
    const catRes = await fetch('/__dev/items');
    if (!catRes.ok) throw new Error(await catRes.text());
    revision = catRes.headers.get('ETag') || '';
    catalog = await catRes.json();

    populateFilterOptions();
    bindEvents();

    if (catalog.items.length > 0) {
      selectItem(catalog.items[0].id);
    } else {
      createNewItem();
    }

    renderLibrary();
    setStatus(`Catálogo cargado con ${catalog.items.length} objetos.`, 'success');
  } catch (err: any) {
    setStatus(`Error al iniciar editor: ${err.message}`, 'error');
  }
}

function setStatus(msg: string, type: 'normal' | 'success' | 'error' = 'normal') {
  const el = $('status');
  if (!el) return;
  el.textContent = msg;
  el.className = type === 'normal' ? '' : type;
}

function populateFilterOptions() {
  const categoryFilter = $<HTMLSelectElement>('category-filter');
  categoryFilter.innerHTML = '<option value="all">Todas las categorías</option>';
  for (const cat of ITEM_CATEGORIES) {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.label}`;
    categoryFilter.appendChild(opt);
  }

  const rarityFilter = $<HTMLSelectElement>('rarity-filter');
  rarityFilter.innerHTML = '<option value="all">Todas las rarezas</option>';
  for (const [id, r] of Object.entries(ITEM_RARITIES)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = r.label;
    rarityFilter.appendChild(opt);
  }

  const templateSelect = $<HTMLSelectElement>('template-select');
  templateSelect.innerHTML = '';
  for (const t of ITEM_TEMPLATES) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    templateSelect.appendChild(opt);
  }
}

function renderLibrary() {
  const filtered = filterAndSortItems(catalog.items, {
    query: searchQuery,
    category: selectedCategory,
    rarity: selectedRarity,
    status: selectedStatus,
    sortBy,
    direction: sortDirection,
  });

  const pagination = paginateItems(filtered, currentPage, PAGE_SIZE);
  currentPage = pagination.currentPage;

  const countBadge = document.getElementById('items-count-badge');
  if (countBadge) {
    countBadge.textContent = `${catalog.items.length} total`;
  }

  $('pagination-info').textContent = `Página ${pagination.currentPage} de ${pagination.totalPages} (${pagination.totalItems} objetos)`;
  ($('prev-page-btn') as HTMLButtonElement).disabled = currentPage <= 1;
  ($('next-page-btn') as HTMLButtonElement).disabled = currentPage >= pagination.totalPages;

  const itemsListEl = $('items-list');
  itemsListEl.innerHTML = '';

  if (pagination.pageItems.length === 0) {
    const empty = document.createElement('div');
    empty.style.padding = '18px';
    empty.style.color = '#a0ada4';
    empty.style.textAlign = 'center';
    empty.textContent = 'No se encontraron objetos con los filtros actuales.';
    itemsListEl.appendChild(empty);
    return;
  }

  for (const item of pagination.pageItems) {
    const rarityMeta = ITEM_RARITIES[item.rarity] || ITEM_RARITIES.common;
    const catMeta = ITEM_CATEGORIES.find(c => c.id === item.category);

    const row = document.createElement('div');
    row.className = `item-row ${activeItem?.id === item.id ? 'active' : ''}`;
    row.dataset.id = item.id;

    // Checkbox de selección masiva
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'item-row-check';
    check.checked = selectedIds.has(item.id);
    check.addEventListener('click', e => {
      e.stopPropagation();
      if (check.checked) selectedIds.add(item.id);
      else selectedIds.delete(item.id);
      updateBulkButtonsState();
    });

    const iconBox = document.createElement('div');
    iconBox.className = 'item-row-icon';
    iconBox.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x=".7" y=".7" width="22.6" height="22.6" rx="3" fill="${rarityMeta.color}" fill-opacity=".15" stroke="${rarityMeta.color}" stroke-width="1.2"/>
        ${item.icon || '<circle cx="12" cy="12" r="8" fill="#586c55"/>'}
      </svg>
    `;

    const info = document.createElement('div');
    info.className = 'item-row-info';

    const title = document.createElement('span');
    title.className = 'item-row-title';
    title.style.color = rarityMeta.color;
    title.textContent = item.label;

    const meta = document.createElement('span');
    meta.className = 'item-row-meta';
    meta.innerHTML = `
      <span>${catMeta ? catMeta.icon : ''} ${catMeta ? catMeta.label : item.category}</span>
      <span>•</span>
      <span>${item.value} 🪙</span>
      ${item.active === false ? '<span style="color:#f4b8a6;">(Inactivo)</span>' : ''}
    `;

    info.appendChild(title);
    info.appendChild(meta);

    row.appendChild(check);
    row.appendChild(iconBox);
    row.appendChild(info);

    row.addEventListener('click', () => {
      if (isDirty && !confirm('Tienes cambios sin guardar en este objeto. ¿Deseas descartarlos y cambiar de objeto?')) {
        return;
      }
      selectItem(item.id);
    });

    itemsListEl.appendChild(row);
  }

  updateBulkButtonsState();
}

function updateBulkButtonsState() {
  const count = selectedIds.size;
  $('selected-count').textContent = `${count} seleccionados`;
  document.querySelectorAll('.bulk-btn').forEach(btn => {
    (btn as HTMLButtonElement).disabled = count === 0;
  });
}

function selectItem(id: string) {
  const item = catalog.items.find(i => i.id === id);
  if (!item) return;

  activeItem = structuredClone(item);
  isNewItem = false;
  history = new HistoryManager(activeItem);
  setDirty(false);

  fillForm(activeItem);
  updatePreviews();
  renderLibrary();
}

function createNewItem(templateId = '') {
  if (templateId) {
    activeItem = createItemFromTemplate(templateId, '', 'Nuevo objeto');
  } else {
    activeItem = {
      id: 'nuevo_objeto_' + Date.now().toString(36),
      label: 'Nuevo objeto',
      description: '',
      category: 'resource',
      rarity: 'common',
      icon: '<circle cx="12" cy="12" r="8" fill="#586c55" stroke="#9bb18d" stroke-width="1.5"/>',
      active: true,
      tags: [],
      value: 10,
      sellPrice: 5,
      stack: 50,
      bound: false,
      sellable: true,
      tradable: true,
      storable: true,
      droppable: true,
      equippable: false,
      stats: [],
      usable: false,
      effects: [],
    };
  }

  isNewItem = true;
  history = new HistoryManager(activeItem);
  setDirty(true);

  fillForm(activeItem);
  updatePreviews();
  renderLibrary();

  $<HTMLInputElement>('field-id').focus();
}

function duplicateCurrentItem() {
  if (!activeItem) return;
  const copy = structuredClone(activeItem);
  copy.id = sanitizeId(`${copy.id}_copia_${Date.now().toString(36).slice(-4)}`);
  copy.label = `Copia de ${copy.label}`;

  activeItem = copy;
  isNewItem = true;
  history = new HistoryManager(activeItem);
  setDirty(true);

  fillForm(activeItem);
  updatePreviews();
  renderLibrary();
  setStatus(`Objeto duplicado como "${copy.label}". Pulsa Guardar para conservarlo.`, 'normal');
}

function setDirty(dirty: boolean) {
  isDirty = dirty;
  const dirtyPill = $('dirty-pill');
  dirtyPill.textContent = dirty ? 'Cambios sin guardar' : 'Sin cambios';
  dirtyPill.className = `pill ${dirty ? 'dirty' : ''}`;
  ($('undo-btn') as HTMLButtonElement).disabled = !history?.canUndo;
  ($('redo-btn') as HTMLButtonElement).disabled = !history?.canRedo;
}

// Rellenar formulario con datos del item
function fillForm(item: ItemCatalogItem) {
  $('form-title').textContent = isNewItem ? 'Nuevo objeto' : item.label;

  const idInput = $<HTMLInputElement>('field-id');
  idInput.value = item.id;
  idInput.readOnly = !isNewItem;

  $<HTMLInputElement>('field-label').value = item.label;
  $<HTMLTextAreaElement>('field-description').value = item.description;
  $<HTMLSelectElement>('field-category').value = item.category;
  $<HTMLInputElement>('field-subcategory').value = item.subcategory || '';
  $<HTMLSelectElement>('field-rarity').value = item.rarity;
  $<HTMLInputElement>('field-active').checked = item.active !== false;
  $<HTMLInputElement>('field-tags').value = (item.tags || []).join(', ');

  // Propiedades
  $<HTMLInputElement>('field-value').value = String(item.value ?? 0);
  $<HTMLInputElement>('field-sellPrice').value = String(item.sellPrice ?? Math.max(1, Math.floor((item.value ?? 0) / 2)));
  $<HTMLInputElement>('field-stack').value = String(item.stack ?? 1);
  $<HTMLInputElement>('field-weight').value = String(item.weight ?? '');
  $<HTMLInputElement>('field-bound').checked = Boolean(item.bound);
  $<HTMLInputElement>('field-sellable').checked = item.sellable !== false;
  $<HTMLInputElement>('field-tradable').checked = item.tradable !== false;
  $<HTMLInputElement>('field-storable').checked = item.storable !== false;
  $<HTMLInputElement>('field-droppable').checked = item.droppable !== false;

  // Equipamiento
  const equipCheck = $<HTMLInputElement>('field-equippable');
  equipCheck.checked = Boolean(item.equippable);
  $<HTMLSelectElement>('field-slot').value = item.slot || 'weapon';
  $<HTMLSelectElement>('field-requiredClass').value = item.requiredClass || 'any';
  $<HTMLInputElement>('field-minLevel').value = String(item.minLevel || 1);
  $<HTMLInputElement>('field-durability').value = String(item.maxDurability || '');
  toggleEquipFields(equipCheck.checked);
  renderStatsBuilder(item.stats || []);

  // Consumibles
  const usableCheck = $<HTMLInputElement>('field-usable');
  usableCheck.checked = Boolean(item.usable);
  toggleUsableFields(usableCheck.checked);
  renderEffectsBuilder(item.effects || []);

  // Visual
  $<HTMLTextAreaElement>('field-svg').value = item.icon || '';
  $<HTMLInputElement>('field-model').value = item.model || '';

  // Actualizar listas de dependencias
  const usedBy = getItemUsageReferences(item.id, references);
  const dependenciesList = $('dependencies-list');
  const dependenciesAlert = $('dependencies-alert');
  const deleteWarning = $('delete-warning');
  const deleteBtn = $<HTMLButtonElement>('delete-btn');

  dependenciesList.innerHTML = '';
  if (usedBy.length > 0) {
    dependenciesAlert.hidden = false;
    for (const ref of usedBy) {
      const li = document.createElement('li');
      li.textContent = `• ${ref}`;
      dependenciesList.appendChild(li);
    }
    deleteWarning.textContent = `No se puede eliminar porque este objeto está en uso en ${usedBy.length} sistema(s).`;
    deleteBtn.disabled = true;
  } else {
    dependenciesAlert.hidden = true;
    deleteWarning.textContent = 'Este objeto no tiene referencias activas en otros sistemas y se puede eliminar de forma segura.';
    deleteBtn.disabled = isNewItem;
  }

  updateHeroCard(item);
  updateTabBadges(item);
}

// Leer datos del formulario hacia el activeItem
function readForm(): ItemCatalogItem {
  const idInput = $<HTMLInputElement>('field-id');
  const rawId = isNewItem ? sanitizeId(idInput.value) : activeItem.id;

  const equippable = ($<HTMLInputElement>('field-equippable')).checked;
  const usable = ($<HTMLInputElement>('field-usable')).checked;

  const value = Number($<HTMLInputElement>('field-value').value) || 0;
  const sellPriceVal = $<HTMLInputElement>('field-sellPrice').value;
  const sellPrice = sellPriceVal ? Number(sellPriceVal) : Math.max(1, Math.floor(value / 2));

  const tagsRaw = $<HTMLInputElement>('field-tags').value;
  const tags = tagsRaw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  const durVal = $<HTMLInputElement>('field-durability').value;
  const maxDurability = durVal ? Number(durVal) : undefined;

  const stats = collectStatsFromForm();
  const effects = collectEffectsFromForm();

  return validateItem({
    id: rawId,
    label: $<HTMLInputElement>('field-label').value.trim(),
    description: $<HTMLTextAreaElement>('field-description').value.trim(),
    category: $<HTMLSelectElement>('field-category').value,
    subcategory: $<HTMLInputElement>('field-subcategory').value.trim(),
    rarity: $<HTMLSelectElement>('field-rarity').value,
    active: $<HTMLInputElement>('field-active').checked,
    tags,
    value,
    sellPrice,
    stack: Number($<HTMLInputElement>('field-stack').value) || 1,
    weight: Number($<HTMLInputElement>('field-weight').value) || undefined,
    bound: $<HTMLInputElement>('field-bound').checked,
    sellable: $<HTMLInputElement>('field-sellable').checked,
    tradable: $<HTMLInputElement>('field-tradable').checked,
    storable: $<HTMLInputElement>('field-storable').checked,
    droppable: $<HTMLInputElement>('field-droppable').checked,
    equippable,
    slot: equippable ? $<HTMLSelectElement>('field-slot').value : undefined,
    requiredClass: equippable ? $<HTMLSelectElement>('field-requiredClass').value : undefined,
    minLevel: equippable ? Number($<HTMLInputElement>('field-minLevel').value) || 1 : undefined,
    maxDurability,
    durability: maxDurability,
    stats,
    usable,
    effects,
    icon: $<HTMLTextAreaElement>('field-svg').value.trim(),
    model: $<HTMLInputElement>('field-model').value.trim() || undefined,
  });
}

function onFormChange() {
  try {
    activeItem = readForm();
    history.push(activeItem);
    setDirty(true);
    updatePreviews();
    updateHeroCard(activeItem);
    updateTabBadges(activeItem);
  } catch (err: any) {
    // Silencioso durante la escritura
  }
}

function updateHeroCard(item: ItemCatalogItem) {
  const titleEl = document.getElementById('hero-title');
  if (titleEl) titleEl.textContent = item.label || 'Objeto sin nombre';

  const idPill = document.getElementById('hero-id-pill');
  if (idPill) idPill.textContent = `id: ${item.id || '...'}`;

  const iconSlot = document.getElementById('hero-icon-slot');
  if (iconSlot) {
    const rarity = ITEM_RARITIES[item.rarity] || ITEM_RARITIES.common;
    iconSlot.style.borderColor = rarity.color;
    iconSlot.innerHTML = `<svg viewBox="0 0 24 24"><rect x=".7" y=".7" width="22.6" height="22.6" rx="3" fill="${rarity.color}" fill-opacity=".12" stroke="${rarity.color}" stroke-width="1.2"/>${item.icon || '<circle cx="12" cy="12" r="8" fill="#586c55"/>'}</svg>`;
  }

  const catBadge = document.getElementById('hero-category-badge');
  if (catBadge) {
    const cat = ITEM_CATEGORIES.find(c => c.id === item.category);
    catBadge.textContent = cat ? `${cat.icon} ${cat.label}` : `📦 ${item.category}`;
  }

  const rarityBadge = document.getElementById('hero-rarity-badge');
  if (rarityBadge) {
    const rarity = ITEM_RARITIES[item.rarity] || ITEM_RARITIES.common;
    rarityBadge.textContent = rarity.label;
    rarityBadge.style.color = rarity.color;
    rarityBadge.style.borderColor = rarity.color;
  }

  const equipBadge = document.getElementById('hero-equip-badge');
  if (equipBadge) {
    if (item.equippable) {
      equipBadge.style.display = 'inline-flex';
      const slotLabels: Record<string, string> = {
        head: 'Cabeza',
        chest: 'Pecho',
        hands: 'Manos',
        legs: 'Piernas',
        weapon: 'Arma',
        offhand: 'Secundaria',
        pendant: 'Colgante',
        ring: 'Anillo',
        trinket: 'Abalorio',
      };
      equipBadge.textContent = `⚔️ Ranura: ${slotLabels[item.slot || ''] || item.slot || 'Equipable'}`;
    } else {
      equipBadge.style.display = 'none';
    }
  }

  const priceBadge = document.getElementById('hero-price-badge');
  if (priceBadge) {
    priceBadge.textContent = `🪙 ${item.value ?? 0} P`;
  }
}

function updateTabBadges(item: ItemCatalogItem) {
  const propBadge = document.getElementById('tab-badge-properties');
  if (propBadge) {
    propBadge.textContent = `${item.stack || 1} stack`;
  }

  const equipBadge = document.getElementById('tab-badge-equipment');
  if (equipBadge) {
    if (item.equippable) {
      equipBadge.textContent = 'Sí';
      equipBadge.classList.add('badge-highlight');
    } else {
      equipBadge.textContent = 'No';
      equipBadge.classList.remove('badge-highlight');
    }
  }

  const consumBadge = document.getElementById('tab-badge-consumable');
  if (consumBadge) {
    if (item.usable) {
      const effCount = item.effects?.length || 0;
      consumBadge.textContent = effCount > 0 ? `${effCount} ef.` : 'Sí';
      consumBadge.classList.add('badge-highlight');
    } else {
      consumBadge.textContent = 'No';
      consumBadge.classList.remove('badge-highlight');
    }
  }
}

function applyPreset(preset: 'weapon' | 'armor' | 'consumable' | 'food' | 'resource') {
  if (!activeItem) return;

  if (preset === 'weapon') {
    activeItem.category = 'weapon';
    activeItem.equippable = true;
    activeItem.slot = 'weapon';
    activeItem.stack = 1;
    activeItem.usable = false;
    activeItem.sellable = true;
    activeItem.tradable = true;
    activeItem.storable = true;
    activeItem.droppable = true;
    if (!activeItem.stats || activeItem.stats.length === 0) {
      activeItem.stats = [{ label: 'Daño físico', value: '+12' }];
    }
  } else if (preset === 'armor') {
    activeItem.category = 'armor';
    activeItem.equippable = true;
    activeItem.slot = 'chest';
    activeItem.stack = 1;
    activeItem.usable = false;
    activeItem.sellable = true;
    activeItem.tradable = true;
    activeItem.storable = true;
    activeItem.droppable = true;
    if (!activeItem.stats || activeItem.stats.length === 0) {
      activeItem.stats = [{ label: 'Armadura', value: '+8' }];
    }
  } else if (preset === 'consumable') {
    activeItem.category = 'consumable';
    activeItem.equippable = false;
    activeItem.usable = true;
    activeItem.stack = 20;
    if (!activeItem.effects || activeItem.effects.length === 0) {
      activeItem.effects = [{ type: 'restore_mana', value: 35, description: 'Restaura 35 de maná al instante.' }];
    }
  } else if (preset === 'food') {
    activeItem.category = 'food';
    activeItem.equippable = false;
    activeItem.usable = true;
    activeItem.stack = 50;
    if (!activeItem.effects || activeItem.effects.length === 0) {
      activeItem.effects = [{ type: 'restore_energy', value: 20, duration: 10, description: 'Restaura energía con el tiempo.' }];
    }
  } else if (preset === 'resource') {
    activeItem.category = 'resource';
    activeItem.equippable = false;
    activeItem.usable = false;
    activeItem.stack = 99;
    activeItem.sellable = true;
    activeItem.tradable = true;
    activeItem.storable = true;
    activeItem.droppable = true;
  }

  fillForm(activeItem);
  history.push(activeItem);
  setDirty(true);
  updatePreviews();
  setStatus(`Configuración rápida aplicada: "${preset}".`, 'normal');
}

function updatePreviews() {
  if (!activeItem) return;
  const tooltipPreview = $('tooltip-preview');
  if (tooltipPreview) {
    tooltipPreview.innerHTML = renderItemGameTooltip(activeItem);
  }

  const modelPlaceholder = $('model-placeholder');
  if (activeItem.model) {
    if (modelPlaceholder) modelPlaceholder.hidden = true;
    viewer3D?.loadModel(activeItem.model);
  } else {
    if (modelPlaceholder) modelPlaceholder.hidden = false;
    viewer3D?.clear();
  }
}

function toggleEquipFields(enabled: boolean) {
  const box = $('equip-properties-box');
  if (!box) return;
  box.style.opacity = enabled ? '1' : '0.4';
  box.querySelectorAll('input, select').forEach(el => {
    (el as HTMLElement).style.pointerEvents = enabled ? 'auto' : 'none';
  });
}

function toggleUsableFields(enabled: boolean) {
  const box = $('usable-properties-box');
  if (!box) return;
  box.style.opacity = enabled ? '1' : '0.4';
  box.querySelectorAll('input, select').forEach(el => {
    (el as HTMLElement).style.pointerEvents = enabled ? 'auto' : 'none';
  });
}

// Estadísticas de equipamiento
function renderStatsBuilder(stats: ItemStatDef[]) {
  const container = $('stats-builder-container');
  if (!container) return;
  container.innerHTML = '';

  stats.forEach(s => {
    const row = document.createElement('div');
    row.className = 'stats-builder-row';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'Nombre estadística (ej: Guardia)';
    labelInput.value = s.label;

    const valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.placeholder = 'Valor (ej: +15)';
    valInput.value = s.value;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'danger';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => {
      row.remove();
      onFormChange();
    });

    [labelInput, valInput].forEach(inp => inp.addEventListener('input', onFormChange));

    row.appendChild(labelInput);
    row.appendChild(valInput);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

function collectStatsFromForm(): ItemStatDef[] {
  const rows = document.querySelectorAll('.stats-builder-row');
  const result: ItemStatDef[] = [];
  rows.forEach(r => {
    const inputs = r.querySelectorAll('input');
    const label = inputs[0].value.trim();
    const value = inputs[1].value.trim();
    if (label && value) {
      result.push({ label, value });
    }
  });
  return result;
}

// Efectos de consumibles
function renderEffectsBuilder(effects: ItemEffectDef[]) {
  const container = $('effects-builder-container');
  if (!container) return;
  container.innerHTML = '';

  effects.forEach(e => {
    const row = document.createElement('div');
    row.className = 'effects-builder-row';

    const select = document.createElement('select');
    for (const type of EFFECT_TYPES) {
      const opt = document.createElement('option');
      opt.value = type.id;
      opt.textContent = type.label;
      if (e.type === type.id) opt.selected = true;
      select.appendChild(opt);
    }

    const valInput = document.createElement('input');
    valInput.type = 'number';
    valInput.placeholder = 'Valor / %';
    valInput.value = String(e.percent ?? e.value ?? 10);

    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.placeholder = 'Descripción visible';
    descInput.value = e.description || '';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'danger';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => {
      row.remove();
      onFormChange();
    });

    [select, valInput, descInput].forEach(inp => inp.addEventListener('input', onFormChange));

    row.appendChild(select);
    row.appendChild(valInput);
    row.appendChild(descInput);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

function collectEffectsFromForm(): ItemEffectDef[] {
  const rows = document.querySelectorAll('.effects-builder-row');
  const result: ItemEffectDef[] = [];
  rows.forEach(r => {
    const select = r.querySelector('select') as HTMLSelectElement;
    const inputs = r.querySelectorAll('input');
    const type = select.value;
    const num = Number(inputs[0].value) || 0;
    const desc = inputs[1].value.trim();

    result.push({
      type,
      percent: num,
      value: num,
      description: desc || undefined,
    });
  });
  return result;
}

// Guardar objeto en el catálogo del servidor
async function saveActiveItem() {
  try {
    const item = readForm();

    const existingIndex = catalog.items.findIndex(i => i.id === item.id);
    const updatedItems = [...catalog.items];

    if (existingIndex >= 0) {
      updatedItems[existingIndex] = item;
    } else {
      updatedItems.push(item);
    }

    const nextCatalog: ItemCatalog = {
      version: 1,
      items: updatedItems,
    };

    setStatus('Guardando objeto en el servidor...', 'normal');

    const res = await fetch('/__dev/items', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': revision,
      },
      body: JSON.stringify(nextCatalog),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Error desconocido al guardar' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    revision = res.headers.get('ETag') || '';
    catalog = await res.json();
    activeItem = structuredClone(item);
    isNewItem = false;
    history.reset(activeItem);
    setDirty(false);

    fillForm(activeItem);
    renderLibrary();
    setStatus(`Objeto "${item.label}" guardado correctamente en el catálogo y sincronizado.`, 'success');
  } catch (err: any) {
    setStatus(`Error al guardar: ${err.message}`, 'error');
    alert(`No se pudo guardar el objeto: ${err.message}`);
  }
}

// Eliminar objeto de forma segura
async function deleteActiveItem() {
  if (!activeItem) return;

  const usedBy = getItemUsageReferences(activeItem.id, references);
  if (usedBy.length > 0) {
    alert(`No se puede eliminar "${activeItem.label}" porque está en uso por:\n${usedBy.map(r => `• ${r}`).join('\n')}`);
    return;
  }

  if (!confirm(`¿Estás seguro de eliminar el objeto "${activeItem.label}" (ID: ${activeItem.id})? Esta acción es definitiva.`)) {
    return;
  }

  try {
    const updatedItems = catalog.items.filter(i => i.id !== activeItem.id);
    const nextCatalog: ItemCatalog = { version: 1, items: updatedItems };

    const res = await fetch('/__dev/items', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': revision,
      },
      body: JSON.stringify(nextCatalog),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Error al eliminar' }));
      throw new Error(errData.error);
    }

    revision = res.headers.get('ETag') || '';
    catalog = await res.json();

    if (catalog.items.length > 0) {
      selectItem(catalog.items[0].id);
    } else {
      createNewItem();
    }

    renderLibrary();
    setStatus('Objeto eliminado correctamente.', 'success');
  } catch (err: any) {
    setStatus(`Error al eliminar: ${err.message}`, 'error');
  }
}

// Bindeo de eventos y formularios
function bindEvents() {
  const searchInput = $<HTMLInputElement>('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    if (clearSearchBtn) clearSearchBtn.hidden = !searchInput.value.trim();
    currentPage = 1;
    renderLibrary();
  });

  clearSearchBtn?.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    if (clearSearchBtn) clearSearchBtn.hidden = true;
    currentPage = 1;
    renderLibrary();
    searchInput.focus();
  });

  const quickPills = document.querySelectorAll<HTMLButtonElement>('.filter-chip-btn');
  quickPills.forEach(pill => {
    pill.addEventListener('click', () => {
      quickPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.dataset.cat || 'all';
      selectedCategory = cat;
      const catFilter = $<HTMLSelectElement>('category-filter');
      catFilter.value = cat;
      currentPage = 1;
      renderLibrary();
    });
  });

  const categoryFilter = $<HTMLSelectElement>('category-filter');
  categoryFilter.addEventListener('change', () => {
    selectedCategory = categoryFilter.value;
    quickPills.forEach(p => {
      p.classList.toggle('active', (p.dataset.cat || 'all') === selectedCategory);
    });
    currentPage = 1;
    renderLibrary();
  });

  document.querySelectorAll<HTMLButtonElement>('.preset-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset) applyPreset(preset as any);
    });
  });

  const rarityFilter = $<HTMLSelectElement>('rarity-filter');
  rarityFilter.addEventListener('change', () => {
    selectedRarity = rarityFilter.value;
    currentPage = 1;
    renderLibrary();
  });

  const statusFilter = $<HTMLSelectElement>('status-filter');
  statusFilter.addEventListener('change', () => {
    selectedStatus = statusFilter.value as any;
    currentPage = 1;
    renderLibrary();
  });

  const sortSelect = $<HTMLSelectElement>('sort-select');
  sortSelect.addEventListener('change', () => {
    const [col, dir] = sortSelect.value.split(':') as [ItemSortColumn, ItemSortDirection];
    sortBy = col;
    sortDirection = dir;
    renderLibrary();
  });

  $('prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderLibrary();
    }
  });

  $('next-page-btn').addEventListener('click', () => {
    currentPage++;
    renderLibrary();
  });

  $('new-item-btn').addEventListener('click', () => createNewItem());

  $('apply-template-btn').addEventListener('click', () => {
    if (isDirty && !confirm('Tienes cambios sin guardar. ¿Deseas aplicar la plantilla y descartar los cambios?')) return;
    const templateSelect = $<HTMLSelectElement>('template-select');
    createNewItem(templateSelect.value);
  });

  $('duplicate-btn').addEventListener('click', () => duplicateCurrentItem());
  $('duplicate-bottom-btn').addEventListener('click', () => duplicateCurrentItem());

  $('reload-btn').addEventListener('click', async () => {
    if (isDirty && !confirm('Tienes cambios sin guardar. ¿Recargar y descartar tus cambios?')) return;
    const res = await fetch('/__dev/items');
    if (res.ok) {
      revision = res.headers.get('ETag') || '';
      catalog = await res.json();
      if (catalog.items.length > 0) selectItem(catalog.items[0].id);
      renderLibrary();
      setStatus('Catálogo recargado desde el servidor.', 'success');
    }
  });

  $('export-all-btn').addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(catalog, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `catalogo-objetos-brumaluz-${new Date().toISOString().slice(0, 10)}.json`);
    dl.click();
  });

  $('export-current-btn').addEventListener('click', () => {
    if (!activeItem) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeItem, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `objeto-${activeItem.id}.json`);
    dl.click();
  });

  // Importación
  const importInput = $<HTMLInputElement>('import-file-input');
  importInput.addEventListener('change', async e => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      const itemsToImport = Array.isArray(imported.items) ? imported.items : [imported];

      let added = 0;
      let replaced = 0;
      const nextItems = [...catalog.items];

      for (const raw of itemsToImport) {
        const item = validateItem(raw);
        const idx = nextItems.findIndex(i => i.id === item.id);
        if (idx >= 0) {
          nextItems[idx] = item;
          replaced++;
        } else {
          nextItems.push(item);
          added++;
        }
      }

      if (confirm(`Se van a importar ${itemsToImport.length} objeto(s):\n• ${added} nuevos\n• ${replaced} actualizados\n¿Confirmar y guardar en el catálogo?`)) {
        const nextCatalog: ItemCatalog = { version: 1, items: nextItems };
        const res = await fetch('/__dev/items', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'If-Match': revision },
          body: JSON.stringify(nextCatalog),
        });
        if (!res.ok) throw new Error(await res.text());
        revision = res.headers.get('ETag') || '';
        catalog = await res.json();
        renderLibrary();
        setStatus(`Importación completada con éxito (${added} añadidos, ${replaced} modificados).`, 'success');
      }
    } catch (err: any) {
      alert(`Error al importar archivo JSON: ${err.message}`);
    } finally {
      importInput.value = '';
    }
  });

  // Acciones en lote
  document.getElementById('bulk-activate')?.addEventListener('click', async () => {
    modifySelectedItems(item => { item.active = true; });
  });

  document.getElementById('bulk-deactivate')?.addEventListener('click', async () => {
    modifySelectedItems(item => { item.active = false; });
  });

  document.getElementById('bulk-delete')?.addEventListener('click', async () => {
    const referenced = [...selectedIds].filter(id => getItemUsageReferences(id, references).length > 0);
    if (referenced.length > 0) {
      alert(`No se pueden eliminar los siguientes objetos porque están en uso:\n${referenced.map(id => `• ${id}`).join('\n')}`);
      return;
    }
    if (!confirm(`¿Eliminar los ${selectedIds.size} objetos seleccionados? Esta acción es definitiva.`)) return;

    const nextItems = catalog.items.filter(i => !selectedIds.has(i.id));
    selectedIds.clear();
    await saveEntireCatalog(nextItems, 'Objetos seleccionados eliminados.');
  });

  document.getElementById('bulk-export')?.addEventListener('click', () => {
    const subset = catalog.items.filter(i => selectedIds.has(i.id));
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ version: 1, items: subset }, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `objetos-seleccionados-${subset.length}.json`);
    dl.click();
  });

  // Pestañas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => ((c as HTMLElement).hidden = true));

      btn.classList.add('active');
      const tabTarget = (btn as HTMLElement).dataset.tab!;
      const targetEl = document.getElementById(tabTarget);
      if (targetEl) targetEl.hidden = false;
    });
  });

  // Historial
  $('undo-btn').addEventListener('click', () => {
    const prev = history.undo();
    if (prev) {
      activeItem = structuredClone(prev);
      fillForm(activeItem);
      updatePreviews();
      setDirty(true);
    }
  });

  $('redo-btn').addEventListener('click', () => {
    const next = history.redo();
    if (next) {
      activeItem = structuredClone(next);
      fillForm(activeItem);
      updatePreviews();
      setDirty(true);
    }
  });

  // Envío del formulario
  const editorForm = $<HTMLFormElement>('item-form');
  editorForm.addEventListener('submit', e => {
    e.preventDefault();
    saveActiveItem();
  });

  $('delete-btn').addEventListener('click', () => deleteActiveItem());

  // Input listeners para cambios en tiempo real
  editorForm.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', onFormChange);
    el.addEventListener('change', onFormChange);
  });

  // Toggles de categoría
  $('field-equippable').addEventListener('change', e => {
    toggleEquipFields((e.target as HTMLInputElement).checked);
    onFormChange();
  });

  $('field-usable').addEventListener('change', e => {
    toggleUsableFields((e.target as HTMLInputElement).checked);
    onFormChange();
  });

  $('add-stat-btn').addEventListener('click', () => {
    const current = collectStatsFromForm();
    current.push({ label: 'Vida máxima', value: '+10' });
    renderStatsBuilder(current);
    onFormChange();
  });

  $('add-effect-btn').addEventListener('click', () => {
    const current = collectEffectsFromForm();
    current.push({ type: 'restore_health', percent: 15, description: 'Restaura un 15 % de salud.' });
    renderEffectsBuilder(current);
    onFormChange();
  });

  // Selector de Iconos
  setupIconPicker();

  // Selector de modelos 3D
  setupModelPicker();

  // Atajos de teclado
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveActiveItem();
    } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      ($('undo-btn') as HTMLButtonElement).click();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      ($('redo-btn') as HTMLButtonElement).click();
    }
  });

  // Protección ante pérdida accidental
  window.addEventListener('beforeunload', e => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function setupIconPicker() {
  const grid = $('icon-picker-grid');
  const searchInput = $<HTMLInputElement>('icon-search-input');
  const svgTextarea = $<HTMLTextAreaElement>('field-svg');
  if (!grid || !searchInput || !svgTextarea) return;

  function renderIcons() {
    const q = searchInput.value;
    const icons = filterPresetIcons(q);
    grid.innerHTML = '';

    for (const icon of icons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-choice-btn';
      btn.title = icon.name;
      btn.innerHTML = `<svg viewBox="0 0 24 24">${icon.svg}</svg>`;
      btn.addEventListener('click', () => {
        svgTextarea.value = icon.svg;
        onFormChange();
      });
      grid.appendChild(btn);
    }
  }

  searchInput.addEventListener('input', renderIcons);
  renderIcons();
}

function setupModelPicker() {
  const select = $<HTMLSelectElement>('model-picker-select');
  const modelInput = $<HTMLInputElement>('field-model');
  if (!select || !modelInput) return;

  select.innerHTML = '<option value="">-- Sin modelo 3D asignado --</option>';
  if (references.models) {
    for (const m of references.models) {
      const opt = document.createElement('option');
      opt.value = m.path;
      opt.textContent = m.name;
      select.appendChild(opt);
    }
  }

  select.addEventListener('change', () => {
    if (select.value) {
      modelInput.value = select.value;
      onFormChange();
    }
  });
}

async function modifySelectedItems(fn: (item: ItemCatalogItem) => void) {
  const nextItems = catalog.items.map(item => {
    if (selectedIds.has(item.id)) {
      const copy = structuredClone(item);
      fn(copy);
      return copy;
    }
    return item;
  });
  await saveEntireCatalog(nextItems, 'Objetos seleccionados actualizados.');
}

async function saveEntireCatalog(items: ItemCatalogItem[], successMsg: string) {
  try {
    const nextCatalog: ItemCatalog = { version: 1, items };
    const res = await fetch('/__dev/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': revision },
      body: JSON.stringify(nextCatalog),
    });
    if (!res.ok) throw new Error(await res.text());
    revision = res.headers.get('ETag') || '';
    catalog = await res.json();
    renderLibrary();
    setStatus(successMsg, 'success');
  } catch (err: any) {
    setStatus(`Error al actualizar catálogo: ${err.message}`, 'error');
  }
}

// Iniciar inmediatamente
void init();

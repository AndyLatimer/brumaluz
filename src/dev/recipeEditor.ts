import './recipeEditor.css';
import {
  PROFESSIONS_LIST,
  PROFESSION_LABELS,
  PROFESSION_RANKS,
  RECIPE_CATEGORIES,
  RECIPE_TEMPLATES,
  createEmptyRecipe,
  createRecipeFromTemplate,
  createEmptyStation,
  sanitizeId,
  validateRecipe,
  validateRecipeCatalog,
  type RecipeCatalogItem,
  type CraftingStationDef,
  type RecipeCatalog,
  type RecipeReferences,
  type RecipeIngredientDef,
} from '../data/recipesCatalog';
import {
  HistoryManager,
  filterAndSortRecipes,
  paginateRecipes,
  auditRecipe,
  checkRecipeDependencies,
  checkStationDependencies,
  formatTimeHuman,
  batchUpdateRecipes,
  mergeCatalogs,
  calculateRecipeEconomics,
  resolveProductionChain,
  simulateCrafting,
  type RecipeSortColumn,
  type RecipeSortDirection,
  type RecipeEconomics,
  type ProductionChainNode,
  type CraftingSimulationResult,
} from './recipeEditorTools';

// Helper seguro de selección DOM
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// Estado global de la aplicación
let catalog: RecipeCatalog = { version: 1, stations: [], recipes: [] };
let references: RecipeReferences = { items: [], quests: [], professions: {}, ranks: [] };
let itemsMap = new Map<string, any>();
let stationsMap = new Map<string, CraftingStationDef>();
let revision = '';
let activeRecipe: RecipeCatalogItem = createEmptyRecipe();
let isNewRecipe = false;
let isDirty = false;
let history: HistoryManager<RecipeCatalogItem>;
const selectedRecipeIds = new Set<string>();

// Estado de filtrado y paginación
let searchQuery = '';
let selectedProfession = 'all';
let selectedStation = 'all';
let selectedCategory = 'all';
let selectedStatus: 'all' | 'active' | 'inactive' = 'all';
let sortBy: RecipeSortColumn = 'label';
let sortDirection: RecipeSortDirection = 'asc';
let currentPage = 1;
const PAGE_SIZE = 12;

// Modal de selector de objetos
let itemPickerTarget: { type: 'ingredient'; index: number } | { type: 'ingredient-new' } | { type: 'output' } | null = null;
let itemPickerCategory = 'all';

// Modal de estación activa
let activeStationId = '';

// Inicialización
async function init() {
  setStatus('Cargando catálogo de recetas y referencias…', 'normal');
  try {
    // 1. Cargar referencias
    try {
      const refRes = await fetch('/__dev/recipes/references');
      const refType = refRes.headers.get('content-type') || '';
      if (refRes.ok && refType.includes('application/json')) {
        references = await refRes.json();
        itemsMap = new Map((references.items || []).map(i => [i.id, i]));
      } else {
        console.warn('La ruta /references no devolvió JSON o falló:', refRes.status, refType);
      }
    } catch (refErr) {
      console.warn('Advertencia al cargar referencias:', refErr);
    }

    // 2. Cargar catálogo de recetas
    const catRes = await fetch('/__dev/recipes');
    const contentType = catRes.headers.get('content-type') || '';
    if (!catRes.ok || !contentType.includes('application/json')) {
      const errText = await catRes.text();
      let errorMsg = `HTTP ${catRes.status}`;
      if (!contentType.includes('application/json')) {
        errorMsg = 'El servidor devolvió contenido HTML en lugar del catálogo JSON. Asegúrate de que el servidor Vite esté activo con el plugin de recetas y recarga la página.';
      } else {
        try {
          const json = JSON.parse(errText);
          errorMsg = json.error || errorMsg;
        } catch {
          errorMsg = errText.slice(0, 150);
        }
      }
      throw new Error(errorMsg);
    }
    revision = catRes.headers.get('ETag') || '';
    catalog = await catRes.json();

    updateStationsMap();
    populateSelectOptions();
    bindEvents();

    if (catalog.recipes.length > 0) {
      selectRecipe(catalog.recipes[0].id);
    } else {
      createNewRecipe();
    }

    renderLibrary();
    setStatus(`Catálogo cargado con ${catalog.recipes.length} recetas y ${catalog.stations.length} estaciones.`, 'success');
  } catch (err: any) {
    setStatus(`Error al iniciar editor de recetas: ${err.message}`, 'error');
  }
}

function updateStationsMap() {
  stationsMap.clear();
  for (const s of catalog.stations) {
    stationsMap.set(s.id, s);
  }
}

function setStatus(msg: string, type: 'normal' | 'success' | 'error' = 'normal') {
  const el = $('status');
  if (!el) return;
  el.textContent = msg;
  el.className = type === 'normal' ? '' : type;
}

function populateSelectOptions() {
  // Filtro de profesión
  const profFilter = $<HTMLSelectElement>('profession-filter');
  profFilter.innerHTML = '<option value="all">Todas las profesiones</option><option value="none">Sin profesión</option>';
  for (const p of PROFESSIONS_LIST) {
    profFilter.add(new Option(`${p.icon} ${p.label}`, p.id));
  }

  // Filtro de estación
  populateStationFilter();

  // Filtro de categoría
  const catFilter = $<HTMLSelectElement>('category-filter');
  catFilter.innerHTML = '<option value="all">Todas las categorías</option>';
  for (const c of RECIPE_CATEGORIES) {
    catFilter.add(new Option(`${c.icon} ${c.label}`, c.id));
  }

  // Plantillas
  const tplSelect = $<HTMLSelectElement>('template-select');
  tplSelect.innerHTML = '<option value="">Crear desde plantilla…</option>';
  for (const t of RECIPE_TEMPLATES) {
    tplSelect.add(new Option(t.name, t.id));
  }

  // Formulario: profesiones
  const formProf = $<HTMLSelectElement>('field-profession');
  formProf.innerHTML = '<option value="none">Sin restricción de oficio</option>';
  for (const p of PROFESSIONS_LIST) {
    formProf.add(new Option(`${p.icon} ${p.label}`, p.id));
  }

  // Formulario: misiones
  const formQuest = $<HTMLSelectElement>('field-required-quest');
  formQuest.innerHTML = '<option value="">Sin misión requerida</option>';
  for (const q of references.quests) {
    formQuest.add(new Option(`${q.title} (${q.id})`, q.id));
  }

  // Modal de estaciones: profesiones
  const modalStationJob = $<HTMLSelectElement>('station-job-input');
  modalStationJob.innerHTML = '<option value="">Sin profesión específica</option>';
  for (const p of PROFESSIONS_LIST) {
    modalStationJob.add(new Option(`${p.icon} ${p.label}`, p.id));
  }

  // Modal batch: profesiones y estaciones
  const batchProf = $<HTMLSelectElement>('batch-profession-select');
  batchProf.innerHTML = '<option value="keep">Conservar profesión actual</option><option value="none">Sin profesión</option>';
  for (const p of PROFESSIONS_LIST) {
    batchProf.add(new Option(p.label, p.id));
  }

  populateBatchStations();
}

function populateStationFilter() {
  const stationFilter = $<HTMLSelectElement>('station-filter');
  const current = stationFilter.value;
  stationFilter.innerHTML = '<option value="all">Todas las estaciones</option>';
  for (const s of catalog.stations) {
    stationFilter.add(new Option(s.label, s.id));
  }
  if (catalog.stations.some(s => s.id === current)) {
    stationFilter.value = current;
  }
}

function populateBatchStations() {
  const batchAddStation = $<HTMLSelectElement>('batch-add-station-select');
  batchAddStation.innerHTML = '<option value="">No añadir ninguna estación</option>';
  for (const s of catalog.stations) {
    batchAddStation.add(new Option(s.label, s.id));
  }
}

function bindEvents() {
  // Filtros y búsqueda
  const searchInput = $<HTMLInputElement>('search-input');
  const clearSearchBtn = $('clear-search-btn');

  const updateClearBtnVisibility = () => {
    if (!clearSearchBtn) return;
    const hasFilters = Boolean(searchQuery || selectedProfession !== 'all' || selectedStation !== 'all' || selectedCategory !== 'all' || selectedStatus !== 'all');
    clearSearchBtn.hidden = !hasFilters;
  };

  searchInput.addEventListener('input', (e: Event) => {
    searchQuery = (e.target as HTMLInputElement).value;
    updateClearBtnVisibility();
    currentPage = 1;
    renderLibrary();
  });

  clearSearchBtn?.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    selectedProfession = 'all';
    selectedStation = 'all';
    selectedCategory = 'all';
    selectedStatus = 'all';
    ($('profession-filter') as HTMLSelectElement).value = 'all';
    ($('station-filter') as HTMLSelectElement).value = 'all';
    ($('category-filter') as HTMLSelectElement).value = 'all';
    ($('status-filter') as HTMLSelectElement).value = 'all';
    document.querySelectorAll('.filter-chip-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-prof') === 'all');
    });
    updateClearBtnVisibility();
    currentPage = 1;
    renderLibrary();
    setStatus('Filtros y búsqueda restablecidos.', 'normal');
  });

  $('profession-filter').addEventListener('change', (e: Event) => {
    selectedProfession = (e.target as HTMLSelectElement).value;
    updateClearBtnVisibility();
    currentPage = 1;
    renderLibrary();
  });

  $('station-filter').addEventListener('change', (e: Event) => {
    selectedStation = (e.target as HTMLSelectElement).value;
    updateClearBtnVisibility();
    currentPage = 1;
    renderLibrary();
  });

  $('category-filter').addEventListener('change', (e: Event) => {
    selectedCategory = (e.target as HTMLSelectElement).value;
    updateClearBtnVisibility();
    currentPage = 1;
    renderLibrary();
  });

  $('status-filter').addEventListener('change', (e: Event) => {
    selectedStatus = (e.target as HTMLSelectElement).value as any;
    updateClearBtnVisibility();
    currentPage = 1;
    renderLibrary();
  });

  $('sort-select').addEventListener('change', (e: Event) => {
    const val = (e.target as HTMLSelectElement).value.split(':');
    sortBy = val[0] as RecipeSortColumn;
    sortDirection = (val[1] as RecipeSortDirection) || 'asc';
    renderLibrary();
  });

  // Paginación
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

  // Creación rápida
  $('new-recipe-btn').addEventListener('click', () => createNewRecipe());
  $('template-select').addEventListener('change', (e: Event) => {
    const tplId = (e.target as HTMLSelectElement).value;
    if (tplId) {
      createFromTemplate(tplId);
      (e.target as HTMLSelectElement).value = '';
    }
  });

  // Pestañas
  setupTabs();

  // Cambios en campos de formulario
  bindFormInputs();

  // Historial
  $('undo-btn').addEventListener('click', () => {
    const prev = history.undo();
    if (prev) {
      activeRecipe = structuredClone(prev);
      syncRecipeToForm(activeRecipe);
      markDirty(true);
      updateHistoryButtons();
    }
  });

  $('redo-btn').addEventListener('click', () => {
    const next = history.redo();
    if (next) {
      activeRecipe = structuredClone(next);
      syncRecipeToForm(activeRecipe);
      markDirty(true);
      updateHistoryButtons();
    }
  });

  // Guardar receta
  $('save-recipe-btn').addEventListener('click', saveActiveRecipe);

  // Duplicar y eliminar
  $('duplicate-form-btn').addEventListener('click', duplicateActiveRecipe);
  $('duplicate-active-btn').addEventListener('click', duplicateActiveRecipe);
  $('delete-recipe-btn').addEventListener('click', deleteActiveRecipe);

  // Botones de canvas interactivo
  $('visual-add-ing-btn').addEventListener('click', () => {
    openItemPicker({ type: 'ingredient-new' });
  });

  $('visual-output-minus')?.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    if (activeRecipe.output.count > 1) {
      activeRecipe.output.count--;
      ($('field-output-count') as HTMLInputElement).value = String(activeRecipe.output.count);
      onIngredientChange();
    }
  });

  $('visual-output-plus')?.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    activeRecipe.output.count++;
    ($('field-output-count') as HTMLInputElement).value = String(activeRecipe.output.count);
    onIngredientChange();
  });

  const standardTimes = [5, 15, 30, 60, 120, 300];
  $('visual-time-pill')?.addEventListener('click', () => {
    const curr = activeRecipe.craftingTime;
    const nextIdx = (standardTimes.indexOf(curr) + 1) % standardTimes.length;
    const nextTime = standardTimes[nextIdx >= 0 ? nextIdx : 2];
    activeRecipe.craftingTime = nextTime;
    ($('field-crafting-time') as HTMLInputElement).value = String(nextTime);
    $('time-human-display').textContent = formatTimeHuman(nextTime);
    $('visual-time-pill').textContent = formatTimeHuman(nextTime);
    onIngredientChange();
  });

  $('add-ingredient-table-btn').addEventListener('click', () => addIngredientRow());

  $('visual-station-node').addEventListener('click', () => {
    switchTab('stations');
    $('stations-chips-container')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  $('visual-output-slot').addEventListener('click', () => {
    openItemPicker({ type: 'output' });
  });

  $('pick-output-btn').addEventListener('click', () => {
    openItemPicker({ type: 'output' });
  });

  // Guía rápida interactiva
  $('toggle-guide-btn')?.addEventListener('click', () => {
    const banner = $('quick-guide-banner');
    if (banner) banner.hidden = !banner.hidden;
  });

  $('dismiss-guide-btn')?.addEventListener('click', () => {
    const banner = $('quick-guide-banner');
    if (banner) banner.hidden = true;
  });

  // Arquetipos de creación rápida
  document.querySelectorAll('.archetype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const arch = btn.getAttribute('data-arch') || 'mueble';
      applyRecipeArchetype(arch);
    });
  });

  // Presets de tiempo y éxito en Tab 4
  document.querySelectorAll('.time-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = Number(btn.getAttribute('data-s')) || 30;
      activeRecipe.craftingTime = s;
      ($('field-crafting-time') as HTMLInputElement).value = String(s);
      $('time-human-display').textContent = formatTimeHuman(s);
      $('visual-time-pill').textContent = formatTimeHuman(s);
      onIngredientChange();
    });
  });

  document.querySelectorAll('.rate-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = Number(btn.getAttribute('data-r')) || 100;
      activeRecipe.successRate = r;
      ($('field-success-rate') as HTMLInputElement).value = String(r);
      onIngredientChange();
    });
  });

  // Simulación rápida 10x
  $('quick-sim-10-btn')?.addEventListener('click', () => {
    runQuickSimulation();
  });

  // Estaciones subeditor
  $('open-stations-btn').addEventListener('click', openStationsModal);
  $('quick-create-station-btn').addEventListener('click', openStationsModal);
  $('close-stations-modal-btn').addEventListener('click', closeStationsModal);
  $('done-stations-modal-btn').addEventListener('click', closeStationsModal);
  $('new-station-modal-btn').addEventListener('click', createNewStationInModal);
  $('save-station-btn').addEventListener('click', saveStationFromModal);
  $('delete-station-btn').addEventListener('click', deleteStationFromModal);

  // Batch toolbar & modal
  $('batch-edit-btn').addEventListener('click', openBatchModal);
  $('batch-clear-btn').addEventListener('click', clearBatchSelection);
  $('close-batch-modal-btn').addEventListener('click', closeBatchModal);
  $('cancel-batch-btn').addEventListener('click', closeBatchModal);
  $('apply-batch-btn').addEventListener('click', applyBatchChanges);
  $('batch-delete-btn').addEventListener('click', applyBatchDelete);

  // Exportaciones y Backup
  $('export-all-btn').addEventListener('click', exportAllRecipes);
  $('export-single-btn').addEventListener('click', exportActiveRecipe);
  $('create-backup-btn').addEventListener('click', createServerBackup);
  $('sync-rpg-btn')?.addEventListener('click', syncRpgRecipes);
  $('global-audit-btn').addEventListener('click', openGlobalAuditModal);
  $('close-audit-modal-btn').addEventListener('click', closeGlobalAuditModal);
  $('done-audit-modal-btn').addEventListener('click', closeGlobalAuditModal);

  // Importación
  $('import-input').addEventListener('change', handleImportFile);

  // Item Picker modal
  $('close-item-picker-btn').addEventListener('click', closeItemPicker);
  $('cancel-item-picker-btn').addEventListener('click', closeItemPicker);
  $('item-picker-search').addEventListener('input', (e: Event) => {
    renderItemPickerGrid((e.target as HTMLInputElement).value);
  });

  // Categorías de Item Picker
  document.querySelectorAll('.picker-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.picker-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      itemPickerCategory = btn.getAttribute('data-cat') || 'all';
      renderItemPickerGrid($<HTMLInputElement>('item-picker-search').value);
    });
  });

  // Quick filter pills
  const quickPills = document.querySelectorAll('.filter-chip-btn');
  quickPills.forEach(btn => {
    btn.addEventListener('click', () => {
      quickPills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const prof = btn.getAttribute('data-prof') || 'all';
      selectedProfession = prof;
      ($('profession-filter') as HTMLSelectElement).value = prof;
      updateClearBtnVisibility();
      currentPage = 1;
      renderLibrary();
    });
  });

  // Guardar como plantilla
  $('save-as-template-btn').addEventListener('click', saveAsTemplate);

  // Simulación de tiradas
  $('open-sim-btn').addEventListener('click', openSimulationModal);
  $('close-sim-modal-btn').addEventListener('click', closeSimulationModal);
  $('done-sim-modal-btn').addEventListener('click', closeSimulationModal);
  $('run-sim-btn').addEventListener('click', runSimulation);

  document.querySelectorAll('.sim-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = Number(btn.getAttribute('data-n')) || 10;
      ($('sim-attempts-input') as HTMLInputElement).value = String(n);
      runSimulation();
    });
  });

  // Cadena de fabricación (árbol de sub-recetas)
  $('open-tree-btn').addEventListener('click', openProductionTreeModal);
  $('close-tree-modal-btn').addEventListener('click', closeProductionTreeModal);
  $('done-tree-modal-btn').addEventListener('click', closeProductionTreeModal);

  // Atajos de teclado
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveActiveRecipe();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      if (!isTextInput(document.activeElement)) {
        e.preventDefault();
        $('undo-btn').click();
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      if (!isTextInput(document.activeElement)) {
        e.preventDefault();
        $('redo-btn').click();
      }
    }
  });

  // Avisar de cambios sin guardar al salir
  window.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function isTextInput(el: Element | null): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

function setupTabs() {
  const tabs = [
    { btn: $('tab-btn-general'), content: $('tab-content-general') },
    { btn: $('tab-btn-ingredients'), content: $('tab-content-ingredients') },
    { btn: $('tab-btn-stations'), content: $('tab-content-stations') },
    { btn: $('tab-btn-requirements'), content: $('tab-content-requirements') },
  ];

  tabs.forEach(tab => {
    tab.btn.addEventListener('click', () => {
      tabs.forEach(t => {
        t.btn.classList.remove('active');
        t.content.hidden = true;
      });
      tab.btn.classList.add('active');
      tab.content.hidden = false;
    });
  });
}

function switchTab(name: 'general' | 'ingredients' | 'stations' | 'requirements') {
  $(`tab-btn-${name}`).click();
}

function bindFormInputs() {
  const onInput = (forceSeparate = false) => {
    readFormIntoActiveRecipe();
    markDirty(true);
    history.push(activeRecipe, forceSeparate);
    updateHistoryButtons();
    renderVisualCanvas();
    renderLiveCard();
    runAudit();
  };

  $('field-label').addEventListener('input', () => {
    $('draft-title').textContent = ($('field-label') as HTMLInputElement).value || 'Nueva receta';
    if (isNewRecipe) {
      const autoId = sanitizeId(($('field-label') as HTMLInputElement).value);
      ($('field-id') as HTMLInputElement).value = autoId;
      $('draft-id-pill').textContent = `id: ${autoId}`;
    }
    onInput();
  });

  $('field-id').addEventListener('input', () => {
    const val = sanitizeId(($('field-id') as HTMLInputElement).value);
    ($('field-id') as HTMLInputElement).value = val;
    $('draft-id-pill').textContent = `id: ${val}`;
    onInput(true);
  });

  $('field-category').addEventListener('change', () => onInput(true));
  $('field-folder').addEventListener('input', () => onInput());
  $('field-description').addEventListener('input', () => onInput());
  $('field-tags').addEventListener('input', () => onInput());
  $('field-notes').addEventListener('input', () => onInput());
  $('field-active').addEventListener('change', () => onInput(true));

  // Salida
  $('field-output-id').addEventListener('input', () => onInput());
  $('field-output-count').addEventListener('input', () => onInput());
  $('field-output-chance').addEventListener('input', () => onInput());

  // Oficio y estaciones
  $('field-profession').addEventListener('change', () => onInput(true));
  $('field-rank').addEventListener('change', () => onInput(true));

  // Tiempos y requisitos
  $('field-crafting-time').addEventListener('input', () => {
    const val = Number(($('field-crafting-time') as HTMLInputElement).value) || 0;
    $('time-human-display').textContent = formatTimeHuman(val);
    $('visual-time-pill').textContent = formatTimeHuman(val);
    onInput();
  });

  $('field-success-rate').addEventListener('input', () => onInput());
  $('field-min-level').addEventListener('input', () => onInput());
  $('field-required-quest').addEventListener('change', () => onInput(true));
  $('field-required-recipe').addEventListener('input', () => onInput());
  $('field-custom-note').addEventListener('input', () => onInput());
}

function readFormIntoActiveRecipe() {
  activeRecipe.label = ($('field-label') as HTMLInputElement).value.trim() || 'Receta sin nombre';
  activeRecipe.id = sanitizeId(($('field-id') as HTMLInputElement).value.trim());
  activeRecipe.category = ($('field-category') as HTMLSelectElement).value;
  activeRecipe.folder = ($('field-folder') as HTMLInputElement).value.trim() || undefined;
  activeRecipe.description = ($('field-description') as HTMLTextAreaElement).value.trim();
  activeRecipe.active = ($('field-active') as HTMLInputElement).checked;

  const rawTags = ($('field-tags') as HTMLInputElement).value;
  activeRecipe.tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
  activeRecipe.notes = ($('field-notes') as HTMLInputElement).value.trim() || undefined;

  // Resultado
  activeRecipe.output.itemId = ($('field-output-id') as HTMLInputElement).value.trim();
  activeRecipe.output.count = Math.max(1, Number(($('field-output-count') as HTMLInputElement).value) || 1);
  activeRecipe.output.chance = Math.min(100, Math.max(1, Number(($('field-output-chance') as HTMLInputElement).value) || 100));

  // Profesión
  const profVal = ($('field-profession') as HTMLSelectElement).value;
  activeRecipe.requirements.requiredProfession = profVal === 'none' ? undefined : profVal;
  activeRecipe.requirements.requiredRank = Number(($('field-rank') as HTMLSelectElement).value) || 0;

  // Tiempos y desbloqueos
  activeRecipe.craftingTime = Math.max(0, Number(($('field-crafting-time') as HTMLInputElement).value) || 0);
  activeRecipe.successRate = Math.min(100, Math.max(0, Number(($('field-success-rate') as HTMLInputElement).value) || 100));
  const minLvl = Number(($('field-min-level') as HTMLInputElement).value);
  activeRecipe.requirements.minCharacterLevel = minLvl > 0 ? minLvl : undefined;
  activeRecipe.requirements.requiredQuestId = ($('field-required-quest') as HTMLSelectElement).value || undefined;
  activeRecipe.requirements.requiredRecipeId = ($('field-required-recipe') as HTMLInputElement).value.trim() || undefined;
  activeRecipe.requirements.customNote = ($('field-custom-note') as HTMLInputElement).value.trim() || undefined;
}

function syncRecipeToForm(recipe: RecipeCatalogItem) {
  ($('field-label') as HTMLInputElement).value = recipe.label;
  $('draft-title').textContent = recipe.label;
  ($('field-id') as HTMLInputElement).value = recipe.id;
  $('draft-id-pill').textContent = `id: ${recipe.id}`;
  ($('field-category') as HTMLSelectElement).value = recipe.category;
  ($('field-folder') as HTMLInputElement).value = recipe.folder || '';
  ($('field-description') as HTMLTextAreaElement).value = recipe.description;
  ($('field-active') as HTMLInputElement).checked = recipe.active;
  ($('field-tags') as HTMLInputElement).value = recipe.tags.join(', ');
  ($('field-notes') as HTMLInputElement).value = recipe.notes || '';

  // Resultado
  ($('field-output-id') as HTMLInputElement).value = recipe.output.itemId;
  ($('field-output-count') as HTMLInputElement).value = String(recipe.output.count);
  ($('field-output-chance') as HTMLInputElement).value = String(recipe.output.chance ?? 100);

  // Profesión y rango
  ($('field-profession') as HTMLSelectElement).value = recipe.requirements.requiredProfession || 'none';
  ($('field-rank') as HTMLSelectElement).value = String(recipe.requirements.requiredRank ?? 0);

  // Tiempos y requisitos
  ($('field-crafting-time') as HTMLInputElement).value = String(recipe.craftingTime);
  $('time-human-display').textContent = formatTimeHuman(recipe.craftingTime);
  $('visual-time-pill').textContent = formatTimeHuman(recipe.craftingTime);
  ($('field-success-rate') as HTMLInputElement).value = String(recipe.successRate);
  ($('field-min-level') as HTMLInputElement).value = recipe.requirements.minCharacterLevel ? String(recipe.requirements.minCharacterLevel) : '';
  ($('field-required-quest') as HTMLSelectElement).value = recipe.requirements.requiredQuestId || '';
  ($('field-required-recipe') as HTMLInputElement).value = recipe.requirements.requiredRecipeId || '';
  ($('field-custom-note') as HTMLInputElement).value = recipe.requirements.customNote || '';

  renderIngredientsTable();
  renderStationChips();
  renderVisualCanvas();
  renderLiveCard();
  runAudit();
}

function markDirty(dirty: boolean) {
  isDirty = dirty;
  const pill = $('dirty-indicator');
  if (dirty) {
    pill.className = 'pill dirty';
    pill.textContent = 'Cambios sin guardar';
  } else {
    pill.className = 'pill clean';
    pill.textContent = 'Guardado';
  }
}

function updateHistoryButtons() {
  ($('undo-btn') as HTMLButtonElement).disabled = !history.canUndo();
  ($('redo-btn') as HTMLButtonElement).disabled = !history.canRedo();
}

// ─────────────────────────────────────────────────────────────
// RENDERIZADO DE BIBLIOTECA
// ─────────────────────────────────────────────────────────────
function renderLibrary() {
  const counts = new Map<string, number>();
  for (const recipe of catalog.recipes) {
    const profession = recipe.requirements.requiredProfession;
    if (profession) counts.set(profession, (counts.get(profession) ?? 0) + 1);
  }
  document.querySelectorAll<HTMLButtonElement>('.filter-chip-btn[data-prof]').forEach(button => {
    const count = button.querySelector<HTMLElement>('.filter-chip-count');
    const profession = button.dataset.prof;
    if (count && profession) count.textContent = ` (${counts.get(profession) ?? 0})`;
  });

  const filtered = filterAndSortRecipes(catalog.recipes, {
    query: searchQuery,
    profession: selectedProfession,
    station: selectedStation,
    category: selectedCategory,
    status: selectedStatus,
    sortBy,
    sortDirection,
    references,
  });

  const { items, total, totalPages, currentPage: page } = paginateRecipes(filtered, currentPage, PAGE_SIZE);
  currentPage = page;

  // Actualizar badge
  $('recipes-count-badge').textContent = `${catalog.recipes.length} recetas (${filtered.length} visibles)`;
  $('page-indicator').textContent = `Página ${currentPage} de ${totalPages}`;
  ($('prev-page-btn') as HTMLButtonElement).disabled = currentPage <= 1;
  ($('next-page-btn') as HTMLButtonElement).disabled = currentPage >= totalPages;

  const listContainer = $('recipe-list');
  listContainer.innerHTML = '';

  if (items.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); font-size: 13px;">
        No se encontraron recetas con los filtros aplicados.
      </div>
    `;
    return;
  }

  for (const r of items) {
    const card = document.createElement('div');
    card.className = `recipe-card ${r.id === activeRecipe.id ? 'active' : ''} ${!r.active ? 'inactive-recipe' : ''}`;

    const outputItem = itemsMap.get(r.output.itemId);
    const outputIcon = outputItem?.icon || '<circle cx="12" cy="12" r="7" fill="#d5b075"/>';
    const outputName = outputItem?.label || r.output.itemId;

    // Mini ingredientes
    const ingsHtml = r.ingredients.map(ing => {
      const it = itemsMap.get(ing.itemId);
      const name = it?.label || ing.itemId;
      return `<span class="ingredient-chip-mini" title="${name}">${ing.count}× ${name}</span>`;
    }).join('');

    const profLabel = r.requirements.requiredProfession ? (PROFESSION_LABELS[r.requirements.requiredProfession] || r.requirements.requiredProfession) : 'Manual';
    const isChecked = selectedRecipeIds.has(r.id);

    card.innerHTML = `
      <div class="recipe-card-header">
        <input type="checkbox" class="recipe-card-checkbox" data-id="${r.id}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation();">
        <div class="recipe-card-icon">
          <svg viewBox="0 0 24 24">${outputIcon}</svg>
        </div>
        <div class="recipe-card-meta">
          <div class="recipe-card-title">${r.label}</div>
          <div class="recipe-card-sub">
            <span class="pill small ${r.active ? 'active' : 'inactive'}">${r.active ? 'Activa' : 'Inactiva'}</span>
            <span>${profLabel}</span>
            <span>•</span>
            <span>${formatTimeHuman(r.craftingTime)}</span>
          </div>
        </div>
      </div>
      <div class="recipe-card-flow">
        <div class="recipe-card-ingredients">${ingsHtml}</div>
        <span class="flow-arrow-mini">➔</span>
        <span class="output-chip-mini">${r.output.count}× ${outputName}</span>
      </div>
    `;

    // Selección de receta
    card.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      selectRecipe(r.id);
    });

    // Checkbox de lote
    const chk = card.querySelector('.recipe-card-checkbox') as HTMLInputElement;
    chk.addEventListener('change', () => {
      if (chk.checked) {
        selectedRecipeIds.add(r.id);
      } else {
        selectedRecipeIds.delete(r.id);
      }
      updateBatchBar();
    });

    listContainer.appendChild(card);
  }
}

function updateBatchBar() {
  const bar = $('batch-bar');
  const count = $('batch-count');
  if (selectedRecipeIds.size > 0) {
    bar.hidden = false;
    count.textContent = `${selectedRecipeIds.size} seleccionada${selectedRecipeIds.size > 1 ? 's' : ''}`;
  } else {
    bar.hidden = true;
  }
}

function clearBatchSelection() {
  selectedRecipeIds.clear();
  updateBatchBar();
  renderLibrary();
}

function confirmDiscardUnsavedChanges(message: string): boolean {
  return !isDirty || confirm(message);
}

function selectRecipe(id: string, discardConfirmed = false) {
  const found = catalog.recipes.find(r => r.id === id);
  if (!found) return;
  if (id === activeRecipe.id && !isNewRecipe) return;
  if (!discardConfirmed && !confirmDiscardUnsavedChanges('Tienes cambios sin guardar. ¿Descartarlos y cambiar de receta?')) return;

  activeRecipe = structuredClone(found);
  isNewRecipe = false;
  history = new HistoryManager(activeRecipe);
  updateHistoryButtons();
  markDirty(false);
  syncRecipeToForm(activeRecipe);
  renderLibrary();
}

function createNewRecipe(discardConfirmed = false) {
  if (!discardConfirmed && !confirmDiscardUnsavedChanges('Tienes cambios sin guardar. ¿Descartarlos y crear una receta nueva?')) return;

  activeRecipe = createEmptyRecipe();
  isNewRecipe = true;
  history = new HistoryManager(activeRecipe);
  updateHistoryButtons();
  markDirty(true);
  syncRecipeToForm(activeRecipe);
  renderLibrary();
  switchTab('general');
  ($('field-label') as HTMLInputElement).focus();
}

function createFromTemplate(templateId: string) {
  if (!confirmDiscardUnsavedChanges('Tienes cambios sin guardar. ¿Descartarlos y crear una receta desde la plantilla?')) return;

  activeRecipe = createRecipeFromTemplate(templateId);
  isNewRecipe = true;
  history = new HistoryManager(activeRecipe);
  updateHistoryButtons();
  markDirty(true);
  syncRecipeToForm(activeRecipe);
  renderLibrary();
  switchTab('general');
}

function applyRecipeArchetype(arch: string) {
  if (isDirty) {
    const ok = confirm('Se sustituirán los campos de la receta actual por el arquetipo seleccionado. ¿Deseas continuar?');
    if (!ok) return;
  }

  const suffix = Date.now().toString(36).slice(-4);
  if (arch === 'mueble') {
    activeRecipe = {
      id: sanitizeId(`mueble_artesanal_${suffix}`),
      label: 'Mueble artesanal de madera',
      description: 'Mueble de madera ensamblada para estancias y hogares de Brumaluz.',
      category: 'mueble',
      folder: 'Ebanistería y muebles',
      active: true,
      ingredients: [
        { itemId: 'madera', count: 6 },
        { itemId: 'tablones', count: 4 },
      ],
      output: { itemId: 'mueble_taburete_0', count: 1, chance: 100, isPrimary: true },
      craftingTime: 30,
      successRate: 100,
      stations: ['banco_ebanisteria'],
      requirements: { requiredProfession: 'ebanisteria', requiredRank: 0, minCharacterLevel: 1 },
      tags: ['mueble', 'madera', 'ebanisteria'],
    };
  } else if (arch === 'arma') {
    activeRecipe = {
      id: sanitizeId(`arma_forja_${suffix}`),
      label: 'Hoja afilada de forja',
      description: 'Arma templada en el yunque para combate cuerpo a cuerpo.',
      category: 'arma',
      folder: 'Herrería y forja',
      active: true,
      ingredients: [
        { itemId: 'lingote_hierro', count: 4 },
        { itemId: 'tira_cuero', count: 2 },
      ],
      output: { itemId: 'espada_cobre_t1', count: 1, chance: 100, isPrimary: true },
      craftingTime: 45,
      successRate: 100,
      stations: ['forja'],
      requirements: { requiredProfession: 'herreria', requiredRank: 1, minCharacterLevel: 5 },
      tags: ['arma', 'herreria', 'combate'],
    };
  } else if (arch === 'armadura') {
    activeRecipe = {
      id: sanitizeId(`armadura_placas_${suffix}`),
      label: 'Coraza reforzada de placas',
      description: 'Protección pectoral pesada forjada para resistir embates.',
      category: 'armadura',
      folder: 'Herrería y forja',
      active: true,
      ingredients: [
        { itemId: 'lingote_hierro', count: 6 },
        { itemId: 'remaches_hierro', count: 4 },
      ],
      output: { itemId: 'coraza_placas_hierro', count: 1, chance: 100, isPrimary: true },
      craftingTime: 60,
      successRate: 100,
      stations: ['forja'],
      requirements: { requiredProfession: 'herreria', requiredRank: 1, minCharacterLevel: 5 },
      tags: ['armadura', 'herreria', 'defensa'],
    };
  } else if (arch === 'pocion') {
    activeRecipe = {
      id: sanitizeId(`pocion_vital_${suffix}`),
      label: 'Elixir revitalizante silvestre',
      description: 'Brebaje destilado con extractos botánicos que restaura la vitalidad.',
      category: 'pocion',
      folder: 'Alquimia y elixires',
      active: true,
      ingredients: [
        { itemId: 'material_recolector_0', count: 3 },
        { itemId: 'fruta_0', count: 1 },
      ],
      output: { itemId: 'pocion_vida_minuscula', count: 1, chance: 100, isPrimary: true },
      craftingTime: 15,
      successRate: 100,
      stations: ['mesa_alquimia'],
      requirements: { requiredProfession: 'alquimia', requiredRank: 0, minCharacterLevel: 1 },
      tags: ['pocion', 'alquimia', 'salud'],
    };
  } else if (arch === 'comida') {
    activeRecipe = {
      id: sanitizeId(`plato_cocinado_${suffix}`),
      label: 'Guiso sabroso de aldea',
      description: 'Plato caliente y nutritivo preparado al fuego para reponer energías.',
      category: 'alimento',
      folder: 'Cocina y banquetes',
      active: true,
      ingredients: [
        { itemId: 'grano_0', count: 2 },
        { itemId: 'hongo_0', count: 2 },
      ],
      output: { itemId: 'plato_guiso_1', count: 1, chance: 100, isPrimary: true },
      craftingTime: 20,
      successRate: 100,
      stations: ['cocina'],
      requirements: { requiredProfession: 'cocina', requiredRank: 0, minCharacterLevel: 1 },
      tags: ['comida', 'cocina', 'nutricion'],
    };
  } else if (arch === 'pergamino') {
    activeRecipe = {
      id: sanitizeId(`pergamino_arcano_${suffix}`),
      label: 'Pergamino de ignición menor',
      description: 'Papiro consagrado con tintas arcanas que canaliza el fuego.',
      category: 'pergamino',
      folder: 'Encantamiento y pergaminos',
      active: true,
      ingredients: [
        { itemId: 'material_minero_0', count: 2 },
        { itemId: 'fibra_0', count: 2 },
      ],
      output: { itemId: 'pergamino_fire_1', count: 1, chance: 100, isPrimary: true },
      craftingTime: 25,
      successRate: 95,
      stations: ['mesa_encantamiento'],
      requirements: { requiredProfession: 'encantamiento', requiredRank: 0, minCharacterLevel: 1 },
      tags: ['pergamino', 'encantamiento', 'magia'],
    };
  }

  isNewRecipe = true;
  history = new HistoryManager(activeRecipe);
  updateHistoryButtons();
  markDirty(true);
  syncRecipeToForm(activeRecipe);
  renderVisualCanvas();
  renderLiveCard();
  runAudit();
  setStatus(`Arquetipo "${activeRecipe.label}" aplicado. Puedes ajustar ingredientes y guardar.`, 'normal');
}

function duplicateActiveRecipe() {
  const baseId = activeRecipe.id;
  let copyId = `${baseId}_copia`;
  let counter = 1;
  while (catalog.recipes.some(r => r.id === copyId)) {
    counter++;
    copyId = `${baseId}_copia_${counter}`;
  }

  const copy: RecipeCatalogItem = structuredClone(activeRecipe);
  copy.id = copyId;
  copy.label = `${activeRecipe.label} (Copia)`;

  catalog.recipes.push(copy);
  selectRecipe(copy.id, true);
  markDirty(true);
  setStatus(`Receta duplicada con ID "${copy.id}". Guarda para confirmar en disco.`, 'success');
}

async function deleteActiveRecipe() {
  const depCheck = checkRecipeDependencies(activeRecipe.id, activeRecipe.output.itemId, catalog.recipes, references.quests);

  let confirmMsg = `¿Deseas eliminar permanentemente la receta "${activeRecipe.label}" (${activeRecipe.id})?`;
  if (!depCheck.canDelete) {
    confirmMsg = `⚠️ ADVERTENCIA DE DEPENDENCIAS:\n\n${depCheck.warnings.join('\n')}\n\n¿Estás seguro de que deseas eliminar esta receta a pesar de las dependencias?`;
  }
  if (isDirty) {
    confirmMsg += '\n\nLos cambios sin guardar de esta receta también se descartarán.';
  }

  if (!confirm(confirmMsg)) return;

  catalog.recipes = catalog.recipes.filter(r => r.id !== activeRecipe.id);
  selectedRecipeIds.delete(activeRecipe.id);

  if (catalog.recipes.length > 0) {
    selectRecipe(catalog.recipes[0].id, true);
  } else {
    createNewRecipe(true);
  }

  markDirty(true);
  await saveCatalogToServer();
  markDirty(false);
  setStatus('Receta eliminada correctamente.', 'success');
}

// ─────────────────────────────────────────────────────────────
// TABLA Y SLOTS DE INGREDIENTES
// ─────────────────────────────────────────────────────────────
function renderIngredientsTable() {
  const tbody = $('ingredients-table-body');
  tbody.innerHTML = '';

  activeRecipe.ingredients.forEach((ing, index) => {
    const item = itemsMap.get(ing.itemId);
    const label = item?.label || ing.itemId;
    const icon = item?.icon || '<circle cx="12" cy="12" r="7" fill="#8ca89a"/>';
    const isMissing = itemsMap.size > 0 && !item;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div style="width: 32px; height: 32px; background: #0e1614; border: 1px solid #2e4136; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Cambiar objeto">
          <svg viewBox="0 0 24 24" style="width: 22px; height: 22px;">${icon}</svg>
        </div>
      </td>
      <td>
        <div style="font-weight: 600; font-size: 13px; color: ${isMissing ? '#ffb4a6' : '#fff'};">
          ${label} ${isMissing ? '<span style="color: #ff9d8a; font-size: 11px;">(no encontrado)</span>' : ''}
        </div>
      </td>
      <td>
        <div style="display: flex; gap: 4px; align-items: center;">
          <input type="text" value="${ing.itemId}" class="ing-id-input" data-index="${index}" style="padding: 4px 6px; font-size: 11.5px; width: 140px; font-family: monospace;">
          <button type="button" class="small subtle ing-pick-btn" data-index="${index}" title="Buscar en catálogo">🔍</button>
        </div>
      </td>
      <td>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button type="button" class="small subtle ing-minus-btn" data-index="${index}">-</button>
          <input type="number" min="1" max="999" value="${ing.count}" class="ing-count-input" data-index="${index}" style="padding: 4px 6px; width: 60px; text-align: center;">
          <button type="button" class="small subtle ing-plus-btn" data-index="${index}">+</button>
        </div>
      </td>
      <td>
        <button type="button" class="small danger ing-delete-btn" data-index="${index}" title="Quitar ingrediente">✕</button>
      </td>
    `;

    // Eventos de fila
    row.querySelector('.ing-id-input')?.addEventListener('change', (e: Event) => {
      ing.itemId = (e.target as HTMLInputElement).value.trim();
      onIngredientChange();
    });

    row.querySelector('.ing-count-input')?.addEventListener('change', (e: Event) => {
      ing.count = Math.max(1, Number((e.target as HTMLInputElement).value) || 1);
      onIngredientChange();
    });

    row.querySelector('.ing-minus-btn')?.addEventListener('click', () => {
      if (ing.count > 1) {
        ing.count--;
        onIngredientChange();
      }
    });

    row.querySelector('.ing-plus-btn')?.addEventListener('click', () => {
      ing.count++;
      onIngredientChange();
    });

    row.querySelector('.ing-delete-btn')?.addEventListener('click', () => {
      if (activeRecipe.ingredients.length <= 1) {
        alert('La receta debe conservar al menos un ingrediente.');
        return;
      }
      activeRecipe.ingredients.splice(index, 1);
      onIngredientChange();
    });

    row.querySelector('.ing-pick-btn')?.addEventListener('click', () => {
      openItemPicker({ type: 'ingredient', index });
    });

    tbody.appendChild(row);
  });
}

function addIngredientRow(itemId = 'madera', count = 1) {
  activeRecipe.ingredients.push({ itemId, count });
  onIngredientChange();
}

function onIngredientChange() {
  markDirty(true);
  history.push(activeRecipe);
  updateHistoryButtons();
  renderIngredientsTable();
  renderVisualCanvas();
  renderLiveCard();
  runAudit();
}

// ─────────────────────────────────────────────────────────────
// CHIPS DE ESTACIONES DE FABRICACIÓN
// ─────────────────────────────────────────────────────────────
function renderStationChips() {
  const container = $('stations-chips-container');
  container.innerHTML = '';

  for (const s of catalog.stations) {
    const isSelected = activeRecipe.stations.includes(s.id);
    const chip = document.createElement('div');
    chip.className = `station-chip ${isSelected ? 'selected' : ''}`;
    chip.innerHTML = `
      <svg viewBox="0 0 24 24">${s.icon || '<circle cx="12" cy="12" r="6" fill="#d5b075"/>'}</svg>
      <span>${s.label}</span>
    `;

    chip.addEventListener('click', () => {
      if (activeRecipe.stations.includes(s.id)) {
        activeRecipe.stations = activeRecipe.stations.filter(id => id !== s.id);
      } else {
        activeRecipe.stations.push(s.id);
      }
      markDirty(true);
      history.push(activeRecipe, true);
      updateHistoryButtons();
      renderStationChips();
      renderVisualCanvas();
      renderLiveCard();
      runAudit();
    });

    container.appendChild(chip);
  }
}

// ─────────────────────────────────────────────────────────────
// CANVAS VISUAL INTERACTIVO
// ─────────────────────────────────────────────────────────────
function renderVisualCanvas() {
  // 1. Ingredientes slots
  const slotsContainer = $('visual-ingredients-slots');
  slotsContainer.innerHTML = '';

  activeRecipe.ingredients.forEach((ing, index) => {
    const item = itemsMap.get(ing.itemId);
    const label = item?.label || ing.itemId;
    const rarity = item?.rarity || 'common';
    const icon = item?.icon || '<circle cx="12" cy="12" r="7" fill="#8ca89a"/>';

    const slot = document.createElement('div');
    slot.className = `item-slot rarity-border-${rarity}`;
    slot.title = `${label} (${ing.count} unidades - ${rarity}). Clic para cambiar objeto.`;
    slot.innerHTML = `
      <button type="button" class="slot-remove-btn" title="Quitar ingrediente">✕</button>
      <span class="item-slot-badge">${ing.count}</span>
      <div class="item-slot-icon">
        <svg viewBox="0 0 24 24">${icon}</svg>
      </div>
      <span class="item-slot-name">${label}</span>
      <div class="item-slot-stepper" onclick="event.stopPropagation();">
        <button type="button" class="slot-minus" title="Restar 1">-</button>
        <span>${ing.count}</span>
        <button type="button" class="slot-plus" title="Sumar 1">+</button>
      </div>
    `;

    // Clic en la casilla abre el selector de objetos para este ingrediente
    slot.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('.slot-remove-btn') || target.closest('.item-slot-stepper')) return;
      openItemPicker({ type: 'ingredient', index });
    });

    // Botón directo para quitar ingrediente del canvas
    slot.querySelector('.slot-remove-btn')?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      if (activeRecipe.ingredients.length <= 1) {
        alert('La receta debe conservar al menos un ingrediente.');
        return;
      }
      activeRecipe.ingredients.splice(index, 1);
      onIngredientChange();
    });

    slot.querySelector('.slot-minus')?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      if (ing.count > 1) {
        ing.count--;
        onIngredientChange();
      }
    });

    slot.querySelector('.slot-plus')?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      ing.count++;
      onIngredientChange();
    });

    slotsContainer.appendChild(slot);
  });

  // 2. Estación central
  const firstStationId = activeRecipe.stations[0];
  const stationDef = firstStationId ? stationsMap.get(firstStationId) : null;
  const stationIcon = stationDef?.icon || '<circle cx="12" cy="12" r="8" fill="#d5b075"/>';
  const stationLabel = stationDef ? stationDef.label : (activeRecipe.stations.length > 0 ? activeRecipe.stations[0] : 'Manual');

  $('visual-station-node').innerHTML = `<svg viewBox="0 0 24 24">${stationIcon}</svg>`;
  $('visual-station-label').textContent = stationLabel;
  $('visual-time-pill').textContent = formatTimeHuman(activeRecipe.craftingTime);

  // 3. Resultado slot
  const outItem = itemsMap.get(activeRecipe.output.itemId);
  const outRarity = outItem?.rarity || 'common';
  const outIcon = outItem?.icon || '<rect width="24" height="24" rx="4" fill="#354e41"/>';
  const outLabel = outItem?.label || activeRecipe.output.itemId;

  const outSlot = $('visual-output-slot');
  outSlot.className = `item-slot output-slot rarity-border-${outRarity}`;
  $('visual-output-count').textContent = String(activeRecipe.output.count);
  const stepperCount = $('visual-output-stepper-count');
  if (stepperCount) stepperCount.textContent = String(activeRecipe.output.count);
  $('visual-output-icon').innerHTML = `<svg viewBox="0 0 24 24">${outIcon}</svg>`;
  $('visual-output-label').textContent = outLabel;
}

// ─────────────────────────────────────────────────────────────
// FICHA REALISTA EN VIVO Y AUDITORÍA
// ─────────────────────────────────────────────────────────────
function renderLiveCard() {
  const outItem = itemsMap.get(activeRecipe.output.itemId);
  const outIcon = outItem?.icon || '<circle cx="12" cy="12" r="8" fill="#d5b075"/>';

  $('game-card-icon').innerHTML = `<svg viewBox="0 0 24 24">${outIcon}</svg>`;
  $('game-card-title').textContent = activeRecipe.label;

  const profName = activeRecipe.requirements.requiredProfession ? (PROFESSION_LABELS[activeRecipe.requirements.requiredProfession] || activeRecipe.requirements.requiredProfession) : 'Sin oficio';
  const rankName = PROFESSION_RANKS[activeRecipe.requirements.requiredRank ?? 0] || 'Aprendiz';
  $('game-card-category').textContent = `${profName} • ${rankName}`;

  $('game-card-desc').textContent = activeRecipe.description || 'Sin descripción disponible.';

  // Ingredientes
  const ingsList = $('game-card-ingredients');
  ingsList.innerHTML = '';
  for (const ing of activeRecipe.ingredients) {
    const it = itemsMap.get(ing.itemId);
    const name = it?.label || ing.itemId;
    const row = document.createElement('div');
    row.className = 'game-card-ingredient-item';
    row.innerHTML = `
      <span>✓ ${name}</span>
      <span>${ing.count} uds.</span>
    `;
    ingsList.appendChild(row);
  }

  // Estaciones
  const stationNames = activeRecipe.stations.map(id => stationsMap.get(id)?.label || id).join(', ');
  $('game-card-station').textContent = stationNames || 'Manual';
  $('game-card-time').textContent = formatTimeHuman(activeRecipe.craftingTime);
  $('game-card-job').textContent = profName;
  $('game-card-chance').textContent = `${activeRecipe.successRate} %`;

  renderEconomics();
}

function renderEconomics() {
  const econ = calculateRecipeEconomics(activeRecipe, itemsMap);
  $('econ-cost').textContent = `${econ.ingredientCost} Pelines`;
  $('econ-value').textContent = `${econ.outputValue} Pelines`;

  const profitEl = $('econ-profit');
  if (econ.netProfit > 0) {
    profitEl.textContent = `+${econ.netProfit} Pelines`;
    profitEl.className = 'economics-metric-val profit-positive';
  } else if (econ.netProfit < 0) {
    profitEl.textContent = `${econ.netProfit} Pelines`;
    profitEl.className = 'economics-metric-val profit-negative';
  } else {
    profitEl.textContent = '0 Pelines';
    profitEl.className = 'economics-metric-val profit-neutral';
  }

  const ratePerMin = Math.round(econ.profitPerSecond * 60);
  $('econ-rate').textContent = `${ratePerMin >= 0 ? '+' : ''}${ratePerMin} Pel / min`;

  const marginBadge = $('econ-margin-badge');
  marginBadge.textContent = `${Math.round(econ.profitMarginPct)} % margen`;
  marginBadge.className = `pill ${econ.netProfit > 0 ? 'clean' : econ.netProfit === 0 ? 'dirty' : 'inactive'}`;

  const banner = $('profit-banner');
  const bannerText = $('profit-banner-text');
  if (banner && bannerText) {
    if (econ.netProfit > 0) {
      banner.className = 'profit-banner positive';
      bannerText.textContent = `✓ Receta rentable: +${econ.netProfit} Pelines (${Math.round(econ.profitMarginPct)}% margen)`;
    } else if (econ.netProfit < 0) {
      banner.className = 'profit-banner negative';
      bannerText.textContent = `⚠️ Rentabilidad negativa: el coste supera el valor por ${Math.abs(econ.netProfit)} Pelines`;
    } else {
      banner.className = 'profit-banner';
      bannerText.textContent = `⚖️ Equilibrio: el coste de materiales coincide con el valor`;
    }
  }
}

function runQuickSimulation() {
  const sim = simulateCrafting(activeRecipe, 10);
  const msg = `Simulación 10×: ${sim.successes} éxitos, ${sim.failures} fallos (${sim.totalOutputs} productos en ${sim.totalTimeSeconds} s)`;
  setStatus(msg, sim.failures === 0 ? 'success' : 'normal');
  alert(`🎲 Resultado de 10 intentos con los dados del juego:\n\n• Éxitos: ${sim.successes} de 10 (${sim.successes * 10}%)\n• Fallos: ${sim.failures}\n• Unidades obtenidas: ${sim.totalOutputs}\n• Tiempo acumulado: ${sim.totalTimeSeconds} s`);
}

function runAudit() {
  const issues = auditRecipe(activeRecipe, itemsMap, stationsMap, catalog.recipes);
  const auditBox = $('audit-box');
  const badge = $('audit-badge');

  auditBox.innerHTML = '';

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  if (errors.length > 0) {
    badge.className = 'pill inactive';
    badge.textContent = `${errors.length} error${errors.length > 1 ? 'es' : ''}`;
  } else if (warnings.length > 0) {
    badge.className = 'pill dirty';
    badge.textContent = `${warnings.length} aviso${warnings.length > 1 ? 's' : ''}`;
  } else {
    badge.className = 'pill clean';
    badge.textContent = 'Sin alertas';
  }

  if (issues.length === 0) {
    auditBox.innerHTML = `
      <div class="audit-item info">
        ✓ Receta válida. Todos los ingredientes y resultados existen en el catálogo y las estaciones están verificadas.
      </div>
    `;
    return;
  }

  for (const issue of issues) {
    const el = document.createElement('div');
    el.className = `audit-item ${issue.type}`;
    const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
    el.innerHTML = `<span>${icon}</span> <span>${issue.message}</span>`;
    auditBox.appendChild(el);
  }
}

// ─────────────────────────────────────────────────────────────
// PERSISTENCIA (GUARDAR EN DISCO MEDIANTE API VITE)
// ─────────────────────────────────────────────────────────────
async function saveActiveRecipe() {
  readFormIntoActiveRecipe();

  try {
    // Validar receta
    validateRecipe(activeRecipe);

    // Actualizar o añadir a la lista del catálogo
    const index = catalog.recipes.findIndex(r => r.id === activeRecipe.id);
    if (index >= 0) {
      catalog.recipes[index] = structuredClone(activeRecipe);
    } else {
      catalog.recipes.push(structuredClone(activeRecipe));
    }

    isNewRecipe = false;
    await saveCatalogToServer();
    markDirty(false);
    renderLibrary();
    setStatus(`Receta "${activeRecipe.label}" guardada correctamente en disco.`, 'success');
  } catch (err: any) {
    alert(`Error al guardar receta: ${err.message}`);
    setStatus(`Error: ${err.message}`, 'error');
  }
}

async function saveCatalogToServer(): Promise<void> {
  const res = await fetch('/__dev/recipes', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': revision,
    },
    body: JSON.stringify(catalog),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || 'Error al persistir cambios en disco.');
  }

  revision = res.headers.get('ETag') || revision;
  catalog = await res.json();
  updateStationsMap();
}

// ─────────────────────────────────────────────────────────────
// MODAL: SELECTOR DE OBJETOS (ITEM PICKER)
// ─────────────────────────────────────────────────────────────
function openItemPicker(target: { type: 'ingredient'; index: number } | { type: 'ingredient-new' } | { type: 'output' }) {
  itemPickerTarget = target;
  $('item-picker-modal').hidden = false;
  $<HTMLInputElement>('item-picker-search').value = '';
  itemPickerCategory = 'all';
  document.querySelectorAll('.picker-cat-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-cat') === 'all');
  });
  renderItemPickerGrid('');
  $('item-picker-search').focus();
}

function closeItemPicker() {
  $('item-picker-modal').hidden = true;
  itemPickerTarget = null;
}

function matchesPickerCategory(itemCategory: string | undefined, targetCategory: string): boolean {
  if (targetCategory === 'all') return true;
  const c = (itemCategory || '').toLowerCase();
  if (targetCategory === 'material') {
    return c.includes('resource') || c.includes('crafting') || c.includes('material');
  }
  if (targetCategory === 'mueble') {
    return c.includes('furniture') || c.includes('mueble');
  }
  if (targetCategory === 'comida') {
    return c.includes('food') || c.includes('comida') || c.includes('alimento');
  }
  if (targetCategory === 'pocion') {
    return c.includes('consum') || c.includes('pocion') || c.includes('elixir');
  }
  if (targetCategory === 'herramienta') {
    return c.includes('tool') || c.includes('herramienta');
  }
  if (targetCategory === 'equipo') {
    return c.includes('weapon') || c.includes('armor') || c.includes('clothing') || c.includes('arma') || c.includes('armadura');
  }
  if (targetCategory === 'pergamino') {
    return c.includes('pergamino') || c.includes('scroll') || c.includes('special');
  }
  return c.includes(targetCategory.toLowerCase());
}

function renderItemPickerGrid(query: string) {
  const grid = $('item-picker-grid');
  grid.innerHTML = '';
  const q = query.trim().toLowerCase();

  const filtered = references.items.filter(it => {
    if (!matchesPickerCategory(it.category, itemPickerCategory)) return false;
    if (!q) return true;
    return it.label.toLowerCase().includes(q) || it.id.toLowerCase().includes(q) || (it.category && it.category.toLowerCase().includes(q));
  }).slice(0, 100);

  for (const it of filtered) {
    const card = document.createElement('div');
    card.className = `item-picker-card rarity-border-${it.rarity || 'common'}`;
    const valueStr = it.value !== undefined ? `🪙 ${it.value}` : '';
    card.innerHTML = `
      <svg viewBox="0 0 24 24">${it.icon || '<circle cx="12" cy="12" r="7" fill="#d5b075"/>'}</svg>
      <div class="item-picker-card-label">${it.label}</div>
      <div class="item-picker-card-id">${it.id}</div>
      <div class="item-picker-card-badges">
        <span class="item-picker-rarity rarity-${it.rarity || 'common'}">${it.rarity || 'común'}</span>
        ${valueStr ? `<span class="item-picker-value">${valueStr}</span>` : ''}
      </div>
    `;

    card.addEventListener('click', () => {
      selectItemFromPicker(it.id);
    });

    grid.appendChild(card);
  }

  // Opción de usar el ID buscado si no se encuentra
  if (q && !filtered.some(i => i.id === q)) {
    const customOption = document.createElement('div');
    customOption.className = 'item-picker-card';
    customOption.style.borderColor = 'var(--gold)';
    customOption.innerHTML = `
      <div style="font-size: 20px;">➕</div>
      <div class="item-picker-card-label">Usar ID "${q}"</div>
      <div class="item-picker-card-id">(Objeto personalizado)</div>
    `;
    customOption.addEventListener('click', () => {
      selectItemFromPicker(q);
    });
    grid.prepend(customOption);
  }
}

function selectItemFromPicker(itemId: string) {
  if (!itemPickerTarget) return;

  if (itemPickerTarget.type === 'ingredient') {
    activeRecipe.ingredients[itemPickerTarget.index].itemId = itemId;
    onIngredientChange();
  } else if (itemPickerTarget.type === 'ingredient-new') {
    activeRecipe.ingredients.push({ itemId, count: 1 });
    onIngredientChange();
  } else if (itemPickerTarget.type === 'output') {
    activeRecipe.output.itemId = itemId;
    ($('field-output-id') as HTMLInputElement).value = itemId;
    markDirty(true);
    history.push(activeRecipe);
    updateHistoryButtons();
    renderVisualCanvas();
    renderLiveCard();
    runAudit();
  }

  closeItemPicker();
}

// ─────────────────────────────────────────────────────────────
// MODAL: SUBEDITOR DE ESTACIONES DE FABRICACIÓN
// ─────────────────────────────────────────────────────────────
function openStationsModal() {
  $('stations-modal').hidden = false;
  if (catalog.stations.length > 0) {
    selectStationInModal(catalog.stations[0].id);
  } else {
    createNewStationInModal();
  }
  renderStationsModalList();
}

function closeStationsModal() {
  $('stations-modal').hidden = true;
  populateStationFilter();
  populateBatchStations();
  renderStationChips();
  renderVisualCanvas();
  renderLiveCard();
}

function renderStationsModalList() {
  const list = $('stations-list-modal');
  list.innerHTML = '';

  for (const s of catalog.stations) {
    const deps = checkStationDependencies(s.id, catalog.recipes);
    const item = document.createElement('div');
    item.className = `recipe-card ${s.id === activeStationId ? 'active' : ''}`;
    item.style.padding = '8px';
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; flex-shrink: 0;">${s.icon || '<circle cx="12" cy="12" r="6" fill="#d5b075"/>'}</svg>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 12px; color: #fff;">${s.label}</div>
          <div style="font-size: 10.5px; color: var(--text-muted);">${deps.inUseCount} recetas asociadas</div>
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      selectStationInModal(s.id);
    });

    list.appendChild(item);
  }
}

function selectStationInModal(id: string) {
  activeStationId = id;
  const s = catalog.stations.find(st => st.id === id);
  if (!s) return;

  $('station-form-title').textContent = `Editar estación: ${s.label}`;
  ($('station-label-input') as HTMLInputElement).value = s.label;
  ($('station-id-input') as HTMLInputElement).value = s.id;
  ($('station-job-input') as HTMLSelectElement).value = s.job || '';
  ($('station-desc-input') as HTMLTextAreaElement).value = s.description;
  ($('station-icon-input') as HTMLTextAreaElement).value = s.icon;

  renderStationsModalList();
}

function createNewStationInModal() {
  const newStation = createEmptyStation();
  activeStationId = newStation.id;

  $('station-form-title').textContent = 'Nueva estación de trabajo';
  ($('station-label-input') as HTMLInputElement).value = newStation.label;
  ($('station-id-input') as HTMLInputElement).value = newStation.id;
  ($('station-job-input') as HTMLSelectElement).value = '';
  ($('station-desc-input') as HTMLTextAreaElement).value = newStation.description;
  ($('station-icon-input') as HTMLTextAreaElement).value = newStation.icon;

  renderStationsModalList();
}

async function saveStationFromModal() {
  const id = sanitizeId(($('station-id-input') as HTMLInputElement).value.trim());
  const label = ($('station-label-input') as HTMLInputElement).value.trim();
  const job = ($('station-job-input') as HTMLSelectElement).value || undefined;
  const description = ($('station-desc-input') as HTMLTextAreaElement).value.trim();
  const icon = ($('station-icon-input') as HTMLTextAreaElement).value.trim();

  if (!id || !label) {
    alert('El identificador y el nombre de la estación son obligatorios.');
    return;
  }

  const existingIndex = catalog.stations.findIndex(s => s.id === id);
  const updatedStation: CraftingStationDef = {
    id,
    label,
    description,
    icon: icon || '<circle cx="12" cy="12" r="7" fill="#d5b075"/>',
    job,
    category: 'Personalizada',
    active: true,
  };

  if (existingIndex >= 0) {
    catalog.stations[existingIndex] = updatedStation;
  } else {
    catalog.stations.push(updatedStation);
  }

  updateStationsMap();
  activeStationId = id;
  await saveCatalogToServer();
  renderStationsModalList();
  setStatus(`Estación "${label}" guardada correctamente.`, 'success');
}

async function deleteStationFromModal() {
  const s = catalog.stations.find(st => st.id === activeStationId);
  if (!s) return;

  const deps = checkStationDependencies(s.id, catalog.recipes);
  if (deps.inUseCount > 0) {
    alert(`No se puede eliminar la estación "${s.label}" porque está en uso por ${deps.inUseCount} recetas (${deps.recipeNames.join(', ')}).`);
    return;
  }

  if (!confirm(`¿Eliminar la estación "${s.label}"?`)) return;

  catalog.stations = catalog.stations.filter(st => st.id !== activeStationId);
  updateStationsMap();

  if (catalog.stations.length > 0) {
    selectStationInModal(catalog.stations[0].id);
  } else {
    createNewStationInModal();
  }

  await saveCatalogToServer();
  renderStationsModalList();
  setStatus('Estación eliminada.', 'success');
}

// ─────────────────────────────────────────────────────────────
// MODAL: EDICIÓN MASIVA (BATCH)
// ─────────────────────────────────────────────────────────────
function openBatchModal() {
  $('batch-modal').hidden = false;
  $('batch-modal-info').textContent = `Vas a editar ${selectedRecipeIds.size} recetas seleccionadas.`;
}

function closeBatchModal() {
  $('batch-modal').hidden = true;
}

async function applyBatchChanges() {
  if (!confirmDiscardUnsavedChanges('Tienes cambios sin guardar. ¿Descartarlos y aplicar la edición masiva?')) return;

  const activeOpt = ($('batch-active-select') as HTMLSelectElement).value;
  const profOpt = ($('batch-profession-select') as HTMLSelectElement).value;
  const addStationOpt = ($('batch-add-station-select') as HTMLSelectElement).value;
  const folderOpt = ($('batch-folder-input') as HTMLInputElement).value;

  const updates: any = {};
  if (activeOpt === 'true') updates.active = true;
  if (activeOpt === 'false') updates.active = false;
  if (profOpt !== 'keep') updates.requiredProfession = profOpt;
  if (addStationOpt) updates.addStation = addStationOpt;
  if (folderOpt) updates.folder = folderOpt;

  catalog.recipes = batchUpdateRecipes(catalog.recipes, selectedRecipeIds, updates);

  // Si la activa estaba seleccionada, resincronizar
  const currentActive = catalog.recipes.find(r => r.id === activeRecipe.id);
  if (currentActive) activeRecipe = structuredClone(currentActive);

  closeBatchModal();
  clearBatchSelection();
  markDirty(true);
  syncRecipeToForm(activeRecipe);
  renderLibrary();
  await saveCatalogToServer();
  markDirty(false);
  setStatus('Cambios en lote aplicados con éxito.', 'success');
}

async function applyBatchDelete() {
  const unsavedWarning = isDirty ? '\n\nLos cambios sin guardar de la receta activa también se descartarán.' : '';
  if (!confirm(`¿Eliminar las ${selectedRecipeIds.size} recetas seleccionadas?${unsavedWarning}`)) return;

  catalog.recipes = catalog.recipes.filter(r => !selectedRecipeIds.has(r.id));
  closeBatchModal();
  clearBatchSelection();

  if (catalog.recipes.length > 0) {
    selectRecipe(catalog.recipes[0].id, true);
  } else {
    createNewRecipe(true);
  }

  markDirty(true);
  await saveCatalogToServer();
  markDirty(false);
  setStatus('Recetas seleccionadas eliminadas.', 'success');
}

// ─────────────────────────────────────────────────────────────
// EXPORTACIÓN, IMPORTACIÓN Y BACKUP
// ─────────────────────────────────────────────────────────────
function exportAllRecipes() {
  const data = JSON.stringify(catalog, null, 2);
  downloadBlob(data, 'brumaluz-recipes-catalog.json');
}

function exportActiveRecipe() {
  const single = {
    version: 1,
    stations: catalog.stations.filter(s => activeRecipe.stations.includes(s.id)),
    recipes: [activeRecipe],
  };
  downloadBlob(JSON.stringify(single, null, 2), `recipe-${activeRecipe.id}.json`);
}

function downloadBlob(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function createServerBackup() {
  try {
    const res = await fetch('/__dev/recipes/backup', { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    alert(`Copia de seguridad guardada con éxito en el servidor:\n${data.backupFile}`);
    setStatus(`Backup creado: ${data.backupFile}`, 'success');
  } catch (err: any) {
    alert(`Error al crear copia de seguridad: ${err.message}`);
  }
}

async function syncRpgRecipes() {
  if (isDirty) {
    const proceed = confirm('Tienes cambios locales sin guardar. ¿Deseas sincronizar el catálogo RPG de todas formas?');
    if (!proceed) return;
  }

  setStatus('Sincronizando recetas del catálogo RPG del juego…', 'normal');
  try {
    const res = await fetch('/__dev/recipes/sync-rpg', { method: 'POST' });
    if (!res.ok) {
      const errText = await res.text();
      let errorMsg = `HTTP ${res.status}`;
      try {
        const json = JSON.parse(errText);
        errorMsg = json.error || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }
    const data = await res.json();
    revision = res.headers.get('ETag') || revision;
    catalog = data.catalog;
    updateStationsMap();
    populateSelectOptions();
    renderLibrary();
    if (!activeRecipe || !catalog.recipes.find(r => r.id === activeRecipe.id)) {
      if (catalog.recipes.length > 0) selectRecipe(catalog.recipes[0].id, true);
    }
    markDirty(false);
    const msg = data.added > 0
      ? `Sincronización completada: se añadieron ${data.added} nuevas recetas RPG (total: ${data.total}).`
      : `Catálogo sincronizado: las ${data.existing} recetas RPG ya están incorporadas en el editor (total: ${data.total}).`;
    setStatus(msg, 'success');
    alert(msg);
  } catch (err: any) {
    setStatus(`Error al sincronizar recetas RPG: ${err.message}`, 'error');
    alert(`Error al sincronizar recetas RPG: ${err.message}`);
  }
}

async function handleImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!confirmDiscardUnsavedChanges('Tienes cambios sin guardar. ¿Descartarlos e importar el catálogo?')) {
    ($('import-input') as HTMLInputElement).value = '';
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const valid = validateRecipeCatalog(parsed, references);

    const mode = ($('import-mode') as HTMLSelectElement).value as 'merge' | 'replace';
    catalog = mergeCatalogs(catalog, valid, mode);
    updateStationsMap();

    if (catalog.recipes.length > 0) {
      selectRecipe(catalog.recipes[0].id, true);
    }

    markDirty(true);
    await saveCatalogToServer();
    markDirty(false);
    populateSelectOptions();
    renderLibrary();
    alert(`Importación completada en modo "${mode}". Total recetas: ${catalog.recipes.length}.`);
    setStatus('Catálogo importado y guardado.', 'success');
  } catch (err: any) {
    alert(`Error al importar archivo JSON: ${err.message}`);
  } finally {
    ($('import-input') as HTMLInputElement).value = '';
  }
}

// ─────────────────────────────────────────────────────────────
// AUDITORÍA GLOBAL DE INTEGRIDAD
// ─────────────────────────────────────────────────────────────
function openGlobalAuditModal() {
  $('audit-modal').hidden = false;
  const content = $('global-audit-content');
  content.innerHTML = '<p>Analizando catálogo completo de recetas…</p>';

  const total = catalog.recipes.length;
  let missingItemsCount = 0;
  let duplicatesCount = 0;
  const issuesList: { recipe: RecipeCatalogItem; issues: any[] }[] = [];

  for (const r of catalog.recipes) {
    const issues = auditRecipe(r, itemsMap, stationsMap, catalog.recipes);
    if (issues.length > 0) {
      issuesList.push({ recipe: r, issues });
      if (issues.some(i => i.message.includes('catálogo actual de objetos'))) missingItemsCount++;
      if (issues.some(i => i.message.includes('duplicada'))) duplicatesCount++;
    }
  }

  content.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px;">
      <div class="panel" style="padding: 10px; text-align: center;">
        <span class="eyebrow" style="margin: 0;">Recetas totales</span>
        <div style="font-size: 22px; font-weight: 700; color: var(--gold-bright);">${total}</div>
      </div>
      <div class="panel" style="padding: 10px; text-align: center;">
        <span class="eyebrow" style="margin: 0;">Refs inexistentes</span>
        <div style="font-size: 22px; font-weight: 700; color: ${missingItemsCount > 0 ? '#ffb4a6' : 'var(--accent-green)'};">${missingItemsCount}</div>
      </div>
      <div class="panel" style="padding: 10px; text-align: center;">
        <span class="eyebrow" style="margin: 0;">Posibles duplicadas</span>
        <div style="font-size: 22px; font-weight: 700; color: ${duplicatesCount > 0 ? 'var(--accent-amber)' : 'var(--accent-green)'};">${duplicatesCount}</div>
      </div>
    </div>
    <h4>Detalles de auditoría:</h4>
    <div style="max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
      ${issuesList.length === 0 ? '<div class="audit-item info">¡Catálogo en perfecto estado! Cero alertas de integridad.</div>' : ''}
      ${issuesList.map(item => `
        <div class="panel" style="padding: 8px 12px;">
          <div style="font-weight: 600; font-size: 13px; color: var(--gold);">${item.recipe.label} (${item.recipe.id})</div>
          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
            ${item.issues.map(iss => `<div class="audit-item ${iss.type}" style="padding: 2px 6px;">${iss.message}</div>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function closeGlobalAuditModal() {
  $('audit-modal').hidden = true;
}

// ─────────────────────────────────────────────────────────────
// GUARDAR COMO PLANTILLA PERSONALIZADA
// ─────────────────────────────────────────────────────────────
function saveAsTemplate() {
  const name = prompt('Nombre para la nueva plantilla reutilizable:', activeRecipe.label);
  if (!name || !name.trim()) return;

  const tplId = sanitizeId(name);
  RECIPE_TEMPLATES.push({
    id: tplId,
    name: `${name.trim()} (Personalizada)`,
    description: activeRecipe.description,
    category: activeRecipe.category,
    recipe: {
      description: activeRecipe.description,
      category: activeRecipe.category,
      folder: activeRecipe.folder,
      active: true,
      ingredients: activeRecipe.ingredients.map(i => ({ ...i })),
      output: { ...activeRecipe.output },
      craftingTime: activeRecipe.craftingTime,
      successRate: activeRecipe.successRate,
      stations: [...activeRecipe.stations],
      requirements: { ...activeRecipe.requirements },
      tags: [...activeRecipe.tags],
    },
  });

  populateSelectOptions();
  alert(`Plantilla "${name}" guardada y lista para usarse en el desplegable de plantillas.`);
  setStatus(`Plantilla "${name}" creada.`, 'success');
}

// ─────────────────────────────────────────────────────────────
// SIMULADOR DE FABRICACIÓN (TIRADAS Y LOTES)
// ─────────────────────────────────────────────────────────────
function openSimulationModal() {
  $('simulation-modal').hidden = false;
  $('sim-modal-title').textContent = `Simular fabricación: ${activeRecipe.label}`;
  runSimulation();
}

function closeSimulationModal() {
  $('simulation-modal').hidden = true;
}

function runSimulation() {
  const attempts = Math.max(1, Math.min(1000, Number(($('sim-attempts-input') as HTMLInputElement).value) || 50));
  const sim = simulateCrafting(activeRecipe, attempts);

  $('sim-stat-successes').textContent = `${sim.successes} (${Math.round(sim.successRateActual)} %)`;
  $('sim-stat-failures').textContent = `${sim.failures} (${Math.round(100 - sim.successRateActual)} %)`;
  $('sim-stat-outputs').textContent = `${sim.totalOutputs} uds.`;
  $('sim-stat-time').textContent = formatTimeHuman(sim.totalTimeSeconds);

  $('sim-bar-success').style.width = `${sim.successRateActual}%`;
  $('sim-bar-failure').style.width = `${100 - sim.successRateActual}%`;

  const matContainer = $('sim-materials-spent');
  matContainer.innerHTML = '';
  for (const m of sim.materialsSpent) {
    const item = itemsMap.get(m.itemId);
    const label = item?.label || m.itemId;
    const div = document.createElement('div');
    div.innerHTML = `• <b>${m.count}×</b> ${label} <span style="color: var(--text-dim);">(${m.itemId})</span>`;
    matContainer.appendChild(div);
  }
}

// ─────────────────────────────────────────────────────────────
// ÁRBOL DE CADENA DE FABRICACIÓN
// ─────────────────────────────────────────────────────────────
function openProductionTreeModal() {
  $('production-tree-modal').hidden = false;
  $('tree-modal-title').textContent = `Cadena de fabricación: ${activeRecipe.label}`;
  renderProductionTree();
}

function closeProductionTreeModal() {
  $('production-tree-modal').hidden = true;
}

function renderProductionTree() {
  const container = $('production-tree-content');
  container.innerHTML = '';

  const chain = resolveProductionChain(activeRecipe, catalog.recipes, itemsMap);

  function renderNodes(nodes: ProductionChainNode[], parentEl: HTMLElement) {
    for (const node of nodes) {
      const nodeEl = document.createElement('div');
      nodeEl.className = 'tree-node';

      const typeBadge = node.isCircular
        ? '<span class="pill inactive">Dependencia circular</span>'
        : node.isCraftable
        ? `<span class="pill clean">Fabricable (${node.recipe?.label})</span>`
        : '<span class="pill dirty">Materia prima elemental</span>';

      nodeEl.innerHTML = `
        <div class="tree-node-header">
          <span>📦 <b>${node.count}×</b> ${node.label} <code style="font-size: 10px; color: var(--gold);">${node.itemId}</code></span>
          ${typeBadge}
        </div>
      `;

      if (node.subIngredients && node.subIngredients.length > 0) {
        const subList = document.createElement('div');
        subList.className = 'tree-sub-list';
        renderNodes(node.subIngredients, subList);
        nodeEl.appendChild(subList);
      }

      parentEl.appendChild(nodeEl);
    }
  }

  if (chain.length === 0) {
    container.innerHTML = '<p class="muted">Esta receta no tiene ingredientes configurados.</p>';
    return;
  }

  renderNodes(chain, container);
}

// Iniciar al cargar el DOM
window.addEventListener('DOMContentLoaded', init);

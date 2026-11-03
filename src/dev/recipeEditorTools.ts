import type {
  RecipeCatalogItem,
  CraftingStationDef,
  RecipeCatalog,
  RecipeReferences,
} from '../data/recipesCatalog';

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
      // Agrupar tipeo continuado en el mismo estado
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

  reset(newInitial: T): void {
    this.past = [];
    this.future = [];
    this.present = structuredClone(newInitial);
    this.lastActionTime = 0;
  }
}

export type RecipeSortColumn =
  | 'label'
  | 'id'
  | 'craftingTime'
  | 'category'
  | 'profession'
  | 'successRate'
  | 'ingredientsCount';

export type RecipeSortDirection = 'asc' | 'desc';

/**
 * Filtra y ordena las recetas del catálogo en tiempo real.
 */
export function filterAndSortRecipes(
  recipes: RecipeCatalogItem[],
  options: {
    query?: string;
    profession?: string;
    station?: string;
    category?: string;
    folder?: string;
    status?: 'all' | 'active' | 'inactive';
    sortBy?: RecipeSortColumn;
    sortDirection?: RecipeSortDirection;
    references?: RecipeReferences;
  }
): RecipeCatalogItem[] {
  const {
    query = '',
    profession = 'all',
    station = 'all',
    category = 'all',
    folder = 'all',
    status = 'all',
    sortBy = 'label',
    sortDirection = 'asc',
    references,
  } = options;

  const q = query.trim().toLowerCase();
  const itemMap = references?.items ? new Map(references.items.map(i => [i.id, i.label.toLowerCase()])) : null;

  const filtered = recipes.filter(r => {
    // Estado
    if (status === 'active' && !r.active) return false;
    if (status === 'inactive' && r.active) return false;

    // Profesión
    if (profession !== 'all') {
      const p = r.requirements?.requiredProfession || 'none';
      if (p !== profession) return false;
    }

    // Estación
    if (station !== 'all') {
      if (!r.stations.includes(station)) return false;
    }

    // Categoría
    if (category !== 'all') {
      if (r.category !== category) return false;
    }

    // Carpeta
    if (folder !== 'all') {
      if ((r.folder || 'Sin carpeta') !== folder) return false;
    }

    // Búsqueda textual
    if (q) {
      const matchLabel = r.label.toLowerCase().includes(q);
      const matchId = r.id.toLowerCase().includes(q);
      const matchDesc = r.description.toLowerCase().includes(q);
      const matchCategory = r.category.toLowerCase().includes(q);
      const matchFolder = (r.folder || '').toLowerCase().includes(q);
      const matchTags = r.tags.some(t => t.toLowerCase().includes(q));
      const matchOutput = r.output.itemId.toLowerCase().includes(q) ||
        (itemMap?.get(r.output.itemId)?.includes(q) ?? false);
      const matchIngredients = r.ingredients.some(ing =>
        ing.itemId.toLowerCase().includes(q) || (itemMap?.get(ing.itemId)?.includes(q) ?? false)
      );

      if (!matchLabel && !matchId && !matchDesc && !matchCategory && !matchFolder && !matchTags && !matchOutput && !matchIngredients) {
        return false;
      }
    }

    return true;
  });

  // Ordenación
  const mult = sortDirection === 'asc' ? 1 : -1;
  return filtered.sort((a, b) => {
    switch (sortBy) {
      case 'id':
        return a.id.localeCompare(b.id) * mult;
      case 'category':
        return a.category.localeCompare(b.category) * mult;
      case 'craftingTime':
        return (a.craftingTime - b.craftingTime) * mult;
      case 'successRate':
        return (a.successRate - b.successRate) * mult;
      case 'ingredientsCount':
        return (a.ingredients.length - b.ingredients.length) * mult;
      case 'profession': {
        const profA = a.requirements?.requiredProfession || '';
        const profB = b.requirements?.requiredProfession || '';
        return profA.localeCompare(profB) * mult;
      }
      case 'label':
      default:
        return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }) * mult;
    }
  });
}

/**
 * Pagina una lista de recetas.
 */
export function paginateRecipes(
  recipes: RecipeCatalogItem[],
  page: number,
  pageSize = 15
): { items: RecipeCatalogItem[]; total: number; totalPages: number; currentPage: number } {
  const total = recipes.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  const items = recipes.slice(start, start + pageSize);

  return { items, total, totalPages, currentPage: safePage };
}

export interface AuditIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

/**
 * Audita una receta individual detectando:
 * - Referencias a objetos inexistentes en el catálogo.
 * - Estaciones inexistentes o faltantes.
 * - Ingredientes duplicados o cantidades inválidas.
 * - Recetas idénticas duplicadas en el proyecto.
 */
export function auditRecipe(
  recipe: RecipeCatalogItem,
  itemsCatalogMap: Map<string, any>,
  stationsMap: Map<string, CraftingStationDef>,
  allRecipes: RecipeCatalogItem[]
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // Comprobar ingredientes
  const seenIngs = new Set<string>();
  for (let i = 0; i < recipe.ingredients.length; i++) {
    const ing = recipe.ingredients[i];
    if (seenIngs.has(ing.itemId)) {
      issues.push({
        type: 'error',
        field: 'ingredients',
        message: `El ingrediente "${ing.itemId}" está duplicado en esta receta.`,
      });
    }
    seenIngs.add(ing.itemId);

    if (ing.count <= 0) {
      issues.push({
        type: 'error',
        field: 'ingredients',
        message: `La cantidad del ingrediente "${ing.itemId}" debe ser al menos 1.`,
      });
    }

    if (itemsCatalogMap.size > 0 && !itemsCatalogMap.has(ing.itemId)) {
      issues.push({
        type: 'warning',
        field: 'ingredients',
        message: `Ingrediente "${ing.itemId}": no se encuentra en el catálogo actual de objetos.`,
      });
    }
  }

  // Comprobar resultado principal
  if (recipe.output) {
    if (recipe.output.count <= 0) {
      issues.push({
        type: 'error',
        field: 'output',
        message: 'La cantidad resultante debe ser al menos 1.',
      });
    }
    if (itemsCatalogMap.size > 0 && !itemsCatalogMap.has(recipe.output.itemId)) {
      issues.push({
        type: 'warning',
        field: 'output',
        message: `Resultado "${recipe.output.itemId}": no se encuentra en el catálogo actual de objetos.`,
      });
    }
  } else {
    issues.push({
      type: 'error',
      field: 'output',
      message: 'La receta debe definir un objeto resultante.',
    });
  }

  // Comprobar estaciones
  if (!recipe.stations || recipe.stations.length === 0) {
    issues.push({
      type: 'info',
      field: 'stations',
      message: 'No se ha asociado ninguna estación de fabricación (se requerirá fabricación manual).',
    });
  } else {
    for (const stId of recipe.stations) {
      if (stationsMap.size > 0 && !stationsMap.has(stId)) {
        issues.push({
          type: 'warning',
          field: 'stations',
          message: `Estación "${stId}": no existe en las definiciones de estaciones del editor.`,
        });
      }
    }
  }

  // Comprobar tiempo de fabricación
  if (recipe.craftingTime < 0) {
    issues.push({
      type: 'error',
      field: 'craftingTime',
      message: 'El tiempo de fabricación no puede ser negativo.',
    });
  }

  // Detección de recetas duplicadas en el proyecto
  const currentKey = getRecipeSignature(recipe);
  const duplicates = allRecipes.filter(r => r.id !== recipe.id && getRecipeSignature(r) === currentKey);
  if (duplicates.length > 0) {
    issues.push({
      type: 'warning',
      field: 'general',
      message: `Posible receta duplicada: coincide en ingredientes, resultado y estación con "${duplicates[0].label}" (${duplicates[0].id}).`,
    });
  }

  return issues;
}

/**
 * Genera una firma canónica para comparar si dos recetas tienen idéntico resultado e ingredientes.
 */
export function getRecipeSignature(r: RecipeCatalogItem): string {
  const out = `${r.output.itemId}x${r.output.count}`;
  const ings = [...r.ingredients]
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map(i => `${i.itemId}:${i.count}`)
    .join('|');
  const stations = [...r.stations].sort().join(',');
  return `${out}<=(${ings})@[${stations}]`;
}

/**
 * Comprueba si una receta es requerida por otros sistemas antes de eliminarla:
 * - Si su output es ingrediente de otra receta.
 * - Si es requerida como requisito previo de otra receta (`requiredRecipeId`).
 * - Si misiones la requieren.
 */
export function checkRecipeDependencies(
  recipeId: string,
  outputItemId: string,
  allRecipes: RecipeCatalogItem[],
  quests?: { id: string; title: string }[]
): { canDelete: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // 1. Recetas que usan el output como ingrediente
  const dependentRecipes = allRecipes.filter(
    r => r.id !== recipeId && r.ingredients.some(ing => ing.itemId === outputItemId)
  );
  if (dependentRecipes.length > 0) {
    const names = dependentRecipes.slice(0, 3).map(r => `"${r.label}"`).join(', ');
    const extra = dependentRecipes.length > 3 ? ` y ${dependentRecipes.length - 3} más` : '';
    warnings.push(
      `El objeto producido ("${outputItemId}") se usa como ingrediente en otras recetas: ${names}${extra}.`
    );
  }

  // 2. Recetas que exigen esta receta como requisito previo
  const prerequisiteOf = allRecipes.filter(
    r => r.id !== recipeId && r.requirements?.requiredRecipeId === recipeId
  );
  if (prerequisiteOf.length > 0) {
    const names = prerequisiteOf.slice(0, 3).map(r => `"${r.label}"`).join(', ');
    warnings.push(`Esta receta es requisito de desbloqueo previo de: ${names}.`);
  }

  return {
    canDelete: warnings.length === 0,
    warnings,
  };
}

/**
 * Comprueba si una estación de fabricación está en uso por alguna receta.
 */
export function checkStationDependencies(
  stationId: string,
  allRecipes: RecipeCatalogItem[]
): { inUseCount: number; recipeNames: string[] } {
  const usingRecipes = allRecipes.filter(r => r.stations.includes(stationId));
  return {
    inUseCount: usingRecipes.length,
    recipeNames: usingRecipes.slice(0, 5).map(r => r.label),
  };
}

/**
 * Formatea segundos en texto legible en español.
 */
export function formatTimeHuman(seconds: number): string {
  if (seconds <= 0) return 'Instantáneo';
  if (seconds < 60) return `${seconds} s`;
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  if (mins < 60) {
    return remSecs > 0 ? `${mins} min ${remSecs} s` : `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours} h ${remMins} min` : `${hours} h`;
}

/**
 * Modificación masiva (Batch) sobre un conjunto de recetas seleccionadas.
 */
export function batchUpdateRecipes(
  recipes: RecipeCatalogItem[],
  selectedIds: Set<string>,
  updates: {
    active?: boolean;
    requiredProfession?: string;
    addStation?: string;
    removeStation?: string;
    category?: string;
    folder?: string;
  }
): RecipeCatalogItem[] {
  return recipes.map(r => {
    if (!selectedIds.has(r.id)) return r;

    const copy: RecipeCatalogItem = structuredClone(r);

    if (updates.active !== undefined) {
      copy.active = updates.active;
    }

    if (updates.requiredProfession !== undefined) {
      copy.requirements.requiredProfession = updates.requiredProfession === 'none' ? undefined : updates.requiredProfession;
    }

    if (updates.category !== undefined && updates.category !== '') {
      copy.category = updates.category;
    }

    if (updates.folder !== undefined) {
      copy.folder = updates.folder.trim() || undefined;
    }

    if (updates.addStation) {
      if (!copy.stations.includes(updates.addStation)) {
        copy.stations.push(updates.addStation);
      }
    }

    if (updates.removeStation) {
      copy.stations = copy.stations.filter(s => s !== updates.removeStation);
    }

    return copy;
  });
}

/**
 * Combina un catálogo existente con uno importado (modo 'merge' o 'replace').
 */
export function mergeCatalogs(
  existing: RecipeCatalog,
  incoming: RecipeCatalog,
  mode: 'merge' | 'replace'
): RecipeCatalog {
  if (mode === 'replace') {
    return structuredClone(incoming);
  }

  // Modo Merge (añadir / actualizar por ID)
  const stationsMap = new Map<string, CraftingStationDef>();
  for (const s of existing.stations) stationsMap.set(s.id, s);
  for (const s of incoming.stations) stationsMap.set(s.id, s); // Sobrescribe o añade

  const recipesMap = new Map<string, RecipeCatalogItem>();
  for (const r of existing.recipes) recipesMap.set(r.id, r);
  for (const r of incoming.recipes) recipesMap.set(r.id, r);

  const foldersSet = new Set<string>([...(existing.folders || []), ...(incoming.folders || [])]);

  return {
    version: 1,
    stations: Array.from(stationsMap.values()),
    recipes: Array.from(recipesMap.values()),
    folders: foldersSet.size > 0 ? Array.from(foldersSet) : undefined,
  };
}

/**
 * Análisis económico de una receta (coste de ingredientes, valor del producto y rentabilidad).
 */
export interface RecipeEconomics {
  ingredientCost: number;
  outputValue: number;
  netProfit: number;
  profitMarginPct: number;
  profitPerSecond: number;
  breakdown: {
    itemId: string;
    label: string;
    count: number;
    unitPrice: number;
    totalCost: number;
  }[];
}

export function calculateRecipeEconomics(
  recipe: RecipeCatalogItem,
  itemsMap: Map<string, any>
): RecipeEconomics {
  const breakdown: RecipeEconomics['breakdown'] = [];
  let ingredientCost = 0;

  for (const ing of recipe.ingredients) {
    const item = itemsMap.get(ing.itemId);
    const unitPrice = item?.value ?? 0;
    const totalCost = unitPrice * ing.count;
    ingredientCost += totalCost;
    breakdown.push({
      itemId: ing.itemId,
      label: item?.label || ing.itemId,
      count: ing.count,
      unitPrice,
      totalCost,
    });
  }

  const outItem = itemsMap.get(recipe.output.itemId);
  const outUnitPrice = outItem?.value ?? 0;
  const outputValue = outUnitPrice * recipe.output.count;
  const netProfit = outputValue - ingredientCost;
  const profitMarginPct = ingredientCost > 0 ? (netProfit / ingredientCost) * 100 : 0;
  const profitPerSecond = recipe.craftingTime > 0 ? netProfit / recipe.craftingTime : netProfit;

  return {
    ingredientCost,
    outputValue,
    netProfit,
    profitMarginPct,
    profitPerSecond,
    breakdown,
  };
}

/**
 * Nodo del árbol de producción de recetas (cadena de fabricación).
 */
export interface ProductionChainNode {
  itemId: string;
  label: string;
  count: number;
  isCraftable: boolean;
  recipe?: RecipeCatalogItem;
  subIngredients?: ProductionChainNode[];
  isCircular?: boolean;
}

export function resolveProductionChain(
  recipe: RecipeCatalogItem,
  allRecipes: RecipeCatalogItem[],
  itemsMap: Map<string, any>,
  visitedItemIds = new Set<string>()
): ProductionChainNode[] {
  const nodes: ProductionChainNode[] = [];

  for (const ing of recipe.ingredients) {
    const item = itemsMap.get(ing.itemId);
    const label = item?.label || ing.itemId;

    // Buscar si hay una receta activa que produzca este ingrediente
    const subRecipe = allRecipes.find(r => r.output.itemId === ing.itemId && r.id !== recipe.id);

    if (visitedItemIds.has(ing.itemId)) {
      nodes.push({
        itemId: ing.itemId,
        label,
        count: ing.count,
        isCraftable: !!subRecipe,
        isCircular: true,
      });
      continue;
    }

    if (subRecipe) {
      const nextVisited = new Set(visitedItemIds);
      nextVisited.add(ing.itemId);
      const subIngredients = resolveProductionChain(subRecipe, allRecipes, itemsMap, nextVisited);

      nodes.push({
        itemId: ing.itemId,
        label,
        count: ing.count,
        isCraftable: true,
        recipe: subRecipe,
        subIngredients,
      });
    } else {
      nodes.push({
        itemId: ing.itemId,
        label,
        count: ing.count,
        isCraftable: false,
      });
    }
  }

  return nodes;
}

/**
 * Simulación de tiradas de fabricación (probabilidad de éxito y lote de intentos).
 */
export interface CraftingSimulationResult {
  attempts: number;
  successes: number;
  failures: number;
  successRateActual: number;
  totalOutputs: number;
  totalTimeSeconds: number;
  materialsSpent: { itemId: string; count: number }[];
}

export function simulateCrafting(
  recipe: RecipeCatalogItem,
  attempts = 10,
  randomFn = Math.random
): CraftingSimulationResult {
  const safeAttempts = Math.max(1, Math.min(1000, attempts));
  let successes = 0;
  let failures = 0;
  let totalOutputs = 0;

  const successThreshold = (recipe.successRate ?? 100) / 100;

  for (let i = 0; i < safeAttempts; i++) {
    const roll = randomFn();
    if (roll <= successThreshold) {
      successes++;
      // Roll for output chance if configured
      const chance = (recipe.output.chance ?? 100) / 100;
      if (randomFn() <= chance) {
        totalOutputs += recipe.output.count;
      }
    } else {
      failures++;
    }
  }

  const materialsSpent = recipe.ingredients.map(ing => ({
    itemId: ing.itemId,
    count: ing.count * safeAttempts,
  }));

  return {
    attempts: safeAttempts,
    successes,
    failures,
    successRateActual: (successes / safeAttempts) * 100,
    totalOutputs,
    totalTimeSeconds: recipe.craftingTime * safeAttempts,
    materialsSpent,
  };
}

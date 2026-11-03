import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

async function main() {
  console.log('[import-items] Iniciando importación de todos los objetos existentes del juego...');

  const server = await createServer({
    configFile: false,
    root,
    server: { port: 5188 },
  });
  await server.listen();

  try {
    const { ITEMS } = await server.ssrLoadModule('/src/data/items.ts');
    const { EQUIPPABLE } = await server.ssrLoadModule('/src/data/equipment.ts');
    const { validateItem, validateItemCatalog } = await server.ssrLoadModule('/src/data/itemsCatalog.ts');

    const catalogPath = resolve(root, 'src/data/itemsCatalog.json');
    let existingCatalog = { version: 1, items: [] };
    try {
      existingCatalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    } catch {
      // ignore
    }

    const existingMap = new Map();
    for (const item of existingCatalog.items || []) {
      existingMap.set(item.id, item);
    }

    function mapCategory(id, item, equip) {
      if (equip) {
        if (equip.slot === 'weapon') return 'weapon';
        if (['head', 'chest', 'hands', 'legs', 'offhand'].includes(equip.slot)) {
          if (equip.slot === 'offhand' && (id.includes('daga') || id.includes('libro') || id.includes('grimorio'))) return 'weapon';
          return 'armor';
        }
        if (['pendant', 'ring', 'trinket'].includes(equip.slot)) return 'clothing';
      }

      const cat = (item.category || '').toLowerCase();
      if (['espada', 'daga', 'bastón', 'baston', 'varita', 'libro', 'ballesta', 'arco'].some(k => cat.includes(k))) return 'weapon';
      if (['escudo', 'cabeza', 'pecho', 'manos', 'piernas', 'coraza', 'casco', 'grebas'].some(k => cat.includes(k))) return 'armor';
      if (['colgante', 'anillo', 'abalorio', 'ropa', 'túnica', 'tunica'].some(k => cat.includes(k))) return 'clothing';
      if (cat.includes('herramienta') || id.startsWith('herramienta_')) return 'tool';
      if (cat.includes('comida') || item.food || id.startsWith('comida_') || id.startsWith('plato_') || id.startsWith('merienda_') || id === 'pan_duro') return 'food';
      if (cat.includes('material') || id.startsWith('material_') || id.startsWith('fibra_') || id.startsWith('grano_') || id.startsWith('fruta_') || id.startsWith('hongo_') || id.startsWith('gema_')) return 'resource';
      if (cat.includes('componente') || cat.includes('receta') || id.startsWith('receta_') || id.startsWith('lingote_') || id.startsWith('cuero_') || id.startsWith('hilo_')) return 'crafting';
      if (cat.includes('mueble') || id.startsWith('mueble_')) return 'furniture';
      if (cat.includes('consumible') || cat.includes('pergamino') || cat.includes('restauración') || id.startsWith('pocion_') || id.startsWith('pergamino_')) return 'consumable';
      if (id.startsWith('llave_') || id === 'esencia_sombria' || id === 'polvo_de_hada') return 'special';
      return 'resource';
    }

    const finalItems = [];
    let keptCustom = 0;
    let importedGame = 0;
    let skipped = 0;

    for (const [id, raw] of Object.entries(ITEMS)) {
      if (existingMap.has(id)) {
        // Conservar personalización existente del taller
        finalItems.push(existingMap.get(id));
        existingMap.delete(id);
        keptCustom++;
        continue;
      }

      const equip = EQUIPPABLE[id];
      const category = mapCategory(id, raw, equip);

      const effects = [];
      if (raw.restore) {
        effects.push({
          type: raw.restore.kind === 'health' ? 'restore_health' : (raw.restore.kind === 'mana' ? 'restore_mana' : 'restore_stamina'),
          percent: raw.restore.percent || 10,
          description: `Restaura un ${raw.restore.percent || 10} % de ${raw.restore.kind === 'health' ? 'salud' : (raw.restore.kind === 'mana' ? 'maná' : 'estamina')}.`,
        });
      } else if (category === 'food') {
        effects.push({
          type: 'buff_food',
          stat: 'Vida máxima',
          amount: 5,
          durationSeconds: 900,
          description: '+5 de vida máxima durante 15 minutos.',
        });
      }

      // Icono seguro
      let icon = raw.icon || '';
      if (!icon || icon.trim().length === 0) {
        icon = '<circle cx="12" cy="12" r="8" fill="#a0a89d" stroke="#526354" stroke-width="1.5"/>';
      }

      const cleanId = id.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
      if (!/^[a-z0-9_]{2,64}$/.test(cleanId)) {
        skipped++;
        continue;
      }

      const itemDef = {
        id: cleanId,
        label: raw.label || cleanId,
        description: raw.description || `${raw.label || cleanId} procedente de las tierras de Brumaluz.`,
        category,
        subcategory: raw.category || undefined,
        rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'artifact'].includes(raw.rarity) ? raw.rarity : 'common',
        icon,
        active: true,
        tags: [category, raw.category, cleanId.split('_')[0]].filter(Boolean),
        value: typeof raw.value === 'number' && !isNaN(raw.value) ? Math.max(0, raw.value) : 10,
        sellPrice: typeof raw.value === 'number' && !isNaN(raw.value) ? Math.floor(raw.value / 2) : 5,
        stack: typeof raw.stack === 'number' && raw.stack >= 1 ? raw.stack : (equip ? 1 : 50),
        bound: Boolean(raw.bound),
        sellable: raw.sellable !== false,
        tradable: !raw.bound,
        storable: true,
        droppable: !raw.bound,
        equippable: Boolean(equip),
        slot: equip?.slot,
        requiredClass: equip?.cls || 'any',
        minLevel: equip?.tier ? equip.tier * 5 : 1,
        stats: Array.isArray(raw.stats) ? raw.stats.map(s => ({ label: String(s.label), value: String(s.value) })) : [],
        usable: Boolean(raw.usable || raw.restore || raw.food),
        effects,
      };

      try {
        const validated = validateItem(itemDef);
        finalItems.push(validated);
        importedGame++;
      } catch (err) {
        console.warn(`[import-items] Advertencia al validar ${id}: ${err.message}`);
        skipped++;
      }
    }

    // Agregar los ítems existentes que no estuvieran en ITEMS original (nuevos del editor)
    for (const [id, item] of existingMap.entries()) {
      finalItems.push(item);
      keptCustom++;
    }

    console.log(`[import-items] Total final de objetos: ${finalItems.length} (${importedGame} importados del juego, ${keptCustom} existentes del editor, ${skipped} omitidos).`);

    const finalCatalog = {
      version: 1,
      items: finalItems,
    };

    validateItemCatalog(finalCatalog, { quests: [], vendors: [], recipes: [], coreItemIds: [] });

    await writeFile(catalogPath, JSON.stringify(finalCatalog, null, 2), 'utf8');
    console.log(`[import-items] Guardado exitosamente en ${catalogPath}`);
  } finally {
    await server.close();
  }
}

main().catch(err => {
  console.error('[import-items] Error fatal:', err);
  process.exit(1);
});


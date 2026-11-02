import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  const catalogPath = resolve('src/data/itemsCatalog.json');
  const sqlPath = resolve('supabase/server/30-custom-items.sql');

  const content = await readFile(catalogPath, 'utf8');
  const catalog = JSON.parse(content);

  const lines = [
    '-- Generado automáticamente por tools/sync-items-server.mjs',
    '-- Define los objetos creados o modificados desde el Editor de Objetos de Brumaluz',
    '',
    'create or replace function public.game_custom_item(p_item text)',
    'returns jsonb language sql immutable set search_path = \'\' as $$',
    '  select case p_item',
  ];

  for (const item of catalog.items) {
    if (item.active === false) continue;
    const serverProps = {
      value: item.value ?? 0,
      stack: item.stack ?? 50,
      bound: Boolean(item.bound),
      sellable: item.sellable !== false,
      storable: item.storable !== false,
      tradable: item.tradable !== false,
    };
    if (item.equippable && item.slot) {
      serverProps.slot = item.slot;
      if (item.requiredClass && item.requiredClass !== 'any') {
        serverProps.cls = item.requiredClass;
      }
    }
    if (item.food) {
      serverProps.food_seconds = item.food.duration ?? 900;
      serverProps.food_health = item.food.maxHealth ?? 0;
      serverProps.food_resource = item.food.maxResource ?? 0;
    }
    const healEffect = item.effects?.find(e => e.type === 'restore_health');
    if (healEffect) {
      if (healEffect.percent) serverProps.heal_pct = healEffect.percent;
      if (healEffect.value) serverProps.heal_amount = healEffect.value;
    }
    const manaEffect = item.effects?.find(e => e.type === 'restore_mana');
    if (manaEffect) {
      serverProps.resource_pct = manaEffect.percent ?? 5;
      serverProps.resource_kind = 'mana';
    }
    const staminaEffect = item.effects?.find(e => e.type === 'restore_stamina');
    if (staminaEffect) {
      serverProps.resource_pct = staminaEffect.percent ?? 5;
      serverProps.resource_kind = 'stamina';
    }

    lines.push(`    when '${item.id}' then '${JSON.stringify(serverProps)}'::jsonb`);
  }

  lines.push('    else null');
  lines.push('  end');
  lines.push('$$;');
  lines.push('');
  lines.push('-- Extender game_item para consultar tanto items nativos como custom');
  lines.push('create or replace function public.game_item_extended(p_item text)');
  lines.push('returns jsonb language sql immutable set search_path = \'\' as $$');
  lines.push('  select coalesce(public.game_custom_item(p_item), public.game_item(p_item));');
  lines.push('$$;');
  lines.push('');

  await writeFile(sqlPath, lines.join('\n'), 'utf8');
  console.log(`[sync-items-server] Sincronizado ${catalog.items.length} objetos en ${sqlPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

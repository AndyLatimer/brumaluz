// Pruebas del servidor con base de datos (dentro de la transacción de scripts/test-world-db.mjs): Pociones, sobrecuración, acciones de depuración y permisos.
import assert from 'node:assert/strict';

export async function itemsPermissions(t, { client, a, b, ca, cb, sa, user, rpc, rejected }) {
    await t.test('resource potions trade, restore the correct resource and reject without consuming', async () => {
      await client.query('savepoint resource_potions');
      try {
        for (const [cls, item, wrong, maximum] of [
          ['mago', 'pocion_mana_minuscula', 'pocion_estamina_minuscula', 65],
          ['guerrero', 'pocion_estamina_minuscula', 'pocion_mana_minuscula', 80],
        ]) {
          await client.query('reset role');
          await client.query('update public.characters set data=$1 where id=$2', [{
            name: 'Alric', race: 'humano', cls, level: 1, health: -1, resource: 10,
            wallet: { pelines: 100 }, inventory: [], attributePoints: { fuerza: 2 },
          }, ca]);
          await user(a);
          let result = await rpc('vendor_buy', [ca, 'testiculos', item]);
          assert.equal(result.wallet.pelines, 90);
          result = await rpc('use_item', [ca, 0]);
          assert.equal(result.resource, 10 + Math.ceil(maximum * 0.05));
          assert.equal(result.health, -1);
          assert.equal(result.inventory[0], null);
          await rpc('vendor_buy', [ca, 'testiculos', wrong]);
          await rejected(() => rpc('use_item', [ca, 0]), /WRONG_RESOURCE/);
          result = await rpc('vendor_sell', [ca, 'testiculos', 0]);
          assert.equal(result.wallet.pelines, 85);
          await rpc('vendor_buy', [ca, 'testiculos', item]);
          await client.query('reset role');
          await client.query("update public.characters set data=data || '{\"resource\":-1}'::jsonb where id=$1", [ca]);
          await user(a);
          await rejected(() => rpc('use_item', [ca, 0]), /RESOURCE_FULL/);
          result = (await client.query('select data from public.characters where id=$1', [ca])).rows[0].data;
          assert.equal(result.inventory[0].count, 1);
          await client.query('reset role');
          await client.query("update public.characters set data=data || jsonb_build_object('resource',$1::int) where id=$2", [maximum - 1, ca]);
          await user(a);
          result = await rpc('use_item', [ca, 0]);
          assert.equal(result.resource, -1);
        }
      } finally {
        await client.query('rollback to savepoint resource_potions');
        await client.query('release savepoint resource_potions');
      }
    });
    await t.test('overheal absorbs damage before health and preserves full-health encoding', async () => {
      await client.query('savepoint overheal_damage');
      try {
        await client.query("update public.server_config set value='true' where key='debug_actions'");
        for (const [health, overheal, expectedHealth, expectedOverheal] of [
          [-1, 20, -1, 10],
          [-1, 10, -1, 0],
          [-1, 4, 94, 0],
          [5, 0, 0, 0],
        ]) {
          await client.query('reset role');
          await client.query("update public.characters set data=data || jsonb_build_object('health',$1::int,'overheal',$2::int,'overheal_at',extract(epoch from now())) where id=$3", [health, overheal, ca]);
          await user(a);
          const result = await rpc('debug_damage', [ca]);
          assert.equal(result.health, expectedHealth);
          assert.equal(result.overheal, expectedOverheal);
          const saved = await client.query('select data from public.characters where id=$1', [ca]);
          assert.equal(saved.rows[0].data.health, expectedHealth);
          assert.equal(saved.rows[0].data.overheal, expectedOverheal);
        }
      } finally {
        await client.query('rollback to savepoint overheal_damage');
        await client.query('release savepoint overheal_damage');
      }
    });
    await t.test('disabled debug actions allow only the administrator and preserve character ownership', async () => {
      await client.query('savepoint debug_access');
      try {
        await client.query("update public.server_config set value='false' where key='debug_actions'");
        const actions = ['debug_damage', 'debug_heal', 'debug_xp', 'debug_money'];
        await user(a);
        for (const action of actions) await rejected(() => rpc(action, [ca]), /ACTION_DISABLED/);
        await client.query('reset role');
        await client.query("update auth.users set email='ManuelPerezArdanuy@gmail.com' where id=$1", [a]);
        await user(a);
        for (const action of actions) assert.ok(await rpc(action, [ca]));
        for (const action of actions) await rejected(() => rpc(action, [cb]), /CHARACTER_NOT_FOUND/);
        await user(b);
        for (const action of actions) await rejected(() => rpc(action, [cb]), /ACTION_DISABLED/);
        await client.query('reset role');
        await client.query("update public.server_config set value='true' where key='debug_actions'");
        await user(b);
        for (const action of actions) assert.ok(await rpc(action, [cb]));
      } finally {
        await client.query('rollback to savepoint debug_access');
        await client.query('release savepoint debug_access');
      }
    });
    await t.test('ownership, authentication and internal table/function permissions', async () => {
      await user(a);
      await rejected(() => rpc('world_join', [cb, sa]), /CHARACTER_NOT_FOUND/);
      await rejected(() => client.query('select * from public.world_players'), /permission denied/);
      await rejected(() => rpc('game_world_snapshot', [b]), /permission denied/);
      await rejected(() => rpc('game_public_character', [{}]), /permission denied/);
      await rejected(() => rpc('game_public_vitals', [{}]), /permission denied/);
      await rejected(() => rpc('game_skill_rank', [{}]), /permission denied/);
      await rejected(() => rpc('game_skill_id', ['guerrero']), /permission denied/);
      await client.query('set local role anon');
      await rejected(() => rpc('world_join', [ca, sa]), /permission denied/);
      await rejected(() => rpc('upgrade_skill', [ca, 'heavy_strike', 1]), /permission denied/);
    });
}

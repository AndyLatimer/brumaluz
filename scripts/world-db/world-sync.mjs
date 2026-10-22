// Pruebas del servidor con base de datos (dentro de la transacción de scripts/test-world-db.mjs): Presencia en el mundo compartido: apariencia pública, movimiento y sesiones.
import assert from 'node:assert/strict';

export async function worldSync(t, { client, a, b, ca, cb, ca2, sa, sb, replacement, user, rpc, rejected, motion }) {
    await t.test('two players receive authoritative public appearance but no private progression', async () => {
      await user(a);
      assert.deepEqual((await rpc('world_join', [ca, sa])).players, []);
      await user(b);
      const joined = await rpc('world_join', [cb, sb]);
      assert.equal(joined.players.length, 1);
      assert.equal(joined.players[0].data.name, 'Alric');
      assert.equal(joined.players[0].data.skin, 2);
      const target = joined.players[0];
      assert.equal(typeof target.username, 'string');
      assert.deepEqual(target.vitals, { health: 100, maxHealth: 100, overheal: 0, resource: 80, maxResource: 80, resourceKind: 'stamina' });
      for (const key of ['wallet', 'inventory', 'attributePoints', 'health', 'skillRanks']) assert.equal(key in joined.players[0].data, false);
      await user(a);
      assert.equal((await rpc('world_sync', [ca, sa, motion(1)])).players[0].id, cb);
    });
    await t.test('target vitals use authoritative allocated attributes, resource caps and current health', async () => {
      await client.query('reset role');
      await client.query("update public.characters set data=data || $1::jsonb where id=$2", [
        JSON.stringify({ cls: 'mago', level: 7, health: 41, resource: 23, attributePoints: { intelecto: 4, corpulencia: 3 } }), cb,
      ]);
      await user(a);
      const target = (await rpc('world_sync', [ca, sa, motion(1)])).players[0];
      assert.equal(target.data.level, 7);
      assert.deepEqual(target.vitals, { health: 41, maxHealth: 196, overheal: 0, resource: 23, maxResource: 129, resourceKind: 'mana' });
      assert.equal('attributePoints' in target.data, false);
      await client.query('reset role');
      await client.query("update public.characters set data=data || $1::jsonb where id=$2", [
        JSON.stringify({ cls: 'guerrero', level: 1, health: -1, resource: -1, attributePoints: { fuerza: 2 } }), cb,
      ]);
      await user(a);
    });
    await t.test('movement bucket prevents sustained overspeed and accepts realistic latency', async () => {
      assert.equal((await rpc('world_sync', [ca, sa, motion(2)])).status, 'ok');
      const corrected = await rpc('world_sync', [ca, sa, motion(100)]);
      assert.equal(corrected.status, 'corrected');
      assert.equal(corrected.position.x, 2);
      assert.equal((await rpc('world_sync', [ca, sa, motion(4)])).status, 'corrected');
      await client.query('reset role');
      await client.query("update public.world_players set seen_at = now() - interval '1 second' where user_id=$1", [a]);
      await user(a);
      assert.equal((await rpc('world_sync', [ca, sa, motion(8.2)])).status, 'ok');
    });
    await t.test('jump and low-platform heights are accepted up to the exact supported limit', async () => {
      for (const jump of [0.71, 1.15, 2.4]) {
        assert.equal((await rpc('world_sync', [ca, sa, motion(8.2, { jump })])).status, 'ok');
        await client.query('reset role');
        const stored = (await client.query('select jump from public.world_players where user_id=$1', [a])).rows[0].jump;
        assert.equal(stored, jump);
        await user(a);
      }
    });
    await t.test('invalid, missing, null and out-of-bounds state is explicitly rejected', async () => {
      for (const state of [null, {}, motion(401), motion(0, { wave: 1.5 }), motion(0, { jump: -0.01 }), motion(0, { jump: 2.41 }), motion(0, { facing: null }), motion(0, { yaw: 'NaN' })]) {
        await rejected(() => rpc('world_sync', [ca, sa, state]), /INVALID_WORLD_STATE/);
      }
    });
    await t.test('replacement invalidates old sync/leave and does not refill movement credit', async () => {
      await rpc('world_join', [ca, replacement]);
      await rejected(() => rpc('world_sync', [ca, sa, motion(8.2)]), /WORLD_SESSION_REPLACED/);
      await rpc('world_leave', [ca, sa]);
      assert.equal((await rpc('world_sync', [ca, replacement, motion(8.2)])).status, 'ok');
      await client.query('reset role');
      await client.query('update public.world_players set movement_credit=0 where user_id=$1', [a]);
      await user(a);
      await rpc('world_join', [ca, replacement]);
      assert.equal((await rpc('world_sync', [ca, replacement, motion(9)])).status, 'corrected');
    });
    await t.test('expiry hides crashed clients; active heartbeats restore visibility', async () => {
      await client.query('reset role');
      await client.query("update public.world_players set seen_at=now()-interval '16 seconds' where user_id=$1", [b]);
      await user(a);
      assert.equal((await rpc('world_sync', [ca, replacement, motion(8.2)])).players.length, 0);
      await user(b);
      await rpc('world_sync', [cb, sb, motion(0)]);
      await user(a);
      assert.equal((await rpc('world_sync', [ca, replacement, motion(8.2)])).players.length, 1);
    });
    await t.test('checkpoints, graceful leave, and character switching preserve last valid position', async () => {
      await client.query('reset role');
      await client.query("update public.world_players set saved_at=now()-interval '6 seconds' where user_id=$1", [a]);
      await user(a);
      await rpc('world_sync', [ca, replacement, motion(8.2)]);
      const saved = await client.query('select data from public.characters where id=$1', [ca]);
      assert.equal(saved.rows[0].data.position.x, 8.2);
      await rpc('world_join', [ca2, replacement]);
      await rejected(() => rpc('world_sync', [ca, replacement, motion(8.2)]), /WORLD_SESSION_REPLACED/);
      await rpc('world_leave', [ca2, replacement]);
      await user(b);
      assert.equal((await rpc('world_sync', [cb, sb, motion(0)])).players.length, 0);
    });
    await t.test('death and immediate respawn cannot reuse a corpse position', async () => {
      await user(a);
      await rpc('world_join', [ca, replacement]);
      await client.query('reset role');
      await client.query("update public.characters set data=jsonb_set(data,'{health}','0') where id=$1", [ca]);
      await user(b);
      assert.equal((await rpc('world_sync', [cb, sb, motion(0)])).players[0].dead, true);
      await user(a);
      await rpc('respawn_character', [ca]);
      const result = await rpc('world_sync', [ca, replacement, motion(8.2)]);
      assert.equal(result.status, 'corrected');
      assert.notEqual(result.position.x, 8.2);
      await rpc('world_leave', [ca, replacement]);
      const saved = await client.query('select data from public.characters where id=$1', [ca]);
      assert.deepEqual(saved.rows[0].data.position, result.position);
    });
    await t.test('JSON null positions fall back to spawn and can immediately sync and leave', async () => {
      await client.query('reset role');
      await client.query("update public.characters set data=jsonb_set(data,'{position}','null') where id=$1", [ca]);
      await user(a);
      const joined = await rpc('world_join', [ca, replacement]);
      assert.equal(typeof joined.position.x, 'number');
      assert.equal(typeof joined.position.z, 'number');
      assert.equal(joined.position.yaw, 0);
      const synced = await rpc('world_sync', [ca, replacement, { ...motion(joined.position.x), z: joined.position.z }]);
      assert.equal(synced.status, 'ok');
      await client.query('reset role');
      await client.query('update public.world_players set dead=true where user_id=$1', [a]);
      await user(a);
      const revived = await rpc('world_sync', [ca, replacement, { ...motion(joined.position.x), z: joined.position.z }]);
      assert.equal(revived.status, 'corrected');
      assert.deepEqual(revived.position, joined.position);
      await rpc('world_leave', [ca, replacement]);
    });
    await t.test('legacy position saves reject non-finite camera angles without corrupting stored data', async () => {
      for (const yaw of ['NaN', 'Infinity', '-Infinity']) {
        const result = await rpc('save_character_position', [ca, 0, 0, yaw]);
        assert.equal(result.status, 'too_far');
      }
      const { rows } = await client.query('select data from public.characters where id=$1', [ca]);
      assert.equal(typeof rows[0].data.position.yaw, 'number');
    });
    await t.test('late leave after character deletion is harmless', async () => {
      await rpc('world_join', [ca2, replacement]);
      await client.query('delete from public.characters where id=$1', [ca2]);
      await rpc('world_leave', [ca2, replacement]);
    });
}

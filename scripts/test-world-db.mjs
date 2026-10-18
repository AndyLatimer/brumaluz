import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import pg from 'pg';

// La base configurada solo se usa con permiso explícito; todas las pruebas terminan en ROLLBACK.
if (process.argv.includes('--configured')) {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
const url = process.env.SUPABASE_TEST_DB_URL || (process.argv.includes('--configured') ? process.env.SUPABASE_DB_URL : null);

test('world RPCs validate multiplayer state without persisting test data', { timeout: 60000 }, async (t) => {
  assert.ok(url, 'Set SUPABASE_TEST_DB_URL, or explicitly authorize the configured database with --configured');
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout = '5s'; set local statement_timeout = '15s'");
    await client.query(readFileSync(new URL('../supabase/server.sql', import.meta.url), 'utf8'));
    const a = randomUUID(), b = randomUUID(), ca = randomUUID(), cb = randomUUID(), ca2 = randomUUID();
    const sa = randomUUID(), sb = randomUUID(), replacement = randomUUID();
    for (const id of [a, b]) {
      await client.query('insert into auth.users(id, raw_user_meta_data) values($1, $2)', [id, { username: `test_${id.replaceAll('-', '').slice(0, 12)}` }]);
    }
    for (const [id, user, name] of [[ca, a, 'Alric'], [cb, b, 'Elara'], [ca2, a, 'Borin']]) {
      await client.query('insert into public.characters(id,user_id,name,data) values($1,$2,$3,$4)', [
        id, user, name, { name, race: 'humano', cls: 'guerrero', health: -1, level: 1, title: 'none', skin: 2, hair: 3, wallet: { pelines: 999 }, inventory: ['private'], attributePoints: { fuerza: 2 }, position: { x: 0, z: 0, yaw: 0 } },
      ]);
    }
    async function user(id) {
      await client.query('reset role');
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
      await client.query('set local role authenticated');
    }
    async function rpc(fn, args) {
      const { rows } = await client.query(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args);
      return rows[0].result;
    }
    async function rejected(fn, expected) {
      await client.query('savepoint expected_error');
      try {
        await assert.rejects(fn, expected);
      } finally {
        await client.query('rollback to savepoint expected_error');
        await client.query('release savepoint expected_error');
      }
    }
    const motion = (x, extra = {}) => ({ x, z: 0, yaw: 0, facing: 1, jump: 0, wave: 0, ...extra });
    await t.test('ownership, authentication and internal table/function permissions', async () => {
      await user(a);
      await rejected(() => rpc('world_join', [cb, sa]), /CHARACTER_NOT_FOUND/);
      await rejected(() => client.query('select * from public.world_players'), /permission denied/);
      await rejected(() => rpc('game_world_snapshot', [b]), /permission denied/);
      await rejected(() => rpc('game_public_character', [{}]), /permission denied/);
      await client.query('set local role anon');
      await rejected(() => rpc('world_join', [ca, sa]), /permission denied/);
    });
    await t.test('two players receive authoritative public appearance but no private progression', async () => {
      await user(a);
      assert.deepEqual((await rpc('world_join', [ca, sa])).players, []);
      await user(b);
      const joined = await rpc('world_join', [cb, sb]);
      assert.equal(joined.players.length, 1);
      assert.equal(joined.players[0].data.name, 'Alric');
      assert.equal(joined.players[0].data.skin, 2);
      for (const key of ['wallet', 'inventory', 'attributePoints', 'health']) assert.equal(key in joined.players[0].data, false);
      await user(a);
      assert.equal((await rpc('world_sync', [ca, sa, motion(1)])).players[0].id, cb);
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
    await t.test('invalid, missing, null and out-of-bounds state is explicitly rejected', async () => {
      for (const state of [null, {}, motion(401), motion(0, { wave: 1.5 }), motion(0, { jump: 0.71 }), motion(0, { facing: null }), motion(0, { yaw: 'NaN' })]) {
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
  } finally {
    await client.query('rollback');
    await client.end();
  }
});

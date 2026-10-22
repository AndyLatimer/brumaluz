import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import pg from 'pg';
import { serverSql } from './server-sql.mjs';
import { mapsKits } from './world-db/maps-kits.mjs';
import { welcomeFood } from './world-db/welcome-food.mjs';
import { progression } from './world-db/progression.mjs';
import { storyCombat } from './world-db/story-combat.mjs';
import { itemsPermissions } from './world-db/items-permissions.mjs';
import { worldSync } from './world-db/world-sync.mjs';
import { social } from './world-db/social.mjs';

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

test('world RPCs validate multiplayer state without persisting test data', { timeout: 120000 }, async (t) => {
  assert.ok(url, 'Set SUPABASE_TEST_DB_URL, or explicitly authorize the configured database with --configured');
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout = '5s'; set local statement_timeout = '15s'");
    await client.query('select pg_advisory_xact_lock(731029,2)');
    await client.query(serverSql());
    const a = randomUUID(), b = randomUUID(), ca = randomUUID(), cb = randomUUID(), ca2 = randomUUID();
    const sa = randomUUID(), sb = randomUUID(), replacement = randomUUID();
    const location = `test_${randomUUID()}`;
    await client.query('insert into public.world_maps(id,name,spawn) values($1,$2,$3)', [location, 'Zona de pruebas', {x:0,z:0,yaw:0}]);
    for (const id of [a, b]) {
      await client.query('insert into auth.users(id, raw_user_meta_data) values($1, $2)', [id, { username: `test_${id.replaceAll('-', '').slice(0, 12)}` }]);
    }
    for (const [id, user, name] of [[ca, a, 'Alric'], [cb, b, 'Elara'], [ca2, a, 'Borin']]) {
      await client.query('insert into public.characters(id,user_id,name,data) values($1,$2,$3,$4)', [
        id, user, name, { name, location, race: 'humano', cls: 'guerrero', health: -1, level: 1, title: 'none', skin: 2, hair: 3, wallet: { pelines: 999 }, inventory: ['private'], attributePoints: { fuerza: 2 }, position: { x: 0, z: 0, yaw: 0 } },
      ]);
    }
    async function user(id) {
      await client.query('reset role');
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
      await client.query("select set_config('request.jwt.claims', jsonb_build_object('sub',id,'email',email)::text, true) from auth.users where id=$1", [id]);
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
    const context = { client, a, b, ca, cb, ca2, sa, sb, replacement, location, user, rpc, rejected, motion };
    await mapsKits(t, context);
    await welcomeFood(t, context);
    await progression(t, context);
    await storyCombat(t, context);
    await itemsPermissions(t, context);
    await worldSync(t, context);
    await social(t, context);
  } finally {
    await client.query('rollback');
    await client.end();
  }
});

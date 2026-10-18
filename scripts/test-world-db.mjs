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
    const location = `test_${randomUUID()}`;
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
    await t.test('friend requests require consent, expose presence only to accepted friends, and are account-wide', async () => {
      await client.query('reset role');
      const outsider = randomUUID();
      await client.query('insert into auth.users(id, raw_user_meta_data) values($1,$2)', [outsider, { username: `test_${outsider.replaceAll('-', '').slice(0, 12)}` }]);
      const { rows } = await client.query('select user_id,username from public.profiles where user_id=any($1::uuid[])', [[a,b]]);
      const aname = rows.find((row) => row.user_id === a).username;
      const bname = rows.find((row) => row.user_id === b).username;
      await user(a);
      await rejected(() => client.query('select * from public.friendships'), /permission denied/);
      await rejected(() => rpc('friend_request', [aname]), /FRIEND_SELF/);
      await rejected(() => rpc('friend_request', ['nonexistent_account_xyz']), /PLAYER_NOT_FOUND/);
      await rpc('friend_request', [` ${bname.toUpperCase()} `]);
      await rejected(() => rpc('friend_request', [bname]), /FRIEND_ALREADY_EXISTS/);
      await rejected(() => rpc('friend_update', [b, 'accept']), /INVALID_FRIEND_ACTION/);
      const pending = (await rpc('friends_list', []))[0];
      assert.equal(pending.status, 'outgoing');
      assert.equal(pending.online, false);
      assert.equal(pending.characterName, null);
      await user(outsider);
      assert.deepEqual(await rpc('friends_list', []), []);
      await rejected(() => rpc('friend_update', [a, 'accept']), /FRIEND_NOT_FOUND/);
      await rejected(() => rpc('friend_update', [a, 'invalid']), /INVALID_FRIEND_ACTION/);
      await rejected(() => rpc('friend_update', [null, 'accept']), /INVALID_FRIEND_ACTION/);
      await user(b);
      assert.equal((await rpc('friends_list', []))[0].status, 'incoming');
      await rejected(() => rpc('friend_request', [aname]), /FRIEND_ALREADY_EXISTS/);
      await rpc('friend_update', [a, 'accept']);
      await user(a);
      const friend = (await rpc('friends_list', []))[0];
      assert.equal(friend.status, 'friend');
      assert.equal(friend.online, true);
      assert.equal(friend.characterName, 'Elara');
      assert.equal(friend.location, location);
      assert.equal('email' in friend, false);
      await client.query('reset role');
      await client.query("update public.world_players set seen_at=now()-interval '16 seconds' where user_id=$1", [b]);
      await user(a);
      assert.equal((await rpc('friends_list', []))[0].online, false);
      await rpc('friend_update', [b, 'remove']);
      await user(b);
      assert.deepEqual(await rpc('friends_list', []), []);
      await rpc('friend_request', [aname]);
      await rpc('friend_update', [a, 'remove']);
      await user(a);
      assert.deepEqual(await rpc('friends_list', []), []);
      await rpc('friend_request', [bname]);
      await user(b);
      await rpc('friend_update', [a, 'remove']);
      await rejected(() => rpc('friend_update', [a, 'accept']), /FRIEND_NOT_FOUND/);
      await client.query('set local role anon');
      for (const [fn,args] of [['friends_list',[]],['friend_request',[aname]],['friend_update',[a,'accept']]]) {
        await rejected(() => rpc(fn,args), /permission denied/);
      }
      await client.query('reset role');
      await client.query('update public.profiles set username=null where user_id=$1',[outsider]);
      await user(outsider);
      await rejected(() => rpc('friend_request',[bname]), /FRIEND_USERNAME_REQUIRED/);
    });
    await t.test('friend requests cap the number of outstanding invitations', async () => {
      await client.query('reset role');
      const {rows: targets} = await client.query("insert into auth.users(id,raw_user_meta_data) select id,jsonb_build_object('username','cap_'||substr(replace(id::text,'-',''),1,12)) from (select gen_random_uuid() as id from generate_series(1,50)) fixtures returning id");
      await client.query("insert into public.friendships(user_low,user_high,requested_by) select least($1::uuid,id),greatest($1::uuid,id),$1 from unnest($2::uuid[]) as ids(id)",[a,targets.map(row=>row.id)]);
      const {rows:[profile]} = await client.query('select username from public.profiles where user_id=$1',[b]);
      await user(a);
      await rejected(() => rpc('friend_request',[profile.username]), /FRIEND_REQUEST_LIMIT/);
    });
    await t.test('queen title keeps the king configuration and is authorized server-side by email', async () => {
      await client.query('reset role');
      const { rows:[config] } = await client.query("select value from public.server_config where key='staff_titles'");
      assert.ok(config.value.reina_de_pompelin.includes('veronicaluxen17@gmail.com'));
      assert.ok(config.value.rey_de_pompelin.length > 0);
      const email = `test_${a}@example.test`;
      await client.query('update auth.users set email=$1 where id=$2', [email,a]);
      await client.query("update public.server_config set value=jsonb_set(value,'{reina_de_pompelin}', $1) where key='staff_titles'", [JSON.stringify([email])]);
      await user(a);
      assert.ok((await rpc('my_titles', [])).includes('reina_de_pompelin'));
      const data = await rpc('set_character_title', [ca,'reina_de_pompelin']);
      assert.equal(data.title,'reina_de_pompelin');
      await user(b);
      assert.equal((await rpc('my_titles', [])).includes('reina_de_pompelin'),false);
      await rejected(() => rpc('set_character_title', [cb,'reina_de_pompelin']), /INVALID_TITLE/);
    });
  } finally {
    await client.query('rollback');
    await client.end();
  }
});

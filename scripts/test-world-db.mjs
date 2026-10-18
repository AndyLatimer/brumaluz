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
    await client.query('select pg_advisory_xact_lock(731029,2)');
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
    await t.test('welcome is new-character opt-in, validates every transition and position, persists and rewards exactly once', async () => {
      await client.query('savepoint welcome_system');
      try {
        const appearance=Object.fromEntries(['sex','height','build','skin','face','hair','hairColor','beard','eyeShape','eyeColor',
          'brows','nose','mouth','detail','trait','primary','secondary','cape','clothA','clothB','hairAcc','hairAccColor','acc','makeup','makeupColor','accColor'].map(key=>[key,0]));
        const payload={...appearance,name:'Novato',race:'elfo',cls:'mago',attributePoints:{},welcome:{origin:2,stage:'completed'}};
        await client.query('reset role');
        await client.query("update public.server_config set value='false' where key='welcome_enabled'");
        await user(a);
        const before=await rpc('create_character',[payload]);
        assert.equal((await rpc('character_enter',[before])).welcome,undefined,'Client cannot opt in or forge completion');
        await client.query('reset role');
        await client.query("update public.server_config set value='true' where key in ('welcome_enabled','debug_actions')");
        await user(a);
        const id=await rpc('create_character',[{...payload,name:'Aprendiz'}]);
        let data=await rpc('character_enter',[id]);
        assert.deepEqual(data.welcome,{origin:null,stage:'available'});
        assert.equal((await rpc('character_enter',[before])).welcome,undefined,'Activating does not enroll earlier characters');
        await rejected(()=>rpc('welcome_action',[ca,'origin',0]),/WELCOME_UNAVAILABLE/);
        await rejected(()=>rpc('welcome_action',[id,'origin',0]),/WELCOME_NOT_PLAYING/);
        await rejected(()=>rpc('game_require_welcome_complete',[{}]),/permission denied/);
        await user(b);
        await rejected(()=>rpc('welcome_action',[id,'origin',0]),/CHARACTER_NOT_FOUND/);
        await user(a);
        const session=randomUUID();
        await rpc('world_join',[id,session]);
        async function at(x,z,extra={}){
          await client.query('reset role');
          await client.query('update public.world_players set position=$1,seen_at=now() where character_id=$2',[{x,z,yaw:0},id]);
          if(Object.keys(extra).length)await client.query('update public.characters set data=data||$1::jsonb where id=$2',[extra,id]);
          await user(a);
        }
        await at(60,60);
        await rejected(()=>rpc('welcome_action',[id,'origin',0]),/WELCOME_TOO_FAR/);
        await at(-6.4,-8.5);
        await rejected(()=>rpc('welcome_action',[id,'accept']),/WELCOME_INVALID_STATE/);
        await rejected(()=>rpc('welcome_action',[id,'origin',3]),/WELCOME_INVALID_STATE/);
        await rejected(()=>rpc('welcome_action',[id,'origin',null]),/WELCOME_INVALID_STATE/);
        data=await rpc('welcome_action',[id,'origin',1]);
        assert.deepEqual(data.welcome,{origin:1,stage:'available'});
        await rejected(()=>rpc('welcome_action',[id,'origin',2]),/WELCOME_INVALID_STATE/);
        await rejected(()=>rpc('welcome_action',[id,'abandon']),/WELCOME_INVALID_ACTION/);
        await rejected(()=>rpc('debug_xp',[id]),/WELCOME_REQUIRED/);
        await rpc('welcome_action',[id,'accept']);
        await rejected(()=>rpc('welcome_action',[id,'claim']),/WELCOME_INVALID_STATE/);
        await rejected(()=>rpc('welcome_action',[id,'collect']),/WELCOME_TOO_FAR/);
        await at(15.8,-5.7,{health:0});
        await rejected(()=>rpc('welcome_action',[id,'collect']),/WELCOME_DEAD/);
        await at(15.8,-5.7,{health:-1,inventory:Array.from({length:25},()=>({id:'pan_duro',count:50}))});
        data=await rpc('welcome_action',[id,'collect']);
        assert.deepEqual(data.welcome,{origin:1,stage:'found'});
        const inventory=data.inventory;
        await rpc('world_leave',[id,session]);
        data=await rpc('character_enter',[id]);
        assert.equal(data.welcome.stage,'found','Offline progress and immutable origin survive re-entry');
        await rejected(()=>rpc('welcome_action',[id,'claim']),/WELCOME_NOT_PLAYING/);
        await rpc('world_join',[id,randomUUID()]);
        data=await rpc('welcome_action',[id,'claim']);
        assert.equal(data.welcome.stage,'completed');
        assert.equal(data.experience,40);
        assert.equal(data.wallet.pelines,5);
        assert.deepEqual(data.inventory,inventory,'Quest items never consume inventory space, even with a full bag');
        await rejected(()=>rpc('welcome_action',[id,'claim']),/WELCOME_INVALID_STATE/);
        await rejected(()=>rpc('welcome_action',[id,'collect']),/WELCOME_INVALID_STATE/);
        const again=await rpc('character_enter',[id]);
        assert.equal(again.experience,40);
        assert.equal(again.wallet.pelines,5);
        await rpc('debug_xp',[id]);
        await client.query('reset role');
        await client.query("update public.server_config set value='false' where key='welcome_enabled'");
        await user(a);
        await rejected(()=>rpc('welcome_action',[id,'claim']),/ACTION_DISABLED/);
      } finally {
        await client.query('rollback to savepoint welcome_system');
        await client.query('reset role');
      }
    });
    await t.test('bread grants flat maxima without healing, renews, pauses offline and expires authoritatively', async () => {
      await client.query('savepoint food_buff');
      try {
        await client.query('reset role');
        await client.query('update public.characters set data=$1 where id=$2', [{
          name: 'Alric', race: 'humano', cls: 'guerrero', level: 1, health: -1, resource: -1,
          wallet: { pelines: 100 }, inventory: [], attributePoints: { fuerza: 2 }, location,
        }, ca]);
        await user(a);
        let result = await rpc('vendor_buy', [ca, 'testiculos', 'pan_duro']);
        assert.equal(result.wallet.pelines, 96);
        result = await rpc('use_item', [ca, 0]);
        assert.deepEqual(result.foodBuff, { itemId: 'pan_duro', remaining: 900 });
        assert.equal(result.health, 100, 'Eating at full health does not heal the extra capacity');
        assert.equal(result.resource, 80, 'Eating at full resource does not refill the extra capacity');
        assert.equal(result.inventory[0], null);
        assert.equal(result.foodRevision, 1);
        await rejected(() => rpc('use_item', [cb, 0]), /CHARACTER_NOT_FOUND/);
        await rejected(() => rpc('game_food_data', [ca, result]), /permission denied/);
        await client.query('reset role');
        let v = await rpc('game_public_vitals', [result]);
        assert.equal(v.maxHealth, 105);
        assert.equal(v.maxResource, 83);
        v = await rpc('game_public_vitals', [{ ...result, partyPeers: 3 }]);
        assert.equal(v.maxHealth, 109, 'Food is added after the party multiplier');
        assert.equal(v.maxResource, 86);
        // Without presence, old timestamps never spend food duration.
        await client.query("update public.characters set data=data || jsonb_build_object('food_at',extract(epoch from now())-86400) where id=$1", [ca]);
        await user(a);
        result = await rpc('character_enter', [ca]);
        assert.equal(result.foodBuff.remaining, 900);
        const joined = await rpc('world_join', [ca, sa]);
        assert.equal(joined.food.buff.remaining, 900);
        await client.query('reset role');
        await client.query("update public.characters set data=data || jsonb_build_object('food_at',extract(epoch from now())-30) where id=$1", [ca]);
        await user(a);
        let synced = await rpc('world_sync', [ca, sa, motion(0)]);
        assert.equal(synced.food.buff.remaining, 870);
        await rpc('vendor_buy', [ca, 'testiculos', 'pan_duro']);
        result = await rpc('use_item', [ca, 0]);
        assert.equal(result.foodBuff.remaining, 900, 'Eating another renews rather than stacks');
        assert.equal(result.foodRevision, 2);
        assert.equal(result.health, 100);
        await client.query('reset role');
        v = await rpc('game_public_vitals', [result]);
        assert.equal(v.maxHealth, 105);
        assert.equal(v.maxResource, 83);
        // Abrupt loss: only the last confirmed heartbeat counts, not the offline gap.
        await client.query("update public.characters set data=data || jsonb_build_object('food_at',extract(epoch from now())-600) where id=$1", [ca]);
        await client.query("update public.world_players set seen_at=now()-interval '590 seconds' where character_id=$1", [ca]);
        await user(a);
        synced = await rpc('world_sync', [ca, sa, motion(0)]);
        assert.equal(synced.food.buff.remaining, 890);
        synced = await rpc('world_sync', [ca, sa, motion(0)]);
        assert.equal(synced.food.buff.remaining, 890, 'Reconnect reanchors the timer without charging the gap twice');
        await rpc('world_leave', [ca, sa]);
        await client.query('reset role');
        await client.query("update public.characters set data=data || jsonb_build_object('food_at',extract(epoch from now())-3600) where id=$1", [ca]);
        await user(a);
        result = await rpc('character_enter', [ca]);
        assert.equal(result.foodBuff.remaining, 890, 'Graceful exit keeps the remaining duration across relog');
        const resumed = await rpc('world_join', [ca, replacement]);
        assert.equal(resumed.food.buff.remaining, 890);
        await rejected(() => rpc('world_sync', [ca, sa, motion(0)]), /WORLD_SESSION_REPLACED/);
        await rpc('world_leave', [ca, sa]);
        assert.equal((await rpc('world_sync', [ca, replacement, motion(0)])).food.buff.remaining, 890);
        await user(b);
        await rpc('character_enter', [cb]);
        const observer = await rpc('world_join', [cb, sb]);
        const target = observer.players.find(p => p.id === ca);
        assert.equal(target.vitals.maxHealth, 105);
        for (const key of ['foodBuff', 'foodRevision', 'food_at', 'inventory']) assert.equal(key in target.data, false);
        await client.query('reset role');
        await client.query("update public.characters set data=data || jsonb_build_object('food_at',extract(epoch from now())-891,'health',105,'resource',83) where id=$1", [ca]);
        await user(a);
        synced = await rpc('world_sync', [ca, replacement, motion(0)]);
        assert.equal(synced.food.buff, null);
        assert.equal(synced.food.revision, 2);
        await client.query('reset role');
        const expired = await rpc('game_food_data', [ca, (await client.query('select data from public.characters where id=$1', [ca])).rows[0].data]);
        v = await rpc('game_public_vitals', [expired]);
        assert.equal(v.maxHealth, 100); assert.equal(v.health, 100);
        assert.equal(v.maxResource, 80); assert.equal(v.resource, 80);
      } finally {
        await client.query('rollback to savepoint food_buff');
        await client.query('release savepoint food_buff');
      }
    });
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
      const target = joined.players[0];
      assert.equal(typeof target.username, 'string');
      assert.deepEqual(target.vitals, { health: 100, maxHealth: 100, overheal: 0, resource: 80, maxResource: 80, resourceKind: 'stamina' });
      for (const key of ['wallet', 'inventory', 'attributePoints', 'health']) assert.equal(key in joined.players[0].data, false);
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
      assert.equal(pending.characterClass, null);
      assert.equal(pending.characterLevel, null);
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
      assert.equal(friend.characterClass, 'guerrero');
      assert.equal(friend.characterLevel, 1);
      assert.equal(friend.location, location);
      assert.equal('email' in friend, false);
      await client.query('reset role');
      await client.query("update public.world_players set seen_at=now()-interval '16 seconds' where user_id=$1", [b]);
      await user(a);
      const offline = (await rpc('friends_list', []))[0];
      assert.equal(offline.online, false);
      assert.equal(offline.characterClass, null);
      assert.equal(offline.characterLevel, null);
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
    await t.test('parties enforce consent, leader permissions, four seats, private chat, bonuses and succession', async () => {
      await client.query('reset role');
      const fixtures=Array.from({length:5},(_,index)=>({user:randomUUID(),character:randomUUID(),session:randomUUID(),username:`party_${index}_${randomUUID().replaceAll('-','').slice(0,8)}`}));
      for(const [index,f] of fixtures.entries()){
        await client.query('reset role');
        await client.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[f.user,{username:f.username}]);
        await client.query('insert into public.characters(id,user_id,name,data) values($1,$2,$3,$4)',[f.character,f.user,`Party${index}`,{name:`Party${index}`,level:10,experience:0,race:'humano',cls:index===1?'mago':'guerrero',health:80,resource:40,location,position:{x:0,z:0,yaw:0}}]);
        await user(f.user);await rpc('world_join',[f.character,f.session]);
      }
      const [leader,second,third,fourth,outsider]=fixtures;
      await client.query('reset role');
      await client.query('update public.profiles set username=null where user_id=$1',[leader.user]);
      await user(leader.user);
      await rejected(()=>rpc('party_invite',[second.username]),/PARTY_USERNAME_REQUIRED/);
      await client.query('reset role');
      await client.query('update public.profiles set username=$1 where user_id=$2',[leader.username,leader.user]);
      await user(leader.user);
      await rejected(()=>client.query('select * from public.party_members'),/permission denied/);
      await rejected(()=>client.query('select * from public.party_responses'),/permission denied/);
      await rejected(()=>rpc('game_party_cleanup',[]),/permission denied/);
      await rejected(()=>rpc('party_invite',[leader.username]),/PARTY_SELF/);
      await rpc('party_invite',[second.username]);
      const initial=await rpc('party_state',[]);
      assert.equal(initial.members.length,1);
      assert.equal(initial.members[0].vitals.maxHealth,208);
      await user(second.user);
      let invitation=(await rpc('party_state',[])).incoming[0];
      await user(outsider.user);
      await rejected(()=>rpc('party_respond',[invitation.id,true]),/PARTY_INVITE_INVALID/);
      await rejected(()=>rpc('chat_send',[outsider.character,'not a member','party',null]),/PARTY_NOT_JOINED/);
      await user(second.user);
      await rpc('party_respond',[invitation.id,false]);
      assert.equal((await rpc('party_state',[])).id,null);
      assert.deepEqual((await rpc('party_state',[])).responses,[],'Responses are private to the leader');
      await user(leader.user);
      const declined=await rpc('party_state',[]);
      assert.equal(declined.id,null,'Rejecting the last invitation removes the solo placeholder group');
      assert.deepEqual(declined.members,[]);
      assert.equal(declined.responses.length,1);
      assert.equal(declined.responses[0].username,second.username);
      assert.equal(declined.responses[0].accepted,false);
      assert.deepEqual((await rpc('party_state',[])).responses,[],'A response is delivered only once');
      await rpc('party_invite',[second.username]);
      await rpc('party_invite',[third.username]);
      await user(second.user);
      await rpc('party_respond',[(await rpc('party_state',[])).incoming[0].id,false]);
      await user(leader.user);
      const pending=await rpc('party_state',[]);
      assert.equal(pending.members.length,1,'A solo placeholder remains while another invitation is pending');
      assert.equal(pending.outgoing[0].username,third.username);
      await user(third.user);
      await rpc('party_respond',[(await rpc('party_state',[])).incoming[0].id,false]);
      await user(leader.user);
      assert.equal((await rpc('party_state',[])).id,null,'Rejecting the remaining invitation clears the placeholder');
      await user(leader.user);await rpc('party_invite',[second.username]);
      await user(second.user);invitation=(await rpc('party_state',[])).incoming[0];
      await client.query('reset role');
      await client.query("update public.party_invites set expires_at=now()-interval '1 second' where id=$1",[invitation.id]);
      await user(second.user);
      assert.equal((await rpc('party_state',[])).incoming.length,0);
      await rejected(()=>rpc('party_respond',[invitation.id,true]),/PARTY_INVITE_INVALID/);
      await user(leader.user);await rpc('party_invite',[second.username]);
      await user(second.user);invitation=(await rpc('party_state',[])).incoming[0];
      await rpc('party_respond',[invitation.id,true]);
      await user(leader.user);
      const joined=await rpc('party_state',[]);
      assert.equal(joined.responses.length,1);
      assert.equal(joined.responses[0].username,second.username);
      assert.equal(joined.responses[0].accepted,true);
      await user(second.user);
      const pair=await rpc('party_state',[]);
      assert.equal(pair.members.length,2);
      assert.equal(pair.members[0].vitals.maxHealth,211);
      assert.equal(pair.members[1].vitals.maxResource,120); // floor((30+54+35)*1.015)
      await rpc('world_join',[second.character,randomUUID()]);
      await rpc('world_leave',[second.character,second.session]);
      assert.equal((await rpc('party_state',[])).members.length,2,'A replaced session cannot remove current party membership');
      await rejected(()=>rpc('party_invite',[third.username]),/PARTY_LEADER_ONLY/);
      const message=await rpc('chat_send',[second.character,'private party message','party',null]);
      assert.equal(message.party_id,pair.id);
      await user(leader.user);
      assert.equal((await client.query('select id from public.chat_messages where id=$1',[message.id])).rowCount,1);
      await user(outsider.user);
      assert.equal((await client.query('select id from public.chat_messages where id=$1',[message.id])).rowCount,0);
      await user(leader.user);
      for(const f of [third,fourth,outsider])await rpc('party_invite',[f.username]);
      await user(outsider.user);
      await rpc('party_respond',[(await rpc('party_state',[])).incoming[0].id,false]);
      await user(leader.user);
      const stillTogether=await rpc('party_state',[]);
      assert.equal(stillTogether.members.length,2,'A rejection does not dissolve an established group');
      assert.equal(stillTogether.outgoing.length,2,'Other invitations remain pending');
      await rpc('party_invite',[outsider.username]);
      for(const f of [third,fourth]){
        await user(f.user);const i=(await rpc('party_state',[])).incoming[0];await rpc('party_respond',[i.id,true]);
      }
      await user(outsider.user);
      const fullInvite=(await rpc('party_state',[])).incoming[0];
      await rejected(()=>rpc('party_respond',[fullInvite.id,true]),/PARTY_FULL/);
      await user(third.user);
      assert.equal((await client.query('select id from public.chat_messages where id=$1',[message.id])).rowCount,0,'New member cannot read old party messages');
      const full=await rpc('party_state',[]);
      assert.equal(full.members.length,4);
      assert.equal(full.members[0].vitals.maxHealth,217);
      await client.query('reset role');
      await client.query("update public.server_config set value='true' where key='debug_actions'");
      await user(leader.user);
      const gained=await rpc('debug_xp',[leader.character]);
      assert.equal(gained.experience,204,'XP is fixed at +2%, not multiplied by number of peers');
      assert.equal(gained.partyPeers,3);
      const stored=await client.query('select data from public.characters where id=$1',[leader.character]);
      assert.equal('partyPeers' in stored.rows[0].data,false,'Party bonus must never persist');
      await rpc('party_leave',[]);
      await rejected(()=>rpc('chat_send',[leader.character,'left','party',null]),/PARTY_NOT_JOINED/);
      assert.equal((await client.query('select id from public.chat_messages where id=$1',[message.id])).rowCount,0);
      await user(second.user);
      const promoted=await rpc('party_state',[]);
      assert.equal(promoted.members[0].userId,second.user);
      assert.equal(promoted.members.length,3);
      await client.query('reset role');
      await client.query("update public.world_players set seen_at=now()-interval '16 seconds' where user_id=$1",[second.user]);
      await user(third.user);
      assert.equal((await rpc('party_state',[])).members[0].userId,third.user,'Expired leader transfers to oldest remaining member');
      await user(fourth.user);await rpc('world_leave',[fourth.character,fourth.session]);
      await user(third.user);
      const solo=await rpc('party_state',[]);
      assert.equal(solo.members.length,1);
      assert.equal(solo.members[0].vitals.maxHealth,208);
      assert.equal((await rpc('debug_xp',[third.character])).experience,200);
      await rpc('party_leave',[]);
      assert.equal((await rpc('party_state',[])).id,null);
      await rpc('party_invite',[leader.username]);
      await user(leader.user);
      await rpc('party_respond',[(await rpc('party_state',[])).incoming[0].id,true]);
      await client.query('reset role');
      const alternate= randomUUID();
      await client.query('insert into public.characters(id,user_id,name,data) values($1,$2,$3,$4)',[alternate,third.user,'Alternate',{name:'Alternate',level:1,race:'humano',cls:'guerrero',location}]);
      await user(third.user);await rpc('world_join',[alternate,randomUUID()]);
      assert.equal((await rpc('party_state',[])).id,null,'Changing character abandons the old character party');
      await user(leader.user);
      assert.equal((await rpc('party_state',[])).members[0].userId,leader.user);
      await client.query('set local role anon');
      await rejected(()=>rpc('party_state',[]),/permission denied/);
      await client.query('reset role');
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

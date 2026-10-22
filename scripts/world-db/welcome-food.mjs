// Pruebas del servidor con base de datos (dentro de la transacción de scripts/test-world-db.mjs): Bienvenida y comida.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function welcomeFood(t, { client, a, b, ca, cb, sa, sb, replacement, location, user, rpc, rejected, motion }) {
    await t.test('welcome is new-character opt-in, validates every transition and position, persists and rewards exactly once', async () => {
      await client.query('savepoint welcome_system');
      try {
        const appearance=Object.fromEntries(['sex','height','build','skin','face','hair','hairColor','beard','eyeShape','eyeColor',
          'brows','nose','mouth','detail','trait','primary','secondary','cape','clothA','clothB','hairAcc','hairAccColor','acc','makeup','makeupColor','accColor'].map(key=>[key,0]));
        const payload={...appearance,name:'Novato',race:'elfo',cls:'mago',attributePoints:{},welcome:{origin:2,stage:'completed'},isbertoPosition:{x:999,z:999}};
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
        assert.equal(data.isbertoPosition,undefined,'Creating a character cannot forge the Isberto introduction position');
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
        await at(177,0);
        data=await rpc('welcome_action',[id,'arrive']);
        assert.equal(data.introSeen,true);
        assert.deepEqual(data.position,{x:156.5,z:0,yaw:Math.PI/2});
        assert.equal((await rpc('welcome_action',[id,'arrive'])).introSeen,true,'Arrival is idempotent');
        await at(153.5,0);
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
        await at(138.6,-2.6,{health:0});
        await rejected(()=>rpc('welcome_action',[id,'collect']),/WELCOME_DEAD/);
        await at(138.6,-2.6,{health:-1,inventory:Array.from({length:25},()=>({id:'pan_duro',count:50}))});
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
        assert.deepEqual(data.isbertoPosition,{x:140.6,z:-2.6},'Isberto meets the player where the badge was returned');
        assert.deepEqual(data.inventory,inventory,'Quest items never consume inventory space, even with a full bag');
        await rejected(()=>rpc('welcome_action',[id,'claim']),/WELCOME_INVALID_STATE/);
        await rejected(()=>rpc('welcome_action',[id,'collect']),/WELCOME_INVALID_STATE/);
        const again=await rpc('character_enter',[id]);
        assert.equal(again.experience,40);
        assert.equal(again.wallet.pelines,5);
        assert.deepEqual(again.isbertoPosition,data.isbertoPosition,'The farmer stays at the saved meeting point after re-entry');
        await client.query('reset role');
        await client.query("update public.server_config set value='true' where key='combat_enabled'");
        await user(a);
        const introduction=await rpc('combat_start',[id]);
        assert.equal(introduction.quest,'active','The next quest can be accepted immediately without visiting the farm');
        assert.equal(introduction.encounter.z,-62.35,'The creature remains at the farm rather than spawning next to the introduction');
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
        await rejected(()=>rpc('game_food_data',[ca,result]),/permission denied/);
        await rejected(()=>rpc('game_regen_data',[ca,result]),/permission denied/);
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
}

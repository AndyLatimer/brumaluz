// Pruebas del servidor con base de datos (dentro de la transacción de scripts/test-world-db.mjs): Regeneración, migraciones, equipo y botín.
import assert from 'node:assert/strict';
import { serverSql } from '../server-sql.mjs';
import { weaponFor } from './helpers.mjs';

export async function progression(t, { client, a, b, ca, cb, ca2, sa, sb, location, user, rpc, rejected, motion }) {
    await t.test('world heartbeats grant server-side fractional regeneration only during presence', async () => {
      await client.query('savepoint online_regeneration');
      try {
        await client.query('reset role');
        await client.query('update public.characters set data=$1 where id=$2', [{
          name:'Alric',race:'humano',cls:'guerrero',level:1,health:50,resource:0,
          attributePoints:{fuerza:2},location,
        },ca]);
        await user(a);
        const joined=await rpc('world_join',[ca,sa]);
        assert.equal(joined.vitals.health,50);
        await client.query('reset role');
        await client.query("update public.world_players set saved_at=clock_timestamp()-interval '6 seconds' where character_id=$1",[ca]);
        const rewind=(await client.query("update public.characters set data=data || jsonb_build_object('vitals_at',extract(epoch from clock_timestamp())-2.3) where id=$1 returning data->>'vitals_at' stamp",[ca])).rows[0].stamp;
        await user(a);
        const synced=await rpc('world_sync',[ca,sa,motion(0)]);
        assert.ok(synced.vitals.health>=52&&synced.vitals.health<55);
        assert.ok(synced.vitals.resource>=7&&synced.vitals.resource<16);
        await client.query('reset role');
        const stored=(await client.query('select data from public.characters where id=$1',[ca])).rows[0].data;
        assert.ok(stored.health_regen>0&&stored.health_regen<1,'Fractional health is retained server-side');
        assert.ok(stored.resource_regen>0&&stored.resource_regen<1,'Fractional resource is retained server-side');
        assert.ok(Math.abs((stored.health-50+stored.health_regen)-(Number(stored.vitals_at)-Number(rewind)))<0.01,'Health regenerates at exactly 1% per second including DB latency');
        assert.ok(Math.abs(
          (stored.health-50+stored.health_regen)*3.2-(stored.resource+stored.resource_regen)
        )<0.0001,'Health and stamina retain fractions at their exact server-side rates');
        await user(a);
        await rpc('world_leave',[ca,sa]);
        await client.query('reset role');
        await client.query("update public.characters set data=data || jsonb_build_object('health',50,'resource',0,'vitals_at',extract(epoch from clock_timestamp())-100) where id=$1",[ca]);
        await user(a);
        const offline=await rpc('character_enter',[ca]);
        assert.equal(offline.health,50,'Time without a live presence lease grants no health');
        assert.equal(offline.resource,0,'Time without a live presence lease grants no resource');
      } finally {
        await client.query('rollback to savepoint online_regeneration');
        await client.query('release savepoint online_regeneration');
      }
    });
    await t.test('reapplying SQL migrates legacy corpses once without refilling looted bodies or changing feature flags', async () => {
      await client.query('savepoint corpse_migration');
      try {
        await client.query('reset role');
        const body={id:'shadowling',status:'defeated',health:0,maxHealth:100,x:3.5,z:-62.35,enemyAttackAt:0};
        await client.query('update public.characters set data=$1 where id=$2',[{combatEncounter:body},ca]);
        await client.query('update public.characters set data=$1 where id=$2',[{
          shadowQuest:'completed',combatEncounter:{...body,instanceId:'already-looted',loot:[null],looted:true},
        },cb]);
        await client.query('update public.characters set data=$1 where id=$2',[{combatEncounter:{...body,status:'active',health:100}},ca2]);
        const flags=await client.query("select key,value from public.server_config where key in ('welcome_enabled','combat_enabled','debug_actions') order by key");
        const sql=serverSql();
        await client.query(sql);
        const {rows:[migrated]}=await client.query('select data from public.characters where id=$1',[ca]);
        assert.equal(migrated.data.shadowQuest,'defeated');
        assert.equal(typeof migrated.data.combatEncounter.instanceId,'string');
        assert.deepEqual(migrated.data.combatEncounter.loot,[{id:'esencia_sombria',count:1,bound:true}]);
        await client.query(sql);
        const {rows:[again]}=await client.query('select data from public.characters where id=$1',[ca]);
        assert.deepEqual(again.data,migrated.data,'A second application does not generate another body or reward');
        const {rows:[looted]}=await client.query('select data from public.characters where id=$1',[cb]);
        assert.deepEqual(looted.data.combatEncounter.loot,[null]);
        assert.equal(looted.data.shadowQuest,'defeated','Old looted quests unlock the closing scene without refilling the corpse');
        const {rows:[active]}=await client.query('select data from public.characters where id=$1',[ca2]);
        assert.equal(active.data.shadowQuest,'active');
        assert.deepEqual((await client.query("select key,value from public.server_config where key in ('welcome_enabled','combat_enabled','debug_actions') order by key")).rows,flags.rows);
      } finally {
        await client.query('rollback to savepoint corpse_migration');
        await client.query('release savepoint corpse_migration');
      }
    });
    await t.test('equipment transfers preserve bound items, reject stale requests and invalidate accepted trade offers', async () => {
      await client.query('savepoint equipment_transfers');
      try {
        await client.query('reset role');
        const sword={id:'espada_inicial',count:1,bound:true};
        await client.query('update public.characters set data=$1 where id=$2',[{
          name:'Alric',race:'humano',cls:'guerrero',health:-1,level:1,
          equipment:{weapon:sword},inventory:[],
        },ca]);
        await client.query("insert into public.player_trades(a,b,sa,sb,status,accepted_a,accepted_b) values($1,$2,$3,$4,'open',true,true)",[ca,cb,sa,sb]);
        await user(b);
        await rejected(()=>rpc('change_equipment',[ca,'weapon',null,sword]),/CHARACTER_NOT_FOUND/);
        await user(a);
        const removed=await rpc('change_equipment',[ca,'weapon',null,sword]);
        assert.equal(removed.equipment.weapon,null);
        assert.deepEqual(removed.inventory[0],sword);
        await rejected(()=>rpc('change_equipment',[ca,'weapon',null,sword]),/EQUIPMENT_CHANGED/);
        await rejected(()=>rpc('change_equipment',[ca,'weapon',0,{...sword,bound:false}]),/EQUIPMENT_CHANGED/);
        await rejected(()=>rpc('change_equipment',[ca,'head',0,sword]),/EQUIPMENT_INVALID/);
        const equipped=await rpc('change_equipment',[ca,'weapon',0,sword]);
        assert.deepEqual(equipped.equipment.weapon,sword);
        assert.equal(equipped.inventory[0],null);
        await client.query('reset role');
        const {rows:[trade]}=await client.query("select accepted_a,accepted_b,revision,offer_a from public.player_trades where a=$1 and status='open'",[ca]);
        assert.equal(trade.accepted_a,false);assert.equal(trade.accepted_b,false);assert.equal(trade.revision,2);
        assert.deepEqual(trade.offer_a,{items:[],pelines:0});
        await client.query("update public.characters set data=jsonb_set(data,'{inventory}',$1) where id=$2",[JSON.stringify(Array.from({length:25},()=>({id:'antorcha',count:1}))),ca]);
        await user(a);
        await rejected(()=>rpc('change_equipment',[ca,'weapon',null,sword]),/INVENTORY_FULL/);
        assert.deepEqual((await rpc('character_enter',[ca])).equipment.weapon,sword,'A full bag never destroys equipment');
        await client.query('reset role');
        await client.query("update public.characters set data=jsonb_set(data,'{inventory,0}',$1) where id=$2",[JSON.stringify({...sword,bound:false}),ca]);
        await user(a);
        const swapped=await rpc('change_equipment',[ca,'weapon',0,{...sword,bound:false}]);
        assert.deepEqual(swapped.inventory[0],sword,'Equipping swaps the previous piece back into the source bag slot');
        assert.equal(swapped.equipment.weapon.bound,false);
      } finally {
        await client.query('rollback to savepoint equipment_transfers');
        await client.query('release savepoint equipment_transfers');
      }
    });
    await t.test('defeated creatures persist loot, require proximity and grant the essence exactly once without full-bag losses', async () => {
      await client.query('savepoint corpse_loot');
      try {
        await client.query('reset role');
        await client.query("update public.server_config set value='true' where key='combat_enabled'");
        await client.query('update public.characters set data=$1 where id=$2',[{
          name:'Alric',race:'humano',cls:'guerrero',health:100,resource:80,level:1,
          location:'brumaluz',welcome:{origin:0,stage:'completed'},
          position:{x:2,z:-62.35,yaw:0},equipment:weaponFor('guerrero'),inventory:[],
        },ca]);
        await user(a);await rpc('world_join',[ca,sa]);
        const started=await rpc('combat_start',[ca]);
        assert.equal(started.quest,'active');
        await client.query('reset role');
        await client.query("update public.characters set data=jsonb_set(jsonb_set(data,'{equipment}','{}'),'{combatEncounter,health}','1') #- '{combatEncounter,instanceId}' where id=$1",[ca]);
        await user(a);
        await rejected(()=>rpc('combat_action',[ca,'attack']),/COMBAT_WEAPON_REQUIRED/);
        await rejected(()=>rpc('combat_action',[ca,'heavy_strike']),/COMBAT_WEAPON_REQUIRED/);
        await client.query('reset role');
        await client.query("update public.characters set data=jsonb_set(data,'{equipment}',$1) where id=$2",[JSON.stringify(weaponFor('guerrero')),ca]);
        await user(a);
        const defeated=await rpc('combat_action',[ca,'attack']);
        assert.equal(defeated.encounter.status,'defeated');
        assert.equal(defeated.quest,'defeated');
        const instance=defeated.encounter.instanceId;
        assert.equal(typeof instance,'string','Encounters started by an older client receive a loot identity at defeat');
        const essence={id:'esencia_sombria',count:1,bound:true};
        assert.deepEqual(defeated.encounter.loot,[essence]);
        await rejected(()=>rpc('combat_start',[ca]),/LOOT_PENDING/);
        await rejected(()=>rpc('loot_corpse',[ca,'stale-instance',0]),/LOOT_INVALID/);
        await user(b);
        await rejected(()=>rpc('loot_corpse',[ca,instance,0]),/CHARACTER_NOT_FOUND/);
        await client.query('reset role');
        await client.query("update public.world_players set position='{\"x\":0,\"z\":-62.35,\"yaw\":0}' where character_id=$1",[ca]);
        await user(a);
        await rejected(()=>rpc('loot_corpse',[ca,instance,0]),/LOOT_TOO_FAR/);
        await client.query('reset role');
        await client.query("update public.world_players set position='{\"x\":2,\"z\":-62.35,\"yaw\":0}' where character_id=$1",[ca]);
        await client.query("update public.characters set data=jsonb_set(data,'{inventory}',$1) where id=$2",[JSON.stringify(Array.from({length:25},()=>({id:'antorcha',count:1}))),ca]);
        await user(a);
        await rejected(()=>rpc('loot_corpse',[ca,instance,null]),/INVENTORY_FULL/);
        const reentered=await rpc('character_enter',[ca]);
        assert.deepEqual(reentered.combatEncounter.loot,[essence],'Failed looting and re-entry preserve the body');
        await client.query('reset role');
        await client.query("update public.characters set data=jsonb_set(data,'{inventory}','[]') where id=$1",[ca]);
        await user(a);await rpc('world_join',[ca,sa]);
        await rejected(()=>rpc('loot_corpse',[ca,instance,1]),/LOOT_INVALID/);
        const looted=await rpc('loot_corpse',[ca,instance,0]);
        assert.deepEqual(looted.inventory[0],essence);
        assert.equal(looted.combatEncounter.looted,true);
        assert.deepEqual(looted.combatEncounter.loot,[null]);
        assert.equal(looted.shadowQuest,'defeated','Loot alone does not finish the story');
        await rejected(()=>rpc('loot_corpse',[ca,instance,null]),/LOOT_EMPTY/);
        await rejected(()=>rpc('combat_start',[ca]),/SHADOW_ALREADY_DEFEATED/);
        const persisted=await rpc('character_enter',[ca]);
        assert.equal(persisted.inventory.filter(item=>item?.id==='esencia_sombria').length,1);
        assert.equal(persisted.combatEncounter.looted,true);
      } finally {
        await client.query('rollback to savepoint corpse_loot');
        await client.query('release savepoint corpse_loot');
      }
    });
}

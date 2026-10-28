// Pruebas del servidor con base de datos (dentro de la transacción de scripts/test-world-db.mjs): La historia de Isberto, el combate y las habilidades.
import assert from 'node:assert/strict';
import { serverSql } from '../server-sql.mjs';
import { weaponFor } from './helpers.mjs';

export async function storyCombat(t, { client, a, b, ca, sa, location, user, rpc, rejected, motion }) {
    await t.test('Isberto requires looting, invites the player home and completes inside his house', async () => {
      await client.query('savepoint shadow_epilogue');
      try {
        await client.query('reset role');
        const essence={id:'esencia_sombria',count:1,bound:true};
        const body={id:'shadowling',instanceId:'closing-scene',status:'defeated',health:0,maxHealth:100,x:3.5,z:-62.35,enemyAttackAt:0,loot:[essence],looted:false};
        await client.query('update public.characters set data=$1 where id=$2',[{
          name:'Alric',race:'humano',cls:'guerrero',health:100,level:1,location:'brumaluz',inventory:[],
          welcome:{origin:0,stage:'completed'},shadowQuest:'defeated',position:{x:3.5,z:-62.35,yaw:0},combatEncounter:body,
        },ca]);
        await user(b);
        await rejected(()=>rpc('shadow_action',[ca,'report']),/CHARACTER_NOT_FOUND/);
        await user(a);
        await rejected(()=>rpc('shadow_action',[ca,'return']),/SHADOW_INVALID_STATE/);
        await rpc('world_join',[ca,sa]);
        await rejected(()=>rpc('shadow_action',[ca,'report']),/SHADOW_LOOT_REQUIRED/);
        const looted=await rpc('loot_corpse',[ca,body.instanceId,null]);
        assert.deepEqual(looted.inventory[0],essence);
        await client.query('reset role');
        await client.query('update public.world_players set position=$1 where character_id=$2',[{x:90,z:0,yaw:0},ca]);
        await user(a);
        await rejected(()=>rpc('shadow_action',[ca,'report']),/SHADOW_TOO_FAR/);
        await client.query('reset role');
        await client.query('update public.world_players set position=$1 where character_id=$2',[{x:3.5,z:-62.35,yaw:0},ca]);
        await user(a);
        const reported=await rpc('shadow_action',[ca,'report']);
        assert.equal(reported.shadowQuest,'returning');
        assert.equal(reported.combatEncounter.looted,true);
        await rejected(()=>rpc('shadow_action',[ca,'report']),/SHADOW_INVALID_STATE/);
        await rejected(()=>rpc('shadow_action',[ca,'return']),/SHADOW_TOO_FAR/);
        await rpc('world_leave',[ca,sa]);
        assert.equal((await rpc('character_enter',[ca])).shadowQuest,'returning');
        await client.query('reset role');
        await client.query("insert into public.world_maps(id,name,spawn) values('casa_de_isberto_interior','Casa de Isberto',$1) on conflict(id) do nothing",[{x:0,z:2.25,yaw:0}]);
        await client.query('update public.characters set data=data||$1::jsonb where id=$2',[
          {location:'casa_de_isberto_interior',position:{x:.9,z:.55,yaw:0},health:20,resource:10},ca]);
        await user(a);await rpc('world_join',[ca,sa]);
        const returned=await rpc('shadow_action',[ca,'return']);
        assert.equal(returned.shadowQuest,'returned');
        assert.deepEqual(returned.inventory,looted.inventory,'The epilogue grants no extra loot');
        await rejected(()=>rpc('shadow_action',[ca,'return']),/SHADOW_INVALID_STATE/);
        await rejected(()=>rpc('rest_action',[ca]),/REST_TOO_FAR/);
        await client.query('reset role');
        await client.query('update public.world_players set position=$1 where character_id=$2',[{x:-1.5,z:-2.5,yaw:0},ca]);
        await user(a);
        const rested=await rpc('rest_action',[ca]);
        assert.equal(rested.health,-1);assert.equal(rested.resource,-1);
        await client.query('reset role');await client.query(serverSql());
        const {rows:[stored]}=await client.query('select data from public.characters where id=$1',[ca]);
        assert.equal(stored.data.shadowQuest,'returned','Reapplying SQL preserves closure');
        assert.equal(stored.data.combatEncounter.looted,true);
      } finally {
        await client.query('rollback to savepoint shadow_epilogue');
        await client.query('release savepoint shadow_epilogue');
      }
    });
    await t.test('combat RPCs own encounter state, validate range/cooldowns and apply enemy damage server-side', async () => {
      await client.query('savepoint authoritative_combat');
      try {
        await client.query('reset role');
        await client.query("update public.server_config set value='true' where key='combat_enabled'");
        await client.query('update public.characters set data=$1 where id=$2', [{
          name:'Alric',race:'humano',cls:'guerrero',level:1,health:100,resource:80,
          attributePoints:{fuerza:2},location:'brumaluz',equipment:weaponFor('guerrero'),
          position:{x:0,z:-62.35,yaw:0},
        },ca]);
        await user(a);
        await rpc('character_enter',[ca]);
        await rpc('world_join',[ca,sa]);
        await rejected(()=>rpc('combat_start',[ca]),/WELCOME_REQUIRED/);
        await client.query('reset role');
        await client.query("update public.characters set data=jsonb_set(data,'{welcome}','{\"origin\":0,\"stage\":\"active\"}'::jsonb) where id=$1",[ca]);
        await user(a);
        await rejected(()=>rpc('combat_start',[ca]),/WELCOME_REQUIRED/);
        await client.query('reset role');
        await client.query("update public.characters set data=jsonb_set(data,'{welcome,stage}','\"completed\"'::jsonb) where id=$1",[ca]);
        await user(a);
        const encounter=await rpc('combat_start',[ca]);
        assert.equal(encounter.encounter.id,'shadowling');
        assert.equal(encounter.encounter.health,100);
        await rejected(()=>rpc('combat_start',[ca]),/COMBAT_ALREADY_ACTIVE/);
        await client.query('reset role');
        await client.query("update public.characters set data=jsonb_set(data,'{welcome,stage}','\"found\"'::jsonb) where id=$1",[ca]);
        await user(a);
        await rejected(()=>rpc('combat_action',[ca,'attack']),/WELCOME_REQUIRED/);
        await client.query('reset role');
        await client.query("update public.characters set data=jsonb_set(data,'{welcome,stage}','\"completed\"'::jsonb) where id=$1",[ca]);
        await user(a);
        await rejected(()=>rpc('combat_action',[ca,'attack']),/COMBAT_OUT_OF_RANGE/);
        const approached=await rpc('world_sync',[ca,sa,motion(2,{z:-62.35})]);
        assert.equal(approached.status,'ok');
        assert.equal(approached.vitals.health,100);
        const attack=await rpc('combat_action',[ca,'attack']);
        assert.equal(attack.damage,10);
        assert.equal(attack.encounter.health,90);
        assert.equal(attack.vitals.resource,80);
        await rejected(()=>rpc('combat_action',[ca,'attack']),/COMBAT_COOLDOWN/);
        await rejected(()=>rpc('combat_action',[ca,'healing']),/COMBAT_INVALID_ACTION/);
        const skill=await rpc('combat_action',[ca,'heavy_strike']);
        assert.equal(skill.damage,18);
        assert.equal(skill.encounter.health,72);
        assert.equal(skill.vitals.resource,65);
        assert.ok(skill.skillCooldown>0&&skill.skillCooldown<=6);
        await rejected(()=>rpc('combat_action',[ca,'kill']),/COMBAT_INVALID_ACTION/);

        await client.query('reset role');
        await client.query("update public.characters set data=jsonb_set(data,'{combatEncounter}',(data->'combatEncounter')||jsonb_build_object('enemyAttackAt',0,'windup',extract(epoch from clock_timestamp())-1,'aimX',2,'aimZ',-62.35)) where id=$1",[ca]);
        await user(a);
        const hit=await rpc('world_sync',[ca,sa,motion(2,{z:-62.35})]);
        assert.equal(hit.vitals.health,92,'The server applies the enemy hit during world heartbeat');
        const fled=await rpc('combat_stop',[ca]);
        assert.equal(fled.encounter.status,'fled');
        await rpc('combat_start',[ca]);
        await client.query('reset role');
        await client.query(
          "update public.characters set data=jsonb_set(jsonb_set(data,'{health}','1'::jsonb),'{combatEncounter}',(data->'combatEncounter')||jsonb_build_object('enemyAttackAt',0,'windup',extract(epoch from clock_timestamp())-1,'aimX',2,'aimZ',-62.35)) where id=$1",
          [ca],
        );
        await user(a);
        const defeated=await rpc('world_sync',[ca,sa,motion(2,{z:-62.35})]);
        assert.equal(defeated.vitals.health,0);
        assert.equal(defeated.encounter.status,'failed','A player death must not mark the enemy defeated');
      } finally {
        await client.query('rollback to savepoint authoritative_combat');
        await client.query('release savepoint authoritative_combat');
      }
    });
    await t.test('named starter abilities validate class, resources, cooldown and self-healing without an enemy', async () => {
      await client.query('savepoint named_skills');
      try {
        await client.query('reset role');
        await client.query("update public.server_config set value='true' where key='combat_enabled'");
        for (const [cls,skill,cost,damage,healing] of [
          ['guerrero','heavy_strike',15,18,0],['mago','arcane_discharge',20,18,0],
          ['picaro','double_slash',15,16,0],['clerigo','healing',12,0,32],
          ['explorador','precise_shot',15,19,0],
        ]) {
          await client.query('reset role');
          await client.query('update public.characters set data=$1 where id=$2',[{
            name:'Alric',race:'humano',cls,level:1,health:60,resource:50,location:'brumaluz',equipment:cls==='clerigo'?{}:weaponFor(cls),
            attributePoints:{fuerza:2},position:{x:2,z:-62.35,yaw:0},
            ...(cls==='clerigo'?{}:{welcome:{origin:0,stage:'completed'}}),
          },ca]);
          await user(a);
          await rpc('world_join',[ca,sa]);
          if(cls!=='clerigo')await rpc('combat_start',[ca]);
          await rejected(()=>rpc('combat_action',[ca,cls==='clerigo'?'heavy_strike':'healing']),/COMBAT_INVALID_ACTION/);
          const result=await rpc('combat_action',[ca,skill]);
          assert.equal(result.damage,damage);
          assert.equal(result.healing,healing);
          assert.equal(result.vitals.resource,50-cost);
          assert.ok(result.skillCooldown>0);
          if(cls==='clerigo')assert.equal(result.vitals.health,92);
          await rejected(()=>rpc('combat_action',[ca,skill]),/COMBAT_COOLDOWN/);
        }
      } finally {
        await client.query('rollback to savepoint named_skills');
        await client.query('release savepoint named_skills');
      }
    });
    await t.test('skill upgrades grant points every level, validate ownership and expected rank, and scale real combat', async () => {
      await client.query('savepoint skill_ranks');
      try{
        await client.query('reset role');
        await client.query("update public.server_config set value='true' where key='combat_enabled'");
        await client.query("update public.server_config set value='true' where key='debug_actions'");
        for(const [cls,id,power,base,hits] of [
          ['guerrero','heavy_strike',26,10,1],['mago','arcane_discharge',26,10,1],
          ['picaro','double_slash',12,8,2],['clerigo','healing',48,11,1],['explorador','precise_shot',27,10,1],
        ]){
          await client.query('reset role');
          await client.query('update public.characters set data=$1 where id=$2',[{
            name:'Alric',race:'humano',cls,level:1,health:1,resource:80,location:'brumaluz',equipment:weaponFor(cls),
            position:{x:2,z:-62.35,yaw:0},welcome:{origin:0,stage:'completed'},
          },ca]);
          await user(b);
          await rejected(()=>rpc('upgrade_skill',[ca,id,1]),/CHARACTER_NOT_FOUND/);
          await user(a);
          await rejected(()=>rpc('upgrade_skill',[ca,id,1]),/SKILL_LEVEL_REQUIRED/);
          await rejected(()=>rpc('upgrade_skill',[ca,id,null]),/SKILL_CHANGED/);
          await rejected(()=>rpc('upgrade_skill',[ca,cls==='clerigo'?'heavy_strike':'healing',1]),/SKILL_INVALID/);
          if(cls==='guerrero'){
            const leveled=await rpc('debug_xp',[ca]);
            assert.equal(leveled.level,2,'Actual XP leveling unlocks the first earned skill point');
            assert.equal(leveled.skillRanks,undefined,'A free starter rank needs no retroactive mutation');
          }
          for(let rank=1;rank<5;rank++){
            await client.query('reset role');
            await client.query("update public.characters set data=jsonb_set(data,'{level}',to_jsonb($1::int)) where id=$2",[rank+1,ca]);
            await user(a);
            const result=await rpc('upgrade_skill',[ca,id,rank]);
            assert.equal(result.skillRanks[id],rank+1);
            await rejected(()=>rpc('upgrade_skill',[ca,id,rank]),/SKILL_CHANGED/);
            if(rank<4)await rejected(()=>rpc('upgrade_skill',[ca,id,rank+1]),/SKILL_LEVEL_REQUIRED/);
          }
          await rejected(()=>rpc('upgrade_skill',[ca,id,5]),/SKILL_MAX_RANK/);
          const entered=await rpc('character_enter',[ca]);
          assert.equal(entered.skillRanks[id],5);
          await client.query('reset role');
          await client.query("update public.characters set data=jsonb_set(data,'{level}','8') where id=$1",[ca]);
          await user(a);
          await rpc('world_join',[ca,sa]);
          await rpc('combat_start',[ca]);
          const attack=await rpc('combat_action',[ca,'attack']);
          assert.equal(attack.damage,Math.round(base*1.35),'Normal damage scales with level, independently of ranks');
          const skill=await rpc('combat_action',[ca,id]);
          if(cls==='clerigo')assert.equal(skill.healing,power);
          else assert.equal(skill.damage,power*hits);
        }
      }finally{
        await client.query('rollback to savepoint skill_ranks');
        await client.query('release savepoint skill_ranks');
      }
    });
}

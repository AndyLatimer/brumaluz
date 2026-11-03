import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {fullWorldFixture} from './full-world-fixture.mjs';

test('runtime rules preserve equipped stats and keep heartbeats and quest acceptance off the full catalog',{timeout:90000},async()=>{
 const bundle=await build({stdin:{contents:"export * from './src/data/data';export * from './src/data/stats';export {EQUIPPABLE} from './src/data/equipment';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
 let game;try{game=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);}catch(e){throw Error(e.message);}
 const world=await fullWorldFixture(),{db,uid,session}=world;
 try{
  await db.exec("update public.server_config set value='true' where key='welcome_enabled'");
  let builds=0;
  for(const cls of ['guerrero','mago','picaro','clerigo','explorador'])for(let tier=0;tier<6;tier++)for(const peers of [0,3]){
   const d=game.defaultChar();d.cls=cls;d.level=1+tier*8;d.partyPeers=peers;d.equipment={};
   for(const [id,item]of Object.entries(game.EQUIPPABLE))if(item.tier===tier&&(!item.cls||item.cls===cls))d.equipment[item.slot]={id,count:1,instanceId:randomUUID()};
   d.foodBuff={itemId:tier===0?'pan_duro':`comida_${tier}`,remaining:900};
   const actual=(await db.query('select public.game_public_vitals($1) v',[d])).rows[0].v;
   assert.equal(actual.maxHealth,game.maxHealthOf(d),`${cls}/${tier}/${peers}: health`);
   assert.equal(actual.maxResource,game.maxResourceOf(d),`${cls}/${tier}/${peers}: resource`);builds++;
  }
  const id=randomUUID(),position={x:156.5,z:0,yaw:0},d={...game.defaultChar(),name:'Sonda',location:'brumaluz',position,introSeen:true,welcome:{origin:0,stage:'available'},equipment:{weapon:{id:'espada_inicial',count:1,instanceId:randomUUID()}},inventory:Array.from({length:25},()=>({id:'material_minero_0',count:50}))};
  await db.query('insert into public.characters(id,user_id,name,data) values($1,$2,$3,$4)',[id,uid,d.name,d]);
  await world.rpc('world_join',{p_character_id:id,p_session_id:session});
  await db.exec("create or replace function public.game_rpg_catalog() returns jsonb language plpgsql immutable as $$begin raise exception 'Full catalog used in hot path';end$$;");
  // Include checkpoints, full bags, food expiry and regeneration, not just idle movement.
  for(let i=0;i<6;i++){
   await world.step(6);
   const snapshot=await world.rpc('world_sync',{p_character_id:id,p_session_id:session,p_state:{...position,facing:0,jump:0,wave:0}});
   assert.equal(snapshot.status,'ok');assert.ok(snapshot.vitals.maxHealth>0);
  }
  const accepted=await world.rpc('welcome_action',{p_character_id:id,p_action:'accept'});
  assert.equal(accepted.welcome.stage,'active');
  await assert.rejects(()=>world.rpc('welcome_action',{p_character_id:id,p_action:'accept'}),/WELCOME_INVALID_STATE/);
  assert.equal((await world.character(id)).welcome.stage,'active');
  console.log(`Runtime parity: ${builds} real equipment/food/party builds; full-bag checkpoints and quest acceptance verified without the full catalog.`);
 }finally{await world.close();}
});

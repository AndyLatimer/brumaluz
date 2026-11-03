import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {cozyFixture,cozyClient} from './cozy-life-fixture.mjs';
import {cozyLifePatch,sqlDefinition} from '../tools/build-cozy-life-patch.mjs';
const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8'));
const home=cozyClient.STARTER_HOME;
const count=(d,id)=>d.inventory.reduce((n,i)=>n+(i?.id===id?i.count:0),0);
async function gather(f,a,id,n){
 for(let i=0;i<n;i++){
  const d=await f.data(a),now=await f.stamp();let node=Object.values(catalog.nodes).find(s=>s.item===id&&(d.rpg?.nodes?.[s.id]??0)<=now);
  if(!node){const candidates=Object.values(catalog.nodes).filter(s=>s.item===id).sort((a,b)=>(d.rpg.nodes[a.id]??0)-(d.rpg.nodes[b.id]??0));node=candidates[0];assert.ok(node,'Authored gathering source');await f.step(Math.max(0,d.rpg.nodes[node.id]-now)+.1);}
  await f.move(a,node);await f.action(a,'gather_start',{id:node.id});await f.step(node.seconds+.2);await f.action(a,'gather_finish',{id:node.id});
 }
}
async function purchase(f,a,id){
 const recipe=catalog.recipes[id];await f.move(a,catalog.teachers[recipe.job]);let d=await f.action(a,'buy_recipe',{id,master:catalog.teachers[recipe.job].id,price:recipe.price});
 const slot=d.inventory.findIndex(i=>i?.id===`receta_${id}`);return f.action(a,'use_recipe',{slot,id:d.inventory[slot].id,instanceId:d.inventory[slot].instanceId});
}
test('a peaceful starter route funds and keeps its first crafted furnishing',{timeout:120000},async()=>{
 const f=await cozyFixture();try{
  const a=await f.actor('Artesana');await f.patch(a,{welcome:{stage:'completed',origin:0},shadowQuest:'returned',wallet:{pelines:5,lagrimas:0}});
  await f.move(a,catalog.professionTutorial.mentor);await f.action(a,'neighbor_accept',{master:'gnomi'});await f.move(a,catalog.teachers.lenador);await f.action(a,'neighbor_visit',{master:'maestro_lenador'});await f.move(a,catalog.professionTutorial.mentor);
  let d=await f.action(a,'neighbor_report',{master:'gnomi'});assert.equal(d.wallet.pelines,105);
  await f.action(a,'tutorial_accept',{job:'ebanisteria',master:'gnomi'});await f.move(a,catalog.teachers.ebanisteria);await f.action(a,'tutorial_visit',{master:'maestro_ebanisteria'});
  await f.move(a,catalog.teachers.herreria);d=await f.action(a,'buy_tool',{job:'lenador'});await f.action(a,'tool',{slot:d.inventory.findIndex(i=>i?.id==='herramienta_lenador_0')});
  await purchase(f,a,'componente_ebanisteria_0');await gather(f,a,'material_lenador_0',6);await f.move(a,catalog.teachers.ebanisteria);d=await f.action(a,'craft',{id:'componente_ebanisteria_0',count:2});
  await f.step(181);await f.move(a,catalog.teachers.ebanisteria);for(const id of d.rpg.tutorial.jobIds)await f.action(a,'collect',{id});
  await f.patch(a,{rpg:{dailyOrders:{day:new Date(await f.stamp()*1000).toISOString().slice(0,10),completed:3,accepted:[]}}});
  const before=await f.data(a);d=await f.action(a,'tutorial_supply',{master:'maestro_ebanisteria'});assert.equal(d.wallet.pelines,110);assert.deepEqual(d.rpg.dailyOrders,before.rpg.dailyOrders);await f.action(a,'tutorial_complete',{master:'maestro_ebanisteria'});
  await purchase(f,a,'mueble_mesita_0');await gather(f,a,'material_lenador_0',3);await f.move(a,catalog.teachers.ebanisteria);d=await f.action(a,'craft',{id:'mueble_mesita_0'});const task=d.rpg.jobs.find(j=>j.recipe==='mueble_mesita_0');await f.step((task.end-await f.stamp())*3+1);await f.move(a,catalog.teachers.ebanisteria);d=await f.action(a,'collect',{id:task.id});
  const slot=d.inventory.findIndex(i=>i?.id==='mueble_mesita_0');await f.move(a,{location:home.location,x:0,z:1});d=await f.action(a,'home_place',{slot,instanceId:d.inventory[slot].instanceId,x:.75,z:-.75,yaw:0});assert.equal(d.wallet.pelines,60);assert.equal(d.rpg.furniture.length,1);assert.equal(d.rpg.furniture[0].item.craftedBy,a.id);
 }finally{await f.close();}
});

test('home placement preserves instances, prevents overlap and protects visitors and the doorway',{timeout:90000},async()=>{
 const f=await cozyFixture();try{
  const a=await f.actor('Decoradora'),item=await f.item('mueble_silla_0');await f.patch(a,{inventory:[item,...Array(24).fill(null)]});await f.move(a,{location:home.location,x:0,z:1});
  await assert.rejects(()=>f.action(a,'home_place',{slot:0,instanceId:item.instanceId,x:1,z:2,yaw:0}),/puerta|habitación/);assert.equal((await f.data(a)).inventory[0].instanceId,item.instanceId);
  await assert.rejects(()=>f.action(a,'home_place',{slot:0,instanceId:'stale',x:.75,z:-.75,yaw:0}),/ha cambiado/);
  let d=await f.action(a,'home_place',{slot:0,instanceId:item.instanceId,x:.75,z:-.75,yaw:0});const p=d.rpg.furniture[0];
  d=await f.action(a,'home_move',{id:p.id,instanceId:item.instanceId,x:.55,z:.2,yaw:Math.PI/2});assert.equal(d.rpg.furniture[0].item.instanceId,item.instanceId);
  await f.patch(a,{rpg:{homes:{...d.rpg.homes,owned:['lucero'],primary:'lucero',access:'private',visit:randomUUID()}}});await assert.rejects(()=>f.action(a,'home_pickup',{id:p.id,instanceId:item.instanceId}),/propia habitación/);
  await f.action(a,'home_leave_visit');d=await f.action(a,'home_pickup',{id:p.id,instanceId:item.instanceId});assert.equal(d.rpg.furniture.length,0);assert.equal(d.inventory.find(i=>i?.id===item.id).instanceId,item.instanceId);assert.equal(d.rpg.homes.settled,true);
  await f.move(a,{location:home.location,x:1,z:1.5});await f.use(a);
  const exit=await f.rpc('world_travel',{p_character_id:a.id,p_session_id:a.session,p_portal:'home_exit_lucero'});assert.equal(exit.location,'posada_lucero_del_alba');
  await f.move(a,{location:'posada_lucero_del_alba',x:-6.4,z:6});await f.use(a);
  const entry=await f.rpc('world_travel',{p_character_id:a.id,p_session_id:a.session,p_portal:'mkf9n1bp'});assert.equal(entry.location,home.location);
 }finally{await f.close();}
});
test('visits share only the host room and permissions hide separate personal rooms',{timeout:90000},async()=>{
 const f=await cozyFixture();try{
  const a=await f.actor('Anfitriona'),b=await f.actor('Visitante');
  for(const actor of [a,b])await f.move(actor,{location:home.location,x:0,z:1});
  await f.use(a);assert.deepEqual(await f.rpc('game_world_snapshot',{p_user_id:a.uid}),[]);
  await f.action(a,'home_access',{access:'party'});
  await f.move(b,home.entrance);await assert.rejects(()=>f.action(b,'home_visit',{owner:a.id}),/no permite/);
  const party=randomUUID();await f.db.query('insert into public.parties(id) values($1)',[party]);
  for(const actor of [a,b])await f.db.query('insert into public.party_members(party_id,user_id,character_id) values($1,$2,$3)',[party,actor.uid,actor.id]);
  await f.action(b,'home_visit',{owner:a.id});await f.move(b,{location:home.location,x:0,z:1});
  const view=await f.view(b);assert.equal(view.home.owner,a.id);assert.equal(view.home.guest,true);assert.equal(view.home.allowed,true);assert.equal(view.home.inventory,undefined);
  await f.use(a);assert.equal((await f.rpc('game_world_snapshot',{p_user_id:a.uid})).length,1);
  await f.action(a,'home_access',{access:'private'});assert.equal((await f.view(b)).home.allowed,false);await f.use(a);assert.deepEqual(await f.rpc('game_world_snapshot',{p_user_id:a.uid}),[]);
 }finally{await f.close();}
});
test('second home ownership, visitors, exit and bank enforce the selected home',{timeout:90000},async()=>{
 const f=await cozyFixture();try{
  const a=await f.actor('Propietaria'),b=await f.actor('Invitada'),house=cozyClient.NEXT_HOME;
  await f.move(b,house.entrance);await f.use(b);await assert.rejects(()=>f.rpc('world_travel',{p_character_id:b.id,p_session_id:b.session,p_portal:'home_olmo'}),/todavía no te pertenece/);
  await assert.rejects(()=>f.action(b,'home_primary',{id:house.id}),/no te pertenece/);
  await f.patch(a,{wallet:{pelines:3499,lagrimas:0},rpg:{homes:{owned:['lucero'],primary:'lucero',access:'party',settled:true},neighborhood:{errand:'completed',preparations:['banco','plantas']}}});await f.move(a,house.entrance);
  const before=await f.data(a);await assert.rejects(()=>f.action(a,'home_buy',{id:house.id,price:3500}),/moneda/);assert.deepEqual(await f.data(a),before);
  await f.patch(a,{wallet:{pelines:3500,lagrimas:0}});const request=randomUUID(),revision=(await f.data(a)).rpg.revision??0;
  let d=await f.action(a,'home_buy',{id:house.id,price:3500},request,revision);assert.equal(d.wallet.pelines,0);d=await f.action(a,'home_buy',{id:house.id,price:3500},request,revision);assert.deepEqual(d.rpg.homes.owned,['lucero','olmo']);await assert.rejects(()=>f.action(a,'home_buy',{id:house.id,price:3500}),/ya es tuya/);
  const party=randomUUID();await f.db.query('insert into public.parties(id) values($1)',[party]);for(const actor of [a,b])await f.db.query('insert into public.party_members(party_id,user_id,character_id) values($1,$2,$3)',[party,actor.uid,actor.id]);
  await f.move(b,house.entrance);await f.action(b,'home_visit',{owner:a.id,home:'olmo'});await f.use(b);await f.rpc('world_travel',{p_character_id:b.id,p_session_id:b.session,p_portal:'home_olmo'});
  await f.move(b,{location:house.location,x:2.6,z:2.6});assert.equal((await f.view(b)).home.allowed,true);
  await assert.rejects(()=>f.rpc('bank_action',{p_character_id:b.id,p_action:'open'}),/propia vivienda/);await assert.rejects(()=>f.action(b,'home_rest'),/propia habitación/);
  await f.move(a,{location:house.location,x:0,z:1});await f.action(a,'home_access',{access:'private'});assert.equal((await f.view(b)).home.allowed,false);
  d=await f.action(b,'home_leave_visit');assert.equal(d.location,'brumaluz');assert.equal(d.rpg.homes.visit,undefined);assert.equal(d.position.x,house.exit.targetX);
  await f.move(a,{location:house.location,x:2.6,z:2.6});await f.use(a);assert.ok(await f.rpc('bank_action',{p_character_id:a.id,p_action:'open'}));
  await f.move(a,{location:house.location,x:0,z:1});d=await f.data(a);await f.patch(a,{inventory:[await f.item('mueble_silla_0'),...Array(24).fill(null)]});d=await f.data(a);await f.action(a,'home_place',{slot:0,instanceId:d.inventory[0].instanceId,x:1,z:-2,yaw:0});
  const view=await f.view(a);assert.equal(view.home.furniture.length,1);assert.equal(view.home.furniture[0].location,house.location);
  await f.move(a,{location:home.location,x:0,z:1});assert.equal((await f.view(a)).home.furniture.length,0);
 }finally{await f.close();}
});

test('the prepared patch is repeatable and preserves characters, existing catalog additions and placements',{timeout:90000},async()=>{
 const f=await cozyFixture();try{
  const a=await f.actor('Viviendas'),before=await f.data(a);
  const oldCatalog=(await f.db.query('select public.game_rpg_catalog() c')).rows[0].c;
  await f.db.query("update public.test_catalogs set rpg=rpg||'{\"unrelated\":{\"preserved\":true}}'::jsonb");
  // The fixture substitutes its clock in function bodies; the deployment guards
  // intentionally accept only the actual production source, so restore it here.
  const professions=await readFile('supabase/server/20-professions.sql','utf8'),cozy=await readFile('supabase/server/19b-cozy-life.sql','utf8'),bank=await readFile('supabase/server/15-bank.sql','utf8'),world=await readFile('supabase/server/29-shared-world-generated.sql','utf8');
  await f.db.exec(sqlDefinition(professions,'rpg_action')+sqlDefinition(professions,'game_rpg_near')+sqlDefinition(cozy,'game_world_snapshot')+sqlDefinition(bank,'bank_action')+sqlDefinition(world,'world_travel'));
  const patch=await cozyLifePatch();await f.db.exec(patch);await f.db.exec(patch);
  const current=(await f.db.query('select public.game_rpg_catalog() c')).rows[0].c;
  assert.deepEqual(current.nodes,oldCatalog.nodes);assert.deepEqual(current.stations,oldCatalog.stations);assert.deepEqual(current.unrelated,{preserved:true});assert.deepEqual(await f.data(a),before);
  for(const role of ['anon','authenticated'])assert.equal((await f.db.query("select has_function_privilege($1,'public.game_cozy_action(uuid,jsonb,text,jsonb,jsonb,numeric)','EXECUTE') allowed",[role])).rows[0].allowed,false);
 }finally{await f.close();}
});

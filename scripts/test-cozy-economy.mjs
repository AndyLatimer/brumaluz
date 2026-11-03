import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {cozyFixture,cozyClient} from './cozy-life-fixture.mjs';
const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8'));
const slots=items=>[...items,...Array(25-items.length).fill(null)];
const station=job=>Object.values(catalog.stations).find(s=>s.job===job);

test('approved cozy economy in the complete isolated SQL world',async t=>{
 const f=await cozyFixture();
 const offers=async(a,job)=> (await f.db.query('select public.game_order_offers($1,$2,$3) offers',[await f.data(a),job,await f.stamp()])).rows[0].offers;
 const authored=async(a,id,count=1)=>({...await f.item(id,count),craftedBy:a.id});
 const cook=async(a,recipe)=>{
  await f.move(a,catalog.teachers.cocina);await f.action(a,'meal_start',{id:recipe.id,master:'maestro_cocina'});
  const p=(await f.view(a)).projects.find(p=>p.active&&p.recipe.id===recipe.id);
  await f.patch(a,{inventory:slots(await Promise.all(Object.entries(recipe.ingredients).map(([id,n])=>f.item(id,n))))});
  for(const[id,n]of Object.entries(recipe.ingredients))for(let i=0;i<n;i++)await f.action(a,'meal_contribute',{project:p.id,id,master:'maestro_cocina'});
  return (await f.view(a)).projects.find(row=>row.id===p.id);
 };
 try{
  await t.test('catalog respects every approved timing and raw material sale rule',()=>{
   const ranges=[[120,360],[360,960],[1200,2400],[3600,7200],[7200,14400],[14400,28800]];
   for(const r of Object.values(catalog.recipes)){
    const item=catalog.items[r.output];if(item?.furniture)assert.ok(r.seconds>=ranges[r.tier][0]&&r.seconds<=ranges[r.tier][1],r.id);
    if(r.output.startsWith('componente_'))assert.equal(r.seconds,30);
    if(item?.category==='Comida'||r.output.startsWith('pocion_'))assert.equal(r.seconds,0);
   }
   for(const item of Object.values(catalog.items).filter(i=>/^(material_|gema_|fibra_|cuero_|fruta_|hongo_|grano_)/.test(i.id)))assert.equal(item.sellable,false,item.id);
   for(let tier=0;tier<6;tier++){const meals=Object.values(catalog.meals).filter(r=>r.tier===tier);assert.ok(meals.length>=6);assert.ok(meals.some(r=>r.exclusive));assert.ok(meals.some(r=>!r.exclusive));}
  });
  await t.test('house costs 3500 and does not require Gnomi, projects or furniture',async()=>{
   const a=await f.actor('Hogar');await f.patch(a,{wallet:{pelines:3500,lagrimas:7}});await f.move(a,cozyClient.NEXT_HOME.entrance);
   const d=await f.action(a,'home_buy',{id:'olmo',price:3500});assert.equal(d.wallet.pelines,0);assert.equal(d.wallet.lagrimas,7);assert.ok(d.rpg.homes.owned.includes('olmo'));assert.equal(d.rpg.furniture.length,0);
  });
  await t.test('NPCs refuse raw resources atomically and retain the ordinary half-value sale price',async()=>{
   const a=await f.actor('Comercio');await f.patch(a,{wallet:{pelines:0,lagrimas:0},inventory:slots([await f.item('material_lenador_0',3)])});await f.use(a);const before=await f.data(a);
   await assert.rejects(f.rpc('vendor_sell',{p_character_id:a.id,p_vendor:'testiculos',p_slot:0}),/ITEM_NOT_SELLABLE/);assert.deepEqual(await f.data(a),before);
   await f.patch(a,{inventory:slots([await authored(a,'mueble_silla_0')])});const d=await f.rpc('vendor_sell',{p_character_id:a.id,p_vendor:'testiculos',p_slot:0});assert.equal(d.wallet.pelines,20);assert.equal(d.inventory[0],null);
  });
  await t.test('Gnomi pays 100 exactly once',async()=>{
   const a=await f.actor('Recadero');await f.patch(a,{shadowQuest:'returned',wallet:{pelines:5,lagrimas:0}});
   await f.action(a,'neighbor_accept',{master:'gnomi'});await f.move(a,catalog.teachers.lenador);await f.action(a,'neighbor_visit',{master:'maestro_lenador'});await f.move(a,{location:'brumaluz',x:-3.5,z:0});
   const d=await f.action(a,'neighbor_report',{master:'gnomi'});assert.equal(d.wallet.pelines,105);await assert.rejects(f.action(a,'neighbor_report',{master:'gnomi'}));
  });
  await t.test('bank reservation, provenance and full cancellation retain item metadata',async()=>{
   const a=await f.actor('Reservas');await f.patch(a,{race:'elfo',inventory:slots([]),rpg:{learned:['componente_ebanisteria_0']}});await f.move(a,station('ebanisteria'));
   const recipe=catalog.recipes.componente_ebanisteria_0,items=await Promise.all(Object.entries(recipe.ingredients).map(async([id,n])=>({...await f.item(id,n),craftedBy:'old-source'})));
   await f.db.query('insert into public.account_banks(user_id,items) values($1,$2) on conflict(user_id) do update set items=excluded.items',[a.uid,items]);
   let d=await f.action(a,'craft',{id:recipe.id,count:1});assert.equal(d.rpg.jobs.at(-1).output.craftedBy,a.id);assert.equal(d.rpg.jobs.at(-1).reservedItems[0].craftedBy,'old-source');
   d=await f.action(a,'cancel',{id:d.rpg.jobs.at(-1).id});assert.equal(d.rpg.jobs.length,0);assert.deepEqual(d.rpg.deliveries,items);
   const bank=(await f.db.query('select items from public.account_banks where user_id=$1',[a.uid])).rows[0].items;assert.ok(bank.every(i=>i===null));
  });
  await t.test('one hour offline earns twenty minutes, online presence earns full speed',async()=>{
   const a=await f.actor('Relojero'),r=catalog.recipes.componente_ebanisteria_0;
   await f.patch(a,{race:'elfo',inventory:slots(await Promise.all(Object.entries(r.ingredients).map(([id,n])=>f.item(id,n*2)))),rpg:{learned:[r.id]}});await f.move(a,station('ebanisteria'));
   let d=await f.action(a,'craft',{id:r.id,count:2});await f.db.query('delete from public.world_players where character_id=$1',[a.id]);
   await f.step(60);d=await f.action(a,'state');assert.equal(d.rpg.jobs.filter(j=>j.done).length,0);assert.ok(Math.abs(d.rpg.jobs[0].end-await f.stamp()-10)<.01);
   await f.step(30);d=await f.action(a,'state');assert.equal(d.rpg.jobs.filter(j=>j.done).length,1);
   await f.move(a,station('ebanisteria'));for(let i=0;i<6;i++){await f.step(5);await f.move(a,station('ebanisteria'));}d=await f.action(a,'state');assert.equal(d.rpg.jobs.filter(j=>j.done).length,2);
   d=await f.action(a,'collect',{id:d.rpg.jobs[0].id});assert.equal(d.inventory.find(i=>i?.id===r.output).craftedBy,a.id);
  });
  await t.test('five sequential jobs per profession and failed bank batches are atomic',async()=>{
   const a=await f.actor('Colas');await f.patch(a,{race:'elfo',rpg:{learned:['componente_ebanisteria_0','componente_herreria_0'],dailyOrders:{day:cozyClient.dailyOrderDay(await f.stamp()),completed:3}}});await f.move(a,station('ebanisteria'));
   await f.db.query('insert into public.account_banks(user_id,items) values($1,$2)',[a.uid,[await f.item('material_lenador_0',3)]]);const before=await f.data(a);
   await assert.rejects(f.action(a,'craft',{id:'componente_ebanisteria_0',count:2}),/materiales/);assert.deepEqual(await f.data(a),before);assert.equal((await f.db.query('select items from public.account_banks where user_id=$1',[a.uid])).rows[0].items[0].count,3);
   await f.db.query('update public.account_banks set items=$2 where user_id=$1',[a.uid,[await f.item('material_lenador_0',15),await f.item('material_minero_0',3)]]);
   let d=await f.action(a,'craft',{id:'componente_ebanisteria_0',count:5});assert.equal(d.rpg.jobs.length,5);for(let i=1;i<5;i++)assert.equal(d.rpg.jobs[i].start,d.rpg.jobs[i-1].end);await assert.rejects(f.action(a,'craft',{id:'componente_ebanisteria_0'}),/cinco/);
   await f.move(a,station('herreria'));d=await f.action(a,'craft',{id:'componente_herreria_0'});assert.equal(d.rpg.jobs.length,6);assert.equal(d.rpg.dailyOrders.completed,3);
  });
  await t.test('three shared fixed offers, no raw supply loophole, acceptance snapshots survive promotion',async()=>{
   const a=await f.actor('Pedidos'),b=await f.actor('Colega');const first=await offers(a,'ebanisteria');assert.equal(first.length,3);assert.deepEqual(first,await offers(b,'ebanisteria'));
   assert.deepEqual(first,cozyClient.commissionOffers(await f.data(a),'ebanisteria',await f.stamp()));
   await f.move(a,catalog.teachers.ebanisteria);let d=await f.action(a,'order_accept',{id:first[0].id,job:'ebanisteria',master:'maestro_ebanisteria'});const accepted=d.rpg.dailyOrders.accepted[0];
   await f.patch(a,{rpg:{xp:{ebanisteria:100}}});d=await f.action(a,'state');assert.deepEqual(d.rpg.dailyOrders.accepted[0],accepted);assert.ok((await offers(a,'ebanisteria')).every(o=>o.tier===1));
   await assert.rejects(f.action(a,'daily_order',{id:'suministro_lenador',master:'maestro_lenador',reward:50}));
   d=await f.action(a,'order_cancel',{id:accepted.acceptedId});assert.equal(d.rpg.dailyOrders.accepted.length,0);assert.equal(d.rpg.dailyOrders.completed,0);
  });
  await t.test('three active globally, self-made goods only, bulk pay and request retry',async()=>{
   const a=await f.actor('Entregas');await f.move(a,catalog.teachers.ebanisteria);const offer=(await offers(a,'ebanisteria'))[0];let d;
   for(let i=0;i<3;i++)d=await f.action(a,'order_accept',{id:offer.id,job:'ebanisteria',master:'maestro_ebanisteria'});
   await assert.rejects(f.action(a,'order_accept',{id:offer.id,job:'ebanisteria',master:'maestro_ebanisteria'}),/tres/);
   const [id,n]=Object.entries(offer.ingredients)[0];await f.patch(a,{inventory:slots([{...await f.item(id,n*3),craftedBy:randomUUID()}])});
   await assert.rejects(f.action(a,'order_claim',{id:d.rpg.dailyOrders.accepted[0].acceptedId,master:'maestro_ebanisteria'}),/propios/);
   const item=await authored(a,id,n*3);await f.patch(a,{inventory:slots([item]),wallet:{pelines:0,lagrimas:0}});
   const request=randomUUID(),before=(await f.data(a)).rpg.revision;
   d=await f.action(a,'order_claim_all',{job:'ebanisteria',master:'maestro_ebanisteria'},request,before);assert.equal(d.wallet.pelines,offer.reward*3);assert.equal(d.rpg.dailyOrders.completed,3);assert.equal(d.rpg.dailyOrders.accepted.length,0);
   const retry=await f.action(a,'order_claim_all',{job:'ebanisteria',master:'maestro_ebanisteria'},request,before);assert.equal(retry.wallet.pelines,d.wallet.pelines);
  });
  await t.test('used tools remain ineligible even after full repair, day expiry preserves items',async()=>{
   const a=await f.actor('Herramientas');await f.move(a,catalog.teachers.minero);const offer=(await offers(a,'minero'))[0];let d=await f.action(a,'order_accept',{id:offer.id,job:'minero',master:'maestro_minero'});
   const id=Object.keys(offer.ingredients)[0],item={...await authored(a,id),used:true};await f.patch(a,{inventory:slots([item])});
   await assert.rejects(f.action(a,'order_claim',{id:d.rpg.dailyOrders.accepted[0].acceptedId,master:'maestro_minero'}),/propios/);
   await f.step(86400);d=await f.action(a,'state');assert.equal(d.rpg.dailyOrders.accepted.length,0);assert.deepEqual(d.inventory[0],item);
  });
  await t.test('neighborhood projects are unique, crafted-only, independent and no home gates',async()=>{
   const a=await f.actor('Vecindad');await f.move(a,catalog.teachers.alquimia);await f.patch(a,{inventory:slots([await authored(a,'componente_alquimia_0',2)]),rpg:{dailyOrders:{day:cozyClient.dailyOrderDay(await f.stamp()),completed:3}}});
   const before=(await f.data(a)).wallet?.pelines??0;const d=await f.action(a,'neighbor_prepare',{id:'plantas',master:'maestro_alquimia'});assert.equal(d.wallet.pelines,before+25);assert.ok(d.inventory.some(i=>i?.id==='mueble_macetero_0'));assert.equal(d.rpg.dailyOrders.completed,3);await assert.rejects(f.action(a,'neighbor_prepare',{id:'plantas',master:'maestro_alquimia'}));
  });
  await t.test('personal menus, snapshots, repeats, claim-day quota and seven-day expiry',async()=>{
   const a=await f.actor('Cocinera');await f.move(a,catalog.teachers.cocina);const view=await f.view(a),menu=view.menu;assert.equal(menu.length,3);assert.deepEqual(menu,cozyClient.mealMenu(await f.data(a),await f.stamp()));
   const p1=await cook(a,menu[0]),p2=await cook(a,menu[0]),p3=await cook(a,menu[1]);assert.equal(p1.recipe.id,p2.recipe.id);
   const before=(await f.data(a)).wallet?.pelines??0;let d=await f.action(a,'meal_claim',{id:p1.id,master:'maestro_cocina'});assert.equal(d.wallet.pelines,before+p1.recipe.pelines);assert.equal(d.rpg.mealQuota.completed,1);
   await f.action(a,'meal_claim',{id:p2.id,master:'maestro_cocina'});await assert.rejects(f.action(a,'meal_claim',{id:p3.id,master:'maestro_cocina'}),/dos/);
   await f.step(86400);await f.move(a,catalog.teachers.cocina);d=await f.action(a,'meal_claim',{id:p3.id,master:'maestro_cocina'});assert.equal(d.rpg.mealQuota.completed,1);await assert.rejects(f.action(a,'meal_claim',{id:p3.id,master:'maestro_cocina'}));
   const pending=await cook(a,(await f.view(a)).menu[0]);await f.step(604800);await f.move(a,catalog.teachers.cocina);await assert.rejects(f.action(a,'meal_claim',{id:pending.id,master:'maestro_cocina'}),/caducado/);
  });
  await t.test('no manual cancel, pause while all offline, resume and refund exactly once',async()=>{
   const a=await f.actor('Pausa');await f.move(a,catalog.teachers.cocina);const recipe=(await f.view(a)).menu[0];await f.action(a,'meal_start',{id:recipe.id,master:'maestro_cocina'});let p=(await f.view(a)).projects.find(p=>p.active);
   const id=Object.keys(recipe.ingredients)[0],item={...await f.item(id,1),craftedBy:'retained-metadata'};await f.patch(a,{inventory:slots([item])});await f.action(a,'meal_contribute',{project:p.id,id,master:'maestro_cocina'});
   await assert.rejects(f.action(a,'meal_cancel',{id:p.id,master:'maestro_cocina'}),/cancelar/);await f.db.query('delete from public.world_players where character_id=$1',[a.id]);await f.step(3600);await f.move(a,catalog.teachers.cocina);p=(await f.view(a)).projects.find(row=>row.id===p.id);assert.equal(p.remaining,1800);
   await f.db.query('update public.cozy_projects set remaining=10 where id=$1',[p.id]);await f.step(11);await f.move(a,catalog.teachers.cocina);await f.view(a);let d=await f.action(a,'state');assert.deepEqual(d.rpg.deliveries,[item]);await f.view(a);d=await f.action(a,'state');assert.deepEqual(d.rpg.deliveries,[item]);
  });
  await t.test('only group leader starts; disband refunds each donor, preserving properties',async()=>{
   const a=await f.actor('Anfitrion'),b=await f.actor('Ayudante');const party=randomUUID();await f.db.query('insert into public.parties(id) values($1)',[party]);
   for(const actor of [a,b]){await f.db.query('insert into public.party_members(user_id,character_id,party_id) values($1,$2,$3)',[actor.uid,actor.id,party]);await f.move(actor,catalog.teachers.cocina);}
   const recipe=(await f.view(a)).menu[0];await assert.rejects(f.action(b,'meal_start',{id:(await f.view(b)).menu[0].id,master:'maestro_cocina'}),/líder/);
   await f.action(a,'meal_start',{id:recipe.id,master:'maestro_cocina'});const p=(await f.view(a)).projects.find(p=>p.active),id=Object.keys(recipe.ingredients).find(id=>recipe.ingredients[id]>=2);
   const ownA={...await f.item(id,1),craftedBy:a.id},ownB={...await f.item(id,1),craftedBy:b.id};
   for(const[actor,item]of [[a,ownA],[b,ownB]]){await f.patch(actor,{inventory:slots([item])});await f.action(actor,'meal_contribute',{project:p.id,id,master:'maestro_cocina'});}
   await f.db.query('delete from public.world_players where character_id in($1,$2)',[a.id,b.id]);await f.step(3600);await f.rpc('game_party_cleanup');assert.equal((await f.db.query('select count(*)::int n from public.party_members where party_id=$1',[party])).rows[0].n,2);
   for(const actor of [a,b])await f.move(actor,catalog.teachers.cocina);assert.equal((await f.view(a)).projects.find(row=>row.id===p.id).remaining,1800);
   await f.db.query('delete from public.parties where id=$1',[party]);for(const[actor,item]of [[a,ownA],[b,ownB]]){const d=await f.action(actor,'state');assert.deepEqual(d.rpg.deliveries,[item]);}
  });
  await t.test('low-rank helpers receive the full reward; exhausted helpers explicitly forgo it',async()=>{
   const a=await f.actor('Maestra'),b=await f.actor('Aprendiz');const party=randomUUID();await f.db.query('insert into public.parties(id) values($1)',[party]);
   for(const actor of [a,b]){await f.db.query('insert into public.party_members(user_id,character_id,party_id) values($1,$2,$3)',[actor.uid,actor.id,party]);await f.move(actor,catalog.teachers.cocina);}
   await f.patch(a,{rpg:{xp:{cocina:10000},mastery:{cocina:3},mealQuota:{day:cozyClient.dailyOrderDay(await f.stamp()),completed:2}}});const recipe=(await f.view(a)).menu[0];assert.equal(recipe.tier,5);
   await f.action(a,'meal_start',{id:recipe.id,master:'maestro_cocina'});const project=(await f.view(a)).projects.find(p=>p.active),first=Object.keys(recipe.ingredients)[0];
   await f.patch(a,{inventory:slots([await f.item(first,1)])});await assert.rejects(f.action(a,'meal_contribute',{project:project.id,id:first,master:'maestro_cocina'}),/ayudar/);await f.action(a,'meal_contribute',{project:project.id,id:first,master:'maestro_cocina',help:true});
   await f.patch(b,{inventory:slots(await Promise.all(Object.entries(recipe.ingredients).map(([id,n])=>f.item(id,n))))});for(const[id,n]of Object.entries(recipe.ingredients))for(let i=0;i<n-(id===first?1:0);i++)await f.action(b,'meal_contribute',{project:project.id,id,master:'maestro_cocina'});
   const d=await f.action(b,'meal_claim',{id:project.id,master:'maestro_cocina'});assert.equal(d.rpg.xp.cocina,recipe.difficulty*5);assert.equal(d.rpg.mealQuota.completed,1);assert.ok(d.inventory.some(i=>i?.id===recipe.output));
   await f.step(86400);await f.move(a,catalog.teachers.cocina);await assert.rejects(f.action(a,'meal_claim',{id:project.id,master:'maestro_cocina'}),/sin recompensa/);
  });
 }finally{await f.close();}
});

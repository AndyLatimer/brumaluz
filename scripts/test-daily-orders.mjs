import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cozyFixture,cozyClient} from './cozy-life-fixture.mjs';
const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8'));
const slots=item=>[item,...Array(24).fill(null)];
test('revised commissions across all masters and ranks',async t=>{
 const f=await cozyFixture(),a=await f.actor('Pedidos');
 const offers=async(job,stamp=undefined)=>(await f.db.query('select public.game_order_offers($1,$2,$3) offers',[await f.data(a),job,stamp??await f.stamp()])).rows[0].offers;
 try{
  await t.test('server and client agree for all twelve masters at all six ranks',async()=>{
   for(const job of Object.keys(catalog.teachers))for(let rank=0;rank<6;rank++){
    await f.patch(a,{rpg:{xp:{[job]:[0,100,500,1500,4000,10000][rank]},mastery:{[job]:3}}});const data=await f.data(a),rows=await offers(job);assert.equal(rows.length,3,`${job}/${rank}`);assert.deepEqual(rows,cozyClient.commissionOffers(data,job,await f.stamp()));
    for(const o of rows){assert.ok(o.tier===rank||rank===5&&o.tier===4);const recipe=catalog.recipes[o.recipe];assert.ok(recipe);assert.ok(!Object.keys(o.ingredients).some(id=>/^(material_|gema_|fibra_|cuero_|fruta_|hongo_|grano_)/.test(id)));if(['minero','lenador','recolector'].includes(job))assert.equal(catalog.items[recipe.output].tool,job);else assert.equal(recipe.job,job);}
   }
  });
  await t.test('exceptional offer is one shared teacher/day roll and uses its own tariff',async()=>{
   const job='herreria';await f.patch(a,{rpg:{xp:{[job]:10000},mastery:{[job]:3}}});let stamp=await f.stamp();
   for(let i=0;i<36500;i++,stamp+=86400)if(cozyClient.stableHash(`rare|${cozyClient.dailyOrderDay(stamp)}|${job}`)%1000<5)break;
   const rows=await offers(job,stamp);assert.equal(rows.filter(o=>o.tier===5).length,1);const exceptional=rows.find(o=>o.tier===5);assert.equal(exceptional.reward,12150);assert.equal(exceptional.xp,1215);assert.equal(catalog.recipes[exceptional.recipe].source,'drop');assert.deepEqual(rows,cozyClient.commissionOffers(await f.data(a),job,stamp));
  });
  await t.test('a mid-day catalog update cannot reroll shared offers or replace their server snapshot',async()=>{
   await f.patch(a,{rpg:{xp:{encantamiento:0}}});await f.move(a,catalog.teachers.encantamiento);const original=await offers('encantamiento'),saved=(await f.db.query('select rpg from public.test_catalogs')).rows[0].rpg;
   const changed=structuredClone(saved);changed.recipes.zz_extra={...changed.recipes.componente_encantamiento_0,id:'zz_extra'};await f.db.query('update public.test_catalogs set rpg=$1',[changed]);
   assert.deepEqual(await offers('encantamiento'),original);const d=await f.action(a,'order_view',{job:'encantamiento',master:'maestro_encantamiento'});assert.deepEqual(cozyClient.commissionOffers(d,'encantamiento',await f.stamp()),original);await f.db.query('update public.test_catalogs set rpg=$1',[saved]);
  });
  await t.test('component rewards are 80 percent and batch claims stop at the remaining quota',async()=>{
   const b=await f.actor('Componentes');await f.move(b,catalog.teachers.encantamiento);await f.patch(b,{wallet:{pelines:0,lagrimas:0}});
   const rows=(await f.db.query('select public.game_order_offers($1,$2,$3) offers',[await f.data(b),'encantamiento',await f.stamp()])).rows[0].offers,o=rows[0];assert.equal(o.reward,40);assert.equal(o.xp,4);assert.deepEqual(Object.values(o.ingredients),[2]);
   for(let i=0;i<3;i++)await f.action(b,'order_accept',{id:o.id,job:'encantamiento',master:'maestro_encantamiento'});
   await f.patch(b,{inventory:slots({...await f.item(Object.keys(o.ingredients)[0],6),craftedBy:b.id})});let d=await f.data(b);
   await f.patch(b,{rpg:{dailyOrders:{...d.rpg.dailyOrders,completed:2}}});d=await f.action(b,'order_claim_all',{job:'encantamiento',master:'maestro_encantamiento'});assert.equal(d.wallet.pelines,40);assert.equal(d.rpg.dailyOrders.completed,3);assert.equal(d.rpg.dailyOrders.accepted.length,2);assert.equal(d.inventory[0].count,4);
  });
  await t.test('issuing teacher is mandatory and canceling preserves products and daily offers',async()=>{
   const b=await f.actor('Maestros');await f.move(b,catalog.teachers.encantamiento);const before=(await f.db.query('select public.game_order_offers($1,$2,$3) offers',[await f.data(b),'encantamiento',await f.stamp()])).rows[0].offers,o=before[0];
   let d=await f.action(b,'order_accept',{id:o.id,job:'encantamiento',master:'maestro_encantamiento'});const id=d.rpg.dailyOrders.accepted[0].acceptedId;await f.patch(b,{inventory:slots({...await f.item(Object.keys(o.ingredients)[0],2),craftedBy:b.id})});await f.move(b,catalog.teachers.herreria);
   await assert.rejects(f.action(b,'order_claim',{id,master:'isberto'}),/maestro/);const items=(await f.data(b)).inventory;d=await f.action(b,'order_cancel',{id});assert.deepEqual(d.inventory,items);assert.equal(d.rpg.dailyOrders.completed,0);assert.deepEqual((await f.db.query('select public.game_order_offers($1,$2,$3) offers',[d,'encantamiento',await f.stamp()])).rows[0].offers,before);
  });
 }finally{await f.close();}
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {aiFixture,PLAYER,SECOND} from './wilderness-ai-fixture.mjs';
import {wildernessPatch} from '../tools/build-wilderness-patch.mjs';

const catalog=JSON.parse(await readFile(new URL('../src/data/generated/wilderness.json',import.meta.url),'utf8'));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('authored population includes independent enemies and small explicit groups, all on connected safe cells',()=>{
 assert.equal(catalog.spawns.length,14);const groups=new Map();
 for(const site of catalog.spawns){
  const nav=catalog.habitats[site.habitat],cell=(p)=>Math.round((p.z-nav.origin[1])/nav.cell)*nav.width+Math.round((p.x-nav.origin[0])/nav.cell);
  assert.ok(nav.cells[cell(site)]);assert.ok(site.patrol.length>=2);
  for(const p of site.patrol)assert.ok(nav.cells[cell(p)]);
  for(const [id,links]of Object.entries(nav.cells))for(const next of links)assert.ok(nav.cells[next].includes(Number(id)),'navigation edges are symmetric');
  if(site.group)groups.set(site.group,[...(groups.get(site.group)??[]),site]);
 }
 assert.deepEqual([...groups.values()].map(g=>g.length).sort(),[2,2,3]);
 assert.equal(new Set(Object.values(catalog.enemies).map(d=>d.ai.behavior)).size,5);
});

test('SQL patrols move, pause, keep formations, and never fast-forward after a long absence',{timeout:60000},async()=>{
 const f=await aiFixture(catalog);try{
  const start=await f.mob('camino_1');await f.player(start.x+40,start.z);
  const seen=new Set(),positions=[];
  for(let i=0;i<90;i++){await f.step(.5);const m=await f.mob('camino_1');seen.add(m.activity);positions.push({x:m.x,z:m.z});assert.equal(m.status,'idle');assert.ok(distance(m,{x:m.homeX,z:m.homeZ})<9);}
  assert.ok(seen.has('patrol')&&seen.has('watch'));assert.ok(positions.some(p=>distance(p,start)>3));
  const follower=await f.mob('camino_1_vigia'),leader=await f.mob('camino_1');assert.ok(distance(follower,leader)<12);
  const before=await f.mob('camino_1');await f.step(600);const after=await f.mob('camino_1');assert.ok(distance(before,after)<=catalog.enemies.saqueador.ai.walkSpeed*.5+.001);
  assert.equal((await f.db.query('select count(*)::int n from wilderness_events')).rows[0].n,0);
 }finally{await f.close();}
});

test('SQL aggression, bounded group assistance, ranged backsteps and return use the real profiles',{timeout:60000},async()=>{
 const f=await aiFixture(catalog);try{
  const mob=await f.mob('camino_1');await f.player(mob.x-10,mob.z);await f.engage('camino_1');
  await f.step();await f.step();
  const group=await f.rows();for(const row of group.filter(r=>r.state.group==='cuadrilla_camino'))assert.ok(row.state.members[PLAYER]);
  assert.ok(group.find(r=>r.spawn==='camino_1').state.x<mob.x,'pursues a retreating player');
  assert.equal(group.find(r=>r.spawn==='camino_2').state.members[PLAYER],undefined,'assistance does not cross group boundaries');
  const sprout=await f.mob('camino_5');await f.player(sprout.x+1,sprout.z);await f.step();assert.equal((await f.mob('camino_5')).status,'idle','a defensive creature is safe to approach');
  const archer=await f.mob('camino_3');await f.player(archer.x+1,archer.z);await f.engage('camino_3');await f.set('camino_3',{enemyAttackAt:9999999999});await f.step();
  const back=await f.mob('camino_3');assert.equal(back.activity,'backstep');assert.ok(back.x<archer.x);
  await f.player(mob.x+80,mob.z);await f.player(mob.x+80,mob.z,SECOND);
  for(let i=0;i<35;i++)await f.step(.5);
  const home=await f.mob('camino_1');assert.equal(home.status,'idle');assert.deepEqual(home.members,{});assert.ok(distance(home,{x:home.homeX,z:home.homeZ})<9);
 }finally{await f.close();}
});

test('SQL routes walk around missing cells and return without teleporting through an obstacle',{timeout:60000},async()=>{
 const nav={origin:[0,0],cell:2,width:5,cells:{}};
 for(let z=0;z<5;z++)for(let x=0;x<5;x++)if(x!==2||z===4)nav.cells[z*5+x]=[];
 for(const id of Object.keys(nav.cells).map(Number))for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=id%5+dx,z=Math.floor(id/5)+dz,n=z*5+x;if(x>=0&&x<5&&z>=0&&z<5&&nav.cells[n])nav.cells[id].push(n);}
 const custom={...catalog,habitats:{test:nav},spawns:[{id:'test',enemy:'saqueador',habitat:'test',x:0,z:0,patrol:[]}]};
 const f=await aiFixture(custom);try{
  await f.player(8,0);await f.player(55,55,SECOND);await f.engage('test');const track=[];
  for(let i=0;i<90;i++){await f.step(.25);const m=await f.mob('test');track.push(m);if(m.windup)break;}
  assert.ok(track.some(m=>m.z>=7.5),'uses the only gap in the wall');assert.ok(track.at(-1).x>=5.9,JSON.stringify(track.map(m=>({x:m.x,z:m.z,status:m.status,blocked:m.blockedAt,route:m.route?.length})).filter((m,i)=>i%4===0)));
  for(let i=1;i<track.length;i++)assert.ok(distance(track[i],track[i-1])<1.4,'movement remains continuous');
  await f.player(70,0);for(let i=0;i<100;i++)await f.step(.25);
  const home=await f.mob('test');assert.equal(home.status,'idle');assert.ok(distance(home,{x:0,z:0})<.2);
 }finally{await f.close();}
});

test('heavy strike has a longer preparation and recovery, hits only its opponent, and respawn clears behavior',{timeout:60000},async()=>{
 const f=await aiFixture(catalog);try{
  const initial=await f.mob('camino_2');await f.player(initial.x+1,initial.z);await f.player(initial.x+1,initial.z,SECOND);await f.engage('camino_2');await f.set('camino_2',{attackSeq:2,enemyAttackAt:0});await f.step();
  const prepared=await f.mob('camino_2'),stamp=Number((await f.db.query('select extract(epoch from public.test_now()) s')).rows[0].s);
  assert.equal(prepared.attackStyle,'heavy');assert.ok(prepared.windup-stamp>.6);
  await f.step(.5);assert.equal((await f.mob('camino_2')).attackSeq,2);await f.step(.25);
  const hits=(await f.db.query("select * from wilderness_events where instance_id=$1 and kind='damage'",[initial.instanceId])).rows;
  assert.equal(hits.length,1);assert.equal(hits[0].character_id,PLAYER);assert.equal(hits[0].payload.amount,catalog.enemies.salteador.damage*1.35);
  const old=await f.mob('camino_2');await f.set('camino_2',{status:'defeated',health:0,respawnAt:0,members:{},windup:null});await f.player(initial.x+40,initial.z);await f.player(initial.x+40,initial.z,SECOND);await f.step();
  const fresh=await f.mob('camino_2');assert.notEqual(fresh.instanceId,old.instanceId);assert.equal(fresh.health,fresh.maxHealth);assert.equal(fresh.status,'idle');assert.equal(fresh.attackSeq,0);assert.equal(fresh.windup,undefined);
 }finally{await f.close();}
});

test('shared deaths respect each spawn timer and never shorten an already defeated generation',{timeout:60000},async()=>{
 const f=await aiFixture(catalog);try{
  for(const site of catalog.spawns){
   const stamp=Number((await f.db.query('select extract(epoch from public.test_now()) s')).rows[0].s);
   const initial=await f.mob(site.id);
   const dead=(await f.db.query("select public.game_wilderness_finish($1::jsonb) m",[{...initial,health:0}])).rows[0].m;
   assert.equal(Number(dead.respawnAt)-stamp,site.respawn,site.id);
   await f.set(site.id,dead);await f.step(site.respawn-1);
   assert.equal((await f.mob(site.id)).instanceId,initial.instanceId,'no early respawn');
   const again=(await f.db.query('select public.game_wilderness_finish($1::jsonb) m',[dead])).rows[0].m;
   assert.equal(again.respawnAt,dead.respawnAt,'repeated finish does not extend the timer');
   await f.step(1);assert.notEqual((await f.mob(site.id)).instanceId,initial.instanceId,'respawns at the configured boundary');
  }
 }finally{await f.close();}
});

test('the reviewable migration compiles, is repeatable and preserves active generations, health and player data',{timeout:60000},async()=>{
 const f=await aiFixture(catalog);try{
  await f.db.exec('create role anon;create role authenticated;');
  await f.db.exec("do $$declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'game_wilderness_%' loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);end loop;end$$;");
  await f.engage('camino_1');await f.set('camino_1',{health:20});const old=await f.mob('camino_1');
  await f.db.exec("update wilderness_mobs set state=state-'habitat'-'group'-'leader'-'variant' where spawn in ('camino_1','camino_2','camino_3','camino_4','camino_5')");
  const players=(await f.db.query('select * from characters order by id')).rows;
  await f.db.exec(wildernessPatch());await f.db.exec(wildernessPatch());
  const after=await f.mob('camino_1');assert.equal(after.instanceId,old.instanceId);assert.equal(after.health,20);assert.equal(after.status,'active');assert.deepEqual(after.members,old.members);
  assert.equal((await f.rows()).length,catalog.spawns.length);assert.deepEqual((await f.db.query('select * from characters order by id')).rows,players);
  const navigation=(await f.db.query("select spawn,jsonb_array_length(public.game_wilderness_route(state,(state->>'homeX')::numeric,(state->>'homeZ')::numeric)) nodes from wilderness_mobs")).rows;
  assert.ok(navigation.every(row=>row.nodes>0),'Legacy creatures receive their habitat immediately, before any player sync');
  const exposed=(await f.db.query("select proname from pg_proc where proname like 'game_wilderness_%' and has_function_privilege('anon',oid,'EXECUTE')")).rows;assert.deepEqual(exposed,[]);
 }finally{await f.close();}
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {createServer} from 'vite';
import * as THREE from 'three';

let sequence=0;
async function moduleWith(file,bindings={},transform=source=>source){
 const key=`clientPerformance${sequence++}`;globalThis[key]=bindings;
 const source=transform(ts.transpileModule(await readFile(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^import .*;\r?$/gm,''));
 const prefix=Object.keys(bindings).length?`const {${Object.keys(bindings).join(',')}}=globalThis[${JSON.stringify(key)}];`:'';
 return import(`data:text/javascript;base64,${Buffer.from(prefix+source).toString('base64')}`);
}

test('closing one friends observer preserves the in-flight read and the remaining subscriber',async()=>{
 let complete,calls=0;const received=[];
 const friends=await moduleWith('src/services/friends.ts',{listFriends:()=>{calls++;return new Promise(resolve=>complete=resolve);}});
 const stopNotifications=friends.observeFriends(value=>received.push(value));
 const stopPanel=friends.observeFriends(()=>assert.fail('A closed panel must not receive a response'));
 const first=friends.readFriends();stopPanel();const second=friends.readFriends();
 assert.equal(first,second);assert.equal(calls,1);
 const entries=[{userId:'friend',status:'incoming'}];complete(entries);await second;
 assert.deepEqual(received,[entries]);stopNotifications();
});

test('a player waiting for equipment still counts as present and cannot return after the session closes',async()=>{
 let complete;
 const {RemotePlayers}=await moduleWith('src/world/players.ts',{characterModelsReady:()=>false,loadCharacterModels:()=>new Promise(resolve=>complete=resolve)});
 const players=new RemotePlayers({},()=>0,()=>null);
 players.receive([{id:'pending-player',data:{}}]);
 assert.equal(players.count(),1);assert.equal(players.list().length,0);
 players.clear();complete();for(let i=0;i<8;i++)await Promise.resolve();
 assert.equal(players.count(),0);assert.equal(players.list().length,0);
});

test('remote player locomotion receives measured speed and stops animating on death',async()=>{
 let now=0;
 const characters=[];
 class Character{
  constructor(){this.root=new THREE.Group();this.speeds=[];this.gaits=[];characters.push(this);}
  setLocomotionSpeed(speed){this.speeds.push(speed);}
  setGait(gait){this.gaits.push(gait);}
  setSwimming(){}
  jump(){}
  wave(){}
  die(){}
  revive(){}
  attack(){}
 }
 const element=()=>({classList:{add(){}},dataset:{},style:{},hidden:false,append(){},setAttribute(){},remove(){}});
 const previousDocument=globalThis.document;
 globalThis.document={createElement:element,body:{append(){}}};
 try{
  const {RemotePlayers}=await moduleWith('src/world/players.ts',{
   THREE,Character,characterModelsReady:()=>true,loadCharacterModels:async()=>{},
   TITLES:{none:{label:'None'}},isReservedTitle:()=>false,PHOENIX_ICON:'',t:value=>value,
   castShadows:()=>{},performance:{now:()=>now},
  });
  const players=new RemotePlayers(new THREE.Scene(),()=>0,()=>null);
  const player=(x,dead=false)=>({id:'remote',data:{name:'Traveler',title:'none',height:.5},position:{x,z:0},facing:0,dead,jump:0,wave:0});
  players.receive([player(0)]);
  const character=characters[0];
  now=1000;
  players.receive([player(2.4)]);
  assert.deepEqual(character.speeds,[2.4]);
  assert.deepEqual(character.gaits,['walk']);
  now=2000;
  players.receive([player(2.4,true)]);
  assert.equal(character.speeds.at(-1),0);
  assert.equal(character.gaits.at(-1),'idle');
 }finally{
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
 }
});

test('released texture palettes remain bounded and shared live palettes cannot be disposed',async()=>{
 const {RetainedCache}=await moduleWith('src/character/retainedCache.ts');
 const cache=new RetainedCache(2);let disposed=0;
 const shared={dispose:()=>disposed++};cache.set('shared',shared);cache.retain(shared);cache.retain(shared);
 for(let i=0;i<100;i++){cache.set('unused'+i,{dispose:()=>disposed++});cache.trim();}
 assert.deepEqual(cache.stats(),{entries:3,active:1,unused:2,unusedLimit:2});assert.equal(disposed,98);
 cache.release(shared);cache.trim();assert.equal(cache.get('shared'),shared);
 cache.release(shared);cache.trim();assert.equal(cache.stats().unused,2);
 cache.set('new1',{dispose:()=>disposed++});cache.set('new2',{dispose:()=>disposed++});cache.trim();
 assert.equal(cache.get('shared'),undefined);assert.equal(cache.stats().entries,2);
});

test('simultaneous equipment requests share a load and a failed download can be retried',async()=>{
 let calls=0,complete,fail;
 const models=await moduleWith('src/character/weaponModels.ts',{
  modelFiles:{'../assets/models/items/tier1/example.glb':'/assets/example.glb'},
  loadGLB:()=>{calls++;return new Promise((resolve,reject)=>{complete=resolve;fail=reject;});},
 },source=>source.replace(/const files = import\.meta\.glob\([^;]+;/,'const files = modelFiles;'));
 const first=models.loadWeaponModels(['example']),second=models.loadWeaponModels(['example']);
 assert.equal(calls,1);const rejected=Promise.allSettled([first,second]);fail(Error('Temporary download failure'));await rejected;
 assert.equal(models.weaponModelsReady(['example']),false);
 const retry=models.loadWeaponModels(['example']);assert.equal(calls,2);
 complete({scene:{name:'loaded'}});await retry;
 assert.equal(models.weaponModelsReady(['example']),true);assert.equal(models.weaponModel('example').name,'loaded');
  await models.loadWeaponModels(['__proto__','constructor']);assert.equal(calls,2,'Prototype names are not asset URLs');
});

test('GLB download/decoding concurrency stays bounded and failures release their slot',async()=>{
 let started=0;const pending=[];
 class Loader{register(){}parseAsync(){started++;return new Promise((resolve,reject)=>pending.push({resolve,reject}));}}
 const models=await moduleWith('src/world/load.ts',{GLTFLoader:Loader});
 const requests=Array.from({length:14},()=>models.loadGLB('data:model/gltf-binary;base64,AAAA'));
 const results=Promise.allSettled(requests);
 assert.equal(started,6);
 pending.shift().reject(Error('Malformed model'));
 for(let round=0;round<8;round++){for(const p of pending.splice(0))p.resolve({scene:{}});for(let i=0;i<10;i++)await Promise.resolve();}
 const settled=await results;
 assert.equal(started,14);assert.equal(settled.filter(r=>r.status==='fulfilled').length,13);
});

test('nearby resource queries preserve boundaries, respawns, energy labels and live furniture',{timeout:30000},async()=>{
 const server=await createServer({configFile:false,logLevel:'error',server:{middlewareMode:true,hmr:false,watch:null}});
 try{
  await server.ssrLoadModule('/src/data/data.ts');
  const {professionInteractions}=await server.ssrLoadModule('/src/world/professionWorld.ts');
  const {RPG_CATALOG,professionState}=await server.ssrLoadModule('/src/data/professions.ts');
  let heights=0;const city={locationId:'pompelin',groundY:()=>{heights++;return 2;}};
  const state=professionState(undefined),nodes=Object.values(RPG_CATALOG.nodes).filter(n=>n.location==='pompelin');
  for(const node of nodes){
   const near={x:node.x,z:node.z};
   const expected=nodes.filter(n=>(n.x-near.x)**2+(n.z-near.z)**2<=2.8**2).map(n=>'resource:'+n.id).sort();
   assert.deepEqual(professionInteractions(city,state,near).map(n=>n.id).sort(),expected);
  }
  const near={x:nodes[0].x,z:nodes[0].z};heights=0;
  for(let i=0;i<1000;i++)professionInteractions(city,state,near);
  assert.equal(heights,0,'Cached static heights are reused on every frame');
  state.nodes[nodes[0].id]=Date.now()/1000+60;
  assert.ok(!professionInteractions(city,state,near).some(n=>n.id==='resource:'+nodes[0].id));
  state.nodes[nodes[0].id]=0;
  assert.ok(professionInteractions(city,state,near).some(n=>n.id==='resource:'+nodes[0].id));
  const advanced=nodes.find(n=>n.tier===5),advancedNear={x:advanced.x,z:advanced.z};
  const label=professionInteractions(city,state,advancedNear).find(n=>n.id==='resource:'+advanced.id).label;
  state.xp[advanced.job]=10000;
  assert.notEqual(professionInteractions(city,state,advancedNear).find(n=>n.id==='resource:'+advanced.id).label,label,'Cached positions do not freeze energy costs after progression');
  const furniture={id:'desk',item:{id:'mueble_mesa_0',count:1},job:'herreria',location:'pompelin',x:near.x,z:near.z,yaw:0};state.furniture.push(furniture);
  assert.ok(professionInteractions(city,state,near).some(n=>n.id==='station:herreria'));
  furniture.x+=10;assert.ok(!professionInteractions(city,state,near).some(n=>n.id==='station:herreria'));
 }finally{await server.close();}
});

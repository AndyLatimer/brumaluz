import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';
import {Vector3, Scene, Group} from 'three';

async function moduleUrl(path,transform=s=>s){
  const source=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022},
  }).outputText.replace("'three'",JSON.stringify(import.meta.resolve('three')));
  return `data:text/javascript;base64,${Buffer.from(transform(source)).toString('base64')}`;
}
async function load(path,transform){return import(await moduleUrl(path,transform));}
const {storyPath}=await load('../src/world/storyPath.ts');
const {shadowObjective,ISBERTO_HOUSE}=await load('../src/data/quests.ts');
const point=(x,z)=>new Vector3(x,0,z);

test('story NPCs plan a walk around obstacles using player collisions',()=>{
  const blocked=p=>p.x>1&&p.x<4&&Math.abs(p.z)<1.5;
  const city={groundY:()=>0,collide:(from,to)=>blocked(to)?from.clone():to};
  const start=point(0,0),goal=point(5,0),route=storyPath(city,start,goal);
  assert.ok(route.length>1,'The route detours around the solid wall');
  assert.ok(route.at(-1).distanceTo(goal)<.001);
  let previous=start;
  for(const next of route){
    const steps=Math.ceil(previous.distanceTo(next)/.05);
    for(let i=1;i<=steps;i++)assert.equal(blocked(previous.clone().lerp(next,i/steps)),false);
    previous=next;
  }
});
test('an unreachable story destination never creates a teleport waypoint',()=>{
  const city={groundY:()=>0,collide:(from,to)=>to.length()>.1?from.clone():to};
  assert.deepEqual(storyPath(city,point(0,0),point(5,0)),[]);
});
test('clear walks keep ground heights and the exact destination',()=>{
  const city={groundY:x=>x/5,collide:(_from,to)=>to};
  const route=storyPath(city,point(0,0),new Vector3(5,1,0));
  assert.equal(route.length,1);assert.equal(route[0].y,1);
});
test('the quest distinguishes the corpse, the homeward walk and the house conversation',()=>{
  assert.match(shadowObjective('defeated',false),/Registra/);
  assert.match(shadowObjective('defeated',true),/Habla con Isberto/);
  assert.match(shadowObjective('returning',true),/Sigue/);
  assert.match(shadowObjective('returning',true,ISBERTO_HOUSE),/cama y el cofre/);
});

const questsUrl=await moduleUrl('../src/data/quests.ts'),pathUrl=await moduleUrl('../src/world/storyPath.ts');
const {createWelcomeWorld}=await load('../src/world/welcome.ts',s=>s
  .replace("'../data/quests'",JSON.stringify(questsUrl)).replace("'./storyPath'",JSON.stringify(pathUrl)));
test('Gnomi consumes reached waypoints on slopes and continues following',()=>{
  const root=new Group(),scene=new Scene();
  const character={root,attachToChest:o=>root.add(o),setGait(){},update(){},hop(){},speak(){},wave(){},dispose(){}};
  const city={groundY:x=>x*.5,collide:(_from,to)=>to};
  const gnomi=createWelcomeWorld(scene,city,character,'Gnomi');
  for(let frame=0;frame<600;frame++){
    const x=Math.min(8,frame*.05),player=new Vector3(x,city.groundY(x),0);
    gnomi.update({origin:0,stage:'active'},true,player,1/60,frame/60);
  }
  assert.ok(gnomi.root.position.x>6,'A height difference must not trap an already reached waypoint: '+gnomi.root.position.x);
  assert.equal(gnomi.root.userData.gait,'idle','Gnomi rests once he has caught up');
  gnomi.dispose();
});

test('Gnomi can search and greet at the end of his approach without jumping to his waiting position',()=>{
  const root=new Group(),gestures=[];
  const character={root,attachToChest:o=>root.add(o),setGait(){},update(){},hop(){},speak(){},
    pickUp:scripted=>gestures.push(['search',scripted]),wave:()=>gestures.push(['greet']),dispose(){}};
  const city={groundY:()=>0,collide:(_from,to)=>to};
  const gnomi=createWelcomeWorld(new Scene(),city,character,'Gnomi'),player=point(156.5,0);
  gnomi.place(point(143.5,2.2),0);
  gnomi.search();
  gnomi.walkTo(point(153.5,0),1.8,true);
  for(let frame=0;frame<480;frame++)gnomi.update({origin:null,stage:'available'},true,player,1/60,frame/60);
  assert.equal(gnomi.arrived,true);
  const arrived=gnomi.root.position.clone();
  gnomi.walkTo(arrived,0);
  gnomi.greet();
  for(let frame=0;frame<120;frame++)gnomi.update({origin:null,stage:'available'},true,player,1/60,8+frame/60);
  assert.deepEqual(gestures,[['search',true],['greet']]);
  assert.ok(gnomi.root.position.distanceTo(arrived)<1e-8,'The greeting retains the position actually reached');
  assert.equal(gnomi.root.userData.gait,'idle');
  gnomi.release();gnomi.dispose();
});

test('the personal Gnomi marker leaves his meeting point reachable while fixed NPCs remain solid',async()=>{
  const {createServer}=await import('vite');
  const server=await createServer({configFile:false,logLevel:'error',server:{middlewareMode:true}});
  try{
    const maps=await server.ssrLoadModule('/src/data/maps.ts');
    const runtime=await server.ssrLoadModule('/src/world/mapRuntime.ts');
    const map=maps.newMap('llegada','Llegada');
    const marker=(npcId,x)=>({id:`npc_${npcId}`,type:'npc',name:npcId,npcId,layer:map.layers[0].id,position:[x,0,0],rotationY:0,radius:1});
    map.markers.push(marker('gnomi',0),marker('testiculos',4));
    const collision=runtime.buildCollision(map,new runtime.TerrainField(maps.decodeTerrain(map.terrain)),new Map());
    assert.ok(collision.collide(point(-3,0),point(0,0)).distanceTo(point(0,0))<.001,'Gnomi can walk onto his own marker');
    assert.ok(storyPath(collision,point(-3,0),point(0,0)).length>0,'The arrival planner finds a route to the meeting point');
    assert.ok(collision.collide(point(2,0),point(4,0)).distanceTo(point(4,0))>.8,'Ordinary NPCs keep their body collision');
  }finally{await server.close();}
});

// Small DOM stand-in: these checks exercise the actual controller without a renderer or a timer.
class Element {
  hidden=false;dataset={};children=new Map();listeners=new Map();classList={add(){},remove(){},toggle(){}};
  querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Element());return this.children.get(selector);}
  append(child){this.lastChild=child;} addEventListener(type,callback){this.listeners.set(type,callback);} setAttribute(){}
  removeEventListener(type,callback){if(this.listeners.get(type)===callback)this.listeners.delete(type);}
  remove(){this.removed=true;}
  focus(){document.activeElement=this;}
  contains(node){return this===node||[...this.children.values()].some(child=>child.contains(node));}
}
globalThis.document={createElement:()=>new Element(),body:new Element()};
const {createCinematics}=await load('../src/world/cinematic.ts',s=>s.replace(/import \{ t \} from ['"]\.\.\/ui\/i18n['"];?/, 'const t = s => s;'));
test('leaving or replacing a cinematic cancels its continuation; user skipping finishes exactly once',()=>{
  const controller=createCinematics(),events=[];
  controller.play([{duration:2}],()=>events.push('cancelled'));
  controller.cancel();controller.skip();controller.frame(10);
  assert.deepEqual(events,[]);assert.equal(controller.active,false);
  controller.play([{duration:2}],()=>events.push('replaced'));
  controller.play([{duration:2}],skipped=>events.push(skipped));
  controller.skip();controller.skip();controller.frame(10);
  assert.deepEqual(events,[true]);assert.equal(controller.active,false);
});
test('cinematics initialise their render focus and honour a shot minimum',()=>{
  const controller=createCinematics(),events=[];
  controller.play([{duration:3,minimum:1,update:()=>true,camera:()=>({position:point(1,0),target:point(4,0)})}],skipped=>events.push(skipped));
  assert.equal(controller.focus.x,4);assert.equal(controller.scriptedCamera,true);
  controller.frame(.5);assert.equal(controller.active,true);
  controller.frame(.5);assert.deepEqual(events,[false]);assert.equal(controller.active,false);
});

test('cancelling and replacing scenes cleans their resources once without running story progress',()=>{
  const controller=createCinematics(),events=[];
  controller.play([{duration:2}],()=>events.push('progress'),()=>events.push('cleanup'));
  controller.cancel();controller.cancel();controller.skip();
  assert.deepEqual(events,['cleanup']);
  controller.play([{duration:2}],()=>events.push('old progress'),()=>events.push('replace cleanup'));
  controller.play([{duration:1}],skipped=>events.push(skipped),()=>events.push('new cleanup'));
  controller.frame(1);
  assert.deepEqual(events,['cleanup','replace cleanup',false]);
});

test('a start or update callback can change scenes without the old frame finishing the new one',()=>{
  const controller=createCinematics(),events=[];
  const camera=target=>()=>({position:point(1,0),target:point(target,0)});
  controller.play([{duration:.1,start:()=>controller.play([{duration:2,camera:camera(8)}],()=>events.push('new')),camera:camera(3)}],()=>events.push('old'));
  assert.equal(controller.focus.x,8,'The stale start must not overwrite the replacement camera focus');
  controller.cancel();
  controller.play([{duration:.1,update:()=>{controller.play([{duration:2,camera:camera(9)}],()=>events.push('next'));return true;},camera:camera(3)}],()=>events.push('stale'));
  assert.equal(controller.frame(.5),null);
  assert.equal(controller.active,true);assert.equal(controller.focus.x,9);assert.deepEqual(events,[]);
  controller.frame(1);assert.equal(controller.active,true);
  controller.frame(1);assert.deepEqual(events,['next']);
});

test('ending a scene hands the same frame to its dialogue and invalid clocks cannot poison the camera',()=>{
  const controller=createCinematics();let finished=0;
  controller.play([{duration:1,camera:k=>({position:point(k,0),target:point(1,0)})}],()=>finished++);
  assert.equal(controller.frame(NaN).position.x,0);
  assert.equal(controller.frame(-1).position.x,0);
  assert.equal(controller.frame(1),null,'The old camera cannot override a dialogue started on completion');
  assert.equal(finished,1);
  controller.play([{duration:NaN}],()=>finished++);controller.frame(.1);
  assert.equal(controller.active,false);assert.equal(finished,2);
});

test('the skip button works with Enter despite the gameplay input lock',()=>{
  const controller=createCinematics();let finished=0,prevented=0,stopped=0;
  controller.play([{duration:10}],()=>finished++);
  const button=document.body.lastChild.querySelector('.cinematic-skip');
  button.listeners.get('keydown')({code:'Enter',repeat:false,preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
  assert.equal(finished,1);assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(controller.active,false);
});

test('disposing for a module reload removes the old overlay and listeners without advancing the story',()=>{
  const controller=createCinematics(),events=[];
  controller.play([{duration:10,line:{speaker:'Isberto',text:'A'}}],()=>events.push('progress'),()=>events.push('cleanup'));
  const oldRoot=document.body.lastChild,oldButton=oldRoot.querySelector('.cinematic-skip');
  controller.dispose();controller.dispose();
  assert.equal(oldRoot.removed,true);assert.equal(oldButton.listeners.size,0);
  assert.equal(controller.active,false);assert.equal(controller.frame(20),null);
  controller.play([{duration:1}],()=>events.push('stale'));
  assert.equal(controller.active,false);assert.deepEqual(events,['cleanup']);
  const replacement=createCinematics();
  replacement.play([{duration:1}],()=>events.push('new'));
  assert.notEqual(document.body.lastChild,oldRoot);
  replacement.frame(1);assert.deepEqual(events,['cleanup','new']);
  replacement.dispose();
});

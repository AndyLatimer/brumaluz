import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const compiled=ts.transpileModule(await readFile(new URL('../src/services/multiplayer.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const source=compiled.slice(compiled.indexOf('export class WorldConnection'));
let sequence=0;
async function fixture(sync,time){
 const key=`worldCadence${sequence++}`;globalThis[key]={syncWorld:sync,joinWorld:async()=>({}),leaveWorld:async()=>{},time};
 const code=`const {syncWorld,joinWorld,leaveWorld,time}=globalThis[${JSON.stringify(key)}];const performance=time??globalThis.performance;const setTimeout=time?.setTimeout??globalThis.setTimeout;const clearTimeout=time?.clearTimeout??globalThis.clearTimeout;const snapshot=value=>value;${source}`;
 return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).WorldConnection;
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const hooks={motion:()=>({x:0,z:0,yaw:0,facing:0,jump:0,wave:0}),receive:()=>{},stale:()=>{},connection:()=>{},replaced:()=>{}};

test('world synchronization includes network time in its 250 ms budget and never overlaps',{timeout:5000},async()=>{
 const starts=[],time=virtualTime();let pending=0,maximum=0;
 const Connection=await fixture(async()=>{starts.push(time.now());maximum=Math.max(maximum,++pending);await new Promise(resolve=>time.setTimeout(resolve,80));pending--;return {};},time);
 const connection=new Connection('character',hooks);await connection.join();connection.start();await time.advance(610);
 const sampled=[...starts];await connection.stop();
 assert.equal(sampled.length,3,'80 ms of RTT does not add an 80 ms pause to every 250 ms world step');
 assert.deepEqual(sampled,[0,250,500]);
 assert.equal(maximum,1);
});

function virtualTime(){
 let now=0,sequence=0;const tasks=new Map();
 const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 return {now:()=>now,setTimeout:(fn,ms)=>{const id=sequence++;tasks.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>tasks.delete(id),
  async advance(ms){const end=now+ms;await settle();while(true){const next=[...tasks.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;tasks.delete(next[0]);next[1].fn();await settle();}now=end;await settle();},
 };
}

test('one failed heartbeat recovers without reporting a lost connection',async()=>{
 const time=virtualTime(),statuses=[];let calls=0;
 const Connection=await fixture(async()=>{if(++calls===1)throw {message:'Failed to fetch'};return {};},time);
 const connection=new Connection('character',{...hooks,connection:s=>statuses.push(s)});
 await connection.join();connection.start();await time.advance(1000);
 assert.deepEqual(statuses,['connected']);assert.equal(connection.diagnostics().failedRequests,1);
 assert.equal(connection.diagnostics().consecutiveFailures,0);await connection.stop();
});

test('persistent failures report an interruption, expire actors once, back off and recover',async()=>{
 const time=virtualTime(),statuses=[];let failed=true,stale=0,calls=0;
 const Connection=await fixture(async()=>{calls++;if(failed)throw {message:'Network unavailable'};return {};},time);
 const connection=new Connection('character',{...hooks,connection:s=>statuses.push(s),stale:()=>stale++});
 await connection.join();connection.start();await time.advance(24000);
 assert.deepEqual(statuses,['connected','retrying']);assert.equal(stale,1);assert.ok(calls<12,'An outage must not flood the server');
 failed=false;await time.advance(4000);
 assert.deepEqual(statuses,['connected','retrying','connected']);assert.equal(connection.diagnostics().lastError,null);
 await connection.stop();
});

test('plain PostgREST session errors end the old connection instead of retrying forever',async()=>{
 const time=virtualTime();let replaced=0,calls=0;
 const Connection=await fixture(async()=>{calls++;throw {message:'WORLD_SESSION_REPLACED',code:'P0001'};},time);
 const connection=new Connection('character',{...hooks,replaced:()=>replaced++});
 await connection.join();connection.start();await time.advance(30000);
 assert.equal(replaced,1);assert.equal(calls,1);await connection.stop();
});

test('closing a stalled connection aborts its pending sync instead of waiting for an unbounded promise',{timeout:5000},async()=>{
 let calls=0;
 const Connection=await fixture((_id,_session,_motion,signal)=>{calls++;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));});
 const connection=new Connection('character',hooks);await connection.join();connection.start();await pause(20);
 const before=performance.now();await connection.stop();
 assert.ok(performance.now()-before<1800);assert.equal(calls,1,'A stalled sync is aborted without sending another movement request behind it');
});

test('leaving drains a healthy heartbeat and skips an already acknowledged final position',{timeout:5000},async()=>{
 let calls=0,active=0,maximum=0;
 const Connection=await fixture(async()=>{calls++;maximum=Math.max(maximum,++active);await pause(100);active--;return {};});
 const connection=new Connection('character',hooks);await connection.join();connection.start();await pause(20);await connection.stop();
 assert.equal(calls,1);assert.equal(maximum,1);
});

test('leaving sends changed final coordinates after the pending heartbeat finishes',{timeout:5000},async()=>{
 let x=0,active=0,maximum=0;const sent=[];
 const Connection=await fixture(async(_id,_session,motion)=>{sent.push(motion.x);maximum=Math.max(maximum,++active);await pause(80);active--;return {};});
 const connection=new Connection('character',{...hooks,motion:()=>({...hooks.motion(),x})});
 await connection.join();connection.start();await pause(20);x=1;await connection.stop();
 assert.deepEqual(sent,[0,1]);assert.equal(maximum,1);
});

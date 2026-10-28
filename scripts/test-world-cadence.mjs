import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const compiled=ts.transpileModule(await readFile(new URL('../src/services/multiplayer.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const source=compiled.slice(compiled.indexOf('export class WorldConnection'));
let sequence=0;
async function fixture(sync){
 const key=`worldCadence${sequence++}`;globalThis[key]={syncWorld:sync,joinWorld:async()=>({}),leaveWorld:async()=>{}};
 const code=`const {syncWorld,joinWorld,leaveWorld}=globalThis[${JSON.stringify(key)}];const snapshot=value=>value;${source}`;
 return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).WorldConnection;
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const hooks={motion:()=>({x:0,z:0,yaw:0,facing:0,jump:0,wave:0}),receive:()=>{},stale:()=>{},connection:()=>{},replaced:()=>{}};

test('world synchronization includes network time in its 250 ms budget and never overlaps',{timeout:5000},async()=>{
 const starts=[];let pending=0,maximum=0;
 const Connection=await fixture(async()=>{starts.push(performance.now());maximum=Math.max(maximum,++pending);await pause(80);pending--;return {};});
 const connection=new Connection('character',hooks);await connection.join();connection.start();await pause(610);
 const sampled=[...starts];await connection.stop();
 assert.equal(sampled.length,3,'80 ms of RTT does not add an 80 ms pause to every 250 ms world step');
 for(let i=1;i<sampled.length;i++)assert.ok(sampled[i]-sampled[i-1]<300);
 assert.equal(maximum,1);
});

test('closing a stalled connection aborts its pending sync instead of waiting for an unbounded promise',{timeout:5000},async()=>{
 let calls=0;
 const Connection=await fixture((_id,_session,_motion,signal)=>{calls++;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));});
 const connection=new Connection('character',hooks);await connection.join();connection.start();await pause(20);
 const before=performance.now();await connection.stop();
 assert.ok(performance.now()-before<1800);assert.equal(calls,2,'Only the current sync and one bounded final-position send are attempted');
});

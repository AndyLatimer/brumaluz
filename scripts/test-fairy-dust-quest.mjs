import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';

async function load(path){
  const source=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const {parseFairyDustQuest}=await load('../src/data/quests.ts');
const {currentQuest,createQuestTracking}=await load('../src/ui/questTracking.ts');

test('dust quest saves only the discovery and Arboleda lead, without inventing a completed continuation',()=>{
  assert.equal(parseFairyDustQuest(undefined),null);
  for(const phase of ['ask_gnomi','arboleda'])assert.equal(parseFairyDustQuest(phase),phase);
  for(const phase of ['completed','arrived',{},true])assert.throws(()=>parseFairyDustQuest(phase));
});

test('dust tracking works without welcome and preserves the priority of mandatory quests',()=>{
  const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  const data={welcome:null,shadowQuest:null,fairyDustQuest:'ask_gnomi'};
  let character='hero-a';const tracking=createQuestTracking(()=>character);
  assert.equal(currentQuest(data),'fairy-dust');assert.equal(tracking.current(data),'fairy-dust');
  data.welcome={origin:0,stage:'active'};
  assert.equal(tracking.current(data),'welcome');
  tracking.toggle('welcome');assert.equal(tracking.current(data),'fairy-dust');
  data.welcome.stage='completed';assert.equal(tracking.current(data),'shadow');
  data.shadowQuest='returned';assert.equal(tracking.current(data),'fairy-dust');
  data.fairyDustQuest='arboleda';assert.equal(tracking.current(data),'fairy-dust');
  tracking.toggle('fairy-dust');assert.equal(tracking.current(data),null);
  assert.equal(createQuestTracking(()=>character).isTracked('fairy-dust'),false);
  character='hero-b';assert.equal(tracking.isTracked('fairy-dust'),true);
});

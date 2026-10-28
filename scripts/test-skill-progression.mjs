// Isolated client/SQL parity: never connects to the configured database.
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import {build} from 'esbuild';

const bundle = await build({stdin:{contents:"export * from './src/data/combat';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const game = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const modulePath = process.env.PGLITE_TEST_MODULE ?? join(tmpdir(),'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
let sqlAvailable = true; try { await access(modulePath); } catch { sqlAvailable = false; }

test('all classes can improve once per level, finish at five and retain existing ranks and spare points',()=>{
  for (let level=1;level<=50;level++) assert.equal(game.skillPointsAllowed(level),level-1);
  assert.equal(game.skillPointsAllowed(99),49);
  for (const [cls,kit] of Object.entries(game.COMBAT_KITS)) {
    const data={cls,level:1,skillRanks:{}};
    assert.throws(()=>game.upgradeSkill(data,kit.skill.id,1),/nivel/);
    for(let rank=1;rank<5;rank++) {
      data.level=rank+1;
      assert.equal(game.skillRankLevel(rank+1),data.level);
      assert.equal(game.unspentSkillPoints(data),1);
      game.upgradeSkill(data,kit.skill.id,rank);
      assert.equal(game.skillRank(data),rank+1);
      assert.equal(game.unspentSkillPoints(data),0);
      assert.throws(()=>game.upgradeSkill(data,kit.skill.id,rank),/cambiado/);
      if(rank<4) assert.throws(()=>game.upgradeSkill(data,kit.skill.id,rank+1),/nivel/);
    }
    assert.throws(()=>game.upgradeSkill(data,kit.skill.id,5),/máximo/);
    assert.equal(game.unspentSkillPoints({...data,level:50}),45);
    assert.equal(game.skillRank({...data,level:2}),2);
    assert.equal(game.skillRank({...data,level:8}),5);
    assert.equal(game.unspentSkillPoints({...data,level:8}),3);
  }
});

test('authoritative SQL agrees with client progression and rejects stale or invalid upgrades',{skip:!sqlAvailable,timeout:60000},async()=>{
  const {PGlite}=await import(pathToFileURL(modulePath).href),db=new PGlite();
  const formulas=await readFile(new URL('../supabase/server/03-formulas.sql',import.meta.url),'utf8');
  const actions=await readFile(new URL('../supabase/server/04-character-actions.sql',import.meta.url),'utf8');
  const definition=(source,name)=>{
    const start=source.indexOf(`create or replace function public.${name}(`);
    assert.ok(start>=0,name);return source.slice(start,source.indexOf('$$;',source.indexOf('as $$',start))+3);
  };
  const id='00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create table public.characters(id uuid primary key,data jsonb);
      create function public.game_lock_character(cid uuid) returns public.characters language sql as $$ select * from public.characters where id=cid for update $$;
      create function public.game_store(cid uuid,d jsonb) returns jsonb language plpgsql as $$ begin update public.characters set data=d where id=cid;return d;end $$;`);
    for(const name of ['game_level','game_skill_id','game_skill_rank']) await db.exec(definition(formulas,name));
    await db.exec(definition(actions,'upgrade_skill'));
    const seed=d=>db.query('insert into public.characters values($1,$2) on conflict(id) do update set data=excluded.data',[id,d]);
    const upgrade=(skill,rank)=>db.query('select public.upgrade_skill($1,$2,$3) value',[id,skill,rank]);
    for(const [cls,kit] of Object.entries(game.COMBAT_KITS)) {
      const data={cls,level:1,skillRanks:{}};
      await seed(data);
      await assert.rejects(upgrade(kit.skill.id,1),/SKILL_LEVEL_REQUIRED/);
      await assert.rejects(upgrade(cls==='clerigo'?'heavy_strike':'healing',1),/SKILL_INVALID/);
      for(let rank=1;rank<5;rank++) {
        data.level=rank+1;await seed(data);
        const result=(await upgrade(kit.skill.id,rank)).rows[0].value;
        game.upgradeSkill(data,kit.skill.id,rank);
        assert.deepEqual(result,data);
        await assert.rejects(upgrade(kit.skill.id,rank),/SKILL_CHANGED/);
        if(rank<4) await assert.rejects(upgrade(kit.skill.id,rank+1),/SKILL_LEVEL_REQUIRED/);
      }
      await assert.rejects(upgrade(kit.skill.id,5),/SKILL_MAX_RANK/);
      for(const level of [1,2,3,4,5,8,50]) {
        const d={...data,level};
        const sql=(await db.query('select public.game_skill_rank($1) rank',[d])).rows[0].rank;
        assert.equal(sql,game.skillRank(d));
      }
    }
  } finally { await db.close(); }
});

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

test('all twenty class skills unlock and improve independently with one point per rank',()=>{
  for (let level=1;level<=50;level++) assert.equal(game.skillPointsAllowed(level),level-1);
  assert.equal(game.skillPointsAllowed(99),49);
  for (const [cls,kit] of Object.entries(game.COMBAT_KITS)) {
    for (const skill of kit.skills) {
      if(skill.unlockLevel>1) {
        const locked={cls,level:skill.unlockLevel-1,skillRanks:{}};
        assert.equal(game.skillUnlocked(locked,skill.id),false);
        assert.throws(()=>game.upgradeSkill(locked,skill.id,1),/habilidad/);
      }
      const data={cls,level:skill.unlockLevel,skillRanks:{}};
      assert.equal(game.skillUnlocked(data,skill.id),true);
      assert.equal(game.skillRank(data,skill.id),1);
      for(let rank=1;rank<5;rank++) {
        data.level=skill.unlockLevel+rank-1;
        assert.throws(()=>game.upgradeSkill(data,skill.id,rank),/nivel/);
        data.level++;
        assert.equal(game.skillRankLevel(rank+1,skill.id),data.level);
        const points=game.unspentSkillPoints(data);
        assert.ok(points>0);
        game.upgradeSkill(data,skill.id,rank);
        assert.equal(game.skillRank(data,skill.id),rank+1);
        assert.equal(game.unspentSkillPoints(data),points-1);
        assert.throws(()=>game.upgradeSkill(data,skill.id,rank),/cambiado/);
        if(rank<4) assert.throws(()=>game.upgradeSkill(data,skill.id,rank+1),/nivel/);
      }
      assert.throws(()=>game.upgradeSkill(data,skill.id,5),/máximo/);
      assert.equal(game.skillRank({...data,level:2},skill.id),Math.min(2,skill.unlockLevel>2?1:2));
      assert.equal(game.skillRank({...data,level:50},skill.id),5);
      assert.equal(game.unspentSkillPoints({...data,level:50}),45);
    }
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
    for(const name of ['game_level','game_skill_data','game_skill_rank','game_skill_points_spent']) await db.exec(definition(formulas,name));
    await db.exec(definition(actions,'upgrade_skill'));
    const seed=d=>db.query('insert into public.characters values($1,$2) on conflict(id) do update set data=excluded.data',[id,d]);
    const upgrade=(skill,rank)=>db.query('select public.upgrade_skill($1,$2,$3) value',[id,skill,rank]);
    for(const [cls,kit] of Object.entries(game.COMBAT_KITS)) {
      for(const skill of kit.skills) {
        const data={cls,level:skill.unlockLevel-1,skillRanks:{}};
        await seed(data);
        await assert.rejects(upgrade(skill.id,1),/SKILL_LEVEL_REQUIRED/);
        await assert.rejects(upgrade(Object.values(game.COMBAT_KITS).flatMap(value=>value.skills).find(other=>!kit.skills.includes(other)).id,1),/SKILL_INVALID/);
        for(let rank=1;rank<5;rank++) {
          data.level=skill.unlockLevel+rank;await seed(data);
          const result=(await upgrade(skill.id,rank)).rows[0].value;
          game.upgradeSkill(data,skill.id,rank);
          assert.deepEqual(result,data);
          await assert.rejects(upgrade(skill.id,rank),/SKILL_CHANGED/);
          if(rank<4) await assert.rejects(upgrade(skill.id,rank+1),/SKILL_LEVEL_REQUIRED/);
        }
        await assert.rejects(upgrade(skill.id,5),/SKILL_MAX_RANK/);
        for(const level of [1,skill.unlockLevel,skill.unlockLevel+4,50]) {
          const d={...data,level};
          const sql=(await db.query('select public.game_skill_rank($1,$2) rank',[d,skill.id])).rows[0].rank;
          assert.equal(sql,game.skillRank(d,skill.id));
        }
      }
      const full={cls,level:50,skillRanks:Object.fromEntries(kit.skills.map(skill=>[skill.id,5]))};
      const spent=(await db.query('select public.game_skill_points_spent($1) spent',[full])).rows[0].spent;
      assert.equal(spent,49-game.unspentSkillPoints(full));
    }
  } finally { await db.close(); }
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import pg from 'pg';

if (process.argv.includes('--configured')) {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
const url = process.env.SUPABASE_TEST_DB_URL || (process.argv.includes('--configured') ? process.env.SUPABASE_DB_URL : null);

test('mission encounters allow travel until either side actually attacks', { timeout: 90000 }, async () => {
  assert.ok(url, 'Set SUPABASE_TEST_DB_URL, or authorize the configured database with --configured');
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout='5s'; set local statement_timeout='20s'");
    await client.query('select pg_advisory_xact_lock(731029,2)');
    await client.query(readFileSync(new URL('../supabase/server.sql', import.meta.url), 'utf8'));
    const uid = randomUUID(), id = randomUUID(), session = randomUUID();
    const destination = `engagement_${randomUUID()}`, portal = randomUUID();
    const site = (await client.query("select value from public.server_config where key='combat_site'")).rows[0].value;
    const position = { x: site.x, z: site.z, yaw: 0 };
    await client.query("update public.server_config set value='true' where key='combat_enabled'");
    await client.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [uid, { username: `test_${uid.replaceAll('-', '').slice(0,12)}` }]);
    await client.query('insert into public.characters(id,user_id,name,data) values($1,$2,$3,$4)', [id, uid, 'Alric', {
      name:'Alric',race:'humano',cls:'guerrero',level:1,health:100,resource:80,
      location:'brumaluz',position,welcome:{origin:0,stage:'completed'},
      equipment:{weapon:{id:'espada_inicial',count:1,bound:true}},attributePoints:{},
    }]);
    await client.query('insert into public.world_maps(id,name,spawn,bounds) values($1,$2,$3,$4)', [
      destination,'Prueba de encuentro',{x:site.x+3.5,z:site.z,yaw:0},{minX:-500,maxX:500,minZ:-500,maxZ:500},
    ]);
    await client.query('insert into public.world_portals(map,id,x,z,radius,target_map,target) values($1,$2,$3,$4,6,$5,$6),($5,$2,$7,$4,6,$1,$8)', [
      'brumaluz',portal,site.x,site.z,destination,{x:site.x+3.5,z:site.z,yaw:0},site.x+3.5,position,
    ]);
    async function asUser() {
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
      await client.query("select set_config('request.jwt.claims',jsonb_build_object('sub',$1::text)::text,true)", [uid]);
      await client.query('set local role authenticated');
    }
    async function rpc(name, args) {
      return (await client.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) result`, args)).rows[0].result;
    }
    async function rejected(name, args, message) {
      await client.query('savepoint rejected');
      try { await assert.rejects(()=>rpc(name,args),message); }
      finally { await client.query('rollback to savepoint rejected'); await client.query('release savepoint rejected'); }
    }
    async function at(x, extra = {}) {
      await client.query('reset role');
      await client.query('update public.world_players set position=$1,seen_at=now() where character_id=$2', [{x,z:site.z,yaw:0},id]);
      if (Object.keys(extra).length) await client.query('update public.characters set data=data||$1::jsonb where id=$2', [extra,id]);
      await asUser();
    }
    const motion = x => ({x,z:site.z,yaw:0,facing:0,jump:0,wave:0});
    await asUser();
    await rpc('character_enter',[id]);
    await rpc('world_join',[id,session]);
    const started = await rpc('combat_start',[id]);
    assert.equal(started.encounter.status,'active');
    assert.equal(started.encounter.engaged,false);
    await client.query('reset role');
    assert.equal((await client.query("select data->'combat_at' stamp from public.characters where id=$1",[id])).rows[0].stamp,null,'Preparing a mission enemy does not start the combat regeneration clock');
    await asUser();
    await rejected('combat_action',[id,'attack'],/COMBAT_OUT_OF_RANGE/);
    assert.equal((await rpc('world_travel',[id,session,portal])).location,destination,'An unsuccessful attack is not engagement');
    await at(site.x+3.5,{combatEncounter:{...started.encounter,enemyAttackAt:0}});
    const away = await rpc('world_sync',[id,session,motion(site.x+3.5)]);
    assert.equal(away.vitals.health,100,'A pending enemy cannot hit across maps, even at identical coordinates');
    assert.equal(away.encounter.engaged,false);
    await rpc('world_travel',[id,session,portal]);
    await at(site.x+2,{combatEncounter:{...started.encounter,enemyAttackAt:Date.now()/1000+100}});
    const attacked = await rpc('combat_action',[id,'attack']);
    assert.equal(attacked.encounter.engaged,true);
    assert.equal(attacked.encounter.health,90);
    await rejected('world_travel',[id,session,portal],/IN_COMBAT/);
    await at(site.x+2,{combatEncounter:{...started.encounter,enemyAttackAt:0}});
    const hit = await rpc('world_sync',[id,session,motion(site.x+2)]);
    assert.equal(hit.encounter.engaged,true,'Enemy damage also enters combat');
    assert.ok(hit.vitals.health<100);
    await rejected('world_travel',[id,session,portal],/IN_COMBAT/);
    await rpc('combat_stop',[id]);
    assert.equal((await rpc('world_travel',[id,session,portal])).location,destination,'Fleeing ends real combat without finishing the quest');
    const saved = await rpc('character_enter',[id]);
    assert.equal(saved.shadowQuest,'active');
    assert.equal(saved.combatEncounter.status,'fled');
  } finally {
    try { await client.query('rollback'); } finally { await client.end(); }
  }
});

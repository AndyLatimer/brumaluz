import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import pg from 'pg';

if(process.argv.includes('--configured')) for(const file of ['.env.local','.env']) {
  if(!existsSync(file)) continue;
  for(const line of readFileSync(file,'utf8').split(/\r?\n/)) {
    const match=/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if(match && !(match[1] in process.env)) process.env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
  }
}
const url=process.env.SUPABASE_TEST_DB_URL || (process.argv.includes('--configured') ? process.env.SUPABASE_DB_URL : null);
test('private atomic trades (all schema, fixtures and mutations roll back)',{timeout:60000},async t=>{
  assert.ok(url,'Set SUPABASE_TEST_DB_URL or explicitly pass --configured');
  const db=new pg.Client({connectionString:url,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  await db.connect();
  const users=[randomUUID(),randomUUID(),randomUUID()], chars=users.map(()=>randomUUID()), sessions=users.map(()=>randomUUID());
  const base=(index)=>({name:['TraderA','TraderB','Observer'][index],race:'humano',cls:'guerrero',health:-1,level:1,
    location:'trade_test',wallet:{pelines:100,premium:777},inventory: index===0 ? [{id:'pan_duro',count:10},{id:'pocion_vida_minuscula',count:5,bound:true}] : [{id:'pocion_mana_minuscula',count:8}],position:{x:index,z:0,yaw:0}});
  async function as(index) {
    await db.query('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[users[index]]);
    await db.query('set local role authenticated');
  }
  async function rpc(index,action='state',trade=null,target=null,offer=null,revision=null) {
    await as(index);
    return (await db.query('select public.trade_action($1,$2,$3,$4,$5,$6) v',[chars[index],action,trade,target,offer,revision])).rows[0].v;
  }
  async function reject(fn,pattern) {
    await db.query('savepoint rejected');
    try { await assert.rejects(fn,pattern); } finally { await db.query('rollback to rejected'); await db.query('release savepoint rejected'); }
  }
  async function admin(sql,args=[]) { await db.query('reset role'); return db.query(sql,args); }
  async function reset() {
    await admin('delete from public.player_trades where a=any($1::uuid[]) or b=any($1::uuid[])',[chars]);
    for(let i=0;i<3;i++) {
      await admin('update public.characters set data=$2 where id=$1',[chars[i],base(i)]);
      await admin("update public.world_players set position=$2,seen_at=now(),session_id=$3,dead=false where character_id=$1",[chars[i],{x:i,z:0,yaw:0},sessions[i]]);
    }
  }
  async function opened() {
    const state=await rpc(0,'invite',null,chars[1]); const id=state.trade.id;
    await rpc(1,'join',id); return id;
  }
  const offer=(items=[],pelines=0)=>({items,pelines});
  const item=(slot,count)=>({slot,count});
  try {
    await db.query('begin');
    await db.query("set local lock_timeout='5s';set local statement_timeout='15s'");
    await db.query(readFileSync(new URL('../supabase/server.sql',import.meta.url),'utf8'));
    for(let i=0;i<3;i++) {
      await admin('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[users[i],{username:`trade_${users[i].replaceAll('-','').slice(0,12)}`}]);
      await admin('insert into public.characters(id,user_id,name,data) values($1,$2,$3,$4)',[chars[i],users[i],base(i).name,base(i)]);
      await as(i); await db.query('select public.world_join($1,$2)',[chars[i],sessions[i]]);
    }
    await t.test('ownership, private tables, peer offer only and invitation consent',async()=>{
      await reset();
      const empty=await rpc(0);
      assert.equal(empty.trade,null);
      assert.equal(empty.wallet.pelines,100);
      assert.deepEqual(empty.inventory[0],base(0).inventory[0]);
      const invited=await rpc(0,'invite',null,chars[1]); const id=invited.trade.id;
      assert.equal(invited.trade.status,'invited');
      await reject(()=>rpc(0,'accept',id,null,null,0),/TRADE_CLOSED/);
      await reject(()=>rpc(0,'join',id),/TRADE_CLOSED/);
      await reject(()=>rpc(2,'state',id),/TRADE_NOT_FOUND/);
      await as(2);
      await reject(()=>db.query('select public.trade_action($1)',[chars[0]]),/CHARACTER_NOT_FOUND/);
      await reject(()=>db.query('select * from public.player_trades'),/permission denied/);
      await reject(()=>db.query('select public.game_trade_offer($1,$2)',[base(0),offer()]),/permission denied/);
      const peer=await rpc(1,'state',id);
      assert.deepEqual(peer.inventory[0],base(1).inventory[0]);
      for(const forbidden of ['inventory','wallet','data','premium']) assert.equal(forbidden in peer.trade.peer,false);
      assert.deepEqual(Object.keys(peer.trade.peer).sort(),['items','pelines']);
    });
    await t.test('incoming invitations reach characters with missing, null or empty wallets',async()=>{
      for(const wallet of [undefined,null,{}, {premium:777}]) {
        await reset();
        const data=base(1);
        if(wallet===undefined) delete data.wallet; else data.wallet=wallet;
        await admin('update public.characters set data=$2 where id=$1',[chars[1],data]);
        const invited=await rpc(0,'invite',null,chars[1]);
        const received=await rpc(1);
        assert.equal(received.trade.id,invited.trade.id);
        assert.equal(received.trade.incoming,true);
        assert.equal(received.trade.status,'invited');
        assert.equal(received.wallet.pelines,0,'A new character has a valid zero-pelines wallet in the RPC response');
        const joined=await rpc(1,'join',invited.trade.id);
        assert.equal(joined.trade.status,'open');
        assert.equal(joined.wallet.pelines,0);
      }
    });
    await t.test('exact quantities, pelines only, bound and malformed rejection',async()=>{
      await reset(); const id=await opened();
      for(const invalid of [offer([item(0,0)]),offer([item(0,-1)]),offer([item(0,1.5)]),offer([item(0,11)]),
        offer([item(0,1),item(0,1)]),offer([item(25,1)]),offer([],1.5),{...offer(),premium:1}]) {
        await reject(()=>rpc(0,'offer',id,null,invalid,0),/TRADE_INVALID_OFFER|TRADE_ITEMS_CHANGED/);
      }
      await reject(()=>rpc(0,'offer',id,null,offer([item(1,1)]),0),/TRADE_BOUND/);
      await reject(()=>rpc(0,'offer',id,null,offer([],101),0),/NOT_ENOUGH_PELINES/);
      await admin("update public.characters set data=jsonb_set(data,'{inventory,0,bound}','true') where id=$1",[chars[0]]);
      await reject(()=>rpc(0,'offer',id,null,offer([item(0,1)]),0),/TRADE_BOUND/);
    });
    await t.test('two acceptances atomically exchange stacks and money, preserve premium and binding',async()=>{
      await reset(); const id=await opened();
      await rpc(0,'offer',id,null,offer([item(0,4)],30),0);
      await rpc(1,'offer',id,null,offer([item(0,3)],10),1);
      await rpc(0,'accept',id,null,null,2);
      const pending=await rpc(0,'state',id); assert.equal(pending.wallet.pelines,100);
      const completed=await rpc(1,'accept',id,null,null,2); assert.equal(completed.trade.status,'completed');
      const a=await rpc(0,'state',id), b=await rpc(1,'state',id);
      assert.equal(a.wallet.pelines,80);assert.equal(b.wallet.pelines,120);
      assert.equal(a.wallet.premium,777);assert.equal(b.wallet.premium,777);
      assert.equal(a.inventory[0].count,6);assert.equal(b.inventory[0].count,5);
      assert.equal(a.inventory.find(s=>s?.id==='pocion_mana_minuscula').count,3);
      assert.equal(b.inventory.find(s=>s?.id==='pan_duro').count,4);
      assert.equal(a.inventory[1].bound,true);
      await reject(()=>rpc(0,'accept',id,null,null,2),/TRADE_CLOSED/);
      assert.equal((await rpc(0,'state',id)).wallet.pelines,80,'retry never exchanges twice');
    });
    await t.test('offer revisions reset both accepts; Back only withdraws self',async()=>{
      await reset(); const id=await opened();
      await rpc(0,'accept',id,null,null,0);
      assert.equal((await rpc(1,'state',id)).trade.peerAccepted,true);
      const backed=await rpc(0,'back',id,null,null,0);assert.equal(backed.trade.accepted,false);assert.equal(backed.trade.status,'open');
      await rpc(0,'accept',id,null,null,0);
      const updated=await rpc(1,'offer',id,null,offer([item(0,2)]),0);
      assert.equal(updated.trade.accepted,false);assert.equal(updated.trade.peerAccepted,false);
      await reject(()=>rpc(0,'accept',id,null,null,0),/TRADE_CHANGED/);
    });
    await t.test('queued acceptance requests exchange exactly once and reject duplicate requests',async()=>{
      await reset();const id=await opened();
      await rpc(0,'offer',id,null,offer([item(0,2)],10),0);
      await as(0);
      // One rollback connection queues both commands; each command sets its own authenticated identity.
      // This exercises the RPC's competing acceptance/retry paths without committing shared fixtures.
      const accept=index=>db.query(`with identity as materialized (
        select set_config('request.jwt.claim.sub',$1,true) uid
      ) select public.trade_action(case when (select uid from identity) is not null then $2::uuid end,
        'accept',$3,null,null,1) v`,[users[index],chars[index],id]);
      const [a,b]=await Promise.all([accept(0),accept(1)]);
      assert.equal(a.rows[0].v.trade.status,'open');assert.equal(b.rows[0].v.trade.status,'completed');
      await reject(()=>accept(0),/TRADE_CLOSED/);
      assert.equal((await rpc(0,'state',id)).wallet.pelines,90);
      assert.equal((await rpc(1,'state',id)).wallet.pelines,110);
    });
    await t.test('inventory/money changes and insufficient capacity roll back both sides',async()=>{
      await reset();let id=await opened();
      await rpc(0,'offer',id,null,offer([item(0,2)],100),0);
      await rpc(0,'accept',id,null,null,1);
      await admin("update public.characters set data=jsonb_set(data,'{wallet,pelines}','0') where id=$1",[chars[0]]);
      await reject(()=>rpc(1,'accept',id,null,null,1),/NOT_ENOUGH_PELINES/);
      assert.equal((await rpc(1,'state',id)).inventory[0].count,8);
      await reset();id=await opened();
      await rpc(0,'offer',id,null,offer([item(0,2)]),0);
      await rpc(0,'accept',id,null,null,1);
      await admin("update public.characters set data=jsonb_set(data,'{inventory,0,count}','1') where id=$1",[chars[0]]);
      await reject(()=>rpc(1,'accept',id,null,null,1),/TRADE_ITEMS_CHANGED/);
      await reset();id=await opened();
      const full=Array.from({length:25},()=>({id:'pocion_mana_minuscula',count:99}));
      await admin("update public.characters set data=jsonb_set(data,'{inventory}',$2) where id=$1",[chars[1],JSON.stringify(full)]);
      await rpc(0,'offer',id,null,offer([item(0,1)],50),0);
      await rpc(0,'accept',id,null,null,1);
      await reject(()=>rpc(1,'accept',id,null,null,1),/INVENTORY_FULL/);
      const a=await rpc(0,'state',id);assert.equal(a.wallet.pelines,100);assert.equal(a.inventory[0].count,10);
    });
    await t.test('cancel, range, disconnect, session replacement and death invalidate',async()=>{
      for(const cause of ['cancel','range','disconnect','replacement','death']) {
        await reset();const id=await opened();await rpc(0,'accept',id,null,null,0);
        if(cause==='cancel') await rpc(1,'cancel',id);
        if(cause==='range') await admin("update public.world_players set position='{\"x\":11,\"z\":0}' where character_id=$1",[chars[1]]);
        if(cause==='disconnect') await admin("update public.world_players set seen_at=now()-interval '16 seconds' where character_id=$1",[chars[1]]);
        if(cause==='replacement') await admin('update public.world_players set session_id=$2 where character_id=$1',[chars[1],randomUUID()]);
        if(cause==='death') await admin('update public.world_players set dead=true where character_id=$1',[chars[1]]);
        const result=await rpc(0,'state',id);assert.equal(result.trade.status,'cancelled',cause);assert.equal(result.wallet.pelines,100);
      }
    });
    await t.test('bound state survives sanitize-equivalent add/remove/buy/sell/use helpers without merging',async()=>{
      await reset();
      const d={...base(0),inventory:[{id:'pan_duro',count:2,bound:true},{id:'pan_duro',count:3}]};
      const added=(await admin("select public.game_add_item($1,'pan_duro') v",[d])).rows[0].v;
      assert.equal(added.inventory[0].count,2);assert.equal(added.inventory[0].bound,true);assert.equal(added.inventory[1].count,4);
      const removed=(await admin('select public.game_remove_item($1,0) v',[d])).rows[0].v;assert.equal(removed.inventory[0].bound,true);
      await admin('update public.characters set data=$2 where id=$1',[chars[0],d]);await as(0);
      const bought=(await db.query("select public.vendor_buy($1,'testiculos','pan_duro') v",[chars[0]])).rows[0].v;
      assert.equal(bought.inventory[0].count,2);assert.equal(bought.inventory[1].count,4);
      const sold=(await db.query("select public.vendor_sell($1,'testiculos',0) v",[chars[0]])).rows[0].v;assert.equal(sold.inventory[0].bound,true);
      const used=(await db.query('select public.use_item($1,1) v',[chars[0]])).rows[0].v;
      assert.equal(used.inventory[0].bound,true);assert.equal(used.inventory[1].count,3);
    });
    await t.test('inventory moves persist exact stacks, swap occupied slots and reject stale or foreign moves',async()=>{
      await reset();
      const move=async(from,to,source,target,owner=0)=>{
        await as(owner);
        return (await db.query('select public.move_inventory_item($1,$2,$3,$4,$5) v',[chars[0],from,to,source,target])).rows[0].v;
      };
      const source=base(0).inventory[0],bound=base(0).inventory[1];
      let moved=await move(0,24,source,null);
      assert.equal(moved.inventory[0],null);assert.deepEqual(moved.inventory[24],source);
      moved=await move(24,1,source,bound);
      assert.deepEqual(moved.inventory[24],bound);assert.deepEqual(moved.inventory[1],source);
      assert.equal(moved.wallet.pelines,100);
      await reject(()=>move(1,2,{...source,count:9},null),/INVENTORY_CHANGED/);
      await reject(()=>move(24,2,{...bound,bound:false},null),/INVENTORY_CHANGED/);
      await reject(()=>move(1,24,source,null),/INVENTORY_CHANGED/);
      await reject(()=>move(1,25,source,null),/INVALID_ITEM/);
      await reject(()=>move(1,1,source,source),/INVALID_ITEM/);
      await reject(()=>move(null,2,source,null),/INVALID_ITEM/);
      await reject(()=>move(2,3,source,null),/INVALID_ITEM/);
      await reject(()=>move(1,2,source,null,1),/CHARACTER_NOT_FOUND/);
      const persisted=(await admin('select data from public.characters where id=$1',[chars[0]])).rows[0].data;
      assert.deepEqual(persisted.inventory[24],bound);assert.deepEqual(persisted.inventory[1],source);
      await admin('set local role anon');
      await reject(()=>db.query('select public.move_inventory_item($1,1,2,$2,null)',[chars[0],source]),/permission denied/);
    });
    await t.test('inventory rearrangement clears the moving player offer and both acceptances',async()=>{
      await reset();const id=await opened();
      await rpc(0,'offer',id,null,offer([item(0,2)],10),0);
      await rpc(1,'accept',id,null,null,1);
      await as(0);
      await db.query('select public.move_inventory_item($1,0,3,$2,null)',[chars[0],base(0).inventory[0]]);
      const value=await rpc(0,'state',id);
      assert.equal(value.trade.revision,2);
      assert.deepEqual(value.trade.own,offer());
      assert.equal(value.trade.peerAccepted,false);
      await reject(()=>rpc(1,'accept',id,null,null,1),/TRADE_CHANGED/);
    });
    await t.test('default stack is 50 for buying and trading, with no loss of legacy stacks',async()=>{
      await reset();
      await admin('update public.characters set data=$2 where id=$1',[chars[0],{...base(0),inventory:[{id:'pan_duro',count:50}]}]);
      await as(0);
      const bought=(await db.query("select public.vendor_buy($1,'testiculos','pan_duro') v",[chars[0]])).rows[0].v;
      assert.equal(bought.inventory[0].count,50);assert.equal(bought.inventory[1].count,1);
      const legacy=(await admin("select public.game_add_item($1,'pan_duro') v",[{...base(0),inventory:[{id:'pan_duro',count:99}]}])).rows[0].v;
      assert.equal(legacy.inventory[0].count,99);assert.equal(legacy.inventory[1].count,1);
      await reject(()=>admin("select public.game_add_item($1,'pan_duro')",[{...base(0),inventory:Array.from({length:25},()=>({id:'pan_duro',count:50}))}]),/INVENTORY_FULL/);
      await reset();
      await admin('update public.characters set data=$2 where id=$1',[chars[0],{...base(0),inventory:[{id:'pan_duro',count:10}]}]);
      await admin('update public.characters set data=$2 where id=$1',[chars[1],{...base(1),inventory:[{id:'pan_duro',count:49}]}]);
      const id=await opened();
      await rpc(0,'offer',id,null,offer([item(0,10)]),0);
      await rpc(0,'accept',id,null,null,1);
      const value=await rpc(1,'accept',id,null,null,1);
      assert.equal(value.inventory[0].count,50);assert.equal(value.inventory[1].count,9);
    });
    await t.test('explicit catalog stack limit overrides the default',async()=>{
      await reset();
      await admin('savepoint small_stack');
      try {
        await admin(`create or replace function public.game_item(p_item text) returns jsonb
          language sql immutable set search_path='' as $$
          select case when p_item='pan_duro' then jsonb_build_object('value',4,'stack',2) else null end $$`);
        const value=(await admin("select public.game_add_item($1,'pan_duro') v",[{...base(0),inventory:[{id:'pan_duro',count:2}]}])).rows[0].v;
        assert.equal(value.inventory[0].count,2);assert.equal(value.inventory[1].count,1);
      }finally{await db.query('rollback to small_stack');await db.query('release savepoint small_stack');}
    });
    await t.test('catalog binding rejects legacy unbound stacks and newly bought items inherit catalog binding',async()=>{
      await reset();const id=await opened();
      await admin('savepoint bound_catalog');
      try {
        await admin(`create or replace function public.game_item(p_item text) returns jsonb
          language sql immutable set search_path='' as $$
          select case when p_item='pan_duro' then jsonb_build_object('value',4,'bound',true) else null end $$`);
        await reject(()=>rpc(0,'offer',id,null,offer([item(0,1)]),0),/TRADE_BOUND/);
        await as(0);
        const bought=(await db.query("select public.vendor_buy($1,'testiculos','pan_duro') v",[chars[0]])).rows[0].v;
        assert.equal(bought.inventory[0].count,10,'catalog-bound purchase must not merge into legacy unbound stack');
        assert.equal(bought.inventory[2].bound,true);assert.equal(bought.inventory[2].count,1);
      } finally {await db.query('rollback to bound_catalog');await db.query('release savepoint bound_catalog');}
    });
  } finally { await db.query('rollback');await db.end(); }
});

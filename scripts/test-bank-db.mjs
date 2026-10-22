import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import pg from 'pg';
import { serverSql } from './server-sql.mjs';

if(process.argv.includes('--configured')) for(const file of ['.env.local','.env']) {
  if(!existsSync(file)) continue;
  for(const line of readFileSync(file,'utf8').split(/\r?\n/)) {
    const match=/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if(match && !(match[1] in process.env)) process.env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
  }
}
const url=process.env.SUPABASE_TEST_DB_URL || (process.argv.includes('--configured') ? process.env.SUPABASE_DB_URL : null);
const HOUSE='casa_de_isberto_interior', CHEST={x:2.25,z:3.25,yaw:0};

test('account bank shared between characters (all schema, fixtures and mutations roll back)',{timeout:60000},async t=>{
  assert.ok(url,'Set SUPABASE_TEST_DB_URL or explicitly pass --configured');
  const db=new pg.Client({connectionString:url,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  await db.connect();
  // Characters 0 and 1 share an account; character 2 belongs to someone else.
  const users=[randomUUID(),randomUUID()], owners=[0,0,1], chars=owners.map(()=>randomUUID());
  const base=(index)=>({name:['BancoA','BancoB','Ajeno'][index],race:'humano',cls:'guerrero',health:-1,level:1,location:HOUSE,
    wallet:{pelines:100,premium:5},position:CHEST,
    inventory: index===0 ? [{id:'pan_duro',count:30},{id:'espada_inicial',count:1,bound:true},{id:'pocion_vida_minuscula',count:3}] : []});
  async function as(index) {
    await db.query('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[users[owners[index]]]);
    await db.query('set local role authenticated');
  }
  async function bank(index,action,slot=null,expected=null,amount=null,target=null) {
    await as(index);
    return (await db.query('select public.bank_action($1,$2,$3,$4,$5,$6) v',[chars[index],action,slot,expected,amount,target])).rows[0].v;
  }
  async function reject(fn,pattern) {
    await db.query('savepoint rejected');
    try { await assert.rejects(fn,pattern); } finally { await db.query('rollback to rejected'); await db.query('release savepoint rejected'); }
  }
  async function admin(sql,args=[]) { await db.query('reset role'); return db.query(sql,args); }
  async function place(index,position=CHEST,data={}) {
    await admin('update public.characters set data=$2 where id=$1',[chars[index],{...base(index),...data}]);
    await admin('update public.world_players set position=$2,seen_at=now(),dead=false where character_id=$1',[chars[index],position]);
  }
  async function reset() {
    await admin('delete from public.account_banks where user_id=any($1::uuid[])',[users]);
    for(let i=0;i<3;i++) await place(i);
  }
  try {
    await db.query('begin');
    await db.query("set local lock_timeout='5s';set local statement_timeout='15s'");
    // Take the inventory lock before the schema DDL so live RPCs queue behind us instead of deadlocking.
    await db.query('select pg_advisory_xact_lock(731029,3)');
    await db.query(serverSql());
    for(let u=0;u<users.length;u++) await admin('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[users[u],{username:`bank_${users[u].replaceAll('-','').slice(0,12)}`}]);
    for(let i=0;i<3;i++) {
      await admin('insert into public.characters(id,user_id,name,data) values($1,$2,$3,$4)',[chars[i],users[owners[i]],base(i).name,base(i)]);
    }
    // world_players holds one row per account, so each test joins the character it needs.
    async function join(index) { await as(index); await db.query('select public.world_join($1,$2)',[chars[index],randomUUID()]); await place(index); }

    await t.test('empty bank opens with its size and is private',async()=>{
      await reset(); await join(0);
      const state=await bank(0,'open');
      assert.equal(state.bank.size,50);
      assert.equal(state.bank.items.length,50);
      assert.equal(state.bank.pelines,0);
      assert.ok(state.bank.items.every(slot=>slot===null));
      await as(0);
      await reject(()=>db.query('select * from public.account_banks'),/permission denied/);
      await reject(()=>db.query('select public.game_stack_into($1::jsonb,$2)',['[]',{id:'pan_duro',count:1}]),/permission denied/);
      await reject(()=>bank(0,'steal'),/BANK_INVALID_ACTION/);
    });

    await t.test('deposits and withdrawals are shared by every character of the account',async()=>{
      await reset(); await join(0);
      const deposited=await bank(0,'deposit',0,{id:'pan_duro',count:30});
      assert.equal(deposited.inventory[0],null);
      assert.deepEqual(deposited.bank.items[0],{id:'pan_duro',count:30,bound:false});
      const money=await bank(0,'deposit_pelines',null,null,60);
      assert.equal(money.wallet.pelines,40);assert.equal(money.wallet.premium,5);assert.equal(money.bank.pelines,60);

      await join(1);
      const seen=await bank(1,'open');
      assert.deepEqual(seen.bank.items[0],{id:'pan_duro',count:30,bound:false});
      assert.equal(seen.bank.pelines,60);
      const withdrawn=await bank(1,'withdraw',0,{id:'pan_duro',count:30,bound:false});
      assert.equal(withdrawn.bank.items[0],null);
      assert.deepEqual(withdrawn.inventory[0],{id:'pan_duro',count:30,bound:false});
      const cash=await bank(1,'withdraw_pelines',null,null,25);
      assert.equal(cash.wallet.pelines,125);assert.equal(cash.bank.pelines,35);
      await reject(()=>bank(1,'withdraw_pelines',null,null,36),/BANK_NOT_ENOUGH_MONEY/);
      await reject(()=>bank(1,'deposit_pelines',null,null,126),/NOT_ENOUGH_MONEY/);
      await reject(()=>bank(1,'deposit_pelines',null,null,0),/BANK_INVALID_ACTION/);

      await join(2);
      const other=await bank(2,'open');
      assert.equal(other.bank.pelines,0);
      assert.ok(other.bank.items.every(slot=>slot===null),'Another account never sees this bank');
      await as(2);
      await reject(()=>db.query('select public.bank_action($1,$2)',[chars[0],'open']),/CHARACTER_NOT_FOUND/);
    });

    await t.test('bound items and stale slots are rejected',async()=>{
      await reset(); await join(0);
      await reject(()=>bank(0,'deposit',1,{id:'espada_inicial',count:1,bound:true}),/BANK_ITEM_BOUND/);
      await place(0,CHEST,{inventory:[{id:'esencia_sombria',count:4}]});
      await reject(()=>bank(0,'deposit',0,{id:'esencia_sombria',count:4}),/BANK_ITEM_BOUND/);
      await place(0);
      await reject(()=>bank(0,'deposit',0,{id:'pan_duro',count:29}),/INVENTORY_CHANGED/);
      await reject(()=>bank(0,'deposit',5,null),/INVENTORY_CHANGED/);
      await bank(0,'deposit',2,{id:'pocion_vida_minuscula',count:3});
      await reject(()=>bank(0,'withdraw',0,{id:'pocion_vida_minuscula',count:2}),/BANK_CHANGED/);
      await reject(()=>bank(0,'withdraw',50,{id:'pocion_vida_minuscula',count:3}),/INVALID_ITEM/);
    });

    await t.test('stacks merge up to the stack size and full containers reject without losing items',async()=>{
      await reset(); await join(0);
      await admin('insert into public.account_banks(user_id,items,size) values($1,$2::jsonb,2)',[users[0],JSON.stringify([{id:'pan_duro',count:45,bound:false},null])]);
      const merged=await bank(0,'deposit',0,{id:'pan_duro',count:30});
      assert.deepEqual(merged.bank.items,[{id:'pan_duro',count:50,bound:false},{id:'pan_duro',count:25,bound:false}]);
      await reject(()=>bank(0,'deposit',2,{id:'pocion_vida_minuscula',count:3}),/BANK_FULL/);
      await place(0,CHEST,{inventory:Array.from({length:25},()=>({id:'pocion_mana_minuscula',count:50}))});
      await reject(()=>bank(0,'withdraw',0,{id:'pan_duro',count:50}),/INVENTORY_FULL/);
      await place(0,CHEST,{inventory:[{id:'pan_duro',count:40}]});
      const back=await bank(0,'withdraw',0,{id:'pan_duro',count:50});
      assert.deepEqual(back.inventory[0],{id:'pan_duro',count:50});
      assert.deepEqual(back.inventory[1],{id:'pan_duro',count:40,bound:false});
      assert.equal(back.bank.items[0],null);
    });

    await t.test('dragging to a slot places, merges, swaps and reorders',async()=>{
      await reset(); await join(0);
      // Hueco libre elegido.
      const placed=await bank(0,'deposit',0,{id:'pan_duro',count:30},null,7);
      assert.equal(placed.bank.items[7].id,'pan_duro');assert.equal(placed.inventory[0],null);
      // Mismo objeto: se completa el montón y lo que no cabe se queda en la mochila.
      await place(0,CHEST,{inventory:[{id:'pan_duro',count:30}]});
      const merged=await bank(0,'deposit',0,{id:'pan_duro',count:30},null,7);
      assert.equal(merged.bank.items[7].count,50);assert.equal(merged.inventory[0].count,10);
      // Otro objeto: se intercambian.
      await place(0,CHEST,{inventory:[{id:'pocion_vida_minuscula',count:3}]});
      const swapped=await bank(0,'deposit',0,{id:'pocion_vida_minuscula',count:3},null,7);
      assert.equal(swapped.bank.items[7].id,'pocion_vida_minuscula');assert.deepEqual(swapped.inventory[0],{id:'pan_duro',count:50,bound:false});
      // Retirar a un hueco con un objeto ligado: no puede ir al baúl.
      await place(0,CHEST,{inventory:[null,{id:'espada_inicial',count:1,bound:true}]});
      await reject(()=>bank(0,'withdraw',7,{id:'pocion_vida_minuscula',count:3,bound:false},null,1),/BANK_ITEM_BOUND/);
      const out=await bank(0,'withdraw',7,{id:'pocion_vida_minuscula',count:3,bound:false},null,4);
      assert.equal(out.inventory[4].id,'pocion_vida_minuscula');assert.equal(out.bank.items[7],null);
      // Reordenar el baúl.
      await place(0,CHEST,{inventory:[{id:'pan_duro',count:5}]});
      await bank(0,'deposit',0,{id:'pan_duro',count:5},null,2);
      const moved=await bank(0,'move',2,{id:'pan_duro',count:5,bound:false},null,9);
      assert.equal(moved.bank.items[2],null);assert.equal(moved.bank.items[9].count,5);
      await reject(()=>bank(0,'move',9,{id:'pan_duro',count:5,bound:false},null,9),/INVALID_ITEM/);
      await reject(()=>bank(0,'deposit',0,{id:'pan_duro',count:5},null,50),/INVALID_ITEM|INVENTORY_CHANGED/);
    });

    await t.test('requires being alive, present and next to the chest',async()=>{
      await reset(); await join(0);
      await place(0,{x:2.25,z:-2,yaw:0});
      await reject(()=>bank(0,'open'),/BANK_TOO_FAR/);
      await place(0,CHEST,{location:'brumaluz'});
      await reject(()=>bank(0,'open'),/BANK_NOT_PLAYING/);
      await place(0);
      await admin("update public.world_players set seen_at=now()-interval '1 minute' where character_id=$1",[chars[0]]);
      await reject(()=>bank(0,'open'),/BANK_NOT_PLAYING/);
      await place(0,CHEST,{health:0});
      await reject(()=>bank(0,'open'),/BANK_DEAD/);
    });
  } finally { await db.query('rollback');await db.end(); }
});

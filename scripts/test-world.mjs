import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';

const port = Number(process.env.TEST_WORLD_PORT || 4175);
const url = `http://127.0.0.1:${port}`;
const npcDefinitions = JSON.parse(readFileSync(new URL('../src/data/npcs.json', import.meta.url), 'utf8')).npcs;
const project = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
let server, browser;
before(async () => {
  assert.ok(project, 'Build with the public Supabase configuration before running browser tests');
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort']);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview server did not start')), 15000);
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`Preview server exited: ${code}`)));
    server.stdout.on('data', (data) => {
      if (stripVTControlCharacters(data.toString()).includes(url)) { clearTimeout(timer); resolve(); }
    });
    server.stderr.on('data', (data) => process.stderr.write(data));
  });
  assert.equal((await fetch(url)).status, 200);
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
});
after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
});

function fixture(name, race, x) {
  const userId = randomUUID(), characterId = randomUUID();
  const user = { id: userId, email: `${name}@example.test`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const data = { name, race, cls: 'guerrero', title: 'recien_llegado', level: 1, health: -1, position: { x, z: -11.085, yaw: 0 }, attributePoints: { fuerza: 2 } };
  return { user, character: { id: characterId, user_id: userId, name, data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } };
}
function backend() {
  return { players: new Map(), accounts: new Map(), friends: new Map(), parties:new Map(), partyInvites:new Map(), partyResponses:[], history: [], chatSockets: new Map(), fail: new Set(), delay: new Map(), rpcDelay: new Map(), logoutFails: false, counts: new Map(), maximum: new Map(), active: new Map(), combatCalls:[],combatSimulationEnabled:false };
}
function partyOf(world,userId){return [...world.parties.values()].find(party=>party.members.includes(userId));}
function cleanupParties(world){
  for(const [id,party] of world.parties){party.members=party.members.filter(user=>world.players.has(user));if(!party.members.length)world.parties.delete(id);}
  for(const [id,invite] of world.partyInvites)if(!world.parties.has(invite.partyId)||!world.players.has(invite.target)||partyOf(world,invite.target))world.partyInvites.delete(id);
}
function partyMember(world,userId){
  const p=world.players.get(userId),account=world.accounts.get(userId),peers=partyOf(world,userId).members.length-1;
  const boosted=value=>Math.floor(value*(1000+peers*15)/1000);
  const maxHealth=boosted(100+(p.data.level-1)*12+(p.data.attributePoints?.corpulencia??0)*8);
  const mana=['mago','clerigo'].includes(p.data.cls),maxResource=boosted((mana?65+(p.data.race==='elfo'?14:0):80)+(p.data.level-1)*6+(mana?0:(p.data.attributePoints?.corpulencia??0)*3));
  return {userId,characterId:p.id,username:account.username||p.data.name,data:p.data,position:p.position,location:'brumaluz',
    vitals:{health:p.data.health<0?maxHealth:Math.min(p.data.health,maxHealth),maxHealth,overheal:0,resource:maxResource,maxResource,resourceKind:mana?'mana':'stamina'}};
}
async function openPlayer(world, account, compatible = true, clockTime) {
  world.accounts.set(account.user.id, account);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.routeWebSocket(/supabase\.co/, (socket) => {
    socket.onMessage((raw) => {
      const frame = JSON.parse(raw.toString());
      const array = Array.isArray(frame);
      const [joinRef, ref, topic, event, payload] = array ? frame : [frame.join_ref,frame.ref,frame.topic,frame.event,frame.payload];
      const send = (event, payload) => socket.send(JSON.stringify(array ? [joinRef,ref,topic,event,payload] : {join_ref:joinRef,ref,topic,event,payload}));
      if (event === 'phx_join') {
        send('phx_reply',{status:'ok',response:{postgres_changes:(payload.config?.postgres_changes || []).map((filter)=>({...filter,id:1}))}});
        world.chatSockets.set(account.user.id,(row) => send('postgres_changes',{ids:[1],data:{schema:'public',table:'chat_messages',type:'INSERT',commit_timestamp:row.created_at,columns:[],record:row,errors:null}}));
      } else if (event === 'phx_leave') {
        world.chatSockets.delete(account.user.id);
        send('phx_reply',{status:'ok',response:{}});
      } else if (event === 'heartbeat') send('phx_reply',{status:'ok',response:{}});
    });
    socket.onClose(() => world.chatSockets.delete(account.user.id));
  });
  await context.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const fulfill = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/v1/logout' && world.logoutFails) return fulfill({ msg: 'Logout temporarily unavailable' }, 500);
    if (path.startsWith('/auth/v1/')) return fulfill(account.user);
    if (path === '/rest/v1/profiles') {
      const userId = new URL(request.url()).searchParams.get('user_id')?.replace(/^eq\./,'');
      const target = userId ? world.accounts.get(userId) : account;
      return fulfill(target ? { username: target.username || target.character.name } : null);
    }
    if (path === '/rest/v1/characters') return fulfill(account.characters || [account.character]);
    if (path === '/rest/v1/chat_messages') return fulfill(world.history);
    const fn = path.split('/').at(-1);
    const args = request.postDataJSON() || {};
    const character = (account.characters || [account.character]).find((c) => c.id === args.p_character_id) || account.character;
    const data = { ...character.data };
    if (world.rpcDelay.has(fn)) await new Promise((resolve) => setTimeout(resolve, world.rpcDelay.get(fn)));
    if (fn === 'character_enter') return fulfill(data);
    if (fn === 'create_character') return fulfill(randomUUID());
    if (fn === 'set_character_title') { character.data.title = args.p_title; return fulfill({ ...data, title: args.p_title }); }
    if (fn === 'my_titles') return fulfill(account.titles || []);
    const key = account.user.id;
    if(fn==='change_equipment'){
      if(world.fail.has('equipment'))return fulfill({message:'Temporary equipment failure'},503);
      const {p_slot:slot,p_bag:bag,p_expected:expected}=args;
      const inv=Array.from({length:25},(_,i)=>character.data.inventory?.[i]??null);
      const equipment={...(character.data.equipment??{})};
      const source=bag===null?equipment[slot]:inv[bag];
      if(JSON.stringify(source)!==JSON.stringify(expected))return fulfill({message:'EQUIPMENT_CHANGED'},400);
      if(bag===null){
        const free=inv.findIndex(item=>!item);
        if(free<0)return fulfill({message:'INVENTORY_FULL'},400);
        inv[free]=source;equipment[slot]=null;
      }else{inv[bag]=equipment[slot]??null;equipment[slot]=source;}
      Object.assign(character.data,{equipment,inventory:inv});
      return fulfill(character.data);
    }
    if(fn==='loot_corpse'){
      const corpse=character.data.combatEncounter;
      if(!corpse||corpse.instanceId!==args.p_instance_id)return fulfill({message:'LOOT_INVALID'},400);
      if(corpse.looted)return fulfill({message:'LOOT_EMPTY'},400);
      if(world.fail.has('loot'))return fulfill({message:'INVENTORY_FULL'},400);
      const inv=Array.from({length:25},(_,i)=>character.data.inventory?.[i]??null);
      const free=inv.findIndex(item=>!item);
      if(free<0)return fulfill({message:'INVENTORY_FULL'},400);
      inv[free]=corpse.loot[0];
      character.data.combatEncounter={...corpse,loot:[null],looted:true};
      Object.assign(character.data,{inventory:inv});
      const player=world.players.get(key);
      if(player)player.encounter=character.data.combatEncounter;
      return fulfill(character.data);
    }
    if(fn==='collect_coin_bag'){
      const taken=character.data.coinBags??[];
      if(args.p_bag_id!=='plaza_pozo')return fulfill({message:'COIN_BAG_INVALID'},400);
      if(taken.includes(args.p_bag_id))return fulfill({message:'COIN_BAG_TAKEN'},400);
      if(world.fail.has('coinbag'))return fulfill({message:'COIN_BAG_TOO_FAR'},400);
      character.data.wallet={...(character.data.wallet??{}),pelines:(character.data.wallet?.pelines??0)+17};
      character.data.coinBags=[...taken,args.p_bag_id];
      return fulfill(character.data);
    }
    if(fn==='shadow_action'){
      if(world.fail.has('shadow'))return fulfill({message:'Temporary quest failure'},503);
      const q=character.data.shadowQuest;
      if(args.p_action==='report'&&q==='defeated')character.data.shadowQuest='returning';
      else if(args.p_action==='return'&&q==='returning')character.data.shadowQuest='returned';
      else return fulfill({message:'SHADOW_INVALID_STATE'},400);
      return fulfill(character.data);
    }
    if(fn==='upgrade_skill'){
      if(world.fail.has('skill'))return fulfill({message:'Temporary skill failure'},503);
      const ids={guerrero:'heavy_strike',mago:'arcane_discharge',picaro:'double_slash',clerigo:'healing',explorador:'precise_shot'};
      const id=ids[character.data.cls],rank=character.data.skillRanks?.[id]??1;
      if(args.p_skill_id!==id)return fulfill({message:'SKILL_INVALID'},400);
      if(args.p_expected_rank!==rank)return fulfill({message:'SKILL_CHANGED'},400);
      if(rank>=5)return fulfill({message:'SKILL_MAX_RANK'},400);
      if(character.data.level<rank*2)return fulfill({message:'SKILL_LEVEL_REQUIRED'},400);
      character.data.skillRanks={...(character.data.skillRanks??{}),[id]:rank+1};
      return fulfill(character.data);
    }
    if(fn==='welcome_action'){
      if(world.fail.has('welcome'))return fulfill({message:'Temporary quest failure'},503);
      const q=character.data.welcome;
      if(!q)return fulfill({message:'WELCOME_UNAVAILABLE'},400);
      if(args.p_action==='origin'&&q.stage==='available'&&q.origin===null)q.origin=args.p_origin;
      else if(args.p_action==='accept'&&q.stage==='available'&&q.origin!==null)q.stage='active';
      else if(args.p_action==='collect'&&q.stage==='active')q.stage='found';
      else if(args.p_action==='claim'&&q.stage==='found'){
        q.stage='completed';character.data.experience=(character.data.experience||0)+40;
        character.data.wallet={...(character.data.wallet||{}),pelines:(character.data.wallet?.pelines||0)+5};
        const pos=world.players.get(key)?.position??character.data.position;
        character.data.isbertoPosition={x:pos.x+2,z:pos.z};
      }else return fulfill({message:'WELCOME_INVALID_STATE'},400);
      return fulfill(character.data);
    }
    if(fn==='trade_action') {
      world.trades ??= new Map();
      for(const tr of world.trades.values()) {
        const a=world.players.get(tr.a),b=world.players.get(tr.b);
        if(['invited','open'].includes(tr.status) && (!a || !b || a.session!==tr.sa || b.session!==tr.sb
          || Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)>10)) {
          tr.status='cancelled';tr.reason='TRADE_UNAVAILABLE';
        }
      }
      let tr=args.p_trade_id ? world.trades.get(args.p_trade_id) : [...world.trades.values()].reverse().find(tr=>[tr.a,tr.b].includes(key));
      if(args.p_action==='invite') {
        const target=[...world.players.values()].find(player=>player.id===args.p_target_id),self=world.players.get(key);
        if(!target || !self) return fulfill({message:'TRADE_UNAVAILABLE'},400);
        tr={id:randomUUID(),a:key,b:target.userId,sa:self.session,sb:target.session,status:'invited',reason:null,revision:0,
          offer_a:{items:[],pelines:0},offer_b:{items:[],pelines:0},accepted_a:false,accepted_b:false};
        world.trades.set(tr.id,tr);
      }
      if(!tr) return fulfill({trade:null});
      if(![tr.a,tr.b].includes(key)) return fulfill({message:'TRADE_NOT_FOUND'},400);
      const isA=tr.a===key,own=isA?'a':'b',peer=isA?'b':'a';
      if(args.p_action==='join')tr.status='open';
      if(args.p_action==='cancel'){tr.status='cancelled';tr.reason='TRADE_CANCELLED';}
      if(args.p_action==='back')tr[`accepted_${own}`]=false;
      if(args.p_action==='offer') {
        if(args.p_revision!==tr.revision) return fulfill({message:'TRADE_CHANGED'},400);
        tr[`offer_${own}`]=args.p_offer;tr.revision++;tr.accepted_a=false;tr.accepted_b=false;
      }
      if(args.p_action==='accept') {
        if(args.p_revision!==tr.revision) return fulfill({message:'TRADE_CHANGED'},400);
        tr[`accepted_${own}`]=true;
        if(tr.accepted_a && tr.accepted_b) {
          const dataA=world.accounts.get(tr.a).character.data,dataB=world.accounts.get(tr.b).character.data;
          const remove=(data,offer)=>{
            for(const item of offer.items) {
              data.inventory[item.slot].count-=item.count;
              if(!data.inventory[item.slot].count)data.inventory[item.slot]=null;
            }
            data.wallet.pelines-=offer.pelines;
          };
          const add=(data,offer)=>{
            for(const item of offer.items) {
              const found=data.inventory.find(stack=>stack?.id===item.id && !stack.bound);
              if(found)found.count+=item.count;else data.inventory.push({id:item.id,count:item.count});
            }
            data.wallet.pelines+=offer.pelines;
          };
          remove(dataA,tr.offer_a);remove(dataB,tr.offer_b);add(dataA,tr.offer_b);add(dataB,tr.offer_a);
          tr.status='completed';
        }
      }
      const selfData=world.accounts.get(key).character.data;
      return fulfill({trade:{id:tr.id,status:tr.status,reason:tr.reason,revision:tr.revision,incoming:!isA,
        peerId:world.accounts.get(tr[peer]).character.id,peerName:world.accounts.get(tr[peer]).character.name,
        own:tr[`offer_${own}`],peer:tr[`offer_${peer}`],accepted:tr[`accepted_${own}`],peerAccepted:tr[`accepted_${peer}`]},
        inventory:selfData.inventory ?? [],wallet:selfData.wallet ?? {pelines:0}});
    }
    if(fn.startsWith('party_')){
      cleanupParties(world);
      const party=partyOf(world,key);
      if(fn==='party_state'){
        const responses=world.partyResponses.filter(response=>response.recipient===key);
        world.partyResponses=world.partyResponses.filter(response=>response.recipient!==key);
        return fulfill({
        id:party?.id||null,members:party?party.members.map(user=>partyMember(world,user)):[],
        incoming:[...world.partyInvites.values()].filter(i=>i.target===key).map(i=>({id:i.id,username:world.accounts.get(world.parties.get(i.partyId).members[0]).username||world.accounts.get(world.parties.get(i.partyId).members[0]).character.name})),
        outgoing:party?.members[0]===key?[...world.partyInvites.values()].filter(i=>i.partyId===party.id).map(i=>({id:i.id,username:world.accounts.get(i.target).username||world.accounts.get(i.target).character.name})):[],
        responses:responses.map(({id,username,accepted})=>({id,username,accepted})),
      });}
      if(fn==='party_invite'){
        const target=[...world.accounts.values()].find(a=>(a.username||a.character.name).toLowerCase()===args.p_username.replace(/^~/,'').toLowerCase());
        if(!target||!world.players.has(target.user.id))return fulfill({message:'PARTY_TARGET_OFFLINE'},400);
        if(party&&party.members[0]!==key)return fulfill({message:'PARTY_LEADER_ONLY'},400);
        if(party?.members.length>=4)return fulfill({message:'PARTY_FULL'},400);
        if(partyOf(world,target.user.id))return fulfill({message:'PARTY_ALREADY_JOINED'},400);
        const group=party||{id:randomUUID(),members:[key]};world.parties.set(group.id,group);
        const invite={id:randomUUID(),partyId:group.id,target:target.user.id};world.partyInvites.set(invite.id,invite);
      }else if(fn==='party_respond'){
        const invite=world.partyInvites.get(args.p_invite_id);
        if(!invite||invite.target!==key)return fulfill({message:'PARTY_INVITE_INVALID'},400);
        const group=world.parties.get(invite.partyId);
        if(args.p_accept){if(group.members.length===4)return fulfill({message:'PARTY_FULL'},400);group.members.push(key);}
        world.partyResponses.push({id:randomUUID(),recipient:group.members[0],username:account.username||character.name,accepted:args.p_accept});
        world.partyInvites.delete(invite.id);
        if(!args.p_accept&&group.members.length===1&&![...world.partyInvites.values()].some(i=>i.partyId===group.id))world.parties.delete(group.id);
      }else if(fn==='party_leave'&&party){party.members=party.members.filter(user=>user!==key);}
      return route.fulfill({status:204});
    }
    if(fn==='chat_send'){
      const party=partyOf(world,key);
      if(args.p_channel==='party'&&!party)return fulfill({message:'PARTY_NOT_JOINED'},400);
      const row={id:world.history.length+1,channel:args.p_channel,zone:'brumaluz',sender_user:key,sender_name:character.name,sender_account:account.username||character.name,sender_title:character.data.title,body:args.p_body,created_at:new Date().toISOString()};
      world.history.push(row);
      for(const [userId,send] of world.chatSockets)if(args.p_channel!=='party'||party.members.includes(userId))send(row);
      return fulfill(row);
    }
    if (fn === 'friends_list') {
      const entries = [];
      for (const relation of world.friends.values()) {
        if (![relation.from, relation.to].includes(key)) continue;
        const target = world.accounts.get(relation.from === key ? relation.to : relation.from);
        const player = relation.accepted ? world.players.get(target.user.id) : null;
        entries.push({ userId: target.user.id, username: target.username || target.character.name, status: relation.accepted ? 'friend' : relation.from === key ? 'outgoing' : 'incoming', online: !!player, characterName: player?.data.name || null, characterClass: player?.data.cls || null, characterLevel: player?.data.level || null, location: player ? 'brumaluz' : null });
      }
      return fulfill(entries);
    }
    if (fn === 'friend_request') {
      const target = [...world.accounts.values()].find((a) => (a.username || a.character.name).toLowerCase() === args.p_username.toLowerCase());
      if (!target) return fulfill({message:'PLAYER_NOT_FOUND'},400);
      if (target.user.id === key) return fulfill({message:'FRIEND_SELF'},400);
      const pair = [key,target.user.id].sort().join(':');
      if (world.friends.has(pair)) return fulfill({message:'FRIEND_ALREADY_EXISTS'},400);
      world.friends.set(pair,{from:key,to:target.user.id,accepted:false});
      return route.fulfill({status:204});
    }
    if (fn === 'friend_update') {
      const pair = [key,args.p_user_id].sort().join(':');
      if (args.p_action === 'accept') world.friends.get(pair).accepted = true;
      else world.friends.delete(pair);
      return route.fulfill({status:204});
    }
    if (fn === 'combat_start' || fn === 'combat_action' || fn === 'combat_stop') {
      const player=world.players.get(key);
      if(!player||player.id!==args.p_character_id)return fulfill({message:'COMBAT_NOT_PLAYING'},400);
      if(player.data.welcome?.stage!=='completed'&&fn!=='combat_stop')return fulfill({message:'WELCOME_REQUIRED'},400);
      world.combatCalls.push({userId:key,fn,action:args.p_action??null});
      if(fn==='combat_start'){
        if(player.encounter?.status==='active')return fulfill({message:'COMBAT_ALREADY_ACTIVE'},400);
        player.encounter={id:'shadowling',status:'active',engaged:false,health:100,maxHealth:100,x:3.5,z:-62.35,enemyAttackAt:(Date.now()+750)/1000};
        player.nextEnemyAttack=Date.now()+750;
        return fulfill({encounter:player.encounter,vitals:player.vitals,damage:0,healing:0});
      }
      if(fn==='combat_stop'){
        if(player.encounter?.status==='active')player.encounter={...player.encounter,status:'fled'};
        return fulfill({encounter:player.encounter??null,vitals:player.vitals});
      }
      if(player.encounter?.status!=='active')return fulfill({message:'COMBAT_NO_TARGET'},400);
      const skill=args.p_action==='skill'||args.p_action==='heavy_strike',damage=skill?18:10;
      if(skill){
        if(player.vitals.resource<15)return fulfill({message:'COMBAT_NOT_ENOUGH_RESOURCE'},400);
        player.vitals={...player.vitals,resource:player.vitals.resource-15};
      }
      player.encounter={...player.encounter,engaged:true,health:Math.max(0,player.encounter.health-damage),
        status:player.encounter.health<=damage?'defeated':'active'};
      return fulfill({encounter:player.encounter,vitals:player.vitals,damage,healing:0});
    }
    if (fn === 'world_leave') {
      if (world.players.get(key)?.session === args.p_session_id) world.players.delete(key);
      return route.fulfill({ status: 204 });
    }
    if (!['world_join', 'world_sync'].includes(fn)) return fulfill({ message: `Unexpected test RPC: ${fn}` }, 500);
    if (world.fail.has(key)) return fulfill({ message: 'Temporary connection failure' }, 503);
    let player = world.players.get(key);
    if (fn === 'world_join') {
      const resourceKind=['mago','clerigo'].includes(character.data.cls)?'mana':'stamina';
      player = { id: character.id, userId: key, session: args.p_session_id, data: character.data, position: { ...character.data.position }, facing: Math.PI, jump: 0, wave: 0, dead: false,
        vitals:world.combatSimulationEnabled?{health:100,maxHealth:100,overheal:0,resource:80,maxResource:80,resourceKind}:undefined,
        encounter:character.data.combatEncounter??(world.combatSimulationEnabled?null:undefined),nextEnemyAttack:0 };
      world.players.set(key, player);
    } else if (!player || player.session !== args.p_session_id) return fulfill({ message: 'WORLD_SESSION_REPLACED' }, 400);
    world.counts.set(key, (world.counts.get(key) || 0) + 1);
    world.active.set(key, (world.active.get(key) || 0) + 1);
    world.maximum.set(key, Math.max(world.maximum.get(key) || 0, world.active.get(key)));
    let status = 'ok';
    if (fn === 'world_sync') {
      const motion = args.p_state;
      if (Math.hypot(motion.x - player.position.x, motion.z - player.position.z) > 20) status = 'corrected';
      else { player.position = { x: motion.x, z: motion.z, yaw: motion.yaw }; player.facing = motion.facing; player.jump = motion.jump; player.wave = motion.wave; }
      if(world.combatSimulationEnabled&&player.encounter?.status==='active'&&Date.now()>=player.nextEnemyAttack
        &&Math.hypot(player.position.x-player.encounter.x,player.position.z-player.encounter.z)<=2){
        player.vitals={...player.vitals,health:Math.max(0,player.vitals.health-8)};
        player.nextEnemyAttack=Date.now()+3000;
        player.encounter={...player.encounter,engaged:true,enemyAttackAt:player.nextEnemyAttack/1000,
          status:player.vitals.health===0?'failed':'active'};
      }
    }
    const response = { status, position: { ...player.position },
      ...(world.combatSimulationEnabled?{vitals:player.vitals,encounter:player.encounter??null}:{}),
      food: { buff: character.data.foodBuff ?? null, revision: character.data.foodRevision ?? 0, at: Date.now() / 1000 },
      players: [...world.players.values()].filter((p) => p.userId !== key).map((p) => ({
      ...p, position: { ...p.position }, username: world.accounts.get(p.userId).username || p.data.name,
      vitals: p.vitals || { health: p.dead ? 0 : 80, maxHealth: 100, overheal: 0, resource: 35, maxResource: 70, resourceKind: ['mago','clerigo'].includes(p.data.cls) ? 'mana' : 'stamina' },
    })) };
    if (world.delay.has(key)) await new Promise((resolve) => setTimeout(resolve, world.delay.get(key)));
    world.active.set(key, world.active.get(key) - 1);
    return fulfill(response);
  });
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: account.user.id, exp })).toString('base64url')}.test-signature`;
  await page.addInitScript(({ project, jwt, exp, user }) => {
    const NativeAudioContext = window.AudioContext;
    window.__audioContexts = [];
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) {
        super(...args);
        window.__audioContexts.push(this);
        const createGain = this.createGain.bind(this);
        this.createGain = () => {
          const gain = createGain();
          if (!this.testMaster) this.testMaster = gain;
          return gain;
        };
      }
    };
    localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify({ access_token: jwt, refresh_token: 'test-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }));
    localStorage.setItem('brumaluz-ambient', 'off');
    if (localStorage.getItem('brumaluz-menu-music') === null) localStorage.setItem('brumaluz-menu-music', 'off');
    localStorage.setItem('brumaluz-language', 'es');
  }, { project, jwt, exp, user: account.user });
  if (clockTime) await page.clock.install({ time: clockTime });
  await page.goto(`${url}/${compatible ? '?graphics=compatible' : ''}`);
  await page.waitForFunction(() => !!window.brumaluz, { timeout: 90000 });
  await page.locator('.character-card .btn.gold').first().waitFor({ timeout: 30000 });
  return { context, page, errors, async enter() {
    await page.locator('.character-card .btn.gold').first().click();
    await page.waitForFunction(() => document.body.classList.contains('playing'));
  } };
}
async function remote(page, id) {
  await page.waitForFunction((id) => window.brumaluz.players().some((p) => p.id === id), id);
}
async function leave(page) {
  await page.locator('#game-menu-toggle').click();
  await page.locator('#game-menu-characters').click();
  await page.waitForFunction(() => !document.body.classList.contains('playing'));
  await page.locator('.character-card .btn.gold').first().waitFor({ state: 'visible' });
}
async function chatReady(world, player) {
  for (let attempt = 0; attempt < 100 && !world.chatSockets.has(player.user.id); attempt++) await new Promise(resolve=>setTimeout(resolve,50));
  assert.ok(world.chatSockets.has(player.user.id),'Mock live chat subscription must be ready');
}
async function revealChat(page) {
  await page.locator('.chat-peek').waitFor({state:'visible'});
  const box=await page.locator('.chat-peek').boundingBox();
  assert.ok(box,'Chat corner handle must be available');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
}

test('low world props block at ground level and allow landing height above their top', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Saltador','humano',4.4);
  account.character.data.position={x:4.4,z:3.2,yaw:0};
  const player=await openPlayer(world,account);
  try{
    await player.enter();
    const collision=await player.page.evaluate(()=>{
      const city=window.brumaluz.city(),character=window.brumaluz.char();
      const x=5.5,z=3.2,top=city.platformY(x,z),ground=city.groundY(x,z),targetX=5.2;
      const from=character.root.position.clone().set(4.4,ground,z);
      const low=city.collide(from,from.clone().set(targetX,ground,z));
      const high=city.collide(from.clone().setY((top??ground)+0.12),from.clone().set(targetX,(top??ground)+0.12,z));
      return {top,ground,blockedX:low.x,passedX:high.x};
    });
    assert.ok(collision.top!==null&&collision.top>collision.ground+0.3,`The plaza barrel exposes a raised top surface: ${JSON.stringify(collision)}`);
    assert.ok(collision.blockedX<5,`The barrel still blocks horizontal movement from below: ${JSON.stringify(collision)}`);
    assert.ok(Math.abs(collision.passedX-5.2)<0.01,`The character can move across the barrel top when reaching its height: ${JSON.stringify(collision)}`);
    await player.page.waitForTimeout(2500);
    await player.page.evaluate(()=>window.brumaluz.view(0,0.55,12));
    await player.page.keyboard.down('Space');
    await player.page.keyboard.down('KeyD');
    await player.page.waitForTimeout(260);
    const airborne=await player.page.evaluate(()=>window.brumaluz.char().root.parent.position.y);
    await player.page.keyboard.up('KeyD');
    await player.page.keyboard.up('Space');
    await player.page.waitForTimeout(850);
    const landed=await player.page.evaluate(()=>{
      const root=window.brumaluz.char().root;
      const holder=root.parent,city=window.brumaluz.city();
      return {x:holder.position.x,y:holder.position.y,z:holder.position.z,ground:city.groundY(holder.position.x,holder.position.z)};
    });
    assert.ok(airborne>collision.ground+0.5,`The character rises during the jump: y=${airborne}`);
    assert.ok(landed.x>5.05&&landed.x<5.95,`The jump moves the character onto the barrel: ${JSON.stringify(landed)}`);
    assert.ok(landed.y>landed.ground+0.55,`The character lands above ground on the barrel: ${JSON.stringify(landed)}`);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('world collision shapes cover props and every placed tree or terrain variant', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Explorador','humano',4.4);
  const player=await openPlayer(world,account);
  try{
    await player.enter();
    const audit=await player.page.evaluate(()=>{
      const city=window.brumaluz.city(),Vector3=city.spawn.constructor;
      const wheelbarrow=new Vector3(3.5,city.groundY(3.5,-6.2),-6.2);
      const wheelbarrowResult=city.collide(wheelbarrow,wheelbarrow.clone());
      const names=['tree_single_A','tree_single_B','trees_A_large','trees_B_large','trees_A_medium','trees_B_medium','trees_A_small','hills_A_trees','hills_B_trees','hills_C_trees','hill_single_A','hill_single_B','mountain_A_grass_trees','mountain_B_grass_trees','mountain_C_grass','watermill'];
      const features=[];
      for(const name of names){
        const mesh=city.root.children.find(child=>child.name===name&&child.isInstancedMesh);
        if(!mesh||!mesh.count)continue;
        const matrix=mesh.matrix.clone();mesh.getMatrixAt(0,matrix);
        const x=matrix.elements[12],z=matrix.elements[14],length=Math.hypot(x,z)||1;
        const inwardX=-x/length,inwardZ=-z/length;
        const from=new Vector3(x+inwardX*4,city.groundY(x+inwardX*4,z+inwardZ*4),z+inwardZ*4);
        const to=new Vector3(x+inwardX*.2,city.groundY(x+inwardX*.2,z+inwardZ*.2),z+inwardZ*.2);
        const result=city.collide(from,to);
        features.push({name,count:mesh.count,distance:Math.hypot(result.x-x,result.z-z)});
      }
      return {wheelbarrowDistance:Math.hypot(wheelbarrowResult.x-wheelbarrow.x,wheelbarrowResult.z-wheelbarrow.z),features};
    });
    assert.ok(audit.wheelbarrowDistance>0.8&&audit.wheelbarrowDistance<2,`The wheelbarrow has a fitted solid collision body: ${JSON.stringify(audit)}`);
    assert.ok(audit.features.length>=8,`The current map exposes several placed tree and terrain model variants: ${JSON.stringify(audit)}`);
    for(const feature of audit.features){
      assert.ok(Number.isFinite(feature.distance),`${feature.name} has a finite collision footprint`);
      const isTree=feature.name.startsWith('tree_')||feature.name.startsWith('trees_');
      assert.ok(feature.distance>(isTree?0.7:1.7)&&feature.distance<4.5,`${feature.name} collision matches the visible trunk or terrain footprint: ${JSON.stringify(feature)}`);
    }
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('starter equipment renders every class weapon without replacing novice clothes or granting legacy kits', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Equipado','humano',-6.4);
  const player=await openPlayer(world,account);
  const kits=[
    ['guerrero','espada_inicial','escudo_inicial',['1H_Sword','Badge_Shield']],
    ['mago','baston_inicial',null,['2H_Staff']],
    ['picaro','daga_inicial','daga_secundaria_inicial',['Knife','Knife_Offhand']],
    ['clerigo','varita_inicial','libro_inicial',['1H_Wand','Spellbook']],
    ['explorador','ballesta_inicial',null,['1H_Crossbow']],
  ];
  try{
    await player.enter();
    assert.equal(await player.page.evaluate(()=>!!window.brumaluz.char().root.getObjectByName('1H_Sword')),false,'Legacy characters remain unarmed');
    for(const [cls,weapon,offhand,models] of kits){
      Object.assign(account.character.data,{cls,equipment:{weapon:{id:weapon,count:1,bound:true},offhand:offhand?{id:offhand,count:1,bound:true}:null},inventory:[]});
      await player.page.evaluate(({cls,weapon,offhand})=>window.brumaluz.set({
        cls,equipment:{
          weapon:{id:weapon,count:1,bound:true},
          offhand:offhand?{id:offhand,count:1,bound:true}:null,
        },
      }),{cls,weapon,offhand});
      const rendered=await player.page.evaluate(models=>{
        const root=window.brumaluz.char().root;
        return {weapons:models.every(name=>!!root.getObjectByName(name)),novice:!!root.getObjectByName('Rogue_Body')};
      },models);
      assert.equal(rendered.weapons,true,`${cls} equipped meshes`);
      assert.equal(rendered.novice,true,`${cls} keeps novice clothes`);
      await player.page.keyboard.press('KeyI');
      assert.ok(await player.page.locator(`#window-body [data-item-id="${weapon}"]`).count()>0,`${cls} equipment tooltip in inventory`);
      assert.equal(await player.page.locator('.inv-hint').filter({hasText:'Pulsa una pieza'}).count(),0);
      if(cls==='guerrero'){
        await player.page.locator('.equip[data-slot="weapon"]').hover();
        await player.page.locator('#game-tooltip.item-tooltip').waitFor({state:'visible'});
        assert.equal(await player.page.locator('.item-tip-binding').textContent(),'Ligado');
        assert.equal(await player.page.locator('.item-tip-binding').getAttribute('aria-label'),'Ligado · No intercambiable');
        assert.ok(await player.page.locator('#game-tooltip').evaluate(el=>{
          const badge=el.querySelector('.item-tip-binding').getBoundingClientRect(),header=el.querySelector('.item-tip-header').getBoundingClientRect();
          return badge.right<=el.getBoundingClientRect().right&&badge.bottom<=header.top+1;
        }),'Binding is a small corner badge above the item identity');
        assert.ok(await player.page.locator('.equip[data-slot="weapon"] svg path').count()>15);
        assert.ok(await player.page.locator('.equip[data-slot="offhand"] svg path').count()>15);
        if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await player.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'novice-equipment-art.png')});
      }
      await player.page.locator('.equip[data-slot="weapon"]').click();
      await player.page.locator(`.inv-grid [data-item-id="${weapon}"]`).waitFor();
      assert.equal(await player.page.evaluate(name=>!!window.brumaluz.char().root.getObjectByName(name),models[0]),false,`${cls} unequipped model disappears`);
      assert.deepEqual(account.character.data.inventory[0],{id:weapon,count:1,bound:true});
      await player.page.locator(`.inv-grid [data-item-id="${weapon}"]`).hover();
      await player.page.locator('#game-tooltip').filter({hasText:'equipar'}).waitFor();
      await player.page.locator(`.inv-grid [data-item-id="${weapon}"]`).click();
      await player.page.waitForFunction(name=>!!window.brumaluz.char().root.getObjectByName(name),models[0]);
      assert.equal(account.character.data.inventory[0],null);
      await player.page.keyboard.press('Escape');
    }
    world.fail.add('equipment');
    await player.page.keyboard.press('KeyI');
    await player.page.locator('.equip[data-slot="weapon"]').click();
    await player.page.locator('#toast').filter({hasText:'Temporary equipment failure'}).waitFor();
    assert.equal(await player.page.evaluate(()=>!!window.brumaluz.char().root.getObjectByName('1H_Crossbow')),true,'Failed transfers keep the equipped mesh');
    world.fail.delete('equipment');
    await player.page.keyboard.press('Escape');
    await leave(player.page);await player.page.reload();await player.page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    assert.equal(await player.page.evaluate(()=>!!window.brumaluz.char().root.getObjectByName('1H_Crossbow')),true,'Equipment persists after reconnect');
  }finally{await player.context.close();}
});

test('welcome systems save origins directly, present quest cards, await server actions and persist the journal through rewards', {timeout:180000}, async()=>{
  const world=backend(),a=fixture('Alric','humano',-6.4),b=fixture('Elara','elfo',-5.4);
  a.character.data.welcome={origin:null,stage:'available'};
  a.character.data.inventory=Array.from({length:25},()=>({id:'pan_duro',count:50}));
  b.character.data.welcome={origin:null,stage:'available'};
  const first=await openPlayer(world,a),second=await openPlayer(world,b);
  const approach=async(page,x,z)=>{
    await page.evaluate(({x,z})=>window.brumaluz.move(x,z),{x,z});
    await page.waitForTimeout(800);
  };
  const talk=async(page,english=false)=>{
    await page.evaluate(()=>{
      const p=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal').position;
      window.brumaluz.move(p.x,p.z+1.7);
    });
    await page.waitForFunction(label=>document.querySelector('#interact-prompt').textContent.includes(label),english?'Talk to Gnomi':'Hablar con Gnomi');
    await page.keyboard.press('KeyE');
    await page.locator('#dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('.dialog-speaker').textContent(),'Gnomi');
  };
  try {
    await first.enter();await second.enter();
    const gnomiModel=await first.page.evaluate(()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      let skins=0,bones=0;
      g.traverse(object=>{if(object.isSkinnedMesh)skins++;if(object.isBone)bones++;});
      return {
        skins,bones,scale:g.getObjectByName('gnomi-rig').scale.y*g.getObjectByName('gnomi-rig').children[0].scale.y,
        hat:!!g.getObjectByName('helpers-soft-cap'),
        hatAnchor:g.getObjectByName('helpers-soft-cap')?.parent.name,
        bindings:(()=>{
          let compatible=true;
          g.traverse(object=>{
            if(object.isSkinnedMesh)compatible&&=object.skeleton.bones.every(bone=>g.getObjectByName(bone.name)===bone);
          });
          return compatible;
        })(),
        oldHat:!!g.getObjectByName('Mage_Hat'),
        oldBody:!!g.getObjectByName('Rogue_Body'),
        overalls:!!g.getObjectByName('helpers-overalls'),
      };
    });
    assert.ok(gnomiModel.skins>=10,'Gnomi uses independent skinned garments and exposed anatomy');
    assert.equal(gnomiModel.bones,41);
    assert.equal(gnomiModel.scale,.48,'Gnomi keeps his small size outside animation transforms');
    assert.equal(gnomiModel.hat,true);
    assert.equal(gnomiModel.hatAnchor,'head');
    assert.equal(gnomiModel.bindings,true,'Every garment follows the character skeleton rather than an unanimated copy');
    assert.equal(gnomiModel.oldHat,false,'The deformed wizard hat is no longer used');
    assert.equal(gnomiModel.oldBody,false,'The uniform replaces rather than overlaps the starting clothes');
    assert.equal(gnomiModel.overalls,true);
    const relativeHeight=await first.page.evaluate(()=>{
      const height=root=>{
        root.updateWorldMatrix(true,true);
        let bounds=null;
        root.traverse(object=>{
          if(!object.isMesh||!object.visible||object.material.transparent)return;
          if(object.isSkinnedMesh){object.skeleton.update();object.computeBoundingBox();}
          else object.geometry.computeBoundingBox();
          const box=(object.isSkinnedMesh?object.boundingBox:object.geometry.boundingBox).clone().applyMatrix4(object.matrixWorld);
          if(bounds)bounds.union(box);else bounds=box;
        });
        return bounds.max.y-bounds.min.y;
      };
      return height(window.brumaluz.city().root.parent.getObjectByName('gnomi-personal'))/height(window.brumaluz.char().root);
    });
    assert.ok(relativeHeight>.35&&relativeHeight<.6,`Gnomi including his hat reaches roughly mid-thigh: ${relativeHeight}`);
    await approach(first.page,-6.4,-8.5);
    await talk(first.page);
    assert.match(await first.page.locator('.dialog-text').textContent(),/ayudante de bienvenida/);
    assert.equal(await first.page.locator('.dialog-subtitle').textContent(),npcDefinitions.find(npc=>npc.id==='gnomi').subtitle);
    assert.equal(await first.page.locator('.dialog-quest-card').count(),0,'Ordinary conversation has no quest panel');
    world.rpcDelay.set('welcome_action',600);
    await first.page.getByRole('button',{name:'He venido a probar suerte.'}).click();
    assert.equal(await first.page.locator('#dialog').getAttribute('aria-busy'),'true');
    assert.equal(await first.page.getByRole('button',{name:'He venido a probar suerte.'}).isDisabled(),true);
    await first.page.keyboard.press('KeyE');
    await first.page.getByRole('button',{name:'Aceptar misión'}).waitFor();
    assert.equal(a.character.data.welcome.origin,1,'Selecting the response saves it directly with no confirmation step');
    assert.equal(await first.page.getByRole('button',{name:'Confirmar mi motivo'}).count(),0);
    assert.equal(a.character.data.welcome.stage,'available','Origin selection does not accept the quest');
    assert.equal(await first.page.locator('.dialog-quest-card h3').textContent(),'Algo pequeño, algo importante');
    assert.equal(await first.page.locator('.dialog-quest-card').getAttribute('aria-label'),'Nueva misión');
    assert.deepEqual(await first.page.locator('.dialog-quest-rewards > span').allTextContents(),['40 XP','5 pelines']);
    assert.equal(await first.page.locator('.dialog-hint').isVisible(),false,'Quest offers omit the redundant E / Choose hint');
    assert.equal(await first.page.getByRole('button',{name:'Aceptar misión'}).locator('.dialog-choice-mark').textContent(),'✓');
    assert.doesNotMatch(await first.page.locator('.dialog-text').textContent(),/Recompensa|40 XP/,'Rewards are structured UI, not dialogue prose');
    assert.match(await first.page.locator('.dialog-text').textContent(),/Gremio de Ayudantes.*¡Otra vez!.*David/s);
    for(const [width,height] of [[320,844],[390,844],[1280,844],[844,390],[320,568]]){
      await first.page.setViewportSize({width,height});
      const fits=await first.page.locator('#dialog').evaluate(el=>{
        const box=el.getBoundingClientRect();
        return box.top>=0&&box.bottom<=innerHeight&&box.left>=0&&box.right<=innerWidth&&el.scrollWidth<=el.clientWidth;
      });
      assert.ok(fits,`Quest offer fits ${width}px`);
      await first.page.waitForTimeout(1100);
      const framing=await first.page.evaluate(()=>{
        const camera=window.brumaluz.camera(),player=window.brumaluz.char().root.parent;
        const npc=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
        const top=document.querySelector('#dialog').getBoundingClientRect().top;
        return [player,npc].flatMap((actor,i)=>[.08,i===0?2.2:.95].map(height=>{
          const p=actor.position.clone();p.y+=height;p.project(camera);
          return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,z:p.z,top};
        }));
      });
      assert.ok(framing.every(p=>p.x>8&&p.x<width-8&&p.y>0&&p.y<p.top-8&&p.z>-1&&p.z<1),`Both characters remain above the dialogue at ${width}px: ${JSON.stringify(framing)}`);
      await first.page.getByRole('button',{name:'Aceptar misión'}).scrollIntoViewIfNeeded();
      assert.ok(await first.page.getByRole('button',{name:'Aceptar misión'}).evaluate(el=>{
        const box=el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
      }),`Quest acceptance is not covered by chat or minimap at ${width}px`);
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`welcome-offer-${width}.png`)});
    }
    await first.page.setViewportSize({width:1280,height:800});
    await first.page.waitForTimeout(600);
    const beforeOrbit=await first.page.evaluate(()=>({
      camera:window.brumaluz.camera().position.toArray(),player:window.brumaluz.char().root.parent.position.toArray(),
    }));
    await first.page.mouse.move(630,150);await first.page.mouse.down();
    await first.page.mouse.move(790,180,{steps:12});await first.page.mouse.up();
    await first.page.waitForTimeout(600);
    const afterOrbit=await first.page.evaluate(()=>({
      camera:window.brumaluz.camera().position.toArray(),player:window.brumaluz.char().root.parent.position.toArray(),
    }));
    assert.ok(Math.hypot(...afterOrbit.camera.map((v,i)=>v-beforeOrbit.camera[i]))>1,'Dragging orbits the conversation camera');
    assert.deepEqual(afterOrbit.player,beforeOrbit.player,'Orbiting never moves the player');
    assert.equal(await first.page.locator('#dialog').isVisible(),true,'Dragging never advances or closes the conversation');
    await first.page.locator('#scene').dispatchEvent('wheel',{deltaY:600});
    await first.page.keyboard.press('Escape');
    await first.page.waitForFunction(()=>!window.brumaluz.camera().view?.enabled);
    const restoredCamera=await first.page.evaluate(()=>{
      const position=window.brumaluz.camera().position.clone().sub(window.brumaluz.char().root.parent.position);
      return {yaw:Math.atan2(position.x,position.z),distance:Math.hypot(position.x,position.z)};
    });
    assert.ok(Math.abs(restoredCamera.yaw)<.02,'Conversation keeps the exploration camera yaw');
    assert.ok(Math.abs(restoredCamera.distance-Math.cos(.55)*12)<.05,'Wheel input during conversation does not change the exploration zoom');
    assert.equal(await first.page.locator('body').evaluate(el=>el.classList.contains('conversation-open')),false);
    assert.equal(a.character.data.welcome.stage,'available','Closing the offer does not accept or abandon it');
    await talk(first.page);
    await first.page.locator('.dialog-quest-card').waitFor();
    assert.equal(await first.page.getByRole('button',{name:'He venido a probar suerte.'}).count(),0,'Returning to Gnomi does not ask for the saved origin again');
    assert.equal(await first.page.locator('#dialog').getAttribute('aria-busy'),'false');
    world.rpcDelay.delete('welcome_action');
    world.fail.add('welcome');
    await first.page.getByRole('button',{name:'Aceptar misión'}).click();
    await first.page.waitForFunction(()=>document.querySelector('#dialog').getAttribute('aria-busy')==='false');
    assert.equal(a.character.data.welcome.stage,'available');
    assert.equal(await first.page.locator('#dialog').isVisible(),true,'Server failure leaves the conversation ready to retry');
    await first.page.locator('#toast').filter({hasText:'Temporary quest failure'}).waitFor();
    world.fail.delete('welcome');
    await first.page.getByRole('button',{name:'Aceptar misión'}).click();
    await first.page.locator('#dialog').waitFor({state:'hidden'});
    await first.page.locator('#quest-tracker').waitFor();
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'welcome-companion.png')});
    await first.page.keyboard.press('KeyJ');
    await first.page.locator('.quest-entry').waitFor();
    assert.equal(await first.page.locator('.quest-origin,.quest-journal-intro').count(),0);
    assert.deepEqual(await first.page.locator('.quest-reward b').allTextContents(),['+40','+5']);
    assert.equal(await first.page.locator('.quest-reward.pelines .currency-icon-pelines').count(),1);
    assert.equal(await first.page.locator('.quest-reward small').count(),0,'Rewards omit redundant explanatory captions');
    assert.equal(await first.page.locator('.quest-steps li.current').textContent(),'2Encontrar el distintivo');
    assert.equal(await first.page.locator('.quest-items').count(),0,'Uncollected quest items are not owned');
    assert.equal(await first.page.locator('.quest-entry header > small,.quest-rewards-heading > small').count(),0);
    assert.equal(await first.page.getByRole('button',{name:/Abandonar/}).count(),0);
    for(const width of [320,390,1280]){
      await first.page.setViewportSize({width,height:844});
      assert.ok(await first.page.locator('.quest-journal').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),'Journal fits the viewport');
      const close=await first.page.locator('#window-close').boundingBox();
      assert.ok(close.y>=0&&close.y+close.height<844-44,'Journal keeps the close button above the chat handle');
      await first.page.locator('.quest-rewards').scrollIntoViewIfNeeded();
      assert.ok(await first.page.locator('.quest-reward-list').evaluate(el=>el.scrollWidth<=el.clientWidth),'Reward cards fit narrow screens');
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`welcome-journal-${width}.png`)});
    }
    await first.page.keyboard.press('Escape');
    await first.page.keyboard.press('KeyI');
    await first.page.locator('.inv-grid').waitFor();
    assert.equal(await first.page.locator('.inv .quest-items').count(),0);
    const bagCapacity=await first.page.locator('.inv-capacity').textContent();
    await first.page.keyboard.press('Escape');
    const inventoryBeforeQuestItem=JSON.stringify(a.character.data.inventory);
    await first.page.setViewportSize({width:1280,height:800});
    for(const [x,z] of [[-6.4,-3],[3,-3],[10,-3],[15.8,-5.7]])await approach(first.page,x,z);
    await first.page.waitForFunction(()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      const p=window.brumaluz.char().root.parent.position;
      return g.position.distanceTo(p)<3;
    });
    assert.equal(b.character.data.welcome.stage,'available','The other player does not share progress or collection');
    assert.equal(await second.page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('gnomi-lost-badge').visible),false);
    await first.page.waitForFunction(()=>document.querySelector('#interact-prompt').textContent.includes('Recoger distintivo'));
    await first.page.keyboard.press('KeyE');
    await first.page.waitForFunction(()=>document.querySelector('#quest-tracker').textContent.includes('devuélvele'));
    assert.equal(a.character.data.welcome.stage,'found');
    await first.page.reload();await first.page.waitForFunction(()=>!!window.brumaluz);
    await first.enter();
    await first.page.keyboard.press('KeyJ');
    await first.page.locator('.quest-key-item').waitFor();
    assert.equal(await first.page.locator('.quest-origin').count(),0);
    assert.equal(a.character.data.welcome.origin,1,'Origin stays saved without being repeated in the journal');
    assert.match(await first.page.locator('.quest-key-item').textContent(),/Distintivo del Gremio de Ayudantes/);
    await first.page.keyboard.press('Escape');
    await first.page.keyboard.press('KeyI');
    await first.page.locator('.inv .quest-key-item').waitFor();
    assert.equal(await first.page.locator('.inv-capacity').textContent(),bagCapacity);
    assert.equal(JSON.stringify(a.character.data.inventory),inventoryBeforeQuestItem,'Quest items never occupy real bag slots');
    const questItem=first.page.locator('.inv .quest-key-item');
    assert.equal(await questItem.getAttribute('draggable'),null);
    assert.equal(await questItem.locator('button').count(),0);
    assert.equal(await questItem.getAttribute('data-item-id'),null,'Quest items are not transferable bag objects');
    await questItem.scrollIntoViewIfNeeded();
    await first.page.waitForTimeout(100);
    await questItem.focus();
    await first.page.locator('#game-tooltip').filter({hasText:'No se puede vender, intercambiar ni descartar.'}).waitFor();
    for(const width of [320,390,1280]){
      await first.page.setViewportSize({width,height:844});
      await questItem.scrollIntoViewIfNeeded();
      assert.ok(await questItem.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),'Quest item card fits the inventory');
      assert.ok(await questItem.evaluate(el=>{
        const box=el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
      }),'Quest item stays accessible above the action bar');
      const close=await first.page.locator('#window-close').boundingBox();
      assert.ok(close.y>=0&&close.y+close.height<800,'Inventory close button stays onscreen');
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`welcome-inventory-${width}.png`)});
    }
    await first.page.keyboard.press('Escape');
    await first.page.setViewportSize({width:1280,height:800});
    await talk(first.page);
    assert.equal(await first.page.locator('.dialog-quest-card').getAttribute('aria-label'),'Entrega de misión');
    await first.page.getByRole('button',{name:'Completar misión'}).click();
    await first.page.locator('#story-arrival').waitFor({state:'visible'});
    assert.equal(await first.page.locator('#dialog').isVisible(),false,'The offer does not start before Isberto arrives');
    const arrivalStart=await first.page.evaluate(()=>{
      const root=window.brumaluz.city().root.parent.getObjectByName('npc:isberto');
      return {position:root.position.toArray(),player:window.brumaluz.char().root.parent.position.toArray(),time:performance.now()};
    });
    await first.page.keyboard.down('KeyW');
    await first.page.keyboard.press('KeyI');
    await first.page.waitForTimeout(700);
    await first.page.keyboard.up('KeyW');
    const arrivalMiddle=await first.page.evaluate(()=>{
      const root=window.brumaluz.city().root.parent.getObjectByName('npc:isberto'),camera=window.brumaluz.camera();
      const screen=root.position.clone().add({x:0,y:1,z:0}).project(camera);
      return {position:root.position.toArray(),player:window.brumaluz.char().root.parent.position.toArray(),gait:root.userData.gait,screen:screen.toArray()};
    });
    assert.equal(arrivalMiddle.gait,'walk');
    assert.deepEqual(arrivalMiddle.player,arrivalStart.player,'Movement input stays blocked during the short cutscene');
    assert.ok(Math.hypot(arrivalMiddle.position[0]-arrivalStart.position[0],arrivalMiddle.position[2]-arrivalStart.position[2])>.5,'Isberto walks through the world rather than appearing at the player');
    assert.ok(Math.abs(arrivalMiddle.screen[0])<1&&Math.abs(arrivalMiddle.screen[1])<1&&Math.abs(arrivalMiddle.screen[2])<1,'The walking NPC is visible in the cinematic framing');
    assert.equal(await first.page.locator('#window-backdrop').isVisible(),false,'Inventory cannot interrupt the arrival');
    await first.page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    await first.page.locator('#story-arrival').waitFor({state:'hidden'});
    assert.ok(await first.page.evaluate(start=>performance.now()-start>=2000,arrivalStart.time),'The arrival is shown before starting the offer');
    await first.page.locator('.dialog-quest-card').filter({hasText:'Una sombra entre el ganado'}).waitFor();
    assert.equal(a.character.data.shadowQuest,undefined,'Opening the automatic offer never accepts it');
    const introPosition=await first.page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').position.toArray());
    assert.ok(Math.hypot(introPosition[0]-a.character.data.isbertoPosition.x,introPosition[2]-a.character.data.isbertoPosition.z)<2);
    assert.equal(await first.page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('gnomi-worn-badge').visible),true);
    assert.ok(await first.page.evaluate(()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      return g.position.distanceTo(window.brumaluz.char().root.parent.position)<4;
    }),'Gnomi stays beside the player through the thank-you conversation');
    assert.equal(await first.page.locator('.dialog-quest-card').count(),1,'Isberto automatically offers the next quest');
    assert.equal(await first.page.locator('.dialog-hint').isVisible(),false);
    assert.equal(a.character.data.experience,40);
    assert.equal(a.character.data.wallet.pelines,5);
    await first.page.keyboard.press('Escape');
    await first.page.keyboard.press('KeyJ');
    assert.equal(await first.page.locator('.quest-key-item').count(),0);
    assert.equal(await first.page.getByRole('button',{name:'Completadas',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await first.page.locator('.quest-completed').getAttribute('open'),null);
    await first.page.locator('.quest-completed summary').click();
    assert.match(await first.page.locator('.quest-entry footer').textContent(),/Recompensas recibidas/);
    assert.equal(await first.page.locator('.quest-steps li.done').count(),3);
    await first.page.keyboard.press('Escape');
    await first.page.keyboard.press('KeyI');
    await first.page.locator('.inv-grid').waitFor();
    assert.equal(await first.page.locator('.inv .quest-items').count(),0,'Delivered quest items disappear from inventory');
    await first.page.keyboard.press('Escape');
    await first.page.locator('#game-menu-toggle').click();
    await first.page.locator('#game-menu-options').click();
    await first.page.locator('#options-backdrop [data-language="en"]').click();
    await first.page.keyboard.press('Escape');
    await first.page.keyboard.press('KeyJ');
    assert.equal(await first.page.locator('#window-title').textContent(),'Quest journal');
    await first.page.locator('.quest-completed summary').click();
    assert.match(await first.page.locator('.quest-entry footer').textContent(),/Rewards received/);
    assert.deepEqual(await first.page.locator('.quest-reward strong').allTextContents(),['Experience','Pelines']);
    await first.page.keyboard.press('Escape');
    await leave(first.page);
    await first.page.reload();await first.page.waitForFunction(()=>!!window.brumaluz);await first.enter();
    assert.equal(await first.page.locator('#story-arrival').isVisible(),false,'Reconnecting never replays the already seen arrival');
    assert.equal(await first.page.locator('#dialog').isVisible(),false,'Reconnecting does not reopen or accept the offer');
    assert.equal(a.character.data.shadowQuest,undefined);
    await approach(second.page,-6.4,-8.5);
    await talk(second.page);
    await second.page.getByRole('button',{name:'Vengo de la Arboleda para aprender.'}).click();
    await second.page.getByRole('button',{name:'Aceptar misión'}).waitFor();
    await second.page.keyboard.press('Escape');
    await second.page.locator('#game-menu-toggle').click();
    await second.page.locator('#game-menu-options').click();
    await second.page.locator('#options-backdrop [data-language="en"]').click();
    await second.page.keyboard.press('Escape');
    await talk(second.page,true);
    assert.equal(await second.page.locator('.dialog-quest-card').getAttribute('aria-label'),'New quest');
    assert.match(await second.page.locator('.dialog-quest-card').textContent(),/Objective.*Accompany Gnomi.*Rewards/s);
    assert.match(await second.page.locator('.dialog-text').textContent(),/Helpers' Guild.*David/s);
    assert.equal(await second.page.locator('.dialog-subtitle').textContent(),'Welcome helper');
    assert.equal(await second.page.getByRole('button',{name:'Accept quest',exact:true}).isVisible(),true);
    assert.equal(await second.page.getByRole('button',{name:'Close',exact:true}).isVisible(),true);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('welcome systems offer three distinct origins per race in the isolated development preview', {timeout:90000},async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(`${url}/?test&welcome&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    const expected={
      humano:['Soy de Brumaluz y busco mi primer oficio.','He venido a probar suerte.','Quiero aprender de sus talleres.'],
      elfo:['Vengo de la Arboleda para aprender.','Quiero conocer la vida de la capital.','Vivo aquí y busco un nuevo rumbo.'],
      lagto:['He bajado de las Cumbres de Cobre para aprender un oficio.','Quiero conocer qué hay más allá de las montañas.','Vivo aquí y busco un nuevo rumbo.'],
      pelso:['He llegado desde Luna Argéntea para conocer la capital.','Busco oportunidades en tierra firme.','Vivo aquí y busco un nuevo rumbo.'],
    };
    await page.evaluate(()=>window.brumaluz.play());
    for(const [race,labels] of Object.entries(expected)){
      await page.evaluate(race=>{
        window.brumaluz.set({race,welcome:{origin:null,stage:'available'}});
        window.brumaluz.move(-6.4,-8.5);
      },race);
      await page.keyboard.press('KeyE');
      await page.locator('#dialog').waitFor();
      assert.deepEqual(await page.locator('.dialog-choice:not(.exit) > span:last-child').allTextContents(),labels);
      await page.keyboard.press('Escape');
    }
    await page.evaluate(()=>window.brumaluz.set({welcome:{origin:0,stage:'found'}}));
    await page.locator('#game-menu-toggle').click();
    await page.locator('#game-menu-options').click();
    await page.locator('#options-backdrop [data-language="en"]').click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyI');
    await page.locator('.inv .quest-key-item').waitFor();
    assert.match(await page.locator('.inv .quest-items').textContent(),/Quest items.*Helpers' Guild badge.*Return it to Gnomi/s);
    assert.equal(await page.locator('.inv .quest-items > small').count(),0);
    await page.locator('.inv .quest-key-item').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await page.locator('.inv .quest-key-item').focus();
    await page.locator('#game-tooltip').filter({hasText:'Cannot be sold, traded or discarded.'}).waitFor();
    assert.deepEqual(errors,[]);
  } finally {await context.close();}
});

test('independent accounts see real remote models, appearance, names, movement and departure in both graphics modes', { timeout: 240000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), b = fixture('Elara', 'elfo', -5.4);
  Object.assign(a.character.data,{hair:14,acc:7,accColor:4});
  Object.assign(b.character.data,{hair:15,acc:7,accColor:3});
  const first = await openPlayer(world, a, false);
  const second = await openPlayer(world, b);
  try {
    for(const player of [first,second]) {
      const portrait=await player.page.locator('.character-portrait').first().evaluate(canvas=>{
        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        const colors=new Set();
        for(let i=0;i<pixels.length;i+=16)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
        return {width:canvas.width,height:canvas.height,colors:colors.size};
      });
      assert.ok(portrait.width>0&&portrait.height>0&&portrait.colors>50,'Saved new appearance renders in the selection portrait');
    }
    await first.enter();
    await second.enter();
    await remote(first.page, b.character.id);
    await remote(second.page, a.character.id);
    assert.equal(await first.page.locator('#multiplayer-status').count(), 0);
    assert.equal(await first.page.locator('.minimap-player-count').textContent(), '2');
    assert.equal(await first.page.locator('.minimap-players').getAttribute('aria-label'), '2 jugadores en este mapa');
    assert.equal(await first.page.locator(`[data-player-id="${b.character.id}"] strong`).textContent(), 'Elara');
    assert.equal(await first.page.locator(`[data-player-id="${b.character.id}"]`).isVisible(), true);
    assert.equal(await second.page.locator(`[data-player-id="${a.character.id}"]`).isVisible(), true);
    assert.match(await second.page.locator(`[data-player-id="${a.character.id}"]`).textContent(), /Recién llegado/);
    const geometry = await first.page.evaluate(() => {
      const root = window.brumaluz.players()[0].root;
      let meshes = 0;
      root.traverse((object) => { if (object.isMesh && object.visible) meshes++; });
      return { meshes, attached: !!root.parent, visible: root.visible,
        hair:!!root.getObjectByName('character-hair'),mask:!!root.getObjectByName('traveler-mask'),
        maskColor:root.getObjectByName('traveler-mask')?.material.color.getHexString() };
    });

    assert.ok(geometry.meshes > 2 && geometry.attached && geometry.visible, JSON.stringify(geometry));
    assert.ok(geometry.hair&&geometry.mask,'New hair and accessory render on remote actors');
    assert.equal(geometry.maskColor,'d0404a');
    assert.deepEqual(await second.page.evaluate(()=>{
      const root=window.brumaluz.players()[0].root;
      return {hair:!!root.getObjectByName('character-hair'),maskColor:root.getObjectByName('traveler-mask')?.material.color.getHexString()};
    }),{hair:true,maskColor:'4a7ad8'});
    assert.equal(await first.page.locator('#graphics-error').isVisible(), false);
    assert.equal(await second.page.locator('#graphics-error').isVisible(), false);
    await second.page.evaluate(() => window.brumaluz.move(-3.4, -11.085));
    await first.page.waitForFunction(() => Math.abs(window.brumaluz.players()[0].root.position.x + 3.4) < 0.1);
    await second.page.evaluate(() => window.brumaluz.move(200, 200));
    await second.page.waitForFunction(() => window.brumaluz.char().root.parent.position.x < 0);
    assert.ok(world.players.get(b.user.id).position.x < 0, 'Server corrections must reach the local actor');
    await leave(second.page);
    await first.page.waitForFunction(() => window.brumaluz.players().length === 0);
    assert.equal(await first.page.locator('.minimap-player-count').textContent(), '1');
    assert.equal(await first.page.locator('.nameplate.player').count(), 0);
    assert.equal(world.players.has(b.user.id), false);
    assert.deepEqual([...first.errors, ...second.errors], []);
    assert.equal(world.maximum.get(a.user.id), 1);
    assert.equal(world.maximum.get(b.user.id), 1);
  } finally { await first.context.close(); await second.context.close(); }
});

test('a new session replaces the old one without the stale client removing the new player', { timeout: 180000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  const first = await openPlayer(world, a);
  const second = await openPlayer(world, a);
  try {
    await first.enter();
    const oldSession = world.players.get(a.user.id).session;
    await second.enter();
    await first.page.waitForFunction(() => !document.body.classList.contains('playing'));
    assert.match(await first.page.locator('#toast').textContent(), /otra pestaña o equipo/);
    assert.notEqual(world.players.get(a.user.id)?.session, oldSession);
    assert.equal(await second.page.locator('body').evaluate((body) => body.classList.contains('playing')), true);
    assert.deepEqual([...first.errors, ...second.errors], []);
  } finally { await first.context.close(); await second.context.close(); }
});

test('network errors retry sequentially; delayed snapshots cannot recreate actors after leaving', { timeout: 180000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), b = fixture('Elara', 'elfo', -5.4);
  const first = await openPlayer(world, a);
  const second = await openPlayer(world, b);
  try {
    await first.enter(); await second.enter();
    await remote(first.page, b.character.id);
    world.fail.add(a.user.id);
    await first.page.waitForFunction(() => document.querySelector('.minimap-players').classList.contains('error'));
    await first.page.waitForFunction(() => window.brumaluz.players().length === 0, null, { timeout: 25000 });
    assert.equal(await first.page.locator('.minimap-player-count').textContent(), '—');
    assert.match(await first.page.locator('.minimap-players').getAttribute('aria-label'), /Reintentando/);
    world.fail.delete(a.user.id);
    await first.page.waitForFunction(() => !document.querySelector('.minimap-players').classList.contains('error'));
    await remote(first.page, b.character.id);
    world.delay.set(a.user.id, 800);
    await first.page.waitForTimeout(300);
    await leave(first.page);
    await first.page.waitForTimeout(1000);
    assert.equal(await first.page.locator('.nameplate.player').count(), 0);
    assert.equal(await first.page.evaluate(() => window.brumaluz.players().length), 0);
    assert.equal(world.players.has(a.user.id), false);
    assert.equal(world.maximum.get(a.user.id), 1);
    assert.deepEqual([...first.errors, ...second.errors], []);
  } finally { await first.context.close(); await second.context.close(); }
});

test('signing out during a delayed join cannot reopen the world or leave remote models behind', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  const player = await openPlayer(world, a);
  try {
    world.delay.set(a.user.id, 3000);
    const joining = player.page.waitForRequest((request) => request.url().endsWith('/rpc/world_join'));
    await player.page.locator('.character-card .btn.gold').first().click();
    await joining;
    await player.page.locator('#sign-out').click();
    await player.page.locator('#auth-form').waitFor({ state: 'visible' });
    await player.page.waitForTimeout(3500);
    assert.equal(await player.page.locator('body').evaluate((body) => body.classList.contains('playing')), false);
    assert.equal(await player.page.evaluate(() => window.brumaluz.players().length), 0);
    assert.equal(world.players.has(a.user.id), false);
    await player.page.locator('#transition-loading').waitFor({ state: 'hidden' });
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('world transitions show delayed loading, clear on success and errors, and leave controls usable', { timeout: 120000 }, async () => {
  const world = backend(), account = fixture('Alric', 'humano', 100);
  world.rpcDelay.set('character_enter', 1900);
  const player = await openPlayer(world, account), page = player.page;
  try {
    await page.locator('.character-card .btn.gold').first().click();
    const loading = page.locator('#transition-loading');
    await loading.waitFor({ state: 'visible' });
    assert.equal(await loading.textContent(), 'Entrando en Brumaluz…');
    assert.equal(await page.locator('#scene').getAttribute('aria-busy'), 'true');
    assert.equal(await loading.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    await page.waitForFunction(() => document.querySelector('#transition-loading')?.classList.contains('slow'));
    await page.waitForFunction(() => document.body.classList.contains('playing'));
    await loading.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#scene').getAttribute('aria-busy'), null);
    world.rpcDelay.set('world_leave', 700);
    await page.locator('#game-menu-toggle').click();
    await page.locator('#game-menu-characters').click();
    await loading.waitFor({ state: 'visible' });
    assert.equal(await loading.textContent(), 'Volviendo a tus personajes…');
    await page.locator('.character-card .btn.gold').first().waitFor({ state: 'visible' });
    await loading.waitFor({ state: 'hidden' });
    await page.route('**/rest/v1/rpc/character_enter', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Transition temporarily unavailable' }) });
    });
    await page.locator('.character-card .btn.gold').first().click();
    await loading.waitFor({ state: 'visible' });
    await loading.waitFor({ state: 'hidden' });
    assert.match(await page.locator('#toast').textContent(), /Transition temporarily unavailable/);
    assert.equal(await page.locator('.character-card .btn.gold').first().isEnabled(), true);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('only one character entry can run at a time', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), other = fixture('Borin', 'elfo', -5.4);
  a.characters = [a.character, { ...other.character, user_id: a.user.id }];
  world.rpcDelay.set('character_enter', 1000);
  const player = await openPlayer(world, a);
  try {
    await player.page.locator('.character-card .btn.gold').nth(0).dispatchEvent('click');
    await player.page.locator('.character-card .btn.gold').nth(1).dispatchEvent('click');
    await player.page.waitForFunction(() => document.body.classList.contains('playing'));
    assert.equal(world.players.get(a.user.id).id, a.character.id);
    assert.equal(await player.page.evaluate(() => window.brumaluz.char().d.name), 'Alric');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('a late title response cannot overwrite another character or reopen the sheet', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), other = fixture('Borin', 'elfo', -5.4);
  a.characters = [a.character, { ...other.character, user_id: a.user.id }];
  const player = await openPlayer(world, a);
  try {
    await player.enter();
    await player.page.locator('#player-menu-toggle').click();
    await player.page.locator('[data-window="sheet"]').click();
    world.rpcDelay.set('set_character_title', 5000);
    await player.page.locator('.title-button').click();
    const sent = player.page.waitForRequest((request) => request.url().endsWith('/rpc/set_character_title'));
    await player.page.locator('.title-option').filter({ hasText: 'Sin título' }).click();
    await sent;
    await player.page.locator('#window-close').click();
    await leave(player.page);
    await player.page.locator('.character-card .btn.gold').nth(1).click();
    await player.page.waitForFunction(() => document.body.classList.contains('playing'));
    await player.page.waitForTimeout(5200);
    assert.equal(await player.page.evaluate(() => window.brumaluz.char().d.name), 'Borin');
    await player.page.locator('#player-menu-toggle').click();
    await player.page.locator('[data-window="sheet"]').click();
    assert.equal(await player.page.locator('.sheet-name-row strong').textContent(), 'Borin');
    assert.match(await player.page.locator('.title-button').textContent(), /Recién llegado/);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('failed remote logout still closes the local world and shows a visible error', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  const player = await openPlayer(world, a);
  try {
    await player.enter();
    world.logoutFails = true;
    await player.page.locator('#game-menu-toggle').click();
    await player.page.locator('#game-menu-logout').click();
    await player.page.locator('#auth-form').waitFor({ state: 'visible' });
    await player.page.locator('#toast.error.show').waitFor();
    assert.equal(await player.page.locator('body').evaluate((body) => body.classList.contains('playing')), false);
    assert.equal(world.players.has(a.user.id), false);
    assert.match(await player.page.locator('#toast').textContent(), /Logout temporarily unavailable/);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('prototype names in old character data cannot crash appearance sanitization', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  a.character.data.race = 'toString';
  a.character.data.cls = 'constructor';
  const player = await openPlayer(world, a);
  try {
    await player.enter();
    assert.equal(await player.page.evaluate(() => window.brumaluz.char().d.race), 'humano');
    assert.equal(await player.page.evaluate(() => window.brumaluz.char().d.cls), 'guerrero');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('a delayed character creation cannot pull the user back into the world after returning to selection', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  const player = await openPlayer(world, a);
  try {
    await player.page.locator('#new-character').click();
    await player.page.evaluate(() => window.brumaluz.set({ name: 'Borin', attributePoints: { fuerza: 2 }, creationPoints: 2 }));
    world.rpcDelay.set('create_character', 2000);
    const sent = player.page.waitForRequest((request) => request.url().endsWith('/rpc/create_character'));
    await player.page.locator('#enter').click();
    await sent;
    await player.page.locator('#transition-loading').waitFor({ state: 'visible' });
    assert.equal(await player.page.locator('#transition-loading p').textContent(), 'Preparando tu aventura…');
    await player.page.locator('#account-characters').click();
    await player.page.locator('.character-card .btn.gold').first().waitFor({ state: 'visible' });
    await player.page.waitForTimeout(2500);
    assert.equal(await player.page.locator('body').evaluate((body) => body.classList.contains('playing')), false);
    assert.equal(world.players.has(a.user.id), false);
    await player.page.locator('#transition-loading').waitFor({ state: 'hidden' });
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('graphics controls stay clear of account information and map population fits desktop and small screens', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4);
  const player = await openPlayer(world, a);
  try {
    for (const [width, height] of [[1280, 800], [390, 844]]) {
      await player.page.setViewportSize({ width, height });
      const layout = await player.page.evaluate(() => {
        const button = document.getElementById('graphics-mode').getBoundingClientRect();
        const account = document.getElementById('account-details').getBoundingClientRect();
        return {
          separated: button.right <= account.left || button.left >= account.right || button.bottom <= account.top || button.top >= account.bottom,
          inCorner: button.right <= innerWidth && button.bottom <= innerHeight && button.left > innerWidth / 2 && button.top > innerHeight / 2,
        };
      });
      assert.deepEqual(layout, { separated: true, inCorner: true });
    }
    await player.enter();
    for (const [width, height] of [[1280, 800], [390, 844], [320, 844]]) {
      await player.page.setViewportSize({ width, height });
      await player.page.locator('.minimap-player-count').waitFor({ state: 'visible' });
      assert.equal(await player.page.locator('.minimap-player-count').textContent(), '1');
      const fits = await player.page.locator('.minimap-plate').evaluate((plate) => {
        const badge = plate.querySelector('.minimap-players').getBoundingClientRect();
        const bounds = plate.getBoundingClientRect();
        const coords = plate.querySelector('.minimap-coords').getBoundingClientRect();
        const zone = plate.querySelector('.minimap-zone').getBoundingClientRect();
        return plate.scrollWidth <= plate.clientWidth && badge.left >= bounds.left && badge.right <= bounds.right && bounds.right <= innerWidth
          && coords.top >= Math.max(zone.bottom,badge.bottom) && bounds.left>=0
          && plate.querySelector('.minimap-location-icon') !== null && bounds.width <= 140 && bounds.height <= 42;
      });
      assert.equal(fits, true);
    }
    await player.page.locator('#game-menu-toggle').click();
    await player.page.locator('#game-menu-options').click();
    await player.page.locator('#options-backdrop [data-language="en"]').click();
    assert.equal(await player.page.locator('.minimap-players').getAttribute('aria-label'), '1 player in this map');
    assert.equal(await player.page.locator('#multiplayer-status').count(), 0);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

async function social(page) {
  await page.locator('#player-menu-toggle').click();
  await page.locator('[data-window="social"]').click();
  await page.locator('.social-add button').waitFor();
  await page.waitForFunction(() => !document.querySelector('.social-add button').disabled);
}
async function socialRequest(page, username) {
  await page.locator('.social-add input').fill(username);
  await page.locator('.social-add button').click();
}

test('Social supports requests, acceptance, online presence, whisper, cancellation and removal across accounts', { timeout: 180000 }, async () => {
  const world = backend(), a = fixture('Alric', 'humano', -6.4), b = fixture('Elara', 'elfo', -5.4);
  b.character.data.cls = 'mago';
  const first = await openPlayer(world, a), second = await openPlayer(world, b);
  try {
    await first.enter(); await second.enter();
    await social(first.page); await social(second.page);
    await socialRequest(first.page, 'Nobody');
    await first.page.locator('.social-window .account-message.error').waitFor();
    assert.match(await first.page.locator('.social-friends-panel .account-message').textContent(), /No existe/);
    await socialRequest(first.page, '~Elara');
    await first.page.locator('[data-social="outgoing"] .social-row').waitFor();
    await second.page.locator('[data-social="incoming"] .social-row').waitFor({timeout:15000});
    await second.page.getByRole('button', {name:'Rechazar',exact:true}).click();
    await first.page.locator('[data-social="outgoing"] .social-row').waitFor({state:'detached',timeout:15000});
    await socialRequest(first.page, 'Elara');
    await first.page.getByRole('button', {name:'Cancelar solicitud',exact:true}).click();
    await first.page.locator('[data-social="outgoing"] .social-row').waitFor({state:'detached'});
    await socialRequest(first.page, 'Elara');
    await second.page.getByRole('button', {name:'Aceptar',exact:true}).click({timeout:15000});
    await first.page.locator('[data-social="friend"] .social-row').waitFor({timeout:15000});
    assert.equal(await first.page.locator('.social-online').textContent(),'Conectado');
    assert.equal(await first.page.locator('.social-details dt').allTextContents().then(labels=>labels.join(',')),'Personaje,Ubicación');
    assert.deepEqual(await first.page.locator('.social-details dd').allTextContents(),['Elara Nivel 1','Brumaluz']);
    assert.equal(await first.page.locator('.social-friend-level').textContent(),'Nivel 1');
    assert.deepEqual(await first.page.locator('.social-stat strong').allTextContents(),['1','0']);
    assert.equal(await first.page.locator('.social-connected-total').textContent(),'(1 conectados)');
    assert.equal(await first.page.locator('.social-introduction').count(),0);
    assert.equal(await first.page.locator('.social-account-prefix').textContent(),'~');
    assert.equal(await first.page.locator('[data-social="friend"] .social-count').textContent(),'1');
    assert.equal(await first.page.locator('.social-avatar .class-icon').count(),1);
    assert.equal(await first.page.locator('.social-avatar').getAttribute('aria-label'),'Mago');
    assert.equal(await first.page.locator('#social-username').getAttribute('aria-describedby'),'social-invitation-help');
    const stats=await first.page.locator('.social-stat').evaluateAll(cards=>cards.map(card=>{
      const bounds=card.getBoundingClientRect();
      const value=card.querySelector('.social-stat-value').getBoundingClientRect();
      const label=card.querySelector('span').getBoundingClientRect();
      return {centered:Math.abs((bounds.left+bounds.right-value.left-value.right)/2)<1 && Math.abs((bounds.left+bounds.right-label.left-label.right)/2)<1,valueY:value.top};
    }));
    assert.ok(stats.every(stat=>stat.centered),'Statistic values and labels must be centered');
    assert.ok(Math.abs(stats[0].valueY-stats[1].valueY)<1,'Both totals share the same baseline');
    assert.equal(await first.page.locator('.social-details dt svg').count(),2);
    const detailGap=await first.page.locator('.social-details').evaluate(dl=>{
      const first=dl.querySelector('dd').getBoundingClientRect();
      const second=dl.querySelectorAll('dt')[1].getBoundingClientRect();
      return second.left-first.right;
    });
    assert.ok(detailGap>=0 && detailGap<=22,'Character and location must remain grouped');
    world.players.get(b.user.id).data.level = 12;
    await first.page.waitForFunction(()=>document.querySelector('.social-friend-level')?.textContent==='Nivel 12');
    for (const width of [320,390,1280]) {
      await first.page.setViewportSize({width,height:844});
      const badges=await first.page.locator('.social-count').evaluateAll(elements=>elements.map(el=>{
        const box=el.getBoundingClientRect(),head=el.parentElement.getBoundingClientRect();
        const css=getComputedStyle(el);
        return {right:head.right-box.right,center:Math.abs((box.top+box.bottom-head.top-head.bottom)/2),spacing:css.letterSpacing};
      }));
      assert.ok(badges.every(b=>Math.abs(b.right-13)<1&&b.center<1&&['0px','normal'].includes(b.spacing)),`Section counts align at the right edge and are vertically centered without inherited letter spacing: ${width} ${JSON.stringify(badges)}`);
      const fits = await first.page.locator('.social-window').evaluate(el => {
        const bounds = el.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth && el.scrollWidth <= el.clientWidth
          && [...el.querySelectorAll('button,input')].every(control => {
            if (!control.getClientRects().length) return true;
            const box = control.getBoundingClientRect();
            return box.left >= bounds.left && box.right <= bounds.right;
          });
      });
      assert.equal(fits,true,`Populated Social and controls fit ${width}px`);
    }
    await first.page.getByRole('button', {name:'Susurrar',exact:true}).click();
    assert.equal(await first.page.locator('.chat-input').inputValue(), '/w ~Elara ');
    assert.equal(await first.page.locator('#window-backdrop').isVisible(), false);
    await second.page.locator('#window-close').click();
    await leave(second.page);
    await first.page.locator('.chat-input').blur();
    await social(first.page);
    assert.equal(await first.page.locator('.social-offline').textContent(), 'Desconectado');
    assert.equal(await first.page.getByRole('button',{name:'Susurrar',exact:true}).isDisabled(),true);
    assert.equal(await first.page.locator('.social-avatar .class-icon').count(),0);
    assert.equal(await first.page.locator('.social-friend-level').count(),0);
    first.page.once('dialog', dialog => dialog.accept());
    await first.page.getByRole('button', {name:'Eliminar amigo',exact:true}).click();
    await first.page.locator('[data-social="friend"] .social-row').waitFor({state:'detached'});
    assert.equal(world.friends.size,0);
    await first.page.setViewportSize({width:390,height:844});
    const fits = await first.page.locator('.social-window').evaluate(el => el.getBoundingClientRect().right <= innerWidth && el.scrollWidth <= el.clientWidth);
    assert.equal(fits,true);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close(); await second.context.close();}
});

test('queen title uses the same reserved phoenix styling in the picker and remote nameplate', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',-6.4), b = fixture('Elara','elfo',-5.4);
  b.titles = ['reina_de_pompelin'];
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await second.page.locator('#player-menu-toggle').click();
    await second.page.locator('[data-window="sheet"]').click();
    await second.page.locator('.title-button').click();
    const queen = second.page.locator('.title-option').filter({hasText:'Reina de Pompelín'});
    assert.equal(await queen.locator('.phoenix').count(),1);
    assert.equal(await second.page.locator('.title-option').filter({hasText:'Rey de Pompelín'}).count(),0);
    await queen.click();
    await second.page.locator('.title-button.staff-title .phoenix').waitFor();
    await first.page.locator(`[data-player-id="${b.character.id}"] .staff-title`).filter({hasText:'Reina de Pompelín'}).waitFor();
    assert.equal(await first.page.locator(`[data-player-id="${b.character.id}"] .phoenix`).count(),1);
    await hoverActor(first.page,first.page.locator(`[data-player-id="${b.character.id}"]`));
    await first.page.locator('#target-frame .target-kind.staff-title').waitFor();
    assert.equal(await first.page.locator('#target-frame .target-kind').textContent(),'Reina de Pompelín');
    assert.equal(await first.page.locator('#target-frame .target-kind .phoenix').count(),1);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close(); await second.context.close();}
});

async function hoverActor(page, plate) {
  const bounds = await plate.boundingBox();
  assert.ok(bounds, `Target nameplate is visible: ${JSON.stringify(await plate.evaluate(el=>({hidden:el.hidden,style:getComputedStyle(el).display,transform:el.style.transform,text:el.textContent})))}`);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height + 55);
}

test('target frame shows hovered players and NPC types, live vitals, camera aim and menu cleanup', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',-6.4), b = fixture('Elara','elfo',-5.4);
  b.username = 'moon_account';
  b.character.data.cls = 'mago';
  b.character.data.level = 12;
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await remote(first.page,b.character.id);
    await first.page.waitForTimeout(1500);
    await hoverActor(first.page, first.page.locator(`[data-player-id="${b.character.id}"]`));
    const frame = first.page.locator('#target-frame');
    await frame.waitFor({state:'visible'});
    assert.equal(await frame.getAttribute('data-target-id'),b.character.id);
    assert.equal(await frame.locator('.target-name').textContent(),'Elara');
    assert.equal(await frame.locator('.target-username').textContent(),'~moon_account');
    assert.equal(await frame.locator('.target-kind').textContent(),'Recién llegado');
    assert.equal(await frame.locator('.target-emblem').getAttribute('aria-label'),'Mago');
    assert.equal(await frame.locator('.target-level').textContent(),'Nivel 12');
    assert.equal(await frame.locator('.class-icon').count(),1);
    assert.equal(await frame.getByRole('meter',{name:'Vida',exact:true}).getAttribute('aria-valuenow'),'80');
    assert.equal(await frame.getByRole('meter',{name:'Maná',exact:true}).getAttribute('aria-valuemax'),'70');
    world.players.get(b.user.id).vitals = { health: 17, maxHealth: 196, overheal: 0, resource: 9, maxResource: 129, resourceKind:'mana' };
    await first.page.waitForFunction(()=>document.querySelector('.target-health').getAttribute('aria-valuenow')==='17');
    assert.equal(await frame.locator('.target-resource span').textContent(),'9 / 129');
    assert.equal(await frame.locator('.target-health span').textContent(),'17 / 196');
    const hudStyle = await frame.evaluate(el => {
      const style = selector => getComputedStyle(document.querySelector(selector));
      const bounds = el.getBoundingClientRect();
      return {
        font: style('.target-heading').fontFamily === style('.hud-name-row').fontFamily
          && style('.target-meter span').fontFamily === style('.hud-bar span').fontFamily,
        level: style('.target-level').color === style('.hud-name-row span').color
          && style('.target-level').backgroundColor === 'rgba(0, 0, 0, 0)'
          && style('.target-level').borderTopWidth === '0px',
        compact: bounds.width <= 310 && bounds.height < 90 && document.querySelector('.target-emblem').getBoundingClientRect().width <= 38,
      };
    });
    assert.deepEqual(hudStyle,{font:true,level:true,compact:true});
    world.players.get(b.user.id).data.title = 'none';
    await first.page.waitForFunction(()=>document.querySelector('.target-kind').hidden);
    assert.equal(await frame.locator('.target-username').textContent(),'~moon_account','No title does not hide the player account');
    await first.page.mouse.move(1278,798);
    await frame.waitFor({state:'hidden'});
    await first.page.evaluate(()=>{
      const target=window.brumaluz.players()[0].root.position;
      window.brumaluz.move(target.x,target.z+.6);
      window.brumaluz.view(0,.55,12);
    });
    await first.page.waitForTimeout(2500);
    await frame.waitFor({state:'visible'});
    assert.equal(await frame.getAttribute('data-target-id'),b.character.id,'Camera center selects without pointer hovering the actor');
    await first.page.evaluate(()=>window.brumaluz.move(180,180));
    await frame.waitFor({state:'hidden'});
    await first.page.locator('#player-menu-toggle').click();
    await frame.waitFor({state:'hidden'});
    await first.page.locator('#player-menu-toggle').click();
    const npcPosition = await first.page.evaluate(()=>{
      const p=window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x,p.z+3);
      return {x:p.x,z:p.z};
    });
    await first.page.waitForTimeout(2000);
    await hoverActor(first.page,first.page.locator('.nameplate.npc:not(.welcome-nameplate)').first());
    await first.page.waitForFunction(()=>!document.querySelector('#target-frame').hidden && document.querySelector('#target-frame').dataset.targetId==='npc:testiculos');
    assert.equal(await frame.locator('.target-kind').textContent(),'Depuración');
    assert.equal(await frame.locator('.target-name').textContent(),'Testículos, the Debugger');
    assert.equal(await frame.locator('.class-icon').count(),0,'NPC has a type icon, not a character class');
    assert.equal(await frame.locator('.target-emblem svg').count(),1);
    assert.equal(await frame.locator('.target-username').textContent(),'');
    assert.equal(await frame.locator('.target-username').isVisible(),false);
    for (const width of [320,390,1280]) {
      await first.page.setViewportSize({width,height:844});
      await first.page.evaluate(({x,z})=>{
        window.brumaluz.move(x,z+.6);
        window.brumaluz.view(0,.55,12);
      },npcPosition);
      await first.page.mouse.move(width-2,842);
      await first.page.waitForTimeout(1800);
      await frame.waitFor({state:'visible'});
      const fits=await frame.evaluate(el=>{
        const box=el.getBoundingClientRect();
        const hud=document.querySelector('#player-hud').getBoundingClientRect();
        return box.left>=0 && box.right<=innerWidth && el.scrollWidth<=el.clientWidth
          && (box.left>=hud.right || box.top>=hud.bottom);
      });
      assert.equal(fits,true,`Target frame fits ${width}px without overlapping player HUD`);
    }
    await leave(first.page);
    await frame.waitFor({state:'hidden'});
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally { await first.context.close(); await second.context.close(); }
});

test('target aim tolerates camera pitch, zoom and character heights but not walls or turning away', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',-6.4), b = fixture('Elara','elfo',-5.4);
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await remote(first.page,b.character.id);
    const frame = first.page.locator('#target-frame');
    for (const height of [0,1]) {
      world.players.get(b.user.id).data.height = height;
      await first.page.waitForFunction(height=>window.brumaluz.players()[0].height===height,height);
      for (const [pitch, zoom] of [[.15,6],[.55,12],[1.05,20]]) {
        await first.page.evaluate(({pitch,zoom})=>{
          const p=window.brumaluz.players()[0].root.position;
          window.brumaluz.move(p.x,p.z+3);
          window.brumaluz.view(0,pitch,zoom);
        },{pitch,zoom});
        await first.page.mouse.move(1278,798);
        await first.page.waitForTimeout(1000);
        assert.equal(await frame.isVisible(),true,`Camera aim works at height=${height}, pitch=${pitch}, zoom=${zoom}`);
        assert.equal(await frame.getAttribute('data-target-id'),b.character.id);
      }
    }
    await first.page.evaluate(()=>{
      const p=window.brumaluz.players()[0].root.position;
      window.brumaluz.move(p.x-3,p.z);
      window.brumaluz.view(0,.55,12);
    });
    await first.page.waitForTimeout(1200);
    await frame.waitFor({state:'hidden'});
    const plate=first.page.locator(`[data-player-id="${b.character.id}"]`);
    const box=await plate.boundingBox();
    assert.ok(box);
    await first.page.mouse.move(box.x+box.width/2,box.y+box.height+15);
    await frame.waitFor({state:'visible'});
    assert.equal(await frame.getAttribute('data-target-id'),b.character.id,'Hover can select around the head instead of hitting its exact triangles');
    await first.page.mouse.move(box.x+box.width/2+5,box.y+box.height+40);
    await first.page.waitForTimeout(350);
    assert.equal(await frame.isVisible(),true,'Small cursor movements keep the same target');
    await first.page.mouse.move(1278,798);
    await frame.waitFor({state:'hidden'});
    await first.page.evaluate(()=>{
      const target=window.brumaluz.players()[0].root;
      const city=window.brumaluz.city().root;
      let source;
      city.traverse(object=>{
        if(!source && object.isMesh && !object.isInstancedMesh && !object.isSkinnedMesh && !Array.isArray(object.material)) source=object;
      });
      const wall=source.clone(false);
      wall.geometry=source.geometry.clone();
      for(const key of Object.keys(wall.geometry.attributes)) wall.geometry.deleteAttribute(key);
      wall.geometry.setIndex(null);
      wall.geometry.clearGroups();
      wall.geometry.boundingBox=null;
      wall.geometry.boundingSphere=null;
      wall.geometry.setFromPoints([
        {x:-100,y:-20,z:0},{x:100,y:-20,z:0},{x:100,y:80,z:0},
        {x:-100,y:-20,z:0},{x:100,y:80,z:0},{x:-100,y:80,z:0},
      ]);
      wall.geometry.computeVertexNormals();
      wall.material=source.material.clone();
      wall.material.side=2;
      wall.material.vertexColors=false;
      wall.position.copy(target.position);
      wall.position.z+=1.5;
      wall.rotation.set(0,0,0);wall.scale.set(1,1,1);
      wall.name='target-occlusion-test';
      city.add(wall);
      window.brumaluz.move(target.position.x,target.position.z+3);
      window.brumaluz.view(0,.55,12);
    });
    await first.page.waitForTimeout(1200);
    assert.equal(await frame.isVisible(),false,'Relaxed camera aim cannot see through a wall');
    await first.page.evaluate(()=>{
      const wall=window.brumaluz.city().root.getObjectByName('target-occlusion-test');
      wall.removeFromParent();wall.geometry.dispose();wall.material.dispose();
    });
    await first.page.waitForTimeout(1200);
    assert.equal(await frame.isVisible(),true,'Target is reacquired after removing the wall');
    await first.page.evaluate(()=>window.brumaluz.view(Math.PI,.55,12));
    await first.page.waitForTimeout(1200);
    await frame.waitFor({state:'hidden'});
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('target details enforce the 10 metre player-distance limit for camera and cursor', { timeout: 120000 }, async () => {
  const world=backend(), a=fixture('Alric','humano',-6.4), b=fixture('Elara','elfo',-5.4);
  const first=await openPlayer(world,a), second=await openPlayer(world,b);
  try {
    await first.enter();await second.enter();await remote(first.page,b.character.id);
    const frame=first.page.locator('#target-frame');
    for (const method of ['camera','cursor']) {
      for (const distance of [9.99,10.01,25,9.99]) {
        await first.page.evaluate(({distance,method})=>{
          const p=window.brumaluz.players()[0].root.position;
          window.brumaluz.move(p.x+(method==='cursor'?distance:0),p.z+(method==='camera'?distance:0));
          window.brumaluz.view(0,.55,30);
        },{distance,method});
        await first.page.mouse.move(1278,798);
        await first.page.waitForTimeout(1500);
        if(method==='cursor') {
          const plate=first.page.locator(`[data-player-id="${b.character.id}"]`);
          await hoverActor(first.page,plate);
          await first.page.waitForTimeout(250);
        }
        const actual=await first.page.evaluate(()=>{
          const p=window.brumaluz.players()[0].root.position, me=window.brumaluz.char().root.parent.position;
          return p.distanceTo(me);
        });
        const showingPlayer=await frame.isVisible()&&await frame.locator('.target-name').textContent()==='Elara';
        assert.equal(showingPlayer,distance<10,`${method}: actual distance ${actual.toFixed(3)}m must respect the 10m boundary`);
      }
    }
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

async function groupTab(page) {
  if(!await page.locator('#window-backdrop').isVisible()){
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="social"]').click();
  }
  await page.locator('#social-tab-1').click();
}
async function groupInvite(page,username){
  await page.locator('.party-invite-input').fill(username);
  await page.locator('.party-invite-form button').click();
}
test('party rejection notifies the inviter once and removes the solo group without losing other invitations', {timeout:120000}, async()=>{
  const world=backend(),accounts=[fixture('Alric','humano',-6.4),fixture('Elara','elfo',-5.4),fixture('Borin','humano',-3.4)];
  const players=[];
  try {
    for(const account of accounts){const player=await openPlayer(world,account);players.push(player);await player.enter();}
    const [first,second,third]=players;
    await groupTab(first.page);
    await groupInvite(first.page,'Elara');
    await groupInvite(first.page,'Borin');
    await groupTab(second.page);
    await second.page.locator('.party-invitation').getByRole('button',{name:'Rechazar',exact:true}).click();
    const message=first.page.locator('.chat-log').getByText('~Elara ha rechazado tu invitación de grupo.',{exact:true});
    await message.waitFor({state:'attached'});
    assert.equal(await first.page.locator('.party-pending').count(),1,'The other invitation remains available');
    await groupTab(third.page);
    await third.page.locator('.party-invitation').getByRole('button',{name:'Rechazar',exact:true}).click();
    await first.page.locator('.chat-log').getByText('~Borin ha rechazado tu invitación de grupo.',{exact:true}).waitFor({state:'attached'});
    await first.page.waitForFunction(()=>document.querySelector('#hud-party-leader').hidden);
    assert.equal(await first.page.locator('.party-panel-content .party-member').count(),0);
    assert.equal(await first.page.locator('.party-vacant').count(),1);
    await first.page.waitForTimeout(2400);
    assert.equal(await message.count(),1,'Polling does not repeat a response notification');
    assert.deepEqual(players.flatMap(player=>player.errors),[]);
  } finally {for(const player of players)await player.context.close();}
});
test('parties invite through interactions, default Social to Group, show leader HUD and map, chat privately and transfer leadership', {timeout:240000}, async()=>{
  const world=backend(),accounts=[fixture('Alric','humano',-6.4),fixture('Elara','elfo',-5.4),fixture('Borin','humano',-3.4),fixture('Daria','humano',-.4)];
  accounts[0].character.data.level=8;accounts[0].character.data.attributePoints.corpulencia=2;
  accounts[1].username='moon_account';accounts[1].character.data.cls='mago';
  const players=[];
  try {
    for(const account of accounts){const player=await openPlayer(world,account);players.push(player);await player.enter();}
    const [first,second,third,fourth]=players;
    await remote(first.page,accounts[1].character.id);
    await first.page.keyboard.press('KeyE');
    await first.page.getByRole('button',{name:'Invitar a grupo',exact:true}).click();
    await second.page.waitForFunction(()=>document.querySelector('#player-menu-toggle').classList.contains('has-party-invite'));
    await first.page.keyboard.press('Escape');
    await groupTab(second.page);
    assert.equal(await second.page.locator('.party-vacant').count(),1);
    assert.deepEqual(await second.page.locator('.party-bonus-seal strong').allTextContents(),['—','—']);
    assert.equal(await second.page.locator('.party-invite-field > span').textContent(),'~');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await second.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'party-invitation.png')});
    await second.page.setViewportSize({width:320,height:844});
    assert.ok(await second.page.locator('#social-group-panel').evaluate(el=>el.scrollWidth<=el.clientWidth && [...el.querySelectorAll('input,button')].every(control=>{const r=control.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})),'Invitation, response buttons and account field fit a 320px screen');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await second.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'party-invitation-320.png')});
    await second.page.setViewportSize({width:1280,height:800});
    await second.page.locator('.party-invitation').getByRole('button',{name:'Aceptar',exact:true}).click();
    await second.page.locator('.party-member').nth(1).waitFor();
    await second.page.locator('#window-close').click();
    await first.page.locator('#party-hud .party-member').waitFor();
    await first.page.locator('.chat-log').getByText('~moon_account ha aceptado tu invitación y se ha unido al grupo.',{exact:true}).waitFor({state:'attached'});
    assert.equal(await first.page.locator('#party-hud .party-member-name strong').textContent(),'Elara');
    assert.equal(await first.page.locator('#hud-party-leader').isVisible(),true);
    assert.equal(await second.page.locator('#party-hud .party-leader').count(),1);
    assert.equal(await first.page.locator('#hud-health-text').textContent(),'203 / 203','200 + 1.5% is exactly 203, without floating-point under-rounding');
    await first.page.locator('#player-menu-toggle').click();await first.page.locator('[data-window="social"]').click();
    assert.equal(await first.page.locator('#social-tab-1').getAttribute('aria-selected'),'true');
    assert.equal(await first.page.locator('.party-panel-content .party-member').count(),2);
    assert.equal(await first.page.locator('.party-roster .party-vacant').count(),1);
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'party-social-two.png')});
    const invitationField=first.page.locator('.party-invite-input');
    await invitationField.fill('draft_account');await invitationField.focus();
    await first.page.waitForTimeout(2300);
    assert.equal(await invitationField.inputValue(),'draft_account','Group polling preserves the invitation draft');
    assert.equal(await invitationField.evaluate(el=>el===document.activeElement),true,'Group polling preserves focus');
    assert.equal(await first.page.locator('.party-bonus').getAttribute('aria-label'),'Bonificación: +2% experiencia · +1.5% vida y recurso máximos');
    assert.deepEqual(await first.page.locator('.party-bonus-seal strong').allTextContents(),['+2%','+1.5%']);
    for(const [player,account] of [[third,accounts[2]],[fourth,accounts[3]]]){
      await groupInvite(first.page,account.character.name);
      await player.page.waitForFunction(()=>document.querySelector('#player-menu-toggle').classList.contains('has-party-invite'));
      await groupTab(player.page);
      await player.page.locator('.party-invitation').getByRole('button',{name:'Aceptar',exact:true}).click();
      await player.page.locator('#window-close').click();
    }
    await first.page.waitForFunction(()=>document.querySelectorAll('.party-panel-content .party-member').length===4);
    assert.equal(await first.page.locator('.party-invite-input').count(),0);
    assert.equal(await first.page.locator('.party-bonus').getAttribute('aria-label'),'Bonificación: +2% experiencia · +4.5% vida y recurso máximos');
    assert.deepEqual(await first.page.locator('.party-bonus-seal strong').allTextContents(),['+2%','+4.5%']);
    assert.equal(await first.page.locator('.party-seats .filled').count(),4);
    assert.equal(await first.page.locator('.party-roster .party-member-role').count(),4);
    assert.equal(await first.page.locator('.party-roster .is-leader').count(),1);
    assert.equal(await first.page.locator('#hud-health-text').textContent(),'209 / 209');
    for(const width of [320,390,1280]){
      await first.page.setViewportSize({width,height:844});
      assert.ok(await first.page.locator('#social-group-panel').evaluate(el=>el.scrollWidth<=el.clientWidth && [...el.querySelectorAll('input,button')].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));
      const columns=await first.page.locator('.party-roster').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(columns,width>600?2:1,'Roster uses paired cards on desktop, stacked on mobile');
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`party-social-${width}.png`)});
    }
    await first.page.setViewportSize({width:1280,height:800});await first.page.locator('#window-close').click();
    assert.equal(await first.page.locator('#party-hud .party-member').count(),3);
    for(const width of [320,1280]){
      await first.page.setViewportSize({width,height:844});
      assert.ok(await first.page.locator('#party-hud').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth;}));
      for(const card of await first.page.locator('#party-hud .party-member').all()) {
        const box=await card.boundingBox();
        assert.ok(box.width<=(width===320?150:174) && box.height<=44,'Party HUD cards remain significantly smaller than the player HUD');
        assert.equal(await card.getByRole('meter').count(),2,'Compact cards retain both live vitals');
      }
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`party-hud-${width}.png`)});
    }
    const pixels=await first.page.locator('.minimap-canvas').evaluate(canvas=>{
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let found=0;for(let i=0;i<data.length;i+=4)if(data[i]===121&&data[i+1]===215&&data[i+2]===250)found++;return found;
    });
    assert.ok(pixels>0,'Party member markers are rendered cyan on the actual minimap');
    const outsiderMessages=[];world.chatSockets.set('outsider',row=>outsiderMessages.push(row));
    await chatReady(world,accounts[0]);await chatReady(world,accounts[1]);
    await first.page.keyboard.press('Enter');await first.page.locator('.chat-input').fill('/p Adventure together');await first.page.locator('.chat-input').press('Enter');
    await second.page.locator('.chat-log .k-party').filter({hasText:'Adventure together'}).waitFor();
    assert.equal(outsiderMessages.length,0);
    assert.equal(await second.page.locator('.speech-bubble').filter({hasText:'Adventure together'}).count(),0);
    await first.page.locator('.chat-filter[data-kind="party"]').click();
    assert.equal(await first.page.locator('.chat-log .k-party').count(),0);
    await first.page.locator('.chat-filter[data-kind="party"]').click();
    assert.equal(await first.page.locator('.chat-channel').textContent(),'Grupo');
    await first.page.locator('.chat-input').fill('Group tab works');
    await first.page.locator('.chat-input').press('Enter');
    await second.page.locator('.chat-log .k-party').filter({hasText:'Group tab works'}).waitFor();
    assert.equal(outsiderMessages.length,0);
    await second.page.locator('#player-menu-toggle').click();
    await second.page.locator('[data-window="sheet"]').click();
    await second.page.waitForFunction(()=>document.querySelector('.sheet-bars .sheet-bar .track span')?.textContent==='104 / 104');
    assert.equal(await second.page.locator('.sheet-bars .sheet-bar').first().locator('.track span').textContent(),'104 / 104');
    await first.page.locator('.chat-input').blur();
    await groupTab(first.page);await first.page.getByRole('button',{name:'Salir del grupo',exact:true}).click();
    await first.page.waitForFunction(()=>document.querySelectorAll('#party-hud .party-member').length===0);
    await second.page.waitForFunction(()=>!document.querySelector('#hud-party-leader').hidden);
    await second.page.waitForFunction(()=>document.querySelector('.sheet-bars .sheet-bar .track span')?.textContent==='103 / 103');
    await second.page.locator('#window-close').click();
    await groupTab(second.page);
    assert.equal(await second.page.locator('.party-panel-content .party-member').first().getAttribute('data-user-id'),accounts[1].user.id);
    assert.equal(await second.page.locator('.party-invite-input').count(),1,'New leader can invite');
    await second.page.locator('#window-close').click();
    await leave(second.page);
    await third.page.waitForFunction(()=>!document.querySelector('#hud-party-leader').hidden);
    await first.page.keyboard.press('Enter');await first.page.locator('.chat-input').fill('/p Cannot send after leaving');await first.page.locator('.chat-input').press('Enter');
    await first.page.locator('.chat-line.error').filter({hasText:'No perteneces a un grupo.'}).waitFor();
    for(const player of players)assert.deepEqual(player.errors,[]);
  }finally{for(const player of players)await player.context.close();}
});

test('closing Social during a delayed refresh cannot populate a different window', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',-6.4);
  const player = await openPlayer(world,a);
  try {
    await player.enter();
    world.rpcDelay.set('friends_list',1500);
    await player.page.locator('#player-menu-toggle').click();
    await player.page.locator('[data-window="social"]').click();
    await player.page.locator('#window-close').click();
    await player.page.locator('#player-menu-toggle').click();
    await player.page.locator('[data-window="sheet"]').click();
    await player.page.waitForTimeout(1800);
    assert.equal(await player.page.locator('.social-window').count(),0);
    assert.equal(await player.page.locator('.sheet-name-row strong').textContent(),'Alric');
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

async function nearbyInteractions(page, name) {
  await page.locator('#interact-label').filter({hasText:/^Interactuar$/}).waitFor();
  await page.keyboard.press('KeyE');
  await page.locator('#player-interactions').waitFor({state:'visible'});
  await page.waitForFunction(() => {
    const button = document.querySelector('.player-interaction-action');
    return button && !button.disabled;
  });
}

test('nearby player carousel supports keyboard friend actions, reversible mute and account whispers', { timeout: 180000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',100), b = fixture('Elara','elfo',101);
  b.username = 'ElaraAccount';
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await nearbyInteractions(first.page,'Elara');
    assert.equal(await first.page.locator('.player-interaction-header').textContent(),'Elara');
    for (const width of [320,390]) {
      await first.page.setViewportSize({width,height:844});
      const box = await first.page.locator('#player-interactions').boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width,'Player interaction fits a narrow viewport');
      for (const button of await first.page.locator('#player-interactions button').all()) {
        const bounds = await button.boundingBox();
        assert.ok(bounds && bounds.x >= box.x && bounds.x + bounds.width <= box.x + box.width,'Each interaction button fits inside its panel');
      }
    }
    assert.equal(await first.page.locator('.player-interaction-medallion svg[viewBox="0 0 48 48"]').count(),5);
    assert.equal(await first.page.locator('.player-interaction-label').textContent(),'Añadir amigo');
    assert.equal(await first.page.locator('#player-interactions').getAttribute('aria-busy'),'false');
    assert.equal(await first.page.locator('#player-interaction-name').textContent(),'Elara');
    assert.equal(await first.page.locator('#player-interactions .player-interaction-action').count(),5);
    assert.equal(await first.page.getByRole('button',{name:'Invitar a grupo',exact:true}).count(),1);
    await first.page.keyboard.press('ArrowLeft');
    await first.page.keyboard.press('ArrowLeft');
    await first.page.keyboard.press('ArrowLeft');
    assert.equal(await first.page.locator('.player-interaction-label').textContent(),'Silenciar chat');
    assert.equal(await first.page.locator('.player-interaction-action[aria-pressed="true"]').getAttribute('aria-label'),'Silenciar chat');
    await first.page.keyboard.press('KeyE');
    await first.page.getByRole('button',{name:'Reactivar chat',exact:true}).waitFor();
    assert.deepEqual(await first.page.evaluate(()=>JSON.parse(localStorage.getItem('brumaluz-chat-ignored'))),['elaraaccount']);
    await first.page.keyboard.press('Enter');
    await first.page.getByRole('button',{name:'Silenciar chat',exact:true}).waitFor();
    assert.deepEqual(await first.page.evaluate(()=>JSON.parse(localStorage.getItem('brumaluz-chat-ignored'))),[]);
    await first.page.keyboard.press('ArrowRight');
    await first.page.keyboard.press('ArrowRight');
    await first.page.keyboard.press('ArrowRight');
    await first.page.keyboard.press('KeyE');
    await first.page.getByRole('button',{name:'Cancelar solicitud',exact:true}).waitFor();
    assert.equal(world.friends.size,1);
    await nearbyInteractions(second.page,'Alric');
    await second.page.getByRole('button',{name:'Aceptar solicitud',exact:true}).click();
    await second.page.getByRole('button',{name:'Eliminar amigo',exact:true}).waitFor();
    assert.equal(await second.page.getByRole('button',{name:'Silenciar chat',exact:true}).count(),0);
    await first.page.getByRole('button',{name:'Cancelar solicitud',exact:true}).click();
    await first.page.getByRole('button',{name:'Eliminar amigo',exact:true}).waitFor();
    assert.equal(world.friends.size,1,'A stale cancel action must not remove a newly accepted friend');
    assert.equal(await first.page.locator('.player-interaction-action').count(),4);
    first.page.once('dialog',dialog=>dialog.accept());
    await first.page.getByRole('button',{name:'Eliminar amigo',exact:true}).click();
    await first.page.getByRole('button',{name:'Añadir amigo',exact:true}).waitFor();
    assert.equal(await first.page.getByRole('button',{name:'Silenciar chat',exact:true}).count(),1);
    await first.page.keyboard.press('ArrowRight');
    await first.page.keyboard.press('KeyE');
    assert.equal(await first.page.locator('#player-interactions').isVisible(),false);
    assert.equal(await first.page.locator('.chat-input').inputValue(),'/w ~ElaraAccount ');
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('player interaction closes when its target leaves range and ignores late account lookups', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',100), b = fixture('Elara','elfo',101);
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await nearbyInteractions(first.page,'Elara');
    await second.page.evaluate(()=>window.brumaluz.move(110,-11.085));
    await first.page.locator('#player-interactions').waitFor({state:'hidden'});
    await second.page.evaluate(()=>window.brumaluz.move(101,-11.085));
    await first.page.locator('#interact-label').filter({hasText:/^Interactuar$/}).waitFor();
    world.rpcDelay.set('friends_list',1500);
    await first.page.keyboard.press('KeyE');
    await first.page.locator('#player-interactions').waitFor({state:'visible'});
    await first.page.keyboard.press('Escape');
    await first.page.waitForTimeout(1800);
    assert.equal(await first.page.locator('#player-interactions').isVisible(),false);
    assert.equal(await first.page.locator('.player-interaction-action').count(),0);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('nearby player mute persists after reload and filters public messages, whispers and speech bubbles', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',100), b = fixture('Elara','elfo',101);
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    await nearbyInteractions(first.page,'Elara');
    await first.page.getByRole('button',{name:'Silenciar chat',exact:true}).click();
    await first.page.getByRole('button',{name:'Reactivar chat',exact:true}).waitFor();
    await leave(first.page);
    const message = {zone:null,sender_user:b.user.id,sender_name:'Elara',sender_account:'Elara',sender_title:'recien_llegado',recipient_user:null,recipient_name:null,created_at:new Date().toISOString()};
    world.history = [
      {...message,id:3,channel:'general',sender_user:a.user.id,sender_name:'Alric',sender_account:'Alric',body:'History loaded'},
      {...message,id:2,channel:'whisper',recipient_user:a.user.id,recipient_name:'Alric',body:'Muted whisper'},
      {...message,id:1,channel:'general',body:'Muted public message'},
    ];
    await first.page.reload();
    await first.enter();
    await first.page.waitForFunction(() => document.body.classList.contains('playing'));
    await chatReady(world,a);
    world.chatSockets.get(a.user.id)({...message,id:4,channel:'general',body:'Muted public message'});
    world.chatSockets.get(a.user.id)({...message,id:5,channel:'whisper',recipient_user:a.user.id,recipient_name:'Alric',body:'Muted whisper'});
    world.chatSockets.get(a.user.id)({...message,id:6,channel:'general',sender_user:a.user.id,sender_name:'Alric',sender_account:'Alric',body:'Live message loaded'});
    await first.page.locator('.chat-log').getByText('Live message loaded',{exact:true}).waitFor();
    assert.doesNotMatch(await first.page.locator('.chat-log').textContent(),/History loaded/);
    assert.doesNotMatch(await first.page.locator('.chat-log').textContent(),/Muted whisper|Muted public message/);
    assert.equal(await first.page.locator('.speech-bubble').filter({hasText:'Muted public message'}).count(),0);
    await nearbyInteractions(first.page,'Elara');
    await first.page.getByRole('button',{name:'Reactivar chat',exact:true}).click();
    await first.page.getByRole('button',{name:'Silenciar chat',exact:true}).waitFor();
    await leave(first.page);
    await first.enter();
    await chatReady(world,a);
    world.chatSockets.get(a.user.id)({...message,id:7,channel:'general',body:'Muted public message'});
    world.chatSockets.get(a.user.id)({...message,id:8,channel:'whisper',recipient_user:a.user.id,recipient_name:'Alric',body:'Muted whisper'});
    await first.page.locator('.chat-log').getByText('Muted public message',{exact:true}).waitFor();
    await first.page.locator('.chat-log').getByText('Muted whisper',{exact:true}).waitFor();
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('NPC interaction still opens its conversation with E', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',-6.4);
  const player = await openPlayer(world,a);
  try {
    a.character.data.position = await player.page.evaluate(() => {
      const npc = window.brumaluz.city().npcSites[0];
      return {x:npc.position.x + 1,z:npc.position.z,yaw:0};
    });
    await player.page.reload();
    await player.enter();
    assert.equal(await player.page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('gnomi-personal').visible),true,'Gnomi remains present when no welcome progress exists');
    assert.equal(await player.page.locator('[data-window="quests"]').isVisible(),false);
    await player.page.evaluate(()=>window.brumaluz.move(-6.4,-8.5));
    await player.page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#dialog').waitFor({state:'visible'});
    assert.equal(await player.page.locator('.dialog-subtitle').textContent(),npcDefinitions.find(npc=>npc.id==='gnomi').subtitle);
    assert.match(await player.page.locator('.dialog-text').textContent(),/Soy Gnomi/);
    assert.equal(await player.page.locator('.dialog-quest-card').count(),0,'Meeting Gnomi does not activate the welcome quest');
    await player.page.keyboard.press('Escape');
    await player.page.evaluate(()=>{
      const npc=window.brumaluz.city().npcSites[0];
      window.brumaluz.move(npc.position.x+1,npc.position.z);
    });
    await player.page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#dialog').waitFor({state:'visible'});
    assert.equal(await player.page.locator('.dialog-subtitle').textContent(),'Depuración');
    assert.equal(await player.page.locator('.dialog-quest-card').count(),0);
    await player.page.setViewportSize({width:320,height:568});
    await player.page.locator('.dialog-choice').first().hover();
    await player.page.mouse.move(0,0);
    await player.page.keyboard.press('ArrowUp');
    assert.equal(await player.page.locator('.dialog-choice.selected').evaluate(el=>el.classList.contains('exit')),true);
    assert.ok(await player.page.locator('.dialog-choice.selected').evaluate(el=>{
      const box=el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
    }),'Keyboard navigation reveals offscreen conversation choices');
    await player.page.keyboard.press('Escape');
    await player.page.waitForFunction(()=>!window.brumaluz.camera().view?.enabled);
    assert.equal(await player.page.locator('body').evaluate(el=>el.classList.contains('conversation-open')),false);
    assert.equal(await player.page.locator('#player-interactions').isVisible(),false);
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('quest tracker minimizes in place and offscreen objectives point toward the target across camera directions', {timeout:60000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const prepare=async()=>{
    await page.goto(`${url}/?test&welcome&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    await page.evaluate(()=>{
      window.brumaluz.set({welcome:{origin:0,stage:'active'}});
      window.brumaluz.play();
      window.brumaluz.move(0,0);
      window.brumaluz.view(Math.atan2(-15.8,5.7),.55,12);
    });
    await page.locator('#quest-tracker').waitFor();
  };
  try{
    await prepare();
    const marker=page.locator('#quest-objective-marker');
    await page.waitForFunction(()=>!document.querySelector('#quest-objective-marker').classList.contains('offscreen'));
    assert.equal(await marker.locator('.quest-marker-symbol').textContent(),'!');
    assert.doesNotMatch(await marker.textContent(),/◆/);
    assert.match(await marker.locator('.quest-marker-distance').textContent(),/^\d+ m$/);
    for(const menu of ['player','world']){
      await page.locator(`#${menu}-menu-toggle`).click();
      const buttons=page.locator(`#${menu}-menu-panel > button`);
      assert.equal(await buttons.locator('svg.menu-option-icon[aria-hidden="true"]').count(),await buttons.count());
      const positions=await buttons.evaluateAll(buttons=>buttons.filter(b=>!b.hidden).map(b=>{
        const rect=b.getBoundingClientRect(),icon=b.querySelector('svg').getBoundingClientRect();
        return icon.right<=rect.right&&icon.left>rect.left+rect.width/2;
      }));
      assert.ok(positions.every(Boolean),'Menu icons stay at the right edge');
      await page.locator(`#${menu}-menu-toggle`).click();
    }
    assert.equal(await page.locator('#game-menu-panel .menu-option-icon').count(),0);
    assert.equal(await page.locator('#world-menu-map').textContent(),'Mapa');
    assert.equal(await page.locator('#world-menu-map kbd').count(),0);
    await page.keyboard.press('m');
    await page.locator('.zone-map-chart').waitFor();
    await page.keyboard.press('m');
    await page.locator('#window-backdrop').waitFor({state:'hidden'});
    await page.evaluate(()=>window.brumaluz.set({coinBags:['plaza_pozo']}));
    await page.locator('#world-menu-toggle').click();
    await page.locator('#world-menu-collections').click();
    const realms=page.locator('.collections-realm-tile');
    assert.equal(await realms.count(),5);
    assert.equal(await realms.locator('svg[viewBox="0 0 64 64"] .realm-emblem-art').count(),5);
    assert.ok(await realms.filter({hasText:'Isla de Lunargenta'}).isVisible());
    assert.doesNotMatch(await page.locator('.collections-realm-grid').textContent(),/Luna Argéntea/);
    assert.match(await realms.first().textContent(),/50%/);
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.locator('.collections-realm-grid').evaluate(grid=>grid.scrollWidth<=grid.clientWidth));
      const iconsFit=await realms.evaluateAll(tiles=>tiles.every(tile=>{
        const icon=tile.querySelector('.collections-realm-icon').getBoundingClientRect(),rect=tile.getBoundingClientRect();
        return icon.left>=rect.left&&icon.right<=rect.right;
      }));
      assert.ok(iconsFit,'Custom region emblems fit narrow tiles');
    }
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    assert.ok(await page.getByRole('button',{name:'Lunargenta Isle, coming soon',exact:true}).isVisible());
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:1280,height:800});
    await page.locator('#quest-tracker').waitFor();
    assert.match(await page.locator('.quest-tracker-progress').textContent(),/Paso 2 de 3/);
    const initial=await page.locator('#quest-tracker').boundingBox();
    await page.getByRole('button',{name:'Minimizar misiones',exact:true}).click();
    assert.equal(await page.locator('.quest-tracker-detail').isVisible(),false);
    const minimized=await page.locator('#quest-tracker').boundingBox();
    assert.equal(minimized.x,initial.x);assert.equal(minimized.y,initial.y);
    assert.equal(minimized.width,initial.width);assert.ok(minimized.height<initial.height);
    assert.equal(await page.getByRole('button',{name:'Expandir misiones',exact:true}).getAttribute('aria-expanded'),'false');
    assert.equal(await marker.isVisible(),true,'Minimizing the tracker does not disable world guidance');
    await prepare();
    assert.equal(await page.locator('.quest-tracker-detail').isVisible(),false,'Minimization persists after reload');
    await page.getByRole('button',{name:'Expandir misiones',exact:true}).click();
    await page.locator('.quest-tracker-detail').click();
    await page.locator('.quest-entry').waitFor();
    assert.equal(await marker.isVisible(),false,'Objective guidance hides in menus');
    await page.keyboard.press('Escape');
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      for(const [offset,side] of [[-Math.PI/2,'left'],[Math.PI/2,'right'],[Math.PI,'behind']]){
        await page.evaluate(offset=>window.brumaluz.view(Math.atan2(-15.8,5.7)+offset,.55,12),offset);
        await page.waitForTimeout(400);
        await page.waitForFunction(()=>document.querySelector('#quest-objective-marker').classList.contains('offscreen'));
        const bounds=await marker.boundingBox();
        assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.y>=0&&bounds.y+bounds.height<=844,`Arrow fits ${width}px facing ${side}`);
        if(side==='left')assert.ok(bounds.x<width/2);
        if(side==='right')assert.ok(bounds.x>width/2);
        assert.equal(await marker.locator('.quest-direction-arrow').isVisible(),true);
        assert.equal(await marker.locator('.quest-marker-symbol').isVisible(),false,'offscreen guidance has no exclamation');
        assert.match(await marker.locator('.quest-direction-arrow').getAttribute('style'),/rotate\([^N]*rad\)/);
      }
      await page.evaluate(()=>window.brumaluz.view(Math.atan2(-15.8,5.7),.55,12));
      await page.waitForFunction(()=>!document.querySelector('#quest-objective-marker').classList.contains('offscreen'));
      assert.equal(await marker.locator('.quest-direction-arrow').isVisible(),false);
      assert.equal(await marker.locator('.quest-marker-symbol').isVisible(),true);
      assert.ok(await page.locator('#quest-tracker').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth));
    }
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await page.getByRole('button',{name:'Minimize quests',exact:true}).waitFor();
    assert.match(await page.locator('.quest-tracker-progress').textContent(),/Step 2 of 3/);
    await page.evaluate(()=>window.brumaluz.set({welcome:{origin:0,stage:'completed'}}));
    await page.locator('.quest-tracker-objective').filter({hasText:'Isberto'}).waitFor();
    await page.evaluate(()=>window.brumaluz.set({shadowQuest:'returned'}));
    await page.locator('#quest-tracker').waitFor({state:'hidden'});
    assert.equal(await marker.isVisible(),false);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('NPC names and target badges share the same ten metre visibility limit', {timeout:60000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  try{
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    await page.evaluate(()=>window.brumaluz.play());
    const plate=page.locator('.nameplate.npc:not(.welcome-nameplate)').first();
    for(const [distance,visible] of [[9.9,true],[10.1,false],[9.9,true]]){
      await page.evaluate(distance=>{
        const site=window.brumaluz.city().npcSites.find(npc=>npc.id==='testiculos');
        window.brumaluz.move(site.position.x,site.position.z+distance);
        window.brumaluz.view(0,.55,12);
      },distance);
      await plate.waitFor({state:visible?'visible':'hidden'});
      if(visible){
        await page.mouse.move(1278,798);
        await page.evaluate(()=>window.brumaluz.view(.5,.55,12));
        await page.locator('#target-frame').waitFor({state:'hidden'});
        assert.equal(await plate.isVisible(),true,'Nearby NPC names remain visible without aiming or hovering');
        await page.evaluate(()=>window.brumaluz.view(0,.55,12));
        await page.waitForTimeout(300);
        await hoverActor(page,plate);
        await page.waitForFunction(()=>!document.querySelector('#target-frame').hidden&&document.querySelector('#target-frame').dataset.targetId==='npc:testiculos');
      }else await page.locator('#target-frame').waitFor({state:'hidden'});
    }
    await page.evaluate(()=>window.brumaluz.set({welcome:{origin:0,stage:'available'},shadowQuest:null}));
    for(const [distance,visible] of [[9.9,true],[10.1,false]]){
      await page.evaluate(distance=>{
        window.brumaluz.move(-6.4,-8.5+distance);
        window.brumaluz.view(0,.55,12);
      },distance);
      await page.locator('.welcome-nameplate').waitFor({state:visible?'visible':'hidden'});
    }
  }finally{await context.close();}
});

test('online portals distinguish a pending mission encounter from engaged combat', {timeout:180000}, async()=>{
  const world=backend(),account=fixture('Viajero','humano',24.5);
  world.combatSimulationEnabled=true;
  Object.assign(account.character.data,{
    position:{x:24.5,z:-48.5,yaw:0},welcome:{origin:0,stage:'completed'},shadowQuest:'active',
    combatEncounter:{id:'shadowling',instanceId:randomUUID(),status:'active',engaged:true,health:100,maxHealth:100,
      x:3.5,z:-62.35,enemyAttackAt:Date.now()/1000+100,loot:[],looted:false},
  });
  const maps=Object.fromEntries(['brumaluz','casa_de_isberto_interior','pompelin'].map(id=>[
    id,JSON.parse(readFileSync(join(process.cwd(),'src','data','world','maps',`${id}.json`),'utf8')),
  ]));
  const player=await openPlayer(world,account),calls=[];
  await player.context.route(/\/rest\/v1\/rpc\/world_travel$/,async route=>{
    const {p_portal}=route.request().postDataJSON();
    const current=world.players.get(account.user.id);
    const map=current.data.location??'brumaluz',portal=maps[map].markers.find(marker=>marker.id===p_portal);
    assert.ok(portal,`Portal ${p_portal} exists in ${map}`);
    assert.ok(current.encounter?.status!=='active'||!current.encounter.engaged,'Only engaged combat blocks the travel RPC');
    assert.ok(Math.hypot(current.position.x-portal.position[0],current.position.z-portal.position[2])<=portal.radius+.5);
    const arrival=maps[portal.target.map].markers.find(marker=>marker.id===portal.target.arrival);
    const position={x:arrival.position[0],z:arrival.position[2],yaw:arrival.rotationY};
    calls.push({from:map,to:portal.target.map});
    current.position=position;
    current.data.location=portal.target.map;
    current.data.position=position;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      status:'ok',location:portal.target.map,position,players:[],encounter:current.encounter,vitals:current.vitals,
    })});
  });
  const move=async(x,z)=>{
    world.players.get(account.user.id).position={x,z,yaw:0};
    await player.page.evaluate(({x,z})=>window.brumaluz.move(x,z),{x,z});
  };
  try{
    await player.enter();
    await player.page.waitForTimeout(800);
    assert.deepEqual(player.errors,[]);
    assert.equal(await player.page.evaluate(()=>window.brumaluz.city().locationId),'brumaluz');
    await player.page.locator('#interact-label').filter({hasText:/Casa de Isberto/i}).waitFor();
    assert.match(await player.page.locator('#interact-label').textContent(),/Bloqueado: combate activo/);
    await player.page.keyboard.press('e');
    await player.page.locator('#toast.error.show').filter({hasText:'Termina el combate activo'}).waitFor();
    assert.equal(await player.page.evaluate(()=>window.brumaluz.city().locationId),'brumaluz');
    assert.equal(calls.length,0);
    const current=world.players.get(account.user.id);
    current.encounter={...current.encounter,status:'active',engaged:false,health:100};
    await player.page.waitForFunction(()=>!document.querySelector('#interact-label').textContent.includes('Bloqueado'));
    await player.page.keyboard.press('e');
    await player.page.waitForFunction(()=>window.brumaluz.city().locationId==='casa_de_isberto_interior');
    assert.equal(current.encounter.status,'active','Travelling with a pending quest does not complete or discard its enemy');
    assert.equal(current.encounter.engaged,false);
    await player.page.waitForFunction(()=>!document.querySelector('.map-transition'));
    await player.page.locator('#interact-label').filter({hasText:'Salir a Brumaluz'}).waitFor();
    await player.page.keyboard.press('e');
    await player.page.waitForFunction(()=>window.brumaluz.city().locationId==='brumaluz');
    await player.page.waitForFunction(()=>!document.querySelector('.map-transition'));
    current.encounter={...current.encounter,status:'active',engaged:true,health:100};
    await move(70,0);
    await player.page.waitForTimeout(600);
    await move(84,0);
    await player.page.locator('#toast.error.show').filter({hasText:'Termina el combate activo'}).waitFor();
    assert.equal(calls.length,2,'An automatic exit also refuses combat with a visible explanation');
    current.encounter={...current.encounter,status:'active',engaged:false,health:100};
    await move(70,0);
    await player.page.waitForTimeout(600);
    await move(84,0);
    await player.page.waitForFunction(()=>window.brumaluz.city().locationId==='pompelin');
    await player.page.waitForFunction(()=>!document.querySelector('.map-transition'));
    await move(-150,-150);
    await player.page.locator('#interact-label').filter({hasText:'Brumaluz'}).waitFor();
    await player.page.keyboard.press('e');
    await player.page.waitForFunction(()=>window.brumaluz.city().locationId==='brumaluz');
    assert.deepEqual(calls,[
      {from:'brumaluz',to:'casa_de_isberto_interior'},{from:'casa_de_isberto_interior',to:'brumaluz'},
      {from:'brumaluz',to:'pompelin'},{from:'pompelin',to:'brumaluz'},
    ]);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('quest journal tracking persists without changing progress, completed entries or personal waypoints', {timeout:60000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const prepare=async()=>{
    await page.goto(`${url}/?test&welcome&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    await page.evaluate(()=>{
      window.brumaluz.set({welcome:{origin:0,stage:'active'},shadowQuest:null});
      window.brumaluz.play();
      window.brumaluz.move(0,0);
      window.brumaluz.view(Math.atan2(-15.8,5.7),.55,12);
    });
    await page.locator('.minimap-canvas').waitFor();
  };
  const journal=async()=>{
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="quests"]').click();
    await page.locator('.quest-journal').waitFor();
  };
  try{
    await prepare();
    await page.locator('#quest-tracker').waitFor();
    await journal();
    const untrack=page.getByRole('button',{name:'Dejar de seguir misión',exact:true});
    assert.equal(await untrack.getAttribute('aria-pressed'),'true');
    await untrack.click();
    const track=page.getByRole('button',{name:'Seguir misión',exact:true});
    assert.equal(await track.getAttribute('aria-pressed'),'false');
    assert.equal(await track.evaluate(el=>el===document.activeElement),true,'Tracking does not destroy keyboard focus');
    await page.evaluate(()=>window.brumaluz.set({welcome:{origin:0,stage:'active'}}));
    assert.equal(await track.getAttribute('aria-pressed'),'false','A refreshed character snapshot does not reactivate tracking');
    assert.equal(await track.evaluate(el=>el===document.activeElement),true,'Snapshots preserve journal focus');
    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.locator('.quest-journal').evaluate(el=>el.scrollWidth<=el.clientWidth),'Journal fits narrow windows');
      assert.ok(await track.evaluate(el=>{
        const rect=el.getBoundingClientRect();
        return rect.left>=0&&rect.right<=innerWidth&&el.scrollWidth<=el.clientWidth;
      }),'Tracking control stays readable');
    }
    await page.setViewportSize({width:1280,height:800});
    await page.keyboard.press('Escape');
    await page.locator('#quest-tracker').waitFor({state:'hidden'});
    assert.equal(await page.locator('#quest-objective-marker').isVisible(),false);
    await page.keyboard.press('m');
    await page.locator('.zone-map-chart').waitFor();
    assert.equal(await page.locator('.zone-map-poi-quest').count(),0);
    await page.locator('.zone-map-chart').click({position:{x:90,y:90}});
    await page.locator('.zone-map-waypoint').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#waypoint-objective-marker').waitFor();
    await journal();
    await track.click();
    await page.keyboard.press('Escape');
    await page.locator('#quest-tracker').waitFor();
    await page.locator('#quest-objective-marker').waitFor();
    assert.equal(await page.locator('#waypoint-objective-marker').isVisible(),true,'Quest guidance does not replace personal destinations');
    await page.keyboard.press('m');
    await page.locator('.zone-map-poi-quest').waitFor();
    assert.equal(await page.locator('.zone-map-waypoint').isVisible(),true);
    const objectivePosition=await page.locator('.zone-map-poi-quest').evaluate(el=>({x:el.style.left,z:el.style.top}));
    await page.locator('.zone-map-poi-quest').click();
    await page.waitForFunction(expected=>{
      const pin=document.querySelector('.zone-map-waypoint');
      return pin.style.left===expected.x&&pin.style.top===expected.z;
    },objectivePosition);
    await page.keyboard.press('Escape');
    await journal();
    await untrack.click();
    await prepare();
    await journal();
    assert.equal(await track.getAttribute('aria-pressed'),'false','Tracking preference survives a reload');
    assert.equal(await page.locator('[data-quest="welcome"] .quest-objective p').textContent(),'Recoge el distintivo junto al mercado.');
    await page.evaluate(()=>window.brumaluz.set({welcome:{origin:0,stage:'completed'},shadowQuest:null}));
    assert.equal(await page.locator('.quest-journal-content [data-quest="shadow"]').count(),1,'The next conversation is not an empty active journal');
    assert.equal(await untrack.count(),1,'New quests are tracked by default');
    await page.getByRole('button',{name:'Completadas',exact:true}).click();
    await page.locator('.quest-completed summary').click();
    assert.equal(await page.locator('.quest-track-button').count(),0,'Completed quests cannot be tracked');
    await page.evaluate(()=>window.brumaluz.set({health:80}));
    assert.equal(await page.getByRole('button',{name:'Completadas',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.quest-completed').getAttribute('open'),'','Snapshots preserve expanded completed entries');
    await page.getByRole('button',{name:'Activas',exact:true}).click();
    await untrack.click();
    await page.keyboard.press('Escape');
    await page.locator('#quest-tracker').waitFor({state:'hidden'});
    await journal();
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await page.getByRole('button',{name:'Track quest',exact:true}).waitFor();
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    await page.evaluate(()=>window.brumaluz.set({shadowQuest:'returned'}));
    await page.getByRole('button',{name:'Completadas',exact:true}).click();
    assert.equal(await page.locator('.quest-completed').count(),2);
    assert.equal(await page.locator('.quest-track-button').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('online compact corpse loot retries after a full-bag rejection and removes the body permanently after collecting', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Saqueador','humano',4.5);
  world.combatSimulationEnabled=true;
  Object.assign(account.character.data,{
    position:{x:4.5,z:-62.35,yaw:0},welcome:{origin:0,stage:'completed'},shadowQuest:'defeated',
    combatEncounter:{id:'shadowling',instanceId:randomUUID(),status:'defeated',health:0,maxHealth:100,
      x:3.5,z:-62.35,enemyAttackAt:0,loot:[{id:'esencia_sombria',count:1,bound:true}],looted:false},
  });
  const player=await openPlayer(world,account);
  try{
    await player.enter();
    await player.page.locator('#interact-label').filter({hasText:'Registrar cuerpo'}).waitFor();
    await player.page.keyboard.press('KeyE');
    await player.page.locator('.loot-item').waitFor();
    assert.equal(await player.page.locator('.loot-window-frame').getAttribute('aria-modal'),'false');
    assert.equal(await player.page.locator('#action-bar').isVisible(),true,'Looting does not hide the game HUD');
    assert.equal(await player.page.locator('.loot-overlay').evaluate(el=>getComputedStyle(el).backdropFilter),'none');
    for(const width of [320,390,1280]){
      await player.page.setViewportSize({width,height:844});await player.page.waitForTimeout(100);
      const bounds=await player.page.locator('.loot-window-frame').evaluate(el=>{
        const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:el.scrollWidth,client:el.clientWidth};
      });
      assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.top>=0&&bounds.bottom<=bounds.height&&bounds.scroll<=bounds.client,`Compact loot fits the viewport: ${JSON.stringify(bounds)}`);
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await player.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`compact-loot-${width}.png`)});
    }
    await player.page.evaluate(()=>window.brumaluz.move(9,-62.35));
    await player.page.locator('#window-backdrop').waitFor({state:'hidden'});
    assert.equal(account.character.data.combatEncounter.looted,false,'Walking away closes the panel without collecting anything');
    await player.page.evaluate(()=>window.brumaluz.move(4.5,-62.35));
    await player.page.locator('#interact-label').filter({hasText:'Registrar cuerpo'}).waitFor();
    await player.page.keyboard.press('KeyE');await player.page.locator('.loot-item').waitFor();
    world.fail.add('loot');
    await player.page.getByRole('button',{name:'Recoger todo',exact:true}).click();
    await player.page.locator('.loot-status').filter({hasText:'Vuelve a intentarlo'}).waitFor();
    assert.equal(account.character.data.combatEncounter.looted,false);
    world.fail.delete('loot');
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#window-backdrop').waitFor({state:'hidden'});
    assert.equal(await player.page.evaluate(()=>!!window.brumaluz.city().root.parent.getObjectByName('combat-corpse')),false);
    assert.equal(account.character.data.shadowQuest,'defeated','Looting never skips the closing conversation');
    await leave(player.page);await player.page.reload();await player.page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await player.page.waitForTimeout(300);
    assert.equal(await player.page.evaluate(()=>!!window.brumaluz.city().root.parent.getObjectByName('combat-corpse')),false);
    assert.equal(account.character.data.inventory.filter(item=>item?.id==='esencia_sombria').length,1);
    await player.page.keyboard.press('KeyI');
    await player.page.locator('[data-item-id="esencia_sombria"]').waitFor();
    await player.page.locator('[data-item-id="esencia_sombria"]').hover();
    await player.page.locator('#game-tooltip').filter({hasText:'No sabes qué es ni para qué sirve.'}).waitFor();
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('a pelín pouch near the well is collected once, keeps state on failure and stays gone after re-entry', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Buscador','humano',5);
  Object.assign(account.character.data,{position:{x:5,z:-4.4,yaw:0},wallet:{pelines:3}});
  const player=await openPlayer(world,account);
  const bag=()=>player.page.evaluate(()=>{
    const root=window.brumaluz.city().root.parent.getObjectByName('coin-bag:plaza_pozo');
    return root ? {visible:root.visible,model:!!root.getObjectByName('coin-bag-sack')} : null;
  });
  try{
    await player.enter();
    await player.page.waitForFunction(()=>!!window.brumaluz.city().root.parent.getObjectByName('coin-bag-sack'));
    assert.deepEqual(await bag(),{visible:true,model:true});
    await player.page.locator('#interact-label').filter({hasText:'Recoger bolsa de pelines'}).waitFor();
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR){
      await player.page.evaluate(()=>window.brumaluz.view(Math.PI*.8,.35,5));await player.page.waitForTimeout(300);
      await player.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'coin-bag.png')});
    }
    world.fail.add('coinbag');
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#toast').filter({hasText:'Acércate a la bolsa para recogerla.'}).waitFor();
    assert.equal(account.character.data.wallet.pelines,3,'A rejected pickup gives nothing');
    assert.equal((await bag()).visible,true,'A rejected pickup leaves the pouch in place');
    world.fail.delete('coinbag');
    await player.page.keyboard.press('KeyE');
    await player.page.locator('.chat-log').getByText('Has encontrado 17 pelines.',{exact:true}).waitFor({state:'attached'});
    assert.equal(account.character.data.wallet.pelines,20);
    await player.page.waitForFunction(()=>!window.brumaluz.city().root.parent.getObjectByName('coin-bag:plaza_pozo').visible);
    assert.notEqual(await player.page.locator('#interact-label').textContent(),'Recoger bolsa de pelines');
    await leave(player.page);await player.page.reload();await player.page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await player.page.waitForTimeout(300);
    assert.equal((await bag()).visible,false,'Collected pouches stay gone for this character');
    assert.deepEqual(account.character.data.coinBags,['plaza_pozo']);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('online story epilogue retries failed reporting, resumes the return and leaves Gnomi at the well after reconnecting', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('DeVuelta','humano',-1.7);
  Object.assign(account.character.data,{
    position:{x:-1.7,z:-62.35,yaw:0},welcome:{origin:0,stage:'completed'},shadowQuest:'defeated',
    combatEncounter:{id:'shadowling',instanceId:randomUUID(),status:'defeated',health:0,maxHealth:100,
      x:3.5,z:-62.35,enemyAttackAt:0,loot:[null],looted:true},
  });
  const player=await openPlayer(world,account),page=player.page;
  try{
    await player.enter();
    await page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    await page.waitForFunction(()=>{
      const actor=window.brumaluz.city().root.parent.getObjectByName('npc:isberto'),player=window.brumaluz.char().root.parent;
      const angle=Math.atan2(actor.position.x-player.position.x,actor.position.z-player.position.z);
      return Math.abs(Math.atan2(Math.sin(angle-player.rotation.y),Math.cos(angle-player.rotation.y)))<.05;
    });
    const beforeSpeakerChange=await page.evaluate(()=>({
      position:window.brumaluz.char().root.parent.position.toArray(),
      facing:window.brumaluz.char().root.parent.rotation.y,
    }));
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-speaker').filter({hasText:'Gnomi'}).waitFor();
    await page.waitForFunction(()=>{
      const actor=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal'),player=window.brumaluz.char().root.parent;
      const angle=Math.atan2(actor.position.x-player.position.x,actor.position.z-player.position.z);
      return Math.abs(Math.atan2(Math.sin(angle-player.rotation.y),Math.cos(angle-player.rotation.y)))<.05;
    });
    const afterSpeakerChange=await page.evaluate(()=>({
      position:window.brumaluz.char().root.parent.position.toArray(),
      facing:window.brumaluz.char().root.parent.rotation.y,
    }));
    assert.deepEqual(afterSpeakerChange.position,beforeSpeakerChange.position,'Changing speaker rotates the player without moving them');
    assert.ok(Math.abs(Math.atan2(Math.sin(afterSpeakerChange.facing-beforeSpeakerChange.facing),Math.cos(afterSpeakerChange.facing-beforeSpeakerChange.facing)))>.2,'The player turns toward Gnomi instead of staring at Isberto');
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    await page.waitForFunction(()=>{
      const actor=window.brumaluz.city().root.parent.getObjectByName('npc:isberto'),player=window.brumaluz.char().root.parent;
      const angle=Math.atan2(actor.position.x-player.position.x,actor.position.z-player.position.z);
      return Math.abs(Math.atan2(Math.sin(angle-player.rotation.y),Math.cos(angle-player.rotation.y)))<.05;
    });
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'isberto-gnomi-epilogue.png')});
    await page.keyboard.press('Escape');
    assert.equal(account.character.data.shadowQuest,'defeated','Exiting partway through the scene never advances the story');
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    for(let i=0;i<3;i++)await page.keyboard.press('KeyE');
    const report=page.getByRole('button',{name:'Volver con Gnomi a la plaza',exact:true});
    await report.waitFor();
    world.fail.add('shadow');
    await report.click();
    await report.waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelector('#dialog').getAttribute('aria-busy')==='false');
    assert.equal(account.character.data.shadowQuest,'defeated','A failed RPC keeps the conversation retryable');
    world.fail.delete('shadow');
    await report.click();
    await page.locator('#dialog').waitFor({state:'hidden'});
    assert.equal(account.character.data.shadowQuest,'returning');
    await leave(page);await page.reload();await page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await page.locator('.quest-tracker-objective').filter({hasText:'plaza del pozo'}).waitFor();
    Object.assign(world.players.get(account.user.id).position,{x:-3.5,z:0});
    await page.evaluate(()=>window.brumaluz.move(-3.5,0));
    await page.locator('#interact-label').filter({hasText:'Hablar con Gnomi'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.getByRole('button',{name:'Quedarnos en la plaza',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#dialog').getAttribute('aria-busy')==='false');
    assert.equal(account.character.data.shadowQuest,'returned',JSON.stringify(await page.evaluate(()=>({
      text:document.querySelector('.dialog-text').textContent,
      dialogHidden:document.querySelector('#dialog').hidden,
      notifications:document.querySelector('#toasts')?.textContent,
    }))));
    await page.locator('.dialog-text').filter({hasText:'misterio'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('#quest-tracker').waitFor({state:'hidden'});
    await leave(page);await page.reload();await page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    await page.waitForFunction(()=>{
      const gnomi=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      return gnomi.visible&&Math.hypot(gnomi.position.x+3.5,gnomi.position.z)<.1&&gnomi.userData.gait==='idle';
    });
    assert.equal(await page.locator('#quest-tracker').isVisible(),false);
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'gnomi-returned-square.png')});
    assert.equal(await page.evaluate(()=>!!window.brumaluz.city().root.parent.getObjectByName('combat-corpse')),false,'The old body stays exhausted');
    assert.equal(account.character.data.inventory?.filter(item=>item?.id==='esencia_sombria').length??0,0,'The epilogue invents no extra item rewards');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('Gnomi locomotion advances the rig continuously and rests during dialogue without sliding', {timeout:60000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  try{
    await page.goto(`${url}/?test&welcome&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    await page.evaluate(()=>{
      window.brumaluz.set({welcome:{origin:0,stage:'active'},position:{x:-6.4,z:-8.5,yaw:0}});
      window.brumaluz.play();
    });
    const samples=await page.evaluate(async()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      const poses=[],gaits=[];
      let previous=g.position.clone(),moved=0;
      for(let i=0;i<100;i++){
        window.brumaluz.move(-6.4+i*.1,-8.5);
        await new Promise(requestAnimationFrame);
        if(g.position.distanceTo(previous)>.001){
          moved++;gaits.push(g.userData.gait);
          const pose=[];g.traverse(object=>{if(object.isBone)pose.push(...object.quaternion.toArray().map(v=>v.toFixed(3)));});
          poses.push(pose.join(','));
        }
        previous.copy(g.position);
      }
      return {moved,uniquePoses:new Set(poses).size,idleWhileMoving:gaits.filter(gait=>gait==='idle').length};
    });
    assert.ok(samples.moved>20,`Gnomi follows the player: ${JSON.stringify(samples)}`);
    assert.ok(samples.uniquePoses>10,'The rig changes pose while following');
    assert.equal(samples.idleWhileMoving,0,'Reached waypoints do not reset locomotion between trail segments');
    await page.evaluate(()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      window.brumaluz.move(g.position.x,g.position.z);
    });
    await page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('#dialog').waitFor({state:'visible'});
    const idle=await page.evaluate(async()=>{
      const g=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal'),before=g.position.clone();
      await new Promise(resolve=>setTimeout(resolve,300));
      return {gait:g.userData.gait,distance:g.position.distanceTo(before)};
    });
    assert.equal(idle.gait,'idle');assert.equal(idle.distance,0);
  }finally{await context.close();}
});

test('Gnomi unlocks Isberto, whose accepted quest leaves a lootable corpse and exactly one mysterious essence', {timeout:120000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(`${url}/?test&welcome&graphics=compatible`);
    await page.waitForFunction(()=>!!window.brumaluz);
    await page.evaluate(()=>{
      window.brumaluz.set({cls:'guerrero',equipment:{weapon:{id:'espada_inicial',count:1,bound:true}}});
      window.brumaluz.play();
    });
    await page.waitForFunction(()=>document.body.classList.contains('playing'));
    await page.evaluate(()=>{
      const isberto=window.brumaluz.city().npcSites.find(value=>value.id==='isberto');
      if(!isberto)throw new Error('Isberto is missing from the city');
      window.brumaluz.move(isberto.position.x,isberto.position.z);
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').visible),false,'Isberto stays hidden until Gnomi’s welcome is complete');
    assert.equal(await page.locator('#interact-label').filter({hasText:'Hablar'}).count(),0,'Locked Isberto cannot be interacted with');
    await page.evaluate(()=>window.brumaluz.move(-6.4,-8.5));
    await page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('#dialog').waitFor({state:'visible'});
    await page.getByRole('button',{name:'He venido a probar suerte.'}).click();
    await page.getByRole('button',{name:'Aceptar misión'}).waitFor();
    await page.getByRole('button',{name:'Aceptar misión'}).click();
    await page.locator('#dialog').waitFor({state:'hidden'});
    await page.evaluate(()=>window.brumaluz.move(15.8,-5.7));
    await page.locator('#interact-label').filter({hasText:'Recoger distintivo'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>document.querySelector('#quest-tracker').textContent.includes('devuélvele'));
    await page.evaluate(()=>{
      const gnomi=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      window.brumaluz.move(gnomi.position.x,gnomi.position.z);
    });
    await page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.getByRole('button',{name:'Completar misión'}).click();
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    await page.waitForFunction(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').visible);
    assert.equal(await page.evaluate(()=>window.brumaluz.city().root.parent.getObjectByName('npc:isberto').visible),true,'Isberto appears after returning Gnomi’s badge');
    assert.ok(await page.evaluate(()=>{
      const actor=window.brumaluz.city().root.parent.getObjectByName('npc:isberto');
      return actor.position.distanceTo(window.brumaluz.char().root.parent.position)<4;
    }),'Isberto appears beside the player instead of requiring a trip to the farm');
    await page.locator('.dialog-quest-card').filter({hasText:'Una sombra entre el ganado'}).waitFor();
    await page.locator('.dialog-choice').first().click();
    await page.waitForFunction(()=>!document.querySelector('#combat-controls').hidden);
    await page.evaluate(()=>{
      const site=window.brumaluz.city().npcSites.find(value=>value.id==='isberto');
      if(!site)throw new Error('Isberto is missing from the city');
      window.brumaluz.move(site.position.x+5,site.position.z);
      window.brumaluz.view(-Math.PI/2,.55,12);
    });
    await page.waitForFunction(()=>document.querySelector('#target-frame')?.dataset.targetId==='enemy:shadowling');
    await page.keyboard.press('KeyF');
    await page.keyboard.press('Digit1');
    await page.locator('.chat-log').getByText('Golpeas a la criatura extraña por 18.',{exact:true}).waitFor();
    assert.equal(await page.locator('#combat-controls').isVisible(),true);
    assert.equal(await page.locator('#combat-flee').count(),0,'There is no retreat button');
    const slot=page.locator('.ab-slot[data-skill-id="heavy_strike"]');
    await slot.locator('.ab-cooldown-time').filter({hasText:/[1-6]/}).waitFor();
    await slot.evaluate(el=>el.dataset.testIdentity='preserved');
    await page.waitForTimeout(300);
    assert.equal(await slot.getAttribute('data-test-identity'),'preserved','Cooldown updates preserve slot DOM and tooltips');
    await page.waitForFunction(()=>document.querySelector('#combat-controls').hidden);
    await page.waitForFunction(()=>!!window.brumaluz.city().root.parent.getObjectByName('combat-corpse'));
    await page.evaluate(()=>{
      const corpse=window.brumaluz.city().root.parent.getObjectByName('combat-corpse');
      window.brumaluz.move(corpse.position.x,corpse.position.z+1);
    });
    await page.locator('#interact-label').filter({hasText:'Registrar cuerpo'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('.loot-item').filter({hasText:'Esencia sombría'}).waitFor();
    await page.locator('.loot-item').hover();
    await page.locator('#game-tooltip').filter({hasText:'No sabes qué es ni para qué sirve.'}).waitFor();
    await page.getByRole('button',{name:'Recoger todo',exact:true}).click();
    await page.locator('#window-backdrop').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>!!window.brumaluz.city().root.parent.getObjectByName('combat-corpse')),false);
    await page.locator('.quest-tracker-objective').filter({hasText:'Habla con Isberto'}).waitFor();
    await page.evaluate(()=>{
      const isberto=window.brumaluz.city().root.parent.getObjectByName('npc:isberto');
      window.brumaluz.move(isberto.position.x,isberto.position.z);
    });
    await page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-speaker').filter({hasText:'Gnomi'}).waitFor();
    assert.match(await page.locator('.dialog-text').textContent(),/tampoco sé qué era/);
    assert.equal(await page.locator('.dialog-subtitle').textContent(),npcDefinitions.find(npc=>npc.id==='gnomi').subtitle);
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-speaker').filter({hasText:'Isberto'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.getByRole('button',{name:'Volver con Gnomi a la plaza',exact:true}).click();
    await page.locator('#dialog').waitFor({state:'hidden'});
    await page.locator('.quest-tracker-objective').filter({hasText:'plaza del pozo'}).waitFor();
    assert.ok(await page.evaluate(()=>{
      const gnomi=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      return gnomi.visible;
    }));
    await page.evaluate(()=>window.brumaluz.move(-3.5,0));
    await page.waitForFunction(()=>{
      const gnomi=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      const player=window.brumaluz.char().root.parent;
      return gnomi.position.distanceTo(player.position)<2.6;
    });
    await page.locator('#interact-label').filter({hasText:'Hablar con Gnomi'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.getByRole('button',{name:'Quedarnos en la plaza',exact:true}).click();
    await page.locator('.dialog-text').filter({hasText:'misterio'}).waitFor();
    await page.keyboard.press('KeyE');
    await page.locator('#quest-tracker').waitFor({state:'hidden'});
    await page.evaluate(()=>window.brumaluz.move(-3.5,8));
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(()=>{
      const gnomi=window.brumaluz.city().root.parent.getObjectByName('gnomi-personal');
      return Math.hypot(gnomi.position.x+3.5,gnomi.position.z)<.1&&gnomi.userData.gait==='idle';
    }),'Gnomi stays in the plaza after this chapter rather than following forever');
    await page.keyboard.press('KeyI');
    await page.locator('.inv-bag [data-item-id="esencia_sombria"]').waitFor();
    assert.equal(await page.locator('.inv-bag [data-item-id="esencia_sombria"]').count(),1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyJ');
    await page.getByRole('button',{name:'Completadas',exact:true}).click();
    assert.equal(await page.locator('.quest-entry').count(),2,'Both Gnomi and Isberto remain in the completed journal');
    assert.equal(await page.locator('.quest-completed[open]').count(),0,'Completed quests start collapsed');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'collapsed-quests.png')});
    await page.locator('.quest-completed summary').first().click();
    assert.equal(await page.locator('.quest-completed[open]').count(),1);
    await page.locator('.quest-completed summary').first().click();
    assert.equal(await page.locator('.quest-completed[open]').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('online Isberto combat uses mocked RPC state for start, enemy damage, skill and target release without retreat', {timeout:120000}, async()=>{
  const world=backend(),account=fixture('Alric','humano',-3);
  world.combatSimulationEnabled=true;
  account.character.data.welcome={origin:0,stage:'completed'};
  account.character.data.equipment={weapon:{id:'espada_inicial',count:1,bound:true}};
  account.character.data.position={x:-3,z:-62.35,yaw:0};
  const player=await openPlayer(world,account);
  try{
    await player.enter();
    await player.page.locator('#interact-label').filter({hasText:'Hablar'}).waitFor();
    await player.page.keyboard.press('KeyE');
    await player.page.locator('#dialog').waitFor({state:'visible'});
    await player.page.locator('.dialog-choice').first().click();
    await player.page.waitForFunction(()=>!document.querySelector('#combat-controls').hidden);
    assert.equal(world.combatCalls.some(call=>call.fn==='combat_start'),true,'The encounter starts through the online RPC');
    assert.equal(await player.page.locator('#combat-auto').getAttribute('aria-pressed'),'false');
    await player.page.evaluate(()=>{
      const site=window.brumaluz.city().npcSites.find(value=>value.id==='isberto');
      if(!site)throw new Error('Isberto is missing from the city');
      window.brumaluz.move(site.position.x+5,site.position.z);
      window.brumaluz.view(-Math.PI/2,.55,12);
    });

    await player.page.waitForFunction(()=>document.querySelector('#hud-health-text').textContent==='92 / 100',{timeout:15000});
    assert.equal(world.players.get(account.user.id).vitals.health,92,'The world sync snapshot applies the enemy hit to the local HUD');
    await player.page.waitForFunction(()=>document.querySelector('#target-frame')?.dataset.targetId==='enemy:shadowling');
    await player.page.keyboard.press('KeyF');
    await player.page.keyboard.press('Digit1');
    await player.page.locator('.chat-log').getByText('Golpeas a la criatura extraña por 18.',{exact:true}).waitFor();
    assert.equal(world.combatCalls.some(call=>call.fn==='combat_action'&&call.action==='heavy_strike'),true,'The named class skill uses the online action RPC');
    assert.equal(world.players.get(account.user.id).vitals.resource,65,'The server response updates the player resource');
    assert.equal(await player.page.locator('#hud-resource-text').textContent(),'65 / 80');
    await player.page.waitForFunction(()=>document.querySelector('#target-frame')?.dataset.locked==='true');
    await player.page.evaluate(()=>window.brumaluz.view(Math.PI/2,.55,12));
    await player.page.waitForTimeout(400);
    assert.equal(await player.page.locator('#target-frame').getAttribute('data-target-id'),'enemy:shadowling','Locked enemy remains selected when the camera turns away');
    await player.page.keyboard.down('KeyW');
    await player.page.waitForTimeout(150);
    await player.page.keyboard.up('KeyW');
    assert.equal(await player.page.locator('#target-frame').getAttribute('data-locked'),'true','Manual movement does not release the target lock');
    assert.equal(await player.page.locator('#combat-auto').getAttribute('aria-pressed'),'true','Manual movement preserves automatic attacks while in range');
    await player.page.keyboard.press('Escape');
    await player.page.waitForFunction(()=>document.querySelector('#target-frame')?.dataset.locked==='false');
    assert.equal(world.players.get(account.user.id).encounter.status,'active','Escape releases the target without pretending to retreat from the encounter');
    assert.equal(await player.page.locator('#game-menu-panel').isVisible(),false);
    assert.equal(await player.page.locator('#combat-flee').count(),0);
    assert.equal(world.combatCalls.some(call=>call.fn==='combat_stop'),false,'Releasing a target never sends a retreat RPC');
    assert.equal(world.players.get(account.user.id).encounter.status,'active');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('skillbook lists each class starter skill, supports responsive quickbar drag, persistence and self-healing', {timeout:120000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    for(const [cls,id,label] of [
      ['guerrero','heavy_strike','Golpe contundente'],['mago','arcane_discharge','Descarga arcana'],
      ['picaro','double_slash','Corte doble'],['clerigo','healing','Curación'],
      ['explorador','precise_shot','Disparo preciso'],
    ]) {
      await page.goto(`${url}/?test&graphics=compatible`);
      await page.waitForFunction(()=>!!window.brumaluz);
      await page.evaluate(({cls,weapon})=>{
        localStorage.removeItem('brumaluz-actionbar:test');
        window.brumaluz.set({cls,health:60,resource:50,equipment:{weapon:{id:weapon,count:1,bound:true}}});
        window.brumaluz.play();
      },{cls,weapon:({guerrero:'espada_inicial',mago:'baston_inicial',picaro:'daga_inicial',clerigo:'varita_inicial',explorador:'ballesta_inicial'})[cls]});
      await page.keyboard.press('KeyK');
      await page.locator('.skills-book').waitFor();
      assert.equal(await page.locator('.skill-card').count(),1);
      assert.equal(await page.locator('.skill-card h4').textContent(),label);
      await page.locator('[data-language="en"]').first().dispatchEvent('click');
      assert.match(await page.locator('.skill-card p').textContent(),/Rank 1/);
      assert.match(await page.locator('.skill-stats').textContent(),/Cost.*Cooldown/);
      await page.locator('[data-language="es"]').first().dispatchEvent('click');
      await page.locator('.skill-hero-art').hover();
      await page.locator('#game-tooltip.skill-tooltip').waitFor({state:'visible'});
      assert.match(await page.locator('#game-tooltip').textContent(),/Rango 1.*Coste.*Recarga.*Siguiente rango/s);
      assert.equal(await page.locator(`#game-tooltip [data-icon-skill="${id}"]`).count(),1);
      for(const width of [320,390,1280]) {
        await page.setViewportSize({width,height:844});
        assert.ok(await page.locator('.skills-book').evaluate(el=>el.scrollWidth<=el.clientWidth),'Skillbook fits narrow viewports');
        assert.ok(await page.locator('.game-window').evaluate(el=>{
          const r=el.getBoundingClientRect(),bar=document.querySelector('#action-bar').getBoundingClientRect();
          return r.left>=0&&r.right<=innerWidth&&r.bottom<bar.top&&bar.left>=0&&bar.right<=innerWidth;
        }),'The window stays within the viewport and above the quickbar');
      }
      const card=page.locator('.skill-card');
      await card.dragTo(page.locator('.ab-slot').nth(4));
      assert.equal(await page.locator('.ab-slot').nth(4).getAttribute('data-skill-id'),id);
      await page.keyboard.press('Escape');
      await page.locator(`.ab-slot[data-skill-id="${id}"]`).focus();
      await page.locator('#game-tooltip.skill-tooltip').waitFor({state:'visible'});
      assert.match(await page.locator('#game-tooltip').textContent(),/Rango 1/);
      await page.locator(`.ab-slot[data-skill-id="${id}"]`).blur();
      if(cls==='clerigo') {
        await page.keyboard.press('Digit5');
        await page.waitForFunction(()=>document.querySelector('#hud-health-text').textContent==='92 / 100');
        assert.ok(Number(await page.locator(`.ab-slot[data-skill-id="${id}"] .ab-cooldown-time`).textContent())>0,'Skill cooldown is shown on quickbar');
        await page.keyboard.press('Digit5');
        assert.equal(await page.locator('#hud-health-text').textContent(),'92 / 100','Cooldown prevents repeated healing');
      } else {
        await page.keyboard.press('Digit5');
        await page.locator('#toast').filter({hasText:'Fija un enemigo visible con F.'}).waitFor();
      }
      await page.locator(`.ab-slot[data-skill-id="${id}"]`).click({button:'right'});
      await page.keyboard.press('KeyK');
      await page.getByRole('button',{name:'Añadir a la barra rápida'}).click();
      await page.locator('.skill-status').filter({hasText:'Habilidad disponible'}).waitFor();
      const layout=await page.evaluate(()=>JSON.parse(localStorage.getItem('brumaluz-actionbar:test')));
      assert.equal(layout.flat().filter(value=>value===`skill:${id}`).length,1,'Known skill is assigned without duplicates');
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors,[]);
  } finally {await context.close();}
});

test('skillbook previews permanent rank upgrades, spends once, keeps points and scales basic attacks by level', {timeout:120000}, async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:940}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    for(const [cls,power] of [['guerrero',26],['mago',26],['picaro',12],['clerigo',48],['explorador',27]]){
      await page.goto(`${url}/?test&graphics=compatible`);
      await page.waitForFunction(()=>!!window.brumaluz);
      await page.evaluate(cls=>{window.brumaluz.set({cls,level:8,health:1,resource:80});window.brumaluz.play();},cls);
      await page.keyboard.press('KeyK');
      assert.equal(await page.locator('.skill-points strong').textContent(),'4');
      assert.match(await page.locator('.skills-progress').textContent(),/nivel 10/);
      await page.getByRole('button',{name:'Mejorar habilidad',exact:true}).click();
      assert.match(await page.locator('.skill-confirmation').textContent(),/permanente/);
      await page.locator('.skill-confirmation').getByRole('button',{name:'Cancelar',exact:true}).click();
      assert.equal(await page.locator('.skill-points strong').textContent(),'4');
      for(let rank=2;rank<=5;rank++){
        await page.getByRole('button',{name:'Mejorar habilidad',exact:true}).click();
        await page.getByRole('button',{name:'Confirmar mejora',exact:true}).click();
        await page.waitForFunction(rank=>document.querySelector('.skill-rank-label').textContent.includes(`Rango ${rank}`),rank);
        assert.equal(await page.locator('.skill-points strong').textContent(),String(5-rank));
      }
      assert.match(await page.locator('.skill-effect').textContent(),new RegExp(String(power)));
      assert.equal(await page.getByRole('button',{name:'Mejorar habilidad',exact:true}).isDisabled(),true);
      assert.equal(await page.locator('.skill-rank-track .learned').count(),5);
      await page.keyboard.press('Escape');
      await page.keyboard.press('KeyK');
      assert.match(await page.locator('.skill-rank-label').textContent(),/Rango 5/);
      await page.locator('.skill-hero-art').focus();
      await page.locator('#game-tooltip.skill-tooltip').waitFor({state:'visible'});
      assert.match(await page.locator('#game-tooltip').textContent(),/Rango 5.*Rango máximo/s);
    }
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('starter skill fills a free slot without replacing items and respects manual removal after reconnect', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Alric','humano',100);
  account.character.data.inventory=[{id:'pan_duro',count:2}];
  const player=await openPlayer(world,account);
  try {
    await player.page.evaluate(id=>{
      localStorage.setItem(`brumaluz-actionbar:${id}`,JSON.stringify([['pan_duro',null]]));
    },account.character.id);
    await player.enter();
    assert.equal(await player.page.locator('.ab-slot').nth(0).getAttribute('data-item-id'),'pan_duro');
    assert.equal(await player.page.locator('.ab-slot').nth(1).getAttribute('data-skill-id'),'heavy_strike');
    await player.page.locator('.ab-slot[data-skill-id]').click({button:'right'});
    await leave(player.page);
    await player.page.reload(); await player.page.waitForFunction(()=>!!window.brumaluz);
    await player.enter();
    assert.equal(await player.page.locator('.ab-slot[data-skill-id]').count(),0,'Removed skill stays removed on reconnect');
    assert.equal(await player.page.locator('.ab-slot').nth(0).getAttribute('data-item-id'),'pan_duro');
    await player.page.keyboard.press('KeyK');
    await player.page.getByRole('button',{name:'Añadir a la barra rápida'}).click();
    assert.equal(await player.page.locator('.ab-slot').nth(1).getAttribute('data-skill-id'),'heavy_strike');
    await player.page.keyboard.press('Escape');
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('online skill upgrades show failures, retry safely and preserve their rank after re-entry', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Alric','humano',100);
  account.character.data.level=4;
  const player=await openPlayer(world,account);
  try{
    await player.enter();
    await player.page.keyboard.press('KeyK');
    assert.equal(await player.page.locator('.skill-points strong').textContent(),'2');
    world.fail.add('skill');
    await player.page.getByRole('button',{name:'Mejorar habilidad',exact:true}).click();
    await player.page.getByRole('button',{name:'Confirmar mejora',exact:true}).click();
    await player.page.locator('.skill-status').filter({hasText:'No se ha guardado'}).waitFor();
    assert.equal(account.character.data.skillRanks,undefined);
    world.fail.delete('skill');
    world.rpcDelay.set('upgrade_skill',600);
    await player.page.getByRole('button',{name:'Confirmar mejora',exact:true}).click();
    await player.page.locator('[data-language="en"]').first().dispatchEvent('click');
    await player.page.waitForFunction(()=>document.querySelector('.skill-rank-label').textContent.includes('Rank 2'));
    await player.page.locator('[data-language="es"]').first().dispatchEvent('click');
    assert.deepEqual(account.character.data.skillRanks,{heavy_strike:2});
    assert.equal(await player.page.locator('.skill-points strong').textContent(),'1');
    await player.page.getByRole('button',{name:'Mejorar habilidad',exact:true}).click();
    await player.page.getByRole('button',{name:'Confirmar mejora',exact:true}).click();
    await player.page.keyboard.press('Escape');
    await player.page.waitForFunction(()=>document.querySelector('#window-backdrop').hidden);
    await player.page.waitForTimeout(900);
    assert.deepEqual(account.character.data.skillRanks,{heavy_strike:3});
    assert.equal(await player.page.locator('#window-backdrop').isVisible(),false,'A delayed upgrade does not reopen the window');
    await leave(player.page);
    await player.page.reload();await player.page.waitForFunction(()=>!!window.brumaluz);
    await player.enter();await player.page.keyboard.press('KeyK');
    assert.match(await player.page.locator('.skill-rank-label').textContent(),/Rango 3/);
    assert.equal(await player.page.locator('.skill-points strong').textContent(),'0');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('friend requests notify outside Social, mark both menu levels and announce acceptance; Group offers invitations', { timeout: 120000 }, async () => {
  const world = backend(), a = fixture('Alric','humano',100), b = fixture('Elara','elfo',101);
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  try {
    await first.enter(); await second.enter();
    assert.equal(await first.page.locator('#game-menu-toggle .menu-key').textContent(),'Esc');
    assert.equal(await first.page.locator('#player-menu-toggle .menu-key').textContent(),'Tab');
    await social(first.page);
    await socialRequest(first.page,'Elara');
    await first.page.locator('[data-social="outgoing"] .social-row').waitFor();
    await first.page.locator('#window-close').click();
    await second.page.locator('.friend-notification').filter({hasText:'~Alric te ha enviado una solicitud de amistad.'}).waitFor({timeout:15000});
    await second.page.locator('.friend-request-badge').waitFor({state:'visible'});
    assert.equal(await second.page.locator('[data-window="social"]').getAttribute('class').then(value=>value.includes('has-friend-requests')),true);
    assert.equal(await second.page.locator('#window-backdrop').isVisible(),false);
    await social(second.page);
    assert.equal(await second.page.locator('[data-social="incoming"] .class-icon').count(),0);
    assert.equal(await second.page.locator('[data-social="incoming"] .social-avatar').textContent(),'');
    assert.deepEqual(await second.page.locator('.social-stat strong').allTextContents(),['0','1']);
    await second.page.getByRole('tab',{name:'Grupo',exact:true}).click();
    await second.page.getByText('Comienza una aventura en grupo',{exact:true}).waitFor();
    assert.equal(await second.page.locator('#social-friends-panel').isVisible(),false);
    await second.page.keyboard.press('ArrowLeft');
    assert.equal(await second.page.getByRole('tab',{name:'Amigos',exact:true}).getAttribute('aria-selected'),'true');
    await second.page.getByRole('button',{name:'Aceptar',exact:true}).click();
    await second.page.locator('[data-social="friend"] .social-row').waitFor();
    await second.page.locator('.friend-request-badge').waitFor({state:'hidden'});
    assert.equal(await second.page.locator('[data-window="social"]').getAttribute('class').then(value=>value.includes('has-friend-requests')),false);
    await first.page.locator('.friend-notification').filter({hasText:'~Elara ha aceptado tu solicitud de amistad.'}).waitFor({timeout:15000});
    await first.page.locator('.chat-log').getByText('~Elara ha aceptado tu solicitud de amistad.',{exact:true}).waitFor();
    const notices = await first.page.locator('.chat-log').getByText('~Elara ha aceptado tu solicitud de amistad.',{exact:true}).count();
    await first.page.waitForTimeout(5500);
    assert.equal(await first.page.locator('.chat-log').getByText('~Elara ha aceptado tu solicitud de amistad.',{exact:true}).count(),notices);
    await leave(first.page);
    assert.equal(await first.page.locator('.friend-notification').count(),0);
    assert.equal(await first.page.locator('.friend-request-badge').count(),0);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('periodic Social refresh preserves controls, focused input and unchanged friend cards without flickering', {timeout:120000}, async () => {
  const world = backend(), a = fixture('Alric','humano',100), b = fixture('Elara','elfo',101);
  const first = await openPlayer(world,a), second = await openPlayer(world,b);
  world.friends.set([a.user.id,b.user.id].sort().join(':'),{from:a.user.id,to:b.user.id,accepted:true});
  try {
    await first.enter(); await second.enter();
    await social(first.page);
    await first.page.locator('.social-online').waitFor();
    await first.page.locator('#social-username').fill('DraftName');
    await first.page.locator('#social-username').focus();
    world.rpcDelay.set('friends_list',600);
    await first.page.evaluate(()=>{
      const row=document.querySelector('.social-row');
      row.dataset.retained='true';
      const root=document.querySelector('.social-window');
      root.dataset.disableChanges='0';
      new MutationObserver(records=>{
        const count=records.filter(record=>record.attributeName==='disabled').length;
        root.dataset.disableChanges=String(Number(root.dataset.disableChanges)+count);
      }).observe(root,{subtree:true,attributes:true,attributeFilter:['disabled']});
    });
    await first.page.waitForTimeout(6200);
    assert.equal(await first.page.locator('.social-row').getAttribute('data-retained'),'true');
    assert.equal(await first.page.locator('.social-window').getAttribute('data-disable-changes'),'0');
    assert.equal(await first.page.locator('#social-username').inputValue(),'DraftName');
    assert.equal(await first.page.locator('#social-username').evaluate(el=>el===document.activeElement),true);
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

test('menus hide the action bar except Inventory and chat can be revealed by hover without restoring old history', {timeout:120000}, async () => {
  const world = backend(), a = fixture('Alric','humano',100);
  world.history=[{id:1,channel:'general',zone:null,sender_user:a.user.id,sender_name:'Alric',sender_account:'Alric',sender_title:'recien_llegado',recipient_user:null,recipient_name:null,created_at:new Date().toISOString(),body:'Old server history'}];
  const player=await openPlayer(world,a);
  let historyRequests=0;
  player.page.on('request',request=>{if(new URL(request.url()).pathname==='/rest/v1/chat_messages')historyRequests++;});
  try {
    await player.enter();
    await chatReady(world,a);
    world.chatSockets.get(a.user.id)({...world.history[0],id:2,body:'First connection message'});
    await player.page.locator('.chat-log').getByText('First connection message',{exact:true}).waitFor();
    assert.doesNotMatch(await player.page.locator('.chat-log').textContent(),/Old server history/);
    for(const menu of ['#game-menu-toggle','#player-menu-toggle']){
      await player.page.locator(menu).click();
      assert.equal(await player.page.locator('#action-bar').isVisible(),false);
      assert.equal(await player.page.locator('#minimap').isVisible(),false);
      assert.equal(await player.page.locator('#chat').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
      await player.page.locator(menu).click();
    }
    await social(player.page);
    assert.equal(await player.page.locator('#action-bar').isVisible(),false);
    const chatBox=await player.page.locator('#chat').boundingBox();
    await player.page.mouse.move(chatBox.x+chatBox.width-10,chatBox.y+10);
    assert.equal(await player.page.locator('#chat').evaluate(el=>el.classList.contains('hover-revealed')),false);
    await revealChat(player.page);
    await player.page.waitForFunction(()=>getComputedStyle(document.querySelector('#chat')).opacity==='1');
    assert.equal(await player.page.locator('#chat').evaluate(el=>getComputedStyle(el).pointerEvents),'auto');
    await player.page.mouse.move(5,5);
    await player.page.waitForFunction(()=>getComputedStyle(document.querySelector('#chat')).opacity==='0');
    await player.page.locator('#window-close').click();
    await player.page.keyboard.press('KeyI');
    assert.equal(await player.page.locator('#action-bar').isVisible(),true);
    await player.page.keyboard.press('Escape');
    await player.page.keyboard.press('KeyC');
    assert.equal(await player.page.locator('#action-bar').isVisible(),false);
    await player.page.keyboard.press('Escape');
    await player.page.keyboard.press('KeyO');
    assert.equal(await player.page.locator('#action-bar').isVisible(),false);
    await player.page.keyboard.press('Escape');
    assert.equal(await player.page.locator('#action-bar').isVisible(),true);
    await player.page.locator('#chat').evaluate(el=>el.classList.add('faded'));
    await revealChat(player.page);
    await player.page.waitForFunction(()=>!document.querySelector('#chat').classList.contains('faded'));
    const scrollbar=await player.page.locator('.chat-log').evaluate(el=>getComputedStyle(el).scrollbarColor);
    assert.equal(scrollbar,'rgb(185, 148, 90) rgb(40, 26, 16)');
    await player.page.mouse.move(5,5);
    await leave(player.page);
    assert.doesNotMatch(await player.page.locator('.chat-log').textContent(),/First connection message/);
    world.history.unshift({...world.history[0],id:3,body:'Message while disconnected'});
    await player.enter();
    await chatReady(world,a);
    world.chatSockets.get(a.user.id)({...world.history[0],id:4,body:'Second connection message'});
    await player.page.locator('.chat-log').getByText('Second connection message',{exact:true}).waitFor();
    assert.doesNotMatch(await player.page.locator('.chat-log').textContent(),/Old server history|First connection message|Message while disconnected/);
    assert.equal(historyRequests,0);
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('video graphics selector shares access mode and reloads in both directions', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100)), page = player.page;
  try {
    await player.enter();
    await page.keyboard.press('KeyO');
    const button = page.locator('#opt-graphics-mode');
    assert.equal(await button.textContent(), 'Gráficos: compatible');
    assert.equal(await button.textContent(), await page.locator('#graphics-mode').textContent());
    await page.locator('#options-backdrop [data-language="en"]').click();
    assert.equal(await button.textContent(), 'Graphics: compatibility');
    assert.match(await page.locator('[data-pane="video"] .options-hint').textContent(), /reloads the game/);
    await Promise.all([page.waitForURL(url => !url.searchParams.has('graphics')), button.click()]);
    await page.locator('.character-card .btn.gold').first().waitFor({ timeout: 60000 });
    assert.equal(await page.locator('#graphics-mode').textContent(), 'Gráficos: normal');
    await player.enter();
    await page.keyboard.press('KeyO');
    assert.equal(await button.textContent(), 'Gráficos: normal');
    await Promise.all([page.waitForURL(url => url.searchParams.get('graphics') === 'compatible'), button.click()]);
    await page.locator('.character-card .btn.gold').first().waitFor({ timeout: 60000 });
    assert.equal(await page.locator('#graphics-mode').textContent(), 'Gráficos: compatible');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('inventory drag moves and swaps complete stacks persistently without using or merging items', {timeout:120000},async()=>{
  const world=backend(),a=fixture('Alric','humano',100);
  a.character.data.inventory=[{id:'pan_duro',count:4,bound:true},{id:'pan_duro',count:7},{id:'pocion_vida_minuscula',count:3}];
  const player=await openPlayer(world,a),page=player.page;
  let requests=0,failMove=false;
  await page.route('**/rest/v1/rpc/move_inventory_item',async route=>{
    const args=route.request().postDataJSON(),inv=a.character.data.inventory;
    assert.equal(args.p_character_id,a.character.id);
    assert.deepEqual(args.p_expected_from,inv[args.p_from]);
    assert.deepEqual(args.p_expected_to,inv[args.p_to]??null);
    if(failMove) return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'INVENTORY_CHANGED'})});
    [inv[args.p_from],inv[args.p_to]]=[inv[args.p_to]??null,inv[args.p_from]];
    requests++;
    await route.fulfill({contentType:'application/json',body:JSON.stringify(a.character.data)});
  });
  try {
    await player.enter();await page.keyboard.press('KeyI');
    const slot=i=>page.locator(`.inv-grid [data-index="${i}"]`);
    await slot(0).dragTo(page.locator('.ab-slot').first());
    assert.equal(await page.locator('.ab-slot').first().getAttribute('data-item-id'),'pan_duro');
    await slot(0).dragTo(slot(10));
    await page.waitForFunction(()=>document.querySelector('.inv-grid [data-index="10"]')?.dataset.itemId==='pan_duro');
    assert.equal(await slot(0).getAttribute('data-item-id'),null);
    assert.equal(await slot(10).getAttribute('data-item-bound'),'true');
    await slot(10).dragTo(slot(1));
    await page.waitForFunction(()=>document.querySelector('.inv-grid [data-index="1"]')?.dataset.itemBound==='true');
    assert.equal(await slot(1).locator('i').textContent(),'4');
    assert.equal(await slot(10).locator('i').textContent(),'7');
    await slot(2).dragTo(slot(1));
    await page.waitForFunction(()=>document.querySelector('.inv-grid [data-index="1"]')?.dataset.itemId==='pocion_vida_minuscula');
    assert.equal(await slot(2).getAttribute('data-item-bound'),'true');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'inventory-reordered.png')});
    assert.equal(requests,3);
    assert.equal(a.character.data.inventory.filter(Boolean).reduce((n,s)=>n+s.count,0),14);
    failMove=true;
    await slot(1).dragTo(slot(3));
    await page.locator('#toast').filter({hasText:'Tu mochila ha cambiado. Vuelve a mover el objeto.'}).waitFor({state:'visible'});
    assert.equal(await slot(1).getAttribute('data-item-id'),'pocion_vida_minuscula');
    assert.equal(await slot(3).getAttribute('data-item-id'),null);
    await page.reload();
    await page.locator('.character-card .btn.gold').first().waitFor();await player.enter();
    await page.keyboard.press('KeyI');
    assert.equal(await slot(1).getAttribute('data-item-id'),'pocion_vida_minuscula');
    assert.equal(await slot(10).locator('i').textContent(),'7');
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('default chat width follows the action bar while manual size persists', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100)), page = player.page;
  try {
    await page.evaluate(()=>localStorage.setItem('brumaluz-chat-size',JSON.stringify({w:354,h:210})));
    await page.reload();
    await page.locator('.character-card .btn.gold').first().waitFor();
    await player.enter();
    for (const width of [1200, 1280, 1490, 1920, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const bar = document.querySelector('#action-bar').getBoundingClientRect();
        const chat = document.querySelector('#chat').getBoundingClientRect();
        return Math.abs(chat.left - bar.right - 12) <= 1 && Math.abs(chat.right - innerWidth + 12) <= 1
          && Math.abs(chat.bottom - bar.bottom) <= 1;
      });
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('brumaluz-chat-size')).w),354,'Legacy width does not prevent automatic layout');
      if(width===1490 && process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'chat-default-1490.png')});
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const chat = document.querySelector('#chat').getBoundingClientRect();
      return chat.left >= 0 && chat.right <= innerWidth && chat.width >= 250;
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    const handle = await page.locator('.chat-resize').boundingBox();
    await page.mouse.move(handle.x + 7, handle.y + 7);
    await page.mouse.down();
    await page.mouse.move(handle.x - 73, handle.y - 33, { steps: 5 });
    await page.mouse.up();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('brumaluz-chat-size')));
    assert.equal(stored.version,2);
    assert.ok(stored.w > 300);
    await page.setViewportSize({ width: 1920, height: 900 });
    assert.equal(Math.round((await page.locator('#chat').boundingBox()).width), Math.round(stored.w));
    await page.reload();
    await page.locator('.character-card .btn.gold').first().waitFor({ timeout: 30000 });
    await player.enter();
    assert.equal(Math.round((await page.locator('#chat').boundingBox()).width), Math.round(stored.w));
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('chat corner button waits until opacity finishes fading, and hides again on new messages', {timeout:120000},async()=>{
  const world=backend(),a=fixture('Alric','humano',100),player=await openPlayer(world,a),page=player.page;
  try {
    await player.enter();await chatReady(world,a);
    await page.mouse.move(0,0);
    await page.waitForTimeout(200);
    await page.locator('#chat').evaluate(el=>el.classList.add('faded'));
    await page.waitForTimeout(1500);
    const opacity=await page.locator('#chat').evaluate(el=>Number(getComputedStyle(el).opacity));
    assert.ok(opacity>0 && opacity<.82,'Chat is still fading');
    assert.equal(await page.locator('.chat-peek').isVisible(),false,'Button does not precede the end of the fade');
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'chat-fading-no-button.png')});
    await page.locator('.chat-peek').waitFor({state:'visible'});
    assert.equal(await page.locator('#chat').evaluate(el=>Number(getComputedStyle(el).opacity)),0);
    world.chatSockets.get(a.user.id)({id:9991,channel:'general',sender_user:a.user.id,sender_name:'Alric',sender_account:'Alric',sender_title:'recien_llegado',created_at:new Date().toISOString(),body:'Wake the chat'});
    await page.locator('.chat-log').getByText('Wake the chat',{exact:true}).waitFor();
    await page.locator('.chat-peek').waitFor({state:'hidden'});
    await page.locator('#game-menu-toggle').click();
    await page.locator('.chat-peek').waitFor({state:'visible'});
    assert.equal(await page.locator('#chat').evaluate(el=>Number(getComputedStyle(el).opacity)),0);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('chat minimizes into a bottom tab, restores size, and corner preview stays temporary', {timeout:120000}, async()=>{
  const world=backend(), a=fixture('Alric','humano',100), player=await openPlayer(world,a);
  try {
    await player.enter();
    const expanded=await player.page.locator('#chat').boundingBox();
    await player.page.getByRole('button',{name:'Minimizar chat',exact:true}).click();
    const minimized=await player.page.locator('#chat').boundingBox();
    const iconCentered=await player.page.locator('.chat-collapse').evaluate(button=>{
      const bounds=button.getBoundingClientRect(), icon=button.querySelector('i').getBoundingClientRect();
      return Math.abs(bounds.left+bounds.right-icon.left-icon.right)<1 && Math.abs(bounds.top+bounds.bottom-icon.top-icon.bottom)<1;
    });
    assert.equal(iconCentered,true,'Restore icon must be centered in its button');
    assert.ok(minimized.height<=40 && minimized.width<=120);
    assert.equal(Math.round(minimized.y+minimized.height),788);
    assert.equal(await player.page.locator('.chat-log').isVisible(),false);
    await player.page.getByRole('button',{name:'Abrir chat',exact:true}).click();
    assert.equal((await player.page.locator('#chat').boundingBox()).height,expanded.height);
    await player.page.getByRole('button',{name:'Minimizar chat',exact:true}).click();
    await social(player.page);
    await revealChat(player.page);
    await player.page.waitForFunction(()=>getComputedStyle(document.querySelector('#chat')).opacity==='1');
    assert.equal(await player.page.locator('.chat-log').isVisible(),true);
    const revealed=await player.page.locator('#chat').boundingBox();
    assert.equal(Math.round(revealed.y+revealed.height),788,'Chat revealed over an open window keeps its normal bottom position');
    await player.page.locator('.chat-input').fill('Draft');
    await player.page.mouse.move(5,5);
    assert.equal(await player.page.locator('#chat').evaluate(el=>getComputedStyle(el).opacity),'1');
    await player.page.locator('.chat-input').press('Escape');
    await player.page.waitForFunction(()=>getComputedStyle(document.querySelector('#chat')).opacity==='0');
    await player.page.locator('#window-close').click();
    assert.equal((await player.page.locator('#chat').boundingBox()).height,minimized.height);
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('character sheet details stay responsive and preserve attribute drafts, limits and confirmation', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  Object.assign(account.character.data, { level: 3, health: 90, resource: 60, experience: 40, overheal: 12 });
  const player = await openPlayer(backend(), account), page = player.page;
  let confirmed = 0;
  await page.route('**/rest/v1/rpc/spend_attribute_points', route => {
    assert.deepEqual(route.request().postDataJSON().p_points, { corpulencia: 1 });
    confirmed++;
    account.character.data.attributePoints.corpulencia = 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(account.character.data) });
  });
  const openSheet = async () => {
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="sheet"]').click();
  };
  const attr = id => page.locator(`.sheet-attr[data-attribute="${id}"]`);
  try {
    await player.enter();
    await openSheet();
    assert.equal(await page.locator('.sheet-name-row strong').textContent(), 'Alric');
    assert.equal(await page.locator('.sheet-level b').textContent(), '3');
    assert.equal(await page.locator('.sheet-attr-icon svg').count(), 7);
    assert.equal(await attr('pericia').locator('.sheet-attr-description').textContent(), 'Mejora la artesanía y la alquimia: velocidad de creación y probabilidad de obtener mejores objetos.');
    assert.equal(await page.locator('.sheet-vitals h3').textContent(), 'Estado del personaje');
    assert.doesNotMatch(await page.locator('.sheet-attributes').textContent(), /Base 5|Raza \+|Asignados/);
    assert.equal(await attr('fuerza').locator('b').textContent(), '7');
    assert.equal(await page.locator('.sheet-bar.hp [role="meter"]').getAttribute('aria-valuemax'), '124');
    assert.equal(await page.locator('.sheet-bar.hp .track span').textContent(), '90 / 124');
    assert.equal(await page.locator('.sheet-bar.stamina .track span').textContent(), '60 / 92');
    assert.equal(await page.locator('.sheet-progress-note').textContent(), '480 EXP para el nivel 4');
    assert.equal(await page.locator('.sheet-overheal').count(), 0);
    assert.doesNotMatch(await page.locator('.sheet').textContent(), /Sobrecuración/);
    await attr('corpulencia').focus();
    await attr('corpulencia').hover();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#game-tooltip').isVisible(), false);
    assert.equal(await page.locator('.sheet-attr[title], .sheet-attr[data-tip]').count(), 0);
    await page.locator('.sheet-bar.hp').focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /Tu salud actual y máxima/);
    await page.locator('.sheet-bar.stamina').focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /energía física/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Añadir un punto a Corpulencia', exact: true }).scrollIntoViewIfNeeded();
    const beforeDraftScroll = await page.locator('#window-body').evaluate(el => el.scrollTop);
    await page.getByRole('button', { name: 'Añadir un punto a Corpulencia', exact: true }).click();
    assert.ok(Math.abs(await page.locator('#window-body').evaluate(el => el.scrollTop) - beforeDraftScroll) <= 1, 'Editing preserves the mobile reading position');
    assert.equal(await attr('corpulencia').evaluate(el => el.contains(document.activeElement)), true, 'Editing keeps keyboard focus on the attribute');
    assert.equal(await attr('corpulencia').locator('b.pending').textContent(), '6');
    assert.equal(await attr('corpulencia').locator('.sheet-draft').textContent(), '+1 sin confirmar');
    assert.equal(await page.getByRole('button', { name: 'Añadir un punto a Fuerza', exact: true }).isDisabled(), true);
    assert.equal(confirmed, 0, 'Editing a draft does not persist it');
    assert.equal(await page.locator('.sheet-bar.hp .track span').textContent(), '90 / 124', 'Drafts do not change confirmed vitals');
    await page.getByRole('button', { name: 'Quitar un punto de Corpulencia', exact: true }).click();
    assert.equal(await attr('corpulencia').locator('.sheet-draft').count(), 0);
    assert.equal(await page.locator('#window-confirm').isVisible(), false);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Añadir un punto a Corpulencia', exact: true }).click();
    await page.locator('#window-confirm').click();
    await page.waitForFunction(() => document.querySelector('.sheet-bar.hp .track span')?.textContent === '90 / 132');
    assert.equal(confirmed, 1);
    assert.equal(await page.locator('.sheet-attr-add').count(), 0);
    assert.equal(await attr('corpulencia').locator('.sheet-attr-description').textContent(), 'Aumenta la vida máxima y la resistencia al daño.');
    await page.locator('.title-button').click();
    await page.locator('.title-option').first().waitFor({ state: 'visible' });
    await page.locator('.title-button').click();
    for (const [width, height] of [[1280, 800], [768, 1024], [390, 844], [320, 568]]) {
      await page.setViewportSize({ width, height });
      const layout = await page.locator('.sheet-window-frame').evaluate(frame => {
        const box = frame.getBoundingClientRect(), body = frame.querySelector('#window-body');
        return { fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
          noOverflow: body.scrollWidth <= body.clientWidth };
      });
      assert.ok(layout.fits && layout.noOverflow, `Sheet fits ${width}×${height}`);
      const status = page.locator('.sheet-bar.xp');
      await status.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      await page.mouse.move(0, 0);
      await status.evaluate(el => el.blur());
      await status.focus();
      await page.locator('#game-tooltip').waitFor({ state: 'visible' });
      const tip = await page.locator('#game-tooltip').boundingBox();
      assert.ok(tip.x >= 0 && tip.x + tip.width <= width && tip.y >= 0 && tip.y + tip.height <= height);
      assert.equal(await page.locator('#window-close').isVisible(), true);
      if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) {
        await page.mouse.move(0, 0);
        await page.locator('#window-close').focus();
        await page.locator('#window-body').evaluate(el => el.scrollTop = 0);
        await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, `character-sheet-${width}.png`) });
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    assert.equal(await page.locator('.sheet-vitals h3').textContent(), 'Character status');
    assert.equal(await attr('corpulencia').locator('.sheet-attr-description').textContent(), 'Increases maximum health and damage resistance.');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('character sheet handles mana, maximum level and capped attributes without empty overheal', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  Object.assign(account.character.data, { level: 50, cls: 'mago', overheal: 0, attributePoints: { fuerza: 10 } });
  const player = await openPlayer(backend(), account), page = player.page;
  try {
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await player.enter();
    await page.locator('#player-menu-toggle').click();
    await page.locator('[data-window="sheet"]').click();
    assert.equal(await page.locator('.sheet-progress-note').textContent(), 'Maximum level reached');
    assert.equal(await page.locator('.sheet-overheal').count(), 0);
    assert.equal(await page.locator('.sheet-bar.mana [role="meter"]').getAttribute('aria-label'), 'Mana');
    await page.locator('.sheet-bar.mana').focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /magical energy/);
    assert.equal(await page.locator('.sheet-attr[data-attribute="fuerza"] b').textContent(), '15');
    assert.equal(await page.getByRole('button', { name: 'Add one point to Strength', exact: true }).isDisabled(), true);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('login remembers only the opted-in email and forgets it when unchecked', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100));
  const page = player.page;
  try {
    await page.addInitScript(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) localStorage.removeItem(key);
      }
    });
    await page.reload();
    const form = page.locator('#auth-form');
    await form.waitFor({ state: 'visible' });
    const email = page.locator('#auth-email'), remember = page.locator('#auth-remember');
    assert.equal(await remember.isChecked(), false);
    await email.fill('remember@example.test');
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-remembered-email')), null);
    await remember.check();
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-remembered-email')), 'remember@example.test');
    await page.locator('#auth-password').fill('never-save-this-password');
    await page.reload();
    await form.waitFor({ state: 'visible' });
    assert.equal(await email.inputValue(), 'remember@example.test');
    assert.equal(await remember.isChecked(), true);
    assert.equal(await page.locator('#auth-password').inputValue(), '');
    assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('never-save-this-password'))), false);
    await email.fill('updated@example.test');
    await page.locator('[data-auth-mode="register"]').click();
    assert.equal(await remember.isVisible(), false);
    await page.locator('[data-auth-mode="login"]').click();
    assert.equal(await remember.isChecked(), true);
    await page.reload();
    await form.waitFor({ state: 'visible' });
    assert.equal(await email.inputValue(), 'updated@example.test');
    await remember.uncheck();
    assert.equal(await page.evaluate(() => localStorage.getItem('brumaluz-remembered-email')), null);
    assert.equal(await email.inputValue(), 'updated@example.test', 'Unchecking must not erase the current input');
    await page.reload();
    await form.waitFor({ state: 'visible' });
    assert.equal(await email.inputValue(), '');
    assert.equal(await remember.isChecked(), false);
    await page.locator('[data-language="en"]').first().click();
    assert.equal(await page.locator('#remember-email-field span').textContent(), 'Remember me');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('bread shows a timed food buff above the action bar without healing and renews until expiry', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100), true, new Date('2026-10-18T12:00:00'));
  const page = player.page;
  try {
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(() => !!window.brumaluz);
    await page.evaluate(() => {
      window.brumaluz.set({ cls: 'guerrero', health: -1, resource: -1, attributePoints: { fuerza: 2 },
        inventory: [{ id: 'pan_duro', count: 3 }] });
      window.brumaluz.play();
    });
    await page.waitForFunction(() => document.body.classList.contains('playing'));
    await page.keyboard.press('KeyI');
    const bread = page.locator('.inv-grid [data-item-id="pan_duro"]');
    await bread.hover();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.item-tip-category').textContent(), 'Comida');
    assert.match(await page.locator('#game-tooltip').textContent(), /15 minutos de conexión/);
    assert.equal(await page.locator('.item-tip-sale b').textContent(), '2 Pelines');
    await bread.dragTo(page.locator('.ab-slot').first());
    await bread.click();
    const fedAt = await page.evaluate(() => performance.now());
    const buff = page.locator('.food-buff');
    assert.equal(await page.locator('#hud-health-text').textContent(), '100 / 105');
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 83');
    assert.equal(await buff.locator('span').textContent(), '15:00');
    assert.equal(await bread.locator('i').textContent(), '2');
    await page.locator('#window-close').click();
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#interact-prompt').waitFor({ state: 'visible' });
      await page.waitForTimeout(300);
      const badge = await buff.boundingBox(), bar = await page.locator('#action-bar').boundingBox();
      const prompt = await page.locator('#interact-prompt').boundingBox();
      assert.ok(badge.x >= 0 && badge.x + badge.width <= width);
      assert.ok(badge.y + badge.height <= bar.y - 6, 'Buff is above, not overlapping the quick bar');
      assert.ok(prompt.y + prompt.height <= badge.y - 8, 'Interaction prompt stays above the buff row');
    }
    await page.waitForTimeout(100);
    await page.mouse.move(0, 0);
    await buff.evaluate(el => el.blur());
    await buff.focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /Origen: Pan duro/);
    assert.match(await page.locator('#game-tooltip').textContent(), /se pausa al desconectarte/);
    if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, 'bread-buff.png') });
    const elapsedSinceMeal = await page.evaluate(start => performance.now() - start, fedAt);
    await page.clock.fastForward(Math.max(0, Math.floor(60000 - elapsedSinceMeal)));
    assert.equal(await buff.locator('span').textContent(), '14:00');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.keyboard.press('Digit1');
    const renewedAt = await page.evaluate(() => performance.now());
    assert.equal(await buff.locator('span').textContent(), '15:00');
    assert.equal(await page.locator('.food-buff').count(), 1, 'Renewal does not stack buffs');
    assert.equal(await page.locator('#hud-health-text').textContent(), '100 / 105');
    await page.keyboard.press('KeyC');
    assert.equal(await buff.isVisible(), false, 'Buff follows the action bar visibility');
    assert.equal(await page.locator('.sheet-bar.hp .track span').textContent(), '100 / 105');
    await page.locator('#window-close').click();
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await buff.focus();
    await page.locator('#game-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-tooltip').textContent(), /Source: Stale bread/);
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    const elapsedSinceRenewal = await page.evaluate(start => performance.now() - start, renewedAt);
    await page.clock.fastForward(Math.max(0, Math.floor(899000 - elapsedSinceRenewal)));
    assert.equal(await buff.locator('span').textContent(), '0:01');
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 83');
    await page.clock.fastForward(1100);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#active-buffs').evaluate(el => el.hidden), true, JSON.stringify({
      errors: player.errors, timer: await buff.locator('span').allTextContents(),
      graphicsError: await page.locator('#graphics-error').isVisible(),
      playing: await page.locator('body').evaluate(el => el.classList.contains('playing')),
    }));
    assert.equal(await page.locator('#hud-health-text').textContent(), '100 / 100');
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 80');
    assert.equal(await buff.count(), 0);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('food timer pauses on connection failure, restores from server and ignores stale revisions', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100), world = backend();
  Object.assign(account.character.data, { foodBuff: { itemId: 'pan_duro', remaining: 600 }, foodRevision: 2 });
  const player = await openPlayer(world, account), page = player.page;
  try {
    await player.enter();
    const buff = page.locator('.food-buff');
    await buff.waitFor({ state: 'visible' });
    world.fail.add(account.user.id);
    await page.waitForFunction(() => document.querySelector('.food-buff')?.classList.contains('paused'));
    const paused = await buff.locator('span').textContent();
    await page.waitForTimeout(2200);
    assert.equal(await buff.locator('span').textContent(), paused);
    account.character.data.foodBuff.remaining = 590;
    world.fail.delete(account.user.id);
    await page.waitForFunction(() => !document.querySelector('.food-buff')?.classList.contains('paused'));
    assert.match(await buff.locator('span').textContent(), /^9:5\d$/);
    account.character.data.foodRevision = 1;
    account.character.data.foodBuff.remaining = 100;
    await page.waitForTimeout(800);
    assert.match(await buff.locator('span').textContent(), /^9:[45]\d$/, 'An old food revision cannot replace the current buff');
    account.character.data.foodRevision = 2;
    account.character.data.foodBuff.remaining = 590;
    await leave(page);
    await page.waitForTimeout(1000);
    await player.enter();
    assert.match(await buff.locator('span').textContent(), /^9:5\d$/);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('potion shop fits desktop and mobile and local resource potions enforce class and caps', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100)), page = player.page;
  try {
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(() => !!window.brumaluz);
    await page.evaluate(() => {
      window.brumaluz.set({ cls: 'mago', resource: 10, health: -1, wallet: { pelines: 100 }, inventory: [] });
      window.brumaluz.play();
    });
    await page.waitForFunction(() => document.body.classList.contains('playing'));
    const shop = async () => {
      await page.evaluate(() => { const p = window.brumaluz.city().npcSites[0].position; window.brumaluz.move(p.x, p.z + 0.6); });
      await page.keyboard.press('KeyE');
      await page.locator('.dialog-choice').filter({ hasText: 'Comerciar' }).click();
    };
    await shop();
    assert.equal(await page.locator('.vendor-col').first().locator('.vendor-row').count(), 4);
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.locator('#window-body').evaluate(el => el.scrollWidth <= el.clientWidth), `Commerce fits ${width}px`);
      const row = page.locator('.vendor-col').first().locator('[data-item-id="pocion_mana_minuscula"]');
      await row.scrollIntoViewIfNeeded();
      await row.hover();
      await page.locator('#game-tooltip').waitFor({ state: 'visible' });
      assert.match(await page.locator('#game-tooltip').textContent(), /5 % de tu maná máximo/);
      if (process.env.PLAYWRIGHT_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.PLAYWRIGHT_SCREENSHOT_DIR, `commerce-${width}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    const stock = id => page.locator('.vendor-col').first().locator(`[data-item-id="${id}"] button`);
    await stock('pocion_mana_minuscula').click();
    await stock('pocion_estamina_minuscula').click();
    assert.equal(await page.locator('.vendor-banner .currency b').textContent(), '80');
    await page.locator('#window-close').click();
    await page.keyboard.press('KeyI');
    await page.locator('.inv-grid [data-item-id="pocion_mana_minuscula"]').click();
    assert.equal(await page.locator('#hud-resource-text').textContent(), '14 / 65');
    await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').click();
    assert.match(await page.locator('#toast').textContent(), /no corresponde/);
    assert.match(await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').getAttribute('aria-label'), /1 unidades/);
    await page.locator('#window-close').click();
    await page.evaluate(() => window.brumaluz.set({ cls: 'guerrero', resource: 79 }));
    await page.keyboard.press('KeyI');
    await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').click();
    assert.equal(await page.locator('#hud-resource-text').textContent(), '80 / 80');
    await page.locator('#window-close').click();
    await shop();
    await stock('pocion_estamina_minuscula').click();
    await page.locator('#window-close').click();
    await page.keyboard.press('KeyI');
    await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').click();
    assert.match(await page.locator('#toast').textContent(), /recurso completo/);
    assert.match(await page.locator('.inv-grid [data-item-id="pocion_estamina_minuscula"]').getAttribute('aria-label'), /1 unidades/);
    await page.locator('#window-close').click();
    await shop();
    const purse = page.locator('.vendor-banner .currency b');
    const beforeSale = Number(await purse.textContent());
    await page.locator('.vendor-col').nth(1).locator('[data-item-id="pocion_estamina_minuscula"] button').click();
    assert.equal(Number(await purse.textContent()), beforeSale + 5);
    assert.equal(await page.locator('.vendor-empty').isVisible(), true);
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    assert.equal(await page.locator('.vendor-banner strong').textContent(), 'Provisions for the road');
    await page.locator('[data-language="es"]').first().dispatchEvent('click');
    await page.locator('#window-close').click();
    await page.evaluate(() => window.brumaluz.set({ wallet: { pelines: 0 } }));
    await shop();
    assert.equal(await page.locator('.vendor-col').first().locator('button:disabled').count(), 4);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('inventory item cards share tooltips with equipment, action bar and vendor without changing use or drag', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  Object.assign(account.character.data, {
    health: 60, wallet: { pelines: 100, lagrimas: 0 },
    inventory: [{ id: 'pocion_vida_minuscula', count: 3 }],
    equipment: { head: { id: 'pocion_vida_minuscula', count: 1 } },
  });
  const player = await openPlayer(backend(), account);
  const page = player.page;
  let used = 0;
  await page.route('**/rest/v1/rpc/use_item', route => {
    assert.equal(route.request().postDataJSON().p_slot, 0);
    used++;
    account.character.data.health += 5;
    account.character.data.inventory[0].count--;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(account.character.data) });
  });
  const tooltip = page.locator('#game-tooltip');
  async function inspect(target) {
    await page.mouse.move(0, 0);
    await target.hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.equal(await tooltip.locator('.item-tip-name').textContent(), 'Poción de vida minúscula');
    assert.equal(await tooltip.locator('.item-tip-category').textContent(), 'Consumible');
    assert.equal(await tooltip.locator('.item-tip-effects li').textContent(), 'Restaura un 5 % de tu vida máxima.');
    assert.match(await tooltip.locator('.item-tip-description').textContent(), /pequeño frasco/);
    assert.equal(await tooltip.locator('.item-tip-sale b').textContent(), '5 Pelines');
    assert.equal(await tooltip.locator('.item-tip-sale small').count(), 0);
    assert.doesNotMatch(await tooltip.textContent(), /Apilable|por unidad/);
    assert.equal(await tooltip.locator('.item-tip-stats').count(), 0, 'Do not invent equipment stats for a potion');
    assert.equal(await target.getAttribute('title'), null);
    assert.equal(await target.getAttribute('aria-describedby'), 'game-tooltip');
    await page.waitForTimeout(180);
    const anchor = await target.boundingBox(), card = await tooltip.boundingBox();
    const viewport = page.viewportSize();
    if (anchor.x + anchor.width + 10 + card.width <= viewport.width - 6) {
      assert.ok(Math.abs(card.x - anchor.x - anchor.width - 10) <= 1, 'Item tooltip anchors to the right with a small gap');
    } else if (anchor.x - 10 - card.width >= 6) {
      assert.ok(Math.abs(card.x + card.width + 10 - anchor.x) <= 1, 'Item tooltip flips to the left near the right edge');
    }
    assert.ok(card.x + card.width <= anchor.x || card.x >= anchor.x + anchor.width
      || card.y + card.height <= anchor.y || card.y >= anchor.y + anchor.height, 'Tooltip must not cover its item');
    return tooltip.textContent();
  }
  try {
    await player.enter();
    await page.keyboard.press('KeyI');
    const item = page.locator('.inv-grid [data-item-id]').first();
    assert.equal(await page.locator('.inv-grid .inv-slot:not(.locked)').count(), 25);
    assert.equal(await page.locator('.inv-capacity').textContent(), '1 / 25');
    assert.equal(await page.locator('.inv-purse .currency').count(), 2);
    assert.ok((await page.locator('.inv-purse').boundingBox()).height <= 42, 'Desktop purse stays compact');
    assert.equal(await page.locator('.equip-art').count(), 9);
    assert.equal(await item.locator('b').count(), 0, 'Keep slot contents uncluttered');
    const expected = await inspect(item);
    const coinStyle = icon => icon.evaluate(svg => {
      const properties = ['fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'filter'];
      return [svg, ...svg.children].map(part => Object.fromEntries(properties.map(key => [key, getComputedStyle(part)[key]])));
    });
    assert.deepEqual(await coinStyle(tooltip.locator('.currency-icon-pelines')),
      await coinStyle(page.locator('.inv-purse .currency-icon-pelines')),
      'Tooltip and purse must use identical coin artwork styling');
    assert.equal(await inspect(page.locator('.inv-slot.equip.filled')), expected);
    const portrait = page.locator('.doll-portrait');
    const before = await portrait.evaluate(canvas => canvas.toDataURL());
    const stage = await page.locator('.doll-stage').boundingBox();
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width / 2 + 45, stage.y + stage.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(previous => document.querySelector('.doll-portrait').toDataURL() !== previous, before);
    await item.dragTo(page.locator('.ab-slot').first());
    assert.equal(used, 0, 'Dragging must not consume a potion');
    assert.equal(await inspect(page.locator('.ab-slot.filled')), expected);
    await item.click();
    await page.waitForFunction(() => document.querySelector('.inv-grid [data-item-id] i')?.textContent === '2');
    await tooltip.waitFor({ state: 'hidden' });
    assert.equal(used, 1);
    assert.equal(await page.locator('#hud-health-text').textContent(), '65 / 100');
    assert.equal(await page.locator('.ab-slot.filled i').textContent(), '2');
    await page.locator('.currency.pelines').hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.equal(await tooltip.evaluate(el => el.classList.contains('item-tooltip')), false, 'Generic tooltips keep their short format');
    assert.equal(await tooltip.locator('strong').textContent(), 'Pelines');
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-choice').filter({ hasText: 'Comerciar' }).click();
    const stock = page.locator('.vendor-col').first().locator('.vendor-row').first();
    const owned = page.locator('.vendor-col').nth(1).locator('.vendor-row');
    assert.equal(await inspect(stock), expected);
    assert.equal(await stock.locator('.vendor-price b').textContent(), '10', 'Buy price remains unchanged');
    assert.equal(await inspect(owned), expected);
    assert.equal(await owned.locator('.vendor-price b').textContent(), '5');
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('inventory and item tooltips fit narrow viewports, support focus and translate content', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  account.character.data.inventory = [{ id: 'pocion_vida_minuscula', count: 99 }];
  const player = await openPlayer(backend(), account);
  const page = player.page;
  try {
    await player.enter();
    await page.keyboard.press('KeyI');
    const item = page.locator('.inv-grid [data-item-id]');
    const tooltip = page.locator('#game-tooltip');
    for (const size of [{ width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(size);
      await item.scrollIntoViewIfNeeded();
      const layout = await page.locator('.inv').evaluate(el => ({
        width: el.clientWidth, content: el.scrollWidth,
        gridWidth: el.querySelector('.inv-grid').clientWidth, gridContent: el.querySelector('.inv-grid').scrollWidth,
        slots: [...el.querySelectorAll('.inv-grid .inv-slot:not(.locked)')].map(slot => slot.getBoundingClientRect().width),
      }));
      assert.ok(layout.content <= layout.width + 1, JSON.stringify({ size, layout }));
      assert.ok(layout.gridContent <= layout.gridWidth + 1, JSON.stringify({ size, layout }));
      assert.ok(layout.slots.every(width => width >= 30), JSON.stringify({ size, layout }));
      await page.mouse.move(0, 0);
      await item.evaluate(el => el.blur());
      await item.focus();
      await tooltip.waitFor({ state: 'visible' });
      const box = await tooltip.boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height, JSON.stringify({ size, box }));
      assert.equal(await item.getAttribute('aria-describedby'), 'game-tooltip');
    }
    await page.locator('[data-language="en"]').first().dispatchEvent('click');
    await tooltip.waitFor({ state: 'hidden' });
    await page.mouse.move(0, 0);
    await item.hover();
    await tooltip.waitFor({ state: 'visible' });
    assert.equal(await tooltip.locator('.item-tip-name').textContent(), 'Minuscule health potion');
    assert.equal(await tooltip.locator('.item-tip-category').textContent(), 'Consumable');
    assert.equal(await tooltip.locator('.item-tip-effects li').textContent(), 'Restores 5% of your maximum health.');
    assert.match(await tooltip.locator('.item-tip-description').textContent(), /little glass bottle/);
    assert.match(await tooltip.locator('.item-tip-sale').textContent(), /Sell value5 Pelines/);
    assert.doesNotMatch(await tooltip.textContent(), /Stackable|per unit/);
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    assert.equal(await item.getAttribute('aria-describedby'), null);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('party and zone chat use distinct colors across messages, tags, filters and channel selector', { timeout: 120000 }, async () => {
  const world = backend(), account = fixture('Alric', 'humano', 100);
  const player = await openPlayer(world, account);
  const page = player.page;
  try {
    await player.enter();
    await chatReady(world, account);
    for (const [index, channel] of ['zone', 'party'].entries()) {
      world.chatSockets.get(account.user.id)({
        id: index + 1, channel, zone: 'brumaluz', sender_user: account.user.id,
        sender_name: 'Alric', sender_account: 'Alric', sender_title: 'recien_llegado',
        created_at: new Date().toISOString(), body: `${channel} color check`,
      });
    }
    await page.locator('.chat-log .k-party').waitFor({ state: 'attached' });
    const colors = await page.evaluate(() => {
      const color = selector => getComputedStyle(document.querySelector(selector)).color;
      return {
        party: color('.chat-line.k-party'), partyTag: color('.chat-line.k-party .chat-tag'),
        zone: color('.chat-line.k-zone'), zoneTag: color('.chat-line.k-zone .chat-tag'),
        partyFilter: color('.chat-filter[data-kind="party"]'),
      };
    });
    assert.equal(colors.party, 'rgb(242, 183, 129)');
    assert.equal(colors.partyTag, colors.party);
    assert.equal(colors.partyFilter, colors.party);
    assert.equal(colors.zone, 'rgb(207, 234, 255)');
    assert.equal(colors.zoneTag, 'rgb(159, 216, 255)');
    await page.keyboard.press('Enter');
    await page.locator('.chat-channel').click();
    await page.waitForFunction(() => document.querySelector('.chat-channel').dataset.channel === 'zone');
    await page.locator('.chat-channel').click();
    assert.equal(await page.locator('.chat-channel').getAttribute('data-channel'), 'party');
    assert.equal(await page.locator('.chat-channel').evaluate(el => getComputedStyle(el).color), colors.party);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('NPC interactions stay out of chat while spontaneous nearby barks remain', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100), true, new Date(2026, 9, 18, 12));
  const page = player.page;
  try {
    await player.enter();
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.keyboard.press('KeyE');
    await page.locator('.dialog-choice').filter({ hasText: /^\s*1\.\s*Hola$/ }).click();
    await page.locator('.dialog-text').filter({ hasText: '¡Hola! Si estás leyendo esto' }).waitFor();
    const log = page.locator('.chat-log');
    assert.doesNotMatch(await log.textContent(), /¡Saludos, viajero!|¡Hola! Si estás leyendo esto|Hola/);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.clock.fastForward(84_000);
    assert.match(await log.textContent(), /¿Alguien ha visto mi documentación|Psst, viajero|Un día más depurando/);
    assert.match(await log.textContent(), /Testículos, the Debugger/);
    assert.doesNotMatch(await log.textContent(), /¡Saludos, viajero!|¡Hola! Si estás leyendo esto/);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('damage absorbed by overheal preserves full-health sentinel and only zero health kills', { timeout: 120000 }, async () => {
  const account = fixture('Alric', 'humano', 100);
  account.character.data.overheal = 25;
  const player = await openPlayer(backend(), account);
  const page = player.page;
  const results = [
    { health: -1, overheal: 15 },
    { health: -1, overheal: 0 },
    { health: 94, overheal: 0 },
    { health: 0, overheal: 0 },
  ];
  let calls = 0;
  await page.route('**/rest/v1/rpc/debug_damage', route => {
    Object.assign(account.character.data, results[calls++]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(account.character.data) });
  });
  try {
    await player.enter();
    await page.evaluate(() => {
      const p = window.brumaluz.city().npcSites[0].position;
      window.brumaluz.move(p.x, p.z + 0.6);
    });
    await page.keyboard.press('KeyE');
    const damage = page.locator('.dialog-choice').filter({ hasText: 'Recibir 10 puntos de daño' });
    await damage.waitFor({ state: 'visible' });
    for (let i = 0; i < results.length; i++) {
      await damage.click();
      await page.waitForFunction(expected => document.querySelector('#hud-health-text').textContent.startsWith(expected), `${results[i].health < 0 ? 100 : results[i].health} / 100`);
      assert.equal(await page.locator('#death-screen').isVisible(), i === 3, `Damage result ${i} must only kill at zero health`);
      assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dead')), i === 3);
    }
    assert.equal(calls, 4);
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('character cards keep portraits inside the inner frame and borders stable on hover', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100));
  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await player.page.setViewportSize(viewport);
      const card = player.page.locator('.character-card').first();
      const before = await card.boundingBox();
      await card.hover();
      await player.page.waitForTimeout(250);
      assert.deepEqual(await card.boundingBox(), before, 'Hover must not lift the card into the scroll clip');
      const result = await card.evaluate((element) => {
        const card = element.getBoundingClientRect();
        const portrait = element.querySelector('.character-portrait').getBoundingClientRect();
        const info = element.querySelector('.character-info');
        const list = element.parentElement.getBoundingClientRect();
        return {
          left: portrait.left - card.left, top: portrait.top - card.top,
          bottom: card.bottom - portrait.bottom,
          clipped: card.top < list.top || card.bottom > list.bottom,
          overflow: getComputedStyle(info).overflow,
          radius: getComputedStyle(info).borderRadius,
          border: getComputedStyle(element, '::after').borderTopWidth,
        };
      });
      assert.ok(result.left >= 6 && result.top >= 6 && result.bottom >= 6, JSON.stringify(result));
      assert.equal(result.clipped, false);
      assert.equal(result.overflow, 'hidden');
      assert.equal(result.radius, '9px');
      assert.equal(result.border, '1px');
    }
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('menu music produces sound, persists its toggle and stops outside account screens', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100));
  const page = player.page;
  const sample = () => page.evaluate(async () => {
    const context = window.__audioContexts[0];
    const analyser = context.createAnalyser();
    context.testMaster.connect(analyser);
    await new Promise(resolve => setTimeout(resolve, 180));
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    context.testMaster.disconnect(analyser);
    return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
  });
  try {
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 0, 'Do not autoplay before interaction');
    const music = page.locator('#menu-music');
    await music.click();
    await page.waitForTimeout(1200);
    assert.ok(await sample() > 0.0001, 'Music must produce actual audio');
    assert.equal(await music.getAttribute('aria-pressed'), 'true');
    const graphics = await page.locator('#graphics-mode').boundingBox(), button = await music.boundingBox();
    assert.ok(button.x + button.width <= graphics.x && Math.abs(button.y - graphics.y) < 2);
    await page.locator('[data-language="en"]').first().click();
    assert.equal(await music.textContent(), 'Music: on');
    await page.locator('[data-language="es"]').first().click();
    await music.click();
    assert.equal(await sample(), 0, 'Mute must produce exact silence');
    await page.evaluate(() => window.__audioContexts[0].suspend());
    await music.click();
    await music.click();
    await music.click();
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Rapid toggles must restore music once');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await sample(), 0, 'Hidden tabs must stop music');
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Visible tabs must restore music');
    await page.locator('#new-character').click();
    assert.equal(await sample(), 0, 'Creator must stop menu music');
    await page.locator('#account-characters').click();
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Returning to selection must restore music');
    await player.enter();
    assert.equal(await sample(), 0, 'World must stop menu music');
    await page.keyboard.press('KeyO');
    await page.locator('[data-tab="sound"]').click();
    await page.locator('#opt-master-volume').fill('0');
    await page.keyboard.press('Escape');
    await leave(page);
    await page.waitForTimeout(1000);
    assert.ok(await sample() < 0.0001, 'Menu music must respect master volume');
    await music.click();
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('brumaluz-settings'));
      localStorage.setItem('brumaluz-settings', JSON.stringify({ ...settings, masterVolume: 80 }));
    });
    await page.reload();
    await music.waitFor({ state: 'visible' });
    assert.equal(await music.getAttribute('aria-pressed'), 'false', 'Mute preference must survive reload');
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 0);
    await page.locator('#sign-out').click();
    await page.locator('#auth-form').waitFor({ state: 'visible' });
    assert.equal(await music.isVisible(), true, 'Music toggle must also exist on login');
    await music.click();
    await page.waitForTimeout(1000);
    assert.ok(await sample() > 0.0001, 'Login must play the same music');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('menu music follows local day/night boundaries without enabling muted music', { timeout: 120000 }, async () => {
  const player = await openPlayer(backend(), fixture('Alric', 'humano', 100), true, new Date(2026, 9, 18, 5, 59, 30));
  const page = player.page;
  try {
    await page.evaluate(() => {
      window.__menuNotes = [];
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        const oscillator = original.call(this);
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when) => {
          window.__menuNotes.push({ pitch: Math.round(69 + 12 * Math.log2(oscillator.frequency.value / 440)), when });
          start(when);
        };
        return oscillator;
      };
    });
    await page.locator('#new-character').click();
    await page.locator('#account-characters').click();
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('daytime')), false);
    await page.locator('#menu-music').click();
    await page.waitForFunction(() => window.__menuNotes.length >= 12);
    const night = await page.evaluate(() => window.__menuNotes.slice(0, 12).map(note => note.pitch));
    assert.deepEqual(night, [48, 55, 60, 64, 72, 60, 76, 67, 79, 72, 76, 76], 'Original night arrangement must stay unchanged');

    await page.evaluate(() => { window.__menuNotes = []; });
    await page.clock.fastForward(60_000);
    await page.waitForFunction(() => document.body.classList.contains('daytime') && window.__menuNotes.some(note => note.pitch === 81));
    const day = await page.evaluate(() => window.__menuNotes.slice(-22));
    assert.equal(day.length, 22, 'Day arrangement has a livelier melody, accompaniment and bass');
    assert.deepEqual(day.slice(4, 10).map(note => note.pitch), [76, 60, 79, 67, 81, 72]);
    assert.ok(Math.abs(day[6].when - day[4].when - 0.34) < 0.001, 'Day melody must have a faster pulse');
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 1, 'Changing tracks must reuse the audio context');

    await page.evaluate(() => { window.__menuNotes = []; });
    await page.clock.fastForward(12 * 60 * 60 * 1000);
    await page.waitForFunction(() => !document.body.classList.contains('daytime') && window.__menuNotes.length >= 12);
    assert.deepEqual(await page.evaluate(() => window.__menuNotes.slice(-12).map(note => note.pitch)), night);
    await page.locator('#menu-music').click();
    await page.evaluate(() => { window.__menuNotes = []; });
    await page.clock.fastForward(12 * 60 * 60 * 1000);
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('daytime')), true);
    assert.equal(await page.locator('#menu-music').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => window.__menuNotes.length), 0, 'Time changes must preserve mute');
    assert.deepEqual(player.errors, []);
  } finally { await player.context.close(); }
});

test('ambient sound switch changes actual output and respects volume and repeated toggles', {timeout:120000}, async()=>{
  const world=backend(), a=fixture('Alric','humano',100), player=await openPlayer(world,a);
  try {
    await player.enter();
    await player.page.keyboard.press('KeyO');
    await player.page.locator('[data-tab="sound"]').click();
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForFunction(()=>document.querySelector('#opt-ambient').getAttribute('aria-checked')==='true');
    await player.page.waitForFunction(()=>window.__audioContexts.some(context=>context.state==='running'));
    const sample=()=>player.page.evaluate(async()=>{
      const context=window.__audioContexts[0];
      const analyser=context.createAnalyser();
      context.testMaster.connect(analyser);
      await new Promise(resolve=>setTimeout(resolve,150));
      const data=new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      context.testMaster.disconnect(analyser);
      return Math.sqrt(data.reduce((sum,value)=>sum+value*value,0)/data.length);
    });
    await player.page.waitForTimeout(1800);
    const enabled=await sample();
    assert.ok(enabled>0.0001,`Enabled ambient must produce sound, got RMS ${enabled}`);
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForTimeout(150);
    const disabled=await sample();
    assert.equal(disabled,0,'Disabled ambient must be exactly silent, not merely quieter');
    assert.equal(await player.page.evaluate(()=>window.__audioContexts[0].testMaster.gain.value),0);
    await player.page.locator('#opt-master-volume').fill('100');
    assert.equal(await sample(),0,'Changing volume must not reactivate disabled ambience');
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForTimeout(1800);
    assert.ok(await sample()>0.0001);
    await player.page.evaluate(()=>window.__audioContexts[0].suspend());
    await player.page.locator('#opt-ambient').click();
    await player.page.locator('#opt-ambient').click();
    await player.page.waitForFunction(()=>window.__audioContexts[0].state==='running');
    await player.page.waitForTimeout(800);
    assert.ok(await sample()>0.0001,'Toggle must restore suspended browser audio');
    await player.page.locator('#opt-master-volume').fill('0');
    await player.page.waitForTimeout(800);
    assert.ok(await sample()<0.0001,'Master volume must mute ambient output');
    await player.page.locator('#opt-master-volume').fill('80');
    await player.page.waitForTimeout(800);
    assert.ok(await sample()>0.0001,'Master volume must restore ambient output');
    assert.equal(await player.page.locator('#opt-ambient').getAttribute('aria-checked'),'true');
    assert.deepEqual(player.errors,[]);
  } finally {await player.context.close();}
});

test('players trade through the actual interaction menu, offer quantities privately and commit both HUD inventories', {timeout:180000},async()=>{
  const world=backend(),a=fixture('Alric','humano',100),b=fixture('Elara','elfo',101);
  a.character.data.inventory=[{id:'pan_duro',count:10},{id:'pocion_vida_minuscula',count:3,bound:true}];
  b.character.data.inventory=[{id:'pocion_mana_minuscula',count:8}];
  a.character.data.wallet={pelines:100,premium:777};b.character.data.wallet={pelines:100,premium:888};
  const first=await openPlayer(world,a),second=await openPlayer(world,b);
  try {
    await first.enter();await second.enter();
    await nearbyInteractions(first.page,'Elara');
    await first.page.getByRole('button',{name:'Invitar a intercambiar',exact:true}).click();
    await second.page.getByRole('dialog',{name:'Invitación de intercambio',exact:true}).waitFor();
    await second.page.getByText('¿Quieres intercambiar objetos y pelines con Alric?',{exact:true}).waitFor();
    await second.page.getByRole('button',{name:'Rechazar',exact:true}).waitFor();
    await second.page.getByRole('button',{name:'Aceptar',exact:true}).click();
    await first.page.getByText('Tu mochila',{exact:true}).waitFor();
    assert.equal(await first.page.locator('.trade-item').count(),1);
    assert.equal(await first.page.locator('.trade-peer-offer .trade-offer-item').count(),0);
    for(let i=0;i<4;i++) await first.page.getByRole('button',{name:'Añadir: Ofrecer Pan duro (1)',exact:true}).click();
    await first.page.getByLabel('Pelines ofrecidos',{exact:true}).fill('30');
    await first.page.getByRole('button',{name:'Ofertar',exact:true}).click();
    await second.page.locator('.trade-peer-offer').getByText('Pan duro ×4',{exact:true}).waitFor();
    for(let i=0;i<3;i++) await second.page.getByRole('button',{name:'Añadir: Ofrecer Poción de maná minúscula (1)',exact:true}).click();
    await second.page.getByRole('button',{name:'Ofertar',exact:true}).click();
    await first.page.locator('.trade-peer-offer').getByText('Poción de maná minúscula ×3',{exact:true}).waitFor();
    for(const width of [1280,390,320]) {
      await first.page.setViewportSize({width,height:844});
      assert.equal(await first.page.locator('.trade-window').evaluate(el=>el.scrollWidth<=el.clientWidth),true,`Trade fits ${width}px`);
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await first.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`trade-${width}.png`)});
    }
    await first.page.getByRole('button',{name:'Aceptar intercambio',exact:true}).click();
    await second.page.locator('.trade-peer-offer.accepted').getByText('Intercambio aceptado',{exact:true}).waitFor();
    if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await second.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'trade-accepted-1280.png')});
    await first.page.getByRole('button',{name:'Cancelar oferta',exact:true}).click();
    await first.page.locator('[data-own-state]').getByText('Sin oferta',{exact:true}).waitFor();
    await second.page.locator('.trade-peer-offer .trade-empty').waitFor();
    for(let i=0;i<4;i++) await first.page.getByRole('button',{name:'Añadir: Ofrecer Pan duro (1)',exact:true}).click();
    await first.page.getByLabel('Pelines ofrecidos',{exact:true}).fill('30');
    await first.page.getByRole('button',{name:'Ofertar',exact:true}).click();
    await second.page.locator('.trade-peer-offer').getByText('Pan duro ×4',{exact:true}).waitFor();
    await first.page.getByRole('button',{name:'Aceptar intercambio',exact:true}).click();
    await second.page.getByRole('button',{name:'Aceptar intercambio',exact:true}).click();
    await first.page.getByText('¡Intercambio completado!',{exact:true}).waitFor();
    await second.page.getByText('¡Intercambio completado!',{exact:true}).waitFor();
    assert.equal(a.character.data.wallet.pelines,70);assert.equal(b.character.data.wallet.pelines,130);
    assert.equal(a.character.data.wallet.premium,777);assert.equal(b.character.data.wallet.premium,888);
    await first.page.setViewportSize({width:1280,height:844});
    await first.page.getByRole('button',{name:'Cerrar',exact:true}).click();
    await first.page.keyboard.press('KeyI');
    await first.page.locator('[data-item-id="pocion_mana_minuscula"]').first().waitFor();
    await first.page.locator('#window-close').click();
    await nearbyInteractions(first.page,'Elara');
    await first.page.getByRole('button',{name:'Invitar a intercambiar',exact:true}).click();
    await second.page.getByRole('button',{name:'Aceptar',exact:true}).click();
    await first.page.getByText('Tu mochila',{exact:true}).waitFor();
    await first.page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await first.page.locator('.trade-backdrop').waitFor({state:'hidden'});
    await second.page.locator('.trade-backdrop').waitFor({state:'hidden'});
    assert.deepEqual([...first.errors,...second.errors],[]);
  } finally {await first.context.close();await second.context.close();}
});

// Servidor simulado (Supabase y el mundo compartido) para las pruebas del mundo: una página por jugador.
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { test } from 'node:test';
import { url, project, browser, partyOf, cleanupParties, partyMember } from './harness.mjs';

export async function openPlayer(world, account, compatible = true, clockTime) {
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
    if(fn==='bank_action'){
      world.banks??=new Map();
      const bank=world.banks.get(key)??{items:Array(50).fill(null),pelines:0,size:50};
      world.banks.set(key,bank);
      world.bankCalls?.push({action:args.p_action,slot:args.p_slot,amount:args.p_amount,target:args.p_target??null});
      const inv=Array.from({length:25},(_,i)=>character.data.inventory?.[i]??null);
      const wallet={...(character.data.wallet??{pelines:0})};
      const into=(slots,item)=>{
        const out=slots.map(slot=>slot&&{...slot});let left=item.count;
        for(const slot of out)if(left>0&&slot&&slot.id===item.id&&!!slot.bound===!!item.bound&&slot.count<50){const room=Math.min(50-slot.count,left);slot.count+=room;left-=room;}
        for(let i=0;i<out.length&&left>0;i++)if(!out[i]){const room=Math.min(50,left);out[i]={id:item.id,count:room,bound:!!item.bound};left-=room;}
        return left>0?null:out;
      };
      const same=(a,b)=>a&&b&&a.id===b.id&&a.count===b.count&&!!a.bound===!!b.bound;
      // Como game_place_item: hueco libre, montón igual (lo que sobra vuelve) u otro objeto (se intercambian).
      const placeAt=(slots,index,item)=>{
        const target=slots[index];
        if(!target){slots[index]={...item};return null;}
        if(target.id===item.id&&!!target.bound===!!item.bound){
          const moved=Math.min(50-target.count,item.count);slots[index]={...target,count:target.count+moved};
          return item.count>moved?{...item,count:item.count-moved}:null;
        }
        slots[index]={...item};return target;
      };
      const target=args.p_target??null;
      if(args.p_action==='deposit'){
        const item=inv[args.p_slot];
        if(!same(item,args.p_expected))return fulfill({message:'INVENTORY_CHANGED'},400);
        if(item.bound)return fulfill({message:'BANK_ITEM_BOUND'},400);
        if(target===null){
          const next=into(bank.items,item);if(!next)return fulfill({message:'BANK_FULL'},400);
          bank.items=next;inv[args.p_slot]=null;
        }else inv[args.p_slot]=placeAt(bank.items,target,item);
      }else if(args.p_action==='withdraw'){
        const item=bank.items[args.p_slot];
        if(!same(item,args.p_expected))return fulfill({message:'BANK_CHANGED'},400);
        if(target===null){
          const next=into(inv,item);if(!next)return fulfill({message:'INVENTORY_FULL'},400);
          next.forEach((slot,i)=>{inv[i]=slot;});bank.items[args.p_slot]=null;
        }else{
          if(inv[target]?.bound)return fulfill({message:'BANK_ITEM_BOUND'},400);
          bank.items[args.p_slot]=placeAt(inv,target,item);
        }
      }else if(args.p_action==='move'){
        const item=bank.items[args.p_slot];
        if(!same(item,args.p_expected)||target===null||target===args.p_slot)return fulfill({message:'BANK_CHANGED'},400);
        bank.items[args.p_slot]=null;bank.items[args.p_slot]=placeAt(bank.items,target,item);
      }else if(args.p_action==='deposit_pelines'){
        if(wallet.pelines<args.p_amount)return fulfill({message:'NOT_ENOUGH_MONEY'},400);
        wallet.pelines-=args.p_amount;bank.pelines+=args.p_amount;
      }else if(args.p_action==='withdraw_pelines'){
        if(bank.pelines<args.p_amount)return fulfill({message:'BANK_NOT_ENOUGH_MONEY'},400);
        wallet.pelines+=args.p_amount;bank.pelines-=args.p_amount;
      }
      Object.assign(character.data,{inventory:inv,wallet});
      return fulfill({...character.data,bank});
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
    if(fn==='collect_fairy_dust'){
      const taken=character.data.fairyDust??[];
      if(!['plaza_fuente','arco_entrada'].includes(args.p_dust_id))return fulfill({message:'FAIRY_DUST_INVALID'},400);
      if(taken.includes(args.p_dust_id))return fulfill({message:'FAIRY_DUST_TAKEN'},400);
      const amount=1+Math.floor(Math.random()*5);
      let inv=character.data.inventory??[];
      for(let i=0;i<amount;i++){
        const slot=inv.findIndex(s=>s&&s.id==='polvo_de_hada'&&s.count<50);
        if(slot>=0){inv[slot].count++;}
        else{
          const free=inv.findIndex((s,idx)=>!s&&idx<25);
          if(free<0)return fulfill({message:'INVENTORY_FULL'},400);
          inv[free]={id:'polvo_de_hada',count:1,bound:true};
        }
      }
      character.data.inventory=inv;
      character.data.fairyDust=[...taken,args.p_dust_id];
      return fulfill(character.data);
    }
    if(fn==='shadow_action'){
      if(world.fail.has('shadow'))return fulfill({message:'Temporary quest failure'},503);
      const q=character.data.shadowQuest,location=character.data.location??'brumaluz';
      const pos=world.players.get(key)?.position??character.data.position,body=character.data.combatEncounter;
      if(location!==(args.p_action==='report'?'brumaluz':'casa_de_isberto_interior'))return fulfill({message:'SHADOW_TOO_FAR'},400);
      if(args.p_action==='report'&&!body?.looted)return fulfill({message:'SHADOW_LOOT_REQUIRED'},400);
      if(args.p_action==='report'&&Math.hypot(pos.x-body.x,pos.z-body.z)>8)return fulfill({message:'SHADOW_TOO_FAR'},400);
      if(args.p_action==='return'&&Math.hypot(pos.x-.9,pos.z-.55)>4)return fulfill({message:'SHADOW_TOO_FAR'},400);
      if(args.p_action==='report'&&q==='defeated')character.data.shadowQuest='returning';
      else if(args.p_action==='return'&&q==='returning')character.data.shadowQuest='returned';
      else return fulfill({message:'SHADOW_INVALID_STATE'},400);
      return fulfill(character.data);
    }
    if(fn==='rest_action'){
      const pos=world.players.get(key)?.position??character.data.position;
      if(character.data.location!=='casa_de_isberto_interior'||!['returning','returned'].includes(character.data.shadowQuest))return fulfill({message:'REST_UNAVAILABLE'},400);
      if(Math.hypot(pos.x+1.5,pos.z+2.5)>2.2)return fulfill({message:'REST_TOO_FAR'},400);
      world.rests=(world.rests??0)+1;
      Object.assign(character.data,{health:-1,resource:-1});
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
      if(args.p_action==='arrive'&&q.stage==='available'&&q.origin===null){
        character.data.introSeen=true;
        character.data.position={x:156.5,z:0,yaw:Math.PI/2};
        Object.assign(world.players.get(key),{position:{...character.data.position}});
      }
      else if(args.p_action==='origin'&&q.stage==='available'&&q.origin===null){q.origin=args.p_origin;character.data.introSeen=true;}
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
      ...(world.combatSimulationEnabled?{vitals:player.vitals}:{}),
      ...(player.encounter!==undefined?{encounter:player.encounter}:{}),
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

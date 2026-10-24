import rawCatalog from './generated/rpg-catalog.json';
import type { CharData } from './data';
import type { ItemStack } from './inventory';

export interface Recipe { id:string; label:string; job:string; tier:number; output:string; count:number; seconds:number; ingredients:Record<string,number>; source:string }
export interface ProfessionSite { id:string; label:string; job:string; location:string; x:number; z:number; radius?:number; tier?:number; item?:string; seconds?:number; respawn?:number }
export interface ExtraItem { id:string; label:string; category:string; description:string; tier:number; rarity:string; value:number; stack:number; icon:string; tool?:string; enchant?:string; recipe?:string; furniture?:string }
export const RPG_CATALOG = rawCatalog as unknown as { camp:ProfessionSite; professions:Record<string,string>; ranks:string[]; items:Record<string,ExtraItem>; recipes:Record<string,Recipe>; nodes:Record<string,ProfessionSite>; stations:Record<string,ProfessionSite>; sets:Record<string, {id:string;name:string;family:number;tier:number;slot:string;cls:string}>; equipment:Record<string, {tier:number;slot:string;cls?:string}> };
export const ENCHANT_LABELS: Record<string,string> = {fire:'Fuego',vampirism:'Vampirismo',frost:'Escarcha',lightning:'Rayo',dark:'Maldición umbría'};
export const ENCHANT_VALUES = {fire:[0,.05,.06,.07,.08,.09],vampirism:[0,.02,.03,.04,.05,.06],frost:[0,.20,.25,.30,.35,.40],lightning:[0,.40,.50,.60,.70,.80],dark:[0,.20,.25,.30,.35,.40]};
export function enchantmentDescription(id:keyof typeof ENCHANT_VALUES,grade:number){
 const percent=Math.round(ENCHANT_VALUES[id][Math.max(1,Math.min(5,grade))]*100);
 return id==='fire'?`Cada ataque básico añade un ${percent} % de su daño como fuego, antes de la defensa. No causa quemadura.`
  :id==='vampirism'?`Los ataques básicos curan un ${percent} % de la vida realmente retirada. No cuenta daño sobrante, habilidades ni efectos secundarios.`
  :id==='frost'?`Cada 3 básicos crean una barrera del ${percent} % de un básico durante 4 s. No se acumula: conserva la mayor barrera restante.`
  :id==='lightning'?`Cada 4 básicos descargan un ${percent} % del daño básico sobre otro enemigo a 4 m, respetando su Guardia y los obstáculos. Si no hay objetivo, conserva una descarga.`
  :`Cada 3 básicos al mismo enemigo infligen un ${percent} % de daño oscuro adicional, sujeto a Guardia. Sus marcas duran 6 s.`;
}
export const RANK_XP = [0,100,500,1500,4000,10000];
export interface CraftJob {id:string;recipe:string;job:string;start:number;end:number;done:boolean;ingredients:Record<string,number>;output:ItemStack;xp:number}
export interface RpgState {
  version:1; revision?:number; energy:number; at:number; xp:Record<string,number>; mastery:Record<string,number>;
  learned:string[]; tools:Record<string,ItemStack|null>; jobs:CraftJob[]; deliveries:ItemStack[];
  nodes:Record<string,number>; gathering:{node:string;start:number;x:number;z:number}|null;
  crafts:Record<string,number>; projects:Record<string,number>; furniture:{id:string;item:ItemStack;location:string;x:number;z:number;yaw:number;job?:string}[];
}
export function professionState(value:unknown, now=Date.now()/1000):RpgState {
  const source=value&&typeof value==='object'?value as Partial<RpgState>:{};
  return {version:1,revision:source.revision??0,energy:Math.min(100,Math.max(0,Number.isFinite(source.energy)?source.energy!:100)),at:Number.isFinite(source.at)?source.at!:now,xp:source.xp??{},mastery:source.mastery??{},learned:source.learned??[],tools:source.tools??{},jobs:source.jobs??[],deliveries:source.deliveries??[],nodes:source.nodes??{},gathering:source.gathering??null,crafts:source.crafts??{},projects:source.projects??{},furniture:source.furniture??[]};
}
export function professionRank(state:RpgState, job:string) {
  const earned=RANK_XP.filter(x=>(state.xp[job]??0)>=x).length-1;
  return Math.min(earned,2+(state.mastery[job]??0));
}
export const gatherEnergy = (rank:number,tier:number) => [1,2.5,8,25,70,120][Math.max(0,Math.min(5,tier-rank))];
export const professionExperience = (rank:number,tier:number) => tier<rank-1?0:tier<rank?4:10+Math.min(10,Math.max(0,tier-rank)*3);
export const craftingExperience = (rank:number,tier:number) => professionExperience(rank,tier)*3**tier;
export function reconcileProfessions(state:RpgState,now=Date.now()/1000) {
  state.energy=Math.min(100,state.energy+Math.max(0,now-state.at)*100/(276*60));state.at=now;
  for(const task of [...state.jobs].sort((a,b)=>a.end-b.end))if(!task.done&&task.end<=now){task.done=true;const recipe=RPG_CATALOG.recipes[task.recipe];state.xp[task.job]=(state.xp[task.job]??0)+craftingExperience(professionRank(state,task.job),recipe?.tier??0);state.crafts[task.job]=(state.crafts[task.job]??0)+1;}
  for(const [id,at]of Object.entries(state.nodes))if(at<=now)delete state.nodes[id];
}
function meta(id:string){return RPG_CATALOG.items[id]??{stack:RPG_CATALOG.equipment[id]?1:50};}
export function giveStack(d:CharData,stack:ItemStack):boolean {
  const slots=d.inventory.map(x=>x?{...x}:null);let remaining=stack.count;
  if(!stack.instanceId)for(const item of slots)if(item&&item.id===stack.id&&!item.instanceId&&!!item.bound===!!stack.bound){const n=Math.min(remaining,Math.max(0,meta(stack.id).stack-item.count));item.count+=n;remaining-=n;}
  for(let i=0;i<slots.length&&remaining>0;i++)if(!slots[i]){const n=Math.min(remaining,stack.instanceId?1:meta(stack.id).stack);slots[i]={...stack,count:n};remaining-=n;}
  if(remaining)return false;d.inventory=slots;return true;
}
export function newRpgItem(id:string,count=1):ItemStack {
  const item=RPG_CATALOG.items[id];
  return {id,count,...(item?.stack===1||RPG_CATALOG.equipment[id]?{instanceId:crypto.randomUUID()}:{}),...(item?.tool?{durability:100,maxDurability:100,originalDurability:100}: {})};
}
function consume(d:CharData,id:string,count:number){
  if(d.inventory.reduce((n,s)=>n+(s?.id===id?s.count:0),0)<count)throw new Error(`Faltan materiales: ${RPG_CATALOG.items[id]?.label??id}`);
  for(let i=0;i<d.inventory.length&&count>0;i++){const s=d.inventory[i];if(s?.id!==id)continue;const n=Math.min(count,s.count);s.count-=n;count-=n;if(!s.count)d.inventory[i]=null;}
}
function siteRequired(d:CharData,job:string){const s=Object.values(RPG_CATALOG.stations).find(s=>(s.job===job||['minero','lenador','recolector'].includes(job)&&s.job==='herreria')&&s.location===d.location&&d.position&&Math.hypot(s.x-d.position.x,s.z-d.position.z)<=s.radius!);if(!s&&!d.rpg?.furniture.some(f=>(f as unknown as {job?:string}).job===job&&f.location===d.location&&d.position&&Math.hypot(f.x-d.position.x,f.z-d.position.z)<=4))throw new Error('Acércate a una estación de este oficio.');}
function pay(d:CharData,currency:'pelines'|'lagrimas',amount:number){if(d.wallet[currency]<amount)throw new Error('No tienes suficiente moneda.');d.wallet[currency]-=amount;}

/** Development resolver. Online actions are always validated and executed by the SQL RPC. */
export function professionAction(data:CharData,action:string,args:Record<string,unknown>={},now=Date.now()/1000) {
 const d=structuredClone(data), s=professionState(d.rpg,now);d.rpg=s;reconcileProfessions(s,now);
 const id=String(args.id??''), job=String(args.job??''), slot=Number(args.slot),rank=professionRank(s,job);
 if(action==='state'){Object.assign(data,d);return;}
 if(d.health===0)throw new Error('Debes estar vivo para realizar esta acción.');
 if(action==='learn'){
  const r=RPG_CATALOG.recipes[id];if(!r||professionRank(s,r.job)<r.tier)throw new Error('No tienes el dominio necesario.');siteRequired(d,r.job);
  if(s.learned.includes(id))throw new Error('Ya conoces esta receta.');
  if(r.tier>0)consume(d,`receta_${id}`,1);else pay(d,'pelines',2);
  s.learned.push(id);
 }else if(action==='craft'){
  const r=RPG_CATALOG.recipes[id];if(!r||!s.learned.includes(id)||professionRank(s,r.job)<r.tier)throw new Error('Debes aprender la receta y dominar su rango.');siteRequired(d,r.job);
  const count=Math.max(1,Math.min(99,Math.floor(Number(args.count)||1)));
  if(r.seconds>0&&s.jobs.filter(j=>!j.done&&j.job===r.job).length+count>5)throw new Error('Máximo cinco trabajos por oficio.');
  for(const[item,n]of Object.entries(r.ingredients))consume(d,item,n*count);
  for(let n=0;n<count;n++){
   const xp=craftingExperience(professionRank(s,r.job),r.tier), output=newRpgItem(r.output,r.count);
   if(!r.seconds){if(d.race==='elfo'&&r.job==='alquimia'&&r.output.startsWith('pocion_')&&Math.random()<.25)output.count++;if(!giveStack(d,output))throw new Error('Tu mochila está llena.');s.xp[r.job]=(s.xp[r.job]??0)+xp;s.crafts[r.job]=(s.crafts[r.job]??0)+1;}
   else {const start=Math.max(now,...s.jobs.filter(j=>j.job===r.job&&!j.done).map(j=>j.end));s.jobs.push({id:crypto.randomUUID(),recipe:id,job:r.job,start,end:start+r.seconds*(d.race==='humano'?.85:1),done:false,ingredients:{...r.ingredients},output,xp});}
  }
 }else if(action==='cancel'||action==='collect'||action==='reorder'){
  const task=s.jobs.find(j=>j.id===id);if(!task)throw new Error('Ese trabajo ya no está disponible.');siteRequired(d,task.job);
  if(action==='collect'){if(!task.done)throw new Error('El trabajo no ha terminado.');if(!giveStack(d,task.output))throw new Error('Tu mochila está llena.');s.jobs=s.jobs.filter(j=>j.id!==id);}
  else if(action==='cancel'){if(task.done)throw new Error('El trabajo ya ha terminado.');for(const[item,n]of Object.entries(task.ingredients))s.deliveries.push(newRpgItem(item,n));s.jobs=s.jobs.filter(j=>j.id!==id);let cursor=now;for(const j of s.jobs.filter(j=>j.job===task.job&&!j.done)){const duration=j.end-j.start;if(j.start>now){j.start=cursor;j.end=cursor+duration;}cursor=j.end;}}
  else {if(task.done||task.start<=now)throw new Error('Solo puedes reordenar trabajos pendientes.');const active=s.jobs.find(j=>j.job===task.job&&!j.done&&j.start<=now);const pending=s.jobs.filter(j=>j.job===task.job&&!j.done&&j.start>now);pending.splice(pending.indexOf(task),1);pending.unshift(task);let cursor=active?.end??now;for(const j of pending){const duration=j.end-j.start;j.start=cursor;j.end=cursor+duration;}s.jobs=[...s.jobs.filter(j=>!pending.includes(j)),...pending];}
 }else if(action==='delivery'){
  const index=Number(args.slot),item=s.deliveries[index];if(!item||!giveStack(d,item))throw new Error('No hay espacio o el envío ya se ha recogido.');s.deliveries.splice(index,1);
 }else if(action==='tool'){
  const item=d.inventory[slot],def=item&&RPG_CATALOG.items[item.id];if(!item||!def?.tool)throw new Error('Selecciona una herramienta.');
  d.inventory[slot]=s.tools[def.tool]??null;s.tools[def.tool]={...item,instanceId:item.instanceId??crypto.randomUUID(),durability:item.durability??100,maxDurability:item.maxDurability??100,originalDurability:item.originalDurability??100};
 }else if(action==='buy_tool'){
  siteRequired(d,'herreria');if(!['minero','lenador','recolector'].includes(job))throw new Error('Herramienta no válida.');pay(d,'pelines',20);if(!giveStack(d,newRpgItem(`herramienta_${job}_0`)))throw new Error('Tu mochila está llena.');
 }else if(action==='gather_start'||action==='gather_finish'||action==='gather_cancel'){
  if(action==='gather_cancel')s.gathering=null;
  else {const node=RPG_CATALOG.nodes[id];if(!node||node.location!==d.location||!d.position||Math.hypot(node.x-d.position.x,node.z-d.position.z)>3)throw new Error('Acércate al recurso.');
   const tool=s.tools[node.job],tier=tool?RPG_CATALOG.items[tool.id]?.tier??0:0, r=professionRank(s,node.job),cost=gatherEnergy(r,node.tier!);
   if(!tool||!tool.durability)throw new Error('Equipa o repara la herramienta de este oficio.');if(s.energy<cost)throw new Error('No tienes suficiente energía.');if((s.nodes[id]??0)>now)throw new Error('Este recurso aún se está recuperando.');
   if(action==='gather_start')s.gathering={node:id,start:now,x:d.position.x,z:d.position.z};
   else {if(!s.gathering||s.gathering.node!==id||now-s.gathering.start<node.seconds!||Math.hypot(d.position.x-s.gathering.x,d.position.z-s.gathering.z)>.5)throw new Error('La extracción se ha interrumpido.');if(!giveStack(d,newRpgItem(node.item!)))throw new Error('Tu mochila está llena.');
    s.energy-=cost;tool.durability=Math.max(0,tool.durability-.25*(1+Math.max(0,node.tier!-r)*.5)*(1-r*.03)*(1-tier*.04));s.nodes[id]=now+node.respawn!;s.xp[node.job]=(s.xp[node.job]??0)+professionExperience(r,node.tier!);s.crafts[node.job]=(s.crafts[node.job]??0)+1;s.gathering=null;
   }
  }
 }else if(action==='repair'||action==='restore'||action==='restore_item'){
  siteRequired(d,'herreria');const tool=s.tools[job];if(!tool)throw new Error('No tienes herramienta equipada.');const original=tool.originalDurability??100,max=tool.maxDurability??100,current=tool.durability??max,tier=RPG_CATALOG.items[tool.id]?.tier??0;
  if(action==='repair'){const fraction=(max-current)/max;if(fraction<=0)throw new Error('La herramienta ya está reparada.');const next=max-original*.05*(1-rank*.03)*(1-tier*.04)*fraction;if(next<original*.2-1e-8)throw new Error('Esta herramienta necesita una restauración completa.');pay(d,'pelines',Math.ceil((10+10*tier)*fraction));tool.maxDurability=next;tool.durability=next;}
  else {if(max===original&&current===original)throw new Error('La herramienta no necesita restauración.');if(action==='restore')pay(d,'lagrimas',5+tier*2);else consume(d,'nucleo_restauracion',1);tool.maxDurability=original;tool.durability=original;}
 }else if(action==='energy'){
  if(s.energy>=100)throw new Error('La energía está llena.');pay(d,'lagrimas',5);s.energy=100;
 }else if(action==='enchant'){
  const scroll=d.inventory[slot],def=scroll&&RPG_CATALOG.items[scroll.id],weapon=args.target!==undefined?d.inventory[Number(args.target)]:d.equipment.weapon;
  if(!def?.enchant||!weapon||!RPG_CATALOG.equipment[weapon.id]||RPG_CATALOG.equipment[weapon.id].tier<def.tier)throw new Error('El pergamino requiere un arma principal de calidad igual o superior.');
  weapon.enchantment={id:def.enchant as NonNullable<ItemStack['enchantment']>['id'],grade:def.tier};weapon.instanceId??=crypto.randomUUID();consume(d,scroll!.id,1);if(args.target===undefined)d.enchantState=undefined;
 }else if(action==='place'){
  const item=d.inventory[slot],def=item&&RPG_CATALOG.items[item.id];if(!item||!def?.furniture||d.location!=='casa_de_isberto_interior'||d.shadowQuest!=='returned'||!d.position)throw new Error('Este mueble requiere una casa habilitada.');
  const yaw=Number(args.yaw)||0;s.furniture.push({id:crypto.randomUUID(),item,location:d.location,x:d.position.x+Math.sin(yaw)*1.8,z:d.position.z+Math.cos(yaw)*1.8,yaw,...(def.furniture==='estacion'?{job}:{})});d.inventory[slot]=null;
 }else if(action==='pickup'){
  const item=s.furniture.find(f=>f.id===id);if(!item||item.location!==d.location||!d.position||Math.hypot(item.x-d.position.x,item.z-d.position.z)>4)throw new Error('Acércate al mueble.');if(!giveStack(d,item.item))throw new Error('Tu mochila está llena.');s.furniture=s.furniture.filter(f=>f.id!==id);
 }else if(action==='mastery'){
  siteRequired(d,job);const next=(s.mastery[job]??0)+1;if(next>3||(s.xp[job]??0)<RANK_XP[next+2]||(s.crafts[job]??0)<next*50)throw new Error('Completa experiencia y práctica para tu proyecto de maestría.');
  const mat=job==='minero'||job==='herreria'||job==='joyeria'?'minero':job==='lenador'||job==='carpinteria'||job==='ebanisteria'?'lenador':'recolector';consume(d,`material_${mat}_0`,next*20);consume(d,`material_${mat}_${next+1}`,next*10);s.mastery[job]=next;
  const learned=Object.values(RPG_CATALOG.recipes).filter(r=>r.job===job&&r.tier===next+2).sort((a,b)=>a.id.localeCompare(b.id))[0];if(learned&&!s.learned.includes(learned.id))s.learned.push(learned.id);
 }else throw new Error('Acción de oficio no válida.');
 Object.assign(data,d);
}

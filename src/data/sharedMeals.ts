import catalog from './generated/rpg-catalog.json';
import {crafterId,dailyOrderDay,stableHash} from './dailyOrders';
import {giveStack,newRpgItem,professionRank} from './professions';
import type {CharData} from './data';
import type {ItemStack} from './inventory';

export interface MealRecipe {id:string;label:string;tier:number;difficulty:number;output:string;ingredients:Record<string,number>;exclusive?:boolean;pelines?:number;xp?:number;count?:number}
export interface MealProject {id:string;ingredients:Record<string,number>;recipe:MealRecipe;complete:boolean;contributed:boolean;claimed:boolean;contributors:number;active:boolean;remaining:number;expiresAt?:number;rewardable?:boolean;ledger:{item:ItemStack;rewardable:boolean}[]}
export function mealMenu(d:CharData,now=Date.now()/1000):MealRecipe[]{
 const pool=Object.values(catalog.meals).filter(r=>r.tier===professionRank(d.rpg!,'cocina')).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const offset=(stableHash(crafterId(d))+Math.floor(now/86400)*3)%pool.length;
 return Array.from({length:Math.min(3,pool.length)},(_,i)=>pool[(offset+i)%pool.length]);
}
export const mealQuota=(d:CharData,now=Date.now()/1000)=>d.rpg?.mealQuota?.day===dailyOrderDay(now)?d.rpg.mealQuota.completed:0;
export function settleLocalMeals(d:CharData,now:number){
 const q=d.rpg!.neighborhood??={};
 const elapsed=Math.max(0,Math.min(now,q.mealOnlineUntil??now)-(q.mealPulse??now));
 for(const p of q.localMeals??[]){
  if(!p.active||p.complete)continue;p.remaining=Math.max(0,p.remaining-elapsed);
  if(!p.remaining){p.active=false;d.rpg!.deliveries.push(...p.ledger.map(e=>e.item));p.ledger=[];}
 }
 q.mealPulse=now;q.mealOnlineUntil=now+15;
}
export function localMealAction(d:CharData,action:string,args:Record<string,unknown>,now:number){
 const q=d.rpg!.neighborhood??={},teacher=catalog.teachers.cocina;
 if(args.master!==teacher.id||d.location!==teacher.location||!d.position||Math.hypot(d.position.x-teacher.x,d.position.z-teacher.z)>3)throw new Error('Habla con el maestro de Cocina.');
 const projects=q.localMeals??=[];
 if(action==='meal_start'){
  if(projects.filter(p=>p.active&&!p.complete).length>=3)throw new Error('Ya tienes tres preparaciones pendientes.');
  const recipe=mealMenu(d,now).find(r=>r.id===args.id);if(!recipe)throw new Error('Elige una receta de tu menú de hoy.');
  projects.push({id:crypto.randomUUID(),ingredients:{},recipe:{...recipe,pelines:recipe.difficulty*10,xp:recipe.difficulty*5,count:1},complete:false,contributed:false,claimed:false,contributors:0,active:true,remaining:1800,ledger:[]});
 }else if(action==='meal_contribute'||action==='neighbor_contribute'){
  const p=projects.find(p=>p.id===args.project),id=String(args.id);if(!p?.active||p.complete)throw new Error('Preparación no disponible.');
  const required=p.recipe.ingredients[id];if(!required||(p.ingredients[id]??0)>=required)throw new Error('Este ingrediente ya está completo o no forma parte de la receta.');
  const rewardable=mealQuota(d,now)<2;if(!rewardable&&!args.help)throw new Error('Confirma que quieres ayudar sin recompensa.');
  const slot=d.inventory.findIndex(i=>i?.id===id&&!i.bound);if(slot<0)throw new Error('Falta el ingrediente en la mochila.');
  const item=d.inventory[slot]!;p.ledger.push({item:{...item,count:1},rewardable});item.count--;if(!item.count)d.inventory[slot]=null;
  p.ingredients[id]=(p.ingredients[id]??0)+1;p.contributed=true;p.contributors=1;p.rewardable=p.ledger.some(e=>e.rewardable);p.remaining=1800;
  p.complete=Object.entries(p.recipe.ingredients).every(([id,n])=>(p.ingredients[id]??0)>=n);if(p.complete)p.expiresAt=now+604800;
 }else if(action==='meal_claim'||action==='neighbor_claim'){
  const p=projects.find(p=>p.id===args.id);if(!p?.complete||p.claimed||!p.rewardable||now>=(p.expiresAt??0))throw new Error('No tienes recompensa disponible de esta preparación.');
  if(mealQuota(d,now)>=2)throw new Error('Ya has cobrado dos meriendas hoy.');
  const item=newRpgItem(p.recipe.output,1);if(!giveStack(d,item))d.rpg!.deliveries.push(item);
  d.wallet.pelines+=p.recipe.pelines!;d.rpg!.xp.cocina=(d.rpg!.xp.cocina??0)+p.recipe.xp!;
  d.rpg!.mealQuota={day:dailyOrderDay(now),completed:mealQuota(d,now)+1};p.claimed=true;
 }else throw new Error('No se permite cancelar manualmente una merienda.');
}

import type { CharData } from './data';
import { ENCHANT_VALUES } from './professions';

export function basicEnchantment(d:CharData,base:number,actual:number,target:string,now:number){
 const weapon=d.equipment.weapon,e=weapon?.enchantment;
 if(!weapon||!e)return {damage:0,healing:0};
 const key=weapon.instanceId??weapon.id;
 let s=d.enchantState;
 if(!s||s.weapon!==key||now-(s.at??0)>6)s={weapon:key,count:0};
 if(e.id==='dark'){
  s.marks=Object.fromEntries(Object.entries(s.marks??{}).filter(([,mark])=>now-mark.at<=6));
  s.count=s.marks[target]?.count??0;
 }
 s.at=now;s.target=target;s.count=(s.count??0)+1;
 const value=ENCHANT_VALUES[e.id][e.grade];let damage=0,healing=0;
 if(e.id==='fire')damage=base*value;
 else if(e.id==='vampirism')healing=actual*value;
 else if(e.id==='dark'&&s.count>=3){damage=base*value;s.count=0;}
 else if(e.id==='frost'&&s.count>=3){s.barrier=Math.max((s.barrierUntil??0)>now?s.barrier??0:0,base*value);s.barrierUntil=now+4;s.count=0;}
 else if(e.id==='lightning')s.count=Math.min(4,s.count);
 if(e.id==='dark')s.marks![target]={count:s.count,at:now};
 d.enchantState=s;return {damage,healing};
}
export function absorbBarrier(d:CharData,incoming:number,now:number){
 const s=d.enchantState;
 if(!s||(s.barrierUntil??0)<=now)return incoming;
 const absorbed=Math.min(incoming,s.barrier??0);s.barrier=(s.barrier??0)-absorbed;return incoming-absorbed;
}

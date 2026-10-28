import raw from './dailyOrders.json';
import type {CharData} from './data';
import type {RpgState,ProfessionSite} from './professions';

export interface DailyOrder {id:string;job:string;label:string;ingredients:Record<string,number>;reward:number}
export interface DailyOrderCatalog {limit:number;reset:string;orders:Record<string,DailyOrder>}
export const DAILY_ORDERS:DailyOrderCatalog=raw;
export const dailyOrderDay=(now=Date.now()/1000)=>new Date(now*1000).toISOString().slice(0,10);
export function dailyOrderStatus(state:Pick<RpgState,'dailyOrders'>|undefined,now=Date.now()/1000){
 const day=dailyOrderDay(now),completed=state?.dailyOrders?.day===day?state.dailyOrders.completed:0;
 return {day,completed,remaining:Math.max(0,DAILY_ORDERS.limit-completed)};
}
export const orderItemCount=(data:CharData,id:string)=>data.inventory.reduce((sum,item)=>sum+(item?.id===id&&!item.bound?item.count:0),0);
export const hasOrderItems=(data:CharData,order:DailyOrder)=>Object.entries(order.ingredients).every(([id,count])=>orderItemCount(data,id)>=count);

/** Called on the development resolver's cloned state; the server owns online delivery. */
export function deliverDailyOrder(data:CharData,order:DailyOrder|undefined,args:Record<string,unknown>,teacher:ProfessionSite|undefined,now:number){
 if(!order)throw new Error('Encargo diario no válido.');
 if(!teacher||args.master!==teacher.id||data.location!==teacher.location||!data.position||Math.hypot(data.position.x-teacher.x,data.position.z-teacher.z)>(teacher.radius??3))throw new Error('Habla con el maestro de este encargo.');
 if(args.reward!==order.reward)throw new Error('La recompensa ha cambiado. Consulta de nuevo al maestro.');
 const status=dailyOrderStatus(data.rpg,now);
 if(!status.remaining)throw new Error('Ya has completado tus tres encargos diarios.');
 if(!hasOrderItems(data,order))throw new Error('Faltan los materiales o componentes sin vincular del encargo.');
 for(const [id,count]of Object.entries(order.ingredients)){
  let remaining=count;
  for(let slot=0;slot<data.inventory.length&&remaining;slot++){
   const item=data.inventory[slot];if(item?.id!==id||item.bound)continue;
   const n=Math.min(remaining,item.count);item.count-=n;remaining-=n;if(!item.count)data.inventory[slot]=null;
  }
 }
 data.wallet.pelines+=order.reward;
 data.rpg!.dailyOrders={day:status.day,completed:status.completed+1};
}

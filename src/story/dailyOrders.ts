import {t} from '../ui/i18n';
import {acceptedCommissions,commissionOffers,commissionCount,canDeliverCommission,dailyOrderStatus,type Commission} from '../data/dailyOrders';
import {RPG_CATALOG} from '../data/professions';
import type {CharData} from '../data/data';
import type {DialogNode,DialogChoice} from '../ui/dialog';

export interface DailyOrderService {getState:()=>CharData;act:(action:string,args:Record<string,unknown>)=>Promise<boolean>}
export function addDailyOrders(nodes:Record<string,DialogNode>,job:string,service:DailyOrderService):DialogChoice{
 const back:DialogChoice={text:'Volver a mis preguntas',next:'intro'};
 const perform=(action:string,args:Record<string,unknown>)=>()=>service.act(action,args);
 function detail(order:Commission,accepted=false){
  const key=`daily_${accepted?order.acceptedId:order.id}`;
  nodes[key]={get text(){
   const d=service.getState(),needs=Object.entries(order.ingredients).map(([id,n])=>`• ${RPG_CATALOG.items[id]?.label??id}: ${commissionCount(d,id)} / ${n}`).join('\n');
   return `${order.label}\n\n${needs}\n\n${order.reward} Pelines + ${order.xp} XP de ${RPG_CATALOG.professions[job]}.\nSolo productos fabricados por este personaje, nuevos y sin usar. Sirven existencias anteriores a la aceptación.\n\n${accepted?'Aceptado: conserva esta recompensa y caduca al terminar el día.':'No necesitas conocer aún la receta para aceptar. Aprenderla requiere su pergamino.'}`;
  },get choices(){return accepted?[
   {text:'Entregar y cobrar',next:'daily_orders',when:()=>dailyOrderStatus(service.getState().rpg).remaining>0&&canDeliverCommission(service.getState(),order),action:perform('order_claim',{id:order.acceptedId})},
   {text:'Cancelar encargo gratis',next:'daily_orders',action:perform('order_cancel',{id:order.acceptedId})},
   {text:'Volver a los encargos diarios',next:'daily_orders'}
  ]:[
   {text:'Aceptar encargo',next:'daily_orders',when:()=>acceptedCommissions(service.getState()).length<3,action:perform('order_accept',{id:order.id,job,recipe:order.recipe,reward:order.reward})},
   {text:'Volver a los encargos diarios',next:'daily_orders'}
  ];}};
  return{text:`${accepted?'Aceptado · ':''}${order.label} · ${order.reward} Pelines`,next:key};
 }
 nodes.daily_orders={get text(){const d=service.getState(),status=dailyOrderStatus(d.rpg);return t('Elige entre los tres encargos de hoy. Se mantienen hasta las 00:00 UTC. Puedes repetir sus tipos y tener tres aceptados en total entre los maestros.')+`\n\n${status.remaining} / 3 entregas restantes hoy · ${acceptedCommissions(d).length} / 3 aceptados.\n\n`+t('Los encargos pagan productos fabricados por ti. No compramos materias primas. La práctica de iniciación se entrega por separado.');},get choices(){
  const d=service.getState(),pending=acceptedCommissions(d).filter(o=>o.job===job),offers=commissionOffers(d,job);
  return [...offers.map(o=>detail(o)),...pending.map(o=>detail(o,true)),
   {text:'Entregar juntos los completados de este maestro',next:'daily_orders',when:()=>dailyOrderStatus(service.getState().rpg).remaining>0&&acceptedCommissions(service.getState()).some(o=>o.job===job&&canDeliverCommission(service.getState(),o)),action:perform('order_claim_all',{job})},back];
 }};
 return{text:'Encargos diarios',next:'daily_orders',action:perform('order_view',{job})};
}

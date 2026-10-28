import {t} from '../ui/i18n';
import {DAILY_ORDERS,dailyOrderStatus,orderItemCount,hasOrderItems} from '../data/dailyOrders';
import {RPG_CATALOG} from '../data/professions';
import type {CharData} from '../data/data';
import type {DialogNode,DialogChoice} from '../ui/dialog';

const WORKSHOP_REQUESTS: Record<string, string> = {
  "herreria": "Me vendrían bien componentes de Aprendiz para la forja. Si tienes algunos hechos, puedo pagártelos.",
  "peleteria": "Necesito componentes de Aprendiz para trabajar el cuero. Mira las cantidades; puedo comprarte una entrega.",
  "sastreria": "Estoy reuniendo componentes de Aprendiz para el taller. ¿Tienes algunos que puedas venderme?",
  "carpinteria": "Si te han sobrado componentes de Aprendiz al trabajar la madera, me sirven aquí. Te pago por traerlos.",
  "ebanisteria": "Quiero dejar preparados componentes de Aprendiz para los muebles. Puedo pagarte los que indica el encargo.",
  "joyeria": "Necesito componentes de Aprendiz para las piezas del taller. Comprueba qué te pido antes de ponerte a fabricarlos.",
  "alquimia": "Para estas preparaciones me faltan componentes de Aprendiz. Si los traes, te los compro; no necesito que hagas una poción entera.",
  "encantamiento": "Puedo comprarte componentes de Aprendiz para los encantamientos. Con eso basta para este encargo; no me traigas un pergamino terminado.",
  "cocina": "Me hacen falta componentes de Aprendiz para cocinar. Mira lo que falta y, si puedes prepararlo, te pago la entrega.",
  "minero": "Necesito mineral y gemas básicos para el taller. No hace falta que sean de un yacimiento difícil: mira cuáles te pido.",
  "lenador": "Me vendría bien una reserva de roble. Si vas a salir a talar, mira cuánto te puedo comprar.",
  "recolector": "Estoy reuniendo hierbas, cereal y fruta de los más básicos. ¿Tienes algo de la lista? Puedo comprártelo."
};

export interface DailyOrderService {getState:()=>CharData;deliver:(id:string)=>Promise<boolean>}
export function addDailyOrders(nodes:Record<string,DialogNode>,job:string,service:DailyOrderService):DialogChoice{
 const orders=Object.values(DAILY_ORDERS.orders).filter(order=>order.job===job);
 const choices:DialogChoice[]=orders.map(order=>({text:`${order.label} · ${order.reward} Pelines`,next:`daily_${order.id}`}));
 const back:DialogChoice={text:'Volver a mis preguntas',next:'intro'};
 nodes.daily_orders={get text(){
  const status=dailyOrderStatus(service.getState().rpg);
  return `${t(WORKSHOP_REQUESTS[job])}\n\n${t('Te quedan {remaining} de {limit} encargos diarios. El límite se comparte entre todos los maestros y se renueva a las 00:00 UTC.', {remaining:status.remaining,limit:DAILY_ORDERS.limit})}\n\n${t('Son independientes de los proyectos de maestría: no ascienden tu rango ni enseñan recetas.')}`;
 },choices:[...choices,back]};
 for(const order of orders){
  const detail=`daily_${order.id}`,receipt=`daily_paid_${order.id}`;
  nodes[detail]={get text(){
   const data=service.getState(),status=dailyOrderStatus(data.rpg);
   const needs=Object.entries(order.ingredients).map(([id,n])=>`• ${RPG_CATALOG.items[id]?.label??id}: ${orderItemCount(data,id)} / ${n}`).join('\n');
   return `${order.label}\n\n${needs}\n\nRecompensa: ${order.reward} Pelines.\nEntregar consume las cantidades indicadas de tu mochila. Los objetos vinculados no se aceptan.\n\nEncargos disponibles hoy: ${status.remaining} / ${DAILY_ORDERS.limit}.`;
  },choices:[
   {text:`Entregar y cobrar ${order.reward} Pelines`,next:receipt,when:()=>dailyOrderStatus(service.getState().rpg).remaining>0&&hasOrderItems(service.getState(),order),action:()=>service.deliver(order.id)},
   {text:'¿Cómo consigo lo que pides?',next:'daily_help'},
   {text:'Volver a los encargos diarios',next:'daily_orders'},
  ]};
  nodes[receipt]={get text(){return `Entrega recibida. Has cobrado ${order.reward} Pelines.\n\nTe quedan ${dailyOrderStatus(service.getState().rpg).remaining} encargos para hoy entre todos los maestros.`;},choices:[{text:'Ver encargos diarios',next:'daily_orders'},back]};
 }
 nodes.daily_help={text:'Los materiales básicos se reúnen en Pompelín. Los componentes de Aprendiz se fabrican con la receta que vende el maestro del oficio. Puedes traer también materiales o componentes obtenidos mediante comercio.\n\nNo necesitas entregar equipo de calidad superior ni completar un proyecto de maestría.',choices:[{text:'Volver a los encargos diarios',next:'daily_orders'},back]};
 return{text:'Encargos diarios',next:'daily_orders'};
}

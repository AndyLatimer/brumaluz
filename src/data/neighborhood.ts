import type {CharData} from './data';
import {RPG_CATALOG,giveStack} from './professions';
import {PROFESSION_TUTORIAL} from './professionTutorial';
import plans from './neighborhoodPlans.json';
import {crafterId,dailyOrderDay,commissionCount} from './dailyOrders';
import type {MealProject} from './sharedMeals';

export interface NeighborhoodState {errand?:'accepted'|'visited'|'completed';project?:string;claimed?:string[];preparations?:string[];quota?:{day:string;completed:number};localPicnic?:NeighborhoodProject;localMeals?:MealProject[];mealPulse?:number;mealOnlineUntil?:number}
export const NEIGHBORHOOD_PLANS:Record<string,{label:string;job:string;description:string;thanks:string;ingredients:Record<string,number>;pelines:number;gift?:string}>=plans;
export const preparationReady=(_d:CharData)=>true;
export const PICNIC_INGREDIENTS:Record<string,number>={grano_0:4,fruta_0:4,hongo_0:2};
export interface NeighborhoodProject {id:string;ingredients:Record<string,number>;complete:boolean;contributed:boolean;claimed:boolean;contributors:number;active?:boolean;recipe?:MealProject['recipe'];remaining?:number;expiresAt?:number;rewardable?:boolean}
export function neighborhoodAction(d:CharData,action:string,args:Record<string,unknown>,now=Date.now()/1000){
 const s=d.rpg!,q=s.neighborhood??={};
 if(action==='neighbor_accept'||action==='neighbor_report'){
  const target=d.shadowQuest==='returned'?PROFESSION_TUTORIAL.mentor:PROFESSION_TUTORIAL.legacyMentor;
  if(d.welcome&&d.shadowQuest!=='returned')throw new Error('Termina primero la bienvenida y el regreso con Isberto.');
  if(args.master!=='gnomi'||d.location!==target.location||!d.position||Math.hypot(d.position.x-target.x,d.position.z-target.z)>target.radius)throw new Error('Habla con Gnomi junto al pozo.');
  if(action==='neighbor_accept'){if(q.errand)throw new Error('Ya has empezado este recado.');q.errand='accepted';}
  else {if(q.errand!=='visited')throw new Error('Visita primero al maestro de Leñadores.');q.errand='completed';d.wallet.pelines+=100;}
 }else if(action==='neighbor_visit'){
  const teacher=RPG_CATALOG.teachers.lenador;
  if(q.errand!=='accepted'||args.master!==teacher.id||d.location!==teacher.location||!d.position||Math.hypot(d.position.x-teacher.x,d.position.z-teacher.z)>3)throw new Error('Habla con el maestro de Leñadores para este recado.');
  q.errand='visited';
 }else if(action==='neighbor_prepare'){
  const id=String(args.id),plan=NEIGHBORHOOD_PLANS[id],teacher=plan&&RPG_CATALOG.teachers[plan.job];
  if(!plan||!preparationReady(d))throw new Error('Ayuda a Gnomi y coloca tu primer mueble antes de preparar la mudanza.');
  if(q.preparations?.includes(id))throw new Error('Ya terminaste este proyecto.');
  const day=dailyOrderDay(now);if(q.quota?.day!==day)q.quota={day,completed:0};if(q.quota!.completed>=2)throw new Error('Ya has completado dos proyectos de barrio hoy.');
  if(args.master!==teacher.id||d.location!==teacher.location||!d.position||Math.hypot(d.position.x-teacher.x,d.position.z-teacher.z)>3)throw new Error('Habla con el maestro de este proyecto.');
  for(const[item,n]of Object.entries(plan.ingredients))if(commissionCount(d,item)<n)throw new Error('Faltan componentes fabricados por este personaje.');
  for(const[item,n]of Object.entries(plan.ingredients)){let left=n;for(let slot=0;slot<d.inventory.length&&left;slot++){const stack=d.inventory[slot];if(stack?.id!==item||stack.bound||stack.craftedBy!==crafterId(d))continue;const used=Math.min(stack.count,left);left-=used;stack.count-=used;if(!stack.count)d.inventory[slot]=null;}}q.quota!.completed++;
  d.wallet.pelines+=plan.pelines;
  if(plan.gift){const gift={id:plan.gift,count:1,instanceId:crypto.randomUUID(),bound:true};if(!giveStack(d,gift))s.deliveries.push(gift);}
  (q.preparations??=[]).push(id);
 }else throw new Error('Acción de vida cotidiana no válida.');
}

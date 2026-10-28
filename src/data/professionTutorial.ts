import raw from './professionTutorial.json';
import {RPG_CATALOG} from './professions';
import type {CharData} from './data';
import {DAILY_ORDERS,dailyOrderStatus} from './dailyOrders';
import workshops from './workshops.json';
import {experienceToNextLevel} from './stats';
export const PROFESSION_TUTORIAL=raw as {title:string;reward:{experience:number;pelines:number};mentor:{location:string;x:number;z:number;radius:number};legacyMentor:{location:string;x:number;z:number;radius:number};jobs:Record<string,{gatherJob:string;recipe:string|null;order:string}>};
export interface ProfessionTutorial {job:string;status:'active'|'completed';visited:boolean;equipped:boolean;gathered:number;crafted:number;collected:number;delivered:boolean;jobIds:string[];startedAt:number;completedAt?:number}
export const tutorialProgress=(d:CharData)=>d.rpg?.tutorial;
export function tutorialMaterials(d:CharData){
 const q=tutorialProgress(d),cfg=q&&PROFESSION_TUTORIAL.jobs[q.job];if(!q||!cfg||q.delivered)return{};
 const recipe=cfg.recipe?RPG_CATALOG.recipes[cfg.recipe]:null,amount=recipe?Math.max(0,2-q.crafted):1,needs=recipe?.ingredients??DAILY_ORDERS.orders[cfg.order].ingredients;
 return Object.fromEntries(Object.entries(needs).map(([id,n])=>[id,n*amount]));
}
export const hasTutorialMaterials=(d:CharData)=>Object.entries(tutorialMaterials(d)).every(([id,n])=>d.inventory.reduce((sum,item)=>sum+(item?.id===id?item.count:0),0)>=n);
export function tutorialSteps(d:CharData){
 const q=tutorialProgress(d),cfg=q&&PROFESSION_TUTORIAL.jobs[q.job];if(!q||!cfg)return[];
 return [
  {id:'visit',label:'Hablar con el maestro del oficio',done:q.visited},
  {id:'tool',label:`Equipar herramienta de ${RPG_CATALOG.professions[cfg.gatherJob]}`,done:q.equipped},
  ...(cfg.recipe?[{id:'learn',label:'Comprar y usar el pergamino de receta',done:d.rpg!.learned.includes(cfg.recipe)}]:[]),
  {id:'gather',label:'Extraer un recurso y reunir los materiales',done:q.gathered>=1&&hasTutorialMaterials(d)},
  ...(cfg.recipe?[{id:'craft',label:'Fabricar dos componentes de Aprendiz',done:q.crafted>=2},{id:'collect',label:'Recoger las piezas terminadas',done:q.collected>=2}]:[]),
  {id:'deliver',label:'Entregar el suministro diario y cobrar',done:q.delivered},
  {id:'report',label:'Completar la misión con el maestro',done:q.status==='completed'},
 ];
}
export function tutorialStep(d:CharData){return tutorialSteps(d).find(s=>!s.done)?.id??'completed';}
export function tutorialObjective(d:CharData){
 const q=tutorialProgress(d),cfg=q&&PROFESSION_TUTORIAL.jobs[q.job];if(!q||!cfg)return'';
 const name=RPG_CATALOG.professions[q.job],step=tutorialStep(d);
 if(step==='visit')return `Habla con el maestro de ${name} en su taller.`;
 if(step==='tool')return `Compra una herramienta de ${RPG_CATALOG.professions[cfg.gatherJob]} en Herrería por 20 Pelines y equípala en Mis herramientas. Si ya tienes una, equípala.`;
 if(step==='learn')return d.inventory.some(item=>item?.id===`receta_${cfg.recipe}`)?'Usa el pergamino de receta desde la mochila.':`Compra al maestro de ${name} el pergamino de componente de Aprendiz por 50 Pelines y úsalo desde la mochila.`;
 if(step==='gather')return `Extrae un recurso de ${RPG_CATALOG.professions[cfg.gatherJob]} en Pompelín y reúne todos los materiales para ${cfg.recipe?'dos componentes de Aprendiz':'el suministro diario'}. El libro indica las fuentes y cantidades; puedes conseguir lo que falte mediante comercio o botín.`;
 if(step==='craft')return `En el banco de ${name}, fabrica dos componentes de Aprendiz con tus materiales.`;
 if(step==='collect')return `Recoge los dos componentes en el banco de ${name} cuando terminen. Si cancelaste trabajos, vuelve a fabricarlos.`;
 if(step==='deliver')return dailyOrderStatus(d.rpg).remaining?`Entrega «${DAILY_ORDERS.orders[cfg.order].label}» al maestro de ${name} mediante Encargos diarios y cobra su recompensa.`:'Has agotado las tres entregas de hoy. Conserva el suministro y entrégalo al renovarse el cupo a las 00:00 UTC.';
 if(step==='report')return `Habla con el maestro de ${name} y confirma la entrega de la misión.`;
 return `Has recorrido el oficio de ${name}. Puedes seguir practicando o probar otros oficios.`;
}
/** Returns a target in the current map, routing through authored doors. */
export function tutorialTarget(d:CharData,location=d.location):{x:number;z:number;name:string}|null{
 const q=tutorialProgress(d),cfg=q&&PROFESSION_TUTORIAL.jobs[q.job];if(!q||!cfg||q.status==='completed')return null;
 const step=tutorialStep(d),job=step==='tool'?'herreria':q.job,teacher=RPG_CATALOG.teachers[job];
 if(step==='learn'&&d.inventory.some(item=>item?.id===`receta_${cfg.recipe}`))return null;
 if(step==='gather'){
  if(location==='pompelin'){
   const needs=tutorialMaterials(d);
   const nodes=Object.values(RPG_CATALOG.nodes).filter(n=>n.job===cfg.gatherJob&&n.item&&needs[n.item]&&(q.gathered<1||d.inventory.reduce((sum,item)=>sum+(item&&item.id===n.item?item.count:0),0)<needs[n.item])&&n.tier===0&&(d.rpg?.nodes[n.id]??0)<=Date.now()/1000);
   nodes.sort((a,b)=>Math.hypot(a.x-(d.position?.x??0),a.z-(d.position?.z??0))-Math.hypot(b.x-(d.position?.x??0),b.z-(d.position?.z??0)));
   return nodes[0]?{...nodes[0],name:tutorialObjective(d)}:null;
  }
  if(location==='brumaluz')return{x:175.2,z:0,name:'Sal a Pompelín por la Puerta del Este'};
 }
 if(location===teacher.location)return{...(step==='craft'||step==='collect'?RPG_CATALOG.stations[job]:teacher),name:tutorialObjective(d)};
 if(location==='brumaluz'){
  const w=workshops.workshops.find(w=>w.job===job);return w?{...w.entrance,name:`Taller de ${RPG_CATALOG.professions[job]}`} : null;
 }
 if(location==='pompelin')return{x:-70,z:-90,name:'Regresa a Brumaluz'};
 // The common workshop exit and Isberto's house exit are existing authored doors.
 const currentWorkshop=workshops.workshops.find(w=>w.mapId===location);
 if(currentWorkshop)return{...currentWorkshop.exit,name:'Sal del taller para continuar'};
 if(location==='casa_de_isberto_interior')return{x:0,z:2.5,name:'Sal de casa para ir al taller'};
 return null;
}

export function tutorialAction(d:CharData,action:string,args:Record<string,unknown>,now:number){
 const s=d.rpg!,q=s.tutorial;let target:{location:string;x:number;z:number;radius?:number;id?:string};
 if(action==='tutorial_accept'){
  if(q)throw new Error('Ya tienes una iniciación de oficio elegida.');
  if(d.welcome&&(d.welcome.stage!=='completed'||d.shadowQuest!=='returned'))throw new Error('Termina primero la bienvenida y el regreso con Isberto.');
  if(!PROFESSION_TUTORIAL.jobs[String(args.job)])throw new Error('Elige un oficio válido.');
  if(args.master!=='gnomi')throw new Error('Habla con Gnomi para elegir tu iniciación.');
  target=d.shadowQuest==='returned'?PROFESSION_TUTORIAL.mentor:PROFESSION_TUTORIAL.legacyMentor;
 }else{
  if(q?.status!=='active')throw new Error('No tienes una iniciación de oficio pendiente.');
  target=RPG_CATALOG.teachers[q.job];if(args.master!==target.id)throw new Error('Habla con el maestro del oficio elegido.');
 }
 if(d.location!==target.location||!d.position||Math.hypot(d.position.x-target.x,d.position.z-target.z)>(target.radius??3))throw new Error('Acércate al interlocutor de la misión.');
 if(action==='tutorial_accept'){
  const job=String(args.job),cfg=PROFESSION_TUTORIAL.jobs[job];s.tutorial={job,status:'active',visited:false,equipped:(s.tools[cfg.gatherJob]?.durability??0)>0,gathered:0,crafted:0,collected:0,delivered:false,jobIds:[],startedAt:now};
 }else if(action==='tutorial_visit'){
  const cfg=PROFESSION_TUTORIAL.jobs[q!.job];q!.visited=true;q!.equipped||=(s.tools[cfg.gatherJob]?.durability??0)>0;
 }else if(action==='tutorial_complete'){
  const cfg=PROFESSION_TUTORIAL.jobs[q!.job];
  if(!q!.visited||!q!.equipped||q!.gathered<1||!q!.delivered||cfg.recipe&&(q!.collected<2||!s.learned.includes(cfg.recipe)))throw new Error('Completa los pasos normales del oficio antes de entregar la misión.');
  if(d.level<50){d.experience+=PROFESSION_TUTORIAL.reward.experience;while(d.level<50&&d.experience>=experienceToNextLevel(d.level)){d.experience-=experienceToNextLevel(d.level);d.level++;}if(d.level>=50)d.experience=experienceToNextLevel(50);}
  q!.status='completed';q!.completedAt=now;
 }
}

export function tutorialEvent(d:CharData,action:string,args:Record<string,unknown>,previous:CharData){
 const s=d.rpg!,q=s.tutorial;if(q?.status!=='active')return;
 const cfg=PROFESSION_TUTORIAL.jobs[q.job],recipe=cfg.recipe?RPG_CATALOG.recipes[cfg.recipe]:undefined;
 if(action==='tool'&&(s.tools[cfg.gatherJob]?.durability??0)>0)q.equipped=true;
 if(!q.visited)return;
 if(action==='gather_finish'){
  const node=RPG_CATALOG.nodes[String(args.id)],needs=recipe?.ingredients??DAILY_ORDERS.orders[cfg.order].ingredients;
  if(node?.job===cfg.gatherJob&&node.item&&needs[node.item])q.gathered++;
 }else if(action==='craft'&&args.id===cfg.recipe&&q.gathered>=1){
  if(recipe!.seconds===0)q.collected=Math.min(2,q.collected+Number(args.count??1));
  else for(const job of s.jobs)if(job.recipe===cfg.recipe&&!previous.rpg?.jobs.some(old=>old.id===job.id))q.jobIds.push(job.id);
 }else if((action==='collect'||action==='cancel')&&q.jobIds.includes(String(args.id))){
  if(action==='collect')q.collected=Math.min(2,q.collected+1);q.jobIds=q.jobIds.filter(id=>id!==args.id);
 }else if(action==='daily_order'&&args.id===cfg.order&&q.gathered>=1&&(!recipe||q.collected>=2))q.delivered=true;
 q.crafted=Math.min(2,q.collected+q.jobIds.length);
}

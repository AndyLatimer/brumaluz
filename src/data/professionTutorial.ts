import raw from './professionTutorial.json';
import {RPG_CATALOG} from './professions';
import type {CharData} from './data';
import {DAILY_ORDERS} from './dailyOrders';
import workshops from './workshops.json';
import {experienceToNextLevel} from './leveling';
export const PROFESSION_TUTORIAL=raw as {title:string;reward:{experience:number;pelines:number};mentor:{location:string;x:number;z:number;radius:number};legacyMentor:{location:string;x:number;z:number;radius:number};jobs:Record<string,{gatherJob:string;recipe:string|null;order:string}>};
export interface ProfessionTutorial {job:string;status:'active'|'completed';visited:boolean;equipped:boolean;gathered:number;crafted:number;collected:number;delivered:boolean;jobIds:string[];startedAt:number;completedAt?:number}
type Translate=(source:string,values?:Record<string,string|number>)=>string;
const spanish:Translate=(source,values={})=>Object.entries(values).reduce((text,[key,value])=>text.replaceAll(`{${key}}`,String(value)),source);
export const tutorialProgress=(d:CharData)=>d.rpg?.tutorial;
export function tutorialMaterials(d:CharData){
 const q=tutorialProgress(d),cfg=q&&PROFESSION_TUTORIAL.jobs[q.job];if(!q||!cfg||q.delivered)return{};
 const recipe=cfg.recipe?RPG_CATALOG.recipes[cfg.recipe]:null,amount=recipe?Math.max(0,2-q.crafted):1,needs=recipe?.ingredients??DAILY_ORDERS.orders[cfg.order].ingredients;
 return Object.fromEntries(Object.entries(needs).map(([id,n])=>[id,n*amount]));
}
export const hasTutorialMaterials=(d:CharData)=>Object.entries(tutorialMaterials(d)).every(([id,n])=>d.inventory.reduce((sum,item)=>sum+(item?.id===id?item.count:0),0)>=n);
export function tutorialSteps(d:CharData,translate:Translate=spanish){
 const q=tutorialProgress(d),cfg=q&&PROFESSION_TUTORIAL.jobs[q.job];if(!q||!cfg)return[];
 return [
  {id:'visit',label:translate('Hablar con el maestro del oficio'),done:q.visited},
  {id:'tool',label:translate('Equipar herramienta de {job}',{job:translate(RPG_CATALOG.professions[cfg.gatherJob])}),done:q.equipped},
  ...(cfg.recipe?[{id:'learn',label:translate('Comprar y usar el pergamino de receta'),done:d.rpg!.learned.includes(cfg.recipe)}]:[]),
  {id:'gather',label:translate('Extraer un recurso y reunir los materiales'),done:q.gathered>=1&&hasTutorialMaterials(d)},
  ...(cfg.recipe?[{id:'craft',label:translate('Fabricar dos componentes de Aprendiz'),done:q.crafted>=2},{id:'collect',label:translate('Recoger las piezas terminadas'),done:q.collected>=2}]:[]),
  {id:'deliver',label:translate('Entregar el suministro de práctica y cobrar'),done:q.delivered},
  {id:'report',label:translate('Completar la misión con el maestro'),done:q.status==='completed'},
 ];
}
export function tutorialStep(d:CharData){return tutorialSteps(d).find(s=>!s.done)?.id??'completed';}
export function tutorialObjective(d:CharData,translate:Translate=spanish){
 const q=tutorialProgress(d),cfg=q&&PROFESSION_TUTORIAL.jobs[q.job];if(!q||!cfg)return'';
 const job=translate(RPG_CATALOG.professions[q.job]),gatherJob=translate(RPG_CATALOG.professions[cfg.gatherJob]),step=tutorialStep(d);
 if(step==='visit')return translate('Habla con el maestro de {job} en su taller.',{job});
 if(step==='tool')return translate('Equipa una herramienta de {job} desde la mochila o Mis herramientas. La básica cuesta 20 Pelines en Herrería; el recado de Gnomi paga 100.',{job:gatherJob});
 if(step==='learn')return d.inventory.some(item=>item?.id===`receta_${cfg.recipe}`)?translate('Usa el pergamino de receta desde la mochila.'):translate('Compra al maestro de {job} el pergamino de componente de Aprendiz por 50 Pelines y úsalo desde la mochila.',{job});
 if(step==='gather'){
  const materials=Object.entries(tutorialMaterials(d)).filter(([,amount])=>amount>0).map(([id,amount])=>`${amount} × ${translate(RPG_CATALOG.items[id].label)}`).join(', ');
  return [q.gathered<1?translate('Extrae un recurso de {job} en Pompelín.',{job:gatherJob}):'',materials?translate('Reúne en la mochila para la práctica: {materials}.',{materials}):''].filter(Boolean).join(' ');
 }
 if(step==='craft')return translate(q.crafted===1?'Fabrica el componente de Aprendiz que falta en la estación de {job}.':'Fabrica dos componentes de Aprendiz en la estación de {job}.',{job});
 if(step==='collect')return translate(q.collected===1?'Recoge el componente que falta en la estación de {job}.':'Recoge los dos componentes terminados en la estación de {job}.',{job});
 if(step==='deliver')return translate('Entrega el suministro al maestro de {job} desde Mi iniciación al oficio. La práctica se paga una vez y no consume encargos diarios.',{job});
 if(step==='report')return translate('Habla con el maestro de {job} y confirma la misión.',{job});
 return translate('Has completado la iniciación de {job}. Puedes seguir practicando o probar otros oficios.',{job});
}
/** Returns a target in the current map, routing through authored doors. */
export function tutorialTarget(d:CharData,location=d.location,translate:Translate=spanish):{x:number;z:number;name:string}|null{
 const q=tutorialProgress(d),cfg=q&&PROFESSION_TUTORIAL.jobs[q.job];if(!q||!cfg||q.status==='completed')return null;
 const step=tutorialStep(d),job=step==='tool'?'herreria':q.job,teacher=RPG_CATALOG.teachers[job];
 if(step==='learn'&&d.inventory.some(item=>item?.id===`receta_${cfg.recipe}`))return null;
 if(step==='gather'){
  if(location==='pompelin'){
   const needs=tutorialMaterials(d);
   const nodes=Object.values(RPG_CATALOG.nodes).filter(n=>n.job===cfg.gatherJob&&n.item&&needs[n.item]&&(q.gathered<1||d.inventory.reduce((sum,item)=>sum+(item&&item.id===n.item?item.count:0),0)<needs[n.item])&&n.tier===0&&(d.rpg?.nodes[n.id]??0)<=Date.now()/1000);
   nodes.sort((a,b)=>Math.hypot(a.x-(d.position?.x??0),a.z-(d.position?.z??0))-Math.hypot(b.x-(d.position?.x??0),b.z-(d.position?.z??0)));
   return nodes[0]?{...nodes[0],name:tutorialObjective(d,translate)}:null;
  }
  if(location==='brumaluz')return{x:175.2,z:0,name:translate('Sal a Pompelín por la Puerta del Este')};
 }
 if(step!=='gather'&&location===teacher.location)return{...(step==='craft'||step==='collect'?RPG_CATALOG.stations[job]:teacher),name:tutorialObjective(d,translate)};
 if(location==='brumaluz'){
  const w=workshops.workshops.find(w=>w.job===job);return w?{...w.entrance,name:translate('Taller de {job}',{job:translate(RPG_CATALOG.professions[job])})} : null;
 }
 if(location==='pompelin')return{x:-70,z:-90,name:translate('Regresa a Brumaluz')};
 // The common workshop exit and Isberto's house exit are existing authored doors.
 const currentWorkshop=workshops.workshops.find(w=>w.mapId===location);
 if(currentWorkshop)return{...currentWorkshop.exit,name:translate('Sal del taller para continuar')};
 if(location==='casa_de_isberto_interior')return{x:0,z:2.5,name:translate('Sal de casa para ir al taller')};
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

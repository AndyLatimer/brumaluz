import type {CharData} from '../data/data';
import {RPG_CATALOG} from '../data/professions';
import {PROFESSION_TUTORIAL,tutorialProgress,tutorialObjective,tutorialStep} from '../data/professionTutorial';
import type {Conversation,DialogNode,DialogChoice} from '../ui/dialog';
import {t} from '../ui/i18n';
import {addGnomiNeighborhood} from './neighborhood';
export interface TutorialService{getState:()=>CharData;act:(action:string,args:Record<string,unknown>)=>Promise<boolean>;master:string;openBook:()=>void;openInventory:()=>void}
export function professionTutorialConversation(getState:()=>CharData,act:TutorialService['act'],speaker:string,subtitle:string):Conversation{
 const q=tutorialProgress(getState()),nodes:Record<string,DialogNode>={};
 if(q){nodes.intro={get text(){return q.status==='completed'?t('Ya conoces tu primer oficio. Puedes seguir practicando o visitar otro taller.'):`${t('Elegiste {job}. El maestro te espera para practicar.',{job:t(RPG_CATALOG.professions[q.job])})}\n\n${tutorialObjective(getState(),t)}`;}};return addGnomiNeighborhood({speaker,subtitle,emblem:'guild',start:'intro',nodes},getState,act);}
 nodes.intro={text:'Te enseñaré los talleres. Elige un oficio para aprender sus primeros pasos.\n\nEsta elección solo afecta a la iniciación: puedes aprender todos los oficios.',choices:[{text:'Quiero fabricar algo.',next:'production'},{text:'Prefiero empezar recolectando.',next:'gathering'}]};
 for(const gathering of [false,true]){
  const page=gathering?'gathering':'production';
  nodes[page]={text:gathering?'Elige un oficio. Equiparás una herramienta, extraerás recursos y entregarás el suministro de práctica.':'Elige un oficio. Aprenderás una receta, reunirás materiales y fabricarás dos componentes para la práctica.',choices:[]};
  for(const[job,cfg]of Object.entries(PROFESSION_TUTORIAL.jobs).filter(([,c])=>!c.recipe===gathering)){
   nodes[page].choices!.push({text:RPG_CATALOG.professions[job],next:`choose_${job}`});
   nodes[`choose_${job}`]={get text(){return `${t('El maestro de {job} te guiará en la práctica.',{job:t(RPG_CATALOG.professions[job])})}\n\n${t('La herramienta básica cuesta 20 Pelines en Herrería.')}${cfg.recipe?` ${t('El pergamino de componente cuesta 50; úsalo desde la mochila para aprender la receta.')}`:''} ${t('El recado de Gnomi, el botín y el comercio con jugadores pueden ayudarte a conseguir dinero.')}\n\n${t('La entrega de práctica se paga una sola vez y no consume encargos diarios.')}`;},get quest(){return {title:`${t(PROFESSION_TUTORIAL.title)} · ${t(RPG_CATALOG.professions[job])}`,objective:cfg.recipe?'Visita al maestro, equipa la herramienta, aprende la receta, extrae materiales y fabrica, recoge y entrega dos componentes.':'Visita al maestro, equipa la herramienta, extrae materiales y entrega el suministro de práctica.',...PROFESSION_TUTORIAL.reward};},choices:[{text:'Aceptar misión',action:()=>act('tutorial_accept',{job,master:'gnomi'}),next:`accepted_${job}`},{text:'Elegir otro oficio',next:page}]};
   nodes[`accepted_${job}`]={get text(){return t('Busca al maestro de {job} en el Barrio de los Artesanos. El diario y los marcadores te guiarán. Al terminar la práctica, vuelve a hablar con él.',{job:t(RPG_CATALOG.professions[job])});},choices:[{text:'Vamos al taller.'}]};
  }
  nodes[page].choices!.push({text:'Volver',next:'intro'});
 }
 return addGnomiNeighborhood({speaker,subtitle,emblem:'guild',start:'intro',nodes},getState,act);
}
export function addProfessionTutorial(nodes:Record<string,DialogNode>,job:string,service:TutorialService):DialogChoice{
 const state=()=>service.getState(),q=()=>tutorialProgress(state());
 nodes.tutorial={get text(){return tutorialStep(state())==='report'?t('Ya has entregado el suministro. Confirma para completar la misión.'):`${t('Vamos con {job}.',{job:t(RPG_CATALOG.professions[job])})}\n\n${tutorialObjective(state(),t)}`;},get quest(){return tutorialStep(state())==='report'?{title:`${t(PROFESSION_TUTORIAL.title)} · ${t(RPG_CATALOG.professions[job])}`,objective:'Confirma con el maestro para completar la misión.',...PROFESSION_TUTORIAL.reward,turnIn:true}:undefined;},choices:[
  {text:'Empezar la práctica',when:()=>!!q()&&!q()!.visited,action:()=>service.act('tutorial_visit',{master:service.master}),next:'tutorial'},
  {text:'Entregar el suministro de mi práctica',when:()=>tutorialStep(state())==='deliver',action:()=>service.act('tutorial_supply',{master:service.master}),next:'tutorial'},
  {text:'Completar misión',when:()=>tutorialStep(state())==='report',action:()=>service.act('tutorial_complete',{master:service.master}),next:'tutorial_done'},
  {text:'Abrir el libro del oficio',when:()=>tutorialStep(state())!=='report',action:service.openBook},
  {text:'Abrir mochila',when:()=>tutorialStep(state())!=='report',action:service.openInventory},
  {text:'¿Cómo consigo dinero y materiales?',when:()=>tutorialStep(state())!=='report',next:'tutorial_help'},
  {text:'Volver a mis preguntas',next:'intro'},
 ]};
 nodes.tutorial_help={text:'El recado de Gnomi paga 100 Pelines una vez. Una herramienta básica cuesta 20 en Herrería y el pergamino de componente de Aprendiz cuesta 50.\n\nConsigue materiales recolectando, con botín o comerciando con jugadores. Los comerciantes no compran materias primas, pero sí productos terminados y otro botín válido.',choices:[{text:'Volver a mi práctica',next:'tutorial'}]};
 nodes.tutorial_done={get text(){return t('Bien hecho. Has completado la práctica y ganado {xp} XP. Puedes seguir con este oficio o probar otro.',{xp:PROFESSION_TUTORIAL.reward.experience});},choices:[{text:'Seguir con el oficio',next:'intro'}]};
 return{text:'Mi iniciación al oficio',next:'tutorial',when:()=>q()?.job===job&&q()?.status==='active'};
}

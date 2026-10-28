import type {CharData} from '../data/data';
import {RPG_CATALOG} from '../data/professions';
import {PROFESSION_TUTORIAL,tutorialProgress,tutorialObjective,tutorialStep} from '../data/professionTutorial';
import type {Conversation,DialogNode,DialogChoice} from '../ui/dialog';
export interface TutorialService{getState:()=>CharData;act:(action:string,args:Record<string,unknown>)=>Promise<boolean>;master:string;openBook:()=>void;openInventory:()=>void}
export function professionTutorialConversation(getState:()=>CharData,act:TutorialService['act'],speaker:string,subtitle:string):Conversation{
 const q=tutorialProgress(getState()),nodes:Record<string,DialogNode>={};
 if(q){nodes.intro={text:q.status==='completed'?"¡Ya has hecho tu primer recorrido por un oficio! ¿Qué tal te has encontrado en el taller? Puedes seguir practicando, vender tus piezas o pasarte por otro. A lo mejor descubres algo que también te guste.":`Elegiste ${RPG_CATALOG.professions[q.job]}. El maestro te espera para practicar.\n\n${tutorialObjective(getState())}`};return{speaker,subtitle,emblem:'guild',start:'intro',nodes};}
 nodes.intro={text:"Ahora que has descansado, ¿te apetece que nos acerquemos a los talleres? Me hace ilusión enseñarte lo que se hace por allí. Podemos empezar por un oficio: reunir lo necesario, probar con nuestras manos y llevarle un suministro al maestro.\n\nEsta elección solo decide tu tutorial. Puedes aprender todos los oficios.",choices:[{text:'Quiero fabricar algo.',next:'production'},{text:'Prefiero empezar recolectando.',next:'gathering'}]};
 for(const gathering of [false,true]){
  const page=gathering?'gathering':'production';
  nodes[page]={text:gathering?'Elige qué quieres recolectar. Probarás la herramienta, extraerás recursos y entregarás un suministro.':'Elige qué quieres fabricar. Comprarás y usarás una receta, conseguirás materiales, fabricarás y recogerás dos componentes y entregarás el suministro.',choices:[]};
  for(const[job,cfg]of Object.entries(PROFESSION_TUTORIAL.jobs).filter(([,c])=>!c.recipe===gathering)){
   nodes[page].choices!.push({text:RPG_CATALOG.professions[job],next:`choose_${job}`});
   nodes[`choose_${job}`]={text:`Te orientaré hacia ${RPG_CATALOG.professions[job]}. El maestro te enseñará con los mismos objetos, precios y tiempos del oficio normal.\n\nLas herramientas básicas cuestan 20 Pelines en Herrería.${cfg.recipe?' El pergamino de componente cuesta 50 Pelines y se aprende al usarlo desde la mochila.':''} Puedes conseguir dinero con botín, ventas y los suministros diarios de los maestros.\n\nLa entrega final usa uno de los tres encargos diarios compartidos. Si ya los has gastado, podrás avanzar y entregar al renovarse el cupo.`,quest:{title:`${PROFESSION_TUTORIAL.title} · ${RPG_CATALOG.professions[job]}`,objective:cfg.recipe?'Visita al maestro, equipa la herramienta, aprende la receta, extrae materiales, fabrica y recoge dos componentes y entrega el suministro diario.':'Visita al maestro, equipa la herramienta, extrae materiales y entrega su suministro diario.',...PROFESSION_TUTORIAL.reward},choices:[{text:'Aceptar misión',action:()=>act('tutorial_accept',{job,master:'gnomi'}),next:`accepted_${job}`},{text:'Elegir otro oficio',next:page}]};
   nodes[`accepted_${job}`]={text:`Busca al maestro de ${RPG_CATALOG.professions[job]} en el Barrio de los Artesanos. He dejado el recorrido en tu diario; las marcas te indicarán cada destino. Cuando hayas cobrado el suministro, completa la misión con él.`,choices:[{text:'Vamos al taller.'}]};
  }
  nodes[page].choices!.push({text:'Volver',next:'intro'});
 }
 return{speaker,subtitle,emblem:'guild',start:'intro',nodes};
}
export function addProfessionTutorial(nodes:Record<string,DialogNode>,job:string,service:TutorialService):DialogChoice{
 const state=()=>service.getState(),q=()=>tutorialProgress(state());
 nodes.tutorial={get text(){return tutorialStep(state())==='report'?'Ya has reunido materiales, preparado el suministro y cobrado tu trabajo. Ahora sabes cómo continuar por tu cuenta.':`Gnomi me ha contado que quieres probar ${RPG_CATALOG.professions[job]}. Vamos paso a paso.\n\n${tutorialObjective(state())}\n\nUsarás los materiales, herramientas y trabajos normales. Puedes vender botín o entregar suministros de otros maestros para financiarte; todos comparten tres entregas al día.`;},get quest(){return tutorialStep(state())==='report'?{title:`${PROFESSION_TUTORIAL.title} · ${RPG_CATALOG.professions[job]}`,objective:'Has recorrido el oficio y cobrado tu suministro. Confirma con el maestro para completar la misión.',...PROFESSION_TUTORIAL.reward,turnIn:true}:undefined;},choices:[
  {text:'Empezar la práctica',when:()=>!!q()&&!q()!.visited,action:()=>service.act('tutorial_visit',{master:service.master}),next:'tutorial'},
  {text:'Completar misión',when:()=>tutorialStep(state())==='report',action:()=>service.act('tutorial_complete',{master:service.master}),next:'tutorial_done'},
  {text:'Abrir el libro del oficio',when:()=>tutorialStep(state())!=='report',action:service.openBook},
  {text:'Abrir mochila',when:()=>tutorialStep(state())!=='report',action:service.openInventory},
  {text:'¿Cómo consigo dinero y materiales?',when:()=>tutorialStep(state())!=='report',next:'tutorial_help'},
  {text:'Volver a mis preguntas',next:'intro'},
 ]};
 nodes.tutorial_help={text:'Las herramientas básicas se compran en Herrería y se equipan en Mis herramientas. Si te faltan Pelines, puedes combatir en Pompelín, recoger botín y vender lo que no necesites. Los maestros de recolección pagan suministros básicos; recuerda reservar una entrega diaria para terminar tu práctica.\n\nEl libro muestra los ingredientes y sus fuentes. El cuero procede de criaturas o del comercio. Puedes comerciar por los materiales que te falten. Las piezas en cola siguen trabajando si sales del taller o te desconectas. No se recogen hasta que terminan.',choices:[{text:'Volver a mi práctica',next:'tutorial'}]};
 nodes.tutorial_done={text:`Bien hecho. Ya has obtenido materiales y cobrado un encargo con el oficio normal. Has ganado ${PROFESSION_TUTORIAL.reward.experience} XP por completar la misión.\n\nPuedes seguir practicando para dominar el oficio y comprar recetas mejores. Los proyectos de maestría son un paso posterior.`,choices:[{text:'Seguir con el oficio',next:'intro'}]};
 return{text:'Mi iniciación al oficio',next:'tutorial',when:()=>q()?.job===job&&q()?.status==='active'};
}

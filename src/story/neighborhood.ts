import type {CharData} from '../data/data';
import type {Conversation,DialogNode} from '../ui/dialog';
import {closeDialog} from '../ui/dialog';
import {setWindow} from '../ui/menus';
import {selectHomesTab} from '../ui/homesWindow';
import {NEXT_HOME,homeState} from '../data/homes';
import {NEIGHBORHOOD_PLANS} from '../data/neighborhood';
import {t} from '../ui/i18n';

type Act=(action:string,args:Record<string,unknown>)=>Promise<boolean>;
export function addGnomiNeighborhood(conversation:Conversation,getState:()=>CharData,act:Act):Conversation{
 const nodes=conversation.nodes,errand=()=>getState().rpg?.neighborhood?.errand;
 nodes.intro.choices??=[];
 nodes.intro.choices.unshift({text:'¿Hay algún trabajo tranquilo para empezar?',next:'neighbor_errand'});
 nodes.intro.choices.push({text:'Quiero ver mi habitación de la posada.',action:()=>{closeDialog();selectHomesTab();setWindow('homes');}});
 nodes.intro.choices.push({text:'Estoy pensando en mi siguiente casa.',next:'neighbor_next_home'});
 nodes.neighbor_next_home={get text(){const d=getState(),owned=homeState(d.rpg?.homes).owned.includes(NEXT_HOME.id),done=d.rpg?.neighborhood?.preparations??[];return owned
  ?'¡Ya tienes las llaves! La posada te sigue guardando la habitación. Si quieres llevarte un mueble, recógelo en la mochila y busca su sitio en la casa nueva. Me gustará saber qué rincón preparas primero.'
  :'La Casa del Olmo cuesta 3.500 Pelines, en una sola compra. Puedes ahorrar con ventas, misiones, combate y encargos de oficio. Los proyectos de barrio son opcionales; no necesitas terminarlos ni colocar un mueble para comprarla. No hay alquiler y conservas tu habitación de la posada.';},choices:[{text:'Ver mi siguiente hogar',action:()=>{closeDialog();selectHomesTab();setWindow('homes');}},{text:'Consultar los proyectos del barrio',action:()=>{closeDialog();selectHomesTab('neighborhood');setWindow('homes');}},{text:'Seguir charlando',next:'intro'}]};
 nodes.neighbor_errand={get text(){return errand()==='completed'
  ? 'Me vino bien que pasaras por el taller. Ahora puedo orientar a quien llegue detrás de ti. ¿Pudiste conseguir ya tu herramienta? Puedes aprender una receta y fabricar tu primer mueble.'
  :errand()==='visited'?'¡Has vuelto! Cuéntame qué necesita el maestro. Reservé cien Pelines para este recado; con eso puedes comprar una herramienta básica en Herrería.'
  :errand()==='accepted'?'El maestro de Leñadores está en su taller del Barrio de los Artesanos. Pregúntale qué suministro necesita y vuelve a contármelo. No hace falta que compres nada para hacer el recado.'
  :'Sí. Necesito saber qué suministro está pidiendo el maestro de Leñadores para orientar a los recién llegados. ¿Te acercas a preguntárselo y vuelves a contármelo? Te pagaré cien Pelines por el recado.';},choices:[
   {text:'Aceptar el recado · 100 Pelines al volver',when:()=>!errand(),action:()=>act('neighbor_accept',{master:'gnomi'}),next:'neighbor_errand'},
   {text:'Contarle lo que necesita el taller y cobrar',when:()=>errand()==='visited',action:()=>act('neighbor_report',{master:'gnomi'}),next:'neighbor_errand'},
   {text:'Consultar mi recorrido',action:()=>{closeDialog();selectHomesTab('neighborhood');setWindow('homes');}},
   {text:'Volver a los oficios',next:'intro'},
  ]};
 return conversation;
}
export function addMasterNeighborhood(conversation:Conversation,job:string,getState:()=>CharData,act:Act):Conversation{
 const nodes=conversation.nodes;nodes.intro.choices??=[];
 const preparation=Object.entries(NEIGHBORHOOD_PLANS).find(([,p])=>p.job===job);
 if(preparation){const[id,plan]=preparation;nodes.intro.choices.unshift({text:plan.label,next:'neighbor_preparation'});
  nodes.neighbor_preparation={get text(){return getState().rpg?.neighborhood?.preparations?.includes(id)?plan.thanks:t(plan.description)+'\n\n'+t('Lo revisamos juntos antes de entregar los materiales. Este proyecto queda guardado y no tiene plazo.');},choices:[{text:'Revisar materiales y recompensa',action:()=>{closeDialog();selectHomesTab('neighborhood');setWindow('homes');}},{text:'Volver al taller',next:'intro'}]};
 }
 if(job==='lenador'){
  nodes.intro.choices.unshift({text:'Gnomi pregunta qué suministro necesitas.',when:()=>getState().rpg?.neighborhood?.errand==='accepted',action:()=>act('neighbor_visit',{master:'maestro_lenador'}),next:'neighbor_supply'});
  nodes.neighbor_supply={text:'Para los encargos diarios pedimos hachas nuevas fabricadas por quien las entrega. La práctica única de Leñador conserva la entrega de seis robles para enseñar la extracción, fuera del cupo diario. Díselo a Gnomi.',choices:[{text:'Se lo contaré.',next:'intro'}]};
 }
 if(job==='cocina'){
  nodes.intro.choices.unshift({text:'¿Preparamos algo para compartir?',next:'neighbor_picnic'});
  nodes.neighbor_picnic={text:'Cada día encontrarás tres recetas de tu rango de Cocina. En grupo el líder elige una del suyo y todos podéis aportar. Cada contribuyente puede recoger una ración, Pelines y experiencia de Cocina; el límite es de dos recompensas diarias por persona. Las preparaciones se cancelan tras treinta minutos sin aportaciones mientras haya participantes conectados y devuelven los ingredientes.',choices:[{text:'Ver ingredientes y aportar',action:()=>{closeDialog();selectHomesTab('neighborhood');setWindow('homes');}},{text:'Volver a la cocina',next:'intro'}]};
 }
 if(job==='ebanisteria'){
  nodes.intro.choices.unshift({text:'Quiero preparar mi habitación.',next:'neighbor_home'});
  nodes.neighbor_home={get text(){const count=getState().rpg?.furniture.filter(f=>f.location==='habitacion_posada_lucero_del_alba').length??0;return count?'Ya has empezado a colocar tus piezas. Ahora piensa qué te falta para estar a gusto: sentarte, leer o dejar una luz al volver. Elige una receta que conozcas y reúne sus materiales; el sitio de cada cosa lo decides tú.':'Empieza por algo que te apetezca ver todos los días: una silla, una mesita o un macetero. Las recetas de Aprendiz se compran aquí por cincuenta Pelines. Las aprendes desde la mochila y trabajas con roble.\n\nEn Mis viviendas puedes ver tu habitación y colocar lo que termines. La cama y el cofre ya están allí; no tienes que fabricarlo todo para poder instalarte.';},choices:[{text:'Revisar mi vivienda',action:()=>{closeDialog();selectHomesTab();setWindow('homes');}},{text:'Volver al taller',next:'intro'}]};
 }
 return conversation;
}

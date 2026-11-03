import type { Conversation, DialogChoice, DialogNode } from '../ui/dialog';
import { addRecipeTraining, type RecipeTraining } from './recipeTraining';
import { t } from '../ui/i18n';
import {addDailyOrders,type DailyOrderService} from './dailyOrders';
import {addProfessionTutorial,type TutorialService} from './professionTutorial';
import {addWorkshopMission,WORKSHOP_MISSION_JOBS,type WorkshopMissionJob,type WorkshopMissionService} from '../data/workshopMissions';

export type ProfessionSection = 'recipes' | 'jobs' | 'tools' | 'mastery';
type ProfessionKind = 'timed' | 'instant' | 'gathering';
interface ProfessionGuide {
  label: string;
  kind: ProfessionKind;
  welcome: string;
  summary: string;
  question: string;
  answer: string;
  firstStep: string;
  materials: string;
  tool?: string;
}

/** Short workshop introductions, also available to the profession book. */
export const PROFESSION_GUIDES = {
  herreria: {
    label: 'Herrería', kind: 'timed',
    welcome: 'Pasa. ¿Qué necesitas para la forja?',
    summary: 'Aquí fabricamos armas, armaduras y herramientas de recolección.',
    question: '¿Puedo fabricar mis herramientas?',
    answer: 'Sí. Aquí puedes fabricar picos, hachas y hoces. Las herramientas básicas también se compran en Herrería.',
    firstStep: 'Empieza con una receta de Aprendiz y mira qué mineral necesita.',
    materials: 'Minero extrae minerales en Pompelín. También puedes comerciar con otros jugadores.',
  },
  peleteria: {
    label: 'Peletería', kind: 'timed',
    welcome: 'Pasa. ¿Buscas una pieza de cuero?',
    summary: 'Preparamos cuero y fabricamos protecciones ligeras.',
    question: '¿Cómo consigo cuero de mayor rango?',
    answer: 'Lo dejan los jabalíes más fuertes. También puedes prepararlo aquí con cuatro cueros del rango anterior y dos hierbas, si conoces la receta.',
    firstStep: 'Elige una receta de Aprendiz y comprueba el cuero que necesita.',
    materials: 'Los bandidos y jabalíes dejan cuero básico; los jabalíes más fuertes dejan cueros de mayor rango.',
  },
  sastreria: {
    label: 'Sastrería', kind: 'timed',
    welcome: 'Pasa. ¿Buscas algún patrón?',
    summary: 'Confeccionamos vestiduras para magos y clérigos.',
    question: '¿Qué prendas puedo confeccionar?',
    answer: 'Encontrarás piezas para la cabeza, el pecho, las manos y las piernas. Cada receta indica su clase y sus materiales.',
    firstStep: 'Elige una receta de Aprendiz y comprueba las fibras que necesita.',
    materials: 'Recolector consigue fibras en Pompelín. También puedes comprarlas a otros jugadores.',
  },
  carpinteria: {
    label: 'Carpintería', kind: 'timed',
    welcome: 'Pasa. ¿Vienes por un arma de madera?',
    summary: 'Aquí hacemos ballestas, bastones y varitas.',
    question: '¿Qué necesito para fabricar un arma?',
    answer: 'Cada receta indica la madera y los demás materiales. Consulta también el rango necesario antes de comprarla.',
    firstStep: 'Elige una receta de Aprendiz y comprueba la madera que necesita.',
    materials: 'Leñador obtiene madera en Pompelín. Algunas recetas también piden componentes.',
  },
  ebanisteria: {
    label: 'Ebanistería', kind: 'timed',
    welcome: 'Pasa. ¿Qué te gustaría hacer para tu casa?',
    summary: 'Fabricamos muebles y bancos de trabajo.',
    question: '¿Dónde puedo colocar los muebles?',
    answer: 'En una vivienda habilitada. Abre «Mis viviendas» para gestionarla y decorarla.',
    firstStep: 'Elige un mueble de Aprendiz y revisa la madera y los componentes que necesita.',
    materials: 'Leñador consigue madera en Pompelín. La receta indica los componentes y el tiempo de fabricación.',
  },
  joyeria: {
    label: 'Joyería', kind: 'timed',
    welcome: 'Acércate. ¿Buscas alguna joya?',
    summary: 'Aquí hacemos anillos, colgantes y abalorios.',
    question: '¿Cómo elijo una pieza?',
    answer: 'Mira sus atributos y los materiales de la receta. No todas las joyas ofrecen las mismas ventajas.',
    firstStep: 'Elige una receta de Aprendiz y comprueba sus materiales.',
    materials: 'Minero extrae minerales y gemas en Pompelín.',
  },
  alquimia: {
    label: 'Alquimia', kind: 'instant',
    welcome: 'Pasa. ¿Qué poción quieres preparar?',
    summary: 'Preparamos pociones de vida, maná y estamina.',
    question: '¿Qué recuperan las pociones?',
    answer: 'Vida, maná o estamina, según la receta. Las pociones se preparan al instante.',
    firstStep: 'Elige una poción de Aprendiz y comprueba sus ingredientes.',
    materials: 'Recolector encuentra hierbas y otros ingredientes en Pompelín.',
  },
  encantamiento: {
    label: 'Encantamiento', kind: 'timed',
    welcome: '¿Quieres fabricar un pergamino o encantar un arma?',
    summary: 'Fabricamos pergaminos que añaden efectos al arma principal.',
    question: '¿Necesito este oficio para encantar un arma?',
    answer: 'No. Cualquiera puede aplicar un pergamino desde «Encantar un arma». Para fabricarlo sí necesitas la receta de Encantamiento.',
    firstStep: 'Empieza por los componentes de Aprendiz y consulta el rango de cada pergamino.',
    materials: 'Recolector obtiene ingredientes en Pompelín. Cada receta indica sus materiales.',
  },
  cocina: {
    label: 'Cocina', kind: 'instant',
    welcome: 'Pasa. ¿Qué quieres cocinar?',
    summary: 'Preparamos comida que aumenta tus reservas máximas.',
    question: '¿La comida cura?',
    answer: 'No. Aumenta la reserva máxima que indica el plato, pero no la rellena. Para recuperarte, descansa o usa una poción.',
    firstStep: 'Elige una receta de Aprendiz y comprueba sus ingredientes.',
    materials: 'Recolector encuentra cereal, fruta y hongos en Pompelín.',
  },
  minero: {
    label: 'Minero', kind: 'gathering', tool: 'pico',
    welcome: '¿Tienes un pico? Si no, puedes comprar uno básico en Herrería.',
    summary: 'En Pompelín encontrarás minerales y gemas.',
    question: '¿Puedo extraer cualquier mineral?',
    answer: 'Necesitas suficiente energía y un pico en buen estado. Los recursos de rango alto cuestan más; algunos requieren que avances primero.',
    firstStep: 'Equipa un pico, acércate a un yacimiento en Pompelín y pulsa E.',
    materials: 'El cuaderno muestra minerales, gemas y su coste de energía. En Pompelín puedes marcar el recurso disponible más cercano.',
  },
  lenador: {
    label: 'Leñador', kind: 'gathering', tool: 'hacha de tala',
    welcome: '¿Qué madera buscas? Necesitarás un hacha de tala.',
    summary: 'La madera sirve para Carpintería y Ebanistería.',
    question: '¿Dónde reparo mi hacha?',
    answer: 'En Herrería. Repararla cuesta Pelines y reduce poco a poco su durabilidad máxima; restaurarla recupera el máximo original.',
    firstStep: 'Equipa un hacha de tala, acércate a un árbol en Pompelín y pulsa E.',
    materials: 'El cuaderno muestra las maderas y su coste de energía. En Pompelín puedes marcar el recurso disponible más cercano.',
  },
  recolector: {
    label: 'Recolector', kind: 'gathering', tool: 'hoz',
    welcome: '¿Buscas hierbas, fibras o ingredientes para cocinar?',
    summary: 'Con una hoz puedes recoger plantas y alimentos en Pompelín.',
    question: '¿Qué puedo recoger?',
    answer: 'Hierbas, fibras, hongos, cereales, fruta y bayas. El cuaderno indica dónde encontrar cada recurso y cuánta energía cuesta.',
    firstStep: 'Equipa una hoz, acércate a un recurso en Pompelín y pulsa E.',
    materials: 'El cuaderno muestra los recursos disponibles y su coste de energía. En Pompelín puedes marcar el más cercano.',
  },
} satisfies Record<string, ProfessionGuide>;

export type GuidedProfession = keyof typeof PROFESSION_GUIDES;
export interface ProfessionMasterOptions {
  job: string;
  name: string;
  subtitle: string;
  /** Choices without `next` close normally after this synchronous callback. */
  onOpen: (section: ProfessionSection) => void;
  training?: RecipeTraining;
  dailyOrders?:DailyOrderService;
  tutorial?:TutorialService;
  workshopMission?:WorkshopMissionService;
}

/** A focused lesson and a direct route into the matching part of the book. */
export function professionMasterConversation({job,name,subtitle,onOpen,training,dailyOrders,tutorial,workshopMission}:ProfessionMasterOptions):Conversation {
  if(!Object.hasOwn(PROFESSION_GUIDES,job))throw new Error(`Oficio sin guía: ${job}`);
  const guide:ProfessionGuide=PROFESSION_GUIDES[job as GuidedProfession];
  const gathering=guide.kind==='gathering',timed=guide.kind==='timed';
  const open=(section:ProfessionSection,text:string):DialogChoice=>({text,action:()=>onOpen(section)});
  const book=open('recipes',gathering?'Consultar los recursos':'Ver las recetas');
  const back:DialogChoice={text:'Volver a mis preguntas',next:'intro'};
  const lessonChoices:DialogChoice[]=[book,back];
  const nodes:Record<string,DialogNode>={
    intro:{
      get text(){return `${t(guide.welcome)}\n\n${t(guide.summary)}`;},
      choices:[
        {text:'¿Cómo empiezo?',next:'first'},book,
        gathering?open('tools','Revisar mis herramientas'):open('jobs','Consultar mis trabajos'),
        ...(!gathering?[{text:'¿Cómo se fabrica?',next:'work'}]:[]),
        {text:'¿Cómo avanzo en este oficio?',next:'progress'},
        {text:guide.question,next:'trade'},
      ],
    },
    first:{
      get text(){return gathering?t(guide.firstStep):`${t('Compra un pergamino al maestro y úsalo desde la mochila para aprender la receta.')}\n\n${t(guide.firstStep)}`;},
      choices:[
        book,
        {text:gathering?'¿Qué necesito saber antes de recolectar?':'¿De dónde salen los materiales?',next:gathering?'field':'materials'},
        ...(!gathering?[{text:'¿Cómo se fabrica?',next:'work'}]:[]),back,
      ],
    },
    trade:{text:guide.answer,choices:lessonChoices},
    materials:{text:guide.materials,choices:lessonChoices},
    progress:{
      text:'Cada oficio progresa por separado. Gana experiencia fabricando o recolectando; las tareas demasiado fáciles dejan de darla.\n\nIniciado y Oficial se alcanzan automáticamente. Para los rangos superiores también necesitas un proyecto de maestría.',
      choices:[open('mastery','Ver mi progreso y los proyectos'),{text:gathering?'¿Necesito aprender cada recurso?':'¿Cómo consigo nuevas recetas?',next:'learning'},back],
    },
    learning:{
      text:gathering
        ? 'No necesitas una receta para cada recurso. Tu rango reduce el coste de energía y el desgaste de la herramienta.'
        : 'Compra el pergamino al maestro y úsalo desde la mochila. Necesitas el rango de la receta.\n\nLos pergaminos excepcionales de Gran maestro no se venden: son botín muy raro.',
      choices:gathering?[book,open('tools','Ver mis herramientas'),back]:lessonChoices,
    },
  };
  if(gathering){
    nodes.field={
      text:'Los tres oficios de recolección comparten 100 de energía, que se recupera con el tiempo. Los recursos más difíciles cuestan más.\n\nLa energía y la durabilidad se gastan al terminar. Moverte o recibir daño interrumpe la extracción. Otros jugadores no agotan tus recursos.',
      choices:[{text:'¿Y si se estropea la herramienta?',next:'maintenance'},{text:'Consultar los recursos de este oficio',next:'materials'},book,back],
    };
    nodes.maintenance={
      text:'Compra y repara herramientas en Herrería. Si su durabilidad llega a cero, no podrás usarlas hasta repararlas.\n\nLas reparaciones reducen su máximo; una restauración recupera el estado original.',
      choices:[open('tools','Revisar mis herramientas'),back],
    };
  }else if(timed){
    nodes.work={
      text:'Encarga la pieza en una estación del oficio. Puedes usar materiales de la mochila y del banco.\n\nHay un trabajo activo y cuatro en espera. La cola sigue avanzando sin conexión, a un tercio del ritmo normal.',
      choices:[open('jobs','Ver mis trabajos'),{text:'¿Cómo recojo o cancelo una pieza?',next:'orders'},book,back],
    };
    nodes.orders={
      text:'En una estación del oficio puedes recoger las piezas y cambiar el orden de la cola.\n\nAl cancelar un trabajo sin terminar, pierdes su avance y recuperas todos los materiales desde Entregas.',
      choices:[open('jobs','Abrir mis trabajos'),back],
    };
  }else{
    nodes.work={
      text:'Fabrica en una estación del oficio con materiales de la mochila o del banco. La comida y las pociones son instantáneas; los componentes usan la cola de trabajos.',
      choices:[open('jobs','Ver mis trabajos'),...lessonChoices],
    };
  }
  if(!gathering&&training){const shop=addRecipeTraining(nodes,job,training);nodes.intro.choices!.splice(1,0,shop);nodes.learning.choices!.unshift(shop);nodes.first.choices!.unshift(shop);}
  if(dailyOrders)nodes.intro.choices!.splice(1,0,addDailyOrders(nodes,job,dailyOrders));
  if(tutorial)nodes.intro.choices!.unshift(addProfessionTutorial(nodes,job,tutorial));
  const missionJob=WORKSHOP_MISSION_JOBS.find((value):value is WorkshopMissionJob=>value===job);
  if(workshopMission&&missionJob)nodes.intro.choices!.push(addWorkshopMission(nodes,missionJob,guide.label,workshopMission));
  return {speaker:name,subtitle,emblem:job==='herreria'?'anvil':undefined,start:'intro',nodes};
}

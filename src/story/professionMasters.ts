import type { Conversation, DialogChoice, DialogNode } from '../ui/dialog';
import { addRecipeTraining, type RecipeTraining } from './recipeTraining';
import { t } from '../ui/i18n';
import {addDailyOrders,type DailyOrderService} from './dailyOrders';
import {addProfessionTutorial,type TutorialService} from './professionTutorial';

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
    welcome: "Si has venido a admirar el yunque, hazlo desde ese lado. Desde este trabajo yo. ¿Qué necesitas?",
    summary: "Armas, armaduras, herramientas. Sí, los picos también. A algunos se les olvida que el metal hay que sacarlo de alguna parte antes de venir a pedirme una espada.",
    question: "¿Qué harías primero: un arma o una herramienta?",
    answer: "Depende. Si ya tienes un arma que te sirve, no la cambies solo por estrenar algo. Mira qué materiales necesitas y quién los consigue. Un buen pico también acaba convertido en espadas, aunque dé más vueltas.",
    firstStep: 'Empieza por una receta de Aprendiz. Mira sus materiales y aprende a hacerla antes de encargar tu primera pieza.',
    materials: 'Los minerales vienen de los yacimientos de Pompelín. También puedes conseguir materiales comerciando con otros jugadores.',
  },
  peleteria: {
    label: 'Peletería', kind: 'timed',
    welcome: "Si traes cuero, extiéndelo en la mesa. Quiero verlo entero antes de que me digas lo que vamos a sacar de él.",
    summary: "Hacemos protecciones ligeras. Me interesa el cuero que has traído, no lo grande que era el jabalí. La historia me la cuentas mientras preparamos la pieza.",
    question: "¿Y si no quiero salir a cazar?",
    answer: "Compra el cuero. Yo no te voy a examinar de caza delante del banco. También puedes preparar cueros superiores aquí, cuando tengas el rango y la receta: cuero del rango anterior, hierbas y tiempo. Lo que te pido es material; cómo llegues con él es cosa tuya.",
    firstStep: 'Busca una receta de Aprendiz y comprueba el cuero que pide. Apréndela y trae los materiales para fabricar tu primera pieza.',
    materials: 'Jabalíes y bandidos dejan cuero básico. Los jabalíes más difíciles de Pompelín proporcionan cueros superiores. También puedes prepararlos aquí: cuatro cueros del rango anterior, dos hierbas del rango que buscas y tiempo de taller. Aprende cada preparación cuando domines su rango.',
  },
  sastreria: {
    label: 'Sastrería', kind: 'timed',
    welcome: "Pasa. Quieto un momento… No, no tienes nada pegado. Estaba mirando las costuras. Mala costumbre mía.",
    summary: "Aquí hacemos vestiduras, sobre todo para magos y clérigos. Puedes mirar todos los patrones que quieras. Solo te pido que no los pongas encima de las fibras; luego no encuentro nada.",
    question: "¿Tengo que empezar por la ropa más sencilla?",
    answer: "Por Aprendiz, sí. Por algo que te parezca feo, no. Mira las recetas de tu rango y elige una pieza que quieras usar. Vas a pasar bastante rato viéndola; yo empezaría por ahí.",
    firstStep: 'Elige una receta de Aprendiz, revisa sus fibras y apréndela. Con todos los materiales preparados, podrás encargar la confección.',
    materials: 'Recolector consigue las fibras en Pompelín. También puedes comprar materiales a otros jugadores; no es necesario recogerlos personalmente.',
  },
  carpinteria: {
    label: 'Carpintería', kind: 'timed',
    welcome: "¿Has venido por las ballestas? Di que sí, que casi todo el mundo pregunta por los bastones.",
    summary: "También hago bastones, claro. Y varitas. Pero déjame tener mis preferencias. La madera la traen los leñadores de Pompelín; en la receta verás cuál necesitamos.",
    question: "Pues yo venía por un bastón.",
    answer: "Ya decía yo que duraba mucho la alegría. A ver qué receta te sirve. Comprueba tu rango y la madera antes de comprar el pergamino; no me traigas medio bosque al azar.",
    firstStep: 'Abre una receta de Aprendiz y comprueba qué madera necesita. Aprende esa receta y reúne sus materiales antes de encargar la pieza.',
    materials: 'Leñador obtiene las maderas en Pompelín. Las recetas pueden pedir también componentes y otros materiales, que se detallan en el libro.',
  },
  ebanisteria: {
    label: 'Ebanistería', kind: 'timed',
    welcome: "¿Para qué rincón lo quieres? Siempre pregunto eso antes de enseñar los muebles. Un taburete también necesita su sitio.",
    summary: "Mesas, bibliotecas, bancos de trabajo… Me gusta imaginar qué vas a poner encima. Luego tú haces lo que quieras, por supuesto. Casi siempre.",
    question: "Solo quería un taburete.",
    answer: "Pues un taburete. No voy a colocarte una biblioteca por insistencia. Busca uno de tu rango y comprueba que tengas dónde ponerlo: los muebles necesitan un interior habilitado. Eso sí, piensa el sitio antes de encargarlo. Yo lo pensaría.",
    firstStep: 'Un mueble de Aprendiz es un buen comienzo. Aprende su receta y revisa la madera y los componentes que requiere.',
    materials: 'Leñador proporciona las maderas. El tiempo de fabricación depende de la calidad, el tamaño y la complejidad del mueble; lo verás antes de encargarlo.',
  },
  joyeria: {
    label: 'Joyería', kind: 'timed',
    welcome: "Acércate. No hace falta levantar la voz; las gemas no hacen ruido y yo todavía oigo bien.",
    summary: "Anillos, colgantes y abalorios. Son piezas pequeñas, pero también cuentan en tu equipo. Puedes tomarte tu tiempo para elegir; a mí me gusta mirarlas despacio.",
    question: "¿La gema más bonita hace la mejor pieza?",
    answer: "Para mirarla, quizá. Para llevarla al camino, comprueba qué aporta la pieza y qué materiales pide su receta. Yo puedo encapricharme con una gema; tú no tienes por qué pagar mis caprichos.",
    firstStep: 'Elige una receta de Aprendiz. Comprueba las gemas y los demás materiales, aprende la receta y prepara tu primera pieza.',
    materials: 'Minero extrae minerales y gemas de Pompelín. El libro distingue los materiales que tienes de los que todavía te faltan.',
  },
  alquimia: {
    label: 'Alquimia', kind: 'instant',
    welcome: "¿Qué has traído? Espera, no lo mezcles todavía. Me gusta ver qué hay antes de empezar a tener ideas.",
    summary: "Pociones de vida, maná y estamina. Yo las prepararía todas; tú seguramente querrás conservar algún ingrediente. Vamos a mirar qué necesitas de verdad.",
    question: "¿No podemos probar a mezclarlo todo?",
    answer: "Ganas no me faltan. Ingredientes, sí. Y tú has venido por una poción que te sirva. Empezamos con una receta aprendida y sus cantidades; cuando veas qué reserva recupera, sabrás cuál llevarte al camino.",
    firstStep: 'Empieza por una poción de Aprendiz. Aprende su receta y comprueba que traes las hierbas, la fruta y los demás ingredientes indicados.',
    materials: 'Recolector obtiene ingredientes silvestres en Pompelín. Revisa qué reserva recupera cada poción antes de fabricarla.',
  },
  encantamiento: {
    label: 'Encantamiento', kind: 'timed',
    welcome: "¿Quieres encantar un arma o fabricar un pergamino? Te lo pregunto ahora para no descubrir a mitad de la explicación que hablamos de cosas distintas.",
    summary: "Aquí hacemos los pergaminos. Después se aplican al arma principal desde «Encantar un arma». Puedes guardar uno hasta decidirte. Decidirse antes también es una posibilidad que recomiendo mucho.",
    question: "¿Y si todavía no sé qué arma voy a usar?",
    answer: "Entonces todavía no lo apliques. El pergamino puede esperar en tu mochila. Consulta el efecto, elige el arma y vuelve a leerlo antes de confirmar. Sí, otra vez. Es más barato leer dos veces que gastar por impaciencia.",
    firstStep: 'Consulta las recetas y empieza por los componentes de Aprendiz. Para los pergaminos, revisa el dominio y la receta que te falten.',
    materials: 'Cada receta indica sus materiales. Fabricar el pergamino lleva tiempo; aplicarlo al arma es una acción distinta, desde «Encantar un arma».',
  },
  cocina: {
    label: 'Cocina', kind: 'instant',
    welcome: "¿Vienes a cocinar o a decirme que no tienes hambre? Para lo primero hay mesa. Para lo segundo, ya hablaremos cuando vuelvas del camino.",
    summary: "Preparamos provisiones que aumentan tus reservas de vida y de maná o estamina. Las heridas te las curas antes: a mí me traes ingredientes, no un susto en mitad de la cocina.",
    question: "¿Con comer basta para recuperarme?",
    answer: "Ojalá. Me ahorraría muchas discusiones. La comida aumenta tus reservas máximas, pero no las rellena por sí sola. Si vienes herido, descansa o toma una poción. Luego ya vemos qué te preparo para salir.",
    firstStep: 'Empieza por una receta de Aprendiz. Apréndela y reúne las cantidades de cereal y demás ingredientes que indique.',
    materials: 'Recolector encuentra cereal, fruta y hongos en Pompelín. La ficha del plato explica su efecto; comer no rellena por sí solo las reservas.',
  },
  minero: {
    label: 'Minero', kind: 'gathering', tool: 'pico',
    welcome: "¿Tienes prisa? El yacimiento, no. Empieza por enseñarme el pico.",
    summary: "Minerales y gemas, fuera de Brumaluz. Si solo buscas lo que brilla, vas a dejar atrás mucho material que necesitan los herreros. A mí el mineral corriente también me interesa.",
    question: "¿Voy directo al yacimiento más difícil?",
    answer: "Puedes mirarlo. Antes de picar, mira también cuánto te cuesta: lo difícil para tu dominio gasta más energía. Comparte reserva con Leñador y Recolector. Si quieres salir con algo más que cansancio, empieza por consultar el cuaderno.",
    firstStep: 'Equipa un pico en Mis herramientas. Después busca un yacimiento en Pompelín, acércate y pulsa E para extraerlo.',
    materials: 'El cuaderno distingue los minerales de las gemas y muestra su coste de energía. Desde Pompelín puedes marcar el recurso disponible más cercano.',
  },
  lenador: {
    label: 'Leñador', kind: 'gathering', tool: 'hacha de tala',
    welcome: "Dime qué madera te piden. «Un poco de todo» suele significar que luego cargas con mucho de lo que no era.",
    summary: "Carpinteros y ebanistas necesitan las maderas de Pompelín. Tú trae un hacha de tala cuidada y una idea de qué buscas. Lo de cargar la madera ya te dará trabajo suficiente.",
    question: "Tengo un hacha. ¿Ya puedo salir?",
    answer: "De tala, ¿verdad? Equípala en Mis herramientas y revisa su estado. Si está gastada, a Herrería. No hace falta que me cuentes luego cuánto has tardado con un filo que no cortaba; ya me lo imagino.",
    firstStep: 'Equipa un hacha de tala en Mis herramientas. Sal a Pompelín, busca un recurso de madera y pulsa E a su lado.',
    materials: 'El cuaderno muestra las distintas maderas, su energía y los nodos disponibles. Desde Pompelín puedes señalar el más cercano en el mapa.',
  },
  recolector: {
    label: 'Recolector', kind: 'gathering', tool: 'hoz',
    welcome: "¿Qué andas buscando: hierbas, fibras, algo para cocinar? Dímelo antes de que me ponga a contarte para qué sirve todo lo demás.",
    summary: "Me interesan demasiadas cosas, ya lo irás viendo. Por ahora: una hoz y la lista de materiales de tu receta. Así no vuelves con fruta para una vestidura. Aunque al menos habrás comido.",
    question: "¿No vale con recoger lo que encuentre?",
    answer: "A mí no me mires, que lo haría encantada. Pero tu mochila tiene un límite. Mira si necesitas hierbas, fibras o ingredientes de cocina; el cuaderno distingue las familias y lo que cuesta recogerlas. Después, si queda hueco, ya te entretienes.",
    firstStep: 'Equipa una hoz en Mis herramientas. Busca una planta o ingrediente de campo en Pompelín y pulsa E al acercarte.',
    materials: 'Cada familia tiene su forma y su icono. Consulta el cuaderno para ver qué tienes, qué está disponible y cuánto cuesta recogerlo.',
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
}

/** A focused lesson and a direct route into the matching part of the book. */
export function professionMasterConversation({job,name,subtitle,onOpen,training,dailyOrders,tutorial}:ProfessionMasterOptions):Conversation {
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
        gathering?open('tools','Revisar mis herramientas'):timed?open('jobs','Consultar mis trabajos'):{text:'¿Cómo se fabrica?',next:'work'},
        {text:'¿Cómo avanzo en este oficio?',next:'progress'},
        {text:guide.question,next:'trade'},
      ],
    },
    first:{
      get text(){return gathering?guide.firstStep:`${t("Te vendo el pergamino, pero tendrás que usarlo desde la mochila para aprender la receta. Luego reúne los materiales que pide y acércate al banco.")}\n\n${t(guide.firstStep)}`;},
      choices:[
        book,
        {text:gathering?'¿Qué necesito saber antes de recolectar?':'¿De dónde salen los materiales?',next:gathering?'field':'materials'},
        ...(!gathering?[{text:'¿Cómo se fabrica?',next:'work'}]:[]),back,
      ],
    },
    trade:{text:guide.answer,choices:lessonChoices},
    materials:{text:guide.materials,choices:lessonChoices},
    progress:{
      text:"Puedes aprender todos los oficios, pero tendrás que practicar cada uno. Cuando un trabajo te resulte demasiado fácil, dejará de darte experiencia; prueba entonces algo de más dificultad.\n\nPara llegar a Iniciado y Oficial basta la experiencia. Para Experto, Maestro y Gran maestro tendrás que completar también un proyecto de maestría. Puedes ver lo que pide cada uno en el libro.",
      choices:[open('mastery','Ver mi progreso y los proyectos'),{text:gathering?'¿Necesito aprender cada recurso?':'¿Cómo consigo nuevas recetas?',next:'learning'},back],
    },
    learning:{
      text:gathering
        ? 'En recolección no aprendes una receta por cada recurso. Tu dominio cambia el coste de energía y el desgaste; consulta el cuaderno antes de intentar algo difícil.\n\nLas herramientas las fabrica Herrería. Sus recetas y su calidad son independientes de tu dominio de recolección.'
        : 'Compra los pergaminos de receta hablando conmigo. Cada rango tiene un precio mayor. Al usar un pergamino desde la mochila, lo consumes y aprendes su receta de forma permanente. El libro sirve para consultar materiales y fabricar.\n\nLas excepcionales de Gran maestro no se venden: sus pergaminos son botín muy raro. También los aprendes al usarlos desde la mochila. Necesitas el dominio correspondiente en ambos casos.',
      choices:gathering?[book,open('tools','Ver mis herramientas'),back]:lessonChoices,
    },
  };
  if(gathering){
    nodes.field={
      text:'Minero, Leñador y Recolector comparten una reserva de 100 de energía. Se recupera con el tiempo, también sin conexión. Los recursos más difíciles para tu dominio cuestan más.\n\nLa energía y el desgaste se descuentan al completar la extracción. Moverte o recibir daño la interrumpe. Lo que recojas es tuyo: otro jugador no te agota el recurso.',
      choices:[{text:'¿Y si se estropea la herramienta?',next:'maintenance'},{text:'Consultar los recursos de este oficio',next:'materials'},book,back],
    };
    nodes.maintenance={
      text:'Las herramientas básicas se compran en Herrería. Allí también puedes repararlas con Pelines. Si una llega a cero de durabilidad, se conserva, pero no podrás usarla hasta repararla.\n\nLas reparaciones reducen poco a poco su máximo. Una restauración completa recupera el estado original; el libro muestra los materiales o el gasto que requiere.',
      choices:[open('tools','Revisar mis herramientas'),back],
    };
  }else if(timed){
    nodes.work={
      text:"Pon los materiales en orden y busca la receta aprendida en el banco. Allí eliges cuántas piezas hacer; los materiales quedan reservados al encargarlas.\n\nSolo podemos trabajar en una a la vez, con otras cuatro en espera por oficio. Puedes irte mientras tanto, incluso desconectarte. Las piezas terminadas se guardan hasta que vengas a recogerlas y dejan libre su puesto.",
      choices:[open('jobs','Ver mis trabajos'),{text:'¿Cómo recojo o cancelo una pieza?',next:'orders'},book,back],
    };
    nodes.orders={
      text:'Los trabajos de un oficio se gestionan desde cualquier estación de ese mismo oficio. Puedes recoger los terminados y cambiar el orden de los pendientes.\n\nCancelar devuelve todos los materiales a Entregas, aunque se pierde el avance de esa pieza. Allí los recoges cuando tengas espacio. Recoger una pieza terminada también requiere hueco en la mochila.',
      choices:[open('jobs','Abrir mis trabajos'),back],
    };
  }else{
    nodes.work={
      text:"Si ya conoces la receta, trae los ingredientes a la estación y elige cuánto quieres preparar. Con el dominio necesario, la comida y las pociones quedan listas al momento.\n\nDeja sitio en la mochila: de aquí te las llevas directamente.",
      choices:lessonChoices,
    };
  }
  if(!gathering&&training){const shop=addRecipeTraining(nodes,job,training);nodes.intro.choices!.splice(1,0,shop);nodes.learning.choices!.unshift(shop);nodes.first.choices!.unshift(shop);}
  if(dailyOrders)nodes.intro.choices!.splice(1,0,addDailyOrders(nodes,job,dailyOrders));
  if(tutorial)nodes.intro.choices!.unshift(addProfessionTutorial(nodes,job,tutorial));
  return {speaker:name,subtitle,emblem:job==='herreria'?'anvil':undefined,start:'intro',nodes};
}

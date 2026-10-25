// NPC de la ciudad: sus fichas y conversaciones.
import type { NpcType, TargetDetails } from '../ui/targetFrame';
import type { Conversation, DialogChoice } from '../ui/dialog';
import { session, story, play, fight } from '../game/state';
import { ISBERTO_HOUSE, SHADOW_TITLE } from '../data/quests';
import { t } from '../ui/i18n';
import { damagePlayer, healPlayer, gainExperience, receiveMoney } from '../game/vitals';
import { openVendor } from '../game/inventory';
import { holder } from '../game/stage';
import { performShadow } from './quests';
import { corpseLooted } from './scenes';
import { beginIsbertoEncounter } from '../game/combat';

// ---------------- NPCs ----------------
export interface NpcDef {
  name: string;
  type: NpcType;
  title: string;
  level: number;
  vitals: TargetDetails['vitals'];
  conversation: Conversation;
  barks?: string[];
}
// Mismas opciones y mismo orden en todos los nodos del NPC de prueba.
export const testChoices: DialogChoice[] = [
  { text: 'Hola', next: 'hola' },
  { text: 'Recibir 10 puntos de daño', next: 'dano', action: () => void damagePlayer(session.registeredNpcs.testiculos.name) },
  { text: 'Recibir 10 puntos de vida', next: 'cura', action: () => void healPlayer(session.registeredNpcs.testiculos.name) },
  { text: 'Recibir 200 puntos de experiencia', next: 'xp', action: () => void gainExperience() },
  { text: 'Recibir 100 pelines', next: 'dinero', action: () => void receiveMoney() },
  { text: 'Comerciar', action: () => openVendor('testiculos') },
];
export function isbertoConversation(): Conversation {
  const isberto = { speaker:session.registeredNpcs.isberto.name, subtitle:session.registeredNpcs.isberto.subtitle, emblem:'anvil' as const, start:'intro' };
  const gnomi = { speaker:session.registeredNpcs.gnomi.name, subtitle:session.registeredNpcs.gnomi.subtitle, emblem:'guild' as const };
  const gnomiHere = story.welcomeWorld.root.visible && story.welcomeWorld.root.position.distanceTo(holder.position) < 8;
  const follow = [{ text:'Seguir a Isberto', action:()=>performShadow('report') }];
  if (session.state.shadowQuest === 'defeated' && !corpseLooted()) return { ...isberto,
    nodes:{ intro:{ text:'Buen golpe. Ahora registra los restos antes de que se deshagan. Una pelea no termina hasta que sabes qué te ha atacado.' } } };
  if (session.state.shadowQuest === 'defeated') return { ...isberto, nodes:{
    intro:{ text:'Buen trabajo. Has mantenido el tipo cuando se te ha echado encima. Eso vale más que llevar un arma bonita.\n\nAhora enséñame qué has encontrado. He cruzado medio Pompelín y esto no me gusta nada.', next:gnomiHere ? 'gnomi' : 'isberto' },
    gnomi:{ ...gnomi, text:'¿Estás bien? Cuando se te ha echado encima casi se me sale el corazón.\n\nNo había visto una criatura así. Isberto, ¿tú reconoces eso que ha dejado?', next:'isberto' },
    isberto:{ text:'No. Y no voy a ponerle nombre a ojo. Guarda lo que has encontrado; quizá alguien sepa qué es.\n\nPor hoy la herrería está despejada. Con eso me basta.', next:'offer' },
    offer:gnomiHere
      ? { text:'Te has ganado un techo. Tengo una cama libre y un cofre que cierra como es debido. Vente a casa.\n\nY no pongas esa cara. Has defendido mi fragua; no voy a pagártelo señalándote un banco en la plaza.', next:'farewell' }
      : { text:'Te has ganado un techo. Tengo una cama libre y un cofre que cierra como es debido. Vente a casa.\n\nY no pongas esa cara. Has defendido mi fragua; no voy a pagártelo señalándote un banco en la plaza.', choices:follow },
    farewell:{ ...gnomi, text:'Gracias, Isberto. Sabía que no ibas a dejarle a la intemperie.\n\nVe a descansar. Yo me vuelvo a la plaza del pozo. Cuando salgas, pásate a verme. Me gustará saber cómo te va.', choices:follow },
  } };
  if (session.state.shadowQuest === 'returning') return play.city.locationId === ISBERTO_HOUSE
    ? { ...isberto, nodes:{
      intro:{ text:'Aquí puedes descansar y dejar tus cosas. El cerrojo es bueno: lo hice yo.\n\nHas respondido cuando hacía falta. En mi casa eso cuenta. Ponte cómodo.',
        choices:[{ text:'Gracias, Isberto.', action:()=>performShadow('return'), next:'rest' }] },
      rest:{ text:'Descansa. Mañana ya tendrás tiempo de decidir por dónde seguir. Por hoy, bastante trote llevas.' },
    } }
    : { ...isberto, nodes:{ intro:{ text:'Mi casa es esa, la de la puerta junto al camino. Vamos, entra.' } } };
  if (session.state.shadowQuest === 'returned') return { ...isberto,
    nodes:{ intro:{ text:'La cama y el cofre son tuyos mientras los necesites. Si sales, vuelve con todas las piezas. Las tuyas; las del equipo ya las arreglo yo.' } } };
  const text = session.state.shadowQuest === 'active' ? 'Sigue junto a la herrería, al sur. Fija a la sombra para empezar. Cuando marque el suelo, sal del círculo: primero los pies, después el golpe. Yo vigilo el camino.'
    : `${gnomiHere ? t('Gnomi, quédate junto al camino. Si viene alguien, que espere. Y tú, escúchame.') + '\n\n' : ''}${t('Hay una criatura junto a mi herrería. No la reconozco, y no pienso dejarla rondando mis herramientas.\n\nLlevas un arma. Bien. Te iré guiando: elige tu objetivo, prueba tu habilidad y mantente fuera de sus ataques. Si marca el suelo, apártate antes del golpe. Yo vigilo el camino. ¿Me echas una mano?')}`;
  const offer = !session.state.shadowQuest;
  return {
    ...isberto,
    nodes:{intro:{text,
      ...(offer ? {quest:{title:SHADOW_TITLE,objective:'Derrota a la criatura que ronda la herrería de Isberto, al sur.',experience:0,pelines:0}} : {}),
      ...(offer || (session.state.shadowQuest === 'active' && fight.combatEncounter?.status !== 'active')
        ? {choices:[{text:offer ? 'Aceptar misión' : 'Volver a investigar',action:beginIsbertoEncounter},
          ...(offer ? [{text:'¿Has luchado antes con algo así?',next:'experience'}] : [])]} : {}),
    }, experience:{text:'Con eso, no. Con cosas que también parecían imposibles de tumbar, unas cuantas.\n\nFui explorador antes de hacerme herrero. Aprendí a volver a casa. Primera lección: mirar bien. Segunda: no confundir valor con entrar a ciegas.',next:'intro'}},
  };
}

/** Fichas de los NPC de la ciudad; se crean al cargar sus personajes registrados (session.registeredNpcs). */
export function createNpcDefinitions(): Record<string, NpcDef> {
  return {
  isberto: {
    name:session.registeredNpcs.isberto.name,
    type:'resident',
    title:session.registeredNpcs.isberto.subtitle,
    level:session.registeredNpcs.isberto.stats.level,
    vitals:{health:session.registeredNpcs.isberto.stats.health,maxHealth:session.registeredNpcs.isberto.stats.maxHealth,overheal:0,resource:50,maxResource:50,resourceKind:'stamina'},
    get conversation() { return isbertoConversation(); },
  },
  testiculos: {
    name: session.registeredNpcs.testiculos.name,
    type: 'debug',
    title: session.registeredNpcs.testiculos.subtitle,
    level: session.registeredNpcs.testiculos.stats.level,
    vitals: { health: session.registeredNpcs.testiculos.stats.health, maxHealth: session.registeredNpcs.testiculos.stats.maxHealth, overheal: 0, resource: 100, maxResource: 100, resourceKind: 'mana' },
    barks: [
      '¿Alguien ha visto mi documentación? Ah, no, no tengo.',
      'Psst, viajero... ¿quieres probar mis pociones? Son de mentira, pero curan.',
      'Un día más depurando el universo.',
    ],
    conversation: {
      speaker: session.registeredNpcs.testiculos.name,
      start: 'intro',
      nodes: {
        intro: { text: '¡Saludos, viajero! Soy un NPC de prueba, no tengo lore ni ganas de tenerlo.', choices: testChoices },
        hola: { text: '¡Hola! Si estás leyendo esto, el sistema de conversaciones funciona. Ya me dejas en paz.' },
        dano: { text: 'Pum. Diez puntos de daño, recién salidos del horno. Mira tu barra de vida.', choices: testChoices },
        cura: { text: 'Cataplof. Diez puntos de vida, cortesía de la casa. Sin receta ni efectos secundarios.', choices: testChoices },
        xp: { text: 'Toma, doscientos puntos de experiencia recién impresos. Mira la barra dorada, y si subes de nivel, no me des las gracias.', choices: testChoices },
        dinero: { text: 'Cien pelines calentitos, recién acuñados. No preguntes de dónde salen. Gástalos en mi tienda: «Comerciar».', choices: testChoices },
      },
    },
  },
};
}

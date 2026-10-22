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
  const isberto = { speaker:session.registeredNpcs.isberto.name, subtitle:session.registeredNpcs.isberto.subtitle, start:'intro' };
  const gnomi = { speaker:session.registeredNpcs.gnomi.name, subtitle:session.registeredNpcs.gnomi.subtitle };
  const gnomiHere = story.welcomeWorld.root.visible && story.welcomeWorld.root.position.distanceTo(holder.position) < 8;
  const follow = [{ text:'Seguir a Isberto', action:()=>performShadow('report') }];
  if (session.state.shadowQuest === 'defeated' && !corpseLooted()) return { ...isberto,
    nodes:{ intro:{ text:'Registra lo que quede de esa cosa antes de que se deshaga del todo. Quiero saber qué era.' } } };
  if (session.state.shadowQuest === 'defeated') return { ...isberto, nodes:{
    intro:{ text:'Ya no se mueve… Bien hecho. Todavía me tiemblan las manos, y eso que llevo media vida con el martillo. Exploré medio mundo antes de colgar la capa y nunca había visto nada parecido.', next:gnomiHere ? 'gnomi' : 'isberto' },
    gnomi:{ ...gnomi, text:'Yo tampoco sé qué era. Y mira que en el gremio nos cruzamos con gente y bichos de todas clases… Esto no me suena de nada.', next:'isberto' },
    isberto:{ text:'Pues no vamos a ponerle nombre por inventar. Guarda lo que hayas sacado de sus restos; por ahora no sabemos qué significa.', next:'offer' },
    offer:gnomiHere
      ? { text:'…Mira. Se está haciendo tarde, y después de esto no pienso dejar que duermas al raso. Tengo una cama libre en casa. No me gustan las visitas, que conste. Pero vente. Antes de que me arrepienta.', next:'farewell' }
      : { text:'…Mira. Se está haciendo tarde, y después de esto no pienso dejar que duermas al raso. Tengo una cama libre en casa. No me gustan las visitas, que conste. Pero vente. Antes de que me arrepienta.', choices:follow },
    farewell:{ ...gnomi, text:'¡Isberto ofreciendo su casa! Esto sí que no lo había visto nunca. Yo vuelvo a la plaza del pozo; si me necesitas, allí estaré. ¡Descansa!', choices:follow },
  } };
  if (session.state.shadowQuest === 'returning') return play.city.locationId === ISBERTO_HOUSE
    ? { ...isberto, nodes:{
      intro:{ text:'No me mires así. Lo de esa criatura me ha dejado mal cuerpo, y prefiero tenerte bajo techo que pasarme la noche preocupado. Ponte cómodo.',
        choices:[{ text:'Gracias, Isberto.', action:()=>performShadow('return'), next:'rest' }] },
      rest:{ text:'Bah. Descansa, que mañana… ya veremos qué hacemos con lo que encontraste.' },
    } }
    : { ...isberto, nodes:{ intro:{ text:'Mi casa es esa, la de la puerta junto al camino. Vamos, entra.' } } };
  if (session.state.shadowQuest === 'returned') return { ...isberto,
    nodes:{ intro:{ text:'Ponte cómodo. La cama y el cofre de la esquina siguen ahí cuando los necesites. Yo sigo dándole vueltas a esa criatura.' } } };
  const text = session.state.shadowQuest === 'active' ? 'La criatura sigue junto a la herrería, al sur. Ten cuidado.'
    : `${gnomiHere ? t('¡Gnomi, menos mal que te encuentro! Y tú…') + ' ' : ''}${t('¿Sabes usar eso que llevas? Hay algo rondando mi herrería, al sur. No es un lobo ni un zorro. Yo ya tuve bastantes aventuras cuando era explorador; ahora solo quiero mi yunque y mi fragua. Necesito a alguien que se atreva a echarle un vistazo.')}`;
  const offer = !session.state.shadowQuest;
  return {
    ...isberto,
    nodes:{intro:{text,
      ...(offer ? {quest:{title:SHADOW_TITLE,objective:'Derrota a la criatura que ronda la herrería de Isberto, al sur.',experience:0,pelines:0}} : {}),
      ...(offer || (session.state.shadowQuest === 'active' && fight.combatEncounter?.status !== 'active')
        ? {choices:[{text:offer ? 'Aceptar misión' : 'Volver a investigar',action:beginIsbertoEncounter}]} : {}),
    }},
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

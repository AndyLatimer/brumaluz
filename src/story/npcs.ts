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
import { PROFESSION_MASTER_IDS } from '../data/npcs';
import { professionMasterConversation } from './professionMasters';
import { selectProfessionTab } from '../ui/professionsWindow';
import { setWindow } from '../ui/menus';
import { closeDialog } from '../ui/dialog';
import { performProfession } from '../game/professions';
import { RPG_CATALOG } from '../data/professions';

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
  if (play.city.locationId === 'taller_herreria_interior') return workshopConversation('herreria', 'isberto');
  const isberto = { speaker:session.registeredNpcs.isberto.name, subtitle:session.registeredNpcs.isberto.subtitle, emblem:'anvil' as const, start:'intro' };
  const gnomi = { speaker:session.registeredNpcs.gnomi.name, subtitle:session.registeredNpcs.gnomi.subtitle, emblem:'guild' as const };
  const gnomiHere = story.welcomeWorld.root.visible && story.welcomeWorld.root.position.distanceTo(holder.position) < 8;
  const follow = [{ text:'Seguir a Isberto', action:()=>performShadow('report') }];
  if (session.state.shadowQuest === 'defeated' && !corpseLooted()) return { ...isberto,
    nodes:{ intro:{ text:'Ya no se mueve. Mira entre los restos antes de irnos; quiero saber qué se había metido en mi herrería.' } } };
  if (session.state.shadowQuest === 'defeated') return { ...isberto, nodes:{
    intro:{ text:"Ya está. ¿Te ha hecho daño? No me digas que no por quedar bien.\n\nDéjame ver lo que has recogido. He pasado media vida por los caminos y no sé qué demonios tenía delante del yunque.", next:gnomiHere ? 'gnomi' : 'isberto' },
    gnomi:{ ...gnomi, text:"¿Ya puedo soltar el gorro? Se me han quedado los dedos tiesos.\n\nIsberto, míralo tú. Yo desde aquí lo veo muy bien. No necesito acercarme más.", next:'isberto' },
    isberto:{ text:"No lo reconozco. Y no voy a darte una explicación bonita para que te quedes a gusto.\n\nGuarda eso aparte. Yo voy a revisar la fragua; ya me ha tenido bastante tiempo fuera de mi propia herrería.", next:'offer' },
    offer:gnomiHere
      ? { text:"Ven a casa antes de seguir por ahí. Hay una cama libre y un cofre. En el cofre metes tus cosas; en la cama, a ti.\n\nY ahórrate el «no quiero molestar». Me has sacado una criatura de la fragua. Creo que puedo prestarte una manta.", next:'farewell' }
      : { text:"Ven a casa antes de seguir por ahí. Hay una cama libre y un cofre. En el cofre metes tus cosas; en la cama, a ti.\n\nY ahórrate el «no quiero molestar». Me has sacado una criatura de la fragua. Creo que puedo prestarte una manta.", choices:follow },
    farewell:{ ...gnomi, text:"Ve a descansar. Yo me vuelvo a la plaza del pozo.\n\nGracias por buscar el distintivo conmigo. Cuando te apetezca visitar los talleres, ven a buscarme. Esta vez me toca ayudarte a ti.", choices:follow },
  } };
  if (session.state.shadowQuest === 'returning') return play.city.locationId === ISBERTO_HOUSE
    ? { ...isberto, nodes:{
      intro:{ text:"Ahí tienes la cama. No es una posada, así que si cruje, cruje. Tú descansa.\n\nEl cofre de la esquina queda para tus cosas. Y no te levantes para darme conversación: si te he traído a descansar, es a descansar.",
        choices:[{ text:'Gracias, Isberto.', action:()=>performShadow('return'), next:'rest' }] },
      rest:{ text:'Voy a dejarte descansar. La fragua puede esperar un rato más.' },
    } }
    : { ...isberto, nodes:{ intro:{ text:'Mi casa es esa, la de la puerta junto al camino. Vamos, entra.' } } };
  if (session.state.shadowQuest === 'returned') return { ...isberto,
    nodes:{ intro:{ text:"¿Vienes a descansar? Pasa, la cama está libre. Y deja ese peso en el cofre, que aquí no hace falta llevar la casa a cuestas." } } };
  const text = session.state.shadowQuest === 'active' ? 'Sigue junto a la herrería, al sur. Fija a la sombra para empezar. Cuando marque el suelo, sal del círculo: primero los pies, después el golpe. Yo vigilo el camino.'
    : `${gnomiHere ? t('Gnomi, quédate junto al camino. Si viene alguien, que espere. Y tú, escúchame.') + '\n\n' : ''}${t('Hay una criatura junto a mi herrería. No la reconozco, y no pienso dejarla rondando mis herramientas.\n\nLlevas un arma. Bien. Te iré guiando: elige tu objetivo, prueba tu habilidad y mantente fuera de sus ataques. Si marca el suelo, apártate antes del golpe. Yo vigilo el camino. ¿Me echas una mano?')}`;
  const offer = !session.state.shadowQuest;
  return {
    ...isberto,
    nodes:{intro:{text,
      ...(offer ? {quest:{title:SHADOW_TITLE,objective:'Derrota a la criatura que ronda la herrería de Isberto, al sur.',experience:0,pelines:0}} : {}),
      ...(offer || (session.state.shadowQuest === 'active' && fight.combatEncounter?.status !== 'active')
        ? {choices:[{text:offer ? 'Aceptar misión' : 'Volver a investigar',action:beginIsbertoEncounter},
          ...(offer ? [{text:'¿Has luchado antes con algo así?',next:'experience'},{text:'¿Y por qué me lo pides a mí?',next:'help'}] : [])]} : {}),
    }, help:{text:'Porque llevas un arma y necesito a alguien que se ocupe de ella mientras yo mantengo a la gente fuera del camino. Puedo mirar a la criatura o mirar quién se acerca. Las dos cosas a la vez, no.\n\nTe estoy pidiendo ayuda. Si no lo ves claro, dímelo antes de acercarte.',next:'intro'},
    experience:{text:'Con una de esas, no. Antes de la herrería fui explorador; he tenido que abrirme paso más de una vez.\n\nEsta ataca a distancia. No te fíes de lo pequeña que es y deja sitio para apartarte.',next:'intro'}},
  };
}

/** Fichas de los NPC de la ciudad; se crean al cargar sus personajes registrados (session.registeredNpcs). */
export function createNpcDefinitions(): Record<string, NpcDef> {
  const definitions:Record<string,NpcDef>={
  isberto: {
    name:session.registeredNpcs.isberto.name,
    get type():NpcType { return play.city.locationId==='taller_herreria_interior'?'trainer':'resident'; },
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
  for(const [job,id]of Object.entries(PROFESSION_MASTER_IDS)){
    if(id==='isberto')continue; // His welcome dialogue depends on the current map and quest.
    const npc=session.registeredNpcs[id];
    definitions[id]={name:npc.name,title:npc.subtitle,type:'trainer',level:npc.stats.level,
      vitals:{health:npc.stats.health,maxHealth:npc.stats.maxHealth,overheal:0,resource:0,maxResource:0,resourceKind:'stamina'},
      conversation:professionMasterConversation({job,name:npc.name,subtitle:npc.subtitle,tutorial:{getState:()=>session.state,act:performProfession,master:id,openBook:()=>{closeDialog();selectProfessionTab('recipes',job);setWindow('professions');},openInventory:()=>{closeDialog();setWindow('inventory');}},dailyOrders:{getState:()=>session.state,deliver:order=>performProfession('daily_order',{id:order,master:id,reward:RPG_CATALOG.dailyOrders.orders[order].reward})},training:{openInventory:()=>{closeDialog();setWindow('inventory');},getState:()=>session.state,buy:recipe=>performProfession('buy_recipe',{id:recipe,master:id,price:RPG_CATALOG.recipes[recipe].price})},onOpen(section){
        closeDialog();selectProfessionTab(section,job);setWindow('professions');void performProfession('state');
      }}),
    };
  }
  return definitions;
}

function workshopConversation(job:string,id:keyof typeof session.registeredNpcs):Conversation {
  const npc=session.registeredNpcs[id];
  return professionMasterConversation({job,name:npc.name,subtitle:npc.subtitle,tutorial:{getState:()=>session.state,act:performProfession,master:id,openBook:()=>{closeDialog();selectProfessionTab('recipes',job);setWindow('professions');},openInventory:()=>{closeDialog();setWindow('inventory');}},dailyOrders:{getState:()=>session.state,deliver:order=>performProfession('daily_order',{id:order,master:id,reward:RPG_CATALOG.dailyOrders.orders[order].reward})},training:{openInventory:()=>{closeDialog();setWindow('inventory');},getState:()=>session.state,buy:recipe=>performProfession('buy_recipe',{id:recipe,master:id,price:RPG_CATALOG.recipes[recipe].price})},onOpen(section){
    closeDialog();selectProfessionTab(section,job);setWindow('professions');void performProfession('state');
  }});
}

import type { CharData } from '../data/data';
import { ORIGINS, ORIGIN_REPLIES, WELCOME_TITLE, WELCOME_REWARD, SHADOW_TITLE, FAIRY_DUST_QUEST_TITLE, fairyDustObjective, shadowObjective, questItems, welcomeObjective, type WelcomeAction } from '../data/quests';
import { currencyIcon } from '../data/currency';
import type { Conversation } from './dialog';
import { t } from './i18n';
import { currentQuest, type QuestId, type QuestTracking } from './questTracking';
import {PROFESSION_TUTORIAL,tutorialObjective,tutorialSteps,tutorialProgress} from '../data/professionTutorial';
import {RPG_CATALOG} from '../data/professions';

/** ID de la misión de bienvenida (welcome). */
const WELCOME_QUEST_KEY = 'welcome';
/** ID de la misión de sombra (shadow). */
const SHADOW_QUEST_KEY = 'shadow';

function createTrackButton(tracking: QuestTracking, questId: QuestId): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'quest-track-button';
  button.dataset.questControl = questId;
  const refresh = () => {
    const tracked = tracking.isTracked(questId);
    button.setAttribute('aria-pressed', String(tracked));
    button.textContent = t(tracked ? 'Dejar de seguir misión' : 'Seguir misión');
    button.closest('.quest-entry')?.classList.toggle('tracked', tracked);
  };
  button.onclick = () => { tracking.toggle(questId); refresh(); };
  refresh();
  return button;
}

export function welcomeConversation(data: CharData, act: (action: WelcomeAction, origin?: number) => Promise<boolean>): Conversation {
  const progress = data.welcome;
  const conversation: Conversation = { speaker: 'Gnomi', subtitle: 'Ayudante de bienvenida', emblem: 'guild', start: 'intro', nodes: {} };
  const offer = "Tengo que pedirte un favor antes de enseñarte los talleres. He perdido mi distintivo. Lo llevaba junto a los puestos de la plaza del Levante; después he venido a la puerta y… nada. He mirado dos veces en el mismo bolsillo, por si acaso.\n\nEs redondo y dorado, con una abolladura en el borde. Esa no hace falta arreglarla: así sé que es el mío. ¿Lo buscamos? Tú miras alrededor del puesto y yo me meto debajo.";
  const accept = { text: 'Aceptar misión', action: () => act('accept') };
  const offerChoices = [accept, { text: '¿En qué vas a ayudarme?', next: 'guild' }, {text:'¿No eras tú quien iba a ayudarme?',next:'helper'}];
  conversation.nodes.helper = {
    text: 'Sí. Y entiendo cómo está quedando esto. Pero no me descartes todavía, que la ciudad me la sé.\n\nPodría haberte llevado al mercado sin decir nada y buscarlo de reojo. Se me ha ocurrido. Luego he pensado que sería feo empezar así contigo.',
    next: 'offer',
  };
  conversation.nodes.guild = {
    text: "Los talleres están en el Barrio de los Artesanos. Te enseño cuál es cuál y tú preguntas lo que te interese. Si un maestro se pone a hablar como si ya supieras, lo paramos. Yo también pregunto; no me da vergüenza.\n\nBueno, un poco sí. Pero me fastidia más quedarme sin entender.",
    next: 'offer',
  };
  const quest = {
    title: WELCOME_TITLE,
    objective: 'Acompaña a Gnomi al mercado de la plaza del Levante, encuentra su distintivo y devuélveselo.',
    ...WELCOME_REWARD,
  };
  conversation.nodes.offer = { text: offer, quest, choices: offerChoices };
  if (!progress) {
    conversation.nodes.intro = { text: '¡Buen camino! Si necesitas ayuda con algo, estaré por aquí. Para alcanzar los estantes altos tendremos que buscar a otro, eso sí.' };
  } else if (progress.origin === null) {
    conversation.nodes.intro = {
      text: "¡Ah, hola! Si ves algo dorado por el suelo, avísame. Redondo. Con una abolladura…\n\n¡La bienvenida! Eso iba primero. Soy Gnomi, del Gremio de Ayudantes. Me han mandado a recibirte; los demás ya estaban ocupados. A mí suelen dejarme los recados, pero hoy me toca alguien con quien hablar.\n\n¿Vienes a conocer Brumaluz o ya vives aquí?",
      choices: ORIGINS[data.race].map((text, i) => ({ text, action: () => act('origin', i), next: `offer-${i}` })),
    };
    ORIGINS[data.race].forEach((_, i) => {
      conversation.nodes[`offer-${i}`] = {
        text: `${t(ORIGIN_REPLIES[data.race][i])}\n\n${t(offer)}`,
        quest,
        choices: offerChoices,
      };
    });
  } else if (progress.stage === 'available') {
    conversation.nodes.intro = { text: `${t(ORIGIN_REPLIES[data.race][progress.origin])}\n\n${t(offer)}`, quest,
      choices: offerChoices };
  } else if (progress.stage === 'active') {
    conversation.nodes.intro = {
      text: "Tiene que estar junto a los puestos de la plaza del Levante. Mira si ves un borde dorado entre las patas.\n\nYo me agacho. Tú no te preocupes por mí, que a esta altura ya estoy bastante cerca del suelo.",
      choices: [{ text: 'Vamos a encontrarlo.' }, { text: '¿Y si no aparece?', next: 'worry' }],
    };
    conversation.nodes.worry = { text: "David, el jefe del gremio, ya me riñó la última vez. Todavía me acuerdo de la cara. De lo que dijo, también, pero de la cara sobre todo.\n\nSin el distintivo, los vecinos creen que estoy de paseo. Con él me paran para pedirme cosas. Y yo quiero que me paren. No me gusta ser siempre el que sobra." };
  } else if (progress.stage === 'found') {
    conversation.nodes.intro = {
      text: "¡Ese es! A ver el borde… sí, esa abolladura es mía.\n\nPásamelo. Quiero ponérmelo antes de que alguien me pregunte por él. Y luego vamos a ocuparnos de lo tuyo, que vaya ayudante te has buscado.",
      quest: { ...quest, objective: 'Devuelve a Gnomi su distintivo del Gremio de Ayudantes.', turnIn: true },
      choices: [{ text: 'Completar misión', action: () => act('claim'), next: 'thanks' }],
    };
    conversation.nodes.thanks = {
      text: "Ya está. Tira un poco… ahora sí aguanta. Gracias, de veras. Yo venía a echarte una mano y al final me la has echado tú.\n\nBueno, te debía una visita a los talleres. Podemos… anda, Isberto. Viene hacia aquí.",
    };
  } else if (progress.stage === 'completed') {
    conversation.nodes.intro = { text: 'Isberto es el herrero de las afueras, al sur. Iba a llevarte a conocer los oficios, pero parece que necesita algo. Vamos a escucharlo.' };
  } else conversation.nodes.intro = { text: '¡Mi compañero de búsqueda! El distintivo sigue en su sitio. Lo he comprobado. Dos veces.' };
  return conversation;
}

export function createQuestItems(data: CharData) {
  const items = questItems(data.welcome);
  if (!items.length) return null;
  const section = document.createElement('section');
  section.className = 'quest-items';
  const heading = document.createElement('h3');
  heading.textContent = t('Objetos de misión');
  section.append(heading);
  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'quest-key-item';
    card.dataset.questItem = item.id;
    card.tabIndex = 0;
    card.title = `${t(item.name)}|${t(item.description)} ${t('No se puede vender, intercambiar ni descartar.')}`;
    const icon = document.createElement('span');
    icon.className = 'quest-item-art';
    icon.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m15 5 9 5 9-5-3 15H18Z" fill="#647b5b" stroke="#43563d"/><circle cx="24" cy="29" r="14" fill="#d8b76d" stroke="#96713b" stroke-width="2"/><circle cx="24" cy="29" r="10" fill="#ead498" stroke="#ad8d4e"/><path d="M18 30c0-3 3-5 6-3 3-2 6 0 6 3 0 3-6 7-6 7s-6-4-6-7Z" fill="#627b58"/><path d="m20 19 3-1" stroke="#fff4cb" stroke-width="2" stroke-linecap="round"/></svg>';
    const body = document.createElement('div');
    const name = document.createElement('strong'); name.textContent = t(item.name);
    const mission = document.createElement('small'); mission.textContent = t(item.quest);
    const objective = document.createElement('span'); objective.textContent = t(item.objective);
    body.append(name, mission, objective);
    card.append(icon, body); section.append(card);
  }
  return section;
}

function createQuestRewards(completed: boolean,rewards=WELCOME_REWARD) {
  const footer = document.createElement('footer');
  footer.className = 'quest-rewards';
  footer.classList.toggle('received', completed);
  const heading = document.createElement('div');
  heading.className = 'quest-rewards-heading';
  const title = document.createElement('strong');
  title.textContent = t(completed ? 'Recompensas recibidas' : 'Recompensas');
  heading.append(title); footer.append(heading);
  const list = document.createElement('div'); list.className = 'quest-reward-list';
  for (const reward of [
    { kind: 'experience', value: rewards.experience, label: 'Experiencia', icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 3 3.7 8.6 9.3 1-7 6.2 2 9.2-8-4.8L8 28l2-9.2-7-6.2 9.3-1Z" fill="#b0c590" stroke="#58774f" stroke-width="1.5"/><path d="m16 9 1.7 5 5.3.3-4.2 3.2 1.4 5-4.2-3-4.2 3 1.4-5L9 14.3l5.3-.3Z" fill="#f9ebbd"/></svg>' },
    { kind: 'pelines', value: rewards.pelines, label: 'Pelines', icon: currencyIcon('pelines') },
  ]) {
    if(reward.value<=0)continue;
    const card = document.createElement('div'); card.className = `quest-reward ${reward.kind}`;
    const icon = document.createElement('span'); icon.className = 'quest-reward-icon'; icon.innerHTML = reward.icon;
    const body = document.createElement('div');
    const amount = document.createElement('b'); amount.textContent = `+${reward.value}`;
    const label = document.createElement('strong'); label.textContent = t(reward.label);
    body.append(amount, label); card.append(icon, body); list.append(card);
  }
  footer.append(list); return footer;
}

/** `looted`: si ya se registraron los restos de la criatura (cambia el siguiente paso de Isberto). */
export function renderQuestJournal(container: HTMLElement, data: CharData, tracking: QuestTracking, showCompleted?: boolean, looted = true) {
  container.replaceChildren();
  const root = document.createElement('div');
  root.className = 'quest-journal';
  const intro = document.createElement('p');
  intro.className = 'quest-journal-intro';
  intro.textContent = t('Elige qué misión seguir. Sus marcas aparecerán en el mundo y en los mapas.');
  const tabs = document.createElement('div');
  tabs.className = 'social-tabs';
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', t('Estado de las misiones'));
  const content = document.createElement('div');
  content.className = 'quest-journal-content';
  const buttons: HTMLButtonElement[] = [];
  function appendEntry(entry: HTMLElement, completed: boolean) {
    if (!completed) { content.append(entry); return; }
    const details = document.createElement('details'); details.className = `${entry.className} quest-completed`;
    details.dataset.quest = entry.dataset.quest;
    const summary = document.createElement('summary');
    summary.dataset.questControl = `completed-${entry.dataset.quest}`;
    const header = entry.querySelector('header')!;
    const mark = document.createElement('span'); mark.className = 'quest-completed-mark'; mark.textContent = '✓'; mark.setAttribute('aria-hidden','true');
    const status = document.createElement('span'); status.className = 'quest-completed-status'; status.textContent = t('Completada');
    summary.append(mark, header, status);
    entry.querySelector('.quest-seal')?.remove();
    const body = document.createElement('div'); body.className = 'quest-completed-body';
    body.append(...entry.childNodes);
    details.append(summary, body); content.append(details);
  }
  function display(completed: boolean) {
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === Number(completed))));
    content.replaceChildren();
    const lesson=tutorialProgress(data);
    if(lesson&&(lesson.status==='completed')===completed){
      const entry=document.createElement('article');entry.className='quest-entry profession-quest';entry.dataset.quest='profession';entry.classList.toggle('tracked',!completed&&tracking.isTracked('profession'));
      const seal=document.createElement('span');seal.className='quest-seal';seal.textContent=completed?'✓':'!';
      const header=document.createElement('header'),left=document.createElement('div');left.className='quest-header-left';
      const title=document.createElement('h3');title.textContent=`${t(PROFESSION_TUTORIAL.title)} · ${t(RPG_CATALOG.professions[lesson.job])}`;
      const giver=document.createElement('span');giver.className='quest-giver';giver.textContent=t('Gnomi y el maestro del oficio');left.append(title,giver);header.append(left);
      if(!completed)header.append(createTrackButton(tracking,'profession'));
      const description=document.createElement('p');description.textContent=t('Prueba un oficio con sus herramientas, materiales y encargos normales. La elección del tutorial no limita los oficios que puedes aprender.');
      const steps=document.createElement('ol');steps.className='quest-steps';const list=tutorialSteps(data);let first=true;
      list.forEach((s,i)=>{const li=document.createElement('li');li.className=s.done?'done':first?'current':'';if(!s.done&&first){li.setAttribute('aria-current','step');first=false;}const mark=document.createElement('span');mark.textContent=s.done?'✓':String(i+1);mark.setAttribute('aria-hidden','true');li.append(mark,t(s.label));steps.append(li);});
      const objective=document.createElement('section');objective.className='quest-objective';const label=document.createElement('small');label.textContent=t(completed?'Completada':'Siguiente paso');const text=document.createElement('p');text.textContent=t(tutorialObjective(data));objective.append(label,text);
      entry.append(seal,header,description,steps,objective,createQuestRewards(completed,PROFESSION_TUTORIAL.reward));appendEntry(entry,completed);
    }
    if (data.fairyDustQuest && !completed) {
      const entry = document.createElement('article'); entry.className = 'quest-entry fairy-dust-quest';
      entry.dataset.quest = 'fairy-dust';
      const seal = document.createElement('span'); seal.className = 'quest-seal'; seal.textContent = '!';
      const header = document.createElement('header'), left = document.createElement('div'); left.className = 'quest-header-left';
      const title = document.createElement('h3'); title.textContent = t(FAIRY_DUST_QUEST_TITLE);
      const giver = document.createElement('span'); giver.className = 'quest-giver'; giver.textContent = 'Gnomi';
      left.append(title, giver); header.append(left, createTrackButton(tracking, 'fairy-dust'));
      const description = document.createElement('p'); description.textContent = t('Has encontrado polvo de hada. Quizá Gnomi sepa algo sobre él.');
      const objective = document.createElement('section'); objective.className = 'quest-objective';
      const label = document.createElement('small'); label.textContent = t(data.fairyDustQuest === 'arboleda' ? 'Continuará' : 'Siguiente paso');
      const text = document.createElement('p'); text.textContent = t(fairyDustObjective(data.fairyDustQuest));
      objective.append(label, text);
      entry.append(seal, header, description, objective);
      if (data.fairyDustQuest === 'arboleda') {
        const pending = document.createElement('p'); pending.className = 'quest-journal-intro'; pending.textContent = t('La historia continuará en una próxima etapa.');
        entry.append(pending);
      }
      appendEntry(entry, false);
    }
    if ((data.shadowQuest || data.welcome?.stage === 'completed') && (data.shadowQuest === 'returned') === completed) {
      const shadow = document.createElement('article'); shadow.className = 'quest-entry shadow-quest';
      shadow.dataset.quest = SHADOW_QUEST_KEY;
      shadow.classList.toggle('tracked', !completed && tracking.isTracked(SHADOW_QUEST_KEY));
      const header = document.createElement('header');
      const title = document.createElement('h3'); title.textContent = t(SHADOW_TITLE);
      const giver = document.createElement('span'); giver.className = 'quest-giver'; giver.textContent = 'Isberto';
      const left = document.createElement('div'); left.className = 'quest-header-left';
      left.append(title, giver);
      const seal = document.createElement('span'); seal.className = 'quest-seal'; seal.textContent = completed ? '✓' : '!';
      header.append(left);
      if (!completed) header.append(createTrackButton(tracking, SHADOW_QUEST_KEY));
      const description = document.createElement('p'); description.textContent = t('Isberto te ha pedido ayuda con la criatura que ronda su herrería.');
      const objective = document.createElement('section'); objective.className = 'quest-objective';
      const label = document.createElement('small'); label.textContent = t(completed ? 'Completada' : 'Siguiente paso');
      const text = document.createElement('p'); text.textContent = t(shadowObjective(data.shadowQuest, looted, data.location));
      objective.append(label, text);
      shadow.append(seal, header, description, objective); appendEntry(shadow, completed);
    }
    const progress = data.welcome;
    if (!progress || (progress.stage === 'completed') !== completed) {
      if (content.children.length) return;
      const empty = document.createElement('p'); empty.className = 'quest-empty';
      empty.textContent = t(completed ? 'Todavía no hay misiones completadas.' : 'No tienes misiones activas.');
      content.append(empty); return;
    }
    const article = document.createElement('article'); article.className = 'quest-entry';
    article.dataset.quest = WELCOME_QUEST_KEY;
    article.classList.toggle('tracked', !completed && tracking.isTracked(WELCOME_QUEST_KEY));
    const seal = document.createElement('span'); seal.className = 'quest-seal'; seal.textContent = completed ? '✓' : '!';
    const header = document.createElement('header');
    const title = document.createElement('h3'); title.textContent = t(WELCOME_TITLE);
    const giver = document.createElement('span'); giver.className = 'quest-giver';
    giver.textContent = t('Gnomi · Gremio de Ayudantes');
    const left = document.createElement('div'); left.className = 'quest-header-left';
    left.append(title, giver);
    header.append(left);
    if (!completed) header.append(createTrackButton(tracking, WELCOME_QUEST_KEY));
    const text = document.createElement('p');
    text.textContent = t('Gnomi es tu ayudante de bienvenida. Ha perdido el distintivo del gremio cerca del mercado y, aunque esté abollado, le tiene mucho cariño. Ayúdalo a recuperarlo.');
    const objective = document.createElement('section'); objective.className = 'quest-objective';
    const objectiveLabel = document.createElement('small'); objectiveLabel.textContent = t(completed ? 'Completada' : 'Siguiente paso');
    const objectiveText = document.createElement('p'); objectiveText.textContent = t(welcomeObjective(progress));
    objective.append(objectiveLabel, objectiveText);
    const steps = document.createElement('ol'); steps.className = 'quest-steps';
    const current = progress.stage === 'completed' ? 3 : progress.stage === 'found' ? 2 : progress.stage === 'active' ? 1 : 0;
    ['Hablar con Gnomi', 'Encontrar el distintivo', 'Devolver el distintivo'].forEach((label, index) => {
      const step = document.createElement('li');
      step.className = index < current ? 'done' : index === current ? 'current' : '';
      if (index === current) step.setAttribute('aria-current', 'step');
      const mark = document.createElement('span'); mark.textContent = index < current ? '✓' : String(index + 1); mark.setAttribute('aria-hidden', 'true');
      step.append(mark, t(label)); steps.append(step);
    });
    article.append(seal, header, text, steps, objective);
    const items = createQuestItems(data);
    if (items) {
      article.append(items);
    }
    article.append(createQuestRewards(completed)); appendEntry(article, completed);
  }
  ['Activas', 'Completadas'].forEach((label, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = t(label);
    button.dataset.questControl = i === 1 ? 'completed' : 'active';
    button.onclick = () => display(i === 1); tabs.append(button); buttons.push(button);
  });
  root.append(intro, tabs, content); container.append(root); display(showCompleted ?? (currentQuest(data) === null && !!data.welcome));
}

export function createQuestTracker(open: () => void, tracking: QuestTracking) {
  const root = document.createElement('aside'); root.id = 'quest-tracker'; root.hidden = true;
  root.setAttribute('aria-label', t('Misión seguida'));
  let minimized = localStorage.getItem('brumaluz-quest-tracker:minimized') === 'true';
  const header = document.createElement('header');
  const journal = document.createElement('button'); journal.type = 'button'; journal.className = 'quest-tracker-journal'; journal.onclick = open;
  const emblem = document.createElement('span'); emblem.className = 'quest-tracker-emblem'; emblem.textContent = '◇'; emblem.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('span');
  journal.append(emblem, heading);
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'quest-tracker-toggle';
  toggle.setAttribute('aria-controls', 'quest-tracker-detail');
  const button = document.createElement('button'); button.type = 'button'; button.className = 'quest-tracker-detail'; button.id = 'quest-tracker-detail'; button.onclick = open;
  const label = document.createElement('small'), title = document.createElement('strong'), objective = document.createElement('span');
  objective.className = 'quest-tracker-objective';
  const progress = document.createElement('span'); progress.className = 'quest-tracker-progress';
  button.append(label, title, objective, progress);
  function refreshToggle() {
    root.classList.toggle('minimized', minimized);
    button.hidden = minimized;
    toggle.textContent = minimized ? '+' : '−';
    toggle.setAttribute('aria-expanded', String(!minimized));
    toggle.setAttribute('aria-label', t(minimized ? 'Expandir misiones' : 'Minimizar misiones'));
    toggle.title = t(minimized ? 'Expandir misiones' : 'Minimizar misiones');
  }
  toggle.onclick = () => {
    minimized = !minimized;
    localStorage.setItem('brumaluz-quest-tracker:minimized', String(minimized));
    refreshToggle();
  };
  header.append(journal, toggle); root.append(header, button); document.body.append(root);
  let signature = '';
  return {
    update(data: CharData, visible: boolean, looted = true) {
      const quest = tracking.current(data), shadow = quest === SHADOW_QUEST_KEY, dust = quest === 'fairy-dust';
      root.hidden = !visible || !quest;
      if (root.hidden) return;
      const key = `${quest}:${JSON.stringify(data.welcome)}:${data.shadowQuest}:${data.fairyDustQuest}:${looted}:${data.location}:${JSON.stringify([data.rpg?.tutorial,data.rpg?.learned,data.rpg?.dailyOrders,new Date().toISOString().slice(0,10),data.inventory.map(item=>item?[item.id,item.count]:null)])}:${t('Diario')}`;
      if (key === signature) return;
      signature = key;
      if(quest==='profession'){
        const q=tutorialProgress(data)!,steps=tutorialSteps(data),index=steps.findIndex(s=>!s.done);
        root.setAttribute('aria-label',t('Misión seguida'));heading.textContent=t('Misiones');journal.setAttribute('aria-label',t('Abrir diario'));refreshToggle();label.textContent=t('Iniciación al oficio');title.textContent=`${t(PROFESSION_TUTORIAL.title)} · ${t(RPG_CATALOG.professions[q.job])}`;objective.textContent=t(tutorialObjective(data));progress.textContent=t('Paso {current} de {total}',{current:index+1,total:steps.length});progress.style.setProperty('--quest-progress',`${index/(steps.length-1)*100}%`);button.setAttribute('aria-label',`${t('Abrir diario')}: ${title.textContent}`);return;
      }
      root.setAttribute('aria-label', t('Misión seguida'));
      heading.textContent = t('Misiones');
      journal.setAttribute('aria-label', t('Abrir diario'));
      refreshToggle();
      label.textContent = shadow ? 'Isberto' : dust ? 'Gnomi' : t('Bienvenida · Obligatoria');
      title.textContent = t(dust ? FAIRY_DUST_QUEST_TITLE : shadow ? SHADOW_TITLE : WELCOME_TITLE);
      if (dust && data.fairyDustQuest) objective.textContent = t(fairyDustObjective(data.fairyDustQuest));
      else if (shadow) objective.textContent = t(shadowObjective(data.shadowQuest, looted, data.location));
      else if (data.welcome) objective.textContent = t(welcomeObjective(data.welcome));
      const step = shadow ? data.shadowQuest === 'returning' ? 3 : data.shadowQuest === 'defeated' ? 2 : data.shadowQuest === 'active' ? 1 : 0 : data.welcome?.stage === 'found' ? 2 : data.welcome?.stage === 'active' ? 1 : 0;
      const total = shadow ? 4 : 3;
      progress.textContent = dust ? t(data.fairyDustQuest === 'arboleda' ? 'Continuará' : 'Pregunta a Gnomi') : t('Paso {current} de {total}', { current: step + 1, total });
      progress.style.setProperty('--quest-progress', `${dust ? data.fairyDustQuest === 'arboleda' ? 100 : 0 : step / (total - 1) * 100}%`);
      button.setAttribute('aria-label', `${t('Abrir diario')}: ${t(dust ? FAIRY_DUST_QUEST_TITLE : shadow ? SHADOW_TITLE : WELCOME_TITLE)}`);
    },
  };
}

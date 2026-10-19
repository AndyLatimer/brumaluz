import type { CharData } from '../data/data';
import { ORIGINS, ORIGIN_REPLIES, WELCOME_TITLE, WELCOME_REWARD, questItems, welcomeObjective, type WelcomeAction } from '../data/quests';
import { currencyIcon } from '../data/currency';
import type { Conversation } from './dialog';
import { t } from './i18n';

export function welcomeConversation(data: CharData, act: (action: WelcomeAction, origin?: number) => Promise<boolean>): Conversation {
  const progress = data.welcome;
  const conversation: Conversation = { speaker: 'Gnomi', subtitle: 'Ayudante de bienvenida', start: 'intro', nodes: {} };
  const offer = 'Trabajo en el Gremio de Ayudantes. Los gnomos nos dedicamos a echar una mano… y yo he vuelto a perder mi distintivo del gremio. ¡Otra vez! Debió de soltarse junto al mercado. Si se entera David, el jefe, esta vez se va a enfadar de verdad…\n\n¿Me ayudas a encontrarlo? Te acompaño. Soy mejor ayudando que sujetando distintivos, te lo prometo.';
  const quest = {
    title: WELCOME_TITLE,
    objective: 'Acompaña a Gnomi al mercado, encuentra su distintivo y devuélveselo.',
    ...WELCOME_REWARD,
  };
  if (!progress) {
    conversation.nodes.intro = { text: '¡Buen camino! Si alguien necesita una mano por aquí, procuraré que encuentre dos.' };
  } else if (progress.origin === null) {
    conversation.nodes.intro = {
      text: '¡Hola! Soy Gnomi, ayudante de bienvenida. ¿Empiezas una nueva etapa en Brumaluz? Cuéntame un poquito.',
      choices: ORIGINS[data.race].map((text, i) => ({ text, action: () => act('origin', i), next: `offer-${i}` })),
    };
    ORIGINS[data.race].forEach((_, i) => {
      conversation.nodes[`offer-${i}`] = {
        text: `${t(ORIGIN_REPLIES[i])}\n\n${t(offer)}`,
        quest,
        choices: [{ text: 'Aceptar misión', action: () => act('accept') }],
      };
    });
  } else if (progress.stage === 'available') {
    conversation.nodes.intro = { text: `${t(ORIGIN_REPLIES[progress.origin])}\n\n${t(offer)}`, quest,
      choices: [{ text: 'Aceptar misión', action: () => act('accept') }] };
  } else if (progress.stage === 'active') {
    conversation.nodes.intro = { text: 'Estuve junto al mercado. Seguro que sigue allí. Voy contigo… cuatro ojos ven más que dos, aunque dos estén bajo un gorro.' };
  } else if (progress.stage === 'found') {
    conversation.nodes.intro = {
      text: '¡Mi distintivo del gremio! Menos mal… ¿Me lo devuelves? Esta vez lo voy a sujetar bien. Y, si nos cruzamos con David, tú y yo solo hemos dado un paseo. ¿De acuerdo?',
      quest: { ...quest, objective: 'Devuelve a Gnomi su distintivo del Gremio de Ayudantes.', turnIn: true },
      choices: [{ text: 'Completar misión', action: () => act('claim'), next: 'thanks' }],
    };
    conversation.nodes.thanks = {
      text: '¡Ahora sí, bien sujeto! Gracias de corazón. Este distintivo significa que puedo ser útil… y hoy tú me has ayudado a serlo.\n\nOye, antes me contabas que buscas tu camino por Brumaluz. Si quieres encontrar un oficio, puedo orientarte. ¡Para eso soy ayudante de bienvenida! Primero acompáñame a ver a Isberto, un granjero de las afueras. Me ha pedido ayuda con algo extraño que ronda su ganado.',
    };
  } else if (progress.stage === 'completed') {
    conversation.nodes.intro = { text: '¡Mi compañero de búsqueda! El distintivo sigue en su sitio. Lo he comprobado. Dos veces. Cuando quieras, acompáñame a ver a Isberto, el granjero de las afueras; después te ayudaré a encontrar tu camino por Brumaluz.' };
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

function createQuestRewards(completed: boolean) {
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
    { kind: 'experience', value: WELCOME_REWARD.experience, label: 'Experiencia', icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 3 3.7 8.6 9.3 1-7 6.2 2 9.2-8-4.8L8 28l2-9.2-7-6.2 9.3-1Z" fill="#b0c590" stroke="#58774f" stroke-width="1.5"/><path d="m16 9 1.7 5 5.3.3-4.2 3.2 1.4 5-4.2-3-4.2 3 1.4-5L9 14.3l5.3-.3Z" fill="#f9ebbd"/></svg>' },
    { kind: 'pelines', value: WELCOME_REWARD.pelines, label: 'Pelines', icon: currencyIcon('pelines') },
  ]) {
    const card = document.createElement('div'); card.className = `quest-reward ${reward.kind}`;
    const icon = document.createElement('span'); icon.className = 'quest-reward-icon'; icon.innerHTML = reward.icon;
    const body = document.createElement('div');
    const amount = document.createElement('b'); amount.textContent = `+${reward.value}`;
    const label = document.createElement('strong'); label.textContent = t(reward.label);
    body.append(amount, label); card.append(icon, body); list.append(card);
  }
  footer.append(list); return footer;
}

export function renderQuestJournal(container: HTMLElement, data: CharData) {
  container.replaceChildren();
  const root = document.createElement('div');
  root.className = 'quest-journal';
  const tabs = document.createElement('div');
  tabs.className = 'social-tabs';
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', t('Estado de las misiones'));
  const content = document.createElement('div');
  content.className = 'quest-journal-content';
  const buttons: HTMLButtonElement[] = [];
  function display(completed: boolean) {
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === Number(completed))));
    content.replaceChildren();
    const progress = data.welcome;
    if (!progress || (progress.stage === 'completed') !== completed) {
      const empty = document.createElement('p'); empty.className = 'quest-empty';
      empty.textContent = t(completed ? 'Todavía no hay misiones completadas.' : 'No tienes misiones activas.');
      content.append(empty); return;
    }
    const article = document.createElement('article'); article.className = 'quest-entry';
    const seal = document.createElement('span'); seal.className = 'quest-seal'; seal.textContent = completed ? '✓' : '!';
    const header = document.createElement('header');
    const title = document.createElement('h3'); title.textContent = t(WELCOME_TITLE);
    const giver = document.createElement('span'); giver.className = 'quest-giver';
    giver.textContent = t('Gnomi · Gremio de Ayudantes');
    header.append(title, giver);
    const text = document.createElement('p');
    text.textContent = t('Gnomi ha vuelto a perder su distintivo del Gremio de Ayudantes. Ayúdalo a encontrarlo cerca del mercado antes de que se entere David, su jefe.');
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
    article.append(createQuestRewards(completed)); content.append(article);
  }
  ['Activas', 'Completadas'].forEach((label, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = t(label);
    button.onclick = () => display(i === 1); tabs.append(button); buttons.push(button);
  });
  root.append(tabs, content); container.append(root); display(data.welcome?.stage === 'completed');
}

export function createQuestTracker(open: () => void) {
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
    update(data: CharData, visible: boolean) {
      root.hidden = !visible || !data.welcome || data.welcome.stage === 'completed';
      if (root.hidden || !data.welcome) return;
      const key = `${JSON.stringify(data.welcome)}:${t('Diario')}`;
      if (key === signature) return;
      signature = key;
      root.setAttribute('aria-label', t('Misión seguida'));
      heading.textContent = t('Misiones');
      journal.setAttribute('aria-label', t('Abrir diario'));
      refreshToggle();
      label.textContent = t('Bienvenida · Obligatoria');
      title.textContent = t(WELCOME_TITLE);
      objective.textContent = t(welcomeObjective(data.welcome));
      const step = data.welcome.stage === 'found' ? 2 : data.welcome.stage === 'active' ? 1 : 0;
      progress.textContent = t('Paso {current} de {total}', { current: step + 1, total: 3 });
      progress.style.setProperty('--quest-progress', `${step / 2 * 100}%`);
      button.setAttribute('aria-label', `${t('Abrir diario')}: ${t(WELCOME_TITLE)}`);
    },
  };
}

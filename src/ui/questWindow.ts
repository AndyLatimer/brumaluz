import type { CharData } from '../data/data';
import { ORIGINS, ORIGIN_REPLIES, WELCOME_TITLE, welcomeObjective, type WelcomeAction } from '../data/quests';
import type { Conversation } from './dialog';
import { t } from './i18n';

export function welcomeConversation(data: CharData, act: (action: WelcomeAction, origin?: number) => Promise<boolean>): Conversation {
  const progress = data.welcome;
  const conversation: Conversation = { speaker: 'Gnomi', start: 'intro', nodes: {} };
  const reward = t('Recompensa: 40 XP · 5 pelines');
  const offer = 'He perdido mi distintivo de ayudante. Es pequeño, ya lo sé… pero me lo confiaron a mí. Creo que se soltó junto al mercado. ¿Me acompañas a buscarlo?';
  if (!progress) {
    conversation.nodes.intro = { text: '¡Buen camino! Si alguien necesita una mano por aquí, procuraré que encuentre dos.' };
  } else if (progress.origin === null) {
    conversation.nodes.intro = {
      text: '¡Hola! Soy Gnomi, ayudante de acogida. ¿Empiezas una nueva etapa en Brumaluz? Cuéntame un poquito.',
      choices: ORIGINS[data.race].map((text, i) => ({ text, next: `confirm-${i}` })),
    };
    ORIGINS[data.race].forEach((text, i) => {
      conversation.nodes[`confirm-${i}`] = {
        text: t('Tu motivo: «{origin}»\nEsta elección quedará guardada para este personaje y no cambia tus atributos.', { origin: t(text) }),
        choices: [
          { text: 'Confirmar mi motivo', action: () => act('origin', i), next: `offer-${i}` },
          { text: 'Elegir otro motivo', next: 'intro' },
        ],
      };
      conversation.nodes[`offer-${i}`] = {
        text: `${t(ORIGIN_REPLIES[i])}\n\n${t(offer)}\n\n${reward}`,
        choices: [{ text: 'Ayudar a Gnomi', action: () => act('accept') }],
      };
    });
  } else if (progress.stage === 'available') {
    conversation.nodes.intro = { text: `${t(ORIGIN_REPLIES[progress.origin])}\n\n${t(offer)}\n\n${reward}`,
      choices: [{ text: 'Ayudar a Gnomi', action: () => act('accept') }] };
  } else if (progress.stage === 'active') {
    conversation.nodes.intro = { text: 'Estuve junto al mercado. Seguro que sigue allí. Voy contigo… cuatro ojos ven más que dos, aunque dos estén bajo un gorro.' };
  } else if (progress.stage === 'found') {
    conversation.nodes.intro = {
      text: `${t('¡Ese es! No sabes cuánto me alegra verlo. ¿Me lo devuelves? Prometo sujetarlo mejor esta vez.')}\n\n${reward}`,
      choices: [{ text: 'Devolver el distintivo', action: () => act('claim'), next: 'thanks' }],
    };
    conversation.nodes.thanks = { text: 'Gracias. Quizá sea poca cosa para otros, pero para mí significa que puedo ser útil. Y hoy tú me has ayudado a serlo.' };
  } else conversation.nodes.intro = { text: '¡Mi compañero de búsqueda! El distintivo sigue en su sitio. Lo he comprobado. Dos veces.' };
  return conversation;
}

export function renderQuestJournal(container: HTMLElement, data: CharData) {
  container.replaceChildren();
  const root = document.createElement('div');
  root.className = 'quest-journal';
  const intro = document.createElement('p');
  intro.className = 'quest-journal-intro';
  intro.textContent = t('Cada gran viaje empieza con un pequeño paso.');
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
    const tag = document.createElement('small'); tag.textContent = t(completed ? 'Bienvenida completada' : 'Bienvenida · Obligatoria');
    const title = document.createElement('h3'); title.textContent = t(WELCOME_TITLE);
    header.append(tag, title);
    const text = document.createElement('p');
    text.textContent = t('Gnomi ha perdido su distintivo de ayudante. Para otros es una pieza sencilla; para él significa mucho. Acompáñalo a recuperarlo cerca del mercado.');
    const objective = document.createElement('p'); objective.className = 'quest-objective'; objective.textContent = t(welcomeObjective(progress));
    article.append(seal, header, text, objective);
    if (progress.stage === 'found') {
      const item = document.createElement('div'); item.className = 'quest-key-item';
      item.textContent = t('Distintivo de Gnomi · Objeto de misión');
      const note = document.createElement('small'); note.textContent = t('No ocupa mochila. No se puede vender ni intercambiar.');
      item.append(note); article.append(item);
    }
    if (progress.origin !== null) {
      const origin = document.createElement('p'); origin.className = 'quest-origin';
      origin.textContent = `${t('Tu motivo')}: ${t(ORIGINS[data.race][progress.origin])}`; article.append(origin);
    }
    const rewards = document.createElement('footer');
    rewards.textContent = t(completed ? 'Recompensa recibida: 40 XP · 5 pelines' : 'Recompensa: 40 XP · 5 pelines');
    article.append(rewards); content.append(article);
  }
  ['Activas', 'Completadas'].forEach((label, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = t(label);
    button.onclick = () => display(i === 1); tabs.append(button); buttons.push(button);
  });
  root.append(intro, tabs, content); container.append(root); display(data.welcome?.stage === 'completed');
}

export function createQuestTracker(open: () => void) {
  const root = document.createElement('aside'); root.id = 'quest-tracker'; root.hidden = true;
  root.setAttribute('aria-label', t('Misión seguida'));
  const button = document.createElement('button'); button.type = 'button'; button.onclick = open;
  const label = document.createElement('small'), title = document.createElement('strong'), objective = document.createElement('span');
  button.append(label, title, objective); root.append(button); document.body.append(root);
  let signature = '';
  return {
    update(data: CharData, visible: boolean) {
      root.hidden = !visible || !data.welcome || data.welcome.stage === 'completed';
      if (root.hidden || !data.welcome) return;
      const key = `${JSON.stringify(data.welcome)}:${t('Diario')}`;
      if (key === signature) return;
      signature = key;
      label.textContent = t('Bienvenida · Obligatoria');
      title.textContent = t(WELCOME_TITLE);
      objective.textContent = t(welcomeObjective(data.welcome));
      button.setAttribute('aria-label', `${t('Abrir diario')}: ${t(WELCOME_TITLE)}`);
    },
  };
}

import { getProfileUsername, listFriends, requestFriend, updateFriend, type FriendEntry } from '../services/account';
import { focusChat, isChatIgnored, setChatIgnored } from './chatWindow';
import { t } from './i18n';

const ICONS = {
  friend: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M19 7v6m-3-3h6"/>',
  remove: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 10h6"/>',
  whisper: '<path d="M21 15a3 3 0 0 1-3 3H9l-6 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3zM7 8h10M7 12h7"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5zM16 9l6 6m0-6-6 6"/>',
  unmute: '<path d="m11 4-6 5H2v6h3l6 5zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
};
interface Target { id: string; userId: string; name: string }
interface Action { label: string; icon: keyof typeof ICONS; run(): Promise<void> | void }

export function createPlayerInteractions() {
  const panel = document.createElement('section');
  panel.id = 'player-interactions';
  panel.className = 'player-interactions';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'player-interaction-name');
  const heading = document.createElement('strong');
  heading.id = 'player-interaction-name';
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  const choices = document.createElement('div');
  choices.className = 'player-interaction-choices';
  const hint = document.createElement('p');
  hint.className = 'player-interaction-hint';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'player-interaction-close';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', t('Cerrar'));
  closeButton.onclick = close;
  panel.append(closeButton, heading, message, choices, hint);
  document.body.append(panel);
  let target: Target | null = null;
  let generation = 0;
  let actions: Action[] = [];
  let selected = 0;
  let busy = false;

  function close() {
    generation++;
    target = null;
    panel.hidden = true;
    choices.replaceChildren();
    actions = [];
    selected = 0;
    busy = false;
  }
  function status(text: string, error = false) {
    message.textContent = text;
    message.classList.toggle('error', error);
  }
  function move(offset: number) {
    if (busy || !actions.length) return;
    selected = (selected + offset + actions.length) % actions.length;
    render();
    choices.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }
  function render() {
    choices.replaceChildren();
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'player-interaction-arrow';
    previous.textContent = '‹';
    previous.setAttribute('aria-label', t('Acción anterior'));
    previous.disabled = busy;
    previous.onclick = () => move(-1);
    choices.append(previous);
    actions.forEach((action, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'player-interaction-action';
      button.disabled = busy;
      button.setAttribute('aria-pressed', String(index === selected));
      button.setAttribute('aria-label', t(action.label));
      button.title = t(action.label);
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[action.icon]}</svg>`;
      button.onclick = () => { selected = index; void execute(); };
      choices.append(button);
    });
    const next = previous.cloneNode(true) as HTMLButtonElement;
    next.textContent = '›';
    next.setAttribute('aria-label', t('Acción siguiente'));
    next.onclick = () => move(1);
    choices.append(next);
    hint.textContent = actions[selected] ? `${t(actions[selected].label)} · ← → · E / Enter · Esc` : '';
  }
  async function execute() {
    const action = actions[selected];
    if (busy || !target || !action) return;
    const version = generation;
    busy = true;
    render();
    try {
      await action.run();
    } catch (error) {
      if (generation === version) status(t(error instanceof Error ? error.message : String(error)), true);
    } finally {
      if (generation === version) { busy = false; render(); }
    }
  }
  function configure(person: Target, username: string, relation: FriendEntry | undefined) {
    const version = generation;
    const friend = relation?.status === 'friend';
    const label = friend ? 'Eliminar amigo' : relation?.status === 'incoming' ? 'Aceptar solicitud' : relation?.status === 'outgoing' ? 'Cancelar solicitud' : 'Añadir amigo';
    actions = [{
      label, icon: friend || relation?.status === 'outgoing' ? 'remove' : 'friend',
      async run() {
        const before = await listFriends();
        if (generation !== version) return;
        const current = before.find((entry) => entry.userId === person.userId);
        if (current?.status !== relation?.status) {
          configure(person, username, current);
          return;
        }
        if (friend && !window.confirm(t('¿Eliminar a {name} de tus amigos?', { name: username }))) return;
        if (relation) await updateFriend(person.userId, relation.status === 'incoming' ? 'accept' : 'remove');
        else await requestFriend(username);
        if (generation !== version) return;
        const entries = await listFriends();
        if (generation !== version) return;
        configure(person, username, entries.find((entry) => entry.userId === person.userId));
      },
    }, {
      label: 'Susurrar', icon: 'whisper',
      run() { close(); focusChat(`/w ~${username} `); },
    }];
    if (!friend) {
      const muted = isChatIgnored(username);
      actions.push({
        label: muted ? 'Reactivar chat' : 'Silenciar chat',
        icon: muted ? 'unmute' : 'mute',
        async run() {
          const friends = await listFriends();
          if (generation !== version) return;
          const current = friends.find((entry) => entry.userId === person.userId);
          if (current?.status === 'friend') {
            configure(person, username, current);
            return;
          }
          setChatIgnored(username, !isChatIgnored(username));
          configure(person, username, current);
        },
      });
    }
    selected = Math.min(selected, actions.length - 1);
    status(`~${username}`);
    render();
  }
  async function open(person: Target) {
    close();
    target = person;
    const version = generation;
    heading.textContent = person.name;
    panel.hidden = false;
    hint.textContent = '';
    status(t('Cargando…'));
    closeButton.focus();
    busy = true;
    try {
      const [username, friends] = await Promise.all([getProfileUsername(person.userId), listFriends()]);
      if (generation !== version) return;
      if (!username) throw new Error(t('Este jugador no tiene nombre de cuenta.'));
      configure(person, username, friends.find((entry) => entry.userId === person.userId));
    } catch (error) {
      if (generation === version) status(t(error instanceof Error ? error.message : String(error)), true);
    } finally {
      if (generation === version) { busy = false; render(); }
    }
  }
  return {
    open, close,
    get targetId() { return target?.id ?? null; },
    get isOpen() { return target !== null; },
    key(event: KeyboardEvent) {
      event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Escape' || event.code === 'Tab') close();
      else if (event.code === 'ArrowLeft' || event.code === 'KeyA') move(-1);
      else if (event.code === 'ArrowRight' || event.code === 'KeyD') move(1);
      else if (event.code === 'KeyE' || event.code === 'Enter') void execute();
    },
  };
}

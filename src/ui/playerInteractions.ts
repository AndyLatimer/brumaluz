import { getProfileUsername, listFriends, requestFriend, updateFriend, type FriendEntry } from '../services/account';
import { focusChat, isChatIgnored, setChatIgnored } from './chatWindow';
import { t } from './i18n';

const ICONS = {
  friend: '<path class="icon-enamel" d="m24 4 15 6v14c0 10-8 16-15 20C17 40 9 34 9 24V10z"/><path class="icon-detail" d="m24 8 11 5v11c0 7-5 12-11 16-6-4-11-9-11-16V13z"/><circle class="icon-parchment" cx="21" cy="19" r="5"/><path class="icon-parchment" d="M13 33v-3a8 8 0 0 1 15-4"/><circle class="icon-seal" cx="33" cy="31" r="9"/><path class="icon-mark" d="M33 27v8m-4-4h8"/>',
  accept: '<path class="icon-enamel" d="m24 4 15 6v14c0 10-8 16-15 20C17 40 9 34 9 24V10z"/><path class="icon-detail" d="m24 8 11 5v11c0 7-5 12-11 16-6-4-11-9-11-16V13z"/><path class="icon-mark" d="m16 23 6 6 11-13"/><path d="m20 36 4 3 4-3"/>',
  remove: '<path class="icon-enamel" d="m24 4 15 6v14c0 10-8 16-15 20C17 40 9 34 9 24V10z"/><path class="icon-detail" d="m24 8 11 5v11c0 7-5 12-11 16-6-4-11-9-11-16V13z"/><circle class="icon-parchment" cx="21" cy="19" r="5"/><path class="icon-parchment" d="M13 33v-3a8 8 0 0 1 15-4"/><circle class="icon-wax" cx="33" cy="31" r="9"/><path class="icon-mark" d="M29 31h8"/>',
  whisper: '<path class="icon-parchment" d="M10 12h28v26H10z"/><path class="icon-detail" d="M14 17h13m-13 5h10m-10 5h7"/><path class="icon-parchment" d="M10 12H7a4 4 0 0 1 0-8h27a4 4 0 0 1 4 4v4M10 38h23a4 4 0 0 0 4-4H14a4 4 0 1 0 0 8h19"/><path class="icon-enamel" d="M24 29C23 17 32 6 44 5c0 11-7 21-20 24Z"/><path class="icon-mark" d="M21 35 39 11m-9 13 7-1m-3-6 5-1"/><circle class="icon-wax" cx="17" cy="33" r="4"/>',
  mute: '<path class="icon-enamel" d="M11 32c5-5 4-10 4-14a9 9 0 0 1 18 0c0 4-1 9 4 14l2 3H9z"/><path class="icon-parchment" d="M21 9V6a3 3 0 0 1 6 0v3M19 36a5 5 0 0 0 10 0"/><path class="icon-detail" d="M19 19c0-4 2-6 4-6M13 31h22"/><path class="icon-ribbon" d="m8 7 34 34"/><path class="icon-mark" d="m8 7 34 34"/>',
  unmute: '<path class="icon-enamel" d="M11 32c5-5 4-10 4-14a9 9 0 0 1 18 0c0 4-1 9 4 14l2 3H9z"/><path class="icon-parchment" d="M21 9V6a3 3 0 0 1 6 0v3M19 36a5 5 0 0 0 10 0"/><path class="icon-detail" d="M19 19c0-4 2-6 4-6M13 31h22"/><path class="icon-mark" d="m6 15-3-3m39 3 3-3M5 23H2m41 0h3"/>',
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
  const header = document.createElement('header');
  header.className = 'player-interaction-header';
  const crest = document.createElement('span');
  crest.className = 'player-interaction-crest';
  crest.setAttribute('aria-hidden', 'true');
  crest.innerHTML = `<svg viewBox="0 0 48 48">${ICONS.accept}</svg>`;
  const eyebrow = document.createElement('span');
  eyebrow.className = 'player-interaction-eyebrow';
  eyebrow.textContent = t('Social');
  const heading = document.createElement('strong');
  heading.id = 'player-interaction-name';
  header.append(crest, eyebrow, heading);
  const message = document.createElement('p');
  message.className = 'player-interaction-status';
  message.setAttribute('role', 'status');
  const choices = document.createElement('div');
  choices.className = 'player-interaction-choices';
  const hint = document.createElement('p');
  hint.className = 'player-interaction-hint';
  const actionLabel = document.createElement('p');
  actionLabel.className = 'player-interaction-label';
  actionLabel.setAttribute('aria-live', 'polite');
  hint.innerHTML = '<kbd>←</kbd><kbd>→</kbd><span>·</span><kbd>E / Enter</kbd><span>·</span><kbd>Esc</kbd>';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'player-interaction-close';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', t('Cerrar'));
  closeButton.onclick = close;
  panel.append(closeButton, header, message, choices, actionLabel, hint);
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
    actionLabel.textContent = '';
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
    panel.setAttribute('aria-busy', String(busy));
    choices.replaceChildren();
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'player-interaction-arrow';
    previous.innerHTML = '<svg viewBox="0 0 16 24" aria-hidden="true"><path d="m11 5-7 7 7 7"/></svg>';
    previous.setAttribute('aria-label', t('Acción anterior'));
    previous.disabled = busy;
    previous.onclick = () => move(-1);
    choices.append(previous);
    actions.forEach((action, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'player-interaction-action';
      button.dataset.icon = action.icon;
      button.disabled = busy;
      button.setAttribute('aria-pressed', String(index === selected));
      button.setAttribute('aria-label', t(action.label));
      button.title = t(action.label);
      button.innerHTML = `<span class="player-interaction-medallion"><svg viewBox="0 0 48 48" aria-hidden="true">${ICONS[action.icon]}</svg></span><span class="player-interaction-gem" aria-hidden="true"></span>`;
      button.onclick = () => { selected = index; void execute(); };
      choices.append(button);
    });
    const next = previous.cloneNode(true) as HTMLButtonElement;
    next.classList.add('next');
    next.setAttribute('aria-label', t('Acción siguiente'));
    next.onclick = () => move(1);
    choices.append(next);
    actionLabel.textContent = actions[selected] ? t(actions[selected].label) : '';
    hint.hidden = !actions.length;
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
      label, icon: friend || relation?.status === 'outgoing' ? 'remove' : relation?.status === 'incoming' ? 'accept' : 'friend',
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
    hint.hidden = true;
    panel.setAttribute('aria-busy', 'true');
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

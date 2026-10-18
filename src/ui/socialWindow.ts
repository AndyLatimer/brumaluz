import { requestFriend, updateFriend, type FriendEntry } from '../services/account';
import { readFriends as listFriends } from '../services/friends';
import { CLASSES, type ClassId } from '../data/data';
import { classIcon } from './classIcons';
import { t } from './i18n';

const ICONS = {
  friend: '<path d="m12 2 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10V5z"/><circle cx="12" cy="9" r="3"/><path d="M7 17a5 5 0 0 1 10 0"/>',
  incoming: '<path d="M3 9h18v12H3zM3 10l9 6 9-6M12 2v9m-3-3 3 3 3-3"/>',
  outgoing: '<path d="M3 9h5m8 0h5v12H3V9m0 1 9 6 9-6M12 11V2m-3 3 3-3 3 3"/>',
  whisper: '<path d="M4 5h16v13H9l-5 4zM8 9h8m-8 4h5"/>',
  accept: '<path d="m12 2 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10V5zM8 12l3 3 6-7"/>',
  remove: '<path d="M6 6l12 12M18 6 6 18"/>',
  character: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};
function icon(kind: keyof typeof ICONS) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[kind];
  return svg;
}

export function renderSocial(container: HTMLElement, whisper: (username: string) => void) {
  container.replaceChildren();
  const root = document.createElement('div');
  root.className = 'social-window';
  const tabs = document.createElement('div');
  tabs.className = 'social-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', t('Social'));
  const friendsPanel = document.createElement('div');
  friendsPanel.className = 'social-friends-panel';
  friendsPanel.id = 'social-friends-panel';
  friendsPanel.setAttribute('role', 'tabpanel');
  const groupPanel = document.createElement('div');
  groupPanel.id = 'social-group-panel';
  groupPanel.className = 'social-group-panel';
  groupPanel.setAttribute('role', 'tabpanel');
  groupPanel.hidden = true;
  const groupTitle = document.createElement('h3');
  groupTitle.textContent = t('Tu próxima aventura, en grupo');
  const groupText = document.createElement('p');
  groupText.textContent = t('Próximamente podrás formar un grupo con otros aventureros.');
  groupPanel.append(icon('friend'), groupTitle, groupText);
  const tabButtons = [friendsPanel, groupPanel].map((panel, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `social-tab-${index}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.setAttribute('aria-selected', String(index === 0));
    tab.tabIndex = index === 0 ? 0 : -1;
    panel.setAttribute('aria-labelledby', tab.id);
    tab.append(icon(index === 0 ? 'friend' : 'accept'), document.createTextNode(t(index === 0 ? 'Amigos' : 'Grupo')));
    tab.onclick = () => selectTab(index);
    tabs.append(tab);
    return tab;
  });
  function selectTab(index: number) {
    [friendsPanel, groupPanel].forEach((panel, i) => {
      panel.hidden = i !== index;
      tabButtons[i].setAttribute('aria-selected', String(i === index));
      tabButtons[i].tabIndex = i === index ? 0 : -1;
    });
  }
  tabs.onkeydown = (event) => {
    const current = tabButtons.findIndex((tab) => tab === document.activeElement);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - current;
    selectTab(index);
    tabButtons[index].focus();
  };
  const overview = document.createElement('div');
  overview.className = 'social-overview';
  const invitation = document.createElement('section');
  invitation.className = 'social-invitation';
  const invitationLabel = document.createElement('label');
  invitationLabel.textContent = t('Invita a un compañero');
  const form = document.createElement('form');
  form.className = 'social-add';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'social-username';
  invitationLabel.htmlFor = input.id;
  input.required = true;
  input.maxLength = 20;
  input.pattern = '[A-Za-z0-9_]{3,20}';
  input.placeholder = t('Nombre de cuenta');
  input.setAttribute('aria-label', t('Nombre de cuenta'));
  input.autocomplete = 'off';
  const field = document.createElement('div');
  field.className = 'social-account-field';
  const prefix = document.createElement('span');
  prefix.className = 'social-account-prefix';
  prefix.textContent = '~';
  prefix.setAttribute('aria-hidden', 'true');
  field.append(prefix, input);
  input.addEventListener('input', () => {
    if (input.value.startsWith('~')) input.value = input.value.replace(/^~+/, '');
  });
  const send = document.createElement('button');
  send.className = 'btn gold';
  send.type = 'submit';
  send.append(icon('friend'), document.createTextNode(t('Añadir amigo')));
  form.append(field, send);
  const help = document.createElement('p');
  help.id = 'social-invitation-help';
  help.className = 'social-help';
  help.textContent = t('Usa su nombre de cuenta, no el de su personaje.');
  input.setAttribute('aria-describedby', help.id);
  invitation.append(invitationLabel, form, help);
  const message = document.createElement('p');
  message.className = 'account-message';
  message.setAttribute('role', 'status');
  const lists = document.createElement('div');
  lists.className = 'social-lists';
  friendsPanel.append(overview, invitation, message, lists);
  root.append(tabs, friendsPanel, groupPanel);
  container.append(root);
  let closed = false;
  let busy = false;
  let lastEntries = '';
  const sectionSignatures = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function status(text: string, error = false) {
    const translated = t(text);
    if (message.textContent !== translated) message.textContent = translated;
    message.classList.toggle('error', error);
  }
  function setBusy(value: boolean) {
    busy = value;
    lists.setAttribute('aria-busy', String(value));
    for (const control of friendsPanel.querySelectorAll<HTMLButtonElement>('button')) control.disabled = value || control.dataset.unavailable === 'true';
  }
  function button(text: string, kind: keyof typeof ICONS, action: () => void) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `btn ghost social-action-${kind}`;
    el.append(icon(kind), document.createTextNode(t(text)));
    el.onclick = action;
    return el;
  }
  function display(entries: FriendEntry[]) {
    const friends = entries.filter((entry) => entry.status === 'friend');
    overview.replaceChildren();
    for (const [label, count, kind] of [
      ['Tus amigos', friends.length, 'friend'],
      ['Solicitudes recibidas', entries.filter((entry) => entry.status === 'incoming').length, 'incoming'],
    ] as const) {
      const stat = document.createElement('div');
      stat.className = `social-stat social-stat-${kind}`;
      const number = document.createElement('strong');
      number.textContent = String(count);
      const caption = document.createElement('span');
      caption.textContent = t(label);
      const value = document.createElement('div');
      value.className = 'social-stat-value';
      value.append(icon(kind), number);
      stat.append(value, caption);
      if (kind === 'friend') {
        const connected = document.createElement('small');
        connected.className = 'social-connected-total';
        connected.textContent = t('({n} conectados)', { n: friends.filter((entry) => entry.online).length });
        caption.append(' ', connected);
      }
      overview.append(stat);
    }
    for (const [kind, label] of [['friend', 'Amigos'], ['incoming', 'Solicitudes recibidas'], ['outgoing', 'Solicitudes enviadas']] as const) {
      const rows = entries.filter((entry) => entry.status === kind).sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username));
      const signature = JSON.stringify(rows);
      if (sectionSignatures.get(kind) === signature) continue;
      sectionSignatures.set(kind, signature);
      const section = lists.querySelector<HTMLElement>(`[data-social="${kind}"]`) ?? document.createElement('section');
      section.replaceChildren();
      section.dataset.social = kind;
      section.className = 'social-section';
      const heading = document.createElement('h3');
      const count = document.createElement('span');
      count.className = 'social-count';
      count.textContent = String(rows.length);
      heading.append(icon(kind), document.createTextNode(t(label)), count);
      section.append(heading);
      if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'social-empty';
        empty.append(icon(kind), document.createTextNode(t(kind === 'friend' ? 'Tu próxima aventura puede empezar con una amistad.' : kind === 'incoming' ? 'No tienes invitaciones pendientes de responder.' : 'Tus próximas invitaciones aparecerán aquí.')));
        section.append(empty);
      }
      for (const entry of rows) {
        const row = document.createElement('article');
        row.className = 'social-row';
        row.dataset.userId = entry.userId;
        row.classList.toggle('online', kind === 'friend' && entry.online);
        const avatar = document.createElement('span');
        avatar.className = 'social-avatar';
        if (entry.online && entry.characterClass && Object.hasOwn(CLASSES, entry.characterClass)) {
          const cls = entry.characterClass as ClassId;
          avatar.innerHTML = classIcon(cls, `friend-${entry.userId}`);
          avatar.setAttribute('role', 'img');
          avatar.setAttribute('aria-label', t(CLASSES[cls].label));
          avatar.title = t(CLASSES[cls].label);
        } else {
          avatar.append(icon('friend'));
          avatar.setAttribute('aria-hidden', 'true');
        }
        const info = document.createElement('div');
        info.className = 'social-info';
        const name = document.createElement('strong');
        name.textContent = `~${entry.username}`;
        info.append(name);
        if (kind === 'friend') {
          const presence = document.createElement('span');
          presence.className = entry.online ? 'social-online' : 'social-offline';
          presence.textContent = t(entry.online ? 'Conectado' : 'Desconectado');
          info.append(presence);
          if (entry.online) {
            const details = document.createElement('dl');
            details.className = 'social-details';
            for (const [label, value] of [['Personaje', entry.characterName], ['Ubicación', entry.location === 'brumaluz' ? 'Brumaluz' : entry.location]] as const) {
              if (!value) continue;
              const dt = document.createElement('dt');
              dt.append(icon(label === 'Personaje' ? 'character' : 'location'), document.createTextNode(t(label)));
              const dd = document.createElement('dd');
              dd.textContent = label === 'Personaje' ? value : t(value);
              details.append(dt, dd);
            }
            info.append(details);
          }
        }
        const actions = document.createElement('div');
        actions.className = 'social-actions';
        if (kind === 'friend') {
          const whisperButton = button('Susurrar', 'whisper', () => {
            if (entry.online) whisper(entry.username);
          });
          whisperButton.dataset.unavailable = String(!entry.online);
          whisperButton.disabled = !entry.online;
          if (!entry.online) whisperButton.title = t('Solo puedes susurrar a amigos conectados.');
          actions.append(whisperButton);
          actions.append(button('Eliminar amigo', 'remove', () => {
            if (window.confirm(t('¿Eliminar a {name} de tus amigos?', { name: entry.username }))) void change(() => updateFriend(entry.userId, 'remove'));
          }));
        } else {
          if (kind === 'incoming') actions.append(button('Aceptar', 'accept', () => void change(() => updateFriend(entry.userId, 'accept'))));
          actions.append(button(kind === 'incoming' ? 'Rechazar' : 'Cancelar solicitud', 'remove', () => void change(() => updateFriend(entry.userId, 'remove'))));
        }
        row.append(avatar, info, actions);
        section.append(row);
      }
      if (!section.isConnected) lists.append(section);
    }
  }
  async function refresh() {
    try {
      const entries = await listFriends();
      if (closed) return;
      const signature = JSON.stringify([...entries].sort((a, b) => a.userId.localeCompare(b.userId)));
      if (signature !== lastEntries) {
        display(entries);
        lastEntries = signature;
      }
      status('');
    } catch (error) {
      if (!closed) status(error instanceof Error ? error.message : String(error), true);
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (!closed) timer = setTimeout(() => void poll(), 5000);
  }
  async function poll() {
    if (closed) return;
    const initial = !lastEntries;
    if (initial) setBusy(true);
    await refresh();
    if (initial) setBusy(false);
    schedule();
  }
  async function change(action: () => Promise<void>) {
    if (closed || busy) return;
    clearTimeout(timer);
    setBusy(true);
    try {
      await action();
      if (!closed) await refresh();
    } catch (error) {
      if (!closed) status(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(false);
      schedule();
    }
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    const username = input.value.trim();
    if (!username || busy) return;
    void change(async () => {
      await requestFriend(username);
      if (!closed) input.value = '';
    });
  };
  status('Cargando…');
  void poll();
  return () => { closed = true; clearTimeout(timer); };
}

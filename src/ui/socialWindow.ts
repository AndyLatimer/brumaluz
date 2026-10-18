import { listFriends, requestFriend, updateFriend, type FriendEntry } from '../services/account';
import { t } from './i18n';

const ICONS = {
  friend: '<path d="m12 2 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10V5z"/><circle cx="12" cy="9" r="3"/><path d="M7 17a5 5 0 0 1 10 0"/>',
  incoming: '<path d="M3 9h18v12H3zM3 10l9 6 9-6M12 2v9m-3-3 3 3 3-3"/>',
  outgoing: '<path d="M3 9h5m8 0h5v12H3V9m0 1 9 6 9-6M12 11V2m-3 3 3-3 3 3"/>',
  whisper: '<path d="M4 5h16v13H9l-5 4zM8 9h8m-8 4h5"/>',
  accept: '<path d="m12 2 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10V5zM8 12l3 3 6-7"/>',
  remove: '<path d="M6 6l12 12M18 6 6 18"/>',
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
  const introduction = document.createElement('header');
  introduction.className = 'social-introduction';
  const crest = document.createElement('span');
  crest.className = 'social-crest';
  crest.append(icon('friend'));
  const welcome = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = t('Compañeros de aventuras');
  const subtitle = document.createElement('p');
  subtitle.textContent = t('Los mejores caminos se recorren en compañía.');
  welcome.append(title, subtitle);
  introduction.append(crest, welcome);
  const overview = document.createElement('div');
  overview.className = 'social-overview';
  const summary = document.createElement('p');
  summary.className = 'social-summary';
  overview.append(summary);
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
  const send = document.createElement('button');
  send.className = 'btn gold';
  send.type = 'submit';
  send.append(icon('friend'), document.createTextNode(t('Añadir amigo')));
  form.append(input, send);
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
  root.append(introduction, overview, invitation, message, lists);
  container.append(root);
  let closed = false;
  let busy = false;
  let lastEntries = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  function status(text: string, error = false) {
    message.textContent = t(text);
    message.classList.toggle('error', error);
  }
  function setBusy(value: boolean) {
    busy = value;
    lists.setAttribute('aria-busy', String(value));
    for (const control of root.querySelectorAll<HTMLButtonElement>('button')) control.disabled = value;
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
    lists.replaceChildren();
    const friends = entries.filter((entry) => entry.status === 'friend');
    summary.textContent = `${t('Conectados')}: ${friends.filter((entry) => entry.online).length} · ${t('Amigos')}: ${friends.length}`;
    for (const [kind, label] of [['friend', 'Amigos'], ['incoming', 'Solicitudes recibidas'], ['outgoing', 'Solicitudes enviadas']] as const) {
      const section = document.createElement('section');
      section.dataset.social = kind;
      section.className = 'social-section';
      const heading = document.createElement('h3');
      const rows = entries.filter((entry) => entry.status === kind).sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username));
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
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = entry.username.slice(0, 1).toUpperCase();
        const info = document.createElement('div');
        info.className = 'social-info';
        const name = document.createElement('strong');
        name.textContent = `~${entry.username}`;
        info.append(name);
        if (kind === 'friend') {
          const presence = document.createElement('span');
          presence.className = entry.online ? 'social-online' : 'social-offline';
          presence.textContent = t(entry.online ? 'Conectado' : 'Desconectado');
          if (entry.online && entry.characterName) presence.textContent += ` · ${entry.characterName}${entry.location ? ` · ${t(entry.location === 'brumaluz' ? 'Brumaluz' : entry.location)}` : ''}`;
          info.append(presence);
        }
        const actions = document.createElement('div');
        actions.className = 'social-actions';
        if (kind === 'friend') {
          actions.append(button('Susurrar', 'whisper', () => whisper(entry.username)));
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
      lists.append(section);
    }
  }
  async function refresh() {
    try {
      const entries = await listFriends();
      if (closed) return;
      const signature = JSON.stringify(entries);
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
    if (!closed) timer = setTimeout(() => void poll(), 5000);
  }
  async function poll() {
    if (closed) return;
    setBusy(true);
    await refresh();
    setBusy(false);
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

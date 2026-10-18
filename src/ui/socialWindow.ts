import { listFriends, requestFriend, updateFriend, type FriendEntry } from '../services/account';
import { t } from './i18n';

export function renderSocial(container: HTMLElement, whisper: (username: string) => void) {
  container.replaceChildren();
  const root = document.createElement('div');
  root.className = 'social-window';
  const form = document.createElement('form');
  form.className = 'social-add';
  const input = document.createElement('input');
  input.type = 'text';
  input.required = true;
  input.maxLength = 20;
  input.pattern = '[A-Za-z0-9_]{3,20}';
  input.placeholder = t('Nombre de cuenta');
  input.setAttribute('aria-label', t('Nombre de cuenta'));
  input.autocomplete = 'off';
  const send = document.createElement('button');
  send.className = 'btn gold';
  send.type = 'submit';
  send.textContent = t('Añadir amigo');
  form.append(input, send);
  const message = document.createElement('p');
  message.className = 'account-message';
  message.setAttribute('role', 'status');
  const lists = document.createElement('div');
  lists.className = 'social-lists';
  root.append(form, message, lists);
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
    for (const control of root.querySelectorAll<HTMLButtonElement>('button')) control.disabled = value;
  }
  function button(text: string, action: () => void) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn ghost';
    el.textContent = t(text);
    el.onclick = action;
    return el;
  }
  function display(entries: FriendEntry[]) {
    lists.replaceChildren();
    for (const [kind, label] of [['friend', 'Amigos'], ['incoming', 'Solicitudes recibidas'], ['outgoing', 'Solicitudes enviadas']] as const) {
      const section = document.createElement('section');
      section.dataset.social = kind;
      const heading = document.createElement('h3');
      const rows = entries.filter((entry) => entry.status === kind);
      heading.textContent = `${t(label)} (${rows.length})`;
      section.append(heading);
      if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'social-empty';
        empty.textContent = t('No hay entradas en esta lista.');
        section.append(empty);
      }
      for (const entry of rows) {
        const row = document.createElement('article');
        row.className = 'social-row';
        row.dataset.userId = entry.userId;
        const info = document.createElement('div');
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
          actions.append(button('Susurrar', () => whisper(entry.username)));
          actions.append(button('Eliminar amigo', () => {
            if (window.confirm(t('¿Eliminar a {name} de tus amigos?', { name: entry.username }))) void change(() => updateFriend(entry.userId, 'remove'));
          }));
        } else {
          if (kind === 'incoming') actions.append(button('Aceptar', () => void change(() => updateFriend(entry.userId, 'accept'))));
          actions.append(button(kind === 'incoming' ? 'Rechazar' : 'Cancelar solicitud', () => void change(() => updateFriend(entry.userId, 'remove'))));
        }
        row.append(info, actions);
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

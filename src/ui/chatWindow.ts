// Ventana de chat: canales con filtros (general, susurros, sistema, NPC), ventana redimensionable y comandos.
// Solo es interfaz: los mensajes de jugadores los valida y reparte el servidor (chat_send, supabase/server.sql).
import { t } from './i18n';
import type { ChatMessage } from '../services/account';
import { isTitleId, isReservedTitle, PHOENIX_ICON } from '../data/titles';

export type ChatKind = 'general' | 'zone' | 'party' | 'whisper' | 'system' | 'npc' | 'combat';
/** Canales en los que se puede escribir. */
export type SendChannel = 'general' | 'zone' | 'party';
/** Prefijo que distingue un nombre de CUENTA (susurros) de un nombre de personaje. */
export const ACCOUNT_MARK = '~';

interface Entry {
  kind: ChatKind;
  time: Date;
  text: string;
  name?: string;
  title?: string;
  /** Cuenta del remitente (para susurrarle al hacer clic). */
  account?: string | null;
  /** Susurro: cuenta destinataria (si lo envías tú). */
  target?: string;
  own?: boolean;
  error?: boolean;
  /** Combate: `heal` (curación) o `dealt` (daño que haces tú); sin marca, daño recibido. */
  tone?: 'heal' | 'dealt';
}

export interface ChatHooks {
  /** Envía al servidor; el mensaje vuelve por `chatReceive`. Lanza un Error con el motivo si se rechaza. */
  send: (body: string, channel: SendChannel | 'whisper', to?: string) => Promise<void>;
  /** Mapa actual del personaje: solo se muestra el chat de zona de ese mapa. */
  zone: () => string;
  /** Se llama al enfocar el campo de texto (para soltar teclas de movimiento). */
  onFocus: () => void;
}

const MAX_ENTRIES = 300;
const MIN_SIZE = { w: 250, h: 130 };
const store = {
  get<T>(key: string, fallback: T): T {
    try { return JSON.parse(localStorage.getItem(`brumaluz-chat-${key}`) ?? '') as T; } catch { return fallback; }
  },
  set(key: string, value: unknown) { localStorage.setItem(`brumaluz-chat-${key}`, JSON.stringify(value)); },
};

let hooks: ChatHooks | null = null;
let selfUserId: string | null = null;
let lastWhisperFrom: string | null = null;
let unread = 0;
const entries: Entry[] = [];
const seen = new Set<number>();
const filters: Record<ChatKind, boolean> = { general: true, zone: true, party:true, whisper: true, system: true, npc: true, combat: true, ...store.get('filters', {}) };
const ignored = new Set<string>(store.get<string[]>('ignored', []));
const savedChannel = store.get<unknown>('channel', 'general');
let sendChannel: SendChannel = savedChannel === 'zone' || savedChannel === 'party' ? savedChannel : 'general';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(`#chat ${sel}`)!;
const root = () => document.getElementById('chat')!;
const stripMark = (s: string) => (s.startsWith(ACCOUNT_MARK) ? s.slice(1) : s);

export function isChatIgnored(account: string) {
  return ignored.has(stripMark(account).toLowerCase());
}
export function setChatIgnored(account: string, muted: boolean) {
  const who = stripMark(account).trim().toLowerCase();
  if (muted) ignored.add(who);
  else ignored.delete(who);
  store.set('ignored', [...ignored]);
  chatSystem(t(muted ? 'Ignoras a {name}.' : 'Ya no ignoras a {name}.', { name: account }));
}

/** Nombre clicable. `account`: cuenta a la que susurrar al hacer clic (sin ella, no es clicable). */
function nameElement(name: string, title?: string, account?: string | null) {
  const span = document.createElement('span');
  span.className = 'chat-name';
  const staff = !!title && isTitleId(title) && isReservedTitle(title);
  if (staff) { span.classList.add('staff-title'); span.insertAdjacentHTML('beforeend', PHOENIX_ICON); }
  span.append(name);
  if (account) {
    span.title = `${t('Susurrar')}|${t('Clic para susurrar a su cuenta.')}`;
    span.onclick = () => { setInput(`/w ${ACCOUNT_MARK}${account} `); };
  } else span.classList.add('static');
  return span;
}

function accountElement(account: string) {
  const span = document.createElement('span');
  span.className = 'chat-name chat-account';
  span.textContent = ACCOUNT_MARK + account;
  span.title = `${t('Cuenta')}|${t('Los susurros van a la cuenta, no al personaje.')}`;
  span.onclick = () => setInput(`/w ${ACCOUNT_MARK}${account} `);
  return span;
}

/** Cuenta activa (para marcar tus propios mensajes). */
export function setChatSelf(userId: string | null) { selfUserId = userId; }

function lineElement(e: Entry) {
  const line = document.createElement('div');
  line.className = `chat-line k-${e.kind}${e.own ? ' own' : ''}${e.error ? ' error' : ''}${e.tone ? ` ${e.tone}` : ''}`;
  const time = document.createElement('time');
  time.className = 'chat-time';
  time.textContent = e.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  line.append(time);
  const text = document.createElement('span');
  text.className = 'chat-text';
  text.textContent = e.text;
  if (e.kind === 'general' || e.kind === 'zone' || e.kind==='party') {
    if (e.kind === 'zone' || e.kind==='party') {
      const tag = document.createElement('span');
      tag.className = 'chat-tag';
      tag.textContent = `[${t(e.kind==='party'?'Grupo':'Zona')}]`;
      line.append(tag, ' ');
    }
    line.append(nameElement(e.name ?? '?', e.title, e.own ? null : e.account), ': ', text);
  } else if (e.kind === 'whisper') {
    if (e.target) line.append(`${t('Susurras a')} `, accountElement(e.target), ': ', text);
    else line.append(e.account ? accountElement(e.account) : nameElement(e.name ?? '?', e.title), ` ${t('te susurra')}: `, text);
  } else if (e.kind === 'npc') {
    const who = document.createElement('b');
    who.className = 'chat-npc-name';
    who.textContent = e.name ?? '';
    if (e.own) line.append(who, ': ', text);
    else line.append(who, ` ${t('dice')}: `, text);
  } else {
    line.append(text);
  }
  return line;
}

const visible = (e: Entry) => filters[e.kind];

function atBottom(log: HTMLElement) { return log.scrollHeight - log.scrollTop - log.clientHeight < 28; }

function rebuild() {
  const log = $<HTMLElement>('.chat-log');
  log.replaceChildren(...entries.filter(visible).map(lineElement));
  log.scrollTop = log.scrollHeight;
}

function push(e: Entry) {
  wake();
  entries.push(e);
  if (entries.length > MAX_ENTRIES) entries.shift();
  if (!visible(e)) return;
  const log = $<HTMLElement>('.chat-log');
  const stick = atBottom(log);
  log.append(lineElement(e));
  while (log.childElementCount > MAX_ENTRIES) log.firstElementChild!.remove();
  if (stick) log.scrollTop = log.scrollHeight;
  if (root().classList.contains('collapsed') && e.kind !== 'system') {
    unread++;
    const badge = $<HTMLElement>('.chat-collapse');
    badge.dataset.unread = unread > 99 ? '99+' : String(unread);
  }
}

/** Mensaje de un jugador recibido del servidor (se ignoran duplicados y jugadores silenciados por ti). */
let speechListener: ((name: string, text: string, own: boolean, userId: string) => void) | null = null;
/** Se avisa de cada mensaje público NUEVO (general o de tu zona) para mostrarlo como bocadillo sobre el personaje. */
export function setChatSpeechListener(fn: (name: string, text: string, own: boolean, userId: string) => void) { speechListener = fn; }
const FRESH_MS = 15_000;

export function chatReceive(m: ChatMessage) {
  if (seen.has(m.id)) return;
  seen.add(m.id);
  const own = m.senderUser === selfUserId;
  if (!own && ignored.has((m.senderAccount ?? m.senderName).toLowerCase())) return;
  const base = { time: new Date(m.createdAt), text: m.body, own };
  if (m.channel === 'whisper') {
    if (own) push({ ...base, kind: 'whisper', target: m.recipientName ?? '?' });
    else { lastWhisperFrom = m.senderAccount ?? m.senderName; push({ ...base, kind: 'whisper', name: m.senderName, account: m.senderAccount, title: m.senderTitle }); }
  } else if(m.channel==='party') {
    push({...base,kind:'party',name:m.senderName,account:m.senderAccount,title:m.senderTitle});
  } else if (m.channel === 'zone') {
    if (m.zone !== hooks?.zone()) return;
    push({ ...base, kind: 'zone', name: m.senderName, account: m.senderAccount, title: m.senderTitle });
    if (Date.now() - base.time.getTime() < FRESH_MS) speechListener?.(m.senderName, m.body, own, m.senderUser);
  } else {
    push({ ...base, kind: 'general', name: m.senderName, account: m.senderAccount, title: m.senderTitle });
    if (Date.now() - base.time.getTime() < FRESH_MS) speechListener?.(m.senderName, m.body, own, m.senderUser);
  }
}

/** Línea del filtro Combate (daño recibido, curación...). */
export function chatCombat(text: string, tone?: 'heal' | 'dealt') { push({ kind: 'combat', time: new Date(), text, tone }); }
export function chatSystem(text: string, error = false) { push({ kind: 'system', time: new Date(), text, error }); }
/** Lo que dice un NPC (diálogo o comentario cercano). */
export function chatNpc(speaker: string, text: string) { push({ kind: 'npc', time: new Date(), name: speaker, text }); }
/** Lo que respondes tú en una conversación con un NPC. */
export function chatSelfSay(name: string, text: string) { push({ kind: 'npc', time: new Date(), name, text, own: true }); }

let chatGeneration = 0;
export function clearChat() {
  chatGeneration++;
  entries.length = 0;
  seen.clear();
  lastWhisperFrom = null;
  unread = 0;
  delete $<HTMLElement>('.chat-collapse').dataset.unread;
  $<HTMLInputElement>('.chat-input').value = '';
  rebuild();
}

function setInput(value: string) {
  const input = $<HTMLInputElement>('.chat-input');
  input.value = value;
  input.focus();
  input.setSelectionRange(value.length, value.length);
}

export function focusChat(prefill?: string) {
  if (root().classList.contains('collapsed')) setCollapsed(false);
  if (prefill !== undefined) setInput(prefill); else $<HTMLInputElement>('.chat-input').focus();
}
export const isChatFocused = () => document.activeElement === $<HTMLInputElement>('.chat-input');

function setCollapsed(collapsed: boolean) {
  root().classList.toggle('collapsed', collapsed);
  root().classList.remove('hover-revealed', 'peek-expanded');
  if (collapsed) $<HTMLInputElement>('.chat-input').blur();
  wake();
  const button = $<HTMLButtonElement>('.chat-collapse');
  button.setAttribute('aria-expanded', String(!collapsed));
  const label = t(collapsed ? 'Abrir chat' : 'Minimizar chat');
  button.title = label;
  button.setAttribute('aria-label', label);
  if (!collapsed) { unread = 0; delete button.dataset.unread; $<HTMLElement>('.chat-log').scrollTop = 1e9; }
  store.set('collapsed', collapsed);
}

function help() {
  chatSystem(t('Comandos: /g (general), /z (zona) y /p (grupo) cambian de canal o envían un mensaje suelto; /w ~cuenta mensaje (susurrar a una cuenta), /r (responder), /ignore ~cuenta, /unignore ~cuenta, /clear.'));
}

const channelLabel = (c: SendChannel) => t(c === 'party' ? 'Grupo' : c === 'zone' ? 'Zona' : 'General');

function setSendChannel(channel: SendChannel) {
  sendChannel = channel;
  store.set('channel', channel);
  const button = $<HTMLButtonElement>('.chat-channel');
  button.textContent = channelLabel(channel);
  button.dataset.channel = channel;
}

async function submit(raw: string) {
  const text = raw.trim();
  if (!text) return;
  const command = /^\/(\S+)\s*(.*)$/s.exec(text);
  const generation = chatGeneration;
  try {
    if (!command) { await hooks!.send(text, sendChannel); return; }
    const [, name, rest] = command;
    switch (name.toLowerCase()) {
      case 'w': case 't': case 'susurrar': case 'whisper': {
        const match = /^(\S+)\s+(.+)$/s.exec(rest);
        if (!match) { chatSystem(t('Uso: /w ~cuenta mensaje'), true); return; }
        await hooks!.send(match[2], 'whisper', stripMark(match[1]));
        return;
      }
      case 'r': case 'responder': case 'reply':
        if (!lastWhisperFrom) { chatSystem(t('Nadie te ha susurrado todavía.'), true); return; }
        if (!rest.trim()) { setInput(`/w ${ACCOUNT_MARK}${lastWhisperFrom} `); return; }
        await hooks!.send(rest, 'whisper', lastWhisperFrom);
        return;
      case 'p': case 'grupo': case 'party': case 'g': case 'general': case 'z': case 'zona': case 'zone': {
        const channel: SendChannel = ['p','grupo','party'].includes(name.toLowerCase())?'party':['z', 'zona', 'zone'].includes(name.toLowerCase()) ? 'zone' : 'general';
        if (rest.trim()) await hooks!.send(rest, channel);
        else { setSendChannel(channel); chatSystem(t('Escribes en el canal: {name}.', { name: channelLabel(channel) })); }
        return;
      }
      case 'ignore': case 'ignorar': {
        const who = stripMark(rest.trim()).toLowerCase();
        if (!who) { chatSystem(ignored.size ? `${t('Ignorados')}: ${[...ignored].join(', ')}` : t('No ignoras a nadie.')); return; }
        setChatIgnored(who, true);
        return;
      }
      case 'unignore': case 'designorar': {
        const who = stripMark(rest.trim()).toLowerCase();
        if (ignored.has(who)) setChatIgnored(who, false);
        else chatSystem(t('No estabas ignorando a {name}.', { name: rest.trim() }), true);
        return;
      }
      case 'clear': case 'limpiar': clearChat(); return;
      case 'help': case 'ayuda': case '?': help(); return;
      default: chatSystem(t('Comando desconocido: /{name}. Escribe /ayuda.', { name }), true);
    }
  } catch (error) {
    if (generation === chatGeneration) chatSystem(error instanceof Error ? error.message : String(error), true);
  }
}
function initResize() {
  const el = root();
  const saved = store.get<{ w: number; h: number } | null>('size', null);
  const apply = (w: number, h: number) => {
    w = Math.min(Math.max(w, MIN_SIZE.w), Math.round(innerWidth * 0.7));
    h = Math.min(Math.max(h, MIN_SIZE.h), Math.round(innerHeight * 0.7));
    el.style.setProperty('--chat-w', `${w}px`);
    el.style.setProperty('--chat-h', `${h}px`);
    return { w, h };
  };
  let size = saved ? apply(saved.w, saved.h) : apply(300, 210);
  const handle = $<HTMLElement>('.chat-resize');
  let start: { x: number; y: number; w: number; h: number } | null = null;
  handle.onpointerdown = (e) => {
    start = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  handle.onpointermove = (e) => {
    if (!start) return;
    size = apply(start.w + (start.x - e.clientX), start.h + (start.y - e.clientY));
  };
  handle.onpointerup = handle.onpointercancel = () => { if (start) { start = null; store.set('size', size); } };
  window.addEventListener('resize', () => { size = apply(size.w, size.h); });
}

export function initChat(h: ChatHooks) {
  hooks = h;
  const input = $<HTMLInputElement>('.chat-input');
  const form = $<HTMLFormElement>('.chat-form');

  for (const button of document.querySelectorAll<HTMLButtonElement>('#chat .chat-filter')) {
    const kind = button.dataset.kind as ChatKind;
    button.setAttribute('aria-pressed', String(filters[kind]));
    button.onclick = () => {
      filters[kind] = !filters[kind];
      if(kind==='party' && filters[kind])setSendChannel('party');
      button.setAttribute('aria-pressed', String(filters[kind]));
      store.set('filters', filters);
      rebuild();
    };
  }
  $<HTMLButtonElement>('.chat-collapse').onclick = () => setCollapsed(!root().classList.contains('collapsed'));
  if (store.get('collapsed', false)) setCollapsed(true);
  initResize();
  setSendChannel(sendChannel);
  $<HTMLButtonElement>('.chat-channel').onclick = () => { setSendChannel(sendChannel === 'general' ? 'zone' : sendChannel==='zone'?'party':'general'); input.focus(); };

  form.onsubmit = (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    input.blur();
    void submit(value);
  };
  // El juego no debe reaccionar a las teclas que se escriben aquí.
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Escape') { input.value = ''; input.blur(); }
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.addEventListener('focus', () => hooks?.onFocus());
  document.addEventListener('brumaluz-language-change', () => { setSendChannel(sendChannel); rebuild(); });
  // Sin mensajes nuevos ni uso, el chat se apaga poco a poco hasta ocultarse; cualquier mensaje o interacción lo devuelve.
  const chat = root();
  const minimizedLabel = document.createElement('span');
  minimizedLabel.className = 'chat-minimized-label';
  minimizedLabel.textContent = 'Chat';
  chat.querySelector('.chat-head')!.prepend(minimizedLabel);
  const peek = document.createElement('button');
  peek.type = 'button';
  peek.className = 'chat-peek';
  peek.setAttribute('aria-controls', 'chat');
  peek.setAttribute('aria-label', t('Mostrar chat temporalmente'));
  peek.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4zM8 8h8m-8 4h5"/></svg><span>Chat</span><span aria-hidden="true">↑</span>';
  document.body.append(peek);
  peek.addEventListener('pointerenter', () => {
    chat.classList.add('hover-revealed', 'peek-expanded');
    wake();
  });
  peek.onclick = () => focusChat();
  window.addEventListener('pointermove', (event) => {
    if (!document.body.classList.contains('playing') || document.body.classList.contains('dead')) return;
    const bounds = chat.getBoundingClientRect();
    const hovered = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    const handleBounds = peek.getBoundingClientRect();
    const onHandle = event.clientX >= handleBounds.left && event.clientX <= handleBounds.right && event.clientY >= handleBounds.top && event.clientY <= handleBounds.bottom;
    if (chat.classList.contains('hover-revealed') && !hovered && !onHandle) {
      chat.classList.remove('hover-revealed');
      if (!chat.matches(':focus-within')) chat.classList.remove('peek-expanded');
    }
    if (hovered && chat.classList.contains('hover-revealed')) wake();
  }, { passive: true });
  chat.addEventListener('focusout', () => {
    queueMicrotask(() => {
      if (!chat.matches(':focus-within') && !chat.classList.contains('hover-revealed')) chat.classList.remove('peek-expanded');
    });
  });
  for (const type of ['pointerenter', 'pointerdown', 'focusin', 'wheel']) chat.addEventListener(type, wake, { passive: true });
  window.setInterval(() => {
    if (performance.now() - lastActivity > FADE_AFTER_MS && !chat.classList.contains('collapsed') && !chat.matches(':hover, :focus-within')) chat.classList.add('faded');
  }, 500);
}

const FADE_AFTER_MS = 12_000;
let lastActivity = performance.now();
function wake() {
  lastActivity = performance.now();
  document.getElementById('chat')?.classList.remove('faded');
}

import type { FriendEntry } from '../services/account';
import { observeFriends, readFriends } from '../services/friends';
import { chatSystem } from './chatWindow';
import { t } from './i18n';
import { toast } from './toast';

export function startFriendNotifications() {
  let closed = false;
  let previous = new Map<string, FriendEntry['status']>();
  let failed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const toggle = document.getElementById('player-menu-toggle')!;
  const social = document.querySelector<HTMLButtonElement>('[data-window="social"]')!;
  const badge = document.createElement('span');
  badge.className = 'friend-request-badge';
  badge.hidden = true;
  badge.textContent = '!';
  toggle.append(badge);
  function notify(text: string, name: string) {
    // One queue respects conversations, cinematics and reading time for every notice.
    toast('Amistades', text, false, { name });
  }
  const unsubscribe = observeFriends((entries) => {
    if (closed) return;
    const incoming = entries.filter((entry) => entry.status === 'incoming').length;
    badge.hidden = incoming === 0;
    badge.setAttribute('aria-label', t('{n} solicitudes de amistad pendientes', { n: incoming }));
    social.classList.toggle('has-friend-requests', incoming > 0);
    social.setAttribute('aria-label', incoming ? t('Social: {n} solicitudes pendientes', { n: incoming }) : t('Social'));
    for (const entry of entries) {
      const before = previous.get(entry.userId);
      if (entry.status === 'incoming' && before !== 'incoming') notify('{name} te ha enviado una solicitud de amistad.', `~${entry.username}`);
      if (entry.status === 'friend' && before === 'outgoing') notify('{name} ha aceptado tu solicitud de amistad.', `~${entry.username}`);
    }
    previous = new Map(entries.map((entry) => [entry.userId, entry.status]));
  });
  async function poll() {
    try {
      await readFriends();
      failed = false;
    } catch (error) {
      if (!closed && !failed) chatSystem(t('No se pudieron actualizar los avisos de amistad: {error}', { error: error instanceof Error ? error.message : String(error) }), true);
      failed = true;
    } finally {
      if (!closed) timer = setTimeout(() => void poll(), 5000);
    }
  }
  void poll();
  return () => {
    closed = true;
    unsubscribe();
    clearTimeout(timer);
    badge.remove();
    social.classList.remove('has-friend-requests');
    social.setAttribute('aria-label', t('Social'));
  };
}

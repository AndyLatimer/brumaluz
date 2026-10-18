import { listFriends, type FriendEntry } from './account';

let generation = 0;
let pending: Promise<FriendEntry[]> | null = null;
const listeners = new Set<(entries: FriendEntry[]) => void>();

export function observeFriends(listener: (entries: FriendEntry[]) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    generation++;
    pending = null;
  };
}

export function readFriends(): Promise<FriendEntry[]> {
  if (pending) return pending;
  const version = generation;
  const request = listFriends().then((entries) => {
    if (version === generation) for (const listener of listeners) listener(entries);
    return entries;
  }).finally(() => { if (pending === request) pending = null; });
  pending = request;
  return request;
}

import { validateMap, type MapDocument, type MapSummary } from '../../data/maps';

// Acceso a la API local de mapas (/__dev/maps) y a IndexedDB (borradores y miniaturas).

export class MapApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function call(path: string, init: RequestInit = {}) {
  const response = await fetch(`/__dev/maps${path}`, { cache: 'no-store', ...init });
  let body: unknown = null;
  try { body = await response.json(); } catch { /* respuesta sin JSON */ }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : `Error HTTP ${response.status}.`;
    throw new MapApiError(message, response.status);
  }
  return { body, revision: response.headers.get('ETag') };
}

export type MapListEntry = MapSummary | { id: string; name?: string; error: string; revision?: string };

export async function listMaps(): Promise<MapListEntry[]> {
  const { body } = await call('');
  return (body as { maps: MapListEntry[] }).maps;
}

export async function loadMap(id: string) {
  const { body, revision } = await call(`/${encodeURIComponent(id)}`);
  if (!revision) throw new MapApiError('El servidor no devolvió la revisión del mapa.', 500);
  return { map: validateMap(body), revision };
}

/** Guarda el mapa. `revision` null = crear (falla si ya existe). */
export async function saveMap(map: MapDocument, revision: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (revision) headers['If-Match'] = revision; else headers['If-None-Match'] = '*';
  const { body, revision: next } = await call(`/${encodeURIComponent(map.id)}`, { method: 'PUT', headers, body: JSON.stringify(map) });
  if (!next) throw new MapApiError('El servidor no devolvió la revisión del mapa.', 500);
  return { summary: body as MapSummary, revision: next };
}

export async function deleteMap(id: string, revision: string) {
  await call(`/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'If-Match': revision } });
}

/** Mapa que el juego usa como ciudad de Brumaluz (`src/data/world/`). */
export interface PublishedInfo { id: string; name: string; kind: string; publishedAt: string; objects: number; assets: number; bytes: number; warnings?: string[] }
export async function getPublished() {
  return ((await call('/__published')).body as { published: PublishedInfo[] }).published;
}
export async function publishMap(id: string, revision: string | null) {
  const { body } = await call('/__published', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, revision }) });
  return (body as { published: PublishedInfo }).published;
}
export async function unpublishMap(id?: string) {
  await call(`/__published${id ? `/${encodeURIComponent(id)}` : ''}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

let database: Promise<IDBDatabase> | undefined;
function db() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('brumaluz-map-editor', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts');
      request.result.createObjectStore('thumbs');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}
async function tx<T>(store: 'drafts' | 'thumbs', mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const handle = await db();
  return new Promise<T>((resolve, reject) => {
    const request = run(handle.transaction(store, mode).objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface Draft { map: MapDocument; revision: string | null; savedId: string | null; at: number }
export const saveDraft = (draft: Draft) => tx('drafts', 'readwrite', store => store.put(draft, 'current')).catch(() => undefined);
export const loadDraft = () => tx<Draft | undefined>('drafts', 'readonly', store => store.get('current')).catch(() => undefined);
export const clearDraft = () => tx('drafts', 'readwrite', store => store.delete('current')).catch(() => undefined);
export const getThumb = (key: string) => tx<Blob | undefined>('thumbs', 'readonly', store => store.get(key)).catch(() => undefined);
export const putThumb = (key: string, blob: Blob) => tx('thumbs', 'readwrite', store => store.put(blob, key)).catch(() => undefined);

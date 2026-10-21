import type { CharData } from '../data/data';

export type QuestId = 'welcome' | 'shadow';
export interface QuestTracking {
  isTracked(id: QuestId): boolean;
  toggle(id: QuestId): void;
  current(data: CharData): QuestId | null;
}

export function currentQuest(data: CharData): QuestId | null {
  if (data.welcome && data.welcome.stage !== 'completed') return 'welcome';
  if (data.shadowQuest !== 'returned' && (data.shadowQuest || data.welcome?.stage === 'completed')) return 'shadow';
  return null;
}

export function createQuestTracking(storageKey: () => string): QuestTracking {
  let loadedKey = '';
  let preferences: Partial<Record<QuestId, boolean>> = {};
  function load() {
    const key = storageKey();
    if (key === loadedKey) return;
    loadedKey = key;
    preferences = {};
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      const saved: unknown = JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid quest tracking preferences.');
      for (const id of ['welcome', 'shadow'] as const) {
        if (id in saved) {
          const value = Reflect.get(saved, id);
          if (typeof value !== 'boolean') throw new Error('Invalid quest tracking preference.');
          preferences[id] = value;
        }
      }
    } catch (error) {
      console.warn('No se pudo cargar el seguimiento local de misiones.', error);
    }
  }
  const tracking: QuestTracking = {
    isTracked(id) { load(); return preferences[id] !== false; },
    toggle(id) {
      load();
      preferences[id] = !tracking.isTracked(id);
      try { localStorage.setItem(loadedKey, JSON.stringify(preferences)); }
      catch (error) { console.warn('No se pudo guardar el seguimiento local de misiones.', error); }
    },
    current(data) {
      const id = currentQuest(data);
      return id && tracking.isTracked(id) ? id : null;
    },
  };
  return tracking;
}

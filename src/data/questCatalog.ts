/** Serializable authoring format. Executable callbacks never enter the catalog. */
export type QuestAction = 'none' | 'accept' | 'complete';
export type QuestPhase = 'offer' | 'active' | 'ready' | 'completed';
export interface QuestChoice { text: string; next: string; action: QuestAction }
export interface QuestNode { id: string; speaker: string; text: string; choices: QuestChoice[] }
export interface QuestObjective {
  id: string; type: 'fetch' | 'kill' | 'talk'; target: string; count: number;
  description: string; map: string; consume: boolean;
}
export interface QuestDefinition {
  id: string; title: string; summary: string; notes: string;
  giver: string; receiver: string; minLevel: number; prerequisites: string[];
  objectives: QuestObjective[];
  rewards: { experience: number; pelines: number; items: { item: string; count: number }[] };
  dialogue: { entries: Record<QuestPhase, string>; nodes: QuestNode[] };
}
export interface QuestCatalog { version: 1; quests: QuestDefinition[] }
export interface QuestReferences { npcs: { id: string; name: string }[]; items: { id: string; name: string }[]; enemies: { id: string; name: string }[]; maps: { id: string; name: string }[] }
const ID = /^[a-z][a-z0-9_-]{0,63}$/;
const phases: QuestPhase[] = ['offer', 'active', 'ready', 'completed'];
function fail(message: string): never { throw new Error(message); }
function obj(value: unknown, keys: string[], where: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${where}: se esperaba un objeto.`);
  const record = value as Record<string, any>;
  if (Object.keys(record).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(record, key))) fail(`${where}: campos desconocidos o incompletos.`);
  return record;
}
function str(value: unknown, where: string, max = 4000, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail(`${where}: texto vacío o demasiado largo.`);
  return value;
}
function id(value: unknown, where: string): string { const text = str(value, where, 64); if (!ID.test(text)) fail(`${where}: ID no válido.`); return text; }
function num(value: unknown, where: string, min = 0, max = 1_000_000): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(`${where}: cantidad entera entre ${min} y ${max}.`);
  return value as number;
}
function array(value: unknown, where: string, max: number): any[] { if (!Array.isArray(value) || value.length > max) fail(`${where}: lista demasiado larga o no válida.`); return value; }
function unique(ids: string[], where: string) { if (new Set(ids).size !== ids.length) fail(`${where}: IDs repetidos.`); }

export function validateQuest(value: unknown): QuestDefinition {
  const q = obj(value, ['id','title','summary','notes','giver','receiver','minLevel','prerequisites','objectives','rewards','dialogue'], 'Misión');
  id(q.id, 'Misión'); str(q.title, 'Título', 120); str(q.summary, 'Descripción'); str(q.notes, 'Notas', 8000, true);
  id(q.giver, 'NPC inicial'); id(q.receiver, 'NPC de entrega'); num(q.minLevel, 'Nivel mínimo', 1, 10000);
  array(q.prerequisites, 'Requisitos', 50).forEach(v => id(v, 'Misión previa')); unique(q.prerequisites, 'Requisitos');
  const objectives = array(q.objectives, 'Objetivos', 20);
  if (!objectives.length) fail('Añade al menos un objetivo.');
  for (const value of objectives) {
    const o = obj(value, ['id','type','target','count','description','map','consume'], 'Objetivo');
    id(o.id, 'Objetivo'); id(o.target, 'Destino del objetivo'); str(o.description, 'Descripción del objetivo', 500);
    if (!['fetch','kill','talk'].includes(o.type)) fail('Tipo de objetivo no válido.');
    num(o.count, 'Cantidad del objetivo', 1, 9999); if (o.map !== '') id(o.map, 'Mapa');
    if (o.type === 'fetch' && o.map !== '') fail('Los objetos se comprueban en la mochila; no tienen filtro de mapa.');
    if (typeof o.consume !== 'boolean' || (o.type !== 'fetch' && o.consume)) fail('Solo los objetivos de objetos pueden consumir materiales.');
    if (o.type === 'talk' && o.count !== 1) fail('Hablar requiere una única conversación.');
  }
  unique(objectives.map(o => o.id), 'Objetivos');
  // Two fetch rows for one item would make turn-in consumption ambiguous.
  unique(objectives.filter(o => o.type === 'fetch').map(o => o.target), 'Objetivos de objetos');
  const r = obj(q.rewards, ['experience','pelines','items'], 'Recompensas');
  num(r.experience, 'Experiencia'); num(r.pelines, 'Pelines');
  for (const v of array(r.items, 'Objetos de recompensa', 20)) { const item = obj(v, ['item','count'], 'Recompensa'); id(item.item, 'Objeto'); num(item.count, 'Cantidad', 1, 9999); }
  unique(r.items.map((v: {item: string}) => v.item), 'Recompensas');
  const d = obj(q.dialogue, ['entries','nodes'], 'Diálogo'); obj(d.entries, phases, 'Entradas del diálogo');
  const nodes = array(d.nodes, 'Nodos', 100); if (!nodes.length) fail('El diálogo necesita nodos.');
  for (const v of nodes) {
    const n = obj(v, ['id','speaker','text','choices'], 'Nodo'); id(n.id, 'Nodo');
    if (n.speaker !== '') id(n.speaker, 'Interlocutor'); str(n.text, `Texto de ${n.id}`);
    for (const v of array(n.choices, 'Respuestas', 8)) {
      const c = obj(v, ['text','next','action'], 'Respuesta'); str(c.text, 'Respuesta', 300);
      if (!['none','accept','complete'].includes(c.action)) fail('Acción de diálogo no válida.');
      if (c.next !== '') id(c.next, 'Destino del diálogo');
    }
  }
  unique(nodes.map(n => n.id), 'Nodos');
  const nodeIds = new Set(nodes.map(n => n.id));
  for (const phase of phases) if (!nodeIds.has(d.entries[phase])) fail(`La entrada ${phase} apunta a un nodo inexistente.`);
  for (const n of nodes) for (const c of n.choices) if (c.next && !nodeIds.has(c.next)) fail(`${n.id}: respuesta con destino inexistente.`);
  // Validate that each lifecycle entry exposes the corresponding action somewhere reachable.
  for (const [phase, action] of [['offer','accept'],['ready','complete']] as const) {
    const visited = new Set<string>(); const queue = [d.entries[phase]]; let found = false;
    while (queue.length) {
      const next = queue.pop()!; if (visited.has(next)) continue; visited.add(next);
      const n = nodes.find(n => n.id === next)!;
      for (const c of n.choices) { if (c.action === action) found = true; if (c.next && c.action === 'none') queue.push(c.next); }
    }
    if (!found) fail(`El diálogo de ${phase} necesita una respuesta para ${action === 'accept' ? 'aceptar' : 'completar'} la misión.`);
  }
  return JSON.parse(JSON.stringify(q)) as QuestDefinition;
}

export function validateQuestCatalog(value: unknown, refs?: QuestReferences): QuestCatalog {
  const raw = obj(value, ['version','quests'], 'Biblioteca'); if (raw.version !== 1) fail('Versión de biblioteca no compatible.');
  const quests = array(raw.quests, 'Misiones', 1000).map(validateQuest);
  unique(quests.map(q => q.id), 'Misiones');
  const byId = new Map(quests.map(q => [q.id,q]));
  const visited = new Set<string>(); const visiting = new Set<string>();
  const visit = (q: QuestDefinition) => {
    if (visiting.has(q.id)) fail(`Requisitos circulares en ${q.id}.`); if (visited.has(q.id)) return;
    visiting.add(q.id);
    for (const previous of q.prerequisites) { const p = byId.get(previous); if (!p) fail(`${q.id}: misión previa inexistente (${previous}).`); visit(p); }
    visiting.delete(q.id); visited.add(q.id);
  };
  quests.forEach(visit);
  if (refs) {
    const check = (kind: keyof QuestReferences, target: string) => { if (!refs[kind].some(r => r.id === target)) fail(`Referencia inexistente en ${kind}: ${target}.`); };
    for (const q of quests) {
      check('npcs', q.giver); check('npcs', q.receiver);
      for (const o of q.objectives) { check(o.type === 'fetch' ? 'items' : o.type === 'kill' ? 'enemies' : 'npcs', o.target); if (o.map) check('maps', o.map); }
      q.rewards.items.forEach(r => check('items', r.item)); q.dialogue.nodes.forEach(n => { if (n.speaker) check('npcs', n.speaker); });
    }
  }
  return { version: 1, quests };
}

export function newQuest(id = 'nueva_mision', giver = 'gnomi'): QuestDefinition {
  return {
    id, title: 'Nueva misión', summary: 'Describe el encargo y por qué necesita ayuda.', notes: '', giver, receiver: giver, minLevel: 1, prerequisites: [],
    objectives: [{ id: 'objetivo_1', type: 'talk', target: giver, count: 1, description: 'Habla con el contacto del encargo.', map: '', consume: false }],
    rewards: { experience: 0, pelines: 0, items: [] },
    dialogue: { entries: { offer: 'oferta', active: 'pendiente', ready: 'entrega', completed: 'despedida' }, nodes: [
      { id: 'oferta', speaker: '', text: '¿Puedes echarme una mano?', choices: [{ text: 'Claro, te ayudaré.', next: '', action: 'accept' }, { text: 'Ahora no.', next: '', action: 'none' }] },
      { id: 'pendiente', speaker: '', text: '¿Cómo va el encargo?', choices: [] },
      { id: 'entrega', speaker: '', text: '¡Ya está todo listo! Gracias por ayudarme.', choices: [{ text: 'Completar misión', next: '', action: 'complete' }] },
      { id: 'despedida', speaker: '', text: '¡Hasta pronto!', choices: [] },
    ] },
  };
}

/** Pure local rehearsal; it is deliberately not an authoritative character progression API. */
export interface QuestRehearsal { accepted: boolean; completed: boolean; inventory: Record<string, number>; progress: Record<string, number>; experience: number; pelines: number }
export const newRehearsal = (): QuestRehearsal => ({ accepted: false, completed: false, inventory: {}, progress: {}, experience: 0, pelines: 0 });
export function objectiveProgress(o: QuestObjective, state: QuestRehearsal) { return Math.min(o.count, o.type === 'fetch' ? state.inventory[o.target] ?? 0 : state.progress[o.id] ?? 0); }
export function questPhase(q: QuestDefinition, state: QuestRehearsal): QuestPhase {
  return state.completed ? 'completed' : !state.accepted ? 'offer' : q.objectives.every(o => objectiveProgress(o, state) >= o.count) ? 'ready' : 'active';
}
export function rehearseEvent(q: QuestDefinition, state: QuestRehearsal, type: QuestObjective['type'], target: string, map = '', amount = 1) {
  if (!Number.isSafeInteger(amount) || amount < 1 || !state.accepted || state.completed) return;
  if (type === 'fetch') { state.inventory[target] = (state.inventory[target] ?? 0) + amount; return; }
  for (const o of q.objectives) if (o.type === type && o.target === target && (!o.map || o.map === map)) state.progress[o.id] = Math.min(o.count, (state.progress[o.id] ?? 0) + amount);
}
export function rehearseAction(q: QuestDefinition, state: QuestRehearsal, action: QuestAction, context: { level: number; completed: string[] }) {
  if (action === 'none') return true;
  if (action === 'accept') {
    if (state.accepted || state.completed || context.level < q.minLevel || q.prerequisites.some(id => !context.completed.includes(id))) return false;
    state.accepted = true; return true;
  }
  if (questPhase(q, state) !== 'ready') return false;
  for (const o of q.objectives) if (o.type === 'fetch' && o.consume) state.inventory[o.target] -= o.count;
  state.completed = true; state.experience += q.rewards.experience; state.pelines += q.rewards.pelines;
  for (const r of q.rewards.items) state.inventory[r.item] = (state.inventory[r.item] ?? 0) + r.count;
  return true;
}

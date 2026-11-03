import type { QuestCatalog, QuestDefinition, QuestPhase } from '../data/questCatalog';

/** Coalesces typing without merging edits to different controls or structural operations. */
export class DraftHistory {
  private states: QuestDefinition[] = [];
  private index = -1;
  private key = '';
  private at = 0;
  reset(value: QuestDefinition) { this.states = [structuredClone(value)]; this.index = 0; this.key = ''; }
  record(value: QuestDefinition, key = '', now = Date.now()) {
    if (JSON.stringify(value) === JSON.stringify(this.states[this.index])) return;
    const coalesce = key && key === this.key && now-this.at < 900 && this.index > 0 && this.index === this.states.length-1;
    this.states = this.states.slice(0,this.index+1);
    if (coalesce) this.states[this.index] = structuredClone(value);
    else { this.states.push(structuredClone(value)); this.index++; }
    if (this.states.length > 60) { this.states.shift(); this.index--; }
    this.key = key; this.at = now;
  }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.states.length-1; }
  undo() { if (!this.canUndo) return null; this.key = ''; return structuredClone(this.states[--this.index]); }
  redo() { if (!this.canRedo) return null; this.key = ''; return structuredClone(this.states[++this.index]); }
}

export interface QuestWarning { text: string; step: number; node?: number }
export function questWarnings(q: QuestDefinition): QuestWarning[] {
  const warnings: QuestWarning[] = [];
  for (const phase of Object.keys(q.dialogue.entries) as QuestPhase[]) {
    const visited = new Set<string>(); const queue = [q.dialogue.entries[phase]];
    while (queue.length) {
      const id = queue.pop()!; if (visited.has(id)) continue; visited.add(id);
      const index = q.dialogue.nodes.findIndex(n => n.id === id); const node = q.dialogue.nodes[index]; if (!node) continue;
      for (const choice of node.choices) {
        if (choice.action === 'accept' && phase !== 'offer' || choice.action === 'complete' && phase !== 'ready')
          warnings.push({step:2,node:index,text:`Hay una respuesta para ${choice.action === 'accept' ? 'aceptar' : 'entregar'} accesible desde «${({offer:'oferta',active:'pendiente',ready:'entrega',completed:'completada'})[phase]}». La prueba la rechazará fuera de su fase.`});
        // An action changes the phase before reaching its continuation. Check it on the next conversation instead.
        if (choice.next && choice.action === 'none') queue.push(choice.next);
      }
    }
  }
  // Reachability includes continuations after actions, regardless of their phase.
  const queue = Object.values(q.dialogue.entries); const allReached = new Set<string>();
  while (queue.length) { const id = queue.pop()!; if (allReached.has(id)) continue; allReached.add(id); const node = q.dialogue.nodes.find(n => n.id === id); for (const choice of node?.choices ?? []) if (choice.next) queue.push(choice.next); }
  q.dialogue.nodes.forEach((n,index) => {
    if (!allReached.has(n.id)) warnings.push({step:2,node:index,text:`La conversación «${n.text.slice(0,55) || n.id}» no se alcanza desde ninguna fase. Conéctala o elimínala si sobra.`});
    if (/^Escribe aquí|^Escribe lo que|^Nueva respuesta/.test(n.text)) warnings.push({step:2,node:index,text:'Queda una conversación con texto de ejemplo. Personalízala antes de dar el guion por terminado.'});
  });
  if (!q.rewards.experience && !q.rewards.pelines && !q.rewards.items.length) warnings.push({step:3,text:'Este encargo no da recompensas. Es válido; comprueba que sea intencionado.'});
  return warnings.filter((w,index,all) => all.findIndex(v => v.text === w.text) === index);
}

/** Existing downstream quests must never be selected as prerequisites (would introduce a cycle). */
export function questDescendants(q: QuestDefinition, catalog: QuestCatalog): Set<string> {
  const result = new Set<string>(); const queue = [q.id];
  while (queue.length) {
    const id = queue.pop()!;
    for (const next of catalog.quests) if (next.prerequisites.includes(id) && !result.has(next.id)) { result.add(next.id); queue.push(next.id); }
  }
  result.delete(q.id); return result;
}

export function dialogueConnections(q: QuestDefinition) {
  return q.dialogue.nodes.map((node,index) => ({node,index,entries:(Object.keys(q.dialogue.entries) as QuestPhase[]).filter(p => q.dialogue.entries[p] === node.id),
    edges:node.choices.map(c => ({text:c.text,action:c.action,index:q.dialogue.nodes.findIndex(n => n.id === c.next),close:!c.next}))}));
}

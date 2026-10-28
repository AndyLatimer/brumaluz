import type { Conversation } from '../ui/dialog';
import type { QuestAction, QuestDefinition, QuestPhase } from '../data/questCatalog';

/** Builds the same dialogue tree for the editor and future server-backed quest interactions. */
export function questConversation(q: QuestDefinition, phase: QuestPhase, npcName: (id: string) => string,
  action: (action: QuestAction) => void | boolean | Promise<void | boolean>, itemName: (id: string) => string = id => id): Conversation {
  const npc = phase === 'offer' ? q.giver : q.receiver;
  const conversation: Conversation = { speaker:npcName(npc), start:q.dialogue.entries[phase], nodes:{} };
  for (const n of q.dialogue.nodes) conversation.nodes[n.id] = {
    text:n.text, speaker:n.speaker ? npcName(n.speaker) : undefined,
    quest: n.id === q.dialogue.entries.offer || n.id === q.dialogue.entries.ready ? {
      title:q.title,objective:q.objectives.map(o => o.description).join('\n'),
      experience:q.rewards.experience,pelines:q.rewards.pelines,turnIn:n.id === q.dialogue.entries.ready,
      items:q.rewards.items.map(r => ({ label:itemName(r.item), count:r.count })),
    } : undefined,
    choices:n.choices.length ? n.choices.map(c => ({text:c.text,next:c.next || undefined,action:() => action(c.action)})) : undefined,
  };
  return conversation;
}

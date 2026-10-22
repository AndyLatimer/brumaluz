// Objetivos: el marco del objetivo apuntado y los comentarios de los NPC cercanos.
import { play, story, ui, session, fight } from './state';
import { t } from '../ui/i18n';
import { chatNpc } from '../ui/chatWindow';
import { isDialogOpen } from '../ui/dialog';
import type { TargetDetails } from '../ui/targetFrame';
import { npcActors } from './cities';
import { isbertoVisible } from '../story/quests';
import { holder } from './stage';
import { npcSay } from './hud';
import { storyLock } from './conversation';
import { tradeWindow } from '../ui/gameInterface';
import { playerInteractions } from './interaction';
import { remotePlayers } from './worldClient';

// Los NPC comentan algo de vez en cuando si estás cerca (canal NPC del chat).
export const barkCooldown = new Map<string, number>();
export function updateTargetFrame() {
  const enabled = play.mode === 'play' && !play.dead && !storyLock() && !tradeWindow.isOpen && !isDialogOpen() && !ui.gameMenuOpen && !ui.playerMenuOpen && !ui.worldMenuOpen && !ui.openWindow && !ui.optionsOpen && !playerInteractions.isOpen;
  if (!enabled) { ui.targetFrame.update([], false, holder.position); return; }
  const targets: TargetDetails[] = remotePlayers.list().map((player) => ({
    ...player, identity: { kind: 'player', username: player.username, cls: player.cls, title: player.title },
  }));
  for (const npc of npcActors) {
    if (npc.id === 'isberto' && !isbertoVisible()) continue;
    const def = story.NPCS[npc.id];
    const data = session.registeredNpcs[npc.id];
    targets.push({ id: `npc:${npc.id}`, root: npc.character.root, name: def.name, level: def.level, height: data.appearance.height,
      scale: data.render.scale * data.render.height, widthScale: data.render.scale * data.render.width,
      vitals: def.vitals, identity: { kind: 'npc', type: def.type, title: def.title, badgeIcon: data.badgeIcon } });
  }
  if(fight.combatTargetRoot&&fight.combatEncounter?.status==='active')targets.push({
    id:'enemy:shadowling',root:fight.combatTargetRoot,name:'Sombra de Isberto',level:1,height:1.4,
    vitals:{health:fight.combatEncounter.health,maxHealth:fight.combatEncounter.maxHealth,overheal:0,resource:0,maxResource:1,resourceKind:'stamina'},
    identity:{kind:'npc',type:'hostile',title:'Espectro umbrío'},
  });
  if (story.welcomeWorld.root.visible) targets.push({
    id: 'npc:gnomi', root: story.welcomeWorld.root, name: session.registeredNpcs.gnomi.name, level: session.registeredNpcs.gnomi.stats.level, height: session.registeredNpcs.gnomi.appearance.height,
    scale: session.registeredNpcs.gnomi.render.scale * session.registeredNpcs.gnomi.render.height,
    widthScale: session.registeredNpcs.gnomi.render.scale * session.registeredNpcs.gnomi.render.width,
    vitals: { health: session.registeredNpcs.gnomi.stats.health, maxHealth: session.registeredNpcs.gnomi.stats.maxHealth, overheal: 0, resource: 80, maxResource: 80, resourceKind: 'stamina' },
    identity: { kind: 'npc', type: 'resident', title: session.registeredNpcs.gnomi.subtitle, badgeIcon: session.registeredNpcs.gnomi.badgeIcon },
  });
  ui.targetFrame.update(targets, true, holder.position, fight.lockedEnemy ? 'enemy:shadowling' : null);
}
/** De vez en cuando, un NPC cercano comenta algo. */
export function installNpcBarks() {
  window.setInterval(() => {
    if (play.mode !== 'play' || play.dead) return;
    const now = Date.now();
    for (const npc of npcActors) {
      if (npc.id === 'isberto' && !isbertoVisible()) continue;
      const barks = story.NPCS[npc.id]?.barks;
      if (!barks?.length || now < (barkCooldown.get(npc.id) ?? 0)) continue;
      if (Math.hypot(npc.character.root.position.x - holder.position.x, npc.character.root.position.z - holder.position.z) > 8) continue;
      barkCooldown.set(npc.id, now + 40000 + Math.random() * 40000);
      const line = t(barks[Math.floor(Math.random() * barks.length)]);
      chatNpc(story.NPCS[npc.id].name, line);
      npcSay(story.NPCS[npc.id].name, line);
    }
  }, 4000);
}

// Mochila, equipo, comercio y banco: cada operación la decide el servidor.
import { story, ui, play, session, vitals } from './state';
import { RPG_CATALOG } from '../data/professions';
import {homeAt,homeState} from '../data/homes';
import { performProfession } from './professions';
import { selectProfessionTab } from '../ui/professionsWindow';
import { autoAssignToActionBar, initActionBar } from '../ui/actionBar';
import { emptyBank, BANK_SPOTS, sanitizeBank, simulateBank, isBankable } from '../data/bank';
import { type BankAction, bankAction, buyFromVendor, sellToVendor, moveInventoryItem, changeEquipment, useItem } from '../services/account';
import { type ItemStack, INVENTORY_UNLOCKED, type EquipmentSlot } from '../data/inventory';
import { simulateBuy, simulateSell, simulateUse } from '../services/devActions';
import { transferEquipment, hasCombatWeapon, EQUIPPABLE } from '../data/equipment';
import { vitalsOf } from '../data/stats';
import { chatCombat } from '../ui/chatWindow';
import { t } from '../ui/i18n';
import { skillAction } from '../ui/skillsWindow';
import { CLASS_SKILLS, skillCost, skillFor, skillRank, type SkillId } from '../data/combat';
import { skillIcon } from '../ui/skillIcons';
import { setWindow } from '../ui/menus';
import { runOnServer } from './server';
import { houseOpen } from '../story/quests';
import { holder, keys, marker, playerVel } from './stage';
import { updateHud } from './hud';
import { storyLock } from './conversation';
import { getCombatActionFeedback, releaseCombatTarget, useWorldCombatSkill } from './combat';
import { skillCooldownRemaining } from './skillCooldown';
import { rebuildNow } from './avatar';
import { totalHealth } from './vitals';
import { restartClass, floatText } from './effects';
import { $ } from '../ui/dom';
import { toast } from '../ui/toast';

// ---------------- Comercio ----------------

export function openVendor(id: string) {
  const def = story.NPCS[id];
  if (!def) return;
  ui.vendor = { id, name: def.name };
  setWindow('vendor');
}
export async function vendorTransaction(call: (id: string, vendorId: string) => Promise<Record<string, unknown>>, simulate: () => void, bought?: string) {
  if (!ui.vendor) return;
  const vendorId = ui.vendor.id;
  if (await runOnServer((id) => call(id, vendorId), simulate)) {
    if (bought) autoAssignToActionBar(bought);
    if (ui.openWindow === 'vendor') setWindow('vendor', false);
  }
}
// ---------------- Banco de la cuenta ----------------

// En ?test no hay servidor: el banco vive en memoria mientras dure la página.
export const testBank = emptyBank();
export const nearBank = () => {
  const spot = BANK_SPOTS[play.city.locationId];
  const home=homeAt(play.city.locationId),homes=homeState(session.state.rpg?.homes);
  return (home?homes.owned.includes(home.id)&&!homes.visit:houseOpen()) && !!spot && Math.hypot(holder.position.x - spot.x, holder.position.z - spot.z) <= spot.radius;
};
export async function bankTransaction(action: BankAction, value: number | null = null, expected: ItemStack | null = null, target: number | null = null) {
  const done = await runOnServer(async id => {
    const data = await bankAction(id, action, action.endsWith('_pelines') || action === 'open' ? null : value, expected,
      action.endsWith('_pelines') ? value : null, target);
    ui.bankState = sanitizeBank(data.bank);
    return data;
  }, () => {
    if (action !== 'open') simulateBank(session.state, testBank, action, value ?? 0, target);
    ui.bankState = sanitizeBank(testBank);
  });
  if (done && ui.openWindow === 'bank') { updateHud(); setWindow('bank', false); }
  return done;
}
export async function openBank() {
  if (play.dead || storyLock() || !nearBank()) return;
  keys.clear(); play.moveTarget = null; play.pendingTalk = null; marker.visible = false; playerVel.set(0, 0, 0);
  ui.bankState = null;
  setWindow('bank');
  if (!(await bankTransaction('open')) && ui.openWindow === 'bank' && !ui.bankState) setWindow(null);
}
export const buyItem = (item: string) => vendorTransaction((id, v) => buyFromVendor(id, v, item), () => simulateBuy(session.state, ui.vendor!.id, item), item);
export const sellItem = (slot: number) => vendorTransaction((id, v) => sellToVendor(id, v, slot), () => simulateSell(session.state, slot));
export async function moveInventorySlot(from: number, to: number) {
  const source = session.state.inventory[from], target = session.state.inventory[to];
  if (!source || from === to || play.dead) return;
  const moved = await runOnServer(id => moveInventoryItem(id,from,to,source,target), () => {
    [session.state.inventory[from],session.state.inventory[to]] = [target,source];
  });
  if (moved && (ui.openWindow === 'inventory' || ui.openWindow === 'bank')) setWindow(ui.openWindow,false);
}
/** Guarda en el baúl, uno tras otro, todos los objetos de la mochila que se pueden guardar. */
export async function depositAll() {
  for (let slot = 0; slot < INVENTORY_UNLOCKED; slot++) {
    const item = session.state.inventory[slot];
    if (item && isBankable(item) && !(await bankTransaction('deposit', slot, item))) return;
  }
}
export async function updateEquipment(slot: EquipmentSlot, bag: number | null) {
  const source = bag === null ? session.state.equipment[slot] : session.state.inventory[bag];
  if (!source || play.dead) return;
  if (!(await runOnServer(id => changeEquipment(id, slot, bag, source), () => transferEquipment(session.state, slot, bag, source)))) return;
  if (!hasCombatWeapon(session.state)) releaseCombatTarget();
  rebuildNow(); updateHud();
  if (ui.openWindow === 'inventory') setWindow('inventory', false);
}
export function equipInventoryItem(bag: number) {
  const item = session.state.inventory[bag], meta = item && EQUIPPABLE[item.id];
  if (meta) void updateEquipment(meta.slot, bag);
}
/** Usa un objeto de la mochila (clic en el hueco). */
export async function useInventoryItem(slot: number) {
  if (play.dead) return;
  const item=session.state.inventory[slot],extra=item&&RPG_CATALOG.items[item.id];
  if(extra?.tool){await performProfession('tool',{slot});if(ui.openWindow==='inventory')setWindow('inventory',false);return;}
  if(extra?.recipe){
    if(await performProfession('use_recipe',{slot,id:item!.id,...(item!.instanceId?{instanceId:item!.instanceId}:{})})){
      toast('Receta aprendida',RPG_CATALOG.recipes[extra.recipe].label);
      if(ui.openWindow==='inventory')setWindow('inventory',false);
    }return;
  }
  if(extra?.furniture&&session.state.location!=='casa_de_isberto_interior'){setWindow('homes');return;}
  if(extra?.enchant||extra?.furniture){selectProfessionTab(extra.enchant?'enchants':'furniture');setWindow('professions');void performProfession('state');return;}
  const before = totalHealth();
  const resourceBefore = vitalsOf(session.state).resource;
  if (!(await runOnServer((id) => useItem(id, slot), () => simulateUse(session.state, slot)))) return;
  play.char.useItem();
  const healed = totalHealth() - before;
  const restored = vitalsOf(session.state).resource - resourceBefore;
  if (restored > 0) chatCombat(t('Recuperas {n} puntos de {resource}.', { n: restored, resource: t(vitalsOf(session.state).resourceKind === 'mana' ? 'Maná' : 'Estamina') }), 'heal');
  if (healed > 0) chatCombat(t('Te curas {n} puntos de vida.', { n: healed }), 'heal');
  updateHud();
  if (healed > 0) {
    restartClass($('#heal-vignette'), 'hit');
    restartClass($('.hud-health'), 'healed');
    play.char.heal();
    floatText(`+${healed}`, 'heal');
  }
  if (ui.openWindow === 'inventory') setWindow('inventory', false);
}
/** Barra de acción: objetos y habilidades del personaje activo. */
export function installActionBar() {
  const icons = new Map<string, string>();
  initActionBar({
    storageKey: () => `brumaluz-actionbar:${session.activeCharacterId ?? 'test'}`,
    count: (item) => session.state.inventory.reduce((sum, s) => sum + (s?.id === item ? s.count : 0), 0),
    bound: (item) => session.state.inventory.find(s => s?.id === item)?.bound === true,
    use: (item) => {
      const slot = session.state.inventory.findIndex((s) => s?.id === item);
      if (slot < 0) toast('No te quedan', '', true); else void useInventoryItem(slot);
    },
    skill: (actionId) => {
      const cls = session.state.cls;
      const actions = CLASS_SKILLS[cls].filter(skill => session.state.level >= skill.unlockLevel);
      const action = actions.find(skill => skillAction(skill.id) === actionId) ?? actions[0];
      if (!action) throw new Error(`No hay una habilidad inicial para ${cls}.`);
      return makeAction(action.id);
    },
    skills: () => CLASS_SKILLS[session.state.cls]
      .filter(skill => session.state.level >= skill.unlockLevel)
      .map(skill => makeAction(skill.id)),
    useSkill: useWorldCombatSkill,
    feedback: getCombatActionFeedback,
    itemCooldown:()=>Math.max(0,(session.state.potionReadyAt??0)-Date.now()/1000),
  });

  function makeAction(id: SkillId) {
    const cls = session.state.cls, skill = skillFor(cls, id);
    if (!skill) throw new Error(`La habilidad ${id} no pertenece a ${cls}.`);
    const resource = vitalsOf(session.state).resource, cost = skillCost(session.state, id);
    const unavailableReason: 'dead'|'weapon'|'resource'|undefined = play.dead ? 'dead' : !hasCombatWeapon(session.state) ? 'weapon' : resource < cost ? 'resource' : undefined;
    let icon = icons.get(id);
    if (!icon) { icon = skillIcon(id); icons.set(id, icon); }
    return {
      id: skillAction(id), skillId: id, cls, rank: skillRank(session.state, id), equipment: session.state.equipment, icon,
      cooldown: skillCooldownRemaining(id), duration: skill.cooldown,
      available: !unavailableReason, unavailableReason, resource, cost,
    };
  }
}

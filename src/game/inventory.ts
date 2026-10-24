// Mochila, equipo, comercio y banco: cada operación la decide el servidor.
import { story, ui, play, session, vitals } from './state';
import { setBonuses } from '../data/sets';
import { RPG_CATALOG } from '../data/professions';
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
import { skillRank, COMBAT_KITS } from '../data/combat';
import { skillIcon } from '../ui/skillIcons';
import { setWindow } from '../ui/menus';
import { runOnServer } from './server';
import { houseOpen } from '../story/quests';
import { holder, keys, marker, playerVel } from './stage';
import { updateHud } from './hud';
import { storyLock } from './conversation';
import { releaseCombatTarget, useWorldCombatSkill } from './combat';
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
  return houseOpen() && !!spot && Math.hypot(holder.position.x - spot.x, holder.position.z - spot.z) <= spot.radius;
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
  if(extra?.recipe){await performProfession('learn',{id:extra.recipe});if(ui.openWindow==='inventory')setWindow('inventory',false);return;}
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
  initActionBar({
    storageKey: () => `brumaluz-actionbar:${session.activeCharacterId ?? 'test'}`,
    count: (item) => session.state.inventory.reduce((sum, s) => sum + (s?.id === item ? s.count : 0), 0),
    bound: (item) => session.state.inventory.find(s => s?.id === item)?.bound === true,
    use: (item) => {
      const slot = session.state.inventory.findIndex((s) => s?.id === item);
      if (slot < 0) toast('No te quedan', '', true); else void useInventoryItem(slot);
    },
    skill: () => ({
      id: skillAction(session.state.cls), cls: session.state.cls, rank: skillRank(session.state), equipment: session.state.equipment, icon: skillIcon(COMBAT_KITS[session.state.cls].skill.id),
      cooldown: Math.max(0, (vitals.skillReadyAt - performance.now()) / 1000), duration: COMBAT_KITS[session.state.cls].skill.cooldown,
      available: !play.dead && hasCombatWeapon(session.state) && vitalsOf(session.state).resource >= COMBAT_KITS[session.state.cls].skill.cost * (1-setBonuses(session.state.cls,session.state.equipment).skillCost),
    }),
    useSkill: useWorldCombatSkill,
    itemCooldown:()=>Math.max(0,(session.state.potionReadyAt??0)-Date.now()/1000),
  });
}

import { tradeAction } from './account';
import { sanitizeInventory, type InventorySlots, type ItemStack } from '../data/inventory';

export interface TradeOffer { items: (ItemStack & { slot: number })[]; pelines: number }
export interface Trade {
  id: string; status: 'invited' | 'open' | 'completed' | 'cancelled'; reason: string | null;
  revision: number; incoming: boolean; peerId: string; peerName: string;
  own: TradeOffer; peer: TradeOffer; accepted: boolean; peerAccepted: boolean;
}
export interface TradeState { trade: Trade | null; inventory: InventorySlots; wallet: { pelines: number } }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function validOffer(value: unknown): value is TradeOffer {
  return record(value) && amount(value.pelines) && Array.isArray(value.items)
    && value.items.every(item => record(item) && amount(item.slot) && item.slot < 25
      && typeof item.id === 'string' && amount(item.count) && item.count > 0);
}
function validTrade(value: unknown): value is Trade {
  return record(value) && typeof value.status === 'string'
    && ['invited', 'open', 'completed', 'cancelled'].includes(value.status)
    && typeof value.id === 'string' && amount(value.revision)
    && (value.reason === null || typeof value.reason === 'string')
    && typeof value.incoming === 'boolean' && typeof value.peerId === 'string' && typeof value.peerName === 'string'
    && typeof value.accepted === 'boolean' && typeof value.peerAccepted === 'boolean'
    && validOffer(value.own) && validOffer(value.peer);
}
export async function requestTrade(character: string, action: string, trade?: Trade, target?: string, offer?: TradeOffer): Promise<TradeState> {
  const payload = offer && { items: offer.items.map(item => ({ ...item })), pelines: offer.pelines };
  const value: unknown = await tradeAction(character, action, trade?.id, target, payload, trade?.revision);
  if (!record(value) || (value.trade !== null && !validTrade(value.trade))
    || !Array.isArray(value.inventory) || !record(value.wallet) || !amount(value.wallet.pelines)) {
    throw new Error('TRADE_INVALID_RESPONSE');
  }
  return { trade: value.trade, inventory: sanitizeInventory(value.inventory), wallet: { pelines: value.wallet.pelines } };
}

// Sistema de monedas. Para añadir una moneda nueva basta con una entrada en CURRENCIES:
// el monedero del personaje, el saneado de datos y la UI (inventario, ficha) la recogen solos.
// Documentado en docs/CURRENCY.md.

export type CurrencyId = 'pelines' | 'lagrimas';

export interface CurrencyDef {
  id: CurrencyId;
  label: string; // plural, en español (se traduce con t())
  singular: string;
  description: string;
  premium: boolean; // las premium se muestran con un estilo especial
  icon: string; // SVG interior (viewBox 0 0 24 24); usa currentColor / var(--cur-*)
}

export const CURRENCIES: Record<CurrencyId, CurrencyDef> = {
  pelines: {
    id: 'pelines',
    label: 'Pelines',
    singular: 'Pelín',
    description: 'La moneda corriente de Brumaluz. Sirve para comerciar y pagar servicios.',
    premium: false,
    icon: '<circle cx="12" cy="12" r="10.2"/><circle cx="12" cy="12" r="8.6" stroke-dasharray="1 1.15" stroke-width="1.1"/><circle cx="12" cy="12" r="6.6"/><path class="star" d="M12 7.2l1.5 3.2 3.4.4-2.5 2.3.7 3.4-3.1-1.8-3.1 1.8.7-3.4-2.5-2.3 3.4-.4Z"/><path class="shine" d="M6.4 9.6A6 6 0 0 1 9.4 6.5"/>',
  },
  lagrimas: {
    id: 'lagrimas',
    label: 'Lágrimas de fénix',
    singular: 'Lágrima de fénix',
    description: 'Una lágrima de fénix cristalizada, tan rara como valiosa. Con ella se consiguen tesoros y privilegios únicos.',
    premium: true,
    icon: '<path d="M12 2.5c3.4 4.1 6 7.2 6 10.6a6 6 0 0 1-12 0c0-3.4 2.6-6.5 6-10.6Z"/><path d="M12 9.5c1.7 2 2.8 3.4 2.8 4.9a2.8 2.8 0 0 1-5.6 0c0-1.5 1.1-2.9 2.8-4.9Z"/>',
  },
};

export const CURRENCY_ORDER: CurrencyId[] = ['pelines', 'lagrimas'];

/** Icono SVG de una moneda; usar siempre este helper para que sea idéntico en toda la UI. */
export const currencyIcon = (id: CurrencyId) => `<svg class="currency-icon currency-icon-${id}" viewBox="0 0 24 24" aria-hidden="true">${CURRENCIES[id].icon}</svg>`;

export type Wallet = Record<CurrencyId, number>;

export const emptyWallet = (): Wallet => ({ pelines: 0, lagrimas: 0 });

export function sanitizeWallet(raw: unknown, legacyGold?: unknown): Wallet {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const wallet = emptyWallet();
  for (const id of CURRENCY_ORDER) {
    const n = Number(src[id]);
    wallet[id] = Number.isFinite(n) ? Math.max(Math.floor(n), 0) : 0;
  }
  // Migración: antes el dinero se guardaba como `gold`.
  const legacy = Number(legacyGold);
  if (!wallet.pelines && Number.isFinite(legacy) && legacy > 0) wallet.pelines = Math.floor(legacy);
  return wallet;
}

export function addCurrency(wallet: Wallet, id: CurrencyId, amount: number): void {
  wallet[id] = Math.max(0, Math.floor(wallet[id] + amount));
}

export function canAfford(wallet: Wallet, id: CurrencyId, amount: number): boolean {
  return wallet[id] >= amount;
}

/** Descuenta si hay saldo suficiente; devuelve si se pudo. */
export function spendCurrency(wallet: Wallet, id: CurrencyId, amount: number): boolean {
  if (!canAfford(wallet, id, amount)) return false;
  wallet[id] -= amount;
  return true;
}

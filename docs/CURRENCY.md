# Monedas

Todo el sistema vive en [`src/data/currency.ts`](../src/data/currency.ts).

| Id | Nombre | Tipo | Notas |
|----|--------|------|-------|
| `pelines` | Pelines | Normal | Moneda corriente del juego (comercio, servicios). |
| `lagrimas` | Lágrimas de fénix | Premium | Moneda especial; se muestra con llama, brillo y borde cálido. |

## Datos del personaje

`CharData.wallet` es un `Record<CurrencyId, number>` (enteros ≥ 0), guardado dentro del jsonb del personaje.
`sanitize()` lo repara al cargar y migra el antiguo campo `gold` a `pelines`.

## API

- `CURRENCIES` / `CURRENCY_ORDER`: definiciones y orden de aparición.
- `emptyWallet()`, `sanitizeWallet(raw, legacyGold?)`.
- `addCurrency(wallet, id, amount)`, `canAfford(wallet, id, amount)`, `spendCurrency(wallet, id, amount)` (devuelve `false` si no hay saldo).

## Añadir una moneda nueva

1. Añade el id a `CurrencyId` y una entrada en `CURRENCIES` (etiqueta, descripción, `premium`, icono SVG de viewBox 24).
2. Añádela a `CURRENCY_ORDER` y a `emptyWallet()`.
3. Traduce etiqueta y descripción en `src/ui/i18n.ts`.

La UI (inventario y ficha, `src/ui/playerWindows.ts`) las dibuja iterando `CURRENCY_ORDER`; las `premium` reciben la clase `.premium` (estilos en `src/styles/style.css`).

> Las lágrimas de fénix no se obtienen todavía de ninguna forma: solo existe el monedero.

# Monedas

Todo el sistema vive en [`src/data/currency.ts`](../src/data/currency.ts).

| Id | Nombre | Tipo | Notas |
|----|--------|------|-------|
| `pelines` | Pelines | Normal | Moneda corriente del juego (comercio, servicios). |
| `lagrimas` | Lágrimas de fénix | Premium | Moneda especial; se muestra con llama, brillo y borde cálido. |

## Revisión de economía del 31 de octubre

Se mantiene el precio ordinario de venta a comerciantes: 50 % del valor base,
con el redondeo y mínimo existentes, pero **los comerciantes no comprarán
materias primas**. Estas se destinan a fabricación o comercio entre jugadores.
Se mantienen otras ventas válidas, combate y misiones como fuentes de ingresos.
La entrega de materiales del tutorial de recolección es una excepción única de
aprendizaje, no una compra ordinaria ni un encargo diario repetible.

Los proyectos opcionales de barrio tendrán un cupo propio de dos completados
por personaje y día, y **cada proyecto es único por personaje**. Banco pagará
75 Pelines por dos componentes propios de Ebanistería y Plantas, 25 Pelines y
un macetero único por dos componentes propios de Alquimia; no hay pagos diarios
repetidos de estos proyectos. La merienda compartida tendrá otro cupo de **dos
meriendas con recompensa por personaje y día**, que no se recupera al cambiar
de grupo. Ambos cupos son independientes del de maestros. Las meriendas tendrán
**tres recetas aleatorias diarias por personaje**. Cada contribuyente recibe una
ración del plato más **10, 20 o 30 Pelines** según la dificultad; aportar cualquier
ingrediente da derecho a la recompensa completa, dentro del cupo personal.
Cada recompensa incluye además 5, 10 o 15 XP de Cocina. El cupo se gasta al recoger,
no al terminar la preparación: las recompensas de otro día cuentan para el día
de recogida y caducan tras siete días si no se recogen. Se puede repetir la receta
en preparaciones distintas y los ayudantes
pueden cobrar aunque tengan menos rango de Cocina. El máximo recogido diario es
60 Pelines más dos raciones y 30 XP de Cocina por personaje. Esto sustituye la decisión
anterior de no pagar dinero en esta actividad social; no permite la venta
ordinaria de materias primas. Tras agotar las dos recompensas se puede seguir
aportando con aviso previo, sin otra recompensa de comida, dinero ni XP. Las
preparaciones incompletas conservan ingredientes, receta, recompensa y progreso
mientras estén activas, con hasta tres pendientes por personaje. No hay cancelación
manual: se cancelan automáticamente tras 30 minutos desde la última aportación,
reiniciados con cada ingrediente añadido y pausados cuando no queda ningún
participante conectado, o al disolverse el grupo, devolviendo los ingredientes a sus respectivos
participantes. Esto sustituye su conservación indefinida anterior. Véase
[Meriendas compartidas](SHARED-MEALS.md).

La casa posterior a la posada costará 3.500 Pelines y el recado inicial de Gnomi
pagará 100 una sola vez. Los pagos y XP de encargos están definidos en
[Encargos diarios](DAILY-ORDERS.md). Estado y decisiones en
[Viviendas y vida cotidiana](HOMES-AND-COZY-LIFE.md). Estos cambios están aplicados
y probados localmente desde el 2 de noviembre; véase
[Aplicación de la revisión cozy](COZY-IMPLEMENTATION-2026-11-02.md) para distinguir
la preparación del parche y la publicación remota.

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

> Las lágrimas de fénix aún no tienen una fuente de obtención ordinaria documentada. Sí tienen usos implementados en los oficios; véanse sus costes abajo.

## Usos implementados: energía y herramientas

La recarga de energía de recolección cuesta **5 Lágrimas de fénix** y rellena la reserva hasta 100; no aumenta su máximo ni el dominio del oficio. Se comparte entre Minero, Leñador y Recolector, y es independiente de los recursos de combate.

La restauración completa de una herramienta cuesta **5 + 2 por nivel de herramienta** Lágrimas de fénix y recupera su durabilidad actual y máxima originales. También se puede usar un Núcleo de restauración. La reparación ordinaria conserva el desgaste máximo perdido progresivamente; una herramienta que haya alcanzado el límite debe restaurarse. Ambas acciones requieren acudir al herrero.

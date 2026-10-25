# Sistema de estadísticas

Los máximos viven en [`src/data/stats.ts`](../src/data/stats.ts); daño, conjuntos y encantamientos, en los módulos correspondientes de `src/data/`. Los datos del personaje (`CharData`) están en [`src/data/data.ts`](../src/data/data.ts). La implementación vigente del 24 de octubre se resume en [RPG-IMPLEMENTATION.md](RPG-IMPLEMENTATION.md); sus fórmulas tienen réplica autoritativa en SQL.

## Datos guardados en el personaje

| Campo | Significado |
|---|---|
| `level` | Nivel actual (≥ 1). |
| `experience` | Experiencia acumulada **dentro del nivel actual** (se reinicia al subir). |
| `health` | Vida actual. `-1` = al máximo. |
| `resource` | Maná o estamina actual según la clase. `-1` = al máximo. |
| `foodBuff` | Alimento activo (`itemId`) y segundos de conexión restantes (`remaining`), o `null`. |
| `foodRevision` | Versión del alimento: evita que una respuesta antigua deshaga una renovación. |

Los valores máximos **no se guardan**: se calculan siempre a partir de nivel, clase, raza y atributos, así que cambiar una fórmula afecta a todos los personajes existentes. Los personajes antiguos sin `health`/`resource` se reparan solos en `sanitize()`.

## Atributos

`attributeTotal(d, id)` = valor base (`ATTRIBUTE_BASE_VALUE`, 5) + bonificación racial + puntos asignados en el creador.

## Fórmulas (editables en `stats.ts`)

Cada estadística usa la misma forma, `StatFormula`:

```
valor = base + (nivel - 1) × perLevel + Σ (atributo × peso)
```

| Estadística | base | perLevel | Pesos por atributo |
|---|---|---|---|
| Vida base (`MAX_HEALTH`) | 60 | 12 | Sin suma plana por atributo |
| Maná máximo (`MAX_RESOURCE.mana`) | 25 | 6 | Intelecto ×7, Presencia ×1 |
| Estamina máxima (`MAX_RESOURCE.stamina`) | 45 | 6 | Agilidad ×3, Corpulencia ×3, Presencia ×1 |

Ejemplo: mago de nivel 2 con Intelecto 8 y Presencia 5 → 25 + 6 + 8×7 + 5 = **92** de maná.

Después se añaden equipo y multiplicadores:

```
vida = floor((vida base + vida de equipo) × (1 + 0,02 × Corpulencia) × (1 + bono de vida del conjunto) × grupo) + comida
recurso = floor((recurso base + recurso de equipo) × (1 + bono de recurso del conjunto) × grupo) + comida
```

La potencia usa `(1 + 0,01 × atributo principal) × (1 + 0,02 × (nivel − 1))`, una sola vez para básicos, habilidades y curación. Guardia mitiga `min(0,60; Guardia / (Guardia + 20))`; no resta daño plano.

Desde el 25 de octubre, todos los atributos tienen una utilidad de combate en todas las clases. Las bonificaciones secundarias usan `extra = max(0, atributo − 5)`, salvo Presencia y Corpulencia, que usan el total:

| Atributo | Beneficio universal |
|---|---|
| Fuerza | Básicos × `(1 + 0,003 × extra)` |
| Intelecto | Coste de habilidad × `max(0,75; 1 / (1 + 0,004 × extra))` |
| Corpulencia | Vida máxima × `(1 + 0,02 × total)` |
| Agilidad | Cadencia × `max(0,75; 1 / (1 + 0,004 × extra))`, sin bajar de la duración de animación + 40 ms |
| Pericia | Potencia de habilidad o curación × `(1 + 0,004 × extra)` |
| Presencia | +1 de maná o estamina máximo por punto |
| Percepción | Daño recibido tras Guardia × `max(0,85; 1 / (1 + 0,003 × extra))` |

Fuerza sigue siendo el atributo principal del guerrero; Intelecto, de mago y clérigo; Agilidad, de pícaro y explorador. Las nuevas utilidades no igualan sus especializaciones. Cliente, daño exterior, sombra y curación de aliados comparten las mismas fórmulas SQL.

### Recurso por clase

`CLASS_RESOURCE` indica si una clase usa maná o estamina (mago y clérigo: maná; el resto: estamina).

### Experiencia

`experienceToNextLevel(L) = round(XP_CURVE.base × L ^ XP_CURVE.exponent)` (100 × L^1.5: 100, 283, 520, 800…).

### Bonificación de grupo

El servidor calcula `partyPeers` (0–3 compañeros conectados, sin contar al propio personaje); es transitorio y no se guarda en el personaje. Las mismas fórmulas se aplican en el cliente para representar sus barras:

```
máximo con grupo = floor(máximo base × (1 + partyPeers × 0.015))
```

Se aplica a vida y maná/estamina: +1,5 % con dos integrantes, +3 % con tres y +4,5 % con cuatro. Sin compañeros no hay bonificación. El máximo aumentado no añade una curación explícita; `-1` sigue representando una barra llena.

La experiencia de personaje ganada recibe **+2 % fijo** cuando hay al menos un compañero, no +2 % por integrante. Se aplica en `debug_xp` y en las expediciones; estas últimas conservan restos fraccionarios para no perder el bono en recompensas pequeñas. La experiencia propia de los oficios se calcula por dificultad y calidad, sin este bono.

### Comida temporal

**Pan duro** cuesta 4 pelines (venta por 2). Añade **+5 de vida máxima y +3 del recurso máximo** durante **900 segundos conectado al mundo**. El bono es plano y se suma después del multiplicador de grupo. Comer no cura ni rellena el recurso, incluso si el valor previo era `-1`: el servidor convierte esos valores en la cantidad actual antes de añadir el bono. Comer otro pan consume una unidad y renueva los 900 segundos, sin acumularse.

El catálogo del bono está en [`src/data/food.ts`](../src/data/food.ts); precios, duración y reglas autoritativas se replican en [`supabase/server/`](../supabase/server/). El servidor persiste `food_at` como referencia interna y descuenta tiempo solo dentro de la presencia del personaje. La salida guarda el resto; tras una desconexión abrupta, una concesión caducada se detiene en el último latido confirmado, sin descontar el periodo sin conexión. Al volver se reancla el reloj y continúa desde el resto guardado. Las sesiones sustituidas no pueden seguir descontándolo.

Los snapshots devuelven el alimento y su reloj **solo al propietario**; los otros jugadores y el grupo reciben los máximos derivados, no el inventario ni el tiempo del alimento. El cliente interpola el contador sobre la barra rápida, se pausa al fallar la conexión y se reconcilia con el servidor en cada latido. Al agotarse desaparece el icono y los máximos regresan a su valor normal; las cantidades actuales se limitan al máximo vigente.

## Estadísticas de armas

El daño y la guardia del equipo viven en `src/data/weapons.ts`, con una réplica SQL generada. No se añaden puntos permanentes a los atributos del personaje al equipar estas piezas. Las cifras, fórmulas e interacciones con habilidades se describen en [WEAPONS.md](WEAPONS.md).

## Cómo ampliarlo

- **Cambiar equilibrado:** edita los números de `MAX_HEALTH`, `MAX_RESOURCE`, `XP_CURVE` o `CLASS_RESOURCE`.
- **Nueva estadística derivada** (por ejemplo, defensa o velocidad): añade una `StatFormula`, una función `xxxOf(d)` con `evaluate(...)` y, si la UI la muestra, inclúyela en `Vitals`/`vitalsOf`.
- **Nuevo atributo:** añádelo en `data.ts` (`AttributeId`, `ATTRIBUTES`, bonos de raza) y úsalo en los pesos.
- **Aplicar daño, gasto o experiencia:** modifica `health`, `resource` o `experience` en el estado del personaje y vuelve a llamar a `updateHud()`. Al subir de nivel, resta `experienceToNextLevel(level)` a `experience` y suma 1 a `level`.

# Sistema de estadísticas

Todo el cálculo vive en [`src/data/stats.ts`](../src/data/stats.ts). Los datos del personaje (`CharData`) están en [`src/data/data.ts`](../src/data/data.ts). La interfaz (`updateHud` en `src/main.ts`) solo lee `vitalsOf(state)`.

## Datos guardados en el personaje

| Campo | Significado |
|---|---|
| `level` | Nivel actual (≥ 1). |
| `experience` | Experiencia acumulada **dentro del nivel actual** (se reinicia al subir). |
| `health` | Vida actual. `-1` = al máximo. |
| `resource` | Maná o estamina actual según la clase. `-1` = al máximo. |

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
| Vida máxima (`MAX_HEALTH`) | 60 | 12 | Corpulencia ×8 |
| Maná máximo (`MAX_RESOURCE.mana`) | 30 | 6 | Intelecto ×7 |
| Estamina máxima (`MAX_RESOURCE.stamina`) | 50 | 6 | Agilidad ×3, Corpulencia ×3 |

Ejemplo: mago de nivel 2 con Intelecto 8 → 30 + 6 + 8×7 = **92** de maná.

### Recurso por clase

`CLASS_RESOURCE` indica si una clase usa maná o estamina (mago y clérigo: maná; el resto: estamina).

### Experiencia

`experienceToNextLevel(L) = round(XP_CURVE.base × L ^ XP_CURVE.exponent)` (100 × L^1.5: 100, 283, 520, 800…).

## Cómo ampliarlo

- **Cambiar equilibrado:** edita los números de `MAX_HEALTH`, `MAX_RESOURCE`, `XP_CURVE` o `CLASS_RESOURCE`.
- **Nueva estadística derivada** (por ejemplo, defensa o velocidad): añade una `StatFormula`, una función `xxxOf(d)` con `evaluate(...)` y, si la UI la muestra, inclúyela en `Vitals`/`vitalsOf`.
- **Nuevo atributo:** añádelo en `data.ts` (`AttributeId`, `ATTRIBUTES`, bonos de raza) y úsalo en los pesos.
- **Aplicar daño, gasto o experiencia:** modifica `health`, `resource` o `experience` en el estado del personaje y vuelve a llamar a `updateHud()`. Al subir de nivel, resta `experienceToNextLevel(level)` a `experience` y suma 1 a `level`.

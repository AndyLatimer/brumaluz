# Inventario de rigs y animaciones

Revisión del 28 de octubre de 2026, comprobada contra los GLB locales, el
[catálogo importado](../src/assets/library/catalog.json), el
[inventario de originales](../src/assets/library/sources.json) y los cargadores
actuales. Este documento reúne lo disponible para próximas implementaciones;
los posibles usos no aprueban clases, criaturas, oficios ni mecánicas nuevas.
La identidad y las decisiones del mundo siguen en [LORE.md](LORE.md).

## Resumen y alcance

| Recurso | Contenido comprobado | Estado |
| --- | --- | --- |
| Character Animations 1.1 · Medium (normal) | 8 bibliotecas, 139 entradas, 132 nombres distintos dentro del rig | Biblioteca completa disponible en los visores; el juego usa una selección |
| Character Animations 1.1 · Large (grande) | 6 bibliotecas, 34 entradas, 29 nombres distintos dentro del rig | Disponible en el visor; sin personaje Large integrado en el juego |
| Adventurers 2.0 FREE | 6 personajes Medium y 2 bibliotecas con 26 entradas | Personajes y clips de referencia; General y MovementBasic duplican los del paquete completo |
| Skeletons 1.1 FREE | 4 personajes Medium y las mismas 2 bibliotecas, 26 entradas | Recursos disponibles; importarlos no los convierte en enemigos activos |
| Personaje de producción | 21 clips en `models/Mage.glb`, rig de 41 huesos | Base compartida por `Character` |
| Complemento de producción | 5 clips en `models/ambient-animations.glb` | `Idle_B`, `Hit_B`, `Crawling`, `Walking_C`, `Cheering` |
| Variantes del juego | 9 clips `Combat_*`, 2 `Gather_*` y `Use_Item_UpperBody` | Se construyen en memoria a partir de clips existentes |
| Objetos Kenney animados | 3 molinos, un clip `animation` por modelo | Animaciones de objetos, sin rig humanoide |

Las **173 entradas** de Character Animations incluyen un `T-Pose` en cada una
de sus 14 bibliotecas y otras poses estáticas de duración cero. No son 173
acciones jugables distintas. Los duplicados de Adventurers y Skeletons tampoco
añaden movimientos. Nombres iguales en Medium y Large pertenecen a recursos
diferentes y pueden tener otras duraciones y proporciones.

## Paquetes, originales y personajes

Las rutas de biblioteca de esta tabla son relativas a `src/assets/library/`.
Los originales están en `.art-sources/`, una carpeta local ignorada por Git;
los GLB preparados y sus licencias sí se conservan en el repositorio.

| Paquete y origen local | Personajes y rutas preparadas | Rigs y animaciones |
| --- | --- | --- |
| `KayKit_Character_Animations_1.1` | `character-animations/characters/Mannequin_Medium.glb`, `Mannequin_Large.glb` | Medium y Large; bibliotecas separadas en `character-animations/animations/` |
| `KayKit_Adventurers_2.0_FREE` | `adventurers/characters/`: `Barbarian.glb`, `Knight.glb`, `Mage.glb`, `Ranger.glb`, `Rogue.glb`, `Rogue_Hooded.glb` | Todos Medium; `adventurers/animations/Rig_Medium_General.glb` y `Rig_Medium_MovementBasic.glb` |
| `KayKit_Skeletons_1.1_FREE` | `skeletons/characters/`: `Skeleton_Mage.glb`, `Skeleton_Minion.glb`, `Skeleton_Rogue.glb`, `Skeleton_Warrior.glb` | Todos Medium; `skeletons/animations/Rig_Medium_General.glb` y `Rig_Medium_MovementBasic.glb` |

Los doce personajes de biblioteca no llevan clips incrustados: se combinan
con bibliotecas compatibles. El único personaje grande de estos paquetes es
**Mannequin_Large**; no hay un catálogo de gigantes terminados. Barbarian y
los cuatro Skeletons son Medium aunque cambie su silueta.

Character Animations conserva **37 archivos originales**: los dos maniquíes
en GLB y FBX, catorce bibliotecas en GLB y FBX, una textura, la licencia y tres
enlaces. Sus rutas de origen son:

```text
.art-sources/KayKit_Character_Animations_1.1/
  Mannequin Character/characters/Mannequin_Medium.{glb,fbx}
  Mannequin Character/characters/Mannequin_Large.{glb,fbx}
  Animations/gltf/Rig_Medium/Rig_Medium_*.glb
  Animations/gltf/Rig_Large/Rig_Large_*.glb
  Animations/fbx/Rig_Medium/Rig_Medium_*.fbx
  Animations/fbx/Rig_Large/Rig_Large_*.fbx
```

En Adventurers, los personajes originales están en `Characters/gltf/`; en
Skeletons, en `characters/gltf/`. Ambos tienen las dos bibliotecas originales
en `Animations/gltf/Rig_Medium/`, además de versiones FBX y otros recursos
enumerados en `sources.json`. No se ha encontrado una fuente `.blend` en el
paquete Character Animations entregado.

La autoría de estos tres paquetes es **Kay Lousberg**. Las licencias CC0
originales se guardan en [Character Animations](../src/assets/library/character-animations/LICENSE.txt),
[Adventurers](../src/assets/library/adventurers/LICENSE.txt) y
[Skeletons](../src/assets/library/skeletons/LICENSE.txt). El arte original de
Brumaluz conserva su propio régimen; reutilizar un rig no cambia su autoría.

## Compatibilidad de los rigs

| Recurso | Huesos de su skin | Condiciones |
| --- | ---: | --- |
| Maniquí Medium original | 21 | Omite `handslot.l` y `handslot.r`; el visor añade estos dos auxiliares desde la biblioteca |
| Personajes Adventurers y Skeletons de biblioteca | 23 | Incluyen los dos anclajes de mano; comparten la familia Medium |
| Bibliotecas de animación Medium | 23 | Incluyen maniquí, mallas y texturas; no son archivos de animación sin geometría |
| Maniquí y bibliotecas Large | 23 | Proporciones y pose de reposo Large; no se intercambian con Medium |
| `models/Mage.glb`, `Knight.glb`, `Rogue.glb`, `Barbarian.glb` | 41 | Rig de producción con controles adicionales; `Character` clona Mage y enlaza las otras piezas por nombre |

El número de huesos por sí solo no acredita compatibilidad. Para enlazar otro
recurso hay que comprobar los nombres de todos los nodos animados, la jerarquía
y las transformaciones de reposo. Medium y Large comparten muchos nombres,
pero sus matrices de reposo son diferentes. `animationLibrariesFor()` filtra
por familia y prefiere la
biblioteca completa de Character Animations.

Los maniquíes originales miden aproximadamente **2,204** (Medium) y **3,981**
(Large) unidades de altura en los límites del catálogo. Son medidas del
recurso, no alturas aprobadas para habitantes de Pompelín. Escalar un personaje
Medium no lo convierte en un rig Large: Gnomi y las proporciones actuales del
creador conservan el rig de producción y sus animaciones.

Las prendas y accesorios siguen el contrato de [CHARACTER-ART.md](CHARACTER-ART.md):
pose de reposo, matrices inversas, pesos, nombres y anclajes. Que un clip se
enlace correctamente no garantiza que una prenda, arma o proporción no atraviese
el cuerpo. Revisar también pies, asientos, manos y objetos sostenidos.

## Animaciones que usa actualmente el juego

### Base de producción: 21 clips

Archivo: `src/assets/models/Mage.glb`. `Character` utiliza esta base para todas
las clases y los NPC construidos con el mismo sistema. Los otros tres modelos
de producción aportan piezas y rig, pero **no llevan animaciones**. No confundir
estos archivos con los personajes sin clips de `src/assets/library/adventurers/`.

En tierra, `Walking_A/B/C` y `Running_A` acompasan su reproducción al
desplazamiento horizontal real, también en jugadores remotos; cambiar de marcha
conserva la fase de los pasos y arrancar desde reposo empieza una zancada nueva.
`Jump_Full_Short` sustituye gradualmente la marcha durante el vuelo y la devuelve
antes de terminar el arco físico; los pesos complementarios evitan que la
normalización del mezclador diluya la pose aérea.

<!-- BEGIN PRODUCTION CLIPS -->

| Clip exacto | Duración original (s) |
| --- | ---: |
| `1H_Melee_Attack_Slice_Diagonal` | 1,000 |
| `2H_Melee_Attack_Spin` | 2,400 |
| `2H_Melee_Idle` | 1,067 |
| `Block` | 1,067 |
| `Cheer` | 1,667 |
| `Death_A` | 0,800 |
| `Dodge_Forward` | 0,400 |
| `Hit_A` | 0,667 |
| `Idle` | 1,067 |
| `Interact` | 1,300 |
| `Jump_Full_Short` | 1,167 |
| `PickUp` | 1,300 |
| `Running_A` | 0,800 |
| `Sit_Chair_Idle` | 3,600 |
| `Sit_Floor_Idle` | 4,000 |
| `Spellcast_Raise` | 2,100 |
| `Spellcasting` | 0,667 |
| `Unarmed_Idle` | 1,067 |
| `Use_Item` | 1,600 |
| `Walking_A` | 1,067 |
| `Walking_B` | 1,067 |

<!-- END PRODUCTION CLIPS -->

`Idle`, `Cheer`, `Block`, `Spellcasting`, `Spellcast_Raise`,
`1H_Melee_Attack_Slice_Diagonal`, `2H_Melee_Attack_Spin`, `2H_Melee_Idle` y
`Unarmed_Idle` son nombres del archivo de producción. En las bibliotecas
completas, sus nombres correspondientes son `Idle_A`, `Cheering`, `Melee_Block`,
`Ranged_Magic_Spellcasting`, `Ranged_Magic_Raise`,
`Melee_1H_Attack_Slice_Diagonal`, `Melee_2H_Attack_Spin`, `Melee_2H_Idle` y
`Melee_Unarmed_Idle`. No sustituir nombres en código sin comprobar su fuente.

### Selección y variantes en memoria

| Función actual | Clips y comportamiento |
| --- | --- |
| Reposo y locomoción | `Idle`, variación `Idle_B` tras 10–18 s; `Walking_A/B/C` según el estilo guardado y `Running_A` para correr |
| Salto | `Jump_Full_Short`, mezclado con locomoción y ajustado a 0,82 s; las fases de salto separadas de la biblioteca no están integradas |
| Nado | `Crawling` a velocidad 0,75, con colocación y mezcla procedurales en el agua; no es un clip de natación específico |
| Daño y muerte | Alternancia `Hit_A/B`; caída `Death_A`. La reaparición vuelve a locomoción, sin usar `Spawn_Air/Ground` |
| Recoger e inspeccionar | `PickUp` e `Interact`; la recogida cosmética normal exige reposo. Las escenas pueden solicitar la variante dirigida |
| Consumir | `Use_Item_UpperBody`, máscara aditiva de torso y brazos de `Use_Item`, permite mantener la marcha |
| Sentarse | `Sit_Chair_Idle` para jugador y habitantes; entrada y salida mediante transición y ajuste de altura, sin usar aún `Sit_Chair_Down/StandUp` |
| Saludar y celebrar | `wave()` conserva **`Cheer`**; `celebrate()` reproduce **`Cheering`** al crear un personaje. El clip específico `Waving` está disponible, pero no lo usan estas funciones |
| Curarse y hablar | `heal()` anima expresión y un movimiento suave; `speak()` mueve la boca. No cargan clips nuevos de curación o conversación |
| Minería y tala | `Gather_Mine` desde `Melee_1H_Attack_Chop`; `Gather_Chop` desde `Melee_1H_Attack_Slice_Diagonal`; ambos a 1,25 s y repetidos durante la extracción |
| Otras recogidas | `Interact`, con la herramienta visual que corresponda. Los clips del archivo `Rig_Medium_Tools` todavía no se utilizan para la recolección |

`ambient-animations.glb` contiene actualmente **cinco** clips, sin mallas ni
texturas. `tools/prepare-ambient-animations.mjs` los extrae de General
(Adventurers: `Idle_B`, `Hit_B`), MovementAdvanced (`Crawling`) y MovementBasic
(`Walking_C`), además de Simulation (`Cheering`), comprobando su pose de reposo
contra Mage. La celebración del creador se documenta en
[CHARACTER-CREATOR.md](CHARACTER-CREATOR.md#opciones-y-presentación).

`loadKits()` también carga las bibliotecas Medium de combate y conserva en
memoria `Ranged_1H_*` y `Melee_1H_Attack_*`/`Melee_Dualwield_Attack_*`.
Son fuentes para generar acciones; no todos esos clips tienen una acción propia
registrada. Los nueve resultados de `refinedCombatClips()` son:

| Clip del juego | Fuente | Duración actual (s) y uso |
| --- | --- | --- |
| `Combat_Slash` | `1H_Melee_Attack_Slice_Diagonal` de producción | 0,68; primer básico cuerpo a cuerpo |
| `Combat_Backhand` | `Melee_1H_Attack_Slice_Horizontal` | 0,68; segundo básico cuerpo a cuerpo |
| `Combat_Thrust` | `Melee_1H_Attack_Stab` | 0,68; tercer básico cuerpo a cuerpo |
| `Combat_Heavy` | `Melee_1H_Attack_Chop` | 0,90; habilidad de golpe pesado |
| `Combat_Double` | `1H_Melee_Attack_Slice_Diagonal`, remuestreado con segunda fase reflejada | 0,75; habilidad del pícaro |
| `Combat_Cast` | `Spellcasting` de producción | 0,55; básico mágico |
| `Combat_Discharge` | `Spellcast_Raise` de producción | 0,95; habilidad mágica |
| `Combat_Aim` | `Ranged_1H_Aiming` + `Ranged_1H_Shoot` + `Ranged_1H_Reload` | 0,78; ballesta básica, preparación de 0,20 s |
| `Combat_Precise` | Los mismos tres clips de ballesta | 1,05; disparo preciso, preparación de 0,40 s |

Estas duraciones salen de `src/data/combatDuration.json`; no son los tiempos
originales de la biblioteca ni una propuesta de balance. El comportamiento se
define en [character.ts](../src/character/character.ts) y
[combatAnimations.ts](../src/character/combatAnimations.ts).
La asignación de acciones sigue [COMBAT.md](COMBAT.md),
[RPG-IMPLEMENTATION.md](RPG-IMPLEMENTATION.md),
[RESOURCES-ART.md](RESOURCES-ART.md) y [CITY-POPULATION.md](CITY-POPULATION.md).

## Biblioteca completa Medium

Los archivos siguientes están en `src/assets/library/character-animations/animations/`.
Cada tabla enumera **todos** sus clips, incluido `T-Pose`. Las duraciones son
los máximos tiempos de sus pistas en el GLB, redondeados a tres decimales,
antes de cambiar la velocidad de reproducción. Duración cero indica una pose
estática. El nombre exacto, el rig y el archivo identifican el recurso.

<!-- BEGIN MEDIUM CLIPS -->

### Rig_Medium_General (15 entradas)

Archivo: [Rig_Medium_General.glb](../src/assets/library/character-animations/animations/Rig_Medium_General.glb).

Reposo, impactos y muerte; Medium incluye además interacción, recogida, consumo, lanzamiento y aparición.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Death_A` | 0,800 |
| `Death_A_Pose` | 0,000 |
| `Death_B` | 2,633 |
| `Death_B_Pose` | 0,000 |
| `Hit_A` | 0,667 |
| `Hit_B` | 0,867 |
| `Idle_A` | 1,067 |
| `Idle_B` | 2,133 |
| `Interact` | 1,300 |
| `PickUp` | 1,300 |
| `Spawn_Air` | 1,300 |
| `Spawn_Ground` | 1,300 |
| `T-Pose` | 0,000 |
| `Throw` | 1,367 |
| `Use_Item` | 1,600 |

### Rig_Medium_MovementBasic (11 entradas)

Archivo: [Rig_Medium_MovementBasic.glb](../src/assets/library/character-animations/animations/Rig_Medium_MovementBasic.glb).

Caminar y correr; Medium incluye variantes y el salto completo o por fases.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Jump_Full_Long` | 2,333 |
| `Jump_Full_Short` | 1,167 |
| `Jump_Idle` | 1,067 |
| `Jump_Land` | 0,667 |
| `Jump_Start` | 0,600 |
| `Running_A` | 0,800 |
| `Running_B` | 0,800 |
| `T-Pose` | 0,000 |
| `Walking_A` | 1,067 |
| `Walking_B` | 1,067 |
| `Walking_C` | 1,600 |

### Rig_Medium_MovementAdvanced (13 entradas)

Archivo: [Rig_Medium_MovementAdvanced.glb](../src/assets/library/character-animations/animations/Rig_Medium_MovementAdvanced.glb).

Esquivas; Medium incorpora gateo, agacharse, sigilo, marcha atrás, desplazamiento lateral y carrera sosteniendo arco o arma larga.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Crawling` | 1,067 |
| `Crouching` | 1,067 |
| `Dodge_Backward` | 0,400 |
| `Dodge_Forward` | 0,400 |
| `Dodge_Left` | 0,400 |
| `Dodge_Right` | 0,400 |
| `Running_HoldingBow` | 0,800 |
| `Running_HoldingRifle` | 0,800 |
| `Running_Strafe_Left` | 0,800 |
| `Running_Strafe_Right` | 0,800 |
| `Sneaking` | 2,133 |
| `T-Pose` | 0,000 |
| `Walking_Backwards` | 1,067 |

### Rig_Medium_CombatMelee (22 entradas)

Archivo: [Rig_Medium_CombatMelee.glb](../src/assets/library/character-animations/animations/Rig_Medium_CombatMelee.glb).

Ataques y posturas de una mano, dos manos, dos armas, combate sin armas y bloqueo. Las variantes Medium y Large tienen nombres y movimientos propios.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Melee_1H_Attack_Chop` | 1,067 |
| `Melee_1H_Attack_Jump_Chop` | 1,333 |
| `Melee_1H_Attack_Slice_Diagonal` | 1,000 |
| `Melee_1H_Attack_Slice_Horizontal` | 1,367 |
| `Melee_1H_Attack_Stab` | 1,600 |
| `Melee_2H_Attack_Chop` | 1,633 |
| `Melee_2H_Attack_Slice` | 1,100 |
| `Melee_2H_Attack_Spin` | 2,400 |
| `Melee_2H_Attack_Spinning` | 0,667 |
| `Melee_2H_Attack_Stab` | 1,600 |
| `Melee_2H_Idle` | 1,067 |
| `Melee_Block` | 1,067 |
| `Melee_Block_Attack` | 1,067 |
| `Melee_Block_Hit` | 1,067 |
| `Melee_Blocking` | 1,067 |
| `Melee_Dualwield_Attack_Chop` | 1,267 |
| `Melee_Dualwield_Attack_Slice` | 1,167 |
| `Melee_Dualwield_Attack_Stab` | 1,600 |
| `Melee_Unarmed_Attack_Kick` | 0,933 |
| `Melee_Unarmed_Attack_Punch_A` | 1,167 |
| `Melee_Unarmed_Idle` | 1,067 |
| `T-Pose` | 0,000 |

### Rig_Medium_CombatRanged (20 entradas)

Archivo: [Rig_Medium_CombatRanged.glb](../src/assets/library/character-animations/animations/Rig_Medium_CombatRanged.glb).

Apuntar, disparar y recargar a una o dos manos; preparar, tensar y soltar arco; gestos de magia.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Ranged_1H_Aiming` | 1,067 |
| `Ranged_1H_Reload` | 1,167 |
| `Ranged_1H_Shoot` | 1,067 |
| `Ranged_1H_Shooting` | 1,600 |
| `Ranged_2H_Aiming` | 1,600 |
| `Ranged_2H_Reload` | 1,600 |
| `Ranged_2H_Shoot` | 1,067 |
| `Ranged_2H_Shooting` | 1,067 |
| `Ranged_Bow_Aiming_Idle` | 1,833 |
| `Ranged_Bow_Draw` | 1,333 |
| `Ranged_Bow_Draw_Up` | 1,333 |
| `Ranged_Bow_Idle` | 1,567 |
| `Ranged_Bow_Release` | 1,333 |
| `Ranged_Bow_Release_Up` | 1,367 |
| `Ranged_Magic_Raise` | 2,100 |
| `Ranged_Magic_Shoot` | 0,933 |
| `Ranged_Magic_Spellcasting` | 0,667 |
| `Ranged_Magic_Spellcasting_Long` | 2,533 |
| `Ranged_Magic_Summon` | 4,300 |
| `T-Pose` | 0,000 |

### Rig_Medium_Simulation (14 entradas)

Archivo: [Rig_Medium_Simulation.glb](../src/assets/library/character-animations/animations/Rig_Medium_Simulation.glb).

Gestos cotidianos. Medium: celebrar, saludar, sentarse, tumbarse, levantarse y ejercicio. Large: exhibir fuerza (`Flexing`).

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Cheering` | 1,667 |
| `Lie_Down` | 3,000 |
| `Lie_Idle` | 2,667 |
| `Lie_StandUp` | 2,333 |
| `Push_Ups` | 1,033 |
| `Sit_Chair_Down` | 0,800 |
| `Sit_Chair_Idle` | 3,600 |
| `Sit_Chair_StandUp` | 0,800 |
| `Sit_Floor_Down` | 1,000 |
| `Sit_Floor_Idle` | 4,000 |
| `Sit_Floor_StandUp` | 1,133 |
| `Sit_Ups` | 1,733 |
| `T-Pose` | 0,000 |
| `Waving` | 2,133 |

### Rig_Medium_Tools (29 entradas)

Archivo: [Rig_Medium_Tools.glb](../src/assets/library/character-animations/animations/Rig_Medium_Tools.glb).

Trabajo con hacha, pala, martillo, pico y sierra; pesca, ganzúas, sostener objetos y trabajo genérico. Los nombres largos y sus variantes repetidas son clips distintos; el controlador decide el bucle.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Chop` | 4,333 |
| `Chopping` | 1,333 |
| `Dig` | 4,667 |
| `Digging` | 1,400 |
| `Fishing_Bite` | 2,233 |
| `Fishing_Cast` | 1,933 |
| `Fishing_Catch` | 3,233 |
| `Fishing_Idle` | 2,333 |
| `Fishing_Reeling` | 1,600 |
| `Fishing_Struggling` | 3,433 |
| `Fishing_Tug` | 1,900 |
| `Hammer` | 4,333 |
| `Hammering` | 2,667 |
| `Holding_A` | 1,000 |
| `Holding_B` | 1,000 |
| `Holding_C` | 1,000 |
| `Lockpick` | 3,000 |
| `Lockpicking` | 2,333 |
| `Pickaxe` | 6,033 |
| `Pickaxing` | 3,733 |
| `Saw` | 2,400 |
| `Sawing` | 0,667 |
| `T-Pose` | 0,000 |
| `Work_A` | 2,533 |
| `Work_B` | 3,100 |
| `Work_C` | 3,667 |
| `Working_A` | 1,500 |
| `Working_B` | 2,533 |
| `Working_C` | 2,000 |

### Rig_Medium_Special (15 entradas)

Archivo: [Rig_Medium_Special.glb](../src/assets/library/character-animations/animations/Rig_Medium_Special.glb).

Medium: despertar, inactividad, provocación, marcha, muerte y resurrección de esqueletos, además de una transformación experimental. Large: solo transformación experimental y T-Pose.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `EXPERIMENTAL_Medium_Transform` | 1,000 |
| `Skeletons_Awaken_Floor` | 2,300 |
| `Skeletons_Awaken_Floor_Long` | 3,833 |
| `Skeletons_Awaken_Standing` | 1,000 |
| `Skeletons_Death` | 2,000 |
| `Skeletons_Death_Pose` | 0,000 |
| `Skeletons_Death_Resurrect` | 2,700 |
| `Skeletons_Idle` | 4,267 |
| `Skeletons_Inactive_Floor_Pose` | 0,000 |
| `Skeletons_Inactive_Standing_Pose` | 0,000 |
| `Skeletons_Spawn_Ground` | 3,567 |
| `Skeletons_Taunt` | 1,033 |
| `Skeletons_Taunt_Longer` | 3,000 |
| `Skeletons_Walking` | 1,600 |
| `T-Pose` | 0,000 |

<!-- END MEDIUM CLIPS -->

## Biblioteca completa Large

Misma carpeta de biblioteca, con archivos `Rig_Large_*`. **Ninguno está
integrado como acción de un personaje Large en el juego.** No hay bibliotecas
Large de CombatRanged ni Tools en el paquete recibido; tampoco hay clips Large
de salto, asiento, pesca o saludo `Waving` en este inventario. Requieren otro
recurso o trabajo de animación si se necesitan después.

El nombre de esquiva hacia atrás es **`Dodge_Backwards`** en Large y
**`Dodge_Backward`** en Medium. La diferencia forma parte del recurso original.

<!-- BEGIN LARGE CLIPS -->

### Rig_Large_General (6 entradas)

Archivo: [Rig_Large_General.glb](../src/assets/library/character-animations/animations/Rig_Large_General.glb).

Reposo, impactos y muerte; Medium incluye además interacción, recogida, consumo, lanzamiento y aparición.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Death_A` | 1,667 |
| `Death_A_Pose` | 0,000 |
| `Hit_A` | 0,700 |
| `Idle_A` | 1,967 |
| `Idle_B` | 6,000 |
| `T-Pose` | 0,000 |

### Rig_Large_MovementBasic (3 entradas)

Archivo: [Rig_Large_MovementBasic.glb](../src/assets/library/character-animations/animations/Rig_Large_MovementBasic.glb).

Caminar y correr; Medium incluye variantes y el salto completo o por fases.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Running_A` | 1,067 |
| `T-Pose` | 0,000 |
| `Walking_A` | 1,067 |

### Rig_Large_MovementAdvanced (5 entradas)

Archivo: [Rig_Large_MovementAdvanced.glb](../src/assets/library/character-animations/animations/Rig_Large_MovementAdvanced.glb).

Esquivas; Medium incorpora gateo, agacharse, sigilo, marcha atrás, desplazamiento lateral y carrera sosteniendo arco o arma larga.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Dodge_Backwards` | 0,333 |
| `Dodge_Forward` | 0,333 |
| `Dodge_Left` | 0,333 |
| `Dodge_Right` | 0,333 |
| `T-Pose` | 0,000 |

### Rig_Large_CombatMelee (16 entradas)

Archivo: [Rig_Large_CombatMelee.glb](../src/assets/library/character-animations/animations/Rig_Large_CombatMelee.glb).

Ataques y posturas de una mano, dos manos, dos armas, combate sin armas y bloqueo. Las variantes Medium y Large tienen nombres y movimientos propios.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Melee_1H_Slash` | 1,567 |
| `Melee_1H_Stab` | 1,400 |
| `Melee_2H_Attack` | 1,333 |
| `Melee_2H_Idle` | 1,567 |
| `Melee_2H_Slam` | 2,833 |
| `Melee_Block` | 1,067 |
| `Melee_Block_Attack` | 1,033 |
| `Melee_Block_Hit` | 0,667 |
| `Melee_Blocking` | 1,067 |
| `Melee_Dualwield_Slash` | 1,033 |
| `Melee_Dualwield_SlashCombo` | 1,600 |
| `Melee_Unarmed_Idle` | 1,067 |
| `Melee_Unarmed_Kick` | 1,700 |
| `Melee_Unarmed_Punch` | 1,233 |
| `Melee_Unarmed_Smash` | 3,467 |
| `T-Pose` | 0,000 |

### Rig_Large_Simulation (2 entradas)

Archivo: [Rig_Large_Simulation.glb](../src/assets/library/character-animations/animations/Rig_Large_Simulation.glb).

Gestos cotidianos. Medium: celebrar, saludar, sentarse, tumbarse, levantarse y ejercicio. Large: exhibir fuerza (`Flexing`).

| Clip exacto | Duración original (s) |
| --- | ---: |
| `Flexing` | 4,300 |
| `T-Pose` | 0,000 |

### Rig_Large_Special (2 entradas)

Archivo: [Rig_Large_Special.glb](../src/assets/library/character-animations/animations/Rig_Large_Special.glb).

Medium: despertar, inactividad, provocación, marcha, muerte y resurrección de esqueletos, además de una transformación experimental. Large: solo transformación experimental y T-Pose.

| Clip exacto | Duración original (s) |
| --- | ---: |
| `EXPERIMENTAL_Large_Transform` | 1,667 |
| `T-Pose` | 0,000 |

<!-- END LARGE CLIPS -->

## Otros recursos animados

El catálogo importado incluye tres objetos de Kenney Hexagon Kit, sin skin,
cada uno con un clip llamado `animation`:

<!-- BEGIN OBJECT CLIPS -->

| Recurso (ruta relativa a `src/assets/library/`) | Clip | Duración original (s) |
| --- | --- | ---: |
| [kenney-hexagon/objects/building-mill.glb](../src/assets/library/kenney-hexagon/objects/building-mill.glb) | `animation` | 1,000 |
| [kenney-hexagon/objects/building-watermill.glb](../src/assets/library/kenney-hexagon/objects/building-watermill.glb) | `animation` | 1,000 |
| [kenney-hexagon/objects/unit-mill.glb](../src/assets/library/kenney-hexagon/objects/unit-mill.glb) | `animation` | 1,000 |

<!-- END OBJECT CLIPS -->

Sus canales animan piezas del propio objeto, no huesos de personajes. Se
inspeccionan en `/assets.html` filtrando por Kenney. No se han detectado otros
GLB con clips en los modelos de producción ni en los catálogos de arte original
de Brumaluz comprobados en esta revisión.

Los parpadeos, boca, orejas, cola, respiración y mezclas de nado de `Character`
son movimientos programados. Las criaturas de
[forestEnemy.ts](../src/world/forestEnemy.ts) y
[shadowEnemy.ts](../src/world/shadowEnemy.ts) también tienen movimiento propio.
Estos comportamientos no son clips KayKit transferibles a otro rig; hay que
reutilizar su controlador o preparar animaciones nuevas.

## Referencias para implementaciones futuras

Esta tabla sirve para encontrar recursos; **no es una hoja de ruta aprobada**.
Elegir una animación no habilita el sistema correspondiente.

| Necesidad | Recursos que ya existen | Trabajo pendiente para usarlos |
| --- | --- | --- |
| Vida cotidiana y saludo con la mano | Medium Simulation: `Waving`, `Cheering`, asientos, tumbarse y levantarse | Elegir cuándo reproducirlos; preparar transiciones, altura y espacio libre |
| Tala, minería, carpintería y herrería | Medium Tools: `Chop/Chopping`, `Pickaxe/Pickaxing`, `Saw/Sawing`, `Hammer/Hammering`, `Work_*`, `Working_*` | Seleccionar gesto y ciclo, ajustar herramienta, anclaje, estación e interrupción; hoy minería y tala usan variantes de combate |
| Pesca | Medium Tools: las siete fases `Fishing_*` | Diseñar y conectar las fases, caña, sedal y lógica de pesca; disponer de clips no acredita un sistema implementado |
| Transportar o manipular objetos | `Holding_A/B/C`, `PickUp`, `Throw`, `Use_Item` | Revisar qué sostiene cada mano, montar el objeto y conectar con la acción validada |
| Agacharse, sigilo, esquivas y desplazamiento lateral | Medium MovementAdvanced | Integrar desplazamiento y colisiones; no deducir invulnerabilidad o sigilo de un gesto |
| Armas de dos manos, arco y otras poses a distancia | Medium CombatMelee y CombatRanged | Revisar arma y manos, asignar acciones y respetar las ramas aprobadas en LORE |
| Entrada en escena, muerte alternativa y poses | Medium General: `Spawn_*`, `Death_B`, `Death_*_Pose` | Elegir uso narrativo y transición sin cambiar las reglas de muerte |
| Personajes esqueleto | Cuatro modelos Medium y clips `Skeletons_*` de Special | Revisar apariencia y asignar controlador; su disponibilidad no aprueba nuevos enemigos |
| Personajes grandes | Maniquí Large y sus seis bibliotecas | Crear o seleccionar personaje y vestuario Large, conectar su controlador y revisar colisiones, escala, cámara y combate |
| Transformaciones | `EXPERIMENTAL_Medium_Transform`, `EXPERIMENTAL_Large_Transform` | Revisar visualmente el recurso experimental y su aplicación; no asumir intercambio automático entre los dos rigs |

## Inspección y contrato de implementación

1. Ejecutar `npm run dev` y abrir **`/assets.html`**. Elegir Character Animations
   y `Mannequin_Medium` o `Mannequin_Large`; el selector ofrece respectivamente
   139 o 34 entradas. También se pueden abrir las bibliotecas directamente y
   los seis Adventurers o cuatro Skeletons con la biblioteca Medium completa.
2. Para comprobar un NPC con cara y ropa reales, abrir **`/npcs.html`**: ofrece
   los 139 clips Medium agrupados por biblioteca. Elegir un clip solo cambia la
   previsualización; guardar su ficha no asigna una rutina ni un comportamiento.
   **`/wardrobe.html`** prueba la selección integrada de producción y sus prendas.
3. Identificar el recurso por `pack/kind/nombre` y el nombre exacto del clip:
   por ejemplo, `character-animations/animations/Rig_Medium_Tools` + `Hammering`.
   `loadLibraryAsset(id)` devuelve `{ asset, url, gltf }` y `gltf.animations`
   permite localizarlo por nombre. No depender del índice del selector.
4. Usar `SkeletonUtils.clone` para instanciar personajes animados. Para un clip
   externo sobre `Character`, `playClip(clip)` comprueba los nombres de destino
   y lo reproduce una vez; no valida por sí solo todas las matrices de reposo,
   ni registra una rutina persistente. Para ciclos hace falta conectar la acción
   y su salida al controlador correspondiente.
5. Si el juego necesita otro clip, preparar una selección de producción como
   `ambient-animations.glb` o justificar la carga de su biblioteca. Los archivos
   originales de animación también contienen mallas y texturas; importar solo
   una URL al bundle no elimina los datos que no se usan. Conservar los originales
   y trabajar en copias al personalizar.
6. Decidir reproducción única, ciclo o pose; transiciones; prioridades ante
   caminar, salto, combate, muerte y cambio de mapa; velocidad, manos y equipo.
   La duración visual no concede daño, objetos, energía ni progreso: esas acciones
   siguen las validaciones de sus sistemas.
7. Comprobar el resultado **en el editor aplicable y en el juego real**, con
   los cuerpos y prendas que vayan a usarlo. Actualizar este inventario y la
   documentación del sistema al integrar una selección nueva.

## Mantenimiento y comprobación

`catalog.json` conserva nombres, familia, ruta de origen y hash de los GLB de
biblioteca; `sources.json` inventaría los archivos originales. Al cambiar un
paquete, contrastar las tablas con `animations[].name`, los tiempos de sus
samplers y los joints de cada GLB, además de revisar las asignaciones del código.
Las tablas de duración son una instantánea de esta revisión.

Las comprobaciones existentes de rigs pueden ejecutarse sin regenerar assets:

```powershell
node --test --test-name-pattern 'all 260 character/clip|full Medium and Large' scripts/test-assets.mjs
```

Comprueban 260 combinaciones de las bibliotecas incluidas en Adventurers y
Skeletons, y 1.563 combinaciones de personajes con las bibliotecas completas,
incluida la excepción de los dos anclajes del maniquí Medium. El visor dispone
de su comprobación visual existente `npm run assets:check:browser`.
En esta revisión también se han contrastado los nombres y duraciones de todas
las tablas con sus GLB, los enlaces locales y los destinos y matrices de reposo
de los 139 clips Medium contra el personaje de producción de 41 huesos.
La reproducción de la importación y los demás controles están en
[ASSET-LIBRARY.md](ASSET-LIBRARY.md).

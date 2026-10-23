# Trajes modulares de clase

55 conjuntos, cinco clases por once colecciones, divididos en **220 piezas equipables**: cabeza, pecho, manos y piernas. Piernas incluye también las botas: pantalón y calzado se equipan juntos. Los GLB independientes están en `src/assets/models/wardrobe/classes/modular/`; los archivos completos de `classes/` son patrones de montaje. Comparten el esqueleto de KayKit Adventurers.

## Colecciones

| Colección | Rareza | Conjuntos |
| --- | --- | --- |
| Principiante | 0 gris | 5 |
| Caminante / artesano | 1 verde | 5 |
| Ámbar | 2 azul | 5 |
| Sello Violeta | 3 morado | 5 |
| Aurora | 4 dorado | 5 |
| Fuego Primigenio | 5 naranja | 5 |
| Guardia del Alba | 2 azul | 5 |
| Eclipse | 3 morado | 5 |
| Roble Errante | 1 verde | 5 |
| Marea Real | 4 dorado | 5 |
| Forja Estelar | 5 naranja | 5 |

El patronaje vigente usa petos curvos, hombreras arqueadas, túnicas con paños articulados, cuellos doblados, capuchas y sombreros proporcionados al cráneo completo. Las texturas tienen UV por panel, sombras, pliegues, costuras y mapas de normales, oclusión y rugosidad. Los materiales y el detalle aumentan gradualmente por rareza. Véase [dirección artística y límites del ajuste](EQUIPMENT-ART-DIRECTION.md).

## Equipo y equilibrio

Cada pieza ocupa su ranura y sustituye su región del cuerpo. Las ranuras vacías usan ropa básica completa, con manos del color de piel del personaje. Las piezas se venden por separado en Testículos, son comerciables, no apilables y limitadas a su clase. La ropa inicial continúa siendo una túnica medieval de colores personalizables.

Guardia total: categoría + 2 para guerrero, categoría para mago, categoría + 1 para las otras clases. Se reparte entre pecho, manos y piernas: pecho recibe `ceil(total/2)`, manos `ceil(resto/2)` y piernas el resto. Cabeza añade `2+2×categoría` de vida máxima; piernas, el mismo recurso máximo que antes aportaban las botas. Se suma la guardia del arma secundaria, con mínimo de 1 de daño recibido. Los bonos de 2/4 y 4/4 están acordados como diseño, pendientes de definir e implementar sus efectos.

Valor base por categoría 0–5: 90, 180, 360, 720, 2160 y 6480 pelines. Pecho cuesta 50 %, manos 15 % y piernas suma los precios anteriores de calzas (20 %) y botas (15 %), con sus redondeos originales. Cabeza cuesta un 15 % adicional. El vendedor paga la mitad.

## Fuentes y mantenimiento

- Catálogo: `src/data/outfits.json` y `outfits.ts`.
- Geometría, UV y rig: `tools/garment-studio.mjs`.
- Corte y tocados: `tools/tailored-outfit-pattern.mjs`, `tailored-headwear.mjs`.
- Fuente de tocados en Blender: `art/equipment/brumaluz-headwear.blend`; generador `tools/blender/model-equipment-headwear.py`. Treinta prototipos con jaulas, UV y modificadores editables, aplicados a las 55 variantes.
- Atlas PNG editables: `classes/textures/`; generador: `tools/outfit-textures.mjs`.
- Montaje y ajuste al personaje: `src/character/wardrobe.ts`, `equipmentFit.ts`.
- Túnica básica compatible: `tools/build-base-tunic.mjs`.
- Retratos de los GLB: `tools/build-weapon-icons.mjs`, con el marco y luz compartidos de las armas.
- Visores: `equipment.html` para mezclar piezas, linajes y animaciones; `combat.html` para conjuntos completos.
- Revisión: `equipment_tailoring_closeup.png`, `equipment_rarity_progression.png`, `equipment_fit_review.png`, `equipment_pose_review.png`, `modular_equipment.png`.
- Exportación: `class_outfits_glb.zip`, actualizado con `tools/package-equipment.ps1`.

`npm run art:headwear:source` reconstruye la fuente Blender y la caché de geometría de los tocados. `npm run art:outfits` reconstruye modelos, piezas, accesorios, retratos y catálogo usando esa caché. Los GLB son importables en Blender. El [estudio de referencias](EQUIPMENT-REFERENCE-STUDY.md) explica las decisiones y el proceso de edición. Mantener todos los objetos existentes al añadir colecciones. Los IDs de los trajes originales siguen siendo pecheras.

# Trajes modulares de clase

55 conjuntos, cinco clases por once colecciones, divididos en **275 piezas equipables**: cabeza, pecho, manos, piernas y pies. Los GLB independientes están en `src/assets/models/wardrobe/classes/modular/`; los archivos completos de `classes/` son patrones de montaje. Comparten el esqueleto de KayKit Adventurers.

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

Guardia total: categoría + 2 para guerrero, categoría para mago, categoría + 1 para las otras clases. Se reparte entre pecho, manos y piernas: pecho recibe `ceil(total/2)`, manos `ceil(resto/2)` y piernas el resto. Cabeza añade `2+2×categoría` de vida máxima; botas, el mismo recurso máximo. Se suma la guardia del arma secundaria, con mínimo de 1 de daño recibido. No hay efectos de conjunto implícitos.

Valor base de las cuatro piezas originales por categoría 0–5: 90, 180, 360, 720, 2160 y 6480 pelines. Reparto: 50 % pecho, 15 % manos, 20 % piernas, 15 % pies. La cabeza cuesta un 15 % adicional. El vendedor paga la mitad. Esta pasada visual conserva estas estadísticas.

## Fuentes y mantenimiento

- Catálogo: `src/data/outfits.json` y `outfits.ts`.
- Geometría, UV y rig: `tools/garment-studio.mjs`.
- Corte y tocados: `tools/tailored-outfit-pattern.mjs`, `tailored-headwear.mjs`.
- Atlas PNG editables: `classes/textures/`; generador: `tools/outfit-textures.mjs`.
- Montaje y ajuste al personaje: `src/character/wardrobe.ts`, `equipmentFit.ts`.
- Túnica básica compatible: `tools/build-base-tunic.mjs`.
- Retratos de los GLB: `tools/build-weapon-icons.mjs`, con el marco y luz compartidos de las armas.
- Visores: `equipment.html` para mezclar piezas, linajes y animaciones; `combat.html` para conjuntos completos.
- Revisión: `equipment_tailoring_closeup.png`, `equipment_rarity_progression.png`, `equipment_fit_review.png`, `equipment_pose_review.png`, `modular_equipment.png`.
- Exportación: `class_outfits_glb.zip`, actualizado con `tools/package-equipment.ps1`.

`npm run art:outfits` reconstruye modelos, piezas, accesorios, retratos y catálogo. Los GLB son importables en Blender; los generadores son su fuente editable. Mantener todos los objetos existentes al añadir colecciones. Los IDs de los trajes originales siguen siendo pecheras.

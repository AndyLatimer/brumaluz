# Dirección artística y ajuste del equipo

## Patronaje de prendas: versión 3; tocados: versión 4

La pasada de tocados se apoya en el [estudio de referencias](EQUIPMENT-REFERENCE-STUDY.md). La fuente editable está en `art/equipment/brumaluz-headwear.blend`: jaulas de cuadriláteros, bordes cerrados con grosor y modificadores conservados. Sus 30 prototipos se aplican a las 55 combinaciones de clase y colección.

55 conjuntos de cinco clases, 220 piezas independientes: cabeza, pecho, manos y piernas. Piernas incluye el calzado. Sus estadísticas y precio suman los de las dos piezas anteriores; la conversión se documenta en [equipo modular](MODULAR-EQUIPMENT.md). Las referencias geométricas son los personajes de KayKit Adventurers que ya contiene el proyecto: sus mangas, manos, piernas, botas y esqueleto. El torso, los faldones, petos, cuellos y tocados se modelan con contornos específicos.

| Clase | Corte |
| --- | --- |
| Guerrero | Gambesón, peto convexo que envuelve las costillas, hombreras arqueadas y casco abierto con borde enrollado |
| Mago | Túnica entallada con faldones, cuello doblado, botones y sombrero de ala ancha con punta inclinada |
| Pícaro | Jubón de cintura más estrecha, pañuelo asimétrico de tela y capucha profunda con marco vuelto |
| Clérigo | Vestidura con estola cosida a sus paños y cofia o mitra según rareza |
| Explorador | Chaleco entallado con solapas, bolsillo cosido y gorro alargado de ala vuelta |

Los detalles deben tener una función y apoyarse en la prenda. Evitar distribuir cristales, esferas, placas o bolsas para simular riqueza. La heráldica ocupa el lado izquierdo del pecho para dejar libre el espacio central del colgante.

## Progresión

| Rareza | Acabado |
| --- | --- |
| Gris | Tela, cuero, costuras y cierres sencillos |
| Verde | Ribete y refuerzo discretos |
| Azul | Peto y rodilleras del guerrero, herrajes y materiales mejor acabados |
| Morado | Bordado y pequeño emblema de colección |
| Dorado | Bordes metálicos, pasamanería y acabado del emblema |
| Naranja | Acabado superior y un engaste principal en la prenda |

La complejidad depende de `tier`, con variantes de colección del mismo escalón comparables. La ropa inicial sigue siendo la túnica medieval personalizable.

## Geometría y texturas

- `tools/garment-studio.mjs`: superficies curvas, UV por panel, transferencia de pesos del modelo original, recorte preciso de triángulos en uniones y exportación GLB.
- `tools/tailored-outfit-pattern.mjs`: siluetas por clase, paños de faldón, cuellos, refuerzos y piezas modulares explícitas.
- `tools/blender/model-equipment-headwear.py`: modelado reproducible en Blender, fuente editable y caché comprimida con normales y UV.
- `tools/tailored-headwear.mjs`: importa esa geometría y aplica los materiales, atlas y pesos de cada colección.
- `tools/outfit-textures.mjs`: atlas de color de 512 px, normales de 256 px y mapa de oclusión/rugosidad/metal de 128 px. Las 16 zonas UV distinguen cuerpo, espalda, faldón, mangas, cuello, cinturón, armadura, sombrero, pantalón, botas y emblema.

El color base se multiplica por el tinte de colección del material. Los atlas incluyen sombras de costura, pliegues amplios, pespuntes, tejido, acolchado, cuero y reflejos pintados de metal. No son ruido genérico repetido en proyección plana. Los tres mapas están incrustados en cada GLB independiente. En el juego se comparten las texturas idénticas entre las cinco clases para evitar multiplicar su memoria.

## Ajuste y movimiento

Los faldones están divididos en paños izquierdo y derecho con aberturas centrales y pesos progresivos hacia cada muslo. La cintura enlaza con la cadera; el pecho pasa gradualmente a columna y tórax. La animación no empuja vértices cada fotograma: se ha eliminado la corrección antigua que podía producir picos y roturas al combinar ropa básica y equipo.

Pantalones y botas se cortan exactamente en la misma altura, conservando los pesos interpolados del original. Mangas y manos también parten de la anatomía original. Las piezas se pueden combinar entre colecciones sin cambiar estas uniones.

`src/character/equipmentFit.ts` adapta el tocado al contorno del cráneo seleccionado. La versión 4 transfiere la diferencia de forma sin colapsar capas al mismo radio: conserva ala, copa, grosor y forro. Recoge el pelo que invade la parte cubierta. Los accesorios se proyectan sobre todas las superficies de la prenda equipada, incluyendo peto, cuello y cinturón; también reciben sus pesos interpolados. Un GLB con varios materiales se trata como un grupo completo.

Esto es ajuste de mallas animadas; no es una simulación física de tela. Las poses extremas y las futuras prendas o animaciones necesitan revisión visual propia.

## Fuentes y revisión visual

- `equipment_tailoring_closeup.png`: frente y espalda de las cinco clases, con accesorios.
- `equipment_rarity_progression.png`: de gris a naranja.
- `equipment_fit_review.png`: cuatro linajes, extremos de altura/corpulencia, reposo, caminar, correr, habilidad y espalda.
- `equipment_pose_review.png`: las cinco clases en reposo, caminar, correr y habilidad.
- `modular_equipment.png`: conjuntos completos, colecciones mezcladas y piezas con ropa básica.
- `equipment.html`: rotación, ocho ranuras independientes, linajes, reposo, caminar, correr y habilidad.

Los GLB exportados contienen el patrón neutro y los mapas. La adaptación específica de cráneo y el asiento de accesorios se realiza al equiparlos en el juego. La versión anterior de los generadores queda en `.art-sources/tailoring-v3/`.

Regeneración de fuentes Blender: `npm run art:headwear:source` (opcional `BLENDER_PATH`). Regeneración de GLB: `npm run art:outfits`. Si cambian objetos o estadísticas, actualizar también el SQL del catálogo. Para esta pasada de arte no hace falta migrar inventarios ni cambiar estadísticas.

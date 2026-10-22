# Trajes modulares de clase

50 conjuntos, cinco clases por diez colecciones, desglosados en **250 piezas equipables**: cabeza, pecho, manos, piernas y pies. Los GLB independientes están en `classes/modular/`. Los archivos completos se conservan como fuentes de patronaje. Las piezas comparten el esqueleto de Adventurers y pueden combinarse dentro de cada clase. Véase [equipo modular y accesorios](MODULAR-EQUIPMENT.md).

## Colecciones

| Colección de armas | Categoría | Trajes |
| --- | --- | --- |
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

El guerrero lleva coraza, hombreras y faldones articulados; el mago, una túnica larga con solapas y foco; el pícaro, chaqueta corta con bandolera; el clérigo, vestidura larga con estola; el explorador, chaleco, cartuchera y bolsas. Cada colección añade geometría propia: engastes de ámbar, sellos, rayos, puntas de llama, plumas, mantos lunares, hojas, conchas o placas mecánicas. Cabeza tiene su propia pieza opcional: casco abierto, sombrero, gorro, diadema o caperuza corta, con ajuste del pelo.

## Equipo y equilibrio inicial

Cada pieza ocupa su ranura y solo sustituye su región del cuerpo. Una ranura vacía muestra ropa básica completa, con las manos de la piel del personaje. Las piezas se venden por separado en Testículos, son comerciables, no apilables y limitadas a su clase. Los nuevos personajes conservan su ropa básica.

Guardia total del conjunto: categoría + 2 para guerrero, categoría para mago, categoría + 1 para las otras clases. Se reparte entre pecho, manos y piernas, conservando el total anterior. La cabeza añade vida máxima y las botas añaden recurso máximo. Se suma la guardia del arma secundaria, con un mínimo de 1 de daño recibido. Cliente y servidor usan los mismos valores. Es un primer equilibrio revisable; no hay efectos de conjunto ni habilidades nuevas.

Valor de las cuatro piezas originales juntas por categoría: 180, 360, 720, 2160 y 6480 pelines. Se distribuye 50 % pecho, 15 % manos, 20 % piernas y 15 % pies. La cabeza cuesta un 15 % adicional. El vendedor paga la mitad.

## Archivos y mantenimiento

### Pasada de calidad: construcción y texturas

Los 50 trajes incluyen ahora una base pélvica y pantalones completos: la parte superior de las piernas originales del mago no llegaba a cubrir los bajos de las chaquetas cortas. Se sustituyen las calzas superiores y se conservan sus botas inferiores. Pantalones, rodilleras y detalles de mangas tienen pesos de huesos propios; la coraza, los cierres y los bordados siguen la ropa. Los bajos y cuellos se cierran geométricamente.

Se añaden rodilleras, correas de bota, brazales, remaches, forros, bajos cosidos, detalles traseros y mochila del explorador. Las costuras se ajustan al contorno del tejido para evitar líneas que desaparecen dentro de la superficie. Las proporciones y motivos de cada colección se mantienen.

Texturas PNG de 256 px: trama de tejido, cuero cosido, metal cepillado y bordados por colección. Son patrones suaves de bajo contraste para conservar el aspecto facetado y la lectura a distancia. UV explícitas y texturas incrustadas en cada GLB; los PNG editables están en `classes/textures/`. Los materiales conservan los colores de colección. La conversión modular conserva los IDs anteriores como pecheras y reparte sus estadísticas y precios entre las piezas.

Las versiones anteriores están en `.art-sources/outfit-quality-pass/before/`. `tools/outfit-finishing.mjs` contiene los detalles de construcción y `tools/outfit-textures.mjs` genera los tejidos. `class_outfit_details.png` muestra ejemplos de frente, espalda y andando; `class_outfits.png` contiene los 50 conjuntos.

- Catálogo: `src/data/outfits.json` y `outfits.ts`.
- GLB: `src/assets/models/wardrobe/classes/`.
- Generador: `tools/build-class-outfits.mjs`, basado en las utilidades de patronaje medieval.
- Iconos: retratos del propio GLB con la misma dirección artística que las armas; generación incremental en `tools/build-weapon-icons.mjs`.
- Visores: `equipment.html` permite combinar cada pieza y accesorio; `combat.html` equipa conjuntos completos.
- Arte: `class_outfits.png`; paquete: `class_outfits_glb.zip`.

Ejecutar `npm run art:outfits` para reconstruir modelos, iconos y catálogo SQL. Los GLB están listos para importar en Blender; el generador es la fuente editable y reproducible. Las piezas se agrupan por material para limitar las llamadas de dibujo. El catálogo general de armas conserva sus 88 modelos.

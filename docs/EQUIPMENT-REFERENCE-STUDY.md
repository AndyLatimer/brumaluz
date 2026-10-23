# Referencias y decisiones de modelado

Estudio del 23 de octubre de 2026. Se aplica a los tocados y al patronaje de las cinco clases. Los objetos, ranuras y estadísticas conservan sus identificadores.

## Referencias consultadas

- [KayKit Adventurers, página del autor](https://kaylousberg.itch.io/kaykit-adventurers). Referencia principal porque ya usamos sus personajes y animaciones. Se han observado el mago, el caballero y el pícaro encapuchado, tanto en las imágenes del autor como en los GLB que contiene el proyecto. El autor explica el uso de un atlas de gradientes; el detalle visible no depende de añadir ruido ni adornos pequeños.
- [Personajes de Kay Lousberg, serie 1](https://kaylousberg.com/patreon-characters/series-1). El explorador sirve para estudiar la inclinación del gorro, la banda ancha, el cuello doblado y la distribución de masas.
- [Quaternius, Modular Character Outfits — Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html). Referencia de organización: piezas separadas, ropa sobre una anatomía común y compatibilidad con un mismo esqueleto humanoide. Sus proporciones son distintas a las de Brumaluz; no se trasladan directamente.

Las referencias sirven para estudiar proporción, construcción y lectura visual. Los nuevos tocados se construyen con sus propias jaulas de malla en Blender. No se han comprado ni descargado archivos de pago.

## Diagnóstico

Los gorros anteriores rodeaban una esfera casi sin volumen adicional. El explorador tenía además un perfil que bajaba en altura al final, incompatible con el interpolador usado. El resultado perdía la copa. Las tiras del cuello y las placas tenían poca relación con el corte de la prenda.

La adaptación de sombreros también podía colapsar dos capas sobre el mismo radio mínimo. Eso borraba el grosor y producía interferencias entre el borde y la tela.

## Vocabulario de formas

| Clase | Tocado | Prenda |
| --- | --- | --- |
| Guerrero | Casco abierto, nuca ensanchada, borde enrollado; visera frontal y quilla a partir del azul | Pecho más ancho, peto con escote rebajado y borde inferior curvo |
| Mago | Ala gruesa y ondulada, copa curvada con punta caída, banda ancha y hebilla hueca | Cuello de chal continuo y amplio, faldones y botones |
| Pícaro | Capucha profunda, abertura ancha arriba, marco vuelto y forro oscuro | Cintura más estrecha y pañuelo de tela asimétrico |
| Clérigo | Cofia blanda en gris/verde; mitra de dos hojas con valle central estrecho en azul o superior | Manto de hombros redondeado bajo las estolas |
| Explorador | Gorro de bosque alargado, ala vuelta y una pluma desde verde | Chaleco entallado abierto, solapas dobladas y un bolsillo funcional |

La calidad de la forma debe existir desde gris. La rareza añade materiales, ribetes, costuras y un detalle focal; no una acumulación de objetos. La tela conserva pliegues amplios, el cuero bordes suaves y el metal reflejos más mates que en la versión anterior.

## Fuente editable y exportación

- `art/equipment/brumaluz-headwear.blend`: 30 prototipos, cinco clases por seis rarezas, organizados en colecciones. Las jaulas y los modificadores Subdivision, Solidify y Bevel permanecen editables. Las filas corresponden a rarezas y las columnas a clases.
- `tools/blender/model-equipment-headwear.py`: construcción reproducible de la fuente y extracción de posiciones, normales por esquina y UV de las mallas evaluadas.
- `art/equipment/headwear.meshes.json.gz`: caché comprimida, en coordenadas de reposo del juego. Permite reconstruir GLB sin tener Blender instalado. No se carga en el navegador.
- `tools/tailored-headwear.mjs`: aplica los materiales y atlas de cada colección y asigna los pesos al hueso de la cabeza.
- `fitVersion: 4`: transfiere la diferencia entre el cráneo de referencia y el seleccionado, conservando las separaciones entre capas.

Para reconstruir la fuente: `npm run art:headwear:source`. Se puede definir `BLENDER_PATH` si el ejecutable está en otra ubicación. Después: `npm run art:outfits`. Las láminas se regeneran con `npm run art:outfits:review`.

Para iterar una sola clase se pueden ejecutar `node tools/build-class-outfits.mjs --class=clerigo` y `node tools/build-modular-armor.mjs --class=clerigo`. Ambos admiten también `--only=ambar` para limitar la colección; el catálogo completo se conserva.

Si se edita directamente el `.blend`, los cambios deben trasladarse al generador o exportarse de nuevo a la caché antes de regenerar los GLB. Ejecutar el generador sustituye la fuente por su construcción reproducible.

## Revisión visual

Se revisan primero prototipos equipados en personajes reales, de frente y de espalda. Después se generan láminas de rarezas, linajes, movimiento y combinaciones modulares. Estas capturas permiten juzgar el aspecto y detectar penetraciones visibles; no garantizan ausencia de intersecciones en todas las combinaciones posibles. No hay simulación física de tela.

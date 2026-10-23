# Equipo por piezas y accesorios

> Patronaje actual: versión 3, con atlas de color, normales y superficie, tocados alrededor del cráneo completo y faldones articulados por paños. Véase [dirección artística vigente](EQUIPMENT-ART-DIRECTION.md) para los encajes y límites del ajuste durante animaciones.

## Catálogo

- 88 armas existentes.
- 220 piezas de armadura: 55 conjuntos × cabeza, pecho, manos y piernas. Piernas incluye el calzado.
- 33 accesorios universales: 11 colgantes, 11 anillos, 11 abalorios.
- 341 objetos equipables en total. Se conservan los IDs anteriores como pecheras.

Las once colecciones mantienen sus colores y símbolos: Principiante, Caminante, Ámbar, Sello Violeta, Aurora, Fuego Primigenio, Alba, Eclipse, Roble, Marea y Forja. Los accesorios son pequeños objetos físicos con cadenas, engastes, aros y emblemas propios; se sujetan al pecho, mano izquierda o cinturón y siguen los huesos correspondientes. Sus iconos usan los modelos reales y el marco compartido del juego.

## Ranuras y aspecto

| Ranura | Piezas visibles | Restricción |
| --- | --- | --- |
| Cabeza | Casco abierto, sombrero, gorro o diadema | Clase |
| Pecho | Torso, mangas superiores, faldón y adorno de espalda | Clase |
| Manos | Guantes y brazales inferiores | Clase |
| Piernas | Forro pélvico, pantalones, rodilleras, botas y cierres, en un único objeto | Clase |
| Colgante | Cadena, medallón y engaste | Todas las clases |
| Anillo | Aro y engaste en la mano | Todas las clases |
| Abalorio | Talismán colgado del cinturón | Todas las clases |

Las piezas pueden mezclarse entre colecciones dentro de su clase. Al retirar una pieza vuelve la ropa básica de esa región. Los pantalones y forros de respaldo cubren también los trajes cortos; equipar una pechera no equipa ni oculta otra ranura. Los faldones largos cubren parte de los pantalones como ropa real. Los accesorios no sustituyen armadura.

## Estadísticas

La guardia del conjunto anterior se distribuye entre pecho, guantes y piernas: pecho recibe `ceil(total/2)`, guantes `ceil(resto/2)` y piernas el resto. La cabeza añade `2+2×categoría` de vida máxima y piernas el mismo valor de recurso máximo que antes aportaban las botas. El precio de piernas suma los dos precios anteriores.

- Colgante: `4+2×categoría` de vida máxima.
- Anillo: `3+2×categoría` de maná o estamina máxima según clase.
- Abalorio: `2×categoría` de vida máxima y recurso máximo.

Los accesorios grises de principiante tienen valores propios: colgante +2 de vida
máxima, anillo +2 de recurso máximo y abalorio +2 de ambos. Sus precios son 20,
15 y 25 pelines, respectivamente; no usan las fórmulas de los escalones superiores.

Los valores se validan por ranura, cantidad y clase en cliente y servidor. Los bonos de equipo se suman después del bonus de grupo y comida. Se aplican a curación, regeneración, consumibles y límites de sobrecuración mediante los máximos compartidos. Cambiar equipo conserva la vida/recurso actual y los limita al nuevo máximo, evitando rellenarlos al reequipar. No hay efectos aleatorios ni bonos de conjunto implícitos; el equilibrio inicial es revisable.

## Conversión de los objetos antiguos

### Versión 2: piernas y calzado juntos

`17-combined-legwear.sql` guarda instantáneas y convierte cada objeto `_feet` en el `_legs` de su clase y colección. Las calzas existentes pasan a incluir las botas; las antiguas botas también se convierten en una pieza completa como compensación, sin eliminar objetos adquiridos. Si ambas estaban equipadas, se conservan las piernas y la bota convertida va a mochila, banco o cola de entrega. Si solo había botas, la pieza completa ocupa piernas. Se conserva vínculo y cantidad, se convierten banco y entregas pendientes y se invalidan los comercios abiertos. La migración es idempotente y no rellena el recurso actual.

La nueva creación de personajes usa `modularEquipmentVersion: 2`. El SQL debe aplicarse antes de distribuir el cliente que elimina la ranura de pies. Los archivos `_feet.glb` y sus iconos se retiran al reconstruir las exportaciones. Los GLB `_legs` contienen los siete nodos de pantalones y calzado.

### Conversión histórica desde trajes completos

`16-modular-equipment.sql` conserva copias de los datos anteriores y un registro de ejecución por personaje/cuenta. Por cada conjunto antiguo entrega manos, piernas y pies; la cabeza es una pieza nueva. Si estaba equipado, coloca sus piezas en las ranuras vacías; el resto va a huecos de mochila y después al banco. No sobrescribe objetos. Solo amplía el banco si es necesario para estas entregas, hasta su límite existente de 500. Cualquier exceso permanece en una cola privada y se entrega al abrir el banco cuando haya espacio. Reaplicar SQL no repite los regalos. Los personajes y bancos creados bajo el sistema nuevo quedan marcados como modulares.

Las copias de datos están en `equipment_modular_migrations`; los modelos completos previos están archivados en `.art-sources/modular-equipment/previous_full_outfits.zip`.

## Fuentes y generación

- `src/data/outfits.json`: patrones originales; `outfits.ts`: piezas, precios y reparto de guardia.
- `src/data/accessories.json`: accesorios y reservas máximas.
- `tools/build-modular-armor.mjs`: partición de mallas y exportación de GLB individuales.
- `tools/build-accessories.mjs` y `tailored-accessories.mjs`: joyería y heráldica.
- `tools/build-weapon-icons.mjs`: iconos de los 341 equipables, con encuadre de mallas animadas.
- `equipment_manifest.json`: modelos, IDs y estadísticas compartidos.

`npm run art:outfits` reconstruye patrones, partes modulares, accesorios, iconos y SQL. Después se aplica el SQL con `node scripts/apply-sql.mjs`. La compilación normal regenera los iconos nuevos o modificados. Los modelos de `classes/modular/` y `items/accessories/` son GLB independientes con sus materiales y rig; el juego reutiliza los patrones completos en caché para montar solo las piezas seleccionadas.

`equipment.html` es el visor de desarrollo para elegir las cuatro piezas de armadura y los tres accesorios, girar al personaje y comparar las reservas. `modular_equipment.png` muestra conjuntos, mezclas y piezas sobre ropa básica; `accessories.png` muestra las joyas.

# Colecciones de armas con modelos propios

> Actualizado: 88 armas, con 24 modelos adicionales y acabado de todas las piezas. Ver [colecciones y refinado](WEAPON-QUALITY.md). Las cifras siguientes describen la entrega original.

Se añaden 16 armas completas a las 48 anteriores: 64 armas en total. Las 48 previas no cambian de modelo, ID, estadísticas ni precio.

## Guardia del Alba — raro azul

Sable de la Guardia del Alba; Escudo Bastión del Alba; Bastón de Raíz Celeste; Daga Pluma Azul; Daga Garra del Alba; Varita del Lirio Celeste; Códice del Guardián del Alba; Ballesta Martín Pescador.

Acero claro, roble, herrajes dorados y gemas celestes. Siluetas de sable curvo con guardamano, escudo de cometa, ramas abiertas, hojas de pluma y garra, lirio, códice y ballesta de brazos angulares.

## Reliquias del Eclipse — épico morado

Espada Filo del Eclipse; Escudo de la Luna Hendida; Bastón de Medianoche; Daga Onda Violeta; Daga Luna Menguante; Varita de la Estrella Cautiva; Grimorio del Ojo Nocturno; Ballesta Alas del Eclipse.

Metal oscuro, plata apagada y cristales violetas. Espada bifurcada, escudo octagonal con luna, bastón de media luna, kris ondulado y hoz de parada, varita con jaula abierta, grimorio octagonal con ojo y ballesta recurvada.

## Integración

Cada colección tiene ocho piezas compatibles con las cinco clases y los mismos anclajes de mano. Sus valores corresponden a las categorías 2 y 3 ya establecidas: no se aplica una bonificación adicional por pertenecer a una colección ni se modifican las armas anteriores.

Los modelos se construyen desde cero mediante `tools/build-original-weapons.py`, sin importar un GLB existente. Solo comparte funciones geométricas y de atlas con el generador de referencia. Cada export tiene una malla y un material con textura de 256² integrada. El maestro Blender guarda las piezas de construcción separadas.

Los datos de `src/data/uniqueWeapons.json` registran las piezas en equipamiento, mochila, banco, comercio y catálogo SQL. Cada arma tiene icono propio. La tienda provisional vende las nuevas colecciones; `/combat.html` permite seleccionarlas sin sustituir el visor de la progresión anterior.

Las futuras afinidades, efectos o bonificaciones de conjunto se diseñarán aparte; estas piezas usan las habilidades y fórmulas actuales.

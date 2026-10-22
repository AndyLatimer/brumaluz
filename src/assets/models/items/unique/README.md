# Armas originales: Guardia del Alba y Reliquias del Eclipse

16 modelos completos construidos desde cero en Blender, ocho por colección. No se importan ni se modifican mallas de las armas anteriores. Se comparten únicamente utilidades para construir primitivas y asignar UV de atlas.

- `alba/`: raro azul, categoría 2. Sable curvo con guardamano, escudo de cometa, bastón ramificado, dos dagas de perfiles distintos, varita floral, códice rectangular y ballesta angular.
- `eclipse/`: épico morado, categoría 3. Espada lunar bifurcada, escudo octagonal, bastón de media luna, daga ondulada y daga de hoz, varita con jaula abierta, grimorio octagonal y ballesta de brazos recurvados.

Los GLB tienen una malla, un material y un atlas de 256 × 256 integrado. Coordenadas de juego: Y arriba; origen en el agarre. Los libros conservan el eje de portada ±X que usa el anclaje de grimorios del juego.

Maestro editable con componentes separados: `original_weapons.blend`.
Vista previa: `original_weapons.png`.
Generador: `tools/build-original-weapons.py`.
Catálogo: `src/data/uniqueWeapons.json`.

Las estadísticas corresponden a las rarezas azul y morada existentes: son alternativas horizontales dentro de cada categoría. Los objetos anteriores mantienen sus modelos, identificadores, estadísticas y precios. Las nuevas piezas están disponibles en la tienda provisional y en el selector de colecciones de `/combat.html`.

Geometría y atlas originales de Brumaluz. El estilo y las dimensiones de mano se coordinan con los personajes KayKit Adventurers CC0; estos GLB no contienen mallas importadas del paquete ni de las colecciones anteriores.

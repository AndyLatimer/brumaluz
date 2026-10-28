# Recursos y fabricación

Revisión del 26 de octubre de 2026. El acabado mantiene la fantasía cotidiana de Pompelín: madera, piedra, metal y vegetación reconocibles, colores cálidos y magia discreta.

## Identidad visual

Las ocho familias tienen una silueta propia en el mundo, el inventario, las recetas y los mapas:

| Familia | Modelo de campo | Señal al agotarse |
| --- | --- | --- |
| Minerales | Roca con afloramientos de mineral | Roca vacía |
| Gemas | Cristales facetados sobre roca | Roca vacía |
| Maderas | Árbol joven, raíces, corte y tronco | Tocón con anillos |
| Hierbas y flores | Tallos, hojas y flores | Tallos cortados |
| Fibras | Plantas con cápsulas claras | Tallos cortados |
| Frutas y bayas | Arbusto con frutos | Ramas sin frutos |
| Hongos | Grupos de distintas alturas, con sombreros y motas | Base de suelo |
| Cereales | Espigas y hojas largas | Rastrojo |

Los seis rangos conservan sus materiales y colores propios. Abedul, cedro y madera ancestral añaden detalles de forma y corteza. No se ha añadido brillo mágico a los recursos comunes. Los modelos agotados representan la recuperación personal ya existente; no cambian la disponibilidad de otros jugadores.

`src/data/resourceAppearance.ts` comparte familias, paletas y dibujos SVG. `src/data/craftingArt.ts` distingue los componentes de los nueve oficios de fabricación. Los iconos del cliente se resuelven al cargar el catálogo, sin regenerar emplazamientos ni migraciones para cambiar arte.

Revisión del 27 de octubre: los 48 recursos usan retratos de inventario propios en `src/data/resourceInventoryArt.ts`, con facetas, sombras, luces, nervaduras, corteza, anillos y ataduras según su material. Conservan las paletas de los seis rangos y comparten el marco oscuro con remates dorados del equipo. Inventario, banco, botín y recetas usan el mismo retrato; los símbolos pequeños del mapa conservan su dibujo simplificado. Cada instancia recibe identificadores de gradiente independientes para evitar que un recurso tome los colores de otro. La revisión `node tools/review-resource-icons.mjs` captura la colección completa en escritorio y a 390 px y comprueba que los gradientes no comparten identificadores. Se ha revisado además su integración en el inventario real de escritorio, sin modificar cuentas.

## Modelos y rendimiento

### Retratos pintados del inventario

La segunda revisión del 27 de octubre sustituye los retratos vectoriales por ilustraciones pintadas, con transparencia y texturas de corteza, mineral, hojas, metal y cuero. `src/assets/icons/inventory-painted/` contiene 48 recursos, nueve ilustraciones de ranura de equipo y tres herramientas. Las ranuras vacías de equipo y los iconos provisionales de armaduras y accesorios usan las nuevas ilustraciones; los retratos específicos de modelos de equipo se conservan para mantener su identidad.

La lámina original se guarda en `art/resources-review/painted-inventory-atlas.png`. `tools/prepare-painted-inventory-icons.mjs` separa sus veinte dibujos por los espacios transparentes, preserva la proporción y prepara WebP individuales de 256 px. Las variantes mantienen las paletas de rango, las hojas verdes y las ataduras naturales. `src/art/inventoryPaintings.ts` resuelve estos recursos para inventario, banco, recetas y botín. No se añaden llamadas de generación de imágenes al juego.

`src/world/resourceModels.ts` construye modelos nativos de Three.js con colores por vértice. Las piezas de cada modelo se fusionan; `ResourceLayer` agrupa por familia y rango mediante instancias. Cambiar la disponibilidad actualiza únicamente las matrices afectadas.

El editor muestra los mismos 216 nodos derivados del catálogo y adapta su altura al terreno. Esa vista no introduce copias en el documento editable ni publica nodos nuevos. Las coordenadas, radios de interacción y reglas de recolección siguen en el catálogo existente.

Pico, hacha y hoz tienen modelos de mano. Durante la extracción sustituyen visualmente al equipo sostenido y se retiran al terminar o interrumpir la acción. Minería y tala usan gestos de trabajo distintos; la recogida conserva el gesto de interacción. La limpieza respeta una animación posterior de combate.

El mobiliario fabricable incorpora tablones, travesaños, herrajes, libros y detalles de taller. El banco incluye una mordaza y herramientas; Cocina y Alquimia añaden un recipiente. El modelo de taburete, mesa, biblioteca y banco se corresponde con sus iconos existentes.

## Recolección e interfaz

- La tarjeta de extracción muestra retrato del recurso, oficio, energía, duración y progreso; permite cancelar con el botón o Escape. El aviso de interacción cede el espacio mientras se trabaja.
- Virutas y pequeños fragmentos acompañan el gesto. El movimiento reducido elimina esas partículas. Los sonidos de piedra, corte y vegetación respetan el volumen general y el bloqueo de audio del navegador.
- La recompensa se muestra después de confirmar la extracción. Movimiento, daño, combate, muerte o cambio de sesión interrumpen el proceso y retiran la herramienta.
- El cuaderno muestra unidades en mochila, disponibilidad personal y distancia al nodo disponible más cercano. En Pompelín se puede marcar ese nodo en el mapa.
- El minimapa diferencia las ocho familias y limita los iconos de recursos a su vista, sin flechas de nodos lejanos. El atlas agrupa nodos próximos a escala continental; pulsar un grupo acerca la vista para elegir recursos individuales.
- Recetas identifica el origen de los materiales y calcula cuántas fabricaciones permiten las existencias. Los componentes, herramientas y resultados tienen iconos distintos.
- Trabajos muestra el resumen de fabricación, cola y recogida, cinco puestos numerados y tiempos de comienzo o finalización. El panel deja accesible la barra de acciones, también a 320 px.

## Comprobación

`npm run review:resources` revisa geometrías, extracción de los tres oficios, cancelación por botón, desplazamiento y daño, fabricación con materiales reservados en un banco de casa, navegación desde el cuaderno al atlas, traducción y pantallas de 390 y 320 px. Captura también el juego con su renderizador normal y el editor. Usa personajes y acciones locales de prueba, sin operar sobre cuentas reales.

Las capturas e informe están en `art/resources-review/`. `npm run test:resources` cubre las regresiones de gestos y la validación SQL aislada de presencia. La prueba SQL necesita PGlite, con la misma instalación temporal de las pruebas de combate o `PGLITE_TEST_MODULE`; sin él se omite. La compilación que conserva los catálogos y mapas actuales se ejecuta con `npm --ignore-scripts run build`.

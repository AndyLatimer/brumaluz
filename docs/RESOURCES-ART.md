# Recursos y fabricación

Ampliación local del 30 de octubre: [Viviendas y vida cotidiana](HOMES-AND-COZY-LIFE.md)
incorpora ocho modelos domésticos nuevos, sus iconos y 48 recetas de seis rangos,
además de los cuatro tipos de mueble anteriores. Los modelos nativos se exportan
también como GLB para los editores. La colocación en la habitación de la posada
incluye previsualización, movimiento y giro; se conserva el mobiliario anterior
de Isberto.

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

Revisión del 31 de octubre: los componentes de fabricación de los nueve oficios (`componente_herreria_0`, `componente_sastreria_0`, `componente_peleteria_0`, `componente_carpinteria_0`, `componente_ebanisteria_0`, `componente_joyeria_0`, `componente_alquimia_0`, `componente_encantamiento_0`, `componente_cocina_0`) y el cuero curtible (`cuero_0` a `cuero_5`) se actualizan al mismo estilo pictórico 2D de alta fidelidad que los minerales y maderas de referencia (`ore-0.webp` y `wood-0.webp`). Cuentan con perspectiva isométrica 3/4, volumen táctil, sombras suaves de contacto, iluminación cálida de fantasía medieval y transparencia alfa limpia a 256×256 px. `src/art/inventoryPaintings.ts` y `src/data/craftingArt.ts` resuelven automáticamente estos ficheros WebP tanto en la mochila (inventario) como en las recetas y detalles del panel de profesiones.

Asimismo, las 18 pociones del juego (las tres familias: Salud/Vida, Maná y Estamina/Vigor, en sus seis rangos desde Minúscula hasta Gran maestro) reciben ilustraciones pintadas 2D propias con frascos de cristal diferenciados por silueta (esférico para vida, facetado en lágrima para maná y boticario hexagonal para estamina), líquido luminiscente con caústicas, burbujas interiores, tapones de corcho sellados con cera y detalles de encuadernación en relieve, resueltas por `potionPainting()` y enmarcadas en `weaponIconFrame` con el color de rareza de su rango.

En la misma línea, los 25 pergaminos de encantamiento (`pergamino_fire_1..5`, `pergamino_frost_1..5`, `pergamino_lightning_1..5`, `pergamino_vampirism_1..5`, `pergamino_dark_1..5`) adoptan el estilo pictórico 2D sobre lienzo vellum envejecido. Cada senda arcana cuenta con su mandala rúnico concéntrico, glifo elemental identificativo (fuego, flor de hielo, relámpago bifurcado, ala/gota vampírica y ojo del vacío), vara de nogal con remates torneados, cinta de terciopelo y medallón de lacre con el tono de su elemento. Conforme progresa el rango (de Iniciado a Gran maestro), las runas intensifican su luminiscencia mágica y saturación arcana. `src/art/inventoryPaintings.ts` exporta `scrollPainting()` y `src/data/items.ts` las resuelve automáticamente tanto en la mochila de inventario como en las recetas y detalles de Encantamiento.

Por su parte, los 72 muebles de Ebanistería (las 12 piezas domésticas: `taburete`, `mesa`, `biblioteca`, `estacion`, `silla`, `banco`, `mesita`, `arcon`, `alfombra`, `farol`, `macetero` y `biombo` a lo largo de sus seis rangos de calidad) se han modelado y renderizado con perspectiva isométrica 3/4 en Blender 5.2 Cycles sobre fondo transparente con sombra de contacto suave. Cuentan con materiales de madera pulida con veteado procedural, herrajes de bronce y hierro forjado remachado, lino y lanas tejidas, terracota vidriada y cristales de iluminación cálida. Cada rango de calidad refleja la progresión de las maderas nobles (pino común, roble miel, abedul satinado, nogal oscuro, ébano regio y madera ancestral mística). La resolución la realiza `furniturePainting()` en `src/art/inventoryPaintings.ts`, presentándose enmarcados por `weaponIconFrame` con el color de rareza correspondiente tanto en la mochila como en el taller de Ebanistería.

Para el oficio de Cocina, toda la progresión de provisiones y raciones (`pan_duro`, `comida_1`, `comida_2`, `comida_3`, `comida_4` y `comida_5`) y el componente de cocina (`componente_cocina_0`) se unifican bajo el mismo estilo pictórico 2D de fantasía medieval acogedora. Cada modelo se ha esculpido y compuesto en Blender 5.2 Cycles con sombreado pictórico, materiales procedurales (pan de masa madre con greñado crujiente y miga celular, maderas nobles con veteado suave, aros de latón y oro bruñido, embutidos asados con corteza caramelizada, muslos de ave con nudillo de hueso marfil expuesto, empanadas hojaldradas con repulgue esférico artesanal, quesos curados con corteza, frutos y bayas silvestres de recolección y bayas estelares con halo místico) y sombra de contacto suave (Shadow Catcher con oclusión ambiental) sobre fondo transparente a 256×256 px WebP. La resolución de iconos la realiza `foodPainting()` en `src/art/inventoryPaintings.ts` y `src/data/items.ts`, mostrándose tanto en la mochila como en el recetario de Cocina con el marco `weaponIconFrame` del color de rareza de su rango (de T0 Aprendiz a T5 Gran maestro).



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

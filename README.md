# Crónicas de Brumaluz

MMO de navegador cozy en una ciudad medieval, con estilo pintado a mano.

## Equipo modular y trajes de clase

El catálogo contiene **396 equipables**: 88 armas, 275 piezas de 55 conjuntos
y 33 accesorios. La progresión va de gris (principiante) a verde, azul, morado,
dorado y naranja. Cada conjunto tiene cabeza, pecho, manos, piernas y pies;
colgantes, anillos y abalorios se equipan por separado.

Los trajes usan cortes por clase, texturas incrustadas de color, normales y
superficie, faldones articulados y ajuste del tocado al cráneo. La túnica
medieval personalizable comparte las uniones del equipo y su patronaje.
Con `npm run dev`, `/equipment.html` permite combinar piezas, girar el personaje,
cambiar de linaje y verlo caminar, correr o usar una habilidad.

- [Catálogo de trajes y generación](docs/CLASS-OUTFITS.md).
- [Estadísticas, ranuras y migración](docs/MODULAR-EQUIPMENT.md).
- [Dirección artística y límites del ajuste](docs/EQUIPMENT-ART-DIRECTION.md).
- [Vista de frente y espalda](src/assets/models/wardrobe/classes/equipment_tailoring_closeup.png).
- [Paquete de 275 GLB de armadura](src/assets/models/wardrobe/classes/class_outfits_glb.zip).
- [Paquete de 308 GLB de armadura y accesorios](src/assets/models/items/modular_equipment_glb.zip).

`npm run art:outfits` regenera modelos, iconos y catálogo SQL. Si cambia el
catálogo, `npm run db:apply` actualiza el servidor. Los paquetes de exportación
se actualizan con `tools/package-equipment.ps1` después de generar las vistas.

## Biblioteca de recursos

Los doce paquetes KayKit y Kenney importados tienen un [catálogo y visor local](./docs/ASSET-LIBRARY.md)
con 1.021 GLB: objetos, bosque, mazmorras, edificios medievales, terreno hexagonal,
mobiliario, herramientas, cocina, personajes y animaciones.
Restaurant incluye solo 68 recursos aptos para fantasia medieval. Las nuevas
bibliotecas conservan 173 clips para rigs Medium y Large, disponibles en el visor.
Con `npm run dev`, abrir `/assets.html`. El visor no modifica el juego.
Una selección de ocho objetos detalla los servicios y jardines de la ciudad;
los personajes tienen variaciones de reposo e impactos y gestos al recoger
y consumir. El creador incorpora pelo de Ranger y Rogue Hooded: dos peinados
nuevos, dos cortes rehechos con mechones reales y un pañuelo de viajero
recoloreable. Véase [Pelo y complementos](./docs/CHARACTER-ART.md#pelo-y-complementos-del-creador).
Se conservan los IDs guardados y las mecánicas, sin cargar toda la biblioteca.

## Creador de NPCs (desarrollo)

Con `npm run dev`, abrir `/npcs.html` desde el mismo ordenador (localhost).
El taller permite crear, abrir, editar, duplicar y eliminar NPCs, con nombre,
subtítulo, notas y todas las opciones de apariencia del creador: linaje, piel,
rostro, pelo, barba, ojos, rasgos, complementos, maquillaje y colores.
Cada NPC tiene **un único atuendo fijo**, compuesto de piezas independientes:
torso, cada brazo y pierna, sobrerropa, calzado adicional, sombrero, capa y
complemento de espalda. Hay 53 prendas compatibles de Mago, Caballero, Viajero,
Bárbaro, Explorador, Viajero encapuchado, Ayudantes y Clásico medieval (túnica
al estilo de la ropa inicial de KayKit: cuello de lino, cinturón con hebilla y bolsa,
hombreras y brazales de cuero; calzas con sus botas y sin sombrero;
`npm run art:build:medieval` regenera `wardrobe/medieval.glb`), con colores por pieza
o el color original del recurso. La clase no cambia la ropa. Las bases solo
rellenan las piezas del único atuendo; no se guardan conjuntos alternativos.
Algunas piernas incluyen ya el calzado; las botas adicionales de Ayudantes
se prepararon para su pantalón, no para superponerlas a otras botas.
También hay equipo visible de ambas manos, escala y proporciones adicionales.

- Nivel, vida máxima/actual y siete atributos totales son valores propios del
  NPC, sin el límite de puntos de creación de los jugadores. La vida se edita
  explícitamente; hay un botón para sugerirla con la fórmula del juego.
- Vista 3D con giro, zoom, gestos y los 139 clips compatibles Medium del nuevo
  paquete; no se guarda una IA ni un comportamiento por seleccionar animaciones.
- Icono del recuadro del NPC al seleccionarlo: automático según su función,
  una imagen disponible o un identificador reservado para un dibujo futuro.
  Añadir los dibujos en `src/assets/npc-badges/` como PNG, WebP o SVG, con nombres
  únicos como `herrero.png`; el identificador es `herrero`, sin ruta ni extensión.
  Debe comenzar por una letra minúscula y usar solo letras ASCII minúsculas,
  números, `_` o `-`, hasta 64 caracteres. No repetir el mismo nombre con
  diferentes extensiones. Mientras no exista la imagen, el taller indica
  **pendiente** y el juego conserva el icono automático. No afecta al distintivo
  de misión sobre la cabeza ni añade dibujos que todavía no se han entregado.
- **Guardar ficha** escribe `src/data/npcs.json`, no solo el navegador. El ID
  queda estable al guardar. Para editar uno existente, seleccionarlo en la
  biblioteca y pulsar **Editar NPC seleccionado**; **Guardar cambios en este
  NPC** actualiza la misma ficha, sin duplicarla ni cambiar su ID.
  Las fichas del formato anterior se convierten a piezas al cargarlas y se
  guardan en el nuevo formato al confirmar, conservando identidad y estadísticas.
  Exportar/importar JSON permite transportar fichas
  o bibliotecas. Una ficha importada con ID existente se convierte en copia;
  una biblioteca con colisiones se rechaza completa, sin sobrescribir nada.
- Guardado validado, revisión del archivo y detección de ediciones simultáneas.
  Ante un conflicto se conserva el borrador; recargar obtiene la nueva revisión
  y reemplazar una ficha modificada requiere confirmación. No es un bloqueo
  exclusivo frente a editores externos. Los borradores sin guardar no persisten.
- El API `/__dev/npcs` solo existe en Vite de desarrollo y acepta peticiones
  locales del propio origen. No requiere SQL ni una cuenta. Ni el taller ni
  la biblioteca completa se incluyen en la entrada de producción.

El catálogo incluye **Testículos, Gnomi e Isberto**, conectados a sus personajes
reales del juego. Sus fichas se pueden editar y guardar sin duplicar los NPCs;
se conservan colocación, diálogos, misiones y desbloqueos. No pueden eliminarse
desde el taller. Los cambios de apariencia, nombre, subtítulo, estadísticas
e icono se aplican al **recargar el juego**; para publicarlos hay que recompilar
y desplegar. Guardar no recarga el editor ni descarta el borrador.
El subtítulo de la ficha es único y se usa tanto en el recuadro como en las
conversaciones, también para Gnomi tras terminar la bienvenida.

Guardar una ficha nueva **no coloca ese NPC en el mapa**. Para integrarla
después, validar su definición con `src/data/npcs.ts`, cargar los modelos con
`loadKits` y usar `await createNpc(definition)` de `src/character/npc.ts`.
Las prendas adicionales se cargan bajo demanda. La definición conserva vida máxima,
atributos, identidad y notas; conectar esos datos al servidor, diálogos,
combate, comportamiento y colocación es una integración posterior, no automática.
No pasar estas fichas por `sanitize`, que aplica restricciones de jugador.
Las pruebas `npm run test:npcs` usan un catálogo temporal y no modifican fichas
reales del proyecto. Incluyen persistencia, conflictos, validación, interfaz,
edición de los tres NPCs del mundo, iconos, 600 montajes de ropa/equipo y
compatibilidad de los 139 clips.
El catálogo extensible de prendas es `src/data/npcClothing.ts`: sus IDs
persisten en las fichas y alimentan automáticamente los selectores y validación.
Para una fuente nueva hay que registrar también su carga y paleta en
`src/character/npcClothing.ts` y verificar huesos, ajuste y animaciones.
Importar un GLB a la biblioteca no lo convierte automáticamente en ropa modular.

## Editor de mapas (desarrollo)

Con `npm run dev`, abrir `/maps.html` desde el mismo ordenador. Es un editor
visual en 3D para construir mapas con **todos los recursos** (1.078: las piezas
de Pompelín, el mobiliario del juego y los 12 paquetes de la biblioteca),
al estilo de un constructor de ciudades.

- **Catálogo** (izquierda): grupos, categorías, ★ recientes y buscador que
  entiende español (`casa`, `árbol`, `barril`, `valla`…). Clic para colocar,
  arrastrar una miniatura al mapa, Ctrl+clic para añadirla al pincel de dispersar.
- **Herramientas** (barra vertical, con su tecla):
  `V` seleccionar y mover con gizmo (`1` mover, `2` rotar, `3` escalar; Alt+arrastrar
  duplica), `B` colocar (arrastrar crea filas; «Seguir el trazo» orienta vallas
  y muros), `N` dispersar bosques/rocas/flores, `X` borrar con pincel,
  `T` esculpir (subir, bajar, suavizar, aplanar, ruido, cauce), `P` pintar
  12 materiales de suelo, `H` hierba, `C` dibujar colisiones (caja o cilindro,
  bloqueante o plataforma transitable) y `M` marcadores (aparición, NPC del
  catálogo de NPCs, interacción, zona, luz, nota).
- Imán a rejilla configurable o a la rejilla **hexagonal** de Pompelín,
  giro por pasos, apilar sobre otros objetos y pegar al relieve.
- **Escena**: capas (ver, bloquear, renombrar, crear, borrar) y lista de todo
  lo colocado con filtro. **Propiedades**: posición/rotación/escala exactas,
  colisión automática, caja, círculo o ninguna, transitable, tinte, bloqueo,
  reemplazar el recurso, edición múltiple. **Mapa**: nombre, cielo, niebla,
  nubes, luciérnagas y mariposas (por defecto sí, salvo en los interiores), agua, tamaño y resolución del terreno, rellenos globales.
- **Colisión automática**: la altura es la del objeto, pero la planta sale solo de lo que hay a ras de suelo (el 30 %
  de abajo), sin aleros, tejados, copas ni toldos (`footprintOf` en `src/world/mapAssetsCore.ts`). Los faroles y
  postes son un poste fino; los toldos abiertos, solo sus cuatro postes; los arbustos se rodean y no se pisan; las
  plantas altas se atraviesan; las escaleras de las casas siguen con su rellano y peldaños.
- **Faroles**: todos dan luz real. Hay una reserva fija de 10 luces que pasan a los faroles (y marcadores de luz) más
  cercanos al jugador; un marcador de luz junto a un farol fija el color y alcance de su luz.
- **Colisiones** (`K`): naranja las automáticas de cada objeto, azul las
  dibujadas y verde las plataformas. **▶ Pasear** (`J`) baja con un personaje
  al mapa para probar escala y colisiones (WASD, Mayús, Espacio, Esc).
- Deshacer/rehacer hasta 200 pasos (`Ctrl+Z`/`Ctrl+Y`), copiar/pegar,
  duplicar, `F` enfocar, `Inicio` vista cenital. `F1` muestra todos los atajos.
- **Guardar** (`Ctrl+S`) escribe `src/data/maps/<id>.json` con una miniatura;
  **Abrir** lista los mapas del proyecto. También exportar/importar JSON.
  Se detectan cambios hechos desde otra pestaña y se guarda un borrador local
  automático que se ofrece recuperar si se cierra sin guardar.
- **Crear desde plantilla Pompelín** convierte la ciudad actual del juego en un
  mapa editable (casillas, edificios, naturaleza, bancos, marcadores de NPCs).

### Pompelín, Brumaluz y los viajes entre mapas

La **Brumaluz normal publicada** ocupa **392 × 392 m**: una sola ciudad dentro de
una muralla hexagonal con las mismas salidas que el original (este, noreste,
sureste, suroeste y oeste; el noroeste sigue cerrado por el castillo). Todo el
suelo son las casillas hexagonales del juego, en la misma rejilla de 8 m que el
casco antiguo: hierba, calles de piezas `hex_road_*` encajadas según sus vecinas
(la misma tabla de bordes que `src/world/city.ts`), dos lagunas donde desemboca
el río y, fuera de la muralla, lomas y arboledas. El casco antiguo conserva sus
casillas, edificios y marcadores (incluida la puerta de Isberto), pero ya no tiene
foso ni muralla propia: sus seis puertas viejas se prolongan en calles mayores
hasta las puertas nuevas. Alrededor hay seis barrios con unas 270 viviendas (una
por casilla, mirando a su calle), anillos de calles, seis plazas, casas gremiales,
tres colinas (molino, cantera y mirador), huertas, aserradero y cuartel. Todos los
edificios son modelos ya construidos del pack: ninguno se monta con muros y puertas.
El generador termina con un repaso que, con las medidas reales de cada pieza, retira
el atrezo que se pisa con algo o invade una calle, encoge un poco los edificios que
se pisan y deja libre el acceso a las escaleras. `node tools/audit-map.mjs [mapa]`
hace la misma revisión sobre cualquier mapa (solapes, calles invadidas y edificios
sobre mucha pendiente).
`npm run test:brumaluz` comprueba que el suelo está completo, que cada salida de
camino conecta con su casilla vecina, los recorridos, puertas, portales y colinas,
y la coincidencia entre borrador y publicación. El generador
`node tools/build-brumaluz.mjs --out <archivo>` crea la ciudad sin guardarla y
`--apply` la guarda (con ETag) y la publica; vuelve a generar todo lo que lleva el
prefijo `urbe_`, así que los retoques a mano conviene hacerlos después.
`node tools/snap-map.mjs <mapa.json> <carpeta> [vistas.json]` saca capturas del editor sin tocar `src/data`.

**Rendimiento de los mapas en el juego.** Las piezas estáticas se dibujan con un
`BatchedMesh` por material (unas 100 llamadas de dibujo para todo el mapa en vez
de miles). Además hay un campo de visión: los objetos se agrupan en celdas de 24 m
y solo se dibujan las que quedan dentro de la niebla (más un margen para la
cámara); los pequeños (barriles, bancos, flores…) se dejan de dibujar a 75 m. El
minimapa y el editor siguen viendo el mapa completo.

Otras medidas para los 60 fps (de ~22 a 75 fps en la ciudad, con todos los efectos):
- Los objetos fijos del mapa no recalculan su matriz, y sus originales agrupados salen del grafo de escena
  (three.js recorría miles de objetos ocultos dos veces por fotograma).
- La oclusión ambiental (GTAO) usa la profundidad de la pasada principal en vez de volver a dibujar la escena.
- Lotes, personajes y sombras usan materiales propios, para que three.js no revise sus shaders cada fotograma.
- `window.brumaluz.debug()` da acceso al renderer, la escena y el escenario para medir rendimiento.

**Escaleras de las casas.** Las casas con escalera ante la puerta (`home_B` y la taberna de city.glb) ya no
tienen una sola caja de colisión: el cuerpo bloquea, pero los peldaños son una rampa y el rellano una superficie,
así que se puede subir hasta la puerta. Los edificios de Brumaluz son ×1,5 su tamaño base (`BUILDING_SCALE`),
sin pasar de 4,9 m del centro a la esquina para no invadir la calle; en el casco antiguo, los pocos que taparían
una calle o el sitio de un tendero crecen menos y el castillo conserva su tamaño.

**Agua.** El agua ya no es un muro. En las casillas de agua (las lagunas) y donde la lámina general del mapa
cubre más de 1,1 m se nada: el personaje flota con la cabeza y los hombros fuera, avanza a brazadas (el clip
`Crawling`, tumbado a flor de agua) a mitad de velocidad y no puede saltar. Los ríos del pack y el agua poco
profunda se vadean, algo más despacio. Al entrar salpica y, mientras está en el agua, deja ondas a su alrededor
(`src/world/waterFx.ts`); los demás jugadores también nadan y dejan ondas. El agua de las casillas tiene oleaje
animado con destellos, y la cámara nunca baja de la superficie.
En el juego, `src/world/water.ts` sustituye la lámina opaca de las casillas por agua semitransparente: oleaje con
reflejos del cielo y destello del sol, color de turquesa a azul hondo según la profundidad real del fondo (la del
mapa de alturas), cáusticas en lo somero, espuma en las orillas y, en los ríos, ondas y franjas que siguen la
corriente cuesta abajo. Donde dos aguas vecinas están a distinta altura hay una cascada (cortina opaca que cae con
espuma al pie, ondas y salpicaduras); un río de casillas solo cae por los extremos de su cauce, nunca por sus orillas.
Una cascada se baja, pero no se remonta. En el juego el agua refleja el cielo del ciclo de día y noche y se oscurece
de noche, igual que sus ondas y salpicaduras. En Brumaluz las lagunas quedan 1,1 m por debajo de la desembocadura del río, con
fondo de arena visible; a ellas uno se puede tirar desde cualquier altura y se sale trepando a la orilla. El
editor sigue mostrando la casilla de agua del pack.

**Herramienta «Agua» del editor (`L`).** Pinta agua sobre el terreno con el mismo aspecto y comportamiento que en
el juego (se guarda en `terrain.water`: la altura de la lámina en cada vértice; los mapas sin agua no cambian).
- **Lago o laguna**: lámina plana al nivel del primer clic (o del agua que se toca, para ampliarla) o a una altura
  fija; Alt+clic toma el nivel. Con «Excavar el fondo» abre un vaso de la profundidad elegida con orilla suave.
- **Río**: arrastrando, el agua sigue al terreno un poco por debajo de las orillas y se excava el cauce; donde el
  terreno da un salto, el agua cae en cascada. Un río que llega a otra agua se une a ella sin cambiarla.
- **Secar**: quita el agua (el fondo excavado se queda).
- Pinta el fondo (arena en la orilla, barro donde cubre) y quita la hierba bajo el agua.
Donde dos vértices de agua vecinos difieren más de 35 cm hay cascada; a partir de 1,1 m de hondo se nada y, si no,
se vadea. `npm run test:water` comprueba el formato, las colisiones y las cascadas. `waterAt(x, z)` del mapa da la altura del agua
y si es profunda. `node tools/prepare-ambient-animations.mjs` regenera las animaciones extra (incluida la de nado).

**Cámara sin estorbos en interiores.** En los mapas de tipo interior, las paredes que se interponen
entre la cámara y el personaje se vuelven casi transparentes y recuperan su aspecto cuando dejan de
tapar. Se comprueban los pies, el pecho, la cabeza y los lados del personaje y un anillo a ras de
suelo a 2,2 m, así que la pared delantera deja ver la habitación. Nada más se atenúa: ni los muebles
ni, fuera, las casas o los árboles.

En el juego, **M**, un clic en el minimapa o **Mundo → Mapa** abre el mapa completo de la zona actual,
con norte arriba y un indicador de tu posición y orientación. **M**, **Esc**,
la **X** superior derecha o el fondo lo cierran. La ventana se ajusta a la
pantalla sin scroll. Los NPC visibles aparecen en verde y muestran su nombre
al pasar el ratón o recibir foco. **+ / −** y la rueda acercan o alejan hasta
8×; también hay un deslizador, **Centrar en ti** y **Ver zona completa** para restaurar el encuadre.
Arrastrar desplaza la vista; un clic sin arrastrar coloca o mueve un destino
personal azul. Se elimina pulsando su bandera o **Quitar destino**. También
puedes pulsar un icono de NPC, misión, salida, interior o tu posición
para fijar el destino en sus coordenadas exactas, con ratón o teclado. Con el mapa
enfocado, **Enter** marca el centro y **Suprimir** lo elimina. Cada zona conserva
su destino durante la sesión, sin modificar el mapa ni el de otros jugadores.
La bandera también aparece en el minimapa y tiene indicador de distancia en el
mundo. Fuera de pantalla, tanto misiones como destinos solo muestran flecha y
distancia, sin exclamación. Los indicadores se ocultan al abrir ventanas.
El marco de atlas incluye una rosa de los vientos, leyenda de marcadores y
una escala en metros/kilómetros que se ajusta al zoom.
La leyenda distingue jugador, NPC, misión, destino personal, salidas y accesos
a interiores; los accesos del mapa actual muestran su nombre al pasar el ratón
o recibir foco.
El minimapa utiliza esos mismos iconos, colores y puntos, también para salidas e
interiores. Los accesos cerrados aparecen atenuados en ambos mapas.
Las salidas y los interiores lejanos no se dibujan en el borde: solo aparecen
cuando caben en la vista actual del minimapa. Los NPC cercanos llevan una
insignia de retrato verde de 16 px, con fondo oscuro y contorno fino; fuera de la vista se indican con una flecha verde. Las misiones
lejanas usan una flecha dorada, y los destinos personales, una azul.
No permite todavía navegar entre mapas: al viajar cambia al mapa de la nueva zona.
El minimapa sigue siendo independiente y se oculta o muestra con **º**.
En **Personaje → Diario**, las pestañas separan las misiones activas de las
completadas. **Seguir misión / Dejar de seguir misión** activa o desactiva su
panel, su indicador dorado y sus marcas en ambos mapas, sin abandonar la misión
ni cambiar progreso o recompensas. La preferencia se guarda localmente por
personaje y se conserva al recargar; las misiones nuevas se siguen por defecto.
Las completadas no se pueden seguir. El destino personal azul es independiente.
Al actualizarse el estado se conservan pestaña, entradas desplegadas, foco y scroll.
Los nombres de NPC aparecen por proximidad, sin apuntarlos ni pasar el ratón:
a 10 metros o menos del jugador, el mismo alcance que sus badges de objetivo.
También respetan la opción de placas de nombre.
Los portales permanecen bloqueados durante un combate activo: el aviso de
interacción lo indica y al intentar viajar aparece un mensaje. Alejarse del
enemigo no termina el encuentro; hay que resolverlo antes de viajar.
Los menús de personaje y Mundo llevan iconos propios a la derecha de cada
opción; «Mapa» no muestra la tecla, pero conserva el atajo **M**. La guía de
misión utiliza una exclamación sobre una pequeña insignia dorada junto a la distancia y mantiene la
flecha de dirección cuando el objetivo está fuera de pantalla.
Colecciones muestra emblemas ilustrados propios para cada región, incluida
la **Isla de Lunargenta**, con colores legibles también en las zonas todavía bloqueadas.

**Pompelín es el mundo; Brumaluz es su capital**, no dos nombres de la misma ciudad.
Los borradores de `src/data/maps/` no cambian el juego hasta publicarlos.

El selector **Editar mapa**, en la cabecera, permite cambiar directamente entre
todos los mapas guardados (continente, ciudades, exteriores e interiores).
Si hay cambios sin guardar, pide confirmación antes de descartarlos.
**Brumaluz** aparece incluso sin borrador: al seleccionarla por primera vez se
crea y guarda una copia editable de la capital detallada, no del icono de ciudad
en el continente. Después el selector vuelve a abrir esa misma copia, conservando
las ediciones. Cambiar de mapa no publica nada.

1. En `/maps.html`, **Abrir → Mundo de Pompelín** abre el continente o crea una
   plantilla editable basada en el croquis: capital central, caminos, Arboleda,
   Cumbres de Cobre, costa e isla de Lunargenta. Las zonas incompletas son
   referencias editables, no ciudades terminadas. **Capital: Brumaluz** crea
   la copia detallada de la ciudad, con sus cinco puertas al continente.
   El continente mide **3.600 × 2.700 m**: ×5 en cada eje y ×25 de superficie
   respecto al primer boceto. Las poblaciones y edificios conservan su tamaño;
   se amplían los exteriores entre regiones. El terreno usa celdas de 4 m para
   mantener la edición manejable. Los mapas detallados de ciudad siguen separados.
   El editor admite lados de hasta 10 km y celdas de hasta 16 m, siempre
   respetando el límite de vértices.
   Las representaciones de Brumaluz, Rusty Hearth y Lunargenta incluyen barrios,
   mercados, pozos, faroles, bancos y mercancías medievales editables. Brumaluz
   tiene torres y estandartes junto a sus cinco accesos; los radios de viaje y
   llegada quedan despejados. Son decoraciones del continente, independientes
   de los mapas detallados al entrar en cada ciudad.
2. En **Mapa** define **Tipo**, **Región** y **Consejo al cargar**. La miniatura
   guardada se usa como fondo de la pantalla de carga, que muestra el destino.
3. Coloca un marcador **Llegada** en el destino, fuera del radio de su salida.
   En el mapa de origen coloca un **Portal**, elige **Mapa de destino** y
   **Llegada**, y selecciona **Al caminar dentro** o **Pulsar E (sin confirmación)**.
   El radio guardado es el mismo para el aviso del cliente y la validación del
   servidor: si amplías el alcance de una puerta, vuelve a publicar y aplicar
   el SQL. Coloca las llegadas fuera de las colisiones y del disparador automático de regreso.
   **Conectar ida y vuelta** guarda ambos mapas y crea las llegadas y el
   regreso cerca de la aparición del destino; abre ese mapa para moverlos.
   La lista **Abrir** muestra las conexiones de cada mapa.
4. Pulsa **⇪ Publicar en el juego** en **cada mapa** que quieras habilitar.
   Se conserva el resto del mundo publicado. No es obligatorio publicar una
   copia de Brumaluz: la capital procedural también tiene las cinco puertas.
   Un portal sin destino publicado queda cerrado y se avisa al publicar.
   Una llegada nombrada inexistente u oculta impide publicar: nunca se elige
   otra llegada silenciosamente.
5. Se generan `src/data/world/published.ts`, `src/data/world/maps/<id>.json`
   y `<id>.ts` (solo los GLB usados), además de **`supabase/world.sql`** con
   mapas, límites, apariciones y portales. **`npm run db:apply`** aplica
   el SQL del servidor y ese SQL en una transacción. Publicar no ejecuta SQL remoto.
   Para producción, confirma los mapas y el SQL y despliega cliente y base
   con la misma versión. Las pestañas del juego local se recargan al publicar.

El servidor valida sesión, vida, combate y distancia al portal antes del
viaje. Guarda mapa y posición al llegar; al volver a entrar recupera ambos.
Solo se ven jugadores del mismo mapa. Morir lleva a Brumaluz y un mapa retirado
también devuelve allí al volver a entrar. Las llegadas se desarman hasta salir
de todos los radios de portal para evitar rebotes automáticos.

En **Abrir**, **Retirar del juego** retira un mapa sin borrar su borrador.
Retirar todos restaura la Brumaluz procedural; los caminos sin destino quedan
cerrados. `?ciudad-procedural` fuerza ese modo para diagnóstico. Un error de
carga se muestra explícitamente, sin sustituir el destino por otro mapa.

Los mapas conservan la iluminación y el cielo del juego; agua, nubes, objetos
y colisiones vienen del mapa. Los NPC del catálogo (Testículos, Isberto…)
se colocan mediante sus marcadores; los oficios de tienda son vendedores, el
texto `well` es el pozo y otras interacciones muestran texto con `E`.
Bienvenida, combate y bolsas de monedas siguen en Brumaluz, en sus posiciones
fijas (sus marcadores de plantilla son referencias).

El API `/__dev/maps` solo existe en Vite de desarrollo, acepta peticiones
locales y no entra en el build de producción. `npm run test:maps` prueba
esquema, API, publicación, el adaptador del juego y el editor en el navegador
con directorios temporales.

## Cuentas y personajes

El lore acordado y las decisiones narrativas pendientes se mantienen en
[Pompelín: mundo y bienvenida](./docs/LORE.md).

- Registro e inicio de sesión se gestionan con Supabase Auth; el proyecto no guarda contraseñas.
- «Recuérdame» en el inicio de sesión guarda únicamente el correo en este navegador y lo rellena al volver. Desmarcarlo elimina el correo recordado; no cambia la duración de la sesión de Supabase ni guarda la contraseña.
- Al registrarse, cada usuario elige un nombre de usuario único (3-20 letras ASCII, números o guion bajo). El acceso sigue usando correo y contraseña; el nombre de usuario identifica al jugador, aparece en la selección de personajes y es visible para otros usuarios autenticados.
- La interfaz está disponible en español e inglés; el idioma se cambia con las banderas de acceso y del menú del juego y queda guardado en el navegador.
- El acceso y la selección de personajes comparten música cozy original, sintetizada localmente sin descargas: una melodía más alegre y animada de día (06:00–18:00, hora local) y la melodía suave original de noche. Cambia automáticamente junto al fondo, también si la pantalla sigue abierta al cambiar la franja horaria. El botón «Música» junto a «Gráficos» permite silenciarla y recuerda la preferencia en el navegador, independientemente del ambiente del mundo.
  Empieza tras la primera interacción (por las restricciones de audio del navegador), respeta el volumen general y se detiene al ocultar la pestaña, abrir el creador o entrar al mundo.
- El acceso permite solicitar un correo de recuperación y cambiar la contraseña desde el enlace enviado por Supabase Auth.
- Los personajes se guardan en `public.characters`, protegidos por políticas RLS para que cada cuenta solo acceda a los suyos.
- Tras iniciar sesión aparece la selección de personajes. Desde ahí se puede jugar con uno existente o crear otro. Cada cuenta puede tener un máximo de cinco personajes; para crear más, primero hay que borrar uno. El creador guarda el personaje al pulsar «Guardar y entrar».
- Cada personaje guarda su nivel (comienza en 1), sus puntos de experiencia (comienzan en 0), vida, atributos, título, mapa y última posición exacta; la tarjeta de selección muestra el nivel y la zona guardada. Los mapas publicados del mundo de Pompelín se conectan mediante portales. Al volver a jugar apareces donde lo dejaste (si estabas caído o el mapa se retiró, reapareces en la capital).
- **El servidor manda.** El navegador no puede escribir en `public.characters` (solo leer y borrar). Crear personajes, ganar XP/nivel, recibir daño o curación, repartir puntos de atributo, cambiar de título, reaparecer y guardar la posición pasan por funciones de [`supabase/server/`](./supabase/server/) que validan todo y calculan el resultado: el cliente solo pide la acción y muestra lo que el servidor responde. Sin guardado manual: el mundo sincroniza el movimiento y guarda una posición persistente cada 5 s y al salir normalmente; si se cierra el navegador de golpe se conserva el último checkpoint. El servidor rechaza posiciones fuera del mundo y desplazamientos que superan el presupuesto de velocidad acumulado, y devuelve al jugador a la última posición válida.
- Las acciones del NPC de pruebas y demás: cada acción del juego tiene su propia función en el servidor: `respawn_character`, `debug_damage`, `debug_heal`, `debug_xp`, `spend_attribute_points`, `set_character_title`, `save_character_position`, `create_character` y `character_enter`. Las `debug_*` (Testículos: daño, curación, XP y pelines) funcionan para todos mientras `server_config.debug_actions` sea `true`; en producción ponlo en `false` (`update public.server_config set value = 'false' where key = 'debug_actions';`). Con las acciones desactivadas, únicamente la cuenta administradora `manuelperezardanuy@gmail.com` puede seguir utilizándolas sobre sus propios personajes. El servidor comprueba el correo de la cuenta autenticada en `auth.users`, sin confiar en datos enviados por el navegador.
- **Sobrecuración:** la vida curada por encima del máximo no se pierde: pasa a una reserva dorada (máximo el 30 % de la vida máxima) que se dibuja al final de la barra de vida, absorbe el daño antes que la vida y se desvanece con el tiempo (1 punto por segundo). Se calcula en el servidor (`game_overheal_now`) y el cliente solo la descuenta en pantalla; los parámetros están en `OVERHEAL` (`src/data/stats.ts`) y en `supabase/server/`. Solo se muere al llegar a cero de vida real: el valor guardado `-1` significa vida completa, también después de un golpe absorbido por la reserva.
- **Habilidades iniciales:** el menú de personaje y `K` abren el libro de habilidades de clase, con efecto, coste, alcance y recarga. Se añaden al primer hueco libre de la barra sin sobrescribir objetos; también pueden arrastrarse desde el libro. `1`-`0` ejecutan objetos o habilidades y `Z` cambia de página. `F` fija el enemigo visible y activa el ataque automático; moverse o girar la cámara no suelta el objetivo. `Esc` libera la selección; «Retirarse» termina el encuentro. La autoridad sigue siendo del servidor. Véase [COMBAT.md](./docs/COMBAT.md). Se llena sola al comprar, o arrastrando objetos desde la mochila; clic derecho vacía un hueco. La disposición se guarda en el navegador por personaje (es solo interfaz); usar el objeto lo valida siempre el servidor (`use_item`). `Z` alterna entre la barra principal y la secundaria (con animación).
- **Progresión de habilidades:** libro ampliado con catálogo y detalle, iconos originales y tooltips como los objetos. Se obtiene 1 punto en cada nivel par, también por niveles ya ganados; rango 1 gratis y mejoras de 1 punto hasta rango 5, con requisitos de nivel 2/4/6/8. El gasto se confirma y lo valida `upgrade_skill` con bloqueo y rango esperado. Los puntos no gastados se conservan. El ataque normal no usa rangos ni puntos: escala un 5 % de su daño base por nivel ganado, redondeado. Esta ampliación se publica con autorización del 19 de octubre de 2026 y necesita aplicar el SQL actualizado antes del cliente; las pruebas con rollback no lo aplican a producción.
- **Organizar mochila:** arrastra un montón a un hueco vacío para moverlo, o a uno ocupado para intercambiar ambos montones completos, sin fusionarlos ni consumir objetos. `move_inventory_item` valida propiedad, huecos y contenido esperado, conserva las marcas de ligado y guarda la nueva distribución; una petición obsoleta falla sin sobrescribir nada. Si había intercambio pendiente, elimina tu oferta y retira ambas aceptaciones para no reutilizar referencias a huecos movidos. El arrastre a la barra rápida sigue asignando el objeto, sin sacarlo de la mochila.
- **Misiones:** diario con `J`, secciones activas/completadas, seguimiento y objetivos dorados en el mundo y minimapa. La bienvenida de Gnomi y el combate se activan para personajes nuevos por autorización del 19 de octubre de 2026. Los personajes anteriores no se inscriben retroactivamente.
- **Historia de inicio:** los personajes nuevos entran por la Puerta del Este con una cinemática (entrada por la puerta, panorámica de la ciudad y encuentro con Gnomi), recuperan su distintivo en el mercado de la plaza del Levante, ven a la criatura en otra escena, la derrotan y, tras registrar los restos, Isberto los lleva a su casa: la cama (`rest_action`) y el cofre (banco). La casa está cerrada hasta esa invitación (`PORTAL_LOCKED`). Las cinemáticas (`src/world/cinematic.ts`) se saltan con `Esc`; posiciones en `src/data/quests.ts`, en sincronía con `supabase/server/`.
- **Apilado:** el máximo por defecto es **50 unidades por hueco** (`DEFAULT_STACK` y `game_add_item`); `stack` en ambos catálogos permite excepciones. Comprar o recibir por intercambio llena montones compatibles hasta su límite y después utiliza huecos libres. Los montones antiguos superiores al nuevo límite se conservan sin recortes ni pérdidas, pero no reciben más unidades.
- **Tamaño y desvanecimiento del chat:** por defecto ocupa el espacio entre el borde derecho de la barra rápida y el margen derecho de pantalla, con 12 px de separación; en pantallas estrechas usa una medida compacta. Las dimensiones guardadas por versiones antiguas vuelven a este ancho automático; los ajustes manuales nuevos se guardan con `version: 2` y siguen teniendo prioridad. La pestaña **Chat ↑** solo aparece cuando la opacidad llega a cero al terminar la transición, y se oculta al recuperar el chat.
- Al abrir menús o ventanas se ocultan el minimapa y la barra rápida; **Inventario** y **Habilidades** conservan la barra para arrastrar objetos o habilidades. El chat se recupera temporalmente desde una pequeña pestaña **Chat ↑** en la esquina inferior derecha, no al cruzar toda su zona. Se mantiene abierto mientras el ratón está dentro o escribes y se oculta al dejar ambos. La misma pestaña recupera el chat desvanecido por inactividad. Minimizar lo recoge en una pestaña pequeña abajo, conservando su tamaño al restaurar; una vista temporal no cambia esa preferencia. Su scroll usa los colores de madera y oro del panel.
- **Títulos reservados «Rey de Pompelín» y «Reina de Pompelín»** (con el mismo fénix y efectos): cada uno solo está disponible para los correos autorizados en `server_config.staff_titles` (`supabase/server/`); el servidor lo valida en `set_character_title` y el selector solo lo muestra a su cuenta (`my_titles`). La migración añade la autorización de Reina sin borrar la configuración del Rey ni otras autorizaciones existentes. Se eligen en la ficha del personaje; no se cambia automáticamente el título equipado.
- **Comercio:** `vendor_buy`, `vendor_sell` y `use_item`, más `debug_money` (+100 pelines del NPC de pruebas). El servidor decide mercancía, precios (compra = valor del objeto; venta = la mitad), saldo, hueco libre y efecto de los objetos; el cliente solo pide la acción. Catálogo en `game_item` / `game_vendor_stock` (`supabase/server/`) y su copia para mostrar en `src/data/items.ts`: mantenerlos iguales. Los vendedores tienen pelines infinitos, no se muestran.
- **Intercambio entre jugadores:** en el menú de interacción de un jugador cercano (10 m), elige «Invitar a intercambiar». Cada uno ve solo su mochila intercambiable y la oferta del otro, nunca su inventario. Las tarjetas permiten elegir cantidades con **− / + / Todo**; los pelines tienen estos controles y un único campo numérico para cantidades grandes. **Ofertar** envía la selección y la muestra en «Tu oferta»; los cambios sin enviar no se pueden aceptar ni se pierden si cambia la oferta del otro. «Oferta recibida» distingue una oferta de su aceptación: al aceptar, el panel se vuelve verde y muestra un sello de confirmación. En móvil, el estado del otro y los botones de acción permanecen visibles al desplazarse. Cualquier oferta nueva retira ambas aceptaciones; se avisa cuando el otro acepta. «Cancelar oferta» vacía tu propuesta sin cerrar; «Cancelar» termina el intercambio. Dos aceptaciones de la misma revisión intercambian todo en una única transacción de servidor; se revalidan propiedad, cantidades, saldo, espacio, presencia y distancia antes de guardar. Alejarse, caer, salir, perder presencia durante 15 s o sustituir la sesión invalida la operación.
- La invitación de intercambio y la espera del remitente usan avisos compactos, con botones sin marco de fondo. La invitación aparece automáticamente con el nombre del remitente y botones **Aceptar / Rechazar**. Aceptar abre la negociación, sin aceptar aún ninguna oferta. **Cancelar oferta** sustituye a «Atrás»: vacía objetos y pelines, retira ambas aceptaciones y mantiene la negociación abierta; si solo había una selección sin enviar, la descarta localmente. **Aceptar intercambio** sigue siendo la confirmación final. **Cancelar** termina la negociación y cierra la ventana para ambos jugadores, notificando la cancelación sin reabrirla en el siguiente sondeo. Los personajes nuevos sin monedero guardado reciben igualmente la invitación y empiezan con 0 pelines. El aviso de la tecla E para otros jugadores muestra solo **Interactuar**.
- **Objetos ligados:** el catálogo (`ItemDef.bound` / `game_item.bound`) y cada montón (`ItemStack.bound`) pueden marcar un objeto como ligado. Los objetos actuales son intercambiables por defecto. Un montón ligado nunca se fusiona con otro sin ligar; comprar, vender, usar y sanear conservan la marca de los restos. Los tooltips compartidos indican «Intercambiable» o «Ligado · No intercambiable». El servidor rechaza ofertas si cualquiera de las dos marcas está activa.
- **Pruebas de intercambio:** `npm run test:trade` compila y ejecuta la interfaz simulada con Playwright (cantidades, privacidad, aceptación/atrás/cancelar, errores, carga, callbacks tardíos, español/inglés y móvil). `npm run test:trade:db` usa `SUPABASE_TEST_DB_URL`; `npm run test:trade:db -- --configured` permite deliberadamente la base configurada. Toda la aplicación del esquema y los fixtures SQL quedan dentro de una transacción con `ROLLBACK`, sin datos persistentes. La función `trade_action` serializa mutaciones de intercambio con un advisory lock y bloquea ambos personajes en orden UUID, evitando doble intercambio al aceptar simultáneamente.

**Pendiente de hacer en el servidor, a medida que se añada cada sistema** (cada uno con su propia función en `supabase/server/`, validada y sin confiar en el cliente):
- XP y nivel reales: dar experiencia por monstruos, misiones y descubrimientos (hoy solo existe `debug_xp`).
- Comercio: comprobar que el jugador está cerca del vendedor (hoy el servidor no conoce la posición de los NPC); soltar objetos. Equipar/desequipar y recoger botín de la criatura de Isberto ya están disponibles.
- Combate: daño y curación reales, maná/estamina y reaparición con penalizaciones si las hay.
- Títulos ganables: comprobar los requisitos en `set_character_title`.
- Posición: colisiones y límites reales del mapa en el servidor (hoy solo se comprueban el límite del mundo y la velocidad).
- Fórmulas de vida, XP y sobrecuración: están duplicadas en `supabase/server/` y `src/data/stats.ts`; mantenerlas iguales.
- Cada tarjeta de personaje permite borrarlo de la base de datos, tras confirmar escribiendo exactamente su nombre.

### Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/) y ejecuta en el SQL Editor, **en este orden**, [`supabase/schema.sql`](./supabase/schema.sql) y el SQL del servidor, repartido por temas en [`supabase/server/`](./supabase/server/) (`npm run db:sql > servidor.sql` lo une en un solo script, en orden, para pegarlo). Si ya configuraste Supabase, vuelve a ejecutar ambos actualizados (son idempotentes): `schema.sql` retira los permisos de escritura directa sobre los personajes y el SQL del servidor crea sus funciones. Hasta que lo ejecutes, crear y jugar con personajes fallará. Para no pegarlo a mano: pon `SUPABASE_DB_URL` (cadena de conexión de Postgres, ver `.env.example`) en `.env.local`, que git ignora, y ejecuta `npm run db:apply` (añade `-- --schema` para aplicar también `schema.sql`).
2. Los usuarios que ya existían recibirán un perfil sin nombre de usuario. Asígnales uno manualmente desde el SQL Editor: consulta sus cuentas con `select u.id, u.email, p.username from auth.users u left join public.profiles p on p.user_id = u.id order by u.created_at;` y para cada persona ejecuta `update public.profiles set username = 'NombreElegido' where user_id = 'UUID';`. El índice único no distingue mayúsculas de minúsculas; usa nombres de 3-20 letras ASCII, números o guion bajo. No se debe modificar `auth.users` para hacer esta asignación.
3. En **Auth → URL Configuration**, configura el Site URL y permite `http://localhost:5173/**` como Redirect URL de desarrollo (y `http://127.0.0.1:5173/**` si accedes usando esa dirección), además del dominio final al desplegar. Añade también la URL de producción para que los enlaces de recuperación puedan volver a la aplicación.
4. En la configuración de Auth, decide si quieres exigir confirmación de correo. Si está activada, el usuario deberá confirmarlo antes de iniciar sesión.
5. Copia `.env.example` como `.env.local` y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores de **Project URL** y la clave pública/publishable del proyecto.
6. Reinicia `npm run dev`. En producción, configura esas mismas variables en el servicio de despliegue y vuelve a compilar.

La clave publishable es para el navegador y está protegida por las políticas RLS de la base de datos. **No uses ni publiques una `service_role` o secret key en la web.** La autenticación real necesita el proyecto de Supabase y su esquema; sin esa configuración, el sitio muestra qué falta y no ofrece un acceso simulado.

### Despliegue público en Vercel

1. Sube la rama `main` a GitHub e importa `AndyLatimer/brumaluz` desde [Vercel](https://vercel.com/new). Elige `brumaluz` como nombre del proyecto si está disponible; la URL resultante será `https://brumaluz.vercel.app`. Si el nombre ya está ocupado, Vercel pedirá elegir otro.
2. Vercel detecta Vite automáticamente. Comprueba que el comando de build sea `npm run build` y el directorio de salida `dist`.
3. En **Project Settings → Environment Variables**, configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores del proyecto de Supabase. Añádelas al menos al entorno **Production** (y también a **Preview** si quieres que las previsualizaciones puedan iniciar sesión). Son las mismas variables que en `.env.local`; no añadas `SUPABASE_DB_URL`, `service_role` ni ninguna clave secreta al sitio.
4. Haz el primer deploy. En Supabase, ve a **Authentication → URL Configuration** y establece **Site URL** como la URL de producción asignada por Vercel. Añade también `https://brumaluz.vercel.app/**` a **Redirect URLs**. Si Vercel asigna otro subdominio, usa ese dominio real en ambos campos.
5. Antes de abrir el juego al público, desactiva las acciones del NPC de pruebas en el SQL Editor de Supabase:

   ```sql
   update public.server_config set value = 'false'::jsonb where key = 'debug_actions';
   ```

   Comprueba el resultado con `select key, value from public.server_config where key = 'debug_actions';`. Así se desactivan las acciones de prueba de daño, curación, XP y dinero; las funciones normales del juego siguen disponibles.
6. Cada push a `main` desplegará una nueva versión automáticamente. Para usar un dominio propio más adelante, añádelo en **Project Settings → Domains** y actualiza **Site URL** y **Redirect URLs** en Supabase.

## Creador de personaje

- Linajes: Humano, Elfo, Lagto' (gente lagarto) y Pelso (gente gato), hombre o mujer.
- Atributos (Fuerza, Intelecto, Corpulencia, Agilidad, Pericia, Presencia y Percepción): cada personaje empieza con 5 en cada atributo, suma 5 puntos de bonificación según su linaje y reparte 2 puntos libres. Ningún atributo puede superar 15. Los humanos destacan en Pericia y Presencia; los elfos en Intelecto, Pericia y Agilidad; los Lagto' en Fuerza y Corpulencia; los Pelso en Agilidad, combate y Percepción. La asignación se guarda con el personaje, pero por ahora no afecta a las mecánicas del juego.
- Altura y complexión ajustan tanto el tamaño general como las proporciones de piernas, torso, hombros y extremidades.
- Personajes modulares sobre el pack **KayKit Adventurers** (Kay Lousberg, CC0): cabezas, trajes,
  sombreros y armas se combinan sobre un esqueleto común con 21 animaciones.
- Colores de piel, pelo y ropa repintando la paleta de las texturas; orejas, colas y crestas
  propias para elfos, Lagto' y Pelso.
- Escenario con materiales PBR, cielo HDRI del ciclo de día y noche y relieve CC0 de Poly Haven (vía `@pmndrs/assets`).

## Créditos

- Personajes: [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) de Kay Lousberg (CC0).
- Ciudad: [KayKit Medieval Hexagon](https://kaylousberg.itch.io/kaykit-medieval-hexagon) de Kay Lousberg (CC0).
- HDRI y mapas de relieve: [Poly Haven](https://polyhaven.com) (CC0), empaquetados en `@pmndrs/assets`.

Para regenerar los modelos optimizados: `node tools/prepare-models.mjs <carpeta gltf de Adventurers>` y
`node tools/prepare-city.mjs <carpeta Assets/gltf de Medieval Hexagon>`.

## Ciudad

- Brumaluz está hecha con el pack **KayKit Medieval Hexagon** (Kay Lousberg, CC0) a escala ×4:
  plaza con fuente, avenidas, barrios residenciales, taberna, mercados, iglesia, herrería,
  castillo, granja con molino, río con vado y bosques y montañas alrededor. Una muralla de
  piedra rodea la capital y sus seis puertas conectan con las avenidas principales.
- Las calles se eligen y giran solas según sus vecinos; las puertas y la muralla se generan
  siguiendo el perímetro hexagonal y tienen colisión. El suelo continuo tiene colinas visibles
  dentro y fuera de la muralla, con plataformas suavizadas bajo los edificios; la hierba low-poly
  cubre también los claros entre casas y los islotes verdes de las calles, se mece con la brisa y
  se inclina al paso del personaje. Hay flores silvestres, nenúfares y plantas de ribera, bancos con
  colisión, puestos abastecidos junto a los comercios, bandadas de pájaros y un molino en movimiento.
  Seis puntos de servicio estables (`city.vendorSpots`) permiten añadir vendedores y otros NPCs
  más adelante sin rehacer la distribución.
- Al entrar se oyen viento, agua del río, pájaros, murmullo lejano de ciudad y campanas ocasionales,
  generados localmente con Web Audio; se pueden silenciar o reactivar desde el menú del juego. No se
  descargan pistas externas.
- Modo exploración: WASD se mueve respecto a la cámara (W hacia donde miras, A/D a los lados, S hacia ti) con aceleración y frenada suaves; el personaje se orienta hacia donde va. Arrastrar con el ratón orbita la cámara libremente (el vertical se mantiene), rueda para acercar con zoom suave, clic para moverse, Mayús alterna correr/caminar,
  espacio para saltar y E para saludar.
- Opciones (menú del juego): Vídeo (idioma), Sonido (sonido ambiental, volumen ambiental y volumen general; se guardan en el navegador) y Controles (teclado ilustrado).
  **Cada vez que se añada o cambie un control hay que reflejarlo en `CONTROLS` de `src/ui/controls.ts`**; la ventana se genera a partir de esa lista. No hay reasignación de teclas.
- Interacción (`E`; saludar es `<`): `City.interactables` define puntos interactivos (pozo, NPCs). Los diálogos usan `src/ui/dialog.ts`: `openDialog` (líneas simples) y `openConversation` (árbol de nodos con respuestas del jugador; siempre se añade «[Salir de la conversación]» salvo `noExit`; las opciones admiten `when` y `action` para flags de misión). Los NPCs se declaran en `NPCS` de `src/main.ts` (nombre, aspecto, conversación) y su posición en `City.npcSites`; muestran placa verde (no hostiles). el NPC de prueba «Testículos, the Debugger» está junto a la casa más cercana al spawn. Los títulos de personaje están en `src/data/titles.ts`.
- Niveles y atributos: nivel máximo 50 (`MAX_LEVEL`). Se gana 1 punto de atributo cada 3 niveles (3, 6 … 48; `attributePointsAllowed` en `src/data/data.ts`), que se suma a los 2 de la creación (18 en total; tope 15 por atributo). Los puntos pendientes se calculan (permitidos − gastados) y se reparten con «+» en la ficha de personaje; el botón del menú de personaje muestra un «!» mientras haya puntos.
- Experiencia: `gainExperience(n)` en `src/main.ts` suma XP con destellos dorados, número flotante y barra brillante; si completa niveles (`experienceToNextLevel`) añade destello de pantalla, estrellas y cartel «¡Subes de nivel!». Se prueba con Testículos («Recibir 200 puntos de experiencia»).
- Muerte: al llegar la vida a 0 el personaje cae (animación `Death_A`), el mundo se apaga a grises y sale la pantalla «Has caído» con el botón (o `E`) «Reaparecer en la capital», que lleva al punto de inicio de Brumaluz con la vida completa (`die()`/`respawn()` en `src/main.ts`). Daño y curación pasan por `damagePlayer`/`healPlayer`.
- Menú de personaje (`Tab`, icono a la izquierda del menú del juego): Inventario con paneles de equipo y mochila, y un monedero inferior. La mochila tiene 25 huecos, contador de ocupación y una franja bloqueada para futuras ampliaciones; los objetos muestran su icono ilustrado y cantidad, sin repetir el nombre en cada hueco. Las 10 ranuras de equipo rodean un muñeco giratorio: cabeza, colgante, torso, manos, anillo, arma, mano izquierda, piernas, pies y abalorio (constantes en `src/data/inventory.ts`). En móvil los paneles se apilan. Pulsa una pieza equipada para guardarla en la mochila, o un objeto equipable de la mochila para equiparlo; conserva su tooltip y cambia en el modelo local, retratos y jugadores remotos. La mochila llena impide desequipar sin perder nada. Se mantiene el clic para usar consumibles y el arrastre a la barra rápida. Ficha de personaje e inventario en `src/ui/playerWindows.ts`. Las monedas (Pelines y Lágrimas de fénix, premium) están descritas en [docs/CURRENCY.md](docs/CURRENCY.md).
- Tras devolver el distintivo de Gnomi aparece Isberto junto al jugador y abre automáticamente la oferta **Una sombra junto a la fragua**. Acepta, derrota a la criatura y usa `E` junto al cuerpo o pulsa su modelo para abrir un panel de botín compacto sobre el mundo. Otra pulsación de `E`, un clic en el objeto o **Recoger todo** permite recoger una **Esencia sombría**. Al agotarse el botín, el panel se cierra y el cuerpo desaparece sin volver a saquearse al reconectar. La esencia no revela todavía su significado. El diario y el rastreador tienen fondos translúcidos; las misiones completadas se despliegan desde su cabecera. Durante las conversaciones se puede arrastrar para girar la cámara sin alterar la vista de exploración. No hay botón de retirada; `Esc` solo libera el objetivo. El ataque exige arma principal de la clase, salvo Curación. Las habilidades de la barra muestran una recarga radial con cuenta atrás y aviso al quedar listas. Detalles en [docs/COMBAT.md](docs/COMBAT.md) y [docs/QUESTS.md](docs/QUESTS.md).
- Tooltips de objetos (`src/ui/itemTooltip.ts`): ficha compartida en mochila, equipo, barra rápida y comercio, al pasar el cursor o enfocar el objeto. Muestra icono, nombre, categoría, efectos, descripción y valor de venta, sin indicar apilado ni añadir «por unidad»; las estadísticas se muestran si el objeto las define. Se coloca junto al objeto, preferentemente a la derecha, cambiando de lado si falta espacio y manteniéndose dentro de la pantalla. El catálogo `src/data/items.ts` contiene `category`, `effects` y `stats` para ampliar la ficha sin duplicarla en cada ventana. La poción restaura el 5 % de la vida máxima y se vende por 5 pelines; los precios y efectos reales siguen siendo autoritativos en `supabase/server/`. Los tooltips normales conservan su formato breve.
- Cierre actual de la historia: tras derrotar a la criatura hay que hablar con Isberto; Gnomi interviene y ninguno sabe qué era. Después se vuelve con Gnomi a la plaza del pozo y se habla con él para quedarse allí. El progreso se conserva al reconectar, Gnomi deja de seguir al terminar y no se ofrecen más misiones. Recoger la esencia es independiente de ese cierre y no resuelve el misterio.
- Puesta en escena: tras entregar el distintivo se ve llegar a Isberto andando antes de su oferta automática. Durante la breve llegada la cámara lo sigue y no se puede mover al jugador ni abrir menús. En conversaciones con varios NPC, el jugador gira y la cámara reencuadra hacia quien habla, conservando los controles de exploración al terminar.
- El canal Grupo del chat usa un tono melocotón cálido en los mensajes, etiquetas, filtro y selector de escritura, diferenciado del azul claro de Zona.
- El icono de pelines comparte dibujo y estilos de moneda, estrella y brillo entre monedero, comercio y tooltips; la cabecera de Equipo usa una coraza ilustrada.
- La ficha de personaje organiza el retrato con insignia de nivel, identidad y título, estado del personaje y tarjetas ilustradas de atributos. Cada atributo muestra su valor y descripción, sin tooltip redundante ni desglose numérico de base, raza y puntos asignados. Vida, maná/estamina y experiencia sí tienen tooltips explicativos, accesibles con ratón y teclado. Los puntos pendientes se distinguen de los confirmados y conservan el reparto reversible antes de guardar, sin perder la posición de lectura ni el foco al ajustar atributos. La ficha no muestra sobrecuración; incluye la experiencia restante para el siguiente nivel (o el nivel máximo alcanzado). La cuadrícula se adapta a móvil y se genera desde el catálogo de atributos para futuras ampliaciones.
- Opciones → Vídeo incluye el mismo selector de gráficos normales/compatibles de la pantalla de acceso, con aviso de recarga; ambos controles usan el mismo cambio de modo.
- Sin tamaño personalizado guardado, el chat ajusta su anchura al espacio entre la barra rápida centrada y el margen inferior derecho, con 12 px de separación. En pantallas sin espacio lateral suficiente conserva un ancho compacto. El redimensionado manual sigue guardándose y prevalece sobre este ajuste automático.
- Comercio: cabecera con saldo, paneles de compra/venta, tarjetas ilustradas con efecto y precio, cantidades agrupadas y adaptación a móvil. Cada operación compra o vende una unidad. Testículos ofrece pociones minúsculas de vida, maná y estamina (10 pelines; venta por 5): restauran el 5 % del máximo, redondeando hacia arriba y sin superar el máximo. Las de recurso solo sirven para clases que usan ese recurso; recurso completo o incompatible no consume la poción. Catálogo y simulación local replican las reglas autoritativas de `supabase/server/`, que hay que aplicar al desplegar.
- **Pan duro**, primer consumible de comida: 4 pelines (venta por 2), +5 de vida máxima y +3 de maná/estamina máximos durante 15 minutos conectado. No cura ni rellena; otro pan renueva el tiempo sin acumular bonos. El efecto aparece encima de la barra rápida con icono, cuenta atrás y tooltip de origen/efecto; el tiempo se conserva al salir y se pausa sin conexión. Reglas de persistencia, expiración y fórmulas en [docs/STATS.md](docs/STATS.md). Requiere aplicar el SQL al desplegar.
- Entrar/volver al selector muestra un indicador de carga si tarda más de 180 ms, ampliado tras 1,5 s; desaparece también ante errores o cancelaciones y no bloquea los controles para salir. El aviso de interacción con E se sitúa por encima de la fila de buffs, tomando como referencia la altura real de la barra rápida.
- HUD del jugador (vida, maná/estamina, experiencia): las fórmulas son editables en
  `src/data/stats.ts` y están documentadas en [docs/STATS.md](docs/STATS.md).
- Minimapa (abajo a la izquierda, `src/ui/minimap.ts`): la ciudad se captura una sola vez desde arriba (`src/world/mapCapture.ts`) y el mapa no gira (norte arriba). Muestra tu personaje con una flecha y cono de visión, los NPC (punto verde, flecha en el borde si quedan fuera), brújula N/E/S/O, lugar y reloj con la hora del mundo. Zoom con +/− o la rueda; `º` lo oculta.
- Ciclo de día y noche (`src/world/dayNight.ts`): cada 10 minutos reales pasa una hora del mundo (un día dura 4 horas reales). La hora la marca el servidor (`public.world_clock()` y `server_config.world_clock` en `supabase/server/`) y llega con cada sincronización del mundo, así que todos ven la misma; `src/data/worldClock.ts` la deja correr entre respuestas y, sin conexión, la calcula con la misma fórmula. El cielo mezcla los HDRI de noche, alba, amanecer y día de `@pmndrs/assets` (solo su parte de cielo, girada con el sol); el sol sale a las 6:00 por el este y se pone a las 20:00 por el oeste, y de noche la luna da la luz y las sombras. Luces, niebla, exposición y reflejos (el propio cielo, prefiltrado cada pocos minutos del mundo) siguen a la hora; faroles y luciérnagas brillan de noche (las luciérnagas solo salen de noche, alrededor del jugador) y los pájaros se recogen; de día revolotean mariposas cerca del jugador. Los menús y los interiores usan siempre la luz del atardecer dorado (18:30). Para cambiar el ritmo o la hora de inicio, edita `world_clock` en la base de datos (y `SECONDS_PER_WORLD_HOUR`, `EPOCH` y `START_HOUR` para el modo sin conexión). Pruebas: `npm run test:daynight`.
- Habla: al enviar un mensaje público (General/Zona) sale un bocadillo con tu nombre sobre tu personaje y mueve la boca; los NPC (diálogos y comentarios) solo mueven la boca, sin bocadillo. La boca se anima en `src/character/head.ts` (`mouth`) y `Character.speak()`.
- Chat (esquina inferior derecha, `src/ui/chatWindow.ts`): ventana redimensionable (asa arriba-izquierda, se recuerda el tamaño) y minimizable, con filtros General (todo el servidor) / Zona (tu mapa) / Susurros / Sistema / NPC; el botón junto al campo de texto (o /g, /z) elige el canal de escritura. `Enter` escribe, `Esc` sale. Comandos: `/w ~cuenta mensaje` (susurro a una CUENTA; el `~` distingue el nombre de cuenta del de personaje), `/r` (responder), `/ignore` y `/unignore ~cuenta`, `/clear`, `/ayuda`. Clic en un nombre para susurrar a su cuenta. Solo los comentarios espontáneos cercanos de los NPC (`barks` en `NpcDef`) salen en el canal NPC; los diálogos de interacción y las respuestas del jugador no se registran en el chat. El servidor valida y reparte los mensajes (`chat_send`, tablas `chat_messages` y `chat_mutes` en `supabase/server/`; límite 200 caracteres y 5 mensajes/10 s). Para silenciar a alguien: `insert into chat_mutes (user_id, until) values ('<uuid>', now() + interval '1 day')`. Requiere ejecutar `supabase/server/` y tener Realtime activo en la tabla `chat_messages`.
- Cada entrada al mundo inicia un chat limpio: se reciben mensajes nuevos por Realtime, sin cargar mensajes anteriores ni los enviados mientras estabas fuera. Al salir se borran mensajes, borradores y destinatario de respuesta. Se conservan las preferencias del chat y las cuentas silenciadas; los avisos de sistema de la nueva conexión siguen mostrándose.
- El interruptor ambiental reanuda el contexto de audio del navegador y cancela activaciones anteriores al cambiar rápidamente. Al apagarlo fija la ganancia a cero y desconecta la salida de los altavoces, sin cola ambiental residual. En desarrollo se cierra el contexto anterior al sustituir el módulo para no acumular ambientes durante recargas en caliente. La suite de navegador exige silencio exacto al desactivar y mide la salida al activar, reanudar un contexto suspendido y cambiar el volumen general.

## Estructura del proyecto

```
src/
  main.ts          punto de entrada: bucle de juego, HUD y menús
  data/            datos y reglas: data, stats, inventory, currency
  world/           ciudad y entorno: city, env, paint, render, audio, load
  character/       personaje: character, head, portrait
  ui/              interfaz: i18n, controls, tooltip, classIcons, playerWindows, dialog
  services/        cuentas (Supabase) y ajustes
  styles/          style.css
  assets/models/   modelos .glb
docs/              documentación de sistemas (STATS, CURRENCY)
tools/             scripts de preparación de modelos
```

## Desarrollo

```bash
npm install
npm run dev     # servidor de desarrollo
npm run build   # genera dist/index.html (un único archivo)
```

### Compatibilidad gráfica

- Si la interfaz funciona pero el mundo o el creador aparecen vacíos, abre `https://brumaluz.vercel.app/?graphics=compatible`. El botón «Gráficos» en la pantalla de acceso y el creador permite alternar y recarga la página; guarda el personaje antes de cambiar de modo.
- El modo compatible conserva la ciudad, los personajes y el ciclo de día y noche, pero no usa reflejos del cielo, sombras ni posprocesado (oclusión ambiental y resplandor). Limita la resolución a 1920 × 1080 y reduce la captura del minimapa. Se activa automáticamente si falta `EXT_color_buffer_float`; no depende del modelo de tarjeta gráfica.
- El modo normal conserva los efectos, pero limita el renderizado a 2560 × 1440 para no multiplicar innecesariamente los buffers en pantallas de alta densidad.
- Si Chrome rechaza los atributos al crear WebGL 2, el arranque reintenta sin antialiasing y, si es necesario, con la selección de GPU predeterminada del navegador. Esto no activa el modo compatible ni desactiva los efectos normales. Los reintentos se registran en la consola; solo se muestra el error si ninguno permite crear el contexto. Cuando el contexto no usa antialiasing, tampoco se fuerza MSAA en los buffers del posprocesado o los retratos.
- Una pérdida del contexto WebGL o un fallo de shaders muestra un aviso con opciones de recarga, en lugar de dejar solo el mundo vacío. Si WebGL 2 no está disponible, el aviso indica comprobar la aceleración gráfica del navegador y el controlador; el modo compatible también necesita WebGL 2.
- Pruebas: `npm run test:graphics` compila y usa Playwright para comprobar ambos modos con ciudad y personajes, resolución, rechazo de atributos WebGL (antialiasing y preferencia de GPU), falta de texturas flotantes, pérdida de contexto y fallos de WebGL/shaders. Requiere un navegador instalado (Edge en Windows, Chromium de Playwright en otros sistemas); `PLAYWRIGHT_CHANNEL` permite elegir otro canal.

### Mundo multijugador

- El distintivo de ubicación bajo el minimapa muestra un pin y el nombre de la zona, un contador separado con icono de jugadores (incluido el tuyo) y una fila con el reloj del mundo; no hay un mensaje superior permanente. Al perder la conexión, el contador muestra un guion y el aviso de reconexión está disponible en su descripción y en el chat. El botón de gráficos está en la esquina inferior derecha fuera del juego, separado de los datos de cuenta.
- Las cuentas que entran en Brumaluz se ven en la misma ciudad, con su aspecto, nombre, título, movimiento interpolado, orientación, saludo, salto y estado de caída. Los mensajes públicos de jugadores presentes también aparecen sobre su personaje. La opción de mostrar nombres afecta tanto a NPCs como a jugadores.
- Al pasar el cursor por un personaje se muestra su detalle arriba, centrado. La zona del cursor cubre el cuerpo con un margen de 8 px, sin depender de las animaciones ni de acertar entre sus triángulos. Si el cursor no señala a nadie, la dirección horizontal de la cámara selecciona personajes delante del jugador en un cono de 10°, independientemente de la inclinación de la cámara o la altura del modelo, siempre que estén en pantalla. Un pequeño margen angular al mantener el objetivo evita cambios nerviosos entre personajes próximos. Tanto cursor como cámara solo muestran personajes a 10 m como máximo desde el personaje local (no desde la cámara), y la tarjeta se oculta al superar ese límite. Se comprueba la visibilidad de torso/cabeza para no mostrar a través del escenario; no cambia la interacción con E ni selecciona permanentemente un objetivo. Se oculta con menús, conversaciones, muerte o salida del mundo y no depende de la opción de nombres flotantes.
- El panel es compacto y usa la tipografía del HUD propio: nombre, nivel en texto dorado sin insignia, título equipado debajo, clase en el icono y `~usuario`. Las barras solo muestran cifras de vida y maná o estamina; sus etiquetas siguen disponibles para lectores de pantalla. Las cifras y máximos vienen del servidor, incluidos los atributos asignados sin revelar esos atributos. Los títulos reservados conservan su fénix.
- Los NPC amistosos tienen nombre verde, un título configurable por NPC y un tipo con icono propio en lugar de clase o cuenta; no se muestra la etiqueta «Personaje no jugador». Testículos usa el título «Depuración», con nivel 1, vida 100 y maná 100 definidos en su ficha de NPC. Los tipos de icono disponibles son depuración, comerciante y habitante, independientes del título; asignar un tipo no añade acciones por sí mismo.
- Una cuenta solo mantiene un personaje conectado al mundo: entrar desde otra pestaña o equipo sustituye la sesión anterior, que vuelve a la selección con un aviso. Una respuesta tardía o la salida de la pestaña antigua no puede expulsar la nueva sesión.
- [`world_join`, `world_sync` y `world_leave`](./supabase/server/) gestionan una concesión de sesión en `public.world_players`, inaccesible directamente desde el navegador. El servidor fija la identidad y el aspecto a partir del personaje guardado, y solo publica los datos necesarios para dibujarlo, nunca inventario, monedas ni atributos privados.
- Cada cliente envía una petición secuencial y obtiene la instantánea del mapa; espera 250 ms entre respuestas, sin peticiones de movimiento solapadas. Es una primera implementación para grupos pequeños, **no una infraestructura MMO a gran escala**: aumenta las consultas y escrituras de Supabase con los jugadores conectados y debe migrar a un servidor de simulación/difusión antes de crecer.
- Una salida normal elimina la presencia y guarda la última posición validada. Si el navegador se cierra, se suspende o pierde la red, los demás dejan de verlo a los 15 s sin latido. La reconexión se reintenta con aviso visible, sin apropiarse automáticamente de una sesión sustituida.
- Aún no hay PvP ni colisiones entre jugadores. La validación de velocidad y límites del mundo no sustituye las colisiones autoritativas del mapa.
- Antes de publicar este cliente, aplica la versión actual de [`supabase/server/`](./supabase/server/). `npm run db:apply` ejecuta la actualización completa en una transacción y recarga la API al confirmar; no cambia `debug_actions` si ya estaba configurado.
- Pruebas del navegador: `npm run test:world` usa cuentas ficticias en dos contextos aislados, con una API simulada interceptada (sin acceder a cuentas reales), y comprueba modelos 3D, nombres, movimiento, correcciones, salida, sustitución, reconexión y respuestas tardías. Usa el mismo navegador/configuración que las pruebas gráficas.
- Las entradas al mundo se serializan y las respuestas de acciones, títulos, puntos, chat y creación se descartan si ya se ha salido o cambiado de personaje/cuenta. Al salir se detiene el movimiento antes de esperar al guardado. Un fallo remoto al cerrar sesión se muestra incluso si Supabase ya ha eliminado la sesión local.
- Regresiones de cuentas: la suite anterior también comprueba doble entrada, títulos pendientes al cambiar de personaje, creación pendiente al volver a selección, cierre de sesión con fallo de red y datos antiguos de linaje/clase no válidos. El botón de gráficos no debe tapar el de cerrar sesión en la selección.
- Pruebas SQL: define `SUPABASE_TEST_DB_URL` y ejecuta `npm run test:world:db` contra una base de pruebas con el esquema de cuentas instalado. Aplica las funciones y crea fixtures únicamente dentro de una transacción que siempre se deshace. Para usar deliberadamente la base de `.env.local`, con permiso de su administrador: `npm run test:world:db -- --configured`. No lo hagas durante tráfico elevado: aunque no persiste cambios, la actualización transaccional bloquea brevemente objetos del esquema.
- Los fixtures SQL usan una zona ficticia única para no mezclarse con jugadores conectados. Se comprueban también posiciones JSON nulas, rechazo de ángulos no finitos y salida tardía tras borrar un personaje. Las operaciones de mundo bloquean primero los personajes y después su presencia para evitar invertir el orden durante salida, cambio de personaje y reaparición.

### Amigos y ventana Social

- Los amigos conectados muestran el nivel del personaje activo junto a su nombre; cambia con el personaje y se oculta al desconectarse. El servidor no comparte el nivel de solicitudes pendientes ni de cuentas desconectadas.
- La opción **Social** del menú de personaje abre los amigos de tu cuenta, compartidos por todos tus personajes. Se añaden por nombre de cuenta (sin correo ni nombre de personaje); la otra persona debe aceptar la solicitud. Las solicitudes cruzadas no se aceptan automáticamente.
- La ventana separa amigos, solicitudes recibidas y enviadas. Permite aceptar, rechazar, cancelar y eliminar amigos con confirmación; el botón de susurro está desactivado para amigos desconectados y, para conectados, cierra la ventana y prepara `/w ~cuenta` en el chat. El campo de invitaciones muestra un prefijo `~` fijo y admite pegar nombres con o sin él.
- Solo los amigos aceptados reciben el estado de conexión, personaje, clase y mapa actual. «Conectado» significa que está dentro del mundo y ha enviado un latido en los últimos 15 s, no simplemente que tenga la cuenta abierta. Las solicitudes pendientes no revelan presencia ni clase. El icono usa la clase del personaje conectado; desconectados y solicitudes muestran un escudo neutro.
- `friends_list`, `friend_request` y `friend_update` validan autenticación, participantes y consentimiento en el servidor. La tabla `friendships` no tiene acceso directo desde el navegador, y limita a 50 las solicitudes pendientes enviadas por cuenta.
- Mientras estás jugando se consultan las amistades cada 5 s, también con Social cerrado, para avisar de solicitudes recibidas y solicitudes enviadas que pasan a aceptadas. Los avisos aparecen en una alerta y en el chat; las peticiones pendientes mantienen una exclamación tanto en Tab como en la opción Social. No se repiten con cada consulta. Al salir se detienen los avisos y se descartan respuestas tardías; las consultas simultáneas de las ventanas comparten petición.
- Social organiza amigos e invitaciones en tarjetas de pergamino, sin cabecera ornamental grande: el total de amigos incluye los conectados entre paréntesis, junto al contador de solicitudes recibidas. Personaje y ubicación tienen etiquetas explícitas y comparten una fila en escritorio. Los amigos conectados aparecen primero y cada grupo se ordena por nombre de cuenta; las solicitudes recibidas y enviadas se muestran en columnas en escritorio y apiladas en pantallas pequeñas. El contenido largo tiene desplazamiento sin tapar los controles. El refresco periódico no desactiva botones ni reconstruye secciones sin cambios, conservando borradores y foco sin parpadeos.
- Las pestañas **Amigos** y **Grupo** se pueden seleccionar con clic o flechas. Al abrir Social estando en un grupo se selecciona Grupo por defecto. Los botones de los menús muestran sus teclas **Esc** y **Tab**.
- `npm run test:world` comprueba el flujo entre dos cuentas, susurros, presencia, eliminación, cierre durante carga y el fénix del título Reina. `npm run test:world:db` comprueba permisos, consentimiento, privacidad, límites y autorización del título mediante fixtures con rollback.
- Al acercarte a otro jugador (hasta 2,3 m), el aviso de interacción muestra su nombre. **E** abre un selector horizontal con iconos: **←/→** (o **A/D**) eligen y **E/Enter** ejecutan; también se puede pulsar un icono. **Esc/Tab** lo cierra. Compite por distancia con las interacciones de NPCs y objetos para conservar la acción más cercana.
- La ventana usa un marco de pergamino y medallones con ilustraciones SVG propias (escudos, carta con pluma y campanas). La acción seleccionada se destaca con relieve, un rombo y una etiqueta; respeta movimiento reducido y se adapta a pantallas desde 320 px.
- El selector permite enviar/aceptar/cancelar solicitudes, eliminar a un amigo con confirmación, preparar un susurro a su cuenta e invitar a grupo. Solo los no amigos muestran silenciar/reactivar chat: es local al navegador y comparte la misma lista que `/ignore` y `/unignore`, sin afectar al otro jugador ni al servidor.
- El selector se cierra si el jugador se aleja, desaparece o sales del mundo. Comprueba el estado de amistad antes de ejecutar para que una opción antigua de cancelar no elimine una amistad recién aceptada. Las respuestas tardías no reabren el selector.

### Grupos

- Hasta **4 personajes** conectados. Solo el líder puede invitar, desde la interacción con otro jugador o por nombre de cuenta en **Social → Grupo**. La otra persona debe aceptar o rechazar; las invitaciones caducan a los 90 s y se anuncian con alerta y exclamación en Social.
- El líder recibe una alerta y un mensaje de sistema cuando aceptan o rechazan su invitación. Las respuestas se entregan una sola vez mediante una cola privada, disponible durante cinco minutos. Si rechazan la última invitación y solo quedaba el líder, se elimina ese grupo provisional; no se disuelven grupos con compañeros ni se cancelan otras invitaciones pendientes.
- Social muestra integrantes, clase, nivel, vida, maná/estamina, líder, invitaciones pendientes y la opción de salir. Bajo tu HUD aparecen tarjetas compactas de los otros integrantes; el líder lleva una corona. Los compañeros del mismo mapa se marcan en el minimapa en azul, o dorado si lideran el grupo.
- La pestaña Grupo usa un escudo de expedición, cuatro rombos de ocupación, sellos de bonificación y tarjetas heráldicas en dos columnas (una en móvil), con invitaciones en forma de carta. El campo de cuenta incluye el prefijo `~`. Las tarjetas del HUD son de hasta 174 × 44 px (150 px de ancho en móvil), conservando clase, nombre, nivel, corona y ambas barras.
- Al salir del grupo o del mundo se abandona el grupo. Una desconexión sin salida limpia la pertenencia al caducar la presencia (15 s). Si sale el líder, le sucede el siguiente integrante por orden de entrada. Cambiar de personaje no conserva la pertenencia.
- Con al menos dos integrantes hay **+2 % de experiencia fijo**, independientemente del tamaño; vida y maná/estamina máximos aumentan **1,5 % por compañero**, sin contarse a uno mismo: +1,5 %, +3 % o +4,5 %. Se redondean los máximos hacia abajo. Un grupo de una sola persona no tiene bonificación. Actualmente la única fuente de XP es `debug_xp`: concede 204 en grupo y 200 a solas.
- La pestaña de chat **Grupo** y los comandos `/p`, `/grupo` o `/party` envían mensajes privados al grupo. El servidor limita cada mensaje a sus destinatarios originales que sigan perteneciendo al grupo; los nuevos integrantes no pueden consultar mensajes anteriores. No genera bocadillos públicos.
- `party_state`, `party_invite`, `party_respond` y `party_leave` validan consentimiento, liderazgo, presencia y capacidad en el servidor; las mutaciones se serializan. El cliente consulta el estado cada 2 s y descarta respuestas de sesiones anteriores. `partyPeers` es un dato transitorio calculado por el servidor, no una bonificación guardada ni un valor confiado al cliente.
- `npm run test:world` prueba cuatro cuentas aisladas, invitaciones, pestaña predeterminada, HUD, minimapa, chat privado, salida y relevo. Las pruebas SQL con rollback comprueban además permisos, límite de cuatro, caducidad de presencia, privacidad y fórmulas de bonificación.

Tecnología: Three.js + TypeScript + Vite.

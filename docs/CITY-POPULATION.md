# Población ambiental de las ciudades

28 de octubre de 2026. El usuario pide habitantes que paseen, se sienten y
hablen entre ellos, empezando por Brumaluz, con posibilidad de participar en
misiones futuras. Esta implementación sigue la acogida, los distintos pueblos
y la vida de barrio de [LORE.md](LORE.md), el tono de
[DIALOGUES.md](DIALOGUES.md) y los cuerpos, vestuario y animaciones existentes.

## Primera implantación

La primera versión tenía 18 habitantes. El usuario pide ampliarla sin perjudicar
el rendimiento: Brumaluz pasa a **54 habitantes**, repartidos por nueve recorridos, con seis
personas por zona: Levante, casco antiguo, jardín, artesanos, huertas, Lonja,
Telares, Olmo y ronda del noroeste. Los paseos alcanzan los barrios del norte
y del sur en lugar de concentrarse en calles del centro. Hay humanos, elfos, Lagto' y Pelsos,
con apariencias y colores propios y sin armas. Se utiliza la ropa medieval y
el vestuario compatible del catálogo actual; no se importan las bibliotecas
reservadas a Rusty Hearts o La Arboleda.

El ajuste posterior del usuario pide **nombres personales**. Tras probar las
etiquetas de aficiones y paseo, el 30 de octubre pide subtítulos más genéricos
y compartidos: los 54 usan **Habitante de Brumaluz**, sin títulos personales.
Los nombres y los títulos funcionales de los personajes de historia y maestros
se conservan. Las fichas usan
nombres del mismo catálogo ampliado del creador (`characterNames.ts`): 18 292
opciones entre los cuatro linajes, conservando las sílabas anteriores.
Los IDs técnicos se conservan. Apariencias, recorridos, tiempos y réplicas
siguen siendo revisables; no añaden biografías, maestros, instituciones ni acontecimientos.
Gnomi, Isberto y los maestros conservan sus comportamientos y misiones.
La placa muestra el nombre personal y, debajo, el subtítulo; este último se
traduce al cambiar el idioma, también en la ficha y el diálogo.

Los habitantes ambientales **no aparecen en el mapa de zona ni en el
minimapa**, ni se etiquetan como puntos de interés. Conservan su placa,
ficha de objetivo e interacción al encontrarlos. Los servicios y demás NPC
mantienen sus marcadores.

Los habitantes alternan entre caminar, detenerse, descansar en un banco y
conversar con un vecino cercano. Cada recorrido se comprueba contra las
colisiones y alturas del mapa. El planificador evita el agua; no atraviesa
edificios ni teletransporta al NPC si no encuentra un camino. Reintenta tras
una pausa. Solo se calcula un recorrido por fotograma y se conserva una caché
limitada de caminos. Las búsquedas ambientales continúan entre fotogramas;
no bloquean un fotograma hasta terminar todo el camino. `crowdMovement.ts` comprueba el trayecto de cada paso,
anticipa el cruce con otros cuerpos y permite rodearse por la derecha. En un
paso estrecho, las prioridades estables permiten retroceder a quien cede.
Se respeta el espacio del jugador y los NPC de historia o servicio. Una
obstrucción prolongada cancela el paseo y permite reintentarlo. Cancelar
una reserva de banco durante la aproximación ya no desplaza al NPC al banco;
al levantarse busca un punto de salida despejado, también respecto a los NPC
de historia y servicio. Si todas las salidas están ocupadas o en agua, espera
sentado y conserva la reserva hasta poder salir. Hablar con él y reanudar su
rutina respetan esa espera.

La corrección del 30 de octubre aborda los choques repetidos y los tirones
observados al pasear. Los recorridos dejan **12 cm adicionales** junto a los
obstáculos, con la misma tolerancia de colisión al planificar y al caminar.
Los paseantes eligen una banda a la derecha según su dirección y pequeños
desfases de llegada; no se concentran todos en el centro de un mismo destino.
La evasión conserva la dirección anterior y anticipa la distancia mínima del
cruce, en vez de escoger un lado nuevo en cada fotograma.

La detección de atasco mide el avance hacia el siguiente punto: moverse unos
milímetros de lado no reinicia el contador. Tras **1,8 s sin avance** o **0,75 s
bloqueado**, puede recalcular evitando personas detenidas; si no hay paso,
se detiene un momento y elige otro tramo, sin empujar ni teletransportarse.
Los reintentos se espacian y la animación usa velocidad suavizada con umbrales
distintos para arrancar y parar, evitando alternar reposo y marcha continuamente.

El siguiente ajuste ordena los tramos lineales para recorrer sus paradas de
ida y vuelta, cambiando de dirección solo en los extremos. Los circuitos,
como el jardín, conservan su trazado. Una charla o un diálogo guardan el
destino pendiente para que el vecino retome ese tramo, sin saltarse una parada
ni cambiar de rumbo por haber hablado.

Los asientos se reservan desde la aproximación. Cada banco deja una plaza
libre y nunca se ocupa el sitio de un jugador sentado. Los lugares reservados
desaparecen de la interacción «Sentarse». Se reutiliza `Sit_Chair_Idle` y el
ajuste de altura del personaje. El paso final al asiento y la salida al punto
delante del banco son ajustes cortos, como la interacción actual del jugador.
Antes del paso final se vuelve a comprobar que ninguna persona esté en el
sitio reservado; si alguien lo ocupa, cancela la aproximación y libera la plaza.

Las charlas nacen durante una pausa, con dos participantes a **1,2–2,8 m**,
que se giran suavemente para mirarse y alternan réplicas breves. Se evita detenerlos ante un tercer
peatón que ya está pasando. La memoria de escenas es independiente del ciclo
del paseo: una persona descansa al menos **90 s** entre charlas y una misma
escena espera **180 s** antes de volver a ser elegible. Si no hay una adecuada,
no se fuerza otra réplica. Las referencias locales tienen un ancla y un radio
que deben cumplir ambos interlocutores.

Solo habla la boca del interlocutor correspondiente. Boca, bocadillo y ritmo
de charla comparten duración, incluyendo ambas traducciones y una pausa de
0,45 s antes de responder. Se oyen como texto en el
canal **NPC** cuando el jugador está cerca y en un **bocadillo sobre su cabeza**.
La petición se aplica a todos los NPC: residentes, Gnomi, Isberto, maestros y
personaje de depuración. `chatNpc` notifica al presentador común, de modo que
el texto del chat y el bocadillo coinciden; los árboles de diálogo mantienen
su ventana habitual. Los bocadillos siguen la cabeza animada, respetan la
visibilidad, la distancia y la oclusión, y desaparecen al caducar o cambiar
de mapa o personaje. También funcionan con las placas desactivadas.

Se reduce la frecuencia: primer encuentro ambiental tras al menos 18 s e
intervalo global de **45–70 s** entre charlas; los comentarios espontáneos
de otros NPC usan **65–110 s** por interlocutor, con al menos **12 s** entre
comentarios espontáneos de distintos NPC. Solo se emite uno por revisión y
el presentador común anima la boca una sola vez. Los comentarios y las charlas
comparten las pausas: muerte, viajes, diálogo, escenas, menús, comercio,
interacción con jugadores, acciones ocupadas y pestaña del navegador oculta.
Las charlas se interrumpen al alejarse o entrar en esas pausas; los comentarios
espontáneos y el comienzo de las charlas comprueban que no haya una pared
entre el interlocutor y el jugador. No se reproducen conversaciones lejanas
ni se añade un historial.
Las 18 escenas se refieren a saludos, descanso, orientación y dudas cotidianas
de oficios y barrios. No atribuyen bolsas, cestas, herramientas, labores u
otros objetos que el modelo no lleva, ni presuponen que caminan o trabajan
juntos. No prometen encargos ni recompensas. Incluyen inglés. Las ocurrencias
del NPC de depuración no se emiten automáticamente junto a esta población.

El jugador puede hablar con cada habitante con **E** o clic, usando el diálogo,
la cámara, la placa verde y la ficha de objetivo habituales. Al acercarse por
clic, el destino sigue la posición del vecino. La conversación detiene su
rutina y libera al compañero. Libera también el asiento cuando puede salir
con seguridad; al terminar, retoma su paseo después de una pausa o espera
sentado hasta que se despeje la salida.

## Presupuesto de población

Se conservan los 18 habitantes iniciales y se añaden 36 fichas con nombres,
aspectos y subtítulos propios. Los seis puntos de aparición de cada recorrido
son distintos y se comprueban contra las colisiones del mapa; no se apilan
personajes sobre un mismo punto. Se reutilizan las prendas y modelos actuales,
sin añadir GLB ni cambiar los personajes de la historia.

`populationPresentation.ts` separa la presentación de las rutinas. Se dibujan
solo habitantes dentro de la vista y próximos al foco del jugador o de la
cinemática. El límite es **24 modelos a 72 m en modo normal** y **16 a 56 m en
modo compatible o móvil**. Los modelos ocultos salen del árbol de la escena,
evitando también el recorrido de sus huesos y matrices. Recuperan el mismo
personaje al volver a entrar en la vista; conservan identidad y actividad.

Hasta 14 m, la animación se actualiza en cada fotograma. Entre 14 y 32 m se
limita a 15 Hz y, más lejos, a 10 Hz. Solo los habitantes a menos de 22 m
proyectan sombras en modo normal. Los diálogos, charlas activas y suspensiones
de escena tienen prioridad para conservar sus actores visibles y animados.
Fuera del juego, los habitantes no se dibujan ni animan en el creador.
La cámara de diálogo solo consulta los NPC visibles que siguen en la escena;
los modelos retirados por distancia no generan obstáculos invisibles ni
recorridos de huesos adicionales para buscar el encuadre.

Las rutinas ocultas a más de 48 m avanzan a 5 Hz; cerca del jugador y para
**todos los habitantes que se dibujan**, la posición avanza cada fotograma.
Así, los visibles entre 48 m y el límite de dibujo no saltan entre posiciones
de una simulación de 5 Hz. Una rejilla espacial consulta únicamente los cuerpos de las celdas
vecinas. Los pasos sin vecinos cercanos prueban primero el movimiento directo
contra el mapa, evitando calcular nueve desvíos en una calle despejada. Se
mantiene un solo cálculo de camino por fotograma, las colisiones, las reservas
de bancos, la frecuencia global de conversación y la ausencia de marcadores.
La caché de espacio libre está limitada a 8.192 puntos por mapa. Los caminos
ambientales exploran hasta 900 nodos por intento; las escenas conservan su
presupuesto anterior. Cada fotograma continúa un único trabajo, con hasta
32 pequeños pasos de búsqueda y un objetivo de 1,5 ms antes de ceder el turno.
El habitante espera quieto hasta recibir la ruta; hablar con él o viajar cancela
su trabajo pendiente. Se prefiere una pausa corta a agotar una búsqueda larga
en un solo fotograma. La versión síncrona utilizada por las escenas conserva
el mismo resultado y no aplica este reparto de trabajo.

La revisión reproducible `node tools/review-population-performance.mjs` mide
la ciudad real en Levante, centro, jardín y ronda, con el mismo encuadre y
resolución. Guarda datos y capturas en `art/population-review/performance/`.
Se conservó una referencia de la versión de 18 habitantes antes del cambio.
Los tiempos de CPU y las llamadas de dibujo son mediciones locales; la tasa
de fotogramas del navegador con renderizado por software no equivale a la de
una GPU real. Las pruebas exigen los límites de modelos y de actualización,
en vez de imponer un valor de FPS dependiente del equipo.

En la comparación local a 1280 × 800 en modo compatible, la versión inicial
actualizaba los 18 esqueletos en todos los fotogramas; con 54 habitantes se
actualizaron entre 4 y 8 en los cuatro encuadres. El promedio de animación y
rutinas pasó de 1,45 a 0,60 ms por fotograma, más 0,06 ms para seleccionar la
presentación. Son datos de las capturas guardadas, no una garantía de FPS.
`--normal` permite comprobar además el jardín con sombras y el presupuesto
de modo normal.
`--fixes` guarda una medición adicional con sufijo propio, conservando las
referencias anteriores.

## Fichas, recorridos y futuras misiones

- `src/data/npcs.json`: fichas persistentes de aspecto, nombre, subtítulo y
  estadísticas. Se editan en `/npcs.html`; sus IDs de mundo están protegidos
  contra eliminación desde el taller. El modo **Sentarse · banco de la ciudad**
  permite revisar la pose sobre el mismo banco que usa el juego.
- `src/data/characterNames.ts`: catálogo compartido de nombres por linaje,
  reutilizado por `randomName` en el creador y por los habitantes.
- `src/data/cityPopulation.ts`: IDs estables, identidades, población por mapa, recorridos,
  saludos individuales y conversaciones entre vecinos. Las ciudades sin
  configuración no reciben habitantes automáticamente.
- `src/world/population.ts`: controlador reutilizable de rutinas, recorridos,
  reservas y conversaciones. `populationSites()` aporta posiciones iniciales;
  un marcador de NPC ya colocado en el mapa tiene prioridad para esa posición.
- `src/world/populationNavigation.ts`: margen de seguridad, caché de espacio
  libre y búsquedas que pueden continuar entre fotogramas. Los bloqueadores
  detenidos se capturan al comenzar una recuperación de camino.
- `src/world/populationPatrol.ts`: prepara el orden de los paseos lineales y
  conserva los circuitos, sin reescribir las posiciones del mapa.
- `src/world/populationConversations.ts`: elige escenas por proximidad y
  memoria reciente, sin ligarlas al contador de movimiento.
- `src/data/speech.ts`: duración compartida de boca, bocadillo y turnos.
- `src/game/cities.ts`: carga diferida de modelos, colocación e instancia
  `cityPopulation` del mapa actual. Al viajar, se desmontan las rutinas y placas
  anteriores y se liberan asientos; los interiores no heredan los vecinos.
- `src/story/npcs.ts`: conversaciones normales de los residentes. Pueden
  sustituirse por árboles con condiciones y acciones del sistema de diálogo.

Una misión o escena futura puede obtener el actor por su ID en `npcActors`,
llamar a **`cityPopulation.hold(id)`**, dirigirlo mientras la rutina está
suspendida y ejecutar la función devuelta para liberarlo al terminar. Las
suspensiones anidadas son independientes; liberar dos veces la misma no
reactiva prematuramente al actor. No se añaden misiones, marcas de progreso,
objetos, XP, monedas ni acciones de servidor por pasear o conversar.

La simulación es **ambiental y local a cada cliente**: los jugadores comparten
las fichas y los sitios iniciales, pero todavía no sincronizan horarios,
posiciones, charlas ni reservas. Una misión futura con consecuencias compartidas
necesitará validación y, si corresponde, simulación de servidor; el estado de
esta rutina no debe utilizarse para conceder recompensas.

## Comprobación

`npm run test:population` valida las fichas, los cuatro linajes y las posiciones
contra el mapa y las colisiones reales de Brumaluz. Simula paseos, descanso,
charlas, exclusión mutua de asientos, silencio, suspensiones anidadas,
reanudación y desmontaje. Comprueba separación entre cuerpos, cruces en
calles abiertas y estrechas, y los nombres contra las reglas del servidor.
Incluye regresiones de salidas bloqueadas al descansar o hablar, personas
ocupando el destino final del asiento y charlas al otro lado de una pared.
La regresión de movimiento simula tres minutos a 30 Hz con los habitantes
visibles, exige pocas alternancias de marcha/reposo y giros bruscos, y comprueba
el margen alrededor del pozo y el desplazamiento continuo de los visibles
lejanos. La reproducción inicial detectó hasta **453 alternancias y 244 giros
bruscos** por habitante; la primera corrección los redujo a **10 y 12**,
respectivamente, en la misma simulación.

`node tools/review-population-movement.mjs` comprueba además la ciudad del
juego, sus colisiones de profesiones y los personajes reales. Recorre pozo,
jardín, Levante y huertas con rutinas a 30 Hz, comprueba separación y colisión,
registra cambios de marcha, trayectorias y coste de CPU y conserva el límite
de 16 modelos en compatible. Sus capturas e informes quedan en
`art/population-review/movement/`. La simulación controlada excluye el coste
de GPU y no equivale a una medición de FPS del equipo del jugador.
En la revisión local tras ordenar los paseos y simplificar las charlas, las
rutinas promediaron **0,49 ms por paso**, con percentil 95 de **1,7 ms** y un
máximo de **8,1 ms**. Se dibujaron como máximo 10 habitantes en esos encuadres
y no se detectaron solapamientos ni penetración
en los obstáculos comprobados. Son medidas de esa ejecución, no límites de
tiempo garantizados para cualquier equipo.

`node tools/review-population.mjs` abre el taller de NPCs y el juego con
personajes locales de prueba, sin escrituras remotas. Revisa los cuatro linajes,
la pose sentada, los nueve recorridos, la ausencia de residentes en la fuente
común de ambos mapas, el diálogo a escritorio y 390 px y la ida y vuelta desde
un taller. Comprueba bocadillos de habitante, guía, depuración, herrero y maestro,
y su limpieza al viajar. Las capturas y el informe quedan en
`art/population-review/expansion/`. La revisión anterior se conserva en
`revision-2/`. `--speech` permite repetir solo los
bocadillos, los marcadores y los cambios de mapa.
`--fixes` conserva una revisión adicional en `art/population-review/bugfixes/`:
también comprueba en el juego las pausas de los comentarios espontáneos,
la oclusión, el intervalo global y los obstáculos de la cámara de diálogo.
`--dialogue` concentra la revisión en el encuadre del diálogo y guarda
sus resultados en `art/population-review/dialogue/`. El encuadre espera a que
termine la transición y exige que las cabezas de ambos interlocutores queden
dentro de la pantalla y por encima de la ventana, en escritorio y a 390 px.
`--content` guarda la revisión de subtítulos y guion en
`art/population-review/content/`: comprueba el subtítulo compartido en el
editor y el juego, su traducción, las 18 escenas y el silencio automático del
personaje de depuración. Se puede combinar con `--dialogue` para repetir solo
la parte del juego sin cargar todos los modelos del editor.

Compilación: `npm --ignore-scripts run build`, para conservar los catálogos
generados existentes del proyecto.

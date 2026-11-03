# Experiencia cozy: artesanía, construcción y vida de barrio

Revisión del 28 de octubre de 2026. La dirección confirmada por el usuario es
**cozy crafting and building**, con combate dentro de esa experiencia.
Las prioridades y entregas de este documento son **propuestas**; las decisiones
del mundo y los sistemas aprobados se conservan en [LORE.md](LORE.md) y en sus
documentos específicos.

**Seguimiento del 30 de octubre:** el usuario concreta la habitación de la posada
como primera casa, pide un menú de viviendas y fija casas con espacio predefinido.
La personalización se hace con mobiliario, sin construcción modular ni ampliaciones
libres. También encarga los modelos nuevos, el inicio artesanal y la vida de barrio.
La implementación local y sus comprobaciones están en
[Viviendas y vida cotidiana](HOMES-AND-COZY-LIFE.md). Los conteos de esta auditoría
son la fotografía anterior a esa ampliación.

## Diagnóstico

Brumaluz ya tiene una base considerable para recolectar y fabricar. Lo que
necesita desarrollar con más fuerza es el destino de ese trabajo: un lugar
que el jugador haga suyo, objetos que quiera usar y enseñar, vecinos a quienes
ayudar y proyectos que transformen de forma visible su vida cotidiana.

El siguiente recorrido propuesto es **explorar → reunir materiales → fabricar
algo deseado → construir o decorar → habitar y compartir → elegir otro proyecto**.
El combate aporta aventura, materiales y equipo; el progreso del hogar y los
oficios necesita también recorridos cotidianos que funcionen por sí mismos.

La mayor oportunidad está en completar ese recorrido antes de ampliar regiones,
rareza de equipo o cantidad de sistemas. Una habitación agradable con decisiones
reales de decoración puede aportar más a esta dirección que otra colección de
armas. Después, la construcción debe permitir modificar también el espacio.

## Estado contrastado con el repositorio

Estos datos describen el contenido local revisado, incluidas modificaciones
existentes. Una función implementada no equivale a una experiencia validada con
jugadores ni a una publicación comprobada hoy en el servidor.

| Área | Base existente | Carencia principal para esta dirección |
| --- | --- | --- |
| Mundo y bienvenida | Brumaluz acogedora, Gnomi, Isberto, cama y banco; iniciación posterior a un oficio | Continuidad cotidiana después de la iniciación; la continuación del misterio sigue aplazada |
| Artesanía | 12 oficios, 441 recetas, maestros, pergaminos consumibles, maestrías y trabajos sin conexión | Más productos que permitan expresar gustos, usar la casa y ayudar a otros |
| Recolección | 216 nodos; disponibilidad personal, herramientas, energía y guía de fuentes | Comprobar recorridos tranquilos y su ritmo, financiación y exposición a enemigos |
| Mobiliario | 24 muebles: taburete, mesa, biblioteca y estación, cada uno en seis calidades | Variedad de funciones y siluetas, combinaciones y uso cotidiano |
| Colocación | Muebles persistidos por personaje, colocación delante de él, recogida y estaciones utilizables | Previsualizar, mover, girar y reorganizar con comodidad; construcción del espacio |
| Alojamiento | Interior habilitado de Isberto, con límite de 30 muebles en el resolvedor SQL | Reglas de espacio personal, acceso, visitas y ampliaciones |
| Vecinos | 54 habitantes de Brumaluz con paseos, bancos y conversaciones; maestros con voces propias | Vínculos y pequeños encargos con continuidad; las rutinas ambientales son locales a cada cliente |
| Juego social | Amigos, grupos de hasta cuatro, chat, intercambio y combate compartido | Actividades compartidas de artesanía y vida cotidiana, visitas y proyectos conjuntos |
| Misiones | Bienvenida, Isberto, iniciación, encargos diarios y comienzo del polvo de hada | Integrar misiones reutilizables en el juego; el editor prepara y ensaya fichas, su catálogo está vacío |
| Presentación | Creador amplio, ropa cotidiana, música horaria, ambiente, agua y opciones de movimiento reducido | Reutilizar esa calidad en fabricar, colocar, habitar y compartir |

Evidencia principal: [estado RPG](RPG-IMPLEMENTATION.md),
[talleres](PROFESSION-WORKSHOPS.md), [iniciación](PROFESSION-TUTORIAL.md),
[recursos](RESOURCES-ART.md), [población](CITY-POPULATION.md),
[editor de misiones](QUEST-EDITOR.md),
[catálogo RPG](../src/data/generated/rpg-catalog.json),
[interfaz de casa](../src/ui/professionsWindow.ts),
[presentación de muebles](../src/world/professionWorld.ts) y
[acciones SQL de profesiones](../supabase/server/20-professions.sql).

## Prioridades propuestas

### P0. Un rincón propio que apetezca cuidar

Decisión posterior del usuario: la habitación de la posada Lucero del Alba es
la primera vivienda. Se consulta en Mis viviendas y conserva su tamaño y
distribución. La casa de Isberto mantiene su acogida y los muebles que ya tuviera
el personaje. La adquisición de otras casas sigue pendiente.

Primera entrega sugerida: un espacio pequeño con cama, almacenaje y lugar para
un taller, más tres objetos fabricables que el jugador elija y conserve.
El objetivo es poder reconocer «esto lo he hecho yo» y disfrutarlo al volver.

La colocación necesita un modo claro con vista previa, señal de espacio válido,
giro, movimiento de piezas existentes, ajuste opcional y recuperación de objetos.
Cancelar debe conservar el objeto; mover algo no debe exigir fabricarlo otra vez.
El servidor debe mantener propiedad, revisión, límites y pasos despejados.

**Se considera lista** cuando se puede fabricar, colocar, reorganizar y usar el
rincón, salir y reconectar conservándolo, sin perder objetos ni bloquear la puerta.
La revisión visual debe hacerse en el editor aplicable y en el juego real.

### P0. Empezar y continuar por una vía artesanal tranquila

La iniciación ya existe. Conserva la herramienta de 20 Pelines, el pergamino de
componente de 50 y las acciones normales. La bienvenida entrega 5 Pelines.
Hay bolsas explorables, venta, comercio y suministros diarios; esas alternativas
impiden afirmar que haya que combatir necesariamente para financiarse. Falta
demostrar una ruta guiada y repetible desde el saldo real, también para quien
ya recogió las bolsas y juega sin compradores.

La entrega de la iniciación consume una de las tres entregas diarias compartidas.
Con el cupo agotado, el aprendizaje queda esperando la renovación a las 00:00 UTC.
Conviene proponer un cierre de aprendizaje que pueda completarse ese día y
decidir por separado cómo conservar los límites de ingresos. Cambiar esa regla
requiere revisar el acuerdo vigente; aquí no se añade una cuarta entrega.

El tutorial de fabricación termina entregando sus dos componentes. Un siguiente
objetivo podría usar el oficio para obtener un objeto propio: un mueble, ropa
o provisiones que el jugador haya elegido. Las compras y los pergaminos
consumibles siguen ofreciendo valor; no se propone sustituirlos por regalos
automáticos.

**Se considera lista** cuando un personaje puede aprender y fabricar algo para
sí sin depender de regalos, compradores conectados, una baja repetida o esperar
al siguiente día. La financiación, los viajes y las pausas deben medirse desde
el estado real de inicio, sin dinero añadido por el ensayo.

### P0. Decorar viviendas con espacio predefinido

El editor de mapas es una herramienta de desarrollo. Tener casas y piezas de
arquitectura en su catálogo no habilita un constructor para jugadores.

El usuario descarta la propuesta de ampliaciones y piezas modulares. Las casas
tienen tamaño y distribución predefinidos; la elección del jugador está en
amueblarlas, reorganizarlas y compartirlas.

La entrega necesita persistencia del mobiliario, colisiones y restricciones de
colocación coherentes entre cliente, servidor y visitas, conservando el acceso
a puerta, cama y cofre.

**Se considera lista** cuando dos jugadores pueden decorar de forma distinta
la misma vivienda base y conservar su mobiliario al reconectar.

### P1. Fabricar para vivir y expresar gustos

Ampliar primero las cuatro formas actuales con un conjunto coherente de objetos
que se usen juntos: iluminación, asiento, mesa, almacenaje, tejidos, plantas y
detalles de taller. La selección concreta y sus recetas quedan pendientes.
Las variantes deberían aportar diferencias visibles y posibilidades de combinar,
además del escalón de calidad.

Dar usos reconocibles a lo fabricado: sentarse en el propio asiento, encender
una lámpara, preparar una mesa o trabajar en el banco instalado. Descanso,
almacenaje, comida y estaciones ya ofrecen sistemas que se pueden conectar.
Una progresión de comodidad y expresión puede convivir con la potencia del equipo.

**Se considera lista** cuando una pieza nueva cambia cómo se ve o se disfruta
la casa y hay una siguiente meta comprensible, además de fabricar para vender.

### P1. Vecinos y cooperación cotidiana con consecuencias visibles

Dar continuidad a Gnomi, Isberto o unos pocos maestros antes de extender historias
a toda la población. Pequeñas peticiones relacionadas con el oficio y respuestas
a lo que hizo el jugador pueden construir vínculo. Nombres, historias, recompensas
y un posible sistema de amistad requieren diseño; los habitantes ambientales ya
existen y sus paseos no conceden progreso.

Primera actividad social sugerida: visitar un espacio y realizar una tarea corta
juntos, como preparar comida o aportar a una mejora. Debe poder continuarse a
solas y dar reconocimiento individual sin obligar a competir por el último aporte.
Construir conjuntamente añade permisos de edición, protección de objetos y
resolución de cambios simultáneos; puede venir después de las visitas.

Los proyectos de barrio son una posible expansión. Antes hay que decidir qué
cambios son personales y cuáles compartidos, cómo se muestran a cada jugador y
qué sucede al terminarlos. El gremio narrativo de Gnomi no resuelve esta gestión.

**Se considera lista** cuando jugar acompañado aporta una acción y un resultado
que ambos reconocen, y los permisos protegen el espacio y las pertenencias.

### P1. Descubrir y volver con ilusión

Usar los caminos, paisaje, coleccionables y lugares existentes para pequeñas
metas de exploración con utilidad cotidiana: inspiración, objetos decorativos
o encuentros breves, por diseñar. Las cuatro recogidas publicadas son una base
pequeña; el polvo de hada sigue con su continuación reservada a La Arboleda.

Cultivo, jardinería jugable y pesca pueden ampliar esta fantasía más adelante.
Las huertas decorativas y los clips de pesca disponibles no los implementan.
Pesca está fuera de la lista inicial de oficios acordada; añadirla sería una
decisión nueva. Conviene cerrar primero hogar y artesanía.

## Ritmo y combate: decisiones que requieren una prueba de experiencia

| Punto | Evidencia y tratamiento propuesto |
| --- | --- |
| Esperas | Energía compartida de 100 y recuperación en 276 min; trabajos de equipo de hasta 48 h, muebles con escala propia. Son acuerdos existentes. Probar actividades agradables durante esas esperas y proteger una primera recompensa corta antes de proponer cambios |
| Recetas excepcionales | Hay 79 de Gran maestro, con botín al 0,5 % por recompensa elegible de enemigo de nivel 26 o superior y posibilidad de comercio. Esa regla también alcanza muebles de ese rango. Diseñar suficiente expresión doméstica accesible en otros rangos; revisar la excepción cosmética solo si se decide cambiarla |
| Cuero | La transformación superior parte de cuero de combate; más transformación no crea una fuente independiente. La autosuficiencia de Peletería sin caza no está resuelta por esa vía. Mantener comercio y decidir qué actividades requieren aventura, sin prometer autosuficiencia pacífica universal |
| Coste frente a utilidad | Las recetas caras son aprendizaje permanente. Comparar ingresos artesanales, dinero invertido y uso del resultado, incluyendo al jugador sin compradores. No usar el precio de una receta como precio de una única pieza |
| Presión diaria | Los tres suministros diarios son una fuente acotada existente. Procurar metas persistentes que puedan retomarse y comprobar el bloqueo de la iniciación por ese mismo cupo |
| Combate | Conservar selección de objetivo, habilidades, botín, muerte y tutorial aprobados. Comprobar rutas y actividades domésticas con exposición previsible, retirada clara y continuidad fuera del combate |
| Accesibilidad | Ya hay movimiento reducido y adaptación móvil. Validar lectura, controles de colocación, contraste y señales que no dependan solo del color, además de una mezcla sonora que permita estar a gusto |

El control anterior de primera mejora duró 82 min 53 s en una ruta automatizada,
con un 79,4 % de espera de reaparición y recuperación. Es anterior a los encargos
diarios y a la iniciación: no describe el ritmo actual de un jugador ni prueba
que hoy deba repetir esa ruta. Véanse [control de sesión](PROFESSION-SESSION-REVIEW.md),
[encargos diarios](DAILY-ORDERS.md) y [recetas](RECIPE-TRAINING.md).

## Orden de entrega y comprobación

| Fase propuesta | Resultado revisable |
| --- | --- |
| 1. Primer proyecto personal | Acceso definido a un rincón, financiación guiada, primer objeto elegido y colocación cómoda |
| 2. Hogar que se usa | Un pequeño conjunto de objetos combinables, interacciones, reorganización y persistencia |
| 3. Viviendas de espacio fijo | Decoración y reorganización de interiores predefinidos |
| 4. Compartir | Visitas con permisos y una actividad cotidiana cooperativa |
| 5. Ampliar según las partidas | Vecinos con continuidad, más exploración y proyectos; cultivo o pesca si se aprueban |

Para probar el rumbo, proponer tres sesiones: hacer y colocar algo propio;
personalizar y usar el rincón; enseñar lo hecho o colaborar con alguien y elegir
el siguiente proyecto. Son objetivos de diseño, sin duración prometida ni guion
aprobado. El jugador debe poder retomar cada proyecto tras desconectarse.

Medir tiempo hasta el primer resultado que conserva, dinero y materiales
necesarios, esperas sin actividad elegida, ayuda externa, comprensión del siguiente
paso y ganas de volver. Observar también si crear resulta agradable y si las
casas reflejan gustos distintos. Una cola pendiente o un contador completado no
demuestran disfrute.

Rendimiento y convivencia acompañan cada fase: presupuesto de objetos y luces
por espacio, guardado recuperable, reconexión, cambios simultáneos y control de
visitas. Las mejoras de [rendimiento](PERFORMANCE.md) ya existen; la capacidad
multijugador bajo carga sigue necesitando medición. Las visitas también necesitan
una forma accesible de salir y retirar acceso.

## Cobertura documental y comprobaciones de esta revisión

Revisión transversal de los **46 documentos de `docs/`** presentes al comenzar,
del README, las guías artísticas complementarias y el código de los recorridos
citados. Se contrastaron decisiones, estado de integración, límites e historial;
los inventarios de arte y animaciones indican recursos disponibles, no sistemas
jugables terminados.

| Grupo revisado | Documentos |
| --- | --- |
| Mundo, vecinos y narrativa | [LORE](LORE.md), [POMPELIN](POMPELIN.md), [CITY-POPULATION](CITY-POPULATION.md), [DIALOGUES](DIALOGUES.md), [QUESTS](QUESTS.md), [QUEST-EDITOR](QUEST-EDITOR.md), [COLLECTIBLES](COLLECTIBLES.md) |
| Oficios y economía | [RPG-IMPLEMENTATION](RPG-IMPLEMENTATION.md), [PROFESSION-WORKSHOPS](PROFESSION-WORKSHOPS.md), [PROFESSION-TUTORIAL](PROFESSION-TUTORIAL.md), [PROFESSION-SESSION-REVIEW](PROFESSION-SESSION-REVIEW.md), [OBTAINABILITY](OBTAINABILITY.md), [RECIPE-TRAINING](RECIPE-TRAINING.md), [DAILY-ORDERS](DAILY-ORDERS.md), [CURRENCY](CURRENCY.md), [RESOURCES-ART](RESOURCES-ART.md) |
| Combate y progresión | [COMBAT](COMBAT.md), [COMBAT-REFINEMENT](COMBAT-REFINEMENT.md), [COMBAT-BALANCE](COMBAT-BALANCE.md), [COMBAT-AUDIO](COMBAT-AUDIO.md), [INTRO-COMBAT](INTRO-COMBAT.md), [SHARED-WORLD-COMBAT](SHARED-WORLD-COMBAT.md), [ENEMY-AI](ENEMY-AI.md), [STATS](STATS.md), [WEAPON-SYSTEM-DESIGN](WEAPON-SYSTEM-DESIGN.md), [SET-EFFECTS-SUPERSEDED](SET-EFFECTS-SUPERSEDED.md), [MMORPG-SYSTEMS-REVIEW](MMORPG-SYSTEMS-REVIEW.md), [MMORPG-GAP-ANALYSIS](MMORPG-GAP-ANALYSIS-2026-10-27.md) |
| Arte, equipo y herramientas | [ANIMATIONS](ANIMATIONS.md), [ASSET-LIBRARY](ASSET-LIBRARY.md), [CHARACTER-ART](CHARACTER-ART.md), [CHARACTER-CREATOR](CHARACTER-CREATOR.md), [CLASS-OUTFITS](CLASS-OUTFITS.md), [HAMLET-ASSETS](HAMLET-ASSETS.md), [MODULAR-EQUIPMENT](MODULAR-EQUIPMENT.md), [EQUIPMENT-ART-DIRECTION](EQUIPMENT-ART-DIRECTION.md), [EQUIPMENT-REFERENCE-STUDY](EQUIPMENT-REFERENCE-STUDY.md), [WEAPONS](WEAPONS.md), [WEAPON-RARITIES](WEAPON-RARITIES.md), [ORIGINAL-WEAPONS](ORIGINAL-WEAPONS.md), [WEAPON-QUALITY](WEAPON-QUALITY.md), [WEAPON-ICONS](WEAPON-ICONS.md) |
| Presentación y operación | [DAY-MUSIC](DAY-MUSIC.md), [LOGIN](LOGIN.md), [POLISH](POLISH.md), [PERFORMANCE](PERFORMANCE.md) |

La auditoría de materiales ejecutada con `node tools/audit-obtainability.mjs`
termina correctamente: **441 recetas, 216 nodos, 14 criaturas de diez perfiles,
ningún ingrediente sin fuente y ninguna receta bloqueada por materiales**.
No verifica por sí sola aprendizaje, saldo, rango, recorrido o ritmo.

Como contraste adicional, se ejecutó en memoria el mismo análisis omitiendo
todas las fuentes de combate, sin modificar los catálogos: quedan 94 recetas
bloqueadas, todas de Peletería; los cuatro muebles de Aprendiz conservan fuentes
de ingredientes. No incluye vendedores ni comercio y tampoco demuestra una
sesión pacífica completa: los pergaminos, el dinero y los accesos se comprueban
aparte.

Quedan discrepancias históricas de documentación: «no implementado» en diseños
anteriores, la moneda premium descrita como futura en `CURRENCY.md` frente a
acciones existentes en profesiones, y pendientes de bienvenida ya concretados
en el propio lore. Para estas prioridades se han usado las actualizaciones
específicas y el código; esa cronología no debe convertirse en tareas duplicadas.
Los efectos de conjuntos archivados siguen fuera del diseño vigente.

Esta revisión cambia documentación. No ejecuta una nueva partida, revisión visual,
prueba de carga, publicación web o comprobación del servidor remoto. Las recetas,
precios, energía, tiempos, recompensas, mapas y personajes conservan sus reglas.

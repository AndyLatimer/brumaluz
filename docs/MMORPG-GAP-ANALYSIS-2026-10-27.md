# Brumaluz frente a referentes MMORPG

Revisión del 27 de octubre de 2026. **Diagnóstico y propuestas; no modifica decisiones aprobadas, canon, contenido jugable ni servidor.**

**Seguimiento del mismo día:** el paso de historia sigue aplazado por decisión del usuario. La fase de obtención ya añade las dos fuentes de cuero superior y comprueba ingredientes para las 441 recetas; véase [Obtención](OBTAINABILITY.md). Una decisión posterior sustituye las propuestas de recetas garantizadas o de descubrimiento ordinario: compra exclusivamente al maestro, precios elevados y solo Gran maestro mediante botín excepcional; véase [Recetas y maestros](RECIPE-TRAINING.md). Las cifras y observaciones del diagnóstico original que siguen son una fotografía anterior a esos cambios.

## Diagnóstico

Brumaluz tiene una base amplia de sistemas y herramientas, pero el recorrido que los convierte en una experiencia duradera sigue incompleto. La prioridad propuesta es conectar bienvenida, vida de barrio, progresión, oficios y cooperación en una primera franja jugable verificable.

La identidad aprobada ofrece un criterio claro: capital acogedora, vecinos de distintos pueblos, trabajo artesanal y magia discreta. El combate y la exploración pueden ampliar esa vida cotidiana. No hace falta convertir la bienvenida en una amenaza general ni resolver ahora el misterio de la Esencia sombría.

El riesgo principal es confundir amplitud del catálogo con profundidad de juego: tener cientos de recetas no demuestra que el jugador pueda encontrarlas, reunir sus materiales, fabricar algo útil y tener un motivo para volver.

## Alcance y evidencia

Se revisaron lore, documentación de sistemas y dirección artística, módulos de personaje, habilidades, profesiones, misiones, combate, servicios sociales, generadores y SQL relacionado. Se contaron las entradas de los catálogos actuales y se inspeccionaron dos capturas existentes de juego: `art/workshops-review/artisan-district-game.png` y `art/polish-review/hud-mobile-390-collapsed.png`.

Comprobación ejecutada: `npx tsc --noEmit`, correcta. No se regeneraron catálogos, aplicaron migraciones ni modificaron personajes. No se hizo una nueva partida, una revisión interactiva del editor ni una prueba de carga. Las capturas son evidencia histórica, no una reproducción del estado actual. Las conclusiones sobre diversión, retención y capacidad necesitan sesiones y medición.

| Base existente | Evidencia |
| --- | --- |
| Mundo e identidad acordados, bienvenida personal con Gnomi e Isberto | `LORE.md`, `QUESTS.md`, `src/data/quests.ts`, `src/story/` |
| Cinco clases; un básico y una habilidad activa por clase, con cinco rangos | `src/data/combat.ts` |
| 341 equipables; identidad por copia, conjuntos y encantamientos | Catálogo RPG, `RPG-IMPLEMENTATION.md`, módulos de inventario/equipo |
| Doce oficios, 436 recetas, 216 nodos, 541 definiciones adicionales | `src/data/generated/rpg-catalog.json`: 46 recetas básicas y 390 de descubrimiento |
| Doce talleres y maestros; 13 entradas de estación, incluida reparación | `PROFESSION-WORKSHOPS.md`, catálogo y mapas publicados |
| Nueve criaturas compartidas de cinco tipos, de nivel 1–2 | `src/data/wilderness.json`, `ENEMY-AI.md`, SQL 28 |
| Cuentas, presencia, amigos, grupos, chat, comercio y banco | `src/services/`, SQL 04–15 |
| Colocación personal de muebles en la casa habilitada de Isberto | `src/data/professions.ts`, SQL 20; no equivale a vivienda con visitas |
| Editores y generación de recursos, mapas y NPCs | `README.md`, `ASSET-LIBRARY.md`, documentación artística |

Las expediciones conservan código y SQL, pero están retiradas del recorrido del cliente: `src/game/combat.ts` descarta esos encuentros al recibirlos. No se contabilizan como mazmorras disponibles.

## Qué aprender de los referentes

Estas referencias describen mecanismos publicados por sus creadores. No prueban que un mecanismo aislado cause el éxito comercial. Las aplicaciones a Brumaluz son recomendaciones de esta revisión. Palia se incluye como referente social y acogedor cercano a la identidad del proyecto, sin equiparar su escala a la de WoW o FFXIV.

| Referente | Mecanismo documentado | Aplicación propuesta y diferencia actual |
| --- | --- | --- |
| [World of Warcraft: guía de inicio](https://worldofwarcraft.blizzard.com/en-us/news/24266319) | Aprendizaje inicial de controles, clase e inventario seguido de una continuación de aventura explícita | Brumaluz tiene una bienvenida cuidada; falta concretar una continuación que conduzca a decisiones y recompensas propias |
| [Guild Wars 2: eventos dinámicos](https://www.guildwars2.com/en-gb/the-game/dynamic-events/) | Cooperación espontánea, recompensas individuales y eventos que responden a la participación | El combate compartido es una buena base. Faltan actividades compartidas con propósito, desenlace y razones para repetirlas; no hace falta convertir cada criatura en misión |
| [FFXIV: Duty Support](https://na.finalfantasyxiv.com/game_manual/dutysupport/) y [comunidades](https://na.finalfantasyxiv.com/lodestone/community_finder/?type=fc) | Contenido compatible con apoyo de NPCs y organizaciones persistentes de jugadores | Diseñar actividades que funcionen con poca población y vínculos que sobrevivan a cerrar sesión. No implica copiar acompañantes o gremios completos ahora |
| [Old School RuneScape: Group Ironman](https://www.runescape.com/oldschool/groupironman) | Recolección, fabricación y combate alimentan metas de progreso compartidas | Conectar fuentes, requisitos y usos. Permitir todos los oficios ya está aprobado: la colaboración debe resultar conveniente, sin imponer exclusiones nuevas |
| [Old School RuneScape: intervención económica de 2021](https://secure.runescape.com/m=news/grand-exchange-tax--item-sink?oldschool=1) | Jagex introdujo retirada de moneda y objetos, con seguimiento de entradas y comportamiento | Medir producción y consumo antes de ampliar la economía. La noticia es histórica: no se toma su porcentaje de impuesto como regla actual ni como recomendación para Brumaluz |
| [Palia: relaciones](https://support.palia.com/hc/en-us/articles/7474617601428-NPCs-Relationships) y [juego en grupo](https://palia.com/news/patch-181) | Historias personales ligadas a oficios y recompensas por realizar actividades juntos | Dar continuidad a vecinos y maestros, hacer visible la utilidad de lo fabricado y añadir cooperación fuera del combate |

## Carencias y prioridades

P0 significa resolver antes de ampliar sustancialmente el catálogo; P1, desarrollar después del primer recorrido completo; P2, expansión condicionada por población y resultados. Son prioridades propuestas.

### P0: continuación y objetivos alcanzables

**1. Continuación después de Isberto.** El lore deja abierta la siguiente etapa y el sistema narrativo revisado se concentra en la bienvenida. Los talleres ya explican cómo empezar, pero no sustituyen una secuencia de objetivos, decisiones y recompensas que conecte los sistemas.

Propuesta: un pequeño arco posterior que permita probar un oficio sin comprometerse, salir a por materiales, conseguir una mejora y usarla. Incluir un camino cotidiano sin exigir una cadena larga de combates. Personajes, nombres, encargos y desenlaces requieren aprobación; no se presupone una continuación del misterio.

**2. Fuentes de materiales incompletas.** Ochenta recetas del catálogo requieren `cuero_1` a `cuero_5`. Esos cinco ingredientes no aparecen como producto de nodos, botín de las criaturas actuales ni resultado de fabricación. El vendedor SQL revisado tampoco contiene esas entradas. Es un bloqueo aparente de obtención por juego normal en las fuentes revisadas, aunque existan objetos históricos en cuentas o herramientas de desarrollo.

Propuesta: definir y comprobar una fuente activa para cada ingrediente de la franja que se vaya a ofrecer. Comercio entre jugadores redistribuye materiales; no resuelve la ausencia de una fuente original. No se propone añadir Desuello, excluido de la lista inicial acordada.

**3. Obtención de recetas demasiado poco dirigida para una meta concreta.** La recolección puede descubrir recetas de distintos oficios: tras la tirada de núcleo, hay una tirada del 8 % y una selección aleatoria entre recetas elegibles. Hay 78 verdes. En un nodo básico, una verde concreta tiene una esperanza aproximada de **977 extracciones** por esta vía (`78 / (0,998 × 0,08)`), suponiendo tiradas independientes. Es una esperanza matemática, no una garantía ni una duración medida. En nodos superiores el conjunto elegible aumenta.

Hay otras vías: el combate exterior entrega una primera receta verde de clase y luego tiene una probabilidad adicional; las maestrías enseñan una receta avanzada. Por tanto, no todas las recetas dependen exclusivamente de esas 977 extracciones. El problema es la capacidad de perseguir una receta determinada, especialmente con pocos jugadores comerciando.

Propuesta: una primera receta útil garantizada y alguna vía dirigida para avanzar hacia recetas específicas. Mantener descubrimiento y comercio como alternativas valiosas. Seleccionar un mecanismo concreto requiere diseño.

**4. Progresión de clase muy corta frente al horizonte de nivel.** La habilidad inicial puede maximizarse al nivel 5. Se conceden puntos hasta el 50; con esa única habilidad al máximo, un personaje de nivel 50 conserva 45 puntos sin otro destino actual. El equipo y los encantamientos sí añaden progreso, pero no sustituyen nuevas decisiones de clase.

Propuesta: diseñar primero un pequeño tramo de desbloqueos con decisiones distintas —daño, defensa, apoyo o movilidad según clase— y probarlo antes de producir árboles completos. Respetar que las ramas alternativas siguen pendientes y que los conjuntos aprobados mejoran cifras sin transformar habilidades.

**5. Ritmo sin validar.** La reserva de energía es 100 y se recupera en 276 minutos; equipo superior puede tardar 24–48 horas. Son reglas y valores ya documentados, no errores demostrados. Falta medir qué actividades útiles y agradables quedan disponibles mientras se espera.

Propuesta: comprobar la autonomía objetivo de 45–60 minutos y sesiones más breves; medir primera fabricación, primera mejora, tiempo de desplazamiento, pausas y alternativas al agotar energía. No cambiar tiempos o monetización sin revisar resultados y decisiones existentes.

### P1: pertenencia, cooperación y variedad

**6. Cooperación con un propósito.** Hay amenaza, participación, curación de aliado y grupos. Falta un recorrido disponible que permita aprender a colaborar y conseguir una recompensa identificable. Proponer una actividad corta para el grupo actual de hasta cuatro, con una forma razonable de disfrutar el juego cuando no haya compañeros. Las criaturas normales deben conservar su combate habitual sin fases ni encargos por grupo; las reglas de una futura mazmorra se diseñan aparte.

**7. Vida cotidiana y relaciones.** Gnomi e Isberto tienen identidad; once maestros aún usan títulos funcionales. Faltan historias posteriores, hábitos y relaciones que hagan reconocible a la comunidad. Proponer desarrollar dos o tres vecinos con continuidad antes de llenar la ciudad de NPCs funcionales. Amistad o reputación son opciones por diseñar, no sistemas aprobados.

**8. Hogar como meta social.** La colocación de muebles ya permite un primer uso. Faltan reglas de vivienda propia, permisos, visitas y persistencia visible para otros. Para una fantasía de barrio, un espacio personal visitable puede tener más valor que más escalones de potencia. No presuponer alquileres, compras, parcelas ni costes.

**9. Economía con demanda observable.** Ya hay monedas, consumibles, reparaciones, comercio y recetas comerciables. Falta una evaluación de ingresos por actividad, costes, excedentes y necesidades recurrentes. Permitir todos los oficios reduce la dependencia obligatoria; la colaboración puede surgir del tiempo, la comodidad y proyectos comunes. Proponer encargos protegidos o un tablón sencillo solo después de comprobar demanda; una subasta completa no es requisito inicial.

**10. Exploración con recompensas propias.** Mundo, mapas y regiones tienen base e identidad, pero faltan metas de exploración comparables a la fabricación y al combate: descubrimientos, colecciones o pequeñas historias, por concretar. No convertir reservas de futuras ciudades en contenido publicado sin aprobación.

**11. Identidad visual y lectura del espacio.** Los documentos artísticos contienen reglas concretas y una cadena de producción desarrollada. En la captura existente del barrio abundan edificios de silueta y tejado similares; conviene comprobar si el jugador distingue talleres y plazas sin depender del mapa. Proponer hitos, señalética y detalles de oficio utilizando las bibliotecas permitidas. La captura móvil muestra solapamiento entre objetivo y seguimiento: debe reproducirse en el cliente actual antes de declararlo defecto vigente.

### P0 antes de abrir a más jugadores; P2 para expansión

**12. Operación y capacidad verificables.** Hay autoridad del servidor, bloqueos, revisiones, pruebas aisladas y revisiones locales de dos clientes. No se ha establecido aquí un presupuesto comprobado de jugadores simultáneos, coste por sesión ni rendimiento bajo latencia. El ciclo objetivo de presencia de 250 ms obliga a medir tráfico y coste real. Registrar latencia de acciones, errores, tiempos de consulta y comportamiento al reconectar; hacer pruebas de concurrencia en un entorno aislado antes de ampliar población.

**13. Herramientas de convivencia.** No se parte de cero: existen ignorar chat localmente, límites de frecuencia y silencios administrativos. No se localizó un flujo general de denuncias y resolución en los módulos revisados. Diseñarlo según la apertura pública prevista, con recuperación de incidencias y soporte operativo. No confundir ignorar en un navegador con bloqueo persistente de cuenta.

**14. Expansiones que pueden esperar.** Gremios completos, subastas, correo general, PvP, incursiones y muchas regiones no resuelven por sí solos las carencias anteriores. Elegirlos según la experiencia buscada y la población, sin tratarlos como una lista obligatoria de MMORPG.

## Problemas de las guías

Los documentos distinguen acuerdos, propuestas y algunas actualizaciones, pero la lectura cruzada exige reconstruir una cronología:

- `MMORPG-SYSTEMS-REVIEW.md` conserva una auditoría histórica expresamente marcada. Su lista antigua no sirve como inventario de carencias actuales.
- `WEAPON-SYSTEM-DESIGN.md` mantiene numerosos «no implementado» en decisiones que otros documentos y el código ya describen como implementadas.
- `COMBAT.md` conserva una explicación histórica de escalado básico al 5 % y habilidades sin el mismo escalado. El código actual usa el multiplicador común del 2 %, documentado en `STATS.md`.
- `RPG-IMPLEMENTATION.md` contiene párrafos antiguos sobre áreas, atributos reservados, retirada de estaciones y navegación pendiente. `STATS.md`, `POLISH.md`, `ENEMY-AI.md` y `PROFESSION-WORKSHOPS.md` documentan cambios posteriores.
- `README.md` aún afirma, en el apartado de grupos, que la única XP es `debug_xp`, pese a existir bienvenida y combate exterior con experiencia.
- `LORE.md` conserva en «Decisiones pendientes» elementos de la bienvenida que ya concreta antes en sus decisiones confirmadas.

Propuesta: una página breve de estado actual enlazada desde README, responsables por sistema y etiquetas separadas de **aprobado**, **implementado**, **probado localmente** y **verificado en servidor**. Mantener el historial en secciones explícitas. Esta auditoría no reescribe esos documentos ni resuelve discrepancias de diseño por su cuenta.

## Orden de trabajo propuesto

**Prioridad elegida el 27 de octubre:** se aplaza el paso 1 y se trabaja primero el paso 2, cerrar la obtención y comprobar una primera mejora útil. La continuación narrativa después de Isberto queda para más adelante.

Implementación posterior a esta auditoría: [Obtención de materiales y primera mejora](OBTAINABILITY.md). Combina caza y transformación de cueros, según la elección del usuario. Las cifras y carencias del análisis anterior describen el estado auditado antes de ese cambio.

| Etapa | Entrega concreta | Cómo decidir si está lista |
| --- | --- | --- |
| 1. Alinear estado y objetivos | Resumen vigente y diseño del primer tramo posterior a Isberto | Cada objetivo tiene requisito, actividad, fuente de materiales y recompensa accesible |
| 2. Cerrar obtención | Auditar dependencias de recetas y garantizar una primera mejora útil | Recorrido desde personaje nuevo sin objetos de desarrollo, incluidas las clases que usan cuero |
| 3. Dar continuidad | Pequeño arco cotidiano, hitos de clase y una meta personal | El jugador sabe qué puede hacer después y elige entre alternativas comprensibles |
| 4. Hacer valiosa la compañía | Una actividad cooperativa corta y una razón cotidiana para reunirse | Jugar juntos aporta una experiencia reconocible; baja población no impide continuar |
| 5. Validar y ampliar | Sesiones de jugadores, medición económica y pruebas de concurrencia | Ampliar según bloqueos observados, costes y preferencias reales |

Primera vertical sugerida: **terminar la bienvenida → conocer un taller → conseguir una receta útil → reunir materiales → fabricar y usar una mejora → compartir una actividad → volver con una siguiente meta clara**. Es una propuesta de recorrido, no un nuevo guion aprobado.

Medir como mínimo: abandono por paso, tiempo hasta primera mejora, pasos que requieren ayuda externa, energía agotada, utilidad percibida de la recompensa, participación con otros y errores o pérdidas al reconectar. El retorno voluntario al día siguiente aporta una señal; una cola pendiente no demuestra por sí sola diversión ni retención.

La decisión de diseño más útil ahora es concretar qué podrá elegir un jugador durante sus tres primeras sesiones después de Isberto, y qué habrá conseguido al terminarlas.

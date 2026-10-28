# Manos a la obra: iniciación a un oficio

27 de octubre de 2026. El usuario pide una misión tutorial con elección de profesión y el recorrido completo del juego normal. Confirma que **Gnomi la ofrece después del regreso a casa de Isberto**, con elección de oficio. Se usa el sistema existente de oferta, aceptación explícita, diario, seguimiento, marcadores y entrega.

## Recorrido implementado

Gnomi espera en la plaza del pozo tras el regreso de Isberto. Ofrece conocer los talleres; el jugador elige fabricación o recolección y después uno de los doce oficios. La tarjeta detalla el recorrido y su recompensa. Mirarla o cerrarla no acepta la misión. La elección solo determina esta iniciación: todos los oficios siguen disponibles y no se elige una especialización permanente.

| Paso | Acción normal del jugador | Comprobación |
| --- | --- | --- |
| Visita | Hablar con el maestro elegido y empezar la práctica | Maestro, mapa y proximidad publicados |
| Herramienta | Comprar en Herrería la herramienta básica de recolección necesaria y equiparla desde la mochila o Mis herramientas | Herramienta equipada; se reconoce una válida que ya tuviera |
| Receta, para fabricación | Comprar el pergamino de componente de Aprendiz al maestro y usarlo desde la mochila | Receta realmente aprendida; se reconoce el aprendizaje previo |
| Materiales | Extraer al menos un recurso pertinente en Pompelín y reunir todos los ingredientes | Extracción finalizada después de empezar la práctica; ingredientes reales de la mochila |
| Fabricación | Preparar dos componentes de Aprendiz en el banco | Trabajos reales creados después de la extracción |
| Recogida | Recoger las dos piezas terminadas | Recogida validada de esos trabajos; Cocina y Alquimia entregan al instante |
| Suministro | Entregar el encargo diario del oficio y cobrar | Pago y consumo normales; sin eludir el cupo compartido |
| Cierre | Volver a hablar con el maestro y confirmar Completar misión | Progreso completo y recompensa única |

Minero, Leñador y Recolector usan la variante de herramienta → extracción y materiales → entrega de seis materiales. No se les inventa una receta o una fabricación que no pertenece a su oficio. Cada oficio de fabricación usa su receta básica existente y un oficio de recolección que aporta ingredientes: por ejemplo, Herrería usa Minero y Carpintería usa Leñador. Peletería conserva el cuero de caza o comercio, sin añadir Desuello.

Los ingredientes secundarios pueden obtenerse por sus fuentes normales, incluido botín y comercio. La extracción necesaria para aprender el manejo de la herramienta debe realizarla el jugador. Tener componentes antiguos o comerciados no sustituye la fabricación y recogida personales de la iniciación.

## Economía y tiempos

No se conceden herramientas, dinero inicial, materiales ni recetas. Se mantienen los 20 Pelines de la herramienta básica, los 50 del pergamino de componente y todos los tiempos, energía y desgaste normales. El maestro explica cómo financiarse mediante combate, venta de botín y suministros de recolección, y remite al libro para cantidades y fuentes.

La entrega final es el encargo diario normal: paga 75 Pelines por dos componentes o 50 por el suministro de recolección. Consume una de las **tres entregas compartidas del día**. Si el jugador las agotó, conserva su progreso y objetos y puede entregar cuando se renueve el cupo a las 00:00 UTC. La oferta avisa de ello y la guía recomienda reservar una entrega. El tutorial no crea un cuarto encargo ni un reinicio del cupo.

Valor inicial de la recompensa de misión: **40 XP de personaje y 0 Pelines adicionales**, concedidos una sola vez al confirmar el cierre. El pago del suministro ya se ha cobrado al entregarlo; no vuelve a pagarse al completar la misión. La experiencia normal de recolección y fabricación se conserva, con sus propias reglas.

## Diario y guía

- La misión aparece en Activas después de aceptarla, con oficio, contacto, pasos, objetivo actual y recompensa. Al completarla pasa a Completadas, plegada como las demás misiones.
- El rastreador sigue el paso vigente. Las marcas aparecen en el mundo, el minimapa y el mapa; guían por las puertas existentes entre ciudad, taller y campo. Cuando toca usar un pergamino, el objetivo remite a la mochila.
- El paso de materiales permanece activo hasta reunir lo necesario para las piezas pendientes; no manda fabricar después de una sola extracción si faltan ingredientes. Las fuentes y cantidades completas se consultan en el libro.
- El maestro ofrece Mi iniciación al oficio solo para el oficio elegido y mientras la misión esté activa. El panel permite retomar instrucciones, consultar el libro y abrir la mochila. La entrega final usa la tarjeta de misión y requiere confirmación explícita.
- La bienvenida y la misión de Isberto mantienen prioridad. La iniciación activa se sigue antes del hilo del polvo de hada, sin borrar ese progreso ni resolver su continuación.

## Persistencia y autoridad

El progreso vive en `rpg.tutorial`: oficio, estado, visita, herramienta reconocida, extracciones, trabajos personales pendientes, piezas recogidas y suministro entregado. Se conserva al desconectarse. No se añade una misión aceptada a personajes existentes al aplicar SQL; los anteriores a la bienvenida pueden aceptar voluntariamente la oferta de Gnomi en su posición inicial, sin repetir la historia.

`rpg_action` valida `tutorial_accept`, `tutorial_visit` y `tutorial_complete` mediante un auxiliar privado. El servidor comprueba las fases previas de historia para personajes con bienvenida, interlocutor, proximidad, presencia, personaje vivo y ausencia de combate. No acepta una fase o recompensa proporcionada por el cliente.

Las acciones normales confirmadas alimentan un segundo auxiliar privado: equipamiento de herramienta, extracción, fabricación, recogida, cancelación y entrega diaria. No hay un botón para marcar pasos como hechos. Los reintentos conservan los recibos y revisión existentes y no duplican contadores ni recompensas. Cancelar retira el trabajo del progreso de fabricación; los trabajos anteriores a la práctica no cuentan como recogidas del tutorial. El listado de trabajos pendientes del tutorial está acotado por la cola normal de cinco.

La configuración está en `src/data/professionTutorial.json` y se incorpora al catálogo generado. Las reglas SQL están en `supabase/server/19a-profession-tutorial.sql`, integradas con la RPC existente de oficios. La simulación de desarrollo reproduce ese mismo recorrido.

## Comprobaciones y aplicación

- `node --test scripts/test-profession-tutorial.mjs`: recorrido de los doce oficios con herramientas, pergaminos, fuentes de materiales, trabajos y entrega real; aceptación, interlocutores, reintentos, cancelación, cupo diario, progreso previo y paridad entre desarrollo y SQL. También comprueba la aplicación repetida sin migrar personajes ni alterar otras ramas.
- `node tools/review-profession-tutorial.mjs`: oferta de Gnomi, elección de Herrería, diario, uso de herramienta y receta desde la mochila, seis extracciones, fabricación y recogida, entrega diaria y cierre explícito desde el juego con RPCs SQL aisladas. Usa posicionamiento y reloj de prueba, y empieza con 70 Pelines de fixture; **no mide una sesión humana ni el tiempo de conseguir ese dinero**.
- La revisión conserva capturas de oferta, diario, espera y entrega en escritorio y 390 px en `art/profession-tutorial-review/`.
- `node scripts/apply-profession-tutorial-patch.mjs` prepara y comprueba el parche sin aplicarlo. `--apply` instala catálogo, dos auxiliares privados y la integración mínima en `rpg_action`; conserva las demás entradas y ramas publicadas. Guarda copia y SQL de reversión. `--verify` comprueba instalación y permisos.

El registro de instalación se guarda en `art/profession-tutorial-review/deployment.json`. No se migran personajes, mapas, recursos ni criaturas. La publicación del cliente web es independiente.

**Aplicación del 27 de octubre:** instaladas y verificadas las cuatro funciones para los doce oficios. La comprobación posterior confirmó que el resto del catálogo y las demás ramas de `rpg_action` se conservaron exactamente. Los pergaminos consumibles y el cupo de encargos diarios también pasan sus verificaciones de servidor.

Pasan **54 pruebas** combinadas de iniciación, obtención, consumibles, encargos diarios, talleres, recolección, IA, bienvenida y polvo de hada. La revisión del juego completa la misión de Herrería mediante SQL aislado, con oferta y entrega en escritorio y móvil de 390 px, y confirma su entrada en Completadas. El cliente compila en `dist/`; no se ha publicado un nuevo alojamiento web.

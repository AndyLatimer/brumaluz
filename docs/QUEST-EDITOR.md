# Creador de misiones

Petición del 28 de octubre de 2026: un creador/editor, como los de NPCs y mapas,
para misiones sencillas con diálogos, recogida/entrega de objetos y bajas de
enemigos con regreso al contacto. La herramienta no aprueba nuevas historias,
personajes ni recompensas del mundo; el canon sigue en [LORE.md](LORE.md).

Revisión solicitada el mismo día: el primer editor resultaba demasiado
complicado. Se sustituye el formulario largo por un recorrido guiado de cinco
pasos, con explicaciones y ejemplos junto a los campos. Los identificadores y
las conexiones técnicas quedan en opciones avanzadas. Se conserva el formato
de las fichas existentes y no se cambia su alcance de publicación.

## Uso

Ejecutar `npm run dev` y abrir `/quests.html`. Hay accesos desde los creadores
de NPCs y mapas. Es una herramienta local de desarrollo, fuera del bundle del
juego publicado.

Elegir el tipo de encargo en «Mis misiones» y pulsar **Crear misión**. Se puede
avanzar con Siguiente/Anterior o pulsar directamente cualquiera de los pasos:

1. **El encargo.** Darle nombre y escribir la descripción para el diario.
   Elegir quién pide ayuda. Por defecto se vuelve a esa misma persona; para
   entregar a otra, desmarcar esa opción. Nivel y misiones previas están en un
   desplegable opcional, con casillas individuales para elegir los requisitos.
   La referencia interna se genera automáticamente.
2. **Objetivos.** Elegir el objeto, enemigo o persona. Las listas largas tienen
   un buscador por nombre que admite acentos o su ausencia. Indicar la cantidad;
   hablar con alguien exige una conversación. El texto del diario se propone
   automáticamente al cambiar el objetivo o la cantidad. Si se personaliza en
   «Ajustar texto o lugar», se conserva al cambiar la cantidad. La casilla de
   entrega explica si se retiran los objetos de la mochila. Se pueden añadir
   hasta veinte objetivos mediante botones específicos. Todos son obligatorios,
   en cualquier orden. **No hay que añadir un objetivo para volver:** el regreso
   ya forma parte de la entrega. Los filtros por mapa y el orden visual de los
   objetivos se ajustan dentro de sus opciones adicionales.
3. **Conversaciones.** Elegir el momento: al ofrecerla, mientras está pendiente,
   al entregarla o después de terminar. Escribir el texto del personaje y las
   respuestas del jugador. Aceptar y entregar ya vienen conectados. «Añadir una
   pregunta opcional» crea una pareja pregunta/respuesta y prepara el regreso a
   la conversación sin aceptar ni entregar. Puede responder otra persona.
   Quitar una pregunta elimina su respuesta si era automática y no se comparte;
   las ramas personalizadas se conservan. El editor de conexiones avanzado
   sigue disponible para árboles más complejos, sin aplanar las fichas previas.
4. **Recompensas.** Indicar XP y Pelines; cero significa que no se otorgan.
   Añadir objetos de regalo solo si hacen falta. La explicación distingue las
   recompensas al entregar de la recogida o la última baja.
5. **Revisar y probar.** Leer el resumen, los requisitos y las recompensas.
   Los detalles pendientes enlazan al campo correspondiente. Empezar la prueba,
   aceptar en el diálogo, usar los botones para recoger/combatir/hablar y volver
   al contacto. El nivel y los requisitos del personaje de prueba están en un
   desplegable opcional. Se fijan al empezar cada prueba; editar una ficha no
   cambia una prueba ya iniciada.

El resumen lateral muestra el recorrido y las recompensas mientras se escribe.
Guardar está disponible en cualquier paso. Si faltan datos, el editor abre el
apartado correspondiente, señala el campo y explica qué completar.

Las fichas se guardan en `src/data/questCatalog.json`. Duplicar, recargar,
importar y exportar están en **Gestionar biblioteca**. El ID guardado es
estable; duplicar genera otro. El navegador conserva el borrador, el paso y el
momento de la conversación que se estaba editando.

Importar JSON prepara una sustitución completa de la biblioteca como borrador;
solo Guardar escribe en disco. Se pueden exportar borradores incompletos para
recuperar trabajo, aunque deberán pasar la validación antes de importarse o
guardarse. El navegador conserva el borrador y la revisión del archivo.

## Validación y persistencia

`src/data/questCatalog.ts` valida el formato versionado, tipos, cantidades,
referencias y enlaces entre nodos. Los requisitos deben existir en esta misma
biblioteca y no pueden formar ciclos. La oferta necesita una ruta a aceptar y
la entrega una ruta a completar. Los bucles voluntarios de conversación sí
están permitidos. Los nodos usados por entradas o respuestas no se eliminan
hasta quitar sus conexiones. Dos objetivos de objetos no pueden pedir el mismo
objeto: se edita su cantidad para evitar una retirada ambigua.

`tools/quest-editor-plugin.mjs` atiende GET/PUT de `/__dev/quests` y el catálogo
de referencias de `/__dev/quests/references` solo en Vite local. Valida también
en servidor; limita la petición a 4 MB, serializa escrituras, comprueba ETag y
usa un archivo temporal con sustitución atómica. Un conflicto entre ventanas
conserva el borrador y exige exportar/recargar antes de intentar sustituirlo.

## Ensayo y alcance de esta versión

El ensayo es local y desechable. Abrir o cerrar un diálogo no acepta una
misión. Solo la respuesta de aceptación cambia la fase, si se cumplen los
requisitos. Los objetivos se activan después de aceptar. Los objetos se
comprueban contra la mochila al entregar; retirarlos antes vuelve a dejar el
encargo pendiente. La entrega consume los solicitados y concede las recompensas
una sola vez. Las bajas y conversaciones filtradas por mapa solo cuentan en él.

`src/story/questConversation.ts` convierte la ficha en el árbol que usa
`src/ui/dialog.ts`. Editor y juego comparten ese renderizador, incluidos los
objetos de recompensa opcionales. El ensayo no concede nada a personajes.

**Guardar una ficha no publica una misión jugable.** Esta primera versión
prepara y prueba contenido reutilizable, como el taller de NPCs. La biblioteca
empieza vacía: no representa versiones editables de la bienvenida, Isberto,
polvo de hada ni encargos diarios, que mantienen sus flujos y validaciones de
servidor actuales. Conectar estas fichas al mundo, sus NPCs, diario, progreso
autoritativo y eventos reales requiere una integración posterior; el simulador
no es una API de progreso de personajes ni una alternativa a validar en SQL.
No se aplican cambios a Supabase ni se activa contenido al guardar.

## Comprobaciones

- `npm run test:quests`: formato y referencias; requisitos y ciclos; ensayo
  completo con filtros de mapa, consumo y pago único; API local y conflictos
  de escritura; creación guiada, búsqueda por nombre, errores junto al campo,
  conservación del texto personalizado, preguntas con regreso automático,
  edición, ramas, guardado y recuperación en navegador; revisión
  visual en escritorio y móvil, también sobre el juego real en modo de prueba.
- `npm --ignore-scripts run build`: TypeScript y compilación sin regenerar los
  catálogos artísticos de otras tareas.

La prueba usa una biblioteca temporal; no escribe la del proyecto ni cuentas
remotas. Capturas e informe en `art/quest-editor-review/`.

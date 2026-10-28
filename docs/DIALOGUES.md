# Diálogos de Pompelín

27 de octubre de 2026. Dirección solicitada: conversaciones más naturales,
con intención y relación concreta con el juego y su mundo. Esta revisión
aplica esa dirección al guion existente; no aprueba historias nuevas.

Matiz posterior del usuario: recuperar más del tono **cozy y mono** de la
versión anterior. La naturalidad conserva la ternura y la ilusión de Gnomi,
el humor suave y la acogida de los vecinos. Evitar el relleno no significa
reducir cada conversación a instrucciones prácticas. Isberto cuida de forma
refunfuñona; los maestros hacen sitio al aprendiz y proponen aprender juntos.

El siguiente ajuste pide **más personalidad y menos tono genérico**. La
calidez se conserva, pero los personajes pueden discrepar, tener preferencias,
ponerse a la defensiva o no saber cómo expresar un agradecimiento. Se revisan
también las réplicas del jugador: puede cuestionar a Gnomi por pedir ayuda o
preguntar a Isberto por qué recurre a él, sin aceptar la misión al hacerlo.

Los rasgos siguientes describen las voces escritas en esta revisión, no
biografías ni nuevas reglas del mundo:

| Interlocutor | Criterio de voz |
| --- | --- |
| Gnomi | Se entusiasma, se corrige y defiende su utilidad; admite una pequeña picardía sin perder honestidad. |
| Isberto | Directo, impaciente con las excusas; ofrece cuidado como si estuviera dando instrucciones. |
| Peletería | Atiende al material antes que a las hazañas de quien lo trae; aprovecha lo disponible. |
| Sastrería | Observa costuras sin proponérselo; le importa que el aprendiz elija algo que quiera vestir. |
| Carpintería | Prefiere las ballestas y protesta un poco cuando le piden otro bastón; acaba ayudando igualmente. |
| Ebanistería | Quiere imaginar el sitio de cada mueble; le cuesta dejar de opinar sobre la casa ajena. |
| Joyería | Habla con calma, reconoce sus caprichos y distingue el gusto personal de la utilidad del equipo. |
| Alquimia | Se entusiasma con las mezclas, pero acaba volviendo a las recetas y al coste de los ingredientes. |
| Encantamiento | Necesita precisar los términos; insiste en leer antes de gastar un pergamino. |
| Cocina | Lleva la iniciativa, discute con el hambre ajena y separa las provisiones de la curación. |
| Minero | Pausado, poco impresionado por lo que brilla; pide revisar el coste antes de precipitarse. |
| Leñador | Detesta el trabajo de cargar madera equivocada y los filos descuidados. |
| Recolector | Se interesa por demasiadas cosas; reconoce que necesita una lista tanto como el jugador. |

Cada maestro tiene una pregunta propia que enfrenta ese punto de vista con
una duda práctica. No se convierte cada intervención en un chiste ni se
añaden nombres personales, clientes, conflictos históricos o recompensas.

## Criterio de escritura

Cada intervención debe ayudar a entender qué quiere el personaje, qué acaba
de ocurrir o qué puede hacer el jugador. Las explicaciones de reglas se
ofrecen al preguntarlas. Las cantidades, precios, requisitos y recompensas
siguen siendo explícitos en las ofertas y confirmaciones.

Gnomi busca su distintivo mientras trata de cumplir su encargo. Su interés
por ayudar se ve en lo que propone y hace; no necesita explicarlo en cada
frase. Su torpeza no remata todas las conversaciones. David queda en la
pregunta opcional sobre la pérdida. Sus respuestas al comienzo distinguen
las cuatro razas y los tres motivos de cada una, incluidos los residentes.

Isberto habla de su fragua, la criatura y las necesidades del jugador.
Su experiencia aparece en observaciones prácticas, sin discursos sobre
el valor ni elogios genéricos. Ofrece descanso y almacenaje como devolución
del favor. El origen de la criatura y el uso de su esencia siguen abiertos.

Los doce maestros parten de sus herramientas, materiales y productos.
Las presentaciones relacionan la recolección de Pompelín con los talleres
de Brumaluz. Los encargos diarios expresan qué suministro necesita ese
oficio, antes de mostrar el cupo y las condiciones. Sus nombres y biografías
siguen pendientes; no se añaden clientes, sucesos ni instituciones.

## Implementación

- Bienvenida y respuestas de origen: `src/ui/questWindow.ts` y
  `src/data/quests.ts`.
- Isberto, Gnomi y el polvo de hada: `src/story/npcs.ts` y
  `src/story/quests.ts`.
- Talleres y encargos: `src/story/professionMasters.ts` y
  `src/story/dailyOrders.ts`.
- Traducciones de los textos revisados: `src/ui/dialogueTranslations.ts`.

Las misiones, acciones de servidor, recompensas y accesos conservan sus
reglas. Las cinemáticas y los mapas no se modifican con esta revisión.

## Revisión

`node tools/review-dialogues.mjs` recorre las doce respuestas de origen,
las presentaciones y los encargos de los doce maestros, el cambio a inglés
y la lectura a 390 px en el juego real con personajes locales de prueba.
Guarda capturas e informe en `art/dialogue-review/`, sin escrituras remotas.
La compilación se ejecuta con `npm --ignore-scripts run build`, conservando
los catálogos existentes.

La prueba general de bienvenida contiene una discrepancia ajena a estos
textos: espera que la cinemática de la fragua no tenga interlocutor, mientras
`playMonsterReveal` ya presenta líneas habladas de Isberto. Esta revisión
conserva esa escena y no elimina la comprobación.

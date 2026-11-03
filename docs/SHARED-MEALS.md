# Meriendas compartidas

Diseño confirmado en la revisión guiada del 31 de octubre de 2026, aplicado y
probado localmente el 2 de noviembre. Sustituye el prototipo de ingredientes
fijos y dos panes sin dinero. Estado de publicación y comprobaciones en
[Aplicación de la revisión cozy](COZY-IMPLEMENTATION-2026-11-02.md).

## Menú y preparaciones

- Tres recetas aleatorias al día por personaje, con un menú que cambia cada día.
  La selección es personal, no un menú común para todos. No se aprueban nuevas
  tiradas por hablar, cancelar o cambiar de grupo.
- Solo recetas del **rango actual de Cocina** del personaje, sin rangos inferiores.
  Cualquier integrante puede ayudar y recibir recompensa aunque tenga menos rango
  de Cocina que el necesario para la receta elegida por el líder.
- Se ampliará el catálogo normal de Cocina con nuevos platos y también habrá
  platos exclusivos de las meriendas. Se aprueban ambas vías, sin concretar todavía
  platos ni cantidades por rango. El menú se elige aleatoriamente entre ambos
  tipos, **sin proporción fija** ni garantía de incluir uno de cada tipo cada día.
- No hace falta conocer la receta: el maestro dirige la actividad. Participar
  no enseña la receta de forma permanente ni sustituye su pergamino para la
  fabricación ordinaria.
- En grupo, **solo el líder elige la receta y la elige de su propio menú**.
- Se puede repetir la misma receta en preparaciones distintas, incluso para las
  dos recompensas diarias. No es un segundo cobro de la misma preparación.
- Se aportan ingredientes para cocinar, como actividad social independiente de
  los encargos de productos fabricados de los maestros. No se reabre la venta
  ordinaria de materias primas a comerciantes.
- Hasta tres preparaciones pendientes por personaje. Se puede guardar una
  anterior y comenzar otra del menú nuevo mientras quede espacio.
- Cada preparación conserva su receta, cantidades, recompensa anunciada y
  aportaciones de cada participante aunque cambie el día, mientras siga activa.
  Se muestra qué falta para completarla. El cambio de día no es por sí mismo
  motivo de cancelación; sí se aplica el temporizador aprobado posteriormente.
- **Nadie puede cancelar manualmente la preparación.** Se cancelará automáticamente
  tras **30 minutos desde la última aportación**. Cada ingrediente añadido reinicia
  ese plazo. Esto sustituye tanto la cancelación manual como la conservación sin
  caducidad de la propuesta anterior.
- El temporizador **se pausa cuando no queda ningún participante conectado** y
  se reanuda cuando vuelve alguno, conservando el tiempo restante. A solas se
  pausa al desconectarse. Desconectarse o reconectarse no cuenta como aportación
  ni concede un plazo nuevo de 30 minutos; una aportación sí lo reinicia.
- La pausa corresponde solo a la cancelación de la preparación incompleta; no
  modifica la caducidad de siete días de las recompensas terminadas ni las colas
  de fabricación normal.
- Si el grupo se disuelve, sus preparaciones incompletas se cancelan y devuelven
  los ingredientes a sus respectivos participantes, sin esperar al temporizador.
- La cancelación automática devuelve a cada participante sus propios ingredientes
  pendientes. No se devuelven objetos ya consumidos en una receta completada ni
  se duplican devoluciones. No se ha aprobado la retirada manual de aportaciones.

## Recompensas y cupo

| Dificultad de la receta | Recompensa por contribuyente elegible | XP de Cocina |
| --- | --- | --- |
| Sencilla | Una ración del plato preparado y 10 Pelines | 5 |
| Media | Una ración del plato preparado y 20 Pelines | 10 |
| Elaborada | Una ración del plato preparado y 30 Pelines | 15 |

Aportar cualquier ingrediente da derecho a la recompensa completa; no hay una
aportación mínima adicional ni se reparte un bote entre los participantes. Cada
contribuyente elegible cobra una vez de esa preparación; quien no aporta no cobra.

El límite es de **dos recompensas recogidas por personaje y día**, independiente
de las tres entregas de maestros y los dos proyectos únicos de barrio diarios.
El cupo se gasta **al recoger la recompensa**, no al completar la receta. Una
recompensa terminada en otro día usa el cupo del día en que se recoge; no se cambia
su receta ni el importe anunciado. **Las recompensas terminadas sin recoger caducan
a los siete días**; este plazo es distinto del temporizador de minutos de las
preparaciones incompletas. La capacidad de almacenamiento de las recompensas
pendientes sigue por concretar, separada de las tres preparaciones incompletas.

Cambiar de grupo no recupera usos. El máximo recogido de esta actividad es
60 Pelines diarios por personaje más dos raciones y 30 XP de Cocina, antes de
otros ingresos y gastos. Comida, dinero y XP forman una sola recompensa por
preparación y persona; no gastan cupos distintos. La XP no es XP de personaje
ni se multiplica por ingredientes.
No se cambian los requisitos de maestría para ascender de rango.

Después de las dos recompensas se puede seguir ayudando, con aviso antes de
aportar de que no habrá más comida, dinero ni XP de recompensa ese día.

## Aplicación local y cuestiones abiertas

- El catálogo incorpora 18 platos normales nuevos y 18 exclusivos de merienda,
  además de los seis existentes: siete opciones por rango. Los nombres,
  ingredientes y clasificación de dificultad son una primera propuesta de
  contenido implementada para revisar en juego, no decisiones nominales del usuario.
- El menú se fija en el servidor por personaje, día UTC y rango. Si asciende
  Cocina, las nuevas opciones corresponden al rango actual; las preparaciones
  ya iniciadas conservan sus condiciones. La supervisión permite prepararlas
  sin aprenderlas, incluidas las excepcionales; el aprendizaje permanente de
  recetas normales conserva sus pergaminos y restricciones de botín.
- Capacidad de almacenamiento de recompensas pendientes entre días;
  no se deduce un límite nuevo de la cifra de tres preparaciones incompletas.
  La implementación aplica la caducidad de siete días sin añadir otro cupo.
- Al crear una preparación vacía empieza el plazo de treinta minutos; es una
  concreción de implementación. Cada aportación lo reinicia y la desconexión
  de todos los participantes lo pausa, como está aprobado.
- Salida de un participante o cambio de líder sin disolver el grupo. No se
  confunde una desconexión individual con la disolución del grupo completo.
  Los grupos con preparaciones incompletas se conservan al desconectarse todos;
  la limpieza automática de presencia no los disuelve.

Origen de las decisiones: [Viviendas y vida cotidiana](HOMES-AND-COZY-LIFE.md).
Relación con otros ingresos: [Monedas](CURRENCY.md) y [Encargos diarios](DAILY-ORDERS.md).

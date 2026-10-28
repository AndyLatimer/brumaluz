# Encargos diarios de los maestros

27 de octubre de 2026. El usuario aprueba una vía de ingresos mediante entrega de materiales y piezas fabricadas, y concreta que los encargos deben tener límites diarios, ser más fáciles y ser distintos de los encargos de maestría. La continuación narrativa después de Isberto sigue aplazada.

## Primera implementación

Los doce maestros ofrecen **Encargos diarios** en su conversación. Cada uno solicita un suministro sencillo de su oficio. Se puede consultar qué pide, qué cantidad sin vincular hay en la mochila y cuánto paga antes de confirmar. No hay aceptación previa, materiales reservados ni plazos para una entrega iniciada: se paga al entregar los objetos.

Valores iniciales de equilibrio elegidos para concretar el cambio:

- **Tres entregas por día y personaje, compartidas entre los doce maestros.** Se puede repetir el mismo suministro mientras quede cupo. No son tres por maestro ni se exige visitar todos los talleres.
- Renovación a las **00:00 UTC del día real**, independiente del ciclo de luz del mundo y del huso del navegador. El cupo no usado no se acumula. Consultar una oferta no gasta cupo.
- Los tres oficios de recolección piden **seis materiales básicos** por **50 Pelines**.
- Los nueve oficios de fabricación piden **dos componentes de Aprendiz** del oficio por **75 Pelines**.
- Se pueden entregar materiales propios o comerciados. No se acepta equipo inicial, equipo vinculado, objetos equipados ni contenidos pendientes de recoger en trabajos o Entregas.
- La confirmación consume únicamente las cantidades indicadas de la mochila y paga la recompensa mostrada, todo en una operación. Faltar un ingrediente no consume otros objetos ni cupo.

| Maestro | Suministro |
| --- | --- |
| Minero | 4 cobres + 2 gemas de Aprendiz |
| Leñador | 6 robles |
| Recolector | 2 hierbas silvestres + 2 cereales de Aprendiz + 2 frutas de Aprendiz |
| Cada uno de los nueve maestros de fabricación | 2 componentes de Aprendiz de su oficio |

Los pergaminos de receta de componentes se compran al maestro por 50 Pelines y se consumen al usarlos desde la mochila para aprender la receta. Fabricarlos conserva sus ingredientes y su duración actuales; no se conceden componentes ni recetas para completar los encargos. Un primer suministro de recolección puede financiar esa compra. Las recetas superiores conservan sus precios y las excepcionales su botín raro.

## Diferencia con maestría

Estos encargos reponen suministros básicos y pagan Pelines. No comprueban los requisitos de un proyecto de maestría, no ascienden rangos, no enseñan recetas y no añaden experiencia ni prácticas por entregar. Recolectar o fabricar los objetos sí concede su experiencia habitual, una sola vez y con sus reglas existentes.

La misión de iniciación [Manos a la obra](PROFESSION-TUTORIAL.md) enseña a entregar uno de estos suministros. Su entrega final usa este mismo cupo y pago normales. La recompensa única de XP de la misión se concede aparte al confirmar el cierre con el maestro; repetir suministros diarios no vuelve a concederla.

Los proyectos de maestría conservan sus materiales, experiencia, prácticas, progreso y acceso desde el libro. No consumen el cupo diario de suministros. No se introducen nuevas historias, nombres personales de maestros ni encargos de matar criaturas.

## Alcance económico

El ingreso máximo de esta vía es **225 Pelines por personaje y día**, entregando tres veces componentes. Tres suministros de recolección pagan 150. Un recorrido que empieza con un suministro de recolección y continúa con dos de fabricación paga 200 antes de descontar recetas, herramientas y materiales. El límite se comparte también entre oficios de fabricación instantánea y temporal.

Estas cifras no son una duración medida de la nueva primera espada. El control anterior de 82 min 53 s sigue registrado en [Recorrido de control](PROFESSION-SESSION-REVIEW.md); cambiar de ruta, reservar componentes para entregar y escoger actividades requiere otra medición. Los encargos añaden ingresos acotados mientras se practican oficios; no sustituyen combate, comercio o venta ordinaria.

## Estado y comprobaciones

La configuración vive en `src/data/dailyOrders.json`, se incorpora al catálogo generado y se comparte con el cliente. `rpg_action`, acción `daily_order`, valida presencia reciente, personaje vivo, ausencia de combate, maestro, mapa, distancia de 3 m, oferta actual, cantidades sin vincular y cupo del día calculado por el servidor. Usa la revisión y los recibos existentes para evitar pagos duplicados. Los cambios de mochila invalidan las ofertas comerciales aceptadas, como las demás acciones de oficio.

El estado por personaje es `rpg.dailyOrders = {day, completed}`. Se crea al entregar; no hace falta migrar personajes existentes. La normalización del cliente lo conserva. Un reintento de una entrega anterior no paga otra vez ni consume cupo del nuevo día.

- `node --test scripts/test-daily-orders.mjs`: los doce maestros, consumo y pago, conservación de progreso, límite compartido, medianoche UTC, reintentos, concurrencia, rechazo de objetos vinculados y paridad entre desarrollo y SQL. Incluye aplicación repetida del parche sin modificar personajes ni contenido ajeno.
- `node tools/review-daily-orders.mjs`: conversación real de Isberto en el taller, confirmación de cantidades y recompensa, entrega contra SQL aislado, tres pagos y agotamiento del cupo en escritorio y 390 px. Capturas e informe en `art/daily-orders-review/`.
- `node scripts/apply-daily-orders-patch.mjs`: comprobación de solo lectura. `--apply` instala solo el catálogo y la nueva rama de `rpg_action`, conservando las demás entradas y ramas publicadas. Guarda copia y reversión antes de aplicar. `--verify` comprueba contenido y permisos. No modifica filas de personajes, mapas ni criaturas.

El estado de instalación se registra en `art/daily-orders-review/deployment.json`. La publicación del cliente web es independiente de aplicar estas dos funciones.

**Aplicación del 27 de octubre:** instaladas y verificadas las dos funciones, con doce ofertas y límite compartido de tres al día. La comprobación posterior confirmó que las otras entradas del catálogo y ramas de `rpg_action` se conservaron exactamente. No se modificaron filas de personajes, mapas ni criaturas. Copia y reversión en `art/daily-orders-review/`.

Pasan las **24 pruebas** combinadas de encargos diarios, obtención, talleres, presencia de recolección e IA. La conversación y el límite se comprobaron con SQL aislado desde el juego en escritorio y móvil de 390 px, sin errores de JavaScript. `npm --ignore-scripts run build` genera el cliente en `dist/`; no se ha publicado un nuevo alojamiento web.

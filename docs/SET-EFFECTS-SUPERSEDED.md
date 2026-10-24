# Historial de conjuntos: efectos sustituidos

Estado: histórico, NO vigente. La última directiva del usuario separa las habilidades de los conjuntos: estos mejoran cifras y no añaden mecánicas nuevas a las habilidades. Las aprobaciones que aparecen en los extractos siguientes pertenecen al diseño anterior y quedan sustituidas cuando contradicen esa directiva. No implementar ecos, explosiones, escudos, marcas, réplicas, curaciones secundarias o perforación de enemigos por llevar un conjunto. Sus cifras no se trasladan automáticamente a habilidades ni a nuevos bonos.

El bono numérico de Quebrantador (+9/14/19/24 % de daño de Disparo preciso) sí es compatible y se conserva en el documento vigente.

## Extracto anterior del diseño

Estructura de contenido aprobada: un bono pequeño de estadísticas acorde al conjunto con 2/4 y un efecto propio con 4/4 que refuerce una habilidad o función de clase, sin obligar a cambiar toda la rotación. Dos piezas de un conjunto y dos de otro conceden ambos bonos parciales; completar cuatro concede su bono de 2/4 y el de 4/4. Las orientaciones aprobadas por clase se detallan a continuación; sus cifras y reglas específicas siguen pendientes de implementación y equilibrio. No confundir los efectos de conjunto con encantamientos de arma: estos siguen vinculados al arma y sus golpes básicos, sin activarse mediante habilidades.

### Orientaciones del guerrero aprobadas

Se diseñan para los conjuntos existentes, sin sustituir ni eliminar sus modelos:

| Orientación | 2 piezas | 4 piezas |
| --- | --- | --- |
| Defensiva | Más guardia. | Usar Golpe contundente concede un escudo de absorción durante 4 segundos, del 5/6/7/8 % de vida máxima en azul/morado/dorado/naranja. |
| Ofensiva | Más potencia de ataque. | Usar Golpe contundente potencia el siguiente ataque básico un 15/20/25/30 % en azul/morado/dorado/naranja, durante un máximo de 5 segundos. Se consume al acertar y no se acumula. Solo aumenta el daño propio del básico, no el daño adicional de encantamientos. |

Ambas permiten jugar en solitario; la defensiva favorece el papel de tanque. Escudo defensivo aprobado: absorbe daño hasta agotarse o caducar a los 4 segundos, no se acumula consigo mismo y se calcula sobre la vida máxima, sin depender del daño causado por Golpe contundente. No exige acertar un impacto: el activador aprobado es usar la habilidad. Orden respecto a otras defensas y convivencia con otros escudos pendientes. La mejora ofensiva también se activa al usar Golpe contundente, sin exigir que acierte; se consume cuando acierta el siguiente básico o caduca a los 5 segundos. La asignación a conjuntos concretos y las reglas generales de refresco y retirada de efectos siguen pendientes. Todavía no están implementados. El efecto ofensivo es de conjunto, no una modificación de los encantamientos.

### Orientaciones del pícaro

- **Ofensiva aprobada:** 2 piezas aumentan la potencia de ataque; con 4, acertar Corte doble marca al objetivo durante 4 segundos. El pícaro que aplica la marca causa un 4/5/6/7 % más de daño con sus siguientes ataques básicos y habilidades contra él en azul/morado/dorado/naranja. No beneficia a otros jugadores, no se acumula ni aumenta daño adicional de encantamientos. Ningún impacto del Corte doble que aplica la marca recibe el bono. Asignación a conjuntos y reglas de renovación/retirada pendientes; no implementado.
- **Escurridiza descartada en su forma propuesta:** no se aprueba el bono de velocidad de movimiento tras usar la habilidad. El usuario pide rediseñarla.
- **Duelista aprobada, versión vigente:** 2 piezas aumentan modestamente la guardia; con 4, acertar Corte doble prepara una réplica durante 5 segundos. El siguiente ataque básico que acierte recupera el 20/25/30/35 % del coste de recurso realmente pagado por ese Corte doble en azul/morado/dorado/naranja y consume la réplica. Sin superar el recurso máximo; si el coste pagado fue cero, recupera cero. Una sola carga, sin acumulación ni activación desde daño de encantamientos. Asignación a conjuntos y reglas generales de renovación/retirada pendientes; no implementado. Se apoya en Corte doble, habilidad actual del pícaro en `src/data/combat.ts`.

Historial de revisión: la recuperación de recurso mediante réplica sustituye el diseño defensivo de reducción del siguiente golpe recibido. La propuesta de reducción 15/20/25/30 % durante 3 segundos no se aprueba y no forma parte del bono vigente. Mantener la guardia de 2 piezas.

### Orientaciones del mago aprobadas

- **Evocador:** 2 piezas aumentan la potencia mágica; con 4, acertar Descarga arcana provoca un eco de daño mágico en el mismo enemigo 1 segundo después. Daño base del eco = 10/15/20/25 % del daño del impacto principal antes de defensas en azul/morado/dorado/naranja; el eco se somete a la defensa del enemigo de forma independiente, sin partir del daño ya mitigado ni volver a aplicar bonificaciones incluidas en la base. No se repite ni activa encantamientos. Valores aprobados como punto de partida; no implementados.
- **Arcanista de área:** 2 piezas aumentan el maná máximo; con 4, Descarga arcana conserva su impacto principal y añade una explosión de 3 metros de radio alrededor del objetivo, que alcanza hasta 4 enemigos adicionales, sin añadir un segundo impacto al objetivo principal. Cada impacto secundario tiene un daño base del 15/20/25/30 % del daño principal antes de defensas en azul/morado/dorado/naranja y se somete a la defensa del receptor de forma independiente. Sustituye la propuesta de Canalizador con devolución de maná. El daño secundario no genera nuevas explosiones ni activa encantamientos. Radio, límite y cifras aprobados; selección de objetivos y obstáculos pendientes.

Ambas orientaciones y sus efectos generales quedan aprobados; conservan la rotación y favorecen respectivamente un objetivo o grupos. Asignación a conjuntos y reglas detalladas pendientes; no implementadas. El eco de Evocador tiene ya daño y retraso aprobados; su resolución si el objetivo muere o deja de estar disponible queda pendiente.

### Orientaciones del explorador

El usuario pide dos alternativas enteramente nuevas: se retiran Tirador (daño según distancia), Cazador (ralentización) y Acechador (sangrado). La aprobación anterior de Tirador queda revocada por esta última instrucción.

Estado de las alternativas revisadas:

- **Hostigador descartado:** el usuario pide sustituir la propuesta de acelerar dos ataques básicos tras Disparo preciso.
- **Quebrantador aprobado, versión simplificada:** 2 piezas aumentan la potencia de ataque; con 4, Disparo preciso causa un 9/14/19/24 % más de daño en azul/morado/dorado/naranja, sin condiciones adicionales. Sustituye la perforación de guardia anterior. La defensa del enemigo sigue aplicándose normalmente. La petición «un 1 % menos» se concreta en un punto porcentual menos que la propuesta 10/15/20/25 %. Asignación a conjuntos pendiente; no implementado.
- **Tiro de barrido aprobado:** 2 piezas aumentan el recurso máximo; con 4, Disparo preciso atraviesa al objetivo y puede golpear hasta dos enemigos situados detrás, en una franja estrecha, con daño reducido. No duplica impactos sobre un mismo enemigo ni activa encantamientos con los impactos secundarios. Posicionarse para alinear enemigos diferencia esta opción de una explosión de área. Anchura, alcance posterior, daño y validación de obstáculos pendientes.

Son efectos de conjunto, no encantamientos ni habilidades nuevas. Quebrantador y Tiro de barrido están aprobados en su funcionamiento general. Valores y asignación a conjuntos pendientes; no implementados.

### Orientaciones del clérigo aprobadas

El usuario pide otra propuesta tras presentar Sanador con curación periódica y Clérigo de batalla con ataque potenciado tras Curación. Ninguna de esas opciones queda aprobada.

Alternativas aprobadas:

- **Custodio:** 2 piezas aumentan la potencia de curación; con 4, Curación concede al objetivo, incluido el propio clérigo, un escudo durante 5 segundos equivalente al 10/15/20/25 % de la curación realizada antes de descontar el exceso de vida en azul/morado/dorado/naranja. Funciona también con el objetivo a vida completa. No se acumula consigo mismo: una nueva aplicación conserva el mayor entre el escudo restante y el nuevo, renovando la duración. Convivencia entre diferentes clérigos y otros tipos de escudo pendiente.
- **Restaurador:** 2 piezas aumentan el maná máximo; con 4, Curación conserva su efecto principal y cura a hasta 4 aliados adicionales dentro de 4 metros del objetivo. Cada curación secundaria equivale al 15/20/25/30 % de la curación principal antes de descontar el exceso de vida en azul/morado/dorado/naranja. El objetivo principal no recibe una segunda curación y las secundarias no generan otras. Si hay más de 4 aliados elegibles, priorizar menor porcentaje de vida. Desempates, definición de aliados y obstáculos pendientes.

Ambas funcionan también al curarse el propio clérigo. El escudo de Custodio tiene magnitud, duración y regla de reaplicación aprobadas; Restaurador tiene magnitud, radio, límite de objetivos y prioridad por porcentaje de vida aprobados. Definición de aliados, desempates, obstáculos, convivencia entre clérigos y asignación a conjuntos pendientes. Requiere diseñar selección y validación de aliados y curación cooperativa: la Curación actual en `src/data/combat.ts` se aplica al propio personaje y no acredita un sistema de sanación de grupo implementado. Los nuevos efectos de conjunto están aprobados como diseño, todavía no implementados.


## Extracto anterior de la revisión

## Primera vertical propuesta

Restaurador, cifras aprobadas: Curación alcanza hasta 4 aliados adicionales dentro de un radio de 4 metros del objetivo, con curación del 15/20/25/30 % de la principal antes del exceso de vida en azul/morado/dorado/naranja. Excluir al objetivo principal de las secundarias y no permitir encadenamiento. Si hay más de cuatro elegibles, priorizar menor porcentaje de vida. Definición de aliados, desempates, obstáculos y asignación a conjuntos pendientes; no implementado. Concreta las magnitudes, radio, límite y selección básica antes pendientes.

Custodio, cifras aprobadas: Curación añade un escudo de 5 segundos al objetivo por el 10/15/20/25 % de la curación antes de descontar el exceso de vida en azul/morado/dorado/naranja. Funciona a vida completa. Sin acumulación consigo mismo; reaplicar conserva el mayor entre el escudo restante y el nuevo y renueva su duración. Convivencia entre distintos clérigos y otros tipos de escudo pendiente; no implementado. Concreta magnitud, duración y reaplicación antes pendientes.

Arcanista de área, cifras aprobadas: explosión centrada en el objetivo de Descarga arcana, radio de 3 metros y hasta 4 enemigos adicionales. Cada uno recibe un daño base del 15/20/25/30 % del impacto principal antes de defensas en azul/morado/dorado/naranja, aplicando su propia defensa. El objetivo principal no recibe además la explosión; no se encadena ni activa encantamientos. Selección de objetivos, obstáculos y asignación a conjuntos pendientes; no implementado. Concreta radio, límite y magnitudes antes pendientes.

Evocador, cifras aprobadas: acertar Descarga arcana genera un eco sobre el mismo enemigo 1 segundo después, con daño mágico base del 10/15/20/25 % del impacto principal antes de defensas en azul/morado/dorado/naranja. Aplicar defensa al eco de forma independiente; no calcularlo desde el daño principal ya mitigado ni duplicar modificadores incluidos en su base. No activa encantamientos ni produce otro eco. Concreta magnitud y retraso antes pendientes; muerte o indisponibilidad del objetivo, asignación y reglas generales de efectos pendientes. No implementado.

Duelista, cifras aprobadas: la réplica dura 5 segundos y se consume al acertar el siguiente básico, recuperando el 20/25/30/35 % del coste realmente pagado por el Corte doble que la preparó en azul/morado/dorado/naranja. Limitar al recurso máximo; coste cero no genera recurso. Sin acumulación ni activación por daño de encantamientos. Concreta cantidad y duración antes pendientes; redondeo, renovación/retirada de efectos y asignación a conjuntos siguen pendientes. No implementado.

Pícaro ofensivo, valores aprobados: acertar Corte doble marca al objetivo durante 4 segundos; los siguientes ataques básicos y habilidades del mismo pícaro causan un 4/5/6/7 % más de daño contra él en azul/morado/dorado/naranja. Sin acumulación, beneficio a terceros ni aumento del daño adicional de encantamientos. Excluir todos los impactos del Corte doble que aplica la marca, no solo el primero. Renovación, retirada y asignación a conjuntos pendientes; no implementado. Concreta los valores ofensivos antes pendientes.

Guerrero ofensivo, valores aprobados: usar Golpe contundente potencia el siguiente ataque básico un 15/20/25/30 % según calidad azul/morado/dorado/naranja. Ventana máxima de 5 segundos, consumo al acertar, sin acumulación. Solo aumenta el daño propio del básico; no multiplica daño adicional de encantamientos. Valores de partida para equilibrio, todavía no implementados. Sustituye la magnitud y caducidad ofensivas antes pendientes en esta revisión.

Valores iniciales aprobados para bonos de 2 piezas, por calidad verde/azul/morado/dorado/naranja: potencia de ataque o mágica, guardia o potencia de curación +2/+3/+4/+5/+6 %; recurso máximo +4/+6/+8/+10/+12 %. Cada conjunto mejora solo la estadística que tenga asignada. Son cifras de partida, pendientes de contraste con fórmulas de combate y efectos de 4 piezas; no implementadas. Sustituyen la ausencia previa de magnitudes en esta revisión.

Bonos de estadísticas de 2 piezas aprobados como porcentajes de la estadística del personaje y su equipo, calculados antes de las bonificaciones temporales. El porcentaje aumenta gradualmente con la calidad. Si dos bonos parciales mejoran la misma estadística, sumar sus porcentajes y aplicarlos sobre la misma base, excluyendo ambos bonos de ella; no multiplicarlos entre sí. Si afectan a estadísticas distintas, aplicar cada uno a la correspondiente. Ejemplo ilustrativo, no cifras aprobadas: 4 % + 4 % = 8 %. Magnitudes por estadística/calidad pendientes; no implementadas.

Bonificaciones de conjunto por calidad aprobadas: gris sin bonos, verde con bono de 2 piezas, azul y superiores con bonos de 2 y 4 piezas. Desde azul, el efecto de 4 piezas mantiene su funcionamiento y mejora gradualmente sus cifras en calidades superiores, sin añadir automáticamente efectos nuevos. Mezcla de calidades aprobada: piezas del mismo conjunto cuentan juntas; bono de 2 según segunda mejor calidad y bono de 4 según peor de las cuatro. Se respetan las calidades mínimas de activación: dos verdes o superiores para el parcial, cuatro azules o superiores para el completo. Dos moradas y dos azules conceden parcial morado y completo azul. Identidad entre modelos de catálogo y cifras pendientes; no implementadas.

Explorador: aprobados Quebrantador, versión simplificada (2 piezas: potencia de ataque; 4: Disparo preciso causa un 9/14/19/24 % más de daño en azul/morado/dorado/naranja, sin condiciones adicionales ni perforación de guardia; la defensa se aplica normalmente) y Tiro de barrido (2: recurso máximo; 4: Disparo preciso atraviesa al objetivo y golpea hasta dos enemigos alineados detrás con daño reducido, sin impactos duplicados ni activación de encantamientos en los impactos secundarios). El usuario sustituye expresamente la perforación por daño directo y reduce en un punto porcentual la propuesta 10/15/20/25 %. Hostigador con ataques acelerados queda descartado, al igual que Tirador, Cazador y Acechador. Magnitudes de barrido, geometría, obstáculos y asignación a conjuntos pendientes; no implementados.

Clérigo: aprobados Custodio (2 piezas: potencia de curación; 4: Curación añade un pequeño escudo temporal al objetivo, incluido el propio clérigo, sin acumulación del mismo efecto) y Restaurador (2: maná máximo; 4: Curación sana en menor cantidad a aliados próximos al objetivo, sin duplicar la curación principal ni encadenar curaciones secundarias). Reemplazan las propuestas previas no aprobadas de curación periódica y ataque potenciado. Selección de aliados, sanación cooperativa, cifras, radio, límite de objetivos, duración, convivencia entre clérigos y asignación a conjuntos pendientes; no implementados.

Mago: aprobados Evocador (potencia mágica a 2 piezas y eco de daño de Descarga arcana al mismo objetivo a 4, sin repetirse ni activar encantamientos) y Arcanista de área (maná máximo a 2 y explosión pequeña de Descarga arcana a 4, con daño reducido a enemigos próximos, sin duplicar daño al objetivo principal, encadenarse o activar encantamientos). La alternativa de área sustituye a Canalizador y su devolución de maná. Radio, límite de objetivos, magnitudes, retraso del eco y asignación a conjuntos siguen pendientes; no implementadas.

Pícaro: aprobadas Ofensiva (2 piezas: potencia de ataque; 4: marca de daño tras Corte doble, con cifras detalladas en esta revisión) y Duelista, versión revisada (2: guardia; 4: acertar Corte doble prepara una réplica que recupera una pequeña cantidad del recurso de combate al acertar el siguiente ataque básico). La réplica tiene una sola carga, caduca, no se acumula y no se activa desde daño de encantamientos. Sustituye tanto a Escurridiza con velocidad de movimiento como a la versión anterior de Duelista que reducía el siguiente golpe recibido; la escala defensiva 15/20/25/30 % durante 3 segundos no está aprobada. Cantidad y duración de réplica y asignación a conjuntos pendientes; no implementadas.

Guerrero: aprobadas dos orientaciones para los conjuntos existentes. Defensiva: guardia con 2 piezas; con 4, usar Golpe contundente concede un escudo de absorción del 5/6/7/8 % de vida máxima en azul/morado/dorado/naranja, durante 4 segundos, hasta agotarse o caducar, sin acumularse consigo mismo ni depender del daño causado. Ofensiva: potencia de ataque con 2 y mejora del siguiente ataque básico tras usar la habilidad con 4. Ambas deben servir para jugar en solitario; la defensiva favorece tanque. Asignación a conjuntos, orden defensivo, convivencia entre escudos y magnitud/caducidad del efecto ofensivo pendientes; no implementadas.

Estructura de bonificaciones de conjunto aprobada: 2/4 mejora ligeramente estadísticas acordes al conjunto; 4/4 añade un efecto propio sobre una habilidad o función de clase sin cambiar toda la rotación. Combinar dos conjuntos de dos piezas concede los dos bonos parciales como alternativa al conjunto completo. Armas y joyas no cuentan entre las cuatro piezas. Efectos concretos y valores siguen pendientes y no implementados; diseñar y comparar 2+2 frente a 4 piezas para que ambas configuraciones sean viables. Esta decisión no cambia los encantamientos universales ligados al arma y sus golpes básicos.

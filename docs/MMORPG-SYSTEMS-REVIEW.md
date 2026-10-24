# Revisión de sistemas MMORPG y dependencias

## Actualización del 24 de octubre de 2026

Se han implementado atributos de combate, Guardia porcentual, identidad de equipo, conjuntos numéricos, cinco encantamientos, profesiones, recetas, colas sin conexión, recolección, herramientas y un encuentro cooperativo repetible con curación a aliados. El estado concreto, valores iniciales y límites están en [RPG-IMPLEMENTATION.md](RPG-IMPLEMENTATION.md).

El inventario de carencias que sigue es la **auditoría histórica del día 23**. No debe interpretarse como el estado actual ni como una lista de sistemas ya comprobados en una partida multijugador.

Fecha: 23 de octubre de 2026. Revisión del código del repositorio, no auditoría del estado de un servidor desplegado. «No localizado» significa que no se ha encontrado un sistema general en los módulos revisados; no demuestra ausencia de cualquier prototipo o herramienta aislada.

## Estado y prioridades

| Sistema | Evidencia actual | Qué necesita para el diseño de equipo | Prioridad |
| --- | --- | --- | --- |
| Cuentas, personajes y sesiones | Servicios de cuenta, presencia y sesiones en `src/services/` y SQL 04/06/08 | Conservar autoridad y propiedad del personaje en todas las operaciones de equipo | Base existente |
| Estadísticas y nivel | `src/data/stats.ts`, `data.ts`, `combat.ts`; SQL 03/06/07 | Conectar atributos a efectos reales y unificar escalado básico/habilidad | P0 |
| Catálogo y equipo | `weapons.ts`, `outfits.ts`, `equipment.ts`; generador SQL y nueve ranuras, con calzado incluido en piernas | Reglas compartidas, requisitos y versiones | P0 |
| Identidad de objetos | `ItemStack` contiene `id`, `count`, `bound`; el normalizador reconstruye solo esos campos | Instancias para conservar encantamientos diferentes en dos copias del mismo modelo | P0 antes de encantar |
| Efectos y estados | Hay comida temporizada y sobrecuración; no se localizó motor general de sangrado, absorción, marcas y cargas | Duración, acumulación, disparadores, origen, recarga e idempotencia | P0 antes de efectos nuevos |
| Comercio y banco | SQL 12/15, revisiones de ofertas, bloqueos y operaciones atómicas | Transportar identidad y encantamiento, conservar vínculo, cancelar aceptaciones al cambiar objetos | P0 al migrar instancias |
| Combate PvE | RPC autoritativa; encuentro tipado como `shadowling`, ligado a la introducción | Enemigos generalizados, encuentros compartidos, participantes y reglas de distancia/objetivos | P1 |
| Grupos y apoyo | Invitaciones, chat y bonificación de reservas; curación activa del clérigo se aplica a sí mismo | Curación a aliados, apoyo, amenaza y reparto de recompensas antes de diseñar roles de grupo completos | P1 |
| Misiones y recompensas | Gnomi e Isberto, XP de bienvenida y botín de historia | Bucle repetible de combate/exploración y recompensas; tablas de botín y fuentes de equipo | P1 |
| Economía | Monedas, vendedor, compra/venta, banco y comercio directo | Entradas y salidas de moneda/materiales, precios de pergaminos y demanda de artesanía | P1 |
| Artesanía y recolección | Atributos y textos las mencionan; no se localizaron recetas/profesiones/recolección generales en los módulos revisados | Recursos, recetas, requisitos y creación transaccional; opciones de obtención de pergaminos | P1 tras cerrar el circuito de objetos |
| Conjuntos y encantamientos | Existen colecciones visuales, sin bonificaciones mecánicas ni encantamientos | Definiciones explícitas, conteo, cálculo y representación consistente | Próxima vertical jugable |
| Muerte y recuperación | Hay salud, muerte, huida y descanso; cama y banco en la introducción | Política única para perder cargas, efectos, encuentros y recompensas en muerte o desconexión | P1 |
| Mundo e instancias | Mapas, viajes, interiores, reloj y presencia compartida | Persistencia de enemigos/recursos, alcance de instancias y sincronía de encuentros | P1 al ampliar PvE |
| Gremios, subastas, correo y reputación | No se localizaron sistemas generales; el gremio narrativo de Gnomi no equivale a gremios de jugadores | Diseñar cuando población y economía justifiquen su coste; cola de entregas si se necesita recuperar objetos | P2, según objetivos |
| PvP | No se localizó un modo general | Decidir si encaja; requiere objetivos, emparejamiento, control y equilibrio específicos | Opcional, posterior |

P0 = dependencia técnica o de coherencia antes de ampliar equipo. P1 = siguiente bucle jugable. P2 = expansión posterior, no requisito obligatorio para que el juego sea divertido.

## Hallazgos que afectan al diseño

### 1. Los atributos no cumplen todavía toda su descripción

Corpulencia, coeficiente inicial aprobado: +2 % de vida máxima por punto, sumado linealmente sobre vida base del personaje y vida de equipo. Fórmula parcial: (vida base + vida de equipo) × (1 + 0,02 × Corpulencia). No concede reducción de daño ni cura automáticamente por aumentar el máximo mediante equipo. Redondeo, integración de otros modificadores y conservación de vida actual al cambiar equipo pendientes. No se ha sustituido todavía la fórmula implementada.

`src/data/data.ts` anuncia daño para fuerza, poder mágico para intelecto, resistencia al daño para corpulencia, velocidad para agilidad y efectos de oficio/comercio/exploración. En los cálculos revisados:

- Corpulencia aumenta vida y participa en estamina.
- Intelecto aumenta maná.
- Agilidad participa en estamina; cadencia y movimiento no toman ese atributo en los módulos revisados.
- El daño de combate no usa fuerza ni intelecto, sino arma, nivel o rango.
- No se localizaron las fórmulas de oficio, negociación y hallazgo anunciadas para pericia, presencia y percepción.

Antes de ofrecer atributos en armas hay que cerrar su función y hacer coincidir ficha, creador, combate y servidor. No recomendar invertir puntos basándose en efectos que aún no se aplican.

Decisión funcional vigente: Fuerza mejora potencia del guerrero; Agilidad, potencia de pícaro/explorador; Intelecto, potencia del mago y daño/curación del clérigo. El atributo principal beneficia básicos y habilidades. Corpulencia aumenta vida máxima y la Guardia del equipo reduce daño recibido. Agilidad no aumenta automáticamente velocidad de ataque ni Corpulencia concede además reducción de daño. El reparto está aprobado; coeficientes y cambios de implementación pendientes. Los efectos actuales sobre maná y estamina se revisarán aparte, sin asumir su eliminación.

### 2. Ataque básico y habilidad no comparten la misma escala de nivel

Cadencia y habilidades, regla aprobada: separar el daño de cada básico de la potencia usada por habilidades. A igual categoría y potencia, un arma rápida y una lenta deben dar habilidades de fuerza equivalente. Las diferencias de frecuencia y daño por básico se mantienen. Equilibrar encantamientos teniendo en cuenta cadencia, sin ventaja automática por golpear más veces. Fórmula concreta de normalización y asignación al catálogo pendientes; no implementado.

Crecimiento común aprobado: multiplicador por nivel = 1 + 0,02 × (nivel − 1), aplicado una sola vez tanto a básicos como a daño y curación de habilidades, junto al atributo principal. Nivel 1: sin aumento; 10: +18 %; 50: +98 %. Al implementar, sustituye el factor actual del básico de 5 % por nivel y la ausencia de ese factor en habilidades. No duplicarlo al resolver coeficientes/rangos de habilidades ni al calcular efectos desde daño ya escalado. Armas, conjuntos y rangos conservan sus aportaciones propias. Las descripciones siguientes del 5 % reflejan el funcionamiento anterior aún no modificado, no la fórmula nueva aprobada.

Conversión inicial de Guardia aprobada: reducción = min(0,60; Guardia / (Guardia + 20)). Ejemplos: 2 puntos ≈ 9,1 %; 5 = 20 %; 10 ≈ 33,3 %; 20 = 50 %; 30 = 60 %. Usar la misma conversión en combate y tooltip; no añadir además una resta plana por impacto. Esta regla concreta la conversión antes pendiente, pero no cambia todavía las fórmulas implementadas. Tratamiento de nivel, daño periódico/ambiental y redondeo pendientes.

Guardia, comportamiento aprobado: mitiga un porcentaje del daño directo de básicos y habilidades, con rendimiento decreciente y un máximo inicial del 60 %. No resta una cantidad fija por impacto, para no penalizar especialmente armas rápidas. Conversión de puntos a porcentaje, referencia de nivel y daño periódico/ambiental pendientes. Esta decisión requiere sustituir cualquier resta plana incompatible al implementar, manteniendo sincronizados cliente, servidor y tooltips.

Coeficiente inicial del atributo principal aprobado: +1 % de potencia por punto, acumulado linealmente (multiplicador 1 + 0,01 × atributo principal). Aplicar a la potencia del arma y equipo para básicos y habilidades; en clérigo, también a la curación. Calcular después el bono de conjunto sobre esa potencia, sin multiplicar otra vez por atributo al resolver la habilidad. La integración del crecimiento por nivel y la normalización de armas con cadencias distintas siguen pendientes; esta aprobación no cambia todavía el combate implementado.

El básico multiplica potencia por `1 + 0,05 × (nivel − 1)`. Las habilidades ofensivas usan coeficiente, rango y potencia del arma, sin ese factor de nivel. Con espada inicial, a nivel 50 el básico sería 35 y Golpe contundente de rango 1 sería 18 antes de otros cambios. Esto compara fórmulas, no una medición de equilibrio del juego completo.

La habilidad puede dejar de sentirse como una mejora aunque consuma recurso y tenga recarga. Hay que resolverlo antes de añadir porcentajes de encantamiento o conjunto.

### 3. El equipo no tiene identidad por copia

Agregar `enchantmentId` a un objeto no basta: `sanitizeInventory`/`sanitizeEquipment` reconstruyen tres campos; otras rutas comparan o apilan por ID y vínculo. Banco, comercio, botín y guardado deben usar la misma identidad y revisión. De lo contrario se pueden perder o confundir encantamientos entre copias.

### 4. Un grupo social no es todavía combate cooperativo completo

Existen grupos y sus bonificaciones, pero el encuentro de combate revisado se guarda en el personaje y admite `shadowling`. La habilidad del clérigo cura al propio personaje. Antes de prometer conjuntos de tanque o sanador de grupo se necesitan objetivos compartidos, curación a compañeros, participación y reglas de amenaza/recompensas.

### 5. Hay una buena base transaccional que conviene ampliar

Comercio usa revisión de oferta y bloqueos; banco conserva objetos y coordina cambios con comercio. El catálogo de equipo se genera para SQL. Extender esas estructuras existentes permite coordinar encantamiento, materiales, moneda, equipo y ofertas. Revisar el alcance de bloqueos compartidos al crecer la concurrencia: no elegir un bloqueo global por defecto para cada acción de combate.

## Contratos entre sistemas

| Momento | Fuente de verdad | Sistemas que deben reaccionar |
| --- | --- | --- |
| Equipar o retirar | Instancia y ranura validadas en servidor | Estadísticas, conjunto, vida/recurso ajustados sin curación, oferta de comercio, tooltip y apariencia |
| Aplicar pergamino | Una transacción sobre instancia, inventario y costes | Consumo, encantamiento anterior sustituido, revisión, cálculo y confirmación al jugador |
| Usar habilidad | Sesión, objetivo, alcance, coste y recarga validados | Daño/curación, un disparo de efectos elegibles, evento visual y estado resultante |
| Impactar con arma encantada | Arma de origen e impacto válido confirmados | Daño del arma y su encantamiento, con límites y sin activación mediante habilidades |
| Morir un enemigo | Encuentro y participantes confirmados | Botín único, contribución, XP, misión y derechos de recogida |
| Obtener/crear equipo | Fuente de recompensa o receta validada | Identidad única, capacidad de inventario y entrega alternativa si se decide admitirla |
| Cambiar grupo o mapa | Estado de grupo/mundo validado | Reservas, destinatarios de apoyo, efectos permitidos y visibilidad; conservar tiempos de servidor |
| Reintentar o reconectar | Estado y revisiones persistidos | Reenviar resultado sin duplicar pago, recompensa, efecto o fabricación |

## Reglas de equilibrio propuestas

- Un presupuesto común por escalón: arma, atributos, encantamiento, conjunto, comida y grupo deben evaluarse juntos.
- El aumento de reservas también aumenta regeneración porcentual; cualquier nueva bonificación de vida o recurso afecta a la recuperación, no solo al tamaño de barra.
- Si se añaden reducción de coste o de recarga, fijar mínimos y topes compartidos. Evitar bucles de recurso o activaciones infinitas.
- Los encantamientos afectan al arma y sus golpes, no se activan mediante habilidades. Identificar el arma de origen y equilibrar su aportación entre cadencias distintas; los impactos de habilidades no activan los pergaminos.
- Los conjuntos dan una recompensa por completarlos sin eliminar la opción de combinar piezas. Comparar tanto daño como supervivencia, apoyo, consumo y tiempo para derrotar enemigos.
- El contenido debe aportar motivos para obtener equipo; vender todo el catálogo desde el inicio no sustituye un circuito de recompensas.
- No añadir pérdida de equipo, durabilidad, destrucción al encantar, cuotas diarias ni PvP por inercia: requieren una decisión de experiencia de juego.

## Primera vertical propuesta

### Separación vigente de habilidades y conjuntos

Maldición umbría, cifras aprobadas: cada tercer básico contra el mismo enemigo añade daño oscuro del 20/25/30/35/40 % de un básico antes de defensas en verde/azul/morado/dorado/naranja, sujeto a Guardia. Marcas de 6 segundos, sin generar marcas ni efectos secundarios desde la descarga. Sustituye la antigua propuesta única del 30 %. No implementado.

Bloque agrupado aprobado en `WEAPON-SYSTEM-DESIGN.md`: bonos numéricos de 4 piezas para todas las orientaciones. Escala azul/morado/dorado/naranja de +9/+14/+19/+24 % para daño o curación de habilidad; +5/+7/+9/+11 % para vida máxima, o −5/−7/−9/−11 % para coste según orientación. También aprobados: Guardia antes de barreras y vida; cambiar equipo conserva vida/recurso actuales limitándolos al nuevo máximo, sin rellenarlos; retirar inmediatamente bonos de piezas desequipadas; conservar precisión interna y redondear presentación. Reemplaza los bonos pendientes de rediseño y sus cifras anteriores, sin reactivar efectos archivados. Los costes monetarios enteros siguen por definir. Aprobado como diseño, no implementado.

Vampirismo aprobado: cada básico recupera vida equivalente al 2/3/4/5/6 % de la vida realmente quitada al enemigo en verde/azul/morado/dorado/naranja. Calcular tras defensas y absorciones y excluir exceso de daño al matar; no activar con habilidades ni daño de encantamientos ni superar la vida máxima del portador. Redondeo y tratamiento de recuperaciones pequeñas pendientes; no implementado.

Fuego aprobado: cada básico acertado añade daño de fuego del 5/6/7/8/9 % del daño propio del básico antes de defensas en verde/azul/morado/dorado/naranja. Aplicar la Guardia del receptor al componente de fuego. Sin quemadura ni daño periódico, sin generar cargas ni activar otros encantamientos, y sin activación por habilidades. Cifras iniciales de diseño, no implementadas; unificar la definición de daño base con Rayo y Escarcha al desarrollar.

Escarcha, cifras y renovación aprobadas: barrera cada tres básicos acertados, duración de 4 segundos y absorción del 20/25/30/35/40 % del daño de un básico del arma antes de defensas en verde/azul/morado/dorado/naranja. Reaplicar conserva la mayor entre la barrera restante y la nueva y renueva la duración, sin sumar absorciones. Orden respecto a Guardia y otros escudos, definición exacta de la base de daño y retirada del efecto pendientes; no implementado. Concreta valores y renovación antes pendientes.

Rayo, daño inicial aprobado: 40/50/60/70/80 % del daño de un básico del arma antes de defensas en verde/azul/morado/dorado/naranja. La descarga causa daño eléctrico al segundo enemigo, con su propia mitigación por Guardia; no añade daño eléctrico al objetivo principal. Concreta el daño por grado antes pendiente; definición exacta de la base de daño y su integración con otros modificadores, desempates y elegibilidad pendientes. No implementado.

Rayo, alcance y selección aprobados: salto de hasta 4 metros desde el enemigo golpeado por el básico al enemigo válido más cercano distinto del principal, sin atravesar paredes. Si no existe segundo objetivo elegible, aplicar la regla de descarga preparada. Desempate, daño por grado y validaciones concretas de elegibilidad pendientes; no implementado. Concreta el radio y selección antes pendientes.

Rayo sin segundo objetivo, regla aprobada que concreta el caso antes pendiente: conservar una única descarga preparada si al cuarto básico no hay otro enemigo cercano elegible. El siguiente básico acertado con un segundo objetivo válido activa la descarga. No acumular descargas ni seguir almacenando nuevos ciclos mientras esté preparada. Los básicos acertados mantienen su actividad; 6 segundos sin acertar, cambio de arma/encantamiento o muerte la eliminan. Radio, selección y daño pendientes; no implementado.

Contadores de encantamientos aprobados: Escarcha (tres básicos) y Rayo (cuatro) conservan progreso al cambiar de enemigo; Maldición umbría requiere tres golpes en el mismo objetivo. Reiniciar al cambiar arma o encantamiento, morir o transcurrir 6 segundos sin acertar un básico válido. En Umbría, la caducidad de cada objetivo se renueva con golpes a ese objetivo. Habilidades y efectos secundarios no suman cargas. Los contadores pertenecen al portador y a su instancia de arma, sin compartirlos. Rayo sin segundo objetivo y reaplicación de barreras pendientes; no implementados.

Rayo y Escarcha aprobados: Rayo provoca una descarga eléctrica que salta del objetivo a otro enemigo cercano cada cuatro ataques básicos acertados, con un único salto, sin nuevas descargas ni activación de otros encantamientos; su daño mejora por grado. Escarcha concede al portador una pequeña barrera temporal de hielo cada tres básicos acertados, sin acumulación, con absorción creciente por grado; sustituye la ralentización. Son efectos del arma, no de conjuntos; las habilidades no generan cargas y los efectos todavía no están implementados. Daños, absorción, reinicio/renovación de contadores, duración, radio y tratamiento sin segundo objetivo pendientes.

Grados de encantamiento aprobados: pergaminos verdes, azules, morados, dorados y naranjas. La intensidad depende del grado aplicado; solo puede aplicarse uno de calidad igual o inferior al arma principal. Mejorar requiere consumir otro pergamino, sustituyendo el anterior; cambiar de arma no mejora ni transfiere automáticamente su encantamiento. Cifras, costes y recetas por grado pendientes; no implementado.

Encantamiento y vínculo aprobados: aplicar un pergamino no liga el arma. Un arma no ligada puede venderse o regalarse con su encantamiento hasta equiparse por primera vez; cambiar encantamiento no elimina un vínculo existente. Reemplazar consume el nuevo pergamino y elimina el anterior. Las transacciones deben conservar identidad y encantamiento de cada copia; no apilar ni confundir copias con efectos distintos. No implementado.

Compatibilidad de encantamientos aprobada para la primera versión: solo arma principal desde verde, con un único encantamiento activo por personaje. Escudos, libros y dagas secundarias mantienen estadísticas pero no admiten otro encantamiento; mejoras específicas futuras pendientes de diseño. No está implementado aún el sistema de encantamientos.

El usuario confirma empezar con mejoras numéricas y ampliar efectos más adelante. Priorizar ahora las fórmulas comunes de atributos y combate, la identidad por copia y las dependencias cooperativas; no seguir equilibrando como vigentes los efectos de conjunto archivados.

Última directiva del usuario: el equipo beneficia numéricamente las habilidades sin transformarlas ni añadir efectos especiales. El funcionamiento de las habilidades se diseña en su propio sistema. Se sustituyen los bonos de conjunto que añadían escudos, marcas, réplicas, ecos, explosiones, curaciones secundarias y disparos que atraviesan objetivos. Su historial queda en [SET-EFFECTS-SUPERSEDED.md](SET-EFFECTS-SUPERSEDED.md), sin vigencia para implementar.

Se conservan las orientaciones y estadísticas de 2 piezas, los umbrales 2/4 y 4/4, la mezcla de calidades y la alternativa 2+2. Los bonos de 4 deben rediseñarse como mejoras numéricas. Quebrantador conserva su aumento directo del daño de Disparo preciso del 9/14/19/24 % en azul/morado/dorado/naranja, compatible con esta regla. No trasladar automáticamente cifras de efectos retirados a nuevos bonos. Encantamientos siguen separados, vinculados al arma y golpes básicos. No se han implementado los efectos retirados ni los nuevos bonos.

Valores iniciales aprobados para bonos de 2 piezas, por calidad verde/azul/morado/dorado/naranja: potencia de ataque o mágica, guardia o potencia de curación +2/+3/+4/+5/+6 %; recurso máximo +4/+6/+8/+10/+12 %. Cada conjunto mejora solo la estadística que tenga asignada. Son cifras de partida, pendientes de contraste con fórmulas de combate y efectos de 4 piezas; no implementadas. Sustituyen la ausencia previa de magnitudes en esta revisión.

Bonos de estadísticas de 2 piezas aprobados como porcentajes de la estadística del personaje y su equipo, calculados antes de las bonificaciones temporales. El porcentaje aumenta gradualmente con la calidad. Si dos bonos parciales mejoran la misma estadística, sumar sus porcentajes y aplicarlos sobre la misma base, excluyendo ambos bonos de ella; no multiplicarlos entre sí. Si afectan a estadísticas distintas, aplicar cada uno a la correspondiente. Ejemplo ilustrativo, no cifras aprobadas: 4 % + 4 % = 8 %. Magnitudes por estadística/calidad pendientes; no implementadas.

Bonificaciones de conjunto por calidad aprobadas: gris sin bonos, verde con bono de 2 piezas, azul y superiores con bonos de 2 y 4 piezas. Desde azul, el efecto de 4 piezas mantiene su funcionamiento y mejora gradualmente sus cifras en calidades superiores, sin añadir automáticamente efectos nuevos. Mezcla de calidades aprobada: piezas del mismo conjunto cuentan juntas; bono de 2 según segunda mejor calidad y bono de 4 según peor de las cuatro. Se respetan las calidades mínimas de activación: dos verdes o superiores para el parcial, cuatro azules o superiores para el completo. Dos moradas y dos azules conceden parcial morado y completo azul. Identidad entre modelos de catálogo y cifras pendientes; no implementadas.

### Economía de profesiones: dirección aprobada

El usuario ha aprobado artesanía y mazmorras como vías de potencia comparable y ha pedido profesiones muy importantes, con objetos excelentes exclusivos de fabricación. No todo el mejor equipo debe salir directamente de un jefe. Estos acuerdos son de diseño: el sistema general de profesiones todavía requiere implementación.

Propuestas para concretar con el usuario:

- **Equipo exclusivo fabricado:** armas con perfiles propios, piezas y conjuntos de recetas especiales; mismo presupuesto de potencia que otras opciones de su escalón, con ventajas y compensaciones útiles. Completar una receta avanzada debe tener valor jugable.
- **Demanda recurrente:** pergaminos consumibles de encantamiento, comida y pociones. El consumo ya acordado de pergaminos ofrece una salida natural para materiales; no hace falta asumir destrucción de equipo o durabilidad.
- **Vínculo con el mundo:** proponer materiales comunes de recolección y componentes especiales de exploración y encuentros. Está aprobado que todos los materiales de profesiones, incluidos los raros, puedan comprarse y venderse entre jugadores; no se exige obtenerlos personalmente para fabricar. Las fuentes concretas de materiales quedan por decidir.
- **Recetas aprobadas:** aprendizaje permanente por personaje. Maestros enseñan recetas básicas; exploración, enemigos y mazmorras proporcionan recetas especiales; proyectos de maestría desbloquean recetas avanzadas del oficio. Las recetas encontradas pueden venderse antes de aprenderlas y aprenderlas consume el pergamino. No se extiende automáticamente su comercio a desbloqueos de maestro o maestría. Requisitos, precios y distribución concreta quedan pendientes; el sistema todavía requiere implementación.
- **Comercio y encargos:** aprobado el ligado al equipar para el equipo fabricado: puede venderse o regalarse hasta su primer equipamiento, que lo liga a ese personaje. No extender esta regla automáticamente a consumibles, muebles o botín de mazmorra. Proponer, más adelante, encargos con materiales del comprador y comisión del artesano; no exigir entregar objetos a otro jugador sin protección. La regla de vínculo es una decisión de diseño, no una funcionalidad nueva implementada.
- **Progresión aprobada:** cada oficio progresa por separado mediante fabricación de recetas de dificultad adecuada. Las recetas demasiado fáciles dejan de conceder experiencia y siguen siendo fabricables para uso o venta. Nuevas recetas se aprenden mediante maestros, exploración y comercio; los rangos superiores requieren proyectos de maestría. Quedan por definir umbrales de experiencia, distribución concreta de recetas y proyectos concretos. Tener una clase de combate no debe determinar automáticamente el oficio.
- **Resultados claros:** conservar estadísticas fijas por modelo. La fabricación no introduce variaciones aleatorias del mismo modelo sin una nueva decisión del usuario.
- **Valor del botín:** conservar recompensas y modelos de mazmorra propios, además de posibles materiales y recetas; no convertir todas las recompensas en ingredientes indistinguibles.

### Acceso y afinidades raciales: acordado

- Todos los personajes pueden dominar todos los oficios. No hay un límite de oficios ni una exclusión permanente entre ellos; conseguir todas las maestrías debe requerir mucho esfuerzo.
- Acordado: los humanos reducen un 15 % el tiempo de todas las recetas con duración, incluidos equipo, muebles y pergaminos. Duración humana = duración base × 0,85; comida y pociones siguen siendo instantáneas. La reducción de tiempo élfica en Alquimia queda sustituida por una habilidad racial: 25 % de probabilidad de fabricar una poción adicional. La última corrección del usuario sustituye expresamente las dos unidades por una. Esta bonificación de cantidad sigue siendo útil al alcanzar la maestría y no cambia las estadísticas fijas de las pociones. El usuario prevé ampliar las habilidades raciales a las demás razas en el futuro; no hay otras habilidades nuevas aprobadas.
- Acordado para lotes: una tirada independiente por ejecución de receta, tanto individualmente como en lote; la poción adicional es del mismo modelo, no cuesta materiales adicionales ni activa nuevas tiradas. Dividir un lote en clics no cambia el beneficio esperado. Pendiente: experiencia y alcance sobre productos que no sean pociones. Propuesta pendiente: las unidades extra no conceden experiencia adicional.
- Propuesta pendiente: mantener las mismas recetas, estadísticas por modelo y potencia máxima accesibles a todas las razas. Las afinidades darían eficiencia, sin convertir una raza en requisito para fabricar el mejor objeto.
- La progresión mediante recetas y proyectos de maestría está aprobada. Las posibles especializaciones y los proyectos concretos quedan pendientes. Estas decisiones de diseño no significan que el sistema esté implementado.

### Lista inicial de oficios

Rangos de fabricación aprobados: Aprendiz (gris), Iniciado (verde), Oficial (azul), Experto (morado), Maestro (dorado) y Gran maestro (naranja especial). El rango habilita aprender las recetas correspondientes: no las concede automáticamente ni sustituye sus requisitos de materiales. Acceder a Experto, Maestro y Gran maestro exige proyectos de maestría de dificultad creciente. No hay todavía niveles numéricos, umbrales de experiencia ni proyectos concretos aprobados.

Recolección aprobada para Minero, Leñador y Recolector: mismos seis rangos, experiencia por recursos de dificultad adecuada y pruebas de campo para acceder a Experto, Maestro y Gran maestro. Los recursos básicos conservan demanda como ingredientes de recetas avanzadas. El usuario corrige el desbloqueo de recursos por rango: todos son accesibles desde el principio sin un requisito directo de rango, pero el coste de energía depende del dominio y la dificultad. Un principiante puede extraer recursos de Experto a un coste tan alto que no resulte rentable; uno de nivel máximo supera su capacidad energética y no puede extraerlo. Progresar mejora la eficiencia energética y hace viables recursos superiores.

Acordado: una reserva de energía de recolección compartida entre los tres oficios, separada de los recursos de combate. Se regenera con el tiempo, también sin conexión, hasta su capacidad máxima. En el futuro podrá recargarse con Lágrimas de fénix. La compra repone energía hasta el máximo, sin aumentar la capacidad máxima ni el dominio del oficio; no permite saltarse la dificultad de recursos cuyo coste supere esa capacidad. Fórmula, capacidad, velocidad de recuperación, precios, cantidades y límites de compra pendientes. Actualmente existe el monedero `lagrimas` (`src/data/currency.ts`, `docs/CURRENCY.md`); esta aprobación no implementa la compra ni la energía.

El usuario mantiene la propuesta de fabricación, pide sustituir el nombre Marroquinería y añadir un oficio independiente de muebles. Se adopta Peletería para cuero y Ebanistería para muebles; Carpintería conserva las armas y escudos de madera. Los límites de recetas entre oficios se concretarán después.

| Oficio | Ámbito inicial |
| --- | --- |
| Herrería | Armas metálicas, armaduras pesadas y herramientas de recolección: picos, hachas de tala y hoces. |
| Peletería | Armaduras de cuero. Sustituye el nombre Marroquinería. |
| Sastrería | Ropas, túnicas y sombreros de tela. |
| Carpintería | Arcos, bastones y escudos de madera. |
| Ebanistería | Muebles; oficio independiente de Carpintería. |
| Joyería | Anillos, collares y abalorios. |
| Alquimia | Pociones y elixires. |
| Encantamiento | Pergaminos para encantar armas. |
| Cocina | Comidas con beneficios temporales. |
| Minero | Extracción de minerales; recursos concretos pendientes. |
| Leñador | Obtención de madera; recursos concretos pendientes. |
| Recolector | Plantas, hongos, fibras, frutas, bayas y otros ingredientes silvestres similares. Abastece principalmente a Alquimia, Cocina y Sastrería. |

La recolección tiene progresión propia. Por ahora solo se incluyen Minero, Leñador y Recolector: Pesca y Desuello no forman parte de la lista inicial. La integración de muebles con vivienda, colocación y almacenamiento queda por diseñar; añadir Ebanistería al diseño no implementa esos sistemas.

### Estaciones y fabricación diferida

Gestión de colas aprobada con corrección del usuario: hasta cinco trabajos por oficio, concretados como uno activo y cuatro pendientes en total. Se pueden reordenar pendientes gratuitamente. Los resultados terminados no cuentan contra ese límite ni bloquean el siguiente trabajo. Materiales reservados al encolar; sin mejoras de taller ni ampliaciones premium de cola. La capacidad queda así fijada y sustituye las menciones anteriores a límite pendiente. Definir todavía cómo representar cantidades de una receta sin que una fila de lote permita eludir el límite de trabajos.

Garantías aprobadas: fabricación garantizada si se cumplen receta, materiales y oficio, sin fallo aleatorio ni variación de estadísticas por copia. Conceder experiencia una sola vez al terminar, no al recoger; resultados quedan guardados si la mochila está llena. Los reembolsos al cancelar tampoco se pierden por falta de espacio y quedan pendientes de recoger. Las pociones extra de la racial élfica no conceden experiencia adicional. Concreta la regla antes pendiente de experiencia racial. Requiere implementación transaccional; no está programado todavía.

Autonomía inicial de herramientas confirmada: una herramienta gris usada por Aprendiz con recursos de su rango aguanta aproximadamente cuatro reservas de energía hasta la primera reparación. Las reparaciones posteriores reducen su máximo y, por tanto, su autonomía. Es un objetivo para calibrar desgaste base, no una regla de descontar durabilidad por gastar energía ni por transcurso de tiempo. El desgaste sigue aplicándose por extracción completada.

Reparaciones parciales aprobadas: tanto precio como deterioro del máximo son proporcionales al desgaste reparado, sin aplicar la penalización completa por arreglar un daño pequeño. Con máximo original O, máximo vigente M y durabilidad actual D, usar fracción f = (M − D) / M antes de reparar. Pérdida = O × 0,05 × (1 − reducción por dominio) × (1 − reducción por calidad) × f. Reparar desde 0 da f = 1; reparar con el 90 % de durabilidad vigente da f = 0,1. Al completar, máximo nuevo = M − pérdida y durabilidad actual = máximo nuevo. Validar el umbral del 20 % original antes de cobrar o modificar; a durabilidad llena no hay operación ni cobro. El coste se escala por la misma fracción respecto al precio completo que aún falta definir; redondeo monetario pendiente. Mantener precisión de durabilidad para no anular pequeñas pérdidas al reparar repetidamente. Este acuerdo ajusta las fórmulas anteriores de reparación completa, sin modificar la restauración especial a máximo original.

Límite de reparación normal aprobado: el máximo resultante debe ser al menos el 20 % del máximo original. Una reparación que lo dejase por debajo se rechaza, sin cobrar ni deteriorar la herramienta; se requiere restauración completa o sustitución. No recortar artificialmente la pérdida para permitir una reparación adicional. Exactamente el 20 % es admisible; no confundir este umbral del máximo con la durabilidad actual, que se sigue gastando hasta 0. La herramienta se conserva aunque ya no admita reparación normal. Este acuerdo concreta el umbral antes pendiente, sin fijar precios ni implementar operaciones.

Pérdida por reparación normal aprobada: máximo original × 0,05 × (1 − reducción por dominio) × (1 − reducción por calidad). El usuario aprueba reutilizar los porcentajes de desgaste por extracción: dominio 0/3/6/9/12/15 % y calidad 0/4/8/12/16/20 %. Usar el máximo original como referencia evita una pérdida geométrica sobre el máximo ya deteriorado. Aprendiz con gris pierde un 5 % del original por reparación; Gran maestro con naranja pierde un 3,4 %. Mantener precisión interna para que el redondeo no anule reducciones pequeñas. Umbral final de reparabilidad y precios de reparación/restauración pendientes. No hay implementación nueva de estas reglas.

Revisión aprobada de vida útil: cada reparación normal reduce la durabilidad máxima; mayor dominio del oficio y calidad de herramienta reducen esa pérdida, prolongando su vida útil. Al agotarse su capacidad de reparación no puede repararse normalmente; no se borra. Esto revisa el acuerdo previo de reparación sin deterioro: la rareza/calidad del modelo no cambia, pero su máximo de durabilidad sí. Fórmula, pérdida por reparación y umbral final pendientes. La propuesta de cuatro reservas entre reparaciones para gris/Aprendiz con recursos del mismo rango sigue pendiente de confirmación expresa.

Restauración completa aprobada: mediante Lágrimas de fénix o un objeto muy raro se puede recuperar toda la durabilidad original, tanto el máximo como el valor actual. El usuario confirma que los créditos premium para esta operación son Lágrimas de fénix. Concretar precio, identidad y fuentes del objeto raro y condiciones de uso. Al implementar, persistir por instancia el máximo original, máximo deteriorado y durabilidad actual; reparación normal y restauración completa deben ser operaciones distintas, con coste y actualización atómicos e idempotentes. Conservar la herramienta agotada para permitir su restauración; no eliminarla automáticamente. No hay implementación de estas operaciones todavía.

Reducción de desgaste por dominio aprobada: 0/3/6/9/12/15 % desde Aprendiz hasta Gran maestro. Combinación multiplicativa aprobada: desgaste base por dificultad × (1 − reducción por dominio) × (1 − reducción por calidad). Con Gran maestro y naranja resulta 0,85 × 0,80 = 0,68 del desgaste base, un 32 % menos. El desgaste base por dificultad sigue pendiente; estas decisiones todavía requieren implementación. Conservar precisión interna para que redondear cada extracción no anule las reducciones pequeñas.

Uso y calidad de herramientas aprobados: cualquier personaje puede usar una herramienta de cualquier calidad sin exigir rango del oficio. El usuario pide que la ventaja sea pequeña: la calidad reduce el desgaste, sin reducir el coste de energía ni reemplazar el dominio del oficio. La corrección «un 1 % más» sobre la propuesta de 3 % por salto se concreta en 4 puntos porcentuales por salto: gris 0 %, verde 4 %, azul 8 %, morado 12 %, dorado 16 % y naranja 20 % de reducción frente a gris. Son valores totales por calidad, no descuentos sucesivos acumulados. Fórmula conjunta con dominio y dificultad pendiente. Se mantiene que los recursos cuyo coste supere la reserva máxima no se pueden extraer aunque se compre una herramienta avanzada.

Obtención de herramientas aprobada: Herrería fabrica picos, hachas de tala y hoces de distintas calidades. Las herramientas básicas también se pueden comprar a comerciantes; las avanzadas son exclusivas de artesanía. Se crea así una dependencia entre herreros y recolectores para el suministro de herramientas y materiales. Modelos, recetas, precios y frontera concreta entre herramientas básicas y avanzadas quedan pendientes; no asumir todavía que una calidad específica exige un rango para equiparse.

Desgaste de herramientas aprobado: únicamente al completar una extracción; cancelar o sufrir una interrupción no resta durabilidad. Recursos más difíciles desgastan más, mientras que el dominio del oficio correspondiente y la calidad de herramienta reducen el desgaste. Esto concreta la reducción de frecuencia de reparación mediante menor desgaste; no aprueba además aumentos de durabilidad máxima por calidad. Fórmula y valores pendientes. Al implementar, resolver desgaste junto con energía, disponibilidad individual del nodo, entrega y experiencia en la misma transacción; reintentar no debe aplicar desgaste duplicado.

Herramientas de recolección aprobadas: pico (Minero), hacha de tala (Leñador) y hoz (Recolector), usadas automáticamente desde equipamiento de herramientas sin sustituir el arma de combate. El usuario corrige la propuesta sin durabilidad: las herramientas se desgastan y deben repararse; mayor habilidad del oficio y calidad de herramienta implican reparaciones menos frecuentes. A 0 de durabilidad quedan inutilizables hasta repararlas, sin destruirse ni perder calidad. Se reparan en un taller pagando Pelines. No está decidido si la menor frecuencia de reparación se expresa mediante menor desgaste, mayor durabilidad o ambos. Fórmula, ranuras concretas, precios y talleres habilitados quedan pendientes. No extender automáticamente esta durabilidad a armas, armaduras o estaciones. La implementación requerirá estado persistente por herramienta individual, no solo por modelo de catálogo.

Disponibilidad de recursos aprobada: individual por personaje. Cada personaje puede recolectar el mismo nodo una vez antes de su recuperación individual; que otro jugador lo recolecte no lo agota ni interrumpe la acción para los demás. La disponibilidad se regula mediante ubicación, tiempo de recuperación y coste energético. Tiempos concretos y persistencia de nodos quedan por implementar. Requisito técnico: identificar de forma estable nodo y personaje y persistir el siguiente instante disponible en servidor; reconectar, cambiar de mapa o de sesión no debe reiniciar la recuperación. La entrega y el registro de extracción deben resolverse junto con gasto y experiencia, sin duplicación ante reintentos. La regla aprobada es por personaje, no un bloqueo compartido por cuenta.

Experiencia de recolección aprobada: solo al completar la extracción. Recursos del rango del oficio conceden experiencia normal; superiores dan algo más, con un límite para evitar saltos desproporcionados de progresión; inferiores dan experiencia reducida hasta dejar de concederla cuando sean demasiado fáciles. Cantidades, límite del bono y umbral de dificultad trivial quedan pendientes. Esta regla concreta el otorgamiento antes pendiente sin fijar aún niveles numéricos ni umbrales de ascenso.

Extracción y energía aprobadas: mostrar el coste antes de iniciar y exigir energía suficiente para completarla. La energía se descuenta únicamente al completar y obtener el recurso; cancelar, alejarse o sufrir una interrupción antes de completar no consume energía ni concede materiales o experiencia. Requisito técnico futuro: validar energía y acción en servidor, impedir extracciones simultáneas del mismo personaje y resolver gasto, entrega y experiencia de forma atómica e idempotente. Si no puede entregarse el recurso, no descontar energía sin conservar su entrega. Las condiciones concretas de interrupción y la duración de extracción siguen pendientes; no asumir que cualquier daño la interrumpe.

Regla de eficiencia de recolección aprobada: calcular la diferencia entre rango del recurso y rango del oficio correspondiente. Mismo rango o inferior cuesta 1 punto; diferencias de +1, +2, +3, +4 y +5 cuestan respectivamente 2,5, 8, 25, 70 y 120 puntos por extracción. Usar el dominio de Minero, Leñador o Recolector según la acción, sin sumar rangos de otros oficios ni usar el nivel de combate. La reserva compartida es de 100 puntos. Ejemplo: un recurso de Experto cuesta 25 para Aprendiz, 8 para Iniciado, 2,5 para Oficial y 1 desde Experto. La fórmula queda acordada como diseño; tiempos de extracción, rendimiento y otorgamiento de experiencia siguen pendientes.

Objetivo aprobado para la energía de recolección: una reserva llena permite aproximadamente 45–60 minutos de actividad habitual con recursos adecuados al dominio. Los recursos difíciles la agotan mucho más rápido. No es un límite de tiempo de sesión ni implica gastar energía simplemente por estar conectado; capacidad y costes por extracción siguen pendientes. Al concretar cifras, considerar también la regeneración durante la actividad para conservar esa autonomía neta.

El usuario fija la escala inicial en 100 puntos de reserva máxima y pide escalar la tabla propuesta entre diez. Costes por extracción para un Aprendiz: Aprendiz 1; Iniciado 2,5; Oficial 8; Experto 25; Maestro 70; Gran maestro 120. El último supera la reserva y no puede extraerse; los demás conservan las proporciones de la propuesta original. La recuperación completa sigue durando 276 minutos: 100/276 puntos por minuto, sin redondear cada intervalo a enteros. Esta escala concreta la capacidad pendiente en las descripciones anteriores; fórmula de reducción por dominio, duración de extracción y rendimiento quedan por definir y no están implementados. Ajustar conjuntamente esos parámetros y la regeneración activa para conservar el objetivo de autonomía, sin deducir que cuatro extracciones de Experto agoten exactamente la reserva si transcurre tiempo entre ellas.

Ritmo de recuperación acordado: recuperación continua hasta el máximo, también sin conexión, con 4 horas y 36 minutos para pasar de vacío a lleno. La corrección «15 % más lenta» se concreta aumentando la duración de la propuesta de 4 horas en un 15 % (276 minutos); equivale a aproximadamente un 21,74 % de la reserva por hora. Reemplaza la velocidad pendiente de la descripción general anterior, sin fijar aún la capacidad numérica. La implementación futura deberá calcular el tiempo transcurrido en servidor y limitar la recuperación al máximo, sin depender del reloj del cliente.

Tiempos base aprobados por pieza de equipo: gris 30 segundos, verde 2 minutos, azul 30 minutos, morado 2 horas, dorado 24 horas y naranja especial 48 horas. La última corrección del usuario sustituye dorado 8 horas y naranja 24 horas por 24 y 48 horas respectivamente. La reducción racial humana del 15 % se aplica sobre el tiempo base: dorado 20 horas y 24 minutos; naranja 40 horas y 48 minutos. Son decisiones de diseño, todavía no duraciones implementadas.

El usuario pide tiempos más extensos para muebles y para Encantamiento, con escalas propias todavía por concretar. En Encantamiento se trata de fabricar los pergaminos; no se añade una espera a aplicarlos al arma. Para muebles está aprobado combinar calidad, tamaño y complejidad: una silla sencilla tarda menos que una gran biblioteca de la misma calidad. La fórmula y las duraciones concretas siguen pendientes; no usar automáticamente la tabla de equipo como tabla de muebles. Comida y pociones siguen siendo instantáneas.

Acordado: estaciones del mundo y estaciones colocables en casas. Los talleres no tendrán mejoras; se descarta ampliar colas mediante mejoras del taller. Comida y pociones se fabrican instantáneamente en su estación, sin espera ni cola temporal. No extender esta excepción automáticamente a otros productos de Alquimia u otros consumibles: su duración queda pendiente.

Para las recetas con tiempo, se inicia la fabricación en la estación, con posibilidad de encolar unidades, y el personaje puede alejarse mientras el trabajo continúa. El usuario corrige expresamente la propuesta de permanecer en la estación: los tiempos aumentarán con la calidad del objeto. Los proyectos de maestría incluyen varios componentes y pasos. No hay duraciones ni límites de capacidad de cola aprobados.

Acordado: una cola por oficio y personaje, independiente de la estación utilizada. Cada oficio tiene un trabajo activo y los pendientes empiezan automáticamente al terminar el anterior, también sin conexión y sin exigir recoger el resultado anterior. Distintos oficios pueden trabajar simultáneamente; usar varias estaciones no multiplica los trabajos activos. Comida y pociones siguen siendo instantáneas y no ocupan estas colas. Al implementar, serializar las altas de trabajos por personaje y oficio para impedir trabajos activos duplicados y calcular el avance encadenado desde las marcas de tiempo persistidas, sin depender de que el cliente esté conectado.

Acordado: los trabajos también avanzan con el jugador desconectado y el resultado queda guardado para recogerlo cuando vuelva, sin caducar. Se puede consultar la cola personal y recoger los resultados terminados en cualquier estación del mismo oficio, pública o de casa, sin volver a la estación de origen. Esto no concede acceso automático a casas privadas ni a colas ajenas. Concretar capacidad de cola, acceso compartido y retirada de estaciones con trabajos activos antes de implementar. El avance sin conexión y la conservación del resultado son decisiones de diseño; todavía requieren implementación.

Acordado sobre materiales y cancelación: reservar todos los materiales al encolar, dejándolos indisponibles para otras operaciones. Cancelar un trabajo pendiente devuelve todos sus materiales; cancelar uno iniciado también los devuelve, pero pierde todo el progreso. Recoger el resultado anterior no bloquea el siguiente trabajo. Al implementar, resolver cancelación y finalización bajo el mismo bloqueo transaccional: un trabajo completado no puede devolver además sus materiales como si estuviese cancelado. Conservar los reembolsos aunque la mochila esté llena, sin duplicarlos ante reintentos; concretar el canal de entrega. La cancelación no fabrica objetos ni concede experiencia.

Requisito técnico para implementar la fabricación diferida aprobada: persistir propietario, receta, cantidades, estación y estado del trabajo en servidor; registrar las marcas de tiempo necesarias y la reducción racial aplicada. La duración debe fijarse al iniciar el trabajo para evitar recalcularla según la presencia del cliente. La creación del trabajo y la reserva de materiales deben ser atómicas; completar consume la reserva definitivamente. Finalizar o recoger debe conceder resultado y experiencia una sola vez, incluso ante reintentos. El cliente muestra el progreso, sin decidir cuándo termina ni conceder objetos. Esto describe requisitos futuros, no una implementación existente.

Para comida y pociones, validar receta, oficio, estación, materiales y espacio de entrega y resolver consumo, resultado y experiencia en una operación atómica e idempotente, sin crear una espera artificial. Al implementar la habilidad élfica, la tirada y su resultado deben resolverse y persistirse en servidor junto con la fabricación: reintentar una petición no debe permitir volver a tirar ni duplicar el premio. Debe conservarse la entrega completa, incluida la poción adicional si aparece, sin perderla por falta de espacio. La habilidad está aprobada como diseño, todavía no implementada.

Orden propuesto: concretar afinidades, progresión y comercio → definir familias de recetas y recursos → identidad de objetos y fabricación transaccional → recolección y desbloqueos → encargos y especializaciones. La comisión, el consumo de materiales y la entrega deben resolverse como una operación atómica en servidor.

Pendiente de decidir: recursos concretos de cada oficio, experiencia de las pociones adicionales de la racial élfica, futuras habilidades raciales, especializaciones compatibles con poder dominar todos los oficios, requisitos y distribución concreta de recetas, reglas de encantamiento antes de equipar y reparto de fuentes de equipo. El comercio de todos los materiales de profesiones, el ligado al equipar del equipo fabricado y las reglas generales de aprendizaje y comercio de recetas encontradas ya están aprobados.

Una clase, dos armas de estadísticas fijas, dos pergaminos elegibles, un conjunto de cuatro piezas y un enemigo repetible. Recorrido completo: obtener material o pergamino → aplicar → equipar → combatir → recibir botín → consultar tooltip → guardar/comerciar → reconectar conservando el estado.

Esta vertical depende de las decisiones de atributos y conjunto. Después extender a las cinco clases y a sus fuentes de obtención. Para validar equilibrio cuando se solicite: comparar escenarios completos y fórmulas cliente/servidor, además de revisar duplicación de transacciones y persistencia.

## Referencias externas

### Estudio ampliado y decisiones de Brumaluz

Fuentes oficiales consultadas de nuevo el 23 de octubre de 2026. Las aplicaciones propuestas para Brumaluz son decisiones de diseño propias, no garantías derivadas de otros juegos.

| Referencia | Qué aporta | Aplicación propuesta |
| --- | --- | --- |
| [Guild Wars 2: combate](https://www.guildwars2.com/en/the-game/combat/) | Diversidad de armas y estilos, posicionamiento, juego individual y colaboración en mundo abierto | Hacer útiles cadencia y alcance mediante encuentros y movimiento. Mantener nuestras habilidades de clase, como ya se acordó |
| [FFXIV: guía oficial de roles](https://na.finalfantasyxiv.com/jobguide/battle/) | Funciones claras: tanque atrae ataques, sanador recupera y apoya, daño se especializa en ofensiva | Adoptado el enfoque híbrido: autonomía en aventura y complementariedad de roles en mazmorras difíciles |
| [ESO: conjuntos](https://help.elderscrollsonline.com/app/answers/detail/a_id/60388/~/gear-set-bonuses---the-elder-scrolls-online) | Umbrales explícitos y posibilidad de recibir beneficios de varios conjuntos | Mantener los umbrales propios aprobados, 2/4 y 4/4; comparar conjunto completo frente a combinar dos pares |

### Siguiente circuito que hay que desarrollar

1. **Enemigos y encuentros:** acciones anunciadas, oportunidad de reaccionar, enemigos cuerpo a cuerpo y a distancia, defensa y control con reglas claras. La diferencia de armas necesita situaciones donde sus ventajas importen.
2. **Cooperación real:** enemigos compartidos con identidad persistente, participantes, amenaza, curación a aliados y derechos de recompensa. Los grupos sociales actuales no resuelven todavía ese circuito.
3. **Equipo diferenciado:** perfiles por modelo y valores comunes para servidor, animación, aproximación y tooltip. Normalizar la potencia de habilidades para que una gran cifra por golpe no domine también todas las habilidades.
4. **Obtención y economía:** artesanía y mazmorras de potencia comparable, con objetos excelentes exclusivos de fabricación; definir recetas, fuentes de materiales y gastos antes de repartir todo el equipo desde un vendedor.
5. **Personalización persistente:** instancias de objetos, pergaminos, aplicación transaccional y motor de efectos. Los encantamientos universales siguen ligados a golpes de arma, sin activación mediante habilidades.
6. **Conjuntos:** dar a 2/4 una mejora pequeña y a 4/4 una identidad, con cifras todavía por decidir. Revisar supervivencia y apoyo además del daño.

El usuario ha aprobado diferencias jugables entre armas, enfoque híbrido de roles y profesiones centrales con equipo exclusivo. La asignación exacta de roles/especializaciones por clase, composición de grupo y reglas detalladas de obtención siguen pendientes. Ninguna decisión obliga a implementar PvP, pérdida de equipo o una economía equivalente a la de otro MMORPG.

- [ESO: bonificaciones de conjunto](https://help.bethesda.net/app/answers/detail/a_id/60388/~/gear-set-bonuses---the-elder-scrolls-online): ejemplo de conteo explícito y combinación de piezas. El número de ranuras de Brumaluz debe decidirse según nuestras clases.
- [ESO: tipos de encantamiento](https://help.elderscrollsonline.com/app/answers/detail/a_id/6119/~/what-are-enchantments-and-what-kind-enchantments-are-there%3F): ejemplo de compatibilidad de encantamientos por tipo de equipo y efecto visible en tooltip.
- [ESO: vista previa de encantamiento](https://help.elderscrollsonline.com/app/answers/detail/a_id/9384/~/why-did-my-enchantment-change-when-i-put-it-on-my-armor%3F): ejemplo de mostrar el resultado antes de aplicar.

Son referencias de presentación y reglas explícitas, no una recomendación de copiar su economía, cantidades o fórmulas. El diseño específico de Brumaluz figura en [WEAPON-SYSTEM-DESIGN.md](WEAPON-SYSTEM-DESIGN.md).

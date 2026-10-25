# Implementación de equipo, combate y oficios

Actualizado: 24 de octubre de 2026. Este documento describe el código implementado; los documentos de diseño conservan también propuestas e historial. Las fórmulas numéricas nuevas son valores iniciales de equilibrio, no resultados de una sesión de juego.

## Acceso en el juego

- **P**, menú **Mundo → Profesiones** o pulsar la reserva de energía del HUD: doce oficios, recetas, trabajos, entregas, herramientas, encantamientos y muebles.
- El libro de oficios incluye navegación por profesión y rango, búsqueda y filtros de recetas, detalle del resultado, materiales disponibles y cantidades, proyectos de maestría y cinco puestos de fabricación. La energía de recolección permanece integrada en la insignia del personaje como una barra fina; «Energía», el valor sobre 100 y la recuperación aparecen en su tooltip; el libro muestra además el tiempo restante para recuperar la reserva.
- Ilustraciones SVG propias para las familias de recursos, herramientas y muebles. La ficha de receta conserva visibles los controles de fabricación en escritorio; la navegación se adapta a pantallas pequeñas y conserva filtros, selección, desplazamiento y secciones desplegadas al actualizar trabajos.
- Navegación contextual: fabricación temporal tiene Recetas / Trabajos / Maestría; Cocina y Alquimia, Recetas / Maestría; recolección, Recursos / Mi herramienta / Maestría. Cambiar de oficio vuelve a su página principal y limpia los filtros del oficio anterior.
- Utilidades independientes y accesibles desde cualquier oficio: Mis herramientas, Encantar un arma, Mi casa y Entregas. Aplicar un encantamiento es universal; fabricar pergaminos sigue perteneciendo al oficio Encantamiento. Las entregas ya no dependen de abrir una cola de fabricación.
- Maestría muestra los seis rangos, los ascensos automáticos a Iniciado y Oficial y los proyectos posteriores. Los proyectos futuros se presentan desplegables hasta llegar a Oficial. Los avisos de trabajos listos cuentan únicamente los del oficio seleccionado.
- Iconos de oficios y utilidades ilustrados en color. En móvil, un selector agrupado sustituye la tira horizontal de doce oficios; las cuatro utilidades permanecen accesibles.
- **E** cerca de un banco de trabajo instalado en casa: abrir su oficio.
- Retirados los talleres públicos provisionales: mesas, rótulos flotantes, colisiones, interacciones, indicaciones de proximidad e iconos de mapa y minimapa. Quedan pendientes de integrarlos en sus ubicaciones definitivas.
- Comprar las herramientas básicas en el apartado Herramientas, cerca de Herrería; equiparlas y acercarse a un recurso para recolectar con **E**. Moverse, cancelar, morir o recibir daño interrumpe la extracción.
- La **ficha de personaje** muestra daño básico, intervalo, habilidad, coste real, mitigación y progreso de conjuntos.
- **Expediciones retiradas provisionalmente**: sin tablón, colisión, iconos de mapa/minimapa, interacción ni acceso para iniciarlas. Los encuentros antiguos recibidos del servidor se abandonan y se retiran de la escena. Su implementación definitiva queda pendiente.
- En combate: los enemigos exteriores detectan al jugador y este responde con básicos; **F** permite iniciar y aproximarse manualmente. Se conserva la barra de habilidades y el marco de objetivo; este muestra la preparación enemiga. Solo el clérigo en grupo tiene selector de aliado para curar.

## Equipo e identidad

Se conservan los modelos y objetos existentes. Las cuatro piezas de armadura son cabeza, pecho, manos y piernas; piernas incluye calzado. Armas y joyas no cuentan para conjuntos.

Las copias de equipo incorporan `instanceId`. Inventario, equipo, banco y comercio conservan encantamiento, vínculo y durabilidad. La migración separa equipo antiguo apilado; si falta espacio, las copias adicionales quedan en entregas. El equipo se liga al equiparse, no al fabricarlo ni al encantar un arma de la mochila.

La normalización del personaje conserva explícitamente `rpg`, `enchantState` y `partyPeers`; la limpieza de claves desconocidas ya no elimina el progreso de profesiones, la energía ni el estado de los encantamientos recibido del servidor.

Los conjuntos tienen dos familias mecánicas por clase. Las colecciones visuales se asignan explícitamente en `src/data/sets.ts`. Se pueden mezclar calidades y colecciones de la misma familia. El bono de dos piezas usa la segunda mejor calidad; el de cuatro, la peor. El gris no da bonos; verde habilita dos piezas y azul habilita cuatro. Las bonificaciones son numéricas: no cambian la habilidad ni añaden activaciones nuevas.

| Clase | Primera familia | Segunda familia |
| --- | --- | --- |
| Guerrero | Bastión: guardia / vida | Vanguardia: potencia / habilidad |
| Pícaro | Ofensiva: potencia / habilidad | Duelista: guardia / menor coste |
| Mago | Evocador: potencia / habilidad | Arcanista: recurso / menor coste |
| Explorador | Quebrantador: potencia / habilidad | Vigía: recurso / menor coste |
| Clérigo | Custodio: curación / habilidad | Restaurador: recurso / menor coste |

Vigía es el nombre provisional de la segunda orientación del explorador. Cada celda expresa **2 piezas / 4 piezas**. Las escalas aprobadas se aplican en cliente y servidor.

## Fórmulas de combate

- Atributo principal: Fuerza para guerrero, Agilidad para pícaro/explorador e Intelecto para mago/clérigo. Multiplicador: `1 + atributo × 0,01`, también para curación.
- Nivel: `1 + (nivel − 1) × 0,02`, compartido por básicos, habilidades y curación.
- Corpulencia: `+2 %` de vida máxima por punto sobre vida base y equipo.
- Guardia: `min(60 %, Guardia / (Guardia + 20))`. Primero guardia, después barreras y finalmente vida.
- Armas rápidas: `0,85 ×` daño básico e intervalo; lentas: `1,15 ×`; normales: `1 ×`. Las habilidades no reciben ese multiplicador de cadencia. La asignación inicial por modelo está en `weaponTempo`.
- Los cambios de equipo conservan valores actuales, limitándolos si baja el máximo. No curan ni reinician recargas.
- Daño y barreras conservan decimales. La vida y el recurso persistidos usan enteros con restos acumulados para no perder las mejoras pequeñas por redondeo. Monedas y precios se cobran como enteros.
- Pociones: recarga compartida inicial de **15 segundos**; comida y pociones se fabrican instantáneamente.

Se añadieron variantes de animación a partir de los clips KayKit: preparación, impacto y recuperación, corte doble, golpe pesado y canalización. La ballesta combina los clips compatibles de apuntar, disparar y recargar; el disparo preciso tiene una preparación más larga.

## Encantamientos

Un encantamiento universal por arma principal desde verde. Un pergamino consumible elige y sustituye el efecto, sin fallo. El grado no puede superar la calidad del arma. Solo los ataques básicos activan efectos.

| Efecto | Verde → naranja |
| --- | --- |
| Fuego | Daño adicional del 5/6/7/8/9 % del básico antes de defensa; sin quemadura |
| Vampirismo | Cura 2/3/4/5/6 % de la vida realmente retirada por el básico; sin sobrecuración |
| Escarcha | Cada tres básicos: barrera del 20/25/30/35/40 % durante 4 s; no se acumula |
| Rayo | Cada cuatro básicos: un salto al enemigo válido más cercano a 4 m, del 40/50/60/70/80 %; sin atravesar obstáculos ni encadenarse |
| Maldición umbría | Cada tres básicos al mismo enemigo: daño oscuro del 20/25/30/35/40 % |

Rayo conserva una descarga preparada si no hay segundo objetivo. Escarcha y Rayo mantienen contador al cambiar de enemigo; Oscuro guarda marcas independientes durante seis segundos. Arma nueva, encantamiento nuevo, muerte o seis segundos sin básicos válidos eliminan cargas.

## Oficios y economía

Implementados Herrería, Peletería, Sastrería, Carpintería, Ebanistería, Joyería, Alquimia, Encantamiento, Cocina, Minero, Leñador y Recolector. El catálogo inicial contiene **436 recetas**, **216 recursos** y **541 definiciones adicionales**, que incluyen materiales, pergaminos de receta, herramientas, muebles y consumibles; no son 541 modelos nuevos.

- Todos pueden dominar todos los oficios. Rangos independientes y proyectos para Experto, Maestro y Gran maestro.
- Recetas básicas aprendidas en taller por Pelines; recetas superiores mediante pergaminos comerciables y proyectos. Una vez aprendidas, son permanentes.
- Materiales básicos continúan participando en recetas avanzadas. Recolección incluye hierbas, hongos, fibras, fruta, bayas, cereal y gemas. Los cueros se obtienen en combate.
- Ubicación de los 216 nodos: exclusivamente el mapa del mundo **Pompelín**, fuera de ciudades y asentamientos. Los talleres permanecen en Brumaluz. La distribución evita edificios, accesos, agua y pendientes pronunciadas; conserva los identificadores, cantidades, costes y recuperaciones individuales de los nodos.
- Colecciones avanzadas de artesanía quedan fuera de vendedores y tablas de botín de expedición. Las expediciones ofrecen colecciones distintas y recetas comerciables.
- Cinco trabajos temporales por oficio: uno activo y cuatro pendientes. Distintos oficios trabajan a la vez. Avanzan sin conexión y se recogen en cualquier estación del oficio.
- Materiales reservados al encolar; cancelación con devolución íntegra. Resultados terminados no ocupan capacidad de cola y no caducan. Experiencia al completar, una sola vez. Sin espacio, devoluciones y recompensas diferidas quedan en entregas; recoger un trabajo sin espacio lo mantiene pendiente.
- Humanos: 15 % menos tiempo. Elfos: 25 % de probabilidad de **una** poción adicional por ejecución, sin experiencia adicional ni activaciones recursivas.

### Tiempos

| Calidad | Equipo por pieza |
| --- | --- |
| Gris | 30 s |
| Verde | 2 min |
| Azul | 30 min |
| Morado | 2 h |
| Dorado | 24 h |
| Naranja especial | 48 h |

Pergaminos: tiempo de equipo × 2. Muebles: tiempo de equipo × `2 + 0,5 × (tamaño − 1) + 0,5 × (complejidad − 1)`. Son valores iniciales de implementación para concretar la directiva de tardar más; una biblioteca compleja tarda más que un taburete de igual calidad. Aplicación del pergamino inmediata. Talleres sin mejoras.

### Energía, herramientas y maestría

- Reserva común de recolección: 100. De vacía a llena en 276 minutos, también sin conexión.
- Diferencia de rangos recurso − oficio: ≤0 → 1; +1 → 2,5; +2 → 8; +3 → 25; +4 → 70; +5 → 120. No hay bloqueo directo por rango.
- Herramientas en tres ranuras propias: pico, hacha y hoz. Cualquier calidad se puede usar con cualquier dominio; no reduce energía.
- Durabilidad inicial: 100. Desgaste de referencia 0,25 por extracción adecuada, aumentado por dificultad y reducido multiplicativamente por calidad (0–20 %) y rango (0–15 %).
- Reparación en Pelines: resta hasta un 5 % de durabilidad original, con reducciones por dominio/calidad y proporción pendiente de reparar. No puede bajar del 20 % del máximo original. Cero de durabilidad inutiliza sin destruir.
- Restauración completa con un núcleo raro o Lágrimas de fénix. La interfaz pide confirmar el gasto premium. La recarga de energía no aumenta su máximo.
- Umbrales iniciales de experiencia: 0/100/500/1500/4000/10000. Maestría superior requiere además 50/100/150 prácticas y materiales. Recolección: experiencia adecuada 10; inferior 4; trivial 0; dificultad superior con bono acotado. Fabricación: esa base × `3^categoría`, para que las recetas de varias horas o días no exijan cientos de días de repetición. Las unidades adicionales de la racial no conceden experiencia.

Precios, umbrales, distribución de recursos, probabilidades de recetas y tiempos de canalización son ajuste inicial. El objetivo de autonomía de 45–60 minutos sigue necesitando medición en una sesión real.

## Cooperación, interfaz y persistencia

Las expediciones provisionales están retiradas. El circuito exterior incluye cinco enemigos compartidos en Pompelín, con múltiples agresores simultáneos, amenaza, persecución, retirada y ataques anunciados que comprueban a todos los jugadores dentro del área. El botín se reparte por participación y tiene selección independiente del objetivo de combate. El clérigo puede curar a un compañero del grupo a 6 m con línea de visión. Reglas actuales y límites en `docs/SHARED-WORLD-COMBAT.md`.

Interfaz conservada, con recarga de habilidad, números de daño/curación y preparación enemiga en el marco existente. Tooltips muestran instancia, efecto aplicado, durabilidad, cadencia y progreso de conjuntos. Mesas, tablón e iconos provisionales de talleres/expediciones permanecen retirados.

Las operaciones persistentes están en RPC autenticadas con bloqueos, propiedad del personaje y posición validada. Oficios utiliza revisión y recibos para reintentos. Las respuestas de personaje y vitales tienen revisión del servidor para descartar estados atrasados sin perder cambios de inventario.

Muebles y estaciones colocables en el interior habilitado de Isberto, con comprobación de espacio, recogida y colisión local. Es una primera integración en el interior existente; no constituye un sistema completo de viviendas comprables, permisos y visitas.

## Archivos y mantenimiento

- Catálogo: `tools/build-rpg-catalog.mjs` → `src/data/generated/rpg-catalog.json`.
- Geometría: `tools/build-rpg-geometry.mjs`, a partir de mapas publicados y huellas de colisión.
- Reglas: `src/data/{combat,sets,enchantments,professions}.ts`.
- Servidor: `supabase/server/18*`–`29*`. Los archivos 18, 18a, 21, 23, 26 y 29 se generan; cambiar sus fuentes, no sus salidas. Cadencia compartida en `src/data/combatCadence.json`; preparación visual en `src/data/combatTiming.json`; enemigos en `src/data/wilderness.json`. El archivo 28 sustituye los encuentros exteriores individuales del 27.
- `npm run build`: regenera catálogo, geometría, catálogo de equipo y adaptaciones SQL, luego compila TypeScript y Vite.
- `npm run db:apply`: aplica el SQL a la base configurada. Regenerar y aplicar juntos cuando cambien fórmulas o contenido.

## Trabajo de contenido y revisión pendiente

El explorador utiliza los clips KayKit de apuntar, disparar y recargar ballesta del rig compatible. El básico y Disparo preciso tienen tiempos de preparación distintos; sustituyen la pose provisional de lanzamiento de magia.

Faltan revisión de equilibrio con jugadores y varias sesiones reales, un recorrido de mazmorra con jefes y mecánicas de roles, navegación completa de enemigos, arte propio para talleres/recursos/muebles y expansión del alojamiento. La población exterior ya es compartida. Las expediciones continúan retiradas mientras se diseña su versión definitiva.

Pericia, Presencia y Percepción mantienen sus valores de personaje, pero sus efectos generales siguen reservados para el diseño de especializaciones, comercio y exploración. Sus descripciones ya no prometen bonificaciones inexistentes. Las raciales de fabricación y el dominio de cada oficio sí tienen efecto.

Gremios de jugadores, subastas, correo general, reputaciones y PvP siguen siendo expansiones pendientes de diseño. La cola de entregas recupera objetos personales; no sustituye a correo entre jugadores.

No se añadieron ni ejecutaron pruebas automatizadas en esta implementación. La compilación y la aplicación de migraciones no demuestran por sí solas el funcionamiento de todos los recorridos multijugador.

Entrega técnica del 24 de octubre: `npm run build` completado correctamente (TypeScript y Vite), catálogo regenerado y migraciones aplicadas a la base configurada. El cliente compilado queda en `dist/`; no se ha publicado un alojamiento web nuevo.

### Corrección del bloqueo al moverse cerca de un NPC

El detector de visibilidad recorría los nuevos rótulos Sprite de los talleres sin asignar cámara al Raycaster. Sprite.raycast lanzaba una excepción al consultar camera.matrixWorld y detenía el bucle de animación. Se asignó la cámara en objetivos y diálogos y se excluyeron rótulos y llamas decorativas de los impactos. El bucle muestra ahora un error con controles de recuperación si falla una actualización. El diagnóstico del navegador capturó la excepción original en targetFrame.ts.

Después de corregirlo se repitió el movimiento junto al vendedor: el bucle siguió avanzando 13,7 segundos, con renderizado activo y sin la excepción de Sprite. Compilación TypeScript/Vite completada. Es una reproducción local del fallo concreto, no una validación completa de todos los recorridos multijugador.

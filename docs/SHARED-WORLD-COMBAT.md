# Combate exterior compartido

24 de octubre de 2026. Sustituye la limitación de un enemigo individual descrita en la primera revisión del combate.

**Actualización del 26 de octubre:** [IA de enemigos](ENEMY-AI.md) documenta patrullas, navegación, grupos y personalidades. Hay nueve emplazamientos de cinco tipos; el combate normal conserva ataques a un solo oponente, sin fases de área.

**Actualización del 27 de octubre:** [Obtención de materiales](OBTAINABILITY.md) amplía la población a 14 emplazamientos y diez perfiles, con cinco jabalíes superiores solitarios. La reaparición compartida consulta el tiempo de cada emplazamiento: 90 s para los anteriores y 210–330 s para los nuevos. Los cadáveres existentes conservan el temporizador que ya tenían; el cálculo corregido se aplica a las nuevas muertes.

## Reglas implementadas

- Los catorce emplazamientos de Pompelín tienen una única instancia, posición, vida, objetivo, preparación de ataque, muerte y reaparición para todos los jugadores. No se generan copias privadas ni recuperaciones individuales.
- Cada criatura detecta por separado a los jugadores vivos cercanos con línea de visión. No hay límite artificial de enemigos que puedan participar contra un personaje. Seleccionar un enemigo no detiene a los demás.
- Los jugadores pueden atacar a la misma criatura, ayudar y cambiar su objetivo con clic. F mantiene el acceso al ataque automático y la aproximación. La selección no reinicia la cadencia del arma ni elimina la agresión.
- Cada criatura elige un objetivo por amenaza. El objetivo actual tiene un margen del 20 % para evitar cambios constantes. El daño añade amenaza; curar a un participante añade la mitad de la curación efectiva. Recibir golpes cuenta como participación defensiva.
- Los ataques normales comprueban al oponente elegido al terminar la preparación: alcance, posición y cobertura. No dañan a un transeúnte por estar cerca. Guardia se calcula al impactar; barrera, sobrecuración y vida absorben el resultado en orden.
- Un golpe pendiente se cancela sin consumir recurso ni activar la recarga si su criatura ya murió o cambió de generación. Nunca se aplica automáticamente al siguiente enemigo seleccionado.
- El encantamiento Rayo puede alcanzar a otra criatura compartida válida a 4 m y provocar su agresión. Las muertes secundarias también reparten sus recompensas una sola vez.

## Persecución y retirada

La detección inicial sigue los radios del catálogo de cada enemigo. Hay tres salidas normales:

1. Alejarse más de `max(radio de agresión + 5 m, alcance + 3 m)` sin contacto durante seis segundos.
2. Perder la línea de visión durante seis segundos.
3. Salir del límite de su territorio: 20–26 m desde su origen según el perfil. Un perseguidor bloqueado también abandona tras cuatro segundos sin avanzar.

Muerte, salida del mapa y pérdida de presencia válida retiran al jugador de la lista de amenazas. Si quedan otros participantes válidos, la criatura sigue combatiendo con ellos. Si no queda ninguno, cancela su ataque y regresa invulnerable. Recupera la vida al llegar a su origen. Persecución, patrulla y regreso usan celdas conectadas verificadas contra colisiones, agua y desniveles del mapa publicado; se calcula una ruta cuando el paso directo no es válido.

La navegación está limitada a los hábitats horneados: no hay nado, saltos ni navegación global entre regiones. La simulación avanza con las sincronizaciones de los jugadores; no es un proceso de IA independiente. Volver tras una pausa no ejecuta de golpe los ataques acumulados.

## Botín y cooperación

El cadáver es común; el botín es personal para quienes contribuyeron con daño, curación o recepción de golpes y siguen presentes en el mismo mapa a menos de 60 m al morir la criatura. No exige rematarla ni entrar en grupo. No se concede recompensa por estar cerca sin participar.

La muerte produce recibos individuales. Cada personaje recoge sus materiales y receta sin consumir los de los demás. El botín tiene una selección independiente de la selección de combate: se puede registrar un cadáver mientras siguen activos otros enemigos. Al reaparecer la criatura a los 90 segundos, los objetos personales pendientes pasan a Entregas al sincronizar el personaje, también si vuelve más tarde.

## Cliente e interfaz

La sincronización del mundo incluye las criaturas y los cadáveres personales. Cada criatura lleva revisión propia para que una respuesta atrasada no restaure vida, posición o una generación antigua. El personaje conserva sus revisiones separadas de inventario y vitales.

El marco de objetivo muestra la vida compartida real y la preparación. Las barras sobre las criaturas aparecen al combatir o estar heridas; desaparecen al morir o alejarse. No se ha añadido un panel de combate individual. Hay proyectiles visuales para magia y ballesta; son cosméticos, el servidor decide si hay impacto.

## Archivos

- `supabase/server/28-shared-wilderness.sql`: población, amenaza, persecución, retorno, áreas, recibos, cadáveres y RPC.
- `tools/build-wilderness.mjs`: deriva el impacto del resolvedor de combate existente y genera `26-wilderness-generated.sql` y `29-shared-world-generated.sql`.
- `29-shared-world-generated.sql`: integración en entrada, movimiento, viaje y curación de aliados autenticados. El movimiento consulta el combate aunque aún no hubiera un objetivo seleccionado.
- `src/game/wilderness.ts`: modelos compartidos, animaciones, zonas, barras y selección de cadáveres.

El orden de bloqueo es personaje propio → presencia propia → población. La simulación no bloquea personajes ajenos: guarda daño y recompensa en recibos que cada personaje consume. Tablas y funciones auxiliares son privadas, con RLS y sin acceso directo para clientes.

Compilar TypeScript/Vite y aplicar el SQL no acredita una sesión multijugador real. No se han añadido ni ejecutado pruebas automatizadas en esta pasada. Sigue pendiente revisar con varias sesiones conectadas el comportamiento con latencia, la distribución de amenaza y el equilibrio frente a grupos de criaturas.

## Pulido posterior de cámara y respuesta

- Seguimiento horizontal más ágil, anticipación amortiguada, menos cabeceo al saltar y encuadre de combate limitado a 0,7 m. Girar o acercar manualmente suspende ese encuadre; las cinemáticas conservan sus cámaras. Las sacudidas se reducen y respetan la preferencia de movimiento reducido.
- Arrastrar con botón derecho o central solo gira. El botón izquierdo distingue clic de arrastre; la rueda normaliza ratón y panel táctil. Pérdida de foco y ocultación limpian teclas y aproximación automática. Chat, campos de texto, composición de caracteres y atajos del navegador no disparan acciones.
- Mayús + F recorre enemigos cercanos; Mayús usado como modificador no alterna caminar/correr. P abre Profesiones, igual que su acceso del menú Mundo.
- La aproximación frena al llegar al alcance. Una habilidad pendiente no borra la velocidad de movimiento; la orientación de ataque dura su recuperación visual, sin quedar bloqueada durante una petición lenta.
- La barra muestra cola, aproximación, preparación, recuperación corta y falta de recurso con señales pequeñas. Sus iconos y referencias DOM se conservan; el reloj sigue animándose sin reconstruir el inventario a cada frame. Los tooltips mantienen su referencia al equipo actual tras recibir un snapshot.
- Las recargas usan marcas absolutas del servidor y se recuperan por sincronización si se pierde una respuesta. Peticiones de combate limitadas a ocho segundos evitan un estado ocupado indefinido. No se predice daño ni se reembolsan recursos desde el cliente.
- Movimiento y giro de criaturas interpolados entre muestras. Las barras y cifras se proyectan después de actualizar la cámara para evitar retraso visual al girar. Las victorias con botín nuevo tienen aviso, sin repetir el historial al entrar.
- Señales sonoras para preparación, lanzamiento, impacto, curación, daño recibido, ataques enemigos y muerte, con timbres por arma y familia, distancia y posición estéreo. Los cadáveres conservan los ojos cerrados hasta reaparecer. Véase [Sonidos de combate y expresión al morir](COMBAT-AUDIO.md).
- La autocuración y la curación de aliados consumen primero el daño y recompensas pendientes. La IA prioriza participantes visibles, conserva el margen de amenaza y evita escaneos repetidos de jugadores dentro del mismo paso.

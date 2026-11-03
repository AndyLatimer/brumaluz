# Rendimiento de acciones y conexión

Revisión del 28 de octubre de 2026. El objetivo es reducir la espera de acciones
simples y evitar que un fallo transitorio se presente como una desconexión.
Las reglas de misiones, recompensas, combate, equipo y concesiones de sesión
se conservan.

## Causas comprobadas

- Las estadísticas históricas de Supabase registraban sincronizaciones de
  mundo de hasta 7.874 ms; el cliente cancela esas peticiones a los 4.000 ms.
- Los cálculos de vida, recurso, comida y conjuntos consultaban reiteradamente
  el catálogo completo, de 880.996 bytes, con ilustraciones y descripciones.
- Los selectores SQL de equipo y objetos volvían a preparar cientos de ramas
  por llamada. El perfil de una sesión de prueba acumuló 2.992 consultas al
  selector de equipo y 394 al catálogo completo.
- Un solo error del latido activaba el aviso de conexión interrumpida. Al salir,
  abortar una petición y enviar inmediatamente la posición final podía solapar
  trabajo que el servidor todavía estaba procesando.

## Corrección

- `18a-rpg-runtime-rules.sql` separa las reglas pequeñas de conjuntos, comida y
  límites de apilado. Las ranuras vacías no consultan el catálogo de conjuntos.
- Vitales y regeneración reutilizan los máximos calculados. La comida y las
  revisiones de inventario no cargan el catálogo completo en cada latido.
- Los selectores de equipo y objetos usan expresiones PL/pgSQL preparadas y
  reutilizadas por conexión. Conservan exactamente sus metadatos.
- Se mantiene una petición de movimiento a la vez y el presupuesto de 250 ms.
  Un error se reintenta; el aviso aparece si pasan al menos cinco segundos sin
  confirmación. Los reintentos espacian su frecuencia hasta cuatro segundos.
  A los quince segundos se retiran una sola vez las presencias obsoletas.
- Salir deja hasta un segundo para completar el latido pendiente. Si se atasca,
  se cancela sin añadir otra petición de movimiento. Una posición final ya
  confirmada no se vuelve a enviar. Las respuestas de sesiones cerradas se ignoran.
- La validación de apariencia importa opciones sin cargar el renderizador 3D;
  se elimina además una dependencia circular que afectaba a herramientas SSR.

## Medición del servidor

Comparación en el PostgreSQL configurado, con personajes sintéticos y una
transacción finalmente deshecha. Cada escenario tiene una primera ejecución y
cinco muestras posteriores; la tabla muestra sus medianas. Son tiempos de
planificación y ejecución SQL, **sin HTTP ni renderizado**.

| Operación | Antes | Después |
| --- | ---: | ---: |
| Sincronizar personaje inicial | 325,2 ms | 4,4 ms |
| Sincronizar personaje equipado y con comida | 396,8 ms | 5,6 ms |
| Sincronizar personaje con mochila llena | 360,9 ms | 4,5 ms |
| Aceptar misión | 443,9 ms | 4,6 ms |

El parche específico se ha aplicado al servidor configurado sin reaplicar
migraciones de historia ni modificar el progreso de personajes. Antes de
confirmarlo se compararon las 939 definiciones de objetos y equipo. La copia
de las implementaciones anteriores está en
`art/performance-review/server-rollback.sql`.

Los cambios del navegador requieren publicar el nuevo cliente. La mejora del
servidor también beneficia al cliente que ya estaba publicado.

La verificación posterior del servidor ya instalado dio medianas de 4,3–5,4 ms
en sincronización y 4,5 ms al aceptar. En el navegador, la aceptación tardó
664 ms con 600 ms de latencia artificial, tras un primer intento fallido;
no hubo escrituras duplicadas ni errores de JavaScript. La prueba con dos
jugadores confirmó recuperación, retirada de presencias y salida sin
peticiones de movimiento solapadas.

## Reproducción y diagnóstico

- `npm run test:performance`: once regresiones de cadencia, fallos transitorios,
  recuperación, sesiones sustituidas, salida acotada y SQL aislado. Incluye
  100 combinaciones de clase/atributos/equipo/comida/grupo, checkpoints con
  mochila llena y aceptación única de misión sin consultar el catálogo completo.
- `npm run build`: genera catálogos, comprueba TypeScript y construye el cliente.
- `node --test scripts/test-network-performance.mjs`: cliente de producción en
  navegador con API simulada, latencia y error de misión, seguido de reintento.
- `npm run review:server-performance -- --configured --save`: compara la base
  configurada con las funciones locales y deshace todas las escrituras de prueba.
  Después de aplicar el parche, ambas mediciones usarán ya la versión corregida;
  el informe anterior queda en `art/performance-review/server.json`.
- `npm run db:performance`: aplica únicamente estas funciones, con transacción,
  comprobación de metadatos y copia de reversión. No ejecuta las migraciones de datos.
- `window.brumaluz.connection()` muestra latencias p50/p95 de las últimas 120
  respuestas válidas, peticiones fallidas, fallos consecutivos y último error.

La prueba SQL aislada materializa catálogos para comprobar reglas; no sirve
como benchmark de Supabase. Las pruebas del navegador con API simulada no
acreditan latencia real de Internet ni capacidad para cientos de jugadores.

La prueba general de bienvenida llegó más lejos que la aceptación, pero falló
en su comprobación visual de un NPC dentro de una cinemática
(`scripts/world/welcome.mjs:281`). Esa revisión de encuadre queda pendiente;
no se presenta la suite general del mundo como superada.

## Segunda pasada: cliente y recursos

La ampliación de esta revisión corrige otros costes y carreras del cliente:

- El build habitual publica HTML, JavaScript y recursos separados. Los GLB se
  descargan cuando se solicitan y pueden reutilizarse desde caché. El modo
  `npm run build:standalone` conserva la distribución incrustada en
  `dist-standalone/` para contextos que necesitan un archivo portátil.
- El índice de mapas carga el módulo del destino al viajar. El editor genera
  ambos índices: diferido para hosting y estático para el modo portátil, donde
  las importaciones dinámicas incrustadas pueden atascar el `await` inicial.
  Las transacciones de publicación conservan y restauran ambos archivos.
- El juego arranca con cuerpos, ropa básica y equipo inicial. Las demás armas,
  accesorios y colecciones de armadura se cargan según el personaje o NPC.
  Los editores conservan `loadKits()` completo para inspeccionar el catálogo.
- Las peticiones concurrentes del mismo equipo comparten la descarga; si falla,
  se puede reintentar. Las respuestas de modelos que llegan después de salir
  de la sesión no pueden recrear jugadores. Durante una carga se conserva el
  modelo anterior; los retratos pendientes no bloquean la lista de personajes.
  El contador del mapa incluye también a quienes esperan la carga de su equipo.
  La descarga y descodificación de GLB se limita a seis trabajos simultáneos;
  los visores completos no abren cientos a la vez. Un fallo libera su plaza.
- Nivel, nombre y título remotos actualizan sus datos y placa sin reconstruir
  el personaje ni reiniciar la animación. Los bocadillos ocultos dejan de leer
  alturas del DOM y de escribir posiciones cada fotograma.
- Cerrar Social ya no invalida la consulta de amistades que siguen esperando
  las notificaciones. Se conserva una lectura compartida sin duplicar sondeos.
- Las paletas recoloreadas tienen propietarios: las texturas de personajes
  vivos se conservan y solo quedan hasta 32 paletas libres para reutilizar.
  Al desechar personajes se liberan sus referencias; cambiar repetidamente
  colores ya no hace crecer esa caché indefinidamente.
- Las interacciones de profesiones consultan una rejilla cercana al jugador y
  reutilizan las alturas estáticas. Disponibilidad, energía y muebles siguen
  leyendo el progreso actual y no quedan congelados por la caché.

### Medición del arranque

Contexto nuevo de Chromium, localhost, build de producción, 1280 × 800 y modo
compatible. Son muestras de arranque con renderizado por software, no una
promesa de tiempos de Internet ni de FPS en una GPU real. La memoria indicada
es el heap JavaScript; no incluye toda la memoria nativa ni de GPU.

| Medida | Antes | Después |
| --- | ---: | ---: |
| HTML inicial | 180,1 MB | 45,3 KB |
| Transferencia hasta disponer del cliente | 82,0 MB | 16,0 MB |
| Heap JavaScript | 1.520 MB | 542 MB |
| Arranque de la muestra | 40,7 s | 12,5 s |

El código inicial queda en unos 3,9 MB y el mapa de Brumaluz se carga aparte.
El módulo de Pompelín, de unos 5 MB, y los interiores esperan a que se soliciten.
Los modelos de la escena y las texturas dibujadas conservaron sus recuentos en
ambas capturas. Los informes están en `art/performance-review/client/`.

En 1.000 consultas de interacción junto a un recurso, la versión anterior
reconstruyó 216.000 candidatos y consultó otras tantas alturas. La versión
corregida produjo 1.000 candidatos y calculó una sola altura. El microbenchmark
con terreno simulado pasó de 100,2 a 3,4 ms; mide esa consulta, no el fotograma
completo. Informes en `art/performance-review/interactions/`.

### Comprobación del cliente

- `npm run test:performance:client` comprueba suscripciones compartidas, caché
  de paletas, deduplicación y reintento de modelos, recursos y muebles, y el
  recorrido de dos jugadores con equipo diferido. Incluye 40 reconstrucciones
  reales para comprobar que la caché libre sigue acotada y una descarga que
  termina después de abandonar el mundo.
- La prueba de publicación de mapas comprueba los dos índices y conserva la
  atomicidad frente a destinos inválidos. La comprobación de producción de
  `test-ambient.mjs` inspecciona el JavaScript inicial además del HTML.
- `node tools/review-client-performance.mjs` mide el build de hosting;
  `--baseline` conserva una referencia separada. `PERFORMANCE_DIST` permite
  seleccionar otro directorio y `PERFORMANCE_LABEL` evita sobrescribir informes.
- `node tools/review-client-editor-smoke.mjs` comprueba la carga completa y el
  cambio de clase, colección y animación del visor de equipo sin guardar fichas.
- El cambio de empaquetado requiere desplegar **todo `dist/`**, incluidos sus
  archivos `assets/`. Copiar solamente `index.html` corresponde al build portátil.

## Servidor de desarrollo local

El 31 de octubre se reprodujeron bloqueos por exports nuevos de
`src/art/inventoryPaintings.ts`: `potionPainting`, `furniturePainting` y
`foodPainting` existían en disco, pero Vite conservaba una versión anterior del
módulo. También fallaban las referencias SSR del editor de misiones. La causa
era la exclusión `**/art/**`, que coincidía tanto con las fuentes artísticas de
la raíz como con el código de `src/art`. Reiniciar despejaba el fallo temporalmente;
el sondeo añadido inicialmente no podía detectar archivos excluidos.

La exclusión artística usa ahora la ruta absoluta de `art/` en la raíz del
proyecto. Los cambios de `src/art/` vuelven a invalidar el JavaScript servido
y sus importaciones SSR. Se retira el sondeo añadido durante el diagnóstico;
se mantienen las exclusiones de compilaciones y fuentes artísticas, y una
espera de 200 ms de estabilidad antes de procesar guardados sucesivos.

`npm run test:dev` sitúa el módulo de prueba dentro de `src/art/`, donde reproduce
el fallo con la exclusión anterior. Comprueba, con un mismo servidor, cuatro
cambios sucesivos de exports, guardados directos, sustituciones atómicas y la
incorporación de imágenes a un `import.meta.glob`, tanto en el JavaScript servido
como en las importaciones SSR.

## Tercera pasada: línea de visión con índice espacial

Revisión del 2 de noviembre de 2026, motivada por avisos frecuentes de
«Conexión al mundo interrumpida» y acciones lentas en el servidor.

- La red y el latido en ciudad estaban sanos: ~85 ms por petición completa y
  p50 de 69 ms / p95 de 96 ms sin fallos en una sesión real en Brumaluz.
- La causa estaba en `game_rpg_sight`: recorría en PL/pgSQL **todos** los
  bloqueadores del mapa por cada comprobación (2.884 en Pompelín, ~12–20 ms por
  llamada). El tick compartido de la fauna la invoca por criatura y jugador, y
  los ataques, curas, expediciones, profesiones y muebles también la usan. Todo
  ello se serializa bajo el candado global de la fauna, así que cada latido en
  Pompelín costaba cientos de milisegundos y los demás hacían cola: las
  estadísticas del proveedor registraban `wilderness_action` con media de
  1,7 s y sincronizaciones de hasta 7,9 s, por encima del límite de 4 s del
  cliente, que entonces anunciaba la conexión interrumpida.
- `rpg_blockers` tiene ahora una columna generada `bounds` (caja envolvente en
  coordenadas del mundo) con un índice GiST. `game_rpg_sight` solo recorre los
  bloqueadores cuya caja toca el rectángulo del segmento; el corte exacto por
  caja girada no cambia. La paridad se comprobó con 0 discrepancias en 6.900
  segmentos trazados entre bloqueadores reales del servidor configurado.

Medianas en el PostgreSQL configurado (planificación y ejecución SQL, sin HTTP),
con un personaje sintético junto a una criatura y transacción deshecha:

| Operación | Antes | Después |
| --- | ---: | ---: |
| `game_rpg_sight` en Pompelín (segmentos largos) | 12,4 ms | 0,4 ms |
| Sincronizar en Pompelín con fauna activa | 505,3 ms | 18,2 ms |
| Empezar combate en la espesura | 82,9 ms | 10,7 ms |
| Atacar en la espesura | — | 26,0 ms |

- `npm run db:sight-performance` aplica solo la columna, el índice y la función,
  verifica la paridad dentro de la transacción y guarda la reversión en
  `art/performance-review/sight-rollback.sql`. No toca las filas de bloqueadores
  (el `18a-rpg-geometry.sql` del repositorio contiene cambios de la posada de
  otra tarea aún sin publicar) ni ninguna migración de datos.
- `scripts/test-sight-performance.mjs` (incluida en `npm run test:performance`)
  carga el archivo generado completo en PostgreSQL/WASM y comprueba la columna,
  el índice y la paridad con una referencia de recorrido completo.
- El generador `tools/build-rpg-geometry.mjs` emite la misma columna, índice y
  función, de modo que una futura regeneración conserva la corrección.
- `scripts/test-combat-sql-local.mjs` falla actualmente al crear
  `game_skill_rank` porque el `03-formulas.sql` en curso referencia
  `game_skill_data` y el arnés no la carga; es trabajo de otra tarea anterior a
  esta pasada.

## Límites que siguen abiertos

Una caída real de red o del proveedor sigue requiriendo reconexión. El sondeo
HTTP y las instantáneas completas por mapa siguen siendo una arquitectura para
grupos pequeños. El mapa exterior sigue teniendo un módulo de datos grande,
ahora diferido. La ciudad y sus personajes todavía requieren trabajo de CPU y
GPU al cargar y al jugar; estas mediciones no prometen un FPS concreto en el
equipo del jugador. La revisión del cliente se valida localmente y requiere
publicación para llegar a la web alojada.

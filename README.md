# Crónicas de Brumaluz

MMO de navegador cozy en una ciudad medieval, con estilo pintado a mano.

## Cuentas y personajes

- Registro e inicio de sesión se gestionan con Supabase Auth; el proyecto no guarda contraseñas.
- Al registrarse, cada usuario elige un nombre de usuario único (3-20 letras ASCII, números o guion bajo). El acceso sigue usando correo y contraseña; el nombre de usuario identifica al jugador, aparece en la selección de personajes y es visible para otros usuarios autenticados.
- La interfaz está disponible en español e inglés; el idioma se cambia con las banderas de acceso y del menú del juego y queda guardado en el navegador.
- El acceso permite solicitar un correo de recuperación y cambiar la contraseña desde el enlace enviado por Supabase Auth.
- Los personajes se guardan en `public.characters`, protegidos por políticas RLS para que cada cuenta solo acceda a los suyos.
- Tras iniciar sesión aparece la selección de personajes. Desde ahí se puede jugar con uno existente o crear otro. Cada cuenta puede tener un máximo de cinco personajes; para crear más, primero hay que borrar uno. El creador guarda el personaje al pulsar «Guardar y entrar».
- Cada personaje guarda su nivel (comienza en 1), sus puntos de experiencia (comienzan en 0), vida, atributos, título, ubicación y última posición exacta en el mapa; la tarjeta de selección muestra el nivel y la zona guardada. Por ahora solo está disponible Brumaluz. Al volver a jugar apareces donde lo dejaste (si estabas caído, reapareces en la capital).
- **El servidor manda.** El navegador no puede escribir en `public.characters` (solo leer y borrar). Crear personajes, ganar XP/nivel, recibir daño o curación, repartir puntos de atributo, cambiar de título, reaparecer y guardar la posición pasan por funciones de [`supabase/server.sql`](./supabase/server.sql) que validan todo y calculan el resultado: el cliente solo pide la acción y muestra lo que el servidor responde. Sin guardado manual: el mundo sincroniza el movimiento y guarda una posición persistente cada 5 s y al salir normalmente; si se cierra el navegador de golpe se conserva el último checkpoint. El servidor rechaza posiciones fuera del mundo y desplazamientos que superan el presupuesto de velocidad acumulado, y devuelve al jugador a la última posición válida.
- Las acciones del NPC de pruebas y demás: cada acción del juego tiene su propia función en el servidor: `respawn_character`, `debug_damage`, `debug_heal`, `debug_xp`, `spend_attribute_points`, `set_character_title`, `save_character_position`, `create_character` y `character_enter`. Las `debug_*` (NPC de pruebas: daño, curación, XP) solo funcionan mientras `server_config.debug_actions` sea `true`; en producción ponlo en `false` (`update public.server_config set value = 'false' where key = 'debug_actions';`).
- **Sobrecuración:** la vida curada por encima del máximo no se pierde: pasa a una reserva dorada (máximo el 30 % de la vida máxima) que se dibuja al final de la barra de vida, absorbe el daño antes que la vida y se desvanece con el tiempo (1 punto por segundo). Se calcula en el servidor (`game_overheal_now`) y el cliente solo la descuenta en pantalla; los parámetros están en `OVERHEAL` (`src/data/stats.ts`) y en `server.sql`.
- **Barra de acceso rápido** (abajo, teclas `1`-`0`, `src/ui/actionBar.ts`): por ahora solo objetos usables (pociones). Se llena sola al comprar, o arrastrando objetos desde la mochila; clic derecho vacía un hueco. La disposición se guarda en el navegador por personaje (es solo interfaz); usar el objeto lo valida siempre el servidor (`use_item`). `Z` alterna entre la barra principal y la secundaria (con animación).
- Al abrir menús o ventanas se ocultan el minimapa y la barra rápida; **Inventario** conserva la barra para arrastrar objetos. El chat se recupera temporalmente desde una pequeña pestaña **Chat ↑** en la esquina inferior derecha, no al cruzar toda su zona. Se mantiene abierto mientras el ratón está dentro o escribes y se oculta al dejar ambos. La misma pestaña recupera el chat desvanecido por inactividad. Minimizar lo recoge en una pestaña pequeña abajo, conservando su tamaño al restaurar; una vista temporal no cambia esa preferencia. Su scroll usa los colores de madera y oro del panel.
- **Títulos reservados «Rey de Pompelín» y «Reina de Pompelín»** (con el mismo fénix y efectos): cada uno solo está disponible para los correos autorizados en `server_config.staff_titles` (`server.sql`); el servidor lo valida en `set_character_title` y el selector solo lo muestra a su cuenta (`my_titles`). La migración añade la autorización de Reina sin borrar la configuración del Rey ni otras autorizaciones existentes. Se eligen en la ficha del personaje; no se cambia automáticamente el título equipado.
- **Comercio:** `vendor_buy`, `vendor_sell` y `use_item`, más `debug_money` (+100 pelines del NPC de pruebas). El servidor decide mercancía, precios (compra = valor del objeto; venta = la mitad), saldo, hueco libre y efecto de los objetos; el cliente solo pide la acción. Catálogo en `game_item` / `game_vendor_stock` (`server.sql`) y su copia para mostrar en `src/data/items.ts`: mantenerlos iguales. Los vendedores tienen pelines infinitos, no se muestran.

**Pendiente de hacer en el servidor, a medida que se añada cada sistema** (cada uno con su propia función en `server.sql`, validada y sin confiar en el cliente):
- XP y nivel reales: dar experiencia por monstruos, misiones y descubrimientos (hoy solo existe `debug_xp`).
- Comercio: comprobar que el jugador está cerca del vendedor (hoy el servidor no conoce la posición de los NPC); recoger botín, soltar y equipar objetos.
- Combate: daño y curación reales, maná/estamina y reaparición con penalizaciones si las hay.
- Títulos ganables: comprobar los requisitos en `set_character_title`.
- Posición: colisiones y límites reales del mapa en el servidor (hoy solo se comprueban el límite del mundo y la velocidad).
- Fórmulas de vida, XP y sobrecuración: están duplicadas en `server.sql` y `src/data/stats.ts`; mantenerlas iguales.
- Cada tarjeta de personaje permite borrarlo de la base de datos, tras confirmar escribiendo exactamente su nombre.

### Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/) y ejecuta en el SQL Editor, **en este orden**, [`supabase/schema.sql`](./supabase/schema.sql) y [`supabase/server.sql`](./supabase/server.sql). Si ya configuraste Supabase, vuelve a ejecutar ambos archivos actualizados (son idempotentes): `schema.sql` retira los permisos de escritura directa sobre los personajes y `server.sql` crea las funciones del servidor. Hasta que ejecutes `server.sql`, crear y jugar con personajes fallará. Para no pegarlo a mano: pon `SUPABASE_DB_URL` (cadena de conexión de Postgres, ver `.env.example`) en `.env.local`, que git ignora, y ejecuta `npm run db:apply` (añade `-- --schema` para aplicar también `schema.sql`).
2. Los usuarios que ya existían recibirán un perfil sin nombre de usuario. Asígnales uno manualmente desde el SQL Editor: consulta sus cuentas con `select u.id, u.email, p.username from auth.users u left join public.profiles p on p.user_id = u.id order by u.created_at;` y para cada persona ejecuta `update public.profiles set username = 'NombreElegido' where user_id = 'UUID';`. El índice único no distingue mayúsculas de minúsculas; usa nombres de 3-20 letras ASCII, números o guion bajo. No se debe modificar `auth.users` para hacer esta asignación.
3. En **Auth → URL Configuration**, configura el Site URL y permite `http://localhost:5173/**` como Redirect URL de desarrollo (y `http://127.0.0.1:5173/**` si accedes usando esa dirección), además del dominio final al desplegar. Añade también la URL de producción para que los enlaces de recuperación puedan volver a la aplicación.
4. En la configuración de Auth, decide si quieres exigir confirmación de correo. Si está activada, el usuario deberá confirmarlo antes de iniciar sesión.
5. Copia `.env.example` como `.env.local` y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores de **Project URL** y la clave pública/publishable del proyecto.
6. Reinicia `npm run dev`. En producción, configura esas mismas variables en el servicio de despliegue y vuelve a compilar.

La clave publishable es para el navegador y está protegida por las políticas RLS de la base de datos. **No uses ni publiques una `service_role` o secret key en la web.** La autenticación real necesita el proyecto de Supabase y su esquema; sin esa configuración, el sitio muestra qué falta y no ofrece un acceso simulado.

### Despliegue público en Vercel

1. Sube la rama `main` a GitHub e importa `AndyLatimer/brumaluz` desde [Vercel](https://vercel.com/new). Elige `brumaluz` como nombre del proyecto si está disponible; la URL resultante será `https://brumaluz.vercel.app`. Si el nombre ya está ocupado, Vercel pedirá elegir otro.
2. Vercel detecta Vite automáticamente. Comprueba que el comando de build sea `npm run build` y el directorio de salida `dist`.
3. En **Project Settings → Environment Variables**, configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores del proyecto de Supabase. Añádelas al menos al entorno **Production** (y también a **Preview** si quieres que las previsualizaciones puedan iniciar sesión). Son las mismas variables que en `.env.local`; no añadas `SUPABASE_DB_URL`, `service_role` ni ninguna clave secreta al sitio.
4. Haz el primer deploy. En Supabase, ve a **Authentication → URL Configuration** y establece **Site URL** como la URL de producción asignada por Vercel. Añade también `https://brumaluz.vercel.app/**` a **Redirect URLs**. Si Vercel asigna otro subdominio, usa ese dominio real en ambos campos.
5. Antes de abrir el juego al público, desactiva las acciones del NPC de pruebas en el SQL Editor de Supabase:

   ```sql
   update public.server_config set value = 'false'::jsonb where key = 'debug_actions';
   ```

   Comprueba el resultado con `select key, value from public.server_config where key = 'debug_actions';`. Así se desactivan las acciones de prueba de daño, curación, XP y dinero; las funciones normales del juego siguen disponibles.
6. Cada push a `main` desplegará una nueva versión automáticamente. Para usar un dominio propio más adelante, añádelo en **Project Settings → Domains** y actualiza **Site URL** y **Redirect URLs** en Supabase.

## Creador de personaje

- Linajes: Humano, Elfo, Lagto' (gente lagarto) y Pelso (gente gato), hombre o mujer.
- Atributos (Fuerza, Intelecto, Corpulencia, Agilidad, Pericia, Presencia y Percepción): cada personaje empieza con 5 en cada atributo, suma 5 puntos de bonificación según su linaje y reparte 2 puntos libres. Ningún atributo puede superar 15. Los humanos destacan en Pericia y Presencia; los elfos en Intelecto, Pericia y Agilidad; los Lagto' en Fuerza y Corpulencia; los Pelso en Agilidad, combate y Percepción. La asignación se guarda con el personaje, pero por ahora no afecta a las mecánicas del juego.
- Altura y complexión ajustan tanto el tamaño general como las proporciones de piernas, torso, hombros y extremidades.
- Personajes modulares sobre el pack **KayKit Adventurers** (Kay Lousberg, CC0): cabezas, trajes,
  sombreros y armas se combinan sobre un esqueleto común con 21 animaciones.
- Colores de piel, pelo y ropa repintando la paleta de las texturas; orejas, colas y crestas
  propias para elfos, Lagto' y Pelso.
- Escenario con materiales PBR, HDRI de atardecer y relieve CC0 de Poly Haven (vía `@pmndrs/assets`).

## Créditos

- Personajes: [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) de Kay Lousberg (CC0).
- Ciudad: [KayKit Medieval Hexagon](https://kaylousberg.itch.io/kaykit-medieval-hexagon) de Kay Lousberg (CC0).
- HDRI y mapas de relieve: [Poly Haven](https://polyhaven.com) (CC0), empaquetados en `@pmndrs/assets`.

Para regenerar los modelos optimizados: `node tools/prepare-models.mjs <carpeta gltf de Adventurers>` y
`node tools/prepare-city.mjs <carpeta Assets/gltf de Medieval Hexagon>`.

## Ciudad

- Brumaluz está hecha con el pack **KayKit Medieval Hexagon** (Kay Lousberg, CC0) a escala ×4:
  plaza con fuente, avenidas, barrios residenciales, taberna, mercados, iglesia, herrería,
  castillo, granja con molino, río con vado y bosques y montañas alrededor. Una muralla de
  piedra rodea la capital y sus seis puertas conectan con las avenidas principales.
- Las calles se eligen y giran solas según sus vecinos; las puertas y la muralla se generan
  siguiendo el perímetro hexagonal y tienen colisión. El suelo continuo tiene colinas visibles
  dentro y fuera de la muralla, con plataformas suavizadas bajo los edificios; la hierba low-poly
  cubre también los claros entre casas y los islotes verdes de las calles, se mece con la brisa y
  se inclina al paso del personaje. Hay flores silvestres, nenúfares y plantas de ribera, bancos con
  colisión, puestos abastecidos junto a los comercios, bandadas de pájaros y un molino en movimiento.
  Seis puntos de servicio estables (`city.vendorSpots`) permiten añadir vendedores y otros NPCs
  más adelante sin rehacer la distribución.
- Al entrar se oyen viento, agua del río, pájaros, murmullo lejano de ciudad y campanas ocasionales,
  generados localmente con Web Audio; se pueden silenciar o reactivar desde el menú del juego. No se
  descargan pistas externas.
- Modo exploración: WASD se mueve respecto a la cámara (W hacia donde miras, A/D a los lados, S hacia ti) con aceleración y frenada suaves; el personaje se orienta hacia donde va. Arrastrar con el ratón orbita la cámara libremente (el vertical se mantiene), rueda para acercar con zoom suave, clic para moverse, Mayús alterna correr/caminar,
  espacio para saltar y E para saludar.
- Opciones (menú del juego): Vídeo (idioma), Sonido (sonido ambiental, volumen ambiental y volumen general; se guardan en el navegador) y Controles (teclado ilustrado).
  **Cada vez que se añada o cambie un control hay que reflejarlo en `CONTROLS` de `src/ui/controls.ts`**; la ventana se genera a partir de esa lista. No hay reasignación de teclas.
- Interacción (`E`; saludar es `<`): `City.interactables` define puntos interactivos (pozo, NPCs). Los diálogos usan `src/ui/dialog.ts`: `openDialog` (líneas simples) y `openConversation` (árbol de nodos con respuestas del jugador; siempre se añade «[Salir de la conversación]» salvo `noExit`; las opciones admiten `when` y `action` para flags de misión). Los NPCs se declaran en `NPCS` de `src/main.ts` (nombre, aspecto, conversación) y su posición en `City.npcSites`; muestran placa verde (no hostiles). el NPC de prueba «Testículos, the Debugger» está junto a la casa más cercana al spawn. Los títulos de personaje están en `src/data/titles.ts`.
- Niveles y atributos: nivel máximo 50 (`MAX_LEVEL`). Se gana 1 punto de atributo cada 3 niveles (3, 6 … 48; `attributePointsAllowed` en `src/data/data.ts`), que se suma a los 2 de la creación (18 en total; tope 15 por atributo). Los puntos pendientes se calculan (permitidos − gastados) y se reparten con «+» en la ficha de personaje; el botón del menú de personaje muestra un «!» mientras haya puntos.
- Experiencia: `gainExperience(n)` en `src/main.ts` suma XP con destellos dorados, número flotante y barra brillante; si completa niveles (`experienceToNextLevel`) añade destello de pantalla, estrellas y cartel «¡Subes de nivel!». Se prueba con Testículos («Recibir 200 puntos de experiencia»).
- Muerte: al llegar la vida a 0 el personaje cae (animación `Death_A`), el mundo se apaga a grises y sale la pantalla «Has caído» con el botón (o `E`) «Reaparecer en la capital», que lleva al punto de inicio de Brumaluz con la vida completa (`die()`/`respawn()` en `src/main.ts`). Daño y curación pasan por `damagePlayer`/`healPlayer`.
- Menú de personaje (`Tab`, icono a la izquierda del menú del juego): Inventario (mochila de 25 huecos + 1 bloqueado con «+» para futuras ampliaciones, 10 ranuras de equipo sobre un muñeco: cabeza, colgante, torso, manos, anillo, arma, mano izquierda, piernas, pies y abalorio; constantes en `src/data/inventory.ts`) y Ficha de personaje (`src/ui/playerWindows.ts`). Las monedas (Pelines y Lágrimas de fénix, premium) están descritas en [docs/CURRENCY.md](docs/CURRENCY.md). Habilidades, Profesiones, Enciclopedia y Social son solo botones por ahora; "Ayuda" del menú normal también.
- HUD del jugador (vida, maná/estamina, experiencia): las fórmulas son editables en
  `src/data/stats.ts` y están documentadas en [docs/STATS.md](docs/STATS.md).
- Minimapa (abajo a la izquierda, `src/ui/minimap.ts`): la ciudad se captura una sola vez desde arriba (`src/world/mapCapture.ts`) y el mapa no gira (norte arriba). Muestra tu personaje con una flecha y cono de visión, los NPC (punto verde, flecha en el borde si quedan fuera), brújula N/E/S/O, lugar y coordenadas. Zoom con +/− o la rueda; `º` lo oculta.
- Habla: al enviar un mensaje público (General/Zona) sale un bocadillo con tu nombre sobre tu personaje y mueve la boca; los NPC (diálogos y comentarios) solo mueven la boca, sin bocadillo. La boca se anima en `src/character/head.ts` (`mouth`) y `Character.speak()`.
- Chat (esquina inferior derecha, `src/ui/chatWindow.ts`): ventana redimensionable (asa arriba-izquierda, se recuerda el tamaño) y minimizable, con filtros General (todo el servidor) / Zona (tu mapa) / Susurros / Sistema / NPC; el botón junto al campo de texto (o /g, /z) elige el canal de escritura. `Enter` escribe, `Esc` sale. Comandos: `/w ~cuenta mensaje` (susurro a una CUENTA; el `~` distingue el nombre de cuenta del de personaje), `/r` (responder), `/ignore` y `/unignore ~cuenta`, `/clear`, `/ayuda`. Clic en un nombre para susurrar a su cuenta. Los diálogos con NPC y sus comentarios cercanos (`barks` en `NpcDef`) salen en el canal NPC. El servidor valida y reparte los mensajes (`chat_send`, tablas `chat_messages` y `chat_mutes` en `supabase/server.sql`; límite 200 caracteres y 5 mensajes/10 s). Para silenciar a alguien: `insert into chat_mutes (user_id, until) values ('<uuid>', now() + interval '1 day')`. Requiere ejecutar `server.sql` y tener Realtime activo en la tabla `chat_messages`.
- Cada entrada al mundo inicia un chat limpio: se reciben mensajes nuevos por Realtime, sin cargar mensajes anteriores ni los enviados mientras estabas fuera. Al salir se borran mensajes, borradores y destinatario de respuesta. Se conservan las preferencias del chat y las cuentas silenciadas; los avisos de sistema de la nueva conexión siguen mostrándose.
- El interruptor ambiental reanuda el contexto de audio del navegador y cancela activaciones anteriores al cambiar rápidamente. Al apagarlo fija la ganancia a cero y desconecta la salida de los altavoces, sin cola ambiental residual. En desarrollo se cierra el contexto anterior al sustituir el módulo para no acumular ambientes durante recargas en caliente. La suite de navegador exige silencio exacto al desactivar y mide la salida al activar, reanudar un contexto suspendido y cambiar el volumen general.

## Estructura del proyecto

```
src/
  main.ts          punto de entrada: bucle de juego, HUD y menús
  data/            datos y reglas: data, stats, inventory, currency
  world/           ciudad y entorno: city, env, paint, render, audio, load
  character/       personaje: character, head, portrait
  ui/              interfaz: i18n, controls, tooltip, classIcons, playerWindows, dialog
  services/        cuentas (Supabase) y ajustes
  styles/          style.css
  assets/models/   modelos .glb
docs/              documentación de sistemas (STATS, CURRENCY)
tools/             scripts de preparación de modelos
```

## Desarrollo

```bash
npm install
npm run dev     # servidor de desarrollo
npm run build   # genera dist/index.html (un único archivo)
```

### Compatibilidad gráfica

- Si la interfaz funciona pero el mundo o el creador aparecen vacíos, abre `https://brumaluz.vercel.app/?graphics=compatible`. El botón «Gráficos» en la pantalla de acceso y el creador permite alternar y recarga la página; guarda el personaje antes de cambiar de modo.
- El modo compatible conserva la ciudad y los personajes, pero no usa HDRI, sombras ni posprocesado (oclusión ambiental y resplandor). Limita la resolución a 1920 × 1080 y reduce la captura del minimapa. Se activa automáticamente si falta `EXT_color_buffer_float`; no depende del modelo de tarjeta gráfica.
- El modo normal conserva los efectos, pero limita el renderizado a 2560 × 1440 para no multiplicar innecesariamente los buffers en pantallas de alta densidad.
- Si Chrome rechaza los atributos al crear WebGL 2, el arranque reintenta sin antialiasing y, si es necesario, con la selección de GPU predeterminada del navegador. Esto no activa el modo compatible ni desactiva los efectos normales. Los reintentos se registran en la consola; solo se muestra el error si ninguno permite crear el contexto. Cuando el contexto no usa antialiasing, tampoco se fuerza MSAA en los buffers del posprocesado o los retratos.
- Una pérdida del contexto WebGL o un fallo de shaders muestra un aviso con opciones de recarga, en lugar de dejar solo el mundo vacío. Si WebGL 2 no está disponible, el aviso indica comprobar la aceleración gráfica del navegador y el controlador; el modo compatible también necesita WebGL 2.
- Pruebas: `npm run test:graphics` compila y usa Playwright para comprobar ambos modos con ciudad y personajes, resolución, rechazo de atributos WebGL (antialiasing y preferencia de GPU), falta de texturas flotantes, pérdida de contexto y fallos de WebGL/shaders. Requiere un navegador instalado (Edge en Windows, Chromium de Playwright en otros sistemas); `PLAYWRIGHT_CHANNEL` permite elegir otro canal.

### Mundo multijugador

- El distintivo de ubicación bajo el minimapa muestra un pin y el nombre de la zona, un contador separado con icono de jugadores (incluido el tuyo) y una fila de coordenadas con separador; no hay un mensaje superior permanente. Al perder la conexión, el contador muestra un guion y el aviso de reconexión está disponible en su descripción y en el chat. El botón de gráficos está en la esquina inferior derecha fuera del juego, separado de los datos de cuenta.
- Las cuentas que entran en Brumaluz se ven en la misma ciudad, con su aspecto, nombre, título, movimiento interpolado, orientación, saludo, salto y estado de caída. Los mensajes públicos de jugadores presentes también aparecen sobre su personaje. La opción de mostrar nombres afecta tanto a NPCs como a jugadores.
- Al pasar el cursor por un personaje se muestra su detalle arriba, centrado. La zona del cursor cubre el cuerpo con un margen de 8 px, sin depender de las animaciones ni de acertar entre sus triángulos. Si el cursor no señala a nadie, la dirección horizontal de la cámara selecciona personajes delante del jugador en un cono de 10°, independientemente de la inclinación de la cámara o la altura del modelo, siempre que estén en pantalla. Un pequeño margen angular al mantener el objetivo evita cambios nerviosos entre personajes próximos. Tanto cursor como cámara solo muestran personajes a 10 m como máximo desde el personaje local (no desde la cámara), y la tarjeta se oculta al superar ese límite. Se comprueba la visibilidad de torso/cabeza para no mostrar a través del escenario; no cambia la interacción con E ni selecciona permanentemente un objetivo. Se oculta con menús, conversaciones, muerte o salida del mundo y no depende de la opción de nombres flotantes.
- El panel es compacto y usa la tipografía del HUD propio: nombre, nivel en texto dorado sin insignia, título equipado debajo, clase en el icono y `~usuario`. Las barras solo muestran cifras de vida y maná o estamina; sus etiquetas siguen disponibles para lectores de pantalla. Las cifras y máximos vienen del servidor, incluidos los atributos asignados sin revelar esos atributos. Los títulos reservados conservan su fénix.
- Los NPC amistosos tienen nombre verde, un título configurable por NPC y un tipo con icono propio en lugar de clase o cuenta; no se muestra la etiqueta «Personaje no jugador». Testículos usa el título «Depuración», con nivel 1, vida 100 y maná 100 definidos en su ficha de NPC. Los tipos de icono disponibles son depuración, comerciante y habitante, independientes del título; asignar un tipo no añade acciones por sí mismo.
- Una cuenta solo mantiene un personaje conectado al mundo: entrar desde otra pestaña o equipo sustituye la sesión anterior, que vuelve a la selección con un aviso. Una respuesta tardía o la salida de la pestaña antigua no puede expulsar la nueva sesión.
- [`world_join`, `world_sync` y `world_leave`](./supabase/server.sql) gestionan una concesión de sesión en `public.world_players`, inaccesible directamente desde el navegador. El servidor fija la identidad y el aspecto a partir del personaje guardado, y solo publica los datos necesarios para dibujarlo, nunca inventario, monedas ni atributos privados.
- Cada cliente envía una petición secuencial y obtiene la instantánea del mapa; espera 250 ms entre respuestas, sin peticiones de movimiento solapadas. Es una primera implementación para grupos pequeños, **no una infraestructura MMO a gran escala**: aumenta las consultas y escrituras de Supabase con los jugadores conectados y debe migrar a un servidor de simulación/difusión antes de crecer.
- Una salida normal elimina la presencia y guarda la última posición validada. Si el navegador se cierra, se suspende o pierde la red, los demás dejan de verlo a los 15 s sin latido. La reconexión se reintenta con aviso visible, sin apropiarse automáticamente de una sesión sustituida.
- Aún no hay PvP ni colisiones entre jugadores. La validación de velocidad y límites del mundo no sustituye las colisiones autoritativas del mapa.
- Antes de publicar este cliente, aplica la versión actual de [`supabase/server.sql`](./supabase/server.sql). `npm run db:apply` ejecuta la actualización completa en una transacción y recarga la API al confirmar; no cambia `debug_actions` si ya estaba configurado.
- Pruebas del navegador: `npm run test:world` usa cuentas ficticias en dos contextos aislados, con una API simulada interceptada (sin acceder a cuentas reales), y comprueba modelos 3D, nombres, movimiento, correcciones, salida, sustitución, reconexión y respuestas tardías. Usa el mismo navegador/configuración que las pruebas gráficas.
- Las entradas al mundo se serializan y las respuestas de acciones, títulos, puntos, chat y creación se descartan si ya se ha salido o cambiado de personaje/cuenta. Al salir se detiene el movimiento antes de esperar al guardado. Un fallo remoto al cerrar sesión se muestra incluso si Supabase ya ha eliminado la sesión local.
- Regresiones de cuentas: la suite anterior también comprueba doble entrada, títulos pendientes al cambiar de personaje, creación pendiente al volver a selección, cierre de sesión con fallo de red y datos antiguos de linaje/clase no válidos. El botón de gráficos no debe tapar el de cerrar sesión en la selección.
- Pruebas SQL: define `SUPABASE_TEST_DB_URL` y ejecuta `npm run test:world:db` contra una base de pruebas con el esquema de cuentas instalado. Aplica las funciones y crea fixtures únicamente dentro de una transacción que siempre se deshace. Para usar deliberadamente la base de `.env.local`, con permiso de su administrador: `npm run test:world:db -- --configured`. No lo hagas durante tráfico elevado: aunque no persiste cambios, la actualización transaccional bloquea brevemente objetos del esquema.
- Los fixtures SQL usan una zona ficticia única para no mezclarse con jugadores conectados. Se comprueban también posiciones JSON nulas, rechazo de ángulos no finitos y salida tardía tras borrar un personaje. Las operaciones de mundo bloquean primero los personajes y después su presencia para evitar invertir el orden durante salida, cambio de personaje y reaparición.

### Amigos y ventana Social

- Los amigos conectados muestran el nivel del personaje activo junto a su nombre; cambia con el personaje y se oculta al desconectarse. El servidor no comparte el nivel de solicitudes pendientes ni de cuentas desconectadas.
- La opción **Social** del menú de personaje abre los amigos de tu cuenta, compartidos por todos tus personajes. Se añaden por nombre de cuenta (sin correo ni nombre de personaje); la otra persona debe aceptar la solicitud. Las solicitudes cruzadas no se aceptan automáticamente.
- La ventana separa amigos, solicitudes recibidas y enviadas. Permite aceptar, rechazar, cancelar y eliminar amigos con confirmación; el botón de susurro está desactivado para amigos desconectados y, para conectados, cierra la ventana y prepara `/w ~cuenta` en el chat. El campo de invitaciones muestra un prefijo `~` fijo y admite pegar nombres con o sin él.
- Solo los amigos aceptados reciben el estado de conexión, personaje, clase y mapa actual. «Conectado» significa que está dentro del mundo y ha enviado un latido en los últimos 15 s, no simplemente que tenga la cuenta abierta. Las solicitudes pendientes no revelan presencia ni clase. El icono usa la clase del personaje conectado; desconectados y solicitudes muestran un escudo neutro.
- `friends_list`, `friend_request` y `friend_update` validan autenticación, participantes y consentimiento en el servidor. La tabla `friendships` no tiene acceso directo desde el navegador, y limita a 50 las solicitudes pendientes enviadas por cuenta.
- Mientras estás jugando se consultan las amistades cada 5 s, también con Social cerrado, para avisar de solicitudes recibidas y solicitudes enviadas que pasan a aceptadas. Los avisos aparecen en una alerta y en el chat; las peticiones pendientes mantienen una exclamación tanto en Tab como en la opción Social. No se repiten con cada consulta. Al salir se detienen los avisos y se descartan respuestas tardías; las consultas simultáneas de las ventanas comparten petición.
- Social organiza amigos e invitaciones en tarjetas de pergamino, sin cabecera ornamental grande: el total de amigos incluye los conectados entre paréntesis, junto al contador de solicitudes recibidas. Personaje y ubicación tienen etiquetas explícitas y comparten una fila en escritorio. Los amigos conectados aparecen primero y cada grupo se ordena por nombre de cuenta; las solicitudes recibidas y enviadas se muestran en columnas en escritorio y apiladas en pantallas pequeñas. El contenido largo tiene desplazamiento sin tapar los controles. El refresco periódico no desactiva botones ni reconstruye secciones sin cambios, conservando borradores y foco sin parpadeos.
- Las pestañas **Amigos** y **Grupo** se pueden seleccionar con clic o flechas. Al abrir Social estando en un grupo se selecciona Grupo por defecto. Los botones de los menús muestran sus teclas **Esc** y **Tab**.
- `npm run test:world` comprueba el flujo entre dos cuentas, susurros, presencia, eliminación, cierre durante carga y el fénix del título Reina. `npm run test:world:db` comprueba permisos, consentimiento, privacidad, límites y autorización del título mediante fixtures con rollback.
- Al acercarte a otro jugador (hasta 2,3 m), el aviso de interacción muestra su nombre. **E** abre un selector horizontal con iconos: **←/→** (o **A/D**) eligen y **E/Enter** ejecutan; también se puede pulsar un icono. **Esc/Tab** lo cierra. Compite por distancia con las interacciones de NPCs y objetos para conservar la acción más cercana.
- La ventana usa un marco de pergamino y medallones con ilustraciones SVG propias (escudos, carta con pluma y campanas). La acción seleccionada se destaca con relieve, un rombo y una etiqueta; respeta movimiento reducido y se adapta a pantallas desde 320 px.
- El selector permite enviar/aceptar/cancelar solicitudes, eliminar a un amigo con confirmación, preparar un susurro a su cuenta e invitar a grupo. Solo los no amigos muestran silenciar/reactivar chat: es local al navegador y comparte la misma lista que `/ignore` y `/unignore`, sin afectar al otro jugador ni al servidor.
- El selector se cierra si el jugador se aleja, desaparece o sales del mundo. Comprueba el estado de amistad antes de ejecutar para que una opción antigua de cancelar no elimine una amistad recién aceptada. Las respuestas tardías no reabren el selector.

### Grupos

- Hasta **4 personajes** conectados. Solo el líder puede invitar, desde la interacción con otro jugador o por nombre de cuenta en **Social → Grupo**. La otra persona debe aceptar o rechazar; las invitaciones caducan a los 90 s y se anuncian con alerta y exclamación en Social.
- Social muestra integrantes, clase, nivel, vida, maná/estamina, líder, invitaciones pendientes y la opción de salir. Bajo tu HUD aparecen tarjetas compactas de los otros integrantes; el líder lleva una corona. Los compañeros del mismo mapa se marcan en el minimapa en azul, o dorado si lideran el grupo.
- La pestaña Grupo usa un escudo de expedición, cuatro rombos de ocupación, sellos de bonificación y tarjetas heráldicas en dos columnas (una en móvil), con invitaciones en forma de carta. El campo de cuenta incluye el prefijo `~`. Las tarjetas del HUD son de hasta 174 × 44 px (150 px de ancho en móvil), conservando clase, nombre, nivel, corona y ambas barras.
- Al salir del grupo o del mundo se abandona el grupo. Una desconexión sin salida limpia la pertenencia al caducar la presencia (15 s). Si sale el líder, le sucede el siguiente integrante por orden de entrada. Cambiar de personaje no conserva la pertenencia.
- Con al menos dos integrantes hay **+2 % de experiencia fijo**, independientemente del tamaño; vida y maná/estamina máximos aumentan **1,5 % por compañero**, sin contarse a uno mismo: +1,5 %, +3 % o +4,5 %. Se redondean los máximos hacia abajo. Un grupo de una sola persona no tiene bonificación. Actualmente la única fuente de XP es `debug_xp`: concede 204 en grupo y 200 a solas.
- La pestaña de chat **Grupo** y los comandos `/p`, `/grupo` o `/party` envían mensajes privados al grupo. El servidor limita cada mensaje a sus destinatarios originales que sigan perteneciendo al grupo; los nuevos integrantes no pueden consultar mensajes anteriores. No genera bocadillos públicos.
- `party_state`, `party_invite`, `party_respond` y `party_leave` validan consentimiento, liderazgo, presencia y capacidad en el servidor; las mutaciones se serializan. El cliente consulta el estado cada 2 s y descarta respuestas de sesiones anteriores. `partyPeers` es un dato transitorio calculado por el servidor, no una bonificación guardada ni un valor confiado al cliente.
- `npm run test:world` prueba cuatro cuentas aisladas, invitaciones, pestaña predeterminada, HUD, minimapa, chat privado, salida y relevo. Las pruebas SQL con rollback comprueban además permisos, límite de cuatro, caducidad de presencia, privacidad y fórmulas de bonificación.

Tecnología: Three.js + TypeScript + Vite.

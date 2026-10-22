# Combate: primera base de desarrollo

La iteración de armas de categorías 0 y 1 está descrita en [WEAPONS.md](WEAPONS.md): poder por item, guardia, curación por equipo, modelos propios y selector de categoría en el banco de combate. Sus cambios de SQL están preparados en el repositorio y requieren aplicación antes de publicar el cliente.

## Estado real

Se han implementado el catálogo de kits iniciales, su entrega desde
`create_character` y la representación del equipo en el personaje compartido
`Character`. El equipo ocupa `weapon` y `offhand`, no la mochila, y no cambia
la ropa de novato. No se entrega a personajes antiguos al entrar.

El SQL no se aplica automáticamente. El 19 de octubre de 2026 se aplicó a
Brumaluz con autorización expresa. El mismo día se autorizó activar
`welcome_enabled` y `combat_enabled` tras validar el sistema de habilidades.
Las banderas se habilitan explícitamente en la configuración desplegada;
reaplicar el SQL conserva su valor. No se migran personajes antiguos.

La ampliación del libro con iconos propios, tooltips detallados y progresión
por rangos se publica con autorización del 19 de octubre de 2026, aplicando el
SQL actualizado antes del cliente. Las pruebas en la base configurada se
ejecutan con rollback y son independientes de la aplicación persistente del SQL.

`src/data/combat.ts` conserva el balance y el resolver puro del banco local.
El SQL añade RPC de inicio/ataque y estado personal del rival,
validando presencia, posición, alcance, recargas y recursos en servidor.
La conversación de Isberto ofrece una misión explícita que, al aceptarla, inicia
un encuentro personal en el mundo 3D, con objetivo seleccionable, aproximación,
ataque automático y habilidad. Ya no hay botón de retirada.
Isberto permanece oculto e ininteractuable hasta completar la bienvenida de
Gnomi. `combat_start` y las acciones ofensivas comprueban ese estado en el servidor;
la ausencia de progreso o una fase incompleta se rechaza con `WELCOME_REQUIRED`.
Curación es personal y no requiere misión ni encuentro activo.
El cliente de prueba simula el encuentro localmente; el mundo conectado usa
los RPC autoritativos y los latidos para el daño del enemigo. Una derrota del
jugador cierra el encuentro sin presentarla como victoria sobre el enemigo.
La bandera `combat_enabled` permanece desactivada por defecto. No hay todavía
XP de combate ni recompensas monetarias. La victoria deja un cadáver con botín
y el cierre requiere recoger el botín, hablar con Isberto y seguirlo a su casa.
Recoger la esencia habilita la conversación de regreso. Nunca se debe enviar al servidor el
resultado calculado por el prototipo como daño o progreso autoritativos.

## Habilidades y objetivo fijado

- El menú de personaje incluye **Habilidades** (`K`), con la habilidad inicial
  aprendida de cada clase, su efecto, coste, alcance y recarga. El catálogo lateral
  selecciona el detalle, con puntos disponibles y comparación del siguiente rango.
  La ventana reserva espacio para la barra rápida y permite desplazamiento en
  pantallas pequeñas. No hay habilidades
  futuras ficticias ni puntos de aprendizaje provisionales.
- Cada habilidad tiene un icono SVG original, compartido por el libro, la barra
  y su tooltip. El tooltip detallado reutiliza el aspecto y el posicionamiento
  de los objetos, funciona con ratón y foco, y muestra el rango, efecto real,
  coste, recarga, alcance, objetivo y requisitos de la siguiente mejora.
- La barra rápida acepta objetos y habilidades; estas usan identificadores
  `skill:<id>` sin alterar el formato guardado de los objetos. La inicial entra
  en el primer hueco libre de las dos páginas, sin sustituir consumibles. Si se
  retira manualmente, no vuelve a añadirse en cada reconexión.
- Se puede arrastrar desde Habilidades a un hueco concreto, reorganizar los
  huecos, retirarlos con clic derecho o usar «Añadir a la barra rápida». La
  disposición sigue siendo privada por personaje y se conserva en el navegador.
- Las teclas `1–0` y el clic ejecutan habilidades desde la barra; `Z` cambia de
  página. La barra muestra un barrido radial de recarga, cuenta atrás con décimas
  en el último segundo y un destello al quedar lista (sin animación si se solicita
  movimiento reducido). Se actualiza el mismo nodo para conservar arrastre,
  foco y tooltips. También señala la falta de recurso o arma.
  `R` ya no tiene un atajo especial para la habilidad.
- `F` fija el enemigo visible y activa ataque automático y aproximación. También
  puede seleccionarse pulsando su modelo. El encuentro no ataca automáticamente
  al terminar la conversación con Isberto.
- El marco y el anillo identifican el objetivo fijado, que se conserva al girar
  la cámara y moverse. El movimiento manual cancela la aproximación, no la
  selección; los ataques continúan si el enemigo está al alcance. No se fuerza
  la orientación de la cámara. `Esc` libera el objetivo sin terminar el encuentro;
  no existe acción de retirada en la interfaz. El RPC antiguo `combat_stop`
  se conserva solo para compatibilidad con clientes anteriores. Muerte, salida, derrota o alejarse
  más de 35 m limpian el bloqueo.
- `combat_action` acepta identificadores de habilidades y valida que correspondan
  a la clase, además de presencia, vida, recurso, recarga y alcance. El argumento
  antiguo `skill` sigue aceptándose para clientes abiertos antes del despliegue.
  La recarga se guarda en servidor y se recupera al reconectar.

## Puntos y rangos

- Se gana **1 punto de habilidad en los niveles 2, 4, 6… 50**. El saldo se
  deriva del nivel y los rangos comprados, no de un contador que envíe el cliente.
  Los personajes existentes reconocen sus niveles ganados sin modificar misiones.
  No hay puntos de habilidad al crear un personaje de nivel 1.
- La habilidad inicial se aprende gratis en rango 1. Tiene cinco rangos:
  mejorar a 2/3/4/5 requiere nivel 2/4/6/8 y cuesta un punto por mejora.
  Los puntos sobrantes se conservan para futuras habilidades.
- El libro muestra el efecto actual y el siguiente antes de confirmar un gasto
  permanente. Cancelar no gasta nada. Un fallo del servidor se notifica y permite
  reintentar sin aparentar que se ha guardado.
- `upgrade_skill` bloquea el personaje y valida propiedad, habilidad de clase,
  rango esperado, nivel y saldo. Una petición repetida con el rango anterior
  falla, incluso si llega desde otra pestaña. El rango se guarda en
  `data.skillRanks`; los datos antiguos sin rangos equivalen a rango 1.
- `create_character` ignora puntos y rangos enviados por el cliente. El combate
  conectado calcula el efecto desde el rango guardado; nunca acepta daño ni
  rango como argumentos del ataque.

| Habilidad | Rango 1 | Rango 2 | Rango 3 | Rango 4 | Rango 5 |
| --- | --- | --- | --- | --- | --- |
| Golpe contundente | 18 | 20 | 22 | 24 | 26 |
| Descarga arcana | 18 | 20 | 22 | 24 | 26 |
| Corte doble | 2 × 8 | 2 × 9 | 2 × 10 | 2 × 11 | 2 × 12 |
| Curación | 32 | 36 | 40 | 44 | 48 |
| Disparo preciso | 19 | 21 | 23 | 25 | 27 |

Los rangos no cambian coste, alcance ni recarga. El ataque normal no tiene
rangos ni consume puntos: su daño es
`round(daño_base × (1 + 0.05 × (nivel - 1)))`. Conserva el daño inicial a
nivel 1 y aumenta gradualmente según el daño base de cada clase, sin cambiar
su cadencia ni alcance. Las habilidades no heredan este escalado del ataque
normal: usan exclusivamente la potencia de su rango.

## Kits y balance provisional

| Clase | Equipo | Alcance | Intervalo | Daño | Habilidad |
| --- | --- | --- | --- | --- | --- |
| Guerrero | Espada + escudo | 1,8 m | 1,5 s | 10 | Golpe contundente: 18 de daño |
| Mago | Bastón | 6 m | 1,8 s | 10 | Descarga arcana: 18 de daño |
| Pícaro | Dos dagas | 1,6 m | 0,9 s | 8 | Corte doble: dos impactos de 8 |
| Clérigo | Varita + libro | 6 m | 1,8 s | 11 | Curación propia: hasta 32 de vida |
| Explorador | Ballesta | 8 m | 1,7 s | 10 | Disparo preciso: 19 de daño |

El coste de las habilidades es 15/20/15/12/15 y sus recargas provisionales
6/7/4,5/6/6 segundos respectivamente. El ataque básico no consume recurso.
El ajuste baja el daño y alcance del mago para moderar su ventaja a distancia;
refuerza el ataque básico y la frecuencia de Corte doble del pícaro y,
especialmente, el ataque básico del clérigo. La
curación del clérigo ahora recupera hasta 32 de vida, cuesta menos y vuelve
antes, para que su habilidad sea útil con el daño entrante de esta prueba.
Estas cifras son la base de nivel 1 y rango 1, no canon ni balance definitivo;
no incluyen todavía escalado por atributos, defensa ni probabilidades de impacto.
Curación no requiere enemigo ni alcance y no sobrecura. Una acción rechazada
no consume recurso ni altera el estado. Las ramas futuras quedan fuera.

## Equipo y visibilidad

Los ocho objetos iniciales están en los catálogos TypeScript y SQL, con
`bound: true`, una unidad por objeto y sin venta. Los comerciantes no los
ofrecen. El servidor rechaza la venta incluso si se fuerza la petición.
La vinculación del catálogo también impide ofertarlos en intercambios.

`Character` lee los slots equipados en cualquier representación: mundo local,
jugadores remotos, retratos y vista del inventario. La vista previa de clase
del creador conserva su presentación anterior. El snapshot público incorpora
equipo para que las armas también sean visibles a otros jugadores; no publica
la mochila, monedas ni el progreso personal.

En Inventario, pulsar una pieza equipada la mueve al primer hueco libre de la
mochila y la retira del modelo; pulsar un objeto equipable de la mochila lo
equipa. Si ya había una pieza en esa ranura, vuelve al hueco origen de la mochila.
Se conservan vinculación, cantidad y tooltips. Una mochila llena impide desequipar,
sin destruir el objeto. La reconstrucción actualiza mundo, retrato e inventario;
el snapshot público actualiza también a los otros jugadores.

`change_equipment` valida propiedad, vida, pieza esperada, clase y ranura,
con el mismo orden de bloqueo que el comercio. Cada cambio invalida ambas
aceptaciones y la oferta propia, evitando intercambiar referencias obsoletas.
No se entregan armas nuevas a los personajes antiguos. Sin arma principal
de su clase no se puede atacar ni usar habilidades ofensivas; Curación sigue
permitida sin arma. Desequiparla cancela el ataque automático y el bloqueo.

La espada y el escudo de principiante fijan la referencia visual de los iconos:
ilustración artesanal de cuento, silueta reconocible en pequeño, contorno oscuro
cálido, luz superior izquierda y sombra de apoyo suave. Se dibujan sobre una
cuadrícula de 64 unidades adaptada al viewBox común de 24: acero con planos
bevelados, latón envejecido, cuero cosido y madera con veta. Los acentos verde
salvia y los detalles de remaches mantienen el aspecto humilde del equipo
inicial. El mismo SVG se reutiliza en mochila, equipo, comercio y tooltip,
sin filtros ni identificadores de gradiente que colisionen entre instancias.
Los tooltips muestran **Ligado** como un distintivo discreto con candado en
la esquina superior, en lugar de dedicarle una línea completa.

## Cadáveres y botín

La victoria conserva el modelo como cuerpo caído, sin objetivo hostil ni daño.
`E` cerca del cuerpo (o pulsar el modelo a menos de 3 m) abre un panel compacto
anclado al cuerpo, con el aspecto de un tooltip. No oscurece ni desenfoca el
mundo, mantiene el HUD visible y permite mover la cámara. Alejarse más de 3 m
cierra el panel. Abrirlo no recoge nada: otra pulsación de `E` recoge el objeto
enfocado (o el primero), y también se puede pulsar un objeto o **Recoger todo**.
Al agotarse el botín se cierra automáticamente y el cuerpo desaparece; el
estado agotado se conserva al reconectar e impide volver a saquearlo.

El encuentro guarda `instanceId`, `loot` y `looted` en el servidor. Cada derrota
de esta criatura deja una **Esencia sombría**, vinculada, no vendible, apilable
hasta 50 y no utilizable. Su descripción no revela su significado.
`loot_corpse` comprueba propiedad, vida, presencia reciente, distancia e identidad
del cuerpo, y guarda inventario y botín restante en la misma transacción,
sin cambiar la misión. El cierre narrativo usa `shadow_action`; véase
[QUESTS.md](./QUESTS.md#después-de-gnomi-isberto).
Una mochila llena no consume el botín; una repetición no lo duplica.
El formato admite varias entradas y recogida individual para futuras criaturas;
no se han inventado enemigos ni tablas de recompensas adicionales.
Los encuentros derrotados anteriores a este sistema reciben una sola vez un
cuerpo recuperable, sin reponer botín ya registrado ni reiniciar misiones completadas.

## Banco de pruebas

Con `npm run dev`, abrir `/combat.html`. Es una escena 3D en tiempo real solo
de desarrollo, sin cuenta, RPC ni recompensas. Usa `Character` con el kit de
clase, animaciones de ataque/cast, proyectiles y una sombra provisional propia.
El aspecto de esta sombra no es un diseño artístico aprobado. El registro
de impactos está plegado y solo sirve para depuración: no es combate por texto.
Elegir clase reinicia la prueba. Seleccionar rival y pulsar 1 activa ataque
automático y aproximación; 2 usa la habilidad. WASD, flechas o clic sobre el
suelo mueven al personaje e interrumpen la aproximación. También se puede
seleccionar al enemigo pulsando su modelo 3D. El enemigo persigue al jugador
al entrar en combate. El rival puede causar daño; hay muerte y reaparición
locales. El escenario es una arena limitada, no el mapa ni la pelea de la
historia. No añade la habilidad a la barra real de consumibles. El ataque
de ballesta usa provisionalmente `Interact`: el pack no incluye disparo.

En el mundo, completa la bienvenida de Gnomi: Isberto se acerca andando en una
breve escena y, al llegar junto al jugador, ofrece automáticamente la misión.
Acéptala y ve a la herrería de Isberto para
probar el encuentro de la sombra. La escena aislada
`?test&welcome&graphics=compatible` permite recorrer esa secuencia sin cuenta
ni persistencia. Los controles son `F` para fijar y atacar, `1–0` para las
habilidades asignadas, `K` para Habilidades y `Esc` para soltar objetivo.
El modelo de la criatura es provisional.

### Regeneración gradual del prototipo

- Vida: 1 % del máximo por segundo fuera de combate y, provisionalmente,
  0,25 % en combate. Se considera fuera tras cinco segundos sin atacar,
  usar habilidad o recibir daño.
- Maná: 2 % del máximo por segundo. Estamina: 4 %, también en combate.
- Conserva fracciones entre pasos, limita al máximo y nunca revive ni
  genera sobrecuración. No acumula tiempo desconectado o con pestaña oculta.

El prototipo local demuestra estas tasas sin autoridad de cliente. El
servidor también las calcula desde la concesión de presencia, conserva las
fracciones y devuelve las estadísticas propias en los latidos del mundo.
Cuando se habilite el RPC, las acciones autorizadas marcan `combat_at` y
activan la tasa lenta de vida durante los cinco segundos posteriores al último
golpe, habilidad o daño recibido. Los cambios de `supabase/server/` están
aplicados a Brumaluz; el encuentro sigue protegido por `combat_enabled`.

`npm run test:combat` comprueba los cinco kits, vinculación, impactos,
curación, recursos, alcance, recargas, muerte, regeneración fraccional,
entradas inválidas, rangos, puntos por nivel, escalado del ataque e inmutabilidad.
Incluye navegador con desplazamiento del
actor 3D, aproximación, acciones por clase y movimiento manual.
Las pruebas SQL adicionales en `test-world-db.mjs` requieren una base de pruebas
o permiso explícito para usar la configurada con rollback.

## Trabajo pendiente

El encuentro conectado no concede XP ni pelines; su recompensa material es la
esencia; el encargo termina dentro de la casa de Isberto, donde presenta la
cama y el cofre del banco. Gnomi vuelve a la plaza del pozo. Ninguno reconoce
la criatura y el misterio queda abierto.
Falta el arte definitivo
de la criatura. Las pruebas SQL ya pasaron en Brumaluz dentro de una transacción
con rollback antes de aplicar el archivo. No habilitar la bienvenida ni el
combate sin autorización, ni inventar recompensas o desbloqueos de historia.

# Misiones: primera implementación

El canon se mantiene en [LORE.md](./LORE.md). El guion, el aspecto de Gnomi y la
posición del distintivo de esta versión son una presentación de desarrollo
para probar los sistemas. Su activación pública se autorizó el 19 de octubre
de 2026 junto al combate y las habilidades iniciales.

## Activación y personajes anteriores

- `server_config.welcome_enabled` se crea como `false`; reaplicar el SQL
  conserva su valor existente. La activación pública autorizada pone esta
  bandera y `combat_enabled` en `true`.
- Mientras siga desactivado, crear personajes no les añade la bienvenida y
  el RPC `welcome_action` rechaza acciones. No hay un bypass de administrador
  que permita modificar el progreso de personajes reales.
- Después de aprobar la presentación, la activación debe hacerse de forma
  explícita en el servidor. Solo `create_character` añade entonces
  `welcome: { origin: null, stage: 'available' }`, ignorando cualquier
  progreso enviado por el navegador.
- Los personajes anteriores no se migran ni reciben la misión retroactivamente.
  La ausencia de `welcome` significa que están exentos, no que deban empezarla.
- El diario aparece en el menú de personajes elegibles. `J` permite abrirlo;
  los personajes sin misiones ven un estado vacío.

## Progreso y acciones

Los datos se guardan dentro de `characters.data.welcome` y se conservan por
las acciones existentes del personaje.

| Fase | Acción válida | Resultado |
| --- | --- | --- |
| `available`, sin origen | `origin`, índice 0–2 | Guarda definitivamente el motivo de su raza |
| `available`, con origen | `accept` | Pasa a `active` y comienza el acompañamiento |
| `active` | `collect` | Pasa a `found`; guarda la posesión del distintivo |
| `found` | `claim` | Pasa a `completed`, entrega 40 XP y 5 pelines |

No existe acción de abandono, reinicio ni modificación del origen confirmado.
El distintivo se representa mediante la fase `found`, no como un objeto de
inventario. No ocupa huecos, no se vende y no puede ofertarse en un intercambio.

`welcome_action` bloquea la fila del personaje mediante `game_lock_character`,
valida propiedad, personaje vivo, presencia reciente y ubicación en Brumaluz.
Elegir origen y aceptar requieren estar junto al puesto inicial de Gnomi;
recoger requiere proximidad al distintivo en la posición del servidor.
La entrega requiere haberlo recogido y seguir conectado: Gnomi es un
acompañante personal móvil, no un NPC con posición compartida.

El servidor no acepta cantidades de recompensa ni fases enviadas por el
cliente. Entrega y cambio a `completed` se guardan en la misma transacción:
peticiones repetidas u obsoletas fallan sin volver a pagar. La experiencia
respeta la curva y el nivel máximo; la recompensa acordada es fija, no se
multiplica por estar en grupo.

`game_require_welcome_complete` es el requisito interno para contenido
posterior. La XP de depuración ya lo utiliza para personajes elegibles.
El encuentro con Isberto exige además que `welcome.stage` sea exactamente
`completed` tanto al mostrar/interactuar con el NPC como al iniciar o ejecutar
acciones de combate en el servidor. La ausencia de progreso no desbloquea este
encuentro. Las futuras misiones o accesos que hagan avanzar la historia deben
invocar el requisito correspondiente: no basta con ocultar sus botones.
Pasear, hablar con otros NPC, abrir menús o usar los servicios existentes no
quedan bloqueados.

## Interfaz y acompañamiento

- Los diálogos admiten acciones asíncronas: desactivan las respuestas mientras
  esperan, no avanzan si la acción devuelve `false`, muestran errores y
  descartan continuaciones de una conversación cerrada o reemplazada.
- Elegir la respuesta inicial guarda el motivo directamente, sin una segunda
  confirmación; la conversación espera al servidor antes de ofrecer la misión.
  El motivo permanece guardado, pero no se muestra como texto de relleno en
  el diario. Este organiza la misión por contacto, pasos, objetivo actual y
  recompensas visuales separadas de experiencia y pelines.
- `questItems` deriva los objetos de misión del progreso autoritativo.
  El distintivo aparece solo durante `found`, en una sección independiente
  del inventario y en el diario. No se inserta en `inventory`, no cuenta para
  la capacidad de mochila y no admite uso, arrastre, venta ni intercambio.
  Se conserva al reconectar y desaparece al entregarlo. Ambas vistas comparten
  ilustración, nombre, misión asociada y tooltip.
- La misión obligatoria se sigue automáticamente; su marcador exacto se
  muestra en el minimapa y, cuando entra en cámara, sobre el objetivo. Si queda
  fuera del encuadre, una flecha en el borde de pantalla señala su dirección
  y conserva la distancia, también si está detrás de la cámara. Se oculta
  junto al resto de indicadores durante diálogos, menús y muerte.
- El rastreador incluye encabezado con acceso al diario, objetivo y progreso
  por pasos. Su botón minimiza o expande el contenido en el mismo lugar,
  sin abrir el diario ni desactivar la guía del mundo. La preferencia se
  conserva en el navegador y los controles admiten teclado y traducción.
- Los nodos de diálogo pueden incluir una tarjeta `quest`: título, objetivo,
  XP, pelines y modo de oferta o entrega. Se presenta en un panel propio,
  separado de las palabras del NPC, con botones de aceptar/completar y salir.
  Salir de la oferta no la acepta, no abandona el progreso y no modifica el
  motivo guardado. Las conversaciones normales no muestran tarjeta de misión.
  Aceptar y completar usan una marca de verificación; la tarjeta omite la ayuda
  redundante «E · Elegir». Las recompensas del diario muestran icono, cantidad
  y nombre sin las leyendas explicativas de experiencia y monedero.
- El encabezado del encuentro muestra nombre y subtítulo/oficio del NPC
  (la misma identidad usada en el marco de objetivo). El encuentro oculta
  temporalmente chat, minimapa y acceso rápido para dejar libre la escena.
- Al hablar con un NPC, ambos se miran y la cámara encuadra a la pareja en
  el espacio que deja libre el diálogo, también al cambiar de nodo o tamaño
  de pantalla. No cambia el zoom ni el giro guardados de exploración.
  Al cerrar se restaura la orientación del NPC y vuelve suavemente la cámara
  de juego. Las interacciones sin interlocutor, como el pozo, no usan este plano.
- El plano busca líneas de visión despejadas para los cuerpos de ambos
  interlocutores, incluyendo edificios, faroles y otros personajes como
  obstáculos (no hierba, flores ni partículas). Al completar la bienvenida,
  Gnomi espera a terminar su agradecimiento antes de reanudar el seguimiento.
- Gnomi y el distintivo son actores locales. No entran en `world_players`,
  no se transmiten a otros usuarios y no compiten entre jugadores.
- El cuerpo de Gnomi reutiliza `Character` y el rig KayKit de 41 huesos:
  cabeza modular dulce, barba clara y el vestuario independiente `helpers`
  (peto azul, camisa clara, botas y gorro rojo nuevo sin ala). Las piezas
  sustituyen las regiones cubiertas del traje inicial; no se superponen a él.
  El proceso de creación se describe en [CHARACTER-ART.md](./CHARACTER-ART.md).
  El escalado está en un contenedor externo para que las animaciones no lo
  sobrescriban. Camina/corre, parpadea y mueve la boca con el mismo sistema
  de personajes; el distintivo devuelto va unido al hueso del pecho.
- Gnomi recorre una estela de posiciones del jugador con colisiones de la
  ciudad y animación sencilla. Sigue durante `active`, `found` y `completed` por toda
  Brumaluz, espera durante diálogos y se reincorpora al volver a entrar.
  Si queda a más de 20 m, reaparece junto al jugador para evitar perderlo
  tras una corrección de posición. Tras el agradecimiento, guía al jugador
  hacia el encuentro con Isberto antes de la orientación sobre oficios.
- Hay un comentario contextual cerca del mercado. Los textos se traducen
  al español/inglés y se consideran provisionales hasta su aprobación.

## Después de Gnomi: Isberto

Solo después de devolver el distintivo aparece Isberto. El rastreador, el
minimapa y la flecha de borde pasan a señalar al granjero. Su tarjeta ofrece
**Una sombra entre el ganado**: investigar a la criatura, derrotarla y examinar
sus restos. Salir del diálogo no acepta la misión ni crea un enemigo.
Aceptar llama a `combat_start`, que guarda `shadowQuest: active` junto al
encuentro personal. No hay recompensas ficticias de XP ni pelines en la tarjeta.

La victoria cambia la fase a `defeated`; el objetivo pasa al cadáver. Abrirlo
no completa la misión: hay que recoger su **Esencia sombría**, un objeto real de
mochila cuyo significado todavía no conocemos. `loot_corpse` cambia la fase a
`completed` solo cuando no queda botín y conserva el cuerpo vacío al reconectar.
No se puede reiniciar un encuentro completado ni sustituir un cadáver con
botín pendiente. Si el jugador muere, Isberto permite volver a investigar.
El diario conserva por separado la bienvenida y el encargo de Isberto;
al completarlos ambos se ocultan el rastreador y su guía de objetivo.

El acompañamiento consume los puntos alcanzados de la estela antes de mover,
mantiene la animación entre segmentos y gira según el desplazamiento resuelto
por colisiones. Durante un diálogo Gnomi descansa sin deslizarse.

## Validación de desarrollo

No se debe activar la bandera en producción para hacer pruebas.

- `npm run build`
- `node --test --test-name-pattern="welcome systems" scripts/test-world.mjs`
  prueba el recorrido completo con RPC simulados, errores, espera asíncrona,
  origen confirmado, acompañante privado, diario adaptable, recarga y entrega.
- `node scripts/test-world-db.mjs --configured` verifica los RPC reales dentro
  de una transacción que acaba en rollback, incluida la activación temporal,
  creación de personajes, permisos, distancia, estados, persistencia y pago
  único. Requiere autorización para usar la base configurada.
- `?test&welcome&graphics=compatible` permite ensayar la secuencia de Gnomi e
  Isberto sin cuenta, en la escena simple de desarrollo. No escribe datos ni
  activa la bienvenida real; no conserva el progreso al recargar.

Las coordenadas de `WELCOME_START` y `WELCOME_BADGE` en `src/data/quests.ts`
deben coincidir con las comprobaciones de `welcome_action` en
`supabase/server.sql`. Son posiciones provisionales del mapa actual.

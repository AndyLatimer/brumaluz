# Misiones: primera implementación

El canon se mantiene en [LORE.md](./LORE.md). El guion, el aspecto de Gnomi y la
posición del distintivo de esta versión son una presentación de desarrollo
para probar los sistemas, no una bienvenida aprobada para publicación.

## Activación y personajes anteriores

- `server_config.welcome_enabled` se crea como `false`; reaplicar el SQL
  conserva su valor existente.
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
Las futuras misiones o accesos que hagan avanzar la historia deben invocarlo
también: no basta con ocultar sus botones. Pasear, hablar, abrir menús o usar
los servicios existentes no quedan bloqueados.

## Interfaz y acompañamiento

- Los diálogos admiten acciones asíncronas: desactivan las respuestas mientras
  esperan, no avanzan si la acción devuelve `false`, muestran errores y
  descartan continuaciones de una conversación cerrada o reemplazada.
- El motivo tiene una confirmación explícita. El diario muestra el motivo,
  objetivo, recompensa y, cuando procede, el distintivo pendiente de devolver.
- La misión obligatoria se sigue automáticamente; su marcador exacto se
  muestra en el minimapa y, cuando entra en cámara, sobre el objetivo.
- Gnomi y el distintivo son actores locales. No entran en `world_players`,
  no se transmiten a otros usuarios y no compiten entre jugadores.
- Gnomi recorre una estela de posiciones del jugador con colisiones de la
  ciudad y animación sencilla. Sigue durante `active` y `found` por toda
  Brumaluz, espera durante diálogos y se reincorpora al volver a entrar.
  Si queda a más de 20 m, reaparece junto al jugador para evitar perderlo
  tras una corrección de posición. Al completar, vuelve a su puesto.
- Hay un comentario contextual cerca del mercado. Los textos se traducen
  al español/inglés y se consideran provisionales hasta su aprobación.

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
- `?test&welcome&graphics=compatible` permite ensayar la interfaz sin cuenta,
  en la escena simple de desarrollo. No escribe datos ni activa la bienvenida
  real; no conserva el progreso al recargar.

Las coordenadas de `WELCOME_START` y `WELCOME_BADGE` en `src/data/quests.ts`
deben coincidir con las comprobaciones de `welcome_action` en
`supabase/server.sql`. Son posiciones provisionales del mapa actual.

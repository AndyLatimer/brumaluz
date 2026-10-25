# Combate de introducción

La sombra de Isberto guía cuatro lecciones: fijar y golpear, usar la habilidad de clase, moverse para evitar ataques y registrar los restos. La guía reconoce acciones confirmadas; no bloquea el daño ni la continuación de la historia. Para clérigos, Curación se explica cuando falta vida.

Los enemigos normales se atacan con F o clic, sin una interacción «Enfrentarse a…». Cada muerte conserva la experiencia, las monedas y el botín que concede el servidor. Solo aparece un pequeño texto flotante de EXP y una entrada numérica en el registro de combate: no hay aviso de victoria, pasos de misión ni ventana que se abra al matar. Varias muertes recibidas juntas agrupan el texto y los snapshots repetidos no lo duplican; los cuerpos siguen disponibles mientras se combate con otros enemigos.

La sombra tiene 110 de vida y alterna una zona evitable con dos ataques normales. La zona fija un círculo de 1,6 m durante 1,4 segundos y causa 9 de daño base. Los ataques normales son golpes de 6 de daño a menos de 2,2 m o descargas dirigidas de 5 de daño hasta 12 m; moverse dentro del alcance no anula una descarga, pero la cobertura sí. La recuperación entre ataques es 1,8 segundos. Antes del primer contacto solo inicia la agresión a 2 m. Las reglas salen de `shadowCombat.json` y el generador las incorpora al servidor; el modo local usa la misma tabla.

La cinemática presenta a Isberto contando cómo encontró a la criatura y cómo dañó la puerta al intentar espantarla. El panel de ayuda se titula «Tutorial de combate» y sigue la tecla asignada realmente a la habilidad, incluso en la segunda barra. Las instrucciones de esquiva se reservan para las zonas evitables.

Los ataques cercanos alternan corte diagonal, corte horizontal y estocada. La habilidad fuerte usa un tajo distinto. Las habilidades tienen una preparación breve, los proyectiles llegan antes del daño mostrado y la recuperación respeta la duración de cada clip. La sombra muestra el impacto sin perder la preparación de su siguiente ataque. Los efectos reutilizan geometrías y limitan su número.

Las recargas se predicen al lanzar la habilidad y se confirman con el servidor. Las muestras viejas no borran una habilidad pendiente ni reinician un temporizador ya confirmado; los relojes desajustados del ordenador no afectan a las muestras relativas del servidor.

La selección usa las colisiones del mapa con un índice espacial y pruebas de altura. No recorre las mallas de toda la ciudad al mirar un enemigo. Los marcadores de NPC no actúan como paredes. La sombra conserva su brillo mediante materiales emisivos, sin añadir luces que cambien las variantes de los materiales del escenario; el humo usa menos cálculos y una sola cara.

Soltar el objetivo cancela una preparación que todavía no se ha enviado al servidor. El alcance y la visión se vuelven a comprobar al impactar. Las respuestas ya enviadas conservan su resolución autoritativa. La preparación enemiga resiste las reacciones de impacto y el modelo se restablece al reiniciar un encuentro.

## Validación

- `npm run test:combat:intro`: animación, visibilidad, selección sin raycasts de escenario, tutorial hasta el botín, esquiva, cancelación, habilidades de las cinco clases y muertes normales sucesivas con botín sin anuncios ni interrupciones.
- `node --test scripts/test-story.mjs`: rutas y continuidad de historia.
- `npm run test:combat:balance`: utilidad real de los siete atributos por clase, topes de cadencia y defensa y estimaciones de tiempo contra cada monstruo inicial.
- `node --test scripts/test-combat-sql-local.mjs`: paridad de fórmulas en 40 configuraciones de clase/atributos, ataques dirigidos, cobertura y esquiva en PostgreSQL aislado. Usa `PGLITE_TEST_MODULE` o una instalación temporal de PGlite en `brumaluz-combat-sql-tools`; se omite si no existe, sin conectarse a la base configurada.
- `npm run build`: generación, tipos y distribución.
- Las pruebas de `scripts/test-combat-engagement-db.mjs` y `scripts/world-db/story-combat.mjs` incluyen la nueva preparación y su resolución. Requieren una base de pruebas; no se debe usar la base configurada sin autorización.

## Servidor

Las reglas de atributos están en `19-rpg-foundation.sql`; la sombra, en `06-world-presence.sql` y su variante generada `21-rpg-combat.sql`; la curación de aliados, en `22-expeditions.sql`. `node tools/build-rpg-server.mjs` y `node tools/build-wilderness.mjs` actualizan los resolvedores derivados y el catálogo exterior. Aplicar el SQL mediante el procedimiento habitual del proyecto antes de publicar el cliente. Hasta entonces, el servidor instalado conserva las reglas anteriores. La implementación local no implica un despliegue.

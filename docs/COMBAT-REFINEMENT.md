# Revisión del combate — 24 de octubre de 2026

**Actualización posterior:** el circuito exterior ya usa criaturas compartidas y varios enemigos simultáneos. [Reglas y arquitectura actuales](SHARED-WORLD-COMBAT.md). Las referencias y la revisión inicial de entrada/animación de este documento se conservan como historial.

## Referencias y decisiones

- [Guild Wars 2: Combat](https://www.guildwars2.com/en/the-game/combat/): movimiento durante el combate, ataques evitables y autonomía de las profesiones. Aplicación en Brumaluz: los ataques de Pompelín fijan una zona durante su preparación y comprueban la posición al impactar; moverse fuera evita el daño. No se ha añadido una voltereta ni invulnerabilidad.
- [World of Warcraft: novedades de interfaz](https://worldofwarcraft.blizzard.com/en-us/news/23876525/): selección de objetivo de acción para reducir pasos antes de atacar. Aplicación propia: agresión por proximidad y visibilidad; respuesta básica automática; una habilidad puede seleccionar e iniciar un encuentro mirando al enemigo. No es una reproducción del sistema de WoW.

Se conserva la interfaz del juego: insignia de personaje, marco de objetivo y barra de acciones. El marco enemigo oculta el recurso ficticio y muestra la preparación del ataque cuando procede. El selector de curación solo aparece para clérigos en grupo. No se añade un panel de combate individual.

## Problemas corregidos

1. **Inicio manual obligatorio:** el servidor detecta enemigos cercanos en Pompelín y comienza el encuentro con línea de visión. El personaje equipado responde con básicos, sin desplazarse automáticamente al recibir agresión. F o una habilidad permiten iniciar y aproximarse de forma explícita. La sombra de introducción también provoca respuesta automática cuando entra en combate.
2. **Pulsaciones perdidas:** una habilidad solicitada durante otra acción queda en una cola breve; se admite pulsarla hasta 350 ms antes de terminar su recarga. Fuera de alcance, conserva la intención durante tres segundos y permite aproximarse. El movimiento manual permite esquivar sin borrar la habilidad pendiente.
3. **Animación después del daño:** la animación empieza al pulsar; la petición de impacto llega después de su preparación visual. El servidor sigue validando alcance, visión, recurso y recarga. El cliente no concede daño. La respuesta no reproduce de nuevo la misma animación. Las reacciones de daño no interrumpen clips de ataque.
4. **Cadencia inconsistente:** `combatCadence.json` alimenta cliente y SQL generado. Se usa la recarga confirmada por el servidor para programar el siguiente básico. Una recuperación corta impide encadenar animaciones instantáneamente. Se conserva la separación entre cadencia del arma y habilidades.
5. **Botín y sincronización:** identificación de encuentro, revisión de respuestas, recompensa una sola vez y recogida transaccional. Al comenzar otro combate, los restos pendientes pasan a Entregas. Recoger botín no inicia silenciosamente otro enemigo dentro de esa operación.
6. **Equilibrio inicial:** el básico de principiante queda en torno a 7 de daño por segundo antes de mitigación (7,3 pícaro). Antes variaba de 5,83 a 9,33. Esto aproxima la base; no demuestra igualdad entre rotaciones, supervivencia y equipo avanzado. Véase [referencia numérica](COMBAT-BALANCE.md).

## Primer circuito exterior

Cinco enemigos en Pompelín, fuera de asentamientos y accesos inmediatos:

| Enemigo | Ataque anunciado | Recompensa material |
| --- | --- | --- |
| Saqueador | Cono frontal | Cuero y fibra |
| Salteador | Cono frontal más lento | Mineral y cuero |
| Vigía | Zona circular a distancia | Madera y cereal |
| Jabalí | Carga recta | Cuero y fruta |
| Brote mágico | Zona circular | Hierbas y hongos |

Hay experiencia, monedas para bandidos y receta verde de la clase en la primera victoria; después, probabilidad del 20 %. Materiales y recetas enlazan con el catálogo de oficios existente. La reaparición individual actual es de 90 segundos. Alejarse más de 24 m del origen rompe el encuentro; desconexiones prolongadas y muerte también lo cierran. Hay unos segundos de margen antes de otra agresión.

Los bandidos reutilizan el rig y armas del juego; jabalí y brote tienen modelos articulados generados por código. La sombra de historia conserva su modelo y encuentro originales. No se han añadido GLB de estos enemigos.

## Límites y trabajo siguiente

- La restricción inicial de un enemigo activo por personaje está retirada. Hay población compartida, varios agresores simultáneos, amenaza y recompensas por participación. Rayo puede saltar a otras criaturas válidas.
- La persecución comprueba obstáculos, pero no rodea edificios mediante navegación completa. Faltan rutas, retorno animado al origen y prevención de atasco más avanzada.
- Sigue habiendo una habilidad inicial por clase. Faltan ampliar y revisar las rotaciones aprobadas, enemigos de mayor nivel y encuentros de roles. Los conjuntos siguen siendo bonos numéricos y los encantamientos solo activan con básicos.
- Las preparaciones de zona se aplican al circuito exterior; la sombra de introducción conserva su resolución de historia.
- Faltan sesiones reales con latencia y distintos equipos: tiempo para derrotar, daño recibido, gasto de recursos y valor de curación. El informe aritmético no sustituye estas sesiones.

Compilar y aplicar SQL es necesario después de cambiar cadencias o catálogo. `tools/build-wilderness.mjs` deriva el impacto exterior del mismo resolvedor que la historia; no mantener dos fórmulas de daño por separado.

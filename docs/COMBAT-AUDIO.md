# Sonidos de combate y expresión al morir

Decisión del 26 de octubre de 2026: el combate tiene sonidos de acciones e impactos; los enemigos cierran los ojos al morir y los recuperan al reaparecer.

## Sonido implementado

- Armas cercanas: barrido de hoja, golpe con cuerpo y resonancia metálica discreta. El pícaro usa un corte más ligero; el guerrero, más grave.
- Explorador: tensión, disparo e impacto seco. Mago y clérigo: preparación, descarga y contacto con timbres distintos. Las habilidades tienen más peso que el básico; la curación conserva una respuesta cálida y breve.
- Enemigos: preparación, ataque y caída. El jabalí usa aire grave y cuerpo; el brote y la sombra, una disipación mágica. No hay fanfarria al derrotar un enemigo normal.
- El contacto cercano suena con su efecto visual. Los proyectiles suenan al llegar; la confirmación del servidor no repite ese impacto. Estos sonidos cosméticos no conceden daño.
- Los sonidos del mundo se atenúan desde 4 m y desaparecen a 24 m. La posición estéreo sigue la cámara. Los avisos y muertes se disparan al cambiar de estado, sin repetirse con cada fotograma o snapshot idéntico; entrar ante un cadáver existente no reproduce su muerte.
- Siguen el volumen general, requieren un gesto del jugador y se silencian al ocultar la pestaña. El ruido se prepara una vez, hay hasta 24 efectos simultáneos, variación ligera entre golpes y compresión de mezcla. Los nodos se liberan al terminar.

`src/world/combatAudio.ts` sintetiza los instrumentos con Web Audio, sin descargas ni servicios externos; `src/game/combatSound.ts` sitúa los sonidos en el mundo.

## Expresión de los cuerpos

Los humanoides usan dos párpados en reposo, distintos de los arcos de alegría. Se ocultan iris, pupilas y brillos; tampoco saludan o hablan al morir. Jabalí y brote sustituyen sus ojos abiertos por párpados oscuros. La sombra cierra los ojos durante los primeros 220 ms de su caída y apaga su brillo. Reiniciar o reaparecer restaura los ojos originales, sin compartir el estado entre enemigos.

## Comprobación

- `npm run test:combat:feedback`: render de audio real, niveles y colas, desbloqueo, silencio, límite de voces, liberación de nodos, cuatro rostros, ambas familias del bosque, sombra y reaparición. Incluye una sesión local del juego con respuesta retrasada, un solo impacto por golpe y llegada de proyectil.
- `node --test scripts/test-character-actions.mjs scripts/test-intro-combat.mjs`: regresión de animaciones y combate de introducción.
- `npm --ignore-scripts run build`: tipos y distribución sin regenerar el catálogo ni las posiciones del mundo.

Las muestras de escucha y capturas se guardan en `art/combat-review/combat-sounds.wav`, `combat-sounds.json`, `enemy-eyes-alive.png`, `enemy-eyes-dead.png` y `shadow-eyes-dead-gameplay.png`. Las vistas de los tres modelos aíslan la expresión al principio de la caída; la captura de la sombra utiliza el bucle del juego real. No se ha desplegado el cliente ni modificado el servidor.

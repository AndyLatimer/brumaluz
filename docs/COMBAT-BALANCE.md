# Referencia aritmética de combate

Actualizada: 25 de octubre de 2026. Generada desde las fórmulas del juego mediante `node tools/analyze-combat-balance.mjs`.

Personaje humano de nivel 1, atributos iniciales y equipo de principiante. Sin encantamiento ni conjunto. El DPS de la tabla solo corresponde a ataques básicos sin interrupciones: no incluye habilidad, defensa enemiga, desplazamiento, fallos, latencia ni preparación. No demuestra equilibrio en una partida.

| Clase | Básico | Intervalo (s) | DPS básico teórico | Habilidad, rango 1 | Recarga (s) | Coste | Vida |
|---|---:|---:|---:|---:|---:|---:|---:|
| guerrero | 10.5 | 1.5 | 7 | 19.13 | 6 | 15 | 66 |
| mago | 10.5 | 1.5 | 7 | 19.13 | 7 | 20 | 66 |
| picaro | 8.4 | 1.15 | 7.3 | 17 | 4.5 | 15 | 66 |
| clerigo | 11.55 | 1.65 | 7 | 34 curación | 6 | 12 | 66 |
| explorador | 10.5 | 1.5 | 7 | 20.19 | 6 | 15 | 66 |

## Catálogo inicial de habilidades

Desbloqueos automáticos en los niveles indicados. Cada habilidad comienza en rango 1 y puede subir hasta rango 5; el bono se aplica por impacto y rango. Cada mejora consume un punto, disponible desde el nivel 2, y requiere un nivel más que la anterior. Los costes son de estamina salvo para mago y clérigo, que consumen maná. En Curación, los valores son de sanación y no de daño.

| Clase | Nivel | Habilidad | Base por impacto × impactos | Bono por rango e impacto | Coste | Recarga (s) |
|---|---:|---|---:|---:|---:|---:|
| Guerrero | 1 | Golpe contundente | 18 × 1 | +2 | 15 | 6 |
| Guerrero | 5 | Arremetida de escudo | 13 × 1 | +1.5 | 12 | 5 |
| Guerrero | 12 | Tajo envolvente | 6 × 3 | +0.67 | 18 | 8 |
| Guerrero | 20 | Quebrantamontañas | 25 × 1 | +2 | 26 | 10 |
| Mago | 1 | Descarga arcana | 18 × 1 | +2 | 20 | 7 |
| Mago | 5 | Ráfaga de luciérnagas | 6 × 3 | +0.67 | 15 | 5 |
| Mago | 12 | Lanza de escarcha | 23 × 1 | +2 | 24 | 9 |
| Mago | 20 | Caída estelar | 31 × 1 | +2 | 30 | 12 |
| Pícaro | 1 | Corte doble | 8 × 2 | +1 | 15 | 4.5 |
| Pícaro | 5 | Danza de dagas | 4 × 4 | +0.25 | 13 | 4 |
| Pícaro | 12 | Golpe oportuno | 15 × 1 | +1 | 18 | 6.5 |
| Pícaro | 20 | Combinación sombría | 6 × 3 | +0.34 | 24 | 9 |
| Clérigo | 1 | Curación | 32 × 1 | +4 | 12 | 6 |
| Clérigo | 5 | Rayo sereno | 14 × 1 | +2 | 12 | 5 |
| Clérigo | 12 | Rayo votivo | 20 × 1 | +2 | 18 | 7 |
| Clérigo | 20 | Golpe del alba | 29 × 1 | +2 | 26 | 11 |
| Explorador | 1 | Disparo preciso | 19 × 1 | +2 | 15 | 6 |
| Explorador | 5 | Ráfaga de virotes | 6 × 3 | +0.67 | 15 | 5 |
| Explorador | 12 | Virote penetrante | 22 × 1 | +2 | 21 | 8 |
| Explorador | 20 | Disparo del horizonte | 30 × 1 | +2 | 27 | 11 |

El daño real también depende del arma, atributos, nivel y bonos de equipo; la tabla describe la base del catálogo, no el resultado final. Las cifras son una primera pasada implementada, no balance validado en juego. En particular, el valor de los ataques de varios impactos debe medirse con la duración real de la animación, y el de Curación con el daño recibido y el coste de oportunidad del clérigo.

Se mantienen las reglas acordadas: +1 % por punto del atributo principal, +2 % por nivel adicional, +2 % de vida por Corpulencia, Guardia con rendimiento decreciente y tope del 60 %, habilidades independientes de la cadencia del arma, conjuntos numéricos y encantamientos activados por básicos. El clérigo conserva su básico ofensivo para aventura individual.

Los cinco enemigos iniciales tienen 75–100 de vida y 6–8 de daño antes de Guardia. La comprobación de tiempo de derrota para personajes iniciales se limita a enemigos de nivel 1–2; los jabalíes superiores requieren contrastar su duración con la progresión correspondiente. Los ataques anunciados se evitan por posición: cono frontal, carga recta o zona circular fijada al preparar el ataque. Mantenerse dentro de la zona al terminar la preparación provoca el impacto; salir de ella lo evita sin una tirada aleatoria. La sombra de introducci?n combina zona evitable, cuerpo a cuerpo y descargas dirigidas hasta 12 m; no basta con alejarse o moverse dentro de alcance para anular estas ?ltimas. Los valores iniciales deben revisarse con partidas reales y distintas combinaciones de equipo.

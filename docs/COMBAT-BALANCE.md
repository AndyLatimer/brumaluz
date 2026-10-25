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

Se mantienen las reglas acordadas: +1 % por punto del atributo principal, +2 % por nivel adicional, +2 % de vida por Corpulencia, Guardia con rendimiento decreciente y tope del 60 %, habilidades independientes de la cadencia del arma, conjuntos numéricos y encantamientos activados por básicos. El clérigo conserva su básico ofensivo para aventura individual.

Los primeros enemigos tienen 65–90 de vida y 6–8 de daño antes de Guardia. Los ataques anunciados se evitan por posición: cono frontal, carga recta o zona circular fijada al preparar el ataque. Mantenerse dentro de la zona al terminar la preparación provoca el impacto; salir de ella lo evita sin una tirada aleatoria. La sombra de introducci?n combina zona evitable, cuerpo a cuerpo y descargas dirigidas hasta 12 m; no basta con alejarse o moverse dentro de alcance para anular estas ?ltimas. Los valores iniciales deben revisarse con partidas reales y distintas combinaciones de equipo.

# Música del ciclo horario

Cuatro composiciones originales acompañan el reloj del mundo de Brumaluz, con un motivo común en re dórico. La instrumentación busca un pueblo medieval cálido: cuerdas pulsadas, flauta de madera, arcos suaves y percusión de mano discreta.

| Hora del mundo | Pieza | Carácter |
|---|---|---|
| 05:00–08:00 | **El valle despierta** | Arpa, flauta ligera y cuerdas que entran despacio; 66 BPM. |
| 08:00–18:00 | **Senderos de Brumaluz** | Laúd de cuerdas dobles, pequeñas respuestas de flauta y pandero lejano; 78 BPM. |
| 18:00–21:00 | **El último dorado** | Registro más cálido, laúd tranquilo y frases más largas; 62 BPM. |
| 21:00–05:00 | **Luz entre las hojas** | Arpa espaciada, cuerdas suaves y amplios silencios entre melodías; 54 BPM. |

Cada pieza tiene 32 compases, entre 98 y 142 segundos. Las frases de ocho compases tienen respuestas, respiraciones y cadencias; las repeticiones posteriores incorporan variaciones de interpretación. Entre vueltas completas quedan 12–24 segundos de descanso para que se escuchen el mundo y sus habitantes.

## Comportamiento en el juego

- La selección sigue `worldHour()`, la misma hora que el cielo y las luces. No depende de la hora del menú ni del ordenador del jugador.
- Los cambios de tramo se funden durante ocho segundos, manteniendo como máximo dos arreglos a la vez.
- En interiores la mezcla se vuelve más íntima. Durante diálogos y cinemáticas baja de volumen; en combate deja más espacio a los efectos.
- **Opciones → Sonido** ofrece un interruptor de música ambiental y volumen de música independientes de aves, agua y viento. El volumen general afecta a todos.
- Se respeta el silencio elegido, la pestaña oculta y la salida de la partida. La música de los menús conserva su propio control.
- No se intenta reproducir audio antes de una interacción del jugador.

Las aves del ambiente se reservan para las horas de luz; las campanas se afinan con la música y suenan más discretas por la noche.

## Composición y rendimiento

`src/world/dayMusicScore.ts` contiene las partituras; `dayMusicVoice.ts`, los instrumentos; `dayMusic.ts`, la reproducción y las transiciones. Las cuerdas pulsadas usan síntesis de cuerda resonante; flautas y arcos emplean muestras armónicas con respiración y vibrato. No requieren archivos ni servicios de audio externos.

Las muestras se preparan entre fotogramas y se reutilizan por instrumento y octava. El contexto conserva una caché limitada, la reverberación es compartida y hay un límite de voces. El temporizador de audio es independiente del render 3D.

## Escucha y comprobación

- `npm run test:music`: partituras, audio estéreo real, picos, silencio, transiciones, visibilidad y opciones del juego.
- `npm run music:render`: genera muestras WAV estéreo de los cuatro tramos en `art/music/` usando los mismos instrumentos.
- `npm run music:render -- --full`: exporta las cuatro piezas completas.

Los WAV son archivos de escucha y revisión; el juego genera su música a partir de las partituras y las muestras en memoria.

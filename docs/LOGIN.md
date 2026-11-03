# Pantallas de acceso

## Decisiones confirmadas el 28 de octubre de 2026

- Restaurar los adornos originales del borde superior e inferior de la ventana:
  rombos dorados (`❖`), sin el medallón circular añadido después.
- Renovar el logo de **Crónicas de Brumaluz**.
- Añadir **atardecer**, recuperando el fondo cálido que antes se usaba de día.
  El cielo de la ilustración del login también debe ser de atardecer, a juego
  con el fondo exterior.
  Los tramos siguen la hora local del dispositivo, como el menú anterior:

| Tramo | Horario |
| --- | --- |
| Día | 07:00 ≤ hora < 16:00 |
| Atardecer | 16:00 ≤ hora < 20:00 |
| Noche | 20:00–24:00 y 00:00–07:00 |

La misma regla se aplica al acceso, registro, recuperación de contraseña y
selección de personajes. Se comprueba al abrir estas pantallas y cada minuto;
no hace falta recargar para cambiar de tramo. Este horario corresponde al menú:
el reloj del mundo y sus cuatro composiciones siguen sus reglas propias de
[música del ciclo horario](DAY-MUSIC.md).

## Implementación visual

El logo diseñado para esta revisión combina un farol de bienvenida, una puerta,
un libro abierto y ramas discretas, siguiendo la identidad acogedora de
[Brumaluz](LORE.md). El emblema vectorial está en
`src/assets/brand/brumaluz-emblem.svg`; el nombre usa las fuentes Cinzel del
proyecto y conserva texto accesible. Es una solución gráfica para la interfaz,
sin establecer un nuevo escudo canónico de la ciudad.

El día conserva el cielo azul y la ilustración diurna actuales. El atardecer
recupera la paleta melocotón, las montañas cálidas y el sol del fondo anterior;
la ilustración `brumaluz-login-sunset.svg` tiene su propio cielo melocotón y dorado,
con montañas iluminadas por el atardecer. La noche mantiene su ilustración,
luna y faroles. Las estrellas se reservan para la noche y se respeta la
preferencia de movimiento reducido.

El atardecer comparte el arreglo diurno existente de la música del menú.

La ilustración lateral es estática: no tiene zoom al pasar el ratón ni
animaciones internas. En escritorio la ventana mantiene su altura al cambiar
entre acceso, registro y recuperación; el formulario tiene su propio
desplazamiento, sin estirar ni mover la ilustración. En móvil se conserva
el desplazamiento de la ventana para acceder cómodamente al formulario.

## Rendimiento

Las pantallas de cuenta suspenden el bucle 3D: ocultar el lienzo mediante CSS
no evita que WebGL siga dibujando, calculando efectos y actualizando el mundo.
El bucle se reactiva al abrir el creador o entrar en partida y también se
suspende cuando la pestaña está oculta. Al volver se reajusta el tiempo del
fotograma para no acumular la pausa en el siguiente movimiento.

La música del menú y los formularios siguen funcionando durante esta pausa.
Los retratos de la selección de personajes se dibujan al generar la lista.

## Comprobación

`npm run review:login` comprueba los límites horarios y el cambio automático,
revisa acceso, registro y recuperación, y guarda capturas de los tres tramos
en escritorio y móvil en `art/login-review/`. También abre la selección de
personajes, el creador y la partida real para comprobar la visibilidad del fondo.

`npm run review:login-performance` comprueba con los modos normal y compatible
que escribir y usar los formularios no renderiza ni anima el mundo oculto,
y que el creador y la partida se reanudan. Guarda la medición en
`art/login-review/performance.json`.

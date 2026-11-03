# Pulido de juego, interacción e interfaz

La revisión de latencia, reintentos y coste SQL del 28 de octubre se detalla en
[Rendimiento de acciones y conexión](PERFORMANCE.md), con mediciones y límites.

El logo, los adornos y los tres tramos horarios de las pantallas de acceso se detallan en [Pantallas de acceso](LOGIN.md).

El sonido de armas, habilidades y enemigos, junto con los párpados de los cadáveres, se detalla en [Sonidos de combate y expresión al morir](COMBAT-AUDIO.md).

El sistema de reporte rápido de problemas con captura de pantalla (`F8`) y visor de revisión (`Mayús + F8`) se detalla en [Reporte de problemas y mejoras](BUG-REPORTER.md).

Esta pasada corrige problemas de continuidad y lectura en los sistemas del personaje, combate, introducción y avisos. `npm run test:polish` reúne las regresiones de estos sistemas; ejecuta los navegadores en serie, con cachés de Vite separadas y sin recarga automática durante las pruebas.

## Pantallas de carga

**Decisión final del 3 de noviembre:** el usuario descarta los renders, los
modelos con filtros y la propuesta pictórica generada. Pide **dibujos simples,
cuidados, sin apariencia de arte IA**. La referencia que sí encaja es la primera
pantalla de «Encendiendo los faroles de Brumaluz…», anterior a estas revisiones.

Se restaura ese arranque: fondo radial oscuro `#4a2c2a`–`#1a1012`, estrella
dorada giratoria y texto, sin ilustración ni descarga de imágenes. Las cargas
dentro del juego conservan nombre, contexto y consejos, con la misma base cálida
y oscura, un dibujo pequeño centrado y tipografía de la UI, no una lámina gigante
ni una tarjeta de menú.

Los quince dibujos de `src/assets/loading/*.svg` son trazados vectoriales
editables directamente: contornos limpios, colores planos suaves y pocos objetos
reconocibles. No contienen imágenes rasterizadas, modelos, filtros de grabado,
ruido, tramas de relleno, letras falsas ni escenas pintadas generadas.
Los detalles describen piezas concretas: asas, uniones, cierres, hojas, páginas
y herramientas. Se retiran los WebP de renders y su generador.
Son iconos ilustrados de interfaz, no planos literales ni nuevos emblemas canónicos.

En la siguiente revisión del 3 de noviembre el usuario aprueba este estilo y
pide dibujos más elaborados, no meras formas básicas. Se conserva la composición
y la UI: se trabajan proporciones, volumen con sombras planas, cantos, juntas,
herrajes, costuras y materiales, con detalles ligados al uso real de cada objeto.
Las herramientas se apoyan o guardan, los libros tienen lomo y cantos de páginas,
y las escenas conservan una silueta clara al reducirse en móvil. No se añaden
texturas automáticas, filigranas arbitrarias ni imágenes generadas.
El presupuesto por SVG pasa a menos de 6 KB para permitir este acabado.

La revisión posterior prioriza coherencia sobre cantidad de detalles: ninguna
pieza secundaria queda suspendida sin apoyo. La pluma se introduce en el tintero,
las hierbas reposan atadas en la bandeja, la lupa se apoya tumbada en el estuche
y las tenazas descansan junto al yunque. Se corrigen la construcción de la tienda,
las bisagras de la puerta, el cojín sobre el asiento y las uniones de herramientas.
Se retiran marcas de falso texto, fragmentos decorativos sin función y barrotes
que atravesaban las llamas. El estilo aprobado, el arranque y la UI no cambian.
La revisión visual se hace tanto en la colección a tamaño nativo como en las
pantallas de carga reales; las pruebas geométricas no sustituyen esa revisión.

| Carga o destino | Ilustración |
| --- | --- |
| Arranque | Pantalla original: estrella dorada y mensaje de los faroles |
| Entrada de personaje | El ambiente de su ubicación guardada, no siempre Brumaluz |
| Nuevo personaje; mundo exterior | Tienda y poste indicador |
| Regreso a personajes | Libro abierto, marcador y pluma |
| Ciudad | Puerta abierta, tejados y árbol |
| Zonas naturales; talleres de Leñador y Recolector | Dos árboles y sendero |
| Carpintería y Ebanistería | Banco con cepillo, mazo y paño |
| Herrería | Yunque sobre base de madera, martillo y cubo |
| Minería | Pico, rocas y farol |
| Alquimia | Dos frascos y ramita de hierbas |
| Encantamiento | Libro encuadernado con motivo vegetal |
| Joyería | Anillo y lupa sobre estuche |
| Sastrería | Cesta con ovillos, agujas y paño |
| Peletería | Bolsa de cuero con asa, costura y hebilla |
| Cocina | Olla tapada, cuchara y vapor |
| Casas, posada e interiores generales | Butaca, cojín, mesita y taza |
| Recuperación tras caer | Farol encendido |

La selección usa IDs estables de mapa y su `kind`, nunca nombres traducidos.
Los mapas conservan nombre, región y consejo. Los consejos alternan dentro de
cada familia; el específico del mapa tiene prioridad. No se usan capturas cenitales
del editor como ilustración. La pantalla aparece antes de cargar el módulo del
destino, para cubrir también esa espera.

El dibujo aparece con un fundido suave y halo tenue; no gira ni flota.
No se simulan porcentajes de progreso.
Movimiento reducido detiene todos estos efectos. El diseño reserva una zona
independiente para el texto en móvil y se adapta a pantallas bajas. Los textos
siguen el idioma. La carga inicial es HTML estático, visible antes de ejecutar
el juego. Los SVG son recursos locales diminutos que Vite puede incrustar en el
módulo; no se descargan imágenes de gran tamaño ni se ejecuta un renderizador
3D adicional para estas pantallas.

Se mantiene el retraso de 180 ms de los cambios de sesión, sin añadir duración
mínima a ninguna carga. Guardar misiones y preparar intercambios siguen usando
el aviso compacto y no tapan el juego. La finalización, también en caso de error,
retira el estado de carga y deja disponibles los controles.

`node --test scripts/test-loading.mjs` comprueba el HTML inicial, las familias de
dibujos y sus diferencias, colores conservados, SVG editables de menos de 6 KB
sin raster ni filtros, escritorio, móvil, orientación horizontal, idiomas,
movimiento reducido, recuperación y cargas concurrentes. Guarda capturas en
`art/loading-review/`. Las pruebas de sesión en `scripts/world/sessions.mjs`
comprueban entrada, regreso y errores en el juego.
Tras `npm run build`, `node --test scripts/test-loading-travel.mjs` entra
en la Brumaluz publicada, usa con E la puerta real de Herrería y regresa:
comprueba que aparece la fragua antes del cambio de mapa y la ciudad al volver.

## Personaje y objetos

- Usar un objeto superpone manos y torso a la locomoción, sin sustituir los pasos.
- Los gestos de recogida pueden reemplazar un reposo cosmético. Los impactos repetidos conservan su reacción y respetan el ataque en curso.
- La locomoción mide el desplazamiento tras resolver colisiones: correr contra una pared deja de reproducir pasos sin avanzar. Los cambios de ritmo conservan su fase.
- Registrar cuerpos, recoger objetos y usar estaciones orienta y detiene al personaje.
- La recolección mantiene un gesto de trabajo y cancela al desplazarse, combatir, morir o cambiar de sesión. Una respuesta tardía no continúa el proceso en otro personaje.
- Las proporciones del cuerpo reconocen los nombres de huesos normalizados por GLTFLoader.

## Combate

- Un clic selecciona y empieza a aproximarse sin esperar la red, incluso fuera del radio de inicio del servidor. Escape suelta el objetivo. No hay botones de ataque, tutorial flotante, textos de procesamiento ni barras de ataques de zona.
- Animaciones y recuperación siguen el reloj local. Ataques y habilidades tienen canales independientes con una petición pendiente como máximo por canal y un límite de cuatro segundos; una petición básica lenta no bloquea una habilidad ni acumula golpes en cola. Las recargas se leen en el propio icono.
- Una respuesta antigua no puede recuperar un objetivo abandonado, reproducir su animación sobre el nuevo enemigo ni bloquear otra sesión. Las bajas y el daño siguen siendo autoritativos del servidor.
- La presencia se sincroniza con un presupuesto de 250 ms que incluye la red, sin añadir otra pausa tras cada respuesta ni solapar consultas. Se elimina la consulta adicional de población cuando ya existe la conexión del mundo.
- Los enemigos normales golpean a un oponente y comprueban alcance/cobertura al contacto. La sombra alterna cuerpo a cuerpo y proyectil según la distancia, sin fases de área.
- La simulación exterior no se ejecuta desde mapas de ciudad ni sin observadores. El cálculo de mitigación se hace para el jugador golpeado; los ataques no vuelven a simular toda la población.
- La experiencia acumulada se lee en la barra. Un recibo agrupa experiencia y monedas de las bajas recientes, muestra cuánto falta para el siguiente nivel y se limpia al salir; las subidas de nivel tienen su celebración.
- Los objetos comparten su recarga visual y accesible. Repetir una pulsación durante esa recarga no envía más peticiones; morir bloquea su uso.
- Las actualizaciones de existencias conservan el foco del teclado en la barra.
- El panel de objetivo conserva su emblema durante las actualizaciones de vida. Los recursos vacíos tienen medidores válidos; los enemigos muestran vida sin rótulos de acciones.
- Los números de daño tienen separaciones pequeñas, formato local y respetan el movimiento reducido. Los efectos usan menos partículas en modo compatible y comparten geometrías.
- Salir de la partida cancela preparaciones y predicciones locales y retira efectos y números pendientes.
- Repetir una muestra de recarga con la misma revisión no puede alargar la espera.

## Pantallas pequeñas

- La barra conserva sus diez accesos en dos filas, con recargas legibles.
- Vida y recursos dejan sitio para los tres menús superiores.
- Chat y minimapa se colocan por encima de la zona de acciones. El chat comienza compacto si no hay una preferencia guardada; abrirlo sigue siendo una elección del jugador.
- Las indicaciones de habilidad y los controles de combate reservan espacio para poder leerse sin taparse.

## Introducción y cinemáticas

- Cancelar o reemplazar una escena limpia su niebla, rutas de personajes y representaciones temporales.
- Las continuaciones de escenas antiguas no pueden terminar una escena nueva. Al abrir diálogo la cámara cede en ese mismo fotograma.
- Saltar funciona con ratón, Escape, Enter y Espacio, con foco recuperable y sin perder la continuidad de la bienvenida.
- El relato de Isberto deja más tiempo para leer y usa subtítulos más legibles.
- Recargar el módulo retira el controlador anterior y sus escuchadores.

## Avisos

- Una sola cola ordena avisos, amistades, misiones, recompensas y errores. La gravedad forma parte de la identidad del aviso.
- La deduplicación también protege el historial del chat.
- El tiempo de lectura usa el texto traducido y sus valores. Se pausa al leer con ratón/teclado y durante conversaciones, cinemáticas o pestañas ocultas, según el tipo de aviso.
- El cierre es accesible; un aviso largo puede desplazarse en una pantalla baja.

Las pruebas de combate mantienen la distinción entre la historia y los enemigos normales: los monstruos dan experiencia y botín sin anuncios de victoria ni diálogos que interrumpan la lucha.

# Pulido de juego, interacción e interfaz

El sonido de armas, habilidades y enemigos, junto con los párpados de los cadáveres, se detalla en [Sonidos de combate y expresión al morir](COMBAT-AUDIO.md).

Esta pasada corrige problemas de continuidad y lectura en los sistemas del personaje, combate, introducción y avisos. `npm run test:polish` reúne las regresiones de estos sistemas; ejecuta los navegadores en serie, con cachés de Vite separadas y sin recarga automática durante las pruebas.

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

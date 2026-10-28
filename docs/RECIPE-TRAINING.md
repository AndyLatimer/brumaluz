# Recetas: maestros, precios y botín excepcional

27 de octubre de 2026. Cambio solicitado antes de continuar el equilibrio: las recetas se compran a los maestros de oficio, no desde el menú de profesiones, y cuestan mucho más. El usuario concreta la excepción: las mejores recetas siguen siendo botín muy raro. La implementación reserva esa excepción a **Gran maestro, calidad naranja**.

## Compra y aprendizaje

La conversación de cada maestro de fabricación incluye **Comprar recetas**. Se elige rango y receta y se confirma el coste antes de pagar. **Comprar entrega un pergamino consumible en la mochila; no enseña la receta automáticamente.** Se aprende de forma permanente al usar ese objeto desde el inventario, consumiendo una copia. Las páginas muestran las recetas que todavía no conoce, con navegación por rango y páginas de cinco entradas. Minero, Leñador y Recolector no venden una receta por cada recurso.

El libro de profesiones permite consultar todas las recetas, cantidades y fuentes de materiales y fabricar las ya aprendidas. No tiene botones para comprar ni aprender. Los bancos y estaciones domésticas sirven para fabricar, no para comprar recetas.

Precios iniciales para concretar el incremento pedido, sujetos a ajuste de ritmo:

| Rango | Calidad | Precio por receta |
| --- | --- | --- |
| Aprendiz | Gris | 50 Pelines |
| Iniciado | Verde | 250 Pelines |
| Oficial | Azul | 1.250 Pelines |
| Experto | Morado | 6.250 Pelines |
| Maestro | Dorado | 25.000 Pelines |
| Gran maestro | Naranja | No se vende: exige pergamino excepcional |

Las preparaciones de cuero siguen la misma regla. Las cuatro primeras se compran al maestro; la de Gran maestro requiere su pergamino. No se cambian las recetas ya aprendidas ni se cobran diferencias retroactivas.

La RPC `rpg_action` usa `buy_recipe`: comprueba maestro, mapa, proximidad de 3 m a su posición publicada, rango, saldo, receta no conocida y espacio en la mochila. El precio procede del catálogo del servidor; la confirmación debe coincidir con ese precio para rechazar ofertas antiguas. Si falta espacio o saldo, no se cobra ni se aprende. Se conservan los recibos y la revisión del oficio. La acción anterior `learn` se rechaza.

`use_recipe` valida la casilla, el identificador del objeto y su copia cuando se proporciona, el dominio del oficio y que la receta no esté aprendida. Consume solo la copia seleccionada y añade el aprendizaje en la misma operación. No requiere estar junto al maestro ni una estación; exige presencia en el mundo, estar vivo y fuera de combate. Una receta conocida, una casilla desactualizada o rango insuficiente conservan el objeto. Comprar y usar son operaciones separadas con protección frente a reintentos.

La proximidad se comprueba respecto al NPC maestro, no al banco de trabajo ni a un mueble doméstico. El servidor no pretende verificar cómo dibuja su interfaz un cliente externo: valida identidad del maestro y presencia real cerca de él.

## Recetas excepcionales

- Solo las de rango Gran maestro tienen origen `drop`. El catálogo actual contiene **79**: las 78 anteriores de ese escalón y la preparación de cuero de Gran maestro.
- Probabilidad inicial: **0,5 % por recompensa personal de una baja elegible**, de criaturas de **nivel 26 o superior**. No hay receta garantizada en la primera victoria ni contador de compensación.
- La selección se realiza entre todas las recetas excepcionales, con independencia de la clase del jugador; el pergamino puede comerciarse antes de aprenderlo.
- Los enemigos normales de nivel bajo y la recolección ya no proporcionan recetas de otros rangos. La recolección conserva los núcleos raros de restauración. Los proyectos de maestría siguen ascendiendo de rango, pero ya no enseñan gratuitamente una receta.
- El maestro no vende las excepcionales. Su pergamino se usa desde la mochila y exige rango Gran maestro, igual que los demás consumibles exigen su rango. Tener Pelines no sustituye al objeto.
- Se conservan los IDs y objetos de los pergaminos anteriores. Ahora todos son consumibles válidos, incluidos los de rangos inferiores guardados en cuentas. No se destruyen objetos ni recetas conocidas. El catálogo contiene un pergamino para cada una de las **441 recetas**, también Aprendiz y las preparaciones de cuero.
- Se adapta también el resolvedor de recompensas de las expediciones retiradas para evitar que su antigua RPC eluda la rareza. Esto no vuelve a habilitar expediciones en el cliente.

El 0,5 % es una tirada por personaje elegible, no por golpe ni por material del botín. La esperanza es una receta cualquiera cada 200 bajas; unas 139 bajas dan aproximadamente un 50 % de probabilidad de haber visto alguna. No garantiza una receta concreta: con selección uniforme entre 79, la esperanza para una específica es de 15.800 bajas elegibles. El comercio permite obtenerla de otro jugador.

## Pasada de ritmo

`node tools/review-profession-pace.mjs` genera `art/recipe-training-review/pace-report.json`. Resuelve ataques y habilidades del jugador con SQL real en PostgreSQL aislado, equipo real y reloj controlado: cinco clases frente al salteador y los cinco jabalíes nuevos, 30 combinaciones. Las pruebas de obtención comprueban además compra, recolección, fabricación y equipamiento de una mejora de cada clase sin regalar sus materiales.

Es una medición controlada: no cronometra una sesión humana, viajes, latencia, competencia por criaturas, navegación ni decisiones del jugador. La estimación de daño entrante usa cadencia y mitigación; no simula esquivas, curación o regeneración de vida y no demuestra por sí sola que un encuentro sea imposible.

Resultados iniciales:

- Pico o hacha básica (20), receta de componente (50) y primera receta verde (250): **320 Pelines**, más materiales. Partiendo de 5 Pelines, equivalen a 63 bajas del salteador de 5 monedas si no se vende botín. Se puede vender material o comerciar; no es una obligación de matar exactamente esa cantidad.
- Contra ese salteador, a nivel 1 y con equipo inicial, el tiempo de daño medido es de unos **9 s** para cuatro clases y **14,9 s** para el clérigo, cuya habilidad inicial es curación. Multiplicar por 63 da 9,5–15,6 minutos de daño en esas condiciones fijas, sin los desplazamientos, recuperaciones, reapariciones y subidas de nivel de una partida real. No se presenta como duración total de la primera mejora.
- Preparar un cuero Iniciado tarda 2 minutos base y exige cuatro cueros básicos más dos hierbas. Fabricar toda la cadena desde cuero básico hasta una unidad de Gran maestro exige **1.024 cueros básicos, 682 hierbas y 15 h 6 min de trabajo base acumulado**, antes de fabricar el equipo. La afinidad humana reduce el tiempo, no los materiales. Es una alternativa de esfuerzo muy superior a obtener cuero del rango adecuado directamente.
- Los jabalíes de rangos altos aumentan mucho la exposición al daño. El benchmark da 58,5–141,9 s para el mayor, usando nivel 38 y equipo dorado de la clase. Estos encuentros merecen una prueba específica con esquivas, curación y cooperación antes de fijar el equilibrio final. No se han alterado atributos de clase o estadísticas de enemigos basándose únicamente en esta estimación.

Consecuencia de diseño: la receta cara es una inversión permanente de oficio, no necesariamente la forma más barata de conseguir la primera pieza. Los vendedores provisionales de equipo pueden ofrecer una pieza por menos que aprender a fabricarla. Este cambio no retira sus existencias ni impone una nueva política de vendedores sin decidirla.

## Verificación y despliegue

La continuación de esta pasada usa `npm run review:profession-session`: recorrido automatizado con movimiento y colisiones del cliente, mundo SQL completo aislado, daño entrante, recuperación, puertas, venta de botín, compra al maestro, minería y primera mejora equipada. Método, límites y corrección de reapariciones: [Recorrido de control](PROFESSION-SESSION-REVIEW.md). Es independiente del benchmark anterior de ataques; no convierte sus estimaciones en una sesión humana medida.

- `node --test scripts/test-obtainability.mjs`: compra con maestro correcto, rechazo de menú antiguo, rango, precio desactualizado, saldo, distancia, mapa, duplicados, pergamino excepcional y límites de la tirada de botín; preservación de recetas conocidas y permisos del parche.
- `node tools/review-obtainability.mjs`: conversación real de compra, confirmación a 250 Pelines en escritorio y a 390 px, ausencia de compra en el libro, fabricación, fuentes de cuero y apertura del taller en el editor. Capturas `art/obtainability-review/master-purchase-*.png`.
- `node tools/build-recipe-training-patch.mjs`: prepara un parche revisable sin tocar el servidor.
- `node scripts/apply-recipe-training-patch.mjs`: comprobación de solo lectura. `--apply` instala únicamente catálogo RPG y tres funciones de oficio/botín; conserva catálogos ajenos a esta tarea, personajes y criaturas. `--verify` comprueba contenido y permisos instalados. Guarda copia y SQL de reversión antes de aplicar.

El estado efectivo del servidor y las rutas de copia/reversión se registran en `art/recipe-training-review/deployment.json` al aplicar. El cliente debe compilarse con `npm --ignore-scripts run build`; su publicación web es independiente.

**Aplicación del 27 de octubre:** parche instalado y verificado en la base configurada: cuatro funciones, 441 recetas, doce maestros registrados y 79 recetas excepcionales. Las tres funciones de comportamiento coincidían con sus versiones anteriores revisadas antes de aplicar. Se conservaron los datos de personajes y las instancias de criaturas; no se tocaron mapas ni recursos del servidor. La comprobación detectó ocho coordenadas generadas locales sin el ajuste de colisiones que ya tenían las publicadas: se sincronizaron únicamente esas coordenadas derivadas desde el catálogo del servidor, sin editar mapas ni mover recursos en producción.

Las pruebas de SQL, la conversación real en escritorio/móvil y la apertura en el editor pasan. Copia y reversión en `art/recipe-training-review/`; `--verify` devuelve cero funciones o recetas pendientes de actualizar. El cliente se prepara en `dist/`; todavía no se publica un nuevo alojamiento web.

## Actualización posterior: recetas consumibles

El usuario concreta después que los maestros deben vender **objetos consumibles de receta**. Las reglas vigentes de compra y uso de las primeras secciones incorporan esta decisión; sustituye el aprendizaje automático y la entrega de pergaminos al maestro de la primera versión.

La actualización está aplicada y verificada con `scripts/apply-recipe-scroll-patch.mjs`: dos funciones, un consumible para cada una de las 441 recetas y 592 definiciones adicionales de objeto. Conserva precios, orígenes de botín, recetas aprendidas, pergaminos anteriores, encargos diarios y otras ramas del servidor. No modifica filas de personajes, mapas ni criaturas. Registro, copia y reversión en `art/recipe-scroll-review/`.

`npm run test:recipe-scrolls` comprueba compra sin aprendizaje, consumo de la copia seleccionada desde otro mapa, reintentos, mochila llena, rango, receta conocida, casilla desactualizada, excepcionales no vendibles y preservación del progreso. La revisión de obtención comprueba compra → mochila → uso → aprendizaje en el juego real, con capturas `recipe-in-bag-desktop.png` y `recipe-in-bag-mobile.png` en `art/obtainability-review/`. La apertura del taller en el editor sigue pasando. El cliente compila en `dist/`; su alojamiento web sigue pendiente de publicación.

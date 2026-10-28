# Talleres y maestros de oficio

26 de octubre de 2026. Primera etapa del rediseño solicitado: dar un lugar y un maestro a cada uno de los doce oficios existentes, con orientación clara. Isberto es el maestro de Herrería y conserva su papel en la bienvenida. Los otros once maestros usan títulos funcionales; sus nombres personales y biografías siguen pendientes.

Actualización del 27 de octubre: [Recetas y maestros](RECIPE-TRAINING.md) mueve la compra a la conversación con el maestro y eleva los precios. Comprar entrega un pergamino consumible en la mochila, que se usa para aprender la receta. Gran maestro exige un pergamino excepcional de botín muy raro, aprendido también desde la mochila.

Los maestros ofrecen también [Encargos diarios](DAILY-ORDERS.md): suministros básicos por Pelines con tres entregas al día compartidas entre todos los talleres. Son independientes de los proyectos de maestría y se entregan hablando con el maestro.

Tras aceptar con Gnomi [Manos a la obra](PROFESSION-TUTORIAL.md), el maestro del oficio elegido muestra Mi iniciación al oficio. Guía la práctica y recibe el cierre explícito de la misión después del suministro diario normal. El diario y los marcadores conservan el recorrido y el progreso al reconectar.

## Acceso y uso

Los doce talleres se agrupan en el **Barrio de los Artesanos**, que sustituye al antiguo Barrio de los Canteros. Se reutilizan doce edificios existentes y se conserva íntegramente el terreno, las calles y las dimensiones de Brumaluz, con puertas identificadas en mapa y minimapa. Acercarse y pulsar **E** permite entrar; la puerta interior devuelve a la misma fachada. Los portales usan interacción explícita y no devuelven automáticamente al jugador al llegar.

| Oficio | Interior del editor | Zona de la entrada |
| --- | --- | --- |
| Herrería | `taller_herreria_interior` · Forja de Brumaluz | Barrio de los Artesanos |
| Peletería | `taller_peleteria_interior` | Barrio de los Artesanos |
| Sastrería | `taller_sastreria_interior` | Barrio de los Artesanos |
| Carpintería | `taller_carpinteria_interior` | Barrio de los Artesanos |
| Ebanistería | `taller_ebanisteria_interior` | Barrio de los Artesanos |
| Joyería | `taller_joyeria_interior` | Barrio de los Artesanos |
| Alquimia | `taller_alquimia_interior` | Barrio de los Artesanos |
| Encantamiento | `taller_encantamiento_interior` | Barrio de los Artesanos |
| Cocina | `taller_cocina_interior` · Cocina de Brumaluz | Barrio de los Artesanos |
| Minero | `taller_minero_interior` · Taller de Minería | Barrio de los Artesanos |
| Leñador | `taller_lenador_interior` · Taller de Leñadores | Barrio de los Artesanos |
| Recolector | `taller_recolector_interior` · Taller de Recolección | Barrio de los Artesanos |

Cada interior tiene un único maestro (`isberto` en Herrería y `maestro_<oficio>` en los otros once), con aspecto y atuendo propios. Se carga su personaje al visitar ese taller. Isberto reutiliza su ficha y apariencia originales; dentro del taller ofrece la guía del oficio y fuera conserva sus conversaciones de bienvenida y de su casa.

Hablar con el maestro permite preguntar cómo empezar, de dónde salen los materiales, cómo funcionan los trabajos y cómo progresa el oficio. Las respuestas abren el apartado correspondiente del libro. Los pergaminos de receta se compran exclusivamente en la conversación del maestro; los excepcionales son botín. El servidor comprueba la presencia junto al NPC para comprar. Aprender consume el pergamino desde la mochila. El banco permite fabricar y recoger trabajos.

El **banco** se usa con E y abre las recetas o recursos de ese oficio. Minero, Leñador y Recolector tienen banco de consulta y proyectos, y sus recursos siguen recolectándose en Pompelín. La compra, reparación y restauración de herramientas continúa en Herrería. Las estaciones colocadas en casas siguen disponibles.

## Libro de oficios

Al elegir un oficio se abre **Guía**, con una secuencia breve: aprender o equiparse, reunir materiales, fabricar o recolectar y recoger resultados o revisar el equipo. Distingue las tareas del maestro, del banco y del campo. En Brumaluz, **Localizar taller** marca su puerta en el mapa.

Las pestañas dependen del oficio: Guía / Recetas / Trabajos / Maestría para fabricación temporal; Guía / Recetas / Maestría para Cocina y Alquimia; Guía / Recursos / Herramienta / Maestría para recolección. Los controles de cantidades, materiales, colas, maestría y utilidades se conservan. La navegación a una herramienta desde su maestro mantiene el oficio elegido.

## Mapas editables y mantenimiento

Decisión confirmada: las colecciones `brumaluz-hamlet` (Rusty Hearts) y `brumaluz-arboleda` (La Arboleda) se reservan para sus respectivas ciudades. Ninguna pieza de esos paquetes se utiliza en los doce interiores de Brumaluz. Los talleres usan Dungeon, Furniture, RPG Tools, Resource Bits, Restaurant y Mixed Bag; el mobiliario y las muestras distinguen cada oficio. La revisión añade almacenaje, semilleros, frascos etiquetados, muestras de acabado y utensilios de preparación, manteniendo libre el paso central hacia el maestro y el banco.

Los doce documentos están en `src/data/maps/` y sus versiones publicadas en `src/data/world/maps/`. Son mapas del editor con capas de arquitectura, suelo, mobiliario, muestras, luz y lógica. Usan piezas existentes de las bibliotecas y no dependen de una habitación generada al entrar.

Para editarlos, iniciar el servidor de desarrollo, abrir `/maps.html` y seleccionar el taller. Los marcadores relevantes son `maestro_<oficio>`, `banco_<oficio>`, `desde_brumaluz` y `salida_taller_<oficio>`. El marcador del banco lleva el texto `profession:<oficio>`; el juego lo reconoce como estación. Las modificaciones se guardan y publican con el flujo habitual del editor.

`tools/build-profession-workshops.mjs` prepara borradores nuevos y conserva los existentes. `--replace-generated` es una regeneración explícita que sustituye su contenido; no forma parte de la compilación normal. `tools/connect-profession-workshops.mjs --apply` guarda y publica mediante la API local del editor, conservando los objetos de la capital, y prepara sus conexiones y estaciones. Sin `--apply` solo muestra la propuesta de conexiones.

`src/data/workshops.json` registra sus accesos y estaciones. La generación del catálogo conserva esas estaciones; la generación de geometría vuelve a leer los puntos del banco publicados, sin recolocarlos como si estuvieran en una calle de Brumaluz.

El servidor configurado recibió una actualización limitada a los doce mapas, veinticuatro portales y trece entradas de estación —doce bancos y el alias de reparación de Herrería—. Se conservaron los demás mapas, permisos, contenido del catálogo y datos de personajes. Las copias de reversión y el SQL preparado se encuentran en `art/workshops-review/`.

## Comprobaciones realizadas

- Recorrido de entrada y salida de los doce talleres en el juego, maestro correcto, diálogo, banco y guía, sin errores de navegador. Paso libre desde la llegada hasta el maestro y el banco.
- Aprendizaje de recetas desde la posición de conversación con los maestros de fabricación.
- Guías en escritorio y a 390 px, con las pestañas y la barra de acciones accesibles.
- Edición y animación de las doce fichas en `/npcs.html`; apertura de los doce interiores en `/maps.html` y captura con el renderizador normal del juego.
- Validación de los doce documentos, llegadas recíprocas y coincidencia entre borradores y publicaciones.
- PostgreSQL/WASM aislado: veinticuatro portales, proximidad de cada banco, rechazo fuera del taller y conservación de estaciones domésticas y mapas anteriores.

Reproducir con `npm run review:workshops` y `npm run test:workshops`. La prueba SQL usa PGlite con la instalación temporal compartida de combate o `PGLITE_TEST_MODULE`; sin ese módulo se omite. `scripts/apply-workshop-patch.mjs` prepara por defecto un parche sin modificar el servidor; `--apply` aplica únicamente los talleres y las estaciones. Compilar conservando el contenido actual con `npm --ignore-scripts run build`.

La revisión de juego usa acciones locales de prueba; no modifica personajes reales. Las capturas y el informe están en `art/workshops-review/`. Esta etapa deja preparados los lugares y maestros del sistema; futuras misiones de aprendizaje, nombres propios, historias y una revisión amplia de progresión continúan pendientes de diseño.

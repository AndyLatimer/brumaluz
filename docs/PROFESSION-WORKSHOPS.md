# Talleres y maestros de oficio

26 de octubre de 2026. Primera etapa del rediseño solicitado: dar un lugar y un maestro a cada uno de los doce oficios existentes, con orientación clara. Isberto es el maestro de Herrería y conserva su papel en la bienvenida. Los otros once maestros usan títulos funcionales; sus nombres personales y biografías siguen pendientes.

Actualización del 27 de octubre: [Recetas y maestros](RECIPE-TRAINING.md) mueve la compra a la conversación con el maestro y eleva los precios. Comprar entrega un pergamino consumible en la mochila, que se usa para aprender la receta. Gran maestro exige un pergamino excepcional de botín muy raro, aprendido también desde la mochila.

Los maestros ofrecen también [Encargos diarios](DAILY-ORDERS.md): productos de fabricación propia por Pelines y XP del oficio, con tres entregas al día compartidas entre todos los talleres. Son independientes de los proyectos de maestría y se entregan hablando con el maestro emisor.

Tras aceptar con Gnomi [Manos a la obra](PROFESSION-TUTORIAL.md), el maestro del oficio elegido muestra Mi iniciación al oficio. Guía la práctica única y recibe el cierre explícito de la misión. Esta práctica no consume encargos diarios. El diario y los marcadores conservan el recorrido y el progreso al reconectar.

## Prácticas opcionales

Después de completar la iniciación, cada maestro ofrece una práctica breve,
disponible una sola vez por personaje y oficio. El jugador puede aceptar
prácticas de varios oficios a la vez. Cada una pide una acción normal ya
existente: fabricar y
recoger un objeto, o completar una extracción en el caso de Minero, Leñador y
Recolector. El progreso se registra al terminar la acción, no al iniciarla, y
se confirma hablando con el maestro correspondiente.

La recompensa es de **10 XP de personaje**, sin Pelines ni objetos. Las
prácticas son independientes de la iniciación, los encargos diarios y la
maestría; no requieren nuevos NPCs ni nuevas mecánicas. Se muestran en el
diario, el seguimiento y los marcadores del mundo. La implementación local está
preparada y probada; el SQL todavía no se ha aplicado al servidor ni se ha
publicado el cliente.

## Revisión de fabricación del 31 de octubre

Se confirma que iniciar una fabricación requiere una estación del oficio,
pública o colocada en casa; no es necesario quedarse junto a ella después.
Los muebles básicos pasarán a tardar minutos y los avanzados horas, y la
fabricación normal avanzará sin conexión a un tercio del ritmo conectado: una
hora de trabajo conectado equivale a tres horas desconectado. Los intervalos
de muebles conectado quedan fijados: Aprendiz 2–6 min, Iniciado 6–16 min,
Oficial 20–40 min, Experto 1–2 h, Maestro 2–4 h y Gran maestro 4–8 h, antes de
bonificaciones vigentes. Tamaño y complejidad sitúan cada modelo dentro del
intervalo, sin multiplicarlo después por fuera de sus límites. Se confirman cinco trabajos
por oficio, uno activo y cuatro esperando; no son cinco fabricaciones simultáneas
ni un cupo diario. Una posible ampliación se revisará en el futuro, sin aprobar
ahora su forma ni aumentar a diez. Al fabricar en una estación se pueden tomar
automáticamente materiales de la mochila y del banco personal. Cualquier trabajo
normal sin terminar, activo o esperando, puede cancelarse con devolución íntegra
de los materiales; no se aplica la prohibición de cancelación manual de meriendas.
Aplicado y probado localmente el 2 de noviembre, junto con los tiempos aprobados
para equipo, pergaminos y componentes; véase [Implementación de oficios](RPG-IMPLEMENTATION.md).

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

Al elegir un oficio se abre **Guía**, con tres pasos y accesos a sus recetas o recursos, trabajos o herramienta, progreso y taller. El resumen muestra las recetas aprendidas y los trabajos listos o, para recolección, la herramienta equipada. Distingue las tareas del maestro, de la estación y del campo. En Brumaluz, **Localizar taller** marca su puerta en el mapa.

Las pestañas son Guía / Recetas / Trabajos / Maestría para todos los oficios de fabricación y Guía / Recursos / Herramienta / Maestría para recolección. Cocina y Alquimia también muestran Trabajos: la comida y las pociones son instantáneas, pero algunos componentes usan la cola. Los controles de cantidades, materiales, colas, maestría y utilidades se conservan. La navegación a una herramienta desde su maestro mantiene el oficio elegido.

El buscador de recetas admite tanto el nombre mostrado en el idioma actual como el nombre original del catálogo.

Las recetas cuentan materiales de la mochila y del banco personal; los proyectos de maestría y los núcleos de restauración requieren los objetos en la mochila. Los recursos del cuaderno de campo muestran únicamente lo que se lleva encima. Una estación doméstica sirve para su propio oficio; la estación pública de Herrería también atiende las operaciones de recolección que la requieren.

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

Reproducir con `npm run review:workshops` y `npm run test:workshops`. `node --test scripts\test-profession-ui.mjs` comprueba el libro y sus diálogos en una partida local aislada, en escritorio y móvil. La prueba SQL usa PGlite con la instalación temporal compartida de combate o `PGLITE_TEST_MODULE`; sin ese módulo se omite. `scripts/apply-workshop-patch.mjs` prepara por defecto un parche sin modificar el servidor; `--apply` aplica únicamente los talleres y las estaciones. Compilar conservando el contenido actual con `npm --ignore-scripts run build`.

La revisión de juego usa acciones locales de prueba; no modifica personajes reales. Las capturas y el informe están en `art/workshops-review/`. Los lugares, maestros y prácticas opcionales están definidos; los nombres propios, las historias y una revisión amplia de progresión continúan pendientes de diseño.

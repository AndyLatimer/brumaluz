# Pompelín: mundo y bienvenida

Documento vivo del lore acordado. Las propuestas no se consideran canon hasta
que se aprueben; al cambiar una decisión, se actualiza este documento y el
contenido del juego relacionado.

## Decisiones confirmadas

- El mundo se llama **Pompelín**.
- **Brumaluz** es la capital común y punto de encuentro de regiones con
  autonomía. Cada región tiene su propio soberano. El rey de Brumaluz tiene
  una importancia superior, pero no gobierna directamente todas las regiones;
  sus competencias concretas todavía no están definidas.
- La identidad principal de Brumaluz es la acogida: vecinos de distintos
  pueblos, oficios y vida de barrio. Los faroles y la bruma, los jardines y
  los talleres complementan esa identidad, sin desplazarla.
- La magia existe, pero es discreta: la mayoría de las cosas se hacen a mano.
- La bienvenida tiene un tono acogedor y cotidiano, sin amenaza inicial.
- El comienzo debe distinguirse según la raza. A largo plazo, cada raza
  empezará en su propia región; durante esta etapa todas comienzan en Brumaluz.
  Se elige entre tres motivos de comienzo por raza, incluida la posibilidad
  de ser residente cuando encaje; se detallan más abajo.
- **Gnomi, el Gnomo**, será un NPC gnomo pequeñito que acompañará al jugador
  como guía durante sus primeros pasos. Es amable, de humor tranquilo y quiere
  ayudar con todo su empeño. Entre los gnomos ocupa un lugar poco valorado:
  lo menosprecian por torpe, juguetón y guasón. Tiene un gran corazón, es algo
  miedoso y también pícaro. Su oficio, aspecto detallado y relación concreta
  con la ciudad se concretan a continuación.
- Gnomi es **ayudante de acogida**: hace tareas pequeñas y le dejan pocas
  responsabilidades. Al principio se sugiere que otros gnomos lo menosprecian;
  su situación se conocerá poco a poco, conforme se gana confianza.
- Gnomi recuerda un poco a un gnomo de jardín: traje azul, gorro rojo y
  poca barba. Debe resultar mono, parecer joven para su especie y reflejar
  su cometido de ayudante en su aspecto. La edad exacta no está fijada:
  unos 150 años podrían seguir siendo juventud para un gnomo.
- El primer favor consiste en **encontrar el distintivo de ayudante de
  Gnomi**, explorando con él un rincón de la ciudad. El distintivo es sencillo
  y tiene poco prestigio para otros, pero es muy importante para él.
  El lugar y desarrollo concreto todavía no están decididos.
- Durante la búsqueda Gnomi camina con el jugador y comenta algunas pistas.
  Ese acompañamiento solo lo ve el propio jugador.
- La primera misión es personal aunque se juegue en grupo: el progreso y
  el objeto no se comparten ni compiten entre jugadores. La búsqueda muestra
  un marcador exacto del objetivo para que la bienvenida sea muy guiada.
- El distintivo se buscará cerca de un taller o puesto del mercado. Todavía
  falta concretar su posición y el recorrido sobre el mapa.
- La recompensa de esta primera misión será de **40 puntos de experiencia
  y 5 pelines**.
- La bienvenida será **solo para personajes nuevos**. Los personajes que
  existían antes de incorporar el sistema no recibirán esta misión ni
  tendrán que repetir su comienzo.
- Los diálogos mezclan cercanía y naturalidad con calidez de cuento:
  humor suave, expresiones coloquiales sin sonar modernas y un toque
  pintoresco, sin solemnidad.
- El lore se construye junto al creador del proyecto, por etapas, y se
  documenta conforme se aprueba. No se dan por aprobados nombres, instituciones,
  acontecimientos ni reglas del mundo por aparecer en una propuesta.

## Motivos de comienzo aprobados

Se eligen hablando por primera vez con Gnomi, no en el creador de personaje.
La elección se guarda por personaje y modifica el saludo, no los atributos.
No impone familiares, un pasado trágico ni obligaciones por pertenecer a una
raza.

| Raza | Motivos |
| --- | --- |
| Humano | Soy de Brumaluz y busco mi primer oficio. / He venido a probar suerte. / Quiero aprender de sus talleres. |
| Elfo | Vengo de la Arboleda para aprender. / Quiero conocer la vida de la capital. / Vivo aquí y busco un nuevo rumbo. |
| Lagto' | He bajado de las Cumbres de Cobre para aprender un oficio. / Quiero conocer qué hay más allá de las montañas. / Vivo aquí y busco un nuevo rumbo. |
| Pelso | He llegado desde Luna Argéntea para conocer la capital. / Busco oportunidades en tierra firme. / Vivo aquí y busco un nuevo rumbo. |

La bienvenida actual debe poder encajar después de las futuras regiones
iniciales. Para los residentes representa una nueva etapa, no una llegada
ficticia a una ciudad que ya conocen.

## Sistema de misiones aprobado

La primera implementación está disponible para pruebas de desarrollo. La
bienvenida permanece desactivada para jugadores reales hasta aprobar el guion
y la presentación. Los textos y la ubicación concretos usados para probar
los sistemas son provisionales, no amplían el canon.

- Aceptación explícita desde el diálogo, mostrando la recompensa.
- La bienvenida es obligatoria: no se puede abandonar ni saltar para avanzar
  en contenido posterior. Se puede interrumpir la sesión y continuar después.
- La elección del motivo se confirma antes de guardarse y queda fija para
  ese personaje.
- Diario con misiones activas y completadas.
- Seguimiento discreto de una misión y marcador del objetivo.
- Progreso persistente por personaje, también al desconectarse y volver.
- Validación del progreso y de las recompensas en el servidor.
- La recompensa solo puede reclamarse una vez.
- El distintivo es un objeto de misión: no ocupa hueco de mochila y no puede
  venderse ni intercambiarse.
- Gnomi acompaña de forma individual durante la búsqueda: distintos jugadores
  pueden hacerla a la vez sin competir por él ni por el distintivo.
- Mientras la misión esté activa, Gnomi sigue al jugador por toda Brumaluz,
  también después de encontrar el distintivo y hasta devolvérselo. Abrir el
  diario no descarta el acompañante ni el progreso.
- Solo los personajes creados después de la activación definitiva reciben
  esta bienvenida. Publicar los sistemas desactivados no incorpora a los
  personajes creados durante ese intervalo.

## Referencias presentes en el juego

Estas referencias proceden de las descripciones actuales de las razas en
`src/data/data.ts`; se conservan como punto de partida, sin ampliar todavía
su historia ni sus implicaciones políticas.

- **Humanos:** pueden haber nacido en Brumaluz o proceder de tierras lejanas.
- **Elfos:** son nativos de la Arboleda y protegen los bosques que abrazan
  Brumaluz; se vinculan al conocimiento de la naturaleza y la alquimia.
- **Lagto':** proceden de las Cumbres de Cobre, entre montañas pedregosas,
  grietas y cavernas. Se describen como recios, pacientes y conocedores de
  los pasos ocultos de la roca.
- **Pelso:** proceden de la Isla de Luna Argéntea y se describen como
  navegantes apasionados e impulsivos.

## Decisiones pendientes

- Alcance de la autoridad del rey de Brumaluz y relación entre soberanos.
- Costumbres, lugares e instituciones que concretan la identidad de la ciudad.
- Detalles del distintivo, lugar del encuentro y recorrido de búsqueda.
- Guion concreto de la primera misión y respuestas del jugador.
- Diseño visual del diario, seguimiento y marcador.
- Siguientes encargos después de recuperar el distintivo; no están aprobados
  nuevos personajes, instituciones ni acontecimientos para esa continuación.

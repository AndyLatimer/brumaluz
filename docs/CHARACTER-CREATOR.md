# Taller de personajes

Ampliación del 27 de octubre de 2026 para la petición de un creador más profundo,
cuidado y con más opciones. Mantiene el mundo y los comienzos aprobados en
[LORE.md](LORE.md): los motivos se eligen con Gnomi, sin inventar trasfondos,
regiones, razas, clases ni ventajas nuevas.

## Opciones y presentación

La revisión de expresiones diferencia las trece opciones de ojos mediante
contornos propios del párpado superior e inferior, apertura, comisuras y
proporción de pupila. Los iris conservan el acabado de color del juego; sus
capas y reflejos se recortan dentro del contorno, también en las miradas
entrecerradas. Pelso y Lagto conservan sus pupilas verticales. Se mantienen
parpadeo, ojos cerrados y expresión de alegría.
Las cejas diferencian posición del arco, ángulo y afinado exterior; las sonrisas
tímida, pícara y de lado tienen trazos propios. Las recetas de inspiración
reparten más formas de ojos entre sus combinaciones. No se reordenan IDs ni se
añaden campos a las apariencias guardadas. La revisión reproducible
`node tools/review-creator-expressions.mjs` comprueba el recorte de las capas y
genera láminas de ojos, cejas, bocas, recetas y gafas en los cuatro linajes en
`art/creator-expression-review/`.

La corrección visual solicitada después de las ampliaciones recupera la tarjeta
anterior como referencia: marco de madera y latón, pergamino, pestañas al borde
superior y selección dorada, como los controles de `03-creator.css`. Se retira
la cabecera grande añadida al taller y los apartados opcionales quedan después
de las opciones de cada pestaña.
Los nuevos catálogos y capas comparten los biseles, tinta y tonos cálidos de
la interfaz original. Se conservan modelos, opciones e historial de teclado.
La decisión posterior del usuario elimina de todas las pestañas la barra
`studio-toolbar`, «Variar sección», «Tus apariencias», «Herramientas de edición»
y «Comparar diseños». Se retiran sus controles y operaciones de la interfaz;
los datos de apariencias que pudieran existir en el navegador no se borran.
El desplegable restante se llama «Inspiración».
`node tools/review-creator-interface.mjs` guarda las vistas `parchment-*` de
escritorio, rostro, catálogo y móvil en `art/creator-studio-review/`.

El personaje se presenta sobre un pedestal en un escenario propio, separado de
la geometría de los mapas. El fondo y la luz permiten revisar los rasgos sin que
una pared de la ciudad tape al personaje. Al entrar al mundo se recuperan la
posición y la iluminación habituales. Hay botones de frente, perfil, espalda y
zoom. En móvil, «Vista amplia» pliega las opciones para inspeccionar el cuerpo;
«Seguir editando» o elegir una pestaña restaura la edición.
«Ver rostro» y «Ver cuerpo» permiten cambiar el encuadre sin salir de la
pestaña actual, también al revisar complementos desde Ropa.

Se mantienen los cuatro linajes y las cinco clases, los cuerpos y las opciones
de apariencia existentes. Cada selector conserva las flechas y la lista nativa,
y añade un catálogo desplegable con todas las opciones y el estado seleccionado.
Los colores muestran también su nombre. Altura y complexión muestran su valor
relativo; el porcentaje no representa centímetros ni modifica estadísticas.

La primera ampliación llevó los detalles faciales de 11 a 18, con estos IDs:
11 pecas y rubor; 12 pecas y cicatriz de ceja; 13 constelación y lunar;
14 pecas de sol y lunar; 15 hojas y rubor; 16 runas y cicatriz;
17 pecas y lunar. Los IDs 0–10 conservan su significado. El montaje combina las
geometrías sobre la superficie de cada rostro y genera el rubor una sola vez.
Se comparte con retratos, personajes del mundo y el editor de NPCs.

La revisión posterior de esta misma petición permite combinar **cinco capas
independientes**: pecas (ninguna, normales o de sol), cicatriz (ninguna, mejilla
o ceja), marca (ninguna, constelación, hoja, runas o pintura de guerra), lunar
y rubor. Son **180 combinaciones** en total. Los IDs 0–17 se conservan exactamente;
los restantes se añaden al catálogo mediante un producto fijo en
`src/character/head/detailLayers.ts`. Se guarda el mismo campo numérico `detail`,
sin un esquema paralelo ni migración SQL. La lista breve sigue ofreciendo las
18 recetas originales; una combinación de capas se identifica como personal.
Todas las combinaciones aparecen también en el catálogo del editor de NPCs.

Los catálogos de cara, ojos, cejas, nariz, boca, pelo, barba y complementos
incluyen retratos del personaje con cada alternativa. Se generan al abrirlos,
solo para las opciones visibles dentro del panel, y se reutilizan mientras no
cambien los demás rasgos. Desplazar el panel carga las siguientes miniaturas.
Las vistas de rasgos usan un encuadre más cercano.

El escenario incorpora luz principal y de contorno, suelo con borde difuminado
y tres ambientes: taller, día y farol. Solo cambian la revisión visual; no se
guardan como parte del personaje. En móvil están disponibles en un selector
al final del panel de opciones para conservar espacio de vista previa.

El apartado de inspiración ofrece dieciséis combinaciones con retratos 3D y dieciséis
armonías para los colores de ropa y complementos. Son recetas cosméticas, sin
significado canónico ni beneficios de juego. No cambian linaje, cuerpo, nombre,
clase ni atributos. Los retratos se calculan al abrir el apartado y se reutilizan
mientras no cambie el resultado de la receta con la base y bloqueos actuales.

## Segunda ampliación: siluetas y complementos

La petición de «más y mejor» añade seis peinados reales, hasta **28 en total**:
22 Trenza alta, 23 Moño trenzado, 24 Melena a un lado, 25 Rizos cortos,
26 Trenzas recogidas y 27 Dos moños trenzados. Combinan las cubiertas existentes
con mechones, rizos y trenzas de tres hebras asentados sobre el cráneo final.
Se mantiene el significado de los IDs 0–21; la revisión de modelado posterior
mejora sus mallas. Se comprueban en los cuatro rostros,
linajes y extremos de proporciones, con sus adornos y animaciones.

Los complementos se separan en **cuatro capas**: gafas/monóculo, cuello/colgante,
pendientes y pañuelo. Hay **200 combinaciones**. Las piezas nuevas son gafas
cuadradas, medallón con borde grabado y pendientes de perla. Se conservan los
IDs 0–10 (incluido 6, gafas y bufanda); 11–13 identifican esas piezas nuevas.
El resto se añade mediante un producto fijo versionado en
`src/character/head/accessoryLayers.ts`. Se guarda en el campo existente `acc`,
sin migración SQL. Se mantiene un solo color para los complementos, con el
acabado propio de cadenas y perlas. Un cuello admite bufanda o colgante,
evitando superponer dos piezas sobre la misma superficie.

El pañuelo combinado también oculta boca y barba. Los valores de boca y barba
se conservan y vuelven a verse al retirarlo. Bufandas, medallones y colgantes
siguen al pecho; gafas y pendientes mantienen los anclajes de cabeza y orejas.
Los catálogos de NPCs y los retratos comparten el mismo montaje y los 200 IDs.

Los catálogos visuales incorporan búsqueda con contador y los peinados se
filtran por cortos, melenas, recogidos, trenzados y rizados. Los retratos se
generan en lotes de dos entre fotogramas y solo para opciones visibles: cerrar
un catálogo, cambiar la búsqueda o salir de su pestaña cancela la cola pendiente.
Pestañas y accesos a apartados conservan el espacio de edición en móvil; al
cambiar de pestaña se recuerda la posición de desplazamiento de cada una.
La navegación interna permite llegar directamente a mirada, facciones, capas,
adornos, paletas o tejidos.

Las ocho inspiraciones y armonías adicionales son combinaciones cosméticas de
los catálogos. No añaden trasfondos, ropa con estadísticas ni compromisos de oficio.

## Revisión de modelado solicitada después

La petición de mejorar los modelos, que parecían formas pegadas, autoriza
rehacer las mallas de las opciones existentes manteniendo sus IDs y significado.
Esta revisión cambia la construcción, sin añadir combinaciones para aumentar
el contador.

- `sculptedHair.ts` construye un cuero cabelludo de pelo continuo, con línea de
  nacimiento, volumen, relieve direccional de mechones, reverso y borde cerrado.
  Los rizos son relieve de esa superficie, no bucles o bolas colocados encima.
  Melenas y cortes de lado tienen caída y contorno propios.
- Las trenzas tienen tres mechones aplanados que se cruzan por encima y debajo;
  sus raíces quedan embebidas en la superficie. Los moños tienen volumen propio
  con pliegues integrados, sin esfera central y espiral superpuesta.
- Los peinados continuos dejan de pintar de marrón una zona rectangular del
  cráneo: la piel mantiene su color bajo el contorno real del pelo. La revisión
  posterior extiende esta corrección a los cuatro recursos importados, IDs 12–15.
- Las superficies terminadas no reciben otra subdivisión Loop al montarse.
  Se conservan los canales y el presupuesto de triángulos previsto, además de
  los rayos de ajuste de adornos y rasgos del linaje.
- Las cejas se modelan como un relieve fino adaptado punto por punto a la cara,
  con extremos afinados. Se comprueba su distancia a cada cráneo con los ojos
  más grandes para evitar cápsulas flotantes sobre la frente.
- La bufanda tiene pliegues, reverso, espesor, bordes cosidos y flecos; el lazo
  usa cintas plegadas y colas recortadas. Las flores tienen pétalos curvos y
  nervaduras, sustituyendo los elipsoides anteriores.
- Las gafas incorporan bisagras y apoyos; las cadenas tienen eslabones alternos
  y los colgantes una anilla de suspensión. El medallón tiene borde biselado.
  Estas piezas mantienen sus anclajes y el color guardado por el personaje.

Los catálogos de pelo y complementos permiten elegir frente, perfil o espalda
para comparar los modelos antes de seleccionarlos. La lámina general y los
detalles ampliados se generan con `node tools/review-creator-options.mjs`, en
`expanded-options.png` y `sculpted-details.png`. Las pruebas recorren los cuatro
rostros y linajes, posturas y proporciones, verifican el cierre de las superficies
y la ausencia del parche pintado del cráneo. No hay simulación física de pelo
o tela; el cabello sigue la cabeza y las piezas del cuello siguen al pecho.

## Pulido de opciones y lectura visual

Cada peinado continuo tiene ahora un perfil de flequillo, nuca, raya y dirección
de mechones. El corto con flequillo, el despeinado, los moños y las coletas
dejan de compartir el mismo frente; los rizos cortos descubren más nuca. Los
recogidos dobles orientan el volumen hacia ambas raíces sin abrir una costura
en el centro. Se mantienen los IDs, los colores guardados y el significado de
las opciones.

Las lunas del pasador y los pendientes tienen contornos de creciente y cantos
biselados, con unión a la cuenta del pasador. Las hojas tienen punta, curvatura,
espesor, nervadura y tallo común. La revisión se recoge también en
`art/creator-studio-review/refined-options.png`.

Los catálogos de maquillaje, marcas y rasgos del linaje incluyen retratos. Si
el pañuelo oculta boca, barba, maquillaje o detalles, solo sus miniaturas lo
retiran para mostrar la opción. Al abrir el catálogo se explica esta diferencia;
el personaje conserva el pañuelo y las demás capas. Elegir un rasgo nunca borra
otra elección para hacerla visible.

Las inspiraciones muestran el resultado efectivo con los bloqueos vigentes.
Su caché incluye todos los rasgos que sobreviven a la receta, por lo que cambiar
la nariz u otra base también actualiza las imágenes. Se recalculan solo las
miniaturas afectadas y visibles; las colas se detienen al cerrar el apartado,
ocultar un control, ir a la selección de personajes o entrar al juego.

Las rejillas permiten mover el foco con las flechas, Inicio y Fin, y elegir con
Intro o Espacio. La búsqueda y los filtros conservan el foco de edición; las
opciones ocultas no entran en el recorrido de teclado.
Al abrir otra sesión del creador se recogen los catálogos y apartados y se
restablecen búsquedas, categorías, ángulos y desplazamiento. Este reinicio no
modifica el personaje; la posición de cada pestaña
se conserva mientras se siga editando en la misma sesión.

## Corrección de huecos y uniones del pelo

La revisión solicitada después de simplificar la interfaz conserva los 28 IDs
y la identidad de sus cortes. La cresta (7) tiene tapas en ambos extremos y
caras orientadas hacia fuera. En el corte asimétrico (12) se continúa el
contorno de la nuca donde el moño original dejaba una muesca. Los cuatro cortes
importados (12–15) incorporan una base fina y cerrada bajo sus mechones; la piel
ya no lleva parches de pelo pintados y los gradientes de las piezas coinciden.
La base terminada no recibe la subdivisión de las piezas antiguas y queda por
debajo de sus caras para evitar intersecciones y cambios de color al girar.
Los cortes importados proyectan sombras sobre la piel y conservan el sombreado
por luces, pero no reciben sombras en el propio pelo: la proximidad entre
mechones y base producía motas en la nuca y las sienes.

Las raíces de coletas y moños y el recorrido de las trenzas se apoyan sobre
el volumen final del peinado. La corona (21) es un recorrido cerrado, sin dos
extremos separados en frente o nuca; sus tres hebras y sus canales cierran
la vuelta. Las trenzas recogidas (26) recorren la nuca de forma continua y
entierran sus extremos en las sienes, en lugar de desaparecer bajo la base.

`node tools/review-creator-hair.mjs final --fit` genera cinco vistas por peinado
(frente, ambos perfiles, espalda y coronilla) y láminas de los cortes delicados
en los cuatro rostros. Se guardan como `hair-final-*` en
`art/creator-studio-review/`. La opción `--parts` distingue las piezas por color
para localizar uniones; es solo una herramienta de revisión. Las comprobaciones
de ajuste recorren también todas las superficies continuas, tapas y hebras para
verificar cierre, orientación, normales finitas y separación respecto a la base.

## Encaje entre linajes y complementos (28 de octubre)

La revisión de conexiones conserva los IDs, colores y elecciones del personaje.
`head/anatomy.ts` define los puntos de raíz, lóbulo, sien y punta de cada oreja
en el espacio de montaje. La geometría de orejas humanas, elfas, Pelso y aletas
Lagto usa los mismos datos que los pendientes y las patillas. Las raíces de
orejas, cuernos y crestas se apoyan en el cráneo, independientemente del volumen
del peinado. El interior de las orejas Pelso sigue su superficie exterior;
los pendientes de este linaje cuelgan del grupo que anima la oreja.

Gafas, patillas y pañuelo miden la superficie real de cara, nariz y pelo. Las
monturas conservan un plano común y sus apoyos nasales; las patillas rodean el
volumen lateral y se ajustan también al casco o capucha equipados. El monóculo
conecta la cadena al aro. El pañuelo mantiene sus pliegues y libera nariz,
montura y cuello, en lugar de aplicar un desplazamiento fijo por linaje.

Los cascos cerrados y las capuchas cubren las orejas y sus pendientes; las
prendas que ocupan la coronilla cubren también las orejas Pelso. Los sombreros
abiertos permiten ver las orejas laterales de humanos y elfos. Cuernos y crestas
mantienen la cobertura anterior con sombrero. Estas reglas no borran rasgos ni
joyas: vuelven a verse al retirar la prenda. La cabeza modular de guerrero y
la capucha de pícaro se reconocen por sus paredes laterales, y la mitra de
clérigo se reconoce como prenda de coronilla.

Bufanda, cadenas y medallones se ajustan a la prenda del torso que se lleva
puesta. Las piezas permanecen en el pecho y reciben los pesos de esa superficie
para acompañar su mezcla de pecho y columna durante las animaciones. La bufanda
tiene una costura circular cerrada y una cola próxima a la tela; su borde
superior deja espacio a la mandíbula y al pañuelo.

Las láminas `tools/review-creator-connections.mjs` recorren los cuatro linajes,
todos sus rasgos, cuatro vistas, proporciones extremas y casos equipados.
`scripts/test-creator-connections.mjs` comprueba separaciones entre piezas,
anclajes de pendientes, cobertura por ropa y el ajuste animado de cuello.
Sus capturas se guardan en `art/creator-connections-review/`.

## Edición

- Cada rasgo y color tiene un bloqueo que protege contra el botón Aleatorio
  y las recetas de inspiración. Se puede editar directamente
  una elección bloqueada. Cambiar de linaje aplica los límites de opciones
  válidas para ese linaje, incluso a los índices bloqueados.
- «Aleatorio» permite variar todo el diseño, incluido linaje y clase, respetando
  bloqueos. Conserva nombre, atributos y progreso. No impone barba o
  maquillaje en función del sexo.
- Deshacer/rehacer conserva hasta 80 estados de edición, incluidos nombre,
  clase y atributos. Los movimientos seguidos de un deslizador se agrupan;
  una edición tras deshacer descarta la rama posterior. Ctrl/Cmd+Z y
  Ctrl/Cmd+Mayús+Z o Ctrl/Cmd+Y funcionan fuera de los campos de texto.
- Un nuevo acceso al editor inicia un historial nuevo y libera los bloqueos.

## Respuesta al editar

La reconstrucción reutiliza plantillas de cráneo y peinados continuos según
su forma, peinado y casco. Cada personaje recibe copias independientes antes
de transformar la geometría: cambiar colores, ojos o crear retratos no altera
otros personajes. Las cachés tienen límites de memoria y entradas y expulsan
las plantillas menos usadas. Se evita repetir el suavizado de superficies
que los peinados continuos ya entregan con normales calculadas.

Los catálogos y las inspiraciones comparten una cola de miniaturas. Tras una
edición se esperan 180 ms sin otro cambio, se prioriza la reconstrucción del
personaje y se genera un único retrato antes de ceder de nuevo al navegador.
No se generan alternativas fuera de la parte visible del panel. Las
proyecciones repetidas sobre la cara se reutilizan entre reconstrucciones de
la misma forma de cráneo, con copias independientes y un máximo de 4096 puntos.
`node tools/profile-creator.mjs <etiqueta>` mide reconstrucciones de pelo,
ojos y colores en el navegador de pruebas y guarda el informe en
`art/creator-studio-review/performance-<etiqueta>.json`.

## Decisiones de juego

La vista de clase muestra las armas iniciales y la habilidad desde
`COMBAT_KITS`, y los máximos de vida y recurso desde las fórmulas compartidas,
con el equipo inicial. La pestaña de atributos muestra también estos máximos.
Las sugerencias reparten los dos puntos autorizados: todos al atributo principal
de la clase, o uno al principal y uno a Corpulencia. Se pueden quitar y repartir
a mano. No se modifica el equilibrio ni el contrato SQL.

La túnica de diario conserva sus colores; el equipo inicial es el aprobado
en el lore. La vista equipada de clase sigue siendo una referencia de vestuario;
no concede armaduras ni desbloquea ramas alternativas.

## Verificación

- `npm run build`: compilación TypeScript y producción.
- `node --test scripts/test-creator-fit.mjs`: ajuste, materiales, anclajes y
  conservación de las opciones existentes en los cuatro rostros y linajes.
- `node --test scripts/test-creator-studio.mjs`: creador real en navegador,
  variaciones, aislamiento del progreso, historial, bloqueos, catálogos,
  paletas, atributos, móvil y combinaciones en personajes y NPCs.
  Recorre las 180 combinaciones para comprobar unicidad, capas y normalización,
  conserva los IDs antiguos y renderiza combinaciones completas en los cuatro
  rostros y linajes. Comprueba también la retirada de los bloques solicitados,
  la carga de retratos al desplazar los catálogos,
  iluminación, traducciones y la llegada de un ID nuevo al juego real.
- Las capturas de esta revisión se guardan en `art/creator-studio-review/`.
- `node tools/review-creator-world.mjs`: revisa un personaje elfo con las cinco
  capas en el mapa publicado de Brumaluz, con el escenario del taller apagado;
  genera `published-city.png`, sin escrituras de cuenta ni de mapas.
- `node tools/review-creator-options.mjs`: lámina de los seis peinados nuevos
  desde frente, perfil y espalda, complementos combinados en los cuatro linajes
  y pañuelo; genera `expanded-options.png`.

No requiere regenerar GLB ni migrar personajes existentes: se añaden valores
al final del catálogo y el servidor ya admite estos índices de apariencia.

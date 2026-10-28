# Vestuario modular

## Atuendo base de los personajes

La ropa de diario de todas las clases es el conjunto `medieval`: túnica,
mangas, manos, calzas y botas. Se utiliza en el creador (incluida la pestaña
**Ropa**), retratos, personaje local y jugadores remotos cuando se muestra
la ropa base. No hace falta modificar los personajes ya guardados.

`clothA` colorea la túnica y sus mangas; `clothB`, los ribetes y las calzas.
El lino de cuello y puños, el cuero, las suelas y los herrajes conservan sus
acabados. Cada personaje recibe materiales propios; cambiar un color no
recolorea las prendas de otros personajes.

La vista de equipo de clase del creador conserva su atuendo de referencia.
Los NPC con vestuario explícito conservan sus prendas registradas. La túnica
es ropa base, sin estadísticas, sin ocupar ranuras y visible al desequiparse.

## Pelo y complementos del creador

La ampliación del taller de personajes del 27 de octubre, sus combinaciones
faciales y sus herramientas de edición se describen en
[CHARACTER-CREATOR.md](CHARACTER-CREATOR.md).

`npm run art:creator` extrae de Adventurers 2.0 tres piezas sin cuerpos,
esqueletos ni texturas adicionales: el pelo de Ranger, el flequillo de
Rogue Hooded y su pañuelo. El archivo de producción `creator-parts.glb`
pesa menos de 170 kB; no se carga el catálogo completo.

- Los IDs 0–11 mantienen sus peinados. El corte asimétrico (12) combina
  una base corta de Mage con el nuevo flequillo; el corto pegado (13) usa los
  mechones de Ranger ajustados al cráneo, en vez de una cubierta lisa.
- Se añaden Melena de explorador (14), con el volumen del modelo original,
  y Flequillo de viajero (15), con una nuca de media melena.
- Pañuelo de viajero se añade como accesorio 7 y utiliza el color de
  complementos. Oculta temporalmente la boca y la barba sin borrar sus valores.
- Los colores de pelo, los cuatro rostros, los linajes y los adornos siguen
  usando el montaje compartido por creador, retratos y personajes del mundo.
  El casco sigue ocultando el pelo.

Los valores anteriores no se reordenan. La validación SQL de apariencia ya
admite los nuevos IDs y no necesita una migración de personajes.
`npm run test:creator` comprueba extracción, opciones, ajuste, colores y render.

### Ampliación y ajuste de apariencia

El catálogo conserva los IDs anteriores y añade seis peinados (22 en total),
cuatro formas de ojos (13), tres barbas, cejas, narices y bocas, cinco detalles
faciales, tres maquillajes y seis complementos. Las trenzas se construyen con
tres mechones entrelazados. Las paletas incorporan tonos de pelo, iris, piel y
adornos, y cada linaje con rasgos propios recibe dos variantes de orejas o cresta.
Los nuevos valores también están disponibles en el taller de NPCs.

Los adornos se orientan con la normal de la superficie final del pelo. Las gafas
ajustan el radio y el puente al tamaño de los ojos e incluyen patillas; los
pendientes siguen la base de las orejas de cada linaje. Bufandas y colgantes se
montan sobre el pecho para que no giren con la cabeza. Los proxies de raycast
compensan la transformación al hueso, conservando los anclajes posteriores.
El rubor y las sombras siguen la curvatura de la cara mediante geometría subdividida.

Los selectores permiten abrir la lista completa o avanzar con las flechas.
Cambiar el cuerpo conserva las elecciones de apariencia. Los colores tienen
estado accesible y los nombres nuevos se traducen al inglés.

- `npm run test:creator:fit`: comprobaciones desde los módulos fuente de anclajes,
  combinaciones de los cuatro rostros y linajes, animación y controles del creador.
- `npm run art:creator:review`: genera vistas de frente, perfil, espalda,
  detalles, complementos y linajes en `art/creator-review/`.

Es ajuste geométrico durante el montaje, sin simulación física del pelo o las joyas.

La segunda ampliación del taller lleva el pelo a **28 peinados** (IDs 22–27:
trenza alta, moño trenzado, melena de lado, rizos cortos, trenzas recogidas y
moños trenzados dobles). Los complementos combinan gafas, cuello, pendientes y
pañuelo mediante **200 IDs estables**, conservando los anteriores y añadiendo
gafas cuadradas, medallón y perlas. Se mantienen las piezas de cuello sobre el
pecho y la ocultación de boca/barba cuando se lleva el pañuelo, también en una
combinación. No se regeneran los GLB ni se cambian los uniformes de NPCs.
`node tools/review-creator-options.mjs` genera la lámina de frente, perfil y
espalda en `art/creator-studio-review/expanded-options.png`; el contrato de IDs,
controles y validación está en [el taller](CHARACTER-CREATOR.md).

La revisión de modelado del creador sustituye las masas procedurales anteriores
por superficies continuas de pelo con borde e interior, rizos esculpidos, trenzas
con cruces planos y moños con pliegues. También retira el parche de color pelo
del cráneo en esos estilos y ajusta las cejas sobre la superficie real. Bufanda,
lazo y pétalos se modelan con espesor y pliegues; cadenas, bisagras y anillas
completan los complementos. Los IDs y recursos GLB se conservan. Contrato y
revisión visual en [Taller de personajes](CHARACTER-CREATOR.md#revisión-de-modelado-solicitada-después).

El pulido posterior diferencia flequillos, nucas, rayas y direcciones de
mechones por peinado. Las lunas se modelan como crecientes biselados y las hojas
como superficies con nervadura y tallo común. La lámina adicional
`art/creator-studio-review/refined-options.png` permite revisar sus tres vistas.

## Primera pieza de producción

`src/assets/models/wardrobe/helpers.glb` contiene el uniforme base del Gremio
de Ayudantes: camisa clara, peto azul con tirantes, botones y bolsillo,
pantalones, botas marrones y gorro rojo de tela con punta caída.
Son mallas nuevas, no deformaciones del traje de Rogue ni del sombrero de Mage.
Solo las manos expuestas proceden de la anatomía CC0 de KayKit.

El juego carga el GLB, no genera estas prendas durante la partida. El esqueleto
y las animaciones siguen siendo KayKit Adventurers (41 huesos). No se modifica
el inventario ni se desbloquea equipamiento para jugadores.

## Crear, editar y revisar

- `npm run art:build`: reconstruye el GLB desde los patrones editables de
  `scripts/build-wardrobe.mjs`, usando las dependencias existentes. No requiere
  Blender, servicios externos ni generación por IA.
- `npm run art:check`: comprueba nombres, tamaño, presupuesto de triángulos,
  esqueleto, matrices de reposo, influencias y pesos normalizados.
- `npm run dev`, después abrir `/wardrobe.html`: probador local independiente,
  sin cuenta ni escrituras al servidor. Permite comparar ropa inicial/uniforme,
  cambiar maniquí, girar y probar reposo, marcha, carrera, saludo e interacción.
  El control de elevación permite mirar desde abajo; al bajar de la horizontal
  se oculta el suelo para inspeccionar las suelas.
- El probador incluye recoger, consumir y golpes. Los clips adicionales y su
  integración cosmética se describen en la [biblioteca de recursos](./ASSET-LIBRARY.md).
  `npm run art:ambient` regenera los dos clips nuevos sin sustituir el rig,
  el uniforme ni las animaciones originales.
- Para editar artísticamente, importar `helpers.glb` en Blender mediante
  **File > Import > glTF 2.0**. El archivo incluye la armadura en reposo,
  prendas separadas y materiales con nombre. Guardar un `.blend` como fuente
  si se continúa allí. No hay un `.blend` generado ni Blender instalado
  en el entorno donde se creó esta primera versión.
- Exportar glTF 2.0 binario con mallas y armadura, sin animaciones ni cámaras,
  manteniendo nombres, transformaciones y pose de reposo. Sustituir el GLB,
  ejecutar las comprobaciones y revisar el probador. **No ejecutar
  `art:build` después de editar el GLB en Blender**: lo regeneraría desde
  los patrones y sobrescribiría esa edición.

## Contrato de nuevas piezas

El catálogo `src/character/wardrobe.ts` declara conjuntos por identificador,
nodos del GLB, regiones sustituidas y anclajes. `Character` monta el catálogo;
no contiene excepciones por nombre de NPC.

- **Prendas deformables:** mallas con skin sobre el rig de referencia,
  coordenadas Y arriba, escala original KayKit y transformaciones de malla
  identidad. Conservar nombres, orden de huesos, matrices inversas y pose
  de reposo. Usar hasta cuatro influencias normalizadas por vértice.
  El montaje enlaza los huesos por nombre y falla si falta uno.
- **Accesorios rígidos:** modelar en el espacio local del hueso elegido.
  Los anclajes admitidos son `head`, `chest`, `handslot.l` y `handslot.r`;
  permiten sombreros, mochilas, armas o escudos sin otro esqueleto.
- **Ocultación:** `replaces` retira torso, brazos o piernas del traje base.
  Una prenda que sustituya brazos debe aportar las manos o anatomía expuesta.
  Es una primera ocultación por regiones, no un sistema de capas arbitrarias.
- **Pelo:** `hairFit` configura cómo se adapta la cabeza modular al accesorio.
- **Recursos:** geometrías del GLB compartidas; materiales y enlaces de
  esqueleto por personaje, liberados al destruirlo. Material `skin` adopta
  el tono del portador. Los conjuntos explícitos conservan sus colores de
  diseño; la túnica base utiliza los colores guardados en el creador.

Para otro conjunto, añadir su recurso al cargador y su definición al catálogo;
no añadir condicionales de NPC en `Character`. Los patrones de esta primera
versión permiten cambiar secciones y detalles, pero no son un generador
universal de ropa. Vestidos, capas largas, armaduras y cuerpos con proporciones
muy diferentes requieren modelado y ajuste de pesos específicos.

## Revisión artística obligatoria

Comprobar frente, perfil y espalda; encuentros de mangas, tirantes y pantalón;
gorro contra pelo y orejas; pies sobre el suelo; saludo, carrera e interacción.
Probar cada proporción admitida: compartir esqueleto no garantiza que todas
las prendas sirvan para todas las razas sin ajustes.

Las mangas transfieren los pesos de la superficie del brazo de referencia,
con transición al pecho en el hombro; las manos conservan las influencias
originales de antebrazo, muñeca y mano. No se fijan a un único hueso.
Las suelas incluyen tapas orientadas hacia fuera, sin materiales transparentes
ni doble cara para disimular huecos. `art:check` comprueba su cierre y recorre
reposo, marcha, carrera, saludo e interacción para medir las uniones.
La pechera, bolsillo y tirantes se ajustan a la superficie real de la camisa,
con un pequeño margen exterior, en lugar de usar una silueta independiente
que pueda quedar suspendida. La comprobación del recurso mide ese margen
en todos los vértices de la pechera y los tirantes.
En los hombros, los tirantes se ajustan a la envolvente exterior de camisa
y mangas, dentro de la zona que sigue al pecho y no al brazo. La camisa
no incluye una cola oculta bajo el pantalón que pueda atravesar la cintura.
Las dos piernas comparten una costura de entrepierna con pesos de cadera
idénticos; sus arcos exteriores coinciden con el borde inferior de la cintura.
Las pruebas comprueban ambas costuras en cada postura muestreada de nueve
animaciones, incluidas recogida, consumo y las dos variantes nuevas de reposo
e impacto, no solo la proximidad de las piezas en reposo.

El probador solo se sirve en desarrollo; no forma parte de la entrada de
producción de Vite. La bienvenida sigue desactivada y publicar requiere
aprobación explícita.

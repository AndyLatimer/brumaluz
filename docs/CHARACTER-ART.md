# Vestuario modular

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
  el tono del portador. Las telas conservan sus colores de diseño.

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
Las pruebas comprueban ambas costuras en cada postura muestreada de las cinco
animaciones, no solo la proximidad de las piezas en reposo.

El probador solo se sirve en desarrollo; no forma parte de la entrada de
producción de Vite. La bienvenida sigue desactivada y publicar requiere
aprobación explícita.

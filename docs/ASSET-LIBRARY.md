# Biblioteca KayKit y Kenney

Las piezas de Ranger y Rogue Hooded utilizadas por el creador se preparan con
`npm run art:creator`. Su integración y los IDs de apariencia se documentan
en [Pelo y complementos](./CHARACTER-ART.md#pelo-y-complementos-del-creador).

Recursos CC0 de Kay Lousberg y Kenney, extraidos de los doce ZIP entregados. No se
sobrescriben los modelos usados por el juego ni se colocan objetos
automaticamente en el mapa al importar.

| Paquete | Archivos originales | GLB preparados |
| --- | ---: | ---: |
| Resource Bits 1.0 | 466 | 76 |
| Forest Nature 1.0 | 641 | 105 |
| Adventurers 2.0 | 250 | 39 |
| Skeletons 1.1 | 107 | 19 |
| Dungeon 1.1 | 1303 | 216 |
| Character Animations 1.1 | 37 | 16 |
| Mixed Bag 1 | 318 | 69 |
| Restaurant Bits 1.0 (seleccion medieval) | 886 | 68 |
| Furniture Bits 1.0 | 328 | 53 |
| RPG Tools Bits 1.0 | 339 | 59 |
| Medieval Builder 1.0 | 1153 | 229 |
| Kenney Hexagon Kit 2.0 | 374 | 72 |
| Total | 6202 | 1021 |

## Seleccion y compatibilidad de los nuevos paquetes

- Restaurant conserva 68 recursos de cocina y taberna: cajas de alimentos,
  ingredientes, pan, guisos, ollas, sartenes, tapas, platos, cuencos, tarros
  marrones, tabla de cortar, cuchillo, silla de madera y mesa de madera.
  Los 82 modelos modernos restantes no se convierten ni aparecen en el visor:
  neveras, fogones, horno electrico, campana extractora, fregaderos, encimeras
  industriales, muebles cromados, dosificadores, papel de cocina y hamburguesas.
  La lista explicita esta en `tools/kaykit-packs.mjs`; el catalogo registra cada
  exclusion y su motivo. Los originales completos se conservan localmente.
  Se trata de fantasia medieval, no de una reconstruccion botanica historica.
- Mixed Bag, Furniture, RPG Tools y Medieval Builder se importan completos,
  incluso sus piezas OBJ independientes. Que un objeto este disponible no
  implica que deba usarse en el mundo medieval sin revision artistica.
- Los 72 modelos de Kenney se mantienen en `kenney-hexagon`, con autoria y
  licencia propias; no sobrescriben el terreno del juego.
- Character Animations incluye los dos maniquies y 14 bibliotecas: **139 clips
  Medium y 34 Large** (173 entradas, incluidos los T-Pose de referencia).
  Se conservan las bibliotecas originales, incluidas las que duplican clips
  presentes en Adventurers/Skeletons. No se cambia el combate ni el rig del juego.

## Inspeccionar y utilizar

Ejecutar `npm run dev` y abrir `/assets.html`. El visor permite filtrar por
paquete y tipo, buscar nombres, recorrer recursos, girar, acercar y descargar
el GLB. Los personajes Medium pueden probar las 139 animaciones del paquete
completo; el maniqui Large solo ofrece sus 34 clips compatibles. Las bibliotecas
tambien se pueden inspeccionar directamente con su maniqui original.

Los GLB autocontenidos estan en `src/assets/library/`, separados por paquete
y por `objects`, `characters` y `animations`. Conservan nombres, origen,
escala, texturas, mallas, rig y todos los clips disponibles. No se normalizan
las escalas ni se recortan animaciones como en los modelos de produccion.
Las 46 piezas OBJ independientes seleccionadas tambien tienen GLB propios.
Se respetan los grupos de materiales, colores difusos y transparencias (por
ejemplo, el cristal de la brujula). Las extensiones glTF como intensidad
emisiva se conservan. Los nombres `.gltf.glb` de Medieval Builder se normalizan
a una sola extension sin duplicar los OBJ equivalentes.

`catalog.json` contiene identificadores, rutas de origen, dimensiones,
animaciones, familia de rig, tamanos y SHA-256 de cada GLB. Cada paquete indica
su autor y las exclusiones intencionales. `sources.json` inventaria **cada
archivo original**, incluidos FBX, OBJ/MTL, texturas, previews y enlaces.
Cada carpeta de paquete conserva su `LICENSE.txt` original.

`src/art/library.ts` expone `catalog` y `loadLibraryAsset(id)` para obtener
el GLTF y su URL bajo demanda. Cada llamada carga un recurso independiente;
el consumidor debe liberar geometria, materiales y texturas cuando termine.
Para reutilizar personajes animados, clonar con `SkeletonUtils.clone`, no
con `Object3D.clone`. Las animaciones separadas necesitan un rig compatible;
el visor las aplica por nombres de hueso y familia, sin modificar los archivos.
El maniqui Medium original omite los anclajes `handslot.l/r`: el visor agrega
solo esos dos nodos auxiliares sin peso desde la biblioteca, respetando su
transformacion y padre. No mezcla Medium con Large ni adapta a ciegas otros rigs.

Preparar un asset no lo convierte en ropa modular ni en un item de inventario:
esos contratos, colisiones, puntos de anclaje y decisiones de juego requieren
integracion posterior. No se han anadido clases jugables ni enemigos activos.

## Reproducir la importacion

Desde la raiz del repositorio, en PowerShell con ejecucion de scripts permitida:

```powershell
.\tools\extract-kaykit.ps1 -SourceDirectory 'Z:\Downloadydescargas'
npm.cmd run assets:import
npm.cmd run assets:check
npm.cmd run assets:check:browser
npm.cmd run build
```

La extraccion conserva los 6202 archivos originales en `.art-sources/`
(ignorado por Git). No modifica los ZIP. Si la
politica local impide ejecutar scripts PowerShell, se pueden extraer los
doce ZIP con el descompresor habitual dentro de `.art-sources/`, manteniendo
la carpeta raiz de cada paquete, antes de ejecutar la importacion Node.
Los ZIP de Medieval Builder y Kenney, que no tienen carpeta raiz propia,
deben extraerse dentro de carpetas con el mismo nombre que su ZIP, sin extension.
El importador usa glTF Transform y su soporte de extensiones y falla ante modelos ilegibles,
licencias inesperadas, identificadores repetidos o referencias ausentes.
Reimportar regenera la biblioteca: editar copias si se van a personalizar.

Las pruebas comprueban cobertura de modelos, integridad, GLB autocontenidos,
geometria, rig, texturas y animaciones. Con los originales presentes tambien
verifican cada archivo por hash y comparan los datos originales y convertidos.
Sin `.art-sources/`, esa prueba se marca explicitamente como omitida.
La prueba de navegador carga los 566 recursos nuevos y reproduce los 173
clips en sus maniquies. Se comprueban ademas 1563 combinaciones personaje/clip
del paquete completo, con coincidencia de nombres y pose de reposo.

El visor y el catalogo completo no forman parte de la entrada de produccion.
El juego importa unicamente la seleccion descrita a continuacion, no los
aproximadamente 58.3 MB de GLB de la biblioteca. Los nuevos IDs de apariencia no requieren migrar
personajes; el SQL de movimiento admite hasta 2.4 unidades de altura relativa
para saltos sobre superficies bajas.

## Primera pasada de ambientacion y animaciones

- Los personajes actuales conservan sus caras, ropa, equipo y proporciones.
  `Idle_B` aporta una variacion ocasional tras 10-18 segundos en reposo;
  `Hit_B` alterna con la reaccion original al recibir golpes.
- Recoger el distintivo de Gnomi o una bolsa de pelines activa `PickUp`
  **despues de la confirmacion** de la accion. Consumir comida o pociones
  activa `Use_Item`, tambien solo tras una respuesta correcta.
  Son gestos locales y cosmeticos, no tiempos de canalizacion ni nuevas reglas.
  No sustituyen ataques o saltos en curso, se omiten durante la locomocion y
  se cancelan al empezar a caminar, correr o saltar. La muerte tiene prioridad.
- `tools/prepare-ambient-animations.mjs` (`npm run art:ambient`) extrae solo
  los dos clips nuevos a `src/assets/models/ambient-animations.glb`, comprueba
  la pose de reposo de los objetivos y elimina mallas y texturas. No reemplaza
  el rig de 41 huesos ni recorta los clips usados hasta ahora.
- `src/world/cityDetails.ts` coloca pequenas escenas de suministros y jardines
  junto a los servicios: barriles, mesa decorada, telas, lingotes, troncos,
  tablones, arbustos y rocas. Son ocho modelos seleccionados, a escala del
  mundo, instanciados por tipo (como maximo ocho llamadas de dibujo por pase).
  La distribucion es determinista y no cambia la semilla del mapa.
  Se comprueban pendientes, caminos, edificios, otros objetos y distancias
  libres a servicios, NPC, aparicion, bolsas y objetivos de mision. Los objetos
  tienen colision y permiten saltar por encima; las superficies bajas y amplias
  admiten aterrizar como el mobiliario existente. No son nuevos contenedores,
  vendedores o recursos recogibles.
- `/props.html` permite inspeccionar estos ocho objetos y la bolsa existente;
  `/wardrobe.html` incorpora botones para probar recoger, consumir y golpes.
- `npm run test:ambient` compila y prueba los clips, transiciones y prioridades
  sobre las cuatro razas, la colocacion real, colisiones, instanciado y el
  presupuesto del bundle. Con las piezas del creador, la pagina compilada pasa
  de unos 9.26 MB a 10.80 MB sin comprimir; no incluye el visor ni el resto de
  la biblioteca.

No se anaden enemigos, clases, equipamiento, recompensas ni cambios de balance.
Las animaciones de combate existentes se conservan: estos paquetes gratuitos
no aportan nuevos ataques especificos de clase.

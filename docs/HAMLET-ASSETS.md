# Barrio artesanal de Brumaluz

Este acabado es la referencia elegida para la ciudad de **Rusty Hearts**. Se conserva el nombre del grupo y los identificadores de los recursos para mantener las referencias de los mapas.

La colección `brumaluz-hamlet` se reserva para Rusty Hearts. No debe utilizarse para amueblar los talleres de Brumaluz. La colección `brumaluz-arboleda` queda igualmente reservada a La Arboleda.

Pack original de edificios, mobiliario y decoración para el editor de mapas. Comparte una paleta de madera cálida, piedra gris, revoco crema, teja de terracota y acentos verde azulado. Los volúmenes facetados, cantos suavizados y detalles de oficio mantienen la lectura a distancia del juego. El atlas pintado se incrusta en cada GLB para que el recurso funcione por sí solo.

Son **30 piezas**: seis edificios (Casa del Sauce, Casa del Farol, Herbolario de la Bruma, Horno de la Plaza, Taller del Roble y Torre del Alba), doce muebles y doce elementos de decoración. Los muebles incluyen mesa servida, sillas, banco, taburete, cama, alacena, librería, escritorio, mostrador, arcón, hogar y alfombra. La decoración incluye faroles, señal, jardineras, barril, caja de cosecha, carro, pozo, fuente, valla y portilla.

## Usarlo en un mapa

1. Ejecuta `npm run dev` y abre `maps.html` en el servidor local que indica Vite.
2. En el catálogo selecciona **Brumaluz · Barrio artesanal**.
3. Filtra por la categoría del recurso o busca su nombre en español. Los edificios van a la capa automática de edificios; el mobiliario y la decoración, a la de atrezo.
4. Haz clic para colocar una pieza o arrástrala al terreno. Conserva la escala inicial de `1` para mantener las proporciones del pack.
5. Guarda el mapa como de costumbre. **Publicar en el juego** incorpora únicamente los GLB utilizados por ese mapa.

Las categorías y etiquetas proceden de `art/hamlet/manifest.json`; el identificador estable de cada recurso tiene la forma `brumaluz-hamlet/objects/nombre_de_pieza`. Renombrar el identificador cambia la referencia que guardan los mapas.

## Escala y colisiones

Una unidad equivale a un metro. Las piezas se colocan con escala `[1, 1, 1]`, origen a ras de suelo y eje vertical Y en el GLB. En Blender se trabaja con Z vertical y la fachada hacia −Y; la exportación convierte la fachada a +Z.

Los edificios son exteriores decorativos: sus puertas y ventanas forman parte del modelo y no abren interiores ni crean portales. Para entrar en otra zona se utilizan los marcadores y conexiones habituales del editor.

Los faroles y las velas del pack llevan el acabado ámbar del atlas. Para que iluminen el entorno, coloca un marcador de tipo **Luz** junto a la lámpara y ajusta su altura y alcance en el editor.

La colisión automática utiliza la planta del 30 % inferior de la geometría y la altura completa del objeto. Esto permite aproximarse a las paredes sin que el alero ensanche el obstáculo. Las puertas, los arcos y los espacios bajo porches no reciben pasos especiales. Cuando una composición necesita una zona transitable distinta, ajusta la colisión del objeto y coloca los colisionadores y plataformas del editor.

## Fuentes y archivos exportados

| Archivo o carpeta | Contenido |
| --- | --- |
| `art/hamlet/brumaluz-hamlet.blend` | Escena editable, con una colección por recurso y piezas de construcción identificables. |
| `art/hamlet/manifest.json` | Nombres, etiquetas, categorías y datos de generación. |
| `art/hamlet/contact-sheet.png` | Vista de conjunto renderizada en Blender. |
| `art/hamlet/brumaluz-hamlet-glb.zip` | Paquete transportable con los 30 GLB, atlas, catálogo y documentación. |
| `src/assets/library/brumaluz-hamlet/objects/` | Un GLB independiente por recurso. |
| `src/assets/library/brumaluz-hamlet/textures/` | Atlas pintado usado por los materiales. |
| `src/assets/library/brumaluz-hamlet/catalog.json` | Registro generado con medidas, hashes y datos de cada GLB. |
| `tools/blender/hamlet_*.py` | Modelado reproducible y utilidades de Blender. |

El pack tiene su propio catálogo. Los archivos, inventarios y licencias de los paquetes importados permanecen en sus ubicaciones originales; el arte de este barrio no hereda su licencia CC0.

Las colecciones del `.blend` están marcadas como assets de Blender. Al abrir el archivo puedes encontrarlas en **Asset Browser**, dentro de la biblioteca del archivo actual, y arrastrarlas a otra escena. Sus puntos de instancia permiten colocarlas desde el centro de la base aunque la escena fuente las muestre ordenadas en una galería.

## Generar y comprobar

Desde la raíz del proyecto, con Blender instalado:

```powershell
npm run art:hamlet
npm run test:hamlet
node tools/review-hamlet.mjs
./tools/package-hamlet.ps1
```

Si Blender está instalado en otra ruta, define `BLENDER_PATH` con la ruta de su ejecutable antes de ejecutar `art:hamlet`.

`art:hamlet` ejecuta el generador de Blender y después registra los GLB exportados. La generación reconstruye el pack desde Python; guarda las ediciones manuales del `.blend` con otro nombre si quieres conservarlas antes de regenerar.

Si solo has reexportado los GLB y actualizado el manifiesto, puedes renovar el catálogo sin volver a modelar:

```powershell
node tools/register-hamlet.mjs
```

`test:hamlet` comprueba geometría, archivos embebidos, hashes, apoyo en el suelo, etiquetas y escala. Cada exportación utiliza una malla y un material con atlas; el presupuesto es de hasta 18 000 triángulos por edificio y 7 000 por mueble o decoración. También carga todas las piezas en un navegador y publica un mapa de prueba en un directorio temporal para verificar la integración con el juego. Esa prueba no cambia los mapas del proyecto.

La revisión visual genera capturas y un informe en `art/hamlet/review/`: incluye modelos individuales y colocación en el editor con un personaje de referencia. La escena de revisión permanece en memoria.

`tools/package-hamlet.ps1` actualiza el ZIP después de regenerar o reexportar los modelos.

Para repetir solo las láminas a partir del `.blend` actual, sin reconstruir geometría ni GLB: `node tools/build-hamlet.mjs --render-only`.

Para reconstruir el ZIP después de registrar el pack:

```powershell
powershell -NoProfile -File tools/package-hamlet.ps1
```

El archivo editable `.blend` se entrega por separado del ZIP de recursos de juego.

## Repaso de uniones

La revisión 2 cierra los marcos y sus travesaños, integra las cuatro patas de la cama en los postes de esquina y añade soportes a faroles, letreros, tiradores y herramientas. Los tejados siguen la pendiente de los hastiales; el mobiliario, la vajilla y las mercancías apoyan en sus superficies. El pozo tiene mortero continuo detrás de los sillares, y las vallas unen los listones a sus travesaños.

`tools/blender/audit_hamlet_joinery.py` revisa la fuente Blender: cuenta los apoyos de la cama, comprueba la continuidad de los marcos y señala conjuntos elevados separados del resto. Los informes y primeros planos quedan en `art/hamlet/review/`.

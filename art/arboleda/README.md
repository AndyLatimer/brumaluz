# Arboleda · Cuna de los Elfos

30 modelos originales construidos en Blender para la arboleda natal de los elfos de Brumaluz. Madera viva, piedra lunar, hojas solapadas, herrajes dorados y alquimia botánica. Geometría estilizada coherente con el juego.

## Usarlos

Abre `maps.html` y selecciona **Arboleda · Cuna de los Elfos** en el filtro de paquetes del catálogo. Todas las piezas tienen nombres en español y categorías. La escala inicial es **1, 1, 1**: una unidad equivale a un metro y el origen queda apoyado en el suelo.

Los GLB individuales están en `src/assets/library/brumaluz-arboleda/objects/`, con las texturas y materiales incluidos. Se pueden importar directamente en otros editores compatibles con glTF.

`brumaluz-arboleda.blend` contiene las 30 colecciones marcadas como recursos de Blender. Cada hoja, tabla, frasco, herraje, rama y nervadura conserva su nombre y se puede editar. Los desplazamientos de instancia de las colecciones compensan la distribución de la galería.

## Contenido

| Grupo | Modelos |
| --- | --- |
| Edificios (5) | Casa Brote del Alba, Alquimería del Rocío, Pabellón del Manantial, Atalaya de las Copas, Invernadero de Lunhelecho |
| Construcción (3) | Umbral de las Dos Ramas, Puente de Raíz Trenzada, Valla de Sarmientos de 2 m |
| Mobiliario (4) | Silla Hoja de Laurel, Banco de Ramas Gemelas, Lecho del Sueño Verde, Armario del Guardasemillas |
| Alquimia (7) | Mesa de la Transmutación, Estantería del Herbario, Caldero de Savia Lunar, Alambique de la Espiral, Esfera de las Tres Lunas, Secadero de Hierbas, Bandeja de Elixires |
| Decoración (4) | Farola Capullo de Luciérnagas, Fuente del Loto Esmeralda, Menhir del Pacto Verde, Jardinera de Flores Lunares |
| Naturaleza (7) | Roble Ancestral, Sauce de la Memoria, Serbal de los Brotes, Macizo de Helechos, Setas de Luna, Cristales de Rocío, Flores Estrella del Claro |

Los edificios son piezas de exterior. Para atravesar el portal, el puente o el pabellón, ajusta su colisión en el editor: la colisión automática usa una caja que abarca el modelo completo. Usa `ninguna` y coloca colisionadores manuales donde convenga.

## Formato y reconstrucción

- Blender: metros, Z arriba, frente −Y. GLB: Y arriba, frente +Z.
- Una malla y un material por modelo, atlas pintado, mapas de metal/rugosidad y emisión suave de los faroles. Sin dependencias de texturas externas.
- Semilla y geometría deterministas; sin modelos descargados ni recursos de terceros. El paquete no hereda la licencia CC0 de los packs importados.
- `npm run art:arboleda`: reconstruye Blender, GLB, atlas, renders y catálogo. Requiere Blender 5.2 o configurar `BLENDER_PATH`.
- `node tools/build-arboleda.mjs --skip-render` y `node tools/register-arboleda.mjs`: reconstrucción sin renders.
- `npm run test:arboleda`: verifica fuente editable, catálogo, texturas, límites, origen, geometría y presupuesto de triángulos.
- `node tools/review-hamlet.mjs --arboleda`: carga los modelos con el cargador real y revisa su colocación en el editor; guarda capturas e informe en `review/`.

La vista general está en `arboleda-collection.png`. También se incluyen seis renders de detalle.

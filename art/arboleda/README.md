# Arboleda · Cuna de los Elfos

30 modelos originales construidos en Blender para la arboleda natal de los elfos de Brumaluz. Madera viva, piedra lunar, tejas de hoja, herrajes dorados y alquimia botánica. Geometría estilizada coherente con el juego.

## Revisión 2 · superficies y uniones

Los cuatro tejados de hojas se han rehecho con una curva común para la base y las tejas, juntas entre sectores, relieves con espesor y nervaduras ajustadas a cada teja. Se han cerrado las costuras de los aros, unificado los arcos ojivales, limpiado las puntas degeneradas y separado las trenzas del banco, puente y valla. Las hojas pequeñas ahora tienen espesor proporcional a su tamaño.

La auditoría de los 30 modelos comprueba triángulos degenerados, solapamientos coplanares expuestos y cruces entre tejas o contra su base. El resultado está en `review/surface-audit.json`, con el diagnóstico anterior en `review/surface-audit-before.json`. Las intersecciones estructurales de ramas y herrajes se conservan.

La revisión anterior tenía 394 triángulos degenerados y 21 pares de triángulos coplanares expuestos. La revisión 2 registra cero en ambas comprobaciones, cero aristas abiertas o no manifold y cero cruces de tejas. La detección coplanar usa una tolerancia de 0,4 mm y un área mínima de 0,2 mm².

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
- Geometría determinista; sin modelos descargados ni recursos de terceros. El paquete no hereda la licencia CC0 de los packs importados.
- `npm run art:arboleda`: reconstruye Blender, GLB, atlas, renders y catálogo. Requiere Blender 5.2 o configurar `BLENDER_PATH`.
- `node tools/build-arboleda.mjs --skip-render` y `node tools/register-arboleda.mjs`: reconstrucción sin renders.
- `node tools/build-arboleda.mjs --render-only`: actualiza los renders desde el Blender guardado. Admite `--asset=house_leafhaven` para un detalle individual.
- `npm run test:arboleda`: verifica fuente editable, catálogo, texturas, límites, origen, triángulos exportados, presupuesto de geometría y auditoría de solapamientos en Blender.
- `node tools/review-hamlet.mjs --arboleda`: carga los modelos con el cargador real y revisa su colocación en el editor; guarda capturas e informe en `review/`.
- `node tools/review-arboleda-surfaces.mjs`: genera 32 vistas WebGL de tejados y uniones con distintas orientaciones y distancias, usando los rangos de profundidad del juego y del editor.

La vista general está en `arboleda-collection.png`. También se incluyen renders de detalle y las hojas de revisión `review/roofs-orbit.png` y `review/joinery-orbit.png`.

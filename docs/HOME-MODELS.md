# Brumaluz · Un rincón propio: revisión del 2 de noviembre de 2026

El usuario solicita mejorar profundamente los doce modelos de esta colección,
incluyendo texturas externas cuando ayuden, y corregir popping, solapamientos y
flickering. Se conserva la identidad artesanal y acogedora de Brumaluz, los IDs,
las seis calidades, las recetas y las dimensiones de colocación ya utilizadas
por cliente y servidor. No se sustituyen colecciones de otras regiones.

## Modelado y materiales

`src/world/homeFurniture.ts` construye dieciocho modelos. Cada mueble contiene una
malla indexada, un material y una pasada de dibujo, sin cambios de nivel de
detalle según la distancia. Las formas curvas conservan sus normales suaves;
las tablas tienen cantos redondeados y la veta sigue sus ejes locales.
Se filtran triángulos degenerados y superficies exactamente duplicadas.

| Pieza | Revisión |
| --- | --- |
| Taburete | Asiento continuo ahuecado, patas abiertas y travesaños; asiento a 0,59 m. |
| Mesa | Cuatro tablas, testas, espigas, clavijas, faldón y chambranas. |
| Biblioteca | Cornisa escalonada, trasera alistonada, baldas, libros encuadernados y mantas. |
| Banco de trabajo | Tablero ensamblado, prensa, formones, garlopa, plano y balda inferior. |
| Silla | Asiento y respaldo textiles, patas torneadas y travesaños; asiento a 0,48 m. |
| Banco | Cojín continuo, botones, reposabrazos y patas torneadas; asiento a 0,55 m. |
| Mesita | Tablero redondeado, pedestal torneado y tres apoyos. |
| Arcón | Bóveda cerrada, flejes exteriores, remaches, cerradura y asas. |
| Alfombra | Tejido y dibujo en la misma superficie, cantos suaves y 32 flecos. |
| Farol | Base y cubierta de forja, paneles luminosos de ámbar, montantes y anilla. |
| Macetero | Cerámica torneada con interior, tierra, tallos y hojas redondas volumétricas. |
| Biombo | Tres bastidores plegados, paños de lino, zócalos y bisagras. |

La ampliación posterior añade butaca de las tardes, aparador de la vajilla,
escritorio de cartas, perchero de bienvenida, costurero de los ovillos y
jardinera de aromáticas. Incorpora bordados, tallas, cerámica pintada, mimbre,
encuadernaciones y mantas con caída a la colección anterior. Las seis familias
nuevas tienen sus seis calidades, iconos, recetas y huellas de colocación; la
butaca admite sentarse a 0,49 m. Son 36 recetas nuevas de Ebanistería, siguiendo
las reglas de rangos y tiempos existentes. SQL preparado localmente, sin aplicar
a cuentas o servidores remotos.

`homeFurnitureMaterial.ts` comparte tres imágenes de 2048 × 2048: color,
AO/rugosidad/metal y emisión. Cada región de 512 px tiene 16 px de margen para
el filtrado. Se utilizan mipmaps, filtrado lineal y anisotropía. No hay ruido
de shader dependiente del tiempo ni transparencia ordenada por distancia.
La emisión del farol se apaga junto con su luz doméstica.

Las texturas se decodifican antes de mostrar el mapa. Mover muebles, cambiar
su orientación o refrescar su estado conserva las mallas existentes. La
previsualización usa profundidad opaca y tinte de validez; oculta temporalmente
el original mientras se mueve para que no compita consigo mismo. Cancelar restaura
el original. Las texturas compartidas no se liberan al retirar una pieza.

## Fuentes y reproducción

- [Wood Table 001](https://polyhaven.com/a/wood_table_001): Dimitrios Savva y Rico Cilliers.
- [Rough Linen](https://polyhaven.com/a/rough_linen): colormass y Rico Cilliers.
- [Licencia CC0](https://polyhaven.com/license). Powered by Poly Haven.

Se descargan mapas Diffuse y Rough de 1K, se verifican contra el MD5 de su API y
se conservan localmente en `.art-sources/brumaluz-home/`. Los SHA-256, fuentes,
autores y operaciones figuran en
`src/assets/library/brumaluz-home/textures/sources.json`. Los atlas preparados
se incluyen con el proyecto. El juego y los editores no consultan servicios
externos para estas texturas. El dibujo de la alfombra es propio.

```powershell
npm.cmd run art:home:textures  # prepara atlas; descarga solo si falta la copia local
npm.cmd run art:home           # exporta los GLB y su catálogo con los atlas existentes
npm.cmd run test:home:models
npm.cmd run review:home:models
node tools/render-home-gallery.mjs
```

El exportador escribe POSITION, NORMAL, TEXCOORD_0 y COLOR_0 directamente desde
la geometría del juego, con imágenes incrustadas y material PBR opaco. Los
scripts anteriores de iconos/Blender generan ilustraciones de inventario;
no son la fuente de estos GLB. No ejecutar parches antiguos de texto sobre
`resourceModels.ts` para cambiar el mobiliario.

## Verificación

`test:home:models` revisa las 108 combinaciones de familia/calidad: números finitos,
normales unitarias, huella, altura, triángulos degenerados o duplicados y
presupuesto inferior a 24.000 triángulos. Comprueba además los hashes del catálogo,
los materiales opacos y la igualdad exacta de geometría/UV entre GLB y juego.

`review:home:models` carga los dieciocho GLB en el visor real de recursos, comprueba
las miniaturas del editor de mapas y coloca copias locales en Casa del Olmo con
la validación de colocación real. Revisa reutilización de modelos, movimiento,
previsualización, cancelación y encendido, tanto con gráficos compatibles como
con gráficos normales y sombras. Para cada calidad, comprueba quince
combinaciones de ángulo/distancia, topología constante y repetición idéntica de
un fotograma estático. Capturas e informe en `art/home-model-review/`.

Son comprobaciones locales con datos ficticios, sin guardar mapas ni modificar
cuentas o bases de datos reales. La repetición de fotogramas y el examen visual
no equivalen a garantizar ausencia de artefactos en toda cámara, colocación,
GPU o configuración gráfica posible.

La compilación completa destapó dos supuestos incorrectos previos en los
generadores: equipo creado en el editor sin rango de fabricación y consumibles
sin un efecto alimentario definido. El generador no inventa recetas para el
primero ni duración de efecto para los segundos. Sus definiciones se conservan.

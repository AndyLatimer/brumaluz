# Categoría 2 · versión original de ámbar

Ocho GLB recuperados de la versión anterior a la revisión de referencias Adventurers.
Se conservan las mallas, materiales, dimensiones y agarres originales; solo cambian los
identificadores y metadatos de categoría. La categoría 1 mantiene sus modelos actuales.

| Archivo | Clase / ranura |
| --- | --- |
| espada_cobre_t2.glb | Guerrero / arma |
| escudo_roble_t2.glb | Guerrero / mano secundaria |
| baston_ambar_t2.glb | Mago / arma |
| daga_cazador_t2.glb | Pícaro / arma |
| daga_secundaria_cazador_t2.glb | Pícaro / mano secundaria |
| varita_ambar_t2.glb | Clérigo / arma |
| grimorio_verde_t2.glb | Clérigo / mano secundaria |
| ballesta_roble_t2.glb | Explorador / arma |

Todos incluyen sus materiales y se pueden importar por separado. El origen coincide
con el agarre utilizado por sus equivalentes de Adventurers. La integración del juego
conserva los anclajes de cada mano y la orientación especial del libro.

La fuente procedural editable está en `tools/build-tier2-weapons.py`:
`blender --background --python tools/build-tier2-weapons.py` regenera los GLB,
la escena Blender y la imagen del conjunto dentro de esta carpeta.

`tools/recover-amber-weapons.mjs` documenta la recuperación desde el archivo local.
Los GLB entregados y el generador Blender no dependen de ese archivo para usarlos.

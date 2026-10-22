# Nuevas colecciones y acabado de armas

El catálogo contiene **88 armas**: se conservan las 64 anteriores y se añaden 24 modelos completos construidos en Blender, sin reutilizar la malla de otras armas.

| Colección | Rareza | Piezas |
| --- | --- | --- |
| Roble Errante | Verde, categoría 1 | 8 |
| Marea Real | Dorado, categoría 4 | 8 |
| Forja Estelar | Naranja, categoría 5 | 8 |

Cada colección incluye espada, escudo, bastón, dos dagas, varita, libro y ballesta. Son alternativas a los conjuntos de su categoría; sus estadísticas siguen el equilibrio existente. Están en el vendedor y en el visor de combate.

## Acabado de las 88 piezas

Se biselan selectivamente los cantos largos y duros, conservando las superficies facetadas, las texturas originales y las siluetas. Se añaden remaches y fijaciones pequeños proyectados sobre la superficie real de cada familia. Los identificadores, estadísticas, precios y coordenadas de agarre anteriores se conservan. Las armas iniciales tienen ahora GLB independientes; los archivos de la biblioteca Adventurers permanecen intactos.

- GLB: `src/assets/models/items/`, organizados por categoría y colección.
- Editable completo: `all_weapons_refined.blend`.
- Archivo de los originales: `.art-sources/weapon-quality-pass/before/`.
- Registro geométrico: `quality_report.json`.
- Catálogo y rutas: `weapon_manifest.json`.
- Paquete completo: `all_weapons_glb.zip`.

## Regeneración

Los generadores de colecciones construyen las mallas iniciales. Después se ejecuta `node tools/build-weapon-catalog.mjs` y Blender con `--background --python tools/refine-all-weapons.py`. El refinado lee siempre la copia original archivada para evitar acumular biseles o remaches en sucesivas ejecuciones. No ejecutar generadores de origen después del refinado sin volver a aplicar este último.

Esta pasada es visual. Los efectos activados por habilidades y la personalización siguen siendo parte del diseño descrito en WEAPONS.md; estas colecciones no añaden efectos de combate nuevos.

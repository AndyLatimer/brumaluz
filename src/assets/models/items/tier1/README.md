# Armas de categoría 1

Variantes low poly modeladas a partir de las mallas originales de KayKit Adventurers. Conservan sus contornos, biseles, degradados y coordenadas de agarre, con herrajes y acabados sencillos de primera mejora. El script crea un `.blend` maestro editable y un `.glb` por item. La procedencia y licencia están descritas en `ATTRIBUTION.md`.

## Generar los modelos

Con Blender instalado, desde la raíz del proyecto:

```powershell
blender --background --python tools/build-tier1-weapons.py
```

Los GLB y `tier1_weapons.blend` se escriben en esta carpeta. El set cubre las ocho piezas iniciales, incluida la daga de mano secundaria.

## Correspondencia de items

| Item | Clase / hueco | Modelo |
| --- | --- | --- |
| `espada_cobre_t1` | Guerrero / arma | Hoja ancha asimétrica, guarda de hierro, pasadores de cobre y cuero cosido |
| `escudo_roble_t1` | Guerrero / mano secundaria | Escudo curvado de roble con uniones de tablas, remaches y refuerzo central bajo |
| `baston_ambar_t1` | Mago / arma | Bastón de fresno con foco de ámbar y abrazaderas |
| `daga_cazador_t1` | Pícaro / arma | Hoja curva facetada, guarda remachada y costura de cuero |
| `daga_secundaria_cazador_t1` | Pícaro / mano secundaria | Daga corta a juego |
| `varita_ambar_t1` | Clérigo / arma | Madera tallada curva, empuñadura cosida y pequeño engaste de ámbar |
| `grimorio_verde_t1` | Clérigo / mano secundaria | Cuero verde, cierres originales, cantoneras, páginas y marcapáginas |
| `ballesta_roble_t1` | Explorador / arma | Culata perfilada, palas curvas originales, placas laterales y guías reforzadas |

Los ocho modelos están registrados como items equipables, con estadísticas de categoría 1 en `src/data/weapons.ts` y el catálogo SQL del servidor. El juego los carga con sus materiales y los monta en el mismo hueso que su arma inicial equivalente. Se pueden comparar en `/combat.html` con el selector de categoría. Consulta `docs/WEAPONS.md` para las cifras, disponibilidad y diseño en curso.

Cada export contiene una sola malla, un material y su textura PNG integrada, con entre 698 y 1559 triángulos. `tier1_preview.png` muestra el set, `tier1_reference_comparison.png` lo compara de cerca con los originales y `tier1_characters.png` muestra ambos conjuntos equipados. `armas_categoria_1.zip` reúne los ocho GLB.

La escena `.blend` conserva separados y nombrados los componentes de construcción, además de una cámara de revisión. El exportador reúne copias evaluadas de esas piezas en una malla y mantiene el origen de agarre; las transformaciones de presentación solo afectan a la escena editable.

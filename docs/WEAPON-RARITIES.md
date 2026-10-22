# Rarezas y progresión de armas

> Actualizado: 88 armas, con 24 modelos adicionales y acabado de todas las piezas. Ver [colecciones y refinado](WEAPON-QUALITY.md). Las cifras siguientes describen la entrega original.

La progresión principal tiene 48 armas: ocho piezas por escalón para las cinco clases. Se conservan los IDs, modelos, estadísticas y vínculos de las 24 armas iniciales de esta progresión. Los tres escalones superiores añaden 24 GLB creados en Blender a partir de los modelos detallados de categoría 1. Además hay [16 armas con modelos originales completos](ORIGINAL-WEAPONS.md), alternativas azules y moradas: 64 armas en total.

| Categoría | Rareza | Color | Conjunto |
|---|---|---|---|
| 0 | Común | Gris | Principiante |
| 1 | Poco común | Verde | Artesano |
| 2 | Raro | Azul | Ámbar recuperado |
| 3 | Épico | Morado | Sello Violeta |
| 4 | Legendario | Dorado | Aurora |
| 5 | Artefacto | Naranja especial | Fuego Primigenio |

En esta progresión cada categoría de arma corresponde a una rareza. El color no añade multiplicadores: el arma ya incluye sus valores finales. Los consumibles y el objeto de misión existentes se clasifican como comunes. La rareza aparece en iconos, bordes, fichas y tienda, con texto además del color.

## Estadísticas a nivel 1, habilidad de rango 1

| Familia | Gris | Verde | Azul | Morado | Dorado | Naranja |
|---|---:|---:|---:|---:|---:|---:|
| Espada, bastón, ballesta: daño | 10 | 11 | 12 | 14 | 17 | 21 |
| Daga principal: daño | 8 | 9 | 10 | 12 | 15 | 19 |
| Escudo o daga secundaria: guardia | 1 | 2 | 3 | 4 | 5 | 6 |
| Varita: daño | 11 | 12 | 13 | 15 | 18 | 22 |
| Varita: curación | 30 | 33 | 36 | 41 | 48 | 57 |
| Libro: curación adicional | 2 | 3 | 4 | 5 | 6 | 7 |
| Curación del conjunto completo | 32 | 36 | 40 | 46 | 54 | 64 |

Daño básico: `round(poder del arma × (1 + 0,05 × (nivel − 1)))`. Las habilidades mantienen sus coeficientes de rango y escalan respecto al arma inicial. Costes, recargas y número de impactos no cambian. Corte doble da dos impactos y cobra una sola vez; la daga secundaria aporta guardia.

Curación: varita + libro + 4 × (rango − 1), sin sobrecuración. Guardia reduce los golpes cuerpo a cuerpo con un mínimo de 1: no concede inmunidad ni resistencia mágica. Solo contribuyen piezas de la clase correcta, en su ranura y con cantidad 1. Equipar otra arma no reinicia recargas ni rellena recursos.

## Obtención provisional

Testículos ofrece los cinco conjuntos mejorados para que puedan obtenerse con los sistemas actuales. Precios por pieza: verde 60–110, azul 120–220, morado 240–440, dorado 720–1320 y naranja 2160–3960 pelines. El vendedor paga la mitad. Equipo mejorado comerciable y no apilable; equipo inicial ligado.

La distribución definitiva entre herreros, misiones y botines sigue pendiente de diseño. La rareza no implica una probabilidad de botín implementada. No se cambia el botín de la sombra, ni la experiencia, los atributos, comida, grupos o regeneración.

## Fuentes y archivos

- `src/data/itemRarity.ts`: nombres, colores y correspondencia con las categorías.
- `src/data/weaponProgression.json`: familias, nombres, precios, incrementos y paletas compartidos por juego y Blender.
- `tools/build-weapon-progression.py`: importa los GLB detallados, conserva UV y agarres y añade engastes, runas, focos y herrajes específicos por familia y escalón.
- `src/assets/models/items/tier3/`, `tier4/`, `tier5/`: 24 GLB, una malla y un material de atlas integrado por pieza.
- `src/assets/models/items/weapon_progression.blend`: maestro con las piezas de construcción editables.
- `src/assets/models/items/weapon_progression.png` y `item_rarities.png`: hojas de arte.
- `tools/build-weapon-catalog.mjs`: genera estadísticas, rarezas, precios y mercancía SQL desde los datos del cliente. El servidor aplica su catálogo y nunca acepta cifras enviadas por el cliente.

`/combat.html` permite seleccionar las cinco clases y los seis escalones con sus modelos y cifras de juego.

Base artística: KayKit Adventurers 2.0 FREE, Kay Lousberg, CC0. Los originales de la biblioteca permanecen intactos.

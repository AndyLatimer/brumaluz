# Armas y equipo · primera iteración

> Actualizado: 88 armas, con 24 modelos adicionales y acabado de todas las piezas. Ver [colecciones y refinado](WEAPON-QUALITY.md). Las cifras siguientes describen la entrega original.

Decisiones confirmadas: seis escalones, **común gris → poco común verde → raro azul → épico morado → legendario dorado → artefacto naranja especial**. Se mantienen los tres conjuntos anteriores y se añaden tres nuevos: 48 armas en total. La tabla completa, modelos y obtención están en [WEAPON-RARITIES.md](WEAPON-RARITIES.md). El sistema crecerá en tres direcciones: atributos del personaje, efectos por familia y personalización. **Los efectos propios de las armas se activarán con habilidades, de forma predecible.** Los números son un primer equilibrio revisable.

## Implementado

Los 48 items están registrados en cliente y servidor. Las piezas nuevas usan sus GLB propios y los mismos anclajes que sus equivalentes Adventurers. Los principiantes conservan sus valores anteriores. Guardia funciona para escudos y dagas secundarias. Los modelos y estadísticas de categorías 0–2 se conservan; las siguientes añaden los conjuntos Sello Violeta, Aurora y Fuego Primigenio.

| Pieza | Categoría 0 | Categoría 1 | Categoría 2 | Estadística |
| --- | ---: | ---: | ---: | --- |
| Espada | 10 | 11 | 12 | Daño base |
| Escudo | 1 | 2 | 3 | Guardia |
| Bastón | 10 | 11 | 12 | Daño base |
| Daga principal | 8 | 9 | 10 | Daño base |
| Daga secundaria | 1 | 2 | 3 | Guardia |
| Varita | 11 / 30 | 12 / 33 | 13 / 36 | Daño base / poder de curación |
| Libro | +2 | +3 | +4 | Poder de curación |
| Ballesta | 10 | 11 | 12 | Daño base |

El ataque básico usa `round(daño del arma × (1 + 0,05 × (nivel − 1)))`. La categoría corresponde a la rareza en esta progresión de armas; no añade una bonificación aparte ni equivale al nivel del personaje.

Las habilidades ofensivas conservan su fórmula de rango, multiplicada por `poder del arma / poder de principiante`. Así, mejoran junto al arma sin reducir costes o recargas. Corte doble sigue dando dos impactos y cobra una sola vez. Su segunda daga aporta guardia en esta primera iteración; no añade un tercer golpe ni duplica el daño.

Curación usa `poder de la varita + poder del libro + 4 × (rango − 1)`: 32 con categoría 0, 36 con categoría 1 y 40 con categoría 2, en rango 1. Requiere una varita de la clase. El libro se puede desequipar: entonces desaparece su contribución. No produce sobrecuración.

Guardia resta su valor a cada golpe cuerpo a cuerpo del enemigo, con mínimo de 1 de daño. Un golpe de 8 pasa a 7 con categoría 0, a 6 con categoría 1 y a 5 con categoría 2. Se aplica antes de absorber sobrecuración y después se descuenta vida. No protege contra magia ni aumenta la vida máxima. No es una probabilidad de bloqueo. El ataque actual de la sombra es cuerpo a cuerpo.

Solo cuentan piezas de la clase correcta, en su ranura y con cantidad 1. El servidor consulta su propio catálogo; no acepta estadísticas enviadas por el cliente. Cambiar equipo conserva las recargas y los recursos actuales. Las mejoras no alteran nivel, experiencia, atributos asignados, comida, bonificación de grupo ni regeneración.

## Cómo probarlo y obtenerlo

`npm run dev` y abrir `/combat.html`: seleccionar clase y categoría. Cambian las armas visibles, las cifras del panel y el combate local. Es una prueba sin cuenta, recompensas ni guardado.

En el juego, Testículos incorpora las ocho piezas de categoría 1 a su mercancía con precios provisionales de 60–110 pelines y las ocho de categoría 2 por 120–220 pelines. Son comerciables, vendibles y no se apilan; el equipo inicial sigue ligado y no se vende. Estos precios y ese punto de venta son revisables cuando diseñemos el herrero, las misiones y los botines. No se ha añadido un botín nuevo a la sombra.

El generador `tools/build-weapon-catalog.mjs` mantiene estadísticas, rarezas, precios y mercancía del servidor sincronizados con el cliente. Los conjuntos nuevos también están en la tienda provisional; véase [WEAPON-RARITIES.md](WEAPON-RARITIES.md).

## Diseño conjunto: propuestas pendientes

Las siguientes son propuestas, **todavía no se calculan en combate**. No hay runas equipables ni efectos aleatorios escondidos en los items actuales.

### 1. Atributos del personaje

Usaremos los atributos existentes para evitar duplicar estadísticas:

| Atributo | Papel propuesto | Decisión por concretar |
| --- | --- | --- |
| Fuerza | Potencia física de espada y ataques pesados | Peso en armas ágiles y a distancia |
| Agilidad | Dagas, movilidad y manejo de ballesta | Potencia o velocidad; evitar dar ambas al principio |
| Intelecto | Potencia de bastón, varita y curación | Coeficiente compartido o diferente para curar |
| Pericia | Consistencia, manejo y efectos del arma | Precisión o probabilidad de crítico |
| Percepción | Puntería, detección y disparo preciso | Cómo se diferencia de pericia |
| Corpulencia | Vida y estamina, como ahora | Si también mitiga daño o solo sostiene al personaje |
| Presencia | Apoyo y efectos sociales | Interacciones de grupo sin convertirla en otro intelecto |

Antes de fijar coeficientes compararemos personajes del mismo nivel y arma, y luego repetiremos con distinta categoría. La suma de categoría, atributos y personalización necesita un presupuesto para que las mejoras no se multipliquen sin control. Los puntos raciales deben entrar en esa comparación.

### 2. Identidad y efectos de las familias

| Familia | Efecto candidato | Relación con habilidades |
| --- | --- | --- |
| Espada y escudo | Bloqueo activo o apertura defensiva | Golpe contundente podría aprovechar una apertura |
| Dagas | Sangrado corto o ventaja al flanquear | Corte doble no debería duplicar una activación por golpe sin límite |
| Bastón | Carga arcana | Descarga podría consumirla en vez de sumar daño gratis |
| Varita y libro | Eficiencia o protección al curar | Debe respetar coste, recarga y límite de sobrecuración |
| Ballesta | Puntería sostenida o impacto penetrante | Disparo preciso podría aprovechar una preparación |

Conviene empezar por **un efecto comprensible por familia**. Su activación al usar la habilidad está confirmada: no dependerá de una probabilidad al golpear. Frecuencia, duración, acumulación y resistencia del enemigo se diseñan juntos. La recarga de la habilidad será la primera limitación de frecuencia. En Corte doble habrá como máximo una activación por uso, aunque produzca dos impactos. Los efectos concretos de la tabla siguen siendo candidatos; no se han fijado aún sus valores ni inmunidades.

### 3. Runas, gemas y encantamientos

Propuesta: una mejora instalada por pieza en categorías bajas, con opciones que cambien su uso. Una gema podría cambiar afinidad; una runa modificar una condición del efecto; un encantamiento mejorar una estadística dentro del presupuesto. No ofreceremos tres multiplicadores de daño independientes al mismo tiempo.

Antes de implementarlo hay que acordar obtención, coste, reemplazo y vínculo. Los objetos actuales guardan solo `{id,count,bound}`: personalizar cada ejemplar exige identidad propia y metadatos validados por el servidor. Habrá que actualizar inventario, banco, comercio, guardado y ofertas para conservar la mejora al mover el objeto. No se deben aceptar bonos arbitrarios desde el navegador.

## Fuente de números y arte

- `src/data/weapons.ts`: estadísticas y compatibilidad de las piezas.
- `tools/build-weapon-catalog.mjs`: regenera `supabase/server/05-weapon-stats.sql` con esos números.
- `src/data/items.ts` y `supabase/server/05-items-vendors.sql`: presentación, precios y disponibilidad.
- `tools/build-tier1-weapons.py`: parte de las mallas CC0 de Adventurers, mantiene sus biseles y UV y añade detalles modestos de construcción. Genera los ocho GLB con una malla, un material y textura integrada por pieza; el maestro Blender conserva los componentes separados para editarlos.
- `tools/review-weapons.mjs`: comprueba los agarres sobre los personajes y genera las comparativas del equipo y de los modelos originales frente a sus mejoras.
- `src/assets/models/items/tier1/`: exports y archivos de revisión.
- `src/assets/models/items/tier2/`: ocho GLB de ámbar recuperados, ZIP y comparativa sobre personajes con la túnica base.
- `tools/build-tier2-weapons.py`: fuente procedural Blender de la versión original, con IDs de categoría 2 y salida separada.
- `tools/recover-amber-weapons.mjs`: recuperación desde el archivo anterior sin alterar los buffers de mallas y materiales.

El siguiente paso de diseño es escoger el primer efecto de cada familia, ya con activación por habilidad confirmada; después podremos distribuir el peso entre atributo y arma y diseñar una primera runa sobre una mecánica ya definida.

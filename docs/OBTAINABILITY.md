# Obtención de materiales y primera mejora

27 de octubre de 2026. El usuario aplaza el paso 1 de la revisión MMORPG y prioriza cerrar la obtención. Para los cueros superiores elige **ambas vías**, criaturas de dificultad creciente y transformación en Peletería, pidiendo que transformar cueste más trabajo. La continuación después de Isberto sigue aplazada.

**Cambio posterior del mismo día:** [Recetas y maestros](RECIPE-TRAINING.md) sustituye las reglas de aprendizaje de esta primera etapa: compra exclusivamente al maestro y precios mayores. Solo las recetas naranjas son botín muy raro. Quedan sustituidas las menciones siguientes a 2 Pelines, aprendizaje desde el libro y primera receta verde garantizada. Las fuentes de cuero y las preparaciones se conservan; Gran maestro necesita su pergamino excepcional.

Ese cambio posterior ya está aplicado y verificado en el servidor. Su despliegue, precios y medición de ritmo se registran en el documento enlazado y en `art/recipe-training-review/deployment.json`; el registro de obtención de este documento conserva la historia de la primera etapa.

**Corrección de la pasada de ritmo:** el combate compartido usaba 90 s para todas las reapariciones, aunque el catálogo ya fijaba 210–330 s para los jabalíes superiores. Se ha corregido `game_wilderness_finish` para consultar el tiempo de cada emplazamiento. Las 14 criaturas tienen una prueba de ausencia de reaparición anticipada, reaparición en el límite e idempotencia al resolver la muerte. El parche instalado cambia solo ese cálculo y conserva los demás cambios de la función publicada, personajes y estados de criaturas. Copia de reversión y verificación en `art/recipe-training-review/respawn-deployment.json`.

## Reglas de esta implementación

- Se mantienen los cueros básicos de los enemigos existentes. Se añaden cinco jabalíes territoriales solitarios en Pompelín, uno por rango superior, cerca de las zonas de recursos de ese rango. No se colocan enemigos dentro de ciudades, accesos, agua o reservas de ciudades futuras.
- Los nuevos perfiles reutilizan el modelo y comportamiento del jabalí. Tienen mayor nivel, vida, daño y Guardia; entregan dos cueros de su rango y uno del anterior. Son fuentes directas y garantizadas al obtener el botín con las reglas normales de participación.
- Peletería permite preparar un cuero superior con **4 cueros del rango anterior y 2 hierbas del rango de destino**. Se aprende en su taller por 2 Pelines al alcanzar el rango correspondiente. El aprendizaje no necesita un pergamino aleatorio.
- Preparar un cuero ocupa uno de los cinco trabajos del oficio. Su tiempo base es de **2/4/6/8/10 minutos**, según rango. Se conserva el descuento humano, el progreso sin conexión, la reserva de materiales, la cancelación con devolución y la recogida sin duplicados.
- La preparación concede experiencia normal de dificultad, sin el multiplicador `3^categoría` de fabricar equipo: a rango adecuado, 10 EXP por cuero. Cuenta como una práctica. No se modifican las recompensas de las recetas existentes.
- La transformación es deliberadamente más costosa en materiales: fabricar un cuero del rango máximo exclusivamente desde cuero básico exige 1.024 cueros básicos, además de hierbas y trabajos intermedios. Cazar directamente ofrece una alternativa; no es obligatorio convertir toda la cadena.
- Las preparaciones se enseñan en el taller; no entran en las tablas de descubrimiento ni desplazan la receta de equipo de un proyecto de maestría. Las recetas superiores de equipo siguen usando sus pergaminos.
- La primera receta de una victoria exterior es ahora de **arma principal verde de la clase**. Después se conserva la probabilidad y el conjunto de descubrimientos de equipo de clase. No se reinicia el indicador `firstRecipe` de personajes existentes ni se reparten recetas retroactivamente.
- Los requisitos de cuero del libro muestran el jabalí correspondiente y su nivel. Desde Pompelín permiten marcar su emplazamiento en el mapa. También indican la alternativa de Peletería.

Los costes, cantidades y estadísticas nuevas son valores iniciales de implementación para concretar las dos vías elegidas; su equilibrio a largo plazo requiere partidas. No se añaden misiones ni una profesión de Desuello.

| Cuero | Fuente directa | Nivel | Vida | Daño base | Guardia | Reaparición | Preparación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Iniciado | Jabalí robusto | 4 | 160 | 11 | 3 | 210 s | 4 cueros Aprendiz + 2 Hierbas de rocío; 2 min |
| Oficial | Jabalí de lomo recio | 9 | 300 | 19 | 6 | 240 s | 4 cueros Iniciado + 2 Flor azul; 4 min |
| Experto | Jabalí de colmillos largos | 16 | 550 | 30 | 10 | 270 s | 4 cueros Oficial + 2 Flores nocturnas; 6 min |
| Maestro | Jabalí de piel gruesa | 26 | 950 | 46 | 14 | 300 s | 4 cueros Experto + 2 Hierba solar; 8 min |
| Gran maestro | Jabalí de colmillos enormes | 38 | 1.500 | 65 | 18 | 330 s | 4 cueros Maestro + 2 Flor estelar; 10 min |

El nivel no es un requisito artificial para saquear: expresa la dificultad del enemigo. Se conservan la preparación de su ataque, el alcance, la cobertura y la posibilidad de retirarse. Los hábitats se hornean con las colisiones y el suelo reales.

## Primera arma fabricada

La primera receta exterior conduce a un arma de Herrería para guerrero/pícaro o Carpintería para mago/clérigo/explorador. Sus materiales son minerales o madera básicos y de Iniciado, más un componente del propio oficio. No pide cuero superior.

El recorrido comprobable es ganar monedas y la receta en combate, comprar/equipar el pico o hacha, reunir materiales, aprender el componente básico, practicar hasta Iniciado, aprender la receta obtenida y fabricar el arma. Sigue exigiendo trabajo de oficio y recursos. No entrega el arma terminada ni elimina el aprendizaje.

## Auditoría y mantenimiento

`npm run audit:obtainability` examina las fuentes activas de recolección, combate exterior y fabricación. Calcula las dependencias hasta que no aparecen nuevos resultados obtenibles y falla si quedan ingredientes sin fuente. No cuenta expediciones retiradas, objetos de desarrollo ni comercio como creación de materiales.

El catálogo pasa de 436 a **441 recetas**. Conserva **541 definiciones adicionales, 216 nodos y las estaciones/posiciones previas**. La población exterior pasa de nueve criaturas de cinco tipos a **14 criaturas de diez perfiles**. Las 80 recetas antes afectadas por cueros superiores quedan abastecidas en el circuito revisado.

La auditoría de materiales no demuestra por sí sola accesibilidad de caminos, saldo suficiente, aprendizaje de todas las recetas, progresión de todos los oficios ni equilibrio. Esas garantías se revisan por separado. La primera arma de las cinco clases se comprueba además mediante RPC de oficio reales en PostgreSQL aislado; los combates se representan mediante sus resolvedores de recompensa, sin simular cada ataque.

Para regenerar únicamente recetas conservando colocaciones actuales:

```powershell
node tools/build-rpg-catalog.mjs --preserve-placements
```

Para cambiar emplazamientos de criaturas, editar `src/data/wilderness.json` y hornear de nuevo con `node tools/build-wilderness-habitats.mjs`, seguido de `node tools/build-wilderness.mjs`. No es necesario volver a distribuir recursos ni publicar mapas. Las criaturas no son objetos editables del mapa: sus ubicaciones y hábitats pertenecen al catálogo exterior.

## Comprobación y servidor

Resultado local: las once pruebas de obtención, recolección e IA pasan sin omisiones. La prueba de primera arma incluye equiparla con las reglas del cliente y comprobar que mejora el daño. TypeScript y la compilación de producción terminan correctamente. La revisión del navegador completa aprendizaje, encargo, marcador de fuente, selección de los nuevos jabalíes e interior en el editor, sin errores; a 390 px se comprueba que los controles se alcanzan al desplazar la ficha. El informe y las capturas se conservan en `art/obtainability-review/`.

- `npm run test:obtainability`: fuentes independientes de caza y transformación, aprendizaje por rango, consumos atómicos, temporizador, experiencia, cancelación, reintentos y conservación de datos al preparar la migración. Incluye un recorrido de primera arma para cada clase sin regalar sus materiales.
- `node --test scripts/test-professions-sql-local.mjs scripts/test-wilderness-ai.mjs`: recolección y navegación/IA existentes con la población ampliada.
- `npm run review:obtainability`: juego real, receta y materiales en escritorio/móvil, marcador de fuente, nuevos jabalíes e interior de Peletería en el editor. Las capturas y el informe se guardan en `art/obtainability-review/`.
- `npx tsc --noEmit` y `npm --ignore-scripts run build`: tipos y distribución sin regenerar ubicaciones.

`node tools/build-obtainability-patch.mjs` prepara `art/obtainability-review/server-patch.sql`. Es una transacción limitada a los dos catálogos, el cálculo de experiencia por receta, conciliación de trabajos, la acción de oficio, el botín inicial y el alta de las cinco criaturas nuevas. Conserva permisos, personajes y criaturas existentes, incluidos vida, cadáveres y generaciones; no migra mapas ni reinicia combates. Requiere la base anterior de oficios e IA ya instalada.

## Aplicación al servidor

El 27 de octubre, al pedir el usuario el siguiente paso tras dejar preparado el parche, se aplicó con `node scripts/apply-obtainability-patch.mjs --apply` a la base configurada. La comprobación previa verificó que las tres funciones de comportamiento correspondían a las versiones anteriores esperadas y que las posiciones de recursos y talleres coincidían con el cliente revisado.

Se instalaron seis funciones, incluidas las dos funciones de catálogo, y se añadieron cinco criaturas. La población queda en **14 criaturas** y el catálogo en **441 recetas**. Se conservaron íntegramente las nueve instancias anteriores, incluida una en combate: estado, vida, participantes, generación y revisión. No se modificaron personajes, mapas ni posiciones de recursos.

El script combina las cinco recetas, descripciones de cuero y perfiles nuevos con los catálogos reales del servidor, conservando las demás entradas. Antes de aplicar guarda las definiciones, permisos e instancias anteriores y prepara SQL de reversión. La reversión exige que las criaturas nuevas no estén combatiendo; restaura las reglas anteriores sin rebobinar el progreso de personajes o encuentros existentes.

`art/obtainability-review/deployment.json` registra el resultado y las rutas de copia y reversión. `node scripts/apply-obtainability-patch.mjs --verify` confirma en modo de solo lectura que están las cinco criaturas nuevas, los catálogos y funciones esperados y sus permisos. La comparación de los catálogos usa su contenido, no el orden de las claves JSON.

**Estado de publicación:** servidor actualizado y verificado; cliente preparado en `dist/`, todavía sin publicar en un alojamiento web. No se ha encontrado una vinculación local de Vercel ni credenciales de despliegue de ese proveedor. El README describe una futura conexión con GitHub/Vercel; no se ha hecho un commit o push de los cambios existentes para desencadenarla. Las pruebas aisladas y la verificación del servidor no acreditan balance ni rendimiento de una partida en producción.

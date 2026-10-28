# Pompelín

El exterior representa las murallas de Brumaluz y sus cinco puertas cerradas (`gateClosed: true`). Las hojas se cierran por instancia, con colisión sólida, sin modificar las puertas abiertas del mapa interior. Las posiciones de viaje siguen siendo las originales; cada entrada usa proximidad (`walk`) y la llegada exterior queda 14 m por delante, fuera del radio del portal. La planta conserva la orientación de las puertas del mapa interior, a la escala del continente. No se copian las casillas ni los barrios en miniatura.

El paisaje conserva las 32 montañas originales de las Cumbres de Cobre, las poblaciones, la costa y el río. El terreno aporta colinas suaves; los picos de roca usan las piezas del mismo conjunto visual. Arboledas con claros, árboles de ribera, flores, roquedos, bancos, faroles y señales acompañan los caminos. Las orillas descienden gradualmente hasta el agua.

El cruce del río en `[345.625, 281.875]` tiene un puente perpendicular al cauce, barandillas de roble, faroles y accesos adaptados. Su superficie de colisión sigue el arco real del tablero y las protecciones laterales bloquean también durante los saltos bajos. El puente explícitamente transitable permite pasar sobre el agua sin nadar. Las demás plataformas mantienen sus límites de altura. Los desplazamientos largos ya no pueden saltarse un muro después de una colisión intermedia; las vallas de roble conservan su planta rectangular en lugar de confundirse con troncos.

El terreno grande se dibuja en parches; la hierba tiene parches propios y desaparece gradualmente a distancia. El editor y la captura del atlas pueden revelar el mapa completo.

## La Arboleda

Se ha consultado `LORE.md` y la dirección artística de `art/arboleda/README.md`: tierra de los elfos, naturaleza, alquimia botánica y magia discreta. El exterior tiene copas continuas de frondosas, sotobosque y senderos. Predominan árboles de 988–1560 triángulos; los 24 robles ancestrales y las plantas de mayor detalle se reservan para acentos. Los árboles que tapan al personaje se atenúan con el sistema de oclusión existente.

`src/data/arboleda.ts` fija la región y la reserva de llegada de 15 m en `[625, -195]`, conectada al camino existente. Su futuro mapa de ciudad aún no se crea. La reserva es una nota del editor, sin portal activo ni edificios provisionales. `tools/pompelin-arboleda.mjs` genera sus capas separadas sin mover recursos, regiones o poblaciones.

`node tools/audit-arboleda-forest.mjs` comprueba la cubierta de copas, la composición de frondosas, los 34 recursos regionales y la llegada. El informe está en `art/pompelin-review/arboleda-forest-audit.json`.

## Reproducir y comprobar

- `npm run world:pompelin`: recalcula el terreno desde la plantilla, regenera las capas `paisaje_*`, publica el borrador para el juego y actualiza exclusivamente la geometría de Pompelín en el SQL. Es determinista para terreno, objetos, marcadores y ajustes. Conserva los demás objetos salvo el antiguo exterior de Brumaluz, y mantiene los puntos de recursos y enemigos.
- `npm run test:pompelin`: comprueba geografía, puertas, terreno, hierba, puente y colisiones; incluye una auditoría de los 216 recursos y las cinco zonas de enemigos contra las colisiones reales.
- `npm run review:pompelin`: capturas del renderizador del mapa y del juego real. Requiere Chromium/Edge de Playwright.
- `npm --ignore-scripts run build`: compila los cambios sin regenerar catálogos y emplazamientos de RPG.

El informe reproducible está en `art/pompelin-review/geography-collision-audit.json`. Las capturas de la revisión final incluyen `puerta-en-juego.png`, `capital-en-juego.png`, `cumbres-restauradas.png`, `ribera.png` y `puente-del-camino.png`. Las primeras capturas del paisaje descartado están separadas en `antes/`.

`tools/rpg-map-blockers.mjs` comparte las reglas de obstáculos entre la publicación del paisaje y la generación completa del RPG: las alturas de Pompelín se miden respecto al terreno y el centro del puente queda libre.

Los cambios de `supabase/server/18a-rpg-geometry.sql` están preparados en el repositorio. Esta revisión no aplica SQL a una base de datos remota.

## Arranque del editor

`vite.config.ts` separa la caché de dependencias por proceso y preoptimiza los controles de Three. Las herramientas y pruebas que arrancan otros servidores dejan de invalidar las dependencias de una pestaña abierta. `maps.html` carga el CSS directamente y muestra un aviso si falla el módulo de arranque, en vez de quedarse como HTML sin estilos.

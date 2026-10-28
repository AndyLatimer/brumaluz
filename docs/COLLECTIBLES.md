# Coleccionables de exploración

Decisión confirmada el 27 de octubre de 2026: durante esta etapa están disponibles
los dos tipos actuales, **bolsas de pelines** y **polvos de hada**.

- Brumaluz parte de dos bolsas y dos montones de polvo. El editor permite añadir,
  mover y eliminar ambos tipos mediante **Añadir coleccionables** en el catálogo
  (o la herramienta ✦, tecla **L**). Se elige el tipo y se hace clic en el suelo;
  los modelos y el radio de recogida aparecen en la escena. Seleccionar permite
  moverlos y girarlos; Supr los elimina y Deshacer recupera el punto con su ID.
- **Guardar** conserva el borrador. **Publicar en el juego** genera conjuntamente
  `src/data/world/collectibles.json` y los catálogos de `supabase/world.sql`.
  Como con los portales, `npm run db:apply` aplica los cambios al servidor online.
  Guardar por sí solo no cambia el mundo publicado.
- Cada punto conserva su identificador al moverlo, renombrarlo o volver a publicar.
  Los cuatro identificadores iniciales se mantienen para conservar el progreso.
  Los nuevos puntos de otros mapas llevan un prefijo del mapa para evitar colisiones.
  Los marcadores ocultos o eliminados quedan fuera de los catálogos publicados.
- El juego usa ese catálogo para modelos, recogida y porcentajes. Los puntos solo
  aparecen en su mapa. Por ahora se agrupan en Brumaluz, y los del continente de
  Pompelín en Alrededores de Brumaluz; no se activan nuevas regiones.
- Cada hallazgo se recoge una vez por personaje. Recoger un tipo no altera el otro.
- La primera recogida de polvo que aún no tenga misión activa **Un polvo misterioso**:
  preguntar a Gnomi, quien orienta hacia La Arboleda. La continuación queda pendiente;
  las siguientes recogidas no reinician el hilo. Véase [QUESTS.md](./QUESTS.md).
- El servidor valida el mapa y la distancia y decide la recompensa: 10–30 pelines
  por bolsa nueva o 1–5 unidades de polvo de hada. La bolsa inicial junto al NPC de
  pruebas conserva sus 20–40 pelines. El aviso muestra la cantidad recibida.
- Colecciones muestra ambos tipos dentro de cada subzona. El porcentaje general y
  regional cuenta los dos tipos; con los cuatro puntos iniciales, completar solo
  las bolsas supone el 50 %. Añadir puntos actualiza también el total.
- Las regiones futuras conservan su estado de «Próximamente».

Regresión de juego: `node --test scripts/world/collectibles.mjs` después de
`npm --ignore-scripts run build`. Revisión del editor y de los porcentajes:
`node tools/review-collectibles.mjs`. Capturas en `art/collectibles-review/`.

`node --test scripts/test-collectibles-editor.mjs` comprueba colocación, modelos,
deshacer/rehacer, guardado y publicación en carpetas temporales, recogida de los
puntos publicados en el juego y retirada o movimiento al volver a publicar.
Comprueba también los catálogos SQL en PostgreSQL aislado cuando PGlite está disponible.

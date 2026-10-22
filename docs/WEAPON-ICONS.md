# Dirección artística permanente: iconos de armas

Todas las armas actuales y futuras usan un retrato de su propio GLB: volumen facetado, materiales originales, iluminación cálida desde arriba a la izquierda, relleno frío suave y fondo transparente. El marco compartido es de madera oscura y bronce envejecido, con la rareza como acento de color. La silueta debe leerse en los huecos pequeños del inventario; no añadir partículas, texto ni medallones que tapen el objeto.

El icono muestra las piezas reales: hoja, empuñadura, herrajes, cristal, cubierta o mecanismo. Libros, escudos y ballestas tienen encuadres específicos; las armas largas se presentan en diagonal. Cada arma conserva su propio retrato, incluidas las iniciales y las secundarias.

## Al añadir o cambiar un arma

1. Registrar el arma en WEAPONS y su objeto en ITEMS, con su GLB independiente nombrado con el ID del arma dentro de `src/assets/models/items/`.
2. Ejecutar `npm run art:weapons:icons` o `node tools/build-weapon-icons.mjs`.
3. Incluir el PNG y `src/assets/icons/weapons/sources.json` junto al modelo. Revisar el retrato con el marco del juego a 32–48 px.

`npm run build` ejecuta esta generación automáticamente. Los hashes detectan modelos nuevos y modificados; solo se regeneran las miniaturas afectadas. Un arma sin GLB impide completar esta fase para que no se publique con un icono genérico. El generador utiliza Three.js y Microsoft Edge mediante Playwright.

El marco y la selección de retratos están centralizados en `src/art/weaponIcons.ts`; todas las pantallas que usan `itemIcon` reciben el mismo acabado. Los objetos que no son armas conservan su arte actual.

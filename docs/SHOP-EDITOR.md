# Editor visual de tiendas y comerciantes

Herramienta de desarrollo y autoría visual dentro del panel de administración del MMORPG de navegador **Brumaluz**. Permite a diseñadores y administradores crear, configurar, equilibrar y organizar los establecimientos comerciales del mundo, asignando NPCs comerciantes, mercancías, precios de compra y venta, cantidades y monedas sin necesidad de escribir código.

El canon y la ambientación siguen las directrices de [LORE.md](LORE.md) (mercados locales, Pompelín, Barrio de los Artesanos de Brumaluz), la economía oficial de Pelines y Lágrimas descrita en [CURRENCY.md](CURRENCY.md), y el catálogo de objetos de [ITEM-EDITOR.md](ITEM-EDITOR.md).

---

## 1. Acceso y funcionamiento

- **Ruta local**: Con el servidor de desarrollo activo (`npm run dev`), acceder a [`/shops.html`](http://localhost:5173/shops.html).
- **Navegación**: Enlazado directamente desde la barra superior de los talleres existentes (`/npcs.html`, `/maps.html`, `/quests.html`, `/items.html`, `/recipes.html`, `/assets.html`).
- **Aislamiento**: Herramienta estrictamente administrativa y de autoría local, fuera del bundle de clientes finales y sin alterar mecánicas jugables, inventarios de jugadores ni tablas de combate.

---

## 2. Catálogo y biblioteca de tiendas (Panel izquierdo)

La columna izquierda ofrece control total sobre la biblioteca de tiendas del juego:

- **Búsqueda instantánea**: Filtra en tiempo real por nombre de tienda, ID técnico, NPC asociado o mercancía que ofrece a la venta.
- **Píldoras de filtrado rápido**: Alterna con un solo clic entre todas las tiendas o familias temáticas (*General*, *Armería*, *Alquimia*, *Sastrería*, *Carpintería*).
- **Filtros combinados**:
  - *Categoría comercial*: Todas o filtradas por cualquiera de las 9 categorías temáticas canónicas (General, Armería, Alquimia, Sastrería, Carpintería, Taberna, Herramientas, Joyería, Exóticos).
  - *Estado*: Todas, solo activas o solo inactivas (para tiendas en fase de diseño o balanceo).
  - *Comerciante / NPC*: Filtrado por NPC asignado, tiendas con NPC o tiendas sin comerciante asignado.
- **Ordenación multidireccional**: Por nombre alfabético (A-Z / Z-A), identificador snake_case, o número de productos a la venta (mayor a menor / menor a mayor).
- **Paginación ergonómica**: Navegación ágil por páginas con control de total de resultados.
- **Tarjetas informativas**: Cada tienda en el listado muestra directamente el nombre, badge de categoría temática, badge con el NPC comerciante asignado, número de productos y badge de estado (*Activa* / *Inactiva*).

---

## 3. Diseñador visual e interactivo (Panel central)

El panel central de edición está organizado en 3 secciones temáticas por pestañas:

### 3.1. General
- **ID técnico**: Identificador inmutable una vez guardado (formato `snake_case`, minúsculas, números y guiones bajos). Sanitización automática al crear o duplicar.
- **Nombre visible**: Nombre con el que los jugadores identificarán el establecimiento en mapas y ventanas de diálogo.
- **Categoría comercial**: Taxonomía temática del comercio.
- **Estado activo**: Casilla interactiva para habilitar o deshabilitar la presencia de la tienda en el mundo.
- **Descripción / Ambientación**: Texto descriptivo ambientado en las tierras y villas de Brumaluz.
- **Etiquetas**: Palabras clave separadas por comas para búsqueda y filtrado rápido.

### 3.2. Comerciante & Moneda
- **Comerciante / NPC asociado**: Desplegable conectado directamente con el catálogo oficial de NPCs (`src/data/npcs.json`). Muestra el nombre y subtítulo de cada habitante o maestro (ej: *Isberto*, *Testículos*, *Maestro de Alquimia*, etc.) o la opción de «Sin comerciante asignado».
- **Moneda base**: Selector entre las monedas oficiales del MMORPG definidas en [`src/data/currency.ts`](CURRENCY.md) (*Pelines* como moneda corriente de Brumaluz o *Lágrimas de fénix* como moneda premium).
- **Independencia arquitectónica**: La relación se almacena de manera desacoplada en la definición de la tienda sin alterar el editor de NPCs ni los componentes jugables.

### 3.3. Catálogo de productos
- **Botón «+ Añadir producto del catálogo»**: Abre un modal visual de selección que escanea en tiempo real todo el catálogo de objetos del MMORPG (`itemsCatalog.json`, `items.ts` y `rpg-catalog.json`).
- **Tabla dinámica de productos**:
  - *Miniatura e icono oficial*: Renderiza el SVG vectorial del ítem con el borde y color exacto de su rareza.
  - *Nombre e ID técnico*: Muestra el nombre visible y el identificador del producto.
  - *Precio de compra*: Valor que pagará el jugador por adquirir el producto. Incluye un botón rápido **«Base»** para restablecer instantáneamente al valor base oficial del objeto.
  - *Precio de venta (recompra)*: Valor que abonará el comerciante si el jugador le vende este objeto. Incluye un botón rápido **«50%»** para aplicar la regla económica canónica de Brumaluz (50 % del valor base).
  - *Stock / Disponibilidad*: Cantidad máxima disponible (ej: 20 unidades) o valor vacío para suministro ilimitado (`∞`).
  - *Moneda por producto*: Permite heredar la moneda de la tienda o definir una moneda específica para un artículo concreto.
  - *Reordenación y eliminación*: Flechas interactivas (▲ / ▼) para ordenar los productos en el escaparate y botón de quitar (✕).

---

## 4. Modal de selección de objetos del catálogo

- **Búsqueda instantánea**: Filtra en tiempo real por nombre, identificador o categoría de objeto.
- **Filtro por familia**: Permite acotar por consumibles, armas, armaduras, herramientas, muebles, materiales, etc.
- **Filtro por rareza**: Común, Poco común, Raro, Épico, Legendario o Mítico.
- **Tarjetas de producto**: Visualizan el icono oficial, nombre con color de rareza, categoría y precio en Pelines.
- **Detección de productos repetidos**: Marca visualmente si el objeto ya se encuentra añadido a la tienda para evitar duplicados.

---

## 5. Auditoría en tiempo real y vista previa (Panel derecho)

- **Escaparate en vivo (Live Merchant Preview)**: Renderiza el establecimiento tal como se visualiza en la interfaz de usuario del juego (`src/ui/vendorWindow.ts`), con:
  - Banner superior con emblema comercial, nombre de la tienda, comerciante asignado y subtítulo.
  - Indicador de moneda principal con icono vectorial oficial (`currencyIcon`) y badge de estado (*Activa en juego* / *Inactiva*).
  - Descripción de ambientación.
  - Lista de mercancías con sus iconos SVG coloreados por rareza, etiquetas de stock y botones de compra.
- **Auditoría de integridad**:
  - *Detección de objetos eliminados o inexistentes*: Advierte con alerta roja si la tienda referencia un `itemId` que ha sido borrado del catálogo del juego.
  - *Detección de comerciante inexistente*: Alerta si el NPC asociado ya no existe en `npcs.json`.
  - *Detección de precios anómalos*: Alerta si el precio de compra es 0 (artículo gratis) o si el precio de compra es menor o igual al de venta (prevención de exploits de dinero infinito).
  - *Tiendas vacías*: Advierte si la tienda no tiene ningún producto registrado.

---

## 6. Herramientas de productividad y seguridad

- **Plantillas canónicas predefinidas**:
  - *Puesto de provisiones de Pompelín* (alimentos y pociones iniciales).
  - *Fragua y pertrechos de Isberto* (armas de cobre, escudos de roble).
  - *Botica del Barrio de los Artesanos* (pociones y elixires).
  - *Prendas y paños de la Maestra* (vestimenta y lino).
  - *Mobiliario y enseres de Ebanistería* (muebles y descanso).
- **Duplicación instantánea**: Crea copias idénticas con identificador autoincremental (`_copia`).
- **Historial de cambios (Undo / Redo)**: Hasta 60 estados locales en memoria con agrupación inteligente de tipeo.
- **Atajos de teclado**:
  - `Ctrl + S`: Guardar tienda inmediatamente en disco.
  - `Ctrl + Z`: Deshacer última modificación.
  - `Ctrl + Y` (o `Ctrl + Shift + Z`): Rehacer modificación.
- **Importación / Exportación JSON**:
  - Exportar biblioteca completa en formato JSON estructurado.
- **Copias de seguridad fechadas (Backups)**: Guarda respaldos con timestamp en `src/data/backups/shops-backup-*.json`.
- **Protección contra pérdida de datos**: Detección de cambios pendientes al cerrar o recargar la pestaña (`beforeunload`).
- **Confirmación de eliminación**: Diálogo de confirmación explícito antes de borrar una tienda para evitar pérdidas accidentales.

---

## 7. Persistencia y arquitectura técnica

1. **Almacenamiento fuente**:
   - `src/data/shopsCatalog.json`: Archivo central tipado con la versión y la lista de tiendas.
2. **Definiciones y esquemas TypeScript**:
   - `src/data/shopsCatalog.ts`: Validadores de esquema, sanitizadores, plantillas de tiendas, interfaces y motor de auditoría.
   - `src/dev/shopEditorTools.ts`: Gestor de historial, motor de filtrado, paginación y renderizado en vivo.
3. **Middleware Vite local**:
   - `tools/shop-editor-plugin.mjs`: Plugin registrado en `vite.config.ts`.
   - Control de concurrencia optimista mediante `ETag` (SHA-256) y cabecera `If-Match` para prevenir sobrescrituras entre pestañas.
   - Escritura atómica en disco mediante archivo temporal (`.shops-<uuid>.tmp` ➔ `rename`).
   - Restricción estricta de seguridad local (`127.0.0.1`, `localhost` y validación de cabeceras).
4. **Integración con auditoría de objetos**:
   - El endpoint `/__dev/items/references` del editor de objetos (`tools/item-editor-plugin.mjs`) escanea automáticamente las tiendas de `shopsCatalog.json`, impidiendo que un diseñador elimine accidentalmente un objeto si se encuentra a la venta en alguna tienda.

---

## 8. Verificación y pruebas automáticas

Para ejecutar la batería completa de pruebas automatizadas del editor de tiendas:

```bash
npm run test:shops
```

Comprueba:
- Validación de esquema de tiendas y productos (rechazo de campos erróneos, IDs no conformes o productos duplicados).
- Generación de tiendas mediante plantillas canónicas.
- Duplicación con asignación correcta de identificadores.
- Auditoría de dependencias (detección de objetos borrados, NPCs inexistentes y control de exploits económicos).
- Persistencia atómica y control de concurrencia optimista por ETag.
- Restricciones de seguridad contra llamadas remotas o de origen cruzado.
- Historial de deshacer y rehacer con agrupación por retardo.
- Filtrado multidimensional, búsqueda combinada y ordenación.
- Prueba integral de navegador Playwright (creación de una tienda nueva, asignación del NPC `testiculos`, incorporación de productos desde el modal, ajuste de precios, guardado reactivo en disco, duplicación y borrado seguro).


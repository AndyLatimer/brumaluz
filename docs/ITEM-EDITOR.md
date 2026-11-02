# Editor de objetos y equipamiento

Herramienta de desarrollo y autoría visual para el catálogo integral de objetos, equipamiento, recursos y consumibles de **Brumaluz**. Permite a diseñadores y administradores crear, equilibrar, organizar e inspeccionar cualquier objeto del MMORPG sin necesidad de programar código.

El canon y la ambientación de los objetos siguen las directrices de [LORE.md](LORE.md), la economía de Pelines de [CURRENCY.md](CURRENCY.md) y las fórmulas de combate descritas en [COMBAT-BALANCE.md](COMBAT-BALANCE.md).

---

## 1. Acceso y funcionamiento

- **Ruta local**: Con el servidor de desarrollo activo (`npm run dev`), acceder a [`/items.html`](http://localhost:5173/items.html).
- **Navegación**: Enlazado directamente desde la barra superior de los talleres existentes (`quests.html`, `npcs.html`, `maps.html`).
- **Entorno**: Herramienta administrativa local de desarrollo (fuera del bundle público final de jugadores).

---

## 2. Catálogo general y biblioteca

La columna izquierda del taller proporciona una visión completa y estructurada del catálogo de objetos:

- **Búsqueda instantánea**: Filtra en tiempo real por ID técnico, nombre visible, descripción o etiquetas organizativas.
- **Filtros combinados**:
  - *Categoría*: Todas o filtradas por cualquiera de las 12 categorías del juego.
  - *Rareza*: Común, Poco común, Raro, Épico, Legendario o Mítico.
  - *Estado*: Todos, solo activos o solo inactivos (útil para objetos en fase de diseño o pruebas).
- **Ordenación multidireccional**: Por nombre alfabético (A-Z / Z-A), identificador, nivel de rareza o precio en Pelines.
- **Paginación ergonómica**: Navegación por páginas de 15 elementos con indicación de página actual y total de coincidencias.
- **Selección múltiple y acciones en lote**:
  - Activación masiva de objetos seleccionados.
  - Desactivación masiva en un solo clic.
  - Exportación conjunta en archivo JSON de los objetos marcados.
  - Eliminación masiva con comprobación de seguridad para evitar borrar objetos en uso.

---

## 3. Formulario de edición por pestañas

El panel central de edición está dividido en 5 secciones temáticas que facilitan el diseño progresivo y evitan la sobrecarga cognitiva:

### 3.1. General
- **ID técnico**: Identificador inmutable una vez guardado (formato `snake_case`, minúsculas, números y guiones bajos). Sanitización automática al crear o duplicar.
- **Nombre**: Nombre con el que los jugadores verán el objeto en inventarios, tiendas y diarios de misión.
- **Categoría y subcategoría**: Define la naturaleza técnica y temática del ítem.
- **Rareza**: Común (blanco/ceniza), Poco común (verde musgo), Raro (azul añil), Épico (púrpura bruma), Legendario (oro real), Mítico (carmesí arcano).
- **Descripción**: Texto descriptivo, ambientado en las tierras y leyendas de Brumaluz.
- **Etiquetas**: Palabras clave separadas por comas para búsqueda y filtrado ágil.
- **Estado activo**: Permite habilitar o deshabilitar la presencia del objeto en el mundo.

### 3.2. Propiedades económicas e inventario
- **Precio base de compra**: Valor en Pelines que cuesta adquirirlo de un comerciante.
- **Precio base de venta**: Valor en Pelines recibido al venderlo a un mercader.
- **Límite de apilamiento (Stack)**: Cantidad máxima por casilla de inventario (1 para armas/armaduras, 50-99 para recursos y consumibles, hasta 9999).
- **Peso**: En kilogramos (opcional).
- **Permisos y vínculos**:
  - *Almacenable*: Si puede depositarse en el banco de la ciudad.
  - *Vendible*: Si los mercaderes lo aceptan.
  - *Intercambiable*: Si puede comerciarse directamente con otros jugadores.
  - *Desechable*: Si puede ser arrojado o eliminado de la bolsa.
  - *Ligado al personaje (Soulbound)*: Si queda anclado a la cuenta o avatar al obtenerlo.

### 3.3. Equipamiento y combate
Se activa con la casilla «Este objeto puede equiparse en el personaje»:
- **Ranura de equipo**: Compatible con el sistema de inventario del juego (`head`, `pendant`, `chest`, `hands`, `ring`, `weapon`, `offhand`, `legs`, `trinket`).
- **Nivel mínimo**: Requisito de nivel de personaje.
- **Clase requerida**: Sin restricción, o limitada a Guerrero, Mago o Pícaro.
- **Durabilidad**: Valor inicial y máximo opcional para objetos de desgaste.
- **Constructor de modificadores y estadísticas**:
  - Modificadores dinámicos y balanceados: Vida máxima, Maná máximo, Ataque físico, Poder mágico, Defensa física, Resistencia mágica, Probabilidad de crítico, Guardia, Velocidad de ataque o Velocidad de movimiento.

### 3.4. Consumibles y efectos
Se activa con la casilla «Este objeto puede consumirse o usarse desde la bolsa»:
- **Registro estricto de efectos autoritativos**: No se permite código JavaScript arbitrario. Los efectos se procesan de forma validada en el cliente y en el servidor.
- **Efectos disponibles**:
  - *Restaurar salud*: Cantidad plana o porcentaje de la vida máxima.
  - *Restaurar maná*: Cantidad plana o porcentaje del maná total.
  - *Restaurar estamina/energía*: Recuperación instantánea.
  - *Comida reconfortante (Buff)*: Efecto pasivo temporal de regeneración o incremento de atributos con duración en segundos.
  - *Entregar objeto*: Otorga otro ítem al abrirse (bolsas de botín, paquetes de suministros).
  - *Teletransporte o portal*: Traslada al mapa registrado.
  - *Aprender receta*: Otorga conocimiento de fabricación en oficios.

### 3.5. Recursos visuales e icono
- **Biblioteca de iconos vectoriales**: Más de 30 iconos SVG integrados (armas, hachas, varitas, escudos, pecheras, cascos, anillos, amuletos, picos, pociones, lingotes, madera, gemas, llaves, pergaminos y monturas). Permite seleccionar un icono predefinido con un solo clic o personalizar el trazado SVG.
- **Asociación de modelos 3D (GLB)**: Selector dinámico que escanea los modelos 3D disponibles en el proyecto (`src/assets/models/`, `src/assets/library/adventurers/objects/`) y asocia su ruta relativa.

---

## 4. Las 12 categorías soportadas

El sistema incorpora una taxonomía extensible que adapta automáticamente las propiedades del objeto:

1. `weapon` (Armas): Espadas, arcos, báculos, dagas.
2. `armor` (Armaduras): Corazas, yelmos, grebas, escudos.
3. `clothing` (Ropa y cosméticos): Túnicas decorativas, capas, sombreros sin estadísticas de combate obligatorio.
4. `tool` (Herramientas de oficio): Picos mineros, hachas de leñador, hoces, cañas de pescar.
5. `food` (Alimentos y bebidas): Pan campesino, pasteles de moras, estofados, sidra suave.
6. `resource` (Materiales y recursos recolectables): Mineral de cobre, madera de abedul, fibras, plantas.
7. `crafting` (Objetos y componentes de fabricación): Lingotes fundidos, cuero curtido, engranajes, hilos.
8. `furniture` (Muebles y decoración de hogar): Sillones de roble, mesas, alacenas, camas para casas personales.
9. `quest` (Objetos de misión): Cartas selladas, reliquias antiguas, muestras para NPCs de encargo.
10. `consumable` (Consumibles y elixires): Pociones de vida, viales de vigor, pergaminos de teletransporte.
11. `special` (Llaves y objetos especiales): Llaves maestras de criptas, pases de carruaje, emblemas de gremio.
12. `pet_mount` (Mascotas y monturas): Riendas de caballo de tiro, silbatos de halcón o compañeros de viaje.

---

## 5. Panel contextual y auditoría en tiempo real

En la columna derecha:

- **Ficha visual en vivo (Tooltip)**: Renderiza idénticamente a la interfaz del juego el nombre con color de rareza, categoría, ranura, requisitos, estadísticas en verde o ámbar, efectos de consumo, precio en Pelines y estado de vinculación.
- **Visor interactivo 3D**: Visor WebGL acelerado basado en Three.js con OrbitControls, luces cálidas de estudio y auto-encuadre de modelos GLB.
- **Auditoría de dependencias**: Analiza en tiempo real las referencias en el juego:
  - Misiones donde el objeto es objetivo de recolección (`fetch` o `craft`).
  - Misiones donde el objeto es otorgado como recompensa.
  - Mercaderes y tiendas NPC que venden el objeto.
  - Recetas de artesanía que utilizan el objeto como ingrediente o lo producen como resultado.
  - **Protección contra borrado accidental**: Si un objeto tiene dependencias activas, el editor bloquea su eliminación y muestra una alerta con la lista exacta de misiones, recetas o tiendas que dependen de él.

---

## 6. Herramientas de productividad y atajos

- **Creación por plantillas**:
  - *Espada de acero* (Arma).
  - *Coraza de placas* (Armadura).
  - *Túnica de mago* (Ropa cosmética).
  - *Pico de minería* (Herramienta).
  - *Pan artesanal* (Alimento).
  - *Lingote de mineral* (Material apilable).
  - *Poción de vida* (Consumible con efecto).
  - *Silla de madera* (Mobiliario).
  - *Llave antigua* (Objeto de misión).
  - *Montura de viaje* (Montura).
- **Duplicación instantánea**: Crea una copia exacta del ítem activo con ID autoincremental (`_copia`).
- **Historial de cambios (Undo / Redo)**: Hasta 60 estados locales por sesión con agrupación inteligente de tipeo.
- **Atajos de teclado**:
  - `Ctrl + S`: Guardar objeto actual inmediatamente.
  - `Ctrl + Z`: Deshacer última modificación.
  - `Ctrl + Y` (o `Ctrl + Shift + Z`): Rehacer modificación.
- **Importación / Exportación JSON**:
  - Exportar biblioteca completa o únicamente el objeto activo.
  - Importar archivos JSON con validación de esquema, detección de conflictos y actualización atómica.
- **Protección de salida**: Alerta antes de cerrar o recargar la pestaña si existen cambios pendientes de guardar.

---

## 7. Persistencia, sincronización y base de datos

1. **Almacenamiento fuente**:
   - `src/data/itemsCatalog.json`: Archivo central estructurado y tipado.
2. **Servicio y API local (Vite Middleware)**:
   - `/__dev/items`: Endpoint GET y PUT con control de concurrencia optimista mediante `ETag` (SHA-256). Previene sobrescrituras accidentales si varios diseñadores abren el taller simultáneamente.
   - Protección de seguridad local (`127.0.0.1`, origen y `Sec-Fetch-Site`).
3. **Integración en el cliente MMORPG**:
   - `src/data/items.ts`: Une dinámicamente los objetos del catálogo en el mapa principal `ITEMS`.
   - `src/data/equipment.ts`: Registra automáticamente los objetos equipables en `EQUIPPABLE`.
4. **Sincronización con la base de datos Supabase / PostgreSQL**:
   - Herramienta de sincronización: `npm run items:sync` (`tools/sync-items-server.mjs`).
   - Genera `supabase/server/30-custom-items.sql`, insertando o actualizando las filas de `public.game_custom_item` y proporcionando la función SQL `public.game_item_extended(p_item text)`.
   - Distingue inequívocamente entre la **definición** de un objeto en el catálogo y las **instancias** de inventario que poseen los jugadores en sus mochilas (`character_inventory`).

---

## 8. Verificación y pruebas automáticas

Para ejecutar la batería completa de pruebas automatizadas del editor de objetos:

```bash
npm run test:items
```

Comprueba:
- Validación de esquema y campos obligatorios.
- Generación de objetos mediante plantillas predefinidas.
- Detección de referencias cruzadas y bloqueo de borrado de objetos dependientes.
- Persistencia atómica y prevención de colisiones por ETag.
- Restricciones de seguridad contra llamadas no locales.
- Historial de deshacer/rehacer y agrupación por retardo.
- Filtrado y ordenación multidimensional.
- Servidor Vite y compilación limpia de TypeScript.
- Prueba integral de navegador Playwright (creación, edición por pestañas, tooltip reactivo y persistencia en disco).

# Editor visual de recetas y fabricación

Herramienta de desarrollo y autoría visual dentro del panel de administración del MMORPG de navegador **Brumaluz**. Permite a diseñadores y administradores crear, equilibrar, organizar e inspeccionar cientos de recetas de artesanía y definiciones de estaciones de fabricación sin necesidad de escribir código ni depender de inteligencia artificial.

El canon y la ambientación siguen las directrices de [LORE.md](LORE.md) (Pompelín, Barrio de los Artesanos de Brumaluz y vida cotidiana acogedora), las 12 profesiones canónicas descritas en [PROFESSION-WORKSHOPS.md](PROFESSION-WORKSHOPS.md) y las reglas de aprendizaje de recetas de [RECIPE-TRAINING.md](RECIPE-TRAINING.md).

---

## 1. Acceso y funcionamiento

- **Ruta local**: Con el servidor de desarrollo activo (`npm run dev`), acceder a [`/recipes.html`](http://localhost:5173/recipes.html).
- **Navegación**: Enlazado directamente desde la barra superior de los talleres existentes (`/npcs.html`, `/maps.html`, `/quests.html`, `/items.html`, `/assets.html`).
- **Aislamiento**: Herramienta estrictamente administrativa y de autoría local, fuera del bundle de clientes finales y sin alterar tablas jugables ni sistemas de inventario.

---

## 2. Catálogo y biblioteca de recetas (Panel izquierdo)

La columna izquierda ofrece control total sobre la biblioteca de recetas:

- **Botón «+ Nueva receta» al inicio**: Situado en la cabecera superior de la biblioteca para crear nuevas recetas en 1 solo clic sin desplazarse.
- **Píldoras de filtrado por profesión con contadores**: Chips para los oficios de fabricación con el número real de recetas de cada uno en la biblioteca cargada. Los totales se actualizan al guardar o modificar el catálogo.
- **Búsqueda instantánea con botón «✕ Limpiar»**: Filtra en tiempo real por nombre de receta, ID técnico, etiqueta, ingrediente o producto resultante, con botón de reseteo rápido.
- **Filtros combinados**:
  - *Profesión*: Todas las profesiones o cualquiera de los 12 oficios del MMORPG (Carpintería, Ebanistería, Herrería, Peletería, Sastrería, Joyería, Alquimia, Encantamiento, Cocina, Minero, Leñador, Recolector) o fabricación manual.
  - *Estación*: Filtrado por estaciones de trabajo asignadas (banco de carpintería, forja, cocina, telar, mesa de alquimia, etc.).
  - *Categoría / Carpeta*: Clasificación por familias temáticas (muebles, armas, armaduras, alimentos, pociones, componentes, herramientas).
  - *Estado*: Todas, solo activas o solo inactivas (para recetas en fase de diseño o balanceo).
- **Ordenación multidireccional**: Por nombre alfabético (A-Z / Z-A), ID técnico, menor/mayor tiempo de fabricación, profesión o número de ingredientes.
- **Paginación ergonómica**: Navegación ágil por páginas con control de total de resultados.
- **Tarjetas informativas con mini-flujo**: Cada elemento del listado muestra directamente el flujo condensado:
  `[Cantidad × Ingredientes]` ➔ `[Cantidad × Resultado]`
  con badges de estado, tiempo y profesión.
- **Selección múltiple y acciones en lote (Batch Editing)**:
  - Activación masiva de recetas seleccionadas.
  - Desactivación masiva.
  - Reasignación de profesión o estación en lote.
  - Asignación de carpeta organizativa.
  - Eliminación masiva con comprobación de seguridad.

---

## 3. Diseñador visual e interactivo (Panel central)

El área central dispone de una interfaz visual clara que representa el proceso artesanal mediante nodos interactivos:

### 3.1. Canvas gráfico de fabricación (Visual Craft Flow)
- **Autoría 100% visual sin escribir código**:
  - **«+ Añadir ingrediente»**: Abre directamente el selector visual de objetos y lo inserta en el canvas.
  - **Clic en cualquier casilla de ingrediente**: Abre el selector de objetos para cambiar el material al instante.
  - **Botón `✕` en cada casilla**: Permite eliminar ingredientes directamente desde el canvas al pasar el ratón.
  - **Controles de cantidad (+ / -)**: Modifica la cantidad requerida de cada material en la propia casilla.
  - **Casilla de resultado interactiva con stepper**: Permite seleccionar el objeto producido y aumentar o reducir las unidades resultantes (+ / -) directamente en el diagrama.
  - **Píldora de tiempo interactiva**: Al hacer clic en el tiempo (`30 s`), alterna rápidamente entre tiempos estándar (`5s`, `15s`, `30s`, `1 min`, `2 min`, `5 min`).
  - **Nodo central de estación**: Muestra el icono animado del taller y navega directamente a la selección de estaciones.
- **Guía rápida visual («¿Cómo funciona?»)**: Banner pedagógico con los 3 pasos esenciales de fabricación (Materiales ➔ Taller ➔ Balance), desplegable en cualquier momento.
- **Barra de arquetipos rápidos de 1 clic**: Botones para crear recetas base al vuelo (`🪑 Mueble de madera`, `🔨 Arma de forja`, `🛡️ Armadura pesada`, `🧪 Poción de salud`, `🍲 Plato cocinado`, `✨ Pergamino arcano`).
- **Botones de presets de tiempo y éxito**: En la pestaña de tiempo, botones rápidos de 1 clic para tiempos (`⚡ 5s`, `⏱️ 15s`, `⚖️ 30s`, `⏳ 1m`, `⌛ 2m`, `🏰 5m`) y probabilidades de éxito (`100%`, `90%`, `75%`, `50%`).

### 3.2. Selector de objetos (Item Picker) mejorado
- **Píldoras de filtrado por categoría**: `Todos`, `🌲 Materiales (570+)`, `🪑 Muebles`, `🍞 Comida`, `🧪 Pociones`, `⛏️ Herramientas`, `⚔️ Equipamiento`, `📜 Pergaminos`.
- **Badges de calidad y valor económico**: Muestra rareza en color y precio en Pelines de cada objeto del MMORPG.

### 3.2. Formulario por pestañas
El formulario está estructurado en 4 secciones temáticas:

1. **General**:
   - *ID técnico*: Identificador snake_case validado (`^[a-z0-9][a-z0-9_]{1,63}$`).
   - *Nombre visible*: Nombre con el que los jugadores y maestros identificarán la receta.
   - *Categoría*: Muebles, armas, armaduras, cocina, pociones, componentes, herramientas, etc.
   - *Carpeta organizativa*: Agrupación en árbol para diseñadores (ej: "Muebles de roble", "Forja intermedia").
   - *Descripción*: Ambientación y detalles del proceso artesanal.
   - *Etiquetas*: Palabras clave separadas por comas.
   - *Estado activo*: Casilla para habilitar o pausar la receta.

2. **Ingredientes y Resultados**:
   - Tabla dinámica con iconos, identificadores, selector visual del catálogo de objetos, steppers de cantidad y botones de eliminación.
   - Configuración del objeto resultante: ID, cantidad producida (1-999) y probabilidad de obtención (1-100 %).

3. **Estación y Oficio**:
   - *Profesión requerida*: Selector entre los 12 oficios del MMORPG o sin restricción.
   - *Rango requerido*: Aprendiz, Iniciado, Oficial, Experto, Maestro o Gran maestro.
   - *Estaciones de fabricación admitidas*: Cuadrícula interactiva de chips para asociar una o múltiples estaciones a la receta.
   - Botón directo para crear una nueva estación de trabajo al instante.

4. **Tiempo y Requisitos**:
   - *Tiempo de fabricación*: Control en segundos con conversión automática a minutos/horas.
   - *Probabilidad de éxito*: 0 a 100 %.
   - *Nivel de personaje*: Nivel mínimo recomendado u obligatorio.
   - *Misión previa requerida*: Desplegable conectado con el catálogo real de misiones (`questCatalog.json`).
   - *Receta previa*: Para cadenas o progresiones de artesanía.
   - *Notas de desbloqueo*: Explicación de obtención (compra a maestro, botín de criatura, etc.).

---

## 4. Subeditor de estaciones de fabricación

Permite definir y gestionar estaciones de trabajo de manera aislada y modular:

- **Estaciones predefinidas**:
  - Banco de carpintería.
  - Forja y yunque.
  - Fogón y cocina.
  - Mesa de alquimia.
  - Telar y rueca.
  - Banco de ebanistería.
  - Mesa de encantamiento.
  - Bastidor de curtido.
  - Banco de orfebre y joyería.
  - Fabricación manual en campo.
- **Creación de estaciones personalizadas**:
  - Identificador único sanitizado.
  - Nombre visible y descripción.
  - Profesión asociada.
  - Icono SVG personalizado.
- **Protección de dependencias**: El subeditor contabiliza cuántas recetas dependen de cada estación y **bloquea la eliminación** de cualquier estación que esté siendo utilizada por recetas activas, detallando los nombres de las recetas afectadas.

---

## 5. Auditoría en tiempo real y vista previa (Panel derecho)

- **Ficha visual en vivo (Live Tooltip Card)**: Renderiza la receta tal como se visualizaría en el libro de oficios o inventario del juego, incluyendo el icono del objeto con color de calidad, nombre, categoría, descripción, lista de ingredientes verificados, tiempo, estación y tasa de éxito.
- **Calculadora económica de balance y rentabilidad**:
  - Calcula en tiempo real el coste acumulado de los materiales en Pelines según el catálogo oficial.
  - Compara el coste contra el valor base del producto terminado.
  - Muestra el **beneficio neto** (ganancia/pérdida en Pelines), el **margen porcentual** y la **tasa de generación económica por minuto de fabricación**.
- **Cadena de producción y materias primas (Production Tree)**:
  - Inspecciona las dependencias jerárquicas de las sub-recetas.
  - Distingue automáticamente entre componentes intermedios fabricables y materias primas elementales (madera en bruto, minerales, etc.).
  - Detecta y previene dependencias circulares.
- **Simulador de tiradas de fabricación**:
  - Permite simular lotes de 10, 50, 100 o N intentos de fabricación usando las probabilidades configuradas.
  - Desglosa éxitos, fallos reales, total de productos terminados, tiempo acumulado de juego y gasto total de materias primas.
- **Auditoría de integridad instantánea**:
  - *Detección de objetos inexistentes*: Detecta si algún ingrediente o resultado no existe en el catálogo general de objetos (`itemsCatalog.json`, `items.ts`, `rpg-catalog.json`), advirtiendo con alertas claras.
  - *Detección de recetas duplicadas*: Identifica si ya existe otra receta con idénticos ingredientes, estación y resultado.
  - *Ingredientes duplicados*: Advierte si un ingrediente se añadió dos veces en la misma receta.
  - *Estaciones no registradas*: Avisa si la receta referencia una estación inexistente.
- **Auditoría global del catálogo**: Modal con diagnóstico completo de la salud del catálogo (conteo total, referencias rotas, posibles duplicados y desglose detallado).

---

## 6. Herramientas de productividad

- **Filtros rápidos por píldoras**: Acceso de un clic en la cabecera del catálogo para alternar entre todas las recetas o profesiones principales (Carpintería, Herrería, Alquimia, Cocina, Sastrería).
- **Creación y gestión de plantillas**:
  - Plantillas canónicas predefinidas: *Mesa de madera*, *Espada de acero*, *Coraza de hierro*, *Poción reconstituyente*, *Pan artesanal*, *Túnica de lino*, *Banco de descanso*, *Piezas de ensamblaje*.
  - **«⭐ Guardar como plantilla»**: Permite convertir cualquier receta diseñada en una plantilla reutilizable para el resto de la sesión de trabajo.
- **Duplicación instantánea**: Crea copias idénticas con identificador autoincremental (`_copia`).
- **Historial de cambios (Undo / Redo)**: Hasta 60 estados en memoria con agrupación inteligente de tipeo.
- **Atajos de teclado**:
  - `Ctrl + S`: Guardar receta inmediatamente.
  - `Ctrl + Z`: Deshacer última acción.
  - `Ctrl + Y` / `Ctrl + Shift + Z`: Rehacer acción.
- **Importación y exportación JSON**:
  - Exportar biblioteca completa o únicamente la receta activa.
  - Importar archivos JSON en modo combinación (*merge*) o sustitución (*replace*).
- **Copias de seguridad (Backups)**: Guarda copias fechadas con un clic en `src/data/backups/`.
- **Sincronización del catálogo canónico RPG**:
  - Incorpora las recetas canónicas disponibles en `src/data/generated/rpg-catalog.json`, respetando los tiempos instantáneos y los precios en Pelines.
  - El botón **«🔄 Sincronizar recetas del catálogo RPG»** añade únicamente las recetas que faltan; no actualiza ni sobrescribe las ya existentes en el editor.
- **Protección contra pérdida de datos**: Advierte de cambios sin guardar al salir y antes de sustituir el borrador al cambiar de receta, crear desde plantilla, importar o aplicar una edición masiva.
- **Resiliencia y validación de tipos MIME**: Verificación estricta de `Content-Type: application/json` tanto en `/references` como en `/recipes`, con avisos explicativos ante fallbacks HTML o reinicios del servidor Vite.

---

## 7. Persistencia y arquitectura técnica

1. **Almacenamiento fuente**:
   - `src/data/recipesCatalog.json`: Archivo central tipado con estaciones, carpetas y recetas canónicas sincronizadas o personalizadas.
2. **Definiciones y esquemas TypeScript**:
   - `src/data/recipesCatalog.ts`: Validadores de esquema, sanitizadores, plantillas, utilidades de mapeo de oficios y estaciones, y sincronizador `syncRpgRecipesIntoCatalog`.
   - `src/dev/recipeEditorTools.ts`: Motor de filtrado, auditoría de dependencias, paginación, cálculo económico, simulación de balance e historial.
3. **Middleware Vite local**:
   - `tools/recipe-editor-plugin.mjs`: Plugin registrado en `vite.config.ts`.
   - Rutas API servidas:
     - `GET /__dev/recipes`: Carga el catálogo completo con cabecera ETag.
     - `PUT /__dev/recipes`: Guarda atómicamente el catálogo con comprobación `If-Match`.
     - `GET /__dev/recipes/references`: Agrega ítems del catálogo (`items.ts`, `itemsCatalog.json`, `rpg-catalog.json`), misiones y rangos.
     - `POST /__dev/recipes/backup`: Genera una copia con marca temporal en `src/data/backups/`.
     - `POST /__dev/recipes/sync-rpg`: Lee `rpg-catalog.json` e incorpora recetas canónicas faltantes de forma no destructiva.
   - Control de concurrencia optimista mediante `ETag` (SHA-256) y cabecera `If-Match` para prevenir sobrescrituras entre pestañas.
   - Escritura atómica en disco mediante archivo temporal (`.recipes-<uuid>.tmp` ➔ `rename`).
   - Restricción de seguridad local (rechazo estricto de solicitudes externas, `127.0.0.1` y validación de `Origin`).

---

## 8. Verificación y pruebas automáticas

Para ejecutar la batería completa de pruebas automatizadas del editor de recetas:

```bash
npm run test:recipes
```

Comprueba (18 pruebas unitarias y e2e):
1. Validación de esquema de recetas e ingredientes.
2. Validación de estaciones de fabricación y prevención de duplicados.
3. Generación y consistencia de recetas mediante plantillas.
4. Detección de objetos inexistentes y recetas duplicadas.
5. Comprobación de dependencias para proteger la eliminación de estaciones y recetas.
6. Persistencia atómica y control de concurrencia optimista por ETag.
7. Restricciones de seguridad contra llamadas remotas o de origen cruzado.
8. Historial de deshacer y rehacer.
9. Filtrado multidimensional, carpetas y ordenación.
10. Prueba integral de navegador Playwright (creación de la receta de prueba «Mesa de madera», verificación de los nodos interactivos del canvas, edición de tiempos y guardado reactivo en disco).
11. Cálculo de balance económico (coste de ingredientes, valor de producto y margen neto).
12. Simulación de tiradas de fabricación (probabilidad de éxito, fallos y materiales gastados).
13. Árbol de cadena de producción y desglose de materias primas elementales.
14. Sincronización no destructiva de todas las recetas canónicas actuales, incluidos sus tiempos instantáneos, mediante endpoint dedicado.
15. Prueba integral de navegador con el catálogo sincronizado: contadores por oficio, filtrado, búsqueda, edición y creación de recetas.
16. Manipulación directa del canvas visual interactivo: inserción directa desde el selector de objetos, stepper de unidades resultantes, eliminación de ingredientes con botón `✕` flotante, filtrado por categorías de ítems y botones de presets rápidos.
17. Conservación de borradores al cancelar la navegación entre recetas.
18. Indicador de guardado tras edición masiva e importación.

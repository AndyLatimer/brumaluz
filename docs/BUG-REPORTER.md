# Sistema de Reporte de Problemas y Mejoras (Bug Reporter)

El sistema de reporte de problemas permite capturar de forma instantánea el estado del juego con una tecla (`F8`), tomar una captura de pantalla del lienzo WebGL en ese mismo instante y abrir un diálogo para describir un error, problema gráfico o sugerencia de mejora. Los reportes se guardan tanto en disco local (`reports/bugs.json` y `reports/screenshots/`) a través del servidor Vite como en `IndexedDB` en el navegador, permitiendo revisarlos, filtrarlos, teletransportarse a la posición exacta del reporte y exportarlos/copiarlos en formato Markdown para el asistente IA o herramientas de seguimiento.

## Acceso y Atajos

- **Tecla rápida de captura y reporte**: `F8` (disponible en juego, creador de personaje y menús).
- **Tecla rápida del visor de reportes**: `Mayús + F8`.
- **Menú de juego (`Esc`)**:
  - Botón *Reportar problema (F8)*.
  - Botón *Revisar reportes*.
- **Opciones > Controles**: documentado en el grupo *Sistema*.
- **Consola de depuración (`window.brumaluz`)**:
  - `window.brumaluz.report()`: abre el diálogo de nuevo reporte.
  - `window.brumaluz.reports()`: abre el visor de reportes.

## Flujo de Nuevo Reporte

1. Al pulsar `F8` (o el botón del menú):
   - Se fuerza un renderizado sincrónico del lienzo WebGL (`stage.render()` / `renderer.render()`) para obtener el búfer actual antes de que el navegador limpie el búfer de dibujo.
   - Se escala y comprime la captura a JPEG optimizado (calidad 82%, ancho máx. 1280 px) para un rendimiento rápido y ligero.
   - Se recopilan automáticamente los metadatos del contexto de juego:
     - Zona actual (ej. `brumaluz`) y nombre amigable.
     - Coordenadas de posición exactas (`x`, `y`, `z`) y ángulo de giro (`yawDegrees`).
     - Parámetros de cámara (`yaw`, `pitch`, `dist`).
     - Datos del personaje (nombre, raza, clase, nivel, salud/recurso).
     - Entorno de ejecución (resolución, modo gráfico normal/compatible, User Agent).
   - Se abre el modal con diseño cozy y pergamino (`#bug-report-backdrop`).
2. El usuario introduce:
   - **Categoría**: Bug/Error, Visual/Gráficos, Sugerencia, Combate, Misión o Rendimiento.
   - **Título / Resumen** (opcional; si se deja en blanco se genera un resumen de la descripción).
   - **Descripción** (campo de texto multilínea).
   - **Severidad**: Baja, Normal, Alta o Bloqueante.
3. Al pulsar *Guardar reporte* (`Enter` con `Ctrl/Cmd` o clic):
   - Se envía por HTTP `POST /__dev/reports` al servidor Vite de desarrollo.
   - El servidor guarda la imagen decodificada en `reports/screenshots/<id>.jpg` y el registro en `reports/bugs.json`.
   - Como respaldo y para funcionamiento fuera de línea / modo cliente, se guarda también en `IndexedDB` (`brumaluz_reports_db`).
   - Se muestra un aviso tipo *toast* confirmando el guardado.

## Visor y Revisión de Reportes

Al pulsar `Mayús + F8` o el botón *Revisar reportes*:
- Se abre el visor con lista lateral y panel de detalle (`#bug-review-backdrop`).
- **Filtros por estado**: *Todos*, *Pendientes*, *En curso* y *Resueltos*, con contador en tiempo real.
- **Búsqueda**: búsqueda instantánea por título, descripción, zona o autor.
- **Detalle de reporte**:
  - Visualización de la captura con opción de zoom a pantalla completa (*Lightbox*).
  - Selector de cambio de estado (*Pendiente*, *En progreso*, *Resuelto*).
  - Campo de notas del desarrollador sobre la corrección o commit asociado.
  - 🚀 **Botón "Teletransportar aquí"**: reubica al personaje en las coordenadas exactas `[X, Y, Z]` y reorienta la cámara al ángulo donde se reportó el bug.
  - 📋 **Botón "Copiar para el Asistente IA (Markdown)"**: formatea todos los datos, coordenadas y descripción en Markdown listo para pegar en el chat del asistente.
  - 💾 **Descargar captura**: descarga el archivo JPG de la captura.
  - 🗑️ **Eliminar reporte**: borra el reporte del visor y del disco.
  - 📥/📤 **Exportar / Importar JSON**: permite guardar un volcado de todos los reportes o importar reportes previos.

## Pruebas Automatizadas

- `npm run test:reports` ejecuta `scripts/test-bug-reporter.mjs`:
  - Prueba unitaria del formateo a Markdown.
  - Prueba de integración del plugin de Vite y endpoints `/__dev/reports` (CRUD y escritura de capturas en disco).
  - Prueba en navegador real con Playwright: pulsación de tecla F8, captura de lienzo, envío de formulario, apertura del visor con Mayús+F8, cambio de estado y limpieza.

# Aplicación de la revisión cozy

El 2 de noviembre el usuario autoriza implementar las decisiones aprobadas de
la revisión de economía, viviendas, encargos, fabricación y meriendas. No se
convierten las propuestas pendientes ni el historial antiguo en requisitos nuevos.

## Últimas decisiones

Equipo y herramientas: mitad de los intervalos de muebles por rango. Pergaminos
de encantamiento: doble del equipo. Componentes: 30/60/120/180/240/300 segundos
de Aprendiz a Gran maestro; esta distribución concreta dentro del intervalo
aprobado es una elección de implementación. Comida y pociones: instantáneas.

Los tiempos son conectados, antes de bonificaciones raciales vigentes. Sin
conexión se avanza a un tercio. Las piezas se asignan dentro de su intervalo;
para equipo sin tamaño o complejidad configurados se usa su punto medio.

## Alcance implementado localmente

- Casa del Olmo por 3.500 Pelines, sin requisitos de recado, proyectos o decoración.
- Recado único de Gnomi por 100; práctica de iniciación separada de encargos.
- Fabricación con cinco trabajos secuenciales por oficio, reserva desde mochila
  y banco de la cuenta, cancelación con devolución íntegra y tiempos nuevos.
- Autoría de objetos fabricados y marca persistente de herramientas usadas.
- Encargos diarios: tres ofertas fijas por maestro/rango/día, tres aceptados y
  tres entregados en total, caducidad diaria, repetición, cancelación gratuita,
  requisitos y recompensas congelados al aceptar y entregas al maestro emisor.
- Venta ordinaria de materias primas a NPC deshabilitada; comercio entre jugadores
  y banco conservados.
- Proyectos de barrio únicos, cupo independiente de dos diarios, productos propios
  y regalo único del macetero.
- Tres recetas personales de merienda diarias, nuevos platos normales y exclusivos,
  preparaciones compartidas, cupo de dos recompensas recogidas, caducidad de siete
  días y cancelación automática a los treinta minutos de actividad sin aportar.

Las ofertas y menús se guardan en el servidor durante el día UTC: abrir otra vez
el diálogo o actualizar el catálogo no produce nuevas tiradas. La caché conserva
siete días de metadatos; no es una nueva caducidad de objetos. El catálogo añade
18 platos normales y 18 exclusivos de merienda, con nombres e ingredientes
iniciales para revisar en juego. Son 42 platos elegibles, siete por rango;
los componentes no se incluyen como platos terminados.

## Conservación y límites

Los objetos antiguos sin autoría verificable se conservan para su uso, comercio
o fabricación, pero no se les atribuye retrospectivamente un fabricante para
entregar encargos. Los trabajos de fabricación que ya estaban pendientes sí
acreditan a su propietario cuando se completan. No se borran recetas, progreso,
viviendas, monedas ni muebles existentes.

Cada ingrediente reservado o devuelto conserva sus propiedades. Las devoluciones
de cancelación se guardan en Entregas; no dependen de espacio en la mochila.
El banco sigue siendo de la cuenta y requiere bloqueo compartido entre personajes.

Las preparaciones empiezan su plazo de actividad al crearse, aunque aún no se
haya aportado el primer ingrediente. Esto concreta el caso técnico que seguía
pendiente. Cambiar el menú no cambia una preparación ya iniciada. El origen de
botín de una receta excepcional sigue controlando su aprendizaje permanente;
la preparación supervisada no la enseña.

La limpieza automática de grupos conserva los que tienen una preparación
incompleta cuando todos se desconectan, para permitir la pausa aprobada. La
disolución explícita sigue cancelando y devolviendo cada aportación a su dueño.
No se añade un cupo de almacenamiento de recompensas terminadas sin aprobar:
se aplica su caducidad de siete días, separada de las tres preparaciones incompletas.

## Comprobaciones y publicación

- `npm run test:cozy`: **57 pruebas correctas**, sin omisiones. Comprueba los
  doce maestros y seis rangos, cupos, repetición, medianoche UTC, autoría,
  herramientas usadas, menús fijos durante el día, banco, devoluciones exactas,
  ritmo sin conexión, tutorial, prácticas opcionales de taller, proyectos,
  meriendas, grupos y conservación del contenido ajeno al aplicar el parche dos
  veces. SQL ejecutado en PGlite aislado.
- `npm run review:cozy`: **15 comprobaciones visuales**, sin errores de navegador,
  en el juego real y los editores: encargos y meriendas en móvil y escritorio,
  compra y visitas, decoración y doce modelos del catálogo. Capturas e informe
  en [art/cozy-economy-review](../art/cozy-economy-review/review.json).
- `npm --ignore-scripts run build`: TypeScript y compilación de producción correctos.
  No se regeneran otros mapas ni recursos durante esta comprobación.
- `npm run db:cozy:prepare`: genera el
  [parche conjunto](../art/cozy-economy-review/server-patch.sql) y su
  [manifiesto](../art/cozy-economy-review/patch-manifest.json). Incluye comprobación
  de las funciones existentes para rechazar cambios remotos ajenos a la revisión.

Estado inicial: **implementado y verificado localmente; parche preparado, sin aplicar a
una base remota y sin publicar el cliente web**. No se han modificado personajes
reales. Las cifras están verificadas como reglas de software; todavía requieren
sesiones humanas para valorar el ritmo, la diversión y el equilibrio global.
Las futuras casas, ampliaciones de colas, contenido narrativo y propuestas sin
confirmar no se consideran aprobadas por esta implementación.

## Publicación del 3 de noviembre

El usuario autoriza publicar servidor y cliente. El parche conjunto no era
aplicable por sí solo: su `rpg_action` llama a las misiones de taller
(`19b-workshop-missions.sql`), ausentes en la base remota, y la guarda rechazaba
`game_rpg_settle` por llevar ya la optimización de rendimiento publicada. Se
publica por eso el servidor completo (`supabase/server/` y `supabase/world.sql`)
con `npm run db:release -- --apply --backup-dir=<carpeta externa>`:

- Ensayo previo en transacción deshecha: 181 funciones locales instaladas tal cual,
  35 nuevas, 5 tablas nuevas, ningún personaje modificado y ninguna función nueva
  ejecutable por `anon`. Solo `cozy_view` se concede a `authenticated`.
- Se revocan permisos que faltaban en `game_cozy_hash`, `game_order_count`,
  `game_order_ready`, `game_custom_item` y `game_item_extended`.
- La copia de seguridad (funciones, permisos y datos de tablas públicas) se guarda
  fuera del repositorio porque contiene datos de jugadores.
- Casa del Olmo, su interior y los portales de las viviendas quedan publicados.

El menú **Mundo → Mis viviendas** no tenía manejador de clic; se enlaza en
`src/ui/menus.ts`. Las revisiones automáticas abrían la ventana con
`setWindow('homes')` y no pulsaban el botón.

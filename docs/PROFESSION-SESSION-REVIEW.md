# Recorrido de control hasta la primera mejora

27 de octubre de 2026. Continúa la pasada de ritmo tras cambiar la compra de recetas. No altera precios, botín excepcional, recompensas monetarias, energía ni estadísticas de clase.

## Qué comprueba

`npm run review:profession-session` carga el esquema, las funciones SQL y los mapas publicados del repositorio en PostgreSQL/WASM aislado. No lee credenciales ni se conecta a la base configurada. Un navegador ejecuta las colisiones y `updatePlay` del juego; sus desplazamientos pasan después por `world_sync`. Las puertas se cruzan con `world_travel`; daño, persecución, recompensas, recuperación, venta, aprendizaje, minería, trabajos y equipamiento los resuelven las RPC correspondientes.

Es una ruta automatizada conservadora de un guerrero humano que espera al salteador solitario. No mide una sesión humana, la ruta más rápida, competencia, latencia ni tiempo de lectura o clics. Mantiene la habilidad en rango uno y los dos puntos iniciales sin gastar. El checkpoint marca bienvenida completada y regreso de Isberto, concede los 5 Pelines de bienvenida y conserva equipo inicial y mochila vacía; omite los 40 XP de bienvenida para fijar un control mínimo de nivel uno con XP cero. No reproduce el tutorial ni concede progreso después del checkpoint.

El reloj avanza en pasos de 0,25 s durante combate y 0,5 s durante desplazamiento. En esperas seguras usa presencia validada cada 5 s: conserva la recuperación, duración de trabajos y reapariciones, pero no pretende medir patrullas ociosas a la cadencia normal del cliente. Los catálogos de la copia aislada se materializan con idénticos valores para evitar releer grandes literales en WASM; no es una prueba de rendimiento de PostgreSQL.

## Recorrido

1. Salir de casa de Isberto y cruzar la puerta este de Brumaluz.
2. Combatir al salteador, recoger sus materiales y recuperarse durante su reaparición. Reservar el cobre y reunir el precio con monedas y venta de cuero.
3. Volver al vendedor y al taller. Comprar pico, equiparlo y comprar al maestro la receta básica de componente.
4. Encargar cinco componentes y viajar a reunir cinco hierros mientras trabaja la cola. Usar emplazamientos disponibles distintos, sin esperar a que reaparezca artificialmente un único nodo.
5. Volver al taller, completar diez componentes para llegar a Iniciado, comprar la receta verde, fabricarla y equiparla. Comprobar que el daño básico aumenta respecto al arma inicial al mismo nivel.

El informe detallado se guarda en `art/recipe-training-review/session-report.json`, con tiempos por actividad, distancia, hitos, saldo y estado final. Un fallo conserva el diagnóstico y termina con código distinto de cero; no se presenta un recorrido interrumpido como completado.

## Corrección encontrada

`game_wilderness_finish` ignoraba la reaparición de cada emplazamiento y fijaba siempre 90 s. Ahora consulta el catálogo: conserva 90 s para las nueve criaturas anteriores y aplica 210/240/270/300/330 s a los cinco jabalíes superiores. No cambia las muertes ya resueltas.

La prueba SQL comprueba las 14 criaturas, la ausencia de reaparición antes del límite, la nueva generación al cumplirse el plazo y que resolver otra vez una muerte no prolongue la espera. Las 15 pruebas combinadas de obtención, presencia de recolección e IA pasan.

El parche está aplicado y verificado. Sustituye exclusivamente el cálculo del temporizador en la definición ya publicada, conservando sus otros cambios y permisos. No actualiza personajes ni estados de criaturas. `node scripts/apply-wilderness-respawn-fix.mjs --verify` comprueba su instalación; copia de reversión y registro en `art/recipe-training-review/respawn-deployment.json`.

## Interpretación

Recorrido completado sin muertes, correcciones de posición del servidor ni errores de JavaScript. Resultado del control:

| Medida | Resultado |
| --- | --- |
| Tiempo simulado total | 82 min 53,25 s |
| Reaparición y recuperación simultáneas | 65 min 49 s; 79,4 % del total |
| Combate, sin sus desplazamientos | 6 min 56,25 s |
| Desplazamientos, aproximación y recogida | 5 min 50 s; 1,93 km recorridos |
| Espera de extracción | 27,5 s para cinco hierros |
| Espera restante en taller | 3 min 50,5 s |
| Financiación | 45 victorias: 225 Pelines + 90 de vender cuero + 5 iniciales |
| Inversión | Pico 20 + receta de componente 50 + receta verde 250 = 320 Pelines |
| Estado final | Nivel 4, 0 Pelines, Herrería 130 XP, Minero 65 XP, energía 89,65/100 |
| Mejora equipada | Espada de la Hoja de Cobre, vinculada y con identidad por copia |
| Daño básico al mismo nivel | 11,13 → 12,243; mejora del 10 % |

Los trabajos humanos acumulan 5 min 57 s. Iniciar la primera tanda antes de salir al campo permite solapar 2 min 6,5 s con viajes y minería. El control conserva los 54 cobres sobrantes y los componentes no consumidos; no convierte todo el botín en dinero. El saldo cero indica que se ha pagado exactamente la inversión mínima elegida, no que se haya agotado todo el patrimonio del personaje.

La ruta comprueba que se puede cerrar el circuito. Su duración no debe generalizarse a las cinco clases ni a un jugador que rota enemigos, comercia o vende otros materiales. La receta es una inversión permanente de oficio: el coste no equivale al precio de una sola espada.

La siguiente decisión de equilibrio es ofrecer alternativas útiles para financiar el aprendizaje sin depender de esperar a un único enemigo. Encargos, misiones, cambios de vendedores o nuevas recompensas siguen siendo propuestas: esta revisión no los introduce ni sustituye el tramo narrativo aplazado.

**Seguimiento posterior del mismo día:** el usuario aprueba [Encargos diarios](DAILY-ORDERS.md) con materiales y piezas, límite diario y dificultad inferior a los proyectos de maestría. Esa implementación añade una vía de ingresos que no existía en el control anterior. Sus resultados no se restan de los tiempos de esta tabla para presentarlos como otra sesión medida.

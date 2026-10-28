# Enemigos con actividad, grupos y personalidad

Actualización del 27 de octubre: [Obtención](OBTAINABILITY.md) añade cinco jabalíes solitarios de mayor dificultad como fuentes de cuero. La población pasa a 14 criaturas y diez perfiles, conservando los grupos y nueve criaturas anteriores. La ampliación está aplicada y verificada en el servidor. La pasada de ritmo corrige además la reaparición compartida para respetar los 210–330 s del catálogo de estos jabalíes; los apartados de aplicación del 26 describen el despliegue anterior.

26 de octubre de 2026. Aplica la decisión de permitir movimiento en reposo, persecución y grupos de enemigos normales, respetando el tono acogedor del mundo y el combate sin fases ni tareas de misión por criatura.

## Población y conductas

Se conservan los cinco tipos y los emplazamientos originales como referencia. Hay nueve criaturas: dos individuos solitarios, una cuadrilla de tres bandidos con roles distintos, una pareja de jabalíes y una pareja de brotes. No hay enemigos nuevos en ciudades, puertas, agua o la reserva de llegada de la Arboleda.

| Tipo | En reposo | Al combatir |
| --- | --- | --- |
| Saqueador | Camina, se detiene y vigila | Persigue con una aproximación lateral corta |
| Salteador | Rondas cortas y pausas largas | Más lento; cada tercer golpe tiene preparación de 0,7 s, daño ×1,35 y recuperación adicional de 0,8 s |
| Vigía | Vigila y acompaña a la cuadrilla | Dispara hasta 6 m y da pasos atrás si se acercan demasiado |
| Jabalí | Hoza, olfatea y camina por su zona | Territorial a 2,8 m; apoya a su piara y acelera al comenzar la persecución |
| Brote | Deambula despacio y se balancea | Defensivo: no agrede por acercarse; responde a ataques y puede ayudar a su compañero herido |

Las pausas duran 2–6 segundos. Los acompañantes mantienen su separación respecto al líder cuando este pasea; si falta el líder, usan su propio recorrido. Variaciones discretas de rostro, pelo, barba y tamaño distinguen individuos sin modificar sus estadísticas, recompensas ni equipo. Los jabalíes mueven la cabeza al olfatear y los brotes inclinan su copa. La cadencia de pasos sigue el movimiento y conserva su fase al cambiar de velocidad. Vigías y brotes muestran sus proyectiles.

La ayuda exige compartir un grupo explícito, estar a 5–9 m según el perfil y tener visión del compañero. No se propaga por pertenecer a una especie ni por estar en otro grupo cercano. Los brotes ayudan si su compañero ha recibido daño. Cada criatura mantiene su vida, amenaza, muerte y botín; no existe una recompensa o ventana de victoria del grupo.

## Navegación y sincronización

Los hábitats respetan `LORE.md` y la geografía publicada de Pompelín. `tools/build-wilderness-habitats.mjs` consulta el mapa y las colisiones del juego y hornea cinco hábitats conectados con celdas de 2 m, comprobando suelo seco, pendiente, obstáculos y distancias a poblaciones y accesos. El generador no mueve recursos ni cambia el paisaje. Las rutas se limitan a este suelo autorizado: no atraviesan agua, muros o regiones completas.

El servidor elige destinos, pausas, amenazas, ayudas, ataques y posiciones. Si no puede caminar directamente al destino, busca un camino por las celdas conectadas, con una búsqueda acotada y caché por criatura. Descarta el recorrido si el siguiente paso deja de ser válido. Los enemigos persiguen dentro de un radio de 20–26 m desde su origen; al retirarse caminan de vuelta y recuperan la vida al llegar. La reaparición restaura actividad y animación. Un mundo sin observadores no simula y una pausa larga no acumula ataques o desplazamientos.

Los clientes interpolan las muestras compartidas, orientan la marcha y usan animaciones de paseo, carrera, vigilancia, olfateo y ataque. No deciden daño ni generan copias independientes de los enemigos. Las rutas internas no se incluyen en las vistas del mundo enviadas a los jugadores.

El marco de objetivo muestra un papel breve —territorial, defensivo, tirador, escaramuzador o golpes fuertes— para que se lea de un vistazo. La descripción completa queda en el perfil de datos, sin saturar el marco.

## Generación, prueba y publicación

- `npm run world:enemies`: reconstruye únicamente hábitats/catálogo de enemigos, sus SQL derivados y el parche revisable. Conserva las posiciones de recursos y otros mapas.
- `npm run test:enemies`: PostgreSQL aislado con el código de servidor real y reloj controlado. Comprueba patrullas, pausas, formación, ausencia prolongada, ayuda acotada, persecución, retirada, navegación alrededor de obstáculos, disparos desde distancia, golpe fuerte y reaparición. Compila la migración dos veces y comprueba que conserva generaciones activas, vida y datos de personajes.
- `npm run review:enemies`: dos clientes del juego real, en Pompelín, reciben muestras de esa base aislada. Comprueba posiciones compartidas, patrulla, persecución en grupo y regreso. Capturas e informe en `art/combat-review/enemies-*-gameplay.png` y `enemy-ai-review.json`.
- `npm --ignore-scripts run build`: tipos y distribución sin regenerar ubicaciones de recursos.

Después de editar o volver a publicar la geografía de Pompelín, ejecutar `npm run world:enemies` antes de preparar la publicación del servidor para que sus celdas coincidan con las nuevas colisiones.

`art/combat-review/enemy-ai-server-patch.sql` prepara una transacción con el catálogo, los auxiliares privados de IA y el alta de los cuatro acompañantes. Es repetible y conserva las instancias que ya combaten. No aplica cambios a la base configurada; debe publicarse mediante el procedimiento habitual antes de activar el cliente actualizado en una partida conectada. La revisión local de dos clientes no acredita rendimiento ni latencia en producción.

## Aplicación autorizada

El 26 de octubre de 2026, tras la petición explícita «aplícalo», se aplicó el parche a la base configurada mediante `node scripts/apply-wilderness-patch.mjs --apply`. Se verificaron las diez funciones privadas y los nueve enemigos, con cuatro altas. Se conservaron las cinco instancias existentes, incluida una en combate, sin modificar datos de personajes.

La verificación posterior detectó que las criaturas antiguas necesitaban recibir los metadatos de hábitat inmediatamente. Se corrigió la migración, se añadió una regresión para estados antiguos y se aplicó la corrección conservando las nueve instancias y el combate activo. La comprobación final del servidor devuelve código coincidente, nueve enemigos y navegación al origen válida en todos ellos. Actualizar solo estos metadatos no desplaza enemigos ni cadáveres.

`art/combat-review/enemy-ai-deployment.json` contiene el resultado y las rutas de la copia de seguridad y del SQL de reversión. La reversión conserva vida y progreso actuales; exige que los nuevos compañeros no estén combatiendo antes de retirarlos. `node scripts/apply-wilderness-patch.mjs --verify` comprueba el código instalado y la navegación al origen sin modificar la base. Esta aplicación actualiza la IA del servidor; no publica una nueva distribución del cliente.

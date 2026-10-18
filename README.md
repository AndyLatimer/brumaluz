# Crónicas de Brumaluz

MMO de navegador cozy en una ciudad medieval, con estilo pintado a mano.

## Cuentas y personajes

- Registro e inicio de sesión se gestionan con Supabase Auth; el proyecto no guarda contraseñas.
- Al registrarse, cada usuario elige un nombre de usuario único (3-20 letras ASCII, números o guion bajo). El acceso sigue usando correo y contraseña; el nombre de usuario identifica al jugador, aparece en la selección de personajes y es visible para otros usuarios autenticados.
- La interfaz está disponible en español e inglés; el idioma se cambia con las banderas de acceso y del menú del juego y queda guardado en el navegador.
- El acceso permite solicitar un correo de recuperación y cambiar la contraseña desde el enlace enviado por Supabase Auth.
- Los personajes se guardan en `public.characters`, protegidos por políticas RLS para que cada cuenta solo acceda a los suyos.
- Tras iniciar sesión aparece la selección de personajes. Desde ahí se puede jugar con uno existente o crear otro. Cada cuenta puede tener un máximo de cinco personajes; para crear más, primero hay que borrar uno. El creador guarda el personaje al pulsar «Guardar y entrar».
- Cada personaje guarda su nivel (comienza en 1), sus puntos de experiencia (comienzan en 0) y su última ubicación; la tarjeta de selección muestra el nivel y la zona guardada. Por ahora solo está disponible Brumaluz. Los personajes antiguos sin ubicación se asignan automáticamente a Brumaluz.
- Cada tarjeta de personaje permite borrarlo de la base de datos, tras confirmar escribiendo exactamente su nombre.

### Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/) y ejecuta [`supabase/schema.sql`](./supabase/schema.sql) en el SQL Editor del proyecto. Si ya configuraste Supabase, vuelve a ejecutar el archivo actualizado para crear los perfiles, activar el límite de cinco personajes y añadir el registro automático de nombres de usuario.
2. Los usuarios que ya existían recibirán un perfil sin nombre de usuario. Asígnales uno manualmente desde el SQL Editor: consulta sus cuentas con `select u.id, u.email, p.username from auth.users u left join public.profiles p on p.user_id = u.id order by u.created_at;` y para cada persona ejecuta `update public.profiles set username = 'NombreElegido' where user_id = 'UUID';`. El índice único no distingue mayúsculas de minúsculas; usa nombres de 3-20 letras ASCII, números o guion bajo. No se debe modificar `auth.users` para hacer esta asignación.
3. En **Auth → URL Configuration**, configura el Site URL y permite `http://localhost:5173/**` como Redirect URL de desarrollo (y `http://127.0.0.1:5173/**` si accedes usando esa dirección), además del dominio final al desplegar. Añade también la URL de producción para que los enlaces de recuperación puedan volver a la aplicación.
4. En la configuración de Auth, decide si quieres exigir confirmación de correo. Si está activada, el usuario deberá confirmarlo antes de iniciar sesión.
5. Copia `.env.example` como `.env.local` y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores de **Project URL** y la clave pública/publishable del proyecto.
6. Reinicia `npm run dev`. En producción, configura esas mismas variables en el servicio de despliegue y vuelve a compilar.

La clave publishable es para el navegador y está protegida por las políticas RLS de la base de datos. **No uses ni publiques una `service_role` o secret key en la web.** La autenticación real necesita el proyecto de Supabase y su esquema; sin esa configuración, el sitio muestra qué falta y no ofrece un acceso simulado.

## Creador de personaje

- Linajes: Humano, Elfo, Lagto' (gente lagarto) y Pelso (gente gato), hombre o mujer.
- Atributos (Fuerza, Intelecto, Corpulencia, Agilidad, Pericia, Presencia y Percepción): cada personaje empieza con 5 en cada atributo, suma 5 puntos de bonificación según su linaje y reparte 2 puntos libres. Ningún atributo puede superar 15. Los humanos destacan en Pericia y Presencia; los elfos en Intelecto, Pericia y Agilidad; los Lagto' en Fuerza y Corpulencia; los Pelso en Agilidad, combate y Percepción. La asignación se guarda con el personaje, pero por ahora no afecta a las mecánicas del juego.
- Altura y complexión ajustan tanto el tamaño general como las proporciones de piernas, torso, hombros y extremidades.
- Personajes modulares sobre el pack **KayKit Adventurers** (Kay Lousberg, CC0): cabezas, trajes,
  sombreros y armas se combinan sobre un esqueleto común con 21 animaciones.
- Colores de piel, pelo y ropa repintando la paleta de las texturas; orejas, colas y crestas
  propias para elfos, Lagto' y Pelso.
- Escenario con materiales PBR, HDRI de atardecer y relieve CC0 de Poly Haven (vía `@pmndrs/assets`).

## Créditos

- Personajes: [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) de Kay Lousberg (CC0).
- Ciudad: [KayKit Medieval Hexagon](https://kaylousberg.itch.io/kaykit-medieval-hexagon) de Kay Lousberg (CC0).
- HDRI y mapas de relieve: [Poly Haven](https://polyhaven.com) (CC0), empaquetados en `@pmndrs/assets`.

Para regenerar los modelos optimizados: `node tools/prepare-models.mjs <carpeta gltf de Adventurers>` y
`node tools/prepare-city.mjs <carpeta Assets/gltf de Medieval Hexagon>`.

## Ciudad

- Brumaluz está hecha con el pack **KayKit Medieval Hexagon** (Kay Lousberg, CC0) a escala ×4:
  plaza con fuente, avenidas, barrios residenciales, taberna, mercados, iglesia, herrería,
  castillo, granja con molino, río con vado y bosques y montañas alrededor. Una muralla de
  piedra rodea la capital y sus seis puertas conectan con las avenidas principales.
- Las calles se eligen y giran solas según sus vecinos; las puertas y la muralla se generan
  siguiendo el perímetro hexagonal y tienen colisión. El suelo continuo tiene colinas visibles
  dentro y fuera de la muralla, con plataformas suavizadas bajo los edificios; la hierba low-poly
  cubre también los claros entre casas y los islotes verdes de las calles, se mece con la brisa y
  se inclina al paso del personaje. Hay flores silvestres, nenúfares y plantas de ribera, bancos con
  colisión, puestos abastecidos junto a los comercios, bandadas de pájaros y un molino en movimiento.
  Seis puntos de servicio estables (`city.vendorSpots`) permiten añadir vendedores y otros NPCs
  más adelante sin rehacer la distribución.
- Al entrar se oyen viento, agua del río, pájaros, murmullo lejano de ciudad y campanas ocasionales,
  generados localmente con Web Audio; se pueden silenciar o reactivar desde el menú del juego. No se
  descargan pistas externas.
- Modo exploración: WASD se mueve respecto a la cámara (W hacia donde miras, A/D a los lados, S hacia ti) con aceleración y frenada suaves; el personaje se orienta hacia donde va. Arrastrar con el ratón orbita la cámara libremente (el vertical se mantiene), rueda para acercar con zoom suave, clic para moverse, Mayús alterna correr/caminar,
  espacio para saltar y E para saludar.
- Opciones (menú del juego): Vídeo (idioma), Sonido (sonido ambiental, volumen ambiental y volumen general; se guardan en el navegador) y Controles (teclado ilustrado).
  **Cada vez que se añada o cambie un control hay que reflejarlo en `CONTROLS` de `src/ui/controls.ts`**; la ventana se genera a partir de esa lista. No hay reasignación de teclas.
- Menú de personaje (`Tab`, icono a la izquierda del menú del juego): Inventario (mochila de 25 huecos + 1 bloqueado con «+» para futuras ampliaciones, 10 ranuras de equipo sobre un muñeco: cabeza, colgante, torso, manos, anillo, arma, mano izquierda, piernas, pies y abalorio; constantes en `src/data/inventory.ts`) y Ficha de personaje (`src/ui/playerWindows.ts`). Las monedas (Pelines y Lágrimas de fénix, premium) están descritas en [docs/CURRENCY.md](docs/CURRENCY.md). Habilidades, Profesiones, Enciclopedia y Social son solo botones por ahora; "Ayuda" del menú normal también.
- HUD del jugador (vida, maná/estamina, experiencia): las fórmulas son editables en
  `src/data/stats.ts` y están documentadas en [docs/STATS.md](docs/STATS.md).

## Estructura del proyecto

```
src/
  main.ts          punto de entrada: bucle de juego, HUD y menús
  data/            datos y reglas: data, stats, inventory, currency
  world/           ciudad y entorno: city, env, paint, render, audio, load
  character/       personaje: character, head, portrait
  ui/              interfaz: i18n, controls, tooltip, classIcons, playerWindows
  services/        cuentas (Supabase) y ajustes
  styles/          style.css
  assets/models/   modelos .glb
docs/              documentación de sistemas (STATS, CURRENCY)
tools/             scripts de preparación de modelos
```

## Desarrollo

```bash
npm install
npm run dev     # servidor de desarrollo
npm run build   # genera dist/index.html (un único archivo)
```

Tecnología: Three.js + TypeScript + Vite.

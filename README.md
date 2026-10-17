# Crónicas de Brumaluz

MMO de navegador cozy en una ciudad medieval, con estilo pintado a mano.

## Cuentas y personajes

- Registro e inicio de sesión se gestionan con Supabase Auth; el proyecto no guarda contraseñas.
- La interfaz está disponible en español e inglés; el idioma se cambia con las banderas de acceso y del menú del juego y queda guardado en el navegador.
- El acceso permite solicitar un correo de recuperación y cambiar la contraseña desde el enlace enviado por Supabase Auth.
- Los personajes se guardan en `public.characters`, protegidos por políticas RLS para que cada cuenta solo acceda a los suyos.
- Tras iniciar sesión aparece la selección de personajes. Desde ahí se puede jugar con uno existente o crear otro. Cada cuenta puede tener un máximo de cinco personajes; para crear más, primero hay que borrar uno. El creador guarda el personaje al pulsar «Guardar y entrar».
- Cada tarjeta de personaje permite borrarlo de la base de datos, tras confirmar escribiendo exactamente su nombre.

### Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/) y ejecuta [`supabase/schema.sql`](./supabase/schema.sql) en el SQL Editor del proyecto. Si ya configuraste Supabase, vuelve a ejecutar el archivo actualizado para activar el límite de cinco personajes en la base de datos.
2. En **Auth → URL Configuration**, configura el Site URL y permite `http://localhost:5173/**` como Redirect URL de desarrollo (y `http://127.0.0.1:5173/**` si accedes usando esa dirección), además del dominio final al desplegar. Añade también la URL de producción para que los enlaces de recuperación puedan volver a la aplicación.
3. En la configuración de Auth, decide si quieres exigir confirmación de correo. Si está activada, el usuario deberá confirmarlo antes de iniciar sesión.
4. Copia `.env.example` como `.env.local` y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores de **Project URL** y la clave pública/publishable del proyecto.
5. Reinicia `npm run dev`. En producción, configura esas mismas variables en el servicio de despliegue y vuelve a compilar.

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
- Modo exploración: WASD o clic para moverse, Mayús para caminar, arrastrar para girar la cámara,
  rueda para acercar y E para saludar.

## Desarrollo

```bash
npm install
npm run dev     # servidor de desarrollo
npm run build   # genera dist/index.html (un único archivo)
```

Tecnología: Three.js + TypeScript + Vite.

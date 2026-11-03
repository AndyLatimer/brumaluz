# Material Promocional y Banners de Brumaluz

Documento vivo del sistema de capturas, banners y material promocional del juego acordado el 3 de noviembre de 2026. Recoge las decisiones de diseño comercial, los scripts automatizados de captura y la hoja de ruta para ampliar el material a medida que crezca el contenido del juego.

---

## 1. Dirección y Criterios Confirmados

- **Exclusivamente juego real (sin arte por IA)**: Las imágenes promocionales deben reflejar fielmente la experiencia visual, modelos low-poly y entornos del motor Three.js de *Crónicas de Brumaluz*.
- **Presentación comercial adornada**: Cada captura se maqueta a **1920 × 1080 (Full HD)** con el lenguaje visual de publicación del juego:
  - Emblema oficial vectorizado (`src/assets/brand/brumaluz-emblem.svg`: farol de bienvenida, libro abierto y hojas de laurel).
  - Tipografías oficiales: `Cinzel Decorative` para la marca, `Cinzel` para titulares e insignias y `Alegreya` (cursiva) para bajadas descriptivas.
  - Marco heráldico con estrellas doradas (`✦`), separadores (`❖`) y sellos de ubicación regional.
  - Tarjetas de cristal ahumado oscuro con borde dorado translúcido y degradados de alta legibilidad.
- **Sin elementos de interfaz jugable**: En las tomas promocionales se ocultan completamente el HUD, el minimapa, el chat, las barras de vida y las placas de nombre flotantes.

---

## 2. Herramientas Automatizadas

Los scripts residen en `tools/` y utilizan Playwright con Vite en modo local para renderizar el mundo 3D y capturar los banners:

| Script | Descripción | Salida |
|---|---|---|
| `tools/render-promo-banners.mjs` | Carga el juego real, posiciona la cámara, ejecuta poses/mobiliario, inyecta el marco promocional en HTML/CSS y captura el banner comercial completo. | `art/promocional/banner_*.png` |
| `tools/render-promo-shots.mjs` | Captura fotográfica limpia a 1080p del motor 3D sin marcos ni textos (para miniaturas, recortes y vídeos). | `art/promocional/captura_*.png` |

### Comandos de ejecución rápida
Para regenerar o actualizar las imágenes tras cambios en el mundo o añadir contenido:
```bash
# Generar los 6 banners adornados
npm run art:promo:banners

# Generar las tomas limpias sin marcos
npm run art:promo:shots

# Generar el paquete promocional completo
npm run art:promo
```

---

## 3. Catálogo Actual de Banners (`art/promocional/`)

Actualmente se cuenta con 6 banners temáticos que cubren los pilares fundamentales del juego:

### 1. `banner_01_vida_de_barrio.png`
- **Ubicación**: Plaza central de Brumaluz (`brumaluz`).
- **Hora del mundo**: 19.3 (atardecer con faroles encendidos).
- **Escena**: La aventurera saluda amablemente en la plaza con faroles encendidos, el pozo de piedra, la taberna del barril y **Gnomi** con su gorro rojo.
- **Categoría**: `Vida de Barrio & Comunidad` | **Título**: *La Calidez de Brumaluz*.

### 2. `banner_02_exploracion_pompelin.png`
- **Ubicación**: El Gran Puente sobre el río (`pompelin`).
- **Hora del mundo**: 10.3 (media mañana soleada).
- **Escena**: Jugadora de pie en el centro de la cubierta del puente de madera saludando sobre el río cristalino y las praderas verdes.
- **Categoría**: `Exploración & Naturaleza` | **Título**: *Un Vasto Mundo por Descubrir*.

### 3. `banner_03_tu_propio_hogar.png`
- **Ubicación**: Interior de Casa del Olmo (`casa_del_olmo`).
- **Hora del mundo**: 20.8 (noche acogedora).
- **Escena**: La vivienda amueblada con alfombra decorativa, mesa de roble, farol encendido sobre el suelo, macetero y silla, con la jugadora sentada pacíficamente.
- **Categoría**: `Viviendas & Decoración Cozy` | **Título**: *Crea tu Propio Refugio*.

### 4. `banner_04_maestria_artesanal.png`
- **Ubicación**: Interior del Taller de Ebanistería (`taller_ebanisteria_interior`).
- **Escena**: El maestro elfo carpintero, el banco de trabajo con planos y maza, tablones de madera y estanterías de herramientas.
- **Categoría**: `10 Oficios Tradicionales` | **Título**: *El Arte de lo Hecho a Mano*.

### 5. `banner_05_la_arboleda_magica.png`
- **Ubicación**: Sendero de La Arboleda (`pompelin`, x: 670, z: -168).
- **Hora del mundo**: 16.5 (luz dorada entre copas).
- **Escena**: Bosque frondoso de árboles milenarios con motas luminosas de polvo de hada flotando junto al camino.
- **Categoría**: `Misterios & Magia Discreta` | **Título**: *El Secreto de La Arboleda*.

### 6. `banner_06_combate_y_aventura.png`
- **Ubicación**: Tierras exteriores frente a la muralla (`pompelin`).
- **Hora del mundo**: 17.2 (tarde dorada).
- **Escena**: Caballero con conjunto completo de combate (yelmo de caballero, capa, espada de acero y escudo heráldico) listo para defender las rutas comerciales.
- **Categoría**: `Aventura, Clases & Combate` | **Título**: *Defiende los Senderos*.

---

## 4. Sistema de Diseño Promocional (Estilos CSS)

El marco publicitario se inyecta dinámicamente mediante `#promo-frame` en `tools/render-promo-banners.mjs`:
- **Marco exterior**: `border: 1px solid rgba(226, 180, 84, 0.45); box-shadow: inset 0 0 120px rgba(10, 8, 6, 0.75);`
- **Barra superior**: Emblema SVG a 52x62 px + Kicker «Crónicas de» + Título «Brumaluz» en degradado oro (`#fff4d1` → `#e5ba5e` → `#a6722c`) + sello de región a la derecha.
- **Tarjeta inferior (Glassmorphism medieval)**:
  - Fondo: `linear-gradient(0deg, rgba(12, 9, 7, 0.96) 0%, rgba(14, 10, 8, 0.85) 60%, rgba(14, 10, 8, 0) 100%)`
  - Pill de categoría: fondo dorado tenue con borde `rgba(226, 180, 84, 0.7)` y texto en mayúsculas espaciadas.
  - Titular principal: fuente `Cinzel` a 42px con degradado marfil/oro y sombra pronunciada.
  - Regla decorativa: `❖` centrado con líneas en desvanecimiento horizontal.
  - Descripción: fuente `Alegreya` a 21px en cursiva, color marfil `#f7ebd0`.
  - Badges de características: píldoras compactas con viñeta `✦` destacando mecánicas clave.

---

## 5. Hoja de Ruta para Retomar Más Adelante

A medida que el proyecto incorpore nuevos sistemas y assets artísticos, se ampliará la colección con los siguientes banners:

1. **Pesca deportiva y relajante**:
   - *Momento*: Cuando el minijuego de pesca (`src/game/fishing.ts`) y la caña de pescar estén 100% integrados con animaciones en las orillas de Pompelín.
   - *Escena propuesta*: Jugador en la orilla del río al amanecer lanzando el sedal con reflejos de agua.
2. **Meriendas compartidas y cooperación**:
   - *Momento*: Cuando la interacción social de meriendas (`docs/SHARED-MEALS.md`) cuente con la mesa servida y varios NPCs/jugadores sentados juntos.
   - *Escena propuesta*: Grupo de vecinos de distintas razas compartiendo platos calientes en la plaza.
3. **Nuevas regiones y arquitectura**:
   - **Cumbres de Cobre (Pueblo Lagto')**: Arquitectura ciclópea, fundiciones y minería pesada (`docs/LAGTO-ASSETS.md`).
   - **Rusty Hearts (Hamlets)**: Aldeas rústicas medievales (`docs/HAMLET-ASSETS.md`).
   - **Ciudad de La Arboleda**: Mapa urbano élfico entre árboles gigantes cuando se publique su mapa propio.
4. **Combate activo contra grupos de enemigos**:
   - Escenas de acción con jabalíes salvajes o cuadrillas de salteadores en pleno enfrentamiento dinámico.
5. **Taller de Personajes y Linajes**:
   - Banner multi-personaje mostrando a las cuatro razas (Humano, Elfo, Pelso y Lagto') con sus diferentes peinados, linajes y vestimentas artesanales.

# Crónicas de Brumaluz

MMO de navegador cozy en una ciudad medieval, con estilo pintado a mano.

## Creador de personaje

- Linajes: Humano, Elfo, Lagto' (gente lagarto) y Pelso (gente gato), hombre o mujer.
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
  plaza con fuente, avenidas, barrio de casas, taberna, mercado, iglesia, herrería, castillo,
  granja con molino, río con vado y bosques y montañas alrededor, rodeada de agua.
- Las calles se eligen y giran solas según sus vecinos (`src/city.ts`).
- Modo exploración: WASD o clic para moverse, Mayús para caminar, arrastrar para girar la cámara,
  rueda para acercar y E para saludar.

## Desarrollo

```bash
npm install
npm run dev     # servidor de desarrollo
npm run build   # genera dist/index.html (un único archivo)
```

Tecnología: Three.js + TypeScript + Vite.

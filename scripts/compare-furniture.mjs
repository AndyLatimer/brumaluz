import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ICONS_DIR = 'src/assets/icons/inventory-painted';
const OUT_PATH = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a/furniture_comparison.png';

const KINDS = [
  { key: 'taburete', label: 'TABURETE' },
  { key: 'mesa', label: 'MESA' },
  { key: 'biblioteca', label: 'BIBLIOTECA' },
  { key: 'estacion', label: 'BANCO TRABAJO' },
  { key: 'silla', label: 'SILLA' },
  { key: 'banco', label: 'BANCO' },
  { key: 'mesita', label: 'MESITA' },
  { key: 'arcon', label: 'ARCÓN' },
  { key: 'alfombra', label: 'ALFOMBRA' },
  { key: 'farol', label: 'FAROL' },
  { key: 'macetero', label: 'MACETERO' },
  { key: 'biombo', label: 'BIOMBO' },
];

const TIERS = [
  { tier: 0, name: 'T0 Aprendiz', color: '#94a3b8' },
  { tier: 1, name: 'T1 Iniciado', color: '#4ade80' },
  { tier: 2, name: 'T2 Oficial', color: '#38bdf8' },
  { tier: 3, name: 'T3 Experto', color: '#c084fc' },
  { tier: 4, name: 'T4 Maestro', color: '#facc15' },
  { tier: 5, name: 'T5 Gran Maestro', color: '#fb923c' },
];

const CELL_SIZE = 120;
const PADDING = 16;
const HEADER_TOP = 80;
const LABEL_LEFT = 160;

const WIDTH = LABEL_LEFT + TIERS.length * (CELL_SIZE + PADDING) + PADDING;
const HEIGHT = HEADER_TOP + 30 + KINDS.length * (CELL_SIZE + PADDING) + PADDING;

const compositeList = [];

// Header SVG
const headerSvg = `
<svg width="${WIDTH}" height="${HEIGHT}">
  <rect width="100%" height="100%" fill="#10141a"/>
  <text x="${WIDTH / 2}" y="42" font-family="Cinzel, serif, Arial" font-size="24" font-weight="bold" fill="#f5d68a" text-anchor="middle" letter-spacing="2">
    COLECCIÓN DE MOBILIARIO DE EBANISTERÍA — ESTILO 2D PINTADO
  </text>
  <text x="${WIDTH / 2}" y="65" font-family="sans-serif" font-size="12" fill="#8899aa" text-anchor="middle">
    12 piezas de mobiliario doméstico en 6 calidades de madera (T0 Aprendiz a T5 Gran maestro)
  </text>

  <!-- Column Headers -->
  ${TIERS.map((t, idx) => {
    const x = LABEL_LEFT + idx * (CELL_SIZE + PADDING) + CELL_SIZE / 2;
    return `
      <text x="${x}" y="95" font-family="sans-serif" font-size="12" font-weight="bold" fill="${t.color}" text-anchor="middle">${t.name}</text>
    `;
  }).join('')}

  <!-- Row Headers -->
  ${KINDS.map((k, rIdx) => {
    const y = HEADER_TOP + 30 + rIdx * (CELL_SIZE + PADDING) + CELL_SIZE / 2 + 5;
    return `
      <text x="${LABEL_LEFT - 16}" y="${y}" font-family="Cinzel, serif, Arial" font-size="13" font-weight="bold" fill="#d1d5db" text-anchor="end">${k.label}</text>
    `;
  }).join('')}

  <!-- Slot frames -->
  ${KINDS.map((k, rIdx) => {
    return TIERS.map((t, cIdx) => {
      const x = LABEL_LEFT + cIdx * (CELL_SIZE + PADDING);
      const y = HEADER_TOP + 30 + rIdx * (CELL_SIZE + PADDING);
      return `
        <rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="10" fill="#18202c" stroke="#2c3b4f" stroke-width="1.5"/>
        <rect x="${x + 4}" y="${y + 4}" width="${CELL_SIZE - 8}" height="${CELL_SIZE - 8}" rx="8" fill="#141a24" stroke="#1f2937" stroke-width="1"/>
      `;
    }).join('');
  }).join('')}
</svg>`;

compositeList.push({
  input: Buffer.from(headerSvg),
  top: 0,
  left: 0,
});

// Load icons and composite
for (let rIdx = 0; rIdx < KINDS.length; rIdx++) {
  const kind = KINDS[rIdx];
  for (let cIdx = 0; cIdx < TIERS.length; cIdx++) {
    const tier = TIERS[cIdx].tier;
    const iconName = `mueble-${kind.key}-${tier}.webp`;
    const iconPath = join(ICONS_DIR, iconName);
    const iconBuf = await sharp(iconPath)
      .resize(CELL_SIZE - 16, CELL_SIZE - 16, { fit: 'inside' })
      .toBuffer();

    const x = LABEL_LEFT + cIdx * (CELL_SIZE + PADDING) + 8;
    const y = HEADER_TOP + 30 + rIdx * (CELL_SIZE + PADDING) + 8;

    compositeList.push({
      input: iconBuf,
      top: y,
      left: x,
    });
  }
}

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 16, g: 20, b: 26, alpha: 1 },
  },
})
  .composite(compositeList)
  .png()
  .toFile(OUT_PATH);

console.log(`Generated furniture comparison sheet at ${OUT_PATH}`);


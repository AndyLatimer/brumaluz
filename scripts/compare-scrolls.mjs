import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ICONS_DIR = 'src/assets/icons/inventory-painted';
const OUT_PATH = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a/scrolls_comparison.png';

const ELEMENTS = [
  { key: 'fire', label: 'FUEGO', color: '#ff6622' },
  { key: 'frost', label: 'ESCARCHA', color: '#44bbee' },
  { key: 'lightning', label: 'RELÁMPAGO', color: '#ffcc22' },
  { key: 'vampirism', label: 'VAMPIRISMO', color: '#ee2244' },
  { key: 'dark', label: 'OSCURIDAD', color: '#b55fe6' },
];

const TIERS = [
  { tier: 1, name: 'T1 Iniciado' },
  { tier: 2, name: 'T2 Oficial' },
  { tier: 3, name: 'T3 Experto' },
  { tier: 4, name: 'T4 Maestro' },
  { tier: 5, name: 'T5 Gran Maestro' },
];

const CELL_SIZE = 140;
const PADDING = 24;
const HEADER_TOP = 80;
const LABEL_LEFT = 140;

const WIDTH = LABEL_LEFT + TIERS.length * (CELL_SIZE + PADDING) + PADDING;
const HEIGHT = HEADER_TOP + ELEMENTS.length * (CELL_SIZE + PADDING) + PADDING;

// Create background canvas
const compositeList = [];

// Header SVG
const headerSvg = `
<svg width="${WIDTH}" height="${HEIGHT}">
  <rect width="100%" height="100%" fill="#10141a"/>
  <!-- Grid slot backgrounds -->
  <text x="${WIDTH / 2}" y="42" font-family="Cinzel, serif, Arial" font-size="24" font-weight="bold" fill="#f5d68a" text-anchor="middle" letter-spacing="2">
    COLECCIÓN DE PERGAMINOS DE ENCANTAMIENTO — ESTILO 2D PINTADO
  </text>
  <text x="${WIDTH / 2}" y="65" font-family="sans-serif" font-size="12" fill="#8899aa" text-anchor="middle">
    25 pergaminos únicos en 5 sendas arcanas (Tiers 1 a 5) con runas luminosas y sello de cera
  </text>

  <!-- Column Headers -->
  ${TIERS.map((t, idx) => {
    const x = LABEL_LEFT + idx * (CELL_SIZE + PADDING) + CELL_SIZE / 2;
    return `
      <text x="${x}" y="95" font-family="sans-serif" font-size="13" font-weight="bold" fill="#cbd5e1" text-anchor="middle">${t.name}</text>
    `;
  }).join('')}

  <!-- Row Headers -->
  ${ELEMENTS.map((e, rIdx) => {
    const y = HEADER_TOP + 30 + rIdx * (CELL_SIZE + PADDING) + CELL_SIZE / 2;
    return `
      <text x="${LABEL_LEFT - 18}" y="${y}" font-family="Cinzel, serif, Arial" font-size="14" font-weight="bold" fill="${e.color}" text-anchor="end">${e.label}</text>
    `;
  }).join('')}

  <!-- Slot frames -->
  ${ELEMENTS.map((e, rIdx) => {
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
for (let rIdx = 0; rIdx < ELEMENTS.length; rIdx++) {
  const elem = ELEMENTS[rIdx];
  for (let cIdx = 0; cIdx < TIERS.length; cIdx++) {
    const tier = TIERS[cIdx].tier;
    const iconName = `scroll-${elem.key}-${tier}.webp`;
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

console.log(`Generated scrolls comparison sheet at ${OUT_PATH}`);


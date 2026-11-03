import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const iconsDir = join(root, 'src', 'assets', 'icons', 'inventory-painted');
const artifactDir = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a';

const RARITY_COLORS = [
  '#a0a0a0', // Tier 0 (Común / Minúscula)
  '#50a850', // Tier 1 (Poco común / Iniciado)
  '#4a8cd4', // Tier 2 (Raro / Oficial)
  '#a85cd4', // Tier 3 (Épico / Experto)
  '#e8a820', // Tier 4 (Legendario / Maestro)
  '#e85040', // Tier 5 (Artefacto / Gran maestro)
];

const TIER_NAMES = ['Minúscula', 'Iniciado', 'Oficial', 'Experto', 'Maestro', 'Gran maestro'];

async function generatePotionSheet() {
  const size = 170;
  const padding = 18;
  const cols = 6;
  const rows = 3;

  const rowsData = [
    {
      family: 'Vida (Salud)',
      kind: 'health',
      items: [0, 1, 2, 3, 4, 5].map(t => ({
        file: `potion-health-${t}.webp`,
        label: `Vida (${TIER_NAMES[t]})`,
        color: RARITY_COLORS[t]
      }))
    },
    {
      family: 'Maná (Arcano)',
      kind: 'mana',
      items: [0, 1, 2, 3, 4, 5].map(t => ({
        file: `potion-mana-${t}.webp`,
        label: `Maná (${TIER_NAMES[t]})`,
        color: RARITY_COLORS[t]
      }))
    },
    {
      family: 'Estamina (Vigor)',
      kind: 'stamina',
      items: [0, 1, 2, 3, 4, 5].map(t => ({
        file: `potion-stamina-${t}.webp`,
        label: `Estamina (${TIER_NAMES[t]})`,
        color: RARITY_COLORS[t]
      }))
    }
  ];

  const totalW = cols * (size + padding) + padding;
  const rowHeight = size + padding + 46;
  const totalH = rows * rowHeight + padding + 70;

  const bgSvg = `
    <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1c1714"/>
          <stop offset="100%" stop-color="#120e0c"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bgGrad)"/>
      <text x="${totalW / 2}" y="42" fill="#fadb96" font-family="'Segoe UI', Georgia, serif" font-size="24" font-weight="bold" text-anchor="middle">Iconos Pintados de Pociones · Sistema Alquímico (Brumaluz)</text>
      ${rowsData.flatMap((rData, rIdx) => {
        const rowY = 60 + padding + rIdx * rowHeight;
        return rData.items.map((item, cIdx) => {
          const x = padding + cIdx * (size + padding);
          const y = rowY;
          return `
            <g transform="translate(${x}, ${y})">
              <!-- Item frame with tier rarity accents -->
              <rect x="0" y="0" width="${size}" height="${size}" rx="26" fill="#2d2826" stroke="#4a392b" stroke-width="5"/>
              <rect x="5" y="5" width="${size - 10}" height="${size - 10}" rx="20" fill="#3f3630" stroke="#8a734e" stroke-width="2.5"/>
              <rect x="10" y="10" width="${size - 20}" height="${size - 20}" rx="16" fill="none" stroke="${item.color}" stroke-opacity=".75" stroke-width="2.5"/>
              <path d="M16 14 V10 H20 M${size - 20} 10 H${size - 16} V14 M16 ${size - 14} V${size - 10} H20 M${size - 20} ${size - 10} H${size - 16} V${size - 14}" fill="none" stroke="${item.color}" stroke-width="2.5"/>
              <text x="${size / 2}" y="${size + 24}" fill="#fce5b8" font-family="'Segoe UI', system-ui, sans-serif" font-size="13" font-weight="bold" text-anchor="middle">${item.label}</text>
            </g>
          `;
        });
      }).join('')}
    </svg>
  `;

  const composites = [];
  for (let rIdx = 0; rIdx < rowsData.length; rIdx++) {
    const rData = rowsData[rIdx];
    const rowY = 60 + padding + rIdx * rowHeight;
    for (let cIdx = 0; cIdx < rData.items.length; cIdx++) {
      const item = rData.items[cIdx];
      const x = padding + cIdx * (size + padding) + 14;
      const y = rowY + 14;

      const imgBuf = await sharp(join(iconsDir, item.file))
        .resize(size - 28, size - 28, { fit: 'contain' })
        .toBuffer();

      composites.push({ input: imgBuf, left: x, top: y });
    }
  }

  const outPath = join(artifactDir, 'potions_comparison.png');
  await sharp(Buffer.from(bgSvg))
    .composite(composites)
    .png()
    .toFile(outPath);

  console.log('Saved potions comparison sheet to:', outPath);
}

generatePotionSheet().catch(console.error);


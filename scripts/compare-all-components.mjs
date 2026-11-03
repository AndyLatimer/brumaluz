import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const iconsDir = join(root, 'src', 'assets', 'icons', 'inventory-painted');
const artifactDir = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a';

async function generateComparison() {
  const size = 180;
  const padding = 20;
  const cols = 6;
  const rows = 3;

  const items = [
    { file: 'ore-0.webp', label: 'Mineral (Ref)' },
    { file: 'wood-0.webp', label: 'Madera (Ref)' },
    { file: 'componente-herreria.webp', label: 'Herrería' },
    { file: 'componente-sastreria.webp', label: 'Sastrería' },
    { file: 'componente-peleteria.webp', label: 'Peletería' },
    { file: 'componente-carpinteria.webp', label: 'Carpintería' },

    { file: 'componente-ebanisteria.webp', label: 'Ebanistería' },
    { file: 'componente-joyeria.webp', label: 'Joyería' },
    { file: 'componente-alquimia.webp', label: 'Alquimia' },
    { file: 'componente-encantamiento.webp', label: 'Encantamiento' },
    { file: 'componente-cocina.webp', label: 'Cocina' },
    { file: 'cuero-0.webp', label: 'Cuero (T0)' },

    { file: 'cuero-1.webp', label: 'Cuero (T1)' },
    { file: 'cuero-2.webp', label: 'Cuero (T2)' },
    { file: 'cuero-3.webp', label: 'Cuero (T3)' },
    { file: 'cuero-4.webp', label: 'Cuero (T4)' },
    { file: 'cuero-5.webp', label: 'Cuero (T5)' },
    { file: 'cuero.webp', label: 'Pelt Base' },
  ];

  const totalW = cols * (size + padding) + padding;
  const totalH = rows * (size + padding + 40) + padding + 60;

  const bgSvg = `
    <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e1814"/>
          <stop offset="100%" stop-color="#14100d"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bgGrad)"/>
      <text x="${totalW / 2}" y="42" fill="#fadb96" font-family="'Segoe UI', Georgia, serif" font-size="24" font-weight="bold" text-anchor="middle">Iconos Pintados de Componentes de Oficio y Cuero (Brumaluz)</text>
      ${items.map((item, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = padding + col * (size + padding);
        const y = 60 + padding + row * (size + padding + 40);
        return `
          <g transform="translate(${x}, ${y})">
            <!-- Weapon/item frame -->
            <rect x="0" y="0" width="${size}" height="${size}" rx="28" fill="#302c2b" stroke="#594533" stroke-width="6"/>
            <rect x="6" y="6" width="${size - 12}" height="${size - 12}" rx="22" fill="#494039" stroke="#b29463" stroke-width="3"/>
            <rect x="12" y="12" width="${size - 24}" height="${size - 24}" rx="18" fill="none" stroke="#a0a0a0" stroke-opacity=".7" stroke-width="3"/>
            <path d="M18 16 V12 H22 M${size - 22} 12 H${size - 18} V16 M18 ${size - 16} V${size - 12} H22 M${size - 22} ${size - 12} H${size - 18} V${size - 16}" fill="none" stroke="#ddc18b" stroke-width="2.5"/>
            <text x="${size / 2}" y="${size + 28}" fill="#eedbb5" font-family="'Segoe UI', system-ui, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">${item.label}</text>
          </g>
        `;
      }).join('')}
    </svg>
  `;

  const composites = [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = padding + col * (size + padding) + 16;
    const y = 60 + padding + row * (size + padding + 40) + 16;

    const imgBuf = await sharp(join(iconsDir, item.file))
      .resize(size - 32, size - 32, { fit: 'contain' })
      .toBuffer();

    composites.push({ input: imgBuf, left: x, top: y });
  }

  const outPath = join(artifactDir, 'all_crafting_components_comparison.png');
  await sharp(Buffer.from(bgSvg))
    .composite(composites)
    .png()
    .toFile(outPath);

  console.log('Saved comparison sheet to:', outPath);
}

generateComparison().catch(console.error);


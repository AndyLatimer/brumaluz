import sharp from 'sharp';

async function compare() {
  const size = 256;
  const padding = 24;
  const totalW = size * 3 + padding * 4;
  const totalH = size + padding * 2 + 50;

  // Background canvas
  const bgSvg = `
    <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1c1815"/>
      ${[0, 1, 2].map(i => {
        const x = padding + i * (size + padding);
        const labels = ['Mineral (Ref)', 'Madera (Ref)', 'Herrería (Nuevo)'];
        return `
          <g transform="translate(${x}, ${padding})">
            <rect x="0" y="0" width="${size}" height="${size}" rx="34" fill="#302c2b" stroke="#594533" stroke-width="8"/>
            <rect x="8" y="8" width="${size - 16}" height="${size - 16}" rx="26" fill="#494039" stroke="#b29463" stroke-width="4"/>
            <rect x="16" y="16" width="${size - 32}" height="${size - 32}" rx="22" fill="none" stroke="#a0a0a0" stroke-opacity=".7" stroke-width="4"/>
            <text x="${size / 2}" y="${size + 38}" fill="#f5deb3" font-family="Georgia, serif" font-size="20" font-weight="bold" text-anchor="middle">${labels[i]}</text>
          </g>
        `;
      }).join('')}
    </svg>
  `;

  const oreBuf = await sharp('src/assets/icons/inventory-painted/ore-0.webp').resize(size - 24, size - 24, { fit: 'contain' }).toBuffer();
  const woodBuf = await sharp('src/assets/icons/inventory-painted/wood-0.webp').resize(size - 24, size - 24, { fit: 'contain' }).toBuffer();
  const herreriaBuf = await sharp('src/assets/icons/inventory-painted/componente-herreria.webp').resize(size - 24, size - 24, { fit: 'contain' }).toBuffer();

  const composites = [
    { input: oreBuf, left: padding + 12, top: padding + 12 },
    { input: woodBuf, left: padding * 2 + size + 12, top: padding + 12 },
    { input: herreriaBuf, left: padding * 3 + size * 2 + 12, top: padding + 12 },
  ];

  await sharp(Buffer.from(bgSvg))
    .composite(composites)
    .png()
    .toFile('C:/Users/sevil/.gemini/antigravity/brain/820f133d-7bd5-41bf-8dee-1f128721b5f5/blacksmith_comparison.png');

  console.log('Successfully saved blacksmith_comparison.png');
}

compare().catch(console.error);

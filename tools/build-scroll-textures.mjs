import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = 'art/scrolls-textures';
await mkdir(outDir, { recursive: true });

function createRunicCircleSvg(element, config, isEmission = false) {
  const { colorMain, colorGlow, symbolPaths, emissionSymbolPaths } = config;

  const runeColor = isEmission ? (colorGlow || colorMain) : colorMain;
  const runeCount = 20;
  const radius = 330;

  const runesSvg = Array.from({ length: runeCount }).map((_, i) => {
    const angle = (i * 360) / runeCount;
    const rad = (angle * Math.PI) / 180;
    const x = 512 + radius * Math.cos(rad);
    const y = 512 + radius * Math.sin(rad);
    const runeIdx = i % 8;
    return `
      <g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${angle + 90}) scale(1.1)">
        <line x1="0" y1="-14" x2="0" y2="14" stroke="${runeColor}" stroke-width="${isEmission ? '5' : '4.5'}" stroke-linecap="round"/>
        ${runeIdx % 2 === 0 ? `<line x1="0" y1="-5" x2="11" y2="-12" stroke="${runeColor}" stroke-width="4" stroke-linecap="round"/>` : ''}
        ${runeIdx % 3 === 0 ? `<line x1="0" y1="5" x2="-11" y2="12" stroke="${runeColor}" stroke-width="4" stroke-linecap="round"/>` : ''}
        ${runeIdx % 4 === 0 ? `<line x1="0" y1="0" x2="9" y2="7" stroke="${runeColor}" stroke-width="4" stroke-linecap="round"/>` : ''}
      </g>
    `;
  }).join('');

  if (isEmission) {
    return `
      <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
        <rect width="1024" height="1024" fill="#000000"/>
        
        <!-- Outer Runic Ring -->
        <circle cx="512" cy="512" r="370" fill="none" stroke="${runeColor}" stroke-width="6" stroke-dasharray="20 12"/>
        <circle cx="512" cy="512" r="350" fill="none" stroke="${runeColor}" stroke-width="4"/>
        <circle cx="512" cy="512" r="310" fill="none" stroke="${runeColor}" stroke-width="3"/>
        <circle cx="512" cy="512" r="290" fill="none" stroke="${runeColor}" stroke-width="5" stroke-dasharray="12 8"/>

        <!-- Runes in ring -->
        ${runesSvg}

        <!-- Sacred Geometry Middle Ring -->
        <g stroke="${runeColor}" stroke-width="4" fill="none" stroke-linecap="round">
          <polygon points="512,250 697,435 774,512 697,589 512,774 327,589 250,512 327,435"/>
          <polygon points="512,250 774,512 512,774 250,512" stroke-dasharray="10 8"/>
          <circle cx="512" cy="512" r="200" stroke-width="5"/>
        </g>

        <!-- Center Inner Circle -->
        <circle cx="512" cy="512" r="165" fill="${runeColor}" fill-opacity="0.15" stroke="${runeColor}" stroke-width="6"/>

        <!-- Core Elemental Symbol -->
        <g transform="translate(512, 512) scale(3.2)">
          ${emissionSymbolPaths || symbolPaths}
        </g>
      </svg>
    `;
  }

  return `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Aged vellum background -->
        <radialGradient id="parchmentBg" cx="50%" cy="50%" r="68%">
          <stop offset="0%" stop-color="#fff8ed"/>
          <stop offset="50%" stop-color="#f6ebd4"/>
          <stop offset="82%" stop-color="#ddc69d"/>
          <stop offset="100%" stop-color="#b09062"/>
        </radialGradient>
        <linearGradient id="edgeVignette" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#6e4d26" stop-opacity="0.32"/>
          <stop offset="50%" stop-color="#6e4d26" stop-opacity="0"/>
          <stop offset="100%" stop-color="#6e4d26" stop-opacity="0.45"/>
        </linearGradient>
      </defs>

      <!-- Parchment Base -->
      <rect width="1024" height="1024" fill="url(#parchmentBg)"/>
      <rect width="1024" height="1024" fill="url(#edgeVignette)"/>

      <!-- Outer Runic Ring -->
      <circle cx="512" cy="512" r="370" fill="none" stroke="${colorMain}" stroke-width="6" stroke-dasharray="20 12"/>
      <circle cx="512" cy="512" r="350" fill="none" stroke="${colorMain}" stroke-width="4"/>
      <circle cx="512" cy="512" r="310" fill="none" stroke="${colorMain}" stroke-width="3"/>
      <circle cx="512" cy="512" r="290" fill="none" stroke="${colorMain}" stroke-width="5" stroke-dasharray="12 8"/>

      <!-- Runes in ring -->
      ${runesSvg}

      <!-- Sacred Geometry Middle Ring -->
      <g stroke="${colorMain}" stroke-width="4" fill="none" stroke-linecap="round">
        <polygon points="512,250 697,435 774,512 697,589 512,774 327,589 250,512 327,435"/>
        <polygon points="512,250 774,512 512,774 250,512" stroke-dasharray="10 8"/>
        <circle cx="512" cy="512" r="200" stroke-width="5"/>
      </g>

      <!-- Center Inner Circle -->
      <circle cx="512" cy="512" r="165" fill="#3b2012" fill-opacity="0.10" stroke="${colorMain}" stroke-width="6"/>

      <!-- Core Elemental Symbol -->
      <g transform="translate(512, 512) scale(3.2)">
        ${symbolPaths}
      </g>
    </svg>
  `;
}

// Elemental configs
const CONFIGS = {
  fire: {
    colorMain: '#ba3200',
    colorGlow: '#ff5500',
    symbolPaths: `
      <path d="M0 -34 C16 -18 24 -4 20 16 C16 32 -4 38 -16 30 C-26 22 -25 -2 -15 -16 C-13 -2 -4 6 0 0 C6 -8 3 -22 0 -34 Z" fill="#e65100" stroke="#bf360c" stroke-width="2"/>
      <path d="M-2 -20 C6 -10 12 -2 10 10 C8 20 -3 24 -10 18 C-16 12 -12 0 -5 -8 C-3 0 0 4 2 2 C4 -3 1 -12 -2 -20 Z" fill="#ffb300"/>
      <circle cx="-16" cy="-10" r="2.5" fill="#ff7043"/>
      <circle cx="16" cy="-6" r="3" fill="#ff9800"/>
    `,
    emissionSymbolPaths: `
      <path d="M0 -34 C16 -18 24 -4 20 16 C16 32 -4 38 -16 30 C-26 22 -25 -2 -15 -16 C-13 -2 -4 6 0 0 C6 -8 3 -22 0 -34 Z" fill="#ff3d00"/>
      <path d="M-2 -20 C6 -10 12 -2 10 10 C8 20 -3 24 -10 18 C-16 12 -12 0 -5 -8 C-3 0 0 4 2 2 C4 -3 1 -12 -2 -20 Z" fill="#ffea00"/>
    `
  },
  frost: {
    colorMain: '#0277bd',
    colorGlow: '#00e5ff',
    symbolPaths: `
      <g stroke="#0288d1" stroke-width="3" stroke-linecap="round">
        ${[0, 60, 120, 180, 240, 300].map(a => `
          <g transform="rotate(${a})">
            <line x1="0" y1="0" x2="0" y2="-34" stroke="#01579b" stroke-width="4"/>
            <line x1="0" y1="-16" x2="-9" y2="-25" stroke="#00b0ff" stroke-width="3"/>
            <line x1="0" y1="-16" x2="9" y2="-25" stroke="#00b0ff" stroke-width="3"/>
            <circle cx="0" cy="-35" r="2.5" fill="#81d4fa"/>
          </g>
        `).join('')}
      </g>
      <polygon points="0,-12 11,0 0,12 -11,0" fill="#40c4ff" stroke="#0277bd" stroke-width="2"/>
      <circle cx="0" cy="0" r="4" fill="#ffffff"/>
    `,
    emissionSymbolPaths: `
      <g stroke="#00e5ff" stroke-width="3.5" stroke-linecap="round">
        ${[0, 60, 120, 180, 240, 300].map(a => `
          <g transform="rotate(${a})">
            <line x1="0" y1="0" x2="0" y2="-34" stroke="#00e5ff" stroke-width="4.5"/>
            <line x1="0" y1="-16" x2="-9" y2="-25" stroke="#18ffff" stroke-width="3.5"/>
            <line x1="0" y1="-16" x2="9" y2="-25" stroke="#18ffff" stroke-width="3.5"/>
          </g>
        `).join('')}
      </g>
      <polygon points="0,-12 11,0 0,12 -11,0" fill="#e0f7fa"/>
    `
  },
  lightning: {
    colorMain: '#b27b00',
    colorGlow: '#ffea00',
    symbolPaths: `
      <path d="M5 -36 L-14 -6 L-2 -6 L-12 14 L14 -8 L2 -8 L11 -36 Z" fill="#ffd600" stroke="#f57f17" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M3 -28 L-9 -6 L-2 -6 L-7 10 L9 -8 L2 -8 L8 -28 Z" fill="#fffde7"/>
      <path d="M-18 6 L-24 16 L-18 16 L-22 28" fill="none" stroke="#29b6f6" stroke-width="3" stroke-linecap="round"/>
      <path d="M18 -2 L24 8 L18 8 L22 20" fill="none" stroke="#29b6f6" stroke-width="3" stroke-linecap="round"/>
    `,
    emissionSymbolPaths: `
      <path d="M5 -36 L-14 -6 L-2 -6 L-12 14 L14 -8 L2 -8 L11 -36 Z" fill="#ffff00"/>
      <path d="M-18 6 L-24 16 L-18 16 L-22 28" fill="none" stroke="#80d8ff" stroke-width="3.5"/>
      <path d="M18 -2 L24 8 L18 8 L22 20" fill="none" stroke="#80d8ff" stroke-width="3.5"/>
    `
  },
  vampirism: {
    colorMain: '#880e1e',
    colorGlow: '#ff1744',
    symbolPaths: `
      <path d="M-30 -4 Q-16 -20 0 0 Q16 -20 30 -4 Q20 14 0 18 Q-20 14 -30 -4 Z" fill="#3e070e" stroke="#5f0913" stroke-width="2"/>
      <path d="M0 -30 C14 -13 20 3 16 18 C11 31 -11 31 -16 18 C-20 3 -14 -13 0 -30 Z" fill="#c2185b" stroke="#880e1e" stroke-width="2.5"/>
      <path d="M-2 -20 C7 -9 11 3 9 14 C7 23 -7 23 -9 14 C-11 3 -7 -9 -2 -20 Z" fill="#ff5252"/>
      <circle cx="0" cy="5" r="3.5" fill="#ffffff" opacity="0.8"/>
    `,
    emissionSymbolPaths: `
      <path d="M0 -30 C14 -13 20 3 16 18 C11 31 -11 31 -16 18 C-20 3 -14 -13 0 -30 Z" fill="#ff1744"/>
      <path d="M-2 -20 C7 -9 11 3 9 14 C7 23 -7 23 -9 14 C-11 3 -7 -9 -2 -20 Z" fill="#ff8a80"/>
    `
  },
  dark: {
    colorMain: '#4a148c',
    colorGlow: '#d500f9',
    symbolPaths: `
      <path d="M0 -32 A 26 26 0 1 1 -26 14 A 30 30 0 1 0 0 -32 Z" fill="#240046" stroke="#4a148c" stroke-width="2.5"/>
      <ellipse cx="0" cy="0" rx="22" ry="12" fill="#10002b" stroke="#7b1fa2" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="8" fill="#aa00ff"/>
      <circle cx="0" cy="0" r="3.5" fill="#f3e5f5"/>
      <path d="M-27 0 Q-16 -16 0 -16 Q16 -16 27 0 Q16 16 0 16 Q-16 16 -27 0 Z" fill="none" stroke="#e040fb" stroke-width="2" stroke-dasharray="5 3"/>
    `,
    emissionSymbolPaths: `
      <circle cx="0" cy="0" r="8" fill="#e040fb"/>
      <circle cx="0" cy="0" r="3.5" fill="#ffffff"/>
      <path d="M-27 0 Q-16 -16 0 -16 Q16 -16 27 0 Q16 16 0 16 Q-16 16 -27 0 Z" fill="none" stroke="#ea80fc" stroke-width="2.5"/>
    `
  }
};

for (const [key, cfg] of Object.entries(CONFIGS)) {
  // Diffuse texture
  const svg = createRunicCircleSvg(key, cfg, false);
  const pngPath = join(outDir, `${key}-parchment.png`);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);

  // Emission mask texture
  const emSvg = createRunicCircleSvg(key, cfg, true);
  const emPngPath = join(outDir, `${key}-emission.png`);
  await sharp(Buffer.from(emSvg)).png().toFile(emPngPath);

  console.log(`Generated textures for ${key}: diffuse & emission`);
}


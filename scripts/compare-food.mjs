import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ICONS_DIR = 'src/assets/icons/inventory-painted';
const OUT_PATH = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a/food_comparison.png';

const TIERS = [
  {
    tier: 0,
    file: 'pan-duro.webp',
    id: 'pan_duro',
    name: 'Pan duro',
    rank: 'T0 Aprendiz',
    rarity: 'Común',
    color: '#94a3b8',
    buff: '+5 Vida máx · +3 Recurso',
    desc: 'Hogaza de masa madre rústica con cortes de greña, rebanada migada, cuchillo de panadero y tabla de corte.'
  },
  {
    tier: 1,
    file: 'comida-1.webp',
    id: 'comida_1',
    name: 'Provisión · I',
    rank: 'T1 Iniciado',
    rarity: 'Poco común',
    color: '#4ade80',
    buff: '+15 Vida máx · +10 Recurso',
    desc: 'Trencher de roble tallado con panecillo dorado, cuña de queso de granja, setas de bosque, bayas rojas y romero.'
  },
  {
    tier: 2,
    file: 'comida-2.webp',
    id: 'comida_2',
    name: 'Provisión · II',
    rank: 'T2 Oficial',
    rarity: 'Raro',
    color: '#38bdf8',
    buff: '+30 Vida máx · +20 Recurso',
    desc: 'Plato con aro de latón, salchicha curada asada a la brasa, panecillo, queso curado, rebozuelos y frutos silvestres.'
  },
  {
    tier: 3,
    file: 'comida-3.webp',
    id: 'comida_3',
    name: 'Provisión · III',
    rank: 'T3 Experto',
    rarity: 'Épico',
    color: '#c084fc',
    buff: '+50 Vida máx · +35 Recurso',
    desc: 'Trencher de nogal oscuro, muslo de ave asado glaseado con hueso de marfil expuesto, pan brioche trenzado, queso madurado y uvas.'
  },
  {
    tier: 4,
    file: 'comida-4.webp',
    id: 'comida_4',
    name: 'Provisión · IV',
    rank: 'T4 Maestro',
    rarity: 'Legendario',
    color: '#facc15',
    buff: '+80 Vida máx · +55 Recurso',
    desc: 'Bandeja de caoba con ribete de oro, empanada hojaldrada con repulgue artesanal, muslo glaseado, trufa negra y brevas melosas.'
  },
  {
    tier: 5,
    file: 'comida-5.webp',
    id: 'comida_5',
    name: 'Provisión · V',
    rank: 'T5 Gran Maestro',
    rarity: 'Artefacto',
    color: '#fb923c',
    buff: '+120 Vida máx · +80 Recurso',
    desc: 'Platón ceremonial con doble anillo de oro bruñido, corona de costillar asado dorado, brioche celestial, bayas estelares y halo radiante.'
  },
];

const COMPONENT = {
  file: 'componente-cocina.webp',
  id: 'componente_cocina_0',
  name: 'Componente de Cocina',
  rank: 'T0 Aprendiz',
  color: '#eab308',
  desc: 'Mortero de esteatita, mano de madera noble, saquito de especias aromáticas, hierbas de secado y rodillo culinario.'
};

const WIDTH = 1240;
const HEIGHT = 780;
const SLOT_SIZE = 148;
const PADDING_X = 28;
const START_X = 36;
const CARD_WIDTH = Math.floor((WIDTH - START_X * 2 - PADDING_X * 5) / 6); // ~171px
const ROW_Y = 110;

const compositeList = [];

// Base SVG canvas
const svg = `
<svg width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#141923"/>
      <stop offset="50%" stop-color="#0f131a"/>
      <stop offset="100%" stop-color="#090c10"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1d2634"/>
      <stop offset="100%" stop-color="#121822"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f5d68a"/>
      <stop offset="50%" stop-color="#ffd700"/>
      <stop offset="100%" stop-color="#e6a838"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  <rect x="12" y="12" width="${WIDTH - 24}" height="${HEIGHT - 24}" rx="16" fill="none" stroke="#253245" stroke-width="1.5"/>

  <!-- Header -->
  <text x="${WIDTH / 2}" y="48" font-family="Cinzel, serif, Georgia, Arial" font-size="26" font-weight="bold" fill="url(#goldGrad)" text-anchor="middle" letter-spacing="3">
    COLECCIÓN DE GASTRONOMÍA Y COCINA · ESTILO 2D PINTADO
  </text>
  <text x="${WIDTH / 2}" y="74" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">
    Progreso culinario completo (T0 Aprendiz a T5 Gran maestro) renderizado en Blender 5.2 Cycles con sombreado pictórico y materiales orgánicos
  </text>

  <!-- 6 Tier Cards -->
  ${TIERS.map((t, idx) => {
    const cardX = START_X + idx * (CARD_WIDTH + PADDING_X);
    const slotX = cardX + (CARD_WIDTH - SLOT_SIZE) / 2;
    const slotY = ROW_Y + 36;
    return `
      <!-- Card background -->
      <rect x="${cardX}" y="${ROW_Y}" width="${CARD_WIDTH}" height="420" rx="12" fill="url(#cardGrad)" stroke="#273549" stroke-width="1.2"/>
      
      <!-- Tier banner -->
      <rect x="${cardX}" y="${ROW_Y}" width="${CARD_WIDTH}" height="28" rx="12" fill="${t.color}" fill-opacity="0.12"/>
      <rect x="${cardX}" y="${ROW_Y + 16}" width="${CARD_WIDTH}" height="12" fill="${t.color}" fill-opacity="0.12"/>
      <text x="${cardX + CARD_WIDTH / 2}" y="${ROW_Y + 19}" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="${t.color}" text-anchor="middle" letter-spacing="0.5">
        ${t.rank.toUpperCase()}
      </text>

      <!-- Slot frame -->
      <rect x="${slotX}" y="${slotY}" width="${SLOT_SIZE}" height="${SLOT_SIZE}" rx="12" fill="#0d1117" stroke="${t.color}" stroke-opacity="0.4" stroke-width="1.5"/>
      <rect x="${slotX + 4}" y="${slotY + 4}" width="${SLOT_SIZE - 8}" height="${SLOT_SIZE - 8}" rx="9" fill="#141a24" stroke="#1f2937" stroke-width="1"/>

      <!-- Item Title & Rarity -->
      <text x="${cardX + CARD_WIDTH / 2}" y="${slotY + SLOT_SIZE + 26}" font-family="Cinzel, serif, Georgia, Arial" font-size="15" font-weight="bold" fill="#f8fafc" text-anchor="middle">
        ${t.name}
      </text>
      <text x="${cardX + CARD_WIDTH / 2}" y="${slotY + SLOT_SIZE + 44}" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="${t.color}" text-anchor="middle">
        ${t.rarity}
      </text>

      <!-- Buff Badge -->
      <rect x="${cardX + 10}" y="${slotY + SLOT_SIZE + 54}" width="${CARD_WIDTH - 20}" height="24" rx="6" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
      <text x="${cardX + CARD_WIDTH / 2}" y="${slotY + SLOT_SIZE + 70}" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" fill="#38bdf8" text-anchor="middle">
        ${t.buff}
      </text>

      <!-- Mini description -->
      <foreignObject x="${cardX + 8}" y="${slotY + SLOT_SIZE + 86}" width="${CARD_WIDTH - 16}" height="95">
        <p xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui, sans-serif; font-size: 10px; line-height: 1.35; color: #94a3b8; text-align: center; margin: 0;">
          ${t.desc}
        </p>
      </foreignObject>
    `;
  }).join('')}

  <!-- Bottom Panel: Culinary Component & Production Info -->
  <rect x="${START_X}" y="555" width="${WIDTH - START_X * 2}" height="185" rx="14" fill="#151d29" stroke="#253549" stroke-width="1.2"/>
  
  <!-- Component slot -->
  <rect x="${START_X + 24}" y="575" width="145" height="145" rx="12" fill="#0d1117" stroke="#eab308" stroke-opacity="0.5" stroke-width="1.5"/>
  <rect x="${START_X + 28}" y="579" width="137" height="137" rx="9" fill="#141a24" stroke="#1f2937" stroke-width="1"/>

  <!-- Component Info -->
  <text x="${START_X + 190}" y="605" font-family="Cinzel, serif, Georgia, Arial" font-size="19" font-weight="bold" fill="#f5d68a">
    ${COMPONENT.name} · Utensilios Culinarios
  </text>
  <text x="${START_X + 190}" y="628" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#eab308">
    Componente base de oficio (Oficio: Cocina · Rango Aprendiz)
  </text>
  <text x="${START_X + 190}" y="652" font-family="system-ui, sans-serif" font-size="12" fill="#cbd5e1">
    ${COMPONENT.desc}
  </text>

  <!-- Technical highlights block -->
  <line x1="${START_X + 190}" y1="670" x2="${WIDTH - START_X - 24}" y2="670" stroke="#27384f" stroke-width="1"/>
  
  <text x="${START_X + 190}" y="694" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#38bdf8">
    ✓ Modelado Bmesh &amp; Curvas orgánicas
  </text>
  <text x="${START_X + 190}" y="710" font-family="system-ui, sans-serif" font-size="10.5" fill="#8899aa">
    Muslos de ave con nudillo de hueso marfil, hogazas con greñado de panadería, empanadas con repulgue esférico y platter imperial dorado.
  </text>

  <text x="${START_X + 540}" y="694" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#4ade80">
    ✓ Sombras de Contacto Suaves
  </text>
  <text x="${START_X + 540}" y="710" font-family="system-ui, sans-serif" font-size="10.5" fill="#8899aa">
    Shadow Catcher Cycles con oclusión ambiental y dispersión cálida para asentamiento perfecto sobre UI oscura.
  </text>

  <text x="${START_X + 850}" y="694" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#facc15">
    ✓ Paleta &amp; Estilo 2D Pictórico
  </text>
  <text x="${START_X + 850}" y="710" font-family="system-ui, sans-serif" font-size="10.5" fill="#8899aa">
    Coherencia idéntica con componentes de herrería, frascos de pociones, pergaminos de encantamiento y muebles.
  </text>
</svg>
`;

compositeList.push({
  input: Buffer.from(svg),
  top: 0,
  left: 0,
});

// Load food tier icons
for (let idx = 0; idx < TIERS.length; idx++) {
  const t = TIERS[idx];
  const cardX = START_X + idx * (CARD_WIDTH + PADDING_X);
  const slotX = Math.round(cardX + (CARD_WIDTH - SLOT_SIZE) / 2);
  const slotY = ROW_Y + 36;
  const iconPath = join(ICONS_DIR, t.file);
  const iconBuf = await sharp(iconPath)
    .resize(SLOT_SIZE - 16, SLOT_SIZE - 16, { fit: 'inside' })
    .toBuffer();

  compositeList.push({
    input: iconBuf,
    top: Math.round(slotY + 8),
    left: Math.round(slotX + 8),
  });
}

// Load component icon
const compIconPath = join(ICONS_DIR, COMPONENT.file);
const compBuf = await sharp(compIconPath)
  .resize(129, 129, { fit: 'inside' })
  .toBuffer();

compositeList.push({
  input: compBuf,
  top: 583,
  left: START_X + 32,
});

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 10, g: 13, b: 18, alpha: 1 },
  },
})
  .composite(compositeList)
  .png()
  .toFile(OUT_PATH);

console.log(`Generated food comparison sheet at ${OUT_PATH}`);

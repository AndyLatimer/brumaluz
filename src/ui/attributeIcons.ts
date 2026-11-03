// Iconos vectoriales de los atributos (viewBox 64×64) para la ficha de personaje.
// Un único símbolo por atributo con el lenguaje heráldico de Brumaluz: contorno oscuro, oro, acero, brillos y sombra.
import type { AttributeId } from '../data/data';

const INK = '#241408';
const INK_SOFT = '#3d2412';

const wrap = (id: string, defs: string, body: string) => `<svg class="attribute-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c0"/><stop offset=".5" stop-color="#e5b654"/><stop offset="1" stop-color="#946420"/></linearGradient>
<linearGradient id="${id}-g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#ffe68a"/><stop offset="1" stop-color="#d69e38"/></linearGradient>
<linearGradient id="${id}-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#c8d6e5"/><stop offset="1" stop-color="#6f8099"/></linearGradient>
<linearGradient id="${id}-sd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7e90a6"/><stop offset=".6" stop-color="#4c5b70"/><stop offset="1" stop-color="#263242"/></linearGradient>
<linearGradient id="${id}-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c68b55"/><stop offset=".5" stop-color="#8c562b"/><stop offset="1" stop-color="#532e14"/></linearGradient>
<linearGradient id="${id}-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f6ff"/><stop offset=".5" stop-color="#68adff"/><stop offset="1" stop-color="#255db8"/></linearGradient>
<filter id="${id}-d" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="1.4" stdDeviation="1" flood-color="#180c04" flood-opacity=".48"/></filter>
${defs}
</defs>
<g stroke-linejoin="round" stroke-linecap="round" filter="url(#${id}-d)">${body}</g>
</svg>`;

const sparkle = (x: number, y: number, r: number, fill = '#fff4cc', stroke = '#6a4a14') =>
  `<path d="M${x} ${y - r}l${r * .3} ${r * .7} ${r * .7} ${r * .3}-${r * .7} ${r * .3}-${r * .3} ${r * .7}-${r * .3}-${r * .7}-${r * .7}-${r * .3} ${r * .7}-${r * .3}Z" fill="${fill}" stroke="${stroke}" stroke-width=".8"/>`;

// 1. FUERZA: guantelete de acero laminado cerrado en un puño de poder, con nudillos dorados reforzados y ráfagas de impacto.
const fuerza = wrap('ai-fu', `<linearGradient id="ai-fu-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c0392f"/><stop offset="1" stop-color="#5e161c"/></linearGradient>`, `
${[[10, 16, 4, 11], [22, 6, 20, 2], [42, 6, 44, 2], [54, 16, 60, 11]].map(([x1, y1, x2, y2]) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="4.2"/><path d="M${x1} ${y1}L${x2} ${y2}" stroke="url(#ai-fu-g)" stroke-width="2.2"/>`).join('')}
<path d="M16 46H48L46 60C46 61.2 44.5 62 43 62H21C19.5 62 18 61.2 18 60Z" fill="url(#ai-fu-sd)" stroke="${INK}" stroke-width="2.2"/>
<path d="M15.5 45H48.5V49.5H15.5Z" fill="url(#ai-fu-g)" stroke="${INK}" stroke-width="1.7"/>
<path d="M18 46.5H46" stroke="#ffffff" stroke-width="1.2" opacity=".9"/>
<path d="M20 54H44" stroke="#c0392f" stroke-width="2.2" stroke-linecap="round"/>
<circle cx="32" cy="54" r="1.8" fill="url(#ai-fu-g)" stroke="${INK}" stroke-width=".8"/>
<path d="M11 25C11 23 13 21 15 21H49C51 21 53 23 53 25V37C53 42 48 45.5 43 45.5H21C16 45.5 11 42 11 37Z" fill="url(#ai-fu-s)" stroke="${INK}" stroke-width="2.4"/>
<path d="M32 21V45" stroke="#ffffff" stroke-width="1.5" opacity=".7"/>
<path d="M32.8 21.5V45" stroke="${INK_SOFT}" stroke-width="1" opacity=".5"/>
${[
  { x: 12, y: 12, w: 9.5, h: 18, r: 4.5 },
  { x: 22, y: 8.5, w: 10, h: 21, r: 5 },
  { x: 32.5, y: 8.5, w: 10, h: 21, r: 5 },
  { x: 43, y: 12, w: 9.5, h: 18, r: 4.5 },
].map((f) => `
  <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.r}" fill="url(#ai-fu-s)" stroke="${INK}" stroke-width="2.2"/>
  <path d="M${f.x + 2.5} ${f.y + 3.5}Q${f.x + f.w / 2} ${f.y + 1.5} ${f.x + f.w - 2.5} ${f.y + 3.5}" fill="none" stroke="#fff" stroke-width="1.6"/>
  <path d="M${f.x + 1} ${f.y + f.h * .55}H${f.x + f.w - 1}" stroke="${INK}" stroke-width="1.4"/>
  <path d="M${f.x + 2} ${f.y + f.h * .55 - .8}H${f.x + f.w - 2}" stroke="#fff" stroke-width=".8" opacity=".8"/>
  <circle cx="${f.x + f.w / 2}" cy="${f.y + f.h * .55}" r="1.8" fill="url(#ai-fu-g)" stroke="${INK}" stroke-width=".9"/>
  <circle cx="${f.x + f.w / 2 - .5}" cy="${f.y + f.h * .55 - .5}" r=".6" fill="#fff"/>
`).join('')}
<path d="M10 28C10 23.5 13 21 18 21L28 24.5C31.5 26 31.5 31.5 28 33.5L18 36.5C13 36.5 10 33 10 28Z" fill="url(#ai-fu-s)" stroke="${INK}" stroke-width="2.4"/>
<path d="M17 23.5L26 26.5C28.5 27.5 28.5 31 26 32L17 34.5C15 34.5 14 32.5 14 29C14 25.5 15 23.5 17 23.5Z" fill="url(#ai-fu-g)" stroke="${INK}" stroke-width="1.4"/>
<path d="M16 25L24 27.5" stroke="#ffffff" stroke-width="1.2" opacity=".9"/>
<circle cx="21" cy="29" r="1.5" fill="#c0392f" stroke="${INK}" stroke-width=".7"/>
${sparkle(32, 28, 3.5, '#fff6cc')}`);

// 2. INTELECTO: grimorio arcano abierto con páginas iluminadas y estrella astral radiante de 8 puntas.
const intelecto = wrap('ai-in', `<radialGradient id="ai-in-a" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#c6e0ff" stop-opacity=".95"/><stop offset="1" stop-color="#558ee8" stop-opacity="0"/></radialGradient>
<linearGradient id="ai-in-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b6be0"/><stop offset=".6" stop-color="#4e33a6"/><stop offset="1" stop-color="#241656"/></linearGradient>
<linearGradient id="ai-in-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#e8d5aa"/></linearGradient>
<linearGradient id="ai-in-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c0dcff"/><stop offset="1" stop-color="#4a76e0"/></linearGradient>`, `
<circle cx="32" cy="16" r="18" fill="url(#ai-in-a)"/>
<path d="M4 33V55C14 51.5 23.5 52.5 32 58C40.5 52.5 50 51.5 60 55V33" fill="url(#ai-in-c)" stroke="${INK}" stroke-width="2.4"/>
<path d="M4 49V55L10 53.5M60 49V55L54 53.5" fill="none" stroke="url(#ai-in-g)" stroke-width="2.2"/>
<path d="M7 30C16 26.5 24.5 27.5 31.5 33V55C24.5 49.5 16 48.5 7 52Z" fill="url(#ai-in-p)" stroke="${INK}" stroke-width="2"/>
<path d="M57 30C48 26.5 39.5 27.5 32.5 33V55C39.5 49.5 48 48.5 57 52Z" fill="url(#ai-in-p)" stroke="${INK}" stroke-width="2"/>
<path d="M8 28.5C16.5 25.5 24.5 26.5 31 31.5M56 28.5C47.5 25.5 39.5 26.5 33 31.5" fill="none" stroke="url(#ai-in-g)" stroke-width="1.2" opacity=".7"/>
<path d="M12 36C17 34.5 21 35 26 37M12 41C17 39.5 21 40 26 42M12 46C17 44.5 21 45 26 47" fill="none" stroke="#9e7b46" stroke-width="1.4" stroke-linecap="round"/>
<path d="M38 37C43 35 47 34.5 52 36M38 42C43 40 47 39.5 52 41M38 47C43 45 47 44.5 52 46" fill="none" stroke="#9e7b46" stroke-width="1.4" stroke-linecap="round"/>
<path d="M14 33L16 35L14 37M50 33L48 35L50 37" fill="none" stroke="#c49432" stroke-width="1.2"/>
<path d="M32 33V56" stroke="${INK}" stroke-width="1.8"/>
<path d="M32 55V63L35 60.5L38 63V54.5" fill="#c0393b" stroke="${INK}" stroke-width="1.3"/>
<path d="M33.5 56V61.5" stroke="#ffd2cc" stroke-width=".8"/>
<path d="M32 2L35.5 11.5L45 15L35.5 18.5L32 28L28.5 18.5L19 15L28.5 11.5Z" fill="url(#ai-in-t)" stroke="#1a2558" stroke-width="2"/>
<path d="M32 8L34 13L39 15L34 17L32 22L30 17L25 15L30 13Z" fill="url(#ai-in-g)" stroke="${INK}" stroke-width="1"/>
<circle cx="32" cy="15" r="3.2" fill="#ffffff"/>
<circle cx="32" cy="15" r="1.8" fill="#d6f0ff"/>
<path d="M32 5V25" stroke="#ffffff" stroke-width="1.5" opacity=".95"/>
<path d="M22 15H42" stroke="#ffffff" stroke-width="1.5" opacity=".95"/>
${sparkle(20, 8, 2, '#fff4cc')}
${sparkle(44, 9, 2.2, '#fff4cc')}
${sparkle(32, 31, 1.6, '#b8dcff')}`);

// 3. CORPULENCIA: escudo de armas de acero y oro reforzado con remaches y garras que engarzan un corazón de rubí tallado.
const corpulencia = wrap('ai-co', `<linearGradient id="ai-co-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9482"/><stop offset=".5" stop-color="#dc2b37"/><stop offset="1" stop-color="#6e121c"/></linearGradient>`, `
<path d="M32 3C44 3 55 7.5 55 11.5V30C55 45.5 43.5 56.5 32 61C20.5 56.5 9 45.5 9 30V11.5C9 7.5 20 3 32 3Z" fill="url(#ai-co-g)" stroke="${INK}" stroke-width="2.4"/>
<path d="M32 7.5C41.5 7.5 50 11 50 14.5V29C50 42 39.5 51.5 32 55.5C24.5 51.5 14 42 14 29V14.5C14 11 22.5 7.5 32 7.5Z" fill="url(#ai-co-s)" stroke="${INK}" stroke-width="1.8"/>
<path d="M32 7.5V55.5C24.5 51.5 14 42 14 29V14.5C14 11 22.5 7.5 32 7.5Z" fill="#ffffff" opacity=".2"/>
<path d="M32 7.5V55.5" stroke="#fff" stroke-width="1.2" opacity=".7"/>
<path d="M32.8 8V55.5" stroke="${INK_SOFT}" stroke-width=".9" opacity=".5"/>
<path d="M21 24C19 28 19 33 22 38C24 41 27 44 32 48C37 44 40 41 42 38C45 33 45 28 43 24C41 20 37 17 32 17C27 17 23 20 21 24Z" fill="url(#ai-co-g)" stroke="${INK}" stroke-width="1.8"/>
<path d="M21 24C24 23 28 26 32 29C36 26 40 23 43 24C45 30 42 38 32 46C22 38 19 30 21 24Z" fill="none" stroke="#fff4cc" stroke-width="1" opacity=".75"/>
<path d="M32 21C27.5 21 23.5 24.5 23.5 29.5C23.5 36.5 32 43.5 32 43.5C32 43.5 40.5 36.5 40.5 29.5C40.5 24.5 36.5 21 32 21Z" fill="url(#ai-co-r)" stroke="${INK}" stroke-width="2"/>
<path d="M32 22C28.5 22 25 25 25 29C25 34.5 32 41 32 41V22Z" fill="#ff9985" opacity=".4"/>
<path d="M32 24.5L27 29L32 37L37 29Z" fill="none" stroke="#ffc0b0" stroke-width="1.1" opacity=".8"/>
<path d="M26 27C27 24.5 29.5 23.5 31.5 24" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="27" cy="28.5" r="1.1" fill="#ffffff"/>
<circle cx="32" cy="20.5" r="1.5" fill="url(#ai-co-g2)" stroke="${INK}" stroke-width=".8"/>
<circle cx="23" cy="30" r="1.4" fill="url(#ai-co-g2)" stroke="${INK}" stroke-width=".8"/>
<circle cx="41" cy="30" r="1.4" fill="url(#ai-co-g2)" stroke="${INK}" stroke-width=".8"/>
<circle cx="32" cy="44.5" r="1.5" fill="url(#ai-co-g2)" stroke="${INK}" stroke-width=".8"/>
${[[32, 5.2], [18, 8.5], [46, 8.5], [11.5, 17], [52.5, 17], [11.5, 29], [52.5, 29], [17, 42], [47, 42], [24, 52], [40, 52]].map(([x, y]) =>
  `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff5d4" stroke="${INK}" stroke-width=".8"/><circle cx="${x - .4}" cy="${y - .4}" r=".5" fill="#fff"/>`).join('')}
<path d="M22 6C27 4.8 37 4.8 42 6" fill="none" stroke="#ffffff" stroke-width="1.3" opacity=".9"/>`);

// 4. AGILIDAD: bota alada de Hermes en pleno salto veloz, con alas de águila plateadas, puntera de oro y ráfagas de viento.
const agilidad = wrap('ai-ag', `<linearGradient id="ai-ag-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfa86e"/><stop offset=".5" stop-color="#a86d3d"/><stop offset="1" stop-color="#5a3216"/></linearGradient>
<linearGradient id="ai-ag-f" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#d4e6f4"/><stop offset="1" stop-color="#88a8c2"/></linearGradient>`, `
<path d="M8 50C18 55 35 55 56 46" fill="none" stroke="url(#ai-ag-b)" stroke-width="2.6" opacity=".7"/>
<path d="M12 55C22 59 38 58 50 51" fill="none" stroke="#fff" stroke-width="1.4" opacity=".85"/>
<path d="M6 44C14 47 25 47 36 43" fill="none" stroke="url(#ai-ag-b)" stroke-width="1.6" opacity=".5"/>
<g transform="translate(-1 -2) rotate(-8 26 24)" opacity=".75">
  <path d="M25 18C15 15 7 9 3 2C6 9 14 16 23 20Z" fill="url(#ai-ag-sd)" stroke="${INK}" stroke-width="1.5"/>
  <path d="M24 22C14 21 6 17 2 11C6 17 13 22 22 23Z" fill="url(#ai-ag-sd)" stroke="${INK}" stroke-width="1.5"/>
</g>
<path d="M27 7L40 5L39 21C39 24.5 43 28.5 48.5 34L56 39.5C57.8 40.8 57.5 43 55.2 44.2C51 46.5 41.5 47 35.5 44C27.5 40 21.5 37 19.5 35.5C17.5 34.2 16.8 31 17.5 27L22 15Z" fill="url(#ai-ag-l)" stroke="${INK}" stroke-width="2.2"/>
<path d="M18.5 35C22 37.5 28 40.5 35.5 44C41.5 47 51 46.5 55.2 44.2C56.5 43.5 56.5 45 54 46.2C49 48.5 39 49 33 46C25 42 19 38.5 16.5 36C15.8 35.2 16.5 33.5 18.5 35Z" fill="#3b2010" stroke="${INK}" stroke-width="1.5"/>
<path d="M47 37.5L56 39.5C57.8 40.8 57.5 43 55.2 44.2C51 46.2 44.5 46 43 45.2L45 38Z" fill="url(#ai-ag-g)" stroke="${INK}" stroke-width="1.6"/>
<path d="M48 39.5L54 41.2" stroke="#ffffff" stroke-width="1.2" opacity=".85"/>
<path d="M17.5 28C17 31.5 18.5 34 22 36L23.5 31.5L18.5 27.5Z" fill="url(#ai-ag-g)" stroke="${INK}" stroke-width="1.5"/>
<path d="M17.5 32L9 34.5L16.5 35.5Z" fill="url(#ai-ag-g)" stroke="${INK}" stroke-width="1.4"/>
<circle cx="17.5" cy="32.5" r="1.3" fill="#fff" opacity=".8"/>
<path d="M25 14L39 12L38 17.5L24 19.5Z" fill="url(#ai-ag-g)" stroke="${INK}" stroke-width="1.6"/>
<path d="M26 15L38 13.2" stroke="#ffffff" stroke-width="1.1" opacity=".85"/>
<rect x="29" y="13" width="5" height="6.5" rx="1" fill="none" stroke="${INK}" stroke-width="2.2"/>
<rect x="29" y="13" width="5" height="6.5" rx="1" fill="none" stroke="url(#ai-ag-g2)" stroke-width="1.4"/>
<path d="M37 28L44 33.5" stroke="#ffe3b8" stroke-width="1.4" opacity=".7"/>
<path d="M30 20C32 25 36 29 42 34" fill="none" stroke="#5a2f14" stroke-width="1.2" opacity=".6"/>
<path d="M26 17C17 14 9 9 5 2.5C8 9.5 17 16 26 19.5Z" fill="url(#ai-ag-f)" stroke="${INK}" stroke-width="1.8"/>
<path d="M23 15C15 12 9 8 6.5 4" fill="none" stroke="#ffffff" stroke-width="1.4" opacity=".95"/>
<path d="M23 15.5C16 13 10 10 7 6" fill="none" stroke="#7b9ab8" stroke-width="1" opacity=".7"/>
<path d="M26 21C15 20.5 7 16 2.5 11C7 17 16 22 25 24Z" fill="url(#ai-ag-f)" stroke="${INK}" stroke-width="1.8"/>
<path d="M22 20C14 18.5 8 15 4 12" fill="none" stroke="#ffffff" stroke-width="1.3" opacity=".9"/>
<path d="M22 20.5C14 19.2 8.5 16.5 5 13.5" fill="none" stroke="#7b9ab8" stroke-width=".9" opacity=".7"/>
<path d="M25 25C15 26.5 8 24.5 3 20.5C7 25 15 28 24 28.5Z" fill="url(#ai-ag-f)" stroke="${INK}" stroke-width="1.8"/>
<path d="M21 25.5C14 26 8 24 4.5 22" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".85"/>
<path d="M24 28.5C16 31 10 32 5 31C9 33.5 16 33.5 23 31.5Z" fill="url(#ai-ag-f)" stroke="${INK}" stroke-width="1.7"/>
<path d="M20 29.5C14 31 9 31.5 6 31" fill="none" stroke="#ffffff" stroke-width="1.1" opacity=".8"/>
<circle cx="26" cy="20" r="3.2" fill="url(#ai-ag-g)" stroke="${INK}" stroke-width="1.4"/>
<circle cx="26" cy="20" r="1.6" fill="#3a8ae0" stroke="${INK}" stroke-width=".8"/>
<circle cx="25.3" cy="19.3" r=".6" fill="#fff"/>
${sparkle(57, 36, 3, '#fff4cc')}
${sparkle(4, 5, 2.5, '#d8eeff')}`);

// 5. PERICIA: martillo de maestro artesano cruzado con compás de precisión y matraz alquímico de elixires.
const pericia = wrap('ai-pe', `<radialGradient id="ai-pe-v" cx=".36" cy=".36" r=".7"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="#bcdfd9" stop-opacity=".85"/></radialGradient>
<linearGradient id="ai-pe-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4f89a"/><stop offset=".5" stop-color="#56bf44"/><stop offset="1" stop-color="#216a32"/></linearGradient>`, `
<g transform="translate(-1 2) rotate(32 32 36)">
  <rect x="29.5" y="14" width="5" height="46" rx="2" fill="url(#ai-pe-w)" stroke="${INK}" stroke-width="2"/>
  <path d="M29.5 44H34.5M29.5 48H34.5M29.5 52H34.5" stroke="#d49e62" stroke-width="1.2"/>
  <circle cx="32" cy="57" r="2.2" fill="url(#ai-pe-g)" stroke="${INK}" stroke-width="1"/>
  <path d="M15 5.5H49C50.5 5.5 51.5 6.5 51.5 8V16C51.5 17.5 50.5 18.5 49 18.5H15L12 16V8L15 5.5Z" fill="url(#ai-pe-s)" stroke="${INK}" stroke-width="2.2"/>
  <rect x="28" y="5.5" width="8" height="13" fill="url(#ai-pe-g)" stroke="${INK}" stroke-width="1.5"/>
  <path d="M16 8.5H27M37 8.5H48" stroke="#ffffff" stroke-width="1.4" opacity=".9"/>
  <path d="M49 6.5V17.5" stroke="#75869c" stroke-width="1.2"/>
</g>
<g transform="translate(1 0)">
  <circle cx="44" cy="12" r="3.2" fill="url(#ai-pe-g)" stroke="${INK}" stroke-width="1.6"/>
  <circle cx="44" cy="12" r="1.3" fill="#ffffff"/>
  <path d="M44 14C42 22 36 29 27 34" fill="none" stroke="${INK}" stroke-width="3.2"/>
  <path d="M44 14C42 22 36 29 27 34" fill="none" stroke="url(#ai-pe-g)" stroke-width="2"/>
  <path d="M44 14C45 22 47 30 46 38" fill="none" stroke="${INK}" stroke-width="3.2"/>
  <path d="M44 14C45 22 47 30 46 38" fill="none" stroke="url(#ai-pe-g)" stroke-width="2"/>
</g>
<path d="M21 16H29V28.5C36 32 40 38 40 45C40 54 33 60 25 60C17 60 10 54 10 45C10 38 14 32 21 28.5Z" fill="url(#ai-pe-v)" stroke="${INK}" stroke-width="2.4"/>
<path d="M11.5 45C11.5 38.5 15 34 21 31.5L29 31.5C35 34 38.5 38.5 38.5 45C38.5 53 32.5 58.5 25 58.5C17.5 58.5 11.5 53 11.5 45Z" fill="url(#ai-pe-l)" stroke="#1a5c28" stroke-width="1.4"/>
<path d="M13 43C17 40.5 21 44.5 25 42C29 39.5 33 43.5 37 41" fill="none" stroke="#e8ffd6" stroke-width="1.6"/>
<circle cx="20" cy="49" r="2.2" fill="#eaffd9" stroke="#1d6b2c" stroke-width=".8"/>
<circle cx="28" cy="51" r="1.5" fill="#eaffd9"/>
<circle cx="25" cy="46" r="1.1" fill="#eaffd9"/>
<circle cx="16" cy="46" r=".8" fill="#eaffd9"/>
<path d="M14 43C13 47 15 53 18 56" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".85"/>
<path d="M22 18V27" stroke="#ffffff" stroke-width="1.2" opacity=".7"/>
<rect x="20" y="14" width="10" height="4.5" rx="1" fill="url(#ai-pe-g)" stroke="${INK}" stroke-width="1.5"/>
<path d="M21.5 7H28.5L27.5 14H22.5Z" fill="#a0683a" stroke="${INK}" stroke-width="1.6"/>
<path d="M23 9H27" stroke="#ffe3b8" stroke-width="1"/>
${sparkle(13, 33, 2.5, '#fff6cc')}`);

// 6. PRESENCIA: corona real de oro macizo de cinco puntas sobre terciopelo rojo, engarzada con zafiros y rubíes.
const presencia = wrap('ai-pr', `<linearGradient id="ai-pr-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e84c42"/><stop offset="1" stop-color="#6e1620"/></linearGradient>`, `
${[[32, 10, 32, 2], [20, 14, 15, 6], [44, 14, 49, 6], [9, 24, 3, 19], [55, 24, 61, 19]].map(([x1, y1, x2, y2]) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="4.2"/><path d="M${x1} ${y1}L${x2} ${y2}" stroke="url(#ai-pr-g)" stroke-width="2.2"/>`).join('')}
<path d="M11 43C12 24 52 24 53 43Z" fill="url(#ai-pr-v)" stroke="${INK}" stroke-width="2.2"/>
<path d="M24 29C28 35 36 35 40 29" fill="none" stroke="#801520" stroke-width="1.5"/>
<path d="M9 46L6 18L18.5 29L32 10L45.5 29L58 18L55 46Z" fill="url(#ai-pr-g)" stroke="${INK}" stroke-width="2.6"/>
<path d="M9.5 24L18 31L32 15L46 31L54.5 24" fill="none" stroke="#fff8dc" stroke-width="1.8" opacity=".9"/>
<path d="M18.5 29L20 44M45.5 29L44 44M32 10V44" stroke="#a06b24" stroke-width="1.3"/>
<path d="M7 44H57V54C57 55.5 55.5 57 54 57H10C8.5 57 7 55.5 7 54Z" fill="url(#ai-pr-g)" stroke="${INK}" stroke-width="2.4"/>
<path d="M9 46.5H55" stroke="#ffffff" stroke-width="1.4" opacity=".9"/>
<rect x="29" y="46.5" width="6" height="6" rx="1" fill="#d82d38" stroke="${INK}" stroke-width="1.3" transform="rotate(45 32 49.5)"/>
<circle cx="32" cy="49.5" r="1.3" fill="#fff" opacity=".8"/>
<circle cx="19" cy="50" r="2.8" fill="#3a7ae0" stroke="${INK}" stroke-width="1.3"/>
<circle cx="18.2" cy="49.2" r=".9" fill="#fff"/>
<circle cx="45" cy="50" r="2.8" fill="#3a7ae0" stroke="${INK}" stroke-width="1.3"/>
<circle cx="44.2" cy="49.2" r=".9" fill="#fff"/>
<circle cx="11.5" cy="50" r="1.8" fill="#2ea868" stroke="${INK}" stroke-width="1"/>
<circle cx="52.5" cy="50" r="1.8" fill="#2ea868" stroke="${INK}" stroke-width="1"/>
<path d="M32 23C34.5 26 36 29 36 31C36 33.5 34 35 32 35C30 35 28 33.5 28 31C28 29 29.5 26 32 23Z" fill="#d82d38" stroke="${INK}" stroke-width="1.4"/>
<circle cx="31.2" cy="30" r=".8" fill="#fff"/>
${[[6, 18], [32, 9.5], [58, 18]].map(([x, y]) =>
  `<circle cx="${x}" cy="${y}" r="3.6" fill="#fffdf5" stroke="${INK}" stroke-width="1.6"/><circle cx="${x - .9}" cy="${y - .9}" r="1.2" fill="#fff"/>`).join('')}
${sparkle(32, 4, 3, '#fff4cc')}`);

// 7. PERCEPCIÓN: ojo celestial de halcón vigilante enmarcado en oro, con iris de esmeralda y destellos astrales.
const percepcion = wrap('ai-pc', `<radialGradient id="ai-pc-i" cx=".38" cy=".36" r=".66"><stop offset="0" stop-color="#d4fff2"/><stop offset=".45" stop-color="#2bb89e"/><stop offset="1" stop-color="#0b4e45"/></radialGradient>
<linearGradient id="ai-pc-e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffef8"/><stop offset="1" stop-color="#e2d2ae"/></linearGradient>`, `
${[[32, 11, 32, 2], [32, 53, 32, 62], [10, 32, 1, 32], [54, 32, 63, 32],
   [16, 16, 9, 9], [48, 16, 55, 9], [16, 48, 9, 55], [48, 48, 55, 55]].map(([x1, y1, x2, y2]) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="4.4"/><path d="M${x1} ${y1}L${x2} ${y2}" stroke="url(#ai-pc-g)" stroke-width="2.3"/>`).join('')}
<path d="M2 32C11 17 21 9 32 9C43 9 53 17 62 32C53 47 43 55 32 55C21 55 11 47 2 32Z" fill="url(#ai-pc-g)" stroke="${INK}" stroke-width="2.6"/>
<path d="M6 32C14 20 22.5 13 32 13C41.5 13 50 20 58 32C50 44 41.5 51 32 51C22.5 51 14 44 6 32Z" fill="url(#ai-pc-e)" stroke="${INK}" stroke-width="1.8"/>
<path d="M8 32C15.5 22 23 16 32 16C41 16 48.5 22 56 32C48.5 42 41 48 32 48C23 48 15.5 42 8 32Z" fill="#fffdf6" stroke="${INK}" stroke-width="1.6"/>
<path d="M8 32C15.5 22 23 16 32 16C41 16 48.5 22 56 32C48 24 40.5 20 32 20C23.5 20 16 24 8 32Z" fill="#2d3d44" opacity=".2"/>
<circle cx="32" cy="32" r="13" fill="url(#ai-pc-i)" stroke="${INK}" stroke-width="2.2"/>
<circle cx="32" cy="32" r="10" fill="none" stroke="#12564e" stroke-width="1.2" opacity=".7"/>
<circle cx="32" cy="32" r="6.8" fill="none" stroke="#92ebd8" stroke-width=".9" opacity=".8"/>
${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(a => {
  const rad = a * Math.PI / 180;
  const x1 = (32 + Math.cos(rad) * 6).toFixed(1);
  const y1 = (32 + Math.sin(rad) * 6).toFixed(1);
  const x2 = (32 + Math.cos(rad) * 11.5).toFixed(1);
  const y2 = (32 + Math.sin(rad) * 11.5).toFixed(1);
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#a8f6e4" stroke-width=".8" opacity=".75"/>`;
}).join('')}
<path d="M32 25C34 29 34 35 32 39C30 35 30 29 32 25Z" fill="#0d0703"/>
<path d="M25 32C29 34 35 34 39 32C35 30 29 30 25 32Z" fill="#0d0703"/>
<circle cx="32" cy="32" r="3.8" fill="#0d0703"/>
<circle cx="27.5" cy="27" r="2.8" fill="#ffffff" opacity=".95"/>
<circle cx="36.5" cy="36.5" r="1.3" fill="#ffffff" opacity=".8"/>
<path d="M12 28C18 20 25 16 32 16" fill="none" stroke="#ffffff" stroke-width="1.4" opacity=".85"/>
<path d="M10 25C17 16 24 12 32 12" fill="none" stroke="#fff4cc" stroke-width="1.2" opacity=".9"/>`);

const ATTRIBUTE_ICON_SVG: Record<AttributeId, string> = { fuerza, intelecto, corpulencia, agilidad, pericia, presencia, percepcion };

export const attributeIcon = (id: AttributeId, scope = '') => (scope ? ATTRIBUTE_ICON_SVG[id].replace(/ai-/g, `${scope}-ai-`) : ATTRIBUTE_ICON_SVG[id]);

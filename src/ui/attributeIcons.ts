// Iconos vectoriales de los atributos (viewBox 64×64) para la ficha de personaje.
// Un único símbolo por atributo con el lenguaje de los emblemas de clase: contorno oscuro, oro, acero, brillos y sombra.
import type { AttributeId } from '../data/data';

const INK = '#2a1608';

const wrap = (id: string, defs: string, body: string) => `<svg class="attribute-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".55" stop-color="#e3b45a"/><stop offset="1" stop-color="#9c6f2a"/></linearGradient>
<linearGradient id="${id}-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f8ff"/><stop offset=".5" stop-color="#b9c6d8"/><stop offset="1" stop-color="#6d7b92"/></linearGradient>
<linearGradient id="${id}-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c58b55"/><stop offset=".5" stop-color="#9a6436"/><stop offset="1" stop-color="#6a3f1e"/></linearGradient>
<filter id="${id}-d" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="1.300" stdDeviation=".9" flood-color="#1a0e04" flood-opacity=".45"/></filter>
${defs}
</defs>
<g stroke-linejoin="round" stroke-linecap="round" filter="url(#${id}-d)">${body}</g>
</svg>`;

// Fuerza: guantelete de acero cerrado en un puño, con nudillos remachados y brazal dorado.
const fuerza = wrap('ai-fu', `<linearGradient id="ai-fu-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c0392f"/><stop offset="1" stop-color="#5e161c"/></linearGradient>`, `
<path d="M17 47h30l-1.600 12.400c-.1 1-1 1.600-2 1.600H20.600c-1 0-1.900-.6-2-1.600Z" fill="url(#ai-fu-l)" stroke="${INK}" stroke-width="2"/>
<path d="M16.500 46.500h31v4.200h-31Z" fill="url(#ai-fu-g)" stroke="${INK}" stroke-width="1.600"/>
<path d="M19.500 55.500h25" stroke="#e3b45a" stroke-width="1.300" opacity=".8"/>
<path d="M11 25h42v14c0 6-4.500 10-10 10H21c-5.500 0-10-4.500-10-10Z" fill="url(#ai-fu-s)" stroke="${INK}" stroke-width="2.400"/>
${[[12, 12.500], [22, 9.500], [32, 9.500], [42, 12.500]].map(([x, y]) => `<rect x="${x}" y="${y}" width="10" height="${31 - y}" rx="5" fill="url(#ai-fu-s)" stroke="${INK}" stroke-width="2.200"/>
<path d="M${x + 2.600} ${y + 4}q2.400-1.600 4.800 0" fill="none" stroke="#fff" stroke-width="1.500"/>
<circle cx="${x + 5}" cy="${y + 10}" r="1.500" fill="url(#ai-fu-g)" stroke="${INK}" stroke-width=".8"/>`).join('')}
<path d="M11.500 36.500c7.500-3.600 18.500-3.800 26.500-.8 3.400 1.300 3.100 5.800-.4 6.600-8 2-17.400 1.500-25.300-1.500Z" fill="url(#ai-fu-s)" stroke="${INK}" stroke-width="2.200"/>
<path d="M16 37.600c5.500-1.500 12-1.600 17.500-.4" fill="none" stroke="#fff" stroke-width="1.400"/>
<path d="M50 28v10" stroke="#5d6b80" stroke-width="1.300" opacity=".7"/>`);

// Intelecto: grimorio abierto del que brota una estrella arcana.
const intelecto = wrap('ai-in', `<radialGradient id="ai-in-a" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#bcd6ff" stop-opacity=".95"/><stop offset="1" stop-color="#6aa0ff" stop-opacity="0"/></radialGradient>
<linearGradient id="ai-in-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b6be0"/><stop offset=".6" stop-color="#5236a8"/><stop offset="1" stop-color="#2a1a5c"/></linearGradient>
<linearGradient id="ai-in-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#ead6aa"/></linearGradient>
<linearGradient id="ai-in-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#bcd6ff"/><stop offset="1" stop-color="#5a82e8"/></linearGradient>`, `
<circle cx="32" cy="17" r="17" fill="url(#ai-in-a)"/>
<path d="M3 33v22c11-3.500 21-2.500 29 3 8-5.500 18-6.500 29-3V33" fill="url(#ai-in-c)" stroke="${INK}" stroke-width="2.200"/>
<path d="M3 49v6l6.500-1.600M61 49v6l-6.500-1.600" fill="url(#ai-in-g)" stroke="${INK}" stroke-width="1.300"/>
<path d="M6.500 30c9.500-3.500 19-2.500 25.500 3v22c-6.500-5-16-6-25.500-3Z" fill="url(#ai-in-p)" stroke="${INK}" stroke-width="1.900"/>
<path d="M57.500 30c-9.500-3.500-19-2.500-25.500 3v22c6.500-5 16-6 25.500-3Z" fill="url(#ai-in-p)" stroke="${INK}" stroke-width="1.900"/>
<path d="M11 36.500c5-1.300 10-.8 15 1.400M11 41.500c5-1.300 10-.8 15 1.400M11 46.500c5-1.300 10-.8 15 1.400M38 37.900c5-2.200 10-2.700 15-1.400M38 42.900c5-2.200 10-2.700 15-1.400M38 47.900c5-2.200 10-2.700 15-1.400" fill="none" stroke="#a48a5c" stroke-width="1.300"/>
<path d="M32 33v22" stroke="${INK}" stroke-width="1.300"/>
<path d="M39 54v8l2.600-2 2.600 2v-9.400" fill="#c0393b" stroke="${INK}" stroke-width="1.300"/>
<path d="M32 2.500l3.400 9.600 9.600 3.400-9.600 3.400L32 28.500l-3.400-9.600-9.600-3.400 9.600-3.400Z" fill="url(#ai-in-t)" stroke="#1e2a6a" stroke-width="1.700"/>
<path d="M32 8v7.500" stroke="#fff" stroke-width="1.400" opacity=".9"/>`);

// Corpulencia: escudo de acero ribeteado en oro que protege un corazón.
const corpulencia = wrap('ai-co', `<linearGradient id="ai-co-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a74"/><stop offset=".55" stop-color="#d23a36"/><stop offset="1" stop-color="#7a161c"/></linearGradient>`, `
<path d="M32 3 56 10.500v17c0 15.500-10.500 26.500-24 33.500C18.500 54 8 43 8 27.500v-17Z" fill="url(#ai-co-g)" stroke="${INK}" stroke-width="2.400"/>
<path d="M32 9 50.500 14.800v12.700c0 12-7.800 21-18.500 27.200C21.300 48.500 13.500 39.500 13.500 27.500V14.800Z" fill="url(#ai-co-s)" stroke="${INK}" stroke-width="1.500"/>
<path d="M32 9 13.500 14.800v12.700c0 2.500.3 4.800.9 7L32 22Z" fill="#fff" opacity=".22"/>
<path d="M32 10v44M14 27h36" stroke="#5d6b80" stroke-width="1" opacity=".55"/>
<path d="M32 46.500S18.500 38.800 18.500 28.700A7 7 0 0 1 32 25a7 7 0 0 1 13.500 3.700C45.500 38.800 32 46.500 32 46.500Z" fill="url(#ai-co-r)" stroke="${INK}" stroke-width="2"/>
<path d="M22.500 28.300a3.600 3.600 0 0 1 4.200-2.600" fill="none" stroke="#ffd6cc" stroke-width="1.800"/>
${[[32, 6.200], [11.200, 13], [52.800, 13], [10.800, 27], [53.200, 27]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.400" fill="#fff4cc" stroke="${INK}" stroke-width=".8"/>`).join('')}
<path d="M15.500 13.500q6-2.300 11.500-3.400" stroke="#fff8dc" stroke-width="1.300" fill="none" opacity=".85"/>`);

// Agilidad: bota de cuero con alas de pluma en el tobillo.
const agilidad = wrap('ai-ag', `<linearGradient id="ai-ag-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9a066"/><stop offset=".55" stop-color="#a5683a"/><stop offset="1" stop-color="#5e3418"/></linearGradient>
<linearGradient id="ai-ag-f" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#dbe8f2"/><stop offset="1" stop-color="#9fb8cc"/></linearGradient>`, `
<g transform="translate(-2 0)">
<path d="M27 12h17l-.6 24.500 9.800 5c3.600 1.800 5.800 4.500 5.800 8.500v2H24.500l1.600-15Z" fill="url(#ai-ag-l)" stroke="${INK}" stroke-width="2.200"/>
<path d="M23 52h37.500v4c0 1.200-.8 2-2 2H24.500c-1 0-1.500-.6-1.500-1.500Z" fill="#4a2c18" stroke="${INK}" stroke-width="1.900"/>
<path d="M29 55.500h3M37 55.500h3M45 55.500h3M53 55.500h3" stroke="#a07040" stroke-width="1.100"/>
<path d="M25 8h21.500l-1.200 8H26.200Z" fill="#e2b276" stroke="${INK}" stroke-width="1.900"/>
<path d="M27 10.800h17" stroke="#fff0cc" stroke-width="1.200" opacity=".9"/>
<path d="M26.800 30.500h16.600v4.800H26.500Z" fill="#5a3420" stroke="${INK}" stroke-width="1.400"/>
<rect x="35" y="29.300" width="5.400" height="7.200" rx="1" fill="none" stroke="${INK}" stroke-width="3.200"/>
<rect x="35" y="29.300" width="5.400" height="7.200" rx="1" fill="none" stroke="url(#ai-ag-g)" stroke-width="1.800"/>
<path d="M46 42.500c3.200.8 6.400 2.400 8.600 4.600" fill="none" stroke="#ffd9a8" stroke-width="1.400" opacity=".75"/>
<path d="M30 17v9" stroke="#ffd9a8" stroke-width="1.500" opacity=".6"/>
<path d="M27 21C19.500 20 12.500 14.500 8.500 6c8.500 1 15 5.500 18.500 11Z" fill="url(#ai-ag-f)" stroke="#1e2a3a" stroke-width="1.700"/>
<path d="M27 26c-7.800 1.200-15-1.200-20.500-7.500 7.500-1.200 15 .2 20.500 3.500Z" fill="url(#ai-ag-f)" stroke="#1e2a3a" stroke-width="1.700"/>
<path d="M26.600 30.800c-6.200 2.300-12.600 1.300-17-2.600 5.400-1.800 11.400-1.800 17 0Z" fill="url(#ai-ag-f)" stroke="#1e2a3a" stroke-width="1.700"/>
<path d="M13 10c4 3 8.500 5.500 13 7.500M11 20.500c5 1.200 10 1.800 15 1.700M13 29c4.400.3 9 0 13-1" fill="none" stroke="#7d95aa" stroke-width=".9"/>
</g>`);

// Pericia: martillo de artesano cruzado con un matraz de alquimia.
const pericia = wrap('ai-pe', `<radialGradient id="ai-pe-v" cx=".38" cy=".38" r=".7"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="#bcdcd8" stop-opacity=".85"/></radialGradient>
<linearGradient id="ai-pe-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8f08c"/><stop offset=".5" stop-color="#5cb84a"/><stop offset="1" stop-color="#25703a"/></linearGradient>`, `
<g transform="translate(-3 5) rotate(30 32 40) scale(.9)">
<rect x="30" y="17" width="4.400" height="44" rx="2" fill="url(#ai-pe-w)" stroke="${INK}" stroke-width="1.900"/>
<path d="M30 54h4.400M30 57h4.400" stroke="${INK}" stroke-width="1"/>
<path d="M16 6.500h28c1.400 0 2.500 1.100 2.500 2.500v8c0 1.400-1.100 2.500-2.500 2.500H16l-3-2.200V8.700Z" fill="url(#ai-pe-s)" stroke="${INK}" stroke-width="2.100"/>
<path d="M28.700 6.500h7v13h-7Z" fill="url(#ai-pe-g)" stroke="${INK}" stroke-width="1.400"/>
<path d="M17 9.800h9M38 9.800h5" stroke="#fff" stroke-width="1.400" opacity=".9"/>
</g>
<path d="M20 15.500h8v14.100a13 13 0 1 1-8 0Z" fill="url(#ai-pe-v)" stroke="${INK}" stroke-width="2.200"/>
<path d="M11.700 43.500c4.100-2.200 8.200 2.200 12.300 0s8.200-2.200 12.300 0a12.300 12.300 0 0 1-24.600 0Z" fill="url(#ai-pe-l)" stroke="${INK}" stroke-width="1.300"/>
<circle cx="19.500" cy="49" r="1.900" fill="#e8ffd6" stroke="#25703a" stroke-width=".7"/>
<circle cx="27.500" cy="50.500" r="1.200" fill="#e8ffd6"/><circle cx="24" cy="46" r=".9" fill="#e8ffd6"/>
<path d="M14.500 37.500a10 10 0 0 1 4.600-6" fill="none" stroke="#fff" stroke-width="2.200"/>
<path d="M18.800 13.500h10.400v3.800H18.800Z" fill="url(#ai-pe-g)" stroke="${INK}" stroke-width="1.400"/>
<path d="M20 6h8v7.500h-8Z" fill="#b98352" stroke="${INK}" stroke-width="1.600"/>
<path d="M21.200 8.500h5.600" stroke="#e8c49a" stroke-width="1"/>`);

// Presencia: corona real enjoyada sobre terciopelo rojo.
const presencia = wrap('ai-pr', `<linearGradient id="ai-pr-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2554a"/><stop offset="1" stop-color="#6e1820"/></linearGradient>`, `
<path d="M12 42c1-17 39-17 40 0Z" fill="url(#ai-pr-v)" stroke="${INK}" stroke-width="1.900"/>
<path d="M10 47 6 18l13.500 12L32 12l12.500 18L58 18l-4 29Z" fill="url(#ai-pr-g)" stroke="${INK}" stroke-width="2.400"/>
<path d="M10.500 23.500l2.300 19M22 29.500l10-14" stroke="#fff6cc" stroke-width="1.400" opacity=".8" fill="none"/>
<path d="M8.500 45h47v8.500c0 1.400-1.100 2.500-2.500 2.500H11c-1.400 0-2.500-1.100-2.500-2.500Z" fill="url(#ai-pr-g)" stroke="${INK}" stroke-width="2.300"/>
<path d="M11.500 47.800h41" stroke="#fff6cc" stroke-width="1.300" opacity=".85"/>
<path d="M32 46.300l4 4-4 4-4-4Z" fill="#d8323a" stroke="${INK}" stroke-width="1.300"/>
<circle cx="19" cy="50.300" r="2.700" fill="#3a7ae0" stroke="${INK}" stroke-width="1.200"/><circle cx="45" cy="50.300" r="2.700" fill="#3a7ae0" stroke="${INK}" stroke-width="1.200"/>
<circle cx="18.300" cy="49.500" r=".8" fill="#fff"/><circle cx="44.300" cy="49.500" r=".8" fill="#fff"/><path d="M31 48.700l1.100-1" stroke="#fff" stroke-width="1"/>
<path d="M32 26c2.800 3 3.800 5.800 3.800 8.200a3.800 3.800 0 0 1-7.600 0c0-2.400 1-5.200 3.800-8.200Z" fill="#d8323a" stroke="${INK}" stroke-width="1.400"/>
<path d="M30.600 32.800a1.800 1.800 0 0 1 1-2.100" stroke="#ffd0cc" stroke-width="1" fill="none"/>
${[[6, 18], [32, 11.500], [58, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.400" fill="#fbf6ea" stroke="${INK}" stroke-width="1.400"/><circle cx="${x - 1}" cy="${y - 1}" r="1" fill="#fff"/>`).join('')}`);

// Percepción: ojo vigilante enmarcado en oro, con iris esmeralda.
const percepcion = wrap('ai-pc', `<radialGradient id="ai-pc-i" cx=".42" cy=".4" r=".62"><stop offset="0" stop-color="#c8f5e8"/><stop offset=".5" stop-color="#2fa38c"/><stop offset="1" stop-color="#0f4a44"/></radialGradient>
<linearGradient id="ai-pc-e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#e6d6b4"/></linearGradient>`, `
${[[32, 12, 32, 4], [19.500, 14.500, 16, 7], [44.500, 14.500, 48, 7], [9.500, 20.500, 4.500, 15], [54.500, 20.500, 59.500, 15]].map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="4.600"/><path d="M${x1} ${y1}L${x2} ${y2}" stroke="#e9bd5e" stroke-width="2.400"/>`).join('')}
<path d="M3 36C11.500 22.500 21.500 16 32 16s20.500 6.500 29 20C52.500 49.500 42.500 56 32 56S11.500 49.500 3 36Z" fill="url(#ai-pc-g)" stroke="${INK}" stroke-width="2.400"/>
<path d="M8 36C15.500 25.500 23.500 20.500 32 20.500S48.500 25.500 56 36C48.500 46.500 40.500 51.500 32 51.500S15.500 46.500 8 36Z" fill="url(#ai-pc-e)" stroke="${INK}" stroke-width="1.800"/>
<circle cx="32" cy="36" r="12" fill="url(#ai-pc-i)" stroke="${INK}" stroke-width="2"/>
<circle cx="32" cy="36" r="8.300" fill="none" stroke="#0f4a44" stroke-width=".9" opacity=".6"/>
<path d="M32 30.500c2.200 2.400 2.200 8.600 0 11-2.200-2.400-2.200-8.600 0-11Z" fill="#140a04"/>
<circle cx="27.800" cy="31.500" r="2.600" fill="#fff" opacity=".95"/><circle cx="36" cy="40.500" r="1.200" fill="#fff" opacity=".7"/>
<path d="M10 33.500C17 25 24 21.500 32 21.500" fill="none" stroke="#fff" stroke-width="1.300" opacity=".7"/>
<path d="M9.500 31.500C16.500 22.500 24 18.300 32 18.300" fill="none" stroke="#fff6cc" stroke-width="1.200" opacity=".85"/>`);

const ATTRIBUTE_ICON_SVG: Record<AttributeId, string> = { fuerza, intelecto, corpulencia, agilidad, pericia, presencia, percepcion };

export const attributeIcon = (id: AttributeId, scope = '') => (scope ? ATTRIBUTE_ICON_SVG[id].replace(/ai-/g, `${scope}-ai-`) : ATTRIBUTE_ICON_SVG[id]);

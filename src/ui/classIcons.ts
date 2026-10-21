// Iconos vectoriales de cada clase (viewBox 64×64). Se usan en el creador, el HUD, el grupo, el objetivo y Social.
// Cada emblema tiene personalidad propia pero comparte el oro, el contorno oscuro y los brillos del juego.
import type { ClassId } from '../data/data';

const wrap = (id: string, defs: string, body: string) => `<svg class="class-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".55" stop-color="#e3b45a"/><stop offset="1" stop-color="#9c6f2a"/></linearGradient>
<linearGradient id="${id}-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f8ff"/><stop offset=".5" stop-color="#b9c6d8"/><stop offset="1" stop-color="#6d7b92"/></linearGradient>
<filter id="${id}-d" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="1.300" stdDeviation=".9" flood-color="#1a0e04" flood-opacity=".45"/></filter>
${defs}
</defs>
<g stroke-linejoin="round" stroke-linecap="round" filter="url(#${id}-d)">${body}</g>
</svg>`;

const sparkle = (x: number, y: number, r: number, fill: string, stroke = '#6a4a14') =>
  `<path d="M${x} ${y - r}l${r * .3} ${r * .7} ${r * .7} ${r * .3}-${r * .7} ${r * .3}-${r * .3} ${r * .7}-${r * .3}-${r * .7}-${r * .7}-${r * .3} ${r * .7}-${r * .3}Z" fill="${fill}" stroke="${stroke}" stroke-width=".8"/>`;

// Guerrero: escudo de armas con espada a la espalda, bloca dorada y remaches.
const warrior = wrap('ci-w', `<linearGradient id="ci-w-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2554a"/><stop offset=".6" stop-color="#a42a2c"/><stop offset="1" stop-color="#5e161c"/></linearGradient>
<radialGradient id="ci-w-b" cx=".38" cy=".32" r=".7"><stop offset="0" stop-color="#fff6cc"/><stop offset=".5" stop-color="#e3b45a"/><stop offset="1" stop-color="#8a5a1c"/></radialGradient>`, `
${[45, -45].map((a) => `<g transform="translate(32 32) rotate(${a})">
<path d="M0-31 3.200-25V16h-6.400V-25Z" fill="url(#ci-w-s)" stroke="#1e2430" stroke-width="1.700"/>
<path d="M-1-27V15" stroke="#fff" stroke-width="1" opacity=".8"/>
<path d="M1.100-24V14" stroke="#7d8aa0" stroke-width=".8" opacity=".8"/>
<path d="M-9.500 17c0-2 2-2.400 3-1.500h13c1-.9 3-.5 3 1.500s-2 2.400-3 1.500h-13c-1 .9-3 .5-3-1.500Z" fill="url(#ci-w-g)" stroke="#2a1608" stroke-width="1.300"/>
<circle cx="0" cy="17" r="1.500" fill="#c8323a" stroke="#4a1010" stroke-width=".7"/>
<rect x="-2" y="19" width="4" height="7.500" rx="1" fill="#5a2c16" stroke="#2a1608" stroke-width="1.200"/>
<path d="M-2 20.800 2 22.200M-2 23.300 2 24.700" stroke="#b07a48" stroke-width=".8"/>
<circle cx="0" cy="28.600" r="2.600" fill="url(#ci-w-g)" stroke="#2a1608" stroke-width="1.200"/>
<circle cx="-.7" cy="27.900" r=".8" fill="#fff" opacity=".8"/>
</g>`).join('')}
<g transform="translate(32 33) scale(.82) translate(-32 -33)">
<path d="M32 12 50 17.500v13c0 12-7 20.500-18 27C21 51 14 42.500 14 30.500v-13Z" fill="url(#ci-w-r)" stroke="#2a1608" stroke-width="2.400"/>
<path d="M32 15.200 46.800 19.800V30.500c0 10-5.600 17.300-14.800 23.300C22.800 47.800 17.200 40.500 17.200 30.500V19.800Z" fill="none" stroke="url(#ci-w-g)" stroke-width="2"/>
<path d="M32 15.200 46.800 19.800V30.500H32Z" fill="#c23a36" opacity=".55"/>
<path d="M32 30.500h-14.800c0 10 5.600 17.300 14.800 23.300Z" fill="#c23a36" opacity=".55"/>
<path d="M32 15.500v38M17.500 31h29" stroke="#e3b45a" stroke-width="1.300" opacity=".6"/>
<path d="M19.500 22.500q5-2.200 9.500-3.200" stroke="#ffc4b0" stroke-width="1.500" fill="none" opacity=".75"/>
<path d="M41 40.500l3 1.200M39.800 43.300l2 .4M22 39l2.400-1.400" stroke="#3a0e10" stroke-width=".9" opacity=".7"/>
<path d="M23.500 43.500c1.500 2 3 3.300 4.500 4.200M40.500 43.500c-1.500 2-3 3.300-4.500 4.200" stroke="url(#ci-w-g)" stroke-width="1.300" fill="none"/>
<path d="M24.500 45.300l-1.500.6M26.500 47.200l-1.300 1M39.500 45.300l1.500.6M37.500 47.200l1.300 1" stroke="#e3b45a" stroke-width="1.100"/>
<circle cx="32" cy="31" r="7.500" fill="url(#ci-w-b)" stroke="#2a1608" stroke-width="2"/>
<path d="M32 26.200v9.600M27.200 31h9.600" stroke="#7a4a16" stroke-width="1.500"/>
<circle cx="30" cy="29" r="1.600" fill="#fff" opacity=".8"/>
<circle cx="20.500" cy="21" r="1.400" fill="url(#ci-w-g)" stroke="#2a1608" stroke-width=".9"/>
<circle cx="43.500" cy="21" r="1.400" fill="url(#ci-w-g)" stroke="#2a1608" stroke-width=".9"/>
<circle cx="32" cy="48.500" r="1.400" fill="url(#ci-w-g)" stroke="#2a1608" stroke-width=".9"/>
<circle cx="47.500" cy="31" r="1.200" fill="url(#ci-w-g)" stroke="#2a1608" stroke-width=".8"/>
<circle cx="16.500" cy="31" r="1.200" fill="url(#ci-w-g)" stroke="#2a1608" stroke-width=".8"/>
<path d="M32 12v3.200" stroke="#2a1608" stroke-width="1.200"/></g>`);

// Mago: sombrero puntiagudo con lunas y estrellas, hebilla dorada y un orbe arcano flotando.
const mage = wrap('ci-m', `<linearGradient id="ci-m-h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b6be8"/><stop offset=".55" stop-color="#4436a8"/><stop offset="1" stop-color="#211a5c"/></linearGradient>
<radialGradient id="ci-m-o" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e8f6ff"/><stop offset=".45" stop-color="#58a8ff"/><stop offset="1" stop-color="#2a3fa8"/></radialGradient>
<radialGradient id="ci-m-a" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fd4ff" stop-opacity=".7"/><stop offset="1" stop-color="#58a8ff" stop-opacity="0"/></radialGradient>`, `
<circle cx="50" cy="13" r="11" fill="url(#ci-m-a)"/>
<path d="M12 49C17 44 22 30 28 16c3-7 8-11 15-11-3 3-5 8-4 14l6 28Z" fill="url(#ci-m-h)" stroke="#16103a" stroke-width="2.400"/>
<path d="M30 17c2-5 6-8.500 10-9.500" fill="none" stroke="#b6acff" stroke-width="1.500" opacity=".8"/>
<path d="M22 37c3-4 8-6 14-6M25 28c3-2 7-3 12-2.500" fill="none" stroke="#211a5c" stroke-width="1.200" opacity=".7"/>
<path d="M33.500 21.500l4.500-1.200 1 4.300-4.300 1.300Z" fill="#6a3a9a" stroke="#16103a" stroke-width="1"/>
<path d="M34.200 21.800l.4 3.300M36.200 21.200l.5 3.400" stroke="#d8b4ff" stroke-width=".6" stroke-dasharray=".8 .7"/>
<circle cx="20.500" cy="40" r=".8" fill="#fff3c0"/><circle cx="41" cy="33" r=".7" fill="#fff3c0"/><circle cx="31" cy="12.500" r=".7" fill="#fff3c0"/><circle cx="27" cy="22" r=".6" fill="#cfe8ff"/>
<path d="M43 5c2.500-.8 4.500.5 4.200 2.800" fill="none" stroke="#16103a" stroke-width="1.200"/>
${sparkle(47.200, 9, 2, '#fff3c0')}
<path d="M4 51c6-6 18-8 28-8s22 2 28 8c-6 5-18 7-28 7S10 56 4 51Z" fill="url(#ci-m-h)" stroke="#16103a" stroke-width="2.400"/>
<path d="M9 50.500c6-3.500 15-4.800 23-4.800s17 1.300 23 4.800" fill="none" stroke="#9a8cf0" stroke-width="1.200" opacity=".7"/>
<path d="M15.500 45.500c5-2.500 11-3.500 17-3.500s10.500.6 14 1.800l-.6-5.300C42 37.300 37 36.800 32.500 36.800c-6 0-11.500 1.200-15.500 3.300Z" fill="url(#ci-m-g)" stroke="#5a3a10" stroke-width="1.500"/>
<path d="M17 41.500c5-2 10.500-3 16-3s9.500.5 13 1.500" fill="none" stroke="#fff4c8" stroke-width=".9" opacity=".8"/>
<path d="M19 43.800l1-3.300M23 42.700l.7-3.400M39 42.300l-.3-3.400M43 43.200l-.5-3.300" stroke="#8a5a1c" stroke-width=".9"/>
<rect x="27.500" y="37.600" width="7" height="6.400" rx="1.200" fill="#2a1a5c" stroke="url(#ci-m-g)" stroke-width="1.600"/>
<circle cx="31" cy="40.800" r="1.400" fill="url(#ci-m-o)" stroke="#1c2a6a" stroke-width=".6"/>
<path d="M28 26a4.500 4.500 0 1 0 4-5 3.500 3.500 0 1 1-4 5Z" fill="url(#ci-m-g)" stroke="#5a3a10" stroke-width=".9"/>
${sparkle(38, 28, 3.200, '#fff3c0')}
${sparkle(24, 34, 2.200, '#cfe8ff', '#4a6aa8')}
<circle cx="50" cy="13" r="5.800" fill="url(#ci-m-o)" stroke="#1c2a6a" stroke-width="1.800"/>
<path d="M47 11.500a3.400 3.400 0 0 1 3.400-2.400" stroke="#fff" stroke-width="1.400" fill="none"/>
<ellipse cx="50" cy="13" rx="9.500" ry="3" fill="none" stroke="#9fd4ff" stroke-width=".9" stroke-dasharray="2 1.600" transform="rotate(-20 50 13)"/>
<path d="M50 10.500v5M47.500 13h5" stroke="#e8f6ff" stroke-width=".7" opacity=".7"/>
${sparkle(58, 24, 2, '#cfe8ff', '#4a6aa8')}`);

// Pícaro: capucha en sombra con ojos brillantes, pañuelo y la daga lista bajo la barbilla.
const rogue = wrap('ci-r', `<linearGradient id="ci-r-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f7a62"/><stop offset=".6" stop-color="#34483a"/><stop offset="1" stop-color="#1a2620"/></linearGradient>
<radialGradient id="ci-r-f" cx=".5" cy=".35" r=".6"><stop offset="0" stop-color="#1a1420"/><stop offset="1" stop-color="#05040a"/></radialGradient>
<radialGradient id="ci-r-e" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbd0"/><stop offset=".45" stop-color="#ffd84a"/><stop offset="1" stop-color="#ffb000" stop-opacity="0"/></radialGradient>`, `

<path d="M32 4C19 4 11 15 10 28c-1 10 2 18 6 24h32c4-6 7-14 6-24C53 15 45 4 32 4Z" fill="url(#ci-r-h)" stroke="#0e1612" stroke-width="2.400"/>
<path d="M32 4c-4 4-6 8-6 12" fill="none" stroke="#8fae90" stroke-width="1.400" opacity=".7"/>
<path d="M14.500 44C12.500 38 12.500 30 14.500 24 17 14 24 8.500 32 8.500" fill="none" stroke="#86a888" stroke-width="1.300" opacity=".6"/>
<path d="M12.500 38c1-6 2.500-11 5-15M51.500 38c-1-6-2.500-11-5-15M36 6.500c5 2 9 6 11.500 11" fill="none" stroke="#1a2620" stroke-width="1.200" opacity=".8"/>
<path d="M14 47l-1.500 4M50 47l1.500 4" stroke="#1a2620" stroke-width="1.200"/>
<path d="M18 33c0-10 6-17 14-17s14 7 14 17" fill="none" stroke="#5a7a5c" stroke-width="2.600" stroke-dasharray="1.400 2" opacity=".75"/>
<path d="M18 33c0-10 6-17 14-17s14 7 14 17c0 5-2 9-5 12H23c-3-3-5-7-5-12Z" fill="url(#ci-r-f)" stroke="#0e1612" stroke-width="1.800"/>
<ellipse cx="25.500" cy="31" rx="5" ry="3.600" fill="url(#ci-r-e)"/>
<ellipse cx="38.500" cy="31" rx="5" ry="3.600" fill="url(#ci-r-e)"/>
<path d="M22.500 30.500q3-2.400 6 .4M35.500 30.900q3-2.800 6-.4" fill="none" stroke="#fffbd0" stroke-width="1.800"/>
<circle cx="25.500" cy="31.300" r=".9" fill="#2a1a00"/><circle cx="38.500" cy="31.300" r=".9" fill="#2a1a00"/>
<path d="M21.500 27.500l7 1.500M42.500 27.500l-7 1.500" stroke="#2a3a2e" stroke-width="1.300"/>
<path d="M16 41c5 3 10 4.500 16 4.500S43 44 48 41l2 7c-5 4-11 6-18 6s-13-2-18-6Z" fill="#7a2a3a" stroke="#2a0e14" stroke-width="1.800"/>
<path d="M20 45.500c4 2 8 3 12 3s8-1 12-3" fill="none" stroke="#b0506a" stroke-width="1.100"/>
<path d="M18 49.500l1.200 2.300M24 52l.6 2.200M30 53l.2 2.200M36 52.800l-.3 2.200" stroke="#2a0e14" stroke-width=".9"/>
<path d="M26.500 44.500l5.500 3.500 5.500-3.500-5.500 7Z" fill="url(#ci-r-g)" stroke="#3a2008" stroke-width="1.100"/>
<circle cx="32" cy="48" r="1.300" fill="#5ad08a" stroke="#0e3a20" stroke-width=".6"/>
<path d="M46 47l5 8-6-2Z" fill="#7a2a3a" stroke="#2a0e14" stroke-width="1.400"/>
<g transform="translate(49 47) rotate(35)">
<path d="M0-18 2.400-2h-4.800Z" fill="url(#ci-r-s)" stroke="#232b3a" stroke-width="1.500"/>
<path d="M0-16v13" stroke="#fff" stroke-width=".9" opacity=".85"/>
<path d="M-1.400-7l1.400-1.200M-1.700-4.500l1.700-1.300" stroke="#6d7b92" stroke-width=".6"/>
<path d="M-6-1.500h12" stroke="#2a1608" stroke-width="4"/>
<path d="M-6-1.500h12" stroke="url(#ci-r-g)" stroke-width="2"/>
<rect x="-1.600" y="0" width="3.200" height="7" rx=".8" fill="#4a2a18" stroke="#2a1608" stroke-width="1.100"/>
<path d="M-1.600 2 1.600 3M-1.600 4.500 1.600 5.500" stroke="#a8683a" stroke-width=".7"/>
<circle cx="0" cy="8.600" r="2" fill="url(#ci-r-g)" stroke="#2a1608" stroke-width="1"/>
<circle cx="0" cy="-1.500" r="1" fill="#5ad08a" stroke="#0e3a20" stroke-width=".5"/>
</g>`);

// Clérigo: sol sagrado con alas protectoras, cruz enjoyada y halo.
const cleric = wrap('ci-c', `<radialGradient id="ci-c-c" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#fffbe0"/><stop offset=".7" stop-color="#ffe08a"/><stop offset="1" stop-color="#e8a838"/></radialGradient>
<linearGradient id="ci-c-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9d4e8"/></linearGradient>
<radialGradient id="ci-c-j" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffe0e0"/><stop offset=".5" stop-color="#e2454a"/><stop offset="1" stop-color="#7a1424"/></radialGradient>`, `
<g stroke="url(#ci-c-g)" stroke-width="2.600" fill="none">
<path d="M32 2v7M32 55v7M13 9.500l4.500 5M51 9.500l-4.500 5M13 54.500l4.500-5M51 54.500l-4.500-5"/>
</g>
<g stroke="#ffe7a0" stroke-width="1.300" fill="none" opacity=".85">
<path d="M22.500 5.500l1.800 4.500M41.500 5.500l-1.800 4.500M22.500 58.500l1.800-4.500M41.500 58.500l-1.800-4.500"/>
</g>
<ellipse cx="32" cy="10.500" rx="9" ry="2.300" fill="none" stroke="#fff3b0" stroke-width="2.200" opacity=".55"/>
<ellipse cx="32" cy="10.500" rx="9" ry="2.300" fill="none" stroke="url(#ci-c-g)" stroke-width="1.100"/>
<path d="M18 28C12 22 5 22 2 24c3 1 4 3 4 5-2 0-3 1-3 3 3-1 5 0 6 2-2 1-2 3-1 4 3-2 7-2 11 0Z" fill="url(#ci-c-w)" stroke="#4a5470" stroke-width="1.700"/>
<path d="M46 28c6-6 13-6 16-4-3 1-4 3-4 5 2 0 3 1 3 3-3-1-5 0-6 2 2 1 2 3 1 4-3-2-7-2-11 0Z" fill="url(#ci-c-w)" stroke="#4a5470" stroke-width="1.700"/>
<path d="M8 30c3-1 6-1 9 0M6 35c3-.500 6 0 9 1M56 30c-3-1-6-1-9 0M58 35c-3-.500-6 0-9 1" stroke="#8f9ab8" stroke-width="1" fill="none"/>
<path d="M5.500 25.500c3 .5 7 1.300 11 2.800M58.500 25.500c-3 .5-7 1.300-11 2.800M10 38.500c2-1 4-1.300 6.500-1M54 38.500c-2-1-4-1.300-6.500-1" stroke="#fff" stroke-width=".9" fill="none" opacity=".9"/>
<circle cx="32" cy="32" r="18" fill="none" stroke="#fff3b0" stroke-width="1.400" opacity=".6"/>
<circle cx="32" cy="32" r="16.500" fill="url(#ci-c-c)" stroke="#8a5a14" stroke-width="2.400"/>
<circle cx="32" cy="32" r="13" fill="none" stroke="#fff" stroke-width="1" opacity=".65"/>
<circle cx="32" cy="32" r="13" fill="none" stroke="#c98a2a" stroke-width="1" stroke-dasharray="1.500 2.500" opacity=".7"/>
<path d="M29.300 19h5.400v8.300H43v5.400h-8.300V46h-5.400V32.700H21v-5.400h8.300Z" fill="url(#ci-c-g)" stroke="#6a4210" stroke-width="1.700"/>
<path d="M30.600 20.500v7.300" stroke="#fff8d8" stroke-width="1" opacity=".9"/>
<path d="M22.500 28.600v2.800M41.500 28.600v2.800M30.600 44.500h2.800M30.600 20.400h2.800" stroke="#8a5a14" stroke-width=".9"/>
<circle cx="32" cy="44" r=".9" fill="#5ab8ff" stroke="#1c3a6a" stroke-width=".4"/><circle cx="22.600" cy="30" r=".9" fill="#5ab8ff" stroke="#1c3a6a" stroke-width=".4"/><circle cx="41.400" cy="30" r=".9" fill="#5ab8ff" stroke="#1c3a6a" stroke-width=".4"/><circle cx="32" cy="21" r=".9" fill="#5ab8ff" stroke="#1c3a6a" stroke-width=".4"/>
<path d="M32 26.200 35.800 30 32 33.800 28.200 30Z" fill="none" stroke="url(#ci-c-g)" stroke-width="1.100"/>
<circle cx="32" cy="30" r="3" fill="url(#ci-c-j)" stroke="#5a1418" stroke-width="1.100"/>
<circle cx="31" cy="29" r=".9" fill="#fff"/>`);

// Explorador: arco tensado con flecha emplumada sobre una rosa de los vientos y hojas del bosque.
const ranger = wrap('ci-x', `<linearGradient id="ci-x-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c88a4a"/><stop offset=".5" stop-color="#8a5428"/><stop offset="1" stop-color="#5a3418"/></linearGradient>
<linearGradient id="ci-x-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a8de78"/><stop offset="1" stop-color="#3a7a3a"/></linearGradient>`, `
<path d="M19 5c18 5 27 16 27 27S37 54 19 59" fill="none" stroke="#2a190e" stroke-width="7.200"/>
<path d="M19 5c18 5 27 16 27 27S37 54 19 59" fill="none" stroke="url(#ci-x-w)" stroke-width="3.800"/>
<path d="M21 8c13 5 20 13 21.500 21" fill="none" stroke="#eac08a" stroke-width="1.300" opacity=".8"/>
<path d="M27.500 9.200l-1.600 3.300M37.200 17.600l-2.700 2.400M37.200 46.400l-2.700-2.400M27.500 54.800l-1.600-3.300" stroke="#2a190e" stroke-width="3.200"/><path d="M27.500 9.200l-1.600 3.300M37.200 17.600l-2.700 2.400M37.200 46.400l-2.700-2.400M27.500 54.800l-1.600-3.300" stroke="url(#ci-x-g)" stroke-width="1.700"/>
<path d="M16.500 3.500l5 1.200-1 3.300-4.400-1.500Z M16.500 60.500l5-1.200-1-3.300-4.400 1.500Z" fill="url(#ci-x-g)" stroke="#2a190e" stroke-width="1.100"/>
<path d="M42 28.500h5v7h-5Z" fill="#5a3a24" stroke="#2a190e" stroke-width="1.300"/>
<path d="M42.500 30.500h4M42.500 33.500h4" stroke="#c99a5a" stroke-width=".9"/>
<path d="M19 5 13 32 19 59" fill="none" stroke="#f0e6cc" stroke-width="1.500"/>
<path d="M13 32h40" stroke="#2a190e" stroke-width="4.200"/>
<path d="M13 32h40" stroke="#c99a5a" stroke-width="2"/>
<path d="M60 32 49 26.500v11Z" fill="url(#ci-x-s)" stroke="#2a3040" stroke-width="1.800"/>
<path d="M58 32 50 28.200" stroke="#fff" stroke-width=".9" opacity=".85"/>
<path d="M47.500 30.500h1.800v3h-1.800Z" fill="url(#ci-x-g)" stroke="#2a190e" stroke-width=".7"/>
<path d="M44.500 35.500c.5 3-.5 5.500-2.500 7.500" fill="none" stroke="#5a3a24" stroke-width="1"/>
<path d="M42 43c-1.800 1.500-2 4-.6 6 1.300-1.300 1.600-4 .6-6Z" fill="#f4f0e0" stroke="#5a4a3a" stroke-width=".8"/>
<circle cx="42.300" cy="42.500" r="1.100" fill="#e05a4a" stroke="#5a1a14" stroke-width=".6"/>
<path d="M13 32 6 25.500l5 .5 6 6M13 32l-7 6.500 5-.5 6-6" fill="#e05a4a" stroke="#5a1a14" stroke-width="1.300"/>
<path d="M7 26.500l7 5.500M7 37.500l7-5.500" stroke="#ffb4a0" stroke-width=".8"/>
<path d="M4 49c3-6 9-8 14-6-3 5-9 8-14 6Z" fill="url(#ci-x-l)" stroke="#1d3a1c" stroke-width="1.500"/>
<path d="M5 48.500c4-2 8-3.500 12-5" fill="none" stroke="#d8f0b0" stroke-width=".9"/>
<path d="M8 55c4-4 9-4 12-1-4 3-8 4-12 1Z" fill="url(#ci-x-l)" stroke="#1d3a1c" stroke-width="1.500"/>
<path d="M9 55c3.500-1 7-1.300 10.500-1" fill="none" stroke="#d8f0b0" stroke-width=".8"/>
<path d="M2 44c1-3.500 4-5 6.500-4.500-1.500 3-4 4.800-6.500 4.500Z" fill="url(#ci-x-l)" stroke="#1d3a1c" stroke-width="1.200"/>
<path d="M18 43c1 2 1.500 4 1 6" fill="none" stroke="#3a2010" stroke-width="1.100"/>
<circle cx="20.500" cy="50.500" r="1.400" fill="#c8323a" stroke="#4a1010" stroke-width=".6"/><circle cx="18.800" cy="51.700" r="1.200" fill="#c8323a" stroke="#4a1010" stroke-width=".6"/><circle cx="20.100" cy="50" r=".4" fill="#fff"/>`);

export const CLASS_ICON_SVG: Record<ClassId, string> = {
  guerrero: warrior,
  mago: mage,
  picaro: rogue,
  clerigo: cleric,
  explorador: ranger,
};

/** SVG de la clase; `scope` evita ids duplicados cuando el icono aparece en dos sitios a la vez. */
export const classIcon = (cls: ClassId, scope = '') => (scope ? CLASS_ICON_SVG[cls].replace(/ci-/g, `${scope}-ci-`) : CLASS_ICON_SVG[cls]);

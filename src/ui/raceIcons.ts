// Emblemas vectoriales de cada linaje (viewBox 64×64), con el mismo acabado dorado que los de clase.
import type { Race } from '../data/data';

const wrap = (id: string, defs: string, body: string) => `<svg class="class-icon race-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".55" stop-color="#e3b45a"/><stop offset="1" stop-color="#9c6f2a"/></linearGradient>
${defs}
</defs>
<g stroke-linejoin="round" stroke-linecap="round">${body}</g>
</svg>`;

// Humano · Brumaluz: escudo heráldico con el farol que da nombre a la capital sobre la bruma.
const human = wrap('ri-h', `<linearGradient id="ri-h-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a86c8"/><stop offset="1" stop-color="#1f3466"/></linearGradient>
<radialGradient id="ri-h-l" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#ffd76a" stop-opacity=".8"/><stop offset="1" stop-color="#ffb43a" stop-opacity="0"/></radialGradient>`, `
<path d="M32 5 53 12v16c0 14-8.500 23-21 30C19.500 51 11 42 11 28V12Z" fill="url(#ri-h-b)" stroke="#2a1608" stroke-width="2.400"/>
<path d="M32 9.500 49 15v13c0 11.500-7 19.500-17 25.500C22 47.500 15 39.500 15 28V15Z" fill="none" stroke="url(#ri-h-g)" stroke-width="1.800"/>
<circle cx="32" cy="28" r="13" fill="url(#ri-h-l)"/>
<path d="M28 15.500h8M32 13v2.500" stroke="#2a1608" stroke-width="3.400"/>
<path d="M28 15.500h8M32 13v2.500" stroke="url(#ri-h-g)" stroke-width="1.600"/>
<path d="M26.500 19 28 16.500h8L37.500 19Z" fill="url(#ri-h-g)" stroke="#5a3a10" stroke-width="1.300"/>
<path d="M27 19h10l-1 13h-8Z" fill="#fff3b0" stroke="#5a3a10" stroke-width="1.500"/>
<path d="M32 19v13" stroke="#c98a2a" stroke-width="1"/>
<path d="M32 22.500c2 1.800 2 4.200 0 6-2-1.800-2-4.200 0-6Z" fill="#ff9a2a"/>
<path d="M26 32h12l-1.500 3h-9Z" fill="url(#ri-h-g)" stroke="#5a3a10" stroke-width="1.300"/>
<path d="M16 40c4-2.500 7 1.500 11 0s7-2.500 11 0 7 1.500 10 0M18.500 45.500c4-2 6.500 1.500 10 0s6.500-2 10 0 5 1 7 0" fill="none" stroke="#dbe7f5" stroke-width="2" opacity=".85"/>
<path d="M14 21l1 2.200 2.200 1-2.200 1-1 2.200-1-2.200-2.200-1 2.200-1Z" fill="#fff6d2" opacity=".9" transform="translate(5 -5)"/>
<path d="M45 16l.8 1.800 1.800.8-1.800.8-.8 1.800-.8-1.800-1.800-.8 1.800-.8Z" fill="#fff6d2" opacity=".9"/>`);

// Elfo · la Arboleda: hoja protectora que guarda un matraz de alquimia.
const elf = wrap('ri-e', `<linearGradient id="ri-e-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe88a"/><stop offset=".55" stop-color="#5fa64a"/><stop offset="1" stop-color="#2c5e30"/></linearGradient>
<linearGradient id="ri-e-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2fff0"/><stop offset="1" stop-color="#4fc4a6"/></linearGradient>`, `
<path d="M50 6C30 6 12 18 12 38c0 6 2 11 5 15 4-3 9-5 15-6C46 44 56 30 50 6Z" fill="url(#ri-e-l)" stroke="#1d3a1c" stroke-width="2.400"/>
<path d="M17 53C26 38 36 25 48 9" fill="none" stroke="#e8f7c8" stroke-width="1.800" opacity=".9"/>
<path d="M25 39c-4-2-6-6-6-10m12 1c-3-3-4-7-3-11m9 3c-1-3 0-7 2-9M30 41c5 1 10 0 14-3m-8-6c4 0 8-2 10-5" fill="none" stroke="#a6d97a" stroke-width="1.400" opacity=".85"/>
<path d="M34 34h8v5.500l6 10c1 2-.400 4-2.600 4H30.600c-2.200 0-3.600-2-2.600-4l6-10Z" fill="#effffa" fill-opacity=".85" stroke="#1d3a1c" stroke-width="1.900"/>
<path d="M30.300 47.500c3-1.600 5-1.600 8 0s5 1.600 8.300 0l1 2c.800 1.800-.400 3-2 3H31c-1.600 0-2.700-1.300-1.800-3Z" fill="url(#ri-e-p)"/>
<path d="M33 32.500h10" stroke="url(#ri-e-g)" stroke-width="3"/>
<circle cx="35.500" cy="44" r="1.200" fill="#fff"/><circle cx="39" cy="40.500" r=".9" fill="#fff"/>
<path d="M55 30l1 2.200 2.200 1-2.200 1-1 2.200-1-2.200-2.200-1 2.200-1Z" fill="url(#ri-e-g)" stroke="#6a4a14" stroke-width=".8"/>
<path d="M9 14l.8 1.800 1.800.8-1.800.8-.8 1.800-.8-1.800-1.800-.8 1.800-.8Z" fill="#e8f7c8"/>`);

// Lagto' · Cumbres de Cobre: escama de cobre con el ojo de reptil que ve en la oscuridad de las cuevas.
const lagto = wrap('ri-l', `<linearGradient id="ri-l-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2a66a"/><stop offset=".55" stop-color="#b8612e"/><stop offset="1" stop-color="#6a2f16"/></linearGradient>
<radialGradient id="ri-l-e" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff4a0"/><stop offset=".55" stop-color="#f0b02a"/><stop offset="1" stop-color="#a85a10"/></radialGradient>`, `
<path d="M32 4 55 17v24L32 60 9 41V17Z" fill="url(#ri-l-c)" stroke="#2e140a" stroke-width="2.400"/>
<path d="M32 8.500 51 19.300v19.500L32 55 13 38.800V19.300Z" fill="none" stroke="url(#ri-l-g)" stroke-width="1.700"/>
<path d="M13 38.800 21 30l5 5 6-9 6 9 5-5 8 8.800" fill="none" stroke="#4a200e" stroke-width="2.200" opacity=".7"/>
<path d="M20 15c3 2 5 2 8 0m8 0c3 2 5 2 8 0M18 48c3-2 5-2 8 0m12 0c3-2 5-2 8 0" fill="none" stroke="#f6c08c" stroke-width="1.300" opacity=".6"/>
<path d="M14 30C20 19 44 19 50 30 44 41 20 41 14 30Z" fill="#2e140a"/>
<path d="M17 30C22 22 42 22 47 30 42 38 22 38 17 30Z" fill="url(#ri-l-e)" stroke="#5a2a0e" stroke-width="1.200"/>
<path d="M32 21.500c-2.500 3-2.500 14 0 17 2.500-3 2.500-14 0-17Z" fill="#1a0c06"/>
<path d="M21.500 27.500c2-2.300 5-3.800 8-4.300" fill="none" stroke="#fffbe0" stroke-width="1.500" opacity=".9"/>`);

// Pelso · Isla de Luna Argéntea: cabeza felina ante la luna creciente plateada de su isla.
const pelso = wrap('ri-p', `<linearGradient id="ri-p-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cdd8ea"/><stop offset="1" stop-color="#7c8aa8"/></linearGradient>
<linearGradient id="ri-p-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf8a"/><stop offset=".6" stop-color="#e08a3a"/><stop offset="1" stop-color="#9a4f1c"/></linearGradient>`, `
<path d="M40 4a26 26 0 1 0 20 38A22 22 0 1 1 40 4Z" fill="url(#ri-p-m)" stroke="#2a3048" stroke-width="2.200"/>
<path d="M14 24 12 8l11 9M42 24l2-16-11 9" fill="url(#ri-p-f)" stroke="#3a1a0a" stroke-width="2.200"/>
<path d="M15.500 20 14.500 12l5 4.200M40.500 20l1-8-5 4.200" fill="#f7b7a8"/>
<path d="M28 15c-11 0-17 8-17 18 0 11 8 18 17 18s17-7 17-18c0-10-6-18-17-18Z" fill="url(#ri-p-f)" stroke="#3a1a0a" stroke-width="2.400"/>
<path d="M22 17c2 3 2 5 1 7m5-8v6m6-5c-2 3-2 5-1 7" fill="none" stroke="#9a4f1c" stroke-width="1.600"/>
<path d="M18 40c3 5 7 7 10 7s7-2 10-7c-3-2-6-3-10-3s-7 1-10 3Z" fill="#fff1dc"/>
<ellipse cx="21.500" cy="32" rx="3" ry="3.800" fill="#3fae6a" stroke="#1a2a12" stroke-width="1.200"/>
<ellipse cx="34.500" cy="32" rx="3" ry="3.800" fill="#3fae6a" stroke="#1a2a12" stroke-width="1.200"/>
<path d="M21.500 29v6M34.500 29v6" stroke="#10180c" stroke-width="1.400"/>
<circle cx="20.500" cy="30.500" r=".9" fill="#fff"/><circle cx="33.500" cy="30.500" r=".9" fill="#fff"/>
<path d="M26 38.500h4l-2 2.300Z" fill="#d86a74" stroke="#5a2018" stroke-width="1"/>
<path d="M28 40.800c-.500 2-2.500 2.500-4 1.500M28 40.800c.500 2 2.500 2.500 4 1.500" fill="none" stroke="#5a2018" stroke-width="1.200"/>
<path d="M17 39 7 37m10 4-9 3m31-5 10-2m-10 4 9 3" stroke="#fff6e6" stroke-width="1.100"/>
<path d="M54 50l1 2.200 2.200 1-2.200 1-1 2.200-1-2.200-2.200-1 2.200-1Z" fill="url(#ri-p-m)" stroke="#4a5470" stroke-width=".8"/>`);

export const RACE_ICON_SVG: Record<Race, string> = { humano: human, elfo: elf, lagto, pelso };

/** SVG del linaje; `scope` evita ids duplicados cuando el icono aparece en dos sitios a la vez. */
export const raceIcon = (race: Race, scope = '') => (scope ? RACE_ICON_SVG[race].replace(/ri-/g, `${scope}-ri-`) : RACE_ICON_SVG[race]);

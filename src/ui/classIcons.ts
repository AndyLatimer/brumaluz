// Iconos vectoriales de cada clase (viewBox 64×64). Se usan en el creador y en el HUD.
// Cada uno es un emblema dorado con un motivo propio; edita los colores en los degradados.
import type { ClassId } from '../data/data';

const wrap = (id: string, defs: string, body: string) => `<svg class="class-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".55" stop-color="#e3b45a"/><stop offset="1" stop-color="#9c6f2a"/></linearGradient>
<linearGradient id="${id}-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f8ff"/><stop offset=".5" stop-color="#b9c6d8"/><stop offset="1" stop-color="#6d7b92"/></linearGradient>
${defs}
</defs>
<g stroke-linejoin="round" stroke-linecap="round">${body}</g>
</svg>`;

const warrior = wrap('ci-w', '<linearGradient id="ci-w-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9534a"/><stop offset="1" stop-color="#7a1f24"/></linearGradient>', `
<path d="M32 6 52 13v15c0 13-8 22-20 28C20 50 12 41 12 28V13Z" fill="url(#ci-w-r)" stroke="#3a1a10" stroke-width="2.4"/>
<path d="M32 10 48 15.5V28c0 10.5-6.500 18.500-16 24-9.500-5.500-16-13.500-16-24V15.500Z" fill="none" stroke="url(#ci-w-g)" stroke-width="2"/>
<path d="M32 12v38" stroke="#3a1a10" stroke-width="5"/>
<path d="M32 12v38" stroke="url(#ci-w-s)" stroke-width="2.600"/>
<path d="M24 21h16" stroke="#3a1a10" stroke-width="5"/>
<path d="M24 21h16" stroke="url(#ci-w-g)" stroke-width="2.600"/>
<path d="M32 4 35 12H29Z" fill="url(#ci-w-s)" stroke="#3a1a10" stroke-width="1.600"/>`);

const mage = wrap('ci-m', '<radialGradient id="ci-m-o" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e8f6ff"/><stop offset=".45" stop-color="#58a8ff"/><stop offset="1" stop-color="#2a3fa8"/></radialGradient>', `
<path d="M20 58 40 22" stroke="#2a190e" stroke-width="7"/>
<path d="M20 58 40 22" stroke="url(#ci-m-g)" stroke-width="3.600"/>
<path d="M36 25c-6-4-8-12-3-17 2-2 5-3 8-2 6 1 10 8 8 14-2 5-8 8-13 5Z" fill="#8fd0ff" opacity=".25"/>
<circle cx="42" cy="17" r="9" fill="url(#ci-m-o)" stroke="#1c2a6a" stroke-width="2.200"/>
<path d="M37 14a6 6 0 0 1 6-4" stroke="#fff" stroke-width="2" fill="none" opacity=".9"/>
<path d="M16 20l1.800 4.200L22 26l-4.200 1.800L16 32l-1.800-4.200L10 26l4.200-1.800Z" fill="url(#ci-m-g)" stroke="#6a4a14" stroke-width="1.200"/>
<path d="M52 40l1.300 3 3 1.300-3 1.300-1.300 3-1.300-3-3-1.300 3-1.300Z" fill="url(#ci-m-g)" stroke="#6a4a14" stroke-width="1"/>
<path d="M12 44l1 2.200 2.200 1-2.200 1-1 2.200-1-2.200-2.200-1 2.200-1Z" fill="#cfe8ff" stroke="#4a6aa8" stroke-width=".8"/>`);

const rogue = wrap('ci-r', '', `
<g transform="rotate(-38 32 32)">
<path d="M32 4 38 30H26Z" fill="url(#ci-r-s)" stroke="#232b3a" stroke-width="2"/>
<path d="M32 6v22" stroke="#fff" stroke-width="1.400" opacity=".8"/>
<rect x="23" y="30" width="18" height="5" rx="2" fill="url(#ci-r-g)" stroke="#5a3a10" stroke-width="1.600"/>
<rect x="29" y="35" width="6" height="15" rx="2" fill="#4a2a2e" stroke="#2a1418" stroke-width="1.600"/>
<path d="M29 40h6M29 44h6" stroke="#9a6a6e" stroke-width="1.200"/>
<circle cx="32" cy="53" r="3.600" fill="url(#ci-r-g)" stroke="#5a3a10" stroke-width="1.400"/>
</g>
<g transform="rotate(38 32 32)">
<path d="M32 4 38 30H26Z" fill="url(#ci-r-s)" stroke="#232b3a" stroke-width="2"/>
<path d="M32 6v22" stroke="#fff" stroke-width="1.400" opacity=".8"/>
<rect x="23" y="30" width="18" height="5" rx="2" fill="url(#ci-r-g)" stroke="#5a3a10" stroke-width="1.600"/>
<rect x="29" y="35" width="6" height="15" rx="2" fill="#4a2a2e" stroke="#2a1418" stroke-width="1.600"/>
<path d="M29 40h6M29 44h6" stroke="#9a6a6e" stroke-width="1.200"/>
<circle cx="32" cy="53" r="3.600" fill="url(#ci-r-g)" stroke="#5a3a10" stroke-width="1.400"/>
</g>`);

const cleric = wrap('ci-c', '<radialGradient id="ci-c-c" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#f0c24a"/></radialGradient>', `
<g stroke="url(#ci-c-g)" stroke-width="3.400" fill="none">
<path d="M32 3v8M32 53v8M3 32h8M53 32h8M11.500 11.500l5.700 5.700M46.800 46.800l5.700 5.700M52.500 11.500l-5.700 5.700M17.200 46.800l-5.700 5.700"/>
</g>
<circle cx="32" cy="32" r="18" fill="url(#ci-c-c)" stroke="#8a5a14" stroke-width="2.400"/>
<circle cx="32" cy="32" r="14" fill="none" stroke="#fff" stroke-width="1" opacity=".6"/>
<path d="M29 20h6v8h8v6h-8v10h-6V34h-8v-6h8Z" fill="#fff8e0" stroke="#8a5a14" stroke-width="2"/>`);

const ranger = wrap('ci-x', '', `
<path d="M20 6c20 6 28 18 28 26S40 52 20 58" fill="none" stroke="#2a190e" stroke-width="7.400"/>
<path d="M20 6c20 6 28 18 28 26S40 52 20 58" fill="none" stroke="#9a6a38" stroke-width="4"/>
<path d="M22 9c14 5 21 14 22 23" fill="none" stroke="#d8a868" stroke-width="1.400" opacity=".8"/>
<path d="M20 6 20 58" stroke="#e8dcc0" stroke-width="1.600"/>
<path d="M10 32h40" stroke="#2a190e" stroke-width="4.400"/>
<path d="M10 32h40" stroke="url(#ci-x-s)" stroke-width="2"/>
<path d="M56 32 46 26.500v11Z" fill="url(#ci-x-s)" stroke="#2a3040" stroke-width="1.800"/>
<path d="M10 32 4 26M10 32l-6 6M16 32 10 26M16 32l-6 6" stroke="#4a9a5a" stroke-width="2.600"/>`);

export const CLASS_ICON_SVG: Record<ClassId, string> = {
  guerrero: warrior,
  mago: mage,
  picaro: rogue,
  clerigo: cleric,
  explorador: ranger,
};

/** SVG de la clase; `scope` evita ids duplicados cuando el icono aparece en dos sitios a la vez. */
export const classIcon = (cls: ClassId, scope = '') => (scope ? CLASS_ICON_SVG[cls].replace(/ci-/g, `${scope}-ci-`) : CLASS_ICON_SVG[cls]);

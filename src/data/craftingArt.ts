/**
 * Handcrafted artisan illustrations for profession crafting components and raw materials.
 * Scaled and styled to match the visual depth, warm medieval fantasy palette and volumetric
 * grounding of Brumaluz's wood and mineral resource icons.
 */
import { craftingComponentPainting } from '../art/inventoryPaintings';

function herreriaArt(): string {
  return `<defs>
    <linearGradient id="resource-art-ingot-top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#edf4fa"/><stop offset="35%" stop-color="#c0d1df"/><stop offset="100%" stop-color="#8fa3b3"/>
    </linearGradient>
    <linearGradient id="resource-art-ingot-left" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7e91a0"/><stop offset="100%" stop-color="#45535e"/>
    </linearGradient>
    <linearGradient id="resource-art-ingot-right" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#556675"/><stop offset="100%" stop-color="#28323a"/>
    </linearGradient>
    <linearGradient id="resource-art-plate-top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9eb0be"/><stop offset="60%" stop-color="#62727f"/><stop offset="100%" stop-color="#364048"/>
    </linearGradient>
    <linearGradient id="resource-art-bronze" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff2b3"/><stop offset="45%" stop-color="#d9a538"/><stop offset="100%" stop-color="#734e0d"/>
    </linearGradient>
  </defs>
  <ellipse cx="48" cy="81" rx="36" ry="8" fill="#110d0a" opacity=".55"/>
  <path d="M14 43 L46 61 L46 79 L14 63 Z" fill="url(#resource-art-ingot-left)" stroke="#1a232a" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M46 61 L82 41 L82 59 L46 79 Z" fill="url(#resource-art-ingot-right)" stroke="#1a232a" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M14 43 L48 25 L82 41 L46 61 Z" fill="url(#resource-art-ingot-top)" stroke="#1a232a" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M15 43 L48 26.5 L81 41.5" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M46 61.5 L46 78.5" fill="none" stroke="#cfe0ed" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M15 62.5 L46 78.5 L81 58.5" fill="none" stroke="#2a353e" stroke-width="1"/>
  <g transform="translate(48, 41) scale(.95)">
    <circle cx="0" cy="0" r="8" fill="none" stroke="#313f49" stroke-width="1.4"/>
    <path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="#313f49" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="0" cy="0" r="1.5" fill="#f0f6fa"/>
  </g>
  <path d="M26 65 L66 43 L78 49 L38 71 Z" fill="url(#resource-art-plate-top)" stroke="#131a1f" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M26 65 L38 71 L38 77 L26 71 Z" fill="#2d3840" stroke="#131a1f" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M38 71 L78 49 L78 54 L38 76 Z" fill="#1b2328" stroke="#131a1f" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M27 65.5 L66 44 L77 49.5" fill="none" stroke="#d5e5f2" stroke-width="1"/>
  <circle cx="33" cy="67.5" r="2.6" fill="url(#resource-art-bronze)" stroke="#452e07" stroke-width=".9"/>
  <circle cx="32.2" cy="66.7" r=".8" fill="#ffffff"/>
  <circle cx="52" cy="57" r="2.6" fill="url(#resource-art-bronze)" stroke="#452e07" stroke-width=".9"/>
  <circle cx="51.2" cy="56.2" r=".8" fill="#ffffff"/>
  <circle cx="71" cy="46.5" r="2.6" fill="url(#resource-art-bronze)" stroke="#452e07" stroke-width=".9"/>
  <circle cx="70.2" cy="45.7" r=".8" fill="#ffffff"/>
  <path d="M17 45.5 L44 59.5" fill="none" stroke="#f2aa38" stroke-width="1.2" stroke-linecap="round" opacity=".85"/>`;
}

function peleteriaArt(): string {
  return `<defs>
    <linearGradient id="resource-art-leather-main" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e3a86f"/><stop offset="40%" stop-color="#ac6c37"/><stop offset="100%" stop-color="#542e10"/>
    </linearGradient>
    <linearGradient id="resource-art-leather-dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#693b18"/><stop offset="100%" stop-color="#311704"/>
    </linearGradient>
    <linearGradient id="resource-art-strap-buckle" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff0aa"/><stop offset="50%" stop-color="#cca337"/><stop offset="100%" stop-color="#6b4a09"/>
    </linearGradient>
  </defs>
  <ellipse cx="48" cy="81" rx="35" ry="8" fill="#110d0a" opacity=".55"/>
  <path d="M16 66 Q8 75 20 82 Q48 85 76 81 Q88 74 78 64 Q62 68 42 71 Z" fill="url(#resource-art-leather-dark)" stroke="#220e02" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M22 78 Q48 82 74 77" fill="none" stroke="#e8c29b" stroke-width="1" stroke-dasharray="2.5 2"/>
  <ellipse cx="25" cy="45" rx="13" ry="19" fill="#5c3011" stroke="#220e02" stroke-width="1.8"/>
  <ellipse cx="25" cy="45" rx="9.5" ry="14.5" fill="#874a1f"/>
  <path d="M25 31 C17 31 16 59 25 59 C32 59 32 38 25 38 C20 38 20 52 25 52" fill="none" stroke="#220e02" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M25 26 C54 25 76 35 81 48 L71 75 C48 78 22 67 25 64 Z" fill="url(#resource-art-leather-main)" stroke="#220e02" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M36 30 Q58 34 72 43" fill="none" stroke="#fadeb8" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M38 39 Q58 43 70 53" fill="none" stroke="#7a3f14" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M42 47 Q60 51 68 62" fill="none" stroke="#7a3f14" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M45 29 L41 71" stroke="#2e1403" stroke-width="6" stroke-linecap="round"/>
  <path d="M45 29 L41 71" stroke="#c4864a" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M45 31 L41 69" fill="none" stroke="#fff4de" stroke-width=".9" stroke-dasharray="2 2"/>
  <rect x="35" y="44" width="11" height="10" rx="2.5" fill="url(#resource-art-strap-buckle)" stroke="#3d2602" stroke-width="1.4"/>
  <rect x="38" y="47" width="5" height="4" rx="1" fill="#2e1403"/>
  <line x1="36.5" y1="49" x2="44.5" y2="49" stroke="#fff7cc" stroke-width="1.4" stroke-linecap="round"/>`;
}

function sastreriaArt(): string {
  return `<defs>
    <linearGradient id="resource-art-fabric-top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d4a3cb"/><stop offset="50%" stop-color="#9e6293"/><stop offset="100%" stop-color="#5f3256"/>
    </linearGradient>
    <linearGradient id="resource-art-fabric-fold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7a4270"/><stop offset="100%" stop-color="#3b1735"/>
    </linearGradient>
    <linearGradient id="resource-art-gold-needle" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#ffe48f"/><stop offset="100%" stop-color="#b8831f"/>
    </linearGradient>
    <linearGradient id="resource-art-spool-body" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2d7a75"/><stop offset="50%" stop-color="#55b0aa"/><stop offset="100%" stop-color="#215955"/>
    </linearGradient>
  </defs>
  <ellipse cx="48" cy="81" rx="36" ry="8" fill="#110d0a" opacity=".55"/>
  <path d="M14 49 L52 33 L84 46 L46 65 Z" fill="url(#resource-art-fabric-fold)" stroke="#240a20" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M14 49 L46 65 L46 78 L14 62 Z" fill="#471c40" stroke="#240a20" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M46 65 L84 46 L84 59 L46 78 Z" fill="#310f2c" stroke="#240a20" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M19 37 L52 23 L82 35 L48 51 Z" fill="url(#resource-art-fabric-top)" stroke="#240a20" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M19 37 L48 51 L48 59 L19 45 Z" fill="#75396a" stroke="#240a20" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M48 51 L82 35 L82 43 L48 59 Z" fill="#54234c" stroke="#240a20" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M20 37.5 L52 24 L81 35.5" fill="none" stroke="#fae6f6" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M24 41 L48 52 L78 39" fill="none" stroke="#fcf0fa" stroke-width="1" stroke-dasharray="2 2"/>
  <path d="M42 27 L57 48 L53 53 L38 32 Z" fill="#cca035" stroke="#423004" stroke-width="1.1"/>
  <path d="M40 29 L55 50" fill="none" stroke="#fff4b8" stroke-width="1.1"/>
  <path d="M72 17 Q82 10 83 23 Q84 37 68 41" fill="none" stroke="#faeaf8" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M77 12 L38 64" stroke="url(#resource-art-gold-needle)" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="74.5" cy="15" r="1.1" fill="#3b1735"/>
  <line x1="76" y1="13" x2="40" y2="61" stroke="#ffffff" stroke-width="1"/>
  <g transform="translate(12, 60) scale(.95)">
    <ellipse cx="14" cy="5" rx="7.5" ry="3.2" fill="#9e6a38" stroke="#331c06" stroke-width="1.2"/>
    <rect x="6.5" y="5" width="15" height="13" fill="url(#resource-art-spool-body)" stroke="#331c06" stroke-width="1.2"/>
    <line x1="6.5" y1="8" x2="21.5" y2="8" stroke="#8ae8e2" stroke-width=".9"/>
    <line x1="6.5" y1="11" x2="21.5" y2="11" stroke="#8ae8e2" stroke-width=".9"/>
    <line x1="6.5" y1="14" x2="21.5" y2="14" stroke="#8ae8e2" stroke-width=".9"/>
    <ellipse cx="14" cy="18" rx="7.5" ry="3.2" fill="#7a4c1f" stroke="#331c06" stroke-width="1.2"/>
  </g>`;
}

function carpinteriaArt(): string {
  return `<defs>
    <linearGradient id="resource-art-wood-top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fadba0"/><stop offset="45%" stop-color="#cc9754"/><stop offset="100%" stop-color="#8f5c22"/>
    </linearGradient>
    <linearGradient id="resource-art-wood-side" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a66e33"/><stop offset="100%" stop-color="#4a2c0d"/>
    </linearGradient>
    <linearGradient id="resource-art-wood-end" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#deb478"/><stop offset="100%" stop-color="#8a5723"/>
    </linearGradient>
  </defs>
  <ellipse cx="48" cy="81" rx="36" ry="8" fill="#110d0a" opacity=".55"/>
  <path d="M12 43 L36 59 L36 78 L12 62 Z" fill="url(#resource-art-wood-end)" stroke="#261303" stroke-width="1.8" stroke-linejoin="round"/>
  <ellipse cx="24" cy="60" rx="7" ry="5" fill="none" stroke="#573310" stroke-width="1.4"/>
  <ellipse cx="24" cy="60" rx="10.5" ry="7.5" fill="none" stroke="#573310" stroke-width="1.1"/>
  <path d="M12 43 L48 23 L58 29 L54 35 L66 42 L61 48 L84 35 L84 42 L75 48 L79 54 L70 60 L46 75 L36 59 Z" fill="url(#resource-art-wood-top)" stroke="#261303" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M46 75 L82 54 L82 70 L46 85 Z" fill="url(#resource-art-wood-side)" stroke="#261303" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M48 66 L56 62 L60 66 L52 70 Z" fill="#e6bd85" stroke="#261303" stroke-width="1.4"/>
  <path d="M62 58 L70 54 L74 58 L66 62 Z" fill="#e6bd85" stroke="#261303" stroke-width="1.4"/>
  <path d="M13 43.5 L48 24.5 L83 35.5" fill="none" stroke="#fff1d1" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M22 39 Q44 28 64 38" fill="none" stroke="#784719" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M26 44 Q48 34 68 43" fill="none" stroke="#ffe2b5" stroke-width="1" stroke-linecap="round"/>
  <path d="M32 50 Q52 40 70 49" fill="none" stroke="#784719" stroke-width="1.2" stroke-linecap="round"/>
  <ellipse cx="44" cy="44" rx="3" ry="2.1" fill="#4d2807" stroke="#261303" stroke-width="1"/>
  <ellipse cx="44" cy="44" rx="2.1" ry="1.4" fill="#c7955b"/>
  <circle cx="43.3" cy="43.3" r=".6" fill="#fff0d4"/>
  <ellipse cx="60" cy="35" rx="3" ry="2.1" fill="#4d2807" stroke="#261303" stroke-width="1"/>
  <ellipse cx="60" cy="35" rx="2.1" ry="1.4" fill="#c7955b"/>
  <circle cx="59.3" cy="34.3" r=".6" fill="#fff0d4"/>`;
}

function ebanisteriaArt(): string {
  return `<defs>
    <linearGradient id="resource-art-walnut" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#734120"/><stop offset="50%" stop-color="#4d260f"/><stop offset="100%" stop-color="#241004"/>
    </linearGradient>
    <linearGradient id="resource-art-inlay" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff5dc"/><stop offset="60%" stop-color="#e8c287"/><stop offset="100%" stop-color="#ad803d"/>
    </linearGradient>
    <linearGradient id="resource-art-brass-bracket" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff5b8"/><stop offset="45%" stop-color="#deb33c"/><stop offset="100%" stop-color="#734f0a"/>
    </linearGradient>
  </defs>
  <ellipse cx="48" cy="81" rx="36" ry="8" fill="#110d0a" opacity=".55"/>
  <path d="M16 43 L48 25 L80 43 L48 61 Z" fill="url(#resource-art-walnut)" stroke="#170801" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M16 43 L48 61 L48 79 L16 61 Z" fill="#3b1b08" stroke="#170801" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M48 61 L80 43 L80 61 L48 79 Z" fill="#241004" stroke="#170801" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M17 43.5 L48 26.5 L79 43.5" fill="none" stroke="#b06d3e" stroke-width="1.4"/>
  <path d="M48 61.5 L48 78.5" fill="none" stroke="#5c2e12" stroke-width="1.2"/>
  <path d="M34 35 L48 27 L62 35 L48 43 Z" fill="url(#resource-art-inlay)" stroke="#422409" stroke-width="1.1"/>
  <path d="M48 27 L53 35 L48 43 L43 35 Z" fill="#fff9eb"/>
  <path d="M34 35 L62 35 M48 27 L48 43" stroke="#422409" stroke-width=".9"/>
  <path d="M25 42 L42 32 M48 28 L68 39" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".6" stroke-linecap="round"/>
  <path d="M15 43 L26 37 L30 45 L25 48 L25 59 L16 54 Z" fill="url(#resource-art-brass-bracket)" stroke="#301f01" stroke-width="1.3" stroke-linejoin="round"/>
  <circle cx="23" cy="43" r="1.5" fill="#261701"/>
  <circle cx="22.6" cy="42.6" r=".6" fill="#fffbe6"/>
  <path d="M44 59 L48 55 L52 59 L53 71 L48 75 L43 71 Z" fill="url(#resource-art-brass-bracket)" stroke="#301f01" stroke-width="1.4" stroke-linejoin="round"/>
  <circle cx="48" cy="63" r="1.7" fill="#261701"/>
  <circle cx="47.5" cy="62.5" r=".7" fill="#fffbe6"/>
  <circle cx="48" cy="69" r="1.3" fill="#261701"/>`;
}

function joyeriaArt(): string {
  return `<defs>
    <linearGradient id="resource-art-gem-body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#dbf8fd"/><stop offset="28%" stop-color="#55c9d6"/><stop offset="70%" stop-color="#1b7b8a"/><stop offset="100%" stop-color="#083a42"/>
    </linearGradient>
    <linearGradient id="resource-art-gold-filigree" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff7c2"/><stop offset="45%" stop-color="#e8b83a"/><stop offset="100%" stop-color="#734e08"/>
    </linearGradient>
  </defs>
  <ellipse cx="48" cy="81" rx="34" ry="7" fill="#110d0a" opacity=".55"/>
  <ellipse cx="48" cy="67" rx="29" ry="13" fill="url(#resource-art-gold-filigree)" stroke="#3d2a03" stroke-width="1.8"/>
  <ellipse cx="48" cy="67" rx="23" ry="10" fill="#4d3506"/>
  ${[0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325].map(deg => {
    const rad = deg * Math.PI / 180;
    const x = 48 + 26.5 * Math.cos(rad);
    const y = 67 + 11 * Math.sin(rad);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#fff0a6" stroke="#3d2a03" stroke-width=".7"/>`;
  }).join('')}
  <path d="M48 78 L22 47 L48 16 L74 47 Z" fill="url(#resource-art-gem-body)" stroke="#06292f" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M48 16 L32 36 L48 30 Z" fill="#f0fdff" stroke="#0e535e" stroke-width="1.1"/>
  <path d="M48 16 L48 30 L64 36 Z" fill="#80e2f0" stroke="#0e535e" stroke-width="1.1"/>
  <path d="M32 36 L48 30 L64 36 L48 52 Z" fill="#42cdda" stroke="#0e535e" stroke-width="1.1"/>
  <path d="M22 47 L32 36 L48 52 L34 68 Z" fill="#1a8999" stroke="#0e535e" stroke-width="1.1"/>
  <path d="M74 47 L64 36 L48 52 L62 68 Z" fill="#136470" stroke="#0e535e" stroke-width="1.1"/>
  <path d="M34 68 L48 52 L62 68 L48 78 Z" fill="#094047" stroke="#0e535e" stroke-width="1.1"/>
  <path d="M25 43 Q30 45 33 48" stroke="url(#resource-art-gold-filigree)" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="31.5" cy="47.5" r="1.8" fill="#fffbe0" stroke="#3d2a03" stroke-width=".7"/>
  <path d="M71 43 Q66 45 63 48" stroke="url(#resource-art-gold-filigree)" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="64.5" cy="47.5" r="1.8" fill="#fffbe0" stroke="#3d2a03" stroke-width=".7"/>
  <path d="M48 20 L48 26" stroke="url(#resource-art-gold-filigree)" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="48" cy="24" r="1.8" fill="#fffbe0" stroke="#3d2a03" stroke-width=".7"/>
  <path d="M32 36 L27 36 M32 36 L37 36 M32 36 L32 31 M32 36 L32 41" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="32" cy="36" r="1.5" fill="#ffffff"/>`;
}

function alquimiaArt(): string {
  return `<defs>
    <linearGradient id="resource-art-elixir" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c4ffdc"/><stop offset="35%" stop-color="#42d678"/><stop offset="80%" stop-color="#14873f"/><stop offset="100%" stop-color="#06421c"/>
    </linearGradient>
    <linearGradient id="resource-art-glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".75"/><stop offset="30%" stop-color="#d6f7ed" stop-opacity=".25"/><stop offset="100%" stop-color="#72bda6" stop-opacity=".45"/>
    </linearGradient>
    <linearGradient id="resource-art-cork" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#805628"/><stop offset="50%" stop-color="#c9975f"/><stop offset="100%" stop-color="#69431b"/>
    </linearGradient>
    <linearGradient id="resource-art-wax" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#eb3d5b"/><stop offset="60%" stop-color="#9e1931"/><stop offset="100%" stop-color="#4f0814"/>
    </linearGradient>
  </defs>
  <ellipse cx="48" cy="81" rx="34" ry="8" fill="#110d0a" opacity=".55"/>
  <ellipse cx="48" cy="75" rx="27" ry="7" fill="#1c160b" stroke="#4d3711" stroke-width="1.6"/>
  <path d="M26 74 Q48 77 70 74 L68 68 Q48 71 28 68 Z" fill="#9e7724" stroke="#4d3711" stroke-width="1.4"/>
  <path d="M28 68 L39 48 M68 68 L57 48" stroke="#c99c36" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="48" cy="50" r="25" fill="#0b2416" stroke="#123621" stroke-width="1.8"/>
  <path d="M24 53 C24 72 72 72 72 53 C65 50 56 56 48 53 C40 50 31 56 24 53 Z" fill="url(#resource-art-elixir)"/>
  <ellipse cx="48" cy="52" rx="23" ry="5.5" fill="#6bf09f" opacity=".4"/>
  <circle cx="40" cy="62" r="2.2" fill="#d9ffea" opacity=".85"/>
  <circle cx="56" cy="57" r="1.8" fill="#d9ffea" opacity=".9"/>
  <circle cx="48" cy="66" r="2" fill="#d9ffea" opacity=".7"/>
  <circle cx="34" cy="58" r="1.2" fill="#ffffff"/>
  <rect x="41" y="20" width="14" height="17" fill="url(#resource-art-glass)" stroke="#123621" stroke-width="1.6"/>
  <ellipse cx="48" cy="20" rx="8.5" ry="3.5" fill="#d1faee" stroke="#123621" stroke-width="1.6"/>
  <path d="M42 12 L54 12 L53 20 L43 20 Z" fill="url(#resource-art-cork)" stroke="#382109" stroke-width="1.3"/>
  <ellipse cx="48" cy="11.5" rx="7.5" ry="3.5" fill="url(#resource-art-wax)" stroke="#38050e" stroke-width="1.3"/>
  <path d="M42 12 C41 18 44 22 44 24 C46 22 51 23 54 13 Z" fill="url(#resource-art-wax)"/>
  <path d="M28 40 A 22 22 0 0 1 45 28" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>
  <path d="M26 49 A 22 22 0 0 0 31 65" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`;
}

function encantamientoArt(): string {
  return `<defs>
    <linearGradient id="resource-art-slate-top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#553f70"/><stop offset="50%" stop-color="#37264d"/><stop offset="100%" stop-color="#1d122b"/>
    </linearGradient>
    <linearGradient id="resource-art-slate-side" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2d1e3d"/><stop offset="100%" stop-color="#12091c"/>
    </linearGradient>
    <linearGradient id="resource-art-rune-glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="40%" stop-color="#e7bcff"/><stop offset="100%" stop-color="#a35cf0"/>
    </linearGradient>
  </defs>
  <ellipse cx="48" cy="81" rx="36" ry="8" fill="#110d0a" opacity=".55"/>
  <path d="M16 48 L48 64 L80 48 L80 64 L48 80 L16 64 Z" fill="url(#resource-art-slate-side)" stroke="#0f0517" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M48 64 L48 80" stroke="#0f0517" stroke-width="1.6"/>
  <path d="M16 48 L32 28 L64 28 L80 48 L64 64 L32 64 Z" fill="url(#resource-art-slate-top)" stroke="#0f0517" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M21 48 L34 32 L62 32 L75 48 L62 61 L34 61 Z" fill="none" stroke="#d6a738" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M21 48 L34 32 L62 32" fill="none" stroke="#fff5b3" stroke-width="1"/>
  <path d="M48 34 L48 58 M36 41 L60 51 M36 51 L60 41 M41 46 L55 46" fill="none" stroke="#b170f7" stroke-width="6" stroke-linecap="round" opacity=".4"/>
  <path d="M48 34 L48 58 M36 41 L60 51 M36 51 L60 41 M41 46 L55 46" fill="none" stroke="url(#resource-art-rune-glow)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M48 35 L48 57 M38 42 L58 50 M38 50 L58 42" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M24 33 L26.5 35.5 L24 38 L21.5 35.5 Z" fill="#ffffff" stroke="#c48cff" stroke-width=".9"/>
  <path d="M73 30 L75 32 L73 34 L71 32 Z" fill="#ffffff" stroke="#c48cff" stroke-width=".9"/>
  <path d="M50 21 L52.5 23.5 L50 26 L47.5 23.5 Z" fill="#ffffff" stroke="#c48cff" stroke-width=".9"/>
  <circle cx="28" cy="58" r="1.4" fill="#ebd1ff"/>
  <circle cx="71" cy="56" r="1.6" fill="#ebd1ff"/>`;
}

function cocinaArt(): string {
  return `<defs>
    <linearGradient id="resource-art-pot-clay" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#df8252"/><stop offset="45%" stop-color="#a64c26"/><stop offset="100%" stop-color="#4d1b08"/>
    </linearGradient>
    <linearGradient id="resource-art-stew-rich" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fadc73"/><stop offset="40%" stop-color="#de872e"/><stop offset="85%" stop-color="#8f390e"/><stop offset="100%" stop-color="#4d1803"/>
    </linearGradient>
    <linearGradient id="resource-art-spoon-wood" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8a5c34"/><stop offset="50%" stop-color="#cca276"/><stop offset="100%" stop-color="#69401d"/>
    </linearGradient>
  </defs>
  <ellipse cx="48" cy="81" rx="36" ry="8" fill="#110d0a" opacity=".55"/>
  <path d="M11 48 Q7 55 13 61 Q18 59 16 50 Z" fill="#7a3215" stroke="#2b0d02" stroke-width="1.5"/>
  <path d="M85 48 Q89 55 83 61 Q78 59 80 50 Z" fill="#521d0a" stroke="#2b0d02" stroke-width="1.5"/>
  <path d="M15 44 C15 77 81 77 81 44 Z" fill="url(#resource-art-pot-clay)" stroke="#2b0d02" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="48" cy="44" rx="33" ry="12" fill="#4d1a07" stroke="#2b0d02" stroke-width="2"/>
  <ellipse cx="48" cy="45" rx="29" ry="9.5" fill="url(#resource-art-stew-rich)"/>
  <ellipse cx="46" cy="46" rx="18" ry="5" fill="#fae087" opacity=".4"/>
  <circle cx="37" cy="45" r="1.8" fill="#fa9837"/>
  <circle cx="58" cy="44" r="2.2" fill="#fa9837"/>
  <circle cx="45" cy="48" r="1.4" fill="#fa9837"/>
  <path d="M34 46 Q43 39 50 45 Q44 49 34 46 Z" fill="#548231" stroke="#192e09" stroke-width="1"/>
  <line x1="36" y1="46" x2="48" y2="44.5" stroke="#90c763" stroke-width=".9"/>
  <path d="M53 44 Q60 41 64 46 Q58 47 53 44 Z" fill="#6ba03f" stroke="#192e09" stroke-width="1"/>
  <g transform="rotate(-25 66 40)">
    <ellipse cx="66" cy="35" rx="7" ry="9.5" fill="url(#resource-art-spoon-wood)" stroke="#381e09" stroke-width="1.4"/>
    <ellipse cx="66" cy="36" rx="4.8" ry="6.5" fill="#542e0e"/>
    <rect x="64.5" y="42" width="3.5" height="27" rx="1.7" fill="url(#resource-art-spoon-wood)" stroke="#381e09" stroke-width="1.4"/>
    <line x1="65.8" y1="43" x2="65.8" y2="67" stroke="#ffe0bd" stroke-width=".8"/>
  </g>
  <path d="M33 33 Q38 26 34 19 M48 31 Q53 22 49 13 M63 33 Q68 26 64 19" fill="none" stroke="#fff2db" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>`;
}

function cueroArt(tier = 0): string {
  const palettes = [
    { main0: '#e3a86f', main1: '#ab6b36', main2: '#573012', dark: '#311704', seam: '#ffdcb5' },
    { main0: '#c2aaa3', main1: '#7d655d', main2: '#473630', dark: '#241a16', seam: '#ede3de' },
    { main0: '#94b0cc', main1: '#4a6b8a', main2: '#243a4f', dark: '#111f2c', seam: '#d4e8fc' },
    { main0: '#c59de8', main1: '#74479c', main2: '#3e1d5c', dark: '#200b33', seam: '#f0d9ff' },
    { main0: '#fad66b', main1: '#bd9124', main2: '#694e0b', dark: '#3b2a03', seam: '#fff4cc' },
    { main0: '#fa8484', main1: '#b83939', main2: '#631414', dark: '#360808', seam: '#ffd4d4' },
  ];
  const p = palettes[tier] || palettes[0];
  return `<defs>
    <linearGradient id="resource-art-cuero-${tier}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.main0}"/><stop offset="45%" stop-color="${p.main1}"/><stop offset="100%" stop-color="${p.main2}"/>
    </linearGradient>
  </defs>
  <ellipse cx="48" cy="81" rx="36" ry="8" fill="#110d0a" opacity=".55"/>
  <path d="M48 16 C57 16 66 20 68 29 C77 33 85 40 83 51 C81 60 76 64 78 74 C70 78 61 74 48 78 C35 74 26 78 18 74 C20 64 15 60 13 51 C11 40 19 33 28 29 C30 20 39 16 48 16 Z" fill="url(#resource-art-cuero-${tier})" stroke="${p.dark}" stroke-width="1.9" stroke-linejoin="round"/>
  <path d="M48 20 Q47 46 48 74" fill="none" stroke="${p.dark}" stroke-width="2" stroke-linecap="round" opacity=".65"/>
  <path d="M49.2 20 Q48.5 46 49.5 74" fill="none" stroke="${p.seam}" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>
  <path d="M33 33 Q46 38 63 33" fill="none" stroke="${p.dark}" stroke-width="1.3" stroke-linecap="round" opacity=".5"/>
  <path d="M29 53 Q46 58 67 53" fill="none" stroke="${p.dark}" stroke-width="1.3" stroke-linecap="round" opacity=".5"/>
  <path d="M31 51 Q46 56 65 51" fill="none" stroke="${p.seam}" stroke-width="1" stroke-linecap="round" opacity=".7"/>
  <path d="M48 20 C55 20 63 24 65 31 C72 35 79 41 77 49 C75 57 71 61 73 70 C66 73 59 70 48 73 C37 70 30 73 23 70 C25 61 21 57 19 49 C17 41 24 35 31 31 C33 24 41 20 48 20 Z" fill="none" stroke="${p.seam}" stroke-width="1.1" stroke-dasharray="2.5 2"/>
  <ellipse cx="48" cy="22" rx="7.5" ry="3" fill="#ffeac9" stroke="${p.dark}" stroke-width="1.1"/>
  <path d="M44 23 L42 32 M52 23 L54 32" stroke="#ffeac9" stroke-width="1.5" stroke-linecap="round"/>`;
}

const componentArtMap: Record<string, () => string> = {
  herreria: herreriaArt,
  peleteria: peleteriaArt,
  sastreria: sastreriaArt,
  carpinteria: carpinteriaArt,
  ebanisteria: ebanisteriaArt,
  joyeria: joyeriaArt,
  alquimia: alquimiaArt,
  encantamiento: encantamientoArt,
  cocina: cocinaArt,
};

/** Materials made by a profession or raw artisan pelts have their own volumetric workshop artwork. */
export function craftingComponentDrawing(id: string): string | null {
  if (id.startsWith('cuero_')) {
    const tier = parseInt(id.slice(6), 10) || 0;
    const painted = craftingComponentPainting(`cuero-${tier}`) ?? craftingComponentPainting('cuero');
    if (painted) return painted;
    return `<svg x="1.2" y="1.2" width="21.6" height="21.6" viewBox="0 0 96 96">${cueroArt(tier)}</svg>`;
  }
  if (!id.startsWith('componente_')) return null;
  const job = id.slice(11, -2);
  const painted = craftingComponentPainting(job) ?? craftingComponentPainting(id);
  if (painted) return painted;
  const generator = componentArtMap[job];
  if (!generator) return null;
  return `<svg x="1.2" y="1.2" width="21.6" height="21.6" viewBox="0 0 96 96">${generator()}</svg>`;
}

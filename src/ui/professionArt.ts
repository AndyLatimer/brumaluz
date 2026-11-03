// Ilustraciones artesanales para la ventana de Profesiones (viewBox 64×64).
// Construidas por planos de material (hierro forjado, acero biselado, roble veteado,
// cuero cosido, cobre martillado, vidrio soplado y piedra facetada) con IDs únicos por instancia.

const INK = '#24160b';

function makeDefs(uid: string) {
  return `<defs>
    <linearGradient id="${uid}-steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f5f9fb"/>
      <stop offset=".45" stop-color="#bdcdd6"/>
      <stop offset="1" stop-color="#617582"/>
    </linearGradient>
    <linearGradient id="${uid}-iron" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8d9ca8"/>
      <stop offset=".5" stop-color="#586773"/>
      <stop offset="1" stop-color="#313b44"/>
    </linearGradient>
    <linearGradient id="${uid}-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff5c8"/>
      <stop offset=".45" stop-color="#e0b252"/>
      <stop offset="1" stop-color="#8a5b17"/>
    </linearGradient>
    <linearGradient id="${uid}-copper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fac5a7"/>
      <stop offset=".45" stop-color="#d4764a"/>
      <stop offset="1" stop-color="#7c3316"/>
    </linearGradient>
    <linearGradient id="${uid}-wood" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#cf9960"/>
      <stop offset=".5" stop-color="#966132"/>
      <stop offset="1" stop-color="#573214"/>
    </linearGradient>
    <linearGradient id="${uid}-leather" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e3a366"/>
      <stop offset=".5" stop-color="#ab662d"/>
      <stop offset="1" stop-color="#63320e"/>
    </linearGradient>
    <linearGradient id="${uid}-parch" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fcf5e3"/>
      <stop offset=".6" stop-color="#e7d0a5"/>
      <stop offset="1" stop-color="#b89158"/>
    </linearGradient>
    <linearGradient id="${uid}-heat" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff6b3"/>
      <stop offset=".5" stop-color="#f58b2e"/>
      <stop offset="1" stop-color="#ad2c11"/>
    </linearGradient>
  </defs>`;
}

const artwork: Record<string, (u: string) => string> = {
  // 1. Herrería: Yunque de herrero con cuerno sobre cepo de roble, hoja incandescente y martillo de forja golpeando desde arriba
  herreria: (u) => `
    <ellipse cx="32" cy="59" rx="25" ry="3.8" fill="#1a110a" opacity=".35"/>
    <!-- Cepo de roble con zunchos de hierro y remaches -->
    <path d="M15 46h34l2 12H13Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
    <path d="M22 46v12M32 46v12M42 46v12" stroke="#45250d" stroke-width="1.4" opacity=".75"/>
    <rect x="13.5" y="49.5" width="37" height="3.8" rx="1" fill="url(#${u}-iron)" stroke="${INK}" stroke-width="1.6"/>
    <circle cx="19" cy="51.4" r="1.1" fill="#dce6ed"/><circle cx="32" cy="51.4" r="1.1" fill="#dce6ed"/><circle cx="45" cy="51.4" r="1.1" fill="#dce6ed"/>
    <!-- Base escalonada y cintura forjada del yunque -->
    <path d="M12 46h40l-3.5-5H15.5Z" fill="url(#${u}-iron)" stroke="${INK}" stroke-width="2"/>
    <path d="M20 41c2-3.5 2-6.5 0-9.5h24c-2 3-2 6 0 9.5Z" fill="#43525e" stroke="${INK}" stroke-width="2"/>
    <path d="M24 41c1.2-3.2 1.2-6.2 0-9.5h10c-.6 3.3-.6 6.3 0 9.5Z" fill="#687b8a"/>
    <!-- Cuerpo superior del yunque: cuerno cónico izquierdo, mesa templada y talón con tas -->
    <path d="M3 26.5c5.5-2.8 11-3.8 16.5-3.8h36.5v6.5l-5 3.3H19.5c-5 0-11.5-2.2-16.5-6Z" fill="url(#${u}-iron)" stroke="${INK}" stroke-width="2"/>
    <path d="M19.5 22.7H56v3.6H19.5c-4.5 0-10.2-.8-15-1.6 4.8-1.4 10.2-2 15-2Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="1.7"/>
    <rect x="48" y="23.7" width="3.6" height="1.6" fill="#29333b"/>
    <path d="M20 24.3h25" stroke="#ffffff" stroke-width="1.3" opacity=".8"/>
    <!-- Hoja de espada al rojo vivo sobre el yunque sujeta con tenazas -->
    <path d="M5 18.5 17 22m-12 1.5 12-1" stroke="#39454f" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M16 21.2h23l4.5 1.7-4.5 1.6H16Z" fill="url(#${u}-heat)" stroke="#5c1807" stroke-width="1.5"/>
    <path d="M18 22.8h17" stroke="#fffbe0" stroke-width="1.3"/>
    <!-- Martillo de forja pesado descendiendo sobre la hoja incandescente -->
    <g transform="translate(33 13) rotate(18)">
      <path d="M-2-1.5 25-1.5c1.8 0 1.8 3.2 0 3.2L-2 1.7Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
      <path d="M2-.3h20" stroke="#ecc28d" stroke-width="1.1" opacity=".8"/>
      <path d="M-7.5-7.5 0-9.5 7.5-7.5v14.5c0 1-.8 1.8-1.8 1.8H-5.7c-1 0-1.8-.8-1.8-1.8Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="2"/>
      <path d="M-7.5 1h15v6H-7.5Z" fill="#7c8f9e"/>
      <path d="M-5-6.5v13" stroke="#ffffff" stroke-width="1.5" opacity=".88"/>
      <rect x="-8" y="-2.2" width="16" height="4.2" rx="1" fill="url(#${u}-iron)" stroke="${INK}" stroke-width="1.5"/>
      <circle cx="0" cy="-.1" r="1.3" fill="url(#${u}-gold)"/>
    </g>
    <!-- Esquirlas incandescentes del golpe -->
    <path d="m20 17-3.5-3m21 3.5 3.5-3M26 18.5l-2-3.2" stroke="#ffd275" stroke-width="1.9" stroke-linecap="round"/>
  `,

  // 2. Peletería: Gran piel curtida con costuras, cuchilla media luna (chifla) y rollo de cuero con hebilla
  peleteria: (u) => `
    <ellipse cx="32" cy="59" rx="24" ry="3.8" fill="#1a110a" opacity=".32"/>
    <!-- Piel de fiera curtida con cuello, cuatro extremidades y reborde de ante -->
    <path d="M18 6c4.2 3.2 7.8 3.2 12 0 4.2 3.2 7.8 3.2 12 0 2.5 5.5 6 9 9.5 10.5-3.2 5.5-3.2 12.5 0 18.5-3.8 2-6.5 6-7.8 11.5-4.8-2-9.5-1.5-13.7 2.5-4.2-4-8.9-4.5-13.7-2.5C15 41 12.3 37 8.5 35c3.2-6 3.2-13 0-18.5C12 15 15.5 11.5 18 6Z" fill="url(#${u}-leather)" stroke="${INK}" stroke-width="2.2"/>
    <!-- Plano interior de ante claro y pespunte artesanal -->
    <path d="M21 11c3.2 2 6 2 9 0 3 2 5.8 2 9 0 2 4 4.2 6.5 6.8 7.8-2.4 4.5-2.4 10 0 14.5-2.8 1.5-4.8 4.2-5.8 8.2-3.8-1.4-7.2-1-10 1.8-2.8-2.8-6.2-3.2-10-1.8-1-4-3-6.7-5.8-8.2 2.4-4.5 2.4-10 0-14.5 2.6-1.3 4.8-3.8 6.8-7.8Z" fill="#d99759" opacity=".62"/>
    <path d="M21 11c3.2 2 6 2 9 0 3 2 5.8 2 9 0 2 4 4.2 6.5 6.8 7.8-2.4 4.5-2.4 10 0 14.5-2.8 1.5-4.8 4.2-5.8 8.2-3.8-1.4-7.2-1-10 1.8-2.8-2.8-6.2-3.2-10-1.8-1-4-3-6.7-5.8-8.2 2.4-4.5 2.4-10 0-14.5 2.6-1.3 4.8-3.8 6.8-7.8Z" fill="none" stroke="#fae6c0" stroke-width="1.4" stroke-dasharray="2.8 2.2"/>
    <!-- Rollo de cuero curtido ceñido con correa y hebilla abajo a la izquierda -->
    <path d="M5 48c0-3.3 2.7-6 6-6h16c3.3 0 6 2.7 6 6s-2.7 6-6 6H11c-3.3 0-6-2.7-6-6Z" fill="#753b12" stroke="${INK}" stroke-width="2"/>
    <circle cx="11" cy="48" r="6" fill="#e09f63" stroke="${INK}" stroke-width="1.9"/>
    <path d="M11 44.7a3.3 3.3 0 1 1-2.8 1.6" fill="none" stroke="#54280a" stroke-width="1.4"/>
    <rect x="18" y="41.5" width="4.5" height="13" rx="1.2" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.5"/>
    <!-- Cuchilla media luna de peletero (chifla): disco semicircular macizo de acero con lomo recto, virola de latón y mango torneado -->
    <g transform="translate(43 40) rotate(-38)">
      <path d="M-14.5 1C-14.5-14.5 14.5-14.5 14.5 1Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="2.1"/>
      <path d="M-12-1.5c3.5-8.5 20.5-8.5 24 0" fill="none" stroke="#ffffff" stroke-width="1.6" opacity=".92"/>
      <path d="M-9 1h18" stroke="#5b6d7a" stroke-width="1.5"/>
      <rect x="-3" y="1" width="6" height="5.5" rx="1" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.5"/>
      <path d="M-4.2 6h8.4L3 17c-.2 1.6-5.8 1.6-6 0Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.9"/>
      <path d="M-1.2 8v7" stroke="#ebc08d" stroke-width="1.2"/>
    </g>
  `,

  // 3. Sastrería: Jubón entallado con cordaje dorado y cuello de lino sobre maniquí, tijeras de sastre y bobina con aguja
  sastreria: (u) => `
    <ellipse cx="32" cy="59" rx="23" ry="3.8" fill="#1a110a" opacity=".32"/>
    <!-- Mástil y peana torneada del maniquí -->
    <path d="M29 4h6v6h-6ZM30 46h4v10h-4Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.8"/>
    <path d="M22 55h20l2 3.5H20Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.8"/>
    <!-- Camisa interior de lino claro en el escote -->
    <polygon points="24,10 32,21 40,10" fill="url(#${u}-parch)" stroke="${INK}" stroke-width="1.5"/>
    <!-- Jubón entallado con hombreras, cintura ceñida y faldón acampanado -->
    <path d="M21 9 8 16l5 10.5 5.5-3.2L21 34l-4 13h30l-4-13 2.5-10.7 5.5 3.2L56 16 43 9c-2 4-5.5 7.5-11 9.5C26.5 16.5 23 13 21 9Z" fill="#824f99" stroke="${INK}" stroke-width="2.1"/>
    <path d="M32 18.5V47h15l-4-13 2.5-10.7 5.5 3.2L56 16 43 9c-2 4-5.5 7.5-11 9.5Z" fill="#5e3473"/>
    <!-- Solapas brocadas en oro, cordaje cruzado en el pecho y cinturón -->
    <path d="M21 9 28 22l4-3.5 4 3.5 7-13" fill="none" stroke="url(#${u}-gold)" stroke-width="2.2"/>
    <path d="m28 23 8 4m0-4-8 4m0 3 8 4m0-4-8 4" stroke="url(#${u}-gold)" stroke-width="1.3"/>
    <rect x="20" y="33" width="24" height="4.2" rx="1" fill="url(#${u}-leather)" stroke="${INK}" stroke-width="1.6"/>
    <rect x="29" y="32.2" width="6" height="5.8" rx="1" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.5"/>
    <path d="M20 43.5h24" stroke="url(#${u}-gold)" stroke-width="1.5" stroke-dasharray="3 2"/>
    <!-- Bobina de hilo carmesí a la izquierda con aguja de plata e hilo dorado -->
    <path d="M7 41h11v13H7Z" fill="#bf363e" stroke="${INK}" stroke-width="1.8"/>
    <path d="M7 44.5h11M7 47.5h11M7 50.5h11" stroke="#f58b91" stroke-width="1.1"/>
    <rect x="5.5" y="38.5" width="14" height="3.2" rx="1" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.6"/>
    <rect x="5.5" y="53.5" width="14" height="3.2" rx="1" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.6"/>
    <path d="M5 31 20 48" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M5 31 20 48" stroke="#eef6fa" stroke-width="2" stroke-linecap="round"/>
    <path d="M6 32c-2-5 5-7 8-2s6 6 9 3" fill="none" stroke="url(#${u}-gold)" stroke-width="1.5" stroke-linecap="round"/>
    <!-- Tijeras grandes de sastre abiertas a la derecha -->
    <g transform="translate(48 41) rotate(-22)">
      <path d="M0 0-12-17 0-3.5Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="1.7"/>
      <path d="M0 0 12-17 0-3.5Z" fill="#8fa2b0" stroke="${INK}" stroke-width="1.7"/>
      <circle cx="0" cy="-1.8" r="1.8" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1"/>
      <circle cx="-5.2" cy="7" r="4.5" fill="none" stroke="${INK}" stroke-width="3.8"/>
      <circle cx="-5.2" cy="7" r="4.5" fill="none" stroke="url(#${u}-gold)" stroke-width="2"/>
      <ellipse cx="5.5" cy="7.5" rx="4.5" ry="5.6" fill="none" stroke="${INK}" stroke-width="3.8"/>
      <ellipse cx="5.5" cy="7.5" rx="4.5" ry="5.6" fill="none" stroke="url(#${u}-gold)" stroke-width="2"/>
    </g>
  `,

  // 4. Carpintería: Viga de roble con ensamble y anillos, serrucho de carpintero con mango de madera, formón y viruta rizada
  carpinteria: (u) => `
    <ellipse cx="32" cy="59" rx="25" ry="3.8" fill="#1a110a" opacity=".32"/>
    <!-- Tablón macizo de roble en perspectiva con testa anillada y cola de milano -->
    <path d="M5 41 41 26l17 8.5-36 15Z" fill="#dead70" stroke="${INK}" stroke-width="2"/>
    <path d="M5 41l17 8.5v8.5L5 49.5Z" fill="#f2d6a7" stroke="${INK}" stroke-width="2"/>
    <path d="M22 49.5 58 34.5V43L22 58Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
    <path d="M9 46c2.5-1.5 5.5-.5 8 2.5M28 51l24-10m-18 11.5 16-6.5" fill="none" stroke="#593314" stroke-width="1.3"/>
    <!-- Serrucho de carpintero cortando en diagonal con hoja de acero dentada y empuñadura cerrada -->
    <g transform="translate(31 24) rotate(-20)">
      <path d="M-24-4 14-7v11L-24 6Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="2"/>
      <path d="M-22-2H12" stroke="#ffffff" stroke-width="1.4" opacity=".85"/>
      <path d="m-22 6 2.5-2.5 1 2.5 2.5-2.5 1 2.5 2.5-2.5 1 2.5 2.5-2.5 1 2.5 2.5-2.5 1 2.5 2.5-2.5 1 2.5 2.5-2.5 1 2.5 2.5-2.5 1 2.5 2.5-2.5 1 2.5" fill="none" stroke="#36434d" stroke-width="1.2"/>
      <!-- Mango ergonómico de madera con tornillos de latón -->
      <path d="M12-9h11c2.5 0 4 2 4 4.5v10c0 2.5-1.5 4.5-4 4.5H13l-2-4v-11Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
      <rect x="16.5" y="-4" width="4.5" height="9" rx="2" fill="#2c2219" stroke="${INK}" stroke-width="1.5"/>
      <circle cx="14" cy="-3" r="1.2" fill="url(#${u}-gold)"/><circle cx="14" cy="3" r="1.2" fill="url(#${u}-gold)"/>
    </g>
    <!-- Viruta rizada de madera recién cepillada en primer plano -->
    <path d="M35 45c-5-2-7-7-3.5-10.5 3-3 8-.5 6 3.5-1.5 2.5-4.5 1.5-4.5-1" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/>
    <path d="M35 45c-5-2-7-7-3.5-10.5 3-3 8-.5 6 3.5-1.5 2.5-4.5 1.5-4.5-1" fill="none" stroke="#fae6bd" stroke-width="2" stroke-linecap="round"/>
  `,

  // 5. Ebanistería: Aparador noble con taracea clara, puertas arqueadas, herrajes de latón, cajón y escuadra
  ebanisteria: (u) => `
    <ellipse cx="32" cy="59" rx="24" ry="3.8" fill="#1a110a" opacity=".34"/>
    <!-- Cuerpo del mueble en 3/4 con costado sombreado -->
    <path d="M10 13h32v38H10Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
    <path d="M42 13 52 9v37l-10 5Z" fill="#4f2c11" stroke="${INK}" stroke-width="2"/>
    <!-- Cornisa superior tallada con frontón y moldura clara -->
    <path d="M7 10h37l10-4H18Z" fill="#e6b87e" stroke="${INK}" stroke-width="1.9"/>
    <path d="M7 10h37v4H7Z" fill="#b07640" stroke="${INK}" stroke-width="1.9"/>
    <path d="M44 10 54 6v4l-10 4Z" fill="#47260d" stroke="${INK}" stroke-width="1.9"/>
    <!-- Patas cabriolé / torneadas -->
    <path d="M11 51h5l-1 6.5h-4Zm25 0h5l-1 6.5h-4Zm11-5h4.5l-1 6h-3.5Z" fill="#4f2c11" stroke="${INK}" stroke-width="1.7"/>
    <!-- Puertas con paneles de taracea clara (alto contraste sobre la madera de nogal) -->
    <rect x="13.5" y="16.5" width="11.5" height="22.5" rx="1" fill="#542f13" stroke="#e0ad6e" stroke-width="1.4"/>
    <rect x="27" y="16.5" width="11.5" height="22.5" rx="1" fill="#542f13" stroke="#e0ad6e" stroke-width="1.4"/>
    <path d="M15.5 21a3.8 3.8 0 0 1 7.5 0v15.5h-7.5Zm13.5 0a3.8 3.8 0 0 1 7.5 0v15.5H29Z" fill="url(#${u}-parch)" stroke="#8c5a2b" stroke-width="1.2"/>
    <!-- Celosía decorativa y tiradores de latón -->
    <path d="m15.5 23 7.5 7.5m0-7.5-7.5 7.5M29 23l7.5 7.5m0-7.5L29 30.5" stroke="#a6723a" stroke-width="1.1"/>
    <circle cx="23" cy="29" r="1.5" fill="url(#${u}-gold)" stroke="${INK}" stroke-width=".9"/>
    <circle cx="29" cy="29" r="1.5" fill="url(#${u}-gold)" stroke="${INK}" stroke-width=".9"/>
    <!-- Cajón inferior con tiradores dorados -->
    <rect x="13.5" y="42" width="25" height="6" rx="1" fill="#693b18" stroke="#e0ad6e" stroke-width="1.3"/>
    <circle cx="20" cy="45" r="1.4" fill="url(#${u}-gold)" stroke="${INK}" stroke-width=".8"/>
    <circle cx="32" cy="45" r="1.4" fill="url(#${u}-gold)" stroke="${INK}" stroke-width=".8"/>
    <!-- Escuadra de ebanista de latón y acero -->
    <path d="M43 56V37h15v4.5H47.5V56Z" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.8"/>
    <path d="M47 41.5h10" stroke="#fff9d6" stroke-width="1.1"/>
  `,

  // 6. Joyería: Sortija real de oro con engaste de corona, zafiro tallado en facetas y colgante de rubí
  joyeria: (u) => `
    <ellipse cx="32" cy="59" rx="23" ry="3.8" fill="#1a110a" opacity=".34"/>
    <!-- Aro de oro labrado en perspectiva 3D con interior sombreado -->
    <ellipse cx="29" cy="41.5" rx="17.5" ry="14" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="2.2"/>
    <ellipse cx="29" cy="43" rx="11" ry="8" fill="#291a0c" stroke="${INK}" stroke-width="2"/>
    <path d="M18 41.5a11 8 0 0 1 22 0 11 6 0 0 0-22 0Z" fill="#825315"/>
    <!-- Gemas laterales de esmeralda en los hombros del anillo -->
    <polygon points="13,38 17,36 18,41 14,43" fill="#35a862" stroke="${INK}" stroke-width="1.3"/>
    <polygon points="45,38 41,36 40,41 44,43" fill="#35a862" stroke="${INK}" stroke-width="1.3"/>
    <!-- Chatón de oro con garras que nacen del anillo y abrazan la gema -->
    <path d="M18 27h22l-3.5 6.5h-15Z" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.9"/>
    <!-- Zafiro octogonal tallado en facetas asentado dentro del engaste -->
    <polygon points="20,10 38,10 45,18 29,30 13,18" fill="#1f7eb3" stroke="${INK}" stroke-width="2.2"/>
    <polygon points="20,10 38,10 34,17 24,17" fill="#caf6ff"/>
    <polygon points="13,18 20,10 24,17" fill="#73daf7"/>
    <polygon points="38,10 45,18 34,17" fill="#39a3d6"/>
    <polygon points="13,18 24,17 29,30" fill="#4ab8e6"/>
    <polygon points="24,17 34,17 29,30" fill="#1b6b9c"/>
    <polygon points="34,17 45,18 29,30" fill="#104569"/>
    <path d="M20 10 24 17h10l4-7M13 18h32M24 17l5 13 5-13" fill="none" stroke="#ebfcff" stroke-width="1.1" opacity=".88"/>
    <!-- Garras de oro abrazando las aristas del zafiro -->
    <path d="M12.5 16.5 17 20.5m29.5-4L42 20.5M20 26l2.5 5m13.5-5-2.5 5" stroke="url(#${u}-gold)" stroke-width="3" stroke-linecap="round"/>
    <!-- Colgante de rubí engastado en oro con cadena a la derecha -->
    <path d="M47 34c4-3 9-1 10 4" fill="none" stroke="url(#${u}-gold)" stroke-width="2" stroke-dasharray="2.5 1.8"/>
    <polygon points="51,40 57,40 60,46 54,55 48,46" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.8"/>
    <polygon points="52,42 56,42 58,46 54,52 50,46" fill="#d92b3b" stroke="${INK}" stroke-width="1.2"/>
    <polygon points="52,42 56,42 54,46" fill="#ffb8c0"/>
  `,

  // 7. Alquimia: Matraz de vidrio sobre hornillo, elixir esmeralda burbujeante, serpentín de cobre y redoma carmesí
  alquimia: (u) => `
    <ellipse cx="32" cy="59" rx="25" ry="3.8" fill="#1a110a" opacity=".34"/>
    <!-- Trípode de hierro y llama de hornillo -->
    <path d="M13 50h30M16 50l-3.5 7m27.5-7 3.5 7M28 50v7" stroke="#39454f" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M28 55.5c-3-1-4-4-2-6 1.5 1.5 2-1 2-2.5 1.5 1.5 3 2.5 2.5 5 .5-.5 1.5-1 1.5-2 1 2.5-.5 5.5-4 5.5Z" fill="url(#${u}-heat)"/>
    <!-- Matraz esférico con tapón de corcho y boca reforzada -->
    <path d="M23 7.5h10v4.5h-8Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.7"/>
    <path d="M22 12h12v8.5c8.5 3.5 13.5 11 12 19.5-1.5 7.5-8 12-18 12s-16.5-4.5-18-12c-1.5-8.5 3.5-16 12-19.5Z" fill="#dff4f7" fill-opacity=".45" stroke="${INK}" stroke-width="2.1"/>
    <!-- Elixir esmeralda con menisco iluminado y burbujas -->
    <path d="M12 35.5c4 2.5 10 3.5 16 3.5s12-1 16-3.5c.5 6-4 14-16 14s-16.5-8-16-14Z" fill="#217844" stroke="#124526" stroke-width="1.2"/>
    <ellipse cx="28" cy="35.5" rx="16" ry="3.6" fill="#6ee092" stroke="#1b6137" stroke-width="1.2"/>
    <circle cx="23" cy="44" r="2.3" fill="#befad0"/><circle cx="31" cy="42" r="1.7" fill="#befad0"/><circle cx="27" cy="38.5" r="1.3" fill="#ffffff"/>
    <circle cx="28" cy="27.5" r="1.5" fill="#92f0b0"/><circle cx="30" cy="21.5" r="1.1" fill="#befad0"/>
    <!-- Brillo curvo del cristal y collarín de latón -->
    <path d="M15 30.5c1-4 4-7 7.5-8.5M14.5 39c.5 3.5 3 6.5 6.5 8" fill="none" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" opacity=".88"/>
    <path d="M21 12h14" stroke="url(#${u}-gold)" stroke-width="2.5"/>
    <!-- Serpentín de destilación de cobre goteando en una redoma rubí -->
    <path d="M30 8.5c8-4 19-1.5 21 6.5 1 4 0 8.5 0 11.5" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M30 8.5c8-4 19-1.5 21 6.5 1 4 0 8.5 0 11.5" fill="none" stroke="url(#${u}-copper)" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M51 29.5c1.8 2.2 2.2 4 2.2 5.2a2.2 2.2 0 0 1-4.4 0c0-1.2.4-3 2.2-5.2Z" fill="#6ee092" stroke="${INK}" stroke-width="1.3"/>
    <!-- Redoma secundaria con pócima carmesí abajo a la derecha -->
    <path d="M48 39h6v4l4 7.5a3 3 0 0 1-2.6 4.5H46.6a3 3 0 0 1-2.6-4.5L48 43Z" fill="#dff4f7" fill-opacity=".6" stroke="${INK}" stroke-width="1.8"/>
    <path d="M45.5 48.5h11l1.5 3a2 2 0 0 1-1.8 2.5h-10.4a2 2 0 0 1-1.8-2.5Z" fill="#d43545"/>
  `,

  // 8. Encantamiento: Pergamino rúnico en perspectiva, sello astrolábico dorado, cristal de éter tallado y pluma de escribano
  encantamiento: (u) => `
    <ellipse cx="32" cy="59" rx="24" ry="3.8" fill="#1a110a" opacity=".32"/>
    <!-- Rodillos de madera noble con remates de oro -->
    <g transform="rotate(-6 30 31)">
      <rect x="7" y="7" width="42" height="4.8" rx="2.2" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.9"/>
      <rect x="7" y="50" width="42" height="4.8" rx="2.2" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.9"/>
      <circle cx="7" cy="9.4" r="2.7" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.4"/>
      <circle cx="49" cy="9.4" r="2.7" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.4"/>
      <circle cx="7" cy="52.4" r="2.7" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.4"/>
      <circle cx="49" cy="52.4" r="2.7" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.4"/>
      <!-- Pergamino desplegado con bordes dobles -->
      <path d="M11 11.8h34v38.2H11Z" fill="url(#${u}-parch)" stroke="${INK}" stroke-width="2"/>
      <path d="M14 14.8h28v32.2H14Z" fill="none" stroke="#b08446" stroke-width="1.1"/>
      <!-- Círculo rúnico y hexagrama arcano grabado -->
      <circle cx="28" cy="28.5" r="11.5" fill="#522975" fill-opacity=".2" stroke="#683394" stroke-width="1.6"/>
      <polygon points="28,18 37,33.5 19,33.5" fill="none" stroke="#7d3eab" stroke-width="1.4"/>
      <polygon points="28,39 37,23.5 19,23.5" fill="none" stroke="url(#${u}-gold)" stroke-width="1.4"/>
      <path d="M17 43.5h15m-15 3h10" stroke="#785224" stroke-width="1.6" stroke-linecap="round"/>
      <!-- Cristal rúnico de amatista facetado en el centro -->
      <polygon points="28,20 33.5,24.5 33.5,32.5 28,37 22.5,32.5 22.5,24.5" fill="#8b42c2" stroke="${INK}" stroke-width="1.9"/>
      <polygon points="28,20 33.5,24.5 28,28.5 22.5,24.5" fill="#e0b3ff"/>
      <path d="M28 23.5v10m-2.8-7 2.8 2.5 2.8-2.5" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
    </g>
    <!-- Pluma de cálamo con barbas detalladas a la derecha -->
    <path d="M37 48C40 34 47 19 58 9c1.5 11-3.5 23-14 32l-7 7Z" fill="#f7eed7" stroke="${INK}" stroke-width="1.9"/>
    <path d="M43 42c5-6 9.5-15 15-33-7.5 7.5-12.5 17-16 26" fill="#9c5cc4"/>
    <path d="M34 51 56 12" stroke="url(#${u}-gold)" stroke-width="1.8" stroke-linecap="round"/>
  `,

  // 9. Cocina: Caldero de cobre martillado sobre lumbre, cucharón de madera, hogaza de pan dorada y vapor
  cocina: (u) => `
    <ellipse cx="32" cy="59" rx="25" ry="3.8" fill="#1a110a" opacity=".34"/>
    <!-- Leños y fuego vivo bajo el caldero -->
    <path d="M11 54 43 47M13 47l30 7" stroke="url(#${u}-wood)" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M19 52c0-5 2.8-8 4.8-10 1 3 3 3 4.8-2 2 4 3.8 4 4.8 1 2 3 4.6 6 4.6 11Z" fill="url(#${u}-heat)" stroke="#6e1b07" stroke-width="1.3"/>
    <!-- Asas laterales y cucharón de madera -->
    <path d="M9 26c-4.5 0-5.5 6.5-1 7.5m39-7.5c4.5 0 5.5 6.5 1 7.5" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M9 26c-4.5 0-5.5 6.5-1 7.5m39-7.5c4.5 0 5.5 6.5 1 7.5" fill="none" stroke="url(#${u}-iron)" stroke-width="2" stroke-linecap="round"/>
    <path d="M35 21 49 6c1.5-1.5 4 .5 2.5 2.5L39 22Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.8"/>
    <!-- Caldero de cobre martillado -->
    <path d="M10 21h36l-2 13c-1.5 8.5-8 14.5-16 14.5S13.5 42.5 12 34Z" fill="url(#${u}-copper)" stroke="${INK}" stroke-width="2.1"/>
    <path d="M14 27c1 7.5 5.5 13 13 15" fill="none" stroke="#ffd8bf" stroke-width="2" stroke-linecap="round" opacity=".75"/>
    <ellipse cx="28" cy="21" rx="19" ry="5" fill="url(#${u}-iron)" stroke="${INK}" stroke-width="2"/>
    <ellipse cx="28" cy="21.3" rx="15.8" ry="3.4" fill="#e39f3b" stroke="#69390c" stroke-width="1.1"/>
    <path d="M19 21c2-2.8 5.5-2.8 7.5 0-2 1.8-5.5 1.8-7.5 0Z" fill="#5c9e49" stroke="${INK}" stroke-width="1"/>
    <circle cx="31" cy="22" r="2" fill="#d94b31" stroke="${INK}" stroke-width="1"/>
    <!-- Hogaza de pan recién horneado con cortes en primer plano a la derecha -->
    <path d="M36 53c-1-6 4-11 11-11s12 5 11 11c-4 2.5-18 2.5-22 0Z" fill="#d99648" stroke="${INK}" stroke-width="1.9"/>
    <path d="M43 44.5l2 4m4-4.5 2 4m4-3 1.5 3" stroke="#fff0be" stroke-width="1.7" stroke-linecap="round"/>
    <!-- Vapor aromático -->
    <path d="M19 14c-2-2.8 1.5-5.5 0-8.5m9 7.5c-2-3 2-6 0-9m9 9c-1.8-2.5 1.5-5 0-7.5" fill="none" stroke="#fff5db" stroke-width="2" stroke-linecap="round" opacity=".88"/>
  `,

  // 10. Minero: Filón de roca madre con cristales de cuarzo azul y pepitas de cobre a la izquierda, golpeado por un pico de minero forjado a la derecha
  minero: (u) => `
    <ellipse cx="32" cy="59" rx="26" ry="3.8" fill="#1a110a" opacity=".36"/>
    <!-- Peñasco de roca facetada en la mitad inferior izquierda -->
    <polygon points="4,55 7,34 21,26 38,33 43,51 36,57 9,57" fill="#6d6b61" stroke="${INK}" stroke-width="2.2"/>
    <polygon points="7,34 21,26 25,40 11,45" fill="#999587"/>
    <polygon points="21,26 38,33 36,57 25,40" fill="#4f4d45"/>
    <path d="M7 34 11 45 9 57M21 26l4 14 11 17" fill="none" stroke="#33312b" stroke-width="1.4"/>
    <!-- Cristales facetados de azurita/cuarzo brotando de la roca -->
    <polygon points="9,36 12,17 20,14 22,33 14,38" fill="#3da2c4" stroke="${INK}" stroke-width="2"/>
    <polygon points="12,17 20,14 17,34 9,36" fill="#b0f0ff"/>
    <path d="M12 17 17 34l5-1" fill="none" stroke="#ffffff" stroke-width="1.1"/>
    <polygon points="22,33 27,19 34,22 31,36" fill="#287fa1" stroke="${INK}" stroke-width="1.9"/>
    <polygon points="27,19 31,21 27,34 22,33" fill="#82e0fa"/>
    <!-- Veta de mineral de cobre en la base del peñasco -->
    <polygon points="12,45 20,40 26,45 22,54 13,53" fill="url(#${u}-copper)" stroke="${INK}" stroke-width="1.8"/>
    <polygon points="14,46 20,42 22,47" fill="#ffe0bf"/>
    <!-- Pico de minero clásico en diagonal (cabeza simétrica de doble punta perpendicular al mango) -->
    <g transform="translate(43 20) rotate(36)">
      <!-- Mango de fresno que baja en diagonal hacia la izquierda con virola inferior -->
      <path d="M-2.4-6.5h4.8L2.8 36c0 2.2-5.6 2.2-5.6 0Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
      <path d="M-.5-4v38" stroke="#edd5ad" stroke-width="1.2" opacity=".82"/>
      <rect x="-3" y="32.5" width="6" height="3.8" rx="1" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.4"/>
      <!-- Cabeza de acero forjado doblemente arqueada y simétrica -->
      <path d="M-23 8.5C-16-3-7.5-5.2 0-5.2S16-3 23 8.5c-6.5-4-14-5.2-23-5.2S-16.5 4.5-23 8.5Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="2.1"/>
      <path d="M-19.5 5C-13.5-1.8-6.5-3.2 0-3.2S13.5-1.8 19.5 5" fill="none" stroke="#ffffff" stroke-width="1.5" opacity=".9"/>
      <!-- Abrazadera central de hierro remachada (ojo del pico) -->
      <rect x="-5" y="-5.5" width="10" height="8" rx="1.4" fill="url(#${u}-iron)" stroke="${INK}" stroke-width="1.9"/>
      <circle cx="0" cy="-1.5" r="1.5" fill="url(#${u}-gold)"/>
    </g>
    <!-- Chispas de impacto sobre la veta de cuarzo -->
    <path d="m18 15-4-2.5m2.5 6.5-4.5.5" stroke="#ffe485" stroke-width="1.8" stroke-linecap="round"/>
  `,

  // 11. Leñador: Tocón de roble con corteza, raíces y anillos claros, gran hacha barbada clavada y leño apilado
  lenador: (u) => `
    <ellipse cx="32" cy="59" rx="26" ry="3.8" fill="#1a110a" opacity=".35"/>
    <!-- Leño cortado apilado a la izquierda -->
    <path d="M5 43 21 36l8 5-16 8Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.8"/>
    <ellipse cx="8.5" cy="46" rx="4.5" ry="5.5" fill="#f0d2a0" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="8.5" cy="46" r="2.4" fill="none" stroke="#9e6b3b" stroke-width="1.1"/>
    <!-- Tocón de roble con raíces y corteza surcada -->
    <path d="M15 36h29l3 15 4 5.5H10l4-5.5Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2.1"/>
    <path d="M20 38v17M26.5 39v17M33.5 39v17M40 38v17" stroke="#42240d" stroke-width="1.6"/>
    <!-- Testa del tocón con anillos concéntricos claros -->
    <ellipse cx="29.5" cy="36" rx="14.5" ry="5.8" fill="#f5dba8" stroke="${INK}" stroke-width="2"/>
    <ellipse cx="29.5" cy="36" rx="10" ry="3.8" fill="none" stroke="#b57e42" stroke-width="1.3"/>
    <ellipse cx="29.5" cy="36" rx="5.2" ry="1.9" fill="none" stroke="#8c5b28" stroke-width="1.2"/>
    <polygon points="21,32.5 34,35.5 31,39 20,35.5" fill="#522d0f" stroke="${INK}" stroke-width="1.2"/>
    <!-- Gran hacha barbada de leñador: mango en eje Y y pala proyectada en eje -X con filo curvo paralelo al mango -->
    <g transform="translate(36 15.5) rotate(-36)">
      <!-- Mango de fresno a lo largo del eje Y -->
      <path d="M-2.3-4.5h4.6L2.8 31c0 2.2-5.6 2.2-5.6 0Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2.1"/>
      <path d="M-.5-2v31" stroke="#f5d3a2" stroke-width="1.2" opacity=".82"/>
      <!-- Pala barbada de acero que se proyecta hacia la izquierda (-X) con filo curvo paralelo al mango (Y) -->
      <path d="M-3-3.8C-9.5-4.2-15-4.8-19.5-3c-2.6 6.5-1.8 13.5 3.2 19.5 4.8-1.5 9.5-6.2 13.3-10.5Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="2.1"/>
      <path d="M-19.5-3c-2.6 6.5-1.8 13.5 3.2 19.5l2.8-2.2c-4-5.2-4.6-10.8-2.6-16.2Z" fill="#ffffff" opacity=".9"/>
      <!-- Ojo/cabeza de hierro forjado que abraza el mango en (0,0) -->
      <rect x="-4" y="-4.2" width="8.5" height="9.2" rx="1.3" fill="url(#${u}-iron)" stroke="${INK}" stroke-width="1.9"/>
      <circle cx=".2" cy=".4" r="1.4" fill="url(#${u}-gold)"/>
    </g>
    <!-- Brote de hojas verdes de roble en el costado del tocón -->
    <path d="M44 45c5-4 11-3 13 1-4 4-9 4-13-1Z" fill="#5da146" stroke="${INK}" stroke-width="1.6"/>
  `,

  // 12. Recolector: Hoz creciente de herborista abrazando un ramillete de hierbas, flores silvestres, seta y bayas
  recolector: (u) => `
    <ellipse cx="32" cy="59" rx="24" ry="3.8" fill="#1a110a" opacity=".32"/>
    <!-- Tallos verdes atados en la base -->
    <path d="M21 55 29 17M25 55 38 21M18 54 17 23" stroke="#426b32" stroke-width="2.6" stroke-linecap="round"/>
    <!-- Hojas medicinales con nervaduras claras -->
    <path d="M24 38C11 37 6 26 11 15c10.5 2 15.5 10.5 13 23Z" fill="#49873e" stroke="${INK}" stroke-width="2"/>
    <path d="M11 15c3 7.5 7 14.5 13 23M14 22l5.5 2m-4.5 5 6.5 2" fill="none" stroke="#bef0a1" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M26 33c2-12.5 10.5-19.5 22-18.5 1 11.5-7.5 18.5-22 18.5Z" fill="#6cb553" stroke="${INK}" stroke-width="2"/>
    <path d="M48 14.5C41 20.5 33.5 26.5 26 33m13.5-11.5-5.5 1m-1 5-6 1" fill="none" stroke="#dcfac2" stroke-width="1.3" stroke-linecap="round"/>
    <!-- Flor silvestre de cinco pétalos y espiga dorada -->
    <path d="M27 23c-3-4-1-9.5 3-11.5 2 4 1 9.5-3 11.5Zm3.5-6c2-4 6-6 9.5-4-1 4-5.5 6-9.5 4Z" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="22.5" cy="13.5" r="4.8" fill="#5aa6de" stroke="${INK}" stroke-width="1.6"/>
    <circle cx="22.5" cy="13.5" r="1.9" fill="#fff2a8"/>
    <!-- Seta roja moteada y bayas silvestres -->
    <path d="M11.5 45h5.5v9.5h-5.5Z" fill="#efe0bf" stroke="${INK}" stroke-width="1.7"/>
    <path d="M5.5 46c0-6.5 4.8-10 9-10s9 3.5 9 10Z" fill="#c94b32" stroke="${INK}" stroke-width="1.9"/>
    <circle cx="11.5" cy="41.5" r="1.4" fill="#fff5df"/><circle cx="17" cy="43" r="1.2" fill="#fff5df"/>
    <circle cx="28.5" cy="48.5" r="3.6" fill="#cf2933" stroke="${INK}" stroke-width="1.6"/>
    <circle cx="34.5" cy="51.5" r="3.2" fill="#a81d26" stroke="${INK}" stroke-width="1.6"/>
    <circle cx="27.5" cy="47.3" r="1" fill="#ffc2c6"/>
    <!-- Hoz de herborista en primer plano con hoja curva biselada y mango de madera -->
    <path d="M36 45.5c12-1 19.5-9.5 19.5-20C55.5 15.5 47.5 8 36.5 8c15 3.8 14.5 27 0 32.5Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="2.1"/>
    <path d="M43 11.5c8.5 4.2 10.5 14.5 5.5 23" fill="none" stroke="#ffffff" stroke-width="1.5" opacity=".9"/>
    <rect x="32.5" y="42" width="6" height="4.2" rx="1" transform="rotate(28 35.5 44)" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.5"/>
    <path d="M33.5 45 26 56.5c-1.1 1.7-4 0-3-1.9L30.5 43Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
  `,

  // Utilidades y navegación
  // Mis herramientas: Martillo de forja y llave/tenaza cruzados con medallón de cuero y latón
  tools: (u) => `
    <ellipse cx="32" cy="59" rx="23" ry="3.8" fill="#1a110a" opacity=".32"/>
    <path d="M11 51 47 15l3.8 3.8L14.8 54.8Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
    <path d="M41 9.5c-5.5 3-5.5 10.5 0 14.5l9.5 2 6-8.5-6 2.5-4.5-4.5 2.5-6Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="2"/>
    <path d="M17 15 53 51l-3.8 3.8L13.2 18.8Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
    <path d="M7.5 18 19 6.5l7.5 7.5L15 25.5Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="2"/>
    <path d="M10.5 17 19 8.5" stroke="#ffffff" stroke-width="1.5" opacity=".88"/>
    <circle cx="32" cy="33" r="7" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="2"/>
    <circle cx="32" cy="33" r="3.2" fill="url(#${u}-leather)" stroke="${INK}" stroke-width="1.5"/>
  `,

  // Encantar un arma: Espada forjada grabada con runas y anillos arcanos dorados
  enchants: (u) => `
    <ellipse cx="32" cy="59" rx="22" ry="3.8" fill="#1a110a" opacity=".3"/>
    <path d="M10 54 19 45" stroke="url(#${u}-wood)" stroke-width="5.2" stroke-linecap="round"/>
    <circle cx="9.5" cy="54.5" r="3.4" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.7"/>
    <path d="M12 36 28 52l3.8-3.8L15.8 32.2Z" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="2"/>
    <polygon points="18,35 46,7 56.5,7.5 55,18 27,46" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="2.1"/>
    <polygon points="22.5,40.5 55,18 56.5,7.5 27,37" fill="#7c52ab" opacity=".68"/>
    <path d="M23 39 51.5 10.5" stroke="#f3dcff" stroke-width="1.9" stroke-dasharray="3.2 2.5"/>
    <path d="M24 22c8.5-3 18.5 2 19.5 10m-25.5 2c8.5-3 18.5 2 19.5 10" fill="none" stroke="url(#${u}-gold)" stroke-width="2.1" stroke-linecap="round"/>
  `,

  // Mi casa: Cabaña artesana de Brumaluz con tejado, chimenea de piedra, puerta de roble y ventana cálida
  furniture: (u) => `
    <ellipse cx="32" cy="59" rx="25" ry="3.8" fill="#1a110a" opacity=".32"/>
    <rect x="42" y="9.5" width="8.5" height="16.5" fill="#737980" stroke="${INK}" stroke-width="1.9"/>
    <rect x="40.5" y="8" width="11.5" height="3.2" fill="#949ba3" stroke="${INK}" stroke-width="1.6"/>
    <path d="M11 26 32 9.5 53 26v29.5H11Z" fill="#ebd7b0" stroke="${INK}" stroke-width="2.1"/>
    <path d="M11 47h42v8.5H11Z" fill="#7d786f" stroke="${INK}" stroke-width="1.8"/>
    <path d="M11 27h42M32 10.5V27" stroke="url(#${u}-wood)" stroke-width="2.2"/>
    <path d="M5 28 32 6.5 59 28l-4 4.5L32 13 9 32.5Z" fill="url(#${u}-copper)" stroke="${INK}" stroke-width="2.1"/>
    <path d="M27 55.5V38a6 6 0 0 1 12 0v17.5Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.9"/>
    <circle cx="36.5" cy="46.5" r="1.4" fill="url(#${u}-gold)"/>
    <rect x="15" y="33" width="9" height="10" rx="1.5" fill="#ffe188" stroke="${INK}" stroke-width="1.8"/>
    <path d="M19.5 33v10M15 38h9" stroke="${INK}" stroke-width="1.4"/>
  `,

  // Entregas: Cajón de mercader reforzado con cuerdas, sello de lacre y albarán
  deliveries: (u) => `
    <ellipse cx="32" cy="59" rx="24" ry="3.8" fill="#1a110a" opacity=".32"/>
    <polygon points="32,8 56,20 32,32 8,20" fill="#e3c591" stroke="${INK}" stroke-width="2"/>
    <polygon points="8,20 32,32 32,56 8,44" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
    <polygon points="32,32 56,20 56,44 32,56" fill="#693c19" stroke="${INK}" stroke-width="2"/>
    <path d="M8 28l24 12 24-12M20 14l24 12v24M44 14 20 26v24" fill="none" stroke="url(#${u}-gold)" stroke-width="2.1"/>
    <circle cx="32" cy="32" r="5.5" fill="#bf242d" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="32" cy="32" r="2.4" fill="url(#${u}-gold)"/>
    <rect x="13" y="33" width="7.2" height="9.2" rx="1" transform="skewY(26)" fill="url(#${u}-parch)" stroke="${INK}" stroke-width="1.4"/>
  `,

  // Guía: Manual del maestro con brújula dorada
  guide: (u) => `
    <ellipse cx="32" cy="59" rx="22" ry="3.8" fill="#1a110a" opacity=".28"/>
    <rect x="9" y="8" width="36" height="46" rx="3" fill="url(#${u}-parch)" stroke="${INK}" stroke-width="2.1"/>
    <path d="M15 16h19m-19 6h15m-15 6h11" stroke="#8a6230" stroke-width="1.9" stroke-linecap="round"/>
    <circle cx="40" cy="40" r="14.5" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="2.1"/>
    <circle cx="40" cy="40" r="10.8" fill="#223340" stroke="${INK}" stroke-width="1.5"/>
    <polygon points="40,29.5 43.2,39 40,37 36.8,39" fill="#e3463c"/>
    <polygon points="40,50.5 43.2,41 40,43 36.8,41" fill="#dce7ee"/>
    <circle cx="40" cy="40" r="2.2" fill="url(#${u}-gold)"/>
  `,

  // Recetas: Libro de oficio abierto con páginas de pergamino y marcapáginas
  recipes: (u) => `
    <ellipse cx="32" cy="59" rx="25" ry="3.8" fill="#1a110a" opacity=".3"/>
    <path d="M6 13c8-4 18-2 26 3 8-5 18-7 26-3v39c-8-4-18-2-26 3-8-5-18-7-26-3Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2.1"/>
    <path d="M10 11c7-3 15-1 22 4 7-5 15-7 22-4v36c-7-3-15-1-22 4-7-5-15-7-22-4Z" fill="url(#${u}-parch)" stroke="${INK}" stroke-width="1.9"/>
    <path d="M32 15v36" stroke="#785122" stroke-width="2"/>
    <path d="M15 21h11m-11 6h11m-11 6h8m16-12h11m-11 6h11m-11 6h8" stroke="#855e2e" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M41 11h6v18.5l-3-3.5-3 3.5Z" fill="#bf242d" stroke="${INK}" stroke-width="1.5"/>
  `,

  // Trabajos: Banco de taller con mordaza, pieza de metal y martillo bien unido golpeando la pieza
  jobs: (u) => `
    <ellipse cx="32" cy="59" rx="25" ry="3.8" fill="#1a110a" opacity=".32"/>
    <!-- Mesa de banco de carpintero/herrero -->
    <path d="M6 36h52v8H6Zm6 8h6.5v12H12Zm33.5 0H52v12h-6.5Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2.1"/>
    <path d="M15 48h34v4H15Z" fill="#5c3415" stroke="${INK}" stroke-width="1.7"/>
    <!-- Mordaza de hierro y lingote/pieza dorada sujeta sobre el banco -->
    <rect x="10" y="29" width="12" height="7" rx="1" fill="url(#${u}-iron)" stroke="${INK}" stroke-width="1.9"/>
    <path d="M18 30h17l3 3-3 3H18Z" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.8"/>
    <!-- Martillo de artesano con cabeza maciza y mango unidos golpeando la pieza -->
    <g transform="translate(33 16) rotate(26)">
      <path d="M-2-1.6H23c1.8 0 1.8 3.2 0 3.2H-2Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="2"/>
      <path d="M-7-7 0-8.8 7-7v13.5c0 1-.8 1.8-1.8 1.8H-5.2c-1 0-1.8-.8-1.8-1.8Z" fill="url(#${u}-steel)" stroke="${INK}" stroke-width="2"/>
      <rect x="-7.5" y="-2" width="15" height="4" rx="1" fill="url(#${u}-iron)" stroke="${INK}" stroke-width="1.5"/>
    </g>
  `,

  // Energía: Brote vigoroso de roble con nervaduras y rocío dorado
  energy: (u) => `
    <path d="M32 56V24" stroke="url(#${u}-wood)" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M32 43C15 43 10 29 15 15c15 0 21 11 17 28Z" fill="#529646" stroke="${INK}" stroke-width="2"/>
    <path d="M32 33c17 0 22-14 17-28-15 0-21 11-17 28Z" fill="#76bf5c" stroke="${INK}" stroke-width="2"/>
    <path d="M18 22c5 8 10 14 14 17m13-25c-5 8-9 13-13 16" fill="none" stroke="#e4f7c8" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="32" cy="18" r="3.6" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.5"/>
  `,

  // Maestría: Estrella facetada en relieve
  star: (u) => `
    <polygon points="32,5 39.5,21 57,23 44,35 47.5,52.5 32,43.5 16.5,52.5 20,35 7,23 24.5,21" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="2.1"/>
    <polygon points="32,5 32,30 24.5,21" fill="#fff8d6" opacity=".65"/>
    <polygon points="57,23 32,30 39.5,21" fill="#fff8d6" opacity=".45"/>
    <polygon points="7,23 32,30 20,35" fill="#fff8d6" opacity=".45"/>
    <polygon points="32,30 47.5,52.5 32,43.5" fill="#7a4c10" opacity=".45"/>
    <circle cx="32" cy="29" r="3.5" fill="#fff6cc" stroke="#6e4510" stroke-width="1.2"/>
  `,

  // Pin de localización
  pin: (u) => `
    <path d="M32 6C20.5 6 12 14.5 12 25.5 12 39 28.5 53 32 56c3.5-3 20-17 20-30.5C52 14.5 43.5 6 32 6Z" fill="#c4382f" stroke="${INK}" stroke-width="2.1"/>
    <circle cx="32" cy="25.5" r="9.5" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="32" cy="25.5" r="4.5" fill="#2e1810"/>
    <path d="M19 16c3-4.5 8-6.5 13-6.5" fill="none" stroke="#ffb8ad" stroke-width="2" stroke-linecap="round"/>
  `,

  // Reloj de bolsillo de latón
  clock: (u) => `
    <circle cx="32" cy="9" r="4.5" fill="none" stroke="url(#${u}-gold)" stroke-width="2.4"/>
    <rect x="28.5" y="12" width="7" height="4" rx="1" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="32" cy="36" r="21" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="2.1"/>
    <circle cx="32" cy="36" r="16" fill="url(#${u}-parch)" stroke="#7a5324" stroke-width="1.5"/>
    <path d="M32 23v3m13 10h-3M32 49v-3M19 36h3" stroke="#6e4610" stroke-width="2" stroke-linecap="round"/>
    <path d="M32 36v-9m0 9 7 4" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="32" cy="36" r="2.4" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.2"/>
  `,

  // Candado de hierro y bronce
  lock: (u) => `
    <path d="M21 28v-9a11 11 0 0 1 22 0v9" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <path d="M21 28v-9a11 11 0 0 1 22 0v9" fill="none" stroke="url(#${u}-steel)" stroke-width="3.8" stroke-linecap="round"/>
    <rect x="14" y="27" width="36" height="29" rx="5" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="2.1"/>
    <rect x="18.5" y="31.5" width="27" height="20" rx="3" fill="#6b4412" opacity=".35"/>
    <circle cx="32" cy="39" r="3.8" fill="${INK}"/>
    <polygon points="30,40 34,40 35,48 29,48" fill="${INK}"/>
  `,

  // Sello de verificación
  check: (u) => `
    <circle cx="32" cy="32" r="23" fill="#468542" stroke="${INK}" stroke-width="2.1"/>
    <circle cx="32" cy="32" r="18.5" fill="none" stroke="url(#${u}-gold)" stroke-width="1.6"/>
    <path d="m21 33 7.5 7.5 15-16.5" fill="none" stroke="#fff8dc" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  `,

  // Mochila de cuero con hebillas
  bag: (u) => `
    <path d="M22 20v-6a10 10 0 0 1 20 0v6" fill="none" stroke="url(#${u}-leather)" stroke-width="4.2"/>
    <path d="M12 21h40l4 31a4 4 0 0 1-4 4.5H12a4 4 0 0 1-4-4.5Z" fill="url(#${u}-leather)" stroke="${INK}" stroke-width="2.1"/>
    <path d="M11 21h42v13a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4Z" fill="url(#${u}-wood)" stroke="${INK}" stroke-width="1.9"/>
    <rect x="18" y="21" width="5" height="25" rx="1" fill="url(#${u}-leather)" stroke="${INK}" stroke-width="1.4"/>
    <rect x="41" y="21" width="5" height="25" rx="1" fill="url(#${u}-leather)" stroke="${INK}" stroke-width="1.4"/>
    <rect x="17" y="34" width="7" height="6" rx="1.2" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.4"/>
    <rect x="40" y="34" width="7" height="6" rx="1.2" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="1.4"/>
  `,

  // Lupa de latón y cristal
  search: (u) => `
    <path d="m38 38 17 17" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="m38 38 17 17" stroke="url(#${u}-wood)" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="25" cy="25" r="17" fill="url(#${u}-gold)" stroke="${INK}" stroke-width="2.1"/>
    <circle cx="25" cy="25" r="12.5" fill="#70c2de" fill-opacity=".42" stroke="${INK}" stroke-width="1.5"/>
    <path d="M17 18a10 10 0 0 1 12-2" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
  `,

  // Flecha dorada
  arrow: (u) => `
    <path d="M10 32h38m-14-14 15 14-15 14" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M10 32h38m-14-14 15 14-15 14" fill="none" stroke="url(#${u}-gold)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
  `,
};

let iconSequence = 0;

export function professionIcon(id: string) {
  const uid = `pfg-${++iconSequence}`;
  const render = artwork[id] ?? artwork.recipes;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">${makeDefs(uid)}${render(uid)}</svg>`;
}

export const PROFESSION_COLORS: Record<string, string> = {
  herreria: '#86613f',
  peleteria: '#94704b',
  sastreria: '#907191',
  carpinteria: '#758352',
  ebanisteria: '#8b683e',
  joyeria: '#7b799e',
  alquimia: '#68896c',
  encantamiento: '#84719f',
  cocina: '#ac7952',
  minero: '#71858b',
  lenador: '#6e8156',
  recolector: '#63886a',
};

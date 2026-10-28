import type { SkillId } from '../data/combat';

type Art = { colors: [string, string, string]; drawing: (id: (name: string) => string) => string };

// Cada icono cuenta lo que hace la habilidad con el arma de su clase; todas las formas llevan relleno explícito
// porque la barra de acción hereda `fill:none`.
const ART: Record<SkillId, Art> = {
  // Guerrero · Golpe contundente: el mandoble cae a plomo y agrieta el suelo.
  heavy_strike: {
    colors: ['#8a3f27', '#22161a', '#ffc771'],
    drawing: id => `<defs>
        <linearGradient id="${id('blade')}" x1="0" x2="1"><stop stop-color="#f4fbff"/><stop offset=".5" stop-color="#c9d8e0"/><stop offset=".51" stop-color="#8fa5b4"/><stop offset="1" stop-color="#b8c8d2"/></linearGradient>
        <radialGradient id="${id('impact')}" cx=".5" cy=".5" r=".5"><stop stop-color="#fff4c4"/><stop offset=".45" stop-color="#ffb347" stop-opacity=".85"/><stop offset="1" stop-color="#ff7a2f" stop-opacity="0"/></radialGradient>
      </defs>
      <path d="M17 8v15M47 8v15M22 4v9M42 4v9" stroke="#ffcf86" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".55"/>
      <ellipse cx="32" cy="51" rx="23" ry="9" fill="url(#${id('impact')})"/>
      <path d="m32 52-7 3-4 5m11-8 8 2 5 5m-13-7-14-1m14 1 15-2m-15 2 1 8" stroke="#3b1d14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="m10 40 4-3 2 4-4 2zm40-5 4-2 1 4-4 1zm-3 9 3 0-1 3z" fill="#e0a165" stroke="#4a2618" stroke-width=".8"/>
      <circle cx="32" cy="7.5" r="3.3" fill="#f0bb52" stroke="#4a2618" stroke-width="1.2"/>
      <rect x="29.5" y="10" width="5" height="8" rx="1" fill="#6b3826" stroke="#2c1710" stroke-width="1"/>
      <path d="M29.5 12.5h5m-5 3h5" stroke="#a5643f" stroke-width="1"/>
      <path d="M18 18.5q14-4 28 0l-1 3.5q-13-3-26 0z" fill="#f0bb52" stroke="#4a2618" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M27 22.5h10v18.5l-5 7.5-5-7.5z" fill="url(#${id('blade')})" stroke="#2f3b46" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M32 24v20" stroke="#6f8696" stroke-width="1.2"/>
      <path d="M28.6 24v15" stroke="#fff" stroke-width="1" opacity=".8"/>
      <path d="m32 44 2.5 3.5-2.5 2-2.5-2z" fill="#fff6d5"/>
      <path d="m32 41 1.6 5.4 5.4 1.6-5.4 1.6-1.6 5.4-1.6-5.4-5.4-1.6 5.4-1.6z" fill="#fffbe6" opacity=".95"/>`,
  },
  // Mago · Descarga arcana: el cristal del bastón libera un rayo bifurcado dentro de un círculo rúnico.
  arcane_discharge: {
    colors: ['#5b4596', '#141a3c', '#c8abff'],
    drawing: id => `<defs>
        <radialGradient id="${id('orb')}" cx=".38" cy=".32" r=".7"><stop stop-color="#ffffff"/><stop offset=".35" stop-color="#d9c6ff"/><stop offset="1" stop-color="#7650d8"/></radialGradient>
        <radialGradient id="${id('glow')}" cx=".5" cy=".5" r=".5"><stop stop-color="#c7a8ff" stop-opacity=".9"/><stop offset="1" stop-color="#7d5cff" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id('wood')}" x1="0" x2="1"><stop stop-color="#9a6a40"/><stop offset="1" stop-color="#5a3a24"/></linearGradient>
      </defs>
      <circle cx="22" cy="20" r="16" fill="url(#${id('glow')})"/>
      <circle cx="22" cy="20" r="12.5" fill="none" stroke="#b9a0ff" stroke-width="1" stroke-dasharray="2.5 2" opacity=".75"/>
      <path d="m22 6 1.2 2.4h-2.4zm14 14-2.4 1.2v-2.4zM22 34l-1.2-2.4h2.4zM8 20l2.4-1.2v2.4z" fill="#e6d8ff"/>
      <path d="m13 58 9-27" stroke="#2a1a10" stroke-width="5" stroke-linecap="round"/>
      <path d="m13 58 9-27" stroke="url(#${id('wood')})" stroke-width="3" stroke-linecap="round"/>
      <path d="m15.5 49.5 3 1m-1.2-6.6 3 1" stroke="#e3c27a" stroke-width="1.5"/>
      <path d="M21 31q-7-3-6-11m8 11q7-3 6-11" fill="none" stroke="#e3c27a" stroke-width="2" stroke-linecap="round"/>
      <circle cx="22" cy="21" r="6" fill="url(#${id('orb')})" stroke="#5134a8" stroke-width="1"/>
      <circle cx="20" cy="19" r="1.6" fill="#fff"/>
      <path d="M27 22 45 26l-6 6 17 5-9 3 9 12-20-11 7-4-15-7z" fill="#efe4ff" stroke="#8f6cf0" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="m30 24.5 11 2.6-5 5 14 4.4" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="m43 35 7-6m-4 13 9 1" stroke="#c9b3ff" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <circle cx="52" cy="27" r="1.6" fill="#bfe7ff"/><circle cx="57" cy="44" r="1.3" fill="#fff0b5"/><circle cx="44" cy="15" r="1.2" fill="#e6d8ff"/>`,
  },
  // Pícaro · Corte doble: dos dagas cruzadas dejan dos tajos paralelos.
  double_slash: {
    colors: ['#2f5e57', '#13232a', '#9de4c0'],
    drawing: id => {
      const dagger = (angle: number) => `<g transform="translate(32 36) rotate(${angle}) scale(1.15)">
          <path d="M0-27 4.6-13 3.2 0h-6.4l-1.4-13z" fill="url(#${id('steel')})" stroke="#24363c" stroke-width="1.1" stroke-linejoin="round"/>
          <path d="M0-25V-1" stroke="#7d9aa2" stroke-width=".9"/><path d="M-1.6-21-2.5-4" stroke="#fff" stroke-width=".8" opacity=".8"/>
          <path d="M-8 0q8 2.5 16 0v3q-8 2-16 0z" fill="#c99b4f" stroke="#3a2618" stroke-width="1"/>
          <rect x="-2.2" y="3" width="4.4" height="10" rx="1.2" fill="#5b3248" stroke="#2a1420" stroke-width="1"/>
          <path d="M-2.2 6h4.4m-4.4 3h4.4" stroke="#8d5a73" stroke-width=".9"/>
          <circle cx="0" cy="15" r="2.4" fill="#e1bc72" stroke="#3a2618" stroke-width="1"/>
        </g>`;
      return `<defs>
          <linearGradient id="${id('steel')}" x1="0" x2="1"><stop stop-color="#f1fbf6"/><stop offset=".5" stop-color="#cfe2e0"/><stop offset=".51" stop-color="#93b2b4"/><stop offset="1" stop-color="#b6cfcf"/></linearGradient>
          <linearGradient id="${id('slash')}" x1="0" x2="1"><stop stop-color="#8ff0c0" stop-opacity="0"/><stop offset=".55" stop-color="#bfffe0"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
        </defs>
        <path d="M6 17q24 3 51-9-21 15-51 9z" fill="url(#${id('slash')})"/>
        <path d="M7 29q24 3 51-9-21 15-51 9z" fill="url(#${id('slash')})"/>
        ${dagger(-38)}${dagger(38)}
        <path d="m50 12 1.4 3.2 3.2 1.4-3.2 1.4-1.4 3.2-1.4-3.2-3.2-1.4 3.2-1.4z" fill="#f4fff8"/>
        <circle cx="12" cy="50" r="1.3" fill="#c3f5da"/><circle cx="53" cy="52" r="1.3" fill="#c3f5da"/>`;
    },
  },
  // Clérigo · Curación: del libro sagrado brota una columna de luz con un corazón que sana.
  healing: {
    colors: ['#6b7a3f', '#1d3530', '#f4de8a'],
    drawing: id => `<defs>
        <linearGradient id="${id('beam')}" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#fff2b0" stop-opacity=".85"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></linearGradient>
        <radialGradient id="${id('heart')}" cx=".38" cy=".3" r=".8"><stop stop-color="#ffd9c9"/><stop offset=".45" stop-color="#ef7c78"/><stop offset="1" stop-color="#a8324a"/></radialGradient>
        <radialGradient id="${id('halo')}" cx=".5" cy=".5" r=".5"><stop stop-color="#fff6c8" stop-opacity=".95"/><stop offset="1" stop-color="#ffe48a" stop-opacity="0"/></radialGradient>
      </defs>
      <path d="M26 48 17 5h30l-9 43z" fill="url(#${id('beam')})"/>
      <circle cx="32" cy="24" r="17" fill="url(#${id('halo')})"/>
      <path d="M32 37.5C20.5 30 16.5 24.5 16.5 19.3c0-5.4 4.2-8.8 8.5-8.8 3 0 5.4 1.7 7 4.4 1.6-2.7 4-4.4 7-4.4 4.3 0 8.5 3.4 8.5 8.8 0 5.2-4 10.7-15.5 18.2z" fill="url(#${id('heart')})" stroke="#6d1e33" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M21 17.5q1.5-3.8 5-3.8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>
      <path d="M30 17h4v4h4v4h-4v4h-4v-4h-4v-4h4z" fill="#fffbe8" stroke="#c98a55" stroke-width=".8"/>
      <path d="M6 47.5q13-3.5 26 2 13-5.5 26-2V59q-13-3.5-26 1.5Q19 55.5 6 59z" fill="#7a2f2a" stroke="#2c120f" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M8.5 46q12-3.5 23.5 2v9.5Q20 53 8.5 55.5zm47 0q-12-3.5-23.5 2v9.5Q44 53 55.5 55.5z" fill="#fbf1d6" stroke="#8f6a3c" stroke-width="1"/>
      <path d="M12 49.5q8-1.5 16 1.6M12 52.5q8-1.5 16 1.6m24-4.6q-8-1.5-16 1.6m16 1.4q-8-1.5-16 1.6" stroke="#c9ad7d" stroke-width=".9" fill="none"/>
      <path d="M32 48v10" stroke="#8f6a3c" stroke-width="1"/>
      <path d="M11 30h4m-2-2v4M50 33h4m-2-2v4M47 8h3m-1.5-1.5v3M14 12h3m-1.5-1.5v3" stroke="#fff6c8" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  // Explorador · Disparo preciso: el virote de la ballesta se clava en el centro de la diana.
  precise_shot: {
    colors: ['#3f5878', '#162630', '#b9dfdf'],
    drawing: id => `<defs>
        <radialGradient id="${id('board')}" cx=".42" cy=".38" r=".7"><stop stop-color="#fff8e4"/><stop offset="1" stop-color="#d9c79b"/></radialGradient>
      </defs>
      <circle cx="39" cy="26" r="19" fill="#5d3c26" stroke="#2a1a10" stroke-width="1.3"/>
      <circle cx="39" cy="26" r="16.5" fill="url(#${id('board')})"/>
      <circle cx="39" cy="26" r="12.5" fill="#c4423a"/>
      <circle cx="39" cy="26" r="8.5" fill="url(#${id('board')})"/>
      <circle cx="39" cy="26" r="4.5" fill="#c4423a"/>
      <circle cx="39" cy="26" r="16.5" fill="none" stroke="#7b5536" stroke-width=".8"/>
      <path d="M39 3v5m0 36v5M16 26h5m36 0h5" stroke="#e7f5f2" stroke-width="1.6" stroke-linecap="round"/>
      <path d="m39 26-3-6m3 6 6-3m-6 3 4 5" stroke="#fff3c4" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M6 47 20 38M4 41l11-7M10 53l12-8" stroke="#cfe9e6" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>
      <path d="M39 26 12 51" stroke="#2a1a10" stroke-width="4.8" stroke-linecap="round"/>
      <path d="M39 26 12 51" stroke="#d6a964" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M38 27 14 49" stroke="#f3d79e" stroke-width=".9" stroke-linecap="round"/>
      <path d="m35.6 29.2 3.4-3.2" stroke="#e8eef0" stroke-width="3.2"/>
      <path d="m20 44-11-2.2 3.6 7.6zm0 0 2.2 11-7.6-3.6z" fill="#e7f2ee" stroke="#3d5862" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="m16.8 47.1-7-1.4m7 1.4 1.4 7" stroke="#7fb0b2" stroke-width=".9"/>
      <circle cx="39" cy="26" r="1.4" fill="#fffbe6"/>`,
  },
};
let sequence = 0;

export function skillIcon(id: SkillId) {
  const { colors, drawing } = ART[id], uid = `skill-art-${++sequence}`;
  return `<svg class="skill-icon" data-icon-skill="${id}" data-icon-family="painted" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="${uid}" cx=".35" cy=".2" r=".95"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></radialGradient>
      <radialGradient id="${uid}-vignette" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
      <linearGradient id="${uid}-frame" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff0b8"/><stop offset=".48" stop-color="#d8b16a"/><stop offset="1" stop-color="#93632e"/></linearGradient>
      <clipPath id="${uid}-clip"><rect x="3" y="3" width="58" height="58" rx="8"/></clipPath>
    </defs>
    <rect x="1.5" y="1.5" width="61" height="61" rx="10" fill="url(#${uid})" stroke="#382519" stroke-width="3"/>
    <g clip-path="url(#${uid}-clip)" stroke-linejoin="round" stroke-linecap="round">${drawing(name => `${uid}-${name}`)}</g>
    <rect x="3" y="3" width="58" height="58" rx="8" fill="url(#${uid}-vignette)"/>
    <rect x="2.5" y="2.5" width="59" height="59" rx="9" fill="none" stroke="url(#${uid}-frame)" stroke-width="1.7"/>
    <rect x="5" y="5" width="54" height="54" rx="6.5" fill="none" stroke="#e6c78e" stroke-opacity=".2" stroke-width=".8"/>
    <path d="M7 14V8h6m38 0h5v6M7 50v6h6m38 0h5v-6" fill="none" stroke="#efd59d" stroke-width="1" stroke-linejoin="round"/>
    <circle cx="55" cy="8" r="1.3" fill="${colors[2]}" stroke="#5e4028" stroke-width=".55"/>
  </svg>`;
}

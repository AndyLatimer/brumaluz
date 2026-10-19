import type { SkillId } from '../data/combat';

const ART: Record<SkillId, { colors: [string, string, string]; drawing: string }> = {
  heavy_strike: {
    colors: ['#843b29', '#241d25', '#ffc771'],
    drawing: `<path d="M12 51 24 42M10 37l12 1M26 54l1-10M42 16l10-4-4 11" stroke="#f5aa57" stroke-width="2.5"/>
      <path d="m20 45 7 7 7-13 19-24-5-5-23 22z" fill="#d9e8ea" stroke="#667f91" stroke-width="1.4"/>
      <path d="m27 39 22-25-1-4-23 22z" fill="#fff6d3"/>
      <path d="m18 35 16 13 3-4-16-13z" fill="#f5bd5c" stroke="#5c3426"/>
      <path d="m16 40 8 7-6 7-6-6z" fill="#7f4430" stroke="#e1a562"/>
      <path d="m35 25-3-9 5 3 3-9 3 12" fill="none" stroke="#ffd67e" stroke-width="2"/>
      <circle cx="16" cy="51" r="3" fill="#ffd98a"/>`,
  },
  arcane_discharge: {
    colors: ['#59458e', '#171e40', '#c8abff'],
    drawing: `<circle cx="32" cy="32" r="20" fill="none" stroke="#b197fa" opacity=".5"/>
      <path d="m32 7 4 8-4 3-4-3zm25 25-8 4-3-4 3-4zM32 57l-4-8 4-3 4 3zM7 32l8-4 3 4-3 4z" fill="#d0b8ff"/>
      <path d="m37 12-17 23h11l-5 17 20-26H34z" fill="#e9dbff" stroke="#9271dc" stroke-width="1.5"/>
      <path d="m35 18-11 15h11l-5 11 12-16H32z" fill="#fff"/>
      <path d="m13 16 5 5m28 25 5 5m-37-1 5-5m26-26 5-5" stroke="#a6d9ff" stroke-width="2"/>
      <circle cx="18" cy="12" r="1.5" fill="#fff0b5"/><circle cx="49" cy="41" r="2" fill="#bce6ff"/>`,
  },
  double_slash: {
    colors: ['#355f5b', '#182a30', '#9de4c0'],
    drawing: `<path d="M11 33Q25 8 52 17M14 48q14-24 39-25" fill="none" stroke="#86d8ae" stroke-width="3" opacity=".65"/>
      <path d="m17 16 5-4 18 24-5 4z" fill="#e5f0e4" stroke="#668f92"/>
      <path d="m47 15-5-3-18 25 5 4z" fill="#bfdbe0" stroke="#668f92"/>
      <path d="m15 43 15-12 3 4-15 12zm16-9 3-4 16 12-3 5z" fill="#c8a364" stroke="#4c3a2b"/>
      <path d="m17 44 4 4-9 9-4-4zm25 4 4-4 10 8-4 5z" fill="#684358" stroke="#d7b875"/>
      <path d="m30 22 2 5 6 1-5 3-1 6-3-5-6-1 5-3z" fill="#fff0b4"/>
      <path d="m8 26 3-4m39 12 4-3" stroke="#d1f6d9" stroke-width="2"/>`,
  },
  healing: {
    colors: ['#687745', '#213b35', '#f4de8a'],
    drawing: `<circle cx="32" cy="27" r="16" fill="none" stroke="#e7d695" opacity=".65"/>
      <path d="M32 6v5M12 11l4 5m32-5-4 5M8 28h5m38 0h5" stroke="#f5e4a4" stroke-width="2"/>
      <path d="M28 16h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill="#fff0b4" stroke="#baa85d"/>
      <path d="m12 37 8 8 12 3 12-3 8-8 4 5-12 12-12 4-12-4L8 42z" fill="#bad6ae" stroke="#668b75"/>
      <path d="m19 40 8 4h10l8-4M32 48v7" fill="none" stroke="#5a8d71" stroke-width="2"/>
      <path d="m48 20 2 4 4 1-4 2-2 4-1-4-4-2 4-1z" fill="#fff7d5"/>`,
  },
  precise_shot: {
    colors: ['#43587b', '#1b2d35', '#b9dfdf'],
    drawing: `<circle cx="36" cy="29" r="17" fill="none" stroke="#8ecccc" stroke-width="2"/>
      <circle cx="36" cy="29" r="10" fill="none" stroke="#82abaa"/>
      <path d="M36 7v10m0 24v10M14 29h10m24 0h10" stroke="#dfd9a0" stroke-width="2"/>
      <path d="m10 53 26-26 2 2-25 27z" fill="#f5e5bd"/>
      <path d="m30 28 13-7-7 14-1-7z" fill="#eaf7f2" stroke="#709fa6"/>
      <path d="m9 43 9 1 2 10-7 4-1-8-7-1z" fill="#d2a965" stroke="#6d573b"/>
      <circle cx="36" cy="29" r="2" fill="#fff9d2"/>
      <path d="m8 33 7-3M25 56l3-7" stroke="#b3d6ce" stroke-width="2"/>`,
  },
};
let sequence = 0;

export function skillIcon(id: SkillId) {
  const { colors, drawing } = ART[id], gradient = `skill-art-${++sequence}`;
  return `<svg class="skill-icon" data-icon-skill="${id}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><radialGradient id="${gradient}" cx=".35" cy=".2" r=".9"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></radialGradient></defs>
    <rect x="1" y="1" width="62" height="62" rx="11" fill="url(#${gradient})" stroke="${colors[2]}" stroke-width="1.5"/>
    <rect x="4" y="4" width="56" height="56" rx="8" fill="none" stroke="${colors[2]}" opacity=".25"/>
    ${drawing}
    <path d="M6 14V7h7m38 0h6v7M6 50v7h7m38 0h6v-7" fill="none" stroke="${colors[2]}" stroke-width="1.2"/>
  </svg>`;
}

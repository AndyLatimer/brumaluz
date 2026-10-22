/** Shared art direction for every weapon. Generated from its actual GLB at build time. */
const portraits = import.meta.glob<string>(['../assets/icons/weapons/*.png', '!../assets/icons/weapons/weapon_icons.png'], {
  eager: true, query: '?url', import: 'default',
});
const byId = Object.fromEntries(Object.entries(portraits).map(([file, url]) => [file.split('/').at(-1)!.slice(0, -4), url]));

export function weaponPortrait(id: string): string | undefined {
  const url = byId[id];
  return url ? `<image href="${url}" x=".6" y=".6" width="22.8" height="22.8" preserveAspectRatio="xMidYMid meet"/>` : undefined;
}

/** Layered wood/bronze frame; rarity remains a readable accent at small sizes. */
export function weaponIconFrame(color: string) {
  return `<rect x=".45" y=".45" width="23.1" height="23.1" rx="3.2" fill="#302c2b" stroke="#594533" stroke-width=".8"/>
    <rect x="1.15" y="1.15" width="21.7" height="21.7" rx="2.5" fill="#494039" stroke="#b29463" stroke-width=".35"/>
    <path d="M3 2h18q1 0 1 1v8H2V3q0-1 1-1Z" fill="#675447" opacity=".38"/>
    <ellipse cx="12" cy="20" rx="8" ry="1.5" fill="#191c22" opacity=".4"/>
    <rect x="1.6" y="1.6" width="20.8" height="20.8" rx="2.1" fill="none" stroke="${color}" stroke-opacity=".7" stroke-width=".4"/>
    <path d="M3 5V3h2M19 3h2v2M3 19v2h2M19 21h2v-2" fill="none" stroke="#ddc18b" stroke-width=".5"/>`;
}

import { execFileSync } from 'node:child_process';
for(const script of ['build-rpg-catalog.mjs','build-rpg-geometry.mjs','build-weapon-catalog.mjs','build-rpg-server.mjs','build-wilderness.mjs'])execFileSync(process.execPath,[`tools/${script}`],{stdio:'inherit'});

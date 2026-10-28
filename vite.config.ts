import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { npcWorkshopPlugin } from './tools/npc-workshop-plugin.mjs';
import { mapEditorPlugin } from './tools/map-editor-plugin.mjs';
import { questEditorPlugin } from './tools/quest-editor-plugin.mjs';
import { readFileSync } from 'node:fs';

export default defineConfig(() => {
  const catalog = JSON.parse(readFileSync(new URL('./src/data/npcs.json', import.meta.url), 'utf8'));
  const uses = (source: string) => catalog.npcs.some((npc: { render: { clothing?: Record<string, { piece: string }> } }) =>
    Object.values(npc.render.clothing ?? {}).some(item => item.piece.startsWith(`${source}.`)));
  return {
    // CLI, previews and helper processes must not replace one another's optimized
    // dependencies while an editor tab is open (504 Outdated Optimize Dep).
    cacheDir: `node_modules/.vite-brumaluz/${process.pid}`,
    optimizeDeps: {
      include: [
        'three',
        'three/examples/jsm/controls/OrbitControls.js',
        'three/examples/jsm/controls/TransformControls.js',
        'three/examples/jsm/loaders/GLTFLoader.js',
      ],
    },
    plugins: [viteSingleFile(), npcWorkshopPlugin(), mapEditorPlugin(), questEditorPlugin()],
    define: {
      'import.meta.env.NPC_RANGER': JSON.stringify(uses('Ranger')),
      'import.meta.env.NPC_ROGUE_HOODED': JSON.stringify(uses('Rogue_Hooded')),
    },
    build: { target: 'es2022' },
    assetsInclude: ['**/*.glb'],
  };
});

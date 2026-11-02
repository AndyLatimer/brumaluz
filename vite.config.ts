import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { npcWorkshopPlugin } from './tools/npc-workshop-plugin.mjs';
import { mapEditorPlugin } from './tools/map-editor-plugin.mjs';
import { questEditorPlugin } from './tools/quest-editor-plugin.mjs';
import { itemEditorPlugin } from './tools/item-editor-plugin.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  const artDirectory = fileURLToPath(new URL('./art/', import.meta.url)).replaceAll('\\', '/');
  const catalog = JSON.parse(readFileSync(new URL('./src/data/npcs.json', import.meta.url), 'utf8'));
  const uses = (source: string) => catalog.npcs.some((npc: { render: { clothing?: Record<string, { piece: string }> } }) =>
    Object.values(npc.render.clothing ?? {}).some(item => item.piece.startsWith(`${source}.`)));
  return {
    // CLI, previews and helper processes must not replace one another's optimized
    // dependencies while an editor tab is open (504 Outdated Optimize Dep).
    cacheDir: `node_modules/.vite-brumaluz/${process.pid}`,
    resolve: { alias: standalone ? { '../data/world/published': fileURLToPath(new URL('./src/data/world/published-standalone.ts', import.meta.url)) } : {} },
    server: {
      watch: {
        // Ignore generated art at the project root while keeping src/art watched.
        ignored: ['**/dist/**', '**/dist-standalone/**', '**/.art-sources/**', `${artDirectory}**`],
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
      },
    },
    optimizeDeps: {
      entries: ['index.html', 'maps.html', 'npcs.html', 'quests.html', 'items.html', 'wardrobe.html', 'equipment.html'],
      include: [
        '@supabase/supabase-js',
        'three',
        'three-subdivide',
        'three/examples/jsm/controls/OrbitControls.js',
        'three/examples/jsm/controls/TransformControls.js',
        'three/examples/jsm/exporters/GLTFExporter.js',
        'three/examples/jsm/loaders/EXRLoader.js',
        'three/examples/jsm/loaders/GLTFLoader.js',
        'three/examples/jsm/postprocessing/EffectComposer.js',
        'three/examples/jsm/postprocessing/GTAOPass.js',
        'three/examples/jsm/postprocessing/OutputPass.js',
        'three/examples/jsm/postprocessing/RenderPass.js',
        'three/examples/jsm/postprocessing/ShaderPass.js',
        'three/examples/jsm/postprocessing/UnrealBloomPass.js',
        'three/examples/jsm/utils/BufferGeometryUtils.js',
        'three/examples/jsm/utils/SkeletonUtils.js',
      ],
    },
    plugins: [...(standalone ? [viteSingleFile()] : []), npcWorkshopPlugin(), mapEditorPlugin(), questEditorPlugin(), itemEditorPlugin()],
    define: {
      'import.meta.env.NPC_RANGER': JSON.stringify(uses('Ranger')),
      'import.meta.env.NPC_ROGUE_HOODED': JSON.stringify(uses('Rogue_Hooded')),
    },
    // Hosting can cache model/image files independently and fetch lazy libraries
    // only when requested. Keep the portable embedded build as an explicit mode.
    build: { target: 'es2022', assetsInlineLimit: 0, manifest: true, outDir: standalone ? 'dist-standalone' : 'dist' },
    assetsInclude: ['**/*.glb'],
  };
});

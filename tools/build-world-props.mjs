/**
 * Build and render the Pompelín world-map props kit through Blender.
 *
 * Generates editable Blender collections (`art/world-props/pompelin-world-props.blend`),
 * standalone `.glb` files (`art/world-props/objects/*.glb`), painted texture atlas,
 * manifest, and Cycles preview sheets without modifying game runtime files.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLENDER_CANDIDATES = [
  process.env.BLENDER_PATH,
  'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender\\blender.exe',
  'blender',
].filter(Boolean);

function findBlender() {
  for (const candidate of BLENDER_CANDIDATES) {
    if (candidate === 'blender' || existsSync(candidate)) {
      const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
      if (probe.status === 0) return candidate;
    }
  }
  throw new Error('Blender executable not found. Set BLENDER_PATH or install Blender.');
}

function runBlender(blender, script) {
  const result = spawnSync(
    blender,
    ['--background', '--factory-startup', '--python', path.join(ROOT, script)],
    { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`Blender failed while running ${script} (exit ${result.status})`);
  }
}

const blender = findBlender();
runBlender(blender, 'tools/blender/build_world_props.py');
if (!process.argv.includes('--no-render')) {
  runBlender(blender, 'tools/blender/render_world_props.py');
}


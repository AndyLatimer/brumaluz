import { spawnSync } from 'node:child_process';

const blender = process.env.BLENDER_PATH ?? (process.platform === 'win32'
  ? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' : 'blender');
const script = process.argv.includes('--render-only') ? 'tools/blender/render_hamlet.py' : 'tools/blender/build_hamlet.py';
const result = spawnSync(blender, [
  '--background', '--factory-startup', '--python-exit-code', '1',
  '--python', script,
  '--', ...process.argv.slice(2),
], { stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
if (result.error) throw new Error(`Blender could not run. Set BLENDER_PATH. ${result.error.message}`);
process.exitCode = result.status ?? 1;

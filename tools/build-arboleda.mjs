import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const blender = process.env.BLENDER_PATH ?? (process.platform === 'win32'
  ? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' : 'blender');
const result = spawnSync(blender, [
  '--background', '--factory-startup', '--python-exit-code', '1',
  '--python', 'tools/blender/build_arboleda.py', '--', ...process.argv.slice(2),
], { cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
if (result.error) throw new Error(`No se pudo ejecutar Blender. Configura BLENDER_PATH. ${result.error.message}`);
process.exitCode = result.status ?? 1;

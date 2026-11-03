import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
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
  throw new Error('No se encontró el ejecutable de Blender. Configura BLENDER_PATH.');
}

if (!existsSync(path.join(root, 'src/assets/library/brumaluz-lagto/textures/lagto-normal.png'))) {
  const textures = spawnSync(process.execPath, ['tools/build-lagto-textures.mjs'], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (textures.status !== 0) process.exit(textures.status ?? 1);
}
const blender = findBlender();
console.log(`Usando Blender en: ${blender}`);

const script = 'tools/blender/build_lagto.py';
const result = spawnSync(blender, [
  '--background', '--factory-startup', '--python-exit-code', '1',
  '--python', script, '--', ...process.argv.slice(2),
], { cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });

if (result.error) {
  throw new Error(`Fallo al ejecutar Blender: ${result.error.message}`);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// Ahora registrar en catalog.json
const registerResult = spawnSync(process.execPath, ['tools/register-lagto.mjs'], { cwd: root, stdio: 'inherit' });
if (registerResult.status !== 0) {
  process.exit(registerResult.status ?? 1);
}


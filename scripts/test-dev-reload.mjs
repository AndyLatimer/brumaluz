import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

test('dev reload watches src/art exports, SSR imports and image globs after repeated saves', { timeout: 45000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'brumaluz-dev-reload-'));
  let server;
  const source = join(directory, 'src');
  const art = join(source, 'art');
  const drawings = join(art, 'drawings');
  const paintings = join(art, 'paintings.ts');
  const entry = join(source, 'entry.ts');
  const code = version => `
export const painting${version} = () => ${version};
export const images = Object.keys(import.meta.glob('./drawings/*.webp', { eager: true, query: '?url', import: 'default' }));
`;
  async function eventually(check) {
    const deadline = Date.now() + 10000;
    let error;
    do {
      try { return await check(); } catch (failure) { error = failure; }
      await delay(100);
    } while (Date.now() < deadline);
    throw error;
  }
  try {
    await mkdir(drawings, { recursive: true });
    await writeFile(join(drawings, 'first.webp'), 'fixture');
    await writeFile(paintings, code(0));
    await writeFile(entry, "import * as paintings from './art/paintings'; export const current = paintings;\n");
    server = await createServer({
      configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
      root: directory,
      cacheDir: join(directory, '.vite'),
      logLevel: 'error',
      optimizeDeps: { entries: [], include: [], noDiscovery: true },
      server: { host: '127.0.0.1', port: 0, strictPort: false },
    });
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    const verify = version => eventually(async () => {
      const response = await fetch(`${base}/src/art/paintings.ts`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), new RegExp(`export const painting${version}\\b`));
      const { current } = await server.ssrLoadModule('/src/entry.ts');
      assert.equal(current[`painting${version}`](), version);
      assert.equal(Object.keys(current).filter(key => key.startsWith('painting')).length, 1);
      return current;
    });
    assert.deepEqual((await verify(0)).images, ['./drawings/first.webp']);
    // Keep this fixture under src/art: ignoring **/art/** caused the real failure.
    // Change both an export's name and its value, as with new inventory art.
    for (const version of [1, 2, 3, 4]) {
      if (version % 2) {
        await writeFile(paintings, code(version));
      } else {
        const replacement = join(art, 'replacement.tmp');
        await writeFile(replacement, code(version));
        await rename(replacement, paintings);
      }
      await verify(version);
    }
    await writeFile(join(drawings, 'second.webp'), 'fixture');
    await eventually(async () => {
      const { current } = await server.ssrLoadModule('/src/entry.ts');
      assert.deepEqual(current.images.sort(), ['./drawings/first.webp', './drawings/second.webp']);
      assert.match(await (await fetch(`${base}/src/art/paintings.ts`)).text(), /second\.webp/);
    });
  } finally {
    await server?.close();
    const target = resolve(directory);
    assert.equal(target.startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')), true);
    assert.equal(target.split(/[\\/]/).at(-1).startsWith('brumaluz-dev-reload-'), true);
    await rm(target, { recursive: true, force: true });
  }
});

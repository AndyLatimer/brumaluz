import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

const hash = text => `"${createHash('sha256').update(text).digest('hex')}"`;
export function npcWorkshopPlugin({ catalogPath } = {}) {
  let catalogFile;
  return {
    name: 'brumaluz-npc-workshop',
    apply: 'serve',
    configResolved(config) { catalogFile = resolve(catalogPath ?? resolve(config.root, 'src', 'data', 'npcs.json')); },
    handleHotUpdate(context) {
      const normalize = path => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
      // Saving a shared JSON module must not reload the editor and discard its active draft.
      if (normalize(context.file) === normalize(catalogFile)) return [];
    },
    configureServer(server) {
      const file = catalogPath ?? resolve(server.config.root, 'src', 'data', 'npcs.json');
      let pending = Promise.resolve();
      server.middlewares.use('/__dev/npcs', (request, response) => {
        const send = (status, data, revision) => {
          response.statusCode = status;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          if (revision) response.setHeader('ETag', revision);
          response.end(JSON.stringify(data));
        };
        const run = async () => {
          const host = request.headers.host;
          const remote = request.socket.remoteAddress;
          if (!host || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
            || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)
            || request.headers.origin && request.headers.origin !== `http://${host}` && request.headers.origin !== `https://${host}`
            || request.headers['sec-fetch-site'] === 'cross-site') {
            send(403, { error: 'El registro de NPCs solo admite solicitudes locales del propio taller.' }); return;
          }
          if (request.url !== '/' && request.url !== '') { send(404, { error: 'Ruta no válida.' }); return; }
          if (!['GET', 'PUT'].includes(request.method)) {
            response.setHeader('Allow', 'GET, PUT'); send(405, { error: 'Método no permitido.' }); return;
          }
          const { validateNpcCatalog, WORLD_NPC_IDS } = await server.ssrLoadModule('/src/data/npcs.ts');
          const current = await readFile(file, 'utf8');
          const revision = hash(current);
          let catalog;
          try { catalog = validateNpcCatalog(JSON.parse(current)); }
          catch (error) { throw new Error(`El catálogo del proyecto no es válido: ${error.message}`); }
          if (request.method === 'GET') { send(200, catalog, revision); return; }
          if (request.headers['if-match'] !== revision) {
            send(409, { error: 'El catálogo cambió en otra ventana o en disco. Exporta tu borrador y recarga la biblioteca antes de guardar.' }); return;
          }
          if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
            send(415, { error: 'Se requiere application/json.' }); return;
          }
          if (Number(request.headers['content-length']) > 4_000_000) {
            request.resume(); send(413, { error: 'El catálogo supera los 4 MB.' }); return;
          }
          const chunks = [];
          let size = 0;
          for await (const chunk of request.iterator({ destroyOnReturn: false })) {
            size += chunk.length;
            if (size > 4_000_000) { request.resume(); send(413, { error: 'El catálogo supera los 4 MB.' }); return; }
            chunks.push(chunk);
          }
          let next;
          try { next = validateNpcCatalog(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
          catch (error) { send(400, { error: error.message }); return; }
          const removed = WORLD_NPC_IDS.find(id => catalog.npcs.some(npc => npc.id === id) && !next.npcs.some(npc => npc.id === id));
          if (removed) { send(400, { error: `El NPC del mundo "${removed}" puede editarse, pero no eliminarse desde el taller.` }); return; }
          const content = `${JSON.stringify(next, null, 2)}\n`;
          const temporary = join(dirname(file), `.npcs-${randomUUID()}.tmp`);
          try {
            await writeFile(temporary, content, { flag: 'wx' });
            // Do not overwrite edits made outside Vite while this request was being read.
            if (hash(await readFile(file, 'utf8')) !== revision) {
              send(409, { error: 'El archivo cambió durante el guardado. Recarga la biblioteca.' }); return;
            }
            await rename(temporary, file);
          } finally {
            await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
          }
          send(200, next, hash(content));
        };
        const job = pending.then(run);
        pending = job.catch(error => {
          server.config.logger.error(`Taller de NPCs: ${error.stack ?? error}`);
          if (!response.writableEnded) send(500, { error: 'No se pudo leer o guardar el catálogo. Revisa la terminal de Vite; no se ha confirmado el guardado.' });
        });
      });
    },
  };
}

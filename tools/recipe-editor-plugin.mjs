import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

const hash = text => `"${createHash('sha256').update(text).digest('hex')}"`;

export function recipeEditorPlugin({ catalogPath } = {}) {
  let catalogFile;

  return {
    name: 'brumaluz-recipe-editor',
    apply: 'serve',
    configResolved(config) {
      catalogFile = resolve(catalogPath ?? resolve(config.root, 'src', 'data', 'recipesCatalog.json'));
    },
    handleHotUpdate(context) {
      const normalize = path => (process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path));
      if (normalize(context.file) === normalize(catalogFile)) {
        return [];
      }
    },
    configureServer(server) {
      const file = catalogPath ?? resolve(server.config.root, 'src', 'data', 'recipesCatalog.json');
      let pending = Promise.resolve();

      server.middlewares.use('/__dev/recipes', (request, response) => {
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
          if (
            !host ||
            !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) ||
            !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ||
            (request.headers.origin && request.headers.origin !== `http://${host}` && request.headers.origin !== `https://${host}`) ||
            request.headers['sec-fetch-site'] === 'cross-site'
          ) {
            send(403, { error: 'El registro de recetas solo admite solicitudes locales del propio taller.' });
            return;
          }

          const references = async () => {
            const [
              itemsModule,
              itemsCatalogText,
              questText,
              rpgText,
              professionsModule,
            ] = await Promise.all([
              server.ssrLoadModule('/src/data/items.ts').catch(() => ({ ITEMS: {} })),
              readFile(resolve(server.config.root, 'src/data/itemsCatalog.json'), 'utf8').catch(() => '{"version":1,"items":[]}'),
              readFile(resolve(server.config.root, 'src/data/questCatalog.json'), 'utf8').catch(() => '{"version":1,"quests":[]}'),
              readFile(resolve(server.config.root, 'src/data/generated/rpg-catalog.json'), 'utf8').catch(() => '{"items":{},"recipes":{}}'),
              server.ssrLoadModule('/src/data/professions.ts').catch(() => ({ RPG_CATALOG: { professions: {}, ranks: [] } })),
            ]);

            const itemMap = new Map();

            // 1. Catálogo extendido custom
            try {
              const customParsed = JSON.parse(itemsCatalogText);
              if (Array.isArray(customParsed.items)) {
                for (const it of customParsed.items) {
                  itemMap.set(it.id, {
                    id: it.id,
                    label: it.label || it.id,
                    category: it.category || 'Objeto',
                    rarity: it.rarity || 'common',
                    icon: it.icon || '',
                    value: it.value ?? 0,
                    stack: it.stack ?? 50,
                  });
                }
              }
            } catch {}

            // 2. ITEMS estáticos del juego
            if (itemsModule?.ITEMS) {
              for (const [id, it] of Object.entries(itemsModule.ITEMS)) {
                if (!itemMap.has(id)) {
                  itemMap.set(id, {
                    id,
                    label: it?.label || id,
                    category: it?.category || 'Objeto',
                    rarity: it?.rarity || 'common',
                    icon: it?.icon || '',
                    value: it?.value ?? 0,
                    stack: it?.stack ?? 50,
                  });
                }
              }
            }

            // 3. Ítems del catálogo RPG generado (materiales, muebles, etc.)
            let parsedRpg = { items: {}, recipes: {} };
            try {
              parsedRpg = JSON.parse(rpgText);
              if (parsedRpg.items) {
                for (const [id, it] of Object.entries(parsedRpg.items)) {
                  if (!itemMap.has(id)) {
                    itemMap.set(id, {
                      id,
                      label: it.label || id,
                      category: it.category || 'Material de oficio',
                      rarity: it.rarity || 'common',
                      icon: it.icon || '',
                      value: it.value ?? 0,
                      stack: it.stack ?? 99,
                    });
                  }
                }
              }
            } catch {}

            // Quests
            let quests = [];
            try {
              const qObj = JSON.parse(questText);
              if (Array.isArray(qObj.quests)) {
                quests = qObj.quests.map(q => ({ id: q.id, title: q.title }));
              }
            } catch {}

            const professions = professionsModule?.RPG_CATALOG?.professions ?? {
              carpinteria: 'Carpintería',
              herreria: 'Herrería',
              cocina: 'Cocina',
              alquimia: 'Alquimia',
              sastreria: 'Sastrería',
              ebanisteria: 'Ebanistería',
              joyeria: 'Joyería',
              encantamiento: 'Encantamiento',
              peleteria: 'Peletería',
              minero: 'Minero',
              lenador: 'Leñador',
              recolector: 'Recolector',
            };

            const ranks = professionsModule?.RPG_CATALOG?.ranks ?? [
              'Aprendiz',
              'Iniciado',
              'Oficial',
              'Experto',
              'Maestro',
              'Gran maestro',
            ];

            return {
              items: Array.from(itemMap.values()),
              quests,
              professions,
              ranks,
              existingRecipes: parsedRpg.recipes ?? {},
            };
          };

          // Endpoint /references
          if (request.url === '/references' && request.method === 'GET') {
            send(200, await references());
            return;
          }

          // Endpoint /backup
          if (request.url === '/backup' && request.method === 'POST') {
            const current = await readFile(file, 'utf8');
            const backupsDir = resolve(server.config.root, 'src', 'data', 'backups');
            await mkdir(backupsDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = join(backupsDir, `recipes-backup-${timestamp}.json`);
            await writeFile(backupFile, current, 'utf8');
            send(200, { success: true, backupFile: `src/data/backups/recipes-backup-${timestamp}.json` });
            return;
          }

          // Endpoint /sync-rpg (Sincroniza e incorpora recetas existentes del catálogo RPG)
          if (request.url === '/sync-rpg' && request.method === 'POST') {
            const { syncRpgRecipesIntoCatalog, validateRecipeCatalog } = await server.ssrLoadModule('/src/data/recipesCatalog.ts');
            const current = await readFile(file, 'utf8').catch(async () => {
              const empty = JSON.stringify({ version: 1, stations: [], recipes: [] }, null, 2);
              await writeFile(file, empty, 'utf8');
              return empty;
            });
            const catalog = validateRecipeCatalog(JSON.parse(current));
            const rpgText = await readFile(resolve(server.config.root, 'src', 'data', 'generated', 'rpg-catalog.json'), 'utf8').catch(() => '{"recipes":{},"items":{}}');
            const rpg = JSON.parse(rpgText);
            const result = syncRpgRecipesIntoCatalog(catalog, rpg.recipes || {}, rpg.items || {});

            const content = `${JSON.stringify(catalog, null, 2)}\n`;
            const temporary = join(dirname(file), `.recipes-${randomUUID()}.tmp`);
            try {
              await writeFile(temporary, content, { flag: 'wx' });
              await rename(temporary, file);
            } finally {
              await unlink(temporary).catch(error => {
                if (error.code !== 'ENOENT') throw error;
              });
            }
            send(200, {
              success: true,
              added: result.added,
              existing: result.existing,
              total: result.total,
              catalog,
            }, hash(content));
            return;
          }

          if (request.url !== '/' && request.url !== '') {
            send(404, { error: 'Ruta no válida.' });
            return;
          }

          if (!['GET', 'PUT'].includes(request.method)) {
            response.setHeader('Allow', 'GET, PUT');
            send(405, { error: 'Método no permitido.' });
            return;
          }

          const { validateRecipeCatalog } = await server.ssrLoadModule('/src/data/recipesCatalog.ts');
          const current = await readFile(file, 'utf8').catch(async () => {
            const empty = JSON.stringify({ version: 1, stations: [], recipes: [] }, null, 2);
            await writeFile(file, empty, 'utf8');
            return empty;
          });
          const revision = hash(current);

          let catalog;
          try {
            catalog = validateRecipeCatalog(JSON.parse(current));
          } catch (error) {
            throw new Error(`El catálogo de recetas del proyecto no es válido: ${error.message}`);
          }

          if (request.method === 'GET') {
            send(200, catalog, revision);
            return;
          }

          if (request.headers['if-match'] !== revision) {
            send(409, {
              error: 'El catálogo de recetas cambió en otra ventana o en disco. Exporta tu borrador y recarga el catálogo antes de guardar.',
            });
            return;
          }

          if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
            send(415, { error: 'Se requiere application/json.' });
            return;
          }

          if (Number(request.headers['content-length']) > 4_000_000) {
            request.resume();
            send(413, { error: 'El catálogo de recetas supera los 4 MB permitidos.' });
            return;
          }

          const chunks = [];
          let size = 0;
          for await (const chunk of request.iterator({ destroyOnReturn: false })) {
            size += chunk.length;
            if (size > 4_000_000) {
              request.resume();
              send(413, { error: 'El catálogo de recetas supera los 4 MB.' });
              return;
            }
            chunks.push(chunk);
          }

          let next;
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            next = validateRecipeCatalog(parsed, await references());
          } catch (error) {
            send(400, { error: error.message });
            return;
          }

          const content = `${JSON.stringify(next, null, 2)}\n`;
          const temporary = join(dirname(file), `.recipes-${randomUUID()}.tmp`);
          try {
            await writeFile(temporary, content, { flag: 'wx' });
            if (hash(await readFile(file, 'utf8')) !== revision) {
              send(409, { error: 'El archivo cambió durante el guardado. Recarga el catálogo de recetas.' });
              return;
            }
            await rename(temporary, file);
          } finally {
            await unlink(temporary).catch(error => {
              if (error.code !== 'ENOENT') throw error;
            });
          }

          send(200, next, hash(content));
        };

        const job = pending.then(run);
        pending = job.catch(error => {
          server.config.logger.error(`Editor de recetas: ${error.stack ?? error}`);
          if (!response.writableEnded) {
            send(500, {
              error: 'No se pudo leer o guardar el catálogo de recetas. Revisa la terminal de Vite; no se ha confirmado el guardado.',
            });
          }
        });
      });
    },
  };
}

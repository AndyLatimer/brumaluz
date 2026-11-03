import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

const hash = text => `"${createHash('sha256').update(text).digest('hex')}"`;

export function shopEditorPlugin({ catalogPath } = {}) {
  let catalogFile;

  return {
    name: 'brumaluz-shop-editor',
    apply: 'serve',
    configResolved(config) {
      catalogFile = resolve(catalogPath ?? resolve(config.root, 'src', 'data', 'shopsCatalog.json'));
    },
    handleHotUpdate(context) {
      const normalize = path => (process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path));
      if (normalize(context.file) === normalize(catalogFile)) {
        return [];
      }
    },
    configureServer(server) {
      const file = catalogPath ?? resolve(server.config.root, 'src', 'data', 'shopsCatalog.json');
      let pending = Promise.resolve();

      server.middlewares.use('/__dev/shops', (request, response) => {
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
            send(403, { error: 'El registro de tiendas solo admite solicitudes locales del propio taller.' });
            return;
          }

          const references = async () => {
            const [
              itemsModule,
              itemsCatalogText,
              npcsText,
              rpgText,
              currencyModule,
            ] = await Promise.all([
              server.ssrLoadModule('/src/data/items.ts').catch(() => ({ ITEMS: {}, sellPrice: (id) => 1 })),
              readFile(resolve(server.config.root, 'src/data/itemsCatalog.json'), 'utf8').catch(() => '{"version":1,"items":[]}'),
              readFile(resolve(server.config.root, 'src/data/npcs.json'), 'utf8').catch(() => '{"version":1,"npcs":[]}'),
              readFile(resolve(server.config.root, 'src/data/generated/rpg-catalog.json'), 'utf8').catch(() => '{"items":{}}'),
              server.ssrLoadModule('/src/data/currency.ts').catch(() => ({ CURRENCIES: {}, CURRENCY_ORDER: [] })),
            ]);

            const itemMap = new Map();

            // 1. Catálogo extendido custom
            try {
              const customParsed = JSON.parse(itemsCatalogText);
              if (Array.isArray(customParsed.items)) {
                for (const it of customParsed.items) {
                  const val = it.value ?? 0;
                  const sell = it.sellPrice ?? Math.max(1, Math.floor(val / 2));
                  itemMap.set(it.id, {
                    id: it.id,
                    label: it.label || it.id,
                    category: it.category || 'Objeto',
                    rarity: it.rarity || 'common',
                    icon: it.icon || '',
                    value: val,
                    sellPrice: sell,
                    stack: it.stack ?? 50,
                  });
                }
              }
            } catch {}

            // 2. ITEMS base del juego
            if (itemsModule?.ITEMS) {
              for (const [id, it] of Object.entries(itemsModule.ITEMS)) {
                if (!itemMap.has(id)) {
                  const val = it?.value ?? 0;
                  const sell = typeof itemsModule.sellPrice === 'function' ? itemsModule.sellPrice(id) : Math.max(1, Math.floor(val / 2));
                  itemMap.set(id, {
                    id,
                    label: it?.label || id,
                    category: it?.category || 'Objeto',
                    rarity: it?.rarity || 'common',
                    icon: it?.icon || '',
                    value: val,
                    sellPrice: sell,
                    stack: it?.stack ?? 50,
                  });
                }
              }
            }

            // 3. Catálogo RPG
            try {
              const parsedRpg = JSON.parse(rpgText);
              if (parsedRpg.items) {
                for (const [id, it] of Object.entries(parsedRpg.items)) {
                  if (!itemMap.has(id)) {
                    const val = it.value ?? 0;
                    itemMap.set(id, {
                      id,
                      label: it.label || id,
                      category: it.category || 'Material de oficio',
                      rarity: it.rarity || 'common',
                      icon: it.icon || '',
                      value: val,
                      sellPrice: Math.max(1, Math.floor(val / 2)),
                      stack: it.stack ?? 99,
                    });
                  }
                }
              }
            } catch {}

            // NPCs disponibles
            let npcs = [];
            try {
              const parsedNpcs = JSON.parse(npcsText);
              if (Array.isArray(parsedNpcs.npcs)) {
                npcs = parsedNpcs.npcs.map(n => ({
                  id: n.id,
                  name: n.name || n.id,
                  subtitle: n.subtitle || '',
                  badgeIcon: n.badgeIcon || '',
                }));
              }
            } catch {}

            // Monedas disponibles
            const currencies = (currencyModule.CURRENCY_ORDER || ['pelines', 'lagrimas']).map(id => {
              const def = currencyModule.CURRENCIES?.[id];
              return {
                id,
                label: def?.label || id,
                icon: def?.icon || '',
                premium: Boolean(def?.premium),
              };
            });

            return {
              items: Array.from(itemMap.values()),
              npcs,
              currencies,
            };
          };

          // Endpoint /references
          if (request.url === '/references' && request.method === 'GET') {
            send(200, await references());
            return;
          }

          // Endpoint /backup
          if (request.url === '/backup' && request.method === 'POST') {
            const current = await readFile(file, 'utf8').catch(() => '{"version":1,"shops":[]}');
            const backupsDir = resolve(server.config.root, 'src', 'data', 'backups');
            await mkdir(backupsDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = join(backupsDir, `shops-backup-${timestamp}.json`);
            await writeFile(backupFile, current, 'utf8');
            send(200, { success: true, backupFile: `src/data/backups/shops-backup-${timestamp}.json` });
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

          const { validateShopCatalog } = await server.ssrLoadModule('/src/data/shopsCatalog.ts');
          const current = await readFile(file, 'utf8').catch(async () => {
            const empty = JSON.stringify({ version: 1, shops: [] }, null, 2);
            await writeFile(file, empty, 'utf8');
            return empty;
          });
          const revision = hash(current);

          let catalog;
          try {
            catalog = validateShopCatalog(JSON.parse(current));
          } catch (error) {
            throw new Error(`El catálogo de tiendas del proyecto no es válido: ${error.message}`);
          }

          if (request.method === 'GET') {
            send(200, catalog, revision);
            return;
          }

          // PUT: Guardar cambios
          if (request.headers['if-match'] !== revision) {
            send(409, {
              error: 'El catálogo cambió en otra ventana o en disco. Exporta tu borrador y recarga antes de guardar.',
            });
            return;
          }

          if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
            send(415, { error: 'Se requiere application/json.' });
            return;
          }

          const chunks = [];
          let size = 0;
          for await (const chunk of request.iterator({ destroyOnReturn: false })) {
            size += chunk.length;
            if (size > 4_000_000) {
              request.resume();
              send(413, { error: 'El catálogo supera el límite permitido de 4 MB.' });
              return;
            }
            chunks.push(chunk);
          }

          let next;
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            next = validateShopCatalog(parsed);
          } catch (error) {
            send(400, { error: error.message });
            return;
          }

          const content = `${JSON.stringify(next, null, 2)}\n`;
          const temporary = join(dirname(file), `.shops-${randomUUID()}.tmp`);

          try {
            await writeFile(temporary, content, { flag: 'wx' });
            if (hash(await readFile(file, 'utf8')) !== revision) {
              send(409, { error: 'El archivo cambió en disco durante el guardado. Recarga el taller.' });
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
          server.config.logger.error(`Taller de tiendas: ${error.stack ?? error}`);
          if (!response.writableEnded) {
            send(500, {
              error: 'No se pudo leer o guardar el catálogo de tiendas. Revisa la terminal de desarrollo.',
            });
          }
        });
      });
    },
  };
}


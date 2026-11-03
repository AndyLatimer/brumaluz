import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink, readdir } from 'node:fs/promises';
import { resolve, dirname, join, relative } from 'node:path';

const hash = text => `"${createHash('sha256').update(text).digest('hex')}"`;

export function itemEditorPlugin({ catalogPath } = {}) {
  let catalogFile;

  return {
    name: 'brumaluz-item-editor',
    apply: 'serve',
    configResolved(config) {
      catalogFile = resolve(catalogPath ?? resolve(config.root, 'src', 'data', 'itemsCatalog.json'));
    },
    handleHotUpdate(context) {
      const normalize = path => (process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path));
      if (normalize(context.file) === normalize(catalogFile)) {
        return [];
      }
    },
    configureServer(server) {
      const file = catalogPath ?? resolve(server.config.root, 'src', 'data', 'itemsCatalog.json');
      let pending = Promise.resolve();

      server.middlewares.use('/__dev/items', (request, response) => {
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
            send(403, { error: 'El registro de objetos solo admite solicitudes locales del propio taller.' });
            return;
          }

          const references = async () => {
            const [
              { ITEMS, VENDOR_STOCK },
              questText,
              npcText,
              rpgText,
              shopsText,
            ] = await Promise.all([
              server.ssrLoadModule('/src/data/items.ts'),
              readFile(resolve(server.config.root, 'src/data/questCatalog.json'), 'utf8').catch(() => '{"version":1,"quests":[]}'),
              readFile(resolve(server.config.root, 'src/data/npcs.json'), 'utf8').catch(() => '{"version":1,"npcs":[]}'),
              readFile(resolve(server.config.root, 'src/data/generated/rpg-catalog.json'), 'utf8').catch(() => '{"items":{},"recipes":{}}'),
              readFile(resolve(server.config.root, 'src/data/shopsCatalog.json'), 'utf8').catch(() => '{"version":1,"shops":[]}'),
            ]);

            const quests = JSON.parse(questText).quests.map(q => ({
              id: q.id,
              title: q.title,
              objectiveItems: q.objectives.filter(o => o.type === 'fetch' || o.type === 'craft').map(o => o.target),
              rewardItems: q.rewards?.items?.map(r => r.item) ?? [],
            }));

            const npcs = JSON.parse(npcText).npcs;
            const vendors = Object.entries(VENDOR_STOCK).map(([vendorId, items]) => {
              const npc = npcs.find(n => n.id === vendorId);
              return {
                id: vendorId,
                name: npc ? npc.name : vendorId,
                items: Array.isArray(items) ? items : [],
              };
            });

            // Tiendas del catálogo
            try {
              const shopsParsed = JSON.parse(shopsText);
              if (Array.isArray(shopsParsed.shops)) {
                for (const s of shopsParsed.shops) {
                  if (s.active !== false) {
                    const npc = s.npcId ? npcs.find(n => n.id === s.npcId) : null;
                    const vendorLabel = npc ? `${s.name} (${npc.name})` : s.name;
                    const itemIds = (s.items || []).map(i => i.itemId);
                    vendors.push({
                      id: s.id,
                      name: vendorLabel,
                      items: itemIds,
                    });
                  }
                }
              }
            } catch {}

            const parsedRpg = JSON.parse(rpgText);
            const recipes = Object.entries(parsedRpg.recipes ?? {}).map(([id, r]) => ({
              id,
              output: r.output,
              ingredients: Object.keys(r.ingredients ?? {}),
            }));

            // Modelos 3D disponibles (escaneo rápido de carpetas de objetos)
            const modelDirs = [
              resolve(server.config.root, 'src/assets/models'),
              resolve(server.config.root, 'src/assets/library/adventurers/objects'),
            ];
            const models = [];
            for (const dir of modelDirs) {
              const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
              for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith('.glb')) {
                  const fullPath = join(dir, entry.name);
                  const rel = relative(server.config.root, fullPath).replaceAll('\\', '/');
                  models.push({ id: rel, name: entry.name.replace(/\.glb$/i, ''), path: rel });
                }
              }
            }

            return {
              quests,
              vendors,
              recipes,
              coreItemIds: Object.keys(ITEMS),
              models,
            };
          };

          if (request.url === '/references' && request.method === 'GET') {
            send(200, await references());
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

          const { validateItemCatalog } = await server.ssrLoadModule('/src/data/itemsCatalog.ts');
          const current = await readFile(file, 'utf8');
          const revision = hash(current);

          let catalog;
          try {
            catalog = validateItemCatalog(JSON.parse(current));
          } catch (error) {
            throw new Error(`El catálogo del proyecto no es válido: ${error.message}`);
          }

          if (request.method === 'GET') {
            send(200, catalog, revision);
            return;
          }

          if (request.headers['if-match'] !== revision) {
            send(409, {
              error: 'El catálogo cambió en otra ventana o en disco. Exporta tu borrador y recarga el catálogo antes de guardar.',
            });
            return;
          }

          if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
            send(415, { error: 'Se requiere application/json.' });
            return;
          }

          if (Number(request.headers['content-length']) > 4_000_000) {
            request.resume();
            send(413, { error: 'El catálogo supera los 4 MB.' });
            return;
          }

          const chunks = [];
          let size = 0;
          for await (const chunk of request.iterator({ destroyOnReturn: false })) {
            size += chunk.length;
            if (size > 4_000_000) {
              request.resume();
              send(413, { error: 'El catálogo supera los 4 MB.' });
              return;
            }
            chunks.push(chunk);
          }

          let next;
          try {
            next = validateItemCatalog(JSON.parse(Buffer.concat(chunks).toString('utf8')), await references());
          } catch (error) {
            send(400, { error: error.message });
            return;
          }

          const content = `${JSON.stringify(next, null, 2)}\n`;
          const temporary = join(dirname(file), `.items-${randomUUID()}.tmp`);
          try {
            await writeFile(temporary, content, { flag: 'wx' });
            if (hash(await readFile(file, 'utf8')) !== revision) {
              send(409, { error: 'El archivo cambió durante el guardado. Recarga el catálogo.' });
              return;
            }
            await rename(temporary, file);

            // Generar o sincronizar SQL del servidor Supabase para los ítems
            await generateServerSql(server.config.root, next);
          } finally {
            await unlink(temporary).catch(error => {
              if (error.code !== 'ENOENT') throw error;
            });
          }

          send(200, next, hash(content));
        };

        const job = pending.then(run);
        pending = job.catch(error => {
          server.config.logger.error(`Editor de objetos: ${error.stack ?? error}`);
          if (!response.writableEnded) {
            send(500, {
              error: 'No se pudo leer o guardar el catálogo. Revisa la terminal de Vite; no se ha confirmado el guardado.',
            });
          }
        });
      });
    },
  };
}

async function generateServerSql(projectRoot, catalog) {
  const sqlPath = resolve(projectRoot, 'supabase/server/30-custom-items.sql');
  const lines = [
    '-- Generado automáticamente por el Editor de Objetos de Brumaluz',
    '-- Define los objetos personalizados creados o modificados en itemsCatalog.json',
    '',
    'create or replace function public.game_custom_item(p_item text)',
    'returns jsonb language sql immutable set search_path = \'\' as $$',
    '  select case p_item',
  ];

  for (const item of catalog.items) {
    if (item.active === false) continue;
    const serverProps = {
      value: item.value ?? 0,
      stack: item.stack ?? 50,
      bound: Boolean(item.bound),
      sellable: item.sellable !== false,
      storable: item.storable !== false,
      tradable: item.tradable !== false,
    };
    if (item.equippable && item.slot) {
      serverProps.slot = item.slot;
      if (item.requiredClass && item.requiredClass !== 'any') {
        serverProps.cls = item.requiredClass;
      }
    }
    if (item.food) {
      serverProps.food_seconds = item.food.duration ?? 900;
      serverProps.food_health = item.food.maxHealth ?? 0;
      serverProps.food_resource = item.food.maxResource ?? 0;
    }
    const healEffect = item.effects?.find(e => e.type === 'restore_health');
    if (healEffect) {
      if (healEffect.percent) serverProps.heal_pct = healEffect.percent;
      if (healEffect.value) serverProps.heal_amount = healEffect.value;
    }
    const manaEffect = item.effects?.find(e => e.type === 'restore_mana');
    if (manaEffect) {
      serverProps.resource_pct = manaEffect.percent ?? 5;
      serverProps.resource_kind = 'mana';
    }
    const staminaEffect = item.effects?.find(e => e.type === 'restore_stamina');
    if (staminaEffect) {
      serverProps.resource_pct = staminaEffect.percent ?? 5;
      serverProps.resource_kind = 'stamina';
    }

    lines.push(`    when '${item.id}' then '${JSON.stringify(serverProps)}'::jsonb`);
  }

  lines.push('    else null');
  lines.push('  end');
  lines.push('$$;');
  lines.push('');
  lines.push('-- Extender game_item para consultar tanto items nativos como custom');
  lines.push('create or replace function public.game_item_extended(p_item text)');
  lines.push('returns jsonb language sql immutable set search_path = \'\' as $$');
  lines.push('  select coalesce(public.game_custom_item(p_item), public.game_item(p_item));');
  lines.push('$$;');
  lines.push('revoke all on function public.game_custom_item(text),public.game_item_extended(text) from public,anon,authenticated;');
  lines.push('');

  await writeFile(sqlPath, lines.join('\n'), 'utf8').catch(err => {
    console.error('No se pudo escribir 30-custom-items.sql:', err.message);
  });
}

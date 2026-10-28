import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, rename, unlink, stat } from 'node:fs/promises';
import { resolve, join, sep, relative, dirname } from 'node:path';
import { readLibraryCatalog } from './library-catalog.mjs';
import { collectibleCatalog, collectiblesSql } from './collectibles.mjs';

const hash = text => `"${createHash('sha256').update(text).digest('hex')}"`;
const MAX_BYTES = 48_000_000;
const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const normalize = path => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
const PUBLISHED = '__published';
const HEADER = '// Generado por el editor de mapas («Publicar en el juego»). No lo edites a mano.';
const importPath = (from, to) => { const path = relative(from, to).split(sep).join('/'); return path.startsWith('.') ? path : `./${path}`; };
const ignoreMissing = error => { if (error.code !== 'ENOENT') throw error; };

async function writeAtomic(file, content) {
  const temporary = join(dirname(file), `.publish-${randomUUID()}.tmp`);
  try { await writeFile(temporary, content, { flag: 'wx' }); await rename(temporary, file); }
  finally { await unlink(temporary).catch(ignoreMissing); }
}

/** Mapas publicados (los metadatos se incrustan en `published.ts`). */
async function publishedStatus(publishDir) {
  const source = await readFile(join(publishDir, 'published.ts'), 'utf8').catch(error => { ignoreMissing(error); return ''; });
  const meta = /^const META(?:: \w+\[\])? = (.*);$/m.exec(source);
  const value = meta ? JSON.parse(meta[1]) : [];
  return Array.isArray(value) ? value : [];
}

/** Escribe el índice del mundo: importa estáticamente cada mapa publicado. */
async function writeManifest(publishDir, srcDir, metas) {
  metas.sort((a, b) => a.id.localeCompare(b.id));
  await writeAtomic(join(publishDir, 'published.ts'), [
    HEADER,
    `import type { PublishedWorld, PublishedMapMeta, PublishedMapModule } from '${importPath(publishDir, join(srcDir, 'world', 'mapCity'))}';`,
    // Importación estática: el build es un único archivo con `await` en el nivel superior y un
    // `import()` de un módulo incrustado se evaluaría después de quien lo espera.
    ...metas.map((meta, index) => `import * as m${index} from './maps/${meta.id}';`),
    '',
    `const META: PublishedMapMeta[] = ${JSON.stringify(metas)};`,
    `const MODULES: PublishedMapModule[] = [${metas.map((_, index) => `m${index}`).join(', ')}];`,
    'export const PUBLISHED_WORLD: PublishedWorld = Object.fromEntries(META.map((meta, index) => [meta.id, { ...meta, load: async () => MODULES[index] }]));',
    '',
  ].join('\n'));
}

/**
 * Publica un mapa guardado en el mundo del juego: copia el mapa y genera un módulo que importa solo
 * los GLB de la biblioteca que usa (el build es un único archivo). El resto de mapas publicados se conserva.
 */
async function publishMap(map, { publishDir, libraryDir, srcDir }) {
  const catalog = await readLibraryCatalog(libraryDir);
  const paths = new Map(catalog.assets.map(asset => [asset.id, join(libraryDir, asset.path)]));
  const variants = JSON.parse(await readFile(join(srcDir, 'art', 'mapVariants.json'), 'utf8'));
  for (const [id, file] of Object.entries(variants)) if (paths.has(id)) paths.set(id, join(srcDir, 'assets', file));
  const used = [...new Set(map.objects.map(object => object.asset))]
    .filter(asset => !asset.startsWith('city/') && !asset.startsWith('builtin/')).sort();
  const missing = used.filter(asset => !paths.has(asset));
  if (missing.length) throw Object.assign(new Error(`Recursos que no están en la biblioteca: ${missing.slice(0, 5).join(', ')}`), { status: 422 });
  let bytes = 0;
  for (const asset of used) bytes += (await stat(paths.get(asset))).size;
  const mapsDir = join(publishDir, 'maps');
  await mkdir(mapsDir, { recursive: true });
  // La miniatura se conserva: es el fondo de la pantalla de carga.
  await writeAtomic(join(mapsDir, `${map.id}.json`), `${JSON.stringify(map)}\n`);
  const imports = used.map((asset, index) => `import a${index} from '${importPath(mapsDir, paths.get(asset))}?url';`);
  await writeAtomic(join(mapsDir, `${map.id}.ts`), [
    HEADER,
    `import map from './${map.id}.json';`,
    ...imports,
    '',
    'export { map };',
    'export const assets: Record<string, string> = {',
    ...used.map((asset, index) => `  ${JSON.stringify(asset)}: a${index},`),
    '};',
    '',
  ].join('\n'));
  const meta = {
    id: map.id, name: map.name, kind: map.settings.kind ?? 'zone', region: map.settings.region ?? '', loadingTip: map.settings.loadingTip ?? '',
    publishedAt: new Date().toISOString(), objects: map.objects.length, assets: used.length, bytes,
  };
  const metas = (await publishedStatus(publishDir)).filter(entry => entry.id !== map.id);
  await writeManifest(publishDir, srcDir, [...metas, meta]);
  // Formato antiguo (una sola ciudad).
  for (const name of ['city.ts', 'city.json']) await unlink(join(publishDir, name)).catch(ignoreMissing);
  return meta;
}

async function unpublish(id, { publishDir, srcDir }) {
  await mkdir(publishDir, { recursive: true });
  const metas = await publishedStatus(publishDir);
  const keep = id ? metas.filter(entry => entry.id !== id) : [];
  await writeManifest(publishDir, srcDir, keep);
  for (const entry of metas.filter(entry => !keep.includes(entry))) {
    for (const extension of ['ts', 'json']) await unlink(join(publishDir, 'maps', `${entry.id}.${extension}`)).catch(ignoreMissing);
  }
  for (const name of ['city.ts', 'city.json']) await unlink(join(publishDir, name)).catch(ignoreMissing);
}

const sqlText = value => `'${String(value).replaceAll("'", "''")}'`;
const sqlJson = value => `${sqlText(JSON.stringify(value))}::jsonb`;
const r2 = value => Math.round(value * 100) / 100;

async function publicationTransaction(files, operation) {
  const before = await Promise.all(files.map(async file => [file, await readFile(file).catch(error => { ignoreMissing(error); return null; })]));
  try { return await operation(); }
  catch (error) {
    const failures = [];
    for (const [file, content] of before) {
      try {
        if (content === null) await unlink(file).catch(ignoreMissing);
        else await writeAtomic(file, content);
      } catch (restoreError) { failures.push(restoreError); }
    }
    if (failures.length) throw new AggregateError([error, ...failures], 'Error de publicación y de restauración; revisa los archivos antes de desplegar.');
    throw error;
  }
}

/**
 * Genera supabase/world.sql con los mapas publicados y sus portales para que el servidor valide los viajes.
 * Si Brumaluz no está publicada, se usan las puertas de la Brumaluz procedural.
 */
async function writeWorldSql({ publishDir, sqlFile }, { validateMap, arrivalPoint }, { brumaluzGateMarkers, CAPITAL_MAP }) {
  const maps = new Map();
  for (const meta of await publishedStatus(publishDir)) {
    const doc = validateMap(JSON.parse(await readFile(join(publishDir, 'maps', `${meta.id}.json`), 'utf8')));
    const visible = new Set(doc.layers.filter(layer => layer.visible).map(layer => layer.id));
    maps.set(doc.id, { id: doc.id, name: doc.name, markers: doc.markers.filter(marker => visible.has(marker.layer)), terrain: doc.terrain });
  }
  const proceduralCapital = !maps.has(CAPITAL_MAP);
  if (proceduralCapital) maps.set(CAPITAL_MAP, { id: CAPITAL_MAP, name: 'Brumaluz', markers: brumaluzGateMarkers(), procedural: true });
  const center = map => map.terrain
    ? { x: r2(map.terrain.origin[0] + (map.terrain.columns - 1) * map.terrain.cell / 2), z: r2(map.terrain.origin[1] + (map.terrain.rows - 1) * map.terrain.cell / 2), yaw: 0 }
    : null;
  const spawnOf = map => {
    const spawn = map.markers.find(marker => marker.type === 'spawn');
    return spawn ? { x: r2(spawn.position[0]), z: r2(spawn.position[2]), yaw: r2(spawn.rotationY) } : center(map);
  };
  const lines = [
    '-- Generado por el editor de mapas al publicar. No lo edites a mano.',
    '-- Mapas de Pompelín publicados y sus portales. Se aplica después del SQL del servidor con «npm run db:apply».',
    'delete from public.world_portals;',
    `delete from public.world_maps where id not in (${[...maps.keys()].map(sqlText).join(', ')});`,
  ];
  for (const map of maps.values()) {
    const spawn = map.procedural ? null : spawnOf(map);
    lines.push(spawn
      ? `insert into public.world_maps(id, name, spawn) values (${sqlText(map.id)}, ${sqlText(map.name)}, ${sqlJson(spawn)}) on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;`
      : `insert into public.world_maps(id, name, spawn) select ${sqlText(map.id)}, ${sqlText(map.name)}, value || '{"yaw":0}'::jsonb from public.server_config where key = 'spawn' on conflict (id) do update set name = excluded.name, spawn = excluded.spawn;`);
    const bounds = map.terrain ? {
      minX: map.terrain.origin[0], minZ: map.terrain.origin[1],
      maxX: map.terrain.origin[0] + (map.terrain.columns - 1) * map.terrain.cell,
      maxZ: map.terrain.origin[1] + (map.terrain.rows - 1) * map.terrain.cell,
    } : null;
    lines.push(`update public.world_maps set bounds = ${bounds ? sqlJson(bounds) : 'null'} where id = ${sqlText(map.id)};`);
  }
  // La capital publicada mueve también el punto de inicio y de reaparición.
  const capital = maps.get(CAPITAL_MAP);
  lines.push(capital.procedural
    ? "update public.server_config set value = '{\"x\": -6.4, \"z\": -11.085}'::jsonb where key = 'spawn';"
    : `update public.server_config set value = ${sqlJson({ x: spawnOf(capital).x, z: spawnOf(capital).z })} where key = 'spawn';`);
  if (capital.procedural) lines.push("update public.world_maps set spawn = '{\"x\": -6.4, \"z\": -11.085, \"yaw\": 0}'::jsonb where id = 'brumaluz';");
  const portals = [];
  const warnings = [];
  for (const map of maps.values()) for (const marker of map.markers) {
    if (marker.type !== 'portal') continue;
    if (!marker.target || !maps.has(marker.target.map)) {
      warnings.push(`«${map.name} / ${marker.name}»: camino cerrado; destino sin publicar.`);
      continue;
    }
    const target = maps.get(marker.target.map);
    if (marker.radius < 0.5 || marker.radius > 100) throw Object.assign(new Error(`El portal «${marker.name}» debe tener un radio entre 0,5 y 100 m.`), { status: 422 });
    if (marker.target.arrival && !target.markers.some(item => item.type === 'arrival' && item.id === marker.target.arrival)) {
      throw Object.assign(new Error(`La llegada «${marker.target.arrival}» de «${map.name} / ${marker.name}» no existe o está oculta en «${target.name}».`), { status: 422 });
    }
    const arrival = arrivalPoint(target, marker.target.arrival);
    const point = arrival ? { x: r2(arrival.position[0]), z: r2(arrival.position[2]), yaw: r2(arrival.rotationY) } : spawnOf(target) ?? { x: -6.4, z: -11.085, yaw: 0 };
    portals.push(`(${sqlText(map.id)}, ${sqlText(marker.id)}, ${r2(marker.position[0])}, ${r2(marker.position[2])}, ${r2(Math.min(100, marker.radius))}, ${sqlText(target.id)}, ${sqlJson(point)})`);
  }
  if (portals.length) lines.push(`insert into public.world_portals(map, id, x, z, radius, target_map, target) values\n  ${portals.join(',\n  ')};`);
  const collectibles = collectibleCatalog(maps.values());
  lines.push(collectiblesSql(collectibles));
  lines.push('');
  await mkdir(dirname(sqlFile), { recursive: true });
  await writeAtomic(sqlFile, lines.join('\n'));
  await writeAtomic(join(publishDir, 'collectibles.json'), `${JSON.stringify(collectibles, null, 2)}\n`);
  return warnings;
}

/** API local del editor de mapas: lista, abre, guarda y elimina `src/data/maps/<id>.json` y publica mapas en el mundo del juego. */
export function mapEditorPlugin({ mapsDir, publishDir: publishOption, sqlFile: sqlOption } = {}) {
  let directory, publishDir, libraryDir, srcDir, sqlFile;
  return {
    name: 'brumaluz-map-editor',
    apply: 'serve',
    configResolved(config) {
      srcDir = resolve(config.root, 'src');
      directory = resolve(mapsDir ?? resolve(srcDir, 'data', 'maps'));
      publishDir = resolve(publishOption ?? resolve(srcDir, 'data', 'world'));
      sqlFile = resolve(sqlOption ?? resolve(config.root, 'supabase', 'world.sql'));
      libraryDir = resolve(srcDir, 'assets', 'library');
    },
    handleHotUpdate(context) {
      // Los mapas no son módulos del juego: guardarlos no debe recargar el editor.
      if (normalize(context.file).startsWith(normalize(directory) + sep)) return [];
      // La publicación avisa por su cuenta (ver `notifyPublished`): solo se recargan las pestañas del juego.
      if (normalize(context.file).startsWith(normalize(publishDir) + sep)) return [];
    },
    configureServer(server) {
      let pending = Promise.resolve();
      server.middlewares.use('/__dev/maps', (request, response) => {
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
            request.resume(); send(403, { error: 'El editor de mapas solo admite solicitudes locales.' }); return;
          }
          const path = (request.url ?? '/').split('?')[0];
          const id = path.replace(/^\/+|\/+$/g, '');
          const { validateMap, mapSummary, arrivalPoint } = await server.ssrLoadModule('/src/data/maps.ts');
          await mkdir(directory, { recursive: true });
          if (id === PUBLISHED || id.startsWith(`${PUBLISHED}/`)) {
            const options = { publishDir, libraryDir, srcDir };
            const target = id.slice(PUBLISHED.length + 1);
            const persistPublication = async operation => {
              const ids = new Set((await publishedStatus(publishDir)).map(meta => meta.id));
              if (typeof operation.id === 'string') ids.add(operation.id);
              const files = [join(publishDir, 'published.ts'), join(publishDir, 'city.ts'), join(publishDir, 'city.json'), join(publishDir, 'collectibles.json'), sqlFile,
                ...[...ids].flatMap(id => ['ts', 'json'].map(ext => join(publishDir, 'maps', `${id}.${ext}`)))];
              return publicationTransaction(files, async () => {
                const result = await operation.run();
                const warnings = await writeWorldSql({ publishDir, sqlFile }, { validateMap, arrivalPoint }, await server.ssrLoadModule('/src/data/pompelin.ts'));
                return { result, warnings };
              });
            };
            const notifyPublished = () => {
              for (const module of server.moduleGraph.fileToModulesMap.entries()) {
                const [file, modules] = module;
                if (!normalize(file).startsWith(normalize(publishDir) + sep)) continue;
                for (const item of modules) server.moduleGraph.invalidateModule(item);
              }
              server.ws.send({ type: 'custom', event: 'brumaluz:city-published' });
            };
            if (request.method === 'GET') { request.resume(); send(200, { published: await publishedStatus(publishDir) }); return; }
            if (request.method === 'DELETE') {
              request.resume();
              if (target && !ID.test(target)) { send(400, { error: 'ID de mapa no válido.' }); return; }
              await persistPublication({ run: () => unpublish(target || null, options) });
              notifyPublished();
              send(200, { published: await publishedStatus(publishDir) }); return;
            }
            if (request.method !== 'POST') { request.resume(); response.setHeader('Allow', 'GET, POST, DELETE'); send(405, { error: 'Método no permitido.' }); return; }
            if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
              request.resume(); send(415, { error: 'Se requiere application/json.' }); return;
            }
            let body = '';
            for await (const chunk of request.iterator({ destroyOnReturn: false })) {
              body += chunk;
              if (body.length > 4096) { request.resume(); send(413, { error: 'Solicitud demasiado grande.' }); return; }
            }
            let source;
            try { source = JSON.parse(body); } catch { send(400, { error: 'JSON no válido.' }); return; }
            if (typeof source?.id !== 'string' || !ID.test(source.id)) { send(400, { error: 'ID de mapa no válido.' }); return; }
            const content = await readFile(join(directory, `${source.id}.json`), 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
            if (content === null) { send(404, { error: `No existe el mapa "${source.id}". Guárdalo antes de publicarlo.` }); return; }
            if (source.revision && source.revision !== hash(content)) { send(409, { error: 'El mapa guardado no coincide con el que tienes abierto. Guarda antes de publicar.' }); return; }
            let map;
            try { map = validateMap(JSON.parse(content)); }
            catch (error) { send(422, { error: `El archivo del mapa no es válido: ${error.message}` }); return; }
            try {
              const { result, warnings } = await persistPublication({ id: map.id, run: () => publishMap(map, options) });
              notifyPublished();
              send(200, { published: { ...result, warnings } });
            }
            catch (error) { if (error.status) { send(error.status, { error: error.message }); return; } throw error; }
            return;
          }
          if (!id) {
            if (request.method !== 'GET') { request.resume(); response.setHeader('Allow', 'GET'); send(405, { error: 'Método no permitido.' }); return; }
            const maps = [];
            for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
              if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
              const fileId = entry.name.slice(0, -5);
              if (!ID.test(fileId)) continue;
              const content = await readFile(join(directory, entry.name), 'utf8');
              try {
                const map = validateMap(JSON.parse(content));
                if (map.id !== fileId) throw new Error(`el ID interno (${map.id}) no coincide con el archivo`);
                maps.push(mapSummary(map, hash(content)));
              } catch (error) { maps.push({ id: fileId, name: fileId, error: error.message, revision: hash(content) }); }
            }
            send(200, { maps }); return;
          }
          if (!ID.test(id)) { request.resume(); send(404, { error: 'ID de mapa no válido.' }); return; }
          if (!['GET', 'PUT', 'DELETE'].includes(request.method)) {
            request.resume(); response.setHeader('Allow', 'GET, PUT, DELETE'); send(405, { error: 'Método no permitido.' }); return;
          }
          const file = join(directory, `${id}.json`);
          const current = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
          const revision = current === null ? null : hash(current);
          if (request.method === 'GET') {
            if (current === null) { send(404, { error: `No existe el mapa "${id}".` }); return; }
            let map;
            try { map = validateMap(JSON.parse(current)); }
            catch (error) { send(422, { error: `El archivo del mapa no es válido: ${error.message}` }, revision); return; }
            send(200, map, revision); return;
          }
          const matches = current === null ? request.headers['if-none-match'] === '*' : request.headers['if-match'] === revision;
          if (!matches) {
            request.resume();
            send(current === null && request.method === 'DELETE' ? 404 : 409, {
              error: current === null
                ? (request.method === 'DELETE' ? `No existe el mapa "${id}".` : 'El mapa ya no existe en disco. Guárdalo como nuevo.')
                : 'El mapa cambió en otra ventana o en disco. Exporta tu copia y vuelve a abrirlo antes de guardar.',
            }); return;
          }
          if (request.method === 'DELETE') {
            if (hash(await readFile(file, 'utf8')) !== revision) { send(409, { error: 'El mapa cambió mientras se eliminaba.' }); return; }
            await unlink(file);
            send(200, { deleted: id }); return;
          }
          if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
            request.resume(); send(415, { error: 'Se requiere application/json.' }); return;
          }
          if (Number(request.headers['content-length']) > MAX_BYTES) {
            request.resume(); send(413, { error: 'El mapa supera los 48 MB.' }); return;
          }
          const chunks = [];
          let size = 0;
          for await (const chunk of request.iterator({ destroyOnReturn: false })) {
            size += chunk.length;
            if (size > MAX_BYTES) { request.resume(); send(413, { error: 'El mapa supera los 48 MB.' }); return; }
            chunks.push(chunk);
          }
          let next;
          try { next = validateMap(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
          catch (error) { send(400, { error: error.message }); return; }
          if (next.id !== id) { send(400, { error: 'El ID del mapa no coincide con la ruta.' }); return; }
          const content = `${JSON.stringify(next)}\n`;
          const temporary = join(directory, `.map-${randomUUID()}.tmp`);
          try {
            await writeFile(temporary, content, { flag: 'wx' });
            const now = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
            if ((now === null ? null : hash(now)) !== revision) {
              send(409, { error: 'El archivo cambió durante el guardado. Vuelve a abrir el mapa.' }); return;
            }
            await rename(temporary, file);
          } finally {
            await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
          }
          send(current === null ? 201 : 200, mapSummary(next, hash(content)), hash(content));
        };
        const job = pending.then(run);
        pending = job.catch(error => {
          server.config.logger.error(`Editor de mapas: ${error.stack ?? error}`);
          if (!response.writableEnded) send(500, { error: 'No se pudo leer o guardar el mapa. Revisa la terminal de Vite.' });
        });
      });
    },
  };
}

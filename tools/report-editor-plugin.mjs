import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export function reportEditorPlugin({ reportsDir: customReportsDir } = {}) {
  let reportsDir;
  let bugsFile;
  let screenshotsDir;

  return {
    name: 'brumaluz-report-editor',
    apply: 'serve',
    configResolved(config) {
      reportsDir = resolve(customReportsDir ?? resolve(config.root, 'reports'));
      bugsFile = join(reportsDir, 'bugs.json');
      screenshotsDir = join(reportsDir, 'screenshots');
    },
    configureServer(server) {
      const rootReportsDir = customReportsDir ?? resolve(server.config.root, 'reports');
      const rootBugsFile = join(rootReportsDir, 'bugs.json');
      const rootScreenshotsDir = join(rootReportsDir, 'screenshots');

      const ensureDirs = async () => {
        await mkdir(rootReportsDir, { recursive: true });
        await mkdir(rootScreenshotsDir, { recursive: true });
      };

      const readReports = async () => {
        try {
          const text = await readFile(rootBugsFile, 'utf8');
          const data = JSON.parse(text);
          if (Array.isArray(data.reports)) return data;
          return { version: 1, reports: [] };
        } catch {
          return { version: 1, reports: [] };
        }
      };

      const writeReports = async (data) => {
        await ensureDirs();
        await writeFile(rootBugsFile, JSON.stringify(data, null, 2), 'utf8');
      };

      server.middlewares.use('/__dev/reports', (request, response, next) => {
        const send = (status, data, contentType = 'application/json; charset=utf-8') => {
          response.statusCode = status;
          response.setHeader('Content-Type', contentType);
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Access-Control-Allow-Origin', '*');
          response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
          response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          if (typeof data === 'string' || Buffer.isBuffer(data)) {
            response.end(data);
          } else {
            response.end(JSON.stringify(data));
          }
        };

        if (request.method === 'OPTIONS') {
          send(204, '');
          return;
        }

        const run = async () => {
          const url = new URL(request.url || '/', 'http://localhost');
          const pathname = url.pathname;

          // Servir capturas guardadas: GET /screenshot/:id
          if (request.method === 'GET' && pathname.startsWith('/screenshot/')) {
            const id = pathname.replace('/screenshot/', '').replace(/[^a-zA-Z0-9_-]/g, '');
            const filePath = join(rootScreenshotsDir, `${id}.jpg`);
            try {
              const buffer = await readFile(filePath);
              send(200, buffer, 'image/jpeg');
            } catch {
              send(404, { error: 'Captura no encontrada' });
            }
            return;
          }

          // GET /__dev/reports
          if ((pathname === '/' || pathname === '') && request.method === 'GET') {
            const data = await readReports();
            send(200, data);
            return;
          }

          // POST /__dev/reports
          if ((pathname === '/' || pathname === '') && request.method === 'POST') {
            let bodyText = '';
            for await (const chunk of request) {
              bodyText += chunk;
            }

            let body;
            try {
              body = JSON.parse(bodyText);
            } catch {
              send(400, { error: 'Cuerpo JSON inválido' });
              return;
            }

            await ensureDirs();
            const id = body.id || `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            let screenshotPath = body.screenshotPath || '';

            // Si viene una imagen en base64, guardarla en disco
            if (body.screenshot && typeof body.screenshot === 'string' && body.screenshot.startsWith('data:image/')) {
              const base64Data = body.screenshot.replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              const filename = `${id}.jpg`;
              const filePath = join(rootScreenshotsDir, filename);
              await writeFile(filePath, buffer);
              screenshotPath = `reports/screenshots/${filename}`;
            }

            const now = new Date();
            const report = {
              id,
              timestamp: body.timestamp || now.toISOString(),
              dateFormatted: body.dateFormatted || now.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }),
              title: (body.title || '').trim() || 'Sin título',
              description: (body.description || '').trim(),
              category: body.category || 'bug',
              severity: body.severity || 'normal',
              status: body.status || 'pending',
              resolutionNotes: body.resolutionNotes || '',
              screenshotPath,
              screenshotUrl: `/__dev/reports/screenshot/${id}`,
              location: body.location || null,
              camera: body.camera || null,
              character: body.character || null,
              system: body.system || null,
              gameplay: body.gameplay || null,
            };

            const data = await readReports();
            data.reports = [report, ...data.reports.filter(r => r.id !== id)];
            await writeReports(data);

            send(201, { ok: true, report });
            return;
          }

          // PATCH /__dev/reports/:id
          const patchMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)$/);
          if (patchMatch && request.method === 'PATCH') {
            const id = patchMatch[1];
            let bodyText = '';
            for await (const chunk of request) {
              bodyText += chunk;
            }

            let updates;
            try {
              updates = JSON.parse(bodyText);
            } catch {
              send(400, { error: 'Cuerpo JSON inválido' });
              return;
            }

            const data = await readReports();
            const idx = data.reports.findIndex(r => r.id === id);
            if (idx === -1) {
              send(404, { error: 'Reporte no encontrado' });
              return;
            }

            data.reports[idx] = {
              ...data.reports[idx],
              ...updates,
              id, // Conservar ID original
            };
            await writeReports(data);

            send(200, { ok: true, report: data.reports[idx] });
            return;
          }

          // DELETE /__dev/reports/:id
          const deleteMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)$/);
          if (deleteMatch && request.method === 'DELETE') {
            const id = deleteMatch[1];
            const data = await readReports();
            data.reports = data.reports.filter(r => r.id !== id);
            await writeReports(data);

            try {
              await unlink(join(rootScreenshotsDir, `${id}.jpg`));
            } catch {}

            send(200, { ok: true, id });
            return;
          }

          send(404, { error: 'Ruta no encontrada en el sistema de reportes' });
        };

        run().catch((error) => {
          console.error('[Brumaluz Report Server Error]', error);
          send(500, { error: error instanceof Error ? error.message : String(error) });
        });
      });
    },
  };
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { formatReportToMarkdown } from '../src/dev/bugReportStorage.ts';
import { reportEditorPlugin } from '../tools/report-editor-plugin.mjs';

test('formatReportToMarkdown formats bug reports cleanly for AI assistant and devs', () => {
  const sampleReport = {
    id: 'rep-test-123',
    timestamp: '2026-11-03T01:30:00.000Z',
    dateFormatted: '03/11/2026, 01:30',
    title: 'Hueco sin colisión en el puente',
    description: 'El personaje se cae a través del tablón central al correr.',
    category: 'bug',
    severity: 'high',
    status: 'pending',
    screenshotPath: 'reports/screenshots/rep-test-123.jpg',
    location: {
      zone: 'brumaluz',
      zoneName: 'Brumaluz',
      position: { x: 14.52, y: 1.2, z: -38.4 },
      yawDegrees: 180,
    },
    camera: { yaw: 3.14, pitch: 0.5, dist: 12 },
    character: { name: 'Alanna', race: 'humano', cls: 'guerrero' },
    system: { userAgent: 'Mozilla/5.0', viewport: { width: 1920, height: 1080 }, pixelRatio: 1, graphicsMode: 'normal' },
  };

  const md = formatReportToMarkdown(sampleReport);

  assert.match(md, /### \[🐛 Bug \/ Error\] Hueco sin colisión en el puente/);
  assert.match(md, /\*\*ID\*\*: `rep-test-123`/);
  assert.match(md, /\*\*Zona\*\*: `brumaluz` \(Brumaluz\)/);
  assert.match(md, /\*\*Posición\*\*: `X: 14\.52, Y: 1\.20, Z: -38\.40`/);
  assert.match(md, /\*\*Personaje\*\*: Alanna \(humano, guerrero\)/);
  assert.match(md, /El personaje se cae a través del tablón central al correr/);
  assert.match(md, /reports\/screenshots\/rep-test-123\.jpg/);
});

test('reportEditorPlugin handles CRUD endpoints and base64 screenshot writing', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'brumaluz-reports-test-'));

  try {
    const plugin = reportEditorPlugin({ reportsDir: tempDir });
    let middleware;
    const mockServer = {
      config: { root: tempDir },
      middlewares: {
        use(route, handler) {
          if (route === '/__dev/reports') middleware = handler;
        },
      },
    };

    plugin.configResolved({ root: tempDir });
    plugin.configureServer(mockServer);

    assert.ok(middleware, 'El middleware /__dev/reports debe registrarse');

    const requestHandler = (method, urlPath, body = null) => {
      return new Promise((resolve, reject) => {
        const chunks = body ? [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))] : [];
        const req = {
          method,
          url: urlPath,
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) yield chunk;
          },
        };

        let responseBody = '';
        let isBuffer = false;
        let headers = {};
        const res = {
          statusCode: 200,
          setHeader(k, v) { headers[k] = v; },
          end(data) {
            if (Buffer.isBuffer(data)) {
              isBuffer = true;
              responseBody = data;
            } else {
              responseBody += data || '';
            }
            resolve({
              statusCode: res.statusCode,
              headers,
              body: isBuffer ? responseBody : (headers['Content-Type']?.includes('application/json') && responseBody ? JSON.parse(responseBody) : responseBody),
            });
          },
        };

        middleware(req, res, reject);
      });
    };

    // 1. GET inicial (vacío)
    const initialGet = await requestHandler('GET', '/');
    assert.equal(initialGet.statusCode, 200);
    assert.deepEqual(initialGet.body.reports, []);

    // 2. POST nuevo reporte con captura de prueba (1x1 pixel JPEG en base64)
    const dummyJpegBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const postRes = await requestHandler('POST', '/', {
      id: 'rep-test-01',
      title: 'Farol desalineado',
      description: 'El farol de la plaza flota 20 cm sobre el suelo.',
      category: 'visual',
      severity: 'low',
      screenshot: dummyJpegBase64,
      location: {
        zone: 'brumaluz',
        zoneName: 'Brumaluz',
        position: { x: 5, y: 0.2, z: -10 },
        yawDegrees: 90,
      },
    });

    assert.equal(postRes.statusCode, 201);
    assert.equal(postRes.body.ok, true);
    assert.equal(postRes.body.report.id, 'rep-test-01');
    assert.equal(postRes.body.report.screenshotPath, 'reports/screenshots/rep-test-01.jpg');

    // Verificar que el archivo de imagen se escribió en disco
    const savedImgBuffer = await readFile(join(tempDir, 'screenshots', 'rep-test-01.jpg'));
    assert.ok(savedImgBuffer.length > 0, 'La captura de pantalla debe haberse escrito en disco');

    // 3. GET de la captura vía /screenshot/:id
    const imgGet = await requestHandler('GET', '/screenshot/rep-test-01');
    assert.equal(imgGet.statusCode, 200);
    assert.equal(imgGet.headers['Content-Type'], 'image/jpeg');

    // 4. PATCH actualizar estado
    const patchRes = await requestHandler('PATCH', '/rep-test-01', {
      status: 'resolved',
      resolutionNotes: 'Ajustada la altura del farol en mapCity.ts',
    });
    assert.equal(patchRes.statusCode, 200);
    assert.equal(patchRes.body.report.status, 'resolved');
    assert.equal(patchRes.body.report.resolutionNotes, 'Ajustada la altura del farol en mapCity.ts');

    // 5. GET final
    const listGet = await requestHandler('GET', '/');
    assert.equal(listGet.statusCode, 200);
    assert.equal(listGet.body.reports.length, 1);
    assert.equal(listGet.body.reports[0].status, 'resolved');

    // 6. DELETE reporte
    const deleteRes = await requestHandler('DELETE', '/rep-test-01');
    assert.equal(deleteRes.statusCode, 200);
    assert.equal(deleteRes.body.ok, true);

    const emptyGet = await requestHandler('GET', '/');
    assert.equal(emptyGet.body.reports.length, 0);

  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('browser client captures screenshot on F8 and handles review workflow', { timeout: 60000 }, async () => {
  let server, browser;
  const testPort = 4252;
  try {
    server = await createServer({
      server: { host: '127.0.0.1', port: testPort, strictPort: true, hmr: false, watch: null },
      logLevel: 'error',
    });
    await server.listen();

    browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${testPort}/?test=1`);

    // Esperar a que el juego arranque
    await page.waitForSelector('#scene');
    await page.waitForFunction(() => typeof window.brumaluz !== 'undefined');

    // 1. Comprobar que los diálogos están ocultos al inicio
    const initiallyHidden = await page.$eval('#bug-report-backdrop', el => el.hidden);
    assert.equal(initiallyHidden, true);

    // 2. Pulsar tecla F8
    await page.keyboard.press('F8');
    await page.waitForFunction(() => !document.getElementById('bug-report-backdrop').hidden);

    // 3. Comprobar que se ha tomado la captura y el canvas de anotación se ha cargado
    const canvasValid = await page.$eval('#bug-annotation-canvas', el => el.width > 0 && el.height > 0);
    assert.equal(canvasValid, true, 'El canvas de anotación debe tener las dimensiones de la captura');

    // 4. Escribir descripción y título
    await page.fill('#bug-title-input', 'Test Bug Automático');
    await page.fill('#bug-desc-input', 'Descripción de prueba para verificar guardado');

    // 5. Guardar reporte
    await page.click('#bug-btn-submit');
    await page.waitForFunction(() => document.getElementById('bug-report-backdrop').hidden);

    // 6. Abrir visor de revisión con Shift+F8
    await page.keyboard.press('Shift+F8');
    await page.waitForFunction(() => !document.getElementById('bug-review-backdrop').hidden);

    // 7. Comprobar que aparece en la lista
    await page.waitForSelector('.bug-card');
    const firstCardTitle = await page.$eval('.bug-card-title', el => el.textContent);
    assert.match(firstCardTitle, /Test Bug Automático/);

    // 8. Cambiar estado a Resuelto
    await page.click('#btn-status-resolved');
    await page.waitForFunction(() => {
      const pill = document.querySelector('#bug-report-detail .bug-status-pill');
      return pill && pill.textContent.includes('Resuelto');
    });

    // 9. Eliminar reporte de prueba para limpiar
    await page.evaluate(async () => {
      const res = await fetch('/__dev/reports');
      const data = await res.json();
      for (const r of data.reports) {
        if (r.title === 'Test Bug Automático') {
          await fetch(`/__dev/reports/${encodeURIComponent(r.id)}`, { method: 'DELETE' });
        }
      }
    });

    // Cerrar visor
    await page.click('#bug-review-close-btn');
    await page.waitForFunction(() => document.getElementById('bug-review-backdrop').hidden);

  } finally {
    await browser?.close();
    await server?.close();
  }
});

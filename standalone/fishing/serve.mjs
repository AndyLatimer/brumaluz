/**
 * @file serve.mjs
 * Servidor estático ligero y sin dependencias para ejecutar el prototipo de pesca
 * independientemente desde Node.js en cualquier entorno.
 *
 * Uso:
 *   node standalone/fishing/serve.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function createServer(port) {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') {
      reqPath = '/index.html';
    }

    const safePath = path.normalize(path.join(__dirname, reqPath));

    // Seguridad: no salir de la carpeta standalone/fishing
    if (!safePath.startsWith(__dirname)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Acceso denegado');
      return;
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Archivo no encontrado: ${reqPath}`);
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });

      fs.createReadStream(safePath).pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Puerto ${port} ocupado, probando con ${port + 1}...`);
      createServer(port + 1);
    } else {
      console.error('Error al iniciar el servidor:', err);
    }
  });

  server.listen(port, () => {
    console.log('\n======================================================');
    console.log('  🐟 PROTOTIPO DE PESCA COZY - BRUMALUZ');
    console.log('======================================================');
    console.log(`  Servidor activo en: http://localhost:${port}/`);
    console.log('  Abre la URL en tu navegador para jugar al minijuego.');
    console.log('  Presiona Ctrl+C para detener el servidor.');
    console.log('======================================================\n');
  });
}

const START_PORT = parseInt(process.env.PORT || '3030', 10);
createServer(START_PORT);

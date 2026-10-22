// Reglas del servidor: el SQL está repartido por temas en supabase/server/ y se ejecuta siempre como un único
// script, uniendo los archivos en el orden de su nombre (00-config.sql, 01-world-clock.sql…).
// Uso directo: `npm run db:sql > servidor.sql` lo vuelca entero (p. ej. para pegarlo en el SQL Editor de Supabase).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const folder = new URL('../supabase/server/', import.meta.url);

/** Archivos del servidor, en orden de ejecución. */
export function serverSqlFiles() {
  return readdirSync(folder).filter(name => name.endsWith('.sql')).sort().map(name => fileURLToPath(new URL(name, folder)));
}

/** Todo el SQL del servidor, listo para ejecutarse en una sola consulta (idempotente). */
export function serverSql() {
  return serverSqlFiles().map(file => readFileSync(file, 'utf8')).join('\n\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.stdout.write(serverSql());

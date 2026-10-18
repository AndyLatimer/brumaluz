// Aplica supabase/server.sql (idempotente) a la base de datos indicada en SUPABASE_DB_URL (.env.local).
// Uso: npm run db:apply            (solo server.sql)
//      npm run db:apply -- --schema (schema.sql y después server.sql)
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnv('.env.local');
loadEnv('.env');

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Falta SUPABASE_DB_URL en .env.local (Supabase → Project Settings → Database → Connection string).');
  process.exit(1);
}

const files = process.argv.includes('--schema') ? ['supabase/schema.sql', 'supabase/server.sql'] : ['supabase/server.sql'];
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  for (const file of files) {
    await client.query(readFileSync(file, 'utf8'));
    console.log(`OK  ${file}`);
  }
  // Recarga la caché de esquema de la API para que las funciones nuevas se vean al momento.
  await client.query("notify pgrst, 'reload schema'");
} catch (error) {
  console.error('Error aplicando el SQL:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

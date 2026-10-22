// Aplica el SQL del servidor (supabase/server/, idempotente) y supabase/world.sql (mapas y portales publicados desde el
// editor de mapas) a la base de datos indicada en SUPABASE_DB_URL (.env.local).
// Uso: npm run db:apply            (servidor + world.sql)
//      npm run db:apply -- --schema (schema.sql, servidor y world.sql)
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';
import { serverSql } from './server-sql.mjs';

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

// El servidor se ejecuta como un único script (sus archivos unidos en orden), igual que antes de repartirlo.
const scripts = [
  ...(process.argv.includes('--schema') ? [['supabase/schema.sql', () => readFileSync('supabase/schema.sql', 'utf8')]] : []),
  ['supabase/server/', serverSql],
  ...(existsSync('supabase/world.sql') ? [['supabase/world.sql', () => readFileSync('supabase/world.sql', 'utf8')]] : []),
];
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
let transaction = false;
try {
  await client.connect();
  await client.query('begin');
  transaction = true;
  for (const [name, sql] of scripts) {
    await client.query(sql());
    console.log(`OK  ${name}`);
  }
  // Recarga la caché de esquema de la API para que las funciones nuevas se vean al momento.
  await client.query("notify pgrst, 'reload schema'");
  await client.query('commit');
  transaction = false;
} catch (error) {
  console.error('Error aplicando el SQL:', error.message);
  if (transaction) {
    try { await client.query('rollback'); }
    catch (rollbackError) { console.error('Error deshaciendo la transacción:', rollbackError.message); }
  }
  process.exitCode = 1;
} finally {
  await client.end();
}

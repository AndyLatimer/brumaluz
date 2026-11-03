// Isolated PostgreSQL/WASM: creation and public appearance, without a live database.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const modulePath = process.env.PGLITE_TEST_MODULE ?? join(tmpdir(), 'brumaluz-combat-sql-tools/node_modules/@electric-sql/pglite/dist/index.js');
let available = true; try { await access(modulePath); } catch { available = false; }
test('creation validates and persists every walking style, defaults old clients to A and shares it publicly', { skip: !available, timeout: 60000 }, async () => {
  const { PGlite } = await import(pathToFileURL(modulePath).href), db = new PGlite();
  const definition = (source, name) => {
    const start = source.indexOf(`create or replace function public.${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('$$;', source.indexOf('as $$', start)) + 3);
  };
  const [creation, presence, combat] = await Promise.all(['04-character-actions.sql', '06-world-presence.sql', '21-rpg-combat.sql']
    .map(name => readFile(new URL(`../supabase/server/${name}`, import.meta.url), 'utf8')));
  try {
    await db.exec(`
      create schema auth;
      create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
      create table public.characters(id uuid primary key default gen_random_uuid(), user_id uuid, name text, data jsonb);
      create table public.server_config(key text, value text);
      insert into public.server_config values('welcome_enabled','true');
    `);
    await db.exec(definition(creation, 'create_character'));
    const numericKeys = ['sex', 'height', 'build', 'skin', 'face', 'hair', 'hairColor', 'beard', 'eyeShape', 'eyeColor', 'brows', 'nose', 'mouth', 'detail', 'trait', 'primary', 'secondary', 'cape', 'clothA', 'clothB', 'hairAcc', 'hairAccColor', 'acc', 'makeup', 'makeupColor', 'accColor'];
    const base = { ...Object.fromEntries(numericKeys.map(key => [key, 0])), name: 'Miel', race: 'humano', cls: 'guerrero', attributePoints: { fuerza: 2 }, level: 50, experience: 9999 };
    const create = async data => (await db.query('select public.create_character($1) id', [data])).rows[0].id;
    for (const walkStyle of [0, 1, 2]) {
      const id = await create({ ...base, walkStyle });
      const data = (await db.query('select data from public.characters where id=$1', [id])).rows[0].data;
      assert.equal(data.walkStyle, walkStyle); assert.equal(data.level, 1); assert.equal(data.experience, 0);
      assert.equal(data.welcome.stage, 'available'); assert.equal(data.introSeen, false);
    }
    const oldId = await create(base);
    assert.equal((await db.query('select data from public.characters where id=$1', [oldId])).rows[0].data.walkStyle, 0);
    for (const walkStyle of [-1, 3, .5, '2', null, {}, true])
      await assert.rejects(create({ ...base, walkStyle }));
    for (const source of [presence, combat]) {
      await db.exec(definition(source, 'game_public_character'));
      const data = (await db.query('select public.game_public_character($1) data', [{ ...base, walkStyle: 2, wallet: { pelines: 999 } }])).rows[0].data;
      assert.equal(data.walkStyle, 2); assert.equal(data.wallet, undefined);
    }
  } finally { await db.close(); }
});

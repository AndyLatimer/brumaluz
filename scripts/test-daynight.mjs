import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

// Hora del mundo: la del servidor manda, el cliente la deja correr y sin conexión calcula la misma.
let server, clock;

before(async () => {
  server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true } });
  clock = await server.ssrLoadModule('/src/data/worldClock.ts');
});
after(async () => { await server?.close(); });

test('el cliente usa el mismo origen y ritmo que server_config.world_clock', () => {
  const sql = readFileSync('supabase/server.sql', 'utf8');
  const config = JSON.parse(/\('world_clock', '([^']+)'::jsonb\)/.exec(sql)[1]);
  assert.equal(config.seconds_per_hour, clock.SECONDS_PER_WORLD_HOUR);
  assert.equal(clock.localWorldHour(config.epoch * 1000), config.start_hour);
  // Diez minutos reales son una hora del mundo; un día del mundo, cuatro horas reales.
  assert.ok(Math.abs(clock.localWorldHour((config.epoch + 600) * 1000) - (config.start_hour + 1)) < 1e-9);
  assert.ok(Math.abs(clock.localWorldHour((config.epoch + 4 * 3600) * 1000) - config.start_hour) < 1e-9);
});

test('la hora del servidor se sigue y corre sola entre sincronizaciones', () => {
  assert.equal(clock.parseWorldClock(null), null);
  assert.equal(clock.parseWorldClock({ hour: 'x', secondsPerHour: 600 }), null);
  assert.deepEqual(clock.parseWorldClock({ hour: 25.5, secondsPerHour: 600 }), { hour: 1.5, secondsPerHour: 600 });
  clock.syncWorldClock({ hour: 23.5, secondsPerHour: 600 }, 0);
  assert.equal(clock.worldHour(0), 23.5);
  assert.ok(Math.abs(clock.worldHour(600_000) - 0.5) < 1e-9, 'Pasa la medianoche');
  // La latencia (menos de un minuto del mundo) no mueve el reloj; un cambio real de hora, sí.
  clock.syncWorldClock({ hour: 23.51, secondsPerHour: 600 }, 0);
  assert.equal(clock.worldHour(0), 23.5);
  clock.syncWorldClock({ hour: 12, secondsPerHour: 600 }, 0);
  assert.equal(clock.worldHour(0), 12);
});

test('el reloj se muestra en horas y minutos', () => {
  assert.equal(clock.formatWorldTime(0), '00:00');
  assert.equal(clock.formatWorldTime(7.0833), '07:04');
  assert.equal(clock.formatWorldTime(23.999), '23:59');
  assert.equal(clock.formatWorldTime(24.25), '00:15');
});

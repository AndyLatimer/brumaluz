// @ts-check
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server, browser, page;

before(async () => {
  server = await createServer({
    cacheDir: 'node_modules/.vite-fishing-test',
    server: { host: '127.0.0.1', port: 4198, strictPort: true, hmr: false, watch: null },
    logLevel: 'error',
  });
  server.middlewares.use('/__fishing_test', (_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><title>Fishing Integration Test</title>');
  });
  await server.listen();

  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
  });
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.goto('http://127.0.0.1:4198/__fishing_test', { timeout: 60000 });
  await page.evaluate(async () => {
    const { loadKits } = await import('/src/character/character.ts');
    await loadKits();
  });
}, { timeout: 120000 });

after(async () => {
  await browser?.close();
  await server?.close();
});

test('1. Catálogo de Objetos de Pesca (Cañas, Cebos y Peces)', async () => {
  const result = await page.evaluate(async () => {
    const { itemDef } = await import('/src/data/items.ts');
    const { FISHING_ITEMS } = await import('/src/data/fishingItems.ts');

    const rods = ['cana_pesca_sauce', 'cana_pesca_bambu', 'cana_pesca_fresno', 'cana_pesca_roble'];
    const baits = ['cebo_lombriz', 'cebo_gusano_seda', 'cebo_baya_rio', 'cebo_insecto_bruma'];
    const fish = [
      'pez_trucha_plateada', 'pez_perca_atigrada', 'pez_siluro_olmo', 'pez_carpa_dorada',
      'pez_salmon_alba', 'pez_lucio_esmeralda', 'pez_anguila_luminosa', 'pez_esturion_ancestral',
      'pez_luna_mistico', 'pez_draco_alevin'
    ];

    const rodsValid = rods.every(id => {
      const def = itemDef(id);
      return def && def.category === 'tool' && def.label && def.icon;
    });

    const baitsValid = baits.every(id => {
      const def = itemDef(id);
      return def && (def.category === 'consumable' || def.category === 'food') && def.label;
    });

    const fishValid = fish.every(id => {
      const def = itemDef(id);
      return def && def.label && def.rarity;
    });

    return {
      totalFishingItems: Object.keys(FISHING_ITEMS).length,
      rodsValid,
      baitsValid,
      fishValid,
      mythicalFishRarity: itemDef('pez_draco_alevin')?.rarity,
    };
  });

  assert.equal(result.totalFishingItems, 18, 'Debe haber 18 ítems registrados en FISHING_ITEMS (4 cañas + 4 cebos + 10 peces)');
  assert.ok(result.rodsValid, 'Todas las cañas deben estar definidas como tool con label e icono');
  assert.ok(result.baitsValid, 'Todos los cebos deben estar definidos como consumable con label');
  assert.ok(result.fishValid, 'Todos los peces deben estar definidos como material con rareza válida');
  assert.equal(result.mythicalFishRarity, 'artifact', 'El pez draco-alevín debe tener rareza artifact');
});

test('2. Geometría 3D Procedural de Caña de Pescar (BufferGeometry)', async () => {
  const result = await page.evaluate(async () => {
    const { gatheringToolGeometry } = await import('/src/world/resourceModels.ts');
    
    const geometries = [0, 1, 2, 3].map(tier => {
      const geom = gatheringToolGeometry('pescador', tier);
      return {
        tier,
        hasPositions: geom.attributes.position.count > 0,
        hasColors: geom.attributes.color.count > 0,
        vertexCount: geom.attributes.position.count,
      };
    });

    return { geometries };
  });

  assert.equal(result.geometries.length, 4, 'Debe haber geometrías para los 4 tiers');
  for (const g of result.geometries) {
    assert.ok(g.hasPositions, `Tier ${g.tier} debe tener vértices de posición`);
    assert.ok(g.hasColors, `Tier ${g.tier} debe tener colores de vértice horneados`);
    assert.ok(g.vertexCount >= 100, `Tier ${g.tier} debe tener suficiente detalle low-poly`);
  }
});

test('3. Rig del Personaje y Ciclo de Animaciones de Pesca', async () => {
  const result = await page.evaluate(async () => {
    const { Character } = await import('/src/character/character.ts');
    const { defaultChar } = await import('/src/data/data.ts');

    const char = new Character(defaultChar(), { outfit: false });
    char.update(0);

    // Inicio de pesca
    const started = char.beginFishing(0);
    const hasTool = char.hasFishingRod;
    const initialPhase = char.fishingPhase;

    // Transiciones de fases
    char.setFishingPhase('CASTING');
    const castPhase = char.fishingPhase;

    char.setFishingPhase('WAITING');
    const waitingPhase = char.fishingPhase;

    char.setFishingPhase('REELING');
    const reelingPhase = char.fishingPhase;

    char.setFishingPhase('RESULT');
    const resultPhase = char.fishingPhase;

    // Fin de pesca
    char.endFishing();
    const toolAfterEnd = char.hasFishingRod;
    const phaseAfterEnd = char.fishingPhase;

    char.dispose();

    return {
      started,
      hasTool,
      initialPhase,
      castPhase,
      waitingPhase,
      reelingPhase,
      resultPhase,
      toolAfterEnd,
      phaseAfterEnd,
    };
  });

  assert.ok(result.started, 'beginFishing debe devolver true');
  assert.ok(result.hasTool, 'beginFishing debe equipar la caña 3D en la mano del personaje');
  assert.equal(result.castPhase, 'CASTING', 'Debe cambiar a fase CASTING');
  assert.equal(result.waitingPhase, 'WAITING', 'Debe cambiar a fase WAITING');
  assert.equal(result.reelingPhase, 'REELING', 'Debe cambiar a fase REELING');
  assert.equal(result.resultPhase, 'RESULT', 'Debe cambiar a fase RESULT');
  assert.equal(result.toolAfterEnd, false, 'endFishing debe retirar la caña 3D');
  assert.equal(result.phaseAfterEnd, null, 'endFishing debe limpiar la fase de pesca');
});

test('4. Detección de Interacción en el Mundo y Estado de Pesca', async () => {
  const result = await page.evaluate(async () => {
    const { fishingInteractions, isFishingActive, stopFishing } = await import('/src/game/fishing.ts');
    const { play } = await import('/src/game/state.ts');

    play.mode = 'play';

    const mockCity = {
      locationId: 'brumaluz',
      groundY: (x, z) => 0,
      waterAt: (x, z) => {
        if (z > 2) return { surface: 0, deep: true };
        return null;
      },
    };

    const initialActive = isFishingActive();
    stopFishing();
    const afterStop = isFishingActive();

    // Comprobar detección de puntos escénicos
    const pos = { x: 0, y: 0, z: 0 };
    const interactions = fishingInteractions(mockCity, pos);

    return {
      initialActive,
      afterStop,
      interactionCount: interactions.length,
      interactionIds: interactions.map(i => i.id),
      interactionLabels: interactions.map(i => i.label),
    };
  });

  assert.equal(result.initialActive, false, 'Inicialmente la pesca debe estar inactiva');
  assert.equal(result.afterStop, false, 'stopFishing debe mantener o dejar inactivo');
  assert.ok(result.interactionCount >= 3, 'Debe detectar al menos los puntos escénicos de Brumaluz');
  assert.ok(result.interactionIds.includes('fishing:muelle_faroles'), 'Debe incluir Muelle de los Faroles');
  assert.ok(result.interactionIds.includes('fishing:canal_olmo'), 'Debe incluir Canal del Olmo');
  assert.ok(result.interactionIds.includes('fishing:rio_brumaluz'), 'Debe incluir Río Brumaluz');
});

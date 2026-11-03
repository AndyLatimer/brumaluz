import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const outDir = 'art/promocional';
await mkdir(outDir, { recursive: true });

const server = await createServer({
  cacheDir: 'node_modules/.vite-promo-capture',
  server: { host: '127.0.0.1', port: 4298, strictPort: true, hmr: false, watch: null },
  logLevel: 'error'
});

let browser;
try {
  await server.listen();
  console.log('Vite server running on port 4298');

  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    reducedMotion: 'reduce'
  });

  page.on('pageerror', err => console.error('Page error:', err.message));

  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-ambient', 'off');
    localStorage.setItem('brumaluz-menu-music', 'off');
    localStorage.setItem('brumaluz-language', 'es');
  });

  await page.route(/https:\/\/[^/]+\.supabase\.co\//, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  );

  console.log('Navigating to game...');
  await page.goto('http://127.0.0.1:4298/?test&welcome&graphics=compatible', {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });

  await page.waitForFunction(() => window.brumaluz, null, { timeout: 120000 });

  // Helper to hide all UI and make the scene cinematic
  async function hideUiAndClean() {
    await page.evaluate(() => {
      let style = document.getElementById('cinematic-hide-ui');
      if (!style) {
        style = document.createElement('style');
        style.id = 'cinematic-hide-ui';
        style.textContent = `
          canvas#scene {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 999999 !important;
          }
          body > *:not(canvas#scene) {
            display: none !important;
            visibility: hidden !important;
          }
        `;
        document.head.appendChild(style);
      }
    });
  }

  // Set up character with aesthetic outfit
  await page.evaluate(async () => {
    window.brumaluz.set({
      name: 'Aventurera de Brumaluz',
      race: 'humano',
      cls: 'mago',
      hair: 14,
      hairColor: 3,
      clothA: 17, // Cozy deep amber/russet
      clothB: 24, // Warm teal
      introSeen: true,
      welcome: { stage: 'completed', origin: 0 }
    });
    window.brumaluz.play();
  });

  await hideUiAndClean();
  await page.waitForTimeout(1000);

  // 1. CAPTURA: Brumaluz Capital al atardecer
  console.log('Capturing 1: Brumaluz Capital...');
  await page.evaluate(async () => {
    const { syncWorldClock } = await import('/src/data/worldClock.ts');
    const { switchGameMap } = await import('/src/game/cities.ts');
    await switchGameMap('brumaluz');
    syncWorldClock({ hour: 19.4, secondsPerHour: 36000 }); // Atardecer con faroles encendidos
    window.brumaluz.move(12, 14);
    window.brumaluz.view(0.5, 0.22, 11);
    window.brumaluz.spin(0.5);
    window.brumaluz.char().wave();
  });
  await hideUiAndClean();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/captura_01_brumaluz_capital.png` });

  // 2. CAPTURA: Pompelín - Las Praderas y el Gran Puente
  console.log('Capturing 2: Pompelín Praderas y Gran Puente...');
  await page.evaluate(async () => {
    const { syncWorldClock } = await import('/src/data/worldClock.ts');
    const { switchGameMap } = await import('/src/game/cities.ts');
    const { holder, camTarget } = await import('/src/game/stage.ts');
    const { play } = await import('/src/game/state.ts');

    await switchGameMap('pompelin');
    syncWorldClock({ hour: 10.5, secondsPerHour: 36000 }); // Sol radiante matutino

    const x = 352, z = 280;
    const platform = play.city.platformY(x, z);
    window.brumaluz.move(x, z);
    if (platform !== null) {
      holder.position.y = platform;
      play.groundHeight = platform;
      play.lastPlatformY = platform;
    }
    camTarget.copy(holder.position);
    camTarget.y += 1.2;
    window.brumaluz.view(1.1, 0.22, 14);
  });
  await hideUiAndClean();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/captura_02_pompelin_gran_puente.png` });

  // 3. CAPTURA: La Arboleda Mística
  console.log('Capturing 3: La Arboleda...');
  await page.evaluate(async () => {
    const { syncWorldClock } = await import('/src/data/worldClock.ts');
    syncWorldClock({ hour: 16.5, secondsPerHour: 36000 }); // Tarde dorada entre copas
    window.brumaluz.move(670, -168);
    window.brumaluz.view(0.35, 0.22, 12);
  });
  await hideUiAndClean();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/captura_03_arboleda_mistica.png` });

  // 4. CAPTURA: Hogar Acogedor - Casa del Olmo
  console.log('Capturing 4: Hogar en Casa del Olmo...');
  await page.evaluate(async () => {
    const { switchGameMap } = await import('/src/game/cities.ts');
    const { syncWorldClock } = await import('/src/data/worldClock.ts');
    syncWorldClock({ hour: 20.8, secondsPerHour: 36000 });
    await switchGameMap('casa_del_olmo');
    window.brumaluz.move(0, 0.6);
    window.brumaluz.view(0.35, 0.45, 6.5);
  });
  await hideUiAndClean();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/captura_04_hogar_casa_del_olmo.png` });

  // 5. CAPTURA: Taller de Ebanistería y Artesanía
  console.log('Capturing 5: Taller de Ebanistería...');
  await page.evaluate(async () => {
    const { switchGameMap } = await import('/src/game/cities.ts');
    await switchGameMap('taller_ebanisteria_interior');
    window.brumaluz.move(0, 1.0);
    window.brumaluz.view(0.3, 0.4, 7.5);
  });
  await hideUiAndClean();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/captura_05_taller_artesano.png` });

  console.log('All promotional captures completed successfully!');
} catch (error) {
  console.error('Error during promo capture:', error);
} finally {
  await browser?.close();
  await server?.close();
}

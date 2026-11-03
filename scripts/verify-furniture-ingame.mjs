import { createServer } from 'vite';
import { chromium } from 'playwright';

async function verify() {
  const server = await createServer({
    optimizeDeps: { noDiscovery: true, entries: [] },
    server: { host: '127.0.0.1', port: 4295, strictPort: true, hmr: false, watch: null },
    logLevel: 'error'
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });

    await page.route(/https:\/\/[^/]+\.supabase\.co\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
    await page.goto('http://127.0.0.1:4295/?test&graphics=compatible');
    await page.waitForFunction(() => window.brumaluz, null, { timeout: 60000 });

    // 1. Setup inventory with various furniture items
    await page.evaluate(async () => {
      window.brumaluz.set({ introSeen: true, welcome: { stage: 'completed', origin: 0 }, shadowQuest: 'returned' });
      window.brumaluz.play();
      const { session } = await import('/src/game/state.ts');
      session.state.inventory = [
        { id: 'mueble_arcon_0', count: 1 },
        { id: 'mueble_arcon_4', count: 1 },
        { id: 'mueble_biblioteca_1', count: 1 },
        { id: 'mueble_biblioteca_5', count: 1 },
        { id: 'mueble_mesa_2', count: 1 },
        { id: 'mueble_estacion_3', count: 1 },
        { id: 'mueble_silla_1', count: 2 },
        { id: 'mueble_farol_3', count: 2 },
        { id: 'mueble_macetero_2', count: 2 },
        { id: 'mueble_alfombra_4', count: 1 },
        { id: 'componente_ebanisteria_0', count: 15 },
        { id: 'mueble_biombo_2', count: 1 },
      ];
      const { setWindow } = await import('/src/ui/menus.ts');
      setWindow('inventory');
    });

    await page.waitForTimeout(800);
    const invScreenshotPath = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a/in_game_inventory_furniture.png';
    await page.screenshot({ path: invScreenshotPath });
    console.log('In-game furniture inventory screenshot saved:', invScreenshotPath);

    // 2. Open Ebanistería recipes in professions window
    await page.evaluate(async () => {
      const { selectProfessionTab } = await import('/src/ui/professionsWindow.ts');
      const { setWindow } = await import('/src/ui/menus.ts');
      selectProfessionTab('recipes', 'ebanisteria');
      setWindow('professions');
    });

    await page.waitForTimeout(800);
    const profScreenshotPath = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a/in_game_professions_ebanisteria.png';
    await page.screenshot({ path: profScreenshotPath });
    console.log('In-game ebanisteria professions screenshot saved:', profScreenshotPath);
  } finally {
    await browser?.close();
    await server.close();
  }
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});


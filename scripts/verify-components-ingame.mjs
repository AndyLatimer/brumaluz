import { createServer } from 'vite';
import { chromium } from 'playwright';

async function verify() {
  const server = await createServer({
    optimizeDeps: { noDiscovery: true, entries: [] },
    server: { host: '127.0.0.1', port: 4292, strictPort: true, hmr: false, watch: null },
    logLevel: 'error'
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });

    await page.route(/https:\/\/[^/]+\.supabase\.co\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
    await page.goto('http://127.0.0.1:4292/?test&graphics=compatible');
    await page.waitForFunction(() => window.brumaluz, null, { timeout: 60000 });

    // 1. Setup inventory with all crafting components
    await page.evaluate(async () => {
      window.brumaluz.set({ introSeen: true, welcome: { stage: 'completed', origin: 0 }, shadowQuest: 'returned' });
      window.brumaluz.play();
      const { session } = await import('/src/game/state.ts');
      session.state.inventory = [
        { id: 'material_minero_0', count: 15 },
        { id: 'material_lenador_0', count: 12 },
        { id: 'componente_herreria_0', count: 5 },
        { id: 'componente_sastreria_0', count: 4 },
        { id: 'componente_peleteria_0', count: 6 },
        { id: 'componente_carpinteria_0', count: 3 },
        { id: 'componente_ebanisteria_0', count: 2 },
        { id: 'componente_joyeria_0', count: 4 },
        { id: 'componente_alquimia_0', count: 8 },
        { id: 'componente_encantamiento_0', count: 3 },
        { id: 'componente_cocina_0', count: 10 },
        { id: 'cuero_0', count: 12 },
        { id: 'cuero_1', count: 7 },
        { id: 'cuero_2', count: 5 },
      ];
      const { setWindow } = await import('/src/ui/menus.ts');
      setWindow('inventory');
    });

    await page.waitForTimeout(700);
    const invScreenshotPath = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a/in_game_inventory_all_components.png';
    await page.screenshot({ path: invScreenshotPath });
    console.log('In-game inventory screenshot saved:', invScreenshotPath);

    // 2. Open professions window (Tailoring / Sastrería recipes)
    await page.evaluate(async () => {
      const { selectProfessionTab } = await import('/src/ui/professionsWindow.ts');
      const { setWindow } = await import('/src/ui/menus.ts');
      selectProfessionTab('recipes', 'sastreria');
      setWindow('professions');
    });

    await page.waitForTimeout(700);
    const profScreenshotPath = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a/in_game_professions_sastreria.png';
    await page.screenshot({ path: profScreenshotPath });
    console.log('In-game tailoring professions screenshot saved:', profScreenshotPath);
  } finally {
    await browser?.close();
    await server.close();
  }
}

verify().catch(console.error);


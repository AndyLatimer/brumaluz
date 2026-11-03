import { createServer } from 'vite';
import { chromium } from 'playwright';

async function verify() {
  const server = await createServer({
    optimizeDeps: { noDiscovery: true, entries: [] },
    server: { host: '127.0.0.1', port: 4293, strictPort: true, hmr: false, watch: null },
    logLevel: 'error'
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });

    await page.route(/https:\/\/[^/]+\.supabase\.co\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
    await page.goto('http://127.0.0.1:4293/?test&graphics=compatible');
    await page.waitForFunction(() => window.brumaluz, null, { timeout: 60000 });

    // 1. Setup inventory with various potions and components
    await page.evaluate(async () => {
      window.brumaluz.set({ introSeen: true, welcome: { stage: 'completed', origin: 0 }, shadowQuest: 'returned' });
      window.brumaluz.play();
      const { session } = await import('/src/game/state.ts');
      session.state.inventory = [
        { id: 'pocion_vida_minuscula', count: 10 },
        { id: 'pocion_health_1', count: 5 },
        { id: 'pocion_health_3', count: 2 },
        { id: 'pocion_mana_minuscula', count: 8 },
        { id: 'pocion_mana_2', count: 4 },
        { id: 'pocion_estamina_minuscula', count: 12 },
        { id: 'pocion_stamina_1', count: 6 },
        { id: 'pocion_stamina_4', count: 1 },
        { id: 'componente_alquimia_0', count: 15 },
        { id: 'material_minero_0', count: 20 },
      ];
      const { setWindow } = await import('/src/ui/menus.ts');
      setWindow('inventory');
    });

    await page.waitForTimeout(700);
    const invScreenshotPath = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a/in_game_inventory_potions.png';
    await page.screenshot({ path: invScreenshotPath });
    console.log('In-game potions inventory screenshot saved:', invScreenshotPath);

    // 2. Open alchemy recipes in professions window
    await page.evaluate(async () => {
      const { selectProfessionTab } = await import('/src/ui/professionsWindow.ts');
      const { setWindow } = await import('/src/ui/menus.ts');
      selectProfessionTab('recipes', 'alquimia');
      setWindow('professions');
    });

    await page.waitForTimeout(700);
    const profScreenshotPath = 'C:/Users/sevil/.gemini/antigravity/brain/346256b4-e3d2-43b8-9080-f6b02a48f32a/in_game_professions_alquimia.png';
    await page.screenshot({ path: profScreenshotPath });
    console.log('In-game alchemy professions screenshot saved:', profScreenshotPath);
  } finally {
    await browser?.close();
    await server.close();
  }
}

verify().catch(console.error);


import { createServer } from 'vite';
import { chromium } from 'playwright';

async function verify() {
  const server = await createServer({
    optimizeDeps: { noDiscovery: true, entries: [] },
    server: { host: '127.0.0.1', port: 4290, strictPort: true, hmr: false, watch: null },
    logLevel: 'error'
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });

    await page.route(/https:\/\/[^/]+\.supabase\.co\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
    await page.goto('http://127.0.0.1:4290/?test&graphics=compatible');
    await page.waitForFunction(() => window.brumaluz, null, { timeout: 60000 });

    await page.evaluate(async () => {
      window.brumaluz.set({ introSeen: true, welcome: { stage: 'completed', origin: 0 }, shadowQuest: 'returned' });
      window.brumaluz.play();
      const { session } = await import('/src/game/state.ts');
      session.state.inventory = [
        { id: 'material_minero_0', count: 12 },
        { id: 'material_lenador_0', count: 8 },
        { id: 'componente_herreria_0', count: 5 }
      ];
      const { setWindow } = await import('/src/ui/menus.ts');
      const { selectProfessionTab } = await import('/src/ui/professionsWindow.ts');
      selectProfessionTab('recipes', 'herreria');
      setWindow('professions');
    });

    await page.waitForTimeout(600);
    const screenshotPath = 'C:/Users/sevil/.gemini/antigravity/brain/820f133d-7bd5-41bf-8dee-1f128721b5f5/in_game_professions_herreria.png';
    await page.screenshot({ path: screenshotPath });
    console.log('In-game professions screenshot captured:', screenshotPath);
  } finally {
    await browser?.close();
    await server.close();
  }
}

verify().catch(console.error);

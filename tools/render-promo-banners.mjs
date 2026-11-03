import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';

const outDir = 'art/promocional';
await mkdir(outDir, { recursive: true });

const server = await createServer({
  cacheDir: 'node_modules/.vite-promo-banners',
  server: { host: '127.0.0.1', port: 4299, strictPort: true, hmr: false, watch: null },
  logLevel: 'error'
});

const emblemSvg = await readFile('src/assets/brand/brumaluz-emblem.svg', 'utf8');

let browser;
try {
  await server.listen();
  console.log('Vite server running on port 4299');

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
  await page.goto('http://127.0.0.1:4299/?test&welcome&graphics=compatible', {
    waitUntil: 'domcontentloaded',
    timeout: 120000
  });

  await page.waitForFunction(() => window.brumaluz, null, { timeout: 120000 });

  // 1. Enter game mode once
  await page.evaluate(async () => {
    window.brumaluz.set({
      name: 'Aventurera de Brumaluz',
      race: 'humano',
      cls: 'mago',
      hair: 14,
      hairColor: 3,
      clothA: 17,
      clothB: 24,
      introSeen: true,
      welcome: { stage: 'completed', origin: 0 }
    });
    window.brumaluz.play();
  });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.brumaluz?.city?.(), null, { timeout: 60000 });

  // 2. Injects the promotional banner styling & layout
  await page.evaluate(({ emblem }) => {
    // 1. Hide default game UI
    const hideStyle = document.createElement('style');
    hideStyle.textContent = `
      #player-hud, #chat, #minimap, #game-menu, #access-settings,
      #interact-prompt, #action-bar, #active-buffs, .nameplate,
      #dialog, #destination-indicator, #toast, .toast-container,
      .chat-peek, .game-menu-dock, #loading, #account-gate,
      #damage-vignette, #low-health-vignette, #quest-tracker {
        display: none !important;
        visibility: hidden !important;
      }
      body > *:not(canvas#scene):not(#promo-frame) {
        display: none !important;
      }
      canvas#scene {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 1 !important;
      }
    `;
    document.head.appendChild(hideStyle);

    // 2. Create the promotional banner frame
    const frame = document.createElement('div');
    frame.id = 'promo-frame';
    frame.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Cinzel:wght@600;700&family=Alegreya:ital,wght@0,500;0,700;1,400&display=swap');

        #promo-frame {
          position: fixed;
          inset: 0;
          z-index: 999999;
          pointer-events: none;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 38px 48px;
          border: 1px solid rgba(226, 180, 84, 0.45);
          box-shadow: inset 0 0 120px rgba(10, 8, 6, 0.75), inset 0 0 0 1px rgba(226, 180, 84, 0.25);
          font-family: 'Alegreya', Georgia, serif;
        }

        /* Ornate Corners */
        .promo-ornament {
          position: absolute;
          width: 28px;
          height: 28px;
          color: #f0cd80;
          font-size: 20px;
          display: grid;
          place-items: center;
          text-shadow: 0 0 8px rgba(240, 205, 128, 0.8);
        }
        .promo-ornament.tl { top: 10px; left: 10px; }
        .promo-ornament.tr { top: 10px; right: 10px; }
        .promo-ornament.bl { bottom: 10px; left: 10px; }
        .promo-ornament.br { bottom: 10px; right: 10px; }

        /* Top Bar */
        .promo-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(180deg, rgba(14, 10, 8, 0.88) 0%, rgba(14, 10, 8, 0.45) 75%, rgba(14, 10, 8, 0) 100%);
          margin: -38px -48px 0 -48px;
          padding: 28px 48px 40px 48px;
        }

        .promo-brand-container {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .promo-brand-emblem {
          width: 52px;
          height: 62px;
          filter: drop-shadow(0 3px 10px rgba(0,0,0,0.85));
        }

        .promo-brand-titles {
          display: flex;
          flex-direction: column;
        }

        .promo-brand-kicker {
          font-family: 'Cinzel', serif;
          font-size: 13px;
          letter-spacing: 4px;
          color: #dfbe82;
          text-transform: uppercase;
          text-shadow: 0 2px 5px rgba(0,0,0,0.9);
        }

        .promo-brand-main {
          font-family: 'Cinzel Decorative', 'Cinzel', serif;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 2px;
          background: linear-gradient(180deg, #fff4d1 0%, #e5ba5e 55%, #a6722c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 3px 8px rgba(0,0,0,0.9));
        }

        .promo-stamp {
          background: rgba(22, 16, 12, 0.65);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(226, 180, 84, 0.5);
          border-radius: 4px;
          padding: 8px 18px;
          font-family: 'Cinzel', serif;
          font-size: 13px;
          letter-spacing: 2.5px;
          color: #f1e2c2;
          text-transform: uppercase;
          box-shadow: 0 4px 15px rgba(0,0,0,0.6);
        }

        /* Bottom Promotional Card */
        .promo-footer-card {
          margin: 0 -48px -38px -48px;
          padding: 48px 52px 34px 52px;
          background: linear-gradient(0deg, rgba(12, 9, 7, 0.96) 0%, rgba(14, 10, 8, 0.85) 60%, rgba(14, 10, 8, 0) 100%);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .promo-card-tag {
          align-self: flex-start;
          background: rgba(226, 180, 84, 0.16);
          border: 1px solid rgba(226, 180, 84, 0.7);
          color: #ffe2a0;
          font-family: 'Cinzel', serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          padding: 5px 16px;
          border-radius: 3px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }

        .promo-card-title {
          margin: 0;
          font-family: 'Cinzel', serif;
          font-size: 42px;
          font-weight: 700;
          letter-spacing: 1px;
          background: linear-gradient(180deg, #ffffff 0%, #fae6b2 45%, #e0b050 85%, #aa772c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.95));
          line-height: 1.1;
        }

        .promo-card-rule {
          display: flex;
          align-items: center;
          gap: 14px;
          color: #c49646;
          font-size: 14px;
          max-width: 500px;
        }
        .promo-card-rule::before, .promo-card-rule::after {
          content: "";
          height: 1px;
          flex: 1;
          background: linear-gradient(90deg, transparent, #c49646, transparent);
        }

        .promo-card-desc {
          margin: 0;
          font-size: 21px;
          line-height: 1.45;
          color: #f7ebd0;
          font-style: italic;
          text-shadow: 0 2px 8px rgba(0,0,0,0.95);
          max-width: 1050px;
        }

        .promo-card-badges {
          display: flex;
          gap: 12px;
          margin-top: 6px;
        }

        .promo-badge-item {
          font-family: 'Cinzel', serif;
          font-size: 12px;
          letter-spacing: 1.5px;
          color: #dfbe82;
          background: rgba(30, 22, 16, 0.6);
          border: 1px solid rgba(226, 180, 84, 0.35);
          padding: 4px 12px;
          border-radius: 3px;
          text-transform: uppercase;
        }
      </style>

      <span class="promo-ornament tl">✦</span>
      <span class="promo-ornament tr">✦</span>
      <span class="promo-ornament bl">✦</span>
      <span class="promo-ornament br">✦</span>

      <div class="promo-header-bar">
        <div class="promo-brand-container">
          <div class="promo-brand-emblem">${emblem}</div>
          <div class="promo-brand-titles">
            <span class="promo-brand-kicker">Crónicas de</span>
            <span class="promo-brand-main">Brumaluz</span>
          </div>
        </div>
        <div class="promo-stamp" id="promo-stamp">Un mundo por descubrir</div>
      </div>

      <div class="promo-footer-card">
        <div class="promo-card-tag" id="promo-tag">Categoría</div>
        <h1 class="promo-card-title" id="promo-title">Título Promocional</h1>
        <div class="promo-card-rule"><span>❖</span></div>
        <p class="promo-card-desc" id="promo-desc">Descripción detallada de la característica del juego.</p>
        <div class="promo-card-badges" id="promo-badges"></div>
      </div>
    `;
    document.body.appendChild(frame);

    window.updatePromoCard = ({ stamp, tag, title, desc, badges }) => {
      document.getElementById('promo-stamp').textContent = stamp || 'Un mundo por descubrir';
      document.getElementById('promo-tag').textContent = tag;
      document.getElementById('promo-title').textContent = title;
      document.getElementById('promo-desc').textContent = desc;
      const bContainer = document.getElementById('promo-badges');
      bContainer.innerHTML = '';
      for (const b of badges) {
        const span = document.createElement('span');
        span.className = 'promo-badge-item';
        span.textContent = b;
        bContainer.appendChild(span);
      }
    };
  }, { emblem: emblemSvg });

  // 1. BANNER 1: Vida de Barrio y Acogida (Brumaluz Capital)
  console.log('Rendering Banner 1: Vida de Barrio...');
  await page.evaluate(async () => {
    const { syncWorldClock } = await import('/src/data/worldClock.ts');
    const { switchGameMap } = await import('/src/game/cities.ts');
    await switchGameMap('brumaluz');
    syncWorldClock({ hour: 19.3, secondsPerHour: 36000 });
    window.brumaluz.move(12, 14);
    window.brumaluz.view(0.5, 0.22, 11);
    window.brumaluz.spin(0.5);
    window.brumaluz.char().wave();

    window.updatePromoCard({
      stamp: 'Brumaluz Capital',
      tag: 'Vida de Barrio & Comunidad',
      title: 'La Calidez de Brumaluz',
      desc: 'Entre faroles dorados, callejuelas empedradas y la suave bruma, descubre una capital viva donde cada vecino comparte su oficio, su mesa y su historia.',
      badges: ['✦ Plaza Central', '✦ 54 Habitantes', '✦ Cozy RPG', '✦ Pompelín']
    });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/banner_01_vida_de_barrio.png` });

  // 2. BANNER 2: Exploración de Pompelín y el Gran Puente
  console.log('Rendering Banner 2: Exploración de Pompelín...');
  await page.evaluate(async () => {
    const { syncWorldClock } = await import('/src/data/worldClock.ts');
    const { switchGameMap } = await import('/src/game/cities.ts');
    const { holder, camTarget } = await import('/src/game/stage.ts');
    const { play } = await import('/src/game/state.ts');

    await switchGameMap('pompelin');
    syncWorldClock({ hour: 10.3, secondsPerHour: 36000 });

    const x = 345.625, z = 281.875;
    const platform = play.city.platformY(x, z);
    window.brumaluz.move(x, z);
    if (platform !== null) {
      holder.position.y = platform;
      play.groundHeight = platform;
      play.lastPlatformY = platform;
    }
    camTarget.copy(holder.position);
    camTarget.y += 1.3;
    window.brumaluz.view(0.65, 0.35, 12);
    window.brumaluz.spin(0.65);
    window.brumaluz.char().wave();

    window.updatePromoCard({
      stamp: 'Continente de Pompelín',
      tag: 'Exploración & Naturaleza',
      title: 'Un Vasto Mundo por Descubrir',
      desc: 'Cruza las cinco puertas de la capital hacia praderas infinitas, ríos caudalosos y puentes centenarios. Viaja a tu propio ritmo sin prisas ni plazos forzados.',
      badges: ['✦ Mundo Abierto', '✦ Sin Pantallas de Carga', '✦ Ríos & Molinos', '✦ Cinco Regiones']
    });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/banner_02_exploracion_pompelin.png` });

  // 3. BANNER 3: Hogar Propio en Casa del Olmo
  console.log('Rendering Banner 3: Tu Propio Hogar...');
  await page.evaluate(async () => {
    const { switchGameMap } = await import('/src/game/cities.ts');
    const { syncWorldClock } = await import('/src/data/worldClock.ts');
    const { session, play } = await import('/src/game/state.ts');
    syncWorldClock({ hour: 20.8, secondsPerHour: 36000 });

    session.state.rpg = {
      ...session.state.rpg,
      furniture: [
        { id: 'f1', item: { id: 'mueble_alfombra_0', count: 1 }, location: 'casa_del_olmo', x: 0, z: 0.6, yaw: 0 },
        { id: 'f2', item: { id: 'mueble_mesa_0', count: 1 }, location: 'casa_del_olmo', x: 0.7, z: 0.7, yaw: 0 },
        { id: 'f3', item: { id: 'mueble_silla_0', count: 1 }, location: 'casa_del_olmo', x: 0.7, z: 0.1, yaw: Math.PI },
        { id: 'f4', item: { id: 'mueble_farol_0', count: 1 }, location: 'casa_del_olmo', x: 0.7, z: 0.7, yaw: 0, lit: true },
        { id: 'f5', item: { id: 'mueble_macetero_0', count: 1 }, location: 'casa_del_olmo', x: -0.7, z: 0.7, yaw: 0 }
      ]
    };

    await switchGameMap('casa_del_olmo');
    window.brumaluz.move(0, 0.4);
    window.brumaluz.view(0.35, 0.42, 6.0);
    window.brumaluz.char().sit(0);

    window.updatePromoCard({
      stamp: 'Barrio del Olmo',
      tag: 'Viviendas & Decoración Cozy',
      title: 'Crea tu Propio Refugio',
      desc: 'Desde tu habitación de posada inicial hasta la acogedora Casa del Olmo: amuebla cada rincón con piezas fabricadas a mano, estanterías, alfombras y faroles.',
      badges: ['✦ Sistema de Viviendas', '✦ Muebles Hechos a Mano', '✦ Descanso Reconfortante']
    });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/banner_03_tu_propio_hogar.png` });

  // 4. BANNER 4: Maestría Artesanal y Oficios
  console.log('Rendering Banner 4: Maestría Artesanal...');
  await page.evaluate(async () => {
    const { switchGameMap } = await import('/src/game/cities.ts');
    await switchGameMap('taller_ebanisteria_interior');
    window.brumaluz.move(0, 1.0);
    window.brumaluz.view(0.3, 0.4, 7.5);

    window.updatePromoCard({
      stamp: 'Barrio de los Artesanos',
      tag: '10 Oficios Tradicionales',
      title: 'El Arte de lo Hecho a Mano',
      desc: 'Ebanistería, Alquimia, Herrería, Cocina, Sastrería y más. Fabrica herramientas, equipo y mobiliario usando ingredientes de tu mochila y banco sin límites diarios.',
      badges: ['✦ 10 Profesiones', '✦ Aprendiz a Gran Maestro', '✦ Fabricación Progresiva']
    });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/banner_04_maestria_artesanal.png` });

  // 5. BANNER 5: El Secreto de La Arboleda
  console.log('Rendering Banner 5: La Arboleda Mística...');
  await page.evaluate(async () => {
    const { switchGameMap } = await import('/src/game/cities.ts');
    const { syncWorldClock } = await import('/src/data/worldClock.ts');
    await switchGameMap('pompelin');
    syncWorldClock({ hour: 16.5, secondsPerHour: 36000 });
    window.brumaluz.move(670, -168);
    window.brumaluz.view(0.35, 0.22, 12);

    window.updatePromoCard({
      stamp: 'Región de La Arboleda',
      tag: 'Misterios & Magia Discreta',
      title: 'El Secreto de La Arboleda',
      desc: 'Sigue el resplandor del misterioso polvo de hada hacia el corazón de bosques milenarios, donde la magia antigua duerme esperando a los más curiosos.',
      badges: ['✦ Polvo de Hada', '✦ Bosque Ancestral', '✦ Misiones de Descubrimiento']
    });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/banner_05_la_arboleda_magica.png` });

  // 6. BANNER 6: Combate y Equipamiento de Clase
  console.log('Rendering Banner 6: Combate y Acción...');
  await page.evaluate(async () => {
    const { syncWorldClock } = await import('/src/data/worldClock.ts');
    const { switchGameMap } = await import('/src/game/cities.ts');
    const { Character } = await import('/src/character/character.ts');
    const { holder, camTarget } = await import('/src/game/stage.ts');
    const { play, session } = await import('/src/game/state.ts');

    await switchGameMap('pompelin');
    syncWorldClock({ hour: 17.2, secondsPerHour: 36000 });

    window.brumaluz.set({
      name: 'Caballero de Brumaluz',
      race: 'humano',
      cls: 'guerrero',
      hair: 14,
      hairColor: 2,
      clothA: 16,
      clothB: 26,
      introSeen: true,
      welcome: { stage: 'completed', origin: 0 }
    });

    // Rebuild with full class outfit (helmet, cape, sword & shield)
    play.char?.dispose();
    play.char = new Character({ ...session.state, cls: 'guerrero' }, { outfit: true });
    holder.add(play.char.root);

    window.brumaluz.move(-46, -92);
    camTarget.copy(holder.position);
    camTarget.y += 1.2;
    window.brumaluz.view(0.3, 0.2, 5.8);
    window.brumaluz.spin(0.3);

    window.updatePromoCard({
      stamp: 'Tierras Salvajes de Pompelín',
      tag: 'Aventura, Clases & Combate',
      title: 'Defiende los Senderos',
      desc: 'Equípate con armas forjadas, escudos de heráldica y armaduras artesanales. Haz frente a las bestias salvajes y protege las rutas comerciales de Pompelín.',
      badges: ['✦ Clases de Personaje', '✦ Espadas, Arcos & Magia', '✦ Combate en Tiempo Real']
    });
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/banner_06_combate_y_aventura.png` });

  console.log('All 6 promotional banners successfully rendered!');
} catch (error) {
  console.error('Error during banner rendering:', error);
} finally {
  await browser?.close();
  await server?.close();
}

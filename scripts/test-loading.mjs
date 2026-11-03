import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import sharp from 'sharp';

test('loading drawings are simple editable vectors, not renders or embedded pictures', async () => {
  const expected = ['lantern', 'city', 'world', 'forest', 'workshop', 'forge', 'alchemy', 'hearth', 'atelier', 'book', 'mining', 'jewelry', 'enchantment', 'kitchen', 'leather'];
  const drawings = await Promise.all(expected.map(async (name, index) => {
    const image = await readFile(new URL(`../src/assets/loading/${name}.svg`, import.meta.url));
    const source = image.toString('utf8');
    assert.ok(image.length < 6000, `${name} stays under 6 KB with its illustrated details`);
    assert.doesNotMatch(source, /<image|<filter|<pattern|<script|data:|https?:\/\/(?!www\.w3\.org)/i, `${name} has no raster, generated texture, or external dependency`);
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.width, 360);
    assert.equal(metadata.height, 260);
    assert.equal(metadata.hasAlpha, true);
    const stats = await sharp(image).stats();
    assert.equal(stats.channels[3].min, 0, `${name} has no rectangular background`);
    assert.ok(stats.channels[3].max > 240, `${name} keeps solid, readable materials`);
    const pixels = await sharp(image).ensureAlpha().raw().toBuffer();
    let opaque = 0, colourful = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 240) continue;
      opaque++;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 25) colourful++;
    }
    assert.ok(colourful / opaque > .08, `${name} retains material colours instead of monochrome sepia`);
    const label = Buffer.from(`<svg width="360" height="32"><text x="180" y="23" text-anchor="middle" fill="#ffe2a0" font-size="16" font-family="Georgia">${name}</text></svg>`);
    return [
      { input: await sharp(image).png().toBuffer(), left: (index % 3) * 360, top: Math.floor(index / 3) * 292 },
      { input: await sharp(label).png().toBuffer(), left: (index % 3) * 360, top: Math.floor(index / 3) * 292 + 260 },
    ];
  }));
  await mkdir('art/loading-review', { recursive: true });
  await sharp({ create: { width: 1080, height: 1460, channels: 4, background: '#382324' } })
    .composite(drawings.flat()).png().toFile('art/loading-review/drawings-overview.png');
});

test('cozy loading screens: contextual art, layouts, languages and concurrent lifecycle', { timeout: 120000 }, async () => {
  const server = await createServer({
    server: { host: '127.0.0.1', port: 4236, strictPort: true, hmr: false, watch: null },
    logLevel: 'error',
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    const plateRequests = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/\/assets\/loading\/[^/]+\.svg$/.test(new URL(request.url()).pathname)) plateRequests.add(new URL(request.url()).pathname);
    });
    await page.addInitScript(() => localStorage.setItem('brumaluz-language', 'es'));
    // Keep the initial screen in place without starting the 3D world or account requests.
    await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.goto('http://127.0.0.1:4236/');
    await page.evaluate(() => document.fonts.ready);
    await mkdir('art/loading-review', { recursive: true });

    const fits = async selector => {
      const bounds = await page.locator(selector).evaluate(el => {
        const r = el.getBoundingClientRect();
        return {
          inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          horizontalOverflow: el.scrollWidth > el.clientWidth,
        };
      });
      assert.equal(bounds.inside, true, `${selector} fits the viewport at ${JSON.stringify(page.viewportSize())}`);
      assert.equal(bounds.horizontalOverflow, false, `${selector} has no horizontal clipping`);
    };
    const imagesLoaded = async selector => {
      assert.equal(await page.locator(`${selector} img`).evaluateAll(async images => {
        await Promise.all(images.map(image => image.decode()));
        return images.every(image => image.naturalWidth > 0);
      }), true);
    };
    const artworkHashes = new Map();
    const checkArtwork = async (selector, art) => {
      await imagesLoaded(selector);
      const pixels = await page.locator(`${selector} .loading-illustration`).evaluate(image => {
        const canvas = document.createElement('canvas');
        canvas.width = 200; canvas.height = 125;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0, hash = 2166136261;
        for (let i = 0; i < data.length; i++) {
          hash = Math.imul(hash ^ data[i], 16777619) >>> 0;
          if (i % 4 === 3 && data[i] > 16) visible++;
        }
        return { visible, hash };
      });
      assert.ok(pixels.visible > 500, `${art} contains visible printed artwork`);
      if (artworkHashes.has(art)) assert.equal(pixels.hash, artworkHashes.get(art));
      else {
        assert.ok(![...artworkHashes.values()].includes(pixels.hash), `${art} is visually distinct from the other scenes`);
        artworkHashes.set(art, pixels.hash);
      }
    };
    await fits('#loading');
    assert.equal(await page.locator('#loading .crest').textContent(), '✦', 'Restore the original boot crest');
    assert.equal(await page.locator('#loading p').textContent(), 'Encendiendo los faroles de Brumaluz…');
    assert.equal(await page.locator('#loading img').count(), 0, 'The original boot screen needs no image download');
    assert.equal(await page.locator('#loading p').evaluate(el => getComputedStyle(el).color), 'rgb(255, 226, 160)');
    assert.deepEqual([...plateRequests], [], 'Boot needs no drawing assets');
    await page.screenshot({ path: 'art/loading-review/initial-desktop.png' });
    for (const [width, height] of [[390, 844], [320, 568]]) {
      await page.setViewportSize({ width, height });
      await fits('#loading');
      await fits('#loading p');
    }
    await page.screenshot({ path: 'art/loading-review/initial-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => document.querySelector('#loading').classList.add('hide'));
    await page.locator('#loading').waitFor({ state: 'hidden' });

    await page.evaluate(async () => {
      const loading = await import('/src/ui/transitionLoading.ts');
      globalThis.loadingReview = loading;
      globalThis.finishShort = loading.beginTransition('Guardando misión…');
      globalThis.finishShort();
    });
    await page.waitForTimeout(220);
    assert.equal(await page.locator('#transition-loading').count(), 0, 'Short actions never flash a panel');
    assert.equal(await page.locator('#scene').getAttribute('aria-busy'), null);

    await page.evaluate(() => {
      globalThis.finishJourney = globalThis.loadingReview.beginTransition('Entrando en el mundo…', {
        journey: 'enter', destination: { id: 'brumaluz', name: 'Brumaluz', kind: 'city' },
      });
    });
    const transition = page.locator('#transition-loading');
    await transition.waitFor({ state: 'visible' });
    await fits('#transition-loading .loading-page');
    await checkArtwork('#transition-loading', 'city');
    assert.equal(await page.locator('#scene').getAttribute('aria-busy'), 'true');
    assert.equal(await transition.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    assert.equal(await transition.locator('.loading-status').textContent(), 'Entrando en el mundo…');
    assert.equal(await transition.getAttribute('data-art'), 'city');
    await page.screenshot({ path: 'art/loading-review/journey-desktop.png' });
    await page.evaluate(() => {
      globalThis.finishAction = globalThis.loadingReview.beginTransition('Guardando misión…');
      globalThis.finishJourney();
      globalThis.finishJourney();
    });
    assert.equal(await transition.locator('.loading-page').count(), 0, 'Small actions retain the compact notification');
    assert.equal(await transition.locator('p').textContent(), 'Guardando misión…');
    assert.equal(await page.locator('#scene').getAttribute('aria-busy'), 'true', 'Another request still owns the busy state');
    await page.evaluate(() => globalThis.finishAction());
    await transition.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#scene').getAttribute('aria-busy'), null);

    await page.evaluate(() => {
      globalThis.finishMap = globalThis.loadingReview.beginMapTransition({
        id: 'taller_ebanisteria_interior', kind: 'interior', name: 'Taller de Ebanistería', region: 'Brumaluz',
        loadingTip: 'Puedes usar materiales de tu mochila y del banco personal al fabricar en una estación.',
      });
    });
    assert.equal(await page.locator('.map-transition .loading-title').textContent(), 'Taller de Ebanistería');
    assert.equal(await page.locator('.map-transition').getAttribute('data-art'), 'workshop');
    await checkArtwork('.map-transition', 'workshop');
    for (const [name, width, height] of [
      ['desktop', 1440, 900], ['mobile', 390, 844], ['small-mobile', 320, 568], ['landscape', 844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await fits('.map-transition .loading-page');
      await fits('.map-transition .loading-illustration');
      assert.equal(await page.locator('.map-transition .loading-illustration').evaluate(el => getComputedStyle(el).objectFit), 'contain', 'The complete illustration remains visible, including on mobile');
      await page.locator('.map-transition .loading-page').evaluate(el => { el.scrollTop = 0; });
      for (const selector of ['.loading-masthead', '.loading-illustration', '.loading-title', '.loading-tip', '.loading-footer']) {
        await fits(`.map-transition ${selector}`);
      }
      await page.screenshot({ path: `art/loading-review/map-${name}.png` });
      await page.locator('.map-transition .loading-status').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.map-transition .loading-status').isVisible(), true);
    }
    await page.evaluate(async () => (await import('/src/ui/i18n.ts')).setLanguage('en'));
    assert.equal(await page.locator('.map-transition .loading-status').textContent(), 'Preparing the way…');
    assert.match(await page.locator('.map-transition .loading-tip').textContent(), /^You can use materials/);
    assert.equal(await page.locator('.map-transition .loading-brand').textContent(), 'Chronicles of Brumaluz');
    assert.equal(await page.locator('.map-transition .loading-note-heading').textContent(), 'A tip for the road');
    assert.equal(await page.locator('.map-transition .loading-edition').textContent(), 'Made with your own hands');
    assert.equal(await page.locator('.map-transition .loading-track span').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.evaluate(async () => (await import('/src/ui/i18n.ts')).setLanguage('es'));
    assert.match(await page.locator('.map-transition .loading-tip').textContent(), /^Puedes usar materiales/);
    await page.evaluate(() => { globalThis.finishMap(); globalThis.finishMap(); });
    assert.equal(await page.locator('.map-transition').count(), 0);

    const cityNotes = await page.evaluate(() => {
      const tips = [];
      for (let i = 0; i < 2; i++) {
        const finishCity = globalThis.loadingReview.beginMapTransition({ id: 'brumaluz', name: 'Brumaluz' });
        tips.push(document.querySelector('.map-transition .loading-tip').textContent);
        finishCity();
        globalThis.loadingReview.beginMapTransition({ id: 'taller_herreria_interior', name: 'Forja' })();
      }
      return tips;
    });
    assert.notEqual(cityNotes[0], cityNotes[1], 'Notes rotate within each family, even when alternating destinations');
    await page.setViewportSize({ width: 1440, height: 900 });
    const destinations = [
      ['city', { id: 'brumaluz', name: 'Brumaluz', kind: 'city' }],
      ['world', { id: 'pompelin', name: 'Pompelín', kind: 'world' }],
      ['forest', { id: 'bosque', name: 'Senderos del bosque', kind: 'zone' }],
      ['forge', { id: 'taller_herreria_interior', name: 'Forja de Brumaluz', kind: 'interior' }],
      ['alchemy', { id: 'taller_alquimia_interior', name: 'Taller de Alquimia', kind: 'interior' }],
      ['hearth', { id: 'habitacion_posada_lucero_del_alba', name: 'Lucero del Alba', kind: 'interior' }],
      ['atelier', { id: 'taller_sastreria_interior', name: 'Taller de Sastrería', kind: 'interior' }],
      ['mining', { id: 'taller_minero_interior', name: 'Taller de Minería', kind: 'interior' }],
      ['jewelry', { id: 'taller_joyeria_interior', name: 'Taller de Joyería', kind: 'interior' }],
      ['enchantment', { id: 'taller_encantamiento_interior', name: 'Taller de Encantamiento', kind: 'interior' }],
      ['kitchen', { id: 'taller_cocina_interior', name: 'Cocina de Brumaluz', kind: 'interior' }],
      ['leather', { id: 'taller_peleteria_interior', name: 'Taller de Peletería', kind: 'interior' }],
    ];
    for (const [art, destination] of destinations) {
      await page.evaluate(destination => {
        globalThis.finishMap = globalThis.loadingReview.beginMapTransition(destination);
      }, destination);
      assert.equal(await page.locator('.map-transition').getAttribute('data-art'), art);
      await checkArtwork('.map-transition', art);
      assert.match(await page.locator('.map-transition .loading-illustration').getAttribute('src'), new RegExp(`/${art}\\.svg$`));
      await page.screenshot({ path: `art/loading-review/${art}-desktop.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      for (const selector of ['.loading-masthead', '.loading-illustration', '.loading-title', '.loading-tip', '.loading-footer']) {
        await fits(`.map-transition ${selector}`);
      }
      await page.screenshot({ path: `art/loading-review/${art}-mobile.png` });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(() => globalThis.finishMap());
    }
    for (const [journey, art] of [['return', 'book'], ['create', 'world']]) {
      await page.evaluate(journey => {
        globalThis.finishJourney = globalThis.loadingReview.beginTransition('Preparando tu aventura…', { journey });
      }, journey);
      await transition.waitFor({ state: 'visible' });
      assert.equal(await transition.getAttribute('data-art'), art);
      assert.equal(await transition.getAttribute('data-phase'), journey);
      await checkArtwork('#transition-loading', art);
      await page.screenshot({ path: `art/loading-review/${journey}-desktop.png` });
      await page.evaluate(() => globalThis.finishJourney());
    }
    await page.evaluate(() => {
      globalThis.finishMap = globalThis.loadingReview.beginMapTransition({ name: '<b>Destino</b>', id: 'brumaluz' }, { recovery: true });
    });
    assert.equal(await page.locator('.map-transition').getAttribute('data-art'), 'lantern');
    assert.equal(await page.locator('.map-transition').getAttribute('data-phase'), 'recover');
    assert.equal(await page.locator('.map-transition h1 b').count(), 0, 'Destination names are plain text');
    await checkArtwork('.map-transition', 'lantern');
    await page.screenshot({ path: 'art/loading-review/recovery-desktop.png' });
    await page.evaluate(() => globalThis.finishMap());
    assert.equal(artworkHashes.size, 15, 'All fifteen simple drawings are rendered and distinct');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      globalThis.finishMap = globalThis.loadingReview.beginMapTransition({ id: 'taller_herreria_interior', name: 'Forja de Brumaluz' });
    });
    const animations = await page.locator('.map-transition').evaluate(el => ({
      art: getComputedStyle(el.querySelector('.loading-art')).animationName,
      light: getComputedStyle(el.querySelector('.loading-light')).animationName,
      lantern: getComputedStyle(el.querySelector('.loading-waymark')).animationName,
    }));
    assert.equal(animations.art, 'loading-appear');
    assert.equal(animations.light, 'loading-warmth');
    assert.equal(animations.lantern, 'none', 'Drawings and emblem do not wobble or rotate');
    await page.evaluate(async () => {
      globalThis.finishMap();
      const loading = globalThis.loadingReview;
      const art = loading.destinationArt;
      const cases = {
        taller_carpinteria_interior: 'workshop', taller_ebanisteria_interior: 'workshop',
        taller_herreria_interior: 'forge', taller_minero_interior: 'mining',
        taller_alquimia_interior: 'alchemy', taller_encantamiento_interior: 'enchantment', taller_joyeria_interior: 'jewelry',
        taller_sastreria_interior: 'atelier', taller_peleteria_interior: 'leather',
        taller_lenador_interior: 'forest', taller_recolector_interior: 'forest', taller_cocina_interior: 'kitchen',
        casa_del_olmo: 'hearth', casa_de_isberto_interior: 'hearth',
        posada_lucero_del_alba: 'hearth', habitacion_posada_lucero_del_alba: 'hearth',
      };
      for (const [id, expected] of Object.entries(cases)) {
        if (art({ id, name: 'A translated destination' }) !== expected) throw new Error(`Wrong engraving for ${id}`);
      }
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});

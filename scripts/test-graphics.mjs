import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4174';
let server;
let browser;

before(async () => {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort']);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview server did not start')), 15000);
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`Preview server exited: ${code}`)));
    server.stdout.on('data', (data) => {
      if (stripVTControlCharacters(data.toString()).includes(url)) { clearTimeout(timeout); resolve(); }
    });
    server.stderr.on('data', (data) => process.stderr.write(data));
  });
  const response = await fetch(url);
  assert.equal(response.status, 200, 'The preview server must respond before browser tests start');
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
  });
});

after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill();
    await stopped;
  }
});

async function openPage(query = '', fault) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.location().url !== `${url}/favicon.ico`) {
      errors.push(`${message.text()} (${message.location().url})`);
    }
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.addInitScript((fault) => {
    localStorage.setItem('brumaluz-ambient', 'off');
    localStorage.setItem('brumaluz-language', 'es');
    if (fault === 'no-float') {
      const original = WebGL2RenderingContext.prototype.getExtension;
      WebGL2RenderingContext.prototype.getExtension = function (name) {
        return name === 'EXT_color_buffer_float' ? null : original.call(this, name);
      };
    } else if (['no-webgl', 'no-antialias', 'no-high-performance'].includes(fault)) {
      const original = HTMLCanvasElement.prototype.getContext;
      window.graphicsContextAttempts = [];
      window.graphicsMultisampleCalls = 0;
      window.graphicsFloatTargets = 0;
      const multisample = WebGL2RenderingContext.prototype.renderbufferStorageMultisample;
      WebGL2RenderingContext.prototype.renderbufferStorageMultisample = function (...args) {
        window.graphicsMultisampleCalls++;
        return multisample.apply(this, args);
      };
      const storage = WebGL2RenderingContext.prototype.texStorage2D;
      WebGL2RenderingContext.prototype.texStorage2D = function (...args) {
        if (args[2] === this.RGBA16F) window.graphicsFloatTargets++;
        return storage.apply(this, args);
      };
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === 'webgl2' && this.id === 'scene' && args[0]) {
          const attributes = args[0];
          window.graphicsContextAttempts.push({ antialias: attributes.antialias, powerPreference: attributes.powerPreference });
          if (fault === 'no-webgl' || (fault === 'no-antialias' && attributes.antialias)
            || (fault === 'no-high-performance' && attributes.powerPreference === 'high-performance')) {
            this.dispatchEvent(new WebGLContextEvent('webglcontextcreationerror', { statusMessage: 'Error creating WebGL context with your selected attributes.' }));
            return null;
          }
        }
        return original.call(this, type, ...args);
      };
    } else if (fault === 'shader') {
      const original = WebGL2RenderingContext.prototype.shaderSource;
      WebGL2RenderingContext.prototype.shaderSource = function (shader) {
        return original.call(this, shader, 'intentional invalid shader for regression test');
      };
    }
  }, fault);
  await page.goto(`${url}/${query}`);
  return { page, errors, warnings, close: () => context.close() };
}

async function waitForWorld(page) {
  await page.waitForFunction(() => !!window.brumaluz, { timeout: 90000 });
  await page.evaluate(() => {
    document.body.classList.remove('auth-visible', 'characters-visible');
    document.getElementById('account-gate').hidden = true;
  });
}

async function assertRendered(page, budget) {
  const frame = await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => {
    const gl = document.getElementById('scene').getContext('webgl2');
    const pixels = new Uint8Array(64 * 64 * 4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    resolve({ width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, colors: colors.size, error: gl.getError(), lost: gl.isContextLost() });
  })));
  assert.equal(frame.lost, false);
  assert.equal(frame.error, 0);
  assert.ok(frame.width * frame.height <= budget, JSON.stringify(frame));
  assert.ok(frame.colors > 8, `The 3D frame must not be blank: ${JSON.stringify(frame)}`);
  assert.equal(await page.locator('#graphics-error').isVisible(), false);
}

test('normal and compatible modes render the creator and world with bounded resolution', { timeout: 180000 }, async () => {
  for (const compatible of [false, true]) {
    const { page, errors, close } = await openPage(compatible ? '?graphics=compatible' : '');
    try {
      await waitForWorld(page);
      assert.equal(await page.locator('#graphics-mode').textContent(), compatible ? 'Gráficos: compatible' : 'Gráficos: normal');
      await assertRendered(page, compatible ? 1920 * 1080 : 2560 * 1440);
      await page.evaluate(() => window.brumaluz.play());
      await assertRendered(page, compatible ? 1920 * 1080 : 2560 * 1440);
      await page.setViewportSize({ width: 2560, height: 1440 });
      await assertRendered(page, compatible ? 1920 * 1080 : 2560 * 1440);
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});

test('missing float render targets automatically use the direct compatible renderer', { timeout: 120000 }, async () => {
  const { page, errors, close } = await openPage('', 'no-float');
  try {
    await waitForWorld(page);
    assert.equal(await page.locator('#graphics-mode').textContent(), 'Gráficos: compatible');
    await assertRendered(page, 1920 * 1080);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('rejected context attributes retry without antialiasing while preserving normal effects', { timeout: 180000 }, async () => {
  for (const fault of ['no-antialias', 'no-high-performance']) {
    const { page, errors, warnings, close } = await openPage('', fault);
    try {
      await waitForWorld(page);
      assert.equal(await page.locator('#graphics-mode').textContent(), 'Gráficos: normal');
      await assertRendered(page, 2560 * 1440);
      await page.evaluate(() => window.brumaluz.play());
      await assertRendered(page, 2560 * 1440);
      const result = await page.evaluate(() => ({
        attempts: window.graphicsContextAttempts,
        antialias: document.getElementById('scene').getContext('webgl2').getContextAttributes().antialias,
        multisampleCalls: window.graphicsMultisampleCalls,
        floatTargets: window.graphicsFloatTargets,
      }));
      const expected = [
        { antialias: true, powerPreference: 'high-performance' },
        { antialias: false, powerPreference: 'high-performance' },
      ];
      if (fault === 'no-high-performance') expected.push({ antialias: false, powerPreference: 'default' });
      assert.deepEqual(result.attempts, expected);
      assert.equal(result.antialias, false);
      assert.equal(result.multisampleCalls, 0);
      assert.ok(result.floatTargets > 0, 'Normal effects must still use HDR render targets');
      assert.ok(warnings.some((warning) => warning.includes('WebGL 2 rechazó los atributos')));
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});

test('compatible mode can retry with the browser default GPU preference', { timeout: 120000 }, async () => {
  const { page, errors, close } = await openPage('?graphics=compatible', 'no-high-performance');
  try {
    await waitForWorld(page);
    assert.equal(await page.locator('#graphics-mode').textContent(), 'Gráficos: compatible');
    await assertRendered(page, 1920 * 1080);
    assert.deepEqual(await page.evaluate(() => window.graphicsContextAttempts), [
      { antialias: false, powerPreference: 'high-performance' },
      { antialias: false, powerPreference: 'default' },
    ]);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('context loss shows recovery and the compatible reload preserves URL fragments', { timeout: 120000 }, async () => {
  const { page, close } = await openPage('?#graphics-test');
  try {
    await waitForWorld(page);
    await page.evaluate(() => {
      const gl = document.getElementById('scene').getContext('webgl2');
      const extension = gl.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('WEBGL_lose_context is required for this test');
      extension.loseContext();
    });
    await page.locator('#graphics-error').waitFor({ state: 'visible' });
    assert.match(await page.locator('#graphics-error-message').textContent(), /perdido/);
    await page.getByRole('button', { name: 'Recargar en modo compatible' }).click();
    await waitForWorld(page);
    assert.equal(new URL(page.url()).searchParams.get('graphics'), 'compatible');
    assert.equal(new URL(page.url()).hash, '#graphics-test');
    await assertRendered(page, 1920 * 1080);
  } finally { await close(); }
});

test('WebGL unavailable and shader failures show an actionable error instead of a blank canvas', { timeout: 60000 }, async () => {
  for (const fault of ['no-webgl', 'shader']) {
    const { page, close } = await openPage('', fault);
    try {
      await page.locator('#graphics-error').waitFor({ state: 'visible' });
      assert.match(await page.locator('#graphics-error-message').textContent(), fault === 'no-webgl' ? /WebGL 2/ : /mundo 3D/);
      assert.equal(await page.getByRole('button', { name: 'Recargar en modo compatible' }).isVisible(), true);
      if (fault === 'no-webgl') {
        assert.equal(await page.evaluate(() => window.graphicsContextAttempts.length), 3);
        assert.match(await page.locator('#graphics-error-details').textContent(), /selected attributes/);
      }
    } finally { await close(); }
  }
});

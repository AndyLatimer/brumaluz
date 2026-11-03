import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server, browser, url;

before(async () => {
  server = await createServer({
    cacheDir: 'node_modules/.vite-audio-mix',
    server: { host: '127.0.0.1', strictPort: false, hmr: false, watch: null },
    logLevel: 'error',
  });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
  });
}, { timeout: 120000 });

after(async () => {
  await browser?.close();
  await server?.close();
});

async function openProbe() {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(`${url}/__audio-mix`, route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><meta charset="utf-8"><button id="gesture">Activar</button><button id="menu-music"></button><div id="menu-music-message"></div><div id="account-gate"></div>',
  }));
  await page.goto(`${url}/__audio-mix`);
  return { context, page, errors };
}

function trackAudioContexts() {
  const NativeAudioContext = window.AudioContext;
  window.__audioContexts = [];
  window.AudioContext = class extends NativeAudioContext {
    constructor(...args) {
      super(...args);
      const destination = this.destination;
      const output = this.createGain();
      const analyser = this.createAnalyser();
      analyser.fftSize = 2048;
      output.connect(destination);
      output.connect(analyser);
      Object.defineProperty(this, 'destination', { value: output });
      this.testAnalyser = analyser;
      this.testSuspensions = 0;
      this.testPendingResumes = 0;
      this.testPendingSuspensions = 0;
      this.testTransitions = [];
      this.addEventListener('statechange', () => this.testTransitions.push(this.state));
      window.__audioContexts.push(this);
    }
    suspend() {
      this.testSuspensions++;
      this.testTransitions.push(`suspend:${this.state}`);
      this.testPendingSuspensions++;
      const operation = super.suspend();
      void operation.then(() => this.testPendingSuspensions--, () => this.testPendingSuspensions--);
      return operation;
    }
    resume() {
      this.testTransitions.push(`resume:${this.state}`);
      this.testPendingResumes++;
      const operation = super.resume();
      void operation.then(() => this.testPendingResumes--, () => this.testPendingResumes--);
      return operation;
    }
  };
}

async function waitForSuspension(page, kind) {
  const states = await page.evaluate(async kind => {
    const deadline = performance.now() + 10000;
    let contexts;
    do {
      contexts = window.__audioContexts.filter(audio => audio.brumaluzAudio === kind);
      if (contexts.length && contexts.every(audio => audio.state !== 'running' && !audio.testPendingResumes && !audio.testPendingSuspensions)) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    } while (performance.now() < deadline);
    return contexts.map(audio => ({ state: audio.state, pendingResumes: audio.testPendingResumes,
      pendingSuspensions: audio.testPendingSuspensions, transitions: audio.testTransitions }));
  }, kind);
  assert.ok(states.length && states.every(audio => audio.state !== 'running' && !audio.pendingResumes && !audio.pendingSuspensions),
    `Audio contexts did not suspend: ${JSON.stringify(states)}`);
}

async function sampleOutput(page, kind, duration = 1000) {
  return page.evaluate(async ({ kind, duration }) => {
    let energy = 0, count = 0, peak = 0;
    const end = performance.now() + duration;
    while (performance.now() < end) {
      for (const context of window.__audioContexts.filter(audio => audio.brumaluzAudio === kind && audio.state === 'running')) {
        const values = new Float32Array(context.testAnalyser.fftSize);
        context.testAnalyser.getFloatTimeDomainData(values);
        for (const value of values) {
          energy += value * value;
          peak = Math.max(peak, Math.abs(value));
          count++;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    return { rms: count ? Math.sqrt(energy / count) : 0, peak };
  }, { kind, duration });
}

test('the actual world music mix is audible at default and maximum volume without clipping', { timeout: 180000 }, async t => {
  const { context, page, errors } = await openProbe();
  try {
    const result = await page.evaluate(async () => {
      const { loadSettings } = await import('/src/services/settings.ts');
      const { MUSIC_PROFILES, musicBar } = await import('/src/world/dayMusicScore.ts');
      const { DayMusic } = await import('/src/world/dayMusic.ts');
      const { renderNote } = await import('/src/world/dayMusicVoice.ts');
      const settings = loadSettings();
      const native = window.AudioContext;

      async function render(phase, level, frame = {}) {
        const profile = MUSIC_PROFILES[phase], beat = 60 / profile.bpm, rate = 24000;
        const seconds = profile.bars * profile.beatsPerBar * beat;
        const offline = new OfflineAudioContext(2, Math.ceil((seconds + 6) * rate), rate);
        const music = new DayMusic(true);
        try {
          window.AudioContext = class { constructor() { return offline; } };
          music.makeGraph();
        } finally {
          window.AudioContext = native;
        }
        music.frame = { playing: true, hour: 12, inside: false, dialogue: false, combat: false, ...frame };
        music.level = level;
        music.applyMix();
        for (let bar = 0; bar < profile.bars; bar++) {
          for (const note of musicBar(phase, bar)) {
            renderNote(offline, music.bus, note, 3 + (bar * profile.beatsPerBar + note.beat) * beat, note.duration * beat);
          }
        }
        const buffer = await offline.startRendering();
        const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
        let energy = 0, peak = 0, finite = true, count = 0;
        for (let i = 3 * rate; i < Math.min(buffer.length, Math.floor((3 + seconds) * rate)); i++) {
          const l = left[i], r = right[i];
          finite &&= Number.isFinite(l) && Number.isFinite(r);
          energy += l * l + r * r;
          peak = Math.max(peak, Math.abs(l), Math.abs(r));
          count += 2;
        }
        await music.dispose();
        return { rms: Math.sqrt(energy / count), peak, finite };
      }

      const phases = {};
      const defaultLevel = settings.masterVolume * settings.musicVolume / 10000;
      for (const phase of ['dawn', 'day', 'dusk', 'night']) {
        phases[phase] = {
          default: await render(phase, defaultLevel),
          maximum: await render(phase, 1),
        };
      }
      return { settings, phases, indoorDialogue: await render('day', 1, { inside: true, dialogue: true }) };
    });
    t.diagnostic(JSON.stringify(result));
    const defaultLevel = result.settings.masterVolume * result.settings.musicVolume / 10000;
    for (const [phase, levels] of Object.entries(result.phases)) {
      for (const [name, stats] of Object.entries(levels)) {
        assert.equal(stats.finite, true, `${phase} ${name}: samples must be finite`);
        assert.ok(stats.peak < .8, `${phase} ${name}: leave headroom (${JSON.stringify(stats)})`);
      }
      assert.ok(levels.default.rms > .009, `${phase}: default volume is too quiet (${JSON.stringify(levels.default)})`);
      assert.ok(levels.maximum.rms > .020 && levels.maximum.rms < .1, `${phase}: maximum volume is outside the intended range (${JSON.stringify(levels.maximum)})`);
      assert.ok(Math.abs(levels.default.rms / levels.maximum.rms - defaultLevel) < .01, `${phase}: the music slider must remain linear`);
    }
    assert.ok(result.indoorDialogue.rms > .013, `Music should remain audible in indoor conversations (${JSON.stringify(result.indoorDialogue)})`);
    assert.ok(result.indoorDialogue.rms < result.phases.day.maximum.rms * .7, 'Conversations should still reduce music');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('access and creator music use an audible, unclipped final mix', { timeout: 90000 }, async t => {
  for (const kind of ['day', 'night', 'creator']) {
    const { context, page, errors } = await openProbe();
    try {
      await page.evaluate(async kind => {
        const { initMenuMusic } = await import('/src/ui/menuMusic.ts');
        const { CREATOR_MUSIC } = await import('/src/ui/creatorMusicScore.ts');
        document.body.className = kind === 'day' ? 'auth-visible daytime' : kind === 'night' ? 'auth-visible' : '';
        document.querySelector('#account-gate').hidden = kind === 'creator';
        window.__seconds = kind === 'creator'
          ? CREATOR_MUSIC.bars * CREATOR_MUSIC.beatsPerBar * 60 / CREATOR_MUSIC.bpm
          : kind === 'day' ? 4 * 2.72 : 4 * 4.8;
        window.__offline = new OfflineAudioContext(2, Math.ceil((window.__seconds + 2) * 24000), 24000);
        window.__virtualTime = 0;
        Object.defineProperty(window.__offline, 'currentTime', { configurable: true, get: () => window.__virtualTime });
        Object.defineProperty(window.__offline, 'state', { configurable: true, value: 'running' });
        window.__offline.resume = async () => {};
        window.__nativeAudio = window.AudioContext;
        window.__nativeInterval = window.setInterval;
        window.AudioContext = class { constructor() { return window.__offline; } };
        window.setInterval = (callback, delay, ...args) => {
          if (delay === 250) { window.__schedule = callback; return 2147483647; }
          return window.__nativeInterval(callback, delay, ...args);
        };
        window.__menu = initMenuMusic();
        window.__menu.setLevel(1);
      }, kind);
      await page.locator('#gesture').click();
      await page.waitForFunction(() => window.__menu.diagnostics.playing);
      const stats = await page.evaluate(async () => {
        for (let time = .25; time < window.__seconds; time += .25) {
          window.__virtualTime = time;
          window.__schedule();
        }
        delete window.__offline.currentTime;
        delete window.__offline.state;
        window.AudioContext = window.__nativeAudio;
        window.setInterval = window.__nativeInterval;
        const buffer = await window.__offline.startRendering();
        const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
        let energy = 0, peak = 0, count = 0;
        for (let i = 24000; i < Math.floor(window.__seconds * 24000); i++) {
          energy += left[i] ** 2 + right[i] ** 2;
          peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
          count += 2;
        }
        return { rms: Math.sqrt(energy / count), peak };
      });
      t.diagnostic(`${kind}: ${JSON.stringify(stats)}`);
      assert.ok(stats.rms > (kind === 'creator' ? .055 : .030), `${kind}: music is too quiet (${JSON.stringify(stats)})`);
      assert.ok(stats.peak < .8, `${kind}: leave headroom (${JSON.stringify(stats)})`);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
});

test('ambience and action effects are audible, bounded and still respond to volume', { timeout: 60000 }, async t => {
  const { context, page, errors } = await openProbe();
  try {
    const stats = await page.evaluate(async () => {
      const { AmbientSoundscape } = await import('/src/world/audio.ts');
      const { CombatAudio } = await import('/src/world/combatAudio.ts');
      const native = window.AudioContext, rate = 24000;
      const measure = (buffer, from, to) => {
        const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
        let energy = 0, peak = 0, count = 0;
        for (let i = from * rate; i < to * rate; i++) for (const channel of channels) {
          energy += channel[i] ** 2;
          peak = Math.max(peak, Math.abs(channel[i]));
          count++;
        }
        return { rms: Math.sqrt(energy / count), peak };
      };

      const ambientContext = new OfflineAudioContext(2, 6 * rate, rate);
      Object.defineProperty(ambientContext, 'state', { configurable: true, value: 'running' });
      ambientContext.resume = async () => {};
      window.AudioContext = class { constructor() { return ambientContext; } };
      const ambient = new AmbientSoundscape();
      await ambient.setEnabled(true);
      window.clearTimeout(ambient.birdsTimer);
      window.clearTimeout(ambient.bellTimer);
      delete ambientContext.state;
      const ambience = measure(await ambientContext.startRendering(), 1, 6);
      await ambient.dispose();

      const combatContext = new OfflineAudioContext(2, 10 * rate, rate);
      let time = 0;
      Object.defineProperty(combatContext, 'currentTime', { configurable: true, get: () => time });
      Object.defineProperty(combatContext, 'state', { configurable: true, value: 'running' });
      window.AudioContext = class { constructor() { return combatContext; } };
      const combat = new CombatAudio();
      combat.setLevel(1);
      combat.unlock();
      for (time = 1; time <= 4; time++) combat.play('impact', 'guerrero', { strong: true });
      time = 5;
      combat.setLevel(.5);
      for (time = 6; time <= 9; time++) combat.play('impact', 'guerrero', { strong: true });
      window.AudioContext = native;
      delete combatContext.currentTime;
      delete combatContext.state;
      const rendered = await combatContext.startRendering();
      const effects = measure(rendered, 1, 5), half = measure(rendered, 6, 10);
      await combat.dispose();
      return { ambience, effects, half };
    });
    t.diagnostic(JSON.stringify(stats));
    assert.ok(stats.ambience.rms > .038 && stats.ambience.peak < .5, `Ambient level or headroom: ${JSON.stringify(stats.ambience)}`);
    assert.ok(stats.effects.rms > .015 && stats.effects.peak < .6, `Action level or headroom: ${JSON.stringify(stats.effects)}`);
    assert.ok(stats.half.rms / stats.effects.rms > .35 && stats.half.rms / stats.effects.rms < .65, 'The master slider must still reduce effects');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('simultaneous effects retain headroom without flattening strong hits', { timeout: 60000 }, async t => {
  const { context, page, errors } = await openProbe();
  try {
    const result = await page.evaluate(async () => {
      const { CombatAudio } = await import('/src/world/combatAudio.ts');
      const native = window.AudioContext, random = Math.random, rate = 24000;
      async function render(initial, count, strong) {
        let seed = initial, time = 0;
        Math.random = () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
          return (seed >>> 0) / 4294967296;
        };
        const offline = new OfflineAudioContext(2, 2 * rate, rate);
        Object.defineProperty(offline, 'currentTime', { configurable: true, get: () => time });
        Object.defineProperty(offline, 'state', { configurable: true, value: 'running' });
        window.AudioContext = class { constructor() { return offline; } };
        const combat = new CombatAudio();
        try {
          combat.setLevel(1);
          combat.unlock();
          time = 1;
          for (let i = 0; i < count; i++) combat.play('impact', `foe${i}`, { strong });
        } finally {
          Math.random = random;
          window.AudioContext = native;
          delete offline.currentTime;
          delete offline.state;
        }
        const buffer = await offline.startRendering();
        const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
        let energy = 0, peak = 0;
        for (let i = rate; i < buffer.length; i++) {
          energy += left[i] ** 2 + right[i] ** 2;
          peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
        }
        await combat.dispose();
        return { rms: Math.sqrt(energy / (rate * 2)), peak };
      }
      const normal = await render(5483, 1, false);
      const strong = await render(5483, 1, true);
      const simultaneous = [];
      for (const seed of [12731, 5483, 98317]) simultaneous.push(await render(seed, 24, true));
      return { normal, strong, simultaneous };
    });
    t.diagnostic(JSON.stringify(result));
    assert.ok(result.strong.rms > .015, 'A strong hit must be clearly audible');
    assert.ok(result.strong.rms / result.normal.rms > 1.2, 'Strong hits must retain their extra weight');
    for (const stats of result.simultaneous) {
      assert.ok(stats.peak < .7, `Even 24 simultaneous effects must leave headroom for music and ambience: ${JSON.stringify(stats)}`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('full-volume music, ambience and overlapping effects leave combined headroom', { timeout: 90000 }, async t => {
  const { context, page, errors } = await openProbe();
  try {
    const stats = await page.evaluate(async () => {
      const { DayMusic } = await import('/src/world/dayMusic.ts');
      const { AmbientSoundscape } = await import('/src/world/audio.ts');
      const { CombatAudio } = await import('/src/world/combatAudio.ts');
      const { MUSIC_PROFILES, musicBar } = await import('/src/world/dayMusicScore.ts');
      const { renderNote } = await import('/src/world/dayMusicVoice.ts');
      const profile = MUSIC_PROFILES.dusk, beat = 60 / profile.bpm, rate = 24000, bars = 8;
      const seconds = bars * profile.beatsPerBar * beat;
      const offline = new OfflineAudioContext(2, Math.ceil((seconds + 6) * rate), rate);
      const native = window.AudioContext;
      let time = 0;
      Object.defineProperty(offline, 'currentTime', { configurable: true, get: () => time });
      Object.defineProperty(offline, 'state', { configurable: true, value: 'running' });
      offline.resume = async () => {};
      window.AudioContext = class { constructor() { return offline; } };

      const music = new DayMusic(true);
      music.makeGraph();
      music.level = 1;
      music.frame = { playing: true, hour: 19, inside: false, dialogue: false, combat: false };
      music.applyMix();
      for (let bar = 0; bar < bars; bar++) {
        for (const note of musicBar('dusk', bar + 20)) {
          renderNote(offline, music.bus, note, 3 + (bar * profile.beatsPerBar + note.beat) * beat, note.duration * beat);
        }
      }
      const ambient = new AmbientSoundscape();
      await ambient.setEnabled(true);
      window.clearTimeout(ambient.birdsTimer);
      window.clearTimeout(ambient.bellTimer);
      const combat = new CombatAudio();
      combat.setLevel(1);
      combat.unlock();
      let burstVoices = 0;
      for (let i = 0; i < Math.floor(seconds / .4); i++) {
        time = 3 + i * .4;
        if (i === 31) {
          time += .19;
          for (let voice = 0; voice < 24; voice++) combat.play('impact', `overlap${voice}`, { strong: true });
          burstVoices = combat.voices.length;
          continue;
        }
        combat.play('impact', 'guerrero', { strong: true });
        if (i % 3 === 0) combat.play('incoming', 'guerrero');
        if (i % 13 === 0) ambient.chirp();
        if (i % 75 === 0) ambient.ringBell();
      }
      window.AudioContext = native;
      delete offline.currentTime;
      delete offline.state;
      const buffer = await offline.startRendering();
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      let energy = 0, peak = 0, count = 0;
      for (let i = 3 * rate; i < Math.min(buffer.length, Math.floor((3 + seconds) * rate)); i++) {
        energy += left[i] ** 2 + right[i] ** 2;
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
        count += 2;
      }
      await music.dispose();
      await ambient.dispose();
      await combat.dispose();
      return { rms: Math.sqrt(energy / count), peak, burstVoices };
    });
    t.diagnostic(JSON.stringify(stats));
    assert.equal(stats.burstVoices, 24, 'The stress mix must include the complete effect voice budget');
    assert.ok(stats.rms > .04, `The combined mix must be audible: ${JSON.stringify(stats)}`);
    assert.ok(stats.peak < .9, `The combined mix must leave headroom: ${JSON.stringify(stats)}`);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('a delayed music start respects mute, volume, visibility and re-enabling', { timeout: 60000 }, async () => {
  for (const reason of ['mute', 'zero volume', 'hidden', 're-enabled']) {
    const { context, page, errors } = await openProbe();
    try {
      await page.evaluate(trackAudioContexts);
      await page.evaluate(async () => {
        const NativeAudioContext = window.AudioContext;
        let delayed = false;
        window.AudioContext = class extends NativeAudioContext {
          resume() {
            if (delayed) return super.resume();
            delayed = true;
            return new Promise((resolve, reject) => {
              window.__releaseAudioResume = () => super.resume().then(resolve, reject);
            });
          }
        };
        const { DayMusic } = await import('/src/world/dayMusic.ts');
        window.__music = new DayMusic(true);
        window.__music.makeGraph();
        await window.__audioContexts[0].suspend();
        window.__music.update({ playing: true, hour: 12 });
      });
      await page.locator('#gesture').click();
      await page.waitForFunction(() => typeof window.__releaseAudioResume === 'function');
      assert.equal(await page.evaluate(() => window.__music.diagnostics.contextState), 'suspended');
      await page.evaluate(reason => {
        if (reason === 'mute') window.__music.setEnabled(false);
        else if (reason === 'zero volume') window.__music.setLevel(0);
        else if (reason === 'hidden') {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event('visibilitychange'));
        } else {
          window.__music.setEnabled(false);
          window.__music.setEnabled(true);
        }
      }, reason);
      await page.evaluate(() => window.__releaseAudioResume());
      if (reason === 're-enabled') {
        await page.waitForFunction(() => window.__music.diagnostics.playing, null, { polling: 50, timeout: 10000 });
        assert.equal(await page.evaluate(() => window.__music.diagnostics.contextState), 'running', reason);
      } else {
        await page.waitForFunction(() => window.__music.diagnostics.contextState === 'suspended', null, { polling: 50, timeout: 5000 });
        assert.equal(await page.evaluate(() => window.__music.diagnostics.playing), false, reason);
      }
      assert.deepEqual(errors, []);
      await page.evaluate(() => window.__music.dispose());
    } finally {
      await context.close();
    }
  }
});

test('music remains audible during real loading transitions and respects mute and visibility', { timeout: 120000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(trackAudioContexts);
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-settings', JSON.stringify({ masterVolume: 100, ambientVolume: 100, musicVolume: 100, musicEnabled: true, nameplates: true }));
    localStorage.setItem('brumaluz-ambient', 'off');
    localStorage.setItem('brumaluz-menu-music', 'on');
  });
  try {
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 60000 });
    await page.locator('#loading.hide').waitFor({ state: 'attached' });
    await page.locator('#tabs [data-tab="rostro"]').click();
    await page.waitForFunction(async () => (await import('/src/game/audio.ts')).menuMusic.diagnostics.playing);
    await page.evaluate(async () => {
      window.__finishJourney = (await import('/src/ui/transitionLoading.ts')).beginTransition('Preparando tu aventura…', { journey: 'create' });
    });
    await page.locator('#transition-loading').waitFor({ state: 'visible' });
    await page.waitForTimeout(1200);
    assert.ok((await sampleOutput(page, 'menu-music')).rms > .01, 'The creator theme must continue during its loading screen');
    await page.evaluate(async () => {
      window.__finishJourney();
      (await import('/src/data/worldClock.ts')).syncWorldClock({ hour: 12, secondsPerHour: 600 });
      window.brumaluz.set({ introSeen: true, welcome: { origin: 0, stage: 'completed' }, shadowQuest: null });
      window.brumaluz.play();
      const { story, talk } = await import('/src/game/state.ts');
      story.introArmed = false;
      story.houseTourArmed = false;
      talk.pendingIsbertoIntroduction = false;
    });
    await page.waitForFunction(async () => (await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    await page.waitForTimeout(3000);
    const before = await page.evaluate(() => {
      const audio = window.__audioContexts.find(context => context.brumaluzAudio === 'world-music');
      return { suspensions: audio.testSuspensions, count: window.__audioContexts.filter(context => context.brumaluzAudio === 'world-music').length };
    });
    await page.evaluate(async () => {
      const { play } = await import('/src/game/state.ts');
      const { travelPortal } = await import('/src/game/cities.ts');
      const requestFrame = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => {
        window.requestAnimationFrame = requestFrame;
        window.__releaseTravel = () => requestFrame(callback);
        return 2147483647;
      };
      window.__travel = travelPortal({ id: 'audio-test', trigger: 'use', radius: 2, position: play.city.spawn.clone(), target: { map: 'brumaluz' } });
      if (!window.__releaseTravel) throw new Error('The travel frame was not held');
    });
    await page.locator('.map-transition').waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);
    const during = await page.evaluate(async () => {
      const audio = window.__audioContexts.find(context => context.brumaluzAudio === 'world-music');
      const { worldMusic } = await import('/src/game/audio.ts');
      const { play } = await import('/src/game/state.ts');
      return { ...worldMusic.diagnostics, travelling: play.mapTravelling, suspensions: audio.testSuspensions,
        count: window.__audioContexts.filter(context => context.brumaluzAudio === 'world-music').length };
    });
    assert.equal(during.travelling, true);
    assert.equal(during.playing, true, 'A map loading screen must not stop the current score');
    assert.equal(during.suspensions, before.suspensions, 'A loading screen must not suspend and restart the audio context');
    assert.equal(during.count, before.count, 'A loading screen must reuse the existing context');
    assert.ok((await sampleOutput(page, 'world-music')).rms > .01, 'The world score must remain audible while loading');

    await page.evaluate(async () => (await import('/src/game/audio.ts')).setWorldMusicEnabled(false));
    await page.waitForFunction(async () => !(await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    await waitForSuspension(page, 'world-music');
    assert.equal((await sampleOutput(page, 'world-music', 200)).rms, 0, 'An explicit mute must also silence loading screens');
    await page.evaluate(async () => (await import('/src/game/audio.ts')).setWorldMusicEnabled(true));
    await page.waitForFunction(async () => (await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    await page.evaluate(async () => {
      const audio = await import('/src/game/audio.ts');
      audio.settings.masterVolume = 0;
      audio.applyVolumes();
    });
    await page.waitForFunction(async () => !(await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    await waitForSuspension(page, 'world-music');
    assert.equal((await sampleOutput(page, 'world-music', 200)).rms, 0, 'Zero master volume must silence loading screens');
    await page.evaluate(async () => {
      const audio = await import('/src/game/audio.ts');
      audio.settings.masterVolume = 100;
      audio.applyVolumes();
    });
    await page.waitForFunction(async () => (await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(async () => !(await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    await waitForSuspension(page, 'world-music');
    assert.equal((await sampleOutput(page, 'world-music', 200)).rms, 0, 'A hidden loading screen must be silent');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(async () => (await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    await page.evaluate(() => window.__releaseTravel());
    await page.evaluate(() => window.__travel);
    assert.equal(await page.locator('.map-transition').count(), 0);
    assert.equal(await page.evaluate(async () => (await import('/src/game/audio.ts')).worldMusic.diagnostics.playing), true);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

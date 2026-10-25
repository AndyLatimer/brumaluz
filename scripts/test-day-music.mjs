// Audio real del ciclo horario, sin cargar el mundo 3D ni depender de Supabase.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.TEST_MUSIC_PORT || 4192);
const url = `http://127.0.0.1:${port}`;
const phases = ['dawn', 'day', 'dusk', 'night'];
let server, browser;

before(async () => {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: projectRoot });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Music test server did not start')), 15000);
    const fail = error => { clearTimeout(timer); reject(error); };
    server.once('error', fail);
    server.once('exit', code => fail(new Error(`Music test server exited: ${code}`)));
    server.stdout.on('data', data => {
      if (stripVTControlCharacters(data.toString()).includes(url)) { clearTimeout(timer); resolve(); }
    });
    server.stderr.on('data', data => process.stderr.write(data));
  });
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

function trackAudioContexts() {
    const NativeAudioContext = window.AudioContext;
    window.__musicContexts = [];
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) {
        super(...args);
        // Intercept the destination itself: the first gain may belong to a voice,
        // reverb or a compressor, and is not necessarily the final music bus.
        const destination = this.destination;
        const output = this.createGain();
        output.connect(destination);
        Object.defineProperty(this, 'destination', { value: output });
        this.testOutput = output;
        window.__musicContexts.push(this);
      }
    };
}

async function openMusicPage() {
  const context = await browser.newContext();
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(`${url}/__music-test`, route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="es"><meta charset="utf-8"><title>Prueba de música</title><body><button>Activar audio</button></body></html>',
  }));
  await page.goto(`${url}/__music-test`);
  await page.evaluate(trackAudioContexts);
  return { context, page, errors };
}

async function sampleOutput(page, audioKind) {
  return page.evaluate(async audioKind => {
    const contexts = window.__musicContexts.filter(context => context.state !== 'closed' && (!audioKind || context.brumaluzAudio === audioKind));
    if (!contexts.length) return 0;
    const analysers = contexts.map(context => {
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.testOutput.connect(analyser);
      return { context, analyser };
    });
    await new Promise(resolve => setTimeout(resolve, 160));
    let energy = 0;
    for (const { context, analyser } of analysers) {
      const values = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(values);
      for (const value of values) energy += value * value / values.length;
      context.testOutput.disconnect(analyser);
      analyser.disconnect();
    }
    return Math.sqrt(energy);
  }, audioKind);
}

test('music follows world dawn, day, dusk and night boundaries, including wrapped hours', { timeout: 30000 }, async () => {
  const { context, page, errors } = await openMusicPage();
  try {
    const actual = await page.evaluate(async () => {
      const { musicPhaseAtHour } = await import('/src/world/dayMusic.ts');
      return [0, 4.999, 5, 7.999, 8, 17.999, 18, 20.999, 21, 23.999, 24, 29, -3, -6, 48]
        .map(hour => [hour, musicPhaseAtHour(hour)]);
    });
    assert.deepEqual(actual, [
      [0, 'night'], [4.999, 'night'], [5, 'dawn'], [7.999, 'dawn'], [8, 'day'],
      [17.999, 'day'], [18, 'dusk'], [20.999, 'dusk'], [21, 'night'], [23.999, 'night'],
      [24, 'night'], [29, 'dawn'], [-3, 'night'], [-6, 'dusk'], [48, 'night'],
    ]);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('four original scores contain bounded, deterministic arrangements that evolve over 32 bars', { timeout: 30000 }, async () => {
  const { context, page, errors } = await openMusicPage();
  try {
    const result = await page.evaluate(async phases => {
      const { MUSIC_PROFILES, musicBar } = await import('/src/world/dayMusicScore.ts');
      return phases.map(phase => {
        const profile = MUSIC_PROFILES[phase];
        const bars = Array.from({ length: profile.bars }, (_, bar) => musicBar(phase, bar));
        return { phase, profile, bars, repeated: bars.map((_, bar) => musicBar(phase, bar)), wrapped: musicBar(phase, profile.bars) };
      });
    }, phases);
    const signatures = new Set();
    for (const { phase, profile, bars, repeated, wrapped } of result) {
      assert.ok(profile.bars >= 32, `${phase}: a complete phrase needs at least 32 bars`);
      assert.ok(profile.bpm >= 35 && profile.bpm <= 120, `${phase}: ambient tempo stays restrained`);
      assert.ok(Number.isFinite(profile.beatsPerBar) && profile.beatsPerBar > 0);
      assert.ok(profile.title.length > 0);
      assert.deepEqual(repeated, bars, `${phase}: repeated scheduling must return the same score`);
      const phrasing = notes => notes.map(({ velocity, ...note }) => note);
      assert.deepEqual(phrasing(wrapped), phrasing(bars[0]), `${phase}: the phrase must wrap while allowing gentle performance variation`);
      assert.ok(new Set(bars.map(bar => JSON.stringify(bar))).size >= 8, `${phase}: the score must evolve beyond a short four-bar loop`);
      const instruments = new Set(), pitches = new Set();
      for (const notes of bars) {
        assert.ok(notes.length > 0 && notes.length < 100, `${phase}: note density stays within the audio budget`);
        for (const note of notes) {
          assert.ok(Number.isFinite(note.beat) && note.beat >= 0 && note.beat < profile.beatsPerBar);
          assert.ok(Number.isFinite(note.duration) && note.duration > 0);
          assert.ok(Number.isFinite(note.pitch) && note.pitch >= 0 && note.pitch <= 127);
          assert.ok(Number.isFinite(note.velocity) && note.velocity > 0 && note.velocity <= 1);
          assert.ok(Number.isFinite(note.pan) && note.pan >= -1 && note.pan <= 1);
          instruments.add(note.instrument); pitches.add(note.pitch);
        }
      }
      assert.ok(instruments.size >= 2, `${phase}: accompaniment and melody need distinct timbres`);
      assert.ok(pitches.size >= 10, `${phase}: the arrangement needs a musical register`);
      signatures.add(JSON.stringify(bars));
    }
    assert.equal(signatures.size, 4, 'Each time of day has its own arrangement');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('all four arrangements render audible, finite stereo audio with headroom and reproducible voices', { timeout: 120000 }, async t => {
  const { context, page, errors } = await openMusicPage();
  try {
    const renders = await page.evaluate(async phases => {
      const { MUSIC_PROFILES, musicBar } = await import('/src/world/dayMusicScore.ts');
      const { renderNote } = await import('/src/world/dayMusicVoice.ts');
      async function render(phase, bars, keepSamples = false) {
        const profile = MUSIC_PROFILES[phase], beatSeconds = 60 / profile.bpm;
        const notes = Array.from({ length: bars }, (_, bar) => musicBar(phase, bar)
          .map(note => ({ note, start: (bar * profile.beatsPerBar + note.beat) * beatSeconds }))
        ).flat();
        const end = Math.max(...notes.map(({ note, start }) => start + note.duration * beatSeconds)) + 8;
        const audio = new OfflineAudioContext(2, Math.ceil(end * 32000), 32000);
        for (const { note, start } of notes) renderNote(audio, audio.destination, note, start + .05, note.duration * beatSeconds);
        const buffer = await audio.startRendering();
        let peak = 0, energy = 0, sum = 0, finite = true, signature = 2166136261;
        let leftEnergy = 0, rightEnergy = 0, differenceEnergy = 0;
        const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
        for (let i = 0; i < left.length; i++) {
          const l = left[i], r = right[i];
          finite &&= Number.isFinite(l) && Number.isFinite(r);
          peak = Math.max(peak, Math.abs(l), Math.abs(r));
          energy += l * l + r * r; sum += l + r;
          leftEnergy += l * l; rightEnergy += r * r; differenceEnergy += (l - r) ** 2;
          if (i % 64 === 0) signature = Math.imul(signature ^ Math.round(l * 10000000), 16777619) >>> 0;
        }
        return { phase, finite, peak, rms: Math.sqrt(energy / (left.length * 2)), dc: sum / (left.length * 2),
          leftRms: Math.sqrt(leftEnergy / left.length), rightRms: Math.sqrt(rightEnergy / left.length),
          stereoRms: Math.sqrt(differenceEnergy / left.length), signature,
          ...(keepSamples ? { samples: [left, right] } : {}) };
      }
      const results = [];
      for (const phase of phases) {
        const full = await render(phase, 8);
        const first = await render(phase, 2, true), second = await render(phase, 2, true);
        let repeatMaxDelta = 0, repeatEnergy = 0, repeatSamples = 0;
        for (let channel = 0; channel < first.samples.length; channel++) {
          for (let i = 0; i < first.samples[channel].length; i++) {
            const delta = first.samples[channel][i] - second.samples[channel][i];
            repeatMaxDelta = Math.max(repeatMaxDelta, Math.abs(delta));
            repeatEnergy += delta * delta; repeatSamples++;
          }
        }
        results.push({ ...full, repeatMaxDelta, repeatRmsDelta: Math.sqrt(repeatEnergy / repeatSamples) });
      }
      return results;
    }, phases);
    if (process.env.TEST_MUSIC_DIAGNOSTICS) t.diagnostic(JSON.stringify(renders));
    for (const audio of renders) {
      assert.equal(audio.finite, true, `${audio.phase}: samples must never contain NaN or infinity`);
      assert.ok(audio.rms > .0001, `${audio.phase}: the score must produce actual sound (${JSON.stringify(audio)})`);
      assert.ok(audio.peak <= .98, `${audio.phase}: leave headroom rather than clip (${audio.peak})`);
      assert.ok(Math.abs(audio.dc) < .01, `${audio.phase}: avoid a DC offset`);
      assert.ok(audio.leftRms > .0001 && audio.rightRms > .0001, `${audio.phase}: both stereo channels must sound`);
      assert.ok(audio.stereoRms > .00001, `${audio.phase}: instruments must occupy a stereo space`);
      // Browser resampling/summing can differ by float ULPs between renders.
      // Compare PCM rather than hashing those inaudible rounding differences.
      assert.ok(audio.repeatMaxDelta <= .000001 && audio.repeatRmsDelta <= .0000001,
        `${audio.phase}: repeated PCM must agree within float rounding (${JSON.stringify(audio)})`);
    }
    assert.equal(new Set(renders.map(render => render.signature)).size, 4, 'Four phases must produce distinct audio');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('world music unlocks on input, crossfades without piling up, and respects mute and rapid toggles', { timeout: 45000 }, async () => {
  const { context, page, errors } = await openMusicPage();
  try {
    await page.evaluate(async () => {
      const { DayMusic } = await import('/src/world/dayMusic.ts');
      window.__music = new DayMusic(true);
      window.__musicState = { playing: true, hour: 12, inside: false, dialogue: false, combat: false };
      window.__music.setLevel(.8);
      window.__music.update(window.__musicState);
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__musicContexts.length), 0, 'Do not allocate or autoplay before a trusted gesture');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__music.diagnostics.playing && window.__music.diagnostics.contextState === 'running');
    await page.waitForTimeout(1300);
    assert.ok(await sampleOutput(page) > .00001, 'World music must produce actual audio');
    assert.equal(await page.evaluate(() => window.__music.diagnostics.phase), 'day');
    for (const hour of [18.5, 22, 5.5, 12, 21.5, 8.5]) {
      const tracks = await page.evaluate(hour => {
        window.__musicState.hour = hour;
        window.__music.update(window.__musicState);
        return window.__music.diagnostics.tracks;
      }, hour);
      assert.ok(tracks <= 2, `Changing to ${hour}:00 must keep at most two crossfading tracks`);
      await page.waitForTimeout(100);
    }
    assert.equal(await page.evaluate(() => window.__musicContexts.length), 1, 'Phase changes must reuse one context');
    await page.evaluate(() => window.__music.setLevel(0));
    await page.waitForTimeout(700);
    assert.ok(await sampleOutput(page) < .00001, 'Zero music/master gain must silence the destination');
    await page.evaluate(() => window.__music.setLevel(.8));
    await page.waitForTimeout(1000);
    assert.ok(await sampleOutput(page) > .00001, 'Restoring volume must restore the current arrangement');
    await page.evaluate(() => {
      for (const enabled of [false, true, false, true, false]) window.__music.setEnabled(enabled);
    });
    await page.waitForFunction(() => !window.__music.diagnostics.enabled && window.__music.diagnostics.voices === 0 && window.__music.diagnostics.tracks === 0);
    assert.equal(await sampleOutput(page), 0, 'A rapid final mute must remain exactly silent');
    await page.evaluate(() => { window.__music.setLevel(1); window.__music.update({ ...window.__musicState, hour: 5.5 }); });
    await page.waitForTimeout(250);
    assert.equal(await sampleOutput(page), 0, 'Volume and time changes must preserve an explicit mute');
    await page.evaluate(() => { window.__musicState.hour = 5.5; window.__music.setEnabled(true); });
    await page.waitForFunction(() => window.__music.diagnostics.playing);
    await page.waitForTimeout(1000);
    assert.ok(await sampleOutput(page) > .00001, 'Re-enabling must recover once after rapid toggles');
    await page.evaluate(() => window.__music.dispose());
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('hidden tabs and account screens stop world music, visibility restores the current phase, and dispose releases audio', { timeout: 45000 }, async () => {
  const { context, page, errors } = await openMusicPage();
  try {
    await page.evaluate(async () => {
      const { DayMusic } = await import('/src/world/dayMusic.ts');
      window.__music = new DayMusic(true);
      window.__musicState = { playing: true, hour: 12, inside: false, dialogue: false, combat: false };
      window.__music.update(window.__musicState);
    });
    await page.getByRole('button').click();
    await page.waitForFunction(() => window.__music.diagnostics.playing);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => !window.__music.diagnostics.playing && window.__musicContexts.every(context => context.state !== 'running'));
    assert.equal(await sampleOutput(page), 0, 'Background tabs must be silent');
    await page.evaluate(() => {
      window.__musicState.hour = 22;
      window.__music.update(window.__musicState);
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.__music.diagnostics.playing && window.__music.diagnostics.phase === 'night');
    await page.waitForTimeout(1300);
    assert.ok(await sampleOutput(page) > .00001, 'Foregrounding must resume the current world hour');
    await page.evaluate(() => {
      window.__musicState.playing = false;
      window.__music.update(window.__musicState);
    });
    await page.waitForFunction(() => !window.__music.diagnostics.playing && window.__music.diagnostics.voices === 0);
    assert.equal(await sampleOutput(page), 0, 'Leaving the world must release menu audio ownership');
    await page.evaluate(() => { window.__musicState.playing = true; window.__music.update(window.__musicState); });
    await page.waitForFunction(() => window.__music.diagnostics.playing);
    await page.evaluate(() => window.__music.dispose());
    await page.waitForFunction(() => window.__musicContexts.every(context => context.state === 'closed'));
    assert.equal(await page.evaluate(() => window.__music.diagnostics.voices), 0);
    assert.equal(await page.evaluate(() => window.__music.diagnostics.tracks), 0);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__musicContexts.length), 1, 'Disposed gesture listeners must not recreate audio');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('a rejected browser audio resume never escapes into gameplay and disposes cleanly', { timeout: 30000 }, async () => {
  const { context, page, errors } = await openMusicPage();
  try {
    await page.evaluate(async () => {
      window.AudioContext.prototype.resume = () => Promise.reject(new Error('Audio blocked by test browser'));
      const { DayMusic } = await import('/src/world/dayMusic.ts');
      window.__music = new DayMusic(true);
      window.__music.update({ playing: true, hour: 12, inside: false, dialogue: false, combat: false });
    });
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.__music.diagnostics.playing), false);
    assert.equal(await page.evaluate(() => window.__music.diagnostics.voices), 0);
    assert.equal(await sampleOutput(page), 0);
    await page.evaluate(() => window.__music.dispose());
    assert.deepEqual(errors, [], 'Audio failure must not reject a game/frame or gesture handler');
  } finally { await context.close(); }
});

test('the actual game uses the world clock and keeps music options independent, audible and persistent', { timeout: 90000 }, async t => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(trackAudioContexts);
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-ambient', 'off');
    localStorage.setItem('brumaluz-menu-music', 'off');
    localStorage.setItem('brumaluz-language', 'es');
    // A legacy settings object also verifies migration to the new defaults.
    if (!localStorage.getItem('brumaluz-settings')) {
      localStorage.setItem('brumaluz-settings', JSON.stringify({ masterVolume: 80, ambientVolume: 80, nameplates: true }));
    }
  });
  const enterWorld = () => page.evaluate(async () => {
    const { syncWorldClock } = await import('/src/data/worldClock.ts');
    syncWorldClock({ hour: 12, secondsPerHour: 600 });
    window.brumaluz.set({ introSeen: true, welcome: { origin: 0, stage: 'completed' }, shadowQuest: null });
    window.brumaluz.play();
    const { story, talk } = await import('/src/game/state.ts');
    story.introArmed = false; story.houseTourArmed = false; talk.pendingIsbertoIntroduction = false;
  });
  const diagnostics = () => page.evaluate(async () => (await import('/src/game/audio.ts')).worldMusic.diagnostics);
  try {
    await page.goto(`${url}/?test&graphics=compatible`);
    await page.waitForFunction(() => !!window.brumaluz, undefined, { timeout: 60000 });
    await page.locator('#loading.hide').waitFor({ state: 'attached' });
    assert.deepEqual(await page.evaluate(async () => {
      const { settings } = await import('/src/game/audio.ts');
      return { enabled: settings.musicEnabled, volume: settings.musicVolume };
    }), { enabled: true, volume: 55 }, 'Old saved settings must receive usable music defaults');
    await enterWorld();
    await page.keyboard.press('KeyO');
    await page.locator('[data-tab="sound"]').click();
    await page.waitForFunction(async () => (await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    assert.equal(await page.locator('#opt-music').getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('#opt-music-volume').inputValue(), '55');
    for (const [hour, phase] of [[6, 'dawn'], [12, 'day'], [19, 'dusk'], [22, 'night']]) {
      await page.evaluate(async hour => (await import('/src/data/worldClock.ts')).syncWorldClock({ hour, secondsPerHour: 600 }), hour);
      await page.waitForFunction(async phase => (await import('/src/game/audio.ts')).worldMusic.diagnostics.phase === phase, phase);
      assert.ok((await diagnostics()).tracks <= 2, `${phase}: game frames must not multiply music tracks`);
    }
    await page.locator('#opt-music-volume').fill('0');
    await page.waitForFunction(async () => !(await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    assert.equal(await sampleOutput(page, 'world-music'), 0, 'The real music volume control must stop audible music');
    await page.locator('#opt-music-volume').fill('38');
    await page.waitForFunction(async () => (await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    await page.waitForTimeout(1600);
    assert.ok(await sampleOutput(page, 'world-music') > .00001, 'The real volume control must restore audio');
    await page.locator('#opt-ambient').click();
    await page.locator('#opt-ambient-volume').fill('17');
    await page.locator('#opt-ambient').click();
    assert.equal((await diagnostics()).enabled, true, 'Ambient controls must preserve the music preference');
    const musicAfterAmbient = await page.evaluate(async () => {
      const { worldMusic, settings } = await import('/src/game/audio.ts');
      const { play } = await import('/src/game/state.ts');
      return { ...worldMusic.diagnostics, mode: play.mode, travelling: play.mapTravelling, hidden: document.hidden,
        musicLevel: settings.musicVolume, master: settings.masterVolume };
    });
    if (process.env.TEST_MUSIC_DIAGNOSTICS) t.diagnostic(JSON.stringify(musicAfterAmbient));
    assert.equal(musicAfterAmbient.playing, true, `Disabling environmental sound must leave the score playing: ${JSON.stringify(musicAfterAmbient)}`);
    await page.locator('#opt-music').click();
    await page.waitForFunction(async () => !(await import('/src/game/audio.ts')).worldMusic.diagnostics.playing);
    assert.equal(await sampleOutput(page, 'world-music'), 0);
    assert.deepEqual(await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('brumaluz-settings'));
      return { enabled: saved.musicEnabled, volume: saved.musicVolume, ambient: saved.ambientVolume };
    }), { enabled: false, volume: 38, ambient: 17 });
    await page.evaluate(async () => (await import('/src/game/playSession.ts')).exitPlay());
    assert.equal((await diagnostics()).playing, false, 'Leaving a real play session must relinquish music output');
    await page.reload();
    await page.waitForFunction(() => !!window.brumaluz, undefined, { timeout: 60000 });
    await page.locator('#loading.hide').waitFor({ state: 'attached' });
    await enterWorld();
    await page.keyboard.press('KeyO');
    await page.locator('[data-tab="sound"]').click();
    assert.equal(await page.locator('#opt-music').getAttribute('aria-checked'), 'false', 'Music mute must survive reload');
    assert.equal(await page.locator('#opt-music-volume').inputValue(), '38', 'Music volume must survive reload');
    assert.equal((await diagnostics()).playing, false);
    assert.equal(await sampleOutput(page, 'world-music'), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

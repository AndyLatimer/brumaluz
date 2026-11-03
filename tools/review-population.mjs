// Actual editor and game review with local preview characters. Never writes to an account or NPC catalog.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const dialogueOnly = process.argv.includes('--dialogue');
const output = process.argv.includes('--content') ? 'art/population-review/content' : dialogueOnly ? 'art/population-review/dialogue' : process.argv.includes('--fixes') ? 'art/population-review/bugfixes' : 'art/population-review/expansion';
const speechOnly = process.argv.includes('--speech');
await mkdir(output, { recursive: true });
const server = await createServer({ cacheDir: 'node_modules/.vite-population',
  server: { host: '127.0.0.1', port: 4276, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
let browser;
const errors = [], report = { editor: [], game: [], errors };
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('brumaluz-language', 'es'); localStorage.setItem('brumaluz-ambient', 'off');
    localStorage.setItem('brumaluz-menu-music', 'off');
  });
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  const base = 'http://127.0.0.1:4276';
  if (!speechOnly && !dialogueOnly) {
  await page.goto(`${base}/npcs.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#library option[value="vecino_levante_1"]'), null, { timeout: 120000 });
  for (const id of ['vecino_levante_1', 'vecino_levante_2', 'vecino_levante_3', 'vecino_pozo_1', 'habitante_brumaluz_19']) {
    await page.selectOption('#library', id);
    await page.locator('#load').click();
    await page.waitForFunction(id => document.querySelector('#npc-id').value === id && document.querySelector('#preview-name').textContent === document.querySelector('#npc-name').value, id);
    assert.equal(await page.locator('#npc-subtitle').inputValue(), 'Habitante de Brumaluz');
    assert.equal(await page.locator('#preview-subtitle').textContent(), 'Habitante de Brumaluz');
    await page.selectOption('#animation', 'idle');
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${output}/editor-${id}.png` });
    await page.selectOption('#animation', 'seat');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${output}/editor-seat-${id}.png` });
    assert.equal(await page.locator('#delete').isDisabled(), true, 'world residents retain stable IDs');
    report.editor.push({ id, name: await page.locator('#preview-name').textContent(), seated: true });
  }
  console.log('Editor: four lineages, walking/idle and seating previews loaded.');
  }
  await page.goto(`${base}/?test&welcome&graphics=compatible`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.brumaluz, null, { timeout: 180000 });
  await page.evaluate(async () => {
    (await import('/src/data/worldClock.ts')).syncWorldClock({ hour: 11, secondsPerHour: 100000 });
    window.brumaluz.set({ introSeen: true, welcome: { stage: 'completed', origin: 0 }, shadowQuest: 'returned', position: { x: 138, z: 4, yaw: 0 } });
    window.brumaluz.play(); window.brumaluz.view(0, .5, 13);
  });
  const initial = await page.evaluate(async () => (await import('/src/game/cities.ts')).cityPopulation.snapshot());
  assert.equal(initial.length, 54);
  await page.evaluate(async () => {
    const reviewStage = await import('/src/game/stage.ts');
    const reviewState = await import('/src/game/state.ts');
    const reviewCities = await import('/src/game/cities.ts');
    const reviewConversation = await import('/src/game/conversation.ts');
    window.frameReviewNpc = async id => {
      const { npcActors } = await import('/src/game/cities.ts');
      const { play, story, session } = await import('/src/game/state.ts');
      const { holder, camera, camTarget } = await import('/src/game/stage.ts');
      const guide = id === 'gnomi', actor = npcActors.find(npc => npc.id === id);
      const root = guide ? story.welcomeWorld.root : actor.character.root;
      const character = guide ? session.worldCharacters.gnomi : actor.character;
      character.root.updateWorldMatrix(true, true);
      const head = character.headWorld(); head.y += .28;
      for (const distance of [8, 5, 3, 2]) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, .7, -.7, 2.4, -2.4]) {
        const p = root.position.clone(); p.x += Math.sin(yaw) * 1.8; p.z += Math.cos(yaw) * 1.8; p.y = play.city.groundY(p.x, p.z);
        if (play.city.collide(p, p.clone()).distanceTo(p) > .05) continue;
        const eye = p.clone(); eye.x += Math.sin(yaw) * Math.cos(.4) * distance; eye.z += Math.cos(yaw) * Math.cos(.4) * distance;
        eye.y += 1.3 + Math.sin(.4) * distance;
        if (!play.city.lineOfSight(eye, head)) continue;
        window.brumaluz.move(p.x, p.z); window.brumaluz.view(yaw, .4, distance);
        (await import('/src/game/camera.ts')).noteCameraControl();
        camTarget.copy(holder.position); camTarget.y += 1.3;
        camera.position.copy(eye); camera.lookAt(camTarget); camera.updateMatrixWorld();
        return;
      }
      throw Error(`No unobstructed review camera for ${id}`);
    };
    window.reviewGuideVisible = () => reviewState.story.welcomeWorld.root.visible;
    window.reviewConversationShot = () => reviewState.talk.conversationShot;
    window.conversationFraming = () => {
      const { camera, camTarget, holder } = reviewStage;
      const { play, talk } = reviewState;
      const { npcActors } = reviewCities;
      const { conversationPosition } = reviewConversation;
      const actor = npcActors.find(npc => npc.character.root === talk.conversationActor);
      if (!actor) return { ready: false };
      camera.updateMatrixWorld();
      const dialogTop = document.getElementById('dialog').getBoundingClientRect().top;
      const offset = (innerHeight - 24 - Math.max(84, dialogTop - 16)) * .5;
      const target = holder.position.clone().add(actor.character.root.position).multiplyScalar(.5);
      target.y = Math.max(holder.position.y, actor.character.root.position.y) + 1;
      const subjects = [play.char, actor.character].map(character => {
        const head = character.headWorld().project(camera);
        const x = (head.x * .5 + .5) * innerWidth, y = (-head.y * .5 + .5) * innerHeight;
        return { x, y, visible: head.z > -1 && head.z < 1 && x > 8 && x < innerWidth - 8 && y > 8 && y < dialogTop - 8 };
      });
      return { ready: camera.position.distanceTo(conversationPosition) < .12 && camTarget.distanceTo(target) < .12
        && Math.abs(talk.conversationOffset - offset) < 1 && subjects.every(subject => subject.visible), subjects, dialogTop };
    };
  });
  report.chatter = await page.evaluate(async () => {
    const { updateNpcBarks, barkCooldown } = await import('/src/game/targets.ts');
    const { npcActors, cityPopulation } = await import('/src/game/cities.ts');
    const { play, ui, story } = await import('/src/game/state.ts');
    const { camera, holder, clock } = await import('/src/game/stage.ts');
    const { cinematic } = await import('/src/story/scenes.ts');
    const { talkTo } = await import('/src/game/interaction.ts');
    const { closeDialog } = await import('/src/ui/dialog.ts');
    const actor = npcActors.find(npc => npc.id === 'vecino_levante_1');
    const release = cityPopulation.hold(actor.id);
    const savedBarks = npcActors.map(npc => [story.NPCS[npc.id], story.NPCS[npc.id].barks]);
    const line = 'Un rato tranquilo para conversar.';
    const count = () => [...document.querySelectorAll('#chat .k-npc .chat-text')].filter(node => node.textContent === line).length;
    const lineOfSight = play.city.lineOfSight;
    const checks = [];
    try {
      for (const [definition] of savedBarks) definition.barks = [];
      story.NPCS[actor.id].barks = [line];
      await window.frameReviewNpc(actor.id);
      cityPopulation.updatePresentation(clock.getElapsedTime(), camera, holder.position, true, true);
      for (const [state, key, value] of [[play, 'dead', true], [play, 'mapTravelling', true], [play, 'actionBusy', true],
        [ui, 'gameMenuOpen', true], [ui, 'playerMenuOpen', true], [ui, 'worldMenuOpen', true], [ui, 'optionsOpen', true],
        [ui, 'openWindow', 'sheet']]) {
        const original = state[key]; state[key] = value;
        try { updateNpcBarks(); checks.push({ state: key, lines: count(), cooldown: barkCooldown.has(actor.id) }); }
        finally { state[key] = original; }
      }
      cinematic.play([{ duration: 1 }], () => {}); updateNpcBarks();
      checks.push({ state: 'cinematic', lines: count(), cooldown: barkCooldown.has(actor.id) });
      cinematic.cancel();
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      try {
        updateNpcBarks(); checks.push({ state: 'background', lines: count(), cooldown: barkCooldown.has(actor.id) });
      } finally { delete document.hidden; }
      talkTo(actor.id); updateNpcBarks();
      checks.push({ state: 'dialogue', lines: count(), cooldown: barkCooldown.has(actor.id) });
      closeDialog();
      play.city.lineOfSight = () => false; updateNpcBarks();
      checks.push({ state: 'wall', lines: count(), cooldown: barkCooldown.has(actor.id) });
      const visible = actor.character.root.visible; actor.character.root.visible = false;
      play.city.lineOfSight = () => true; updateNpcBarks(); actor.character.root.visible = visible;
      checks.push({ state: 'hidden', lines: count(), cooldown: barkCooldown.has(actor.id) });
      const originalType = story.NPCS[actor.id].type; story.NPCS[actor.id].type = 'debug';
      try { updateNpcBarks(); checks.push({ state: 'debug', lines: count(), cooldown: barkCooldown.has(actor.id) }); }
      finally { story.NPCS[actor.id].type = originalType; }
      updateNpcBarks(); const audible = count();
      barkCooldown.delete(actor.id); updateNpcBarks();
      return { checks, audible, immediateRepeat: count() };
    } finally {
      play.city.lineOfSight = lineOfSight;
      for (const [definition, barks] of savedBarks) definition.barks = barks;
      release();
    }
  });
  assert.ok(report.chatter.checks.every(check => check.lines === 0 && !check.cooldown), JSON.stringify(report.chatter));
  assert.equal(report.chatter.audible, 1, 'an audible NPC still comments');
  assert.equal(report.chatter.immediateRepeat, 1, 'the global gap prevents overlapping barks');
  console.log('Chatter: quiet contexts, walls, hidden actors and overlapping comments checked.');
  const mapPoints = await page.evaluate(async () => {
    const points = (await import('/src/ui/gameInterface.ts')).zoneMapPoints();
    const { RESIDENT_IDS } = await import('/src/data/cityPopulation.ts');
    return { residents: points.filter(point => RESIDENT_IDS.includes(point.id)).length, debug: points.some(point => point.id === 'testiculos') };
  });
  assert.equal(mapPoints.residents, 0, 'the common map/minimap source excludes ambient residents');
  assert.ok(mapPoints.debug, 'other NPC map markers remain available'); report.maps = mapPoints;
  report.residentContent = await page.evaluate(async () => {
    const { RESIDENT_IDS, CITY_POPULATIONS, RESIDENT_SUBTITLE } = await import('/src/data/cityPopulation.ts');
    const { session, story } = await import('/src/game/state.ts');
    const { t, setLanguage } = await import('/src/ui/i18n.ts');
    const subtitles = [...new Set(RESIDENT_IDS.map(id => session.registeredNpcs[id].subtitle))];
    setLanguage('en'); const english = t(RESIDENT_SUBTITLE[0]); setLanguage('es');
    return { subtitles, english,
      greetings: RESIDENT_IDS.slice(0, 6).map(id => story.NPCS[id].conversation.nodes.intro.text),
      scenes: CITY_POPULATIONS.brumaluz.districts.flatMap(district => district.exchanges).map(({ id, lines, near }) => ({ id, lines, near })) };
  });
  assert.deepEqual(report.residentContent.subtitles, ['Habitante de Brumaluz']);
  assert.equal(report.residentContent.english, 'Brumaluz resident');
  if (!speechOnly) {
  if (!dialogueOnly) {
  const districts = await page.evaluate(async () => (await import('/src/data/cityPopulation.ts')).CITY_POPULATIONS.brumaluz.districts.map(d => d.id));
  for (const district of districts) {
    const result = await page.evaluate(async districtId => {
      const { cityPopulation, npcActors } = await import('/src/game/cities.ts');
      const { CITY_POPULATIONS } = await import('/src/data/cityPopulation.ts');
      const { play } = await import('/src/game/state.ts');
      const { holder } = await import('/src/game/stage.ts');
      const { chatNpc } = await import('/src/ui/chatWindow.ts');
      const { session } = await import('/src/game/state.ts');
      const district = CITY_POPULATIONS.brumaluz.districts.find(d => d.id === districtId);
      const [x, z] = district.route[1]; window.brumaluz.move(x + 4, z + 5);
      const speech = [];
      for (let i = 0; i < 240; i++) cityPopulation.update(.1, {
        player: holder.position, playerSeated: false, quiet: false,
        say(id, line) { speech.push({ id, line }); chatNpc(session.registeredNpcs[id].name, line); },
      });
      return { district: districtId, speech, residents: cityPopulation.snapshot().filter(r => district.residents.includes(r.id)),
        loaded: npcActors.filter(n => district.residents.includes(n.id)).every(n => n.character.root.children.length > 0), location: play.city.locationId };
    }, district);
    assert.equal(result.location, 'brumaluz'); assert.equal(result.residents.length, 6); assert.ok(result.loaded);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${output}/game-${district}.png` });
    report.game.push(result);
    console.log(`Game: ${district}, ${result.speech.length} ambient lines.`);
  }
  const benchReview = await page.evaluate(async () => {
    const { cityPopulation, npcActors } = await import('/src/game/cities.ts');
    const { play } = await import('/src/game/state.ts');
    const { holder } = await import('/src/game/stage.ts');
    const { residentDistrict } = await import('/src/data/cityPopulation.ts');
    window.brumaluz.move(33, 38); window.brumaluz.view(0, .35, 9);
    for (let i = 0; i < 1500; i++) {
      cityPopulation.update(.1, { player: holder.position, playerSeated: false, quiet: true, say() {} });
      const seated = cityPopulation.snapshot().find(r => r.activity === 'seated' && residentDistrict(r.id)?.id === 'jardin');
      if (seated) {
        const actor = npcActors.find(npc => npc.id === seated.id), seat = play.city.seats.find(seat => seat.id === seated.seat);
        window.brumaluz.move(seat.position.x + Math.sin(seat.yaw) * 3, seat.position.z + Math.cos(seat.yaw) * 3);
        window.brumaluz.view(seat.yaw, .3, 8);
        return { id: actor.id, seat: seated.seat, seatHeight: seat.seatHeight, ground: seat.position.y, modelSeatHeight: actor.character.seatHeight };
      }
    }
    return null;
  });
  assert.ok(benchReview, 'a resident sits on the garden bench in the actual game');
  assert.ok(Math.abs(benchReview.modelSeatHeight - (benchReview.seatHeight - benchReview.ground)) < .001, 'sitting uses height relative to the ground');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${output}/game-seated.png` });
  report.bench = benchReview;
  }
  await page.evaluate(async () => {
    const { conversationRay } = await import('/src/game/conversation.ts');
    const { npcActors } = await import('/src/game/cities.ts');
    const roots = new Set(npcActors.map(npc => npc.character.root));
    const intersectObjects = conversationRay.intersectObjects;
    const result = { queries: 0, hidden: 0, maxNpcObstacles: 0 };
    conversationRay.intersectObjects = function (objects, ...args) {
      const actors = objects.filter(root => roots.has(root));
      result.queries++;
      result.hidden += actors.filter(root => !root.visible || !root.parent).length;
      result.maxNpcObstacles = Math.max(result.maxNpcObstacles, actors.length);
      return intersectObjects.call(this, objects, ...args);
    };
    window.finishConversationCameraReview = () => { conversationRay.intersectObjects = intersectObjects; return result; };
  });
  const talked = await page.evaluate(async () => {
    const { npcActors, cityPopulation } = await import('/src/game/cities.ts');
    const { talkTo } = await import('/src/game/interaction.ts');
    const actor = npcActors.find(n => n.id === 'vecino_lonja_1');
    await window.frameReviewNpc(actor.id);
    talkTo(actor.id);
    // Exercise the exported controller explicitly as well as the live render loop.
    (await import('/src/game/conversation.ts')).updateConversationCamera(0);
    return { id: actor.id, before: actor.character.root.position.toArray(), state: cityPopulation.snapshot().find(r => r.id === actor.id).activity };
  });
  assert.equal(talked.state, 'scripted');
  await page.locator('#dialog').waitFor();
  // This Playwright version treats a Promise as truthy; keep polling predicates synchronous.
  const desktopFrame = await page.waitForFunction(() => {
    const frame = window.conversationFraming(); return frame.ready ? frame : false;
  }, null, { timeout: 60000 });
  report.desktopFraming = await desktopFrame.jsonValue(); await desktopFrame.dispose();
  assert.equal(report.desktopFraming.ready, true);
  console.log(`Desktop dialogue framing: ${JSON.stringify(report.desktopFraming)}`);
  report.conversationCamera = await page.evaluate(() => window.finishConversationCameraReview());
  assert.ok(report.conversationCamera.queries > 0, 'exercised actual dialogue camera raycasts');
  assert.equal(report.conversationCamera.hidden, 0, 'culled NPCs cannot obstruct the dialogue camera');
  assert.deepEqual(await page.evaluate(async id => (await import('/src/game/cities.ts')).npcActors.find(n => n.id === id).character.root.position.toArray(), talked.id), talked.before);
  await page.screenshot({ path: `${output}/game-dialogue.png` });
  const desktopShot = await page.evaluate(async () => (await import('/src/game/state.ts')).talk.conversationShot);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFrame = await page.waitForFunction(previous => {
    const frame = window.conversationFraming();
    return window.reviewConversationShot() !== previous && frame.ready ? frame : false;
  }, desktopShot, { timeout: 60000 });
  report.mobileFraming = await mobileFrame.jsonValue(); await mobileFrame.dispose();
  assert.equal(report.mobileFraming.ready, true);
  await page.screenshot({ path: `${output}/game-dialogue-mobile.png` });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(async () => (await import('/src/ui/dialog.ts')).closeDialog());
  await page.setViewportSize({ width: 1440, height: 1000 });
  }
  if (!dialogueOnly) {
  const residentBubble = await page.evaluate(async () => {
    const { npcActors, cityPopulation } = await import('/src/game/cities.ts');
    const actor = npcActors.find(actor => actor.id === 'vecino_levante_1');
    cityPopulation.hold(actor.id);
    await window.frameReviewNpc(actor.id);
    const { chatNpc } = await import('/src/ui/chatWindow.ts');
    const { session } = await import('/src/game/state.ts');
    chatNpc(session.registeredNpcs[actor.id].name, 'Me apetece pasear un rato más. Si tienes un momento, puedes acompañarme; hoy no tengo ninguna prisa por volver.');
    return actor.id;
  });
  await page.waitForFunction(id => {
    const bubble = document.querySelector(`.npc-speech-bubble[data-npc-id="${id}"]`);
    return bubble && !bubble.hidden;
  }, residentBubble);
  await page.screenshot({ path: `${output}/game-speech-bubble.png` });
  await page.evaluate(async id => {
    (await import('/src/game/audio.ts')).settings.nameplates = false;
    const { session } = await import('/src/game/state.ts');
    (await import('/src/ui/chatWindow.ts')).chatNpc(session.registeredNpcs[id].name,
      'Me apetece pasear un rato más. Si tienes un momento, puedes acompañarme; hoy no tengo ninguna prisa por volver.');
  }, residentBubble);
  await page.waitForFunction(id => {
    const bubble = document.querySelector(`.npc-speech-bubble[data-npc-id="${id}"]`);
    return bubble && !bubble.hidden && [...document.querySelectorAll('.nameplate.npc')].every(plate => plate.hidden);
  }, residentBubble);
  await page.evaluate(async () => { (await import('/src/game/audio.ts')).settings.nameplates = true; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async id => {
    const { session } = await import('/src/game/state.ts');
    (await import('/src/ui/chatWindow.ts')).chatNpc(session.registeredNpcs[id].name,
      'Me apetece pasear un rato más. Si tienes un momento, puedes acompañarme; hoy no tengo ninguna prisa por volver.');
  }, residentBubble);
  await page.waitForFunction(id => {
    const bubble = document.querySelector(`.npc-speech-bubble[data-npc-id="${id}"]`);
    return bubble && !bubble.hidden;
  }, residentBubble);
  const bubbleBounds = await page.locator(`.npc-speech-bubble[data-npc-id="${residentBubble}"]`).boundingBox();
  assert.ok(bubbleBounds && bubbleBounds.x >= 0 && bubbleBounds.x + bubbleBounds.width <= 390);
  await page.screenshot({ path: `${output}/game-speech-bubble-mobile.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const emitNpc = async id => {
    await page.evaluate(async id => {
      const { npcActors } = await import('/src/game/cities.ts');
      const { session, story } = await import('/src/game/state.ts');
      await window.frameReviewNpc(id);
      (await import('/src/ui/chatWindow.ts')).chatNpc(session.registeredNpcs[id].name, 'Me alegra verte por aquí.');
    }, id);
    await page.waitForFunction(id => {
      const bubble = document.querySelector(`.npc-speech-bubble[data-npc-id="${id}"]`);
      return bubble && !bubble.hidden;
    }, id);
  };
  await emitNpc('testiculos');
  await page.evaluate(async () => {
    window.brumaluz.set({ introSeen: true, welcome: { stage: 'available', origin: 0 }, shadowQuest: null });
    window.brumaluz.move(153.5, 2.5);
  });
  await page.waitForFunction(() => window.reviewGuideVisible());
  await emitNpc('gnomi');
  report.speech = { resident: residentBubble, debug: true, guide: true, withoutNameplates: true };
  await page.evaluate(async () => {
    window.brumaluz.set({ introSeen: true, welcome: { stage: 'completed', origin: 0 }, shadowQuest: 'returned' });
    await (await import('/src/game/cities.ts')).switchGameMap('taller_herreria_interior');
  });
  await emitNpc('isberto');
  await page.evaluate(async () => (await import('/src/game/cities.ts')).switchGameMap('taller_cocina_interior'));
  await emitNpc('maestro_cocina');
  report.speech.smith = true; report.speech.master = true;
  await page.evaluate(async () => (await import('/src/game/cities.ts')).switchGameMap('brumaluz'));
  await page.waitForFunction(() => document.querySelectorAll('.npc-speech-bubble').length === 0);
  const transitions = await page.evaluate(async () => {
    const cities = await import('/src/game/cities.ts');
    await cities.switchGameMap('taller_cocina_interior');
    const interior = cities.cityPopulation.snapshot();
    const interiorResidents = cities.npcActors.filter(actor => actor.id.startsWith('vecino_')).length;
    await cities.switchGameMap('brumaluz');
    return { interior: interior.length, interiorResidents, returned: cities.cityPopulation.snapshot().length,
      plates: document.querySelectorAll('.nameplate.npc:not(.welcome-nameplate)').length, actors: cities.npcActors.length };
  });
  assert.equal(transitions.interior, 0); assert.equal(transitions.interiorResidents, 0); assert.equal(transitions.returned, 54);
  assert.equal(transitions.plates, transitions.actors);
  report.transitions = transitions;
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/review.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(`Review passed: ${output}`);
} finally { await browser?.close(); await server.close(); }

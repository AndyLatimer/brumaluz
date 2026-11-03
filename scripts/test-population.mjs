import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createServer } from 'vite';
import { assetBoxes } from '../tools/asset-bounds.mjs';

let server, CityPopulation, populationSites, crowdStep, config, realCity, catalog;
const actor = () => ({ root: new THREE.Group(), seated: false, gait: 'idle',
  get isSeated() { return this.seated; },
  stand() { this.seated = false; }, sit() { this.seated = true; return true; },
  setGait(gait) { this.gait = gait; }, setLocomotionSpeed() {}, speak() {},
});
const fixture = (city = realCity) => {
  const characters = new Map(populationSites(city).map(site => {
    const character = actor(); character.root.position.copy(site.position);
    return [site.id, character];
  }));
  return { characters, population: new CityPopulation(city, characters) };
};
const context = (x = 30, z = 30) => ({ player: new THREE.Vector3(x, realCity.groundY(x, z), z),
  playerSeated: false, quiet: false, say() {} });

function benchFixture() {
  const seat = { id: 'bench', position: new THREE.Vector3(), yaw: 0, seatHeight: .64 };
  const city = { locationId: 'brumaluz', seats: [seat], groundY: () => 0, collide: (_from, to) => to };
  const id = config.CITY_POPULATIONS.brumaluz.districts[0].residents[2], character = actor();
  character.root.position.set(0, 0, 4);
  const population = new CityPopulation(city, new Map([[id, character]]));
  const ctx = { player: new THREE.Vector3(10, 0, 0), playerSeated: false, quiet: true, blockers: [], say() {} };
  return { city, seat, id, character, population, ctx };
}

function advanceUntil(population, ctx, predicate, seconds = 30) {
  for (let i = 0; i < seconds * 10; i++) {
    population.update(.1, ctx);
    if (predicate(population.snapshot()[0])) return;
  }
  assert.fail('resident did not reach the expected activity');
}

before(async () => {
  server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true } });
  ({ CityPopulation, populationSites } = await server.ssrLoadModule('/src/world/population.ts'));
  ({ crowdStep } = await server.ssrLoadModule('/src/world/crowdMovement.ts'));
  config = await server.ssrLoadModule('/src/data/cityPopulation.ts');
  const schema = await server.ssrLoadModule('/src/data/npcs.ts');
  catalog = schema.validateNpcCatalog(JSON.parse(await readFile('src/data/npcs.json', 'utf8')));
  const maps = await server.ssrLoadModule('/src/data/maps.ts');
  const runtime = await server.ssrLoadModule('/src/world/mapRuntime.ts');
  const map = maps.validateMap(JSON.parse(await readFile('src/data/maps/brumaluz.json', 'utf8')));
  const field = new runtime.TerrainField(maps.decodeTerrain(map.terrain));
  const collision = runtime.buildCollision(map, field, await assetBoxes({ footprint: true, only: new Set(map.objects.map(o => o.asset)) }));
  const seats = map.objects.filter(o => /bench/i.test(o.asset)).flatMap(o => [-.36, .36].map((side, index) => {
    const [x, y, z] = o.position, yaw = o.rotation[1], scale = Math.max(Math.abs(o.scale[0]), Math.abs(o.scale[2]));
    const sx = x + (side * Math.cos(yaw) + .4 * Math.sin(yaw)) * scale;
    const sz = z + (-side * Math.sin(yaw) + .4 * Math.cos(yaw)) * scale;
    return { id: `map-object-${o.id}-${index}`, position: new THREE.Vector3(sx, field.heightAt(sx, sz), sz), yaw,
      seatHeight: (o.conform ? field.heightAt(x, z) + y : y) + .64 * scale };
  }));
  realCity = { ...collision, locationId: 'brumaluz', seats };
});
after(async () => server?.close());

test('all 54 residents have editable, unarmed appearances, distinct IDs and valid starts in the real city', async () => {
  assert.equal(config.RESIDENT_IDS.length, 54);
  const races = new Set();
  const names = new Set();
  const { namePool } = await server.ssrLoadModule('/src/data/characterNames.ts');
  const pools = new Map(['humano', 'elfo', 'lagto', 'pelso'].map(race => [race, new Set(namePool(race))]));
  const blocked = [];
  const subtitles = new Set();
  for (const site of populationSites(realCity)) {
    const npc = catalog.npcs.find(npc => npc.id === site.id);
    assert.ok(npc, site.id); races.add(npc.appearance.race);
    assert.ok(pools.get(npc.appearance.race).has(npc.name), `${site.id}: personal name shared with the creator`);
    names.add(npc.name);
    subtitles.add(npc.subtitle);
    assert.ok(!/^vecin[oa]/i.test(npc.subtitle), 'subtitles describe an interest or routine');
    assert.equal(npc.render.weapon, ''); assert.equal(npc.render.offhand, '');
    assert.ok(!npc.name.includes('?'), `UTF-8 name: ${site.id}`);
    const corrected = realCity.collide(site.position, site.position.clone());
    if (corrected.distanceTo(site.position) >= .06) {
      const alternatives = [];
      for (let dx = -4; dx <= 4; dx += 2) for (let dz = -4; dz <= 4; dz += 2) {
        const p = site.position.clone().add(new THREE.Vector3(dx, 0, dz)); p.y = realCity.groundY(p.x, p.z);
        if (realCity.collide(p, p.clone()).distanceTo(p) < .03) alternatives.push([p.x, p.z]);
      }
      blocked.push({ id: site.id, position: site.position.toArray(), alternatives });
    }
    assert.ok(!realCity.waterAt(site.position.x, site.position.z), `${site.id}: dry start`);
  }
  assert.equal(races.size, 4);
  assert.equal(names.size, 54);
  assert.deepEqual([...subtitles], ['Habitante de Brumaluz'], 'residents share one ordinary role instead of personal titles');
  assert.ok(Math.max(...populationSites(realCity).map(site => site.position.z)) > 120, 'residents reach the southern quarters');
  assert.ok(Math.min(...populationSites(realCity).map(site => site.position.z)) < -120, 'residents reach the northern quarters');
  assert.deepEqual(blocked, [], 'all resident starts must be outside obstacles');
  assert.equal(populationSites({ ...realCity, locationId: 'pompelin' }).length, 0);
});

test('real-map walks stay on dry ground, use benches and exchange alternating lines nearby', async () => {
  const { speechSeconds } = await server.ssrLoadModule('/src/data/speech.ts');
  const { population } = fixture(), ctx = context();
  const activities = new Set(), moved = new Set(), seated = new Set(), speech = [];
  const starts = new Map(population.snapshot().map(r => [r.id, r.position]));
  const byDistrict = new Map(config.CITY_POPULATIONS.brumaluz.districts.flatMap(d => d.residents.map(id => [id, d])));
  let elapsed = 0;
  ctx.say = (id, line) => speech.push({ id, line, at: elapsed });
  for (let i = 0; i < 5400; i++) {
    elapsed = i / 10;
    // Visit all neighbourhoods rather than generating dialogue across the map.
    const district = config.CITY_POPULATIONS.brumaluz.districts[Math.floor(i / 600)];
    const [x, z] = district.route[1]; ctx.player.set(x + 5, realCity.groundY(x + 5, z + 5), z + 5);
    population.update(.1, ctx);
    const snapshots = population.snapshot(), taken = snapshots.flatMap(r => r.seat ? [r.seat] : []);
    assert.equal(taken.length, new Set(taken).size, 'no double-booked seats');
    for (let a = 0; a < snapshots.length; a++) for (let b = a + 1; b < snapshots.length; b++) {
      const first = snapshots[a], second = snapshots[b];
      if (first.activity === 'seated' || second.activity === 'seated') continue;
      assert.ok(Math.hypot(first.position[0] - second.position[0], first.position[2] - second.position[2]) >= 1.075,
        `${first.id} / ${second.id}: do not overlap at ${i / 10}s`);
    }
    for (const resident of snapshots) {
      activities.add(resident.activity);
      if (resident.activity === 'seated') seated.add(resident.id);
      if (Math.hypot(resident.position[0] - starts.get(resident.id)[0], resident.position[2] - starts.get(resident.id)[2]) > 2) moved.add(resident.id);
      if (resident.activity !== 'seated') {
        assert.ok(!realCity.waterAt(resident.position[0], resident.position[2]), `${resident.id}: does not wander into water`);
        const p = new THREE.Vector3(...resident.position);
        assert.ok(realCity.collide(p, p.clone()).distanceTo(p) < .004, `${resident.id}: remains outside buildings`);
      }
    }
  }
  assert.equal(moved.size, 54, `every resident walks, missing: ${config.RESIDENT_IDS.filter(id => !moved.has(id))}`);
  assert.ok(seated.size >= 2, `${seated.size} residents use real benches`);
  assert.ok(activities.has('talking'));
  assert.ok(speech.length >= 6, `${speech.length} ambient lines`);
  assert.ok(speech.length <= 36, 'conversations are less frequent, with a global 45–70 s interval');
  assert.ok(speech.some((line, i) => i && line.id !== speech[i - 1].id && byDistrict.get(line.id) === byDistrict.get(speech[i - 1].id)), 'two neighbours actually exchange lines');
  for (let i = 1; i < speech.length; i++)
    assert.ok(speech[i].at - speech[i - 1].at >= speechSeconds(speech[i - 1].line), 'the previous mouth and bubble finish before another line starts');
  console.log(JSON.stringify({ walked: moved.size, rested: seated.size, lines: speech.length }));
});

test('oncoming walkers pass each other, and yield safely in a narrow street', () => {
  for (const narrow of [false, true]) {
    const city = { groundY: () => 0, collide: (from, to) => narrow && Math.abs(to.x) < 2 && Math.abs(to.z) > .18 ? from.clone() : to };
    const bodies = [-3.5, 3.5].map((x, priority) => ({ position: new THREE.Vector3(x, 0, 0), velocity: new THREE.Vector3(), radius: .5, priority, blocked: 0 }));
    const goals = [new THREE.Vector3(3.5, 0, 0), new THREE.Vector3(-3.5, 0, 0)], dt = .05;
    for (let i = 0; i < 1800; i++) for (let j = 0; j < bodies.length; j++) {
      const body = bodies[j], next = crowdStep(city, body, goals[j], 1, dt, bodies.filter(other => other !== body), body.blocked);
      body.velocity.copy(next).sub(body.position).divideScalar(dt);
      body.blocked = next.distanceTo(body.position) < .001 ? body.blocked + dt : Math.max(0, body.blocked - dt);
      body.position.copy(next);
      assert.ok(bodies[0].position.distanceTo(bodies[1].position) >= 1.075, 'no intersections while passing');
    }
    assert.ok(bodies.every((body, i) => body.position.distanceTo(goals[i]) < .15), `both walkers finish (${narrow ? 'narrow' : 'open'} street)`);
  }
});

test('street patrols follow neighbouring stops and turn only at the ends; gardens keep their circuit', async () => {
  const { populationPatrol, closestPatrolStop, nextPatrolStop } = await server.ssrLoadModule('/src/world/populationPatrol.ts');
  const district = config.CITY_POPULATIONS.brumaluz.districts[0], original = district.route.map(point => [...point]);
  const patrol = populationPatrol(district.route);
  assert.equal(patrol.loop, false);
  assert.deepEqual(patrol.points.map(point => point[0]), [116, 132, 148, 156]);
  assert.deepEqual(district.route, original, 'authored map data is preserved');
  let stop = { index: closestPatrolStop(patrol, 116, 0), direction: 1 };
  const walk = [];
  for (let i = 0; i < 7; i++) { stop = nextPatrolStop(patrol, stop.index, stop.direction); walk.push(patrol.points[stop.index][0]); }
  assert.deepEqual(walk, [132, 148, 156, 148, 132, 116, 132]);
  const garden = config.CITY_POPULATIONS.brumaluz.districts.find(d => d.id === 'jardin');
  const circuit = populationPatrol(garden.route);
  assert.equal(circuit.loop, true); assert.deepEqual(circuit.points, garden.route);
  assert.equal(nextPatrolStop(circuit, 3, 1).index, 0);
});

test('ambient scenes require both neighbours at the right place and remember what was already heard', async () => {
  const { PopulationConversations } = await server.ssrLoadModule('/src/world/populationConversations.ts');
  const memory = new PopulationConversations();
  const first = { id: 'first', position: new THREE.Vector3() }, second = { id: 'second', position: new THREE.Vector3(1.5, 0, 0) };
  const local = { id: 'well', near: { position: [0, 0], radius: 4 }, lines: [['Primera.', 'First.'], ['Respuesta.', 'Reply.']] };
  const ordinary = { id: 'greeting', lines: [['Hola.', 'Hello.'], ['Buenas.', 'Hello.']] };
  second.position.x = 5;
  assert.equal(memory.choose([local, ordinary], first, second, 0), ordinary, 'both must be close to the landmark');
  second.position.x = 1.5;
  assert.equal(memory.choose([local, ordinary], first, second, 0), local);
  memory.heard(local, first.id, second.id, 0);
  assert.equal(memory.choose([local, ordinary], first, second, 45), undefined, 'give the same people a break');
  assert.equal(memory.choose([local, ordinary], first, second, 100), ordinary, 'pick the unheard scene instead of repeating');
  memory.heard(ordinary, first.id, second.id, 100);
  assert.equal(memory.choose([local, ordinary], first, second, 150), undefined, 'silence is allowed when everything is recent');
  assert.equal(memory.choose([local, ordinary], first, second, 200), local);
  memory.dispose();
});

test('authored ambient scenes have stable identities, bilingual replies and complete translations', () => {
  const scenes = config.CITY_POPULATIONS.brumaluz.districts.flatMap(d => d.exchanges);
  assert.equal(new Set(scenes.map(scene => scene.id)).size, scenes.length);
  for (const scene of scenes) {
    assert.ok(scene.lines.length >= 2 && scene.lines.length <= 3, scene.id);
    for (const [es, en] of scene.lines) {
      assert.ok(es.length > 0 && en.length > 0);
      assert.equal(config.POPULATION_TRANSLATIONS[es], en, `${scene.id}: matching chat/bubble translation`);
    }
  }
  assert.equal(config.POPULATION_TRANSLATIONS['Habitante de Brumaluz'], 'Brumaluz resident');
});

test('ambient replies wait for the previous mouth and bubble in either language', async () => {
  const { speechSeconds, conversationTurnSeconds } = await server.ssrLoadModule('/src/data/speech.ts');
  for (const district of config.CITY_POPULATIONS.brumaluz.districts) for (const scene of district.exchanges) for (const line of scene.lines)
    assert.ok(line.every(text => conversationTurnSeconds(...line) > speechSeconds(text)));
});

test('real-city movement stays continuous instead of alternating walk and idle at obstacles', () => {
  const { population, characters } = fixture(), ctx = context(); ctx.quiet = true;
  // Exercise rendered residents at a normal frame rate, not just 100 ms simulation steps.
  for (const character of characters.values()) character.root.visible = true;
  const previous = new Map(), flips = new Map(), turns = new Map();
  for (let frame = 0; frame < 180 * 30; frame++) {
    population.update(1 / 30, ctx);
    for (const resident of population.snapshot()) {
      const character = characters.get(resident.id), old = previous.get(resident.id);
      const [x, , z] = resident.position;
      const dx = old ? x - old.x : 0, dz = old ? z - old.z : 0, moving = Math.hypot(dx, dz) > .002;
      if (old?.activity === 'walking' && resident.activity === 'walking') {
        if (old.gait !== character.gait) flips.set(resident.id, (flips.get(resident.id) ?? 0) + 1);
        if (moving && old.moving && (dx * old.dx + dz * old.dz) / (Math.hypot(dx, dz) * Math.hypot(old.dx, old.dz)) < .5)
          turns.set(resident.id, (turns.get(resident.id) ?? 0) + 1);
      }
      previous.set(resident.id, { x, z, dx, dz, moving, activity: resident.activity, gait: character.gait });
    }
  }
  const worstFlips = [...flips].sort((a, b) => b[1] - a[1]).slice(0, 5), worstTurns = [...turns].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(JSON.stringify({ motion: { worstFlips, worstTurns } }));
  assert.ok(worstFlips.every(([, count]) => count < 24), `repeated walk/idle flicker: ${JSON.stringify(worstFlips)}`);
  assert.ok(worstTurns.every(([, count]) => count < 60), `rapid steering reversals: ${JSON.stringify(worstTurns)}`);
  population.dispose();
});

test('rendered walkers beyond 48 m move on every frame instead of jumping at 5 Hz', () => {
  const city = { locationId: 'brumaluz', seats: [], groundY: () => 0, collide: (_from, to) => to };
  const id = config.RESIDENT_IDS[0], character = actor(); character.root.position.set(148, 0, 0);
  const population = new CityPopulation(city, new Map([[id, character]]));
  const ctx = { player: new THREE.Vector3(1000, 0, 1000), quiet: true, playerSeated: false, say() {} };
  character.root.visible = true;
  advanceUntil(population, ctx, resident => resident.activity === 'walking');
  let moving = 0, largestStep = 0;
  for (let i = 0; i < 120; i++) {
    const old = character.root.position.clone(); population.update(1 / 60, ctx);
    const step = old.distanceTo(character.root.position); if (step > .001) moving++;
    largestStep = Math.max(step, largestStep);
  }
  assert.equal(moving, 120, 'visible translation is continuous even at the rendering distance limit');
  assert.ok(largestStep < .02, `no coarse simulation jump: ${largestStep}`);
  population.dispose();
});

test('pedestrian paths leave space around the real central well and reject occupied destinations', async () => {
  const { PopulationNavigation } = await server.ssrLoadModule('/src/world/populationNavigation.ts');
  const navigation = new PopulationNavigation(realCity);
  const start = new THREE.Vector3(-24, realCity.groundY(-24, 0), 0), goal = new THREE.Vector3(8, realCity.groundY(8, 0), 0);
  const route = navigation.path(start, goal); assert.ok(route.length > 1, 'walk around the well');
  let from = start;
  for (const to of route) {
    const count = Math.ceil(from.distanceTo(to) / .15);
    for (let i = 1; i <= count; i++) {
      const point = from.clone().lerp(to, i / count);
      for (const [dx, dz] of [[0, 0], [.06, 0], [-.06, 0], [0, .06], [0, -.06]]) {
        const p = new THREE.Vector3(point.x + dx, realCity.groundY(point.x + dx, point.z + dz), point.z + dz);
        assert.ok(realCity.collide(p, p.clone()).distanceTo(p) < .004, 'the path keeps clearance at corners');
      }
    }
    from = to;
  }
  assert.deepEqual(navigation.path(start, goal, [{ position: goal, radius: .55, priority: -1 }]), []);
  navigation.dispose();
});

test('pending bench paths can be cancelled by a dialogue or map teardown without moving the actor', () => {
  for (const teardown of [false, true]) {
    const { population, character, ctx, seat, id } = benchFixture();
    advanceUntil(population, ctx, resident => resident.activity === 'planning' && resident.seat);
    const start = character.root.position.clone();
    if (teardown) {
      population.dispose(); assert.deepEqual(population.snapshot(), []);
    } else {
      const release = population.hold(id);
      for (let i = 0; i < 100; i++) population.update(.1, ctx);
      assert.equal(population.snapshot()[0].activity, 'scripted');
      assert.ok(character.root.position.equals(start), 'a cancelled search cannot complete later and move the actor');
      release();
    }
    assert.ok(!population.isSeatOccupied(seat.id));
    population.dispose();
  }
});

test('a path search yields small bounded chunks and preserves the synchronous story route', async () => {
  const { storyPath, storyPathSteps } = await server.ssrLoadModule('/src/world/storyPath.ts');
  let checks = 0;
  const city = { groundY: () => 0, collide: (from, to) => {
    checks++; return to.x > 1 && to.x < 3 && Math.abs(to.z) < 1 ? from.clone() : to;
  } };
  const start = new THREE.Vector3(), goal = new THREE.Vector3(5, 0, 0), steps = storyPathSteps(city, start, goal);
  let result, chunks = 0, largest = 0;
  do {
    const before = checks; result = steps.next(); chunks++;
    largest = Math.max(largest, checks - before);
  } while (!result.done);
  assert.ok(chunks > 1, 'an obstructed search must be resumable across frames');
  assert.ok(largest <= 8, `no chunk performs an entire search: ${largest} collision checks`);
  assert.deepEqual(result.value.map(point => point.toArray()), storyPath(city, start, goal).map(point => point.toArray()));
});

test('thousands of creator names per lineage stay within the server name rules', async () => {
  const { namePool } = await server.ssrLoadModule('/src/data/characterNames.ts');
  const { randomName } = await server.ssrLoadModule('/src/data/data.ts');
  const totals = {};
  for (const race of ['humano', 'elfo', 'lagto', 'pelso']) {
    const pool = namePool(race), names = new Set(pool); totals[race] = pool.length;
    assert.ok(pool.length >= 2000, race);
    assert.ok(pool.every(name => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{3,16}$/.test(name) && !name.includes("''")));
    for (let i = 0; i < 100; i++) assert.ok(names.has(randomName(race)));
  }
  console.log(JSON.stringify({ names: totals }));
});

test('dialogue and quest holds stop movement, nest safely and resume; teardown frees all seats', () => {
  const { population } = fixture(), ctx = context();
  const id = config.RESIDENT_IDS[6];
  for (let i = 0; i < 200; i++) population.update(.1, ctx);
  const releaseDialogue = population.hold(id), releaseQuest = population.hold(id);
  const start = population.snapshot().find(r => r.id === id).position;
  for (let i = 0; i < 100; i++) population.update(.1, ctx);
  assert.deepEqual(population.snapshot().find(r => r.id === id).position, start);
  releaseDialogue(); releaseDialogue();
  assert.equal(population.snapshot().find(r => r.id === id).activity, 'scripted');
  releaseQuest();
  for (let i = 0; i < 150; i++) population.update(.1, ctx);
  assert.notEqual(population.snapshot().find(r => r.id === id).activity, 'scripted');
  population.dispose();
  assert.deepEqual(population.snapshot(), []);
  assert.ok(realCity.seats.every(seat => !population.isSeatOccupied(seat.id)));
});

test('quiet contexts suppress chatter and player seating is respected', () => {
  const { population } = fixture(), ctx = context();
  let lines = 0; ctx.say = () => lines++;
  ctx.quiet = true; ctx.playerSeated = true;
  const seat = realCity.seats[0]; ctx.player.copy(seat.position);
  for (let i = 0; i < 900; i++) population.update(.1, ctx);
  assert.equal(lines, 0);
  assert.ok(!population.isSeatOccupied(seat.id));
});

test('interrupting a reserved seat approach never teleports the resident to the bench', () => {
  const { population } = fixture(), ctx = context(); ctx.quiet = true;
  let checked = false;
  for (let i = 0; i < 1800; i++) {
    population.update(.1, ctx);
    const walking = population.snapshot().find(resident => resident.activity === 'walking' && resident.seat
      && new THREE.Vector3(...resident.position).distanceTo(realCity.seats.find(seat => seat.id === resident.seat).position) > 2);
    if (!walking) continue;
    const release = population.hold(walking.id);
    assert.deepEqual(population.snapshot().find(resident => resident.id === walking.id).position, walking.position);
    assert.ok(!population.isSeatOccupied(walking.seat));
    release(); checked = true; break;
  }
  assert.ok(checked, 'exercised an actual bench approach');
});

test('a resident waits on the bench when exits are blocked, including during a dialogue hold', () => {
  const { population, character, ctx, seat, id, city } = benchFixture();
  advanceUntil(population, ctx, resident => resident.activity === 'seated');
  const position = character.root.position.clone();
  ctx.blockers = [[0, .85], [1.2, .85], [-1.2, .85], [0, 2.05]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  for (let i = 0; i < 400; i++) population.update(.1, ctx);
  assert.ok(character.isSeated, 'does not stand inside the bench or an external actor');
  assert.ok(character.root.position.equals(position));
  assert.ok(population.isSeatOccupied(seat.id), 'keeps the reservation while physically seated');
  const release = population.hold(id);
  assert.ok(character.isSeated, 'blocked dialogue does not force an unsafe exit');
  release();
  for (let i = 0; i < 20; i++) population.update(.1, ctx);
  assert.ok(character.isSeated, 'resuming the routine also waits for an exit');
  ctx.blockers = [];
  city.waterAt = () => ({ surface: 0, deep: false });
  for (let i = 0; i < 20; i++) population.update(.1, ctx);
  assert.ok(character.isSeated, 'does not leave the bench into water');
  city.waterAt = () => null;
  advanceUntil(population, ctx, resident => resident.activity !== 'seated', 3);
  assert.ok(!character.isSeated);
  assert.ok(!population.isSeatOccupied(seat.id));
  assert.ok(character.root.position.distanceTo(position) >= .8);
  population.dispose();
});

test('the last step onto a reserved seat checks people occupying the seat', () => {
  for (const player of [false, true]) {
    const { population, character, ctx, seat } = benchFixture();
    advanceUntil(population, ctx, resident => resident.activity === 'walking' && resident.seat
      && Math.abs(resident.position[2] - .85) < .06);
    if (player) ctx.player.copy(seat.position);
    else ctx.blockers = [seat.position.clone()];
    for (let i = 0; i < 10; i++) population.update(.1, ctx);
    assert.ok(!character.isSeated, 'never snaps onto a player or story actor standing at the seat');
    assert.ok(character.root.position.distanceTo(seat.position) >= .8);
    assert.ok(!population.isSeatOccupied(seat.id), 'releases an unavailable seat');
    population.dispose();
  }
});

test('residents do not begin a conversation behind a wall separating them from the player', () => {
  const ctx = context(136, 5), ear = ctx.player.clone(); ear.y += 1;
  let audible = false, lines = 0;
  const city = { ...realCity, lineOfSight: (_from, to) => audible || to.distanceToSquared(ear) > .01 };
  const { population } = fixture(city); ctx.say = () => lines++;
  for (let i = 0; i < 1500; i++) population.update(.1, ctx);
  assert.equal(lines, 0, 'no chat from the other side of the wall');
  audible = true;
  for (let i = 0; i < 1500; i++) population.update(.1, ctx);
  assert.ok(lines > 0, 'nearby conversations remain available when the view clears');
  population.dispose();
});

test('resident rendering is bounded, and hidden rigs leave the scene graph', async () => {
  const { PopulationPresentation } = await server.ssrLoadModule('/src/world/populationPresentation.ts');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1.6, .1, 250);
  camera.position.set(0, 8, 18); camera.lookAt(0, 1, 0); camera.updateMatrixWorld();
  const actors = Array.from({ length: 54 }, (_, i) => {
    const character = { root: new THREE.Group(), updates: 0, update() { this.updates++; } };
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshBasicMaterial()); character.root.add(mesh);
    character.root.position.set((i % 9 - 4) * .6, 0, -Math.floor(i / 9) * .8); scene.add(character.root);
    return { id: `resident_${i}`, character, pinned: () => false };
  });
  const presentation = new PopulationPresentation(actors);
  assert.equal(scene.children.length, 0, 'hidden rigs do not incur recursive matrix updates');
  presentation.update(0, camera, new THREE.Vector3(), true, true);
  assert.equal(presentation.snapshot().visible, 16); assert.equal(scene.children.length, 16);
  assert.ok(actors.filter(actor => actor.character.root.visible).every(actor => !actor.character.root.children[0].castShadow));
  presentation.update(.02, camera, new THREE.Vector3(), true, false);
  assert.equal(presentation.snapshot().visible, 24); assert.equal(scene.children.length, 24);
  assert.ok(actors.filter(actor => actor.character.root.visible).every(actor => actor.character.root.children[0].castShadow));
  presentation.update(.04, camera, new THREE.Vector3(), false, false);
  assert.equal(presentation.snapshot().visible, 0); assert.equal(scene.children.length, 0);
  assert.ok(actors.every(actor => actor.character.updates <= 2));
  for (const actor of actors) { const mesh = actor.character.root.children[0]; mesh.geometry.dispose(); mesh.material.dispose(); }
});

test('animation budgets favour nearby residents and keep held quest actors alive', async () => {
  const { PopulationPresentation } = await server.ssrLoadModule('/src/world/populationPresentation.ts');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1.6, .1, 250);
  camera.position.set(0, 7, 20); camera.lookAt(0, 1, -25); camera.updateMatrixWorld();
  let held = false;
  const actors = [0, -24, -45, -180].map((z, i) => {
    const character = { root: new THREE.Group(), updates: 0, update() { this.updates++; } };
    character.root.position.z = z; scene.add(character.root);
    return { id: `tier_${i}`, character, pinned: () => i === 3 && held };
  });
  const presentation = new PopulationPresentation(actors), focus = new THREE.Vector3();
  for (let frame = 0; frame < 120; frame++) presentation.update(frame / 60, camera, focus, true, false);
  assert.equal(actors[0].character.updates, 120);
  assert.ok(actors[1].character.updates > 15 && actors[1].character.updates <= 31);
  assert.ok(actors[2].character.updates > 10 && actors[2].character.updates <= 22);
  assert.equal(actors[3].character.updates, 0);
  held = true; presentation.update(3, camera, focus, true, false);
  assert.ok(actors[3].character.root.visible); assert.equal(actors[3].character.root.parent, scene);
  assert.equal(actors[3].character.updates, 1);
});

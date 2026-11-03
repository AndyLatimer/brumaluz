/**
 * @file fishing-logic.test.mjs
 * Pruebas unitarias y de integración para la lógica del minijuego de pesca.
 * Ejecutable mediante: node --test standalone/fishing/tests/fishing-logic.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { FISH_SPECIES, getSpeciesById } from '../src/data/species.js';
import { FISHING_RODS, getRodById, FISHING_BAITS, getBaitById } from '../src/data/equipment.js';
import { FISHING_ZONES, getZoneById } from '../src/data/zones.js';
import { FishingStateMachine } from '../src/core/state-machine.js';
import { FishPhysics } from '../src/core/fish-physics.js';
import { ReelingMechanics } from '../src/core/reeling-mechanics.js';
import { FishingEngine } from '../src/core/engine.js';

test('1. Catálogo de Especies de Peces', (t) => {
  assert.ok(FISH_SPECIES.length >= 8, 'Debe haber al menos 8 especies de peces');

  for (const sp of FISH_SPECIES) {
    assert.ok(sp.id, 'La especie debe tener ID');
    assert.ok(sp.name, 'La especie debe tener nombre');
    assert.ok(sp.difficulty >= 1 && sp.difficulty <= 10, `${sp.id} dificultad debe estar entre 1 y 10`);
    assert.ok(sp.sizeRange[0] < sp.sizeRange[1], `${sp.id} rango de tamaño inválido`);
    assert.ok(sp.weightRange[0] < sp.weightRange[1], `${sp.id} rango de peso inválido`);
    assert.ok(['smooth', 'dart', 'sinker', 'floater', 'erratic', 'rhythmic'].includes(sp.pattern),
      `${sp.id} patrón de movimiento inválido`);
  }

  const found = getSpeciesById('trucha_plateada');
  assert.ok(found, 'Debe encontrar la trucha plateada');
  assert.equal(found.pattern, 'smooth');
});

test('2. Catálogo de Cañas, Cebos y Zonas', (t) => {
  assert.ok(FISHING_RODS.length >= 3, 'Debe haber al menos 3 cañas');
  for (const rod of FISHING_RODS) {
    assert.ok(rod.zoneWidthMultiplier > 0, `${rod.id} multiplicador de zona positivo`);
    assert.ok(rod.stability > 0, `${rod.id} estabilidad positiva`);
  }

  assert.ok(FISHING_BAITS.length >= 4, 'Debe haber al menos 4 cebos');
  for (const bait of FISHING_BAITS) {
    assert.ok(bait.biteTimeMultiplier > 0, `${bait.id} multiplicador de tiempo de espera positivo`);
  }

  assert.ok(FISHING_ZONES.length >= 3, 'Debe haber al menos 3 zonas');
  for (const zone of FISHING_ZONES) {
    for (const spId of zone.availableSpeciesIds) {
      assert.ok(getSpeciesById(spId), `Especie ${spId} en zona ${zone.id} debe existir en el catálogo`);
    }
  }
});

test('3. Máquina de Estados de Pesca', (t) => {
  const transitions = [];
  const sm = new FishingStateMachine({
    onTransition: (prev, next) => transitions.push(`${prev}->${next}`)
  });

  assert.equal(sm.getPhase(), 'IDLE');
  assert.ok(sm.transition('PREPARATION'), 'Debe permitir IDLE -> PREPARATION');
  assert.ok(sm.transition('CASTING'), 'Debe permitir PREPARATION -> CASTING');
  assert.ok(sm.transition('WAITING'), 'Debe permitir CASTING -> WAITING');
  assert.ok(sm.transition('HOOKING'), 'Debe permitir WAITING -> HOOKING');
  assert.ok(sm.transition('REELING'), 'Debe permitir HOOKING -> REELING');
  assert.ok(sm.transition('RESULT'), 'Debe permitir REELING -> RESULT');

  // Transición inválida
  assert.equal(sm.transition('WAITING'), false, 'No debe permitir saltar de RESULT a WAITING directamente');

  // Cancelar regresa a IDLE
  sm.cancel();
  assert.equal(sm.getPhase(), 'IDLE');
});

test('4. Simulación Física del Pez (Patrones y Límites)', (t) => {
  const species = getSpeciesById('trucha_plateada');
  const phys = new FishPhysics(species);

  assert.equal(phys.position, 0.5);

  // Simular 3 segundos de movimiento en pasos de 1/60s
  for (let i = 0; i < 180; i++) {
    phys.update(1 / 60);
    assert.ok(phys.position >= 0.02 && phys.position <= 0.98,
      `Posición del pez ${phys.position} fuera de límites acuáticos`);
  }

  // Comprobar patrón 'sinker' (tiende a descender)
  const sinkerSpecies = getSpeciesById('siluro_del_olmo');
  const sinkerPhys = new FishPhysics(sinkerSpecies);
  sinkerPhys.position = 0.8;
  for (let i = 0; i < 120; i++) {
    sinkerPhys.update(1 / 60);
  }
  assert.ok(sinkerPhys.position < 0.8, 'Un pez de tipo sinker debe tender a profundizar');
});

test('5. Mecánica de Recogida y Captura (Reeling)', (t) => {
  const rod = getRodById('cana_sauce');
  const species = getSpeciesById('trucha_plateada');
  const reel = new ReelingMechanics(rod, species);

  const initialY = reel.zonePosition;

  // 1. Sin entrada de usuario, la barra debe descender por gravedad
  reel.update(0.1, 0.5);
  assert.ok(reel.zonePosition <= initialY, 'La barra debe bajar sin tracción');

  // 2. Con entrada activa, la barra debe ascender
  reel.setReelingInput(true);
  for (let i = 0; i < 20; i++) {
    reel.update(0.05, 0.5);
  }
  assert.ok(reel.zonePosition > initialY, 'La barra debe subir con tracción activa');

  // 3. Progreso aumenta cuando el pez está dentro
  const insideY = reel.zonePosition;
  const prevProg = reel.catchProgress;
  reel.update(0.2, insideY);
  assert.ok(reel.isFishInside, 'El pez debe detectarse dentro de la zona');
  assert.ok(reel.catchProgress > prevProg, 'El progreso de captura debe aumentar al cubrir el pez');

  // 4. Progreso disminuye cuando el pez está fuera
  const outsideY = (insideY > 0.5) ? 0.05 : 0.95;
  const progBeforeDrain = reel.catchProgress;
  reel.update(0.3, outsideY);
  assert.equal(reel.isFishInside, false);
  assert.ok(reel.catchProgress < progBeforeDrain, 'El progreso de captura debe disminuir cuando el pez escapa de la zona');
});

test('6. Ciclo Jugable Completo de FishingEngine (Preparación -> Captura Exitosa)', (t) => {
  const events = [];
  const engine = new FishingEngine({
    zoneId: 'rio_brumaluz',
    rodId: 'cana_sauce',
    baitId: 'sin_cebo',
    fixedSpeciesId: 'trucha_plateada',
    onPhaseChange: (p) => events.push(`phase:${p}`),
    onComplete: (r) => events.push(`complete:${r.success}`)
  });

  assert.equal(engine.getPhase(), 'PREPARATION');

  // Iniciar lance
  assert.ok(engine.startCasting());
  assert.equal(engine.getPhase(), 'CASTING');

  // Ticks de oscilación
  engine.update(0.2);
  assert.ok(engine.castPower > 0);

  // Soltar lance
  assert.ok(engine.releaseCast());
  assert.equal(engine.getPhase(), 'WAITING');
  assert.ok(engine.castDistance >= 6 && engine.castDistance <= 32);

  // Forzar picada
  assert.ok(engine.forceBite());
  assert.equal(engine.getPhase(), 'HOOKING');

  // Clavar anzuelo a tiempo
  assert.ok(engine.hookFish());
  assert.equal(engine.getPhase(), 'REELING');
  assert.ok(engine.fishPhysics != null);
  assert.ok(engine.reelingMechanics != null);

  // Simular combate exitoso (manteniendo la zona sobre el pez)
  for (let i = 0; i < 200; i++) {
    if (engine.getPhase() === 'RESULT') break;
    // Poner la barra exactamente donde está el pez
    engine.reelingMechanics.zonePosition = engine.fishPhysics.position;
    engine.update(1 / 30);
  }

  assert.equal(engine.getPhase(), 'RESULT');
  assert.ok(engine.lastResult != null);
  assert.equal(engine.lastResult.success, true);
  assert.equal(engine.lastResult.species.id, 'trucha_plateada');
  assert.ok(engine.lastResult.size > 0);
  assert.ok(engine.lastResult.weight > 0);
  assert.ok(engine.lastResult.quality >= 1 && engine.lastResult.quality <= 4);
  assert.ok(engine.lastResult.clientSignature.startsWith('sig_fish_'));
});

test('7. Ciclo Jugable de Fallo (Pez Escapa)', (t) => {
  const engine = new FishingEngine({
    zoneId: 'rio_brumaluz',
    rodId: 'cana_sauce',
    baitId: 'sin_cebo',
    fixedSpeciesId: 'trucha_plateada'
  });

  engine.startCasting();
  engine.releaseCast();
  engine.forceBite();
  engine.hookFish();

  // Forzar la barra del jugador completamente lejos del pez
  for (let i = 0; i < 300; i++) {
    if (engine.getPhase() === 'RESULT') break;
    engine.reelingMechanics.zonePosition = 0.05;
    engine.fishPhysics.position = 0.95;
    engine.update(1 / 30);
  }

  assert.equal(engine.getPhase(), 'RESULT');
  assert.ok(engine.lastResult != null);
  assert.equal(engine.lastResult.success, false);
  assert.equal(engine.lastResult.escaped, true);
});

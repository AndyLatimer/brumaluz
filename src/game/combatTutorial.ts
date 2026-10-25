import * as THREE from 'three';
import { COMBAT_KITS } from '../data/combat';
import { hasCombatWeapon } from '../data/equipment';
import { SHADOW_COMBAT } from '../data/shadowCombat';
import { vitalsOf } from '../data/stats';
import { serverNow } from '../data/worldClock';
import { isDialogOpen } from '../ui/dialog';
import { t } from '../ui/i18n';
import { actionBarSkillBinding } from '../ui/actionBar';
import { storyLock } from './conversation';
import { fight, play, session, ui, vitals } from './state';
import { holder, scene } from './stage';

let panel: HTMLElement | null = null;
let warning: THREE.Group | null = null;
let key = '', signature = '', nextUpdate = 0;
let basicDone = false, skillDone = false, dodgeDone = false;
let lastWindup = 0, lastAimX = 0, lastAimZ = 0;

export function resetCombatTutorial() {
  key = ''; signature = ''; nextUpdate = 0;
  basicDone = skillDone = dodgeDone = false; lastWindup = 0;
  if (panel) panel.hidden = true;
  if (warning) { warning.visible = false; warning.removeFromParent(); }
  document.querySelectorAll('.tutorial-skill').forEach(slot => slot.classList.remove('tutorial-skill'));
}

export function noteTutorialAction(action: 'attack' | 'skill', damage: number, healing: number) {
  if (fight.combatEncounter?.id !== 'shadowling') return;
  const nextKey=`${session.accountSyncId}:${session.activeCharacterId}:${play.playGeneration}:${fight.combatEncounter.instanceId}`;
  if(key!==nextKey){resetCombatTutorial();key=nextKey;}
  if (action === 'attack' && damage > 0) basicDone = true;
  if (action === 'skill' && (damage > 0 || healing > 0)) skillDone = true;
}

function attackWarning() {
  if (!warning) {
    warning = new THREE.Group();
    warning.name = 'shadow-attack-warning';
    const fill = new THREE.Mesh(new THREE.CircleGeometry(SHADOW_COMBAT.radius, 48), new THREE.MeshBasicMaterial({
      color: '#e9a05b', transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide,
    }));
    const edge = new THREE.Mesh(new THREE.RingGeometry(SHADOW_COMBAT.radius - .06, SHADOW_COMBAT.radius, 48), new THREE.MeshBasicMaterial({
      color: '#ffcb82', transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide,
    }));
    for (const mesh of [fill, edge]) { mesh.rotation.x = -Math.PI / 2; mesh.raycast = () => {}; warning.add(mesh); }
  }
  if (!warning.parent) scene.add(warning);
  return warning;
}

/** Contextual lessons; progress never blocks damage, loot, or story progression. */
export function tickCombatTutorial() {
  if (performance.now() < nextUpdate) return;
  nextUpdate = performance.now() + 80;
  const encounter = fight.combatEncounter;
  const available = play.mode === 'play' && play.city.locationId === 'brumaluz' && !play.dead
    && encounter?.id === 'shadowling' && !encounter.kind && !encounter.looted
    && (encounter.status === 'active' || encounter.status === 'defeated');
  if (!available) { if(key)resetCombatTutorial(); return; }
  const nextKey = `${session.accountSyncId}:${session.activeCharacterId}:${play.playGeneration}:${encounter.instanceId}`;
  if (key !== nextKey) { resetCombatTutorial(); key = nextKey; }
  const now = serverNow();
  const preparing = encounter.status === 'active' && encounter.attackKind!=='bolt'&&encounter.attackKind!=='melee'&&!!encounter.windup && encounter.windup > now;
  if (preparing) {
    lastWindup = encounter.windup!; lastAimX = encounter.aimX ?? encounter.x; lastAimZ = encounter.aimZ ?? encounter.z;
    const zone = attackWarning();
    zone.position.set(lastAimX, play.city.groundY(lastAimX, lastAimZ) + .045, lastAimZ);
    zone.visible = true;
    const fill = zone.children[0] as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
    fill.material.opacity = .16 + .18 * (1 - Math.max(0, encounter.windup! - now) / SHADOW_COMBAT.windup);
  } else if (warning) warning.visible = false;
  if (lastWindup && now >= lastWindup) {
    if (Math.hypot(holder.position.x - lastAimX, holder.position.z - lastAimZ) > SHADOW_COMBAT.radius) dodgeDone = true;
    lastWindup = 0;
  }
  const visible = !storyLock() && !isDialogOpen() && !ui.openWindow && !ui.optionsOpen
    && !ui.gameMenuOpen && !ui.playerMenuOpen && !ui.worldMenuOpen && !play.mapTravelling;
  if (!panel) {
    panel = document.createElement('aside'); panel.id = 'combat-tutorial';
    panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = '<div class="combat-lesson-heading"><span></span><small></small></div><strong></strong><p></p><div class="combat-lesson-input"><kbd></kbd><span></span></div><div class="combat-lesson-progress" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
    document.body.append(panel);
  }
  panel.hidden = !visible;
  if (!visible) return;
  const kit = COMBAT_KITS[session.state.cls], health = vitalsOf(session.state);
  const distance = Math.hypot(holder.position.x - encounter.x, holder.position.z - encounter.z);
  const binding=actionBarSkillBinding();
  let step = basicDone?(skillDone?2:1):0, title: string, text: string, input='F', inputLabel=t('Fijar objetivo');
  if (encounter.status === 'defeated') {
    step = 3; title = 'Recoge el botín'; text = 'Acércate a los restos, pulsa E y recoge los objetos. La experiencia se recibe al derrotar al enemigo.';input='E';inputLabel=t('Registrar cuerpo');
  } else if (!hasCombatWeapon(session.state)) {
    title = 'Prepara tu arma'; text = 'Abre el inventario con I y equipa el arma de tu clase antes de acercarte.';
  } else if (preparing) {
    title = '¡Sal del círculo!'; text = 'Muévete fuera de la zona dorada antes del golpe. El círculo se queda donde estaba: no te persigue.';input='W A S D';inputLabel=t('Moverse');
  } else if (distance > 10) {
    title = 'Acércate a la sombra'; text = 'Sigue el marcador de la misión hasta la herrería. Cuando tengas cerca a la sombra, mírala y pulsa F o haz clic sobre ella.';
  } else if (!fight.lockedEnemy) {
    title = 'Fija a la sombra'; text = 'Mira hacia la sombra y pulsa F, o haz clic sobre ella. Te acercarás hasta poder atacar.';
  } else if (!basicDone) {
    title = 'Deja que llegue tu primer golpe'; text = distance > kit.range ? 'Te acercas automáticamente. Los golpes básicos empiezan al entrar en alcance.' : 'Los golpes básicos son automáticos y no gastan recurso. Puedes moverte mientras luchas.';
  } else if (!skillDone && (!kit.skill.healing || health.health < health.maxHealth)) {
    step = 1; title = t('Prueba {skill}', { skill: t(kit.skill.label) });
    input=binding?.key??'K';inputLabel=t(kit.skill.label);
    text = kit.skill.healing ? 'Has perdido vida. Usa Curación para recuperarla mientras tus ataques básicos continúan.' : 'Usa tu habilidad para golpear con más fuerza. Gasta recurso; los ataques básicos siguen siendo automáticos.';
    if(binding?.otherPage){input=`Z → ${binding.key}`;text='Cambia de barra con Z y pulsa la tecla indicada para usar tu habilidad.';}
    if(!binding)text='Abre las habilidades con K y arrastra tu habilidad a un hueco de la barra de acciones.';
    if (performance.now() < vitals.skillReadyAt){title='Espera a que se recargue';text='El número de la habilidad indica los segundos que faltan. Cuando desaparezca podrás volver a usarla.';}
  } else {
    title = dodgeDone ? 'Bien esquivado. Sigue atacando' : 'Mantente en movimiento';input='W A S D';inputLabel=t('Moverse');
    text = kit.skill.healing && !skillDone ? 'La varita ataca a distancia. Si pierdes vida, usa Curación. Sal de las zonas doradas para evitar el daño.' : 'Combina tus golpes y tu habilidad. W A S D permite apartarte; F reanuda la aproximación y Esc suelta el objetivo.';
  }
  const content = [t('Tutorial de combate'), `${step + 1} / 4`, t(title), t(text),input,inputLabel];
  const nextSignature = JSON.stringify(content);
  if (signature === nextSignature) return;
  signature = nextSignature; panel.dataset.step = String(step + 1);
  panel.classList.toggle('danger', preparing);
  panel.querySelector('.combat-lesson-heading span')!.textContent = content[0];
  panel.querySelector('small')!.textContent = content[1];
  panel.querySelector('strong')!.textContent = content[2]; panel.querySelector('p')!.textContent = content[3];
  panel.querySelector('kbd')!.textContent=input;panel.querySelector('.combat-lesson-input span')!.textContent=inputLabel;
  panel.querySelectorAll('.combat-lesson-progress i').forEach((dot, index) => dot.classList.toggle('done', index <= step));
  document.querySelectorAll('.ab-slot[data-skill-id]').forEach(slot => slot.classList.toggle('tutorial-skill', step === 1&&!preparing));
}

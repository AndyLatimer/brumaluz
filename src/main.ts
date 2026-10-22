// Arranque del juego: conecta la interfaz, carga personajes y mapa, prepara la historia y lanza el bucle de render.
// Cada parte vive en su módulo (src/game, src/story, src/ui); el estado compartido está en src/game/state.ts.
import { createCoinBags } from './world/coinBags';
import { createDestinationIndicator } from './ui/destinationIndicator';
import { t } from './ui/i18n';
import { loadKits } from './character/character';
import { createNpc } from './character/npc';
import { loadWorldNpcs } from './data/worldNpcs';
import { animateVisibility, initUiMotion } from './ui/uiMotion';
import { createTargetFrame } from './ui/targetFrame';
import { publishedMaps } from './world/mapCity';
import { randomName } from './data/data';
import { initBuffLayout } from './ui/buffs';
import { createWelcomeWorld } from './world/welcome';
import { createQuestTracker } from './ui/questWindow';
import { session, play, ui, story } from './game/state';
import { env, scene, canvas, camera, holder, layout, TEST } from './game/stage';
import { rebuildNow } from './game/avatar';
import { $ } from './ui/dom';
import { installInput } from './game/input';
import { installInteraction } from './game/interaction';
import { installActionBar } from './game/inventory';
import { installCombatControls } from './game/combat';
import { questTracking, installGameInterface } from './ui/gameInterface';
import { setWindow, installMenus } from './ui/menus';
import { installOptions } from './ui/options';
import { refreshUI, installCreator } from './ui/creator';
import { initializeAccountAccess, installAccountScreens } from './ui/accountScreens';
import { syncBackdropTime, installCharacterSelect } from './ui/characterSelect';
import { installWorldClient } from './game/worldClient';
import { gameCity, refreshCityMinimap, placeCityNpcs } from './game/cities';
import { installRestFade } from './story/quests';
import { createNpcDefinitions } from './story/npcs';
import { installArrivalOverlay } from './story/isbertoArrival';
import { installStoryLines } from './story/scenes';
import { installNpcBarks } from './game/targets';
import { installDebugHook } from './game/debugHook';
import { startGameLoop } from './game/loop';

if (!session.state.name) session.state.name = randomName(session.state.race);
installStoryLines();
installArrivalOverlay();
installInput();
initUiMotion();
animateVisibility(...['window-backdrop', 'options-backdrop', 'delete-dialog-backdrop', 'game-menu-panel', 'player-menu-panel', 'world-menu-panel',
  'dialog', 'interact-prompt', 'combat-controls', 'death-screen', 'player-interactions'].map(id => document.getElementById(id)));
installInteraction();
installRestFade();
installActionBar();
installCombatControls();

installGameInterface();
installMenus();
installOptions();

installCreator();
installCharacterSelect();
installWorldClient();
installAccountScreens();
try {
  await loadKits();
  session.registeredNpcs = loadWorldNpcs();
  session.worldCharacters = {
    testiculos: await createNpc(session.registeredNpcs.testiculos),
    gnomi: await createNpc(session.registeredNpcs.gnomi),
    isberto: await createNpc(session.registeredNpcs.isberto),
  };
  play.city = await gameCity('brumaluz');
  env.setLampposts(!publishedMaps().brumaluz);
} catch (e) {
  $('#loading p').textContent = t('No se pudo cargar Brumaluz: ') + (e instanceof Error ? e.message : String(e));
  throw e;
}
scene.add(play.city.root);
story.welcomeWorld = createWelcomeWorld(scene, () => play.city, session.worldCharacters.gnomi, session.registeredNpcs.gnomi.name);
story.coinBags = createCoinBags(scene, () => play.city);
ui.questTracker = createQuestTracker(() => setWindow('quests'), questTracking);
ui.welcomePlate = document.createElement('div');
ui.welcomePlate.className = 'nameplate npc welcome-nameplate';
ui.welcomePlate.textContent = session.registeredNpcs.gnomi.name;
ui.welcomePlate.hidden = true;
document.body.append(ui.welcomePlate);
ui.questIndicator = createDestinationIndicator('quest-objective-marker', 'quest');
ui.waypointIndicator = createDestinationIndicator('waypoint-objective-marker', 'waypoint');
if (import.meta.hot) import.meta.hot.dispose(() => { story.welcomeWorld.dispose(); story.coinBags.dispose(); });
refreshCityMinimap();
story.NPCS = createNpcDefinitions();
placeCityNpcs();
installNpcBarks();
ui.targetFrame = createTargetFrame(canvas, camera, () => play.city.root);
holder.position.copy(play.city.spawn);
holder.rotation.y = play.city.spawnYaw - 0.3;
rebuildNow();
refreshUI();
layout();
startGameLoop();

requestAnimationFrame(() => setTimeout(() => $('#loading').classList.add('hide'), 400));
initBuffLayout();
syncBackdropTime();
window.setInterval(syncBackdropTime, 60_000);
if (TEST) {
  $('#account-gate').hidden = true;
  document.body.classList.remove('auth-visible', 'characters-visible');
} else {
  void initializeAccountAccess();
}
installDebugHook();

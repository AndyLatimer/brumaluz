// Pruebas del mundo en el navegador (vista previa del build + Playwright). Se reparten por temas en scripts/world/;
// se ejecutan en este orden, en un solo proceso, con un servidor y un navegador compartidos (scripts/world/harness.mjs).
import './world/harness.mjs';
import './world/world-basics.mjs';
import './world/welcome.mjs';
import './world/sessions.mjs';
import './world/social-targets.mjs';
import './world/party.mjs';
import './world/quests-ui.mjs';
import './world/story.mjs';
import './world/combat.mjs';
import './world/skills.mjs';
import './world/menus-chat.mjs';
import './world/character-food.mjs';
import './world/items-chat.mjs';
import './world/audio-trade.mjs';

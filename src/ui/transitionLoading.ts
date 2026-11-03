import { t } from './i18n';
import type { MapKind } from '../data/maps';
import emblem from '../assets/brand/brumaluz-emblem.svg';
import lantern from '../assets/loading/lantern.svg';
import city from '../assets/loading/city.svg';
import world from '../assets/loading/world.svg';
import forest from '../assets/loading/forest.svg';
import workshop from '../assets/loading/workshop.svg';
import forge from '../assets/loading/forge.svg';
import alchemy from '../assets/loading/alchemy.svg';
import hearth from '../assets/loading/hearth.svg';
import atelier from '../assets/loading/atelier.svg';
import book from '../assets/loading/book.svg';
import mining from '../assets/loading/mining.svg';
import jewelry from '../assets/loading/jewelry.svg';
import enchantment from '../assets/loading/enchantment.svg';
import kitchen from '../assets/loading/kitchen.svg';
import leather from '../assets/loading/leather.svg';

const artwork = { lantern, city, world, forest, workshop, forge, alchemy, hearth, atelier, book, mining, jewelry, enchantment, kitchen, leather };
type Art = keyof typeof artwork;
type Journey = 'enter' | 'return' | 'create';
export type LoadingDestination = { id?: string; name: string; kind?: MapKind; region?: string; loadingTip?: string };
type Screen = { phase: Journey | 'travel' | 'recover'; art: Art; title: string; region: string; tip: string; label: string };
type Transition = { label: string; screen: Screen | null };

const notes: Record<Art, { heading: string; tips: string[] }> = {
  lantern: { heading: 'A la luz de los faroles', tips: [
    'Brumaluz reúne a vecinos de distintos pueblos, entre jardines, talleres y faroles.',
  ] },
  city: { heading: 'La ciudad y sus gentes', tips: [
    'Brumaluz reúne a vecinos de distintos pueblos, entre jardines, talleres y faroles.',
    'Los talleres del Barrio de los Artesanos reúnen a los maestros de oficio de Brumaluz.',
  ] },
  world: { heading: 'Más allá de las murallas', tips: [
    'Acércate a cualquiera de las cinco puertas de Brumaluz para entrar en la ciudad.',
    'Minero, Leñador y Recolector encuentran sus recursos en Pompelín.',
  ] },
  forest: { heading: 'Entre hojas y senderos', tips: [
    'Minero, Leñador y Recolector encuentran sus recursos en Pompelín.',
    'Puedes consultar tus recursos y herramientas en el libro de oficios.',
  ] },
  workshop: { heading: 'Hecho con tus manos', tips: [
    'Tus trabajos de fabricación siguen avanzando sin conexión, a un tercio de su velocidad normal.',
    'Puedes usar materiales de tu mochila y del banco personal al fabricar en una estación.',
  ] },
  forge: { heading: 'El corazón de la fragua', tips: [
    'Isberto es el maestro de Herrería de Brumaluz.',
    'En Herrería puedes comprar, reparar y restaurar tus herramientas.',
  ] },
  alchemy: { heading: 'Pequeños descubrimientos', tips: [
    'Habla con el maestro para conocer el oficio. El banco de trabajo está dentro del taller.',
    'Los pergaminos de receta se compran hablando con el maestro y se aprenden desde la mochila.',
  ] },
  hearth: { heading: 'Un rincón al que volver', tips: [
    'La habitación de la posada Lucero del Alba es tu primer hogar. Decórala a tu gusto.',
    'Tu habitación de la posada sigue siendo tuya. Los muebles se trasladan recogiéndolos en la mochila.',
  ] },
  atelier: { heading: 'Puntada a puntada', tips: [
    'Puedes usar materiales de tu mochila y del banco personal al fabricar en una estación.',
    'Los pergaminos de receta se compran hablando con el maestro y se aprenden desde la mochila.',
  ] },
  book: { heading: 'Entre una historia y otra', tips: [
    'Cada personaje conserva su propia aventura.',
  ] },
  mining: { heading: 'Bajo la piedra', tips: [
    'Minero, Leñador y Recolector encuentran sus recursos en Pompelín.',
    'Puedes consultar tus recursos y herramientas en el libro de oficios.',
  ] },
  jewelry: { heading: 'El valor de los detalles', tips: [
    'Puedes usar materiales de tu mochila y del banco personal al fabricar en una estación.',
    'Los pergaminos de receta se compran hablando con el maestro y se aprenden desde la mochila.',
  ] },
  enchantment: { heading: 'Lo que guardan los libros', tips: [
    'Los pergaminos de receta se compran hablando con el maestro y se aprenden desde la mochila.',
    'Habla con el maestro para conocer el oficio. El banco de trabajo está dentro del taller.',
  ] },
  kitchen: { heading: 'A fuego lento', tips: [
    'Puedes usar materiales de tu mochila y del banco personal al fabricar en una estación.',
    'Tus trabajos de fabricación siguen avanzando sin conexión, a un tercio de su velocidad normal.',
  ] },
  leather: { heading: 'Preparativos para el camino', tips: [
    'Puedes consultar tus recursos y herramientas en el libro de oficios.',
    'Los pergaminos de receta se compran hablando con el maestro y se aprenden desde la mochila.',
  ] },
};
const noteIndices = new Map<Art, number>();
function nextNote(art: Art) {
  const index = noteIndices.get(art) || 0;
  noteIndices.set(art, index + 1);
  return notes[art].tips[index % notes[art].tips.length];
}

export function destinationArt(map: LoadingDestination): Art {
  const id = map.id || '';
  if (id.startsWith('taller_')) {
    if (/herreria/.test(id)) return 'forge';
    if (/minero/.test(id)) return 'mining';
    if (/alquimia/.test(id)) return 'alchemy';
    if (/encantamiento/.test(id)) return 'enchantment';
    if (/joyeria/.test(id)) return 'jewelry';
    if (/sastreria/.test(id)) return 'atelier';
    if (/peleteria/.test(id)) return 'leather';
    if (/lenador|recolector/.test(id)) return 'forest';
    if (/cocina/.test(id)) return 'kitchen';
    return 'workshop';
  }
  if (/posada|casa_/.test(id) || map.kind === 'interior') return 'hearth';
  if (map.kind === 'world' || id === 'pompelin') return 'world';
  if (map.kind === 'zone') return 'forest';
  return 'city';
}

const pending = new Map<symbol, Transition>();
const maps = new Map<HTMLDivElement, Screen>();
let panel: HTMLDivElement | null = null;
let showTimer = 0, expandTimer = 0;

function engravingPage(screen: Screen) {
  const page = document.createElement('div');
  page.className = 'loading-page';
  page.innerHTML = `
    <div class="loading-art" aria-hidden="true">
      <div class="loading-light"></div>
      <img class="loading-illustration" alt="" />
    </div>
    <header class="loading-masthead">
      <span class="loading-brand"></span>
      <span class="loading-edition"></span>
    </header>
    <div class="loading-content">
      <div class="loading-copy">
        <div class="loading-eyebrow"></div>
        <h1 class="loading-title"></h1>
        <div class="loading-rule" aria-hidden="true"><span>❖</span></div>
        <aside class="loading-note">
          <div class="loading-note-heading"></div>
          <div class="loading-tip"></div>
        </aside>
      </div>
    </div>
    <footer class="loading-footer">
      <img class="loading-waymark" alt="" aria-hidden="true" />
      <p class="loading-status"></p>
      <div class="loading-track" aria-hidden="true"><span></span></div>
    </footer>`;
  page.querySelector<HTMLImageElement>('.loading-illustration')!.src = artwork[screen.art];
  page.querySelector<HTMLImageElement>('.loading-waymark')!.src = emblem;
  translatePage(page, screen);
  return page;
}

function translatePage(page: HTMLElement, screen: Screen) {
  page.querySelector('.loading-brand')!.textContent = t('Crónicas de Brumaluz');
  page.querySelector('.loading-edition')!.textContent = t(notes[screen.art].heading);
  page.querySelector('.loading-eyebrow')!.textContent = t(screen.region);
  page.querySelector('.loading-title')!.textContent = t(screen.title);
  page.querySelector('.loading-note-heading')!.textContent = t('Un consejo para el camino');
  page.querySelector('.loading-tip')!.textContent = t(screen.tip);
  page.querySelector('.loading-status')!.textContent = t(screen.label);
}

function paint(panel: HTMLDivElement, screen: Screen) {
  panel.dataset.phase = screen.phase;
  panel.dataset.art = screen.art;
  panel.replaceChildren(engravingPage(screen));
}

function render() {
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'transition-loading';
    panel.className = 'transition-loading';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    document.body.append(panel);
  }
  const active = [...pending.values()].at(-1);
  panel.classList.toggle('loading-engraving', !!active?.screen);
  if (active?.screen) {
    paint(panel, active.screen);
  } else {
    panel.replaceChildren();
    delete panel.dataset.phase;
    delete panel.dataset.art;
    if (active) {
      const spinner = document.createElement('span');
      spinner.className = 'transition-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      const label = document.createElement('p');
      label.textContent = t(active.label);
      panel.append(spinner, label);
    }
  }
  panel.hidden = !active;
}

function updateLanguage() {
  if (panel && pending.size) {
    const active = [...pending.values()].at(-1);
    if (active?.screen) translatePage(panel, active.screen);
    else if (active) panel.querySelector('p')!.textContent = t(active.label);
  }
  for (const [overlay, screen] of maps) translatePage(overlay, screen);
}
document.addEventListener('brumaluz-language-change', updateLanguage);

export function beginTransition(label: string, { journey, destination }: { journey?: Journey; destination?: LoadingDestination } = {}) {
  const key = Symbol(label);
  const art = journey === 'return' ? 'book' : journey === 'create' ? 'world' : destination ? destinationArt(destination) : 'city';
  const screen: Screen | null = journey ? {
    phase: journey, art, label,
    title: journey === 'return' ? 'Tus historias te esperan' : journey === 'create' ? 'La primera página' : destination?.name || 'Brumaluz',
    region: journey === 'return' ? 'Selección de personajes' : journey === 'create' ? 'Una nueva aventura' : destination?.region || 'Te damos la bienvenida',
    tip: destination?.loadingTip || nextNote(art),
  } : null;
  pending.set(key, { label, screen });
  if (pending.size === 1) {
    document.getElementById('scene')!.setAttribute('aria-busy', 'true');
    showTimer = window.setTimeout(render, 180);
    expandTimer = window.setTimeout(() => panel?.classList.add('slow'), 1500);
  } else if (panel && !panel.hidden) render();
  return () => {
    if (!pending.delete(key)) return;
    if (pending.size) { if (panel && !panel.hidden) render(); return; }
    window.clearTimeout(showTimer);
    window.clearTimeout(expandTimer);
    document.getElementById('scene')!.removeAttribute('aria-busy');
    if (panel) { panel.hidden = true; panel.classList.remove('slow'); }
  };
}

export function beginMapTransition(map: LoadingDestination, { recovery = false } = {}) {
  const art = recovery ? 'lantern' : destinationArt(map);
  const screen: Screen = {
    phase: recovery ? 'recover' : 'travel', art,
    title: map.name, region: recovery ? 'De vuelta a la luz' : map.region || 'Pompelín',
    tip: map.loadingTip || nextNote(art),
    label: recovery ? 'Volviendo a Brumaluz…' : 'Preparando el camino…',
  };
  const overlay = document.createElement('div');
  overlay.className = 'map-transition loading-engraving';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  maps.set(overlay, screen);
  paint(overlay, screen);
  document.body.append(overlay);
  return () => { maps.delete(overlay); overlay.remove(); };
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  window.clearTimeout(showTimer);
  window.clearTimeout(expandTimer);
  document.removeEventListener('brumaluz-language-change', updateLanguage);
  panel?.remove();
  for (const overlay of maps.keys()) overlay.remove();
  document.getElementById('scene')?.removeAttribute('aria-busy');
});

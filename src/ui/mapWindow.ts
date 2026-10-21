import { currentMapImage } from './minimap';
import { t } from './i18n';
import { mapIcon, type MapPoint } from './mapIcons';
interface WaypointControls {
  get(): { x: number; z: number } | undefined;
  set(point: { x: number; z: number } | null): void;
}

export function renderZoneMap(body: HTMLElement, zone: string, player: () => { x: number; z: number; facing: number }, npcs: () => MapPoint[], waypoint: WaypointControls) {
  const { image, bounds } = currentMapImage();
  const root = document.createElement('div');
  root.className = 'zone-map';
  const heading = document.createElement('h3');
  heading.textContent = t(zone);
  root.append(heading);
  if (!image) {
    const error = document.createElement('p');
    error.setAttribute('role', 'alert');
    error.textContent = t('No se pudo cargar el mapa de esta zona.');
    root.append(error);
    body.replaceChildren(root);
    return () => {};
  }
  const chart = document.createElement('div');
  chart.className = 'zone-map-chart';
  chart.tabIndex = 0;
  chart.setAttribute('aria-label', t('Mapa interactivo. Enter: marcar el centro. Suprimir: quitar destino.'));
  const stage = document.createElement('div');
  stage.className = 'zone-map-stage';
  stage.append(chart);
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', t('Mapa completo de {zone}', { zone: t(zone) }));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo crear el mapa de la zona.');
  let zoom = 1, centerX = .5, centerZ = .5, redraw = true;
  const clampCenter = () => {
    const edge = .5 / zoom;
    centerX = Math.max(edge, Math.min(1-edge, centerX));
    centerZ = Math.max(edge, Math.min(1-edge, centerZ));
  };
  const north = document.createElement('span');
  north.className = 'zone-map-north';
  north.setAttribute('aria-hidden', 'true');
  north.innerHTML = `<svg viewBox="0 0 80 80" focusable="false">
    <circle cx="40" cy="43" r="25" fill="none" stroke="currentColor" stroke-width=".8"/>
    <circle cx="40" cy="43" r="20" fill="none" stroke="currentColor" stroke-width=".5" stroke-dasharray="1 4"/>
    <path d="M40 14 46 37 69 43 46 49 40 72 34 49 11 43 34 37Z" fill="#493924" stroke="currentColor"/>
    <path d="M40 14 40 43 46 37ZM69 43 40 43 46 49ZM40 72 40 43 34 49ZM11 43 40 43 34 37Z" fill="currentColor"/>
    <circle cx="40" cy="43" r="3" fill="#fff1c2"/>
    <text x="40" y="10" text-anchor="middle" fill="currentColor" font-size="10" font-family="serif">N</text>
  </svg>`;
  const scale = document.createElement('span');
  scale.className = 'zone-map-scale';
  scale.setAttribute('aria-label', t('Escala del mapa'));
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = 'zone-map-player';
  marker.title = t('Tu posición');
  marker.setAttribute('aria-label', t('Tu posición'));
  marker.setAttribute('aria-description', t('Marcar destino aquí'));
  marker.onclick = () => { const position = player(); waypoint.set({x:position.x,z:position.z}); };
  const arrow = document.createElement('span');
  arrow.innerHTML = mapIcon('player');
  marker.append(arrow);
  chart.append(canvas, north, scale, marker);
  const npcMarkers = new Map<string, HTMLButtonElement>();
  const toolbar = document.createElement('div');
  toolbar.className = 'zone-map-tools';
  const level = document.createElement('output');
  level.setAttribute('aria-label', t('Zoom'));
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = '100'; slider.max = '800'; slider.step = '10'; slider.value = '100';
  slider.setAttribute('aria-label', t('Nivel de zoom'));
  slider.oninput = () => zoomTo(Number(slider.value) / 100);
  const zoomTo = (value: number) => {
    zoom = Math.max(1, Math.min(8, value));
    clampCenter(); redraw = true;
    level.textContent = `${Math.round(zoom*100)}%`;
    slider.value = String(Math.round(zoom * 100));
    const meters = bounds.extent * .4 / zoom;
    scale.textContent = meters >= 1000 ? `${(meters/1000).toFixed(1)} km` : `${Math.round(meters)} m`;
    minus.disabled = zoom === 1; plus.disabled = zoom === 8;
  };
  const button = (label: string, text: string, action: () => void) => {
    const control = document.createElement('button');
    control.type = 'button'; control.className = 'btn ghost';
    control.textContent = text; control.title = t(label); control.setAttribute('aria-label', t(label));
    control.onclick = action;
    return control;
  };
  const minus = button('Alejar mapa', '−', () => zoomTo(zoom/1.5));
  const plus = button('Acercar mapa', '+', () => zoomTo(zoom*1.5));
  const reset = button('Ver zona completa', t('Ver zona completa'), () => zoomTo(1));
  const zoomControls = document.createElement('div');
  zoomControls.className = 'zone-map-zoom';
  zoomControls.append(minus, slider, plus, level, reset);
  const locate = button('Centrar en ti', t('Centrar en ti'), () => {
    const position = player();
    zoomTo(Math.max(2, zoom));
    centerX = (position.x-bounds.x+bounds.extent)/(2*bounds.extent);
    centerZ = (position.z-bounds.z+bounds.extent)/(2*bounds.extent);
    clampCenter(); redraw = true;
  });
  const remove = button('Quitar destino', t('Quitar destino'), () => waypoint.set(null));
  const actions = document.createElement('div');
  actions.className = 'zone-map-actions';
  actions.append(locate, remove);
  toolbar.append(zoomControls, actions);
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'zone-map-waypoint';
  pin.innerHTML = mapIcon('waypoint');
  pin.setAttribute('aria-label', t('Destino personal.'));
  pin.title = t('Destino personal.');
  pin.onclick = () => waypoint.set(null);
  chart.append(pin);
  zoomTo(1);
  chart.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = chart.getBoundingClientRect();
    const x = (event.clientX-rect.left)/rect.width-.5, z = (event.clientY-rect.top)/rect.height-.5;
    const previous = zoom, previousX = centerX, previousZ = centerZ;
    zoomTo(zoom*(event.deltaY < 0 ? 1.2 : 1/1.2));
    centerX = previousX+x*(1/previous-1/zoom); centerZ = previousZ+z*(1/previous-1/zoom);
    clampCenter(); redraw = true;
  }, {passive:false});
  let drag: { id: number; x: number; z: number; startX: number; startZ: number; moved: boolean; target: HTMLButtonElement | null } | null = null;
  let suppressClick = false;
  chart.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
  }, true);
  chart.addEventListener('pointerdown', event => {
    suppressClick = false;
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (event.button !== 0 || (target && !target.matches('.zone-map-npc,.zone-map-player'))) return;
    drag = {id:event.pointerId,x:event.clientX,z:event.clientY,startX:event.clientX,startZ:event.clientY,moved:false,target};
    chart.setPointerCapture(event.pointerId);
  });
  chart.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (Math.hypot(event.clientX-drag.startX,event.clientY-drag.startZ) > 5) drag.moved = true;
    if (!drag.moved) return;
    const rect = chart.getBoundingClientRect();
    centerX -= (event.clientX-drag.x)/rect.width/zoom;
    centerZ -= (event.clientY-drag.z)/rect.height/zoom;
    drag.x=event.clientX; drag.z=event.clientY;
    clampCenter(); redraw=true;
  });
  chart.addEventListener('lostpointercapture', () => { drag=null; });
  chart.addEventListener('pointercancel', () => { drag=null; });
  chart.addEventListener('pointerup', event => {
    if (drag?.id === event.pointerId && !drag.moved) {
      if (drag.target) drag.target.click();
      else {
        const rect = canvas.getBoundingClientRect();
        const x = centerX + ((event.clientX-rect.left)/rect.width-.5)/zoom;
        const z = centerZ + ((event.clientY-rect.top)/rect.height-.5)/zoom;
        waypoint.set({ x: bounds.x+(Math.max(0,Math.min(1,x))-.5)*2*bounds.extent, z: bounds.z+(Math.max(0,Math.min(1,z))-.5)*2*bounds.extent });
      }
    }
    suppressClick = drag?.moved ?? false;
    if (chart.hasPointerCapture(event.pointerId)) chart.releasePointerCapture(event.pointerId);
    drag=null;
  });
  chart.addEventListener('keydown', event => {
    if (event.target !== chart) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      waypoint.set({ x: bounds.x+(centerX-.5)*2*bounds.extent, z: bounds.z+(centerZ-.5)*2*bounds.extent });
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault(); waypoint.set(null);
    }
  });
  const legend = document.createElement('div');
  legend.className = 'zone-map-legend';
  const key = document.createElement('div');
  key.className = 'zone-map-key';
  for (const [symbol, label, className] of [
    [mapIcon('player'), 'Tu posición', 'player'], [mapIcon('npc'), 'NPC', 'npc'],
    [mapIcon('quest'), 'Objetivo de misión', 'quest'], [mapIcon('waypoint'), 'Destino personal', 'waypoint'],
    [mapIcon('exit'), 'Salida de zona', 'exit'], [mapIcon('interior'), 'Acceso a interior', 'interior'],
  ]) {
    const entry = document.createElement('span');
    const icon = document.createElement('span');
    icon.className = `zone-map-key-${className}`;
    icon.innerHTML = symbol; icon.setAttribute('aria-hidden', 'true');
    entry.append(icon, document.createTextNode(t(label)));
    key.append(entry);
  }
  const hint = document.createElement('p');
  hint.className = 'zone-map-hint';
  hint.setAttribute('role', 'status');
  hint.textContent = t('Clic en mapa o icono: destino · Arrastra: mover · Rueda: zoom');
  legend.append(key, hint);
  root.append(toolbar, stage, legend);
  body.replaceChildren(root);
  const positionMarker = (node: HTMLElement, x: number, z: number) => {
    const sx = ((x-bounds.x+bounds.extent)/(2*bounds.extent)-centerX)*zoom+.5;
    const sz = ((z-bounds.z+bounds.extent)/(2*bounds.extent)-centerZ)*zoom+.5;
    node.hidden = sx < 0 || sx > 1 || sz < 0 || sz > 1;
    node.style.left = `${sx*100}%`; node.style.top = `${sz*100}%`;
    node.classList.toggle('near-left', sx < .3);
    node.classList.toggle('near-right', sx > .7);
    node.classList.toggle('near-top', sz < .15);
  };
  return () => {
    if (redraw) {
      context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,(centerX-.5/zoom)*image.width,(centerZ-.5/zoom)*image.height,image.width/zoom,image.height/zoom,0,0,canvas.width,canvas.height);
      redraw=false;
    }
    const position = player();
    positionMarker(marker,position.x,position.z);
    const destination = waypoint.get();
    if (destination) positionMarker(pin, destination.x, destination.z);
    else pin.hidden = true;
    remove.disabled = !destination;
    arrow.style.transform = `rotate(${Math.PI - position.facing}rad)`;
    const current = npcs();
    const ids = new Set(current.map(npc=>npc.id));
    for (const [id,node] of npcMarkers) if (!ids.has(id)) { node.remove(); npcMarkers.delete(id); }
    for (const npc of current) {
      let node=npcMarkers.get(npc.id);
      if (!node) {
        node=document.createElement('button'); node.type='button'; node.className='zone-map-npc';
        const dot=document.createElement('span'); dot.className='zone-map-poi-icon'; dot.setAttribute('aria-hidden','true');
        const tooltip=document.createElement('span'); tooltip.className='zone-map-npc-name';
        node.append(dot,tooltip); chart.append(node); npcMarkers.set(npc.id,node);
      }
      const kind = npc.kind ?? 'npc';
      node.className = `zone-map-npc zone-map-poi-${kind}${npc.closed ? ' closed' : ''}`;
      node.querySelector('.zone-map-poi-icon')!.innerHTML = mapIcon(kind);
      node.setAttribute('aria-label',npc.name);
      node.setAttribute('aria-description',t('Marcar destino aquí'));
      node.onclick = () => waypoint.set({x:npc.x,z:npc.z});
      node.querySelector('.zone-map-npc-name')!.textContent=npc.name;
      positionMarker(node,npc.x,npc.z);
    }
  };
}

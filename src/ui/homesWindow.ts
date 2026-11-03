import type {CharData} from '../data/data';
import {RPG_CATALOG,professionState} from '../data/professions';
import {STARTER_HOME,NEXT_HOME,HOME_CATALOG,homeAt,HOME_FURNISHINGS,homeState,currentHomeView,placementError,furnitureBounds,type HomeDefinition} from '../data/homes';
import {NEIGHBORHOOD_PLANS} from '../data/neighborhood';
import {commissionCount} from '../data/dailyOrders';
import {renderSharedMeals} from './sharedMealsPanel';
import {itemIcon,itemLabel} from '../data/items';
import {performProfession} from '../game/professions';
import {holder} from '../game/stage';
import {play,session} from '../game/state';
import {getParty} from '../services/party';
import {locateHome,locateCozyTarget,visitHome,leaveHomeVisit} from '../game/homes';
import {setFurniturePreview,clearFurniturePreview} from '../world/professionWorld';
import {setWindow} from './menus';
import {selectProfessionTab} from './professionsWindow';
import {t} from './i18n';

let tab='homes',chosen='',x=.8,z=-.8,yaw=0,job='ebanisteria',character='',decorationLocation='',visitId='lucero',requestedTab:string|null=null;
export const selectHomesTab=(next='homes')=>{requestedTab=next;chosen='';clearFurniturePreview(play.city);};
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;if(text)e.textContent=t(text);return e;};
function button(text:string,act:()=>unknown,disabled=false){const b=el('button','profession-button',text);b.type='button';b.disabled=disabled;b.onclick=async()=>{b.disabled=true;try{await act();}finally{if(b.isConnected)b.disabled=disabled;}};return b;}
const openFurnitureRecipes=()=>{selectProfessionTab('recipes','ebanisteria');setWindow('professions');};
export function renderHomes(body:HTMLElement,d:CharData){
 const key=session.activeCharacterId??`${d.name}:${d.race}:${d.cls}`;if(key!==character){character=key;chosen='';tab='homes';clearFurniturePreview(play.city);}
 if(requestedTab){tab=requestedTab;requestedTab=null;}
 const state=professionState(d.rpg),homes=homeState(state.homes),home=homeAt(d.location),guest=!!homes.visit;
 if(decorationLocation!==d.location){decorationLocation=d.location;chosen='';clearFurniturePreview(play.city);}
 const root=el('section','homes-window'),header=el('header','homes-header');
 header.append(el('span','homes-kicker','UN LUGAR AL QUE VOLVER'),el('p','','Descansa, decora y haz sitio para tus cosas y tu gente.'));root.append(header);
 const nav=el('nav','homes-tabs');nav.setAttribute('aria-label',t('Apartados de viviendas'));
 for(const[id,label]of Object.entries({homes:'Mis viviendas',decorate:'Decorar',visits:'Visitas',neighborhood:'Vida de barrio'})){
  const b=button(label,()=>{tab=id;if(id!=='decorate')clearFurniturePreview(play.city);renderHomes(body,d);});b.setAttribute('aria-pressed',String(tab===id));b.dataset.homeTab=id;nav.append(b);
 }root.append(nav);const page=el('div','homes-page');root.append(page);
 if(tab==='homes'){
  for(const id of homes.owned){const definition=HOME_CATALOG.homes[id];if(!definition)continue;
   const here=home?.id===id;
   const card=el('article','home-card');card.dataset.home=id;card.append(el('div','home-illustration','⌂'),el('h3','',definition.label),el('p','',definition.description));
   card.append(el('p','home-detail',homes.primary===id?'Vivienda principal':'Vivienda disponible'),el('p','home-detail',`${state.furniture.filter(f=>f.location===definition.location).length} / ${definition.limit} ${t('muebles colocados')}`),el('p','home-detail','Espacio fijo · cama y cofre incluidos'));
   const actions=el('div','home-actions');actions.append(button(here&&!guest?(id==='lucero'?'Decorar mi habitación':'Decorar esta casa'):(id==='lucero'?'Localizar la posada':'Localizar esta casa'),()=>{if(here&&!guest){tab='decorate';renderHomes(body,d);}else locateHome(id);}));
   if(homes.primary!==id)actions.append(button('Hacer principal',()=>performProfession('home_primary',{id})));card.append(actions);page.append(card);
  }
  page.append(el('p','home-note','Tu habitación es personal. Las viviendas mantienen su tamaño; tú eliges cómo amueblarlas.'));
  if(!homes.owned.includes(NEXT_HOME.id))renderNextHome(page,d,()=>{tab='neighborhood';renderHomes(body,d);});
  else page.append(el('h3','','Disfruta de tu casa'),el('p','','La habitación de la posada sigue siendo tuya. Puedes llevar los muebles en la mochila, elegir tu vivienda principal e invitar a tu grupo desde la entrada de cada hogar.'));
  if(!state.furniture.some(f=>f.location===STARTER_HOME.location))page.append(el('h3','','Tu primer mueble'),el('p','','El recado de Gnomi paga 100 Pelines. Compra una herramienta básica y una receta de mueble de Aprendiz, aprende el pergamino, reúne los materiales y fabrica la pieza en Ebanistería.'),button('Ver mis primeras recetas de muebles',openFurnitureRecipes));
  if(state.furniture.some(f=>f.location==='casa_de_isberto_interior'))page.append(el('p','home-note','Los muebles que dejaste en casa de Isberto se conservan y puedes recogerlos desde Profesiones.'));
 }else if(tab==='decorate'){
  if(!home||!homes.owned.includes(home.id)||guest){page.append(el('h3','',guest?'Estás de visita':'Decora tu habitación'),el('p','','Entra en tu propia habitación para colocar y reorganizar tus muebles.'),button('Localizar mi vivienda',()=>locateHome()));}
  else renderDecoration(page,d,home,()=>renderHomes(body,d));
 }else if(tab==='visits'){
  page.append(el('h3','','Compartir el hogar'),el('p','','Permite que tu grupo visite tus viviendas. Solo tú puedes mover o recoger tus muebles.'));
  const controls=el('div','home-actions');for(const access of ['private','party'] as const){const b=button(access==='private'?'Solo yo':'Permitir a mi grupo',()=>performProfession('home_access',{access}));b.setAttribute('aria-pressed',String(homes.access===access));controls.append(b);}page.append(controls);
  if(guest){const v=currentHomeView();page.append(el('p','home-note',v?.allowed?`${t('Visitando a')} ${v.name}`:'La visita está terminando.'),button('Terminar visita',leaveHomeVisit));}
  const members=getParty().members.filter(m=>m.characterId!==session.activeCharacterId);
  page.append(el('h3','','Visitar a mi grupo'),el('p','','Elige una vivienda y acércate a su entrada. Tu anfitrión debe tenerla y permitir visitas.'));
  const select=el('select','profession-weapon-select');select.setAttribute('aria-label',t('Vivienda que visitar'));for(const h of Object.values(HOME_CATALOG.homes)){const option=el('option','',h.label);option.value=h.id;select.append(option);}select.value=visitId;select.onchange=()=>{visitId=select.value;renderHomes(body,d);};page.append(select);
  if(!members.length)page.append(el('p','home-note','Forma un grupo para visitaros. También puedes disfrutar de tu hogar a solas.'));
  for(const member of members)page.append(button(`${t('Visitar a')} ${member.data.name}`,()=>visitHome(member.characterId,visitId),d.location!==HOME_CATALOG.homes[visitId].entrance.location));
  page.append(button('Localizar la entrada',()=>locateHome(visitId)));
 }else renderNeighborhood(page,d);
 body.replaceChildren(root);
}
function renderNextHome(page:HTMLElement,d:CharData,showProjects:()=>void){
 const home=NEXT_HOME,offer=home.purchase!,near=d.location===home.entrance.location&&Math.hypot(holder.position.x-home.entrance.x,holder.position.z-home.entrance.z)<=home.entrance.radius;
 const card=el('article','home-card home-next');card.dataset.homeOffer=home.id;
 card.append(el('span','homes-kicker','TU SIGUIENTE HOGAR'),el('h3','',home.label),el('p','',home.description),el('p','home-detail','Más espacio para decorar · 40 muebles · cama y cofre incluidos'));
 card.append(el('p','home-price',`${offer.price} ${t('Pelines')} · ${t('En tu monedero:')} ${d.wallet.pelines}`),el('p','home-note','Compra única, sin alquiler ni plazos. La habitación de la posada sigue siendo tuya.'));
 const actions=el('div','home-actions');actions.append(button('Ver proyectos opcionales',showProjects),button('Localizar esta casa',()=>locateHome(home.id)));
 if(near)actions.append(button(`${t('Comprar por')} ${offer.price} ${t('Pelines')}`,()=>performProfession('home_buy',{id:home.id,price:offer.price}),d.wallet.pelines<offer.price));
 else card.append(el('p','home-note','Acércate a la entrada para comprar la casa con tus Pelines.'));
 card.append(actions);page.append(card);
}
function renderDecoration(page:HTMLElement,d:CharData,home:HomeDefinition,redraw:()=>void){
 const state=professionState(d.rpg),pieces=state.furniture.filter(p=>p.location===home.location),piece=pieces.find(p=>`placed:${p.id}`===chosen),slot=chosen.startsWith('bag:')?Number(chosen.slice(4)):-1;
 const item=piece?.item??(slot>=0?d.inventory[slot]:null),kind=item&&RPG_CATALOG.items[item.id]?.furniture,def=kind&&HOME_FURNISHINGS[kind];
 const layout=el('div','home-decor-layout'),planArea=el('div','home-plan-area'),list=el('div','home-piece-list');
 planArea.append(el('h3','',home.id==='lucero'?'Tu habitación':home.label),el('p','','Pulsa el plano para elegir el sitio. Gira el mueble antes de confirmar.'));
 const bounds=home.bounds;
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`${bounds.minX-.25} ${bounds.minZ-.25} ${bounds.maxX-bounds.minX+.5} ${bounds.maxZ-bounds.minZ+.5}`);svg.classList.add('home-plan');svg.setAttribute('role','img');svg.setAttribute('aria-label',t('Plano de la habitación'));
 function rect(bounds:ReturnType<typeof furnitureBounds>,cls:string){const r=document.createElementNS(ns,'rect');r.setAttribute('x',String(bounds.minX));r.setAttribute('y',String(bounds.minZ));r.setAttribute('width',String(bounds.maxX-bounds.minX));r.setAttribute('height',String(bounds.maxZ-bounds.minZ));r.setAttribute('class',cls);svg.append(r);return r;}
 rect(home.bounds,'home-plan-floor');for(const a of home.reserved)rect(a,'home-plan-reserved');
 for(const p of pieces){const k=RPG_CATALOG.items[p.item.id]?.furniture??'mesa';const r=rect(furnitureBounds(k,p.x,p.z,p.yaw),`home-plan-piece${piece===p?' selected':''}`);r.onclick=e=>{e.stopPropagation();chosen=`placed:${p.id}`;x=p.x;z=p.z;yaw=p.yaw;redraw();};const title=document.createElementNS(ns,'title');title.textContent=itemLabel(p.item.id);r.append(title);}
 const error=kind?placementError(kind,x,z,yaw,pieces,id=>RPG_CATALOG.items[id]?.furniture??'',piece?.id,home):'';
 if(kind){rect(furnitureBounds(kind,x,z,yaw),`home-plan-preview${error?' invalid':''}`);setFurniturePreview(play.city,kind,RPG_CATALOG.items[item!.id].tier,x,z,yaw,!error,job,piece?.id);}else clearFurniturePreview(play.city);
 svg.onclick=e=>{if(!kind)return;const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const local=point.matrixTransform(svg.getScreenCTM()!.inverse());x=Math.round(local.x*4)/4;z=Math.round(local.y*4)/4;redraw();};planArea.append(svg,el('p','home-note','Las zonas sombreadas reservan el acceso a la puerta, la cama y el cofre.'));
 if(item&&kind&&def){
  const edit=el('div','home-editor');edit.append(el('h3','',itemLabel(item.id)));const controls=el('div','home-actions');
  controls.append(button('↶ 90°',()=>{yaw-=Math.PI/2;redraw();}),button('90° ↷',()=>{yaw+=Math.PI/2;redraw();}));
  for(const[label,axis,delta]of [['←','x',-.25],['→','x',.25],['↑','z',-.25],['↓','z',.25]] as const)controls.append(button(label,()=>{if(axis==='x')x+=delta;else z+=delta;redraw();}));
  edit.append(controls,el('p','home-coordinates',`X ${x.toFixed(2)} · Z ${z.toFixed(2)} · ${Math.round(yaw*180/Math.PI)}°`));
  if(kind==='estacion'){const select=el('select','profession-weapon-select');select.setAttribute('aria-label',t('Oficio del banco de trabajo'));for(const[id,label]of Object.entries(RPG_CATALOG.professions).filter(([id])=>!['minero','lenador','recolector'].includes(id))){const o=el('option','',label);o.value=id;select.append(o);}select.value=job;select.onchange=()=>{job=select.value;redraw();};edit.append(select);}
  const notice=el('p',`home-note${error?' error':''}`,error||'Listo para colocar. Confirma cuando te guste.');notice.setAttribute('role','status');edit.append(notice);
  edit.append(button(piece?'Guardar nueva posición':'Colocar mueble',async()=>{const ok=await performProfession(piece?'home_move':'home_place',{id:piece?.id,...(piece?{}:{slot}),instanceId:item.instanceId,x,z,yaw,job});if(ok){chosen='';clearFurniturePreview(play.city);redraw();}},!!error));
  if(piece)edit.append(button('Recoger en la mochila',async()=>{if(await performProfession('home_pickup',{id:piece.id,instanceId:item.instanceId})){chosen='';clearFurniturePreview(play.city);redraw();}}));
  edit.append(button('Cancelar',()=>{chosen='';clearFurniturePreview(play.city);redraw();}));planArea.append(edit);
 }
 list.append(el('h3','','Muebles en la mochila'));
 let count=0;d.inventory.forEach((i,slot)=>{if(!i||!RPG_CATALOG.items[i.id]?.furniture)return;count++;const b=button(itemLabel(i.id),()=>{chosen=`bag:${slot}`;x=.75;z=-.75;yaw=0;redraw();});const icon=el('span','home-item-icon');icon.innerHTML=itemIcon(i.id);b.prepend(icon);b.classList.toggle('selected',chosen===`bag:${slot}`);list.append(b);});
 if(!count)list.append(el('p','home-note','Fabrica muebles en Ebanistería y tráelos en tu mochila.'));list.append(button('Ver recetas de Ebanistería',openFurnitureRecipes));
 list.append(el('h3','','Muebles colocados'));for(const p of pieces){const b=button(itemLabel(p.item.id),()=>{chosen=`placed:${p.id}`;x=p.x;z=p.z;yaw=p.yaw;redraw();});b.classList.toggle('selected',chosen===`placed:${p.id}`);list.append(b);}
 layout.append(planArea,list);page.append(layout);
}
function renderNeighborhood(page:HTMLElement,d:CharData){
 const errand=d.rpg?.neighborhood?.errand;
 page.append(el('h3','','Un recado para empezar'),el('p','',errand==='completed'?'Ya ayudaste a Gnomi a ponerse al día con el taller. Ganaste 100 Pelines para empezar.':errand==='accepted'?'Habla con el maestro de Leñadores y pregúntale por el suministro que necesita.':errand==='visited'?'Vuelve a Gnomi junto al pozo para contarle lo que necesita el taller y cobrar 100 Pelines.':'Gnomi tiene un recado tranquilo: consultar al maestro de Leñadores y volver. Paga 100 Pelines y no requiere herramientas.'));
 page.append(el('p','home-note','Con el recado puedes comprar una herramienta de 20 Pelines y una receta de Aprendiz de 50. La práctica de iniciación se entrega por separado.'));
 page.append(el('h3','','De la posada a tu casa'),el('p','','Los proyectos son opcionales y no son requisitos para comprar la casa. Cada uno se completa una vez; puedes completar dos al día con componentes fabricados por ti.'));
 const completed=d.rpg?.neighborhood?.preparations??[];
 for(const[id,plan]of Object.entries(NEIGHBORHOOD_PLANS)){
  const card=el('article','home-project');card.dataset.homeProject=id;const teacher=RPG_CATALOG.teachers[plan.job],done=completed.includes(id),near=d.location===teacher.location&&Math.hypot(holder.position.x-teacher.x,holder.position.z-teacher.z)<=3;
  card.append(el('h3','',plan.label),el('p','',done?plan.thanks:plan.description));
  if(done)card.append(el('p','home-project-done','✓ '+t('Proyecto terminado')));
  else{
   let enough=true;for(const[item,n]of Object.entries(plan.ingredients)){const have=commissionCount(d,item);enough&&=have>=n;card.append(el('p','home-detail',`${itemLabel(item)} · ${have} / ${n}`));}
   card.append(el('p','home-detail',`${t('Recompensa:')} ${plan.pelines} ${t('Pelines')}${plan.gift?` + ${itemLabel(plan.gift)}`:''}`));
   const actions=el('div','home-actions');actions.append(button('Localizar al maestro',()=>locateCozyTarget(teacher)),button('Entregar materiales y terminar',()=>performProfession('neighbor_prepare',{id,master:teacher.id}),!enough||!near));card.append(actions);
   if(!near)card.append(el('p','home-note','La entrega se hace hablando con el maestro en su taller.'));
  }page.append(card);
 }
 if(Object.keys(NEIGHBORHOOD_PLANS).every(id=>completed.includes(id)))page.append(el('p','home-note',homeState(d.rpg?.homes).owned.includes(NEXT_HOME.id)?'Ya tienes las llaves de la Casa del Olmo. Disfruta de tu nuevo hogar.':'Puedes seguir ahorrando para tu casa con ventas, misiones, combate y encargos.'),button('Localizar esta casa',()=>locateHome(NEXT_HOME.id)));
 const teacher=RPG_CATALOG.teachers.cocina,near=d.location===teacher.location&&Math.hypot(holder.position.x-teacher.x,holder.position.z-teacher.z)<=3;
 renderSharedMeals(page,d,near,teacher.id);
}

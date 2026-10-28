import { RPG_CATALOG, professionState, professionRank, recipeExperience, professionExperience, gatherEnergy, RANK_XP, ENCHANT_LABELS, enchantmentDescription, type Recipe, type RpgState } from '../data/professions';
import { itemLabel, itemIcon, itemDef } from '../data/items';
import { ITEM_RARITIES, rarityForTier } from '../data/itemRarity';
import type { CharData } from '../data/data';
import type { ItemStack } from '../data/inventory';
import { performProfession } from '../game/professions';
import { holder } from '../game/stage';
import { setItemTooltip } from './itemTooltip';
import { professionIcon, PROFESSION_COLORS } from './professionArt';
import { gatheringEnergy, professionTime, updateProfessionEnergy } from './professionEnergy';
import { t } from './i18n';
import { resourceFamily, RESOURCE_FAMILIES } from '../data/resourceAppearance';
import { personalWaypoints } from './gameInterface';
import { setWindow } from './menus';
import { PROFESSION_GUIDES, type GuidedProfession } from '../story/professionMasters';
import { play } from '../game/state';
import { WILDERNESS } from '../data/wilderness';

let selected='herreria',tab='guide',filter='',quality='all',knowledge='all',amount=1,weaponTarget=-1,recipeId='',owner='',furnitureJob='';
const expandedSections=new Map<string,boolean>();
const gathering=['minero','lenador','recolector'];
let view='profession';
const utilities:Record<string,string>={tools:'Mis herramientas',enchants:'Encantar un arma',furniture:'Mi casa',deliveries:'Entregas'};
function professionTabs(){return gathering.includes(selected)?{guide:'Guía',recipes:'Recursos',tools:'Herramienta',mastery:'Maestría'}:['alquimia','cocina'].includes(selected)?{guide:'Guía',recipes:'Recetas',mastery:'Maestría'}:{guide:'Guía',recipes:'Recetas',jobs:'Trabajos',mastery:'Maestría'};}
const descriptions:Record<string,string>={herreria:'Armas, armaduras de metal y herramientas de recolección.',peleteria:'Protecciones de cuero para quienes prefieren la agilidad.',sastreria:'Tejidos y vestiduras para magos y clérigos.',carpinteria:'Ballestas, bastones, varitas y equipo de madera.',ebanisteria:'Muebles y bancos de trabajo para tu hogar.',joyeria:'Anillos, colgantes y abalorios para completar tu equipo.',alquimia:'Pociones para recuperar vida, maná y estamina.',encantamiento:'Pergaminos que añaden un efecto al arma principal.',cocina:'Provisiones que mejoran tus reservas durante el viaje.',minero:'Minerales y gemas de los yacimientos de Pompelín.',lenador:'Maderas para armas, herramientas y mobiliario.',recolector:'Hierbas, fibras, hongos, cereales, frutas y bayas silvestres.'};
export function selectProfessionTab(next:string,job?:string){view=Object.hasOwn(utilities,next)&&!(next==='tools'&&job&&gathering.includes(job))?next:'profession';tab=next;if(job&&RPG_CATALOG.professions[job]){if(selected!==job){recipeId='';filter='';}selected=job;}}
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text='')=>{const node=document.createElement(tag);node.className=cls;if(text)node.textContent=t(text);return node;};
const icon=(id:string,cls='profession-symbol')=>{const node=el('span',cls);node.innerHTML=professionIcon(id);return node;};
const count=(d:CharData,id:string)=>d.inventory.reduce((sum,item)=>sum+(item?.id===id?item.count:0),0);
const number=(value:number)=>value.toLocaleString('es-ES',{maximumFractionDigits:1});
function button(label:string,action:()=>void|Promise<unknown>,disabled=false,cls='profession-button'){
 const node=el('button',cls,label);node.type='button';node.disabled=disabled;
 node.onclick=async()=>{if(node.disabled)return;node.disabled=true;node.classList.add('busy');node.setAttribute('aria-busy','true');try{await action();}finally{if(node.isConnected){node.disabled=disabled;node.classList.remove('busy');node.removeAttribute('aria-busy');}}};return node;
}
const action=(name:string,args:Record<string,unknown>={})=>()=>performProfession(name,args);
function art(id:string,cls='profession-item-art',stack?:ItemStack){const node=el('span',cls);node.innerHTML=itemIcon(id);setItemTooltip(node,id,stack?.bound,stack);return node;}
function heading(title:string,copy:string,symbol:string){const node=el('div','profession-section-heading');node.append(icon(symbol),el('div'));node.lastElementChild!.append(el('h3','',title),el('p','',copy));return node;}
function empty(title:string,copy:string,symbol='recipes'){const node=el('div','profession-empty');node.append(icon(symbol),el('strong','',title),el('p','',copy));return node;}
function chip(label:string,cls=''){return el('span',`profession-chip ${cls}`,label);}
function itemMaterial(d:CharData,id:string,required:number){
 const have=count(d,id),row=el('div',`profession-material${have<required?' missing':''}`),copy=el('span','profession-material-name'),family=resourceFamily(id),recipe=RPG_CATALOG.recipes[id];
 const site=id.startsWith('cuero_')?WILDERNESS.spawns.find(site=>WILDERNESS.enemies[site.enemy].family==='beast'&&(WILDERNESS.enemies[site.enemy].loot[id]??0)>0):undefined,enemy=site?WILDERNESS.enemies[site.enemy]:undefined;
 const source=enemy?`${enemy.label} · nivel ${enemy.level}${id==='cuero_0'?'':' · También en Peletería'}`:family?RPG_CATALOG.professions[RESOURCE_FAMILIES[family].job]:recipe?RPG_CATALOG.professions[recipe.job]:'';
 copy.append(el('b','',itemLabel(id)));if(source)copy.append(el('small','',source));row.append(art(id),copy,el('b','',`${have} / ${required}`));
 if(site){const locate=button('',()=>{personalWaypoints.set(site.location,{x:site.x,z:site.z});setWindow('map');},d.location!==site.location,'profession-field-locate');locate.append(icon('pin'));locate.setAttribute('aria-label',t('Localizar {resource}',{resource:enemy!.label}));locate.title=t(d.location===site.location?'Marcar en el mapa':'Disponible al explorar Pompelín');row.append(locate);}
 return row;
}
function station(d:CharData,state:RpgState,job:string){
 const matches=(candidate:string)=>candidate===job||gathering.includes(job)&&candidate==='herreria';
 const sites=[...Object.values(RPG_CATALOG.stations).filter(site=>matches(site.job)),...state.furniture.filter(piece=>piece.job&&matches(piece.job)).map(piece=>({...piece,label:'Banco de trabajo',radius:4}))];
 const here=sites.filter(site=>site.location===d.location).sort((a,b)=>Math.hypot(a.x-holder.position.x,a.z-holder.position.z)-Math.hypot(b.x-holder.position.x,b.z-holder.position.z));
 const closest=here[0],distance=closest?Math.hypot(closest.x-holder.position.x,closest.z-holder.position.z):Infinity;
 return {near:!!closest&&distance<=(closest.radius??4),text:closest?`${closest.label} · ${Math.ceil(distance)} m`:t('Visita el taller de {profession}',{profession:t(RPG_CATALOG.professions[job])})};
}
function energyMeter(state:RpgState){const root=el('div','profession-energy');root.dataset.gatheringEnergy='';root.setAttribute('role','meter');root.setAttribute('aria-label',t('Energía'));root.setAttribute('aria-valuemin','0');root.setAttribute('aria-valuemax','100');root.append(icon('energy'));const content=el('div');content.append(el('small','','Energía'));const value=el('strong'),n=el('span','',number(gatheringEnergy(state)));n.dataset.energyNumber='';value.append(n,el('small','',' / 100'));const track=el('span','gathering-energy-track');track.append(el('i'));const recovery=el('small','profession-energy-recovery');recovery.dataset.energyRecovery='';content.append(value,track,recovery);root.append(content);return root;}

export function renderProfessions(body:HTMLElement,d:CharData){
 const nextOwner=`${d.name}:${d.race}:${d.cls}`;if(owner!==nextOwner){owner=nextOwner;recipeId='';filter='';quality='all';knowledge='all';amount=1;weaponTarget=-1;}
 const scrolls=new Map([...body.querySelectorAll<HTMLElement>('[data-profession-scroll]')].map(node=>[node.dataset.professionScroll!,node.scrollTop]));
 const horizontalScroll=body.querySelector<HTMLElement>('.profession-list')?.scrollLeft??0;
 const focused=document.activeElement instanceof HTMLElement&&body.contains(document.activeElement)?document.activeElement.dataset.professionControl:null;
 const selection=document.activeElement instanceof HTMLInputElement?document.activeElement.selectionStart:null;
 for(const details of body.querySelectorAll<HTMLDetailsElement>('details[data-profession-section]'))expandedSections.set(details.dataset.professionSection!,details.open);
 const state=professionState(d.rpg),rank=professionRank(state,selected),isGather=gathering.includes(selected),now=Date.now()/1000,workplace=station(d,state,selected);
 const tabsForJob=professionTabs();if(view==='profession'&&!(tab in tabsForJob))tab='guide';
 const root=el('section','profession-window');root.style.setProperty('--profession-accent',PROFESSION_COLORS[selected]);root.style.setProperty('--profession-tabs',String(Object.keys(tabsForJob).length));
 const header=el('header','profession-header'),identity=el('div','profession-identity');identity.append(icon(view==='profession'?selected:view,'profession-crest'));
 const utilityDescriptions:Record<string,string>={tools:'Tu equipo de campo, su durabilidad y mantenimiento.',enchants:'Aplica un pergamino al arma principal. No requiere dominar un oficio.',furniture:'Organiza los muebles y bancos de trabajo de tu hogar.',deliveries:'Recupera los materiales y objetos que quedaron pendientes.'};
 const copy=el('div');copy.append(el('span','profession-eyebrow',view==='profession'?'OFICIOS / '+(isGather?'RECOLECCIÓN':'FABRICACIÓN'):'OFICIOS / UTILIDADES'),el('h3','',view==='profession'?RPG_CATALOG.professions[selected]:utilities[view]),el('p','',view==='profession'?descriptions[selected]:utilityDescriptions[view]));identity.append(copy);header.append(identity);if(view==='tools'||view==='profession'&&isGather)header.append(energyMeter(state));root.append(header);
 const layout=el('div','profession-layout'),sidebar=el('aside','profession-sidebar'),nav=el('nav','profession-list');nav.dataset.professionScroll='sidebar';nav.setAttribute('aria-label',t('Oficios'));
 const picker=el('select','profession-picker');picker.dataset.professionControl='profession-picker';picker.setAttribute('aria-label',t('Elegir oficio'));const placeholder=el('option','','Elegir oficio…');placeholder.value='';placeholder.disabled=true;picker.append(placeholder);for(const group of [false,true]){const options=el('optgroup');options.label=t(group?'Recolección':'Fabricación');for(const[job,label]of Object.entries(RPG_CATALOG.professions).filter(([job])=>gathering.includes(job)===group)){const option=el('option','',`${label} · ${RPG_CATALOG.ranks[professionRank(state,job)]}`);option.value=job;options.append(option);}picker.append(options);}picker.value=view==='profession'?selected:'';picker.onchange=()=>{selected=picker.value;view='profession';tab='guide';recipeId='';filter='';quality='all';knowledge='all';amount=1;renderProfessions(body,d);};
 for(const group of [false,true]){
  nav.append(el('h4','profession-nav-label',group?'Recolección':'Fabricación'));
  for(const[job,label]of Object.entries(RPG_CATALOG.professions).filter(([job])=>gathering.includes(job)===group)){
   const ownRank=professionRank(state,job),xp=state.xp[job]??0,base=RANK_XP[ownRank],max=RANK_XP[ownRank+1]??base,ready=state.jobs.filter(task=>task.job===job&&(task.done||task.end<=now)).length;
   const b=button('',()=>{selected=job;view='profession';tab='guide';recipeId='';filter='';quality='all';knowledge='all';amount=1;renderProfessions(body,d);},false,'profession-nav-item');b.dataset.professionControl=`job-${job}`;b.classList.toggle('selected',view==='profession'&&job===selected);b.setAttribute('aria-pressed',String(view==='profession'&&job===selected));b.style.setProperty('--job-color',PROFESSION_COLORS[job]);
   const text=el('span','profession-nav-copy');text.append(el('b','',label),el('small','',RPG_CATALOG.ranks[ownRank]));const progress=el('span','profession-nav-progress');progress.style.setProperty('--progress',`${ownRank===5?100:Math.max(0,Math.min(100,(xp-base)/(max-base)*100))}%`);text.append(progress);b.append(icon(job),text);if(ready)b.append(el('i','profession-ready-badge',String(ready)));nav.append(b);
  }
 }
 const utilityNav=el('nav','profession-utilities');utilityNav.setAttribute('aria-label',t('Utilidades'));utilityNav.append(el('h4','','Utilidades'));
 for(const[id,label]of Object.entries(utilities)){const b=button('',()=>{view=id;renderProfessions(body,d);},false,'profession-utility');b.dataset.professionControl=`utility-${id}`;b.classList.toggle('selected',view===id);b.setAttribute('aria-pressed',String(view===id));b.append(icon(id),el('b','',label));if(id==='deliveries'&&state.deliveries.length)b.append(el('i','profession-ready-badge',String(state.deliveries.length)));utilityNav.append(b);}
 sidebar.append(picker,nav,utilityNav);layout.append(sidebar);
 const content=el('div','profession-content'),tabs=el('nav','profession-tabs');tabs.setAttribute('aria-label',t('Apartados de profesiones'));
 for(const[id,label]of view==='profession'?Object.entries(tabsForJob):[]){
  const b=button('',()=>{tab=id;renderProfessions(body,d);},false,'profession-tab');b.dataset.professionControl=`tab-${id}`;b.setAttribute('aria-pressed',String(tab===id));b.classList.toggle('selected',tab===id);b.append(icon(id==='mastery'?'star':id),el('span','',label));
  if(id==='jobs'){const ready=state.jobs.filter(task=>task.job===selected&&(task.done||task.end<=now)).length;if(ready)b.append(el('b','profession-tab-badge',String(ready)));}tabs.append(b);
 }
 if(view==='profession')content.append(tabs);
 const summary=el('div','profession-summary'),xp=state.xp[selected]??0,base=RANK_XP[rank],next=RANK_XP[rank+1],progress=el('progress');progress.max=next?next-base:1;progress.value=next?Math.min(next-base,Math.max(0,xp-base)):1;progress.setAttribute('aria-label',t('Progreso del oficio'));
 const rankBox=el('div','profession-rank');rankBox.append(icon('star'),el('b','',RPG_CATALOG.ranks[rank]),el('span','',`${number(xp)}${next?` / ${number(next)}`:''} EXP`),progress);summary.append(rankBox);
 const field=isGather&&tab==='recipes',location=el('div',`profession-location${!field&&workplace.near?' available':''}`);location.append(icon(!field&&workplace.near?'check':'pin'),el('span','',field?'Pompelín · fuera de las ciudades':workplace.near?'Estación disponible':workplace.text));summary.append(location);if(view==='profession')content.append(summary);
 const page=el('div',`profession-page profession-page-${view==='profession'?tab:view}`);page.dataset.professionScroll=`page-${view}-${selected}-${tab}`;
 const redraw=()=>renderProfessions(body,d);
 if(view==='tools')renderTools(page,d,state,redraw);
 else if(view==='enchants')renderEnchants(page,d,redraw);
 else if(view==='furniture')renderFurniture(page,d,state,redraw);
 else if(view==='deliveries')renderDeliveries(page,state);
 else if(tab==='guide')renderProfessionGuide(page,d,state,workplace,redraw);
 else if(tab==='mastery'){page.append(heading('Tu progreso','Avanza con experiencia, práctica y proyectos de maestría.','star'));renderMastery(page,d,state,workplace.near);}
 else if(tab==='recipes'&&isGather)renderFieldGuide(page,d,state,rank,workplace.near,redraw);
 else if(tab==='recipes')renderRecipeBook(page,d,state,rank,workplace.near,redraw);
 else if(tab==='jobs')renderJobs(page,d,state,workplace.near,now);
 else if(tab==='tools')renderTools(page,d,state,redraw);
 content.append(page);layout.append(content);root.append(layout);
 const footer=el('footer','profession-footer');const note=view!=='profession'?'Selecciona un oficio para volver a sus recetas o recursos.':isGather?'Cada oficio de recolección tiene su propio progreso.':selected==='alquimia'&&d.race==='elfo'?'Afinidad élfica · 25 % de probabilidad de una poción adicional':['alquimia','cocina'].includes(selected)?'Fabricación instantánea. No utiliza cola de trabajos.':d.race==='humano'?'Afinidad humana · 15 % menos tiempo de fabricación':'Los trabajos continúan mientras viajas o estás desconectado.';footer.append(icon(isGather&&view==='profession'?'pin':'clock'),el('span','',note),el('kbd','','P'));root.append(footer);
 body.replaceChildren(root);
 for(const details of body.querySelectorAll<HTMLDetailsElement>('details[data-profession-section]'))details.open=expandedSections.get(details.dataset.professionSection!)??false;
 for(const node of body.querySelectorAll<HTMLElement>('[data-profession-scroll]'))node.scrollTop=scrolls.get(node.dataset.professionScroll!)??0;
 const professionNav=body.querySelector<HTMLElement>('.profession-list');if(professionNav)professionNav.scrollLeft=horizontalScroll;
 if(focused){const target=body.querySelector<HTMLElement>(`[data-profession-control="${CSS.escape(focused)}"]`);target?.focus({preventScroll:true});if(target instanceof HTMLInputElement&&target.type==='search'&&selection!==null)target.setSelectionRange(selection,selection);}
 updateProfessionEnergy();
}

function renderProfessionGuide(page:HTMLElement,d:CharData,state:RpgState,workplace:{near:boolean;text:string},redraw:()=>void){
 const guide=PROFESSION_GUIDES[selected as GuidedProfession];
 if(!guide)return;
 const isGather=guide.kind==='gathering',timed=guide.kind==='timed';
 const go=(next:string)=>{view='profession';tab=next;redraw();};
 page.classList.add('profession-guide');
 page.append(heading('Empieza aquí',guide.summary,selected));
 const places=el('div','profession-guide-places');
 const roles=[
  ['star','Maestro','Te explica el oficio y vende pergaminos de receta. Los aprendes al usarlos desde la mochila. Los excepcionales solo se consiguen como botín.'],
  [selected,'Banco del taller',isGather?'Consulta tu progreso y presenta proyectos. La compra y reparación de herramientas se hacen en Herrería.':timed?'Aquí fabricas recetas aprendidas, encargas piezas y gestionas los trabajos de este oficio.':'Aquí elaboras las pociones o la comida de recetas que ya conoces.'],
  ['pin','Campo',isGather?'Los recursos se recogen en Pompelín, fuera de ciudades. Tu cuaderno te ayuda a encontrarlos.':'Reúne recursos en Pompelín o consigue los materiales comerciando. Cada receta muestra lo que necesita.'],
 ];
 for(const[symbol,title,text]of roles){const place=el('article','profession-guide-place'),copy=el('div');copy.append(el('h4','',title),el('p','',text));place.append(icon(symbol),copy);places.append(place);}
 const steps:{title:string;copy:string;symbol:string;target:string;label:string}[]=isGather?[
  {title:'Prepara tu herramienta',copy:'Equipa la herramienta de este oficio desde tu mochila. Las básicas se compran en Herrería; allí también se reparan.',symbol:'tools',target:'tools',label:'Revisar herramienta'},
  {title:'Reconoce los recursos',copy:'El cuaderno muestra qué puedes recoger, cuánto cuesta y qué tienes en la mochila. En Pompelín puedes marcar un nodo disponible.',symbol:'recipes',target:'recipes',label:'Abrir cuaderno de campo'},
  {title:'Recolecta en Pompelín',copy:'Acércate al recurso y pulsa E. Quédate cerca hasta completar el trabajo: moverte o recibir daño interrumpe la extracción.',symbol:'pin',target:'recipes',label:'Ver recursos'},
  {title:'Cuida tu energía y tu herramienta',copy:'La energía se recupera con el tiempo, también sin conexión. Energía y desgaste se descuentan al terminar; revisa la herramienta antes de salir.',symbol:'energy',target:'tools',label:'Consultar durabilidad'},
 ]:[
  {title:'Compra y usa un pergamino de receta',copy:'Habla con el maestro, consulta su catálogo y confirma el precio. Recibirás un pergamino consumible: úsalo desde la mochila para aprender la receta. Los excepcionales son botín muy raro.',symbol:'recipes',target:'recipes',label:'Consultar las recetas'},
  {title:'Prepara los materiales',copy:'La ficha indica qué necesitas, cuánto tienes y qué te falta. Los materiales se reservan al encargar o fabricar.',symbol:'bag',target:'recipes',label:'Consultar materiales'},
  {title:timed?'Encarga la pieza en el banco':'Fabrica en la estación',copy:timed?'Acércate al banco de este oficio y encarga la cantidad que necesites. Hay cinco puestos: uno activo y cuatro pendientes.':'Acércate a la estación con una receta aprendida y todos sus ingredientes. Las pociones y la comida actuales se fabrican al momento.',symbol:selected,target:'recipes',label:timed?'Abrir recetas del taller':'Ver qué puedo fabricar'},
  ...(timed?[{title:'Recoge el resultado',copy:'El trabajo continúa cuando te marchas o te desconectas. Recoge las piezas terminadas desde cualquier estación del mismo oficio.',symbol:'jobs',target:'jobs',label:'Ver mis trabajos'}]:[]),
 ];
 const sequence=el('ol','profession-guide-steps');sequence.setAttribute('aria-label',t('Primeros pasos del oficio'));
 steps.forEach((step,index)=>{const card=el('li','profession-guide-step'),title=el('div','profession-guide-step-title');title.append(el('span','profession-guide-step-number',String(index+1)),el('h4','',step.title));
  const next=button(step.label,()=>go(step.target),false,'profession-button subtle');next.dataset.professionControl=`guide-step-${index}`;next.append(icon('arrow'));
  card.append(title,el('p','',step.copy),next);sequence.append(card);
 });page.append(sequence,heading('Dónde se hace cada cosa','El maestro te orienta, el banco sirve para trabajar y el campo aporta los recursos.','pin'),places);
 const visit=el('section',`profession-guide-visit${workplace.near?' available':''}`),copy=el('div');
 copy.append(el('strong','',workplace.near?'Estás junto a una estación del oficio':'Encuentra tu taller en Brumaluz'),el('p','',workplace.near?'Puedes usar los apartados del libro y trabajar desde este banco.':isGather?'Visita al maestro para conocer el oficio. Para recolectar, sal después a Pompelín con tu herramienta.':'Puedes consultar el libro desde cualquier lugar. Aprende las recetas usando sus pergaminos desde la mochila. Para fabricar o gestionar trabajos, acércate al banco del oficio.'));
 const mastery=button('Ver mi progreso',()=>go('mastery'),false,'profession-button');mastery.dataset.professionControl='guide-progress';visit.append(icon(workplace.near?'check':'pin'),copy,mastery);page.append(visit);
 const door=d.location==='brumaluz'?play.city.portals.find(portal=>portal.target?.map===RPG_CATALOG.stations[selected]?.location):undefined;
 if(door){const locate=button('Localizar taller',()=>{personalWaypoints.set(d.location,{x:door.position.x,z:door.position.z});setWindow('map');},false,'profession-button');locate.dataset.professionControl='locate-workshop';locate.append(icon('pin'));visit.append(locate);}
 if(isGather){const tool=state.tools[selected],status=el('p','profession-guide-tool-status');status.append(icon('tools'),el('span','',tool?t('Herramienta equipada: {tool}',{tool:t(itemLabel(tool.id))}):'Todavía no tienes una herramienta equipada para este oficio.'));page.append(status);}
}

function renderRecipeBook(page:HTMLElement,d:CharData,state:RpgState,rank:number,near:boolean,redraw:()=>void){
 const all=Object.values(RPG_CATALOG.recipes).filter(recipe=>recipe.job===selected).sort((a,b)=>a.tier-b.tier||a.label.localeCompare(b.label));
 const toolbar=el('div','profession-toolbar'),search=el('label','profession-search');search.append(icon('search'));const input=el('input');input.type='search';input.placeholder=t('Buscar receta');input.value=filter;input.dataset.professionControl='search';input.setAttribute('aria-label',t('Buscar receta'));input.oninput=()=>{filter=input.value;redraw();};search.append(input);toolbar.append(search);
 const select=(values:[string,string][],value:string,id:string,onChange:(value:string)=>void)=>{const node=el('select');node.dataset.professionControl=id;node.setAttribute('aria-label',t(id==='quality'?'Calidad de receta':'Recetas conocidas'));for(const[key,label]of values){const option=el('option','',label);option.value=key;node.append(option);}node.value=value;node.onchange=()=>{onChange(node.value);redraw();};return node;};
 toolbar.append(select([['all','Todas las calidades'],...Object.values(ITEM_RARITIES).map((rarity,index)=>[String(index),rarity.label] as [string,string])],quality,'quality',value=>{quality=value;}),select([['all','Todas las recetas'],['known','Aprendidas'],['learn','Por aprender']],knowledge,'knowledge',value=>{knowledge=value;}));page.append(toolbar);
 const recipes=all.filter(recipe=>(quality==='all'||recipe.tier===Number(quality))&&(knowledge==='all'||state.learned.includes(recipe.id)===(knowledge==='known'))&&recipe.label.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
 if(!recipes.some(recipe=>recipe.id===recipeId))recipeId=recipes[0]?.id??'';
 const book=el('div','profession-recipe-book'),list=el('div','profession-recipe-list');list.dataset.professionScroll=`recipes-${selected}`;list.setAttribute('aria-label',t('Lista de recetas'));
 const countLine=el('div','profession-list-heading');countLine.append(el('b','',`${recipes.length} recetas`),el('small','',`${all.filter(recipe=>state.learned.includes(recipe.id)).length} aprendidas`));list.append(countLine);
 for(const recipe of recipes){const known=state.learned.includes(recipe.id),b=button('',()=>{recipeId=recipe.id;amount=1;redraw();},false,'profession-recipe-row');b.dataset.professionControl=`recipe-${recipe.id}`;b.classList.toggle('selected',recipe.id===recipeId);b.setAttribute('aria-pressed',String(recipe.id===recipeId));b.style.setProperty('--rarity',ITEM_RARITIES[rarityForTier(recipe.tier)].ink);const copy=el('span');copy.append(el('b','',recipe.label),el('small','',`${RPG_CATALOG.ranks[recipe.tier]} · ${professionTime(recipe.seconds*(d.race==='humano'?.85:1))}`));const status=icon(rank<recipe.tier?'lock':known?'check':'recipes','profession-recipe-state');status.title=t(rank<recipe.tier?'Rango insuficiente':known?'Receta aprendida':'Receta por aprender');b.append(art(recipe.output),copy,status);list.append(b);}
 if(!recipes.length)list.append(empty('Sin coincidencias','Prueba con otro nombre o cambia los filtros.','search'));book.append(list);
 const recipe=RPG_CATALOG.recipes[recipeId],detail=el('section','profession-recipe-detail');detail.dataset.professionScroll=`detail-${selected}`;
 if(recipe)renderRecipeDetail(detail,d,state,recipe,rank,near,redraw);else detail.append(empty('Tu libro de recetas','Selecciona una receta para consultar sus materiales y aprender a fabricarla.'));
 book.append(detail);page.append(book);
}
function renderRecipeDetail(container:HTMLElement,d:CharData,state:RpgState,recipe:Recipe,rank:number,near:boolean,redraw:()=>void){
 const detail=el('div','profession-recipe-reading');detail.dataset.professionScroll=container.dataset.professionScroll;delete container.dataset.professionScroll;container.append(detail);
 const known=state.learned.includes(recipe.id),rarity=ITEM_RARITIES[rarityForTier(recipe.tier)],definition=itemDef(recipe.output),jobs=state.jobs.filter(task=>task.job===selected&&!task.done&&task.end>Date.now()/1000),capacity=Math.max(0,5-jobs.length),max=recipe.seconds?Math.max(1,capacity):99;amount=known?Math.min(max,Math.max(1,amount)):1;
 detail.style.setProperty('--rarity',rarity.ink);
 const hero=el('div','profession-recipe-hero'),copy=el('div');copy.append(chip(rarity.label,'rarity'),el('h3','',recipe.label),el('p','',definition?.category??RPG_CATALOG.professions[selected]));hero.append(art(recipe.output,'profession-result-art'),copy);detail.append(hero);
 const flow=el('div','profession-craft-flow');for(const[symbol,label]of [['bag','Materiales'],[selected,'Fabricación'],['check','Resultado']]){if(flow.children.length)flow.append(el('i','','→'));const step=el('span');step.append(icon(symbol),el('span','',label));flow.append(step);}detail.append(flow);
 if(definition?.description)detail.append(el('p','profession-description',definition.description));
 const stats=el('dl','profession-recipe-facts');for(const[label,value]of [['Dominio',RPG_CATALOG.ranks[recipe.tier]],['Fabricación',professionTime(recipe.seconds*(d.race==='humano'?.85:1))],['Experiencia',`${recipeExperience(rank,recipe)} EXP`],['Resultado',`${recipe.count} ${recipe.count===1?'unidad':'unidades'}`]])stats.append(el('dt','',label),el('dd','',value));detail.append(stats);
 const sampleStats=(definition?.stats??[]).filter(stat=>!['Rareza','Categoría de equipo'].includes(stat.label));if(sampleStats.length){const specs=el('div','profession-item-stats');for(const stat of sampleStats)specs.append(chip(`${stat.label}: ${stat.value}`));detail.append(specs);}
 const materialHead=el('div','profession-materials-heading');materialHead.append(el('h4','','Materiales'),el('small','',`Para ${amount} ${amount===1?'fabricación':'fabricaciones'}`));detail.append(materialHead);
 const materials=el('div','profession-materials');let enough=true;for(const[id,required]of Object.entries(recipe.ingredients)){materials.append(itemMaterial(d,id,required*amount));if(count(d,id)<required*amount)enough=false;}detail.append(materials);
 const possible=Math.min(...Object.entries(recipe.ingredients).map(([id,required])=>Math.floor(count(d,id)/required)));detail.append(el('p','profession-materials-capacity',t('Materiales para {n} fabricaciones',{n:Number.isFinite(possible)?possible:0})));
 const controls=el('div','profession-craft-controls'),quantity=el('div','profession-quantity');
 quantity.append(button('−',()=>{amount=Math.max(1,amount-1);redraw();},amount<=1));const input=el('input');input.type='number';input.min='1';input.max=String(max);input.value=String(amount);input.dataset.professionControl='quantity';input.setAttribute('aria-label',t('Cantidad de fabricaciones'));input.onchange=()=>{amount=Math.max(1,Math.min(max,Math.floor(Number(input.value)||1)));redraw();};quantity.append(input,button('+',()=>{amount=Math.min(max,amount+1);redraw();},amount>=max));if(known)controls.append(quantity);
 const reason=!known?recipe.source==='drop'?`Receta excepcional: botín muy raro de criaturas de nivel 26 o superior. Usa su pergamino desde la mochila para aprenderla; no se vende por Pelines.`:`Compra esta receta hablando con el maestro de ${RPG_CATALOG.professions[recipe.job]}. Precio: ${number(recipe.price)} Pelines. Usa el pergamino desde la mochila para aprenderla. Necesitas el rango ${RPG_CATALOG.ranks[recipe.tier]}.`:!near?'Acércate a una estación de este oficio.':rank<recipe.tier?`Necesitas el rango ${RPG_CATALOG.ranks[recipe.tier]}.`:recipe.seconds&&capacity<amount?'La cola está llena. Recoge o cancela trabajos.':!enough?'Te faltan los materiales señalados.':recipe.seconds?`Usarás ${amount} de los ${capacity} puestos disponibles. Puedes alejarte del taller.`:'Fabricación instantánea. No ocupa puestos de trabajo.';
 const label=recipe.seconds?`Encargar ${amount===1?'pieza':`${amount} piezas`}`:`Fabricar ${amount}`;
 if(known)controls.append(button(label,action('craft',{id:recipe.id,count:amount}),!near||rank<recipe.tier||!enough||!!recipe.seconds&&capacity<amount,'profession-button primary'));const checkout=el('div','profession-recipe-checkout');checkout.append(controls,el('p',`profession-craft-note${near&&enough?'':' caution'}`,reason));container.append(checkout);
}
function renderMastery(parent:HTMLElement,d:CharData,state:RpgState,near:boolean){
 const rank=professionRank(state,selected),earned=state.xp[selected]??0,ladder=el('ol','profession-rank-ladder');
 for(const[label,index]of RPG_CATALOG.ranks.map((label,index)=>[label,index] as const)){const row=el('li',index<rank?'complete':index===rank?'current':'');row.append(icon(index<rank?'check':index===rank?'star':'lock'),el('b','',label),el('small','',index===0?'Inicio':`${number(RANK_XP[index])} EXP${index>=3?' + proyecto':''}`));ladder.append(row);}parent.append(ladder);
 if(rank<2)parent.append(el('p','profession-guidance',`Tu siguiente rango es ${RPG_CATALOG.ranks[rank+1]}. Consigue ${number(Math.max(0,RANK_XP[rank+1]-earned))} EXP más ${gathering.includes(selected)?'recolectando':'fabricando'} con este oficio. Los dos primeros ascensos son automáticos.`));
 const next=(state.mastery[selected]??0)+1;if(next>3){parent.append(empty('Gran maestro','Has completado todos los proyectos de este oficio.','star'));return;}
 const xp=RANK_XP[next+2],practices=next*50,mat=['minero','herreria','joyeria'].includes(selected)?'minero':['lenador','carpinteria','ebanisteria'].includes(selected)?'lenador':'recolector',requirements:{id:string;count:number}[]=[{id:`material_${mat}_0`,count:next*20},{id:`material_${mat}_${next+1}`,count:next*10}];
 const box=el('div','profession-mastery-body');box.append(el('h4','',`Ascender a ${RPG_CATALOG.ranks[next+2]}`),el('p','',`${number(state.xp[selected]??0)} / ${number(xp)} EXP · ${state.crafts[selected]??0} / ${practices} prácticas`));for(const requirement of requirements)box.append(itemMaterial(d,requirement.id,requirement.count));
 const ready=near&&(state.xp[selected]??0)>=xp&&(state.crafts[selected]??0)>=practices&&requirements.every(requirement=>count(d,requirement.id)>=requirement.count);box.append(button('Completar proyecto',action('mastery',{job:selected}),!ready),el('p','profession-craft-note',!near?'El proyecto se entrega en un banco del oficio; los recolectores usan Herrería.':ready?'Requisitos completos. Puedes ascender.':'Completa la experiencia, las prácticas y los materiales indicados.'));if(rank<2){const future=el('details','profession-mastery');future.dataset.professionSection=`future-${selected}`;future.append(el('summary','','Más adelante: proyecto de Experto'),box);parent.append(future);}else parent.append(box);
}
function renderFieldGuide(page:HTMLElement,d:CharData,state:RpgState,rank:number,_near:boolean,redraw:()=>void){
 page.classList.add('profession-field-page');
 page.append(heading('Cuaderno de campo','Reconoce cada recurso por su forma. Encuentra los disponibles y prepara tu herramienta antes de salir.','recolector'));
 const tool=state.tools[selected],notice=el('div',`profession-field-tool${tool?'':' missing'}`);
 notice.append(tool?art(tool.id):icon(selected),el('div','',tool?`${itemLabel(tool.id)} · ${number(tool.durability??0)} / ${number(tool.maxDurability??100)} de durabilidad`:'Necesitas equipar una herramienta para recolectar.'),button('Ver herramientas',()=>{tab='tools';redraw();}));page.append(notice);
 const grid=el('div','profession-field-grid'),now=Date.now()/1000;
 for(let tier=0;tier<6;tier++){
  const nodes=Object.values(RPG_CATALOG.nodes).filter(node=>node.job===selected&&node.tier===tier),items=[...new Set(nodes.map(node=>node.item!))],cost=gatherEnergy(rank,tier),card=el('article','profession-field-card');
  card.classList.toggle('unaffordable',cost>gatheringEnergy(state));card.style.setProperty('--rarity',ITEM_RARITIES[rarityForTier(tier)].ink);
  const header=el('header','profession-field-rank');header.append(chip(RPG_CATALOG.ranks[tier],'rarity'),el('strong','',t('{energy} energía',{energy:number(cost)})));
  card.append(header,el('small','profession-field-facts',`${nodes[0]?.seconds??4} s · ${professionExperience(rank,tier)} EXP`));
  for(const id of items){
   const family=resourceFamily(id)!,sites=nodes.filter(node=>node.item===id),available=sites.filter(node=>(state.nodes[node.id]??0)<=now);
   const closest=available.filter(node=>node.location===d.location).sort((a,b)=>Math.hypot(a.x-holder.position.x,a.z-holder.position.z)-Math.hypot(b.x-holder.position.x,b.z-holder.position.z))[0];
   const row=el('div','profession-field-resource'),copy=el('div','profession-field-resource-copy');
   copy.append(el('b','',itemLabel(id)),el('small','',t(RESOURCE_FAMILIES[family].label)+' · '+t('{n} en la mochila',{n:count(d,id)})));
   const availability=el('span','profession-field-availability',t('{available} / {total} disponibles',{available:available.length,total:sites.length}));copy.append(availability);
   const locate=button('',()=>{if(closest){personalWaypoints.set(d.location,{x:closest.x,z:closest.z});setWindow('map');}},!closest,'profession-field-locate');
   locate.dataset.professionControl=`locate-${id}`;
   locate.append(icon('pin'),el('span','',closest?t('{n} m',{n:Math.ceil(Math.hypot(closest.x-holder.position.x,closest.z-holder.position.z))}):'Pompelín'));
   locate.setAttribute('aria-label',t('Localizar {resource}',{resource:t(itemLabel(id))}));locate.title=t(closest?'Marcar el recurso disponible más cercano':'Disponible al explorar Pompelín');
   row.append(art(id),copy,locate);card.append(row);
  }
  if(cost>100)card.append(el('small','profession-craft-note caution','Supera tu reserva máxima de energía.'));
  else if(cost>gatheringEnergy(state))card.append(el('small','profession-craft-note caution','Deja que se recupere tu energía.'));
  grid.append(card);
 }
 page.append(grid);
}
function renderJobs(page:HTMLElement,_d:CharData,state:RpgState,near:boolean,now:number){
 const tasks=state.jobs.filter(task=>task.job===selected),unfinished=tasks.filter(task=>!task.done&&task.end>now).sort((a,b)=>a.start-b.start),finished=tasks.filter(task=>task.done||task.end<=now);
 const active=unfinished.filter(task=>task.start<=now),pending=unfinished.filter(task=>task.start>now);
 page.append(heading('Tu taller en marcha','Un trabajo activo y cuatro pendientes. Los resultados terminados te esperan sin ocupar la cola.','jobs'));
 const overview=el('div','profession-work-overview');
 for(const[label,value,symbol]of [['En fabricación',active.length,'herreria'],['En cola',pending.length,'clock'],['Para recoger',finished.length,'bag']] as const){const stat=el('div');stat.append(icon(symbol),el('strong','',String(value)),el('span','',label));overview.append(stat);}page.append(overview);
 const slots=el('ol','profession-queue-slots');slots.setAttribute('aria-label',t('Cola de fabricación'));
 for(let i=0;i<5;i++){
  const task=unfinished[i],working=!!task&&task.start<=now,slot=el('li',`profession-queue-slot${task?working?' active':' occupied':''}`);
  const index=el('span','profession-queue-index',String(i+1));slot.append(index,task?art(task.output.id):icon('jobs'),el('small','',task?working?'Activo':'En cola':'Libre'));
  if(task)slot.title=t(itemLabel(task.output.id));slots.append(slot);
 }page.append(slots);
 const orders=el('div','profession-orders');
 for(const task of [...finished,...unfinished]){
  const done=task.done||task.end<=now,working=task.start<=now&&!done,card=el('article',`profession-order ${done?'ready':working?'active':'pending'}`),copy=el('div','profession-order-copy');
  const label=el('div','profession-order-heading');label.append(el('strong','',itemLabel(task.output.id)),chip(done?'Terminado':working?'En fabricación':'En cola',done?'success':''));copy.append(label);
  const timer=el('b','profession-order-time',done?'Listo para recoger':working?t('Termina en {time}',{time:professionTime(task.end-now)}):t('Empieza en {time}',{time:professionTime(task.start-now)}));
  if(!done){timer.dataset.professionEnd=String(task.end);timer.dataset.professionStart=String(task.start);}copy.append(timer);
  const progress=el('progress');progress.max=1;progress.value=done?1:Math.max(0,Math.min(1,(now-task.start)/(task.end-task.start)));progress.setAttribute('aria-label',t('Progreso de fabricación'));copy.append(progress);
  const meta=el('small','profession-order-meta');meta.textContent=t('{count} unidad · {xp} EXP',{count:task.output.count,xp:task.xp});copy.append(meta);
  const controls=el('div','profession-order-actions');
  if(done)controls.append(button('Recoger',action('collect',{id:task.id}),!near,'profession-button primary'));
  else{if(!working)controls.append(button('Priorizar',action('reorder',{id:task.id}),!near));controls.append(button('Cancelar',action('cancel',{id:task.id}),!near,'profession-button subtle'));}
  card.append(art(task.output.id,'profession-item-art',task.output),copy,controls);orders.append(card);
 }page.append(orders);
 if(!tasks.length)page.append(empty('El taller está en silencio','Escoge una receta aprendida y encarga tu primera pieza.','jobs'));
 if(!near&&tasks.length)page.append(el('p','profession-craft-note','Puedes consultar tus trabajos desde cualquier lugar. Acércate a una estación del oficio para recoger o gestionar la cola.'));
}
function renderDeliveries(page:HTMLElement,state:RpgState){page.append(heading('Tus entregas','Materiales devueltos y objetos pendientes. Recógelos cuando tengas espacio en la mochila.','deliveries'));if(!state.deliveries.length)page.append(empty('Todo recogido','Aquí aparecerán las devoluciones y objetos pendientes de recoger.','bag'));for(const[slot,item]of state.deliveries.entries()){const row=el('article','profession-delivery');row.append(art(item.id,'profession-item-art',item),el('strong','',`${itemLabel(item.id)} × ${item.count}`),button('Recoger',action('delivery',{slot})));page.append(row);}}
function renderTools(page:HTMLElement,d:CharData,state:RpgState,_redraw:()=>void){
 const toolJobs=view==='profession'&&gathering.includes(selected)?[selected]:gathering,smith=station(d,state,'herreria').near;if(!smith)page.append(el('p','profession-guidance','Para comprar, reparar o restaurar herramientas necesitas un banco de Herrería cercano. Puedes equipar las de tu mochila desde aquí.'));page.append(heading('Herramientas de viaje','Se usan automáticamente al recolectar. Repara en Herrería para conservarlas; la restauración recupera también el máximo original.','tools'));
 const grid=el('div',"profession-tools-grid"+(toolJobs.length===1?' single':''));for(const job of toolJobs){const tool=state.tools[job],card=el('article','profession-tool-card');card.append(icon(job,'profession-tool-emblem'),el('h3','',RPG_CATALOG.professions[job]));if(tool){const current=tool.durability??100,max=tool.maxDurability??100,original=tool.originalDurability??100,tier=RPG_CATALOG.items[tool.id]?.tier??0,fraction=Math.max(0,1-current/max),loss=original*.05*(1-professionRank(state,job)*.03)*(1-tier*.04)*fraction,repairCost=Math.ceil((10+10*tier)*fraction),restoreCost=5+tier*2;card.append(art(tool.id,'profession-tool-art',tool),el('strong','',itemLabel(tool.id)),chip(current>0?'Equipada':'Necesita reparación',current>0?'success':'warning'));const durability=el('div','profession-durability');durability.style.setProperty('--durability',`${current/original*100}%`);durability.style.setProperty('--capacity',`${max/original*100}%`);durability.append(el('i'),el('b'));durability.setAttribute('aria-label',t(`Durabilidad ${number(current)} de ${number(max)}`));card.append(durability,el('p','',`${number(current)} / ${number(max)} · original ${number(original)}`));const controls=el('div','profession-tool-actions');controls.append(button(`Reparar · ${repairCost} Pelines`,action('repair',{job}),!smith||fraction===0||max-loss<original*.2||d.wallet.pelines<repairCost));if(max-loss<original*.2)card.append(el('small','profession-craft-note caution','El máximo está al límite. Necesita una restauración.'));controls.append(button('Usar núcleo de restauración',action('restore_item',{job}),!smith||count(d,'nucleo_restauracion')===0||current===original&&max===original));const premium=button(`Restaurar · ${restoreCost} Lágrimas`,async()=>{if(confirm(t(`¿Restaurar esta herramienta por ${restoreCost} Lágrimas de fénix?`)))await performProfession('restore',{job});},!smith||d.wallet.lagrimas<restoreCost||current===original&&max===original,'profession-button subtle');controls.append(premium);card.append(controls);}else card.append(empty('Sin herramienta','Compra una básica al herrero o equipa una de tu mochila.',job));card.append(button('Comprar básica · 20 Pelines',action('buy_tool',{job}),!smith||d.wallet.pelines<20,'profession-button subtle'));grid.append(card);}page.append(grid);
 const bag=d.inventory.map((item,slot)=>({item,slot})).filter(entry=>entry.item&&toolJobs.includes(RPG_CATALOG.items[entry.item.id]?.tool??''));if(bag.length){page.append(heading('En tu mochila','Equipar una herramienta sustituye la de su mismo oficio.','bag'));for(const{item,slot}of bag){const row=el('article','profession-delivery');row.append(art(item!.id,'profession-item-art',item!),el('strong','',itemLabel(item!.id)),button('Equipar',action('tool',{slot})));page.append(row);}}
 const refill=el('details','profession-energy-options');refill.dataset.professionSection='energy';refill.append(el('summary','','Opciones de recuperación de energía'),el('p','','La energía se recupera con el tiempo, también sin conexión. Una reserva vacía tarda 4 h 36 min.'));refill.append(button('Recargar · 5 Lágrimas',async()=>{if(confirm(t('¿Recargar la energía hasta 100 por 5 Lágrimas de fénix?')))await performProfession('energy');},gatheringEnergy(state)>=100||d.wallet.lagrimas<5,'profession-button subtle'));page.append(refill);
}
function renderEnchants(page:HTMLElement,d:CharData,redraw:()=>void){
 page.append(heading('Un arma, un encantamiento','Elige un arma principal y un pergamino. Aplicarlo consume el pergamino y sustituye su efecto anterior.','enchants'));
 const selector=el('select','profession-weapon-select');selector.dataset.professionControl='weapon';selector.setAttribute('aria-label',t('Arma que quieres encantar'));const equipped=el('option','','Arma principal equipada');equipped.value='-1';selector.append(equipped);d.inventory.forEach((item,slot)=>{if(item&&RPG_CATALOG.equipment[item.id]?.slot==='weapon'){const option=el('option','',`Mochila · ${itemLabel(item.id)}`);option.value=String(slot);selector.append(option);}});selector.value=String(weaponTarget);if(selector.selectedIndex<0){weaponTarget=-1;selector.value='-1';}selector.onchange=()=>{weaponTarget=Number(selector.value);redraw();};page.append(selector);
 const weapon=weaponTarget>=0?d.inventory[weaponTarget]:d.equipment.weapon,preview=el('div','profession-enchant-weapon');if(weapon){preview.append(art(weapon.id,'profession-result-art',weapon),el('div'));preview.lastElementChild!.append(el('h3','',itemLabel(weapon.id)),el('p','',weapon.enchantment?`${ENCHANT_LABELS[weapon.enchantment.id]} · ${enchantmentDescription(weapon.enchantment.id,weapon.enchantment.grade)}`:'Sin encantamiento. Admite uno desde calidad verde.'));}else preview.append(empty('Selecciona un arma principal','Los escudos, libros y armas secundarias no admiten encantamientos.','enchants'));page.append(preview);
 const scrolls=d.inventory.map((item,slot)=>({item,slot,meta:item&&RPG_CATALOG.items[item.id]})).filter(entry=>entry.item&&entry.meta?.enchant);if(!scrolls.length){page.append(empty('No tienes pergaminos','Puedes fabricarlos con Encantamiento o comprarlos a otros artesanos.','enchants'));return;}
 const grid=el('div','profession-enchants-grid');for(const{item,slot,meta}of scrolls){const card=el('article','profession-enchant-card'),id=meta!.enchant as NonNullable<ItemStack['enchantment']>['id'],valid=!!weapon&&RPG_CATALOG.equipment[weapon.id]?.tier>=meta!.tier;card.append(art(item!.id),el('strong','',itemLabel(item!.id)),el('p','',enchantmentDescription(id,meta!.tier)),button(valid?'Aplicar encantamiento':'Requiere un arma de calidad suficiente',async()=>{if(!weapon?.enchantment||confirm(t('¿Sustituir el encantamiento anterior?')))await performProfession('enchant',{slot,...(weaponTarget>=0?{target:weaponTarget}:{})});},!valid,'profession-button primary'));grid.append(card);}page.append(grid);
}
function renderFurniture(page:HTMLElement,d:CharData,state:RpgState,redraw:()=>void){
 page.append(heading('Un rincón propio','Coloca tus muebles en la casa de Isberto. Los bancos de trabajo permiten usar oficios desde casa.','furniture'));
 const placeable=d.location==='casa_de_isberto_interior'&&d.shadowQuest==='returned',jobSelect=el('select','profession-weapon-select');jobSelect.dataset.professionControl='furniture-job';jobSelect.setAttribute('aria-label',t('Oficio del banco de trabajo'));for(const[job,label]of Object.entries(RPG_CATALOG.professions).filter(([job])=>!gathering.includes(job))){const option=el('option','',label);option.value=job;jobSelect.append(option);}jobSelect.value=furnitureJob||(gathering.includes(selected)?'herreria':selected);jobSelect.onchange=()=>{furnitureJob=jobSelect.value;};page.append(el('label','','Oficio de los nuevos bancos de trabajo'),jobSelect,el('p','profession-craft-note',placeable?'Se colocan delante del personaje. Deja libre el espacio de paso.':'Entra en la casa habilitada de Isberto para colocar muebles.'));
 const grid=el('div','profession-furniture-grid');d.inventory.forEach((item,slot)=>{if(!item||!RPG_CATALOG.items[item.id]?.furniture)return;const card=el('article','profession-furniture-card');card.append(art(item.id,'profession-result-art',item),el('strong','',itemLabel(item.id)),button('Colocar',()=>performProfession('place',{slot,job:jobSelect.value,yaw:holder.rotation.y}),!placeable,'profession-button primary'));grid.append(card);});if(!grid.childElementCount)grid.append(empty('Sin muebles en la mochila','Ebanistería fabrica muebles y bancos de trabajo para tu hogar.','furniture'));page.append(grid);
 if(!d.inventory.some(item=>item&&RPG_CATALOG.items[item.id]?.furniture==='estacion')){jobSelect.previousElementSibling?.remove();jobSelect.remove();}
 page.append(button('Ver recetas de Ebanistería',()=>{selected='ebanisteria';view='profession';tab='recipes';recipeId='';filter='';redraw();},false,'profession-button subtle'));
 if(state.furniture.length){page.append(heading('Muebles colocados',`${state.furniture.length} / 30 espacios ocupados`,'furniture'));for(const piece of state.furniture){const row=el('article','profession-delivery'),near=piece.location===d.location&&Math.hypot(piece.x-holder.position.x,piece.z-holder.position.z)<=4;row.append(art(piece.item.id),el('strong','',itemLabel(piece.item.id)),button('Recoger',action('pickup',{id:piece.id}),!near));page.append(row);}}
}

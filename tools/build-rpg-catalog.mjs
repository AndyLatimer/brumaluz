import fs from 'node:fs';
import { createServer } from 'vite';
import { professionItemIcon } from './rpg-icon-art.mjs';
const server=await createServer({configFile:false,logLevel:'error',server:{middlewareMode:true}});
let equipment,items,sets;
try { ({EQUIPPABLE:equipment}=await server.ssrLoadModule('/src/data/equipment.ts')); ({ITEMS:items}=await server.ssrLoadModule('/src/data/items.ts')); ({armorSet:sets}=await server.ssrLoadModule('/src/data/sets.ts')); } finally {await server.close();}
const names=['Aprendiz','Iniciado','Oficial','Experto','Maestro','Gran maestro'];
const rarities=['common','uncommon','rare','epic','legendary','artifact'];
const professions={herreria:'Herrería',peleteria:'Peletería',sastreria:'Sastrería',carpinteria:'Carpintería',ebanisteria:'Ebanistería',joyeria:'Joyería',alquimia:'Alquimia',encantamiento:'Encantamiento',cocina:'Cocina',minero:'Minero',lenador:'Leñador',recolector:'Recolector'};
const catalog={professions,ranks:names,items:{},recipes:{},nodes:{},stations:{},sets:{},equipment};
catalog.teachers={};
const recipePrices=[50,250,1250,6250,25000,0];
catalog.rareRecipeDrop={tier:5,chance:.005,minEnemyLevel:26};
catalog.dailyOrders=JSON.parse(fs.readFileSync('src/data/dailyOrders.json','utf8'));
catalog.professionTutorial=JSON.parse(fs.readFileSync('src/data/professionTutorial.json','utf8'));
const previous=process.argv.includes('--preserve-placements')&&fs.existsSync('src/data/generated/rpg-catalog.json')
 ?JSON.parse(fs.readFileSync('src/data/generated/rpg-catalog.json','utf8')):null;
const mats={minero:['Cobre','Hierro','Acero lunar','Mitril','Oro solar','Mineral de fénix'],lenador:['Roble','Fresno','Abedul plateado','Madera umbría','Cedro áureo','Madera ancestral'],recolector:['Hierbas silvestres','Hierbas de rocío','Flor azul','Flores nocturnas','Hierba solar','Flor estelar']};
const icon='<path d="M5 6 12 2l7 5 2 10-9 5-9-6Z" fill="#9fae86" stroke="#4c6346"/><path d="m5 6 7 5 7-4m-7 4v11" fill="none" stroke="#dce7bc"/>';
// Gathering belongs to the continent, while production stations remain in cities.
const gatheringRegions=[[-20,-35],[120,-180],[-250,180],[470,-230],[620,350],[80,-500]];
function resourcePosition(job,tier,index){
 const [x,z]=gatheringRegions[tier],family=['minero','lenador','recolector'].indexOf(job);
 const angle=index*2.399963229728653+family*Math.PI*2/3,radius=20+Math.floor(index/3)*9;
 return {location:'pompelin',x:x+Math.cos(angle)*radius,z:z+Math.sin(angle)*radius};
}
for(const [job,list] of Object.entries(mats))for(let tier=0;tier<6;tier++){
 const id=`material_${job}_${tier}`;catalog.items[id]={id,label:list[tier],category:'Material de oficio',description:`Recurso de rango ${names[tier]}. Se utiliza también en recetas de rangos superiores.`,tier,rarity:rarities[tier],value:2*3**tier,stack:99,icon};
 for(let n=0;n<(job==='minero'?9:job==='lenador'?12:3);n++){const node=`${job}_${tier}_${n}`; catalog.nodes[node]={id:node,label:list[tier],job,tier,item:id,...resourcePosition(job,tier,n),seconds:4+tier,respawn:300+tier*180};}
}
for(const[kind,label]of Object.entries({fibra:'Fibra textil',fruta:'Fruta y bayas',hongo:'Hongos',grano:'Cereal',cuero:'Cuero curtible',gema:'Gema'}))for(let tier=0;tier<6;tier++){
 const id=`${kind}_${tier}`;catalog.items[id]={id,label:`${label} · ${names[tier]}`,category:'Material de oficio',description:kind==='cuero'?'Material obtenido como botín de criaturas. Utilizado por Peletería.':'Material comerciable obtenido mediante recolección.',tier,rarity:rarities[tier],value:2*3**tier,stack:99,icon};
 if(kind!=='cuero')for(let n=0;n<(kind==='gema'||kind==='fibra'?3:2);n++){const job=kind==='gema'?'minero':'recolector';const node=`${kind}_${tier}_${n}`,offset=kind==='gema'?9:kind==='fibra'?3:kind==='fruta'?6:kind==='hongo'?8:10;catalog.nodes[node]={id:node,label:catalog.items[id].label,job,tier,item:id,...resourcePosition(job,tier,offset+n),seconds:4+tier,respawn:300+tier*180};}
}
for(const [job,label] of Object.entries(professions))if(!mats[job])catalog.stations[job]={id:job,job,label:`Taller de ${label}`,location:'brumaluz',x:120+(Object.keys(professions).indexOf(job)%3)*6,z:-18-Math.floor(Object.keys(professions).indexOf(job)/3)*6,radius:4};
catalog.stations.reparacion={id:'reparacion',job:'herreria',label:'Herrero · reparaciones',location:'brumaluz',x:117,z:-18,radius:4};
if(fs.existsSync('src/data/workshops.json')){
 const {workshops}=JSON.parse(fs.readFileSync('src/data/workshops.json','utf8'));
 catalog.stations=Object.fromEntries(workshops.map(w=>[w.job,{id:w.job,job:w.job,label:w.name,location:w.mapId,...w.station}]));
 catalog.stations.reparacion={...catalog.stations.herreria,id:'reparacion',label:'Herrería · herramientas y reparaciones'};
 for(const w of workshops){
  const map=JSON.parse(fs.readFileSync(`src/data/world/maps/${w.mapId}.json`,'utf8'));
  const master=map.markers.find(marker=>marker.type==='npc'&&marker.npcId===w.masterId);
  if(!master)throw new Error(`Missing profession master ${w.masterId} in ${w.mapId}`);
  catalog.teachers[w.job]={id:w.masterId,label:`Maestro de ${w.label}`,job:w.job,location:w.mapId,x:master.position[0],z:master.position[2],radius:3};
 }
}
const toolNames={minero:'Pico',lenador:'Hacha de tala',recolector:'Hoz'};
for(const [job,label]of Object.entries(toolNames))for(let tier=0;tier<6;tier++){const id=`herramienta_${job}_${tier}`;catalog.items[id]={id,label:`${label} · ${names[tier]}`,category:'Herramienta',description:'Pierde durabilidad al completar extracciones. Se repara con Pelines y puede restaurarse con Lágrimas de fénix o un núcleo de restauración.',tier,tool:job,rarity:rarities[tier],value:20*3**tier,stack:1,icon};}
const enchantNames={fire:'Fuego',vampirism:'Vampirismo',frost:'Escarcha',lightning:'Rayo',dark:'Maldición umbría'};
for(const [effect,label]of Object.entries(enchantNames))for(let tier=1;tier<6;tier++){const id=`pergamino_${effect}_${tier}`;catalog.items[id]={id,label:`${label} · ${names[tier]}`,category:'Pergamino de encantamiento',description:'Aplicación garantizada al arma principal de esta calidad o superior. Consume el pergamino y sustituye el encantamiento anterior sin ligar el arma.',tier,enchant:effect,rarity:rarities[tier],value:50*3**tier,stack:20,icon};}
catalog.items.nucleo_restauracion={id:'nucleo_restauracion',label:'Núcleo de restauración',category:'Restauración',description:'Restaura la durabilidad actual y el máximo original de una herramienta. Muy raro.',tier:5,rarity:'artifact',value:5000,stack:10,icon};
const seconds=[30,120,1800,7200,86400,172800];
function recipe(id,job,tier,label){
 const mat=job==='herreria'||job==='joyeria'?'minero':job==='carpinteria'||job==='ebanisteria'?'lenador':'recolector';
 const ingredients={[`material_${mat}_0`]:2+tier,[`material_${mat}_${tier}`]:3+tier*2};
 if(tier>0)ingredients[`material_${mat}_0`]=4+tier*2;
 if(job==='peleteria'||job==='sastreria'||job==='encantamiento')ingredients[`material_minero_${Math.max(0,tier-1)}`]=2+tier;
 if(job==='peleteria'||job==='sastreria'||job==='joyeria'||job==='cocina'){
  delete ingredients[`material_${mat}_${tier}`];const kind=job==='peleteria'?'cuero':job==='sastreria'?'fibra':job==='joyeria'?'gema':'grano';ingredients[`${kind}_${tier}`]=3+tier*2;ingredients[`${kind}_0`]=(ingredients[`${kind}_0`]??0)+2+tier;
 }
 const duration=job==='alquimia'||job==='cocina'?0:job==='encantamiento'?seconds[tier]*2:seconds[tier];
 catalog.recipes[id]={id,job,tier,label:label??items[id]?.label??catalog.items[id]?.label??id,output:id,count:1,seconds:duration,ingredients,source:tier===0?'trainer':'discovery'};
}
for(const[id,meta]of Object.entries(equipment)){
 const armor=sets(id);if(armor)catalog.sets[id]={...armor,slot:meta.slot,cls:meta.cls};
 if(meta.tier===0 && meta.slot==='weapon')continue;
 const isArmor=['head','chest','hands','legs'].includes(meta.slot);
 const job=['ring','pendant','trinket'].includes(meta.slot)?'joyeria':isArmor?(meta.cls==='mago'||meta.cls==='clerigo'?'sastreria':meta.cls==='picaro'||meta.cls==='explorador'?'peleteria':'herreria'):['staff','wand','book','crossbow','shield'].includes(meta.kind)?'carpinteria':'herreria';
 recipe(id,job,meta.tier);
}
for(const[id,meta]of Object.entries(catalog.items))if(meta.tool)recipe(id,'herreria',meta.tier);else if(meta.enchant)recipe(id,'encantamiento',meta.tier);
for(const id of ['pocion_vida_minuscula','pocion_mana_minuscula','pocion_estamina_minuscula']){recipe(id,'alquimia',0);catalog.recipes[id].ingredients.fruta_0=1;}
recipe('pan_duro','cocina',0);
for(let tier=1;tier<6;tier++){
 for(const[kind,label]of Object.entries({health:'vida',mana:'maná',stamina:'estamina'})){
  const id=`pocion_${kind}_${tier}`;catalog.items[id]={id,label:`Poción de ${label} · ${names[tier]}`,category:'Consumible',description:`Brebaje de ${label}, elaborado por alquimistas.`,tier,rarity:rarities[tier],value:10*3**tier,stack:50,icon,usable:true,restore:{kind,percent:5+tier*5},effects:[`Restaura un ${5+tier*5} % de ${label}. Las pociones comparten 15 segundos de recuperación.`]};recipe(id,'alquimia',tier);catalog.recipes[id].ingredients[`fruta_${tier}`]=1;
 }
 const id=`comida_${tier}`;catalog.items[id]={id,label:`Provisión del caminante · ${names[tier]}`,category:'Comida',description:'Ración de cereal, fruta y hongos preparada para el camino.',tier,rarity:rarities[tier],value:8*3**tier,stack:50,icon,usable:true,food:id,foodEffect:{duration:900,maxHealth:5+tier*5,maxResource:3+tier*3},effects:[`+${5+tier*5} de vida máxima y +${3+tier*3} de recurso durante 15 minutos de conexión. No rellena las reservas.`]};recipe(id,'cocina',tier);catalog.recipes[id].ingredients[`fruta_${tier}`]=1;catalog.recipes[id].ingredients[`hongo_${tier}`]=1;
}
for(const [kind,label,size,complexity]of [['taburete','Taburete de taller',1,1],['mesa','Mesa de artesano',2,1.2],['biblioteca','Biblioteca tallada',3,1.8],['estacion','Banco de trabajo',2,1.5]])for(let tier=0;tier<6;tier++){
 const id=`mueble_${kind}_${tier}`;catalog.items[id]={id,label:`${label} · ${names[tier]}`,category:'Mueble',description:'Mueble colocable en un interior habilitado. Su fabricación depende de calidad, tamaño y complejidad.',tier,furniture:kind,rarity:rarities[tier],value:40*3**tier,stack:1,icon};
 recipe(id,'ebanisteria',tier);catalog.recipes[id].seconds=Math.round(seconds[tier]*(2+.5*(size-1)+.5*(complexity-1)));
}
// Every advanced recipe is a tradable discovery, not automatically granted by the trainer.
for(const job of Object.keys(professions).filter(job=>!mats[job])){
 const id=`componente_${job}_0`;catalog.items[id]={id,label:`Componente de ${professions[job]}`,category:'Componente de artesanía',description:'Componente básico utilizado también en recetas avanzadas del oficio.',tier:0,rarity:'common',value:6,stack:99,icon};recipe(id,job,0);
 for(const r of Object.values(catalog.recipes))if(r.job===job&&r.tier>0)r.ingredients[id]=1+Math.floor(r.tier/2);
}
// A slower alternative to hunting: four lower hides plus herbs make one higher hide.
// The master teaches processing at its own rank; equipment recipes remain discoveries.
for(let tier=1;tier<6;tier++){
 const id=`curtir_cuero_${tier}`;
 catalog.recipes[id]={id,job:'peleteria',tier,label:`Preparar cuero · ${names[tier]}`,output:`cuero_${tier}`,count:1,seconds:120*tier,ingredients:{[`cuero_${tier-1}`]:4,[`material_recolector_${tier}`]:2},source:'trainer',processing:true};
 catalog.items[`cuero_${tier}`].description='Botín de jabalíes de mayor dificultad en Pompelín. También se prepara en Peletería con cuatro cueros del rango anterior, hierbas del mismo rango y tiempo de taller.';
}
for(const recipe of Object.values(catalog.recipes)){
 recipe.source=recipe.tier===5?'drop':'trainer';recipe.price=recipe.tier===5?0:recipePrices[recipe.tier];
}
// Every recipe is a consumable scroll; exceptional scrolls remain loot only.
for(const r of Object.values(catalog.recipes)){const id=`receta_${r.id}`;catalog.items[id]={id,label:`Receta: ${r.label}`,category:'Receta',description:'Usa este pergamino desde la mochila para aprender la receta. Se consume al aprenderla y exige el rango del oficio indicado.',tier:r.tier,recipe:r.id,rarity:rarities[r.tier],value:20*3**r.tier,stack:1,icon};}
for(const item of Object.values(catalog.items)){
 const c=['#a5aeb2','#77ac73','#79abd4','#ac89ca','#d8bc65','#e29b58'][item.tier];
 if(item.enchant||item.recipe)item.icon=`<path d="M6 3h12v17H6Q3 20 3 17V5q0-2 3-2Z" fill="#d7c6a2" stroke="#655442"/><path d="M6 3v14H3m5-11h7m-7 3h5" stroke="#8e7858" fill="none"/><path d="m12 10 4 4-4 4-4-4Z" fill="${item.enchant?({fire:'#dc8055',vampirism:'#bb5472',frost:'#83c5d6',lightning:'#dcca69',dark:'#9272bd'})[item.enchant]:c}"/><path d="m12 11-1 3 2 1-1 2" stroke="#fff0cc" fill="none"/>`;
 else if(item.restore)item.icon=`<path d="M9 3h6v6l5 8-3 5H7l-3-5 5-8Z" fill="#d9e8e3" stroke="#5c5250"/><path d="M6 14h12l1 4-3 3H8l-3-3Z" fill="${item.restore.kind==='health'?'#c46564':item.restore.kind==='mana'?'#638ec4':'#8cba6b'}"/><path d="M8 3h8v3H8Z" fill="#b3905e"/><path d="M8 11 6 16" stroke="#fff1c6"/>`;
 else if(item.food)item.icon=`<path d="M3 10q9-11 18 0l-2 11H5Z" fill="#ccab76" stroke="#775a3c"/><path d="M6 11h12m-9-5 2 5m3-6 2 5" stroke="#f5da9c"/><path d="M4 16h16" stroke="${c}" stroke-width="3"/>`;
 else if(item.tool)item.icon=`<path d="m6 21 9-17" stroke="#674a33" stroke-width="3"/><path d="M7 5q8-5 13 3l-1 4-5-5-6 1Z" fill="${c}" stroke="#535963"/><path d="m11 6 7 1" stroke="#f4e6c9"/>`;
 else if(item.furniture)item.icon=`<path d="M3 9h18v4H3Zm2 4v8m14-8v8M6 9V4h12v5" fill="${c}" stroke="#6d5039" stroke-width="2"/><path d="M7 6h10" stroke="#f0d4a4"/>`;
 else if(item.id==='nucleo_restauracion')item.icon='<path d="m12 2 5 5 4 5-9 10-9-10 4-5Z" fill="#e1a265" stroke="#866347"/><path d="m12 5 4 7-4 7-4-7Z" fill="#fff0bd"/><path d="M5 5 2 3m17 2 3-2" stroke="#e8c382"/>';
 else if(item.id.startsWith('fruta'))item.icon=`<path d="M12 7c-9-6-12 11-3 14l3-1 3 1c9-3 6-20-3-14Z" fill="${c}" stroke="#5a6243"/><path d="M12 8V3m0 2q6-5 7 0-4 3-7 0" stroke="#638155" fill="#8caf68"/>`;
 else if(item.id.startsWith('cuero'))item.icon=`<path d="m7 3 5 3 5-3 4 6-4 3 3 9-8-2-8 2 3-9-4-3Z" fill="#b28b62" stroke="#6c4d36"/><path d="m8 8 4 2 4-2M9 17l3-1 3 1" stroke="${c}" fill="none"/>`;
 else item.icon=`<path d="M5 6 12 2l7 5 2 10-9 5-9-6Z" fill="${c}" stroke="#4d5c4b"/><path d="m5 6 7 5 7-4m-7 4v11" fill="none" stroke="#e0e8c8"/>`;
 item.icon=professionItemIcon(item)??item.icon;
 if(item.recipe||item.tool||item.enchant||item.furniture)item.usable=true;
 if(item.recipe){const r=catalog.recipes[item.recipe];item.stats=[{label:'Oficio',value:professions[r.job]},{label:'Dominio necesario',value:names[r.tier]}];}
 else if(item.tool)item.stats=[{label:'Oficio',value:professions[item.tool]},{label:'Menos desgaste por calidad',value:`${item.tier*4} %`}];
}
if(previous){
 for(const site of Object.values(catalog.nodes)){const old=previous.nodes?.[site.id];if(old?.job===site.job&&old.item===site.item)Object.assign(site,{x:old.x,z:old.z,location:old.location});}
 for(const site of Object.values(catalog.stations)){const old=previous.stations?.[site.id];if(old?.job===site.job&&old.location===site.location)Object.assign(site,{x:old.x,z:old.z,radius:old.radius});}
 if(previous.camp)catalog.camp=previous.camp;
}
fs.mkdirSync('src/data/generated',{recursive:true});fs.writeFileSync('src/data/generated/rpg-catalog.json',JSON.stringify(catalog));
const literal=JSON.stringify(catalog).replaceAll("'","''");
fs.writeFileSync('supabase/server/18-rpg-catalog.sql',`-- Generated by tools/build-rpg-catalog.mjs.\ncreate or replace function public.game_rpg_catalog() returns jsonb language sql immutable set search_path='' as $catalog$ select '${literal}'::jsonb $catalog$;\nrevoke all on function public.game_rpg_catalog() from public,anon,authenticated;\n`);
console.log(`RPG catalog: ${Object.keys(catalog.recipes).length} recipes, ${Object.keys(catalog.nodes).length} nodes, ${Object.keys(catalog.items).length} items.`);

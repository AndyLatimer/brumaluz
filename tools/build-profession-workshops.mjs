// Native editor documents for the twelve profession interiors.
// Importing this module is read-only. Run directly to prepare new drafts;
// existing drafts are preserved unless --replace-generated is explicitly given.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readLibraryCatalog} from './library-catalog.mjs';

const JOBS={herreria:'Herrería',peleteria:'Peletería',sastreria:'Sastrería',carpinteria:'Carpintería',ebanisteria:'Ebanistería',joyeria:'Joyería',alquimia:'Alquimia',encantamiento:'Encantamiento',cocina:'Cocina',minero:'Minería',lenador:'Leñadores',recolector:'Recolección'};
const P=Math.PI,STAMP='2026-10-26T12:00:00.000Z';
const STYLE={
 herreria:{color:'#b88859',banner:'red',floor:'floor_tile_large',columns:5,rows:4},
 peleteria:{color:'#a9875c',banner:'brown',floor:'floor_wood_large_dark',columns:5,rows:4},
 sastreria:{color:'#b1a3bc',banner:'white',floor:'floor_wood_large',columns:5,rows:4},
 carpinteria:{color:'#ac9265',banner:'brown',floor:'floor_wood_large',columns:6,rows:4},
 ebanisteria:{color:'#a18a62',banner:'yellow',floor:'floor_wood_large_dark',columns:6,rows:5},
 joyeria:{color:'#a7b4b4',banner:'blue',floor:'floor_tile_small_decorated',columns:5,rows:4},
 alquimia:{color:'#95ad8a',banner:'green',floor:'floor_tile_large',columns:5,rows:4},
 encantamiento:{color:'#a2a1ba',banner:'blue',floor:'floor_wood_large_dark',columns:5,rows:4},
 cocina:{color:'#c2a26b',banner:'yellow',floor:'floor_tile_large',columns:5,rows:4},
 minero:{color:'#a2acaa',banner:'brown',floor:'floor_tile_large',columns:5,rows:4},
 lenador:{color:'#a68d62',banner:'green',floor:'floor_wood_large',columns:5,rows:4},
 recolector:{color:'#9daf83',banner:'green',floor:'floor_wood_large',columns:5,rows:4},
};
const LABELS={herreria:'Forja de Brumaluz',peleteria:'Taller de Peletería',sastreria:'Taller de Sastrería',carpinteria:'Taller de Carpintería',ebanisteria:'Taller de Ebanistería',joyeria:'Taller de Joyería',alquimia:'Taller de Alquimia',encantamiento:'Taller de Encantamiento',cocina:'Cocina de Brumaluz',minero:'Taller de Minería',lenador:'Taller de Leñadores',recolector:'Taller de Recolección'};

export const workshopMetadata=Object.fromEntries(Object.entries(JOBS).map(([job,label])=>{
 const style=STYLE[job],halfDepth=style.rows*1.3,benchZ=-halfDepth+2.45;
 return [job,{job,label,name:LABELS[job],mapId:`taller_${job}_interior`,masterId:job==='herreria'?'isberto':`maestro_${job}`,
  master:{x:-1.85,z:benchZ+1.25,yaw:0},station:{x:.8,z:benchZ+1.55,radius:4},
  bench:{x:.8,z:benchZ},arrival:{id:'desde_brumaluz',x:0,z:halfDepth-2.3,yaw:P},
  exit:{id:`salida_taller_${job}`,x:0,z:halfDepth-1.0,radius:1.3,target:{map:'brumaluz',arrival:`desde_taller_${job}`}},
  bounds:{width:style.columns*2.6,depth:style.rows*2.6},color:style.color}];
}));

function makeTerrain(width,depth,stone){
 const columns=Math.ceil(width)+3,rows=Math.ceil(depth)+3,n=columns*rows;
 return {columns,rows,cell:1,origin:[-(columns-1)/2,-(rows-1)/2],heights:Buffer.alloc(n*2).toString('base64'),paint:Buffer.alloc(n,stone?6:3).toString('base64'),grass:Buffer.alloc(n).toString('base64')};
}

/** No server/API side effects: the caller chooses how to save and publish. */
export async function buildProfessionWorkshops(){
 const library=await readLibraryCatalog(fileURLToPath(new URL('../src/assets/library/',import.meta.url))),assets=new Map(library.assets.map(asset=>[asset.id,asset]));
 const maps=[];
 for(const [job,meta]of Object.entries(workshopMetadata)){
  const style=STYLE[job],hw=meta.bounds.width/2,hd=meta.bounds.depth/2;
  const map={format:1,id:meta.mapId,name:meta.name,description:`Taller de ${meta.label} en Brumaluz. Aula de bienvenida, maestro de oficio y zona de trabajo.`,createdAt:STAMP,updatedAt:STAMP,
   settings:{sky:'sunset',fog:0,water:{enabled:false,level:-.6,color:'#4f8fb0',opacity:.82},clouds:false,fireflies:false,bounded:true,kind:'interior',region:'Brumaluz',loadingTip:'Habla con el maestro para conocer el oficio. El banco de trabajo está dentro del taller.'},
   terrain:makeTerrain(hw*2,hd*2,style.floor.includes('tile')),layers:[{id:'suelo',name:'Suelo y alfombras',visible:true,locked:false},{id:'arquitectura',name:'Muros y ventanas',visible:true,locked:false},{id:'mobiliario',name:'Bancos y almacenamiento',visible:true,locked:false},{id:'oficio',name:'Herramientas y muestras',visible:true,locked:false},{id:'logica',name:'Maestro, banco y accesos',visible:true,locked:false},{id:'luz',name:'Luz y ambiente',visible:true,locked:false}],objects:[],colliders:[],markers:[]};
  let sequence=0;
  const collider=(name,x,z,w,h,d,y=0,yaw=0)=>map.colliders.push({id:`c_${++sequence}`,name,layer:'mobiliario',shape:'box',position:[x,y,z],rotationY:yaw,size:[w,h,d],walkable:false});
  function raw(asset,name,x,y,z,scale=.65,yaw=0,layer='arquitectura',rotation){
   if(!assets.has(asset))throw Error(`Missing workshop asset: ${asset}`);
   const s=Array.isArray(scale)?scale:[scale,scale,scale];
   map.objects.push({id:`o_${++sequence}`,asset,name,layer,position:[x,y,z],rotation:rotation??[0,yaw,0],scale:s,collision:'none'});
  }
  function fit(asset,name,x,z,width,{y=0,yaw=0,solid=true,tint,layer='mobiliario',height,depth}={}){
   const bounds=assets.get(asset)?.bounds;if(!bounds)throw Error(`Missing bounds: ${asset}`);
   const size=bounds.max.map((value,i)=>value-bounds.min[i]),sx=width/size[0],sy=height?height/size[1]:sx,sz=depth?depth/size[2]:sx;
   const cx=(bounds.min[0]+bounds.max[0])*.5*sx,cz=(bounds.min[2]+bounds.max[2])*.5*sz;
   const c=Math.cos(yaw),s=Math.sin(yaw);
   raw(asset,name,x-c*cx-s*cz,y-bounds.min[1]*sy,z+s*cx-c*cz,[sx,sy,sz],yaw,layer);
   if(tint)map.objects.at(-1).tint=tint;
   if(solid)collider(name,x,z,width,size[1]*sy,size[2]*sz,y,yaw);
   return {height:size[1]*sy,width,depth:size[2]*sz};
  }
  const deco=(asset,name,x,z,width,y=0,yaw=0)=>fit(asset,name,x,z,width,{y,yaw,solid:false,layer:'oficio'});
  function lay(asset,name,x,z,length,y=0,yaw=0){
   const b=assets.get(asset)?.bounds;if(!b)throw Error(`Missing tool ${asset}`);
   const dims=b.max.map((v,i)=>v-b.min[i]),scale=length/Math.max(...dims),vertical=dims[1]>=Math.max(dims[0],dims[2]);
   const corners=[];
   for(const px of [b.min[0],b.max[0]])for(const py of [b.min[1],b.max[1]])for(const pz of [b.min[2],b.max[2]]){
    const tx=vertical?-py:px,ty=vertical?px:py;corners.push([Math.cos(yaw)*tx+Math.sin(yaw)*pz,ty,-Math.sin(yaw)*tx+Math.cos(yaw)*pz].map(v=>v*scale));
   }
   const low=[0,1,2].map(i=>Math.min(...corners.map(p=>p[i]))),high=[0,1,2].map(i=>Math.max(...corners.map(p=>p[i])));
   raw(asset,name,x-(low[0]+high[0])/2,y-low[1]+.01,z-(low[2]+high[2])/2,scale,yaw,'oficio',[0,yaw,vertical?P/2:0]);
  }
  // Floors have a shallow visible top and do not replace the terrain walking surface.
  for(let x=0;x<style.columns;x++)for(let z=0;z<style.rows;z++){
   const asset=`dungeon/objects/${style.floor}`;
   const b=assets.get(asset)?.bounds;if(!b)throw Error(`Missing floor ${asset}`);
   const sx=2.6/(b.max[0]-b.min[0]),sz=2.6/(b.max[2]-b.min[2]);
   raw(asset,'Suelo del taller',-hw+1.3+x*2.6,.015-b.max[1]*.65,-hd+1.3+z*2.6,[sx,.65,sz],0,'suelo');
  }
  for(let x=0;x<style.columns;x++){
   const px=-hw+1.3+x*2.6;
   raw(x===Math.floor(style.columns/2)?'dungeon/objects/wall_shelves':'dungeon/objects/wall_scaffold','Pared del fondo',px,0,-hd,.65,0);
   if(Math.abs(px)<.2)raw('dungeon/objects/wall_doorway_scaffold','Puerta hacia Brumaluz',px,0,hd,.65,0);
   else raw('dungeon/objects/wall_scaffold','Pared de entrada',px,0,hd,.65,0);
  }
  // Even-width workshops retain a centred, two-panel doorway bay.
  if(style.columns%2===0){
   map.objects=map.objects.filter(object=>!(object.name==='Pared de entrada'&&Math.abs(object.position[0])<1.4));
   raw('dungeon/objects/wall_doorway_scaffold','Puerta hacia Brumaluz',0,0,hd,[1.3,.65,.65],0);
  }
  raw('dungeon/objects/wall_doorway_scaffold_door','Hoja de la puerta',0,0,hd,.65,0);
  for(let z=0;z<style.rows;z++){
   const pz=-hd+1.3+z*2.6,window=z===1||z===style.rows-2;
   for(const side of [-1,1])raw(`dungeon/objects/${window?'wall_window_closed_scaffold':'wall_scaffold'}`,window?'Ventana del taller':'Pared lateral',side*hw,0,pz,.65,P/2);
  }
  for(const x of [-hw,hw])for(const z of [-hd,hd])raw('dungeon/objects/wall_corner_small','Esquina del taller',x,0,z,.65,x<0?(z<0?P/2:P):(z<0?0:-P/2));
  collider('Pared del fondo',0,-hd,hw*2+.5,2.8,.65);collider('Pared izquierda',-hw,0,.65,2.8,hd*2);collider('Pared derecha',hw,0,.65,2.8,hd*2);collider('Pared de entrada y puerta',0,hd,hw*2+.5,2.8,.65);

  // A clear central aisle connects the door, the teacher and the working face of the bench.
  const bx=meta.bench.x,bz=meta.bench.z;
  const main='furniture/objects/table_medium_long';
  const bench=fit(main,`Banco principal de ${meta.label}`,bx,bz,2.75,{depth:1.35,height:.92});
  const top=bench.height+.025;
  fit('furniture/objects/rug_rectangle_B','Alfombra de bienvenida',0,.9,2.9,{solid:false,layer:'suelo',tint:style.color});
  fit('furniture/objects/chair_stool_wood','Taburete de visita',-2.1,2.15,.62);
  fit('dungeon/objects/chest','Baúl de materiales',hw-1.2,hd-1.35,1.35);
  fit('furniture/objects/cabinet_small_decorated','Armario del taller',-hw+1.25,-hd+1.05,1.9,{yaw:0,height:1.65,depth:.8});
  fit('furniture/objects/shelf_B_large_decorated','Manuales del oficio',hw-1.15,-hd+1.2,1.8,{depth:.55,height:.73,y:1.05,solid:false});
  deco('rpg-tools/objects/journal_open','Cuaderno del maestro',bx+.7,bz-.1,.5,top,.2);
  lay('rpg-tools/objects/pencil_A_long','Lápiz del maestro',bx+.88,bz+.32,.29,top+.02,.7);
  deco('rpg-tools/objects/lantern','Farol del banco',bx-1,bz-.32,.32,top);
  fit(`dungeon/objects/banner_patternB_${style.banner}`,'Paño del oficio',-hw+.45,0,.8,{solid:false,y:1.15,yaw:P/2,layer:'arquitectura'});
  fit('furniture/objects/cactus_small_A','Planta junto a la entrada',-hw+1.1,hd-1.3,.75);
  fit('rpg-tools/objects/lantern','Farol junto a la puerta',-1.9,hd-.42,.35,{solid:false,y:1.7,yaw:P,layer:'luz'});
  fit('rpg-tools/objects/lantern','Farol del fondo',2.5,-hd+.42,.35,{solid:false,y:1.7,layer:'luz'});
  const left=-hw+1.35,right=hw-1.3;
  const sideTable=(side,z=0)=>fit('furniture/objects/table_medium',`Mesa auxiliar de ${meta.label}`,side,z,1.8,{height:.82,depth:1.25});
  const tool=(name,x,z,width=.6,y=top,yaw=0)=>lay(`rpg-tools/objects/${name}`,name.replaceAll('_',' '),x,z,width,y,yaw);

  if(job==='herreria'){
   fit('mixed-bag/objects/woodstove','Fragua de carbón',left,-2.5,1.15,{depth:1.15,height:2.45});
   fit('rpg-tools/objects/anvil','Yunque de trabajo',right,-.55,1.5,{height:.84});
   fit('rpg-tools/objects/grindstone','Piedra de afilar',left,.9,1.2);
   fit('resources/objects/Iron_Bars_Stack_Medium','Lingotes de hierro',right,2.1,1.35);
   tool('hammer',bx-.5,bz+.15,.65,top,.9);tool('tongs',bx+.05,bz-.23,.65,top,-.5);
   deco('resources/objects/Copper_Bars','Muestras de cobre',bx+.3,bz+.18,.54,top);
  }else if(job==='peleteria'){
   sideTable(left,-.1);sideTable(right,.3);
   fit('resources/objects/Textiles_Stack_Large','Cueros preparados',right,-2.4,1.45,{tint:'#a17850'});
   fit('dungeon/objects/barrel_large','Barril de curtido',left,2.2,1.1);
   deco('resources/objects/Textiles_A','Piel sobre el banco',bx-.35,bz,.95,top);
   tool('knife',bx+.2,bz+.2,.48,top+.05,.4);tool('scissors',left,.1,.5,.85);
   deco('rpg-tools/objects/rope_bundle_A','Cordones de cuero',right,.3,.8,.84);
  }else if(job==='sastreria'){
   sideTable(left,-.1);sideTable(right,.3);
   fit('resources/objects/Textiles_Stack_Large_Colored','Telas de distintos colores',right,-2.4,1.55);
   fit('resources/objects/Textiles_Stack_Small','Tejidos de lino',left,2.4,1.2);
   deco('resources/objects/Textiles_B','Tela para cortar',bx-.4,bz,.95,top);
   tool('scissors',bx+.2,bz+.22,.5,top+.02,-.4);
   deco('rpg-tools/objects/rope_bundle_B','Hilos enrollados',left,-.1,.7,.84);
   deco('furniture/objects/book_single','Patrones de costura',right,.3,.6,.84);
  }else if(job==='carpinteria'){
   sideTable(left,.1);sideTable(right,.1);
   fit('resources/objects/Wood_Planks_Stack_Large','Tablones preparados',right,-2.9,1.65);
   fit('resources/objects/Wood_Log_Stack','Troncos del taller',left,2.3,1.5);
   tool('saw',bx-.3,bz,.9,top,.3);tool('handplane',bx+.3,bz+.25,.55,top);
   tool('handdrill',left,0,.65,.84);tool('mallet',right,.05,.65,.84);
  }else if(job==='ebanisteria'){
   sideTable(left,0);sideTable(right,-.3);
   fit('furniture/objects/chair_C','Silla de muestra',right,2.3,.9);
   fit('furniture/objects/cabinet_small','Mueble en acabado',left,2.4,1.5);
   fit('resources/objects/Wood_Planks_Stack_Small','Madera para ensamblar',right,-3.2,1.4);
   tool('chisel',bx-.35,bz,.7,top,.4);tool('mallet',bx+.2,bz+.22,.65,top,-.4);
   tool('blueprint',left,0,.9,.84);tool('handplane',right,-.3,.65,.84);
  }else if(job==='joyeria'){
   sideTable(left,0);sideTable(right,.2);
   tool('magnifying_glass',bx-.4,bz,.65,top,.2);
   tool('file',bx+.15,bz+.2,.6,top,.5);tool('tongs',bx-.2,bz-.3,.55,top,-.3);
   deco('resources/objects/Gold_Bars','Oro para engastes',right,.2,.75,.84);
   deco('resources/objects/Silver_Nuggets','Plata y pequeñas muestras',left,0,.75,.84);
   deco('resources/objects/Silver_Nuggets','Muestra de piedras para tallar',bx+.65,bz-.25,.5,top);
  }else if(job==='alquimia'){
   fit('furniture/objects/cabinet_medium_decorated','Armario de ingredientes',left,-2.4,1.65,{height:1.8,depth:.7});
   fit('furniture/objects/cabinet_medium','Alacena de ingredientes',right,.1,1.55,{height:.95,depth:.6});
   fit('restaurant/objects/crate','Hierbas de trabajo',left,1.5,1.75);
   fit('restaurant/objects/pot_large','Caldero de preparación',right,2.1,1.1);
   deco('dungeon/objects/bottle_A_labeled_green','Bandeja de frascos',bx-.25,bz,.22,top);
   deco('dungeon/objects/bottle_B_green','Frasco de ingredientes',bx+.35,bz+.25,.22,top);
  }else if(job==='encantamiento'){
   fit('furniture/objects/shelf_B_large_decorated','Biblioteca de símbolos',left,-2.35,1.85,{depth:.55,height:.75,y:1.05,solid:false});
   sideTable(left,.7);sideTable(right,.2);
   deco('furniture/objects/book_set','Libros de referencia',left,.7,.8,.84);
   tool('journal_open',bx-.3,bz,.85,top);
   deco('dungeon/objects/candle_triple','Velas de lectura',right,.2,.6,.84);
   deco('resources/objects/Silver_Nuggets','Cristales de estudio',bx+.15,bz+.3,.44,top);
  }else if(job==='cocina'){
   fit('mixed-bag/objects/woodstove','Hogar de cocina',left,-2.6,1.2,{height:2.5,depth:1.2});
   sideTable(right,0);fit('restaurant/objects/crate_carrots','Zanahorias',right,2.2,1.15);
   fit('restaurant/objects/crate_potatoes','Patatas',left,2,1.1);
   deco('restaurant/objects/pot_A_stew','Olla de guiso',bx-.35,bz,.65,top);
   deco('restaurant/objects/stew_bowl','Cuenco de muestra',bx+.2,bz+.3,.34,top);
   deco('restaurant/objects/jar_A_medium','Tarro de ingredientes',right,-.25,.38,.84);
   deco('restaurant/objects/food_ingredient_potato_chopped','Ingredientes cortados',right,.25,.55,.84);
   tool('knife',bx+.6,bz+.2,.45,top,.5);
  }else if(job==='minero'){
   sideTable(left,0);sideTable(right,.2);
   fit('resources/objects/Stone_Chunks_Large','Muestras de roca',right,-2.7,1.4);
   fit('resources/objects/Copper_Nuggets','Muestras de cobre',left,2.2,1.2);
   fit('resources/objects/Iron_Nuggets','Muestras de hierro',right,2.3,1.15);
   tool('pickaxe',bx-.25,bz,.9,top,.2);tool('chisel',bx+.15,bz+.3,.5,top,-.3);
   deco('resources/objects/Copper_Nugget_Medium','Mineral para reconocer',left,0,.6,.84);
   tool('map_rolled',right,.2,.65,.84);tool('lantern',bx+.55,bz-.3,.3,top);
  }else if(job==='lenador'){
   sideTable(left,0);sideTable(right,.2);
   fit('resources/objects/Wood_Log_Stack','Troncos de muestra',left,2.2,1.6);
   fit('resources/objects/Wood_Planks_Stack_Medium','Maderas clasificadas',right,-2.6,1.55);
   tool('axe',bx-.3,bz,.85,top,.35);tool('saw',right,.2,.9,.84,.2);
   deco('resources/objects/Wood_Log_A','Corte de tronco',left,0,1,.84);
   tool('rope_bundle_B',bx+.3,bz+.2,.6,top);
  }else if(job==='recolector'){
   fit('furniture/objects/cabinet_medium','Alacena de muestras',left,-2.5,1.6,{depth:.65,height:.95});
   fit('restaurant/objects/crate','Semillero de hierbas',left,.3,1.85);
   fit('furniture/objects/cabinet_medium_decorated','Armario de semillas',right,-2.5,1.6,{depth:.65,height:1.8});
   sideTable(right,.6);fit('restaurant/objects/crate_carrots','Cosecha de muestra',left,2.5,1.15);
   deco('dungeon/objects/bottle_A_labeled_green','Tarros para conservar muestras',right,.6,.22,.84);
   deco('mixed-bag/objects/flax_flower_A','Flores para reconocer',bx-.2,bz,.65,top);
   tool('trowel',bx+.2,bz+.3,.55,top,.5);tool('scissors',bx+.6,bz+.15,.45,top,-.4);
  }

  // Dress the peripheral work areas, keeping the teacher and central aisle clear.
  fit('furniture/objects/cabinet_medium','Base del archivo del oficio',right,-hd+1.2,1.8,{height:1.05,depth:.65});
  deco('dungeon/objects/candle_triple','Velas del armario',left,-hd+1.05,.42,1.67);
  fit('dungeon/objects/barrel_small_stack','Reserva de suministros',hw-1.2,hd-2.95,1.15,{height:1.05,depth:.7});
  const bottles=(x,z,y)=>{
   deco('dungeon/objects/bottle_A_labeled_green','Frasco etiquetado',x-.28,z,.18,y);
   deco('dungeon/objects/bottle_B_brown','Frasco de muestras',x+.12,z+.06,.2,y);
   deco('restaurant/objects/jar_A_medium','Tarro de reserva',x+.42,z-.08,.24,y);
  };
  if(job==='alquimia'||job==='recolector'){
   const name=job==='alquimia'?'Hierbas de trabajo':'Semillero de hierbas';
   map.objects=map.objects.filter(o=>o.name!==name);map.colliders=map.colliders.filter(o=>o.name!==name);
   const seedZ=job==='alquimia'?1.5:.3;
   fit('restaurant/objects/crate','Cajón de cultivo',left,seedZ,1.75,{height:.38,depth:.65});
   for(const offset of [-.32,0,.32])deco('mixed-bag/objects/flax_flower_B','Hierbas del semillero',left+offset,seedZ,.26,.25);
   const shelfX=job==='alquimia'?right:left,shelfZ=job==='alquimia'?.1:-2.5;
   bottles(shelfX,shelfZ,.97);
   deco('mixed-bag/objects/flax_flower_A','Plantas para clasificar',shelfX-.5,shelfZ-.05,.25,.97);
   deco('mixed-bag/objects/flax_flower_A','Muestra botánica',bx-.65,bz+.05,.28,top);
   bottles(bx-.2,bz-.22,top);
   if(job==='alquimia'){
    fit('dungeon/objects/table_small','Soporte del caldero',right,2.1,1.15,{height:.6,depth:1});
    for(const item of [...map.objects,...map.colliders].filter(o=>o.name==='Caldero de preparación'))item.position[1]+=.61;
   }
  }else if(job==='herreria'){
   fit('rpg-tools/objects/bucket_metal','Cubo de temple',left+1.1,-2.1,.55);
   deco('resources/objects/Copper_Nuggets','Minerales junto a la fragua',left,-3.4,.65);
   lay('rpg-tools/objects/tongs','Tenazas de la fragua',left,-1.75,.8,.05,.4);
  }else if(job==='cocina'){
   deco('restaurant/objects/pot_B_stew','Olla sobre el hogar',left,-2.6,.65,1.05);
   bottles(right,-.35,.84);
   fit('restaurant/objects/crate_onions','Cebollas de la despensa',left,3.15,.85,{height:.5});
  }else if(job==='encantamiento'){
   fit('furniture/objects/cabinet_medium','Archivo de símbolos',left,-2.35,1.85,{height:.9,depth:.7});
   deco('furniture/objects/book_set','Tomos de consulta',left,-2.35,.7,.92);
   deco('dungeon/objects/candle_triple','Luz del estudio',bx+.15,bz-.25,.3,top);
   lay('rpg-tools/objects/map_rolled','Pergamino de símbolos',right,.2,.65,.85,.4);
  }else if(job==='joyeria'){
   deco('resources/objects/Gold_Nuggets','Muestras de oro',right,.5,.42,.84);
   deco('dungeon/objects/bottle_C_brown','Aceite de pulido',left,.3,.18,.84);
  }else if(job==='sastreria'||job==='peleteria'){
   fit('dungeon/objects/barrel_small','Reserva de fibras',left,3.3,.7,{height:.8});
   deco('resources/objects/Textiles_Stack_Small','Muestrario sobre la mesa',right,.1,.65,.84);
  }else if(job==='carpinteria'||job==='ebanisteria'||job==='lenador'){
   lay('rpg-tools/objects/chisel','Formón de repuesto',left,.35,.55,.84,.4);
   deco('resources/objects/Wood_Planks_Stack_Small','Muestras de acabado',right,.3,.6,.84);
  }else if(job==='minero'){
   deco('resources/objects/Gold_Nuggets','Veta para identificar',right,.45,.48,.84);
   fit('rpg-tools/objects/bucket_metal','Cubo para clasificar',left,3.3,.6);
  }

  map.markers.push(
   {id:'spawn',type:'spawn',name:'Entrada al taller',layer:'logica',position:[0,0,meta.arrival.z],rotationY:P,radius:1},
   {id:'desde_brumaluz',type:'arrival',name:'Desde Brumaluz',layer:'logica',position:[0,0,meta.arrival.z],rotationY:P,radius:1},
   {id:meta.exit.id,type:'portal',name:'Salir a Brumaluz',layer:'logica',position:[meta.exit.x,0,meta.exit.z],rotationY:0,radius:meta.exit.radius,target:meta.exit.target,trigger:'interact'},
   {id:meta.masterId,type:'npc',name:job==='herreria'?'Isberto · maestro de Herrería':`Maestro de ${meta.label}`,npcId:meta.masterId,layer:'logica',position:[meta.master.x,0,meta.master.z],rotationY:meta.master.yaw,radius:2.5},
   {id:`banco_${job}`,type:'interaction',name:`Usar banco de ${meta.label}`,layer:'logica',position:[meta.station.x,0,meta.station.z],rotationY:P,radius:meta.station.radius,text:`profession:${job}`},
   {id:'luz_central',type:'light',name:'Luz cálida del taller',layer:'luz',position:[0,2.7,0],rotationY:0,radius:8,color:'#ffe2b4'},
   {id:'luz_banco',type:'light',name:'Luz de trabajo',layer:'luz',position:[bx,2.1,bz+.2],rotationY:0,radius:5,color:job==='alquimia'||job==='recolector'?'#edf0cf':'#ffd8a1'},
   {id:'guia_del_taller',type:'note',name:`Guía de ${meta.label}`,layer:'logica',position:[-2,0,hd-2],rotationY:0,radius:1,text:'Habla con el maestro para conocer el oficio. El banco queda al fondo, con espacio libre delante para trabajar.'},
  );
  maps.push(map);
 }
 return maps;
}

export async function writeProfessionWorkshopDrafts({replace=false,directory=fileURLToPath(new URL('../src/data/maps/',import.meta.url))}={}){
 await mkdir(directory,{recursive:true});const maps=await buildProfessionWorkshops(),written=[],preserved=[];
 for(const map of maps){const path=resolve(directory,`${map.id}.json`);let exists=false;try{await access(path);exists=true;}catch{}
  if(exists&&!replace){preserved.push(map.id);continue;}
  if(exists){const previous=JSON.parse(await readFile(path,'utf8'));map.createdAt=previous.createdAt??map.createdAt;}
  await writeFile(path,JSON.stringify(map,null,2)+'\n');written.push(map.id);
 }
 return {written,preserved,maps};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const {written,preserved}=await writeProfessionWorkshopDrafts({replace:process.argv.includes('--replace-generated')});
 console.log(JSON.stringify({written,preserved,published:false}));
}

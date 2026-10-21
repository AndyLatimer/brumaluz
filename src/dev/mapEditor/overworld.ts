import { createTerrain, decodeTerrain, encodeTerrain, GROUND_MATERIALS, newMap, sampleHeight, type MapDocument } from '../../data/maps';
import { BRUMALUZ_GATES } from '../../data/pompelin';

type Point = readonly [number, number];
export const OVERWORLD_SCALE = 3;
export const OVERWORLD_SIZE = { width: 2160, depth: 1620, cell: 2.4 } as const;
// Anchura de los caminos en metros, independiente de la escala del continente.
const ROAD_HALF_WIDTH = 4 / OVERWORLD_SCALE;
const land: Point[] = [[-330,-80],[-290,-120],[-250,-100],[-250,-225],[-150,-220],[-100,-210],[-10,-235],[70,-215],[90,-185],[200,-195],[245,-160],[250,-80],[325,-65],[330,25],[300,60],[330,150],[310,240],[160,230],[95,200],[0,220],[-40,160],[-90,155],[-140,125],[-215,105],[-240,55],[-225,0],[-320,25]];
const island: Point[] = [[-340,170],[-290,145],[-245,155],[-210,190],[-225,245],[-310,250],[-350,220]];
const river: Point[] = [[330,-8],[260,20],[200,47],[145,75],[90,110],[50,160],[-10,150],[-55,135],[-100,160]];
const roads: Point[][] = [
  [[-40,40],[-70,90],[-100,130],[-125,145]],
  [[-95,-30],[-170,-45],[-250,-60]],
  [[20,-30],[70,-50],[125,-50],[200,-65]],
  [[-65,-80],[-90,-145],[-155,-165]],
  [[-100,120],[-180,85],[-265,100]],
  [[85,100],[160,85],[235,120],[280,190]],
  [[-40,-30],[-95,-30]], [[-40,-30],[20,-30]],
  [[-40,-30],[-65,-80]], [[-40,-30],[-40,40]],
];
const inside = (p: Point, polygon: Point[]) => {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) result = !result;
  }
  return result;
};
const distance = ([x,z]: Point, line: Point[]) => {
  let nearest = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax,az] = line[i-1], [bx,bz] = line[i];
    const t = Math.max(0, Math.min(1, ((x-ax)*(bx-ax)+(z-az)*(bz-az))/((bx-ax)**2+(bz-az)**2)));
    nearest = Math.min(nearest, Math.hypot(x-ax-(bx-ax)*t,z-az-(bz-az)*t));
  }
  return nearest;
};
const material = (id: string) => GROUND_MATERIALS.findIndex(item => item.id === id);

/** Aproximación editable al croquis del continente: no sustituye los mapas detallados de las ciudades. */
export function overworldTemplate(): MapDocument {
  const map = newMap('pompelin', 'Pompelín', { ...OVERWORLD_SIZE, grass: 0 });
  map.description = 'Continente de 2,2 × 1,6 km basado en el croquis, con amplios exteriores jugables: Brumaluz central, Rusty Hearth al oeste, la Arboleda al este, Cumbres de Cobre al sureste e isla de Lunargenta al suroeste. Las zonas del norte quedan vacías para ampliar.';
  map.settings = { ...map.settings, kind: 'world', region: 'Continente de Pompelín', fog: .08,
    water: { enabled: true, level: -1, color: '#427f9f', opacity: .9 },
    loadingTip: 'Brumaluz es la capital. Sus puertas conectan la ciudad con el continente.' };
  const terrain = createTerrain(OVERWORLD_SIZE.width, OVERWORLD_SIZE.depth, OVERWORLD_SIZE.cell, -5, material('sand'), 0);
  const pointOnLand = (x: number, z: number) => inside([x,z],land) || inside([x,z],island);
  const roadAt = (x: number, z: number) => Math.abs(Math.hypot((x+40)/1.1,z+30)-83) < ROAD_HALF_WIDTH
    || roads.some(line => distance([x,z],line) < ROAD_HALF_WIDTH);
  const heightAt = (x: number, z: number) => pointOnLand(x,z) ? Math.max(.2, .9 + Math.sin(x*.025)*Math.cos(z*.021)*.55) : -5;
  for (let j=0;j<terrain.rows;j++) for (let i=0;i<terrain.columns;i++) {
    const x=(terrain.origin[0]+i*terrain.cell)/OVERWORLD_SCALE, z=(terrain.origin[1]+j*terrain.cell)/OVERWORLD_SCALE, index=j*terrain.columns+i;
    if (!pointOnLand(x,z)) continue;
    terrain.heights[index]=heightAt(x,z);
    const water=distance([x,z],river)<3.5;
    const road=roadAt(x,z);
    terrain.paint[index]=material(road?'path':((x-230)/130)**2+((z+75)/125)**2<1?'forest':x>140&&z>90?'stone':'meadow');
    terrain.grass[index]=road||water?0:45;
    if(water) { terrain.heights[index]=-2.2; terrain.paint[index]=material('sand'); }
  }
  map.terrain=encodeTerrain(terrain);
  let serial=0;
  const add=(asset:string,x:number,z:number,scale=4,yaw=0, layer='naturaleza') => {
    if (!pointOnLand(x,z)) return;
    map.objects.push({id:`world_${serial++}`,asset:`city/${asset}`,layer,position:[x*OVERWORLD_SCALE,heightAt(x,z),z*OVERWORLD_SCALE],rotation:[0,yaw,0],scale:[scale,scale,scale],collision:'auto'});
  };
  const note=(id:string,name:string,x:number,z:number,radius=15) => map.markers.push({
    id,type:'zone',name,layer:'logica',position:[x*OVERWORLD_SCALE,heightAt(x,z),z*OVERWORLD_SCALE],rotationY:0,radius,text:name,
  });
  map.markers=[];
  note('region_brumaluz','Brumaluz · capital de Pompelín',-40,-30,45);
  add('castle',-40,-30-10/OVERWORLD_SCALE,10,0,'edificios');
  for(let k=0;k<12;k++) {
    const a=k*Math.PI/6;
    add(k%2?'home_A':'home_B',-40+Math.cos(a)*26/OVERWORLD_SCALE,-30+Math.sin(a)*26/OVERWORLD_SCALE,5,a,'edificios');
  }
  // Las cinco puertas coinciden con las de la capital detallada.
  for(const gate of BRUMALUZ_GATES) {
    const dx=2*gate.dir[0]+gate.dir[1], dz=Math.sqrt(3)*gate.dir[1], length=Math.hypot(dx,dz);
    const px=-40+dx/length*50/OVERWORLD_SCALE,pz=-30+dz/length*50/OVERWORLD_SCALE;
    const ax=-40+dx/length*64/OVERWORLD_SCALE,az=-30+dz/length*64/OVERWORLD_SCALE;
    map.markers.push(
      {id:`entrada_brumaluz_${gate.id}`,type:'portal',name:`Entrar en Brumaluz · ${gate.name}`,layer:'logica',position:[px*OVERWORLD_SCALE,heightAt(px,pz),pz*OVERWORLD_SCALE],rotationY:0,radius:4,trigger:'interact',target:{map:'brumaluz',arrival:`llegada_${gate.id}`}},
      {id:`desde_brumaluz_${gate.id}`,type:'arrival',name:`Desde Brumaluz · ${gate.name}`,layer:'logica',position:[ax*OVERWORLD_SCALE,heightAt(ax,az),az*OVERWORLD_SCALE],rotationY:Math.atan2(-dx,-dz),radius:1},
    );
  }
  const spawnZ=-30+80/OVERWORLD_SCALE;
  map.markers.push({id:'spawn',type:'spawn',name:'Inicio en Pompelín',layer:'logica',position:[-40*OVERWORLD_SCALE,heightAt(-40,spawnZ),spawnZ*OVERWORLD_SCALE],rotationY:0,radius:1});
  const settlement=(id:string,name:string,x:number,z:number) => {
    note(id,name,x,z);
    for(let k=0;k<5;k++) add(k===0?'tavern':'home_A',x+(k-2)*9/OVERWORLD_SCALE,z+(k%2)*9/OVERWORLD_SCALE,5,0,'edificios');
    map.markers.push({id:`viaje_${id}`,type:'portal',name:`Entrar en ${name}`,layer:'logica',position:[x*OVERWORLD_SCALE,heightAt(x,z+23/OVERWORLD_SCALE),z*OVERWORLD_SCALE+23],rotationY:0,radius:3,trigger:'interact'});
  };
  settlement('rusty_hearth','Rusty Hearth',-255,-68);
  settlement('lunargenta','Isla de Lunargenta',-278,190);
  note('arboleda','La Arboleda',220,-75,70*OVERWORLD_SCALE);
  note('cumbres_cobre','Cumbres de Cobre',240,150,65*OVERWORLD_SCALE);
  note('gremio','Gremio del sur · nombre provisional',-125,130);
  add('church',-125,130-5/OVERWORLD_SCALE,8,0,'edificios');
  note('norte_oeste','Noroeste · espacio para ampliar',-200,-190,35*OVERWORLD_SCALE);
  note('norte','Norte · espacio para ampliar',30,-190,35*OVERWORLD_SCALE);
  let seed=8172;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let k=0;k<290;k++){
    const x=100+random()*210,z=-160+random()*225;
    if(!pointOnLand(x,z)||roadAt(x,z)||distance([x,z],river)<9)continue;
    add(k%2?'tree_single_A':'tree_single_B',x,z,5+random()*6,random()*6);
  }
  for(let k=0;k<32;k++){
    const x=145+random()*170,z=95+random()*135;
    if(!pointOnLand(x,z)||roadAt(x,z)||distance([x,z],river)<13)continue;
    add(k%2?'mountain_C_grass':'mountain_A_grass_trees',x,z,5+random()*4,random()*6);
  }
  for(let k=0;k<75;k++){
    const a=random()*Math.PI*2,r=95+random()*35,x=-40+Math.cos(a)*r*1.1,z=-30+Math.sin(a)*r;
    if(pointOnLand(x,z)&&!roadAt(x,z)&&distance([x,z],river)>10)add('tree_single_A',x,z,4+random()*3,random()*6);
  }
  decorateOverworldSettlements(map);
  return map;
}

/** Añade detalles al borrador existente sin regenerar su terreno ni sustituir ediciones. */
export function decorateOverworldSettlements(map: MapDocument) {
  const terrain = decodeTerrain(map.terrain);
  const used = new Set(map.objects.map(object => object.id));
  const travel = map.markers.filter(marker => ['portal', 'arrival', 'spawn'].includes(marker.type));
  const ground = (x: number, z: number) => sampleHeight(terrain, (x-terrain.origin[0])/terrain.cell, (z-terrain.origin[1])/terrain.cell);
  let added = 0;
  const settlement = (id: string, label: string) => {
    const center = map.markers.find(marker => marker.id === id);
    if (!center) throw new Error(`Falta la región «${id}» para decorar ${label}.`);
    let serial = 0;
    return (asset: string, dx: number, dz: number, scale = 1, yaw = 0) => {
      const key = `detail_${id}_${serial++}`;
      if (used.has(key)) return;
      const x = center.position[0]+dx, z = center.position[2]+dz;
      const reach = asset.startsWith('city/') ? scale*2 : scale*1.6;
      if (travel.some(marker => Math.hypot(x-marker.position[0], z-marker.position[2]) < marker.radius+reach+3)) return;
      if (x < terrain.origin[0] || z < terrain.origin[1]
        || x > terrain.origin[0]+(terrain.columns-1)*terrain.cell || z > terrain.origin[1]+(terrain.rows-1)*terrain.cell) return;
      const y = ground(x,z);
      if (map.settings.water.enabled && y <= map.settings.water.level+.2) return;
      map.objects.push({
        id:key, name:`${label} · ${asset.split('/').at(-1)}`, asset,
        layer:asset.startsWith('city/') && /home|market|tower|mill|blacksmith|tavern|barracks|church/.test(asset) ? 'edificios' : 'atrezo',
        position:[x,y,z], rotation:[0,yaw,0], scale:[scale,scale,scale], collision:'auto',
      });
      used.add(key); added++;
    };
  };
  const capital = settlement('region_brumaluz', 'Brumaluz');
  // Barrios exteriores en grupos, dejando abiertos los cinco caminos radiales.
  for (const [cx,cz] of [[-100,-48],[92,-48],[-100,45],[92,45]] as const) {
    capital('city/home_A',cx,cz,4);
    capital('city/home_B',cx+16,cz+4,4,Math.PI/3);
    capital('city/home_A',cx+5,cz+19,3.8,-Math.PI/3);
    capital('builtin/lamppost',cx+11,cz+12);
    capital('dungeon/objects/crates_stacked',cx-5,cz+7,.65);
    capital('city/tree_single_B',cx-12,cz+15,4);
    capital('builtin/bench',cx+9,cz+26,1.2);
  }
  capital('city/market',-36,-64,5);
  capital('city/blacksmith',36,-64,4);
  capital('city/barracks',-38,65,4);
  capital('city/well',0,32,2.5);
  for (let i=0;i<5;i++) {
    capital('restaurant/objects/crate_carrots',-46+i*2.5,-54,.6);
    capital('dungeon/objects/barrel_small',33+i*1.6,-54,.8);
  }
  for (const gate of BRUMALUZ_GATES) {
    const dx=2*gate.dir[0]+gate.dir[1],dz=Math.sqrt(3)*gate.dir[1],length=Math.hypot(dx,dz);
    const ux=dx/length,uz=dz/length;
    for (const side of [-1,1]) {
      capital('city/tower_A',ux*49-uz*side*14,uz*49+ux*side*14,3);
      capital('dungeon/objects/banner_blue',ux*54-uz*side*8,uz*54+ux*side*8,1,Math.atan2(ux,uz));
      capital('builtin/lamppost',ux*72-uz*side*8,uz*72+ux*side*8);
    }
  }
  const rustic = settlement('rusty_hearth','Rusty Hearth');
  rustic('city/blacksmith',-35,-20,4);
  rustic('city/windmill',42,-28,4);
  rustic('city/market',32,2,4);
  rustic('city/well',0,39,2.5);
  rustic('city/home_B',-37,17,4);
  rustic('city/home_A',30,30,4);
  for (let i=0;i<5;i++) {
    rustic('city/tree_single_A',-55+i*24,-43,4);
    rustic('dungeon/objects/barrel_small',-25+i*1.5,-13,.8);
    rustic('restaurant/objects/crate_potatoes',25+i*2,12,.65);
    rustic('builtin/lamppost',-12+i*6,33);
  }
  rustic('city/wheelbarrow',-30,3,1.8,Math.PI/2);
  rustic('builtin/bench',-14,43,1.3);
  rustic('builtin/bench',14,43,1.3);
  const islandTown = settlement('lunargenta','Lunargenta');
  islandTown('city/market',30,0,4);
  islandTown('city/tavern',-32,-19,4);
  islandTown('city/home_B',34,-24,4);
  islandTown('city/home_A',-37,18,4);
  islandTown('city/well',5,-22,2);
  for (let i=0;i<6;i++) {
    islandTown('city/tree_single_B',-52+i*20,-43,4);
    islandTown('dungeon/objects/barrel_small',27+i*1.5,12,.8);
    islandTown('restaurant/objects/crate_carrots',-26+i*2,-9,.6);
  }
  for (const side of [-1,1]) {
    islandTown('builtin/lamppost',side*9,28);
    islandTown('dungeon/objects/banner_white',side*8,17);
    islandTown('builtin/bench',side*20,36,1.3,side*Math.PI/2);
    islandTown('city/rock_single_A',side*48,28,3);
  }
  return added;
}

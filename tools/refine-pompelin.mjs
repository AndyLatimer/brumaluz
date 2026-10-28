// Rebuild the landscape around the authored geography, never lift its mountain props.
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';
import {assetBoxes} from './asset-bounds.mjs';
import {populateArboleda} from './pompelin-arboleda.mjs';
const bundle=await build({stdin:{contents:"export * from './src/data/maps';export {overworldTemplate} from './src/dev/mapEditor/overworld';export {ARBOLEDA_WORLD,arboledaDistance} from './src/data/arboleda';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const source=JSON.parse(await fs.readFile('src/data/maps/pompelin.json','utf8'));
const capital=JSON.parse(await fs.readFile('src/data/world/maps/brumaluz.json','utf8'));
const template=api.overworldTemplate(),originalObjects=new Map(template.objects.map(o=>[o.id,o]));
const map=structuredClone(source),base=api.decodeTerrain(template.terrain),before=api.decodeTerrain(source.terrain),field=api.decodeTerrain(template.terrain);
const {columns,rows,cell,origin}=field,count=columns*rows,center=[-120,-90],cityScale=50/172;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const sample=(data,x,z)=>api.sampleHeight(data,(x-data.origin[0])/data.cell,(z-data.origin[1])/data.cell);
const ground=(x,z)=>sample(field,x,z);
const gaussian=(x,z,cx,cz,rx,rz,h)=>h*Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2)*2);
const segmentDistance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
const travel=map.markers.filter(m=>m.id.startsWith('entrada_brumaluz_'));
const radialPaths=travel.map(m=>{const dx=m.position[0]-center[0],dz=m.position[2]-center[1],r=Math.hypot(dx,dz);return [[center[0]+dx/r*45,center[1]+dz/r*45],[center[0]+dx/r*260,center[1]+dz/r*260]];});
const bridgeSite={x:345.625,z:281.875,ux:105/Math.hypot(105,165),uz:165/Math.hypot(105,165)};
const bridgePath=[[285.625,293.875],[bridgeSite.x-bridgeSite.ux*24,bridgeSite.z-bridgeSite.uz*24],[bridgeSite.x+bridgeSite.ux*24,bridgeSite.z+bridgeSite.uz*24],[405.625,269.875]];
const arboleda=api.ARBOLEDA_WORLD,forestPaths=[[...arboleda.approach],[...arboleda.arrival]];
const forestLoop=[[625,-195],[675,-165],[735,-190],[770,-250],[720,-285],[665,-270]];
const smoothLoop=[];
for(let k=0;k<forestLoop.length;k++)for(let n=0;n<12;n++){
 const t=n/12,t2=t*t,t3=t2*t,p0=forestLoop[(k+forestLoop.length-1)%forestLoop.length],p1=forestLoop[k],p2=forestLoop[(k+1)%forestLoop.length],p3=forestLoop[(k+2)%forestLoop.length];
 smoothLoop.push([0,1].map(axis=>.5*(2*p1[axis]+(-p0[axis]+p2[axis])*t+(2*p0[axis]-5*p1[axis]+4*p2[axis]-p3[axis])*t2+(-p0[axis]+3*p1[axis]-3*p2[axis]+p3[axis])*t3)));
}
smoothLoop.push(smoothLoop[0]);
const forestSegments=[forestPaths,...smoothLoop.slice(1).map((b,k)=>[smoothLoop[k],b])];
function distanceTransform(seed){const d=new Float32Array(count);for(let n=0;n<count;n++)d[n]=seed(n)?0:10000;
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const n=j*columns+i;if(i)d[n]=Math.min(d[n],d[n-1]+cell);if(j)d[n]=Math.min(d[n],d[n-columns]+cell);if(i&&j)d[n]=Math.min(d[n],d[n-columns-1]+cell*Math.SQRT2);if(i<columns-1&&j)d[n]=Math.min(d[n],d[n-columns+1]+cell*Math.SQRT2);}
 for(let j=rows-1;j>=0;j--)for(let i=columns-1;i>=0;i--){const n=j*columns+i;if(i<columns-1)d[n]=Math.min(d[n],d[n+1]+cell);if(j<rows-1)d[n]=Math.min(d[n],d[n+columns]+cell);if(i<columns-1&&j<rows-1)d[n]=Math.min(d[n],d[n+columns+1]+cell*Math.SQRT2);if(i&&j<rows-1)d[n]=Math.min(d[n],d[n+columns-1]+cell*Math.SQRT2);}
 return d;
}
const roadMask=new Uint8Array(count);
for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const n=j*columns+i,x=origin[0]+i*cell,z=origin[1]+j*cell;const crossing=Math.hypot(x-bridgeSite.x,z-bridgeSite.z)<59,forest=api.arboledaDistance(x,z)<1.1;
 roadMask[n]=base.paint[n]===4&&!crossing||base.heights[n]>0&&(radialPaths.some(([a,b])=>segmentDistance(x,z,a,b)<4.2)||crossing&&bridgePath.slice(1).some((b,k)=>segmentDistance(x,z,bridgePath[k],b)<3.3)||forest&&forestSegments.some(([a,b])=>segmentDistance(x,z,a,b)<2.6))?1:0;
}
const dist=distanceTransform(n=>roadMask[n]),shore=distanceTransform(n=>base.heights[n]<-1);
const villages=map.markers.filter(m=>['rusty_hearth','lunargenta','gremio','arboleda'].includes(m.id));
const groves=[[-255,-190,45],[-280,60,55],[-55,65,36],[65,-145,40],[-120,-300,44],[-390,-330,65],[-515,-190,65],[-560,105,75],[-735,-350,55],[-350,225,58],[-90,290,48],[150,-375,65],[340,-250,65],[445,-385,85],[550,-150,85],[735,-270,105],[840,-100,80],[555,20,65],[335,155,46],[-870,665,40],[-940,535,42],[-700,620,45],[610,405,50],[790,430,45],[665,540,45]];
const groveAt=(x,z)=>Math.max(...groves.map(([a,b,r])=>1-smooth(r*.25,r,Math.hypot(x-a,z-b))));
for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
 const n=j*columns+i,x=origin[0]+i*cell,z=origin[1]+j*cell,b=base.heights[n];
 if(b<=-1)continue; // Keep every authored sea and river cell intact.
 let keep=smooth(12,55,shore[n])*smooth(62,115,Math.hypot(x-center[0],z-center[1]));
 for(const v of villages)keep=Math.min(keep,smooth(65,130,Math.hypot(x-v.position[0],z-v.position[2])));
 // Cumbres de Cobre already has sculpted mountain models. Its valley stays at its authored level.
 keep*=smooth(1,1.35,Math.hypot((x-690)/345,(z-490)/250));
 const relief=gaussian(x,z,-380,-450,280,190,16)+gaussian(x,z,-505,100,255,160,10)
  +gaussian(x,z,160,-450,230,165,11)+gaussian(x,z,-30,210,180,160,7)
  +gaussian(x,z,445,-290,190,190,5)+gaussian(x,z,-900,625,140,125,6);
 const rolling=(Math.sin(x*.014+z*.005)*Math.cos(z*.011)+1)*.85;
 field.heights[n]=Math.min(b,-1.45+shore[n]*.24)+(relief+rolling)*keep*(.88+.12*smooth(4,22,dist[n]));
 const bx=x-bridgeSite.x,bz=z-bridgeSite.z,lx=bx*bridgeSite.ux+bz*bridgeSite.uz,lz=-bx*bridgeSite.uz+bz*bridgeSite.ux;
 const abutment=(1-smooth(2,6,Math.abs(Math.abs(lx)-18)))*(1-smooth(3.5,6,Math.abs(lz)));
 field.heights[n]=field.heights[n]*(1-abutment)+.65*abutment;
 const grove=groveAt(x,z);
 if(Math.hypot(x-center[0],z-center[1])<44){field.paint[n]=0;field.grass[n]=0;}
 else if(roadMask[n]){field.paint[n]=4;field.grass[n]=0;}
 else if(shore[n]<6){field.paint[n]=8;field.grass[n]=0;}
 else if(api.arboledaDistance(x,z)<1+(Math.sin(x*.027)+Math.cos(z*.031))*.025){field.paint[n]=2;field.grass[n]=44;}
 else if(base.paint[n]===6){field.paint[n]=grove>.45?2:Math.sin(x*.014)+Math.cos(z*.018)>.3?6:1;field.grass[n]=field.paint[n]===6?12:48;}
 else {field.paint[n]=grove>.45?2:Math.sin(x*.008+z*.004)+Math.sin(z*.012)>.6?1:0;field.grass[n]=grove>.45?40:78;}
}
// Eliminate the miniature city terraces. Only the defensive perimeter belongs in this world view.
map.layers=map.layers.filter(l=>!l.id.startsWith('paisaje_'));
for(const[id,name]of [['paisaje_capital','Brumaluz · murallas y puertas'],['paisaje_bosque','Arboledas y claros'],['paisaje_prados','Flores y sotobosque'],['paisaje_rocas','Riberas y roquedos'],['paisaje_descanso','Caminos y descansos']])map.layers.push({id,name,visible:true,locked:false});
const retained=new Map(template.objects.map(o=>[o.id,structuredClone(o)]));
for(const o of source.objects)if(!o.id.startsWith('paisaje_'))retained.set(o.id,structuredClone(o));
map.objects=[...retained.values()].filter(o=>!o.id.startsWith('detail_region_brumaluz_')&&!(Math.hypot(o.position[0]-center[0],o.position[2]-center[1])<60)&&!(/^world_/.test(o.id)&&/city\/trees?_/.test(o.asset)&&api.arboledaDistance(o.position[0],o.position[2])<1.04));
for(const o of map.objects){const[x,y,z]=o.position,original=originalObjects.get(o.id),offset=original?original.position[1]-sample(base,original.position[0],original.position[2]):y-sample(before,x,z);o.position[1]=o.conform?offset:ground(x,z)+offset;}
for(const m of map.markers){m.position[1]=ground(m.position[0],m.position[2]);if(m.id.startsWith('entrada_brumaluz_'))m.trigger='walk';}
let serial=0;
const add=(asset,x,z,s=1,yaw=0,layer='paisaje_bosque',collision='auto',y=ground(x,z))=>{const object={id:`paisaje_${serial++}`,asset,layer,position:[x,y,z],rotation:[0,yaw,0],scale:Array.isArray(s)?s:[s,s,s],collision};map.objects.push(object);return object;};
let walls=0;
const vertices=Array.from({length:6},(_,k)=>[center[0]+Math.cos(k*Math.PI/3)*50,center[1]+Math.sin(k*Math.PI/3)*50]);
for(let k=0;k<6;k++){
 const a=vertices[k],b=vertices[(k+1)%6],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),inset=2.4,steps=Math.ceil((length-inset*2)/1.9),span=(length-inset*2)/steps;
 for(let n=0;n<steps;n++){const d=inset+(n+.5)*span,x=a[0]+dx/length*d,z=a[1]+dz/length*d;add('city/wall_straight',x,z,[(span+.12)/2,4.35,1.5],Math.atan2(-dz,dx),'paisaje_capital');walls++;}
}
for(const o of capital.objects.filter(o=>o.asset==='city/wall_straight_gate'&&!o.hidden)){
 const x=center[0]+o.position[0]*cityScale,z=center[1]+o.position[2]*cityScale,yaw=o.rotation[1];
 map.objects.push({...structuredClone(o),id:`paisaje_capital_${o.id}`,layer:'paisaje_capital',position:[x,ground(x,z)-.03,z],scale:[2.5,4.35,1.5],conform:false,gateClosed:true});
 const dx=x-center[0],dz=z-center[1],l=Math.hypot(dx,dz);
 for(const side of[-1,1])add('city/tower_B',x-dz/l*side*3.1-dx/l*.8,z+dx/l*side*3.1-dz/l*.8,[2.35,3.3,2.35],yaw,'paisaje_capital');
}
add('city/tower_B',center[0]-25,center[1]-25*Math.sqrt(3),[3.4,3.8,3.4],0,'paisaje_capital');
const bridge=add('medieval-builder/objects/bridge',bridgeSite.x,bridgeSite.z,[18,1.5,8],Math.atan2(-bridgeSite.uz,bridgeSite.ux),'paisaje_descanso','auto',.8);bridge.walkable=true;
const deckProfile=[[-1,-.1],[-.71201,.05739],[-.26062,.200617],[.26062,.200617],[.71201,.05739],[1,-.1]];
const deckY=along=>{const x=clamp(along/18,-1,1);for(let k=1;k<deckProfile.length;k++){const[a,ay]=deckProfile[k-1],[b,by]=deckProfile[k];if(x<=b)return .8+(ay+(by-ay)*(x-a)/(b-a))*1.5;}return .65;};
for(let along=-16.5;along<18;along+=3)for(const side of[-1,1]){
 const offset=side*1.95,x=bridgeSite.x+bridgeSite.ux*along-bridgeSite.uz*offset,z=bridgeSite.z+bridgeSite.uz*along+bridgeSite.ux*offset;
 const rail=add('brumaluz-hamlet/objects/fence_oak_panel',x,z,[1.5,.85,1],bridge.rotation[1],'paisaje_descanso','auto',deckY(along)+.12);
 rail.name='Puente del camino · barandilla';rail.walkable=false;
 // Pitch follows each side of the arch; the central span stays level.
 rail.rotation[2]=Math.atan2(deckY(Math.min(18,along+1.5))-deckY(Math.max(-18,along-1.5)),3);
}
for(const along of[-23,23])for(const side of[-1,1]){
 const x=bridgeSite.x+bridgeSite.ux*along-bridgeSite.uz*side*4.5,z=bridgeSite.z+bridgeSite.uz*along+bridgeSite.ux*side*4.5;
 add('builtin/lamppost',x,z,1,0,'paisaje_descanso');
}
const catalog=JSON.parse(await fs.readFile('src/data/generated/rpg-catalog.json','utf8')),wilderness=JSON.parse(await fs.readFile('src/data/generated/wilderness.json','utf8'));
const protectedPoints=map.markers.filter(m=>['spawn','arrival','portal'].includes(m.type)).map(m=>({x:m.position[0],z:m.position[2],r:m.radius+3}));
for(const p of [...Object.values(catalog.nodes),...wilderness.spawns])if(p.location==='pompelin')protectedPoints.push({x:p.x,z:p.z,r:5});
const boxes=await assetBoxes(),blockers=[];
function radiusOf(o){const b=boxes.get(o.asset);return b?Math.hypot(b.max.x-b.min.x,b.max.z-b.min.z)*Math.max(o.scale[0],o.scale[2])*.5:1;}
for(const o of map.objects)blockers.push({x:o.position[0],z:o.position[2],r:radiusOf(o)});
const at=(array,x,z)=>array[clamp(Math.round((z-origin[1])/cell),0,rows-1)*columns+clamp(Math.round((x-origin[0])/cell),0,columns-1)];
const clear=(x,z,r=2,margin=1)=>ground(x,z)>.1&&at(shore,x,z)>r+4&&at(dist,x,z)>r+5
 &&Math.hypot(x-center[0],z-center[1])>70+r&&!protectedPoints.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+r)
 &&!blockers.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+r+margin)
 &&!villages.some(v=>Math.hypot(x-v.position[0],z-v.position[2])<58+r);
let seed=51983;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
// The original outcrops form the foothills; larger matching silhouettes frame the valley.
let peaks=0;
for(const[x,z,s]of [[905,430,21],[870,600,24],[755,655,23],[570,615,20],[480,425,19],[595,325,18],[880,315,18],[780,575,17],[545,540,18]]){
 if(!clear(x,z,s*1.03,2))continue;
 const peak=add(peaks%2?'city/mountain_B_grass_trees':'city/mountain_A_grass_trees',x,z,s,.25+peaks*.72,'paisaje_rocas');
 blockers.push({x,z,r:radiusOf(peak)});peaks++;
}
let trees=0;
for(const[cx,cz,r]of groves)for(let k=0;k<170;k++){
 const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*r,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,s=7+rnd()*7;
 if(api.arboledaDistance(x,z)<1.04||!clear(x,z,s*.42,1.5))continue;
 const tree=add(`city/tree_single_${k%4?'A':'B'}`,x,z,s,rnd()*Math.PI*2);blockers.push({x,z,r:s*.34});trees++;
 if(k%3===0){tree.asset='brumaluz-arboleda/objects/tree_young_rowan';tree.scale=[1.8,1.8,1.8];blockers.at(-1).r=3.3;}
}
for(const[cx,cz,r]of groves)for(let k=0;k<32;k++){
 const a=rnd()*Math.PI*2,d=(.65+rnd()*.55)*r,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;
 if(api.arboledaDistance(x,z)<1.04||!clear(x,z,1.2,0))continue;
 if(k%5===0){const s=3+rnd()*4;if(clear(x,z,s*.2))add('city/rock_single_C',x,z,s,rnd()*6,'paisaje_rocas');}
 else if(k%4===0)add('forest/objects/Bush_1_A_Color1',x,z,3+rnd()*2,rnd()*6,'paisaje_prados','none');
 else for(let n=0;n<5;n++){
  const px=x+(rnd()-.5)*5,pz=z+(rnd()-.5)*5;if(!clear(px,pz,.35,0))continue;
  add(`mixed-bag/objects/flax_flower_${n%3?'A':'B'}`,px,pz,.45+rnd()*.4,rnd()*6,'paisaje_prados','none');
 }
}
// Willows follow the original river instead of inventing new lakes.
for(let k=0;k<420;k++){
 const x=-960+rnd()*1920,z=-650+rnd()*1330,bank=at(shore,x,z);
 if(bank<9||bank>20||!clear(x,z,3))continue;
 const tree=add('brumaluz-arboleda/objects/tree_weeping_willow',x,z,1.2+rnd()*.4,rnd()*6);blockers.push({x,z,r:radiusOf(tree)});trees++;
}
const river=[ [990,-24],[780,60],[600,141],[435,225],[270,330],[150,480],[-30,450],[-165,405],[-300,480] ];
for(let i=1;i<river.length;i++){
 const a=river[i-1],b=river[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
 for(let d=12;d<length;d+=12)for(const side of[-1,1]){
  const offset=14+rnd()*4,x=a[0]+ux*d-uz*side*offset,z=a[1]+uz*d+ux*side*offset;
  if(!clear(x,z,.5,0))continue;
  if(Math.round(d)%48===0&&clear(x,z,4)){
   const tree=add('brumaluz-arboleda/objects/tree_weeping_willow',x,z,1.2,rnd()*6);blockers.push({x,z,r:4.5});trees++;
  }else{
   add('forest/objects/Grass_2_C_Color1',x,z,1.1+rnd()*.6,rnd()*6,'paisaje_prados','none');
   for(let k=0;k<3;k++)add('forest/objects/Grass_1_C_Color1',x+(rnd()-.5)*4,z+(rnd()-.5)*4,1+rnd(),rnd()*6,'paisaje_prados','none');
  }
  if(d%36===12&&clear(x+3,z+2,1)){const rock=add('forest/objects/Rock_1_A_Color1',x+3,z+2,1.5+rnd()*2,rnd()*6,'paisaje_rocas');blockers.push({x:x+3,z:z+2,r:radiusOf(rock)});}
 }
}
for(const gate of travel){const dx=gate.position[0]-center[0],dz=gate.position[2]-center[1],l=Math.hypot(dx,dz),ux=dx/l,uz=dz/l;
 for(const side of [-1,1])add('builtin/lamppost',center[0]+ux*66-uz*side*6.5,center[1]+uz*66+ux*side*6.5,1.15,0,'paisaje_descanso');
 for(const side of[-1,1])add('brumaluz-hamlet/objects/planter_flower_urn',center[0]+ux*57-uz*side*7,center[1]+uz*57+ux*side*7,1.1,0,'paisaje_descanso');
 add('brumaluz-hamlet/objects/signpost_crossroads',center[0]+ux*76-uz*8,center[1]+uz*76+ux*8,1,Math.atan2(ux,uz),'paisaje_descanso');
 add('builtin/bench',center[0]+ux*85+uz*10,center[1]+uz*85-ux*10,1.2,Math.atan2(-ux,-uz),'paisaje_descanso');
 for(let d=95;d<250;d+=26)for(const side of[-1,1]){
  const x=center[0]+ux*d-uz*side*(13+rnd()*5),z=center[1]+uz*d+ux*side*(13+rnd()*5);
  if(!clear(x,z,3))continue;
  const tree=add(d%3?'brumaluz-arboleda/objects/tree_young_rowan':'city/tree_single_B',x,z,d%3?1.65:10,rnd()*6);blockers.push({x,z,r:3.2});trees++;
  for(let k=0;k<7;k++){const px=x+(rnd()-.5)*9,pz=z+(rnd()-.5)*9;if(clear(px,pz,.3,0))add('mixed-bag/objects/flax_flower_A',px,pz,.55+rnd()*.2,rnd()*6,'paisaje_prados','none');}
 }
}
for(const[x,z,yaw]of [[-226,-146,1.1],[-32,-170,-.6],[-255,40,2],[-70,97,-.4],[-691,-164,1.4]]){
 if(clear(x,z,2)){add('builtin/bench',x,z,1.25,yaw,'paisaje_descanso');add('builtin/lamppost',x+3,z+2,1,0,'paisaje_descanso');}
}
const forest=populateArboleda({map,definition:arboleda,ground,roadDistance:(x,z)=>at(dist,x,z),shoreDistance:(x,z)=>at(shore,x,z),protectedPoints,boxes});
map.terrain=api.encodeTerrain(field);map.description='Pompelín: praderas, colinas y riberas. La Arboleda forma un bosque de copas frondosas con llegada reservada para su futura ciudad. Las Cumbres de Cobre conservan sus montañas originales; Brumaluz muestra sus murallas y puertas cerradas con entrada por proximidad.';
map.settings.loadingTip='Acércate a cualquiera de las cinco puertas de Brumaluz para entrar en la ciudad.';
map.updatedAt=new Date().toISOString();delete map.preview;api.validateMap(map);
await fs.writeFile('src/data/maps/pompelin.json',JSON.stringify(map,null,2)+'\n');
const server=await createServer({cacheDir:'node_modules/.vite-pompelin-build',server:{host:'127.0.0.1',port:4210,strictPort:true,hmr:false,watch:null},logLevel:'error'});
try{
 await server.listen();let result;
 for(let attempt=0;attempt<4;attempt++){
  const response=await fetch('http://127.0.0.1:4210/__dev/maps/__published',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'pompelin'})});result=await response.json();
  if(response.ok)break;if(attempt===3)throw Error(JSON.stringify(result));
  // Windows antivirus/indexers can briefly hold a generated TS module during an atomic rename.
  await new Promise(resolve=>setTimeout(resolve,300));
 }
 console.log(JSON.stringify({objects:map.objects.length,walls,newTrees:trees,forest,peaks,oldMountains:map.objects.filter(o=>/^world_/.test(o.id)&&/mountain/.test(o.asset)).length,proximityGates:travel.length,warnings:result.warnings}));
}finally{await server.close();}
execFileSync(process.execPath,['tools/update-pompelin-geometry.mjs'],{stdio:'inherit'});

// Build the next home with existing Brumaluz assets; save/publish via the editor.
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {readLibraryCatalog} from './library-catalog.mjs';
import {assetBoxes} from './asset-bounds.mjs';
import {mapBlockers} from './rpg-map-blockers.mjs';
import {resolve} from 'node:path';
const server=await createServer({cacheDir:'node_modules/.vite-next-home',server:{host:'127.0.0.1',port:4294,strictPort:true,hmr:false,watch:null},logLevel:'error'});
const round=n=>Math.round(n*1000)/1000;
try{
 await server.listen();
 const request=async(path,options)=>{const r=await fetch(`http://127.0.0.1:4294/__dev/maps/${path}`,options);const data=await r.json();if(!r.ok)throw Error(`${r.status}: ${data.error}`);return{data,etag:r.headers.get('etag')};};
 const catalog=JSON.parse(await readFile('src/data/homes.json','utf8')),home=catalog.homes.olmo;
 const capital=await request('brumaluz');
 const current=await fetch('http://127.0.0.1:4294/__dev/maps/casa_del_olmo');
 let map,revision;
 if(current.ok){map=await current.json();revision=current.headers.get('etag');}
 else{
  if(current.status!==404)throw Error(`Cannot inspect next home: ${current.status}`);
  const assets=new Set(capital.data.objects.filter(o=>o.collision==='auto').map(o=>o.asset));
  const boxes=await assetBoxes({footprint:true,only:assets}),blockers=mapBlockers(capital.data,boxes);
  const blocked=(x,z)=>blockers.some(b=>{const dx=x-b.x,dz=z-b.z,c=Math.cos(b.yaw),s=Math.sin(b.yaw),lx=c*dx-s*dz,lz=s*dx+c*dz;return lx>b.minX-.4&&lx<b.maxX+.4&&lz>b.minZ-.4&&lz<b.maxZ+.4;});
  const building=capital.data.objects.find(o=>o.id==='urbe_026s');
  if(!building||building.asset!=='medieval-builder/objects/house')throw Error('The selected Olmo house changed; review its entrance.');
  const yaw=building.rotation[1],front=boxes.get(building.asset).max.z*building.scale[2];
  const at=offset=>({x:round(building.position[0]+Math.sin(yaw)*(front+offset)),z:round(building.position[2]+Math.cos(yaw)*(front+offset))});
  const entrance=at(1.1),arrival=at(2.5);
  if([entrance,arrival].some(p=>blocked(p.x,p.z)))throw Error('Olmo entrance is blocked. Preserve the city and choose a clear entrance.');
  Object.assign(home.entrance,entrance);Object.assign(home.cityEntrance,entrance);home.exit.targetX=arrival.x;home.exit.targetZ=arrival.z;
  await writeFile('src/data/homes.json',JSON.stringify(catalog,null,2)+'\n');
  map=JSON.parse(await readFile('src/data/maps/plantilla_casa_peq.json','utf8'));
  Object.assign(map,{id:home.location,name:home.label,description:home.description,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});delete map.preview;
  map.settings={...map.settings,region:'Brumaluz · Barrio del Olmo',loadingTip:'Tu habitación de la posada sigue siendo tuya. Los muebles se trasladan recogiéndolos en la mochila.'};
  const library=await readLibraryCatalog(resolve('src/assets/library')),defs=new Map(library.assets.map(a=>[a.id,a]));
  function fit(asset,id,x,z,width,depth,height,solid=true,y=0){
   const b=defs.get(asset)?.bounds;if(!b)throw Error(`Missing home asset ${asset}`);
   const size=b.max.map((v,i)=>v-b.min[i]),scale=[width/size[0],height/size[1],depth/size[2]];
   const center=b.min.map((v,i)=>(v+b.max[i])/2*scale[i]);
   map.objects.push({id,asset,layer:'atrezo',position:[x-center[0],y-b.min[1]*scale[1],z-center[2]],rotation:[0,0,0],scale,collision:'none'});
   if(solid)map.colliders.push({id:`solid_${id}`,name:id,layer:'atrezo',shape:'box',position:[x,y,z],rotationY:0,size:[width,height,depth],walkable:false});
  }
  let tile=0;for(let x=-2.6;x<=2.6;x+=2.6)for(let z=-2.6;z<=2.6;z+=2.6)fit('dungeon/objects/floor_wood_large_dark',`floor_${++tile}`,x,z,2.6,2.6,.06,false,-.06);
  fit('dungeon/objects/bed_decorated','olmo_bed',home.bed.x,home.bed.z,1.5,2,.85);
  fit('dungeon/objects/chest','olmo_chest',home.chest.x,home.chest.z,1.1,.7,.68);
  map.markers=[
   {id:'spawn',type:'spawn',name:'Entrada',layer:'logica',position:[0,0,2.5],rotationY:Math.PI,radius:1},
   {id:'desde_brumaluz',type:'arrival',name:'Desde el Barrio del Olmo',layer:'logica',position:[0,0,2.5],rotationY:Math.PI,radius:1},
   {id:'home_exit_olmo',type:'portal',name:'Salir al Barrio del Olmo',layer:'logica',position:[0,0,3],rotationY:0,radius:1.1,target:{map:'brumaluz',arrival:'desde_casa_del_olmo'},trigger:'interact'},
   {id:'luz_olmo',type:'light',name:'Luz del hogar',layer:'logica',position:[0,3,0],rotationY:0,radius:9}
  ];
  const saved=await request(home.location,{method:'PUT',headers:{'content-type':'application/json','if-none-match':'*'},body:JSON.stringify(map)});revision=saved.etag;
 }
 // Keep the room readable at night, using the same warm lights as the workshops.
 // Preserve authored furniture and any explicit colour chosen in the editor.
 let lightingChanged=false;const central=map.markers.find(m=>m.id==='luz_olmo');
 if(central&&!central.color){central.color='#ffe2b4';lightingChanged=true;}
 if(!map.markers.some(m=>m.id==='luz_lectura_olmo')){map.markers.push({id:'luz_lectura_olmo',type:'light',name:'Luz del rincón de lectura',layer:'logica',position:[1.5,2.2,-1.5],rotationY:0,radius:7,color:'#ffe2b4'});lightingChanged=true;}
 if(lightingChanged){const saved=await request(home.location,{method:'PUT',headers:{'content-type':'application/json','if-match':revision},body:JSON.stringify(map)});revision=saved.etag;}
 const entrance=home.entrance,arrival=home.exit;
 for(const marker of [
  {id:'desde_casa_del_olmo',type:'arrival',name:'Desde Casa del Olmo',layer:'logica',position:[arrival.targetX,0,arrival.targetZ],rotationY:-.524,radius:1},
  {id:'home_olmo',type:'portal',name:'Casa del Olmo',layer:'logica',position:[entrance.x,0,entrance.z],rotationY:0,radius:2.2,target:{map:home.location,arrival:'desde_brumaluz'},trigger:'interact'}
 ]){const existing=capital.data.markers.find(m=>m.id===marker.id);if(existing&&JSON.stringify(existing)!==JSON.stringify(marker))throw Error(`${marker.id} changed; preserve the authored marker.`);if(!existing)capital.data.markers.push(marker);}
 const saved=await request('brumaluz',{method:'PUT',headers:{'content-type':'application/json','if-match':capital.etag},body:JSON.stringify(capital.data)});
 // Publish arrivals before their reciprocal portals. The editor reports a temporary
 // warning until the other side is published, without dropping either connection.
 await request('__published',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'brumaluz',revision:saved.etag})});
 await request('__published',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:home.location,revision})});
 const boxes=await assetBoxes({footprint:true,only:new Set(map.objects.filter(o=>o.collision==='auto').map(o=>o.asset))});
 const blockers=mapBlockers(map,boxes);
 await writeFile('supabase/server/19c-home-map.sql',`-- Generated by tools/connect-next-home.mjs; only the new home collision map.\ndelete from public.rpg_blockers where map='${home.location}';\ninsert into public.rpg_blockers values\n${blockers.map(b=>`('${b.map}',${b.x},${b.z},${b.yaw},${b.minX},${b.maxX},${b.minZ},${b.maxZ})`).join(',\n')};\n`);
 console.log(JSON.stringify({home:home.id,entrance:home.entrance,area:46.24,blockers:blockers.length,published:'local'}));
}finally{await server.close();}

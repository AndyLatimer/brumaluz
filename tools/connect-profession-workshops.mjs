// Save and publish through the local map editor API, preserving existing map content.
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {assetBoxes} from './asset-bounds.mjs';
import {mapBlockers} from './rpg-map-blockers.mjs';
import {workshopMetadata} from './build-profession-workshops.mjs';

export const ARTISAN_DISTRICT={id:'urbe_barrio_3',name:'Barrio de los Artesanos',x:-103.923,z:-60,radius:45};
const anchors={herreria:[-108,-32],peleteria:[-120,-42],sastreria:[-113,-42],carpinteria:[-123,-60],ebanisteria:[-114,-72],joyeria:[-96,-54],alquimia:[-90,-46],encantamiento:[-100,-76],cocina:[-106,-63],minero:[-125,-49],lenador:[-130,-32],recolector:[-92,-64]};
const r=value=>Math.round(value*1000)/1000;

export async function workshopConnections(capital){
 const assets=new Set(capital.objects.filter(o=>o.collision==='auto').map(o=>o.asset));
 const boxes=await assetBoxes({footprint:true,only:assets}),blockers=mapBlockers(capital,boxes),used=new Set();
 const heights=Buffer.from(capital.terrain.heights,'base64'),terrain=capital.terrain;
 const ground=(x,z)=>{
  const fx=Math.max(0,Math.min(terrain.columns-1,(x-terrain.origin[0])/terrain.cell)),fz=Math.max(0,Math.min(terrain.rows-1,(z-terrain.origin[1])/terrain.cell));
  const i=Math.min(terrain.columns-2,Math.floor(fx)),j=Math.min(terrain.rows-2,Math.floor(fz)),a=fx-i,b=fz-j;
  return [[i,j,(1-a)*(1-b)],[i+1,j,a*(1-b)],[i,j+1,(1-a)*b],[i+1,j+1,a*b]].reduce((sum,[i,j,w])=>sum+heights.readInt16LE((j*terrain.columns+i)*2)/100*w,0);
 };
 const blocked=(x,z,margin=.4)=>blockers.some(b=>{
  const dx=x-b.x,dz=z-b.z,c=Math.cos(b.yaw),s=Math.sin(b.yaw),lx=c*dx-s*dz,lz=s*dx+c*dz;
  return lx>b.minX-margin&&lx<b.maxX+margin&&lz>b.minZ-margin&&lz<b.maxZ+margin;
 });
 const candidates=capital.objects.filter(o=>!o.hidden&&/Barrio de los (Canteros|Artesanos)/.test(o.name??'')&&Math.hypot(o.position[0]-ARTISAN_DISTRICT.x,o.position[2]-ARTISAN_DISTRICT.z)<ARTISAN_DISTRICT.radius-3&&/^(city\/(home_[AB]|blacksmith|lumbermill|watermill|windmill)|medieval-builder\/objects\/(house|lumbermill))$/.test(o.asset));
 const result=[];
 for(const [job,meta]of Object.entries(workshopMetadata)){
  const anchor=anchors[job];let entrance;
  const sorted=candidates.filter(o=>!used.has(o.id)).sort((a,b)=>{
   const score=o=>Math.hypot(o.position[0]-anchor[0],o.position[2]-anchor[1])+(job==='herreria'&&!o.asset.includes('blacksmith')?18:0)+(job==='lenador'&&!o.asset.includes('lumbermill')?10:0);
   return score(a)-score(b);
  });
  for(const building of sorted){
   const box=boxes.get(building.asset);if(!box)continue;
   const yaw=building.rotation[1],front=box.max.z*building.scale[2];
   for(const offset of [.7,1.1,1.5]){
    const x=building.position[0]+Math.sin(yaw)*(front+offset),z=building.position[2]+Math.cos(yaw)*(front+offset);
    const ax=building.position[0]+Math.sin(yaw)*(front+2.15),az=building.position[2]+Math.cos(yaw)*(front+2.15);
    const free=!blocked(x,z)&&!blocked(ax,az)&&[.4,.8,1.2,1.6,2].every(t=>!blocked(x+Math.sin(yaw)*t,z+Math.cos(yaw)*t));
    if(!free||Math.hypot(x-ARTISAN_DISTRICT.x,z-ARTISAN_DISTRICT.z)>ARTISAN_DISTRICT.radius||result.some(w=>Math.hypot(w.entrance.x-x,w.entrance.z-z)<5)||capital.markers.some(m=>m.type==='portal'&&!m.id.startsWith('taller_')&&Math.hypot(m.position[0]-x,m.position[2]-z)<7))continue;
    entrance={buildingId:building.id,asset:building.asset,x:r(x),z:r(z),y:r(ground(x,z)),yaw,radius:2.2,returnX:r(ax),returnZ:r(az),returnY:r(ground(ax,az))};break;
   }
   if(entrance)break;
  }
  if(!entrance)throw Error(`No clear building entrance for ${job}`);
  used.add(entrance.buildingId);result.push({...meta,entrance});
 }
 return result;
}

export function workshopStations(workshops){
 const stations=Object.fromEntries(workshops.map(w=>[w.job,{id:w.job,job:w.job,label:w.name,location:w.mapId,...w.station}]));
 stations.reparacion={...stations.herreria,id:'reparacion',label:'Herrería · herramientas y reparaciones'};return stations;
}

async function main(){
 const apply=process.argv.includes('--apply');
 const server=await createServer({cacheDir:'node_modules/.vite-workshop-publication',server:{host:'127.0.0.1',port:4236,strictPort:true,hmr:false,watch:null},logLevel:'error'});
 try{
  await server.listen();const origin='http://127.0.0.1:4236';
  const request=async(path,options)=>{const response=await fetch(origin+'/__dev/maps/'+path,options),data=await response.json();if(!response.ok)throw Error(`${response.status}: ${data.error}`);return {data,etag:response.headers.get('etag')};};
  const {data:capital,etag}=await request('brumaluz'),workshops=await workshopConnections(capital);
  if(!apply){console.log(JSON.stringify({mode:'read-only',workshops:workshops.map(w=>({job:w.job,building:w.entrance.buildingId,entrance:[w.entrance.x,w.entrance.z],map:w.mapId}))},null,2));return;}
  // Retitle the existing district in place; geometry and terrain remain untouched.
  for(const item of [...capital.objects,...capital.markers,...capital.colliders])for(const field of ['name','text'])if(typeof item[field]==='string')item[field]=item[field].replaceAll('Barrio de los Canteros',ARTISAN_DISTRICT.name).replaceAll('barrio de los canteros','barrio de los artesanos').replaceAll('Casa de los Canteros','Casa de los Artesanos');
  const district=capital.markers.find(m=>m.id===ARTISAN_DISTRICT.id);
  if(!district)throw Error('Missing existing artisan district zone');
  district.name=ARTISAN_DISTRICT.name;district.text='Barrio de los Artesanos · los doce talleres y sus maestros de oficio';
  for(const w of workshops){const building=capital.objects.find(o=>o.id===w.entrance.buildingId);building.name=`${ARTISAN_DISTRICT.name} · ${w.name}`;}
  if(!capital.layers.some(l=>l.id==='oficios'))capital.layers.push({id:'oficios',name:'Accesos a talleres de oficios',visible:true,locked:false});
  for(const w of workshops){
   const p=w.entrance,id=`taller_${w.job}`,arrival=`desde_taller_${w.job}`;
   capital.markers=capital.markers.filter(m=>m.id!==id&&m.id!==arrival);
   capital.markers.push(
    {id,type:'portal',name:w.name,layer:'oficios',position:[p.x,p.y,p.z],rotationY:p.yaw,radius:p.radius,target:{map:w.mapId,arrival:'desde_brumaluz'},trigger:'interact'},
    {id:arrival,type:'arrival',name:`Desde ${w.name}`,layer:'oficios',position:[p.returnX,p.returnY,p.returnZ],rotationY:p.yaw+Math.PI,radius:1},
   );
  }
  capital.updatedAt=new Date().toISOString();
  const saved=await request('brumaluz',{method:'PUT',headers:{'content-type':'application/json','if-match':etag},body:JSON.stringify(capital)});
  await request('__published',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'brumaluz',revision:saved.etag})});
  for(const w of workshops){
   const {data,etag}=await request(w.mapId);
   const bank=data.markers.find(m=>m.text===`profession:${w.job}`),master=data.markers.find(m=>m.type==='npc'&&m.npcId===w.masterId);
   if(!bank||!master)throw Error(`Missing bank or master in ${w.mapId}`);
   w.station={x:bank.position[0],z:bank.position[2],radius:bank.radius};w.master={x:master.position[0],z:master.position[2],yaw:master.rotationY};
   const saved=await request(w.mapId,{method:'PUT',headers:{'content-type':'application/json','if-match':etag},body:JSON.stringify(data)});
   await request('__published',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:w.mapId,revision:saved.etag})});
  }
  await writeFile('src/data/workshops.json',JSON.stringify({version:1,workshops},null,2)+'\n');
  const catalog=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8'));catalog.stations=workshopStations(workshops);
  await writeFile('src/data/generated/rpg-catalog.json',JSON.stringify(catalog));
  const literal=JSON.stringify(catalog).replaceAll("'","''");
  await writeFile('supabase/server/18-rpg-catalog.sql',`-- Generated RPG catalog and placement.\ncreate or replace function public.game_rpg_catalog() returns jsonb language sql immutable set search_path='' as $catalog$ select '${literal}'::jsonb $catalog$;\nrevoke all on function public.game_rpg_catalog() from public,anon,authenticated;\n`);
  console.log(JSON.stringify({savedViaEditor:true,published:workshops.map(w=>w.mapId),capitalObjectsPreserved:capital.objects.length,stations:Object.keys(catalog.stations).length}));
 }finally{await server.close();}
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/connect-profession-workshops.mjs'))await main();

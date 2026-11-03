// Adds the missing exit using the editor's revision-checked save/publication API.
import {createServer} from 'vite';
const server=await createServer({cacheDir:'node_modules/.vite-home-publication',server:{host:'127.0.0.1',port:4291,strictPort:true,hmr:false,watch:null},logLevel:'error'});
try{
 await server.listen();const origin='http://127.0.0.1:4291';
 const request=async(path,options)=>{const r=await fetch(`${origin}/__dev/maps/${path}`,options),data=await r.json();if(!r.ok)throw Error(`${r.status}: ${data.error}`);return{data,etag:r.headers.get('etag')};};
 for(const [id,marker]of [
  ['posada_lucero_del_alba',{id:'desde_mi_habitacion',type:'arrival',name:'Desde mi habitación',layer:'logica',position:[-5.5,0,6],rotationY:Math.PI/2,radius:1}],
  ['habitacion_posada_lucero_del_alba',{id:'home_exit_lucero',type:'portal',name:'Volver a la posada',layer:'logica',position:[1,0,2],rotationY:0,radius:1,target:{map:'posada_lucero_del_alba',arrival:'desde_mi_habitacion'},trigger:'interact'}],
 ]){
  const {data,etag}=await request(id);const existing=data.markers.find(m=>m.id===marker.id);
  if(existing&&JSON.stringify(existing)!==JSON.stringify(marker))throw Error(`The authored marker ${marker.id} already differs; preserve it and review manually.`);
  let revision=etag;
  if(!existing){data.markers.push(marker);data.updatedAt=new Date().toISOString();const saved=await request(id,{method:'PUT',headers:{'content-type':'application/json','if-match':etag},body:JSON.stringify(data)});revision=saved.etag;}
  await request('__published',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,revision})});
 }
 console.log('Room exit and inn arrival saved and published locally; existing objects preserved.');
}finally{await server.close();}

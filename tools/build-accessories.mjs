import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {motifs} from './equipment-motifs.mjs';
const items=JSON.parse(await fs.readFile('src/data/accessories.json','utf8'));
const original=await fs.readFile('scripts/build-medieval-wardrobe.mjs','utf8');
const prefix=original.slice(0,original.indexOf('const SEGMENTS = 20;')).replace('import { prune }','import { prune, weld, dedup }').replace('  const output = document.createMesh(name);',`
 const groups=new Map();for(const p of components){p.geometry.deleteAttribute('uv');if(!groups.has(p.material))groups.set(p.material,[]);groups.get(p.material).push(p.geometry.index?p.geometry.toNonIndexed():p.geometry)}
 components=[...groups].map(([material,list])=>({material,geometry:mergeGeometries(list)}));
 const output = document.createMesh(name);`);
await fs.mkdir('src/assets/models/items/accessories',{recursive:true});
const temp=path.resolve('scripts/.generated-accessory.mjs');
try{for(const item of items){
 const design=`
 const C=${JSON.stringify(item)},t=C.theme;
 for(const [name,color] of Object.entries({brass:C.metal,plate:C.dark,gem:C.gem,leather:C.cloth})){
  let m=materials.get(name);if(!m){m=document.createMaterial(name);materials.set(name,m)}
  m.setBaseColorFactor([...new THREE.Color(color).toArray(),1]).setMetallicFactor(name==='brass'?.65:0).setRoughnessFactor(name==='brass'?.36:.65);
 }
 const box=(x,y,z,w,h,d)=>new THREE.BoxGeometry(w,h,d).translate(x,y,z);
 const tube=(a,b,r)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A);return new THREE.CylinderGeometry(r,r,v.length(),8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize())).translate(...A.add(B).multiplyScalar(.5).toArray())};
 ${motifs}
 const parts=[],put=(g,m='brass')=>parts.push(piece(g,m));
 if(C.slot==='pendant'){
  // Joined individual chain links, then a bezel, enamel backing, heraldry and drop.
  for(let j=0;j<26;j++){
   const a=j/26*Math.PI*2,x=Math.cos(a)*.205,y=1.18-Math.max(0,Math.sin(a))*.17,z=Math.sin(a)*.22+.045;
   put(new THREE.TorusGeometry(.012,.0032,5,8).rotateY(a).rotateX(j%2?Math.PI/3:0).translate(x,y,z));
  }
  put(tube([-.15,1.12,.19],[0,.99,.37],.004));put(tube([.15,1.12,.19],[0,.99,.37],.004));
  put(new THREE.CylinderGeometry(.072,.072,.014,12).rotateX(Math.PI/2).translate(0,.94,.375),'plate');
  put(new THREE.TorusGeometry(.07,.006,6,20).translate(0,.94,.385));parts.push(...emblem(0,.94,.395,.048));
  put(new THREE.OctahedronGeometry(.018).scale(1,1.6,.6).translate(0,.84,.385),'gem');
 }else if(C.slot==='ring'){
  put(new THREE.TorusGeometry(.031,.006,8,24).rotateY(Math.PI/2).translate(.886,1.105,.015));
  put(new THREE.TorusGeometry(.032,.002,5,24).rotateY(Math.PI/2).translate(.875,1.105,.015));
  put(box(.886,1.105,.048,.039,.044,.012),'plate');parts.push(...emblem(.886,1.105,.061,.021));
  for(const sign of [-1,1])put(box(.886+sign*.016,1.105,.062,.005,.03,.016));
 }else{
  put(new THREE.TorusGeometry(.026,.005,6,14).translate(.29,.80,.24));
  put(tube([.29,.78,.24],[.29,.72,.25],.007),'leather');
  put(new THREE.CylinderGeometry(.063,.063,.018,12).rotateX(Math.PI/2).translate(.29,.675,.26),'plate');
  put(new THREE.TorusGeometry(.064,.006,6,20).translate(.29,.675,.277));
  parts.push(...emblem(.29,.675,.29,.046));
  for(const sign of [-1,1]){put(tube([.29+sign*.03,.63,.26],[.29+sign*.04,.57,.26],.003));put(new THREE.OctahedronGeometry(.012).translate(.29+sign*.04,.56,.26),'gem')}
 }
 mesh(C.id,parts,()=>[[C.slot==='ring'?'hand.l':C.slot==='pendant'?'chest':'hips',1]]);
 await document.transform(weld(),dedup(),prune());await io.write(${JSON.stringify(path.resolve('src/assets/models/items/accessories',item.id+'.glb'))},document);
 `;
 await fs.writeFile(temp,prefix+design);await import(pathToFileURL(temp).href+'?id='+item.id);
}}finally{await fs.unlink(temp).catch(()=>{});}
console.log('Built 30 collection-specific accessories.');

import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {tailoredAccessories} from './tailored-accessories.mjs';
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
 ${tailoredAccessories}
 mesh(C.id,parts,()=>[[C.slot==='ring'?'hand.l':C.slot==='pendant'?'chest':'hips',1]]);
 await document.transform(weld(),dedup(),prune());await io.write(${JSON.stringify(path.resolve('src/assets/models/items/accessories',item.id+'.glb'))},document);
 `;
 await fs.writeFile(temp,prefix+design);await import(pathToFileURL(temp).href+'?id='+item.id);
}}finally{await fs.unlink(temp).catch(()=>{});}
console.log('Built '+items.length+' collection-specific accessories.');

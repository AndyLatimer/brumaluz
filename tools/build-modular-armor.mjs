// Split the tailored patterns into five independent, rig-compatible GLBs per class/set.
import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {prune,weld,dedup} from '@gltf-transform/functions';
const io=new NodeIO(), folder='src/assets/models/wardrobe/classes';
const sets=JSON.parse(await fs.readFile('src/data/outfits.json','utf8'));
await fs.mkdir(folder+'/modular',{recursive:true});
function split(document,nodeName,newName,predicate){
 const root=document.getRoot(),source=root.listNodes().find(n=>n.getName()===nodeName);
 const output=document.createMesh(newName);
 for(const primitive of source.getMesh().listPrimitives()){
  const index=primitive.getIndices(),positions=primitive.getAttribute('POSITION'),indices=[];
  for(let i=0;i<(index?.getCount()??positions.getCount());i+=3){
   const tri=[0,1,2].map(j=>index?index.getScalar(i+j):i+j),p=tri.map(j=>positions.getElement(j,[]));
   const center=[0,1,2].map(j=>(p[0][j]+p[1][j]+p[2][j])/3);
   if(predicate(center))indices.push(...tri);
  }
  if(indices.length)output.addPrimitive(primitive.clone().setIndices(document.createAccessor(newName+' indices').setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(root.listBuffers()[0])));
 }
 const node=document.createNode(newName).setMesh(output).setSkin(source.getSkin());source.getParentNode().addChild(node);
}
const nodes={
 head:['suit-head'],chest:['medieval-tunic','medieval-sleeve-l','medieval-sleeve-r','suit-upperarm-l','suit-upperarm-r'],
 hands:['suit-glove-left','suit-glove-right','suit-bracer-l','suit-bracer-r'],
 legs:['suit-foundation','suit-trousers-l','suit-trousers-r'],feet:['medieval-leg-l','medieval-leg-r','suit-boot-trim-l','suit-boot-trim-r'],
};
for(const set of sets){
 const file=folder+'/'+set.id+'.glb',doc=await io.read(file),root=doc.getRoot();
 // Repeated execution starts from the same named patterns rather than adding duplicates.
 for(const n of [...root.listNodes()])if(/suit-(trousers|boot-trim|upperarm|bracer|glove)-/.test(n.getName()))n.dispose();
 for(const side of ['l','r']){
  split(doc,'suit-leg-detail-'+side,'suit-trousers-'+side,p=>p[1]>=.235);
  split(doc,'suit-leg-detail-'+side,'suit-boot-trim-'+side,p=>p[1]<.235);
  split(doc,'suit-arm-detail-'+side,'suit-bracer-'+side,p=>Math.abs(p[0])>.60);
  split(doc,'suit-arm-detail-'+side,'suit-upperarm-'+side,p=>Math.abs(p[0])<=.60);
 }
 for(const side of ['left','right']){
  const source=root.listNodes().find(n=>n.getName()==='anatomy-hand-'+side);
  const mesh=doc.createMesh('glove '+side);
  for(const p of source.getMesh().listPrimitives())mesh.addPrimitive(p.clone().setMaterial(root.listMaterials().find(m=>m.getName()==='leather')));
  source.getParentNode().addChild(doc.createNode('suit-glove-'+side).setMesh(mesh).setSkin(source.getSkin()));
 }
 await io.write(file,doc);
 for(const [slot,keep] of Object.entries(nodes)){
  const part=await io.read(file);
  for(const n of [...part.getRoot().listNodes()])if(n.getMesh()&&!keep.includes(n.getName()))n.dispose();
  await part.transform(weld(),dedup(),prune());
  const id=slot==='chest'?set.id:`${set.id}_${slot}`;
  await io.write(folder+'/modular/'+id+'.glb',part);
 }
}
await fs.writeFile(folder+'/modular/nodes.json',JSON.stringify(nodes,null,2));
console.log('Built 250 independently equippable armour models.');

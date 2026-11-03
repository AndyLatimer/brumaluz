import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { build } from 'esbuild';
import { NodeIO } from '@gltf-transform/core';
const bundle=await build({stdin:{contents:"export {furnitureGeometry} from './src/world/homeFurniture';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const {furnitureGeometry}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const definitions=JSON.parse(await readFile('src/data/homeFurnishings.json','utf8'));
const catalog=JSON.parse(await readFile('src/assets/library/brumaluz-home/catalog.json','utf8'));
const digest=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');

test('all furniture qualities have finite smooth normals, safe UVs and fit their placement footprints',()=>{
 for(const [kind,def] of Object.entries(definitions))for(let tier=0;tier<6;tier++) {
  const g=furnitureGeometry(kind,tier),box=g.boundingBox;
  assert.ok(box.min.y>=-.0001,`${kind}: grounded`);
  assert.ok(box.max.y<=def.height+.003,`${kind}: height ${box.max.y}`);
  assert.ok(Math.max(Math.abs(box.min.x),Math.abs(box.max.x))<=def.width/2+.001,`${kind}: width`);
  assert.ok(Math.max(Math.abs(box.min.z),Math.abs(box.max.z))<=def.depth/2+.001,`${kind}: depth ${box.min.z} / ${box.max.z}`);
  assert.ok(g.index.count/3<24000,`${kind}: triangle budget`);
  for(const name of ['position','normal','color','uv'])assert.ok([...g.attributes[name].array].every(Number.isFinite),`${kind}: ${name} finite`);
  const normals=g.attributes.normal;
  for(let i=0;i<normals.count;i++)assert.ok(Math.abs(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))-1)<1e-4,`${kind}: unit normals`);
  const uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++)assert.ok(uv.getX(i)>0&&uv.getX(i)<1&&uv.getY(i)>0&&uv.getY(i)<1,`${kind}: atlas padding`);
  g.dispose();
 }
});

test('no degenerate or duplicate surface triangles at any quality',()=>{
 for(const kind of Object.keys(definitions))for(let tier=0;tier<6;tier++) {
  const g=furnitureGeometry(kind,tier),p=g.attributes.position,index=g.index,seen=new Set();
  for(let i=0;i<index.count;i+=3) {
   const tri=[0,1,2].map(j=>[p.getX(index.getX(i+j)),p.getY(index.getX(i+j)),p.getZ(index.getX(i+j))]);
   const [a,b,c]=tri,u=b.map((n,k)=>n-a[k]),v=c.map((n,k)=>n-a[k]);
   assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-9,`${kind}: triangle area`);
   const key=tri.map(p=>p.map(x=>Math.round(x*1e7)).join(',')).sort().join('|');
   assert.ok(!seen.has(key),`${kind}: duplicate surface`);seen.add(key);
  }
  g.dispose();
 }
});

test('exported GLBs have the exact game geometry, embedded PBR maps and opaque materials',async()=>{
 const io=new NodeIO();assert.equal(catalog.assets.length,Object.keys(definitions).length);
 for(const entry of catalog.assets) {
  const bytes=await readFile(`src/assets/library/${entry.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  const doc=await io.readBinary(bytes),root=doc.getRoot();
  assert.equal(root.listMeshes().length,1);
  const mesh=root.listMeshes()[0];assert.equal(mesh.listPrimitives().length,1);
  const primitive=mesh.listPrimitives()[0],material=primitive.getMaterial(),g=furnitureGeometry(entry.name,0);
  for(const [name,semantic] of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0'],['color','COLOR_0']])assert.equal(digest(g.attributes[name].array),digest(primitive.getAttribute(semantic).getArray()),`${entry.name}: ${name} parity`);
  assert.equal(material.getAlphaMode(),'OPAQUE');assert.equal(material.getDoubleSided(),false);
  assert.ok(material.getBaseColorTexture());assert.ok(material.getMetallicRoughnessTexture());assert.ok(material.getEmissiveTexture());
  assert.ok(root.listTextures().every(texture=>texture.getImage()?.byteLength>1000));
  g.dispose();
 }
});

test('all furniture families have six craftable qualities and an icon, including the new reading chair seat',async()=>{
 const rpg=JSON.parse(await readFile('src/data/generated/rpg-catalog.json','utf8'));
 for(const kind of Object.keys(definitions))for(let tier=0;tier<6;tier++) {
  const id=`mueble_${kind}_${tier}`,item=rpg.items[id],recipe=rpg.recipes[id];
  assert.equal(item?.furniture,kind,id);assert.equal(item.tier,tier);
  assert.ok(item.icon?.length>100,`${id}: inventory artwork`);
  assert.equal(recipe?.output,id);assert.equal(recipe.tier,tier);assert.equal(recipe.job,'ebanisteria');
  assert.equal(recipe.source,tier===5?'drop':'trainer');
  assert.ok(Object.entries(recipe.ingredients).every(([id,n])=>rpg.items[id]&&Number.isInteger(n)&&n>0));
 }
 assert.equal(definitions.butaca.seat,.49);
 const sql=await readFile('supabase/server/19b-cozy-life.sql','utf8');
 assert.ok(sql.includes('"butaca"')&&sql.includes('"jardinera"'),'server home placement definitions regenerated');
});

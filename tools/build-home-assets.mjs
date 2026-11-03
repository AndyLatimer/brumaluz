// Export the exact game geometry and atlases, including UVs and PBR channels.
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
const pack='brumaluz-home',directory=`src/assets/library/${pack}`;
const definitions=JSON.parse(await readFile('src/data/homeFurnishings.json','utf8'));
const bundle=await build({stdin:{contents:"export {furnitureGeometry} from './src/world/homeFurniture';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const {furnitureGeometry}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
await mkdir(`${directory}/objects`,{recursive:true});
const images=await Promise.all(['color','orm','emissive'].map(name=>readFile(`${directory}/textures/home-${name}.png`)));
const assets=[],io=new NodeIO();
for(const [name,definition] of Object.entries(definitions)) {
  const geometry=furnitureGeometry(name,0),doc=new Document(),buffer=doc.createBuffer();
  const texture=(name,image)=>doc.createTexture(name).setImage(image).setMimeType('image/png');
  const color=texture('home-color',images[0]),orm=texture('home-orm',images[1]),emissive=texture('home-emissive',images[2]);
  const material=doc.createMaterial('Brumaluz · madera, lino y forja')
    .setBaseColorTexture(color).setMetallicRoughnessTexture(orm).setMetallicFactor(1).setRoughnessFactor(1)
    .setEmissiveTexture(emissive).setEmissiveFactor([.8,.8,.8]);
  for(const info of [material.getBaseColorTextureInfo(),material.getMetallicRoughnessTextureInfo(),material.getEmissiveTextureInfo()])info.setMinFilter(9987).setMagFilter(9729).setWrapS(33071).setWrapT(33071);
  const primitive=doc.createPrimitive().setMaterial(material);
  for(const [attribute,semantic,type] of [['position','POSITION','VEC3'],['normal','NORMAL','VEC3'],['uv','TEXCOORD_0','VEC2'],['color','COLOR_0','VEC3']]) {
    primitive.setAttribute(semantic,doc.createAccessor().setType(type).setArray(geometry.getAttribute(attribute).array).setBuffer(buffer));
  }
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(geometry.index.array).setBuffer(buffer));
  const mesh=doc.createMesh(name).addPrimitive(primitive);
  doc.createScene('Un rincón propio').addChild(doc.createNode(name).setMesh(mesh));
  doc.getRoot().setExtras({author:'Brumaluz',version:3,textures:'Poly Haven CC0 · see textures/sources.json',parts:geometry.userData.parts});
  const bytes=Buffer.from(await io.writeBinary(doc)),path=`${pack}/objects/${name}.glb`;
  await writeFile(`src/assets/library/${path}`,bytes);
  assets.push({id:`${pack}/objects/${name}`,pack,kind:'objects',name,label:definition.label,category:'Hogar y decoración',description:'Mobiliario original con cantos suaves, ensamblajes y materiales PBR de madera, lino y forja.',path,source:`src/world/homeFurniture.ts#${name}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),meshes:1,skins:0,rig:null,animations:[],bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}});
  geometry.dispose();
}
await writeFile(`${directory}/catalog.json`,JSON.stringify({version:3,packs:[{id:pack,label:'Brumaluz · Un rincón propio',author:'Brumaluz',description:`${assets.length} muebles originales con tallas, tejidos bordados, cerámica pintada y detalles cotidianos. Madera y lino CC0. Powered by Poly Haven.`,count:assets.length,source:'src/world/homeFurniture.ts',license:null}],assets},null,2)+'\n');
console.log(JSON.stringify({pack,models:assets.length,bytes:assets.reduce((n,a)=>n+a.bytes,0)}));

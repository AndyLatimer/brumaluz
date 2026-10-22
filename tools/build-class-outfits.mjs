import fs from 'node:fs/promises';
import { outfitTexture, outfitSurfaceTexture, outfitNormalTexture } from './outfit-textures.mjs';
import {createStudio} from './garment-studio.mjs';
import { tailoredPattern } from './tailored-outfit-pattern.mjs';
import { tailoredHeadwear } from './tailored-headwear.mjs';
const collections = [
  ['novicio','de principiante',0,'#8b897d','#aaa797','#797970','#b0aea0'],
  ['artesano','del Caminante',1,'#53664a','#b89564','#777f82','#acbdc1'],
  ['ambar','del Ámbar',2,'#48644b','#d4ac51','#745b3c','#edc16c'],
  ['violeta','del Sello Violeta',3,'#504462','#b9a1c8','#555567','#d6a9eb'],
  ['aurora','de la Aurora',4,'#596b79','#ddc38a','#bac6cc','#ffdf97'],
  ['fuego','del Fuego Primigenio',5,'#543b36','#c38d55','#4e4d53','#ffa65e'],
  ['alba','de la Guardia del Alba',2,'#497a9d','#dfc18b','#afc4cf','#b5e4ee'],
  ['eclipse','del Eclipse',3,'#51405f','#aaa1c3','#646075','#c9a2ee'],
  ['roble','del Roble Errante',1,'#476441','#b99b66','#6b7258','#b6cb83'],
  ['marea','de la Marea Real',4,'#367f8b','#dec28a','#94b7c6','#bce5de'],
  ['forja','de la Forja Estelar',5,'#3e3b4c','#d2ad78','#717489','#ffc17a'],
];
const classes=[['guerrero','Armadura'],['mago','Túnica arcana'],['picaro','Cuero de acechador'],['clerigo','Vestidura sagrada'],['explorador','Atuendo de guardabosques']];
const items=collections.flatMap(([collection,suffix,tier,cloth,trim,metal,gem],theme)=>classes.map(([cls,name],cut)=>({
  id:`traje_${cls}_${collection}`,label:`${name} ${suffix}`,collection,tier,cls,slot:'chest',guard:tier+(cls==='guerrero'?2:cls==='mago'?0:1),
  value:[90,180,360,720,2160,6480][tier],cloth,trim,metal,gem,theme,cut,
})));
await fs.writeFile('src/data/outfits.json',JSON.stringify(items,null,2)+'\n');
// Geometry and UVs are authored together; no temporary source-string rewriting.
const folder='src/assets/models/wardrobe/classes';
await fs.mkdir(folder+'/textures',{recursive:true});
const textureCache=new Map();
const chosen=process.argv.find(v=>v.startsWith('--only='))?.slice(7);
for(const item of items.filter(i=>!chosen||i.collection===chosen)){
 let textures=textureCache.get(item.collection);
 if(!textures){
  textures={};
  for(const name of ['tunic','tunicTrim','plate','leather','darkLeather','trousers','brass','linen','sole']){
   const maps={color:outfitTexture(name,item.collection,item.tier),surface:outfitSurfaceTexture(name,item.collection,item.tier),normal:outfitNormalTexture(name,item.collection,item.tier)};
   textures[name]=maps;
   for(const [kind,data] of Object.entries(maps))await fs.writeFile(folder+'/textures/'+item.collection+'_'+name+(kind==='color'?'':'_'+kind)+'.png',data);
  }
  textureCache.set(item.collection,textures);
 }
 const studio=await createStudio(item);
 tailoredPattern(studio,item);tailoredHeadwear(studio,item);
 await studio.finish(folder+'/'+item.id+'.glb',textures);
 console.log('Sculpted '+item.id);
}
if(!chosen)await import('./build-base-tunic.mjs');

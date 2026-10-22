import fs from 'node:fs/promises';
import {createStudio} from './garment-studio.mjs';
import {tailoredPattern} from './tailored-outfit-pattern.mjs';
import {outfitTexture,outfitSurfaceTexture,outfitNormalTexture} from './outfit-textures.mjs';
// Daily clothes share the same joints and split skirt as equipped garments.
// Colors remain controlled by the character creator, rather than a rarity.
const config={cut:5,tier:1,collection:'medieval',cloth:'#2f5a3a',trim:'#bda052',metal:'#9fa9ab',gem:'#d4b879'};
const studio=await createStudio(config);tailoredPattern(studio,config);
const textures={};
await fs.mkdir('src/assets/models/wardrobe/textures',{recursive:true});
for(const name of ['tunic','tunicTrim','plate','leather','darkLeather','trousers','brass','linen','sole']){
 const maps={color:outfitTexture(name,'medieval',1),normal:outfitNormalTexture(name,'medieval',1),surface:outfitSurfaceTexture(name,'medieval',1)};textures[name]=maps;
 for(const [kind,data] of Object.entries(maps))await fs.writeFile(`src/assets/models/wardrobe/textures/medieval_${name}_${kind}.png`,data);
}
await studio.finish('src/assets/models/wardrobe/medieval.glb',textures);
console.log('Built tailored customizable medieval tunic.');

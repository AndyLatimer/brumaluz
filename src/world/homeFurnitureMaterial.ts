import * as THREE from 'three';
import colorUrl from '../assets/library/brumaluz-home/textures/home-color.png?url';
import ormUrl from '../assets/library/brumaluz-home/textures/home-orm.png?url';
import emissiveUrl from '../assets/library/brumaluz-home/textures/home-emissive.png?url';

let prepared:Promise<void>|undefined;
let maps:{color:THREE.Texture;orm:THREE.Texture;emissive:THREE.Texture}|undefined;
/** Decode before revealing the map: no untextured first frame. */
export function prepareFurnitureMaterials():Promise<void> {
  prepared??=(async()=>{
    const loader=new THREE.TextureLoader();
    const textures=await Promise.all([colorUrl,ormUrl,emissiveUrl].map(url=>loader.loadAsync(url)));
    for(const texture of textures) {
      texture.flipY=false;
      texture.minFilter=THREE.LinearMipmapLinearFilter;
      texture.magFilter=THREE.LinearFilter;
      texture.generateMipmaps=true;
      texture.anisotropy=4;
      texture.needsUpdate=true;
    }
    const [color,orm,emissive]=textures;color.colorSpace=emissive.colorSpace=THREE.SRGBColorSpace;
    maps={color,orm,emissive};
  })().catch(error=>{prepared=undefined;throw error;});
  return prepared;
}
/** Materials belong to each model; decoded atlases stay shared. */
export function furnitureMaterial(lit=true) {
  if(!maps)throw new Error('Las texturas de mobiliario deben prepararse antes de crear los muebles.');
  return new THREE.MeshStandardMaterial({
    name:'Brumaluz · madera, lino y forja',vertexColors:true,
    map:maps.color,roughnessMap:maps.orm,metalnessMap:maps.orm,
    roughness:1,metalness:1,emissiveMap:maps.emissive,
    emissive:'#ffffff',emissiveIntensity:lit?.8:0,
  });
}

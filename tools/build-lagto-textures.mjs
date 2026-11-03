// Offline source preparation. Powered by Poly Haven. Original resources are CC0.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const out='src/assets/library/brumaluz-lagto/textures',art='art/lagto/textures',cache='.art-sources/lagto-textures';
for(const dir of [out,art,cache])await mkdir(dir,{recursive:true});
const code=await readFile('tools/blender/lagto_common.py','utf8');
const palette=[...code.matchAll(/^\s*'([^']+)':\s*'(#[0-9a-f]{6})'/gmi)].map(m=>[m[1],m[2]]);
const sources=[],materials={},size=256,gutter=14,inner=size-gutter*2;
const ids=['granite_tile_03','wood_table_001','brown_leather','metal_plate_02','rough_linen'];
const images={};
for(const id of ids){
 const files=await fetch(`https://api.polyhaven.com/files/${id}`).then(r=>{if(!r.ok)throw Error(`Poly Haven ${r.status}`);return r.json();});
 const info=await fetch(`https://api.polyhaven.com/info/${id}`).then(r=>r.json());
 images[id]={};
 for(const type of ['Diffuse','Rough','nor_gl']){
  const entry=files[type]['1k'].jpg,path=`${cache}/${id}-${type}.jpg`;let bytes;
  try{bytes=await readFile(path);}catch(error){if(error.code!=='ENOENT')throw error;const r=await fetch(entry.url);if(!r.ok)throw Error(`Download ${r.status}`);bytes=Buffer.from(await r.arrayBuffer());await writeFile(path,bytes);}
  if(createHash('md5').update(bytes).digest('hex')!==entry.md5)throw Error(`Texture checksum ${id}/${type}`);
  sources.push({id,type,url:entry.url,authors:info.authors,license:'CC0-1.0',sha256:createHash('sha256').update(bytes).digest('hex')});
  const {data}=await sharp(bytes).resize(inner,inner).removeAlpha().raw().toBuffer({resolveWithObject:true});images[id][type]=data;
 }
}
const layers=[[],[],[],[]];
for(let index=0;index<32;index++){
 const [key,hex]=palette[index]??['stone_mid','#6b6e75'];
 const metal=/copper|bronze|brass|iron|gold/.test(key),patina=/patina|verdigris/.test(key),stone=key.startsWith('stone')||key==='ash';
 const source=key.startsWith('wood')?'wood_table_001':key.startsWith('leather')?'brown_leather':key.startsWith('textile')||key.startsWith('parchment')||key==='banner_heraldry'?'rough_linen':stone?'granite_tile_03':'metal_plate_02';
 const tex=images[source],base=[1,3,5].map(k=>parseInt(hex.slice(k,k+2),16));
 const rough=patina?.90:stone?.91:key.startsWith('textile')?.96:key.startsWith('leather')?.77:metal?(/bright|gold/.test(key)?.36:.61):.75;
 const metallic=patina?.18:metal?(/bright|gold|brass/.test(key)?.85:.70):0;
 materials[key]={slot:index,source,roughness:rough,metalness:metallic};
 const buffers=Array.from({length:4},()=>Buffer.alloc(inner*inner*3));
 for(let y=0;y<inner;y++)for(let x=0;x<inner;x++){
  const p=(y*inner+x)*3,u=x/(inner-1),v=y/(inner-1),gray=(tex.Diffuse[p]+tex.Diffuse[p+1]+tex.Diffuse[p+2])/765;
  const grain=.78+gray*.43,edge=.96+.04*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
  let factor=grain*edge;
  if(key.startsWith('textile'))factor*=.94+.06*Math.cos((u+v)*Math.PI*12);
  const oxidized=patina?Math.max(0,Math.min(1,.6+Math.sin(u*17+Math.cos(v*11))*Math.cos(v*14)*.4)):0;
  for(let c=0;c<3;c++){
   const tint=patina?base[c]*(.75+oxidized*.35)+(1-oxidized)*[95,52,30][c]*.35:base[c];
   buffers[0][p+c]=Math.min(255,Math.round(tint*factor));
   // Very soft normals keep the mineral/hammered grain from sparkling at a distance.
   buffers[2][p+c]=c===2?Math.round(233+tex.nor_gl[p+c]*.085):Math.round(128+(tex.nor_gl[p+c]-128)*.42);
  }
  buffers[1][p]=255;buffers[1][p+1]=Math.min(255,Math.round((rough+(tex.Rough[p]/255-.5)*.15)*255/8)*8);buffers[1][p+2]=Math.round(metallic*255);
  if(key==='amber_glow'||key==='ember_red')for(let c=0;c<3;c++)buffers[3][p+c]=Math.min(255,base[c]*(.7+.3*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)));
 }
 let ornament='';
 if(key==='textile_pattern')ornament=`<rect x="10" y="10" width="208" height="208" fill="none" stroke="#d6ad65" stroke-width="7"/><rect x="19" y="19" width="190" height="190" fill="none" stroke="#ead09a" stroke-width="2" stroke-dasharray="3 4"/>${[49,114,179].map(x=>`<path d="m${x} 61 37 53-37 53-37-53Z" fill="#c39b56"/><path d="m${x} 84 21 30-21 30-21-30Z" fill="#734c35"/>`).join('')}`;
 if(key==='banner_heraldry')ornament='<rect x="9" y="9" width="210" height="210" rx="4" fill="none" stroke="#d0a452" stroke-width="7"/><path d="M20 200h188" stroke="#dec18a" stroke-width="3" stroke-dasharray="5 4"/><circle cx="114" cy="100" r="51" fill="#b4823e"/><path d="m81 126 8-62 11-3-2 65Zm22 8 7-82h12l-2 82Zm29-8-2-65 11 3 8 62Z" fill="#e6bd69"/>';
 if(key==='parchment_map')ornament='<path d="M20 188 52 165 43 126 98 98 120 63 178 42 203 70 163 114 181 160 133 175 99 208M52 165l58-22 53-29M98 98l12 45 23 32M120 63l22 33 36-54" fill="none" stroke="#756145" stroke-width="3"/><path d="M13 13h202v202H13Z" fill="none" stroke="#8b7450" stroke-width="2"/>'+[[52,165],[98,98],[178,42],[181,160],[99,208]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5" fill="#9f684a"/>`).join('')+'<path d="m180 185 0 22m-11-11h22m-16-7 11 14m-11 0 11-14" stroke="#816b4c" stroke-width="2"/>';
 if(key==='stone_carved')ornament='<rect x="17" y="17" width="194" height="194" rx="14" stroke="#b4ad94" stroke-opacity=".6" stroke-width="4" fill="none"/><path d="m76 163 14-93 14-4-7 97Zm27 11 8-121h14l-4 121Zm29-11-1-97 14 4 11 93Z" fill="#494c47"/><path d="m76 161 14-93m13 105 8-121m21 110-1-97" stroke="#c0b49a" stroke-width="3"/>';
 for(let layer=0;layer<4;layer++){
  let pipeline=sharp(buffers[layer],{raw:{width:inner,height:inner,channels:3}});
  if(layer===0&&ornament)pipeline=pipeline.composite([{input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="228" height="228">${ornament}</svg>`)}]);
  layers[layer].push({input:await pipeline.png().toBuffer().then(b=>sharp(b).extend({top:gutter,bottom:gutter,left:gutter,right:gutter,extendWith:'copy'}).png().toBuffer()),left:index%8*size,top:Math.floor(index/8)*size});
 }
}
for(const [index,name]of ['lagto-atlas.png','lagto-orm.png','lagto-normal.png','lagto-emissive.png'].entries()){
 let pipeline=sharp({create:{width:size*8,height:size*4,channels:3,background:'#000000'}}).composite(layers[index]);
 await pipeline.png({palette:index!==2,colours:256,dither:index===0?.12:0,compressionLevel:9}).toFile(`${out}/${name}`);await copyFile(`${out}/${name}`,`${art}/${name}`);
}
const manifest={version:2,credit:'Powered by Poly Haven',licenseUrl:'https://polyhaven.com/license',resolution:[2048,1024],tileSize:size,gutter,materials,sources};
await writeFile(`${out}/sources.json`,JSON.stringify(manifest,null,2)+'\n');await copyFile(`${out}/sources.json`,`${art}/sources.json`);
console.log('Prepared Lagto stone, copper, wood, leather and wool PBR atlases.');

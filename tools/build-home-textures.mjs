// Offline asset preparation. Powered by Poly Haven (https://polyhaven.com).
// Downloads are CC0; the game never contacts Poly Haven.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const directory = 'src/assets/library/brumaluz-home/textures';
const cache = '.art-sources/brumaluz-home';
await mkdir(directory, { recursive: true });
await mkdir(cache, { recursive: true });
const sources = [];
async function source(id, type) {
  const file = `${cache}/${id}-${type}.jpg`;
  let data;
  try { data = await readFile(file); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(`https://api.polyhaven.com/files/${id}`);
    if (!response.ok) throw Error(`Poly Haven: ${response.status}`);
    const files = await response.json();
    const entry = files[type]['1k'].jpg;
    const download = await fetch(entry.url);
    if (!download.ok) throw Error(`Texture download: ${download.status}`);
    data = Buffer.from(await download.arrayBuffer());
    if (createHash('md5').update(data).digest('hex') !== entry.md5) throw Error('Texture checksum mismatch');
    await writeFile(file, data);
  }
  sources.push({ asset: id, map: type, url: `https://polyhaven.com/a/${id}`, sha256: createHash('sha256').update(data).digest('hex') });
  return data;
}
const wood = await source('wood_table_001', 'Diffuse');
const linen = await source('rough_linen', 'Diffuse');
const woodRoughness = await source('wood_table_001', 'Rough');
const linenRoughness = await source('rough_linen', 'Rough');
const tile = 512, gutter = 16, inside = tile - gutter * 2;
const svg = body => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480">${body}</svg>`);
const rug = svg(`<rect width="480" height="480" fill="#a75a3b"/><rect x="20" y="20" width="440" height="440" rx="5" fill="none" stroke="#dcc291" stroke-width="9"/><rect x="38" y="38" width="404" height="404" fill="#51614c"/>${Array.from({length:9},(_,i)=>`<path d="M${52+i*45} 45v390" stroke="#d7c6a0" stroke-opacity=".12" stroke-width="2"/>`).join('')}<path d="M240 74 406 240 240 406 74 240Z" fill="#d2ad73"/><path d="M240 101 379 240 240 379 101 240Z" fill="#a75a3b"/><path d="M240 147 333 240 240 333 147 240Z" fill="#e2c492"/><path d="M240 186 294 240 240 294 186 240Z" fill="#546750"/>${[65,415].flatMap(x=>[65,415].map(y=>`<path d="m${x} ${y-15} 15 15-15 15-15-15Z" fill="#dbc18c"/>`)).join('')}`);
const plain = color => sharp({create:{width:inside,height:inside,channels:3,background:color}}).png().toBuffer();
const neutralWood = await sharp(wood).resize(inside,inside).grayscale().linear(.65,175).png().toBuffer();
const neutralLinen = await sharp(linen).resize(inside,inside).grayscale().linear(.40,149).png().toBuffer();
const overlay=async(base,body)=>sharp(base).composite([{input:svg(body)}]).png().toBuffer();
const stitches='<rect x="19" y="19" width="442" height="442" rx="17" fill="none" stroke="#f2e8ce" stroke-width="3" stroke-dasharray="6 7"/><rect x="30" y="30" width="420" height="420" rx="14" fill="none" stroke="#675f50" stroke-opacity=".27" stroke-width="3"/>';
const embroidered=await overlay(neutralLinen,`${stitches}<path d="M240 360q-35-100 0-236" fill="none" stroke="#f4e8cb" stroke-width="7" stroke-linecap="round"/>${Array.from({length:6},(_,i)=>{const y=155+i*31,side=i%2?1:-1;return `<path d="M240 ${y+29}q${side*77} -2 ${side*58} -42-42 -5-58 42" fill="#eee2c6" opacity=".8"/>`;}).join('')}<path d="m228 113 12-21 12 21-12 21Z" fill="#f4e8cb"/>`);
const wicker=svg(`<rect width="480" height="480" fill="#bba078"/>${Array.from({length:24},(_,y)=>Array.from({length:24},(_,x)=>{const even=(x+y)%2===0;return `<rect x="${x*20}" y="${y*20}" width="${even?18:20}" height="${even?20:18}" rx="3" fill="${even?'#dec49a':'#ac8959'}"/><path d="M${x*20+3} ${y*20+3}h13" stroke="#f0d4a4" stroke-opacity=".5" stroke-width="2"/>`;}).join('')).join('')}`);
const carved=await overlay(neutralWood,`<rect x="22" y="22" width="436" height="436" rx="27" fill="none" stroke="#6a573d" stroke-opacity=".55" stroke-width="9"/><rect x="28" y="28" width="424" height="424" rx="23" fill="none" stroke="#fff0cb" stroke-opacity=".65" stroke-width="3"/><path d="M105 342q130-220 270-214M185 255q-64-3-60-69 61 5 60 69Zm43-44q-8-71 59-79 0 63-59 79Zm38-30q72 4 78 63-65 8-78-63Z" fill="none" stroke="#69583e" stroke-opacity=".56" stroke-width="10"/><path d="M108 338q130-220 270-214" fill="none" stroke="#fff1cd" stroke-opacity=".7" stroke-width="3"/>`);
const ceramic=svg(`<rect width="480" height="480" fill="#e8dfc7"/><path d="M0 52h480M0 74h480M0 392h480M0 414h480" stroke="#728a84" stroke-width="10"/><path d="M0 92h480M0 373h480" stroke="#b3a37a" stroke-width="4"/>${Array.from({length:6},(_,i)=>`<g transform="translate(${40+i*80} 245)"><path d="M0 45Q-10-10 8-55" stroke="#71857a" stroke-width="6" fill="none"/><path d="M-2 16q-42 4-31-28 28-7 31 28ZM1-5q35 1 34-30-28-8-34 30Z" fill="#8c9c82"/><circle cx="8" cy="-55" r="11" fill="#c09b70"/></g>`).join('')}`);
const leather=await overlay(neutralLinen,`<rect width="480" height="480" fill="#b8aa92" fill-opacity=".30"/>${stitches}`);
const book=await overlay(leather,`<rect x="46" y="34" width="388" height="412" rx="23" fill="none" stroke="#e7ca8c" stroke-width="7"/><path d="M68 110h344M68 370h344" stroke="#e8d19c" stroke-width="10"/><path d="m240 166 63 74-63 74-63-74Z" fill="none" stroke="#e7ca8c" stroke-width="6"/><path d="M213 250q27-75 54 0m-41-6 14 31 14-31" fill="none" stroke="#e7ca8c" stroke-width="5"/>`);
const endgrain=svg(`<rect width="480" height="480" fill="#ddd0b4"/>${Array.from({length:16},(_,i)=>`<ellipse cx="220" cy="249" rx="${18+i*17}" ry="${12+i*15}" fill="none" stroke="#9b8968" stroke-opacity="${i%3===0?.4:.20}" stroke-width="3"/>`).join('')}`);
const paper=svg(`<rect width="480" height="480" fill="#efe5cc"/>${Array.from({length:64},(_,i)=>`<path d="M4 ${i*7.5}q220 ${i%3-1} 472 0" stroke="#9d9276" stroke-opacity=".22" stroke-width="${i%5===0?2:1}"/>`).join('')}<rect x="5" y="5" width="470" height="470" fill="none" stroke="#a5946e" stroke-opacity=".2" stroke-width="10"/>`);
const forged=svg(`<rect width="480" height="480" fill="#b7b8af"/>${Array.from({length:150},(_,i)=>`<ellipse cx="${(i*179+17)%480}" cy="${(i*137+49)%480}" rx="${4+i%7}" ry="${3+i%5}" fill="${i%2?'#d3d1c6':'#939890'}" opacity=".22"/>`).join('')}`);
const clay=svg(`<rect width="480" height="480" fill="#e1cdbb"/>${Array.from({length:22},(_,i)=>`<path d="M0 ${i*24}q160 7 480 0" fill="none" stroke="${i%2?'#f2ddc4':'#c6ad94'}" stroke-opacity=".22" stroke-width="3"/>`).join('')}`);
const leaf=svg('<rect width="480" height="480" fill="#d3dfb8"/><path d="M55 240h370" stroke="#a8ba89" stroke-width="7"/>'+Array.from({length:7},(_,i)=>`<path d="m${90+i*46} 240 64-111m-64 111 64 111" fill="none" stroke="#b7c89a" stroke-width="5"/>`).join(''));
const rugBase = await sharp(rug).removeAlpha().raw().toBuffer();
const weave = await sharp(linen).resize(inside,inside).grayscale().raw().toBuffer();
for(let p=0;p<inside*inside;p++) for(let c=0;c<3;c++) rugBase[p*3+c] *= .88 + weave[p]/255*.15;
const tiles = [neutralWood,neutralLinen,forged,clay,await plain('#ffffff'),await sharp(rugBase,{raw:{width:inside,height:inside,channels:3}}).png().toBuffer(),leaf,await plain('#ffca71'),embroidered,wicker,carved,ceramic,leather,book,endgrain,paper];
async function atlas(images, path) {
  const inputs = [];
  for(let i=0;i<images.length;i++) inputs.push({input:await sharp(images[i]).resize(inside,inside).extend({top:gutter,bottom:gutter,left:gutter,right:gutter,extendWith:'copy'}).png().toBuffer(),left:i%4*tile,top:Math.floor(i/4)*tile});
  await sharp({create:{width:tile*4,height:tile*4,channels:3,background:'#ffffff'}}).composite(inputs).png({compressionLevel:9,palette:true,colours:256,dither:path==='home-color.png'?.15:0}).toFile(`${directory}/${path}`);
}
await atlas(tiles,'home-color.png');
const roughImages = [woodRoughness,linenRoughness,null,null,null,linenRoughness,null,null,linenRoughness,null,woodRoughness,null,linenRoughness,null,woodRoughness,null];
const roughFactors = [.67,.93,.58,.86,.72,.95,.83,.44,.96,.89,.70,.4,.78,.70,.85,.94],metalness=[0,0,.68,0,0,0,0,0,0,0,0,0,0,0,0,0];
const orm=[];
for(let i=0;i<16;i++) {
 const data=Buffer.alloc(inside*inside*3);
 const rough=roughImages[i]?await sharp(roughImages[i]).resize(inside,inside).grayscale().raw().toBuffer():null;
 for(let p=0;p<inside*inside;p++){data[p*3]=255;data[p*3+1]=Math.min(255,Math.round(255*Math.min(1,Math.max(.3,roughFactors[i]+(rough?rough[p]/255-.5:0)*.18))/8)*8);data[p*3+2]=Math.round(metalness[i]*255);}
 orm.push(await sharp(data,{raw:{width:inside,height:inside,channels:3}}).png().toBuffer());
}
await atlas(orm,'home-orm.png');
await atlas(await Promise.all(Array.from({length:16},(_,i)=>plain(i===7?'#ffad48':'#000000'))),'home-emissive.png');
await writeFile(`${directory}/sources.json`,JSON.stringify({license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',credit:'Powered by Poly Haven',authors:{wood_table_001:['Dimitrios Savva','Rico Cilliers'],rough_linen:['colormass','Rico Cilliers']},processing:'Grayscale wood/linen for vertex tinting; original rug design; padded 512px atlas tiles; packed AO/roughness/metalness. No runtime external requests.',sources},null,2)+'\n');
console.log('Prepared three 2048 × 2048 home furniture atlases: sixteen crafted surfaces.');

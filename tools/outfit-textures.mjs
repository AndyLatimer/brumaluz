// Small hand-authored material patterns: muted, readable on the game's faceted meshes.
import { deflateSync } from 'node:zlib';
const crc = bytes => { let n=0xffffffff; for(const byte of bytes){n^=byte;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0)}return (n^0xffffffff)>>>0; };
const chunk=(type,data)=>{const t=Buffer.from(type),h=Buffer.alloc(4),c=Buffer.alloc(4);h.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([h,t,data,c])};
function png(size,pixel){
 const rows=Buffer.alloc((size*4+1)*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const at=y*(size*4+1)+1+x*4;rows.set([...pixel(x,y),255],at)}
 const head=Buffer.alloc(13);head.writeUInt32BE(size);head.writeUInt32BE(size,4);head[8]=8;head[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
export function outfitTexture(material, theme){
 const metal=['plate','brass'].includes(material), trim=material==='tunicTrim', leather=/leather|sole/i.test(material);
 return png(256,(x,y)=>{
  // A small repeating weave compresses well inside all 50 portable GLBs.
  const grain=(((x%16)*3+(y%16)*5)%11)/11;
  let v=metal ? 220+grain*9+Math.sin(y*.21)*4 : leather ? 210+grain*18 : 224+grain*10+((x+y)%4===0?8:0);
  if(metal && y%61===0 && x%7<4)v-=20;
  if(leather && (y%64===4||y%64===59) && x%12<7)v+=20;
  if(trim){
   const edge=x%64;v=214+grain*8;
   if(edge<4||edge>59)v=247;
   const dx=Math.abs(edge-32), dy=Math.abs(y%48-24);
   if(theme===7 ? (dx<3&&dy<16)||(Math.abs(dx-dy*.5)<3&&dy<14)
     : theme===8 ? Math.abs(Math.hypot(dx,dy)-17)<2&&dy<16
     : theme===6 ? Math.abs(Math.hypot(dx-5,dy)-12)<2
     : theme===9 ? (dx<13&&dy<13&&(dx>9||dy>9))
     : Math.abs(dx+dy-16)<3)v=252;
  }
  v=Math.max(0,Math.min(254,Math.round(v/2)*2));
  return [v,Math.min(255,v+1),Math.min(255,v+3)];
 });
}
